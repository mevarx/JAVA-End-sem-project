package com.hospital.haes.web.security;

import com.hospital.haes.model.Role;

import java.time.Instant;

/** An authenticated browser session. The token is opaque and only sent as a cookie. */
public record WebSession(
        String token,
        int userId,
        Role role,
        String fullName,
        Instant createdAt,
        Instant lastSeenAt) {

    public WebSession touched(Instant now) {
        return new WebSession(token, userId, role, fullName, createdAt, now);
    }
}
