package com.hospital.haes.web.dto;

import java.time.LocalDateTime;

public record DefineAvailabilityRequest(LocalDateTime start, LocalDateTime end) {
}
