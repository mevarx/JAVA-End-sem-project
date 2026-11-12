package com.hospital.haes.model;

import java.util.Objects;

/**
 * Abstract base for every actor. Concrete roles are modelled with
 * inheritance so permissions and role-specific data stay together.
 */
public abstract class User {

    private int id;
    private String username;
    private String passwordHash;
    private String fullName;
    private String phone;
    private Integer departmentId;
    private boolean active;

    protected User(int id, String username, String passwordHash, String fullName,
                   String phone, Integer departmentId, boolean active) {
        this.id = id;
        this.username = username;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.phone = phone;
        this.departmentId = departmentId;
        this.active = active;
    }

    public abstract Role getRole();

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    public String getPhone() {
        return phone;
    }

    public Integer getDepartmentId() {
        return departmentId;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    /** Doctors override this with their specialization; others return null. */
    public String getSpecialization() {
        return null;
    }

    @Override
    public String toString() {
        return fullName;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof User user)) {
            return false;
        }
        return id == user.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
