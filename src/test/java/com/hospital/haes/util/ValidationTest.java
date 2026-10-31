package com.hospital.haes.util;

import com.hospital.haes.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ValidationTest {

    @Test
    @DisplayName("Usernames allow the documented character set and length")
    void usernamesAreValidated() {
        assertDoesNotThrow(() -> Validator.username("abc_12.x-y"));
        assertThrows(ValidationException.class, () -> Validator.username(null));
        assertThrows(ValidationException.class, () -> Validator.username("ab"));
        assertThrows(ValidationException.class, () -> Validator.username("has space"));
        assertThrows(ValidationException.class, () -> Validator.username("x".repeat(33)));
    }

    @Test
    @DisplayName("Passwords must be 6-128 characters")
    void passwordsAreValidated() {
        assertDoesNotThrow(() -> Validator.password("123456"));
        assertDoesNotThrow(() -> Validator.password("x".repeat(128)));
        assertThrows(ValidationException.class, () -> Validator.password(null));
        assertThrows(ValidationException.class, () -> Validator.password("12345"));
        assertThrows(ValidationException.class, () -> Validator.password("x".repeat(129)));
    }

    @Test
    @DisplayName("Phone numbers are optional but validated when provided")
    void phonesAreValidated() {
        assertDoesNotThrow(() -> Validator.phone(null));
        assertDoesNotThrow(() -> Validator.phone(" "));
        assertDoesNotThrow(() -> Validator.phone("1234567"));
        assertDoesNotThrow(() -> Validator.phone("+1 (555) 123-4567"));
        assertThrows(ValidationException.class, () -> Validator.phone("abc"));
        assertThrows(ValidationException.class, () -> Validator.phone("123"));
        assertThrows(ValidationException.class, () -> Validator.phone("123456789012345678901"));
    }

    @Test
    @DisplayName("Age accepts 0-120 only")
    void ageIsValidated() {
        assertDoesNotThrow(() -> Validator.age(0));
        assertDoesNotThrow(() -> Validator.age(120));
        assertThrows(ValidationException.class, () -> Validator.age(-1));
        assertThrows(ValidationException.class, () -> Validator.age(121));
    }

    @Test
    @DisplayName("A slot must be positive and at most 8 hours")
    void timeRangesAreValidated() {
        LocalDateTime start = LocalDateTime.now().plusHours(1);
        assertDoesNotThrow(() -> Validator.timeRange(start, start.plusHours(8)));
        assertThrows(ValidationException.class, () -> Validator.timeRange(start, start.plusHours(8).plusMinutes(1)));
        assertThrows(ValidationException.class, () -> Validator.timeRange(start, start));
        assertThrows(ValidationException.class, () -> Validator.timeRange(start, start.minusMinutes(1)));
        assertThrows(ValidationException.class, () -> Validator.timeRange(null, start));
        assertThrows(ValidationException.class, () -> Validator.timeRange(start, null));
    }

    @Test
    @DisplayName("Future date/time fields reject the past and nulls")
    void futureDatesAreValidated() {
        assertDoesNotThrow(() -> Validator.futureDateTime(LocalDateTime.now().plusMinutes(5), "Start"));
        assertThrows(ValidationException.class,
                () -> Validator.futureDateTime(LocalDateTime.now().minusMinutes(5), "Start"));
        assertThrows(ValidationException.class, () -> Validator.futureDateTime(null, "Start"));

        assertDoesNotThrow(() -> Validator.dateNotPast(LocalDate.now(), "Date"));
        assertThrows(ValidationException.class,
                () -> Validator.dateNotPast(LocalDate.now().minusDays(1), "Date"));
        assertThrows(ValidationException.class, () -> Validator.dateNotPast(null, "Date"));
    }

    @Test
    @DisplayName("Required text and maximum lengths are enforced")
    void requiredTextAndLengthsAreValidated() {
        assertDoesNotThrow(() -> Validator.requireText("value", "Field"));
        assertThrows(ValidationException.class, () -> Validator.requireText(null, "Field"));
        assertThrows(ValidationException.class, () -> Validator.requireText("", "Field"));
        assertThrows(ValidationException.class, () -> Validator.requireText("  ", "Field"));

        assertDoesNotThrow(() -> Validator.maxLength("12345", 5, "Field"));
        assertDoesNotThrow(() -> Validator.maxLength(null, 5, "Field"));
        ValidationException tooLong = assertThrows(ValidationException.class,
                () -> Validator.maxLength("123456", 5, "Field"));
        assertTrue(tooLong.getMessage().contains("at most 5"));
    }
}
