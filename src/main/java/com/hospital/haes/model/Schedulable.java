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
}
