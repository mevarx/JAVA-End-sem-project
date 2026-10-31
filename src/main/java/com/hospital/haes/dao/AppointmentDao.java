package com.hospital.haes.dao;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class AppointmentDao implements Repository<Appointment, Integer> {

    private static final String SELECT_JOINED = """
            SELECT a.id AS appointment_id, a.slot_id, a.patient_id, a.reason,
                   a.status AS appointment_status, a.created_at,
                   s.doctor_id, s.start_time, s.end_time, s.status AS slot_status,
                   p.full_name AS patient_name, doc.full_name AS doctor_name,
                   doc.department_id AS department_id, d.name AS department_name
            FROM appointments a
            JOIN slots s ON s.id = a.slot_id
            JOIN users p ON p.id = a.patient_id
            JOIN users doc ON doc.id = s.doctor_id
            LEFT JOIN departments d ON d.id = doc.department_id
            """;

    private final DatabaseManager databaseManager;

    public AppointmentDao(DatabaseManager databaseManager) {
        this.databaseManager = databaseManager;
    }

    @Override
    public Appointment save(Appointment appointment) throws DatabaseOperationException {
        return databaseManager.inTransaction(connection -> insert(connection, appointment));
    }

    public Appointment insert(Connection connection, Appointment appointment) throws SQLException {
        String sql = """
                INSERT INTO appointments (slot_id, patient_id, reason, status, created_at)
                VALUES (?, ?, ?, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setInt(1, appointment.getSlotId());
            statement.setInt(2, appointment.getPatientId());
            statement.setString(3, appointment.getReason());
            statement.setString(4, appointment.getStatus().name());
            statement.setString(5, appointment.getCreatedAt().toString());
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (keys.next()) {
                    appointment.setId(keys.getInt(1));
                }
            }
            return appointment;
        }
    }

    @Override
    public Optional<Appointment> findById(Integer id) throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE a.id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load appointment #" + id + ".", e);
        }
    }

    public Optional<Appointment> findById(Connection connection, int id) throws SQLException {
        String sql = SELECT_JOINED + " WHERE a.id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        }
    }

    public List<Appointment> findByPatient(int patientId) throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE a.patient_id = ? ORDER BY s.start_time DESC";
        return queryList(sql, patientId);
    }

    public List<Appointment> findActiveByPatient(int patientId) throws DatabaseOperationException {
        String sql = SELECT_JOINED
                + " WHERE a.patient_id = ? AND a.status = 'BOOKED' ORDER BY s.start_time";
        return queryList(sql, patientId);
    }

    public List<Appointment> findActiveByPatient(Connection connection, int patientId) throws SQLException {
        String sql = SELECT_JOINED
                + " WHERE a.patient_id = ? AND a.status = 'BOOKED' ORDER BY s.start_time";
        List<Appointment> appointments = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, patientId);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    appointments.add(map(rs));
                }
            }
        }
        return appointments;
    }

    public List<Appointment> findByDoctor(int doctorId) throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE s.doctor_id = ? ORDER BY s.start_time";
        return queryList(sql, doctorId);
    }

    public List<Appointment> findByStatus(AppointmentStatus status) throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE a.status = ? ORDER BY s.start_time";
        List<Appointment> appointments = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, status.name());
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    appointments.add(map(rs));
                }
            }
            return appointments;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load appointments.", e);
        }
    }

    @Override
    public List<Appointment> findAll() throws DatabaseOperationException {
        String sql = SELECT_JOINED + " ORDER BY s.start_time DESC";
        List<Appointment> appointments = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                appointments.add(map(rs));
            }
            return appointments;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load appointments.", e);
        }
    }

    public int countActiveByPatient(int patientId) throws DatabaseOperationException {
        String sql = "SELECT COUNT(*) FROM appointments WHERE patient_id = ? AND status = 'BOOKED'";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, patientId);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not count patient appointments.", e);
        }
    }

    public int countActiveByPatient(Connection connection, int patientId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM appointments WHERE patient_id = ? AND status = 'BOOKED'";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, patientId);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    public Optional<Appointment> findAppointmentInProgress(int doctorId, LocalDateTime at)
            throws DatabaseOperationException {
        String sql = SELECT_JOINED + """
                 WHERE s.doctor_id = ? AND a.status = 'BOOKED'
                   AND s.start_time <= ? AND s.end_time > ?
                 ORDER BY s.start_time
                 LIMIT 1
                """;
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, doctorId);
            statement.setString(2, at.toString());
            statement.setString(3, at.toString());
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not check the doctor's current appointment.", e);
        }
    }

    @Override
    public void update(Appointment appointment) throws DatabaseOperationException {
        databaseManager.inTransaction(connection -> {
            update(connection, appointment);
            return null;
        });
    }

    public void update(Connection connection, Appointment appointment) throws SQLException {
        String sql = """
                UPDATE appointments
                SET slot_id = ?, patient_id = ?, reason = ?, status = ?, created_at = ?
                WHERE id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, appointment.getSlotId());
            statement.setInt(2, appointment.getPatientId());
            statement.setString(3, appointment.getReason());
            statement.setString(4, appointment.getStatus().name());
            statement.setString(5, appointment.getCreatedAt().toString());
            statement.setInt(6, appointment.getId());
            if (statement.executeUpdate() == 0) {
                throw new SQLException("Appointment #" + appointment.getId() + " no longer exists.");
            }
        }
    }

    public boolean updateStatus(Connection connection, int appointmentId, AppointmentStatus status)
            throws SQLException {
        String sql = "UPDATE appointments SET status = ? WHERE id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, status.name());
            statement.setInt(2, appointmentId);
            return statement.executeUpdate() == 1;
        }
    }

    public void updateStatus(int appointmentId, AppointmentStatus status) throws DatabaseOperationException {
        databaseManager.inTransaction(connection -> updateStatus(connection, appointmentId, status));
    }

    @Override
    public void delete(Integer id) throws DatabaseOperationException {
        String sql = "DELETE FROM appointments WHERE id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            statement.executeUpdate();
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not delete the appointment.", e);
        }
    }

    private List<Appointment> queryList(String sql, int parameter) throws DatabaseOperationException {
        List<Appointment> appointments = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, parameter);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    appointments.add(map(rs));
                }
            }
            return appointments;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load appointments.", e);
        }
    }

    private Appointment map(ResultSet rs) throws SQLException {
        Slot slot = new Slot(
                rs.getInt("slot_id"),
                rs.getInt("doctor_id"),
                LocalDateTime.parse(rs.getString("start_time")),
                LocalDateTime.parse(rs.getString("end_time")),
                SlotStatus.valueOf(rs.getString("slot_status")));
        slot.setDoctorName(rs.getString("doctor_name"));
        slot.setDepartmentName(rs.getString("department_name"));
        int departmentId = rs.getInt("department_id");
        slot.setDepartmentId(rs.wasNull() ? null : departmentId);

        Appointment appointment = new Appointment(
                rs.getInt("appointment_id"),
                slot,
                rs.getInt("patient_id"),
                rs.getString("reason"),
                AppointmentStatus.valueOf(rs.getString("appointment_status")),
                LocalDateTime.parse(rs.getString("created_at")));
        appointment.setPatientName(rs.getString("patient_name"));
        appointment.setDoctorName(rs.getString("doctor_name"));
        return appointment;
    }
}
