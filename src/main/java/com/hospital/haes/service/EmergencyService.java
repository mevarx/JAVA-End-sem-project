package com.hospital.haes.service;

import com.hospital.haes.dao.DatabaseManager;
import com.hospital.haes.dao.EmergencyDao;
import com.hospital.haes.dao.UserDao;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyEvent;
import com.hospital.haes.model.EmergencyStatus;
import com.hospital.haes.model.EmergencyType;
import com.hospital.haes.model.NotificationLevel;
import com.hospital.haes.model.Severity;
import com.hospital.haes.model.User;
import com.hospital.haes.scheduler.BedPool;
import com.hospital.haes.scheduler.EmergencyDispatcher;
import com.hospital.haes.scheduler.EscalationTimer;
import com.hospital.haes.scheduler.PriorityScheduler;
import com.hospital.haes.util.FileLogger;
import com.hospital.haes.util.Validator;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.OptionalInt;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Emergency lifecycle: raise -> priority queue -> dispatch (doctor + bed)
 * -> acknowledge -> resolve. A scheduled scan escalates unacknowledged
 * cases. Critical cases may pre-empt an in-progress outpatient appointment.
 */
public class EmergencyService {

    private static final int ESCALATION_SCAN_SECONDS = 1;

    private final DatabaseManager databaseManager;
    private final EmergencyDao emergencyDao;
    private final UserDao userDao;
    private final AppointmentService appointmentService;
    private final NotificationService notifications;
    private final FileLogger auditLog;
    private final BedPool bedPool;
    private final PriorityScheduler<EmergencyCase> queue = new PriorityScheduler<>();
    private final EmergencyDispatcher dispatcher;
    private final EscalationTimer escalationTimer = new EscalationTimer();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile int ackTimeoutSeconds;

    public EmergencyService(DatabaseManager databaseManager,
                            EmergencyDao emergencyDao,
                            UserDao userDao,
                            AppointmentService appointmentService,
                            NotificationService notifications,
                            FileLogger auditLog,
                            int bedCapacity,
                            int ackTimeoutSeconds) {
        if (ackTimeoutSeconds < 0) {
            throw new IllegalArgumentException("Acknowledgment timeout cannot be negative");
        }
        this.databaseManager = databaseManager;
        this.emergencyDao = emergencyDao;
        this.userDao = userDao;
        this.appointmentService = appointmentService;
        this.notifications = notifications;
        this.auditLog = auditLog;
        this.bedPool = new BedPool(bedCapacity);
        this.ackTimeoutSeconds = ackTimeoutSeconds;
        this.dispatcher = new EmergencyDispatcher(queue, this::tryDispatch);
    }

    public void start() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        try {
            for (EmergencyCase active : emergencyDao.findActive()) {
                if (active.getBedNo() != null) {
                    bedPool.reserve(active.getBedNo());
                }
                if (active.getStatus() == EmergencyStatus.WAITING) {
                    queue.offer(active);
                }
            }
        } catch (DatabaseOperationException e) {
            System.err.println("Could not reload active emergencies: " + e.getMessage());
        }
        dispatcher.start();
        escalationTimer.start(() -> {
            try {
                scanEscalations();
            } catch (DatabaseOperationException e) {
                System.err.println("Escalation scan failed: " + e.getMessage());
            }
        }, ESCALATION_SCAN_SECONDS);
    }

    public void stop() {
        escalationTimer.stop();
        dispatcher.stop();
        running.set(false);
    }

    public boolean isRunning() {
        return running.get();
    }

    public EmergencyCase raiseEmergency(Integer patientId, String patientLabel,
                                        EmergencyType type, Severity severity,
                                        String location, int raisedByUserId)
            throws ValidationException, DatabaseOperationException {
        if (type == null) {
            throw new ValidationException("Select an emergency type.");
        }
        if (severity == null) {
            throw new ValidationException("Select a severity.");
        }
        Validator.requireText(location, "Location");
        Validator.maxLength(location.trim(), 120, "Location");

        Integer verifiedPatientId = null;
        String label = patientLabel;
        if (patientId != null) {
            Optional<User> patient = userDao.findById(patientId);
            if (patient.isEmpty()) {
                throw new ValidationException("The selected patient does not exist.");
            }
            verifiedPatientId = patientId;
            if (label == null || label.isBlank()) {
                label = patient.get().getFullName();
            }
        }
        if (label == null || label.isBlank()) {
            label = "Walk-in case";
        }

        LocalDateTime now = LocalDateTime.now();
        EmergencyCase emergencyCase = EmergencyCase.waiting(verifiedPatientId, label.trim(),
                type, severity, location.trim(), now);
        String raisedByNote = "Raised by user #" + raisedByUserId;

        databaseManager.inTransaction(connection -> {
            emergencyDao.insert(connection, emergencyCase);
            emergencyDao.saveEvent(connection, new EmergencyEvent(
                    emergencyCase.getId(), "RAISED", now, raisedByNote));
            return null;
        });
        auditLog.logEmergencyEvent(emergencyCase, "RAISED", raisedByNote);
        notifications.broadcast("New " + severity.getLabel().toUpperCase() + " "
                        + type.getLabel() + " emergency #" + emergencyCase.getId()
                        + " at " + location.trim() + ".",
                severity == Severity.CRITICAL ? NotificationLevel.CRITICAL : NotificationLevel.WARNING);
        queue.offer(emergencyCase);
        return emergencyCase;
    }

    /**
     * One dispatch attempt. Returns false when the case should stay queued
     * (no bed or no available responder).
     */
    private boolean tryDispatch(EmergencyCase queued) {
        Integer acquiredBed = null;
        try {
            Optional<EmergencyCase> fresh = emergencyDao.findById(queued.getId());
            if (fresh.isEmpty()) {
                return true;
            }
            EmergencyCase emergencyCase = fresh.get();
            if (emergencyCase.getStatus() != EmergencyStatus.WAITING
                    || emergencyCase.getAssignedTo() != null) {
                return true;
            }

            OptionalInt bed = bedPool.tryAcquire();
            if (bed.isEmpty()) {
                return false;
            }
            acquiredBed = bed.getAsInt();

            Set<Integer> busy = emergencyDao.findActiveAssigneeIds();
            User responder = findFreeResponder(emergencyCase, busy);
            String assignmentNote = "Bed #" + acquiredBed + " reserved";
            Appointment preempted = null;

            if (responder == null && emergencyCase.getSeverity() == Severity.CRITICAL) {
                Preemption preemption = findPreemptibleDoctor(emergencyCase, busy);
                if (preemption != null) {
                    responder = preemption.doctor;
                    preempted = preemption.appointment;
                    assignmentNote += "; pre-empted appointment #" + preempted.getId();
                }
            }
            if (responder == null) {
                bedPool.release(acquiredBed);
                return false;
            }

            LocalDateTime now = LocalDateTime.now();
            emergencyCase.setAssignedTo(responder.getId());
            emergencyCase.setAssignedToName(responder.getFullName());
            emergencyCase.setBedNo(acquiredBed);
            emergencyCase.setStatus(EmergencyStatus.ASSIGNED);
            emergencyCase.setDispatchedAt(now);
            emergencyCase.setAcknowledgedAt(null);
            acquiredBed = null; // ownership transferred to the case

            final String note = assignmentNote;
            final EmergencyCase assigned = emergencyCase;
            databaseManager.inTransaction(connection -> {
                emergencyDao.update(connection, assigned);
                emergencyDao.saveEvent(connection, new EmergencyEvent(
                        assigned.getId(), "DISPATCHED", now, note));
                return null;
            });

            auditLog.logEmergencyEvent(assigned, "DISPATCHED", note);
            notifications.notifyUser(responder.getId(),
                    "EMERGENCY #" + assigned.getId() + " (" + assigned.getSeverity() + " "
                            + assigned.getType() + ", " + assigned.getLocation()
                            + "). Acknowledge within " + ackTimeoutSeconds + "s.",
                    assigned.getSeverity() == Severity.CRITICAL
                            ? NotificationLevel.CRITICAL : NotificationLevel.WARNING);
            if (assigned.getPatientId() != null) {
                notifications.notifyUser(assigned.getPatientId(),
                        "Emergency #" + assigned.getId() + " assigned to " + responder.getFullName()
                                + " (bed " + assigned.getBedNo() + ").",
                        NotificationLevel.INFO);
            }
            if (preempted != null) {
                notifications.broadcast("Critical case #" + assigned.getId()
                        + " pre-empted appointment #" + preempted.getId()
                        + "; the patient has been notified to rebook.", NotificationLevel.WARNING);
            }
            return true;
        } catch (DatabaseOperationException e) {
            if (acquiredBed != null) {
                bedPool.release(acquiredBed);
            }
            System.err.println("Dispatch failed for emergency #" + queued.getId() + ": " + e.getMessage());
            return false;
        }
    }

    private Preemption findPreemptibleDoctor(EmergencyCase emergencyCase, Set<Integer> busy)
            throws DatabaseOperationException {
        List<User> responders = userDao.findResponders();
        LocalDateTime now = LocalDateTime.now();
        // First pass: matching specialization; second pass: any doctor for a Critical case.
        for (int pass = 0; pass < 2; pass++) {
            for (User user : responders) {
                if (!(user instanceof Doctor doctor) || busy.contains(user.getId())) {
                    continue;
                }
                if (pass == 0 && !emergencyCase.getType().matchesSpecialization(doctor.getSpecialization())) {
                    continue;
                }
                Optional<Appointment> appointment = appointmentService.preEmptForEmergency(doctor.getId(), now);
                if (appointment.isPresent()) {
                    return new Preemption(doctor, appointment.get());
                }
            }
        }
        return null;
    }

    private User findFreeResponder(EmergencyCase emergencyCase, Set<Integer> busy)
            throws DatabaseOperationException {
        LocalDateTime now = LocalDateTime.now();
        for (User user : userDao.findResponders()) {
            if (busy.contains(user.getId())) {
                continue;
            }
            if (user instanceof Doctor doctor) {
                if (!emergencyCase.getType().matchesSpecialization(doctor.getSpecialization())) {
                    continue;
                }
                // A doctor in a routine consultation is not free; a Critical
                // case may pre-empt that appointment below.
                if (appointmentService.findInProgressAppointment(doctor.getId(), now).isPresent()) {
                    continue;
                }
                return doctor;
            } else if (user.getRole() == com.hospital.haes.model.Role.ER_STAFF) {
                return user;
            }
        }
        return null;
    }

    public int dispatchPendingNow() {
        return dispatcher.dispatchAvailable();
    }

    public EmergencyCase acknowledge(int emergencyId, int userId)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        EmergencyCase emergencyCase = emergencyDao.findById(emergencyId)
                .orElseThrow(() -> new InvalidBookingException("Emergency case not found."));
        if (emergencyCase.getAssignedTo() == null || emergencyCase.getAssignedTo() != userId) {
            throw new UnauthorizedActionException("Only the assigned responder can acknowledge this case.");
        }
        if (emergencyCase.getStatus() != EmergencyStatus.ASSIGNED
                && emergencyCase.getStatus() != EmergencyStatus.ESCALATED) {
            throw new InvalidBookingException("This case is not waiting for acknowledgment.");
        }
        LocalDateTime now = LocalDateTime.now();
        emergencyCase.setStatus(EmergencyStatus.ACKNOWLEDGED);
        emergencyCase.setAcknowledgedAt(now);
        databaseManager.inTransaction(connection -> {
            emergencyDao.update(connection, emergencyCase);
            emergencyDao.saveEvent(connection, new EmergencyEvent(
                    emergencyId, "ACKNOWLEDGED", now, "Acknowledged by user #" + userId));
            return null;
        });
        auditLog.logEmergencyEvent(emergencyCase, "ACKNOWLEDGED", "Acknowledged by user #" + userId);
        if (emergencyCase.getPatientId() != null) {
            notifications.notifyUser(emergencyCase.getPatientId(),
                    "A responder acknowledged emergency #" + emergencyId + ".",
                    NotificationLevel.INFO);
        }
        return emergencyCase;
    }

    public EmergencyCase resolve(int emergencyId, int userId, com.hospital.haes.model.Role role, String note)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        EmergencyCase emergencyCase = emergencyDao.findById(emergencyId)
                .orElseThrow(() -> new InvalidBookingException("Emergency case not found."));
        boolean allowed = emergencyCase.getAssignedTo() != null
                && emergencyCase.getAssignedTo() == userId;
        if (!allowed && role != com.hospital.haes.model.Role.ADMIN) {
            throw new UnauthorizedActionException("Only the assigned responder (or an admin) can resolve this case.");
        }
        if (!emergencyCase.getStatus().isActive()) {
            throw new InvalidBookingException("This case is already resolved.");
        }
        LocalDateTime now = LocalDateTime.now();
        emergencyCase.setStatus(EmergencyStatus.RESOLVED);
        emergencyCase.setResolvedAt(now);
        final String resolveNote = note == null || note.isBlank() ? "Case resolved" : note.trim();
        databaseManager.inTransaction(connection -> {
            emergencyDao.update(connection, emergencyCase);
            emergencyDao.saveEvent(connection, new EmergencyEvent(
                    emergencyId, "RESOLVED", now, resolveNote));
            return null;
        });
        if (emergencyCase.getBedNo() != null) {
            bedPool.release(emergencyCase.getBedNo());
        }
        auditLog.logEmergencyEvent(emergencyCase, "RESOLVED", resolveNote);
        if (emergencyCase.getPatientId() != null) {
            notifications.notifyUser(emergencyCase.getPatientId(),
                    "Emergency #" + emergencyId + " has been resolved.", NotificationLevel.SUCCESS);
        }
        notifications.broadcast("Emergency #" + emergencyId + " resolved by "
                + emergencyCase.getAssignedToName() + ".", NotificationLevel.INFO);
        return emergencyCase;
    }

    /**
     * Scheduled scan: escalates cases assigned longer than the configured
     * timeout without acknowledgment.
     */
    public synchronized int scanEscalations() throws DatabaseOperationException {
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(ackTimeoutSeconds);
        List<EmergencyCase> overdue = emergencyDao.findOverdue(threshold);
        int escalatedCount = 0;
        for (EmergencyCase stale : overdue) {
            Optional<EmergencyCase> freshOpt = emergencyDao.findById(stale.getId());
            if (freshOpt.isEmpty()) {
                continue;
            }
            EmergencyCase emergencyCase = freshOpt.get();
            if (emergencyCase.getAcknowledgedAt() != null
                    || (emergencyCase.getStatus() != EmergencyStatus.ASSIGNED
                        && emergencyCase.getStatus() != EmergencyStatus.ESCALATED)) {
                continue;
            }
            Set<Integer> busy = emergencyDao.findActiveAssigneeIds();
            Set<Integer> alreadyTried = emergencyDao.findEscalationTargets(emergencyCase.getId());
            if (emergencyCase.getAssignedTo() != null) {
                alreadyTried.add(emergencyCase.getAssignedTo());
            }
            User next = findAlternateResponder(emergencyCase, busy, alreadyTried);
            LocalDateTime now = LocalDateTime.now();
            String note;
            if (next == null) {
                note = "No alternate responder is free; duty head notified.";
                notifications.broadcast("Emergency #" + emergencyCase.getId()
                        + " has NOT been acknowledged and no alternate responder is free.",
                        NotificationLevel.CRITICAL);
            } else {
                note = "Acknowledgment timeout exceeded; escalated to " + next.getFullName()
                        + " (escalated to user #" + next.getId() + ").";
                emergencyCase.setAssignedTo(next.getId());
                emergencyCase.setAssignedToName(next.getFullName());
                notifications.notifyUser(next.getId(),
                        "ESCALATED emergency #" + emergencyCase.getId() + " (" + emergencyCase.getSeverity()
                                + " " + emergencyCase.getType() + "). Acknowledge immediately.",
                        NotificationLevel.CRITICAL);
                if (emergencyCase.getPatientId() != null) {
                    notifications.notifyUser(emergencyCase.getPatientId(),
                            "Emergency #" + emergencyCase.getId() + " escalated to a new responder.",
                            NotificationLevel.WARNING);
                }
            }
            emergencyCase.setStatus(EmergencyStatus.ESCALATED);
            emergencyCase.setEscalationCount(emergencyCase.getEscalationCount() + 1);
            // escalated_at starts the next acknowledgment window. dispatched_at keeps the
            // original dispatch time so dispatch-latency metrics stay meaningful.
            emergencyCase.setEscalatedAt(now);
            emergencyCase.setAcknowledgedAt(null);

            final String eventNote = note;
            final EmergencyCase updated = emergencyCase;
            // Conditional write: if the responder acknowledged between our read and this
            // update, the row no longer matches and we leave their acknowledgment intact.
            boolean applied = databaseManager.inTransaction(connection -> {
                if (!emergencyDao.updateIfUnacknowledged(connection, updated)) {
                    return false;
                }
                emergencyDao.saveEvent(connection, new EmergencyEvent(
                        updated.getId(), "ESCALATED", now, eventNote));
                return true;
            });
            if (!applied) {
                continue;
            }
            auditLog.logEmergencyEvent(updated, "ESCALATED", note);
            escalatedCount++;
        }
        return escalatedCount;
    }

    private User findAlternateResponder(EmergencyCase emergencyCase, Set<Integer> busy,
                                        Set<Integer> alreadyTried)
            throws DatabaseOperationException {
        for (User user : userDao.findResponders()) {
            if (busy.contains(user.getId())) {
                continue;
            }
            // Never bounce a case back to a responder who already let it time out.
            if (alreadyTried.contains(user.getId())) {
                continue;
            }
            if (user instanceof Doctor doctor) {
                if (emergencyCase.getType().matchesSpecialization(doctor.getSpecialization())) {
                    return doctor;
                }
            } else if (user.getRole() == com.hospital.haes.model.Role.ER_STAFF) {
                return user;
            }
        }
        return null;
    }

    public List<EmergencyCase> getActiveCases() throws DatabaseOperationException {
        return emergencyDao.findActive();
    }

    public List<EmergencyCase> getAllCases() throws DatabaseOperationException {
        return emergencyDao.findAll();
    }

    public List<EmergencyCase> findByPatient(int patientId) throws DatabaseOperationException {
        return emergencyDao.findByPatient(patientId);
    }

    public Optional<EmergencyCase> findById(int id) throws DatabaseOperationException {
        return emergencyDao.findById(id);
    }

    public List<EmergencyEvent> getEvents(int emergencyId) throws DatabaseOperationException {
        return emergencyDao.findEvents(emergencyId);
    }

    public List<EmergencyEvent> getRecentEvents(int limit) throws DatabaseOperationException {
        return emergencyDao.findRecentEvents(limit);
    }

    public OptionalDouble getAverageDispatchMillis() throws DatabaseOperationException {
        List<EmergencyCase> cases = emergencyDao.findAll();
        long total = 0;
        int count = 0;
        for (EmergencyCase emergencyCase : cases) {
            if (emergencyCase.getRaisedAt() != null && emergencyCase.getDispatchedAt() != null) {
                total += Duration.between(emergencyCase.getRaisedAt(), emergencyCase.getDispatchedAt()).toMillis();
                count++;
            }
        }
        return count == 0 ? OptionalDouble.empty() : OptionalDouble.of((double) total / count);
    }

    public int getQueueSize() {
        return queue.size();
    }

    public BedPool getBedPool() {
        return bedPool;
    }

    private record Preemption(Doctor doctor, Appointment appointment) {
    }
}
