package com.hospital.haes.web.dto;

import java.time.LocalDateTime;

public record NotificationDto(
        int id,
        int targetUserId,
        String message,
        String level,
        LocalDateTime timestamp) {
}
