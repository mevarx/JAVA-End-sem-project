package com.hospital.haes.web;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class RoleAccessTest {

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
    @DisplayName("A patient cannot list every user account")
    void patientCannotListUsers() throws Exception {
        Cookie cookie = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        mockMvc.perform(get("/api/users").cookie(cookie))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("An admin can list every user account")
    void adminCanListUsers() throws Exception {
        Cookie cookie = WebTestSupport.login(mockMvc, "admin", "admin123");
        mockMvc.perform(get("/api/users").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").exists());
    }

    @Test
    @DisplayName("Reception staff see every appointment; patients see their own")
    void appointmentScopeFollowsRole() throws Exception {
        Cookie reception = WebTestSupport.login(mockMvc, "reception", "reception123");
        mockMvc.perform(get("/api/appointments").cookie(reception))
                .andExpect(status().isOk());

        Cookie patient = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        mockMvc.perform(get("/api/appointments").cookie(patient))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Only an admin can open the reports endpoints")
    void reportsRequireAdmin() throws Exception {
        Cookie patient = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        mockMvc.perform(get("/api/reports/audit-log").cookie(patient))
                .andExpect(status().isForbidden());

        Cookie admin = WebTestSupport.login(mockMvc, "admin", "admin123");
        mockMvc.perform(get("/api/reports/audit-log").cookie(admin))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Emergency board is not available to patients")
    void patientsCannotOpenBoard() throws Exception {
        Cookie patient = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        mockMvc.perform(get("/api/emergencies/board").cookie(patient))
                .andExpect(status().isForbidden());
    }
}
