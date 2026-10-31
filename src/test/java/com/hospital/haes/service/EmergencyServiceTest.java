package com.hospital.haes.service;

import com.hospital.haes.TestFixture;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyStatus;
import com.hospital.haes.model.EmergencyType;
import com.hospital.haes.model.NotificationLevel;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Severity;
import com.hospital.haes.model.SlotStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmergencyServiceTest {

    @TempDir
    Path tempDir;

    private TestFixture fixture;

    @AfterEach
    void tearDown() {
        if (fixture != null) {
            fixture.close();
        }
    }

    @Test
    @DisplayName("Raising an emergency persists the case, an event and an audit line")
    void raisePersistsCaseAndAuditTrail() throws Exception {
        fixture = new TestFixture(tempDir);

        EmergencyCase raised = fixture.emergencyService.raiseEmergency(
                fixture.patient.getId(), null, EmergencyType.CARDIAC, Severity.HIGH,
                "Ward 3", fixture.admin.getId());

        assertTrue(raised.getId() > 0);
        assertEquals(EmergencyStatus.WAITING, raised.getStatus());
        assertEquals(fixture.patient.getFullName(), raised.getPatientLabel());
        assertTrue(fixture.emergencyDao.findById(raised.getId()).isPresent());

        assertEquals("RAISED", fixture.emergencyService.getEvents(raised.getId()).get(0).getEventType());
        String audit = Files.readString(fixture.auditLog.getLogFile());
        assertTrue(audit.contains("RAISED"));
        assertTrue(audit.contains("EMERGENCY id=" + raised.getId()));

        assertTrue(fixture.notifications.getHistory().stream().anyMatch(n ->
                n.getLevel() == NotificationLevel.WARNING
                        && n.getMessage().contains("New HIGH Cardiac emergency")));
    }

    @Test
    @DisplayName("Emergency input is validated before anything is stored")
    void validatesEmergencyInput() throws Exception {
        fixture = new TestFixture(tempDir);
        EmergencyService service = fixture.emergencyService;

        assertThrows(ValidationException.class, () -> service.raiseEmergency(
                null, "Walk-in", null, Severity.HIGH, "ER", fixture.admin.getId()));
        assertThrows(ValidationException.class, () -> service.raiseEmergency(
                null, "Walk-in", EmergencyType.OTHER, null, "ER", fixture.admin.getId()));
        assertThrows(ValidationException.class, () -> service.raiseEmergency(
                null, "Walk-in", EmergencyType.OTHER, Severity.HIGH, "   ", fixture.admin.getId()));
        assertThrows(ValidationException.class, () -> service.raiseEmergency(
                null, "Walk-in", EmergencyType.OTHER, Severity.HIGH,
                "x".repeat(121), fixture.admin.getId()));
        assertThrows(ValidationException.class, () -> service.raiseEmergency(
                999_999, "Ghost", EmergencyType.OTHER, Severity.HIGH,
                "ER", fixture.admin.getId()));

        assertTrue(service.getAllCases().isEmpty());
        assertEquals(0, service.getQueueSize());
    }

    @Test
    @DisplayName("Dispatch assigns a responder and a bed, then records the event")
    void dispatchAssignsResponderAndBed() throws Exception {
        fixture = new TestFixture(tempDir);
        EmergencyCase raised = fixture.emergencyService.raiseEmergency(
                fixture.patient.getId(), null, EmergencyType.CARDIAC, Severity.HIGH,
                "ER bay 2", fixture.admin.getId());

        int dispatched = fixture.emergencyService.dispatchPendingNow();

        assertEquals(1, dispatched);
        EmergencyCase assigned = fixture.emergencyService.findById(raised.getId()).orElseThrow();
        assertEquals(EmergencyStatus.ASSIGNED, assigned.getStatus());
        assertEquals(fixture.doctor.getId(), assigned.getAssignedTo());
        assertEquals(fixture.doctor.getFullName(), assigned.getAssignedToName());
        assertEquals(1, assigned.getBedNo());
        assertNotNull(assigned.getDispatchedAt());
        assertEquals(7, fixture.emergencyService.getBedPool().availableBeds());
        assertEquals(0, fixture.emergencyService.getQueueSize());

        List<String> eventTypes = fixture.emergencyService.getEvents(raised.getId()).stream()
                .map(event -> event.getEventType()).toList();
        assertEquals(List.of("RAISED", "DISPATCHED"), eventTypes);
        assertTrue(fixture.emergencyService.getEvents(raised.getId()).get(1).getNote()
                .contains("Bed #1 reserved"));

        String audit = Files.readString(fixture.auditLog.getLogFile());
        assertTrue(audit.contains("DISPATCHED"));

        assertTrue(fixture.notifications.getHistoryFor(fixture.doctor.getId()).stream()
                .anyMatch(n -> n.getLevel() == NotificationLevel.WARNING
                        && n.getMessage().contains("EMERGENCY #" + raised.getId())));
        assertTrue(fixture.emergencyService.getAverageDispatchMillis().isPresent());
        assertEquals(1, fixture.emergencyService.findByPatient(fixture.patient.getId()).size());
        assertFalse(fixture.emergencyService.getRecentEvents(10).isEmpty());
    }

    @Test
    @DisplayName("Critical cases are dispatched before High before Medium")
    void priorityOrderIsRespected() throws Exception {
        fixture = new TestFixture(tempDir);
        fixture.deactivate(fixture.erStaff);

        EmergencyCase medium = fixture.emergencyService.raiseEmergency(
                null, "Medium patient", EmergencyType.OTHER, Severity.MEDIUM,
                "ER", fixture.admin.getId());
        EmergencyCase high = fixture.emergencyService.raiseEmergency(
                null, "High patient", EmergencyType.OTHER, Severity.HIGH,
                "ER", fixture.admin.getId());
        EmergencyCase critical = fixture.emergencyService.raiseEmergency(
                null, "Critical patient", EmergencyType.OTHER, Severity.CRITICAL,
                "ER", fixture.admin.getId());

        assertEquals(1, fixture.emergencyService.dispatchPendingNow());
        assertEquals(EmergencyStatus.ASSIGNED,
                fixture.emergencyService.findById(critical.getId()).orElseThrow().getStatus());
        assertEquals(EmergencyStatus.WAITING,
                fixture.emergencyService.findById(high.getId()).orElseThrow().getStatus());
        assertEquals(EmergencyStatus.WAITING,
                fixture.emergencyService.findById(medium.getId()).orElseThrow().getStatus());
        assertEquals(2, fixture.emergencyService.getQueueSize());

        fixture.emergencyService.resolve(critical.getId(), fixture.doctor.getId(),
                Role.DOCTOR, "Critical case handled");
        assertEquals(1, fixture.emergencyService.dispatchPendingNow());
        assertEquals(EmergencyStatus.ASSIGNED,
                fixture.emergencyService.findById(high.getId()).orElseThrow().getStatus());
        assertEquals(EmergencyStatus.WAITING,
                fixture.emergencyService.findById(medium.getId()).orElseThrow().getStatus());

        fixture.emergencyService.resolve(high.getId(), fixture.doctor.getId(),
                Role.DOCTOR, "High case handled");
        assertEquals(1, fixture.emergencyService.dispatchPendingNow());
        assertEquals(EmergencyStatus.ASSIGNED,
                fixture.emergencyService.findById(medium.getId()).orElseThrow().getStatus());
        assertEquals(0, fixture.emergencyService.getQueueSize());
    }

    @Test
    @DisplayName("Acknowledge and resolve enforce assignment and release the bed")
    void acknowledgeAndResolveLifecycle() throws Exception {
        fixture = new TestFixture(tempDir);
        EmergencyCase raised = fixture.emergencyService.raiseEmergency(
                fixture.patient.getId(), null, EmergencyType.CARDIAC, Severity.HIGH,
                "ER", fixture.admin.getId());
        fixture.emergencyService.dispatchPendingNow();

        assertThrows(UnauthorizedActionException.class,
                () -> fixture.emergencyService.acknowledge(raised.getId(), fixture.patient.getId()));

        EmergencyCase acknowledged = fixture.emergencyService.acknowledge(
                raised.getId(), fixture.doctor.getId());
        assertEquals(EmergencyStatus.ACKNOWLEDGED, acknowledged.getStatus());
        assertNotNull(acknowledged.getAcknowledgedAt());
        assertEquals(7, fixture.emergencyService.getBedPool().availableBeds());

        assertThrows(InvalidBookingException.class,
                () -> fixture.emergencyService.acknowledge(raised.getId(), fixture.doctor.getId()));
        assertThrows(UnauthorizedActionException.class,
                () -> fixture.emergencyService.resolve(raised.getId(), fixture.patient.getId(),
                        Role.PATIENT, "Not mine"));

        EmergencyCase resolved = fixture.emergencyService.resolve(
                raised.getId(), fixture.doctor.getId(), Role.DOCTOR, "Stabilised");
        assertEquals(EmergencyStatus.RESOLVED, resolved.getStatus());
        assertNotNull(resolved.getResolvedAt());
        assertEquals(8, fixture.emergencyService.getBedPool().availableBeds());

        assertThrows(InvalidBookingException.class,
                () -> fixture.emergencyService.resolve(raised.getId(), fixture.admin.getId(),
                        Role.ADMIN, "Again"));
        assertEquals(List.of("RAISED", "DISPATCHED", "ACKNOWLEDGED", "RESOLVED"),
                fixture.emergencyService.getEvents(raised.getId()).stream()
                        .map(event -> event.getEventType()).toList());
    }

    @Test
    @DisplayName("An unacknowledged case escalates to an alternate responder")
    void escalationReassignsToAlternateResponder() throws Exception {
        fixture = new TestFixture(tempDir, 8, 0);
        EmergencyCase raised = fixture.emergencyService.raiseEmergency(
                fixture.patient.getId(), null, EmergencyType.CARDIAC, Severity.HIGH,
                "ER", fixture.admin.getId());
        fixture.emergencyService.dispatchPendingNow();

        int escalated = fixture.emergencyService.scanEscalations();

        assertEquals(1, escalated);
        EmergencyCase updated = fixture.emergencyService.findById(raised.getId()).orElseThrow();
        assertEquals(EmergencyStatus.ESCALATED, updated.getStatus());
        assertEquals(1, updated.getEscalationCount());
        assertEquals(fixture.erStaff.getId(), updated.getAssignedTo());
        assertEquals(fixture.erStaff.getFullName(), updated.getAssignedToName());
        assertNull(updated.getAcknowledgedAt());
        assertNotNull(updated.getDispatchedAt());

        String note = fixture.emergencyService.getEvents(raised.getId()).stream()
                .filter(event -> event.getEventType().equals("ESCALATED"))
                .findFirst().orElseThrow().getNote();
        assertTrue(note.contains("timeout exceeded"));
        assertTrue(fixture.notifications.getHistoryFor(fixture.erStaff.getId()).stream()
                .anyMatch(n -> n.getLevel() == NotificationLevel.CRITICAL
                        && n.getMessage().contains("ESCALATED")));
    }

    @Test
    @DisplayName("Without an alternate responder the case is still escalated and the duty head is warned")
    void escalationWithoutAlternateKeepsResponder() throws Exception {
        fixture = new TestFixture(tempDir, 8, 0);
        fixture.deactivate(fixture.erStaff);
        EmergencyCase raised = fixture.emergencyService.raiseEmergency(
                fixture.patient.getId(), null, EmergencyType.CARDIAC, Severity.HIGH,
                "ER", fixture.admin.getId());
        fixture.emergencyService.dispatchPendingNow();

        assertEquals(1, fixture.emergencyService.scanEscalations());

        EmergencyCase updated = fixture.emergencyService.findById(raised.getId()).orElseThrow();
        assertEquals(EmergencyStatus.ESCALATED, updated.getStatus());
        assertEquals(1, updated.getEscalationCount());
        assertEquals(fixture.doctor.getId(), updated.getAssignedTo());
        assertTrue(fixture.emergencyService.getEvents(raised.getId()).stream()
                .anyMatch(event -> event.getEventType().equals("ESCALATED")
                        && event.getNote().contains("No alternate responder")));
        assertTrue(fixture.notifications.getHistory().stream()
                .anyMatch(n -> n.getLevel() == NotificationLevel.CRITICAL
                        && n.getMessage().contains("NOT been acknowledged")));
    }

    @Test
    @DisplayName("A Critical case pre-empts an in-progress routine appointment")
    void criticalPreemptsInProgressAppointment() throws Exception {
        fixture = new TestFixture(tempDir);
        fixture.deactivate(fixture.erStaff);
        Appointment routine = fixture.createInProgressAppointment(fixture.doctor, fixture.patient);
        EmergencyCase critical = fixture.emergencyService.raiseEmergency(
                fixture.patient.getId(), null, EmergencyType.CARDIAC, Severity.CRITICAL,
                "Resus room", fixture.admin.getId());

        assertEquals(1, fixture.emergencyService.dispatchPendingNow());

        Appointment preempted = fixture.appointmentDao.findById(routine.getId()).orElseThrow();
        assertEquals(AppointmentStatus.PRE_EMPTED, preempted.getStatus());
        assertEquals(SlotStatus.FREE,
                fixture.slotDao.findById(routine.getSlotId()).orElseThrow().getStatus());
        assertEquals(List.of(routine.getId()),
                fixture.appointmentService.getWaitlistSnapshot().stream()
                        .map(Appointment::getId).toList());

        EmergencyCase assigned = fixture.emergencyService.findById(critical.getId()).orElseThrow();
        assertEquals(EmergencyStatus.ASSIGNED, assigned.getStatus());
        assertEquals(fixture.doctor.getId(), assigned.getAssignedTo());
        assertTrue(fixture.emergencyService.getEvents(critical.getId()).stream()
                .anyMatch(event -> event.getEventType().equals("DISPATCHED")
                        && event.getNote().contains("pre-empted appointment #" + routine.getId())));
        assertTrue(fixture.notifications.getHistoryFor(fixture.patient.getId()).stream()
                .anyMatch(n -> n.getLevel() == NotificationLevel.CRITICAL
                        && n.getMessage().contains("pre-empted")));
    }

    @Test
    @DisplayName("A High case does not pre-empt a routine appointment")
    void nonCriticalDoesNotPreempt() throws Exception {
        fixture = new TestFixture(tempDir);
        fixture.deactivate(fixture.erStaff);
        Appointment routine = fixture.createInProgressAppointment(fixture.doctor, fixture.patient);
        EmergencyCase high = fixture.emergencyService.raiseEmergency(
                fixture.patient.getId(), null, EmergencyType.CARDIAC, Severity.HIGH,
                "ER", fixture.admin.getId());

        assertEquals(0, fixture.emergencyService.dispatchPendingNow());

        assertEquals(EmergencyStatus.WAITING,
                fixture.emergencyService.findById(high.getId()).orElseThrow().getStatus());
        assertEquals(AppointmentStatus.BOOKED,
                fixture.appointmentDao.findById(routine.getId()).orElseThrow().getStatus());
        assertEquals(1, fixture.emergencyService.getQueueSize());
        assertEquals(8, fixture.emergencyService.getBedPool().availableBeds());
        assertTrue(fixture.appointmentService.getWaitlistSnapshot().isEmpty());
    }

    @Test
    @DisplayName("A full bed pool delays dispatch until a bed is released")
    void exhaustedBedsDelayDispatch() throws Exception {
        fixture = new TestFixture(tempDir, 1, 30);
        EmergencyCase first = fixture.emergencyService.raiseEmergency(
                null, "First", EmergencyType.OTHER, Severity.HIGH, "ER", fixture.admin.getId());
        EmergencyCase second = fixture.emergencyService.raiseEmergency(
                null, "Second", EmergencyType.OTHER, Severity.HIGH, "ER", fixture.admin.getId());

        assertEquals(1, fixture.emergencyService.dispatchPendingNow());
        assertEquals(EmergencyStatus.ASSIGNED,
                fixture.emergencyService.findById(first.getId()).orElseThrow().getStatus());
        assertEquals(1, fixture.emergencyService.findById(first.getId()).orElseThrow().getBedNo());
        assertEquals(0, fixture.emergencyService.getBedPool().availableBeds());

        assertEquals(0, fixture.emergencyService.dispatchPendingNow());
        assertEquals(EmergencyStatus.WAITING,
                fixture.emergencyService.findById(second.getId()).orElseThrow().getStatus());
        assertEquals(1, fixture.emergencyService.getQueueSize());

        fixture.emergencyService.resolve(first.getId(), fixture.doctor.getId(),
                Role.DOCTOR, "Bed released");
        assertEquals(1, fixture.emergencyService.getBedPool().availableBeds());
        assertEquals(1, fixture.emergencyService.dispatchPendingNow());
        EmergencyCase assignedSecond = fixture.emergencyService.findById(second.getId()).orElseThrow();
        assertEquals(EmergencyStatus.ASSIGNED, assignedSecond.getStatus());
        assertEquals(1, assignedSecond.getBedNo());
        assertTrue(assignedSecond.getAssignedTo() != null);
    }
}
