package com.hospital.haes.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EmergencyApiTest {

    private static final Path TEMP = WebTestSupport.newTempDir();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("haes.db", () -> TEMP.resolve("haes.db").toString());
        registry.add("haes.audit", () -> TEMP.resolve("audit.log").toString());
        registry.add("haes.emergency.auto-start", () -> "false");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("An emergency raised by staff appears on the board")
    void raisedCaseAppearsOnBoard() throws Exception {
        Cookie er = WebTestSupport.login(mockMvc, "er.patel", "er123");
        mockMvc.perform(post("/api/emergencies").cookie(er)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"CARDIAC\",\"severity\":\"HIGH\",\"location\":\"ER Gate\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.severity").value("HIGH"));

        mockMvc.perform(get("/api/emergencies/board").cookie(er))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cases[0].location").exists())
                .andExpect(jsonPath("$.availableBeds").exists());
    }

    @Test
    @DisplayName("A patient raising an emergency is recorded against their own account")
    void patientCaseIsForcedToSelf() throws Exception {
        Cookie patient = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        MvcResult me = mockMvc.perform(get("/api/auth/me").cookie(patient)).andReturn();
        int patientId = objectMapper.readTree(
                me.getResponse().getContentAsString()).get("id").asInt();

        mockMvc.perform(post("/api/emergencies").cookie(patient)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"patientId\":9999,\"type\":\"STROKE\",\"severity\":\"CRITICAL\","
                                + "\"location\":\"Ward 2\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.patientId").value(patientId));
    }

    @Test
    @DisplayName("A patient cannot acknowledge an emergency")
    void patientCannotAcknowledge() throws Exception {
        Cookie er = WebTestSupport.login(mockMvc, "er.patel", "er123");
        MvcResult raised = mockMvc.perform(post("/api/emergencies").cookie(er)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"TRAUMA\",\"severity\":\"MEDIUM\",\"location\":\"ER\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        int id = objectMapper.readTree(
                raised.getResponse().getContentAsString()).get("id").asInt();

        Cookie patient = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        mockMvc.perform(post("/api/emergencies/" + id + "/acknowledge").cookie(patient))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("An admin can resolve a case")
    void adminCanResolve() throws Exception {
        Cookie er = WebTestSupport.login(mockMvc, "er.patel", "er123");
        MvcResult raised = mockMvc.perform(post("/api/emergencies").cookie(er)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"OTHER\",\"severity\":\"MEDIUM\",\"location\":\"ER\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(raised.getResponse().getContentAsString());
        int id = body.get("id").asInt();

        Cookie admin = WebTestSupport.login(mockMvc, "admin", "admin123");
        mockMvc.perform(post("/api/emergencies/" + id + "/resolve").cookie(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"Handled\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));
    }
}
