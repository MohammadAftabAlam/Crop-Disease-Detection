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
 * Runs the real BhashiniClient against a local fake Bhashini that speaks the same JSON:
 * config call (userID + ulcaApiKey headers) -> callbackUrl + inference key + serviceId,
 * then compute call -> pipelineResponse[0].output[].target. The fake "translates" by prefixing "हिं: ".
 */
class TranslationIntegrationTest extends IntegrationTestBase {

    static final HttpServer FAKE;
    static final AtomicInteger CONFIG_CALLS = new AtomicInteger();
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
        FAKE.createContext("/config", TranslationIntegrationTest::config);
        FAKE.createContext("/compute", TranslationIntegrationTest::compute);
        FAKE.start();
    }

    @DynamicPropertySource
    static void bhashini(DynamicPropertyRegistry registry) {
        String base = "http://127.0.0.1:" + FAKE.getAddress().getPort();
        registry.add("app.bhashini.user-id", () -> "test-user");
        registry.add("app.bhashini.api-key", () -> "test-ulca-key");
        registry.add("app.bhashini.config-url", () -> base + "/config");
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

    private static void config(HttpExchange exchange) throws IOException {
        JsonNode body = JSON.readTree(exchange.getRequestBody());
        if (!"test-user".equals(exchange.getRequestHeaders().getFirst("userID"))
                || !"test-ulca-key".equals(exchange.getRequestHeaders().getFirst("ulcaApiKey"))) {
            PROBLEMS.add("config call without userID/ulcaApiKey headers");
        }
        if (!"64392f96daac500b55c543cd".equals(body.at("/pipelineRequestConfig/pipelineId").asString())) {
            PROBLEMS.add("wrong pipelineId");
        }
        CONFIG_CALLS.incrementAndGet();
        String port = String.valueOf(FAKE.getAddress().getPort());
        reply(exchange, 200, """
                {"pipelineResponseConfig":[{"taskType":"translation","config":[
                   {"serviceId":"en-to-ta","language":{"sourceLanguage":"en","targetLanguage":"ta"}},
                   {"serviceId":"en-to-hi-model","language":{"sourceLanguage":"en","targetLanguage":"hi"}}]}],
                 "pipelineInferenceAPIEndPoint":{"callbackUrl":"http://127.0.0.1:%s/compute",
                   "inferenceApiKey":{"name":"Authorization","value":"inference-secret"}}}""".formatted(port));
    }

    private static void compute(HttpExchange exchange) throws IOException {
        if (DOWN.get()) {
            reply(exchange, 500, "{}");
            return;
        }
        JsonNode body = JSON.readTree(exchange.getRequestBody());
        if (!"inference-secret".equals(exchange.getRequestHeaders().getFirst("Authorization"))) {
            PROBLEMS.add("compute call without inference key");
        }
        if (!"en-to-hi-model".equals(body.at("/pipelineTasks/0/config/serviceId").asString())) {
            PROBLEMS.add("compute call used the wrong serviceId");
        }
        List<String> outputs = new ArrayList<>();
        for (JsonNode input : body.at("/inputData/input")) {
            String source = input.get("source").asString();
            TEXTS_TRANSLATED.incrementAndGet();
            outputs.add("{\"source\":" + JSON.writeValueAsString(source) + ",\"target\":"
                    + JSON.writeValueAsString("हिं: " + source) + "}");
        }
        reply(exchange, 200, "{\"pipelineResponse\":[{\"taskType\":\"translation\",\"output\":[" + String.join(",", outputs) + "]}]}");
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
                .andExpect(jsonPath("$.translation.provider").value("Bhashini"))
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
        assertThat(CONFIG_CALLS.get()).isEqualTo(1);   // config cached for an hour
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
    void whenBhashiniFailsTheAppShowsEnglishInsteadOfAnError() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token);
        DOWN.set(true);

        // Rice text has not been translated by the other tests, so it must hit (the failing) Bhashini
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
