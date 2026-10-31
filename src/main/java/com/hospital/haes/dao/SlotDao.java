package com.hospital.haes.dao;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class SlotDao implements Repository<Slot, Integer> {

    private static final String SELECT_JOINED = """
            SELECT s.id, s.doctor_id, s.start_time, s.end_time, s.status,
                   u.full_name AS doctor_name, u.department_id AS department_id,
                   d.name AS department_name
            FROM slots s
            JOIN users u ON u.id = s.doctor_id
            LEFT JOIN departments d ON d.id = u.department_id
            """;

    private final DatabaseManager databaseManager;

    public SlotDao(DatabaseManager databaseManager) {
        this.databaseManager = databaseManager;
    }

    @Override
    public Slot save(Slot slot) throws DatabaseOperationException {
        return databaseManager.inTransaction(connection -> insert(connection, slot));
    }

    public Slot insert(Connection connection, Slot slot) throws SQLException {
        String sql = "INSERT INTO slots (doctor_id, start_time, end_time, status) VALUES (?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setInt(1, slot.getDoctorId());
            statement.setString(2, slot.getStartTime().toString());
            statement.setString(3, slot.getEndTime().toString());
            statement.setString(4, slot.getStatus().name());
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (keys.next()) {
                    slot.setId(keys.getInt(1));
                }
            }
            return slot;
        }
    }

    @Override
    public Optional<Slot> findById(Integer id) throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE s.id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load slot #" + id + ".", e);
        }
    }

    /** Lightweight row used inside booking/reschedule transactions. */
    public Optional<Slot> findById(Connection connection, int id) throws SQLException {
        String sql = "SELECT id, doctor_id, start_time, end_time, status FROM slots WHERE id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(new Slot(
                        rs.getInt("id"),
                        rs.getInt("doctor_id"),
                        LocalDateTime.parse(rs.getString("start_time")),
                        LocalDateTime.parse(rs.getString("end_time")),
                        SlotStatus.valueOf(rs.getString("status"))));
            }
        }
    }

    public List<Slot> findAvailable(Integer departmentId, Integer doctorId, LocalDate date)
            throws DatabaseOperationException {
        StringBuilder sql = new StringBuilder(SELECT_JOINED)
                .append(" WHERE s.status = 'FREE' AND s.start_time >= ?");
        List<Object> parameters = new ArrayList<>();
        parameters.add(LocalDateTime.now().toString());
        if (date != null) {
            sql.append(" AND s.start_time < ?");
            parameters.add(date.plusDays(1).atStartOfDay().toString());
        }
        if (departmentId != null) {
            sql.append(" AND u.department_id = ?");
            parameters.add(departmentId);
        }
        if (doctorId != null) {
            sql.append(" AND s.doctor_id = ?");
            parameters.add(doctorId);
        }
        sql.append(" ORDER BY s.start_time, u.full_name");

        List<Slot> slots = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            bind(statement, parameters);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    slots.add(map(rs));
                }
            }
            return slots;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load available slots.", e);
        }
    }

    public List<Slot> findAvailableForDoctorBetween(int doctorId, LocalDateTime from, LocalDateTime to)
            throws DatabaseOperationException {
        String sql = SELECT_JOINED
                + " WHERE s.status = 'FREE' AND s.doctor_id = ? AND s.start_time >= ? AND s.start_time < ?"
                + " ORDER BY s.start_time";
        List<Slot> slots = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, doctorId);
            statement.setString(2, from.toString());
            statement.setString(3, to.toString());
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    slots.add(map(rs));
                }
            }
            return slots;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load doctor availability.", e);
        }
    }

    public List<Slot> findByDoctor(int doctorId) throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE s.doctor_id = ? ORDER BY s.start_time DESC";
        List<Slot> slots = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, doctorId);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    slots.add(map(rs));
                }
            }
            return slots;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load slots for doctor #" + doctorId + ".", e);
        }
    }

    @Override
    public List<Slot> findAll() throws DatabaseOperationException {
        String sql = SELECT_JOINED + " ORDER BY s.start_time";
        List<Slot> slots = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                slots.add(map(rs));
            }
            return slots;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load slots.", e);
        }
    }

    public boolean hasOverlap(int doctorId, LocalDateTime start, LocalDateTime end, Integer excludeId)
            throws DatabaseOperationException {
        String sql = """
                SELECT COUNT(*) FROM slots
                WHERE doctor_id = ? AND start_time < ? AND end_time > ?
                """ + (excludeId == null ? "" : " AND id <> ?");
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, doctorId);
            statement.setString(2, end.toString());
            statement.setString(3, start.toString());
            if (excludeId != null) {
                statement.setInt(4, excludeId);
            }
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not check slot overlaps.", e);
        }
    }

    @Override
    public void update(Slot slot) throws DatabaseOperationException {
        databaseManager.inTransaction(connection -> {
            update(connection, slot);
            return null;
        });
    }

    public void update(Connection connection, Slot slot) throws SQLException {
        String sql = "UPDATE slots SET doctor_id = ?, start_time = ?, end_time = ?, status = ? WHERE id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, slot.getDoctorId());
            statement.setString(2, slot.getStartTime().toString());
            statement.setString(3, slot.getEndTime().toString());
            statement.setString(4, slot.getStatus().name());
            statement.setInt(5, slot.getId());
            if (statement.executeUpdate() == 0) {
                throw new SQLException("Slot #" + slot.getId() + " no longer exists.");
            }
        }
    }

    public boolean updateStatus(Connection connection, int slotId, SlotStatus status) throws SQLException {
        String sql = "UPDATE slots SET status = ? WHERE id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, status.name());
            statement.setInt(2, slotId);
            return statement.executeUpdate() == 1;
        }
    }

    public void updateStatus(int slotId, SlotStatus status) throws DatabaseOperationException {
        databaseManager.inTransaction(connection -> updateStatus(connection, slotId, status));
    }

    @Override
    public void delete(Integer id) throws DatabaseOperationException {
        String sql = "DELETE FROM slots WHERE id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            statement.executeUpdate();
        } catch (SQLException e) {
            throw new DatabaseOperationException(
                    "This slot cannot be deleted because an appointment refers to it.", e);
        }
    }

    private void bind(PreparedStatement statement, List<Object> parameters) throws SQLException {
        for (int i = 0; i < parameters.size(); i++) {
            Object value = parameters.get(i);
            if (value instanceof Integer integer) {
                statement.setInt(i + 1, integer);
            } else {
                statement.setString(i + 1, String.valueOf(value));
            }
        }
    }

    private Slot map(ResultSet rs) throws SQLException {
        Slot slot = new Slot(
                rs.getInt("id"),
                rs.getInt("doctor_id"),
                LocalDateTime.parse(rs.getString("start_time")),
                LocalDateTime.parse(rs.getString("end_time")),
                SlotStatus.valueOf(rs.getString("status")));
        slot.setDoctorName(rs.getString("doctor_name"));
        slot.setDepartmentName(rs.getString("department_name"));
        int departmentId = rs.getInt("department_id");
        slot.setDepartmentId(rs.wasNull() ? null : departmentId);
        return slot;
    }
}
