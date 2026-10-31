package com.hospital.haes;

import com.hospital.haes.dao.AppointmentDao;
import com.hospital.haes.dao.DatabaseManager;
import com.hospital.haes.dao.DepartmentDao;
import com.hospital.haes.dao.EmergencyDao;
import com.hospital.haes.dao.SlotDao;
import com.hospital.haes.dao.UserDao;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Admin;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.ErStaff;
import com.hospital.haes.model.Patient;
import com.hospital.haes.model.Receptionist;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;
import com.hospital.haes.model.User;
import com.hospital.haes.scheduler.SlotLockManager;
import com.hospital.haes.service.AppointmentService;
import com.hospital.haes.service.AuthService;
import com.hospital.haes.service.DepartmentService;
import com.hospital.haes.service.EmergencyService;
import com.hospital.haes.service.NotificationService;
import com.hospital.haes.service.ReportingService;
import com.hospital.haes.service.UserService;
import com.hospital.haes.util.CsvExporter;
import com.hospital.haes.util.CsvImporter;
import com.hospital.haes.util.FileLogger;
import com.hospital.haes.util.PasswordHasher;

import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * One isolated SQLite database plus a fully wired service graph for a single
 * test. Every fixture owns its own temporary directory, so tests never share
 * state and can run in any order.
 */
public final class TestFixture {

    public static final String DEFAULT_PASSWORD = "password123";
    private static final String DEFAULT_HASH = PasswordHasher.hash(DEFAULT_PASSWORD);

    public final Path directory;
    public final DatabaseManager databaseManager;
    public final UserDao userDao;
    public final DepartmentDao departmentDao;
    public final SlotDao slotDao;
    public final AppointmentDao appointmentDao;
    public final EmergencyDao emergencyDao;
    public final NotificationService notifications;
    public final SlotLockManager slotLocks;
    public final AppointmentService appointmentService;
    public final AuthService authService;
    public final UserService userService;
    public final DepartmentService departmentService;
    public final EmergencyService emergencyService;
    public final ReportingService reportingService;
    public final FileLogger auditLog;

    public final Department department;
    public final Admin admin;
    public final Doctor doctor;
    public final ErStaff erStaff;
    public final Patient patient;
    public final Patient patient2;

    private final LocalDateTime baseSlotStart;
    private final AtomicInteger slotSequence = new AtomicInteger();

    public TestFixture(Path directory) throws DatabaseOperationException {
        this(directory, 8, 30);
    }

    public TestFixture(Path directory, int bedCapacity, int ackTimeoutSeconds)
            throws DatabaseOperationException {
        this.directory = directory;
        this.databaseManager = new DatabaseManager(directory.resolve("haes.db"));
        this.userDao = new UserDao(databaseManager);
        this.departmentDao = new DepartmentDao(databaseManager);
        this.slotDao = new SlotDao(databaseManager);
        this.appointmentDao = new AppointmentDao(databaseManager);
        this.emergencyDao = new EmergencyDao(databaseManager);

        this.department = departmentDao.save(new Department("Cardiology"));
        this.notifications = new NotificationService();
        this.slotLocks = new SlotLockManager();
        this.appointmentService = new AppointmentService(databaseManager, slotDao,
                appointmentDao, userDao, notifications, slotLocks);
        this.authService = new AuthService(userDao);
        this.userService = new UserService(userDao, departmentDao);
        this.departmentService = new DepartmentService(departmentDao);
        this.auditLog = new FileLogger(directory.resolve("audit.log"));
        this.emergencyService = new EmergencyService(databaseManager, emergencyDao, userDao,
                appointmentService, notifications, auditLog, bedCapacity, ackTimeoutSeconds);
        this.reportingService = new ReportingService(appointmentDao, emergencyDao, userDao,
                appointmentService, new CsvExporter(), new CsvImporter());

        this.admin = (Admin) userDao.save(new Admin(
                0, "admin.fixture", DEFAULT_HASH, "Admin Fixture", null, null, true));
        this.doctor = createDoctor("doctor.fixture", "Cardiology");
        this.erStaff = createErStaff("er.fixture");
        this.patient = createPatient("patient.one");
        this.patient2 = createPatient("patient.two");

        this.baseSlotStart = LocalDate.now().plusDays(2).atTime(9, 0);
    }

    public Doctor createDoctor(String username, String specialization) throws DatabaseOperationException {
        return createDoctor(username, specialization, true);
    }

    public Doctor createDoctor(String username, String specialization, boolean onCall)
            throws DatabaseOperationException {
        Doctor doctor = new Doctor(0, username, DEFAULT_HASH, "Dr. " + username,
                "555-0100", department.getId(), true, specialization, onCall);
        return (Doctor) userDao.save(doctor);
    }

    public Patient createPatient(String username) throws DatabaseOperationException {
        Patient patient = new Patient(0, username, DEFAULT_HASH, "Patient " + username,
                "555-0200", null, true);
        return (Patient) userDao.save(patient);
    }

    public ErStaff createErStaff(String username) throws DatabaseOperationException {
        ErStaff staff = new ErStaff(0, username, DEFAULT_HASH, "ER " + username,
                "555-0300", department.getId(), true);
        return (ErStaff) userDao.save(staff);
    }

    public Receptionist createReceptionist(String username) throws DatabaseOperationException {
        Receptionist receptionist = new Receptionist(0, username, DEFAULT_HASH,
                "Reception " + username, "555-0400", null, true);
        return (Receptionist) userDao.save(receptionist);
    }

    /** Bulk creation used by the 50-thread booking race. */
    public List<Patient> createPatients(int count) throws DatabaseOperationException {
        List<Patient> patients = new ArrayList<>();
        databaseManager.inTransaction(connection -> {
            for (int i = 0; i < count; i++) {
                Patient patient = new Patient(0, "bulk.patient." + i, DEFAULT_HASH,
                        "Bulk Patient " + i, null, null, true);
                userDao.insert(connection, patient);
                patients.add(patient);
            }
            return null;
        });
        return patients;
    }

    public User deactivate(User user) throws DatabaseOperationException {
        user.setActive(false);
        userDao.update(user);
        return user;
    }

    /** A unique future slot start (09:00 two days from now, then every 30 min). */
    public LocalDateTime nextStart() {
        return baseSlotStart.plusMinutes(30L * slotSequence.getAndIncrement());
    }

    public Slot createSlot(int doctorId, LocalDateTime start, int durationMinutes)
            throws DatabaseOperationException {
        return createSlot(doctorId, start, start.plusMinutes(durationMinutes), SlotStatus.FREE);
    }

    public Slot createSlot(int doctorId, LocalDateTime start, int durationMinutes,
                           SlotStatus status) throws DatabaseOperationException {
        return createSlot(doctorId, start, start.plusMinutes(durationMinutes), status);
    }

    public Slot createSlot(int doctorId, LocalDateTime start, LocalDateTime end, SlotStatus status)
            throws DatabaseOperationException {
        return slotDao.save(new Slot(0, doctorId, start, end, status));
    }

    /** Directly seeds an appointment that is happening right now (cannot be booked through the service). */
    public Appointment createInProgressAppointment(Doctor doctor, Patient patient)
            throws DatabaseOperationException {
        LocalDateTime now = LocalDateTime.now().withNano(0);
        Slot slot = slotDao.save(new Slot(0, doctor.getId(), now.minusMinutes(10),
                now.plusMinutes(20), SlotStatus.BOOKED));
        return appointmentDao.save(new Appointment(0, slot, patient.getId(),
                "Routine consultation", AppointmentStatus.BOOKED, now.minusMinutes(15)));
    }

    public Role roleOf(User user) {
        return user.getRole();
    }

    public void close() {
        emergencyService.stop();
    }
}
