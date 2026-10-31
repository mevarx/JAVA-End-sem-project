package com.hospital.haes.service;

import com.hospital.haes.dao.AppointmentDao;
import com.hospital.haes.dao.EmergencyDao;
import com.hospital.haes.dao.UserDao;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.User;
import com.hospital.haes.util.CsvExporter;
import com.hospital.haes.util.CsvImporter;
import com.hospital.haes.util.Result;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

/**
 * CSV reporting facade. Returns Result<T> for UI-friendly success/failure
 * without exposing IO exceptions to controllers.
 */
public class ReportingService {

    private final AppointmentDao appointmentDao;
    private final EmergencyDao emergencyDao;
    private final UserDao userDao;
    private final AppointmentService appointmentService;
    private final CsvExporter exporter;
    private final CsvImporter importer;

    public ReportingService(AppointmentDao appointmentDao, EmergencyDao emergencyDao,
                            UserDao userDao, AppointmentService appointmentService,
                            CsvExporter exporter, CsvImporter importer) {
        this.appointmentDao = appointmentDao;
        this.emergencyDao = emergencyDao;
        this.userDao = userDao;
        this.appointmentService = appointmentService;
        this.exporter = exporter;
        this.importer = importer;
    }

    public Result<Path> exportAppointments(Path target) {
        try {
            List<Appointment> appointments = appointmentDao.findAll();
            exporter.exportAppointments(target, appointments);
            return Result.ok(target);
        } catch (DatabaseOperationException | IOException e) {
            return Result.fail("Appointment export failed: " + e.getMessage());
        }
    }

    public Result<Path> exportEmergencies(Path target) {
        try {
            List<EmergencyCase> cases = emergencyDao.findAll();
            exporter.exportEmergencies(target, cases);
            return Result.ok(target);
        } catch (DatabaseOperationException | IOException e) {
            return Result.fail("Emergency export failed: " + e.getMessage());
        }
    }

    public Result<Integer> importSlots(Path source) {
        try {
            CsvImporter.SlotRow[] rows = importer.readSlotRows(source).toArray(new CsvImporter.SlotRow[0]);
            int imported = 0;
            StringBuilder errors = new StringBuilder();
            for (int i = 0; i < rows.length; i++) {
                CsvImporter.SlotRow row = rows[i];
                Optional<User> doctor = userDao.findByUsername(row.doctorUsername());
                if (doctor.isEmpty() || doctor.get().getRole() != Role.DOCTOR) {
                    appendError(errors, i + 1, "unknown doctor '" + row.doctorUsername() + "'");
                    continue;
                }
                try {
                    appointmentService.defineAvailability(doctor.get().getId(),
                            row.date().atTime(row.start()), row.date().atTime(row.end()));
                    imported++;
                } catch (SlotConflictException | ValidationException e) {
                    appendError(errors, i + 1, e.getMessage());
                }
            }
            if (errors.length() > 0) {
                return Result.fail(imported + " slot(s) imported, but some rows failed: " + errors);
            }
            return Result.ok(imported);
        } catch (IOException e) {
            return Result.fail("Could not read the CSV file: " + e.getMessage());
        } catch (ValidationException e) {
            return Result.fail(e.getMessage());
        } catch (DatabaseOperationException e) {
            return Result.fail("Database error during import: " + e.getMessage());
        }
    }

    private void appendError(StringBuilder errors, int row, String message) {
        if (errors.length() > 0) {
            errors.append("; ");
        }
        errors.append("row ").append(row).append(": ").append(message);
    }
}
