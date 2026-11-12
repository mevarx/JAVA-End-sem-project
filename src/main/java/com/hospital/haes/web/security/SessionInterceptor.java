package com.hospital.haes.web.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.haes.web.dto.ApiError;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Set;

/**
 * Resolves the session cookie for every /api call, rejects anonymous requests, and
 * enforces the coarse {@link RequireRole} guard. The login and registration endpoints
 * are public so a browser can obtain a session in the first place.
 */
@Component
public class SessionInterceptor implements HandlerInterceptor {

    public static final String COOKIE_NAME = "HAES_SESSION";

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/login", "/api/auth/register", "/api/health");

    private final SessionRegistry sessions;
    private final ObjectMapper objectMapper;

    public SessionInterceptor(SessionRegistry sessions, ObjectMapper objectMapper) {
        this.sessions = sessions;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if (HttpMethod.OPTIONS.matches(request.getMethod())
                || PUBLIC_PATHS.contains(request.getRequestURI())) {
            return true;
        }

        String token = readToken(request);
        var session = sessions.find(token);
        if (session.isEmpty()) {
            writeError(response, HttpStatus.UNAUTHORIZED, "Please sign in.");
            return false;
        }
        WebSession current = session.get();
        request.setAttribute(CurrentUser.ATTRIBUTE, current);

        RequireRole required = requiredRole(handler);
        if (required != null && !Arrays.asList(required.value()).contains(current.role())) {
            writeError(response, HttpStatus.FORBIDDEN, "You do not have access to this action.");
            return false;
        }
        return true;
    }

    private RequireRole requiredRole(Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return null;
        }
        RequireRole onMethod = handlerMethod.getMethodAnnotation(RequireRole.class);
        if (onMethod != null) {
            return onMethod;
        }
        return handlerMethod.getBeanType().getAnnotation(RequireRole.class);
    }

    private String readToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private void writeError(HttpServletResponse response, HttpStatus status, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(),
                new ApiError(status.value(), status.getReasonPhrase(), message, LocalDateTime.now()));
    }
}
