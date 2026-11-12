package com.hospital.haes.model;

public class Doctor extends User {

    private String specialization;
    private boolean onCall;

    public Doctor(int id, String username, String passwordHash, String fullName,
                  String phone, Integer departmentId, boolean active,
                  String specialization, boolean onCall) {
        super(id, username, passwordHash, fullName, phone, departmentId, active);
        this.specialization = specialization;
        this.onCall = onCall;
    }

    @Override
    public Role getRole() {
        return Role.DOCTOR;
    }

    @Override
    public String getSpecialization() {
        return specialization;
    }

    public boolean isOnCall() {
        return onCall;
    }
}
