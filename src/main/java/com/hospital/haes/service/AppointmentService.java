package com.hospital.haes.service;

import com.hospital.haes.dao.AppointmentDao;
import com.hospital.haes.dao.DatabaseManager;
import com.hospital.haes.dao.SlotDao;
import com.hospital.haes.dao.UserDao;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.NotificationLevel;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;
import com.hospital.haes.model.User;
import com.hospital.haes.scheduler.PriorityScheduler;
import com.hospital.haes.scheduler.SlotLockManager;
import com.hospital.haes.util.Validator;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Outpatient scheduling rules. Booking is a critical section guarded by a
 * per-slot ReentrantLock followed by a database transaction that re-checks
 * the slot, inserts the appointment and marks the slot in one atomic unit.
 */
public class AppointmentService {

    private static final DateTimeFormatter DISPLAY =
            DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm");

    private final DatabaseManager databaseManager;
    private final SlotDao slotDao;
    private final AppointmentDao appointmentDao;
    private final UserDao userDao;
    private final NotificationService notifications;
    private final SlotLockManager slotLocks;
    private final PriorityScheduler<Appointment> rescheduleWaitlist = new PriorityScheduler<>();
    private int maxActiveAppointments = 3;

    public AppointmentService(DatabaseManager databaseManager,
                              SlotDao slotDao,
                              AppointmentDao appointmentDao,
                              UserDao userDao,
                              NotificationService notifications,
                              SlotLockManager slotLocks) {
        this.databaseManager = databaseManager;
        this.slotDao = slotDao;
        this.appointmentDao = appointmentDao;
        this.userDao = userDao;
        this.notifications = notifications;
        this.slotLocks = slotLocks;
        reloadWaitlistQuietly();
    }

    public Slot defineAvailability(int doctorId, LocalDateTime start, LocalDateTime end)
            throws ValidationException, DatabaseOperationException, SlotConflictException {
        Validator.timeRange(start, end);
        if (start.isBefore(LocalDateTime.now())) {
            throw new ValidationException("Availability must start in the future.");
        }
        User doctor = userDao.findById(doctorId)
                .orElseThrow(() -> new ValidationException("Doctor not found."));
        if (doctor.getRole() != Role.DOCTOR) {
            throw new ValidationException("Availability can only be defined for a doctor.");
        }
        if (slotDao.hasOverlap(doctorId, start, end, null)) {
            throw new SlotConflictException("That doctor already has an overlapping slot.");
        }
        return slotDao.save(new Slot(0, doctorId, start, end, SlotStatus.FREE));
    }

    public void removeSlot(int slotId)
            throws DatabaseOperationException, SlotConflictException, ValidationException {
        Slot slot = slotDao.findById(slotId)
                .orElseThrow(() -> new ValidationException("Slot not found."));
        if (slot.getStatus() != SlotStatus.FREE) {
            throw new SlotConflictException("Only free slots can be removed.");
        }
        slotDao.delete(slotId);
    }

    public List<Slot> findAvailableSlots(Integer departmentId, Integer doctorId, LocalDate date)
            throws DatabaseOperationException {
        return slotDao.findAvailable(departmentId, doctorId, date);
    }

    public Appointment book(int patientId, int slotId, String reason)
            throws DatabaseOperationException, SlotConflictException, InvalidBookingException {
        String cleanReason = validateReason(reason);
        User patient = userDao.findById(patientId)
                .orElseThrow(() -> new InvalidBookingException("Select a valid patient."));
        if (patient.getRole() != Role.PATIENT) {
            throw new InvalidBookingException("Appointments can only be booked for patients.");
        }
        Slot preview = slotDao.findById(slotId)
                .orElseThrow(() -> new InvalidBookingException("That slot no longer exists."));
        if (preview.getStart().isBefore(LocalDateTime.now())) {
            throw new InvalidBookingException("That slot has already started. Choose another slot.");
        }

        BookingOutcome outcome;
        slotLocks.lock(slotId);
        try {
            outcome = databaseManager.inTransaction(connection -> {
                if (appointmentDao.countActiveByPatient(connection, patientId) >= maxActiveAppointments) {
                    return BookingOutcome.limitReached();
                }
                Optional<Slot> fresh = slotDao.findById(connection, slotId);
                if (fresh.isEmpty() || fresh.get().getStatus() != SlotStatus.FREE) {
                    return BookingOutcome.conflict();
                }
                List<Appointment> active = appointmentDao.findActiveByPatient(connection, patientId);
                for (Appointment existing : active) {
                    if (overlaps(existing, preview)) {
                        return BookingOutcome.overlap();
                    }
                }
                if (!slotDao.updateStatus(connection, slotId, SlotStatus.BOOKED)) {
                    return BookingOutcome.conflict();
                }
                Appointment appointment = new Appointment(0, preview, patientId, cleanReason,
                        AppointmentStatus.BOOKED, LocalDateTime.now());
                appointmentDao.insert(connection, appointment);
                return BookingOutcome.success(appointment);
            });
        } finally {
            slotLocks.unlock(slotId);
        }

        if (outcome.limitReached) {
            throw new InvalidBookingException("This patient already has " + maxActiveAppointments
                    + " active appointments. Cancel or reschedule one first.");
        }
        if (outcome.overlap) {
            throw new SlotConflictException("The patient already has another appointment at that time.");
        }
        if (outcome.slotConflict) {
            throw new SlotConflictException("That slot was just taken. Please choose another slot.");
        }

        Appointment appointment = outcome.appointment;
        notifications.notifyUser(patientId, "Appointment confirmed: " + describe(preview) + ".",
                NotificationLevel.SUCCESS);
        notifications.notifyUser(preview.getDoctorId(), "New appointment: " + patient.getFullName()
                + " on " + describe(preview) + ".", NotificationLevel.INFO);
        return appointment;
    }

    public Appointment reschedule(int appointmentId, int newSlotId, int actorId, Role actorRole)
            throws DatabaseOperationException, SlotConflictException, InvalidBookingException,
            UnauthorizedActionException {
        Appointment old = appointmentDao.findById(appointmentId)
                .orElseThrow(() -> new InvalidBookingException("Appointment not found."));
        ensureCanManage(old, actorId, actorRole);
        if (old.getStatus() != AppointmentStatus.BOOKED
                && old.getStatus() != AppointmentStatus.PRE_EMPTED) {
            throw new InvalidBookingException("Only active or pre-empted appointments can be rebooked.");
        }
        if (old.getSlotId() == newSlotId) {
            throw new InvalidBookingException("Choose a different slot.");
        }
        Slot newSlot = slotDao.findById(newSlotId)
                .orElseThrow(() -> new InvalidBookingException("The new slot no longer exists."));
        if (newSlot.getStart().isBefore(LocalDateTime.now())) {
            throw new InvalidBookingException("The new slot has already started.");
        }

        int firstLock = Math.min(old.getSlotId(), newSlotId);
        int secondLock = Math.max(old.getSlotId(), newSlotId);
        ModifyOutcome outcome;
        slotLocks.lock(firstLock);
        slotLocks.lock(secondLock);
        try {
            outcome = databaseManager.inTransaction(connection -> {
                Optional<Appointment> freshOld = appointmentDao.findById(connection, appointmentId);
                if (freshOld.isEmpty()
                        || (freshOld.get().getStatus() != AppointmentStatus.BOOKED
                            && freshOld.get().getStatus() != AppointmentStatus.PRE_EMPTED)) {
                    return ModifyOutcome.invalid();
                }
                Optional<Slot> freshNew = slotDao.findById(connection, newSlotId);
                if (freshNew.isEmpty() || freshNew.get().getStatus() != SlotStatus.FREE) {
                    return ModifyOutcome.conflict();
                }
                List<Appointment> active = appointmentDao.findActiveByPatient(connection, old.getPatientId());
                for (Appointment existing : active) {
                    if (existing.getId() != appointmentId && overlaps(existing, newSlot)) {
                        return ModifyOutcome.conflict();
                    }
                }
                if (!slotDao.updateStatus(connection, newSlotId, SlotStatus.BOOKED)) {
                    return ModifyOutcome.conflict();
                }
                Appointment replacement = new Appointment(0, newSlot, old.getPatientId(), old.getReason(),
                        AppointmentStatus.BOOKED, LocalDateTime.now());
                appointmentDao.insert(connection, replacement);
                appointmentDao.updateStatus(connection, appointmentId, AppointmentStatus.RESCHEDULED);
                slotDao.updateStatus(connection, old.getSlotId(), SlotStatus.FREE);
                return ModifyOutcome.success(replacement);
            });
        } finally {
            slotLocks.unlock(secondLock);
            slotLocks.unlock(firstLock);
        }

        if (outcome.invalid) {
            throw new InvalidBookingException("That appointment is no longer active.");
        }
        if (outcome.conflict) {
            throw new SlotConflictException("That new slot is no longer free or overlaps another booking.");
        }
        rescheduleWaitlist.asQueue().removeIf(a -> a.getId() == appointmentId);
        Appointment replacement = outcome.appointment;
        boolean wasPreempted = old.getStatus() == AppointmentStatus.PRE_EMPTED;
        notifications.notifyUser(old.getPatientId(),
                (wasPreempted ? "Re-booked" : "Appointment rescheduled")
                        + " to " + describe(newSlot) + ".", NotificationLevel.SUCCESS);
        notifications.notifyUser(old.getDoctorId(), "Appointment #" + appointmentId
                + " was rescheduled by " + old.getPatientName() + ".", NotificationLevel.INFO);
        if (newSlot.getDoctorId() != old.getDoctorId()) {
            notifications.notifyUser(newSlot.getDoctorId(), "New appointment: " + old.getPatientName()
                    + " on " + describe(newSlot) + ".", NotificationLevel.INFO);
        }
        return replacement;
    }

    public void cancel(int appointmentId, int actorId, Role actorRole)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        Appointment appointment = appointmentDao.findById(appointmentId)
                .orElseThrow(() -> new InvalidBookingException("Appointment not found."));
        ensureCanManage(appointment, actorId, actorRole);
        if (appointment.getStatus() != AppointmentStatus.BOOKED) {
            throw new InvalidBookingException("Only active appointments can be cancelled.");
        }
        int slotId = appointment.getSlotId();
        boolean cancelled;
        slotLocks.lock(slotId);
        try {
            cancelled = databaseManager.inTransaction(connection -> {
                Optional<Appointment> fresh = appointmentDao.findById(connection, appointmentId);
                if (fresh.isEmpty() || fresh.get().getStatus() != AppointmentStatus.BOOKED) {
                    return false;
                }
                appointmentDao.updateStatus(connection, appointmentId, AppointmentStatus.CANCELLED);
                slotDao.updateStatus(connection, slotId, SlotStatus.FREE);
                return true;
            });
        } finally {
            slotLocks.unlock(slotId);
        }
        if (!cancelled) {
            throw new InvalidBookingException("That appointment is no longer active.");
        }
        notifications.notifyUser(appointment.getPatientId(),
                "Appointment cancelled: " + describe(appointment.getSlot()) + ".", NotificationLevel.WARNING);
        notifications.notifyUser(appointment.getDoctorId(),
                "Appointment cancelled by " + appointment.getPatientName() + " on "
                        + describe(appointment.getSlot()) + ".", NotificationLevel.INFO);
    }

    public void changeStatus(int appointmentId, int actorId, Role actorRole, AppointmentStatus newStatus)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        if (newStatus != AppointmentStatus.COMPLETED && newStatus != AppointmentStatus.NO_SHOW) {
            throw new InvalidBookingException("Doctors can only mark an appointment completed or no-show.");
        }
        Appointment appointment = appointmentDao.findById(appointmentId)
                .orElseThrow(() -> new InvalidBookingException("Appointment not found."));
        if (actorRole != Role.ADMIN
                && !(actorRole == Role.DOCTOR && appointment.getDoctorId() == actorId)) {
            throw new UnauthorizedActionException("Only the assigned doctor can update this appointment.");
        }
        int slotId = appointment.getSlotId();
        boolean updated;
        slotLocks.lock(slotId);
        try {
            updated = databaseManager.inTransaction(connection -> {
                Optional<Appointment> fresh = appointmentDao.findById(connection, appointmentId);
                if (fresh.isEmpty() || fresh.get().getStatus() != AppointmentStatus.BOOKED) {
                    return false;
                }
                appointmentDao.updateStatus(connection, appointmentId, newStatus);
                slotDao.updateStatus(connection, slotId, SlotStatus.FREE);
                return true;
            });
        } finally {
            slotLocks.unlock(slotId);
        }
        if (!updated) {
            throw new InvalidBookingException("That appointment is no longer active.");
        }
        notifications.notifyUser(appointment.getPatientId(),
                "Appointment marked " + newStatus.getLabel().toLowerCase() + ": "
                        + describe(appointment.getSlot()) + ".",
                newStatus == AppointmentStatus.NO_SHOW ? NotificationLevel.WARNING : NotificationLevel.INFO);
    }

    /**
     * Called by the emergency dispatcher when a Critical case needs a doctor
     * who is currently in a routine consultation.
     */
    public Optional<Appointment> preEmptForEmergency(int doctorId, LocalDateTime at)
            throws DatabaseOperationException {
        Optional<Appointment> inProgress = appointmentDao.findAppointmentInProgress(doctorId, at);
        if (inProgress.isEmpty()) {
            return Optional.empty();
        }
        Appointment appointment = inProgress.get();
        int slotId = appointment.getSlotId();
        Optional<Appointment> preEmpted;
        slotLocks.lock(slotId);
        try {
            preEmpted = databaseManager.inTransaction(connection -> {
                Optional<Appointment> fresh = appointmentDao.findById(connection, appointment.getId());
                if (fresh.isEmpty() || fresh.get().getStatus() != AppointmentStatus.BOOKED) {
                    return Optional.<Appointment>empty();
                }
                appointmentDao.updateStatus(connection, appointment.getId(), AppointmentStatus.PRE_EMPTED);
                slotDao.updateStatus(connection, slotId, SlotStatus.FREE);
                fresh.get().setStatus(AppointmentStatus.PRE_EMPTED);
                if (fresh.get().getSlot() != null) {
                    fresh.get().getSlot().setStatus(SlotStatus.FREE);
                }
                return Optional.of(fresh.get());
            });
        } finally {
            slotLocks.unlock(slotId);
        }
        if (preEmpted.isPresent()) {
            rescheduleWaitlist.offer(preEmpted.get());
            notifications.notifyUser(appointment.getPatientId(),
                    "Your appointment (" + describe(appointment.getSlot())
                            + ") was pre-empted for a Critical emergency. Please rebook.",
                    NotificationLevel.CRITICAL);
            notifications.notifyUser(doctorId,
                    "Your appointment with " + appointment.getPatientName()
                            + " was pre-empted for a Critical emergency.",
                    NotificationLevel.WARNING);
        }
        return preEmpted;
    }

    public Optional<Appointment> findInProgressAppointment(int doctorId, LocalDateTime at)
            throws DatabaseOperationException {
        return appointmentDao.findAppointmentInProgress(doctorId, at);
    }

    public List<Appointment> listAll() throws DatabaseOperationException {
        return appointmentDao.findAll();
    }

    public List<Appointment> listByPatient(int patientId) throws DatabaseOperationException {
        return appointmentDao.findByPatient(patientId);
    }

    public List<Appointment> listByDoctor(int doctorId) throws DatabaseOperationException {
        return appointmentDao.findByDoctor(doctorId);
    }

    public List<Slot> listDoctorSlots(int doctorId) throws DatabaseOperationException {
        return slotDao.findByDoctor(doctorId);
    }

    public Optional<Appointment> findById(int id) throws DatabaseOperationException {
        return appointmentDao.findById(id);
    }

    public void refreshWaitlist() throws DatabaseOperationException {
        rescheduleWaitlist.clear();
        for (Appointment appointment : appointmentDao.findByStatus(AppointmentStatus.PRE_EMPTED)) {
            rescheduleWaitlist.offer(appointment);
        }
    }

    public List<Appointment> getWaitlistSnapshot() {
        return rescheduleWaitlist.snapshot();
    }

    public int getMaxActiveAppointments() {
        return maxActiveAppointments;
    }

    public void setMaxActiveAppointments(int maxActiveAppointments) {
        if (maxActiveAppointments < 1) {
            throw new IllegalArgumentException("The active appointment limit must be at least 1");
        }
        this.maxActiveAppointments = maxActiveAppointments;
    }

    private void reloadWaitlistQuietly() {
        try {
            refreshWaitlist();
        } catch (DatabaseOperationException e) {
            System.err.println("Could not load the reschedule waitlist: " + e.getMessage());
        }
    }

    private void ensureCanManage(Appointment appointment, int actorId, Role actorRole)
            throws UnauthorizedActionException {
        if (actorRole == null) {
            throw new UnauthorizedActionException("You are not signed in.");
        }
        switch (actorRole) {
            case PATIENT -> {
                if (appointment.getPatientId() != actorId) {
                    throw new UnauthorizedActionException("You can only manage your own appointments.");
                }
            }
            case DOCTOR -> {
                if (appointment.getDoctorId() != actorId) {
                    throw new UnauthorizedActionException("You can only manage your own schedule.");
                }
            }
            case RECEPTIONIST, ER_STAFF, ADMIN -> {
                // Front-desk and administrative roles may manage appointments.
            }
        }
    }

    private boolean overlaps(Appointment existing, Slot slot) {
        return existing.getStart().isBefore(slot.getEnd()) && slot.getStart().isBefore(existing.getEnd());
    }

    private String validateReason(String reason) throws InvalidBookingException {
        try {
            Validator.requireText(reason, "Reason");
            String clean = reason.trim();
            Validator.maxLength(clean, 250, "Reason");
            return clean;
        } catch (ValidationException e) {
            throw new InvalidBookingException(e.getMessage());
        }
    }

    private String describe(Slot slot) {
        if (slot == null) {
            return "unknown time";
        }
        return slot.getStart().format(DISPLAY) + " with " + slot.getDoctorName();
    }

    private static final class BookingOutcome {
        private final Appointment appointment;
        private final boolean slotConflict;
        private final boolean limitReached;
        private final boolean overlap;

        private BookingOutcome(Appointment appointment, boolean slotConflict,
                               boolean limitReached, boolean overlap) {
            this.appointment = appointment;
            this.slotConflict = slotConflict;
            this.limitReached = limitReached;
            this.overlap = overlap;
        }

        static BookingOutcome success(Appointment appointment) {
            return new BookingOutcome(appointment, false, false, false);
        }

        static BookingOutcome conflict() {
            return new BookingOutcome(null, true, false, false);
        }

        static BookingOutcome limitReached() {
            return new BookingOutcome(null, false, true, false);
        }

        static BookingOutcome overlap() {
            return new BookingOutcome(null, false, false, true);
        }
    }

    private static final class ModifyOutcome {
        private final Appointment appointment;
        private final boolean conflict;
        private final boolean invalid;

        private ModifyOutcome(Appointment appointment, boolean conflict, boolean invalid) {
            this.appointment = appointment;
            this.conflict = conflict;
            this.invalid = invalid;
        }

        static ModifyOutcome success(Appointment appointment) {
            return new ModifyOutcome(appointment, false, false);
        }

        static ModifyOutcome conflict() {
            return new ModifyOutcome(null, true, false);
        }

        static ModifyOutcome invalid() {
            return new ModifyOutcome(null, false, true);
        }
    }
}
