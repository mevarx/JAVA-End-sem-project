package com.hospital.haes.web.security;

import jakarta.servlet.http.HttpServletRequest;

/** Reads the session that SessionInterceptor attached to the request. */
public final class CurrentUser {

    public static final String ATTRIBUTE = "haes.session";

    private CurrentUser() {
    }

    public static WebSession of(HttpServletRequest request) {
        Object value = request.getAttribute(ATTRIBUTE);
        if (value instanceof WebSession session) {
            return session;
        }
        throw new IllegalStateException("No authenticated session on this request");
    }

    public static boolean isStaff(WebSession session) {
        return switch (session.role()) {
            case RECEPTIONIST, ER_STAFF, ADMIN -> true;
            default -> false;
        };
    }
}
