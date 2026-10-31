package com.hospital.haes.model;

public enum SlotStatus {
    FREE("Free"),
    BOOKED("Booked");

    private final String label;

    SlotStatus(String label) {
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
