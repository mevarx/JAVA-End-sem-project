package com.hospital.haes.ui;

import com.hospital.haes.model.Role;
import com.hospital.haes.model.User;
import com.hospital.haes.util.Result;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AppContextTest {

    @TempDir
    Path tempDir;

    @Test
    @DisplayName("Bootstrap seeds demo data, supports every demo role and exports reports")
    void bootstrapSeedsDemoData() throws Exception {
        Path database = tempDir.resolve("app.db");
        Path audit = tempDir.resolve("audit.log");
        AppContext context = AppContext.bootstrap(database, audit);
        try {
            assertTrue(Files.exists(database));
            assertTrue(Files.exists(audit));
            assertTrue(context.userService().listAll().size() >= 10);

            User admin = context.authService().login("admin", "admin123");
            assertEquals(Role.ADMIN, admin.getRole());
            assertEquals(Role.RECEPTIONIST, context.authService()
                    .login("reception", "reception123").getRole());
            assertEquals(Role.DOCTOR, context.authService()
                    .login("dr.sharma", "doctor123").getRole());
            assertEquals(Role.ER_STAFF, context.authService()
                    .login("er.patel", "er123").getRole());
            assertEquals(Role.PATIENT, context.authService()
                    .login("patient.anita", "patient123").getRole());

            assertFalse(context.appointmentService().listAll().isEmpty());
            assertFalse(context.appointmentService().listDoctorSlots(
                    context.userService().listDoctors().get(0).getId()).isEmpty());
            assertFalse(context.emergencyService().getAllCases().isEmpty());
            assertEquals(8, context.emergencyService().getBedPool().getCapacity());

            Result<Path> appointmentExport = context.reportingService()
                    .exportAppointments(tempDir.resolve("appointments.csv"));
            assertTrue(appointmentExport.isSuccess(), appointmentExport.getError());
            assertTrue(Files.readString(appointmentExport.getValue()).startsWith("appointment_id,"));

            Result<Path> emergencyExport = context.reportingService()
                    .exportEmergencies(tempDir.resolve("emergencies.csv"));
            assertTrue(emergencyExport.isSuccess(), emergencyExport.getError());
            assertTrue(Files.readString(emergencyExport.getValue()).startsWith("emergency_id,"));

            context.emergencyService().start();
            assertTrue(context.emergencyService().isRunning());
            context.emergencyService().stop();
            assertFalse(context.emergencyService().isRunning());
        } finally {
            context.shutdown();
        }
    }

    @Test
    @DisplayName("CSV availability import uses the seeded doctor accounts")
    void csvImportAddsAvailability() throws Exception {
        AppContext context = AppContext.bootstrap(tempDir.resolve("import.db"),
                tempDir.resolve("import-audit.log"));
        try {
            int before = context.slotDao().findAll().size();
            Path csv = tempDir.resolve("availability.csv");
            Files.writeString(csv, """
                    doctor_username,date,start,end
                    dr.sharma,%s,11:15,11:45
                    missing.doctor,%s,12:00,12:30
                    """.formatted(java.time.LocalDate.now().plusDays(2),
                    java.time.LocalDate.now().plusDays(2)));

            Result<Integer> result = context.reportingService().importSlots(csv);

            // One valid row is imported; the unknown doctor is reported as a row error.
            assertFalse(result.isSuccess());
            assertTrue(result.getError().contains("1 slot(s) imported"));
            assertTrue(result.getError().contains("unknown doctor 'missing.doctor'"));
            assertEquals(before + 1, context.slotDao().findAll().size());
        } finally {
            context.shutdown();
        }
    }
}
