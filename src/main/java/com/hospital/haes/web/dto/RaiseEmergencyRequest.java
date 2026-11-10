package com.hospital.haes.web.dto;

public record RaiseEmergencyRequest(
        Integer patientId,
        String patientLabel,
        String type,
        String severity,
        String location) {
}
