package com.hospital.haes.dao;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyEvent;
import com.hospital.haes.model.EmergencyStatus;
import com.hospital.haes.model.EmergencyType;
import com.hospital.haes.model.Severity;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public class EmergencyDao implements Repository<EmergencyCase, Integer> {

    private static final String SELECT_JOINED = """
            SELECT e.*, responder.full_name AS assigned_name
            FROM emergencies e
            LEFT JOIN users responder ON responder.id = e.assigned_to
            """;

    private static final String ACTIVE_FILTER = """
             e.status IN ('WAITING', 'ASSIGNED', 'ACKNOWLEDGED', 'ESCALATED')
            """;

    private final DatabaseManager databaseManager;

    public EmergencyDao(DatabaseManager databaseManager) {
        this.databaseManager = databaseManager;
    }

    @Override
    public EmergencyCase save(EmergencyCase emergencyCase) throws DatabaseOperationException {
        return databaseManager.inTransaction(connection -> insert(connection, emergencyCase));
    }

    public EmergencyCase insert(Connection connection, EmergencyCase emergencyCase) throws SQLException {
        String sql = """
                INSERT INTO emergencies (patient_id, patient_label, type, severity, location, status,
                                         assigned_to, bed_no, raised_at, dispatched_at, acknowledged_at,
                                         resolved_at, escalation_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            bind(statement, emergencyCase);
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (keys.next()) {
                    emergencyCase.setId(keys.getInt(1));
                }
            }
            return emergencyCase;
        }
    }

    @Override
    public Optional<EmergencyCase> findById(Integer id) throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE e.id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load emergency #" + id + ".", e);
        }
    }

    public Optional<EmergencyCase> findById(Connection connection, int id) throws SQLException {
        String sql = SELECT_JOINED + " WHERE e.id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        }
    }

    @Override
    public List<EmergencyCase> findAll() throws DatabaseOperationException {
        String sql = SELECT_JOINED + " ORDER BY e.raised_at DESC";
        List<EmergencyCase> cases = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                cases.add(map(rs));
            }
            return cases;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load emergencies.", e);
        }
    }

    public List<EmergencyCase> findActive() throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE " + ACTIVE_FILTER + """
                 ORDER BY CASE e.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
                          e.raised_at
                """;
        List<EmergencyCase> cases = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                cases.add(map(rs));
            }
            return cases;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load the emergency queue.", e);
        }
    }

    public List<EmergencyCase> findByPatient(int patientId) throws DatabaseOperationException {
        String sql = SELECT_JOINED + " WHERE e.patient_id = ? ORDER BY e.raised_at DESC";
        List<EmergencyCase> cases = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, patientId);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    cases.add(map(rs));
                }
            }
            return cases;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load the patient's emergencies.", e);
        }
    }

    /** Assigned/escalated cases whose acknowledgment deadline has passed. */
    public List<EmergencyCase> findOverdue(LocalDateTime threshold) throws DatabaseOperationException {
        String sql = SELECT_JOINED + """
                 WHERE e.status IN ('ASSIGNED', 'ESCALATED')
                   AND e.acknowledged_at IS NULL
                   AND e.dispatched_at IS NOT NULL
                   AND e.dispatched_at <= ?
                 ORDER BY e.dispatched_at
                """;
        List<EmergencyCase> cases = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, threshold.toString());
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    cases.add(map(rs));
                }
            }
            return cases;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not scan acknowledgment deadlines.", e);
        }
    }

    public Set<Integer> findActiveAssigneeIds() throws DatabaseOperationException {
        String sql = """
                SELECT DISTINCT assigned_to FROM emergencies
                WHERE assigned_to IS NOT NULL
                  AND status IN ('ASSIGNED', 'ACKNOWLEDGED', 'ESCALATED')
                """;
        Set<Integer> ids = new HashSet<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                ids.add(rs.getInt(1));
            }
            return ids;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load busy responders.", e);
        }
    }

    @Override
    public void update(EmergencyCase emergencyCase) throws DatabaseOperationException {
        databaseManager.inTransaction(connection -> {
            update(connection, emergencyCase);
            return null;
        });
    }

    public void update(Connection connection, EmergencyCase emergencyCase) throws SQLException {
        String sql = """
                UPDATE emergencies
                SET patient_id = ?, patient_label = ?, type = ?, severity = ?, location = ?,
                    status = ?, assigned_to = ?, bed_no = ?, raised_at = ?, dispatched_at = ?,
                    acknowledged_at = ?, resolved_at = ?, escalation_count = ?
                WHERE id = ?
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, emergencyCase);
            statement.setInt(14, emergencyCase.getId());
            if (statement.executeUpdate() == 0) {
                throw new SQLException("Emergency #" + emergencyCase.getId() + " no longer exists.");
            }
        }
    }

    @Override
    public void delete(Integer id) throws DatabaseOperationException {
        String sql = "DELETE FROM emergencies WHERE id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            statement.executeUpdate();
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not delete the emergency.", e);
        }
    }

    public EmergencyEvent saveEvent(EmergencyEvent event) throws DatabaseOperationException {
        return databaseManager.inTransaction(connection -> saveEvent(connection, event));
    }

    public EmergencyEvent saveEvent(Connection connection, EmergencyEvent event) throws SQLException {
        String sql = """
                INSERT INTO emergency_events (emergency_id, event_type, event_time, note)
                VALUES (?, ?, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setInt(1, event.getEmergencyId());
            statement.setString(2, event.getEventType());
            statement.setString(3, event.getEventTime().toString());
            statement.setString(4, event.getNote());
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (keys.next()) {
                    event.setId(keys.getInt(1));
                }
            }
            return event;
        }
    }

    public List<EmergencyEvent> findEvents(int emergencyId) throws DatabaseOperationException {
        String sql = """
                SELECT id, emergency_id, event_type, event_time, note
                FROM emergency_events WHERE emergency_id = ? ORDER BY event_time, id
                """;
        List<EmergencyEvent> events = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, emergencyId);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    events.add(mapEvent(rs));
                }
            }
            return events;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load emergency events.", e);
        }
    }

    public List<EmergencyEvent> findRecentEvents(int limit) throws DatabaseOperationException {
        String sql = """
                SELECT id, emergency_id, event_type, event_time, note
                FROM emergency_events ORDER BY event_time DESC, id DESC LIMIT ?
                """;
        List<EmergencyEvent> events = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, limit);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    events.add(mapEvent(rs));
                }
            }
            return events;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load recent emergency events.", e);
        }
    }

    private void bind(PreparedStatement statement, EmergencyCase c) throws SQLException {
        if (c.getPatientId() == null) {
            statement.setNull(1, Types.INTEGER);
        } else {
            statement.setInt(1, c.getPatientId());
        }
        statement.setString(2, c.getPatientLabel());
        statement.setString(3, c.getType().name());
        statement.setString(4, c.getSeverity().name());
        statement.setString(5, c.getLocation());
        statement.setString(6, c.getStatus().name());
        if (c.getAssignedTo() == null) {
            statement.setNull(7, Types.INTEGER);
        } else {
            statement.setInt(7, c.getAssignedTo());
        }
        if (c.getBedNo() == null) {
            statement.setNull(8, Types.INTEGER);
        } else {
            statement.setInt(8, c.getBedNo());
        }
        statement.setString(9, c.getRaisedAt().toString());
        statement.setString(10, c.getDispatchedAt() == null ? null : c.getDispatchedAt().toString());
        statement.setString(11, c.getAcknowledgedAt() == null ? null : c.getAcknowledgedAt().toString());
        statement.setString(12, c.getResolvedAt() == null ? null : c.getResolvedAt().toString());
        statement.setInt(13, c.getEscalationCount());
    }

    private EmergencyCase map(ResultSet rs) throws SQLException {
        Integer patientId = nullableInt(rs, "patient_id");
        Integer assignedTo = nullableInt(rs, "assigned_to");
        Integer bedNo = nullableInt(rs, "bed_no");
        String dispatched = rs.getString("dispatched_at");
        String acknowledged = rs.getString("acknowledged_at");
        String resolved = rs.getString("resolved_at");
        EmergencyCase emergencyCase = new EmergencyCase(
                rs.getInt("id"),
                patientId,
                rs.getString("patient_label"),
                EmergencyType.valueOf(rs.getString("type")),
                Severity.valueOf(rs.getString("severity")),
                rs.getString("location"),
                EmergencyStatus.valueOf(rs.getString("status")),
                assignedTo,
                bedNo,
                LocalDateTime.parse(rs.getString("raised_at")),
                dispatched == null ? null : LocalDateTime.parse(dispatched),
                acknowledged == null ? null : LocalDateTime.parse(acknowledged),
                resolved == null ? null : LocalDateTime.parse(resolved),
                rs.getInt("escalation_count"));
        emergencyCase.setAssignedToName(rs.getString("assigned_name"));
        return emergencyCase;
    }

    private EmergencyEvent mapEvent(ResultSet rs) throws SQLException {
        return new EmergencyEvent(
                rs.getInt("id"),
                rs.getInt("emergency_id"),
                rs.getString("event_type"),
                LocalDateTime.parse(rs.getString("event_time")),
                rs.getString("note"));
    }

    private Integer nullableInt(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }
}
