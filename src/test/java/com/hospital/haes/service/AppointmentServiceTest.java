package com.hospital.haes.service;

import com.hospital.haes.TestFixture;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.Notification;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AppointmentServiceTest {

    @TempDir
    Path tempDir;

    private TestFixture fixture;
    private AppointmentService service;

    @BeforeEach
    void setUp() throws Exception {
        fixture = new TestFixture(tempDir);
        service = fixture.appointmentService;
    }

    @AfterEach
    void tearDown() {
        fixture.close();
    }

    @Test
    @DisplayName("Booking persists a BOOKED appointment and marks the slot BOOKED")
    void booksAppointmentAndMarksSlotBooked() throws Exception {
        Slot slot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);

        Appointment appointment = service.book(fixture.patient.getId(), slot.getId(), "Annual check-up");

        assertTrue(appointment.getId() > 0);
        assertEquals(AppointmentStatus.BOOKED, appointment.getStatus());
        assertEquals(fixture.patient.getId(), appointment.getPatientId());
        assertEquals(slot.getId(), appointment.getSlotId());

        Appointment stored = service.findById(appointment.getId()).orElseThrow();
        assertEquals(AppointmentStatus.BOOKED, stored.getStatus());
        assertEquals("Annual check-up", stored.getReason());
        assertEquals(SlotStatus.BOOKED,
                fixture.slotDao.findById(slot.getId()).orElseThrow().getStatus());

        List<Notification> patientFeed = fixture.notifications.getHistoryFor(fixture.patient.getId());
        assertTrue(patientFeed.stream()
                .anyMatch(n -> n.getMessage().contains("Appointment confirmed")));
        List<Notification> doctorFeed = fixture.notifications.getHistoryFor(fixture.doctor.getId());
        assertTrue(doctorFeed.stream().anyMatch(n -> n.getMessage().contains("New appointment")));
    }

    @Test
    @DisplayName("AC-1: a slot can never be booked twice")
    void rejectsDoubleBooking() throws Exception {
        Slot slot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);
        service.book(fixture.patient.getId(), slot.getId(), "First visit");

        assertThrows(SlotConflictException.class,
                () -> service.book(fixture.patient2.getId(), slot.getId(), "Second visit"));

        assertEquals(1, fixture.appointmentDao.findAll().size());
        assertEquals(SlotStatus.BOOKED,
                fixture.slotDao.findById(slot.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("A patient cannot hold two overlapping appointments")
    void rejectsOverlappingAppointmentForSamePatient() throws Exception {
        LocalDateTime start = fixture.nextStart();
        Slot first = fixture.createSlot(fixture.doctor.getId(), start, 30);
        Slot overlapping = fixture.createSlot(fixture.doctor.getId(), start.plusMinutes(15), 30);

        service.book(fixture.patient.getId(), first.getId(), "First");

        assertThrows(SlotConflictException.class,
                () -> service.book(fixture.patient.getId(), overlapping.getId(), "Overlapping"));
        assertEquals(SlotStatus.FREE,
                fixture.slotDao.findById(overlapping.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Back-to-back appointments for the same patient are allowed")
    void allowsBackToBackAppointments() throws Exception {
        LocalDateTime start = fixture.nextStart();
        Slot first = fixture.createSlot(fixture.doctor.getId(), start, 30);
        Slot second = fixture.createSlot(fixture.doctor.getId(), start.plusMinutes(30), 30);

        service.book(fixture.patient.getId(), first.getId(), "First");
        service.book(fixture.patient.getId(), second.getId(), "Second");

        assertEquals(2, fixture.appointmentDao.countActiveByPatient(fixture.patient.getId()));
    }

    @Test
    @DisplayName("The active-appointment limit blocks further bookings")
    void enforcesActiveAppointmentLimit() throws Exception {
        service.setMaxActiveAppointments(2);
        LocalDateTime start = fixture.nextStart();
        Slot first = fixture.createSlot(fixture.doctor.getId(), start, 30);
        Slot second = fixture.createSlot(fixture.doctor.getId(), start.plusMinutes(30), 30);
        Slot third = fixture.createSlot(fixture.doctor.getId(), start.plusMinutes(60), 30);

        service.book(fixture.patient.getId(), first.getId(), "One");
        service.book(fixture.patient.getId(), second.getId(), "Two");

        InvalidBookingException error = assertThrows(InvalidBookingException.class,
                () -> service.book(fixture.patient.getId(), third.getId(), "Three"));
        assertTrue(error.getMessage().contains("active appointments"));
        assertEquals(SlotStatus.FREE,
                fixture.slotDao.findById(third.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Cancelling frees the slot and notifies both parties")
    void cancelFreesSlot() throws Exception {
        Slot slot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);
        Appointment appointment = service.book(fixture.patient.getId(), slot.getId(), "Review");

        service.cancel(appointment.getId(), fixture.patient.getId(), Role.PATIENT);

        assertEquals(AppointmentStatus.CANCELLED,
                service.findById(appointment.getId()).orElseThrow().getStatus());
        assertEquals(SlotStatus.FREE,
                fixture.slotDao.findById(slot.getId()).orElseThrow().getStatus());

        Appointment replacement = service.book(fixture.patient2.getId(), slot.getId(), "Replacement");
        assertEquals(AppointmentStatus.BOOKED, replacement.getStatus());
        assertTrue(fixture.notifications.getHistoryFor(fixture.patient.getId()).stream()
                .anyMatch(n -> n.getMessage().contains("cancelled")));
    }

    @Test
    @DisplayName("Rescheduling moves the booking and releases the old slot")
    void rescheduleMovesBookingAndFreesOldSlot() throws Exception {
        LocalDateTime start = fixture.nextStart();
        Slot oldSlot = fixture.createSlot(fixture.doctor.getId(), start, 30);
        Slot newSlot = fixture.createSlot(fixture.doctor.getId(), start.plusMinutes(60), 30);
        Appointment original = service.book(fixture.patient.getId(), oldSlot.getId(), "Review");

        Appointment replacement = service.reschedule(original.getId(), newSlot.getId(),
                fixture.patient.getId(), Role.PATIENT);

        assertNotNull(replacement);
        assertEquals(newSlot.getId(), replacement.getSlotId());
        assertEquals(AppointmentStatus.BOOKED, replacement.getStatus());
        assertEquals(AppointmentStatus.RESCHEDULED,
                service.findById(original.getId()).orElseThrow().getStatus());
        assertEquals(SlotStatus.FREE,
                fixture.slotDao.findById(oldSlot.getId()).orElseThrow().getStatus());
        assertEquals(SlotStatus.BOOKED,
                fixture.slotDao.findById(newSlot.getId()).orElseThrow().getStatus());
        assertTrue(fixture.notifications.getHistoryFor(fixture.patient.getId()).stream()
                .anyMatch(n -> n.getMessage().contains("rescheduled")));
    }

    @Test
    @DisplayName("Rescheduling rejects a slot that overlaps another booking")
    void rescheduleRejectsOverlap() throws Exception {
        LocalDateTime start = fixture.nextStart();
        Slot firstSlot = fixture.createSlot(fixture.doctor.getId(), start, 30);
        Slot secondSlot = fixture.createSlot(fixture.doctor.getId(), start.plusMinutes(60), 30);
        Slot overlapping = fixture.createSlot(fixture.doctor.getId(), start.plusMinutes(15), 30);
        service.book(fixture.patient.getId(), firstSlot.getId(), "Keep this");
        Appointment movable = service.book(fixture.patient.getId(), secondSlot.getId(), "Move this");

        assertThrows(SlotConflictException.class,
                () -> service.reschedule(movable.getId(), overlapping.getId(),
                        fixture.patient.getId(), Role.PATIENT));

        assertEquals(AppointmentStatus.BOOKED,
                service.findById(movable.getId()).orElseThrow().getStatus());
        assertEquals(SlotStatus.FREE,
                fixture.slotDao.findById(overlapping.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Patients cannot cancel somebody else's appointment")
    void patientCannotManageAnotherPatientsAppointment() throws Exception {
        Slot slot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);
        Appointment appointment = service.book(fixture.patient.getId(), slot.getId(), "Private");

        assertThrows(UnauthorizedActionException.class,
                () -> service.cancel(appointment.getId(), fixture.patient2.getId(), Role.PATIENT));

        assertEquals(AppointmentStatus.BOOKED,
                service.findById(appointment.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("A slot that already started cannot be booked")
    void rejectsPastSlot() throws Exception {
        LocalDateTime start = LocalDateTime.now().minusMinutes(30).withNano(0);
        Slot past = fixture.createSlot(fixture.doctor.getId(), start, 60, SlotStatus.FREE);

        InvalidBookingException error = assertThrows(InvalidBookingException.class,
                () -> service.book(fixture.patient.getId(), past.getId(), "Too late"));
        assertTrue(error.getMessage().contains("already started"));
        assertEquals(SlotStatus.FREE,
                fixture.slotDao.findById(past.getId()).orElseThrow().getStatus());
    }

    @Test
    @DisplayName("Availability is future-only, doctor-only and overlap-free")
    void defineAvailabilityUsesValidationRules() throws Exception {
        LocalDateTime start = fixture.nextStart();
        Slot slot = service.defineAvailability(fixture.doctor.getId(), start, start.plusMinutes(30));
        assertEquals(SlotStatus.FREE, slot.getStatus());

        assertThrows(SlotConflictException.class, () -> service.defineAvailability(
                fixture.doctor.getId(), start.plusMinutes(15), start.plusMinutes(45)));
        assertThrows(ValidationException.class, () -> service.defineAvailability(
                fixture.patient.getId(), start.plusHours(2), start.plusHours(3)));
        assertThrows(ValidationException.class, () -> service.defineAvailability(
                fixture.doctor.getId(), LocalDateTime.now().minusHours(1),
                LocalDateTime.now().plusHours(1)));
        assertThrows(ValidationException.class, () -> service.defineAvailability(
                fixture.doctor.getId(), start.plusHours(4), start.plusHours(3)));
    }

    @Test
    @DisplayName("A pre-empted appointment can be rebooked through reschedule")
    void preemptedAppointmentCanBeRebooked() throws Exception {
        Appointment routine = fixture.createInProgressAppointment(fixture.doctor, fixture.patient);
        Appointment preempted = service.preEmptForEmergency(
                fixture.doctor.getId(), LocalDateTime.now()).orElseThrow();
        assertEquals(AppointmentStatus.PRE_EMPTED, preempted.getStatus());

        Slot newSlot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);
        Appointment replacement = service.reschedule(preempted.getId(), newSlot.getId(),
                fixture.patient.getId(), Role.PATIENT);

        assertEquals(AppointmentStatus.BOOKED, replacement.getStatus());
        assertEquals(newSlot.getId(), replacement.getSlotId());
        assertEquals(AppointmentStatus.RESCHEDULED,
                service.findById(routine.getId()).orElseThrow().getStatus());
        assertEquals(SlotStatus.BOOKED,
                fixture.slotDao.findById(newSlot.getId()).orElseThrow().getStatus());
        assertTrue(service.getWaitlistSnapshot().isEmpty());
    }

    @Test
    @DisplayName("Only free slots can be removed")
    void onlyFreeSlotsCanBeRemoved() throws Exception {
        LocalDateTime start = fixture.nextStart();
        Slot free = service.defineAvailability(fixture.doctor.getId(), start, start.plusMinutes(30));
        service.removeSlot(free.getId());
        assertTrue(fixture.slotDao.findById(free.getId()).isEmpty());

        Slot booked = fixture.createSlot(fixture.doctor.getId(), start.plusHours(1), 30);
        Appointment appointment = service.book(fixture.patient.getId(), booked.getId(), "Keep");
        assertThrows(SlotConflictException.class, () -> service.removeSlot(booked.getId()));
        assertEquals(AppointmentStatus.BOOKED,
                service.findById(appointment.getId()).orElseThrow().getStatus());
    }
}
