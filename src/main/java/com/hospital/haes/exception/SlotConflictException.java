package com.hospital.haes.exception;

/** Checked exception for slot clashes; never falls through as a silent overwrite. */
public class SlotConflictException extends Exception {

    public SlotConflictException(String message) {
        super(message);
    }
}
