package com.hospital.haes.model;

public enum Role {
    PATIENT("Patient"),
    DOCTOR("Doctor"),
    RECEPTIONIST("Receptionist"),
    ER_STAFF("ER Staff"),
    ADMIN("Admin");

    private final String label;

    Role(String label) {
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
