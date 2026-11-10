package com.hospital.haes.web.dto;

import java.time.LocalDateTime;

public record AppointmentDto(
        int id,
        Integer slotId,
        int patientId,
        String patientName,
        int doctorId,
        String doctorName,
        LocalDateTime start,
        LocalDateTime end,
        String reason,
        String status,
        String statusLabel,
        LocalDateTime createdAt) {
}
