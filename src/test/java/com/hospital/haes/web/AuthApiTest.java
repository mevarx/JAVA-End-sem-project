package com.hospital.haes.web;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthApiTest {

    private static final Path TEMP = WebTestSupport.newTempDir();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("haes.db", () -> TEMP.resolve("haes.db").toString());
        registry.add("haes.audit", () -> TEMP.resolve("audit.log").toString());
        registry.add("haes.emergency.auto-start", () -> "false");
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Health endpoint is public")
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    @DisplayName("Login sets a hardened session cookie and never returns the password hash")
    void loginIssuesSecureCookie() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(WebTestSupport.loginBody("admin", "admin123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("admin"))
                .andExpect(jsonPath("$.user.role").value("ADMIN"))
                .andReturn();

        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertNotNull(setCookie);
        assertTrue(setCookie.contains("HttpOnly"), setCookie);
        assertTrue(setCookie.contains("SameSite=Lax"), setCookie);

        String body = result.getResponse().getContentAsString();
        assertFalse(body.toLowerCase().contains("passwordhash"), body);
        assertFalse(body.toLowerCase().contains("password_hash"), body);
    }

    @Test
    @DisplayName("A wrong password is rejected")
    void wrongPasswordRejected() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(WebTestSupport.loginBody("admin", "nope")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Anonymous requests to a protected endpoint are rejected")
    void anonymousRejected() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("The session identifies the signed-in user")
    void sessionIdentifiesUser() throws Exception {
        Cookie cookie = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("patient.anita"))
                .andExpect(jsonPath("$.role").value("PATIENT"));
    }
}
