package com.cropcare.chat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import com.cropcare.config.AppProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Google Gemini {@code models/{model}:generateContent}. The answer is forced into a small JSON
 * object ({@code inScope}, {@code answer}) so the backend can tell an answer from a refusal, and
 * Google's own safety filters are switched on for harmful content.
 * <p>
 * If the main model is overloaded, rate-limited, retired or unreachable, the backup models are tried
 * in order, so one busy model on Google's side does not stop the chat.
 */
@Component
public class GeminiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);
    private static final Duration RETRY_AFTER = Duration.ofMillis(1500);

    private final AppProperties.Gemini settings;
    private final RestClient restClient;

    public GeminiClient(AppProperties props) {
        this.settings = props.gemini();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        // Per model; a farmer should not wait minutes if one model hangs and the next has to be tried
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
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

        // Google's free tier is often "experiencing high demand" (HTTP 503) on one model while a
        // lighter one answers. So: the main model, one quick retry, then each backup model.
        List<String> models = new ArrayList<>(List.of(settings.model()));
        if (settings.fallbackModels() != null) {
            settings.fallbackModels().stream()
                    .map(String::trim).filter(name -> !name.isEmpty() && !models.contains(name))
                    .forEach(models::add);
        }

        RestClientException failure = null;
        for (String model : models) {
            int attempts = model.equals(settings.model()) ? 2 : 1;
            for (int attempt = 1; attempt <= attempts; attempt++) {
                try {
                    Reply reply = call(model, body);
                    if (failure != null) {
                        log.info("Gemini answered with {} after an earlier failure", model);
                    }
                    return reply;
                } catch (RestClientResponseException e) {
                    failure = e;
                    int status = e.getStatusCode().value();
                    log.warn("Gemini model {} failed: HTTP {} {}", model, status, brief(e.getResponseBodyAsString()));
                    if (status != 429 && status != 404 && status < 500) {
                        throw e;            // wrong key or a bad request: another model will not help
                    }
                    if (status < 500 || attempt == attempts) {
                        break;              // rate limit or retired model: straight to the next model
                    }
                    pause();
                } catch (ResourceAccessException e) {
                    failure = e;            // timeout or no network
                    log.warn("Gemini model {} could not be reached: {}", model, e.getMessage());
                    break;
                }
            }
        }
        throw failure;
    }

    private Reply call(String model, Map<String, Object> body) {
        Response response = restClient.post()
                .uri("/models/{model}:generateContent", model)
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

    private static void pause() {
        try {
            Thread.sleep(RETRY_AFTER.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** The start of Google's error message, on one line, for the log. */
    private static String brief(String body) {
        String oneLine = body == null ? "" : body.replaceAll("\\s+", " ").trim();
        return oneLine.length() > 220 ? oneLine.substring(0, 220) + "…" : oneLine;
    }
}
