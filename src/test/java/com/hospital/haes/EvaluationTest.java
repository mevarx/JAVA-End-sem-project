package com.hospital.haes;

import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyType;
import com.hospital.haes.model.Patient;
import com.hospital.haes.model.Severity;
import com.hospital.haes.model.Slot;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Produces the measured numbers quoted in docs/EVALUATION.md. The assertions
 * keep the evaluation honest: a passing build proves the target was met.
 */
class EvaluationTest {

    @TempDir
    Path tempDir;

    @Test
    @DisplayName("Evaluation: 50-way booking race has exactly one winner")
    void bookingRaceMetrics() throws Exception {
        TestFixture fixture = new TestFixture(tempDir);
        ExecutorService pool = Executors.newFixedThreadPool(50);
        try {
            Slot slot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);
            List<Patient> patients = fixture.createPatients(50);
            CountDownLatch ready = new CountDownLatch(50);
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Boolean>> futures = new ArrayList<>();
            for (Patient patient : patients) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await(10, TimeUnit.SECONDS);
                    try {
                        fixture.appointmentService.book(patient.getId(), slot.getId(), "race");
                        return true;
                    } catch (SlotConflictException expected) {
                        return false;
                    }
                }));
            }
            assertTrue(ready.await(20, TimeUnit.SECONDS));
            long began = System.nanoTime();
            start.countDown();
            int successes = 0;
            for (Future<Boolean> future : futures) {
                if (future.get(30, TimeUnit.SECONDS)) {
                    successes++;
                }
            }
            long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - began);

            List<Appointment> persisted = fixture.appointmentDao.findAll().stream()
                    .filter(appointment -> appointment.getSlotId() == slot.getId())
                    .toList();
            int doubleBookings = Math.max(0, persisted.size() - 1);
            assertEquals(1, successes);
            assertEquals(1, persisted.size(), "Exactly one appointment row must survive the race");
            System.out.printf("[EVAL] booking race: attempts=50 successes=%d doubleBookings=%d elapsedMs=%d%n",
                    successes, doubleBookings, elapsedMillis);
        } finally {
            pool.shutdownNow();
            fixture.close();
        }
    }

    @Test
    @DisplayName("Evaluation: mixed emergency dispatch stays under the 1 second target")
    void dispatchLatencyMetrics() throws Exception {
        TestFixture fixture = new TestFixture(tempDir, 8, 30);
        try {
            fixture.deactivate(fixture.erStaff);
            List<Doctor> doctors = new ArrayList<>();
            doctors.add(fixture.doctor);
            for (int i = 0; i < 7; i++) {
                doctors.add(fixture.createDoctor("eval.doctor." + i, "Cardiology"));
            }
            Severity[] severities = {
                    Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.CRITICAL,
                    Severity.HIGH, Severity.MEDIUM, Severity.CRITICAL, Severity.HIGH
            };
            List<EmergencyCase> raised = new ArrayList<>();
            for (int i = 0; i < doctors.size(); i++) {
                raised.add(fixture.emergencyService.raiseEmergency(null, "Eval case " + i,
                        EmergencyType.CARDIAC, severities[i], "ER bay " + i,
                        fixture.admin.getId()));
            }

            int dispatched = fixture.emergencyService.dispatchPendingNow();

            assertEquals(doctors.size(), dispatched);
            long totalMillis = 0;
            long maxMillis = 0;
            for (EmergencyCase emergencyCase : fixture.emergencyService.getAllCases()) {
                long millis = Duration.between(emergencyCase.getRaisedAt(),
                        emergencyCase.getDispatchedAt()).toMillis();
                totalMillis += millis;
                maxMillis = Math.max(maxMillis, millis);
            }
            long averageMillis = totalMillis / raised.size();
            assertTrue(maxMillis < 1_000, "Dispatch latency exceeded NFR-2 target");

            System.out.printf("[EVAL] emergency dispatch: cases=%d avgLatencyMs=%d maxLatencyMs=%d%n",
                    raised.size(), averageMillis, maxMillis);
        } finally {
            fixture.close();
        }
    }
}
