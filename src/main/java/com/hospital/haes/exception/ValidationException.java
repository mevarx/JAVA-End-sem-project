package com.hospital.haes.exception;

/** General form/input validation failure. */
public class ValidationException extends Exception {

    public ValidationException(String message) {
        super(message);
    }
}
