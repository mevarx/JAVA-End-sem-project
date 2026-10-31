package com.hospital.haes.model;

public class Admin extends User {

    public Admin(int id, String username, String passwordHash, String fullName,
                 String phone, Integer departmentId, boolean active) {
        super(id, username, passwordHash, fullName, phone, departmentId, active);
    }

    @Override
    public Role getRole() {
        return Role.ADMIN;
    }
}
