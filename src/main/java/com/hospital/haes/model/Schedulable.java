package com.hospital.haes.model;

import java.time.LocalDateTime;

/**
 * Anything that occupies a time window in the hospital schedule.
 * Implemented by slots, appointments and emergency cases so the same
 * overlap rules can be reused across the system.
 */
public interface Schedulable {

    LocalDateTime getStart();

    LocalDateTime getEnd();

    /**
     * Half-open interval overlap test: back-to-back bookings (one ending
     * exactly when the next starts) do not conflict.
     */
    default boolean conflictsWith(Schedulable other) {
        if (other == null) {
            return false;
        }
        return getStart().isBefore(other.getEnd()) && other.getStart().isBefore(getEnd());
    }
}
