package com.hospital.haes.web.dto;

public record CreateUserRequest(
        String username,
        String password,
        String role,
        String fullName,
        String phone,
        Integer departmentId,
        String specialization,
        Boolean onCall) {
}
