package com.hospital.haes.web.dto;

/** A user as seen by clients. Never contains the password hash. */
public record UserDto(
        int id,
        String username,
        String fullName,
        String phone,
        Integer departmentId,
        boolean active,
        String role,
        String specialization,
        Boolean onCall) {
}
