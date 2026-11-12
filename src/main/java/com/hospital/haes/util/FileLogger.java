package com.hospital.haes.util;

import com.hospital.haes.model.EmergencyCase;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Append-only emergency audit trail. Writes are synchronized so the
 * dispatcher, escalation timer and UI threads cannot interleave lines.
 * File errors are reported but never crash the application.
 */
public class FileLogger {

    private static final DateTimeFormatter LOG_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final Path logFile;

    public FileLogger(Path logFile) {
        this.logFile = logFile.toAbsolutePath();
        try {
            Path parent = this.logFile.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            if (Files.notExists(this.logFile)) {
                Files.writeString(this.logFile, "", StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            }
        } catch (IOException e) {
            System.err.println("Could not initialize audit log " + this.logFile + ": " + e.getMessage());
        }
    }

    public Path getLogFile() {
        return logFile;
    }

    public synchronized void logEmergencyEvent(EmergencyCase emergencyCase, String eventType, String note) {
        String line = LocalDateTime.now().format(LOG_TIME)
                + " | " + eventType
                + " | " + emergencyCase.toLogLine()
                + (note == null || note.isBlank() ? "" : " | " + note)
                + System.lineSeparator();
        appendRaw(line);
    }

    public synchronized void appendRaw(String line) {
        try {
            Files.writeString(logFile, line, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            System.err.println("Audit write failed: " + e.getMessage());
        }
    }
}
