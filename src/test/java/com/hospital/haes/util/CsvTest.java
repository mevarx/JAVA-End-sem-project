package com.hospital.haes.util;

import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyStatus;
import com.hospital.haes.model.EmergencyType;
import com.hospital.haes.model.Severity;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CsvTest {

    @TempDir
    Path tempDir;

    private final CsvImporter importer = new CsvImporter();
    private final CsvExporter exporter = new CsvExporter();

    @Test
    @DisplayName("CSV import reads headers, comments, quoted values and flexible times")
    void importsValidSlotRows() throws Exception {
        Path source = write("""
                # Sample availability
                doctor_username,date,start,end
                dr.sharma,2026-11-02,09:00,09:30
                dr.patel,2026-11-03,9:30,10:15
                "dr.quoted",2026-11-04,14:00,15:00
                """);

        List<CsvImporter.SlotRow> rows = importer.readSlotRows(source);

        assertEquals(3, rows.size());
        assertEquals("dr.sharma", rows.get(0).doctorUsername());
        assertEquals(LocalDate.of(2026, 11, 2), rows.get(0).date());
        assertEquals(LocalTime.of(9, 0), rows.get(0).start());
        assertEquals(LocalTime.of(9, 30), rows.get(0).end());
        assertEquals(LocalTime.of(9, 30), rows.get(1).start());
        assertEquals("dr.quoted", rows.get(2).doctorUsername());
    }

    @Test
    @DisplayName("CSV import rejects malformed rows with a line number")
    void rejectsMalformedRows() throws Exception {
        ValidationException columns = assertThrows(ValidationException.class,
                () -> importer.readSlotRows(write("""
                        doctor_username,date,start,end
                        dr.sharma,2026-11-02,09:00
                        """)));
        assertTrue(columns.getMessage().contains("Line 2"));
        assertTrue(columns.getMessage().contains("4 columns"));

        ValidationException date = assertThrows(ValidationException.class,
                () -> importer.readSlotRows(write("""
                        dr.sharma,02-11-2026,09:00,09:30
                        """)));
        assertTrue(date.getMessage().contains("Line 1"));
        assertTrue(date.getMessage().contains("invalid date"));

        ValidationException time = assertThrows(ValidationException.class,
                () -> importer.readSlotRows(write("""
                        dr.sharma,2026-11-02,25:00,26:00
                        """)));
        assertTrue(time.getMessage().contains("invalid time"));

        ValidationException order = assertThrows(ValidationException.class,
                () -> importer.readSlotRows(write("""
                        dr.sharma,2026-11-02,10:00,09:00
                        """)));
        assertTrue(order.getMessage().contains("end must be after start"));

        ValidationException empty = assertThrows(ValidationException.class,
                () -> importer.readSlotRows(write("""
                        # no data
                        doctor_username,date,start,end
                        """)));
        assertTrue(empty.getMessage().contains("no slot rows"));
    }

    @Test
    @DisplayName("Appointment export is RFC-4180 quoted and includes joined slot details")
    void exportsAppointmentsWithQuoting() throws Exception {
        Slot slot = new Slot(7, 42,
                LocalDateTime.of(2026, 11, 2, 9, 0),
                LocalDateTime.of(2026, 11, 2, 9, 30), SlotStatus.BOOKED);
        slot.setDoctorName("Dr. Sharma");
        slot.setDepartmentName("Cardiology, North");
        Appointment appointment = new Appointment(11, slot, 5,
                "Chest pain, \"urgent\"", AppointmentStatus.BOOKED,
                LocalDateTime.of(2026, 11, 1, 10, 15));
        appointment.setPatientName("Anita, Rao");

        Path target = tempDir.resolve("appointments.csv");
        exporter.exportAppointments(target, List.of(appointment));
        String csv = Files.readString(target);

        assertTrue(csv.startsWith("appointment_id,date,start,end,doctor,department,patient,reason,status,created_at"));
        assertTrue(csv.contains("11,2026-11-02,09:00,09:30"));
        assertTrue(csv.contains("\"Cardiology, North\""));
        assertTrue(csv.contains("\"Anita, Rao\""));
        assertTrue(csv.contains("\"Chest pain, \"\"urgent\"\"\""));
        assertTrue(csv.contains(",BOOKED,"));
    }

    @Test
    @DisplayName("Emergency and slot exports handle nullable fields")
    void exportsEmergenciesAndSlots() throws Exception {
        EmergencyCase emergency = EmergencyCase.waiting(null, "Walk-in",
                EmergencyType.CARDIAC, Severity.CRITICAL, "ER",
                LocalDateTime.of(2026, 11, 2, 8, 0));
        emergency.setId(3);
        Path emergencyFile = tempDir.resolve("emergencies.csv");
        exporter.exportEmergencies(emergencyFile, List.of(emergency));
        String emergencies = Files.readString(emergencyFile);
        assertTrue(emergencies.startsWith("emergency_id,severity,type,location,patient,status,assigned_to,bed"));
        assertTrue(emergencies.contains("3,CRITICAL,CARDIAC,ER,Walk-in,WAITING,,,"));
        assertTrue(emergencies.contains("2026-11-02T08:00"));
        assertTrue(emergencies.strip().endsWith(",0"));

        Slot slot = new Slot(9, 2,
                LocalDateTime.of(2026, 11, 2, 11, 0),
                LocalDateTime.of(2026, 11, 2, 11, 30), SlotStatus.FREE);
        slot.setDoctorName("Dr. Patel, MD");
        Path slotFile = tempDir.resolve("slots.csv");
        exporter.exportSlots(slotFile, List.of(slot));
        String slots = Files.readString(slotFile);
        assertTrue(slots.startsWith("slot_id,doctor,date,start,end,status"));
        assertTrue(slots.contains("\"Dr. Patel, MD\""));
        assertTrue(slots.contains("9,"));
        assertTrue(slots.contains(",FREE"));
    }

    private Path write(String content) throws Exception {
        Path file = tempDir.resolve("input-" + System.nanoTime() + ".csv");
        Files.writeString(file, content);
        return file;
    }
}
