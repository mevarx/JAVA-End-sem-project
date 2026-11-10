package com.hospital.haes.web.dto;

import java.time.LocalDateTime;

public record EmergencyCaseDto(
        int id,
        Integer patientId,
        String patientLabel,
        String type,
        String typeLabel,
        String severity,
        String severityLabel,
        String location,
        String status,
        String statusLabel,
        Integer assignedTo,
        String assignedToName,
        Integer bedNo,
        LocalDateTime raisedAt,
        LocalDateTime dispatchedAt,
        LocalDateTime acknowledgedAt,
        LocalDateTime escalatedAt,
        LocalDateTime resolvedAt,
        int escalationCount) {
}
