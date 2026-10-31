package com.hospital.haes.model;

public class Patient extends User {

    public Patient(int id, String username, String passwordHash, String fullName,
                   String phone, Integer departmentId, boolean active) {
        super(id, username, passwordHash, fullName, phone, departmentId, active);
    }

    @Override
    public Role getRole() {
        return Role.PATIENT;
    }
}
