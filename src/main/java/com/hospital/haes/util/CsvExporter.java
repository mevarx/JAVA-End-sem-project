package com.hospital.haes.util;

import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.Slot;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * RFC-4180-style CSV export for schedules and emergency reports.
 */
public class CsvExporter {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    public void exportAppointments(Path target, List<Appointment> appointments) throws IOException {
        createParent(target);
        try (BufferedWriter writer = Files.newBufferedWriter(target, StandardCharsets.UTF_8)) {
            writer.write("appointment_id,date,start,end,doctor,department,patient,reason,status,created_at");
            writer.newLine();
            for (Appointment appointment : appointments) {
                Slot slot = appointment.getSlot();
                StringBuilder line = new StringBuilder();
                field(line, appointment.getId());
                field(line, slot == null ? "" : slot.getStart().format(DATE));
                field(line, slot == null ? "" : slot.getStart().format(TIME));
                field(line, slot == null ? "" : slot.getEnd().format(TIME));
                field(line, appointment.getDoctorName());
                field(line, slot == null ? "" : slot.getDepartmentName());
                field(line, appointment.getPatientName());
                field(line, appointment.getReason());
                field(line, appointment.getStatus().name());
                field(line, appointment.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                writer.write(line.toString());
                writer.newLine();
            }
        }
    }

    public void exportEmergencies(Path target, List<EmergencyCase> emergencies) throws IOException {
        createParent(target);
        try (BufferedWriter writer = Files.newBufferedWriter(target, StandardCharsets.UTF_8)) {
            writer.write("emergency_id,severity,type,location,patient,status,assigned_to,bed,raised_at,dispatched_at,acknowledged_at,resolved_at,escalations");
            writer.newLine();
            for (EmergencyCase c : emergencies) {
                StringBuilder line = new StringBuilder();
                field(line, c.getId());
                field(line, c.getSeverity().name());
                field(line, c.getType().name());
                field(line, c.getLocation());
                field(line, c.getPatientLabel());
                field(line, c.getStatus().name());
                field(line, c.getAssignedToName() == null ? "" : c.getAssignedToName());
                field(line, c.getBedNo() == null ? "" : c.getBedNo());
                field(line, c.getRaisedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                field(line, c.getDispatchedAt() == null ? "" : c.getDispatchedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                field(line, c.getAcknowledgedAt() == null ? "" : c.getAcknowledgedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                field(line, c.getResolvedAt() == null ? "" : c.getResolvedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                field(line, c.getEscalationCount());
                writer.write(line.toString());
                writer.newLine();
            }
        }
    }

    public void exportSlots(Path target, List<Slot> slots) throws IOException {
        createParent(target);
        try (BufferedWriter writer = Files.newBufferedWriter(target, StandardCharsets.UTF_8)) {
            writer.write("slot_id,doctor,date,start,end,status");
            writer.newLine();
            for (Slot slot : slots) {
                StringBuilder line = new StringBuilder();
                field(line, slot.getId());
                field(line, slot.getDoctorName());
                field(line, slot.getStart().format(DATE));
                field(line, slot.getStart().format(TIME));
                field(line, slot.getEnd().format(TIME));
                field(line, slot.getStatus().name());
                writer.write(line.toString());
                writer.newLine();
            }
        }
    }

    private void createParent(Path target) throws IOException {
        Path parent = target.toAbsolutePath().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
    }

    private void field(StringBuilder line, Object value) {
        if (line.length() > 0) {
            line.append(',');
        }
        String text = value == null ? "" : String.valueOf(value);
        boolean needsQuotes = text.contains(",") || text.contains("\"")
                || text.contains("\n") || text.contains("\r");
        if (needsQuotes) {
            line.append('"').append(text.replace("\"", "\"\"")).append('"');
        } else {
            line.append(text);
        }
    }
}
