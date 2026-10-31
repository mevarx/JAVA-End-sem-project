package com.hospital.haes.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class EmergencyEvent {

    private static final DateTimeFormatter DISPLAY_TIME =
            DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm:ss");

    private int id;
    private int emergencyId;
    private String eventType;
    private LocalDateTime eventTime;
    private String note;

    public EmergencyEvent(int id, int emergencyId, String eventType,
                          LocalDateTime eventTime, String note) {
        this.id = id;
        this.emergencyId = emergencyId;
        this.eventType = eventType;
        this.eventTime = eventTime;
        this.note = note;
    }

    public EmergencyEvent(int emergencyId, String eventType, LocalDateTime eventTime, String note) {
        this(0, emergencyId, eventType, eventTime, note);
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public int getEmergencyId() {
        return emergencyId;
    }

    public String getEventType() {
        return eventType;
    }

    public LocalDateTime getEventTime() {
        return eventTime;
    }

    public String getNote() {
        return note;
    }

    public String getFormattedTime() {
        return eventTime.format(DISPLAY_TIME);
    }

    @Override
    public String toString() {
        return eventTime.format(DISPLAY_TIME) + "  " + eventType
                + (note == null || note.isBlank() ? "" : " - " + note);
    }
}
