package com.hospital.haes.exception;

/** Raised when an emergency cannot be escalated to another responder. */
public class EmergencyEscalationException extends Exception {

    public EmergencyEscalationException(String message) {
        super(message);
    }

    public EmergencyEscalationException(String message, Throwable cause) {
        super(message, cause);
    }
}
