package com.hospital.haes.web.dto;

import java.util.List;

public record EmergencyBoardDto(
        List<EmergencyCaseDto> cases,
        int queueSize,
        int availableBeds,
        int bedCapacity,
        Double averageDispatchMillis) {
}
