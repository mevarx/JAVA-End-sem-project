package com.hospital.haes.service;

import com.hospital.haes.TestFixture;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
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

class AuthServiceTest {

    @TempDir
    Path tempDir;

    private TestFixture fixture;
    private AuthService auth;

    @BeforeEach
    void setUp() throws Exception {
        fixture = new TestFixture(tempDir);
        auth = fixture.authService;
    }

    @AfterEach
    void tearDown() {
        fixture.close();
    }

    @Test
    @DisplayName("An active user can sign in with the correct password")
    void loginSucceedsForActiveUser() throws Exception {
        User user = auth.login(fixture.doctor.getUsername(), TestFixture.DEFAULT_PASSWORD);

        assertEquals(fixture.doctor.getId(), user.getId());
        assertEquals(Role.DOCTOR, user.getRole());
        assertEquals("Dr. " + fixture.doctor.getUsername(), user.getFullName());
        assertTrue(user.getPasswordHash().startsWith("pbkdf2$"));
    }

    @Test
    @DisplayName("Usernames are matched case-insensitively")
    void loginIsUsernameCaseInsensitive() throws Exception {
        User user = auth.login(fixture.doctor.getUsername().toUpperCase(), TestFixture.DEFAULT_PASSWORD);
        assertEquals(fixture.doctor.getId(), user.getId());
    }

    @Test
    @DisplayName("Wrong, unknown and blank credentials are rejected")
    void loginRejectsBadCredentials() {
        assertThrows(UnauthorizedActionException.class,
                () -> auth.login(fixture.doctor.getUsername(), "wrong-password"));
        assertThrows(UnauthorizedActionException.class,
                () -> auth.login("nobody.here", TestFixture.DEFAULT_PASSWORD));
        assertThrows(UnauthorizedActionException.class, () -> auth.login("", ""));
        assertThrows(UnauthorizedActionException.class, () -> auth.login(null, null));
        assertThrows(UnauthorizedActionException.class,
                () -> auth.login(" ", TestFixture.DEFAULT_PASSWORD));
    }

    @Test
    @DisplayName("Deactivated accounts cannot sign in")
    void inactiveUserCannotLogin() throws Exception {
        fixture.deactivate(fixture.patient);

        assertThrows(UnauthorizedActionException.class,
                () -> auth.login(fixture.patient.getUsername(), TestFixture.DEFAULT_PASSWORD));
    }

    @Test
    @DisplayName("Patient self-registration stores a hashed password and can sign in")
    void registerPatientCreatesUsableAccount() throws Exception {
        User registered = auth.registerPatient("new.patient", "secure123",
                "New Patient", "+91 98765-43210");

        assertTrue(registered.getId() > 0);
        assertEquals(Role.PATIENT, registered.getRole());
        assertEquals("New Patient", registered.getFullName());
        assertEquals("+91 98765-43210", registered.getPhone());
        assertFalse(registered.getPasswordHash().equals("secure123"));
        assertTrue(registered.getPasswordHash().startsWith("pbkdf2$"));

        User signedIn = auth.login("new.patient", "secure123");
        assertEquals(registered.getId(), signedIn.getId());
    }

    @Test
    @DisplayName("Registration rejects duplicates and invalid fields")
    void registerRejectsInvalidInput() {
        assertThrows(ValidationException.class, () -> auth.registerPatient(
                fixture.doctor.getUsername(), "secure123", "Duplicate", null));
        assertThrows(ValidationException.class, () -> auth.registerPatient(
                "ab", "secure123", "Short Username", null));
        assertThrows(ValidationException.class, () -> auth.registerPatient(
                "valid.name", "12345", "Short Password", null));
        assertThrows(ValidationException.class, () -> auth.registerPatient(
                "valid.name", "secure123", "   ", null));
        assertThrows(ValidationException.class, () -> auth.registerPatient(
                "valid.name", "secure123", "Bad Phone", "abc"));
    }

    @Test
    @DisplayName("Changing a password requires the current password and invalidates the old one")
    void changePasswordRequiresCurrentPassword() throws Exception {
        User user = auth.login(fixture.doctor.getUsername(), TestFixture.DEFAULT_PASSWORD);

        assertThrows(UnauthorizedActionException.class,
                () -> auth.changePassword(user, "not-the-password", "newpass123"));
        assertThrows(ValidationException.class,
                () -> auth.changePassword(user, TestFixture.DEFAULT_PASSWORD, "123"));
        // A rejected change must not alter the stored password.
        assertEquals(user.getId(), auth.login(fixture.doctor.getUsername(),
                TestFixture.DEFAULT_PASSWORD).getId());

        auth.changePassword(user, TestFixture.DEFAULT_PASSWORD, "newpass123");

        assertThrows(UnauthorizedActionException.class,
                () -> auth.login(fixture.doctor.getUsername(), TestFixture.DEFAULT_PASSWORD));
        assertEquals(user.getId(), auth.login(fixture.doctor.getUsername(), "newpass123").getId());
    }
}
