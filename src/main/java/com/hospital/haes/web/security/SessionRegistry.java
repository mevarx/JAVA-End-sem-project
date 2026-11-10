package com.hospital.haes.web.security;

import com.hospital.haes.model.User;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory session store. Sessions live for the lifetime of the server process;
 * the app is a single-machine academic simulation, so external persistence would add
 * no value.
 */
@Component
public class SessionRegistry {

    private static final Duration IDLE_TIMEOUT = Duration.ofHours(8);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final Map<String, WebSession> sessions = new ConcurrentHashMap<>();

    public WebSession create(User user) {
        pruneExpired();
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now();
        WebSession session = new WebSession(token, user.getId(), user.getRole(),
                user.getFullName(), now, now);
        sessions.put(token, session);
        return session;
    }

    /** Returns the session and refreshes its idle timer, or empty when unknown/expired. */
    public Optional<WebSession> find(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        WebSession session = sessions.get(token);
        if (session == null) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        if (isExpired(session, now)) {
            sessions.remove(token);
            return Optional.empty();
        }
        WebSession touched = session.touched(now);
        sessions.put(token, touched);
        return Optional.of(touched);
    }

    public void remove(String token) {
        if (token != null) {
            sessions.remove(token);
        }
    }

    public void clear() {
        sessions.clear();
    }

    public int size() {
        return sessions.size();
    }

    private void pruneExpired() {
        Instant now = Instant.now();
        sessions.values().removeIf(session -> isExpired(session, now));
    }

    private boolean isExpired(WebSession session, Instant now) {
        return session.lastSeenAt().plus(IDLE_TIMEOUT).isBefore(now);
    }

    public static Duration idleTimeout() {
        return IDLE_TIMEOUT;
    }
}
