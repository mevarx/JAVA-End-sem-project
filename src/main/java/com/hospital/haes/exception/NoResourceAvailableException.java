package com.hospital.haes.exception;

/** No free doctor / bed is currently available for an operation. */
public class NoResourceAvailableException extends Exception {

    public NoResourceAvailableException(String message) {
        super(message);
    }
}
