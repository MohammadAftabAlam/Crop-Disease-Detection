package com.cropcare.translation;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.cropcare.config.AppProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Translation by the Python AI service ({@code POST /translate}), which runs Meta's NLLB-200
 * model locally with a Hindi farming glossary. Needs no account or API key.
 */
@Component
public class LocalTranslatorClient implements Translator {

    private static final int BATCH_SIZE = 100;

    private final boolean enabled;
    private final RestClient restClient;

    public LocalTranslatorClient(AppProperties props) {
        this.enabled = props.translation() == null || props.translation().localEnabled();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        // The model loads on the first call and translates ~1 sentence per second on a CPU
        requestFactory.setReadTimeout(Duration.ofMinutes(5));
        this.restClient = RestClient.builder().baseUrl(props.aiServiceUrl()).requestFactory(requestFactory).build();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Response(List<String> translations) {
    }

    @Override
    public String name() {
        return "CropCare AI (NLLB-200)";
    }

    @Override
    public boolean isAvailable() {
        return enabled;
    }

    @Override
    public List<String> translate(List<String> texts, String source, String target) {
        List<String> result = new ArrayList<>(texts.size());
        for (int start = 0; start < texts.size(); start += BATCH_SIZE) {
            List<String> batch = texts.subList(start, Math.min(start + BATCH_SIZE, texts.size()));
            Response response = restClient.post()
                    .uri("/translate")
                    .body(Map.of("texts", batch, "source", source, "target", target))
                    .retrieve()
                    .body(Response.class);
            if (response == null || response.translations() == null || response.translations().size() != batch.size()) {
                throw new IllegalStateException("AI service returned no translations for " + batch.size() + " texts");
            }
            result.addAll(response.translations());
        }
        return result;
    }
}
