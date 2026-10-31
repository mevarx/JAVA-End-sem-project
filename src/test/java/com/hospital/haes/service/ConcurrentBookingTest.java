package com.hospital.haes.service;

import com.hospital.haes.TestFixture;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.model.Patient;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class ConcurrentBookingTest {

    private static final int THREADS = 50;

    @TempDir
    Path tempDir;

    private TestFixture fixture;

    @BeforeEach
    void setUp() throws Exception {
        fixture = new TestFixture(tempDir);
    }

    @AfterEach
    void tearDown() {
        fixture.close();
    }

    @Test
    @DisplayName("AC-1: 50 concurrent bookings for one slot produce exactly one winner")
    void onlyOneConcurrentBookingWins() throws Exception {
        Slot slot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);
        List<Patient> patients = fixture.createPatients(THREADS);
        ExecutorService pool = Executors.newFixedThreadPool(THREADS, runnable -> {
            Thread thread = new Thread(runnable, "booking-race");
            thread.setDaemon(true);
            return thread;
        });
        CountDownLatch ready = new CountDownLatch(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();

        try {
            for (Patient patient : patients) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    if (!start.await(15, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Race start was never released");
                    }
                    try {
                        fixture.appointmentService.book(patient.getId(), slot.getId(),
                                "Concurrent booking for " + patient.getUsername());
                        return true;
                    } catch (SlotConflictException expected) {
                        return false;
                    }
                }));
            }

            assertTrue(ready.await(20, TimeUnit.SECONDS), "Not all booking threads started");
            start.countDown();

            int successes = 0;
            int conflicts = 0;
            for (Future<Boolean> future : futures) {
                try {
                    if (future.get(30, TimeUnit.SECONDS)) {
                        successes++;
                    } else {
                        conflicts++;
                    }
                } catch (ExecutionException e) {
                    fail("A booking thread failed unexpectedly: " + e.getCause(), e.getCause());
                }
            }

            assertEquals(1, successes, "Exactly one thread must win the slot");
            assertEquals(THREADS - 1, conflicts, "Every other thread must receive a conflict");
            assertEquals(1, fixture.appointmentDao.findAll().size(),
                    "The database must contain exactly one appointment");
            assertEquals(SlotStatus.BOOKED,
                    fixture.slotDao.findById(slot.getId()).orElseThrow().getStatus());
        } finally {
            pool.shutdownNow();
            pool.awaitTermination(10, TimeUnit.SECONDS);
        }
    }
}
