package com.cropcare.common;

import java.util.Map;

import org.springframework.http.HttpStatus;

/** Thrown from services to send {@code {"success": false, "message": ...}} with the given status. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final Map<String, Object> details;

    public ApiException(HttpStatus status, String message) {
        this(status, message, Map.of());
    }

    /** details are added to the JSON body, e.g. {"code": "EMAIL_NOT_VERIFIED", "email": ...} */
    public ApiException(HttpStatus status, String message, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.details = details;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
