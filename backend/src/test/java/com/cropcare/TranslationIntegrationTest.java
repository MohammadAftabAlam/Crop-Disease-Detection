package com.cropcare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.cropcare.translation.TranslationRepository;
import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Runs the real GoogleTranslateClient against a local fake that speaks the same
 * Google Cloud Translation API v2 JSON: POST /language/translate/v2?key=...
 * returns {"data":{"translations":[{"translatedText":"हिं: ..."}]}}.
 * The fake "translates" by prefixing "हिं: ".
 */
class TranslationIntegrationTest extends IntegrationTestBase {

    static final HttpServer FAKE;
    static final AtomicInteger TEXTS_TRANSLATED = new AtomicInteger();
    static final AtomicBoolean DOWN = new AtomicBoolean(false);
    static final List<String> PROBLEMS = new ArrayList<>();
    static final JsonMapper JSON = JsonMapper.builder().build();

    static {
        try {
            FAKE = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        FAKE.createContext("/language/translate/v2", TranslationIntegrationTest::translate);
        FAKE.start();
    }

    @DynamicPropertySource
    static void googleTranslate(DynamicPropertyRegistry registry) {
        String base = "http://127.0.0.1:" + FAKE.getAddress().getPort();
        registry.add("app.google-translate.api-key", () -> "test-google-key");
        registry.add("app.google-translate.base-url", () -> base);
    }

    @AfterAll
    static void stop() {
        FAKE.stop(0);
    }

    @Autowired
    TranslationRepository translations;

    @BeforeEach
    void reset() {
        DOWN.set(false);
        PROBLEMS.clear();
    }

    private static void translate(HttpExchange exchange) throws IOException {
        if (DOWN.get()) {
            reply(exchange, 500, "{}");
            return;
        }
        // Check the API key is passed as a query parameter
        String query = exchange.getRequestURI().getQuery();
        if (query == null || !query.contains("key=test-google-key")) {
            PROBLEMS.add("translate call without API key");
        }

        JsonNode body = JSON.readTree(exchange.getRequestBody());
        JsonNode qArray = body.get("q");
        List<String> items = new ArrayList<>();
        for (JsonNode item : qArray) {
            String source = item.asString();
            TEXTS_TRANSLATED.incrementAndGet();
            items.add("{\"translatedText\":" + JSON.writeValueAsString("हिं: " + source) + "}");
        }
        reply(exchange, 200, "{\"data\":{\"translations\":[" + String.join(",", items) + "]}}");
    }

    private static void reply(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private Integer scan(String token) throws Exception {
        given(aiClient.predict(anyList(), anyBoolean(), any()))
                .willReturn(confident("potato__late_blight", "Potato", "Late Blight", false, 2));
        String body = mvc.perform(multipart("/api/predictions/detect")
                .file(new MockMultipartFile("image", "leaf.png", "image/png", PNG))
                .header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.prediction.id");
    }

    @Test
    void adviceIsTranslatedOnceAndThenServedFromTheDatabase() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token);

        mvc.perform(get("/api/predictions/" + id).header("Authorization", "Bearer " + token).header("Accept-Language", "en"))
                .andExpect(jsonPath("$.translation.language").value("en"))
                .andExpect(jsonPath("$.prediction.advice.immediateActions[0]").value(org.hamcrest.Matchers.not(startsWith("हिं"))));

        int before = TEXTS_TRANSLATED.get();
        mvc.perform(get("/api/predictions/" + id).header("Authorization", "Bearer " + token).header("Accept-Language", "hi-IN,hi;q=0.9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.translation.language").value("hi"))
                .andExpect(jsonPath("$.translation.applied").value(true))
                .andExpect(jsonPath("$.translation.provider").value("Google Translate"))
                .andExpect(jsonPath("$.prediction.advice.immediateActions[0]").value(startsWith("हिं: ")))
                .andExpect(jsonPath("$.prediction.advice.disclaimer").value(startsWith("हिं: ")))
                .andExpect(jsonPath("$.prediction.advice.urgency").value("MODERATE"))           // codes stay as they are
                .andExpect(jsonPath("$.prediction.advice.headline").value("Potato: Late Blight")); // names stay English
        int firstTime = TEXTS_TRANSLATED.get() - before;
        assertThat(firstTime).isGreaterThan(5);

        // Second request: everything comes from the translations table
        mvc.perform(get("/api/predictions/" + id).header("Authorization", "Bearer " + token).header("Accept-Language", "hi"))
                .andExpect(jsonPath("$.prediction.advice.immediateActions[0]").value(startsWith("हिं: ")));
        assertThat(TEXTS_TRANSLATED.get() - before).isEqualTo(firstTime);
        assertThat(translations.count()).isGreaterThanOrEqualTo(firstTime);
        assertThat(PROBLEMS).isEmpty();
    }

    @Test
    void diseaseLibraryIsTranslatedInOneBatch() throws Exception {
        mvc.perform(get("/api/diseases/crop/wheat").header("Accept-Language", "hi"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.translation.applied").value(true))
                .andExpect(jsonPath("$.diseases[0].description").value(startsWith("हिं: ")))
                .andExpect(jsonPath("$.diseases[0].symptoms[0]").value(startsWith("हिं: ")))
                .andExpect(jsonPath("$.diseases[0].diseaseName").value(org.hamcrest.Matchers.not(startsWith("हिं"))));
        assertThat(PROBLEMS).isEmpty();
    }

    @Test
    void whenGoogleTranslateFailsTheAppShowsEnglishInsteadOfAnError() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token);
        DOWN.set(true);

        // Rice text has not been translated by the other tests, so it must hit (the failing) Google
        mvc.perform(get("/api/diseases/crop/rice").header("Accept-Language", "hi"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.translation.applied").value(false))
                .andExpect(jsonPath("$.diseases[0].description").value(org.hamcrest.Matchers.not(startsWith("हिं"))));

        mvc.perform(get("/api/predictions/" + id).header("Authorization", "Bearer " + token).header("Accept-Language", "hi"))
                .andExpect(status().isOk());
    }

    @Test
    void unsupportedLanguagesFallBackToEnglish() throws Exception {
        mvc.perform(get("/api/diseases/crop/maize").header("Accept-Language", "fr-FR"))
                .andExpect(jsonPath("$.translation.language").value("en"))
                .andExpect(jsonPath("$.diseases[0].description").value(org.hamcrest.Matchers.not(startsWith("हिं"))));
    }
}
