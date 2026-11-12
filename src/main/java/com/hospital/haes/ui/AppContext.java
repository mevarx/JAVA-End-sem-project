package com.hospital.haes.ui;

import com.hospital.haes.dao.AppointmentDao;
import com.hospital.haes.dao.DatabaseManager;
import com.hospital.haes.dao.DepartmentDao;
import com.hospital.haes.dao.EmergencyDao;
import com.hospital.haes.dao.SampleData;
import com.hospital.haes.dao.SlotDao;
import com.hospital.haes.dao.UserDao;
import com.hospital.haes.exception.DatabaseOperationException;
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

import java.nio.file.Path;

/**
 * Composition root. Wires concrete DAOs and services exactly once and
 * exposes them to views. No view constructs its own database objects.
 */
public final class AppContext {

    private final DatabaseManager databaseManager;
    private final DepartmentDao departmentDao;
    private final SlotDao slotDao;
    private final AuthService authService;
    private final UserService userService;
    private final DepartmentService departmentService;
    private final AppointmentService appointmentService;
    private final EmergencyService emergencyService;
    private final NotificationService notificationService;
    private final ReportingService reportingService;
    private final FileLogger auditLog;

    private AppContext(DatabaseManager databaseManager,
                       DepartmentDao departmentDao, SlotDao slotDao,
                       AuthService authService, UserService userService,
                       DepartmentService departmentService, AppointmentService appointmentService,
                       EmergencyService emergencyService, NotificationService notificationService,
                       ReportingService reportingService, FileLogger auditLog) {
        this.databaseManager = databaseManager;
        this.departmentDao = departmentDao;
        this.slotDao = slotDao;
        this.authService = authService;
        this.userService = userService;
        this.departmentService = departmentService;
        this.appointmentService = appointmentService;
        this.emergencyService = emergencyService;
        this.notificationService = notificationService;
        this.reportingService = reportingService;
        this.auditLog = auditLog;
    }

    public static AppContext bootstrap(Path databaseFile, Path auditLogFile)
            throws DatabaseOperationException {
        DatabaseManager databaseManager = new DatabaseManager(databaseFile);
        UserDao userDao = new UserDao(databaseManager);
        DepartmentDao departmentDao = new DepartmentDao(databaseManager);
        SlotDao slotDao = new SlotDao(databaseManager);
        AppointmentDao appointmentDao = new AppointmentDao(databaseManager);
        EmergencyDao emergencyDao = new EmergencyDao(databaseManager);

        SampleData.seedIfEmpty(databaseManager, userDao, departmentDao, slotDao,
                appointmentDao, emergencyDao);

        NotificationService notificationService = new NotificationService();
        SlotLockManager slotLocks = new SlotLockManager();
        AppointmentService appointmentService = new AppointmentService(databaseManager, slotDao,
                appointmentDao, userDao, notificationService, slotLocks);
        AuthService authService = new AuthService(userDao);
        UserService userService = new UserService(userDao, departmentDao);
        DepartmentService departmentService = new DepartmentService(departmentDao);
        FileLogger auditLog = new FileLogger(auditLogFile);
        EmergencyService emergencyService = new EmergencyService(databaseManager, emergencyDao,
                userDao, appointmentService, notificationService, auditLog, 8, 30);
        ReportingService reportingService = new ReportingService(appointmentDao, emergencyDao,
                userDao, appointmentService, new CsvExporter(), new CsvImporter());

        return new AppContext(databaseManager, departmentDao, slotDao, authService, userService,
                departmentService, appointmentService, emergencyService, notificationService,
                reportingService, auditLog);
    }

    public DatabaseManager databaseManager() {
        return databaseManager;
    }

    public DepartmentDao departmentDao() {
        return departmentDao;
    }

    public SlotDao slotDao() {
        return slotDao;
    }

    public AuthService authService() {
        return authService;
    }

    public UserService userService() {
        return userService;
    }

    public DepartmentService departmentService() {
        return departmentService;
    }

    public AppointmentService appointmentService() {
        return appointmentService;
    }

    public EmergencyService emergencyService() {
        return emergencyService;
    }

    public NotificationService notificationService() {
        return notificationService;
    }

    public ReportingService reportingService() {
        return reportingService;
    }

    public FileLogger auditLog() {
        return auditLog;
    }

    public void shutdown() {
        emergencyService.stop();
    }
}
