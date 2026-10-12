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
        Bhashini bhashini,
        Translation translation,
        Gemini gemini,
        Chat chat) {

    public record Jwt(String secret, Duration expiry) {
    }

    /**
     * Hindi translation done by the AI service itself (NLLB-200 model, no account needed).
     * Used when Bhashini has no keys. {@code localEnabled=false} turns it off.
     * {@code warmUp}: translate the disease library in the background at startup, so the
     * first farmer who opens a Hindi result does not wait for the model.
     */
    public record Translation(boolean localEnabled, boolean warmUp) {
    }

    /** Google Gemini API for the "ask about this result" chat. Empty apiKey = chat off. */
    public record Gemini(String apiKey, String model, String baseUrl) {
        public boolean configured() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    /**
     * Limits on the chat: questions per user per day, questions per scan, question length,
     * and the answer length the model may produce.
     */
    public record Chat(int dailyLimit, int perPredictionLimit, int maxQuestionChars, int maxAnswerTokens) {
    }

    /** Bhashini (Government of India) translation API. Empty userId/apiKey = translation off. */
    public record Bhashini(String userId, String apiKey, String pipelineId, String configUrl) {
        public boolean configured() {
            return userId != null && !userId.isBlank() && apiKey != null && !apiKey.isBlank();
        }
    }
}
