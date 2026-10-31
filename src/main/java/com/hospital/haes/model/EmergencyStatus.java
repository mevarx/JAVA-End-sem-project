package com.hospital.haes.model;

public enum EmergencyStatus {
    WAITING("Waiting for responder"),
    ASSIGNED("Assigned"),
    ACKNOWLEDGED("Acknowledged"),
    ESCALATED("Escalated"),
    RESOLVED("Resolved");

    private final String label;

    EmergencyStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isActive() {
        return this != RESOLVED;
    }

    @Override
    public String toString() {
        return label;
    }
}
