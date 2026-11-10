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
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class BookingApiTest {

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
    @DisplayName("A patient books a slot; a second patient gets a conflict")
    void bookingIsConflictFree() throws Exception {
        Cookie doctor = WebTestSupport.login(mockMvc, "dr.sharma", "doctor123");
        int slotId = publishSlot(doctor, "11:15", "11:45");

        Cookie anita = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        Cookie rahul = WebTestSupport.login(mockMvc, "patient.rahul", "patient123");

        mockMvc.perform(post("/api/appointments").cookie(anita)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slotId + ",\"reason\":\"Annual check-up\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("BOOKED"));

        mockMvc.perform(post("/api/appointments").cookie(rahul)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slotId + ",\"reason\":\"Second attempt\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("A patient cannot book on behalf of someone else")
    void patientBookingIsForcedToSelf() throws Exception {
        Cookie doctor = WebTestSupport.login(mockMvc, "dr.sharma", "doctor123");
        int slotId = publishSlot(doctor, "12:15", "12:45");

        Cookie anita = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        Cookie rahul = WebTestSupport.login(mockMvc, "patient.rahul", "patient123");
        int anitaId = currentUserId(anita);
        int rahulId = currentUserId(rahul);
        assertTrue(anitaId != rahulId);

        mockMvc.perform(post("/api/appointments").cookie(anita)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"patientId\":" + rahulId + ",\"slotId\":" + slotId
                                + ",\"reason\":\"Trying another patient\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.patientId").value(anitaId));
    }

    @Test
    @DisplayName("Cancelling frees the slot again")
    void cancelFreesSlot() throws Exception {
        Cookie doctor = WebTestSupport.login(mockMvc, "dr.sharma", "doctor123");
        int slotId = publishSlot(doctor, "13:15", "13:45");

        Cookie anita = WebTestSupport.login(mockMvc, "patient.anita", "patient123");
        MvcResult booked = mockMvc.perform(post("/api/appointments").cookie(anita)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slotId + ",\"reason\":\"To cancel\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        int appointmentId = objectMapper.readTree(
                booked.getResponse().getContentAsString()).get("id").asInt();

        mockMvc.perform(post("/api/appointments/" + appointmentId + "/cancel").cookie(anita))
                .andExpect(status().isNoContent());

        String date = LocalDate.now().plusDays(2).toString();
        mockMvc.perform(get("/api/slots/available").cookie(anita)
                        .param("date", date))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + slotId + ")]").exists());
    }

    private int publishSlot(Cookie doctor, String startTime, String endTime) throws Exception {
        String date = LocalDate.now().plusDays(2).toString();
        MvcResult result = mockMvc.perform(post("/api/slots").cookie(doctor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"start\":\"" + date + "T" + startTime + ":00\","
                                + "\"end\":\"" + date + "T" + endTime + ":00\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("id").asInt();
    }

    private int currentUserId(Cookie cookie) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asInt();
    }
}
