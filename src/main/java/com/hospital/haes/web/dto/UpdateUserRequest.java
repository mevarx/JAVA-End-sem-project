package com.hospital.haes.web.dto;

public record UpdateUserRequest(
        String username,
        String newPassword,
        String role,
        String fullName,
        String phone,
        Integer departmentId,
        String specialization,
        Boolean onCall) {
}
