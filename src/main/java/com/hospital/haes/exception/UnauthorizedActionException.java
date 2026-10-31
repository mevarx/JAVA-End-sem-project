package com.hospital.haes.exception;

/** The signed-in user is not allowed to perform the requested action. */
public class UnauthorizedActionException extends Exception {

    public UnauthorizedActionException(String message) {
        super(message);
    }
}
