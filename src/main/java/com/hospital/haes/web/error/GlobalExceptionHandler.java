package com.hospital.haes.web.error;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.web.dto.ApiError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;

/**
 * Maps the domain's checked exceptions onto HTTP statuses. Login failure is handled
 * inside AuthController (401); everywhere else UnauthorizedActionException means "not
 * allowed" (403).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiError> validation(ValidationException e) {
        return build(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            IllegalArgumentException.class})
    public ResponseEntity<ApiError> badRequest(Exception e) {
        return build(HttpStatus.BAD_REQUEST, "Invalid request: " + e.getMessage());
    }

    @ExceptionHandler({InvalidBookingException.class, SlotConflictException.class})
    public ResponseEntity<ApiError> conflict(Exception e) {
        return build(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(UnauthorizedActionException.class)
    public ResponseEntity<ApiError> forbidden(UnauthorizedActionException e) {
        return build(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler(DatabaseOperationException.class)
    public ResponseEntity<ApiError> database(DatabaseOperationException e) {
        log.error("Database operation failed", e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "A database error occurred. Please try again.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception e) {
        log.error("Unhandled request failure", e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String message) {
        return ResponseEntity.status(status)
                .body(new ApiError(status.value(), status.getReasonPhrase(), message, LocalDateTime.now()));
    }
}
