package com.hospital.haes.exception;

/**
 * Wraps SQLException so the UI never has to import java.sql. The original
 * exception remains available as the cause for logs and diagnostics.
 */
public class DatabaseOperationException extends Exception {

    public DatabaseOperationException(String message) {
        super(message);
    }

    public DatabaseOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}
