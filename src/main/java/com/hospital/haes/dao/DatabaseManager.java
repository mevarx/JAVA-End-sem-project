package com.hospital.haes.dao;

import com.hospital.haes.exception.DatabaseOperationException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Owns the SQLite file. Every operation gets a fresh short-lived connection,
 * foreign keys + busy timeout are always enabled, and write transactions are
 * serialised behind a fair lock. The lock is deliberately coarse: this is a
 * single-machine desktop app and correctness matters more than write
 * parallelism (NFR-1, FR-5).
 */
public class DatabaseManager {

    private static final int BUSY_TIMEOUT_MS = 5_000;

    private final Path databasePath;
    private final String jdbcUrl;
    private final ReentrantLock writeLock = new ReentrantLock(true);

    public DatabaseManager(Path databasePath) throws DatabaseOperationException {
        this.databasePath = databasePath.toAbsolutePath();
        try {
            Path parent = this.databasePath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
        } catch (IOException e) {
            throw new DatabaseOperationException("Cannot create the database directory.", e);
        }
        this.jdbcUrl = "jdbc:sqlite:" + this.databasePath;
        initializeSchema();
    }

    public Path getDatabasePath() {
        return databasePath;
    }

    public Connection getConnection() throws SQLException {
        Connection connection = DriverManager.getConnection(jdbcUrl);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = " + BUSY_TIMEOUT_MS);
        } catch (SQLException e) {
            connection.close();
            throw e;
        }
        return connection;
    }

    /** Runs write work in a transaction with rollback on any failure. */
    public <T> T inTransaction(SqlWork<T> work) throws DatabaseOperationException {
        writeLock.lock();
        try (Connection connection = getConnection()) {
            connection.setAutoCommit(false);
            try {
                T result = work.execute(connection);
                connection.commit();
                return result;
            } catch (SQLException e) {
                rollbackQuietly(connection);
                throw new DatabaseOperationException("Database transaction failed: " + e.getMessage(), e);
            } catch (RuntimeException e) {
                rollbackQuietly(connection);
                throw e;
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException("Could not connect to the database.", e);
        } finally {
            writeLock.unlock();
        }
    }

    private void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // The original failure is more useful than a rollback failure.
        }
    }

    private void initializeSchema() throws DatabaseOperationException {
        String script = readSchema();
        try (Connection connection = getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode = WAL");
            String withoutComments = script.replaceAll("(?m)^\\s*--.*$", "");
            for (String raw : withoutComments.split(";")) {
                String sql = raw.trim();
                if (!sql.isEmpty()) {
                    statement.execute(sql);
                }
            }
        } catch (SQLException e) {
            throw new DatabaseOperationException(
                    "Could not initialize the database at " + databasePath + ": " + e.getMessage(), e);
        }
    }

    private String readSchema() throws DatabaseOperationException {
        try (InputStream stream = DatabaseManager.class.getResourceAsStream("/db/schema.sql")) {
            if (stream == null) {
                throw new DatabaseOperationException("Schema resource /db/schema.sql is missing.");
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new DatabaseOperationException("Could not read the database schema.", e);
        }
    }

    @FunctionalInterface
    public interface SqlWork<T> {
        T execute(Connection connection) throws SQLException;
    }
}
