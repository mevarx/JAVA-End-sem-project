package com.hospital.haes.exception;

/** A booking request failed validation (past slot, limit reached, bad data). */
public class InvalidBookingException extends Exception {

    public InvalidBookingException(String message) {
        super(message);
    }

    public InvalidBookingException(String message, Throwable cause) {
        super(message, cause);
    }
}
