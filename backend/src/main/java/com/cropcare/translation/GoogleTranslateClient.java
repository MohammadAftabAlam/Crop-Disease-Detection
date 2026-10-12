package com.cropcare.translation;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.cropcare.config.AppProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Google Cloud Translation API v2 (Basic). Free tier: 500,000 characters/month.
 * <p>
 * Get an API key from <a href="https://console.cloud.google.com">Google Cloud Console</a>
 * &rarr; APIs &amp; Services &rarr; enable "Cloud Translation API" &rarr; Credentials &rarr; API key.
 * Set it as {@code GOOGLE_TRANSLATE_API_KEY} in {@code .env}.
 */
@Component
public class GoogleTranslateClient implements Translator {

    private static final Logger log = LoggerFactory.getLogger(GoogleTranslateClient.class);

    /** Google recommends batches of up to 128 texts. */
    private static final int BATCH_SIZE = 100;

    private final String apiKey;
    private final RestClient restClient;

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TranslationItem(String translatedText) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TranslationsData(List<TranslationItem> translations) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TranslateResponse(TranslationsData data) {}

    private static final String DEFAULT_BASE_URL = "https://translation.googleapis.com";

    public GoogleTranslateClient(AppProperties props) {
        AppProperties.GoogleTranslate config = props.googleTranslate();
        this.apiKey = config != null ? config.apiKey() : null;
        String baseUrl = config != null && config.baseUrl() != null && !config.baseUrl().isBlank()
                ? config.baseUrl() : DEFAULT_BASE_URL;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public String name() {
        return "Google Translate";
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public List<String> translate(List<String> texts, String source, String target) {
        if (!isAvailable()) {
            throw new IllegalStateException("Google Translate API key is not configured (GOOGLE_TRANSLATE_API_KEY)");
        }
        List<String> result = new ArrayList<>(texts.size());
        for (int start = 0; start < texts.size(); start += BATCH_SIZE) {
            List<String> batch = texts.subList(start, Math.min(start + BATCH_SIZE, texts.size()));
            result.addAll(translateBatch(batch, source, target));
        }
        return result;
    }

    private List<String> translateBatch(List<String> texts, String source, String target) {
        Map<String, Object> body = Map.of(
                "q", texts,
                "source", source,
                "target", target,
                "format", "text"
        );

        TranslateResponse response = restClient.post()
                .uri("/language/translate/v2?key={key}", apiKey)
                .body(body)
                .retrieve()
                .body(TranslateResponse.class);

        if (response == null || response.data() == null || response.data().translations() == null
                || response.data().translations().size() != texts.size()) {
            throw new IllegalStateException("Google Translate returned "
                    + (response == null || response.data() == null || response.data().translations() == null
                            ? 0 : response.data().translations().size())
                    + " translations for " + texts.size() + " texts");
        }
        return response.data().translations().stream().map(TranslationItem::translatedText).toList();
    }
}
