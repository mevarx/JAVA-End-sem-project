package com.hospital.haes.web.dto;

public record StatsDto(
        int queueSize,
        int availableBeds,
        int bedCapacity,
        Double averageDispatchMillis) {
}
