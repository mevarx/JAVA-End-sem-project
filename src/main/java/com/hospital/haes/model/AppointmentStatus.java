package com.hospital.haes.model;

public enum AppointmentStatus {
    BOOKED("Booked"),
    COMPLETED("Completed"),
    CANCELLED("Cancelled"),
    NO_SHOW("No show"),
    RESCHEDULED("Rescheduled"),
    PRE_EMPTED("Pre-empted (emergency)");

    private final String label;

    AppointmentStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    @Override
    public String toString() {
        return label;
    }
}
