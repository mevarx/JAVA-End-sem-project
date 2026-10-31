package com.hospital.haes.dao;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Department;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class DepartmentDao implements Repository<Department, Integer> {

    private final DatabaseManager databaseManager;

    public DepartmentDao(DatabaseManager databaseManager) {
        this.databaseManager = databaseManager;
    }

    @Override
    public Department save(Department department) throws DatabaseOperationException {
        String sql = "INSERT INTO departments (name) VALUES (?)";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, department.getName());
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (keys.next()) {
                    department.setId(keys.getInt(1));
                }
            }
            return department;
        } catch (SQLException e) {
            throw new DatabaseOperationException(
                    "Could not save department '" + department.getName() + "'.", e);
        }
    }

    @Override
    public Optional<Department> findById(Integer id) throws DatabaseOperationException {
        String sql = "SELECT id, name FROM departments WHERE id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(new Department(rs.getInt("id"), rs.getString("name")))
                        : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load department #" + id + ".", e);
        }
    }

    public Optional<Department> findByName(String name) throws DatabaseOperationException {
        String sql = "SELECT id, name FROM departments WHERE name = ? COLLATE NOCASE";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, name);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? Optional.of(new Department(rs.getInt("id"), rs.getString("name")))
                        : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not look up the department.", e);
        }
    }

    @Override
    public List<Department> findAll() throws DatabaseOperationException {
        String sql = "SELECT id, name FROM departments ORDER BY name";
        List<Department> departments = new ArrayList<>();
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                departments.add(new Department(rs.getInt("id"), rs.getString("name")));
            }
            return departments;
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not load departments.", e);
        }
    }

    @Override
    public void update(Department department) throws DatabaseOperationException {
        String sql = "UPDATE departments SET name = ? WHERE id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, department.getName());
            statement.setInt(2, department.getId());
            statement.executeUpdate();
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not update the department.", e);
        }
    }

    @Override
    public void delete(Integer id) throws DatabaseOperationException {
        String sql = "DELETE FROM departments WHERE id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, id);
            statement.executeUpdate();
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not delete the department.", e);
        }
    }

    public int countUsers(int departmentId) throws DatabaseOperationException {
        String sql = "SELECT COUNT(*) FROM users WHERE department_id = ?";
        try (Connection connection = databaseManager.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setInt(1, departmentId);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not count department users.", e);
        }
    }
}
