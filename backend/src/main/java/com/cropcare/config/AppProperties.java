package com.cropcare.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Values from the {@code app.*} keys in application.properties. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        String frontendUrl,
        String aiServiceUrl,
        String uploadDir,
        Bhashini bhashini) {

    public record Jwt(String secret, Duration expiry) {
    }

    /** Bhashini (Government of India) translation API. Empty userId/apiKey = translation off. */
    public record Bhashini(String userId, String apiKey, String pipelineId, String configUrl) {
        public boolean configured() {
            return userId != null && !userId.isBlank() && apiKey != null && !apiKey.isBlank();
        }
    }
}
