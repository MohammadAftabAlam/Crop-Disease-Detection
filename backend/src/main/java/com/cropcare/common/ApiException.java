package com.cropcare.common;

import org.springframework.http.HttpStatus;

/** Thrown from services to send {@code {"success": false, "message": ...}} with the given status. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
