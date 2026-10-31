package com.hospital.haes.model;

public class Receptionist extends User {

    public Receptionist(int id, String username, String passwordHash, String fullName,
                        String phone, Integer departmentId, boolean active) {
        super(id, username, passwordHash, fullName, phone, departmentId, active);
    }

    @Override
    public Role getRole() {
        return Role.RECEPTIONIST;
    }
}
