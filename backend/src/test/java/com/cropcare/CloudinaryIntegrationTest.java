package com.cropcare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

/**
 * Photos go to Cloudinary (here a fake of its signed upload API) instead of the uploads folder;
 * if Cloudinary fails, they stay on the server so the scan still works.
 */
class CloudinaryIntegrationTest extends IntegrationTestBase {

    static final HttpServer FAKE;
    static final AtomicInteger UPLOADS = new AtomicInteger();
    static final AtomicBoolean DOWN = new AtomicBoolean(false);
    static final List<String> PROBLEMS = new ArrayList<>();
    static final Path UPLOAD_DIR = Path.of("target/test-uploads");

    static {
        try {
            FAKE = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        FAKE.createContext("/v1_1/test-cloud/image/upload", CloudinaryIntegrationTest::upload);
        FAKE.start();
    }

    @DynamicPropertySource
    static void cloudinary(DynamicPropertyRegistry registry) {
        registry.add("app.cloudinary.cloud-name", () -> "test-cloud");
        registry.add("app.cloudinary.api-key", () -> "test-key");
        registry.add("app.cloudinary.api-secret", () -> "test-secret");
        registry.add("app.cloudinary.api-url", () -> "http://127.0.0.1:" + FAKE.getAddress().getPort() + "/v1_1");
    }

    @AfterAll
    static void stop() {
        FAKE.stop(0);
    }

    @BeforeEach
    void reset() {
        DOWN.set(false);
        PROBLEMS.clear();
    }

    private static String field(String body, String name) {
        Matcher m = Pattern.compile("name=\"" + name + "\"\\r\\n(?:[^\\r\\n]+\\r\\n)*\\r\\n([^\\r\\n]*)").matcher(body);
        return m.find() ? m.group(1) : null;
    }

    private static void upload(HttpExchange exchange) throws IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.ISO_8859_1);
        if (DOWN.get()) {
            reply(exchange, 500, "{\"error\":{\"message\":\"down\"}}");
            return;
        }
        String folder = field(body, "folder");
        String publicId = field(body, "public_id");
        String timestamp = field(body, "timestamp");
        try {
            String expected = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(
                    ("folder=" + folder + "&public_id=" + publicId + "&timestamp=" + timestamp + "test-secret")
                            .getBytes(StandardCharsets.UTF_8)));
            if (!expected.equals(field(body, "signature"))) {
                PROBLEMS.add("wrong signature");
            }
        } catch (Exception e) {
            PROBLEMS.add(e.toString());
        }
        if (!"test-key".equals(field(body, "api_key"))) {
            PROBLEMS.add("missing api_key");
        }
        if (!body.contains("name=\"file\"") || !body.contains("PNG")) {
            PROBLEMS.add("no image file in the upload");
        }
        UPLOADS.incrementAndGet();
        reply(exchange, 200, "{\"public_id\":\"" + folder + "/" + publicId + "\",\"secure_url\":"
                + "\"https://res.cloudinary.com/test-cloud/image/upload/v1/" + folder + "/" + publicId + ".png\"}");
    }

    private static void reply(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static long localFiles() throws IOException {
        if (!Files.isDirectory(UPLOAD_DIR)) {
            return 0;
        }
        try (Stream<Path> files = Files.list(UPLOAD_DIR)) {
            return files.count();
        }
    }

    private String scan(String token, int photos) throws Exception {
        given(aiClient.predict(anyList(), anyBoolean(), any()))
                .willReturn(confident("potato__late_blight", "Potato", "Late Blight", false, 2));
        var request = multipart("/api/predictions/detect");
        for (int i = 0; i < photos; i++) {
            request.file(new MockMultipartFile("images", "leaf.png", "image/png", PNG));
        }
        return mvc.perform(request.header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void photosAreStoredOnCloudinaryAndNotOnTheServer() throws Exception {
        String token = register(uniqueEmail());
        long before = localFiles();
        int uploadsBefore = UPLOADS.get();

        String body = scan(token, 2);
        Integer id = JsonPath.read(body, "$.prediction.id");
        String first = JsonPath.read(body, "$.prediction.imageUrls[0]");
        String second = JsonPath.read(body, "$.prediction.imageUrls[1]");

        assertThat(first).startsWith("https://res.cloudinary.com/test-cloud/image/upload/v1/cropcare/scans/");
        assertThat(second).startsWith("https://res.cloudinary.com/").isNotEqualTo(first);   // random names
        assertThat(UPLOADS.get() - uploadsBefore).isEqualTo(2);
        assertThat(localFiles()).isEqualTo(before);                                         // local copies deleted
        assertThat(PROBLEMS).isEmpty();

        // The link is saved with the scan, and the old image endpoint redirects to it
        mvc.perform(get("/api/predictions/" + id).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.prediction.imageUrls[0]").value(first));
        mvc.perform(get("/api/predictions/" + id + "/images/0").header("Authorization", "Bearer " + token))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", first));
    }

    @Test
    void whenCloudinaryFailsThePhotosStayOnTheServer() throws Exception {
        String token = register(uniqueEmail());
        DOWN.set(true);

        String body = scan(token, 1);
        Integer id = JsonPath.read(body, "$.prediction.id");
        mvc.perform(get("/api/predictions/" + id).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.prediction.imageUrls[0]").value(startsWith("/api/predictions/" + id + "/images/0")));
        mvc.perform(get("/api/predictions/" + id + "/images/0").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));
    }
}
