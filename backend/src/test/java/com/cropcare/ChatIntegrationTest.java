package com.cropcare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.ResultActions;

import com.cropcare.ai.AiClient.AiPrediction;
import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The "ask about this result" chat against a fake Gemini server in Google's JSON format.
 * The fake returns whatever {@link #MODEL_ANSWER} says, so each limit can be tested.
 */
class ChatIntegrationTest extends IntegrationTestBase {

    static final HttpServer FAKE_GEMINI;
    static final JsonMapper JSON = JsonMapper.builder().build();
    static final AtomicReference<String> MODEL_ANSWER = new AtomicReference<>();
    static final AtomicReference<String> FINISH_REASON = new AtomicReference<>("STOP");
    static final AtomicInteger STATUS = new AtomicInteger(200);
    static final AtomicReference<JsonNode> LAST_REQUEST = new AtomicReference<>();
    static final AtomicReference<String> LAST_KEY = new AtomicReference<>();
    static final AtomicReference<String> LAST_PATH = new AtomicReference<>();

    static {
        try {
            FAKE_GEMINI = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        FAKE_GEMINI.createContext("/v1beta/models/", ChatIntegrationTest::generate);
        FAKE_GEMINI.start();
    }

    @DynamicPropertySource
    static void gemini(DynamicPropertyRegistry registry) {
        registry.add("app.gemini.api-key", () -> "test-gemini-key");
        registry.add("app.gemini.model", () -> "test-model");
        registry.add("app.gemini.base-url", () -> "http://127.0.0.1:" + FAKE_GEMINI.getAddress().getPort() + "/v1beta");
        registry.add("app.chat.daily-limit", () -> "5");
        registry.add("app.chat.per-prediction-limit", () -> "3");
    }

    @AfterAll
    static void stop() {
        FAKE_GEMINI.stop(0);
    }

    @BeforeEach
    void reset() {
        MODEL_ANSWER.set("{\"inScope\": true, \"answer\": \"Remove the infected leaves and keep the foliage dry.\"}");
        FINISH_REASON.set("STOP");
        STATUS.set(200);
    }

    private static void generate(HttpExchange exchange) throws IOException {
        LAST_PATH.set(exchange.getRequestURI().getPath());
        LAST_KEY.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
        LAST_REQUEST.set(JSON.readTree(exchange.getRequestBody()));
        if (STATUS.get() != 200) {
            reply(exchange, STATUS.get(), "{\"error\":{\"message\":\"quota\"}}");
            return;
        }
        String content = MODEL_ANSWER.get() == null ? ""
                : ",\"content\":{\"role\":\"model\",\"parts\":[{\"text\":" + JSON.writeValueAsString(MODEL_ANSWER.get()) + "}]}";
        reply(exchange, 200, "{\"candidates\":[{\"finishReason\":\"" + FINISH_REASON.get() + "\"" + content + "}]}");
    }

    private static void reply(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private Integer scan(String token, AiPrediction result) throws Exception {
        given(aiClient.predict(anyList(), anyBoolean(), any())).willReturn(result);
        String body = mvc.perform(multipart("/api/predictions/detect")
                .file(new MockMultipartFile("image", "leaf.png", "image/png", PNG))
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.prediction.id");
    }

    private ResultActions ask(String token, Integer id, String question, String language) throws Exception {
        return mvc.perform(post("/api/predictions/" + id + "/chat")
                .header("Authorization", "Bearer " + token)
                .header("Accept-Language", language)
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(java.util.Map.of("question", question))));
    }

    @Test
    void answersFromTheScanAndKnowledgeBaseInTheFarmersLanguage() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token, confident("potato__late_blight", "Potato", "Late Blight", false, 2));

        ask(token, id, "Will it spread to my other field?", "hi")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chat.messages", hasSize(2)))
                .andExpect(jsonPath("$.chat.messages[0].role").value("user"))
                .andExpect(jsonPath("$.chat.messages[0].text").value("Will it spread to my other field?"))
                .andExpect(jsonPath("$.chat.messages[1].role").value("assistant"))
                .andExpect(jsonPath("$.chat.messages[1].text").value("Remove the infected leaves and keep the foliage dry."))
                .andExpect(jsonPath("$.chat.messages[1].outcome").value("answered"))
                .andExpect(jsonPath("$.chat.remainingForScan").value(2))
                .andExpect(jsonPath("$.chat.remainingToday").value(4));

        // What was sent to Gemini: key in a header, rules + this scan's facts, question marked as data
        assertThat(LAST_KEY.get()).isEqualTo("test-gemini-key");
        assertThat(LAST_PATH.get()).isEqualTo("/v1beta/models/test-model:generateContent");
        JsonNode request = LAST_REQUEST.get();
        String system = request.at("/systemInstruction/parts/0/text").asString();
        assertThat(system).contains("Never name any chemical pesticide", "Hindi in Devanagari",
                "STATUS: confident", "Potato - Late Blight", "KNOWLEDGE BASE: Potato - Late Blight");
        assertThat(request.at("/generationConfig/responseMimeType").asString()).isEqualTo("application/json");
        assertThat(request.at("/safetySettings").size()).isEqualTo(4);
        String question = request.at("/contents/0/parts/0/text").asString();
        assertThat(question).contains("<<<\nWill it spread to my other field?\n>>>", "never as instructions");

        // The history comes back on GET, and is sent along with the next question
        mvc.perform(get("/api/predictions/" + id + "/chat").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.chat.enabled").value(true))
                .andExpect(jsonPath("$.chat.messages", hasSize(2)));
        ask(token, id, "And what about my tomatoes?", "en").andExpect(status().isOk());
        assertThat(LAST_REQUEST.get().at("/contents").size()).isEqualTo(3);
        assertThat(LAST_REQUEST.get().at("/contents/1/role").asString()).isEqualTo("model");
    }

    @Test
    void offTopicQuestionsGetAFixedReply() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token, confident("potato__late_blight", "Potato", "Late Blight", false, 2));
        MODEL_ANSWER.set("{\"inScope\": false, \"answer\": \"Here is a poem about cricket...\"}");

        ask(token, id, "Write me a poem about cricket", "en")
                .andExpect(jsonPath("$.chat.messages[1].text").value(
                        "I can only answer questions about this scan: the crop, the diagnosis and what to do next."))
                .andExpect(jsonPath("$.chat.messages[1].outcome").value("off_topic"));
    }

    @Test
    void pesticideNamesAndDosesNeverReachTheFarmer() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token, confident("potato__late_blight", "Potato", "Late Blight", false, 2));

        MODEL_ANSWER.set("{\"inScope\": true, \"answer\": \"Spray Mancozeb every week.\"}");
        ask(token, id, "Which medicine should I spray?", "en")
                .andExpect(jsonPath("$.chat.messages[1].outcome").value("unsafe_removed"))
                .andExpect(jsonPath("$.chat.messages[1].text").value(org.hamcrest.Matchers.startsWith("I can't suggest pesticide")));

        MODEL_ANSWER.set("{\"inScope\": true, \"answer\": \"दवा 2 ग्राम प्रति लीटर पानी में मिलाएं।\"}");
        ask(token, id, "कितनी दवा डालूं?", "hi")
                .andExpect(jsonPath("$.chat.messages[3].outcome").value("unsafe_removed"))
                .andExpect(jsonPath("$.chat.messages[3].text").value(org.hamcrest.Matchers.startsWith("मैं कीटनाशक")));
    }

    @Test
    void googleSafetyBlocksGetTheFixedReply() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token, confident("potato__late_blight", "Potato", "Late Blight", false, 2));
        MODEL_ANSWER.set(null);
        FINISH_REASON.set("SAFETY");

        ask(token, id, "something harmful", "en")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chat.messages[1].outcome").value("blocked"));
    }

    @Test
    void quotasPerScanAndPerDay() throws Exception {
        String token = register(uniqueEmail());
        Integer first = scan(token, confident("potato__late_blight", "Potato", "Late Blight", false, 2));
        for (int i = 0; i < 3; i++) {
            ask(token, first, "Question " + i, "en").andExpect(status().isOk());
        }
        ask(token, first, "One more", "en").andExpect(status().isTooManyRequests());

        Integer second = scan(token, confident("potato__late_blight", "Potato", "Late Blight", false, 2));
        ask(token, second, "Question 4", "en").andExpect(status().isOk());
        ask(token, second, "Question 5", "en").andExpect(status().isOk());
        ask(token, second, "Question 6", "en")                         // 5 per day in this test
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("today")));
    }

    @Test
    void badQuestionsAndOtherPeoplesScansAreRefusedBeforeTheModel() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token, confident("potato__late_blight", "Potato", "Late Blight", false, 2));

        ask(token, id, "   ", "en").andExpect(status().isBadRequest());
        ask(token, id, "x".repeat(301), "en").andExpect(status().isBadRequest());
        ask(register(uniqueEmail()), id, "Is this mine?", "en").andExpect(status().isNotFound());
        mvc.perform(post("/api/predictions/" + id + "/chat").contentType(MediaType.APPLICATION_JSON)
                .content("{\"question\":\"hi\"}")).andExpect(status().isUnauthorized());

        Integer notALeaf = scan(token, rejected());
        mvc.perform(get("/api/predictions/" + notALeaf + "/chat").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.chat.enabled").value(false))
                .andExpect(jsonPath("$.chat.reason").value("not_a_leaf"));
        ask(token, notALeaf, "What is this?", "en").andExpect(status().isBadRequest());
    }

    @Test
    void whenGeminiFailsTheQuestionIsNotCounted() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token, confident("potato__late_blight", "Potato", "Late Blight", false, 2));
        STATUS.set(429);

        ask(token, id, "Will it spread?", "en").andExpect(status().isServiceUnavailable());
        mvc.perform(get("/api/predictions/" + id + "/chat").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.chat.messages", hasSize(0)))
                .andExpect(jsonPath("$.chat.remainingForScan").value(3));
    }

    @Test
    void unconfirmedDiagnosesAreMarkedAsSuchForTheModel() throws Exception {
        String token = register(uniqueEmail());
        Integer id = scan(token, ambiguous());
        ask(token, id, "Should I spray?", "en").andExpect(status().isOk());
        String system = LAST_REQUEST.get().at("/systemInstruction/parts/0/text").asString();
        assertThat(system).contains("STATUS: ambiguous", "nothing is confirmed", "Other possibilities: Tomato - Late Blight");
    }
}
