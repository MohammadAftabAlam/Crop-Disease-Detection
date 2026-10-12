package com.cropcare.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Values from the {@code app.*} keys in application.properties. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        String frontendUrl,
        String aiServiceUrl,
        String uploadDir,
        GoogleTranslate googleTranslate,
        Translation translation,
        Gemini gemini,
        Chat chat,
        Cloudinary cloudinary) {

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

    /**
     * Cloudinary account for storing leaf photos. Empty = photos stay in the backend's uploads folder.
     * apiUrl is only changed in tests.
     */
    public record Cloudinary(String cloudName, String apiKey, String apiSecret, String folder, String apiUrl) {
        public boolean configured() {
            return cloudName != null && !cloudName.isBlank() && apiKey != null && !apiKey.isBlank()
                    && apiSecret != null && !apiSecret.isBlank();
        }
    }

    /**
     * Google Gemini API for the "ask about this result" chat. Empty apiKey = chat off.
     * fallbackModels are tried, in order, when the main model is overloaded or rate-limited.
     */
    public record Gemini(String apiKey, String model, String baseUrl, List<String> fallbackModels) {
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

    /** Google Cloud Translation API v2. Free tier: 500,000 chars/month. Empty apiKey = off. */
    public record GoogleTranslate(String apiKey, String baseUrl) {
        public boolean configured() {
            return apiKey != null && !apiKey.isBlank();
        }
    }
}
