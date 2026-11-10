package com.hospital.haes.web;

import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Shared helpers for the web-layer MockMvc tests. */
final class WebTestSupport {

    static final String SESSION_COOKIE = "HAES_SESSION";

    private WebTestSupport() {
    }

    static Path newTempDir() {
        try {
            return Files.createTempDirectory("haes-web-test-");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static String loginBody(String username, String password) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
    }

    /** Signs in and returns the session cookie, failing the test if login is rejected. */
    static Cookie login(MockMvc mockMvc, String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody(username, password)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie(SESSION_COOKIE);
        assertNotNull(cookie, "login should set the session cookie");
        return cookie;
    }
}
