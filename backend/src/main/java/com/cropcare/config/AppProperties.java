package com.cropcare.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Values from the {@code app.*} keys in application.properties. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        String frontendUrl,
        String aiServiceUrl,
        String uploadDir) {

    public record Jwt(String secret, Duration expiry) {
    }
}
