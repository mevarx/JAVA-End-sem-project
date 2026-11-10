package com.hospital.haes.web.dto;

import java.time.LocalDateTime;

public record EmergencyEventDto(
        int id,
        int emergencyId,
        String eventType,
        LocalDateTime eventTime,
        String note) {
}
