package com.cropcare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.cropcare.translation.TranslationRepository;
import com.cropcare.translation.TranslationWarmup;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * No Bhashini keys: the backend asks the AI service's POST /translate (here a local fake that
 * "translates" by prefixing "स्थानीय: ") and caches the result like any other translation.
 */
class LocalTranslationIntegrationTest extends IntegrationTestBase {

    static final HttpServer FAKE_AI;
    static final AtomicInteger TEXTS_TRANSLATED = new AtomicInteger();
    static final AtomicBoolean DOWN = new AtomicBoolean(false);
    static final List<String> PROBLEMS = new ArrayList<>();
    static final JsonMapper JSON = JsonMapper.builder().build();

    static {
        try {
            FAKE_AI = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        FAKE_AI.createContext("/translate", LocalTranslationIntegrationTest::translate);
        FAKE_AI.start();
    }

    @DynamicPropertySource
    static void localTranslation(DynamicPropertyRegistry registry) {
        registry.add("app.ai-service-url", () -> "http://127.0.0.1:" + FAKE_AI.getAddress().getPort());
        registry.add("app.translation.local-enabled", () -> "true");
        registry.add("app.bhashini.user-id", () -> "");
        registry.add("app.bhashini.api-key", () -> "");
    }

    @AfterAll
    static void stop() {
        FAKE_AI.stop(0);
    }

    @Autowired
    TranslationWarmup warmup;

    @Autowired
    TranslationRepository translations;

    @BeforeEach
    void reset() {
        DOWN.set(false);
        PROBLEMS.clear();
    }

    private static void translate(HttpExchange exchange) throws IOException {
        if (DOWN.get()) {
            reply(exchange, 503, "{\"success\":false,\"message\":\"model not loaded\"}");
            return;
        }
        JsonNode body = JSON.readTree(exchange.getRequestBody());
        if (!"en".equals(body.get("source").asString()) || !"hi".equals(body.get("target").asString())) {
            PROBLEMS.add("wrong languages: " + body);
        }
        List<String> out = new ArrayList<>();
        for (JsonNode text : body.get("texts")) {
            TEXTS_TRANSLATED.incrementAndGet();
            out.add(JSON.writeValueAsString("स्थानीय: " + text.asString()));
        }
        reply(exchange, 200, "{\"success\":true,\"translations\":[" + String.join(",", out) + "]}");
    }

    private static void reply(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    @Test
    void withoutBhashiniKeysTheAiServiceTranslatesAndTheResultIsCached() throws Exception {
        mvc.perform(get("/api/diseases/crop/potato").header("Accept-Language", "hi"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.translation.applied").value(true))
                .andExpect(jsonPath("$.translation.provider").value("CropCare AI (NLLB-200)"))
                .andExpect(jsonPath("$.diseases[0].description").value(startsWith("स्थानीय: ")))
                .andExpect(jsonPath("$.diseases[0].diseaseName").value(not(startsWith("स्थानीय"))));
        int first = TEXTS_TRANSLATED.get();
        assertThat(first).isGreaterThan(5);   // (some may have come from the warm-up test)

        mvc.perform(get("/api/diseases/crop/potato").header("Accept-Language", "hi"))
                .andExpect(jsonPath("$.diseases[0].description").value(startsWith("स्थानीय: ")));
        assertThat(TEXTS_TRANSLATED.get()).isEqualTo(first);   // second time from the database
        assertThat(PROBLEMS).isEmpty();
    }

    @Test
    void warmUpTranslatesTheLibraryAndAdviceAheadOfTime() {
        assertThat(warmup.warm()).isTrue();
        assertThat(translations.count()).isGreaterThan(200);   // library + advice templates, all stored
        int after = TEXTS_TRANSLATED.get();
        assertThat(warmup.warm()).isTrue();
        assertThat(TEXTS_TRANSLATED.get()).isEqualTo(after);   // second run: nothing left to translate
        assertThat(PROBLEMS).isEmpty();
    }

    @Test
    void whenTheTranslationModelIsUnavailableTheAppShowsEnglish() throws Exception {
        DOWN.set(true);
        mvc.perform(get("/api/diseases/crop/pepper").header("Accept-Language", "hi"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.translation.applied").value(false))
                .andExpect(jsonPath("$.diseases[0].description").value(not(startsWith("स्थानीय"))));
    }
}
