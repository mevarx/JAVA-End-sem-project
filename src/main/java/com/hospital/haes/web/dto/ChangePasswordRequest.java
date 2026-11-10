package com.hospital.haes.web.dto;

public record ChangePasswordRequest(String currentPassword, String newPassword) {
}
