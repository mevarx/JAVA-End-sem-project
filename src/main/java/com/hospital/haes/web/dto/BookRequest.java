package com.hospital.haes.web.dto;

public record BookRequest(Integer patientId, int slotId, String reason) {
}
