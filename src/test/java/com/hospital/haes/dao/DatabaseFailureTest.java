package com.hospital.haes.dao;

import com.hospital.haes.TestFixture;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Slot;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DatabaseFailureTest {

    @TempDir
    Path tempDir;

    private TestFixture fixture;

    @BeforeEach
    void setUp() throws Exception {
        fixture = new TestFixture(tempDir);
    }

    @AfterEach
    void tearDown() {
        if (fixture != null) {
            fixture.close();
        }
    }

    @Test
    @DisplayName("The database file and its parent folders are created automatically")
    void createsNestedDatabaseFile() throws Exception {
        Path nested = tempDir.resolve("a/b/c/haes.db");

        DatabaseManager manager = new DatabaseManager(nested);

        assertTrue(Files.exists(nested));
        assertEquals(nested.toAbsolutePath(), manager.getDatabasePath());
    }

    @Test
    @DisplayName("A failed transaction rolls back every statement")
    void failedTransactionRollsBack() throws Exception {
        assertThrows(DatabaseOperationException.class, () -> fixture.databaseManager.inTransaction(connection -> {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO departments (name) VALUES ('Rolled Back')")) {
                statement.executeUpdate();
            }
            throw new SQLException("forced failure");
        }));

        assertTrue(fixture.departmentDao.findByName("Rolled Back").isEmpty());
        assertEquals(1, fixture.departmentDao.findAll().size());
    }

    @Test
    @DisplayName("A successful transaction commits")
    void successfulTransactionCommits() throws Exception {
        fixture.databaseManager.inTransaction(connection -> {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO departments (name) VALUES ('Committed')")) {
                statement.executeUpdate();
            }
            return null;
        });

        assertTrue(fixture.departmentDao.findByName("Committed").isPresent());
    }

    @Test
    @DisplayName("Foreign keys reject an appointment for a missing patient")
    void foreignKeyViolationFails() throws Exception {
        Slot slot = fixture.createSlot(fixture.doctor.getId(), fixture.nextStart(), 30);
        Appointment orphan = new Appointment(0, slot, 999_999, "Ghost patient",
                AppointmentStatus.BOOKED, LocalDateTime.now());

        assertThrows(DatabaseOperationException.class,
                () -> fixture.appointmentDao.save(orphan));
        assertTrue(fixture.appointmentDao.findAll().isEmpty());
    }

    @Test
    @DisplayName("Unique constraints surface as database errors")
    void duplicateDepartmentFails() throws Exception {
        assertThrows(DatabaseOperationException.class,
                () -> fixture.departmentDao.save(new Department("Cardiology")));
        assertEquals(1, fixture.departmentDao.findAll().size());
    }

    @Test
    @DisplayName("An unwritable database location reports a DatabaseOperationException")
    void unwritableLocationFails() throws Exception {
        Path blocker = tempDir.resolve("blocker");
        Files.writeString(blocker, "not a directory");
        Path impossible = blocker.resolve("haes.db");

        assertThrows(DatabaseOperationException.class, () -> new DatabaseManager(impossible));
    }

    @Test
    @DisplayName("A non-SQLite file is rejected during schema initialization")
    void garbageDatabaseFileFails() throws Exception {
        Path garbage = tempDir.resolve("garbage.db");
        Files.writeString(garbage, "this is definitely not a SQLite database");

        assertThrows(DatabaseOperationException.class, () -> new DatabaseManager(garbage));
    }
}
