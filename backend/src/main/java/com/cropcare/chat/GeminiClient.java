package com.cropcare.chat;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.cropcare.config.AppProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Google Gemini {@code models/{model}:generateContent}. The answer is forced into a small JSON
 * object ({@code inScope}, {@code answer}) so the backend can tell an answer from a refusal, and
 * Google's own safety filters are switched on for harmful content.
 */
@Component
public class GeminiClient {

    private final AppProperties.Gemini settings;
    private final RestClient restClient;

    public GeminiClient(AppProperties props) {
        this.settings = props.gemini();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(60));
        this.restClient = RestClient.builder()
                .baseUrl(settings == null || settings.baseUrl() == null ? "" : settings.baseUrl())
                .requestFactory(requestFactory)
                .build();
    }

    public boolean isConfigured() {
        return settings != null && settings.configured();
    }

    /** One turn of the conversation: role "user" (farmer) or "model" (assistant). */
    public record Turn(String role, String text) {
    }

    /** text = the model's JSON answer; blocked = Google's safety filter stopped it. */
    public record Reply(String text, String finishReason, boolean blocked) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Part(String text) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Content(String role, List<Part> parts) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Candidate(Content content, String finishReason) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PromptFeedback(String blockReason) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Response(List<Candidate> candidates, PromptFeedback promptFeedback) {
    }

    private static final Map<String, Object> ANSWER_SCHEMA = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                    "inScope", Map.of("type", "BOOLEAN"),
                    "answer", Map.of("type", "STRING")),
            "required", List.of("inScope", "answer"));

    private static final List<Map<String, String>> SAFETY = List.of(
            Map.of("category", "HARM_CATEGORY_HARASSMENT", "threshold", "BLOCK_LOW_AND_ABOVE"),
            Map.of("category", "HARM_CATEGORY_HATE_SPEECH", "threshold", "BLOCK_LOW_AND_ABOVE"),
            Map.of("category", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold", "BLOCK_LOW_AND_ABOVE"),
            Map.of("category", "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold", "BLOCK_MEDIUM_AND_ABOVE"));

    public Reply generate(String systemInstruction, List<Turn> turns, int maxOutputTokens) {
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
                "contents", turns.stream()
                        .map(turn -> Map.of("role", turn.role(), "parts", List.of(Map.of("text", turn.text()))))
                        .toList(),
                "generationConfig", Map.of(
                        "temperature", 0.3,
                        "maxOutputTokens", maxOutputTokens,
                        "responseMimeType", "application/json",
                        "responseSchema", ANSWER_SCHEMA),
                "safetySettings", SAFETY);

        Response response = restClient.post()
                .uri("/models/{model}:generateContent", settings.model())
                .header("x-goog-api-key", settings.apiKey())
                .body(body)
                .retrieve()
                .body(Response.class);

        if (response == null) {
            throw new IllegalStateException("Empty response from Gemini");
        }
        if (response.promptFeedback() != null && response.promptFeedback().blockReason() != null) {
            return new Reply(null, response.promptFeedback().blockReason(), true);
        }
        if (response.candidates() == null || response.candidates().isEmpty()) {
            throw new IllegalStateException("Gemini returned no answer");
        }
        Candidate candidate = response.candidates().get(0);
        String text = candidate.content() == null || candidate.content().parts() == null ? null
                : String.join("", candidate.content().parts().stream()
                        .map(Part::text).filter(t -> t != null).toList());
        boolean blocked = "SAFETY".equals(candidate.finishReason()) || "PROHIBITED_CONTENT".equals(candidate.finishReason());
        return new Reply(text, candidate.finishReason(), blocked);
    }
}
