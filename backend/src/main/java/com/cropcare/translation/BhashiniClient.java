package com.cropcare.translation;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import com.cropcare.config.AppProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Bhashini machine translation (https://bhashini.gov.in), in two steps:
 * <ol>
 * <li>config call with our userID + ULCA API key: returns the inference URL, a short-lived
 * inference key and the translation model's serviceId (cached for an hour);</li>
 * <li>compute call to that URL with the texts to translate.</li>
 * </ol>
 */
@Component
public class BhashiniClient implements Translator {

    private static final Logger log = LoggerFactory.getLogger(BhashiniClient.class);
    private static final Duration CONFIG_LIFETIME = Duration.ofHours(1);
    private static final int BATCH_SIZE = 25;

    private final AppProperties.Bhashini settings;
    private final RestClient restClient;

    private record Config(String source, String target, String serviceId, String callbackUrl, String keyName,
            String keyValue, Instant expiresAt) {
    }

    private volatile Config cached;

    public BhashiniClient(AppProperties props) {
        this.settings = props.bhashini();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        // Buffer bodies so requests carry Content-Length instead of chunked encoding (safer with API gateways)
        this.restClient = RestClient.builder().requestFactory(new BufferingClientHttpRequestFactory(requestFactory)).build();
    }

    public boolean isConfigured() {
        return settings != null && settings.configured();
    }

    @Override
    public String name() {
        return "Bhashini";
    }

    @Override
    public boolean isAvailable() {
        return isConfigured();
    }

    // ---- JSON shapes (only the fields we use) ----

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Language(String sourceLanguage, String targetLanguage) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ServiceConfig(String serviceId, Language language) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TaskConfig(String taskType, List<ServiceConfig> config) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record InferenceKey(String name, String value) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Endpoint(String callbackUrl, InferenceKey inferenceApiKey) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ConfigResponse(List<TaskConfig> pipelineResponseConfig, Endpoint pipelineInferenceAPIEndPoint) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Output(String source, String target) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TaskOutput(String taskType, List<Output> output) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ComputeResponse(List<TaskOutput> pipelineResponse) {
    }

    /** Translate texts (same order). Throws if Bhashini is not configured or fails. */
    @Override
    public List<String> translate(List<String> texts, String source, String target) {
        if (!isConfigured()) {
            throw new IllegalStateException("Bhashini is not configured (BHASHINI_USER_ID / BHASHINI_API_KEY)");
        }
        List<String> result = new ArrayList<>(texts.size());
        for (int start = 0; start < texts.size(); start += BATCH_SIZE) {
            List<String> batch = texts.subList(start, Math.min(start + BATCH_SIZE, texts.size()));
            try {
                result.addAll(compute(config(source, target, false), batch));
            } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
                // Inference keys expire; fetch a fresh config once and retry
                result.addAll(compute(config(source, target, true), batch));
            }
        }
        return result;
    }

    private Config config(String source, String target, boolean refresh) {
        Config current = cached;
        if (!refresh && current != null && current.source().equals(source) && current.target().equals(target)
                && Instant.now().isBefore(current.expiresAt())) {
            return current;
        }

        Map<String, Object> body = Map.of(
                "pipelineTasks", List.of(Map.of("taskType", "translation", "config",
                        Map.of("language", Map.of("sourceLanguage", source, "targetLanguage", target)))),
                "pipelineRequestConfig", Map.of("pipelineId", settings.pipelineId()));

        ConfigResponse response = restClient.post()
                .uri(settings.configUrl())
                .header("userID", settings.userId())
                .header("ulcaApiKey", settings.apiKey())
                .body(body)
                .retrieve()
                .body(ConfigResponse.class);

        if (response == null || response.pipelineInferenceAPIEndPoint() == null || response.pipelineResponseConfig() == null) {
            throw new IllegalStateException("Unexpected Bhashini config response");
        }
        String serviceId = response.pipelineResponseConfig().stream()
                .filter(task -> "translation".equals(task.taskType()))
                .flatMap(task -> task.config().stream())
                .filter(c -> c.language() != null && source.equals(c.language().sourceLanguage())
                        && target.equals(c.language().targetLanguage()))
                .map(ServiceConfig::serviceId)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Bhashini offers no " + source + "->" + target + " model"));

        Endpoint endpoint = response.pipelineInferenceAPIEndPoint();
        Config fresh = new Config(source, target, serviceId, endpoint.callbackUrl(), endpoint.inferenceApiKey().name(),
                endpoint.inferenceApiKey().value(), Instant.now().plus(CONFIG_LIFETIME));
        cached = fresh;
        log.info("Bhashini translation model {} ({} -> {})", serviceId, source, target);
        return fresh;
    }

    private List<String> compute(Config config, List<String> texts) {
        Map<String, Object> body = Map.of(
                "pipelineTasks", List.of(Map.of("taskType", "translation", "config", Map.of(
                        "language", Map.of("sourceLanguage", config.source(), "targetLanguage", config.target()),
                        "serviceId", config.serviceId()))),
                "inputData", Map.of("input", texts.stream().map(text -> Map.of("source", text)).toList()));

        ComputeResponse response = restClient.post()
                .uri(config.callbackUrl())
                .header(config.keyName(), config.keyValue())
                .body(body)
                .retrieve()
                .body(ComputeResponse.class);

        List<Output> outputs = response == null || response.pipelineResponse() == null || response.pipelineResponse().isEmpty()
                ? List.of() : response.pipelineResponse().get(0).output();
        if (outputs == null || outputs.size() != texts.size()) {
            throw new IllegalStateException("Bhashini returned " + (outputs == null ? 0 : outputs.size())
                    + " translations for " + texts.size() + " texts");
        }
        return outputs.stream().map(Output::target).toList();
    }
}
