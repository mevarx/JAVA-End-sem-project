package com.hospital.haes.service;

import com.hospital.haes.TestFixture;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminServiceTest {

    @TempDir
    Path tempDir;

    private TestFixture fixture;

    @BeforeEach
    void setUp() throws Exception {
        fixture = new TestFixture(tempDir);
    }

    @AfterEach
    void tearDown() {
        fixture.close();
    }

    @Test
    @DisplayName("Departments can be created, renamed and removed when empty")
    void departmentCrud() throws Exception {
        Department created = fixture.departmentService.create("  Physiotherapy  ");
        assertEquals("Physiotherapy", created.getName());

        assertThrows(ValidationException.class,
                () -> fixture.departmentService.create("physiotherapy"));
        assertThrows(ValidationException.class,
                () -> fixture.departmentService.create("   "));

        fixture.departmentService.update(created.getId(), "Rehabilitation");
        assertEquals("Rehabilitation",
                fixture.departmentDao.findById(created.getId()).orElseThrow().getName());
        assertThrows(ValidationException.class,
                () -> fixture.departmentService.update(fixture.department.getId(), "Rehabilitation"));

        fixture.departmentService.delete(created.getId());
        assertTrue(fixture.departmentDao.findById(created.getId()).isEmpty());
    }

    @Test
    @DisplayName("A department with users cannot be deleted")
    void departmentWithUsersCannotBeDeleted() {
        assertThrows(ValidationException.class,
                () -> fixture.departmentService.delete(fixture.department.getId()));
    }

    @Test
    @DisplayName("Admins can create role-specific users and responders are listed")
    void createsUsersForEveryRole() throws Exception {
        Doctor doctor = (Doctor) fixture.userService.createUser("new.doctor", "doctor123",
                Role.DOCTOR, "Dr. New", "555-1234", fixture.department.getId(),
                "Cardiology", true);
        assertTrue(doctor.getId() > 0);
        assertEquals("Cardiology", doctor.getSpecialization());
        assertTrue(doctor.isOnCall());

        User patient = fixture.userService.createUser("new.patient", "patient123",
                Role.PATIENT, "New Patient", null, null, null, true);
        assertEquals(Role.PATIENT, patient.getRole());

        assertThrows(ValidationException.class, () -> fixture.userService.createUser(
                "no.specialty", "doctor123", Role.DOCTOR, "Dr. Missing",
                null, fixture.department.getId(), "  ", true));
        assertThrows(ValidationException.class, () -> fixture.userService.createUser(
                "new.doctor", "doctor123", Role.PATIENT, "Duplicate", null, null, null, true));
        assertThrows(ValidationException.class, () -> fixture.userService.createUser(
                "bad.department", "doctor123", Role.DOCTOR, "Dr. Bad",
                null, 999_999, "Cardiology", true));

        assertTrue(fixture.userService.listDoctors().stream()
                .anyMatch(user -> user.getId() == doctor.getId()));
        assertTrue(fixture.userService.listResponders().stream()
                .anyMatch(user -> user.getId() == fixture.erStaff.getId()));
        assertFalse(fixture.userService.listResponders().stream()
                .anyMatch(user -> user.getId() == patient.getId()));
    }

    @Test
    @DisplayName("Editing a user can change details and reset the password")
    void updatesUserAndPassword() throws Exception {
        User created = fixture.userService.createUser("edit.me", "original123",
                Role.PATIENT, "Original Name", "555-5555", null, null, true);

        fixture.userService.updateUser(created.getId(), "edit.me", "changed123",
                Role.PATIENT, "Updated Name", "555-6666", null, null, true);

        User updated = fixture.userService.getById(created.getId());
        assertEquals("Updated Name", updated.getFullName());
        assertEquals("555-6666", updated.getPhone());
        assertThrows(com.hospital.haes.exception.UnauthorizedActionException.class,
                () -> fixture.authService.login("edit.me", "original123"));
        assertEquals(updated.getId(), fixture.authService.login("edit.me", "changed123").getId());
    }

    @Test
    @DisplayName("Deleting a user removes unreferenced accounts but rejects referenced ones")
    void deleteUserRespectsReferences() throws Exception {
        User unreferenced = fixture.userService.createUser("delete.me", "password123",
                Role.PATIENT, "Delete Me", null, null, null, true);
        fixture.userService.deleteUser(unreferenced.getId());
        assertTrue(fixture.userDao.findById(unreferenced.getId()).isEmpty());

        var slot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);
        fixture.appointmentService.book(fixture.patient.getId(), slot.getId(), "Referenced");
        assertThrows(DatabaseOperationException.class,
                () -> fixture.userService.deleteUser(fixture.patient.getId()));
    }
}
