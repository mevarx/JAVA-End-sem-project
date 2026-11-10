package com.hospital.haes.web.dto;

import java.time.LocalDateTime;

public record SlotDto(
        int id,
        int doctorId,
        String doctorName,
        Integer departmentId,
        String departmentName,
        LocalDateTime start,
        LocalDateTime end,
        String status) {
}
