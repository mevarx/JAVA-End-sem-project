package com.hospital.haes.util;

import com.hospital.haes.exception.ValidationException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

/**
 * Centralised form validation. Keeping it out of the JavaFX controllers
 * means every entry point (UI, CSV import, tests) applies the same rules.
 */
public final class Validator {

    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9._-]{3,32}$");
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9][0-9 ()-]{6,19}$");

    private Validator() {
    }

    public static void requireText(String value, String field) throws ValidationException {
        if (value == null || value.isBlank()) {
            throw new ValidationException(field + " is required.");
        }
    }

    public static void maxLength(String value, int max, String field) throws ValidationException {
        if (value != null && value.length() > max) {
            throw new ValidationException(field + " must be at most " + max + " characters.");
        }
    }

    public static void username(String username) throws ValidationException {
        requireText(username, "Username");
        if (!USERNAME.matcher(username).matches()) {
            throw new ValidationException(
                    "Username must be 3-32 characters using letters, digits, dot, dash or underscore.");
        }
    }

    public static void password(String password) throws ValidationException {
        requireText(password, "Password");
        if (password.length() < 6) {
            throw new ValidationException("Password must be at least 6 characters.");
        }
        if (password.length() > 128) {
            throw new ValidationException("Password must be at most 128 characters.");
        }
    }

    public static void phone(String phone) throws ValidationException {
        if (phone == null || phone.isBlank()) {
            return;
        }
        if (!PHONE.matcher(phone.trim()).matches()) {
            throw new ValidationException("Phone must contain 7-20 valid digits (optional +, spaces, dash).");
        }
    }

    public static void age(int age) throws ValidationException {
        if (age < 0 || age > 120) {
            throw new ValidationException("Age must be between 0 and 120.");
        }
    }

    public static void futureDateTime(LocalDateTime dateTime, String field) throws ValidationException {
        if (dateTime == null) {
            throw new ValidationException(field + " is required.");
        }
        if (dateTime.isBefore(LocalDateTime.now())) {
            throw new ValidationException(field + " must be in the future.");
        }
    }

    public static void dateNotPast(LocalDate date, String field) throws ValidationException {
        if (date == null) {
            throw new ValidationException(field + " is required.");
        }
        if (date.isBefore(LocalDate.now())) {
            throw new ValidationException(field + " cannot be in the past.");
        }
    }

    public static void timeRange(LocalDateTime start, LocalDateTime end) throws ValidationException {
        if (start == null || end == null) {
            throw new ValidationException("Start and end times are required.");
        }
        if (!end.isAfter(start)) {
            throw new ValidationException("End time must be after start time.");
        }
        if (java.time.Duration.between(start, end).toMinutes() > 480) {
            throw new ValidationException("A single slot cannot be longer than 8 hours.");
        }
    }
}
