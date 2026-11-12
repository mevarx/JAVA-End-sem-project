package com.hospital.haes.dao;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Admin;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.ErStaff;
import com.hospital.haes.model.Patient;
import com.hospital.haes.model.Receptionist;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.User;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class UserDao implements Repository<User, Integer> {

    private static final String SELECT_ALL = """
            SELECT id, username, password_hash, role, full_name, phone,
                   department_id, specialization, on_call, active
            FROM users
            """;

    private final DatabaseManager databaseManager;

    public UserDao(DatabaseManager databaseManager) {
        this.databaseManager = databaseManager;
    }

    @Override
    public User save(User user) throws DatabaseOperationException {
        return databaseManager.inTransaction(connection -> insert(connection, user));
    }

    public User insert(Connection connection, User user) throws SQLException {
        String sql = """
                INSERT INTO users (username, password_hash, role, full_name, phone,
                                   department_id, specialization, on_call, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            bindForInsert(statement, user);
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (keys.next()) {
                    user.setId(keys.getInt(1));
                }
            }
            return user;
        }
    }

    @Override
    public Optional<User> findById(Integer id) throws DatabaseOperationException {
        String sql = SELECT_ALL + " WHERE id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load user #" + id + ".", e);
        }
    }

    public Optional<User> findByUsername(String username) throws DatabaseOperationException {
        String sql = SELECT_ALL + " WHERE username = ? COLLATE NOCASE";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, username);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not look up the username.", e);
        }
    }

    @Override
    public List<User> findAll() throws DatabaseOperationException {
        String sql = SELECT_ALL + " ORDER BY role, full_name";
        List<User> users = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                users.add(map(rs));
            }
            return users;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load users.", e);
        }
    }

    public List<User> findByRole(Role role) throws DatabaseOperationException {
        String sql = SELECT_ALL + " WHERE role = ? AND active = 1 ORDER BY full_name";
        List<User> users = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, role.name());
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    users.add(map(rs));
                }
            }
            return users;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load users with role " + role + ".", e);
        }
    }

    public List<User> findResponders() throws DatabaseOperationException {
        String sql = SELECT_ALL + """
                WHERE role IN ('DOCTOR', 'ER_STAFF') AND active = 1
                  AND (role = 'ER_STAFF' OR on_call = 1)
                ORDER BY CASE role WHEN 'DOCTOR' THEN 0 ELSE 1 END, full_name
                """;
        List<User> users = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                users.add(map(rs));
            }
            return users;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load responders.", e);
        }
    }

    @Override
    public void update(User user) throws DatabaseOperationException {
        databaseManager.inTransaction(connection -> {
            String sql = """
                    UPDATE users SET username = ?, password_hash = ?, role = ?, full_name = ?,
                                     phone = ?, department_id = ?, specialization = ?, on_call = ?, active = ?
                    WHERE id = ?
                    """;
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                bindForInsert(statement, user);
                statement.setInt(10, user.getId());
                if (statement.executeUpdate() == 0) {
                    throw new SQLException("User #" + user.getId() + " no longer exists.");
                }
            }
            return null;
        });
    }

    @Override
    public void delete(Integer id) throws DatabaseOperationException {
        String sql = "DELETE FROM users WHERE id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            statement.executeUpdate();
        } catch (SQLException e) {
            String message = e.getMessage() == null ? "" : e.getMessage();
            if (message.contains("FOREIGN KEY") || message.contains("constraint")) {
                throw new DatabaseOperationException(
                        "This account cannot be deleted because appointments or emergency cases still "
                                + "reference it. Deactivate the account instead, or remove those records first.", e);
            }
            throw new DatabaseOperationException("Could not delete the user: " + message, e);
        }
    }

    private void bindForInsert(PreparedStatement statement, User user) throws SQLException {
        statement.setString(1, user.getUsername());
        statement.setString(2, user.getPasswordHash());
        statement.setString(3, user.getRole().name());
        statement.setString(4, user.getFullName());
        statement.setString(5, user.getPhone());
        if (user.getDepartmentId() == null) {
            statement.setNull(6, java.sql.Types.INTEGER);
        } else {
            statement.setInt(6, user.getDepartmentId());
        }
        if (user instanceof Doctor doctor) {
            statement.setString(7, doctor.getSpecialization());
            statement.setInt(8, doctor.isOnCall() ? 1 : 0);
        } else {
            statement.setNull(7, java.sql.Types.VARCHAR);
            statement.setInt(8, 1);
        }
        statement.setInt(9, user.isActive() ? 1 : 0);
    }

    private User map(ResultSet rs) throws SQLException {
        int id = rs.getInt("id");
        String username = rs.getString("username");
        String hash = rs.getString("password_hash");
        String fullName = rs.getString("full_name");
        String phone = rs.getString("phone");
        int departmentId = rs.getInt("department_id");
        Integer department = rs.wasNull() ? null : departmentId;
        boolean active = rs.getInt("active") != 0;
        Role role = Role.valueOf(rs.getString("role"));
        return switch (role) {
            case PATIENT -> new Patient(id, username, hash, fullName, phone, department, active);
            case DOCTOR -> new Doctor(id, username, hash, fullName, phone, department, active,
                    rs.getString("specialization"), rs.getInt("on_call") != 0);
            case RECEPTIONIST -> new Receptionist(id, username, hash, fullName, phone, department, active);
            case ER_STAFF -> new ErStaff(id, username, hash, fullName, phone, department, active);
            case ADMIN -> new Admin(id, username, hash, fullName, phone, department, active);
        };
    }
}
