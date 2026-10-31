package com.hospital.haes.util;

import com.hospital.haes.exception.ValidationException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Imports availability from a small CSV file:
 * doctor_username,date(YYYY-MM-DD),start(HH:mm),end(HH:mm)
 */
public class CsvImporter {

    private static final DateTimeFormatter FLEXIBLE_TIME = DateTimeFormatter.ofPattern("H:mm");

    public record SlotRow(String doctorUsername, LocalDate date, LocalTime start, LocalTime end) {
    }

    public List<SlotRow> readSlotRows(Path source) throws IOException, ValidationException {
        List<String> lines = Files.readAllLines(source, StandardCharsets.UTF_8);
        List<SlotRow> rows = new ArrayList<>();
        int lineNumber = 0;
        for (String raw : lines) {
            lineNumber++;
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            List<String> columns = split(line);
            if (columns.size() == 4 && columns.get(0).trim().equalsIgnoreCase("doctor_username")) {
                continue;
            }
            if (columns.size() != 4) {
                throw new ValidationException("Line " + lineNumber
                        + ": expected 4 columns (doctor_username,date,start,end).");
            }
            try {
                String doctor = columns.get(0).trim();
                if (doctor.isEmpty()) {
                    throw new ValidationException("Line " + lineNumber + ": doctor username is empty.");
                }
                LocalDate date = LocalDate.parse(columns.get(1).trim());
                LocalTime start = parseTime(columns.get(2).trim(), lineNumber);
                LocalTime end = parseTime(columns.get(3).trim(), lineNumber);
                if (!end.isAfter(start)) {
                    throw new ValidationException("Line " + lineNumber + ": end must be after start.");
                }
                rows.add(new SlotRow(doctor, date, start, end));
            } catch (DateTimeParseException e) {
                throw new ValidationException("Line " + lineNumber + ": invalid date. Use YYYY-MM-DD.");
            }
        }
        if (rows.isEmpty()) {
            throw new ValidationException("The CSV file contains no slot rows.");
        }
        return rows;
    }

    private LocalTime parseTime(String value, int lineNumber) throws ValidationException {
        try {
            return LocalTime.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalTime.parse(value, FLEXIBLE_TIME);
            } catch (DateTimeParseException e) {
                throw new ValidationException("Line " + lineNumber + ": invalid time '" + value + "'. Use HH:mm.");
            }
        }
    }

    /** Minimal CSV splitter with support for quoted values containing commas. */
    private List<String> split(String line) {
        List<String> columns = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (c == ',' && !quoted) {
                columns.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        columns.add(current.toString());
        return columns;
    }
}
