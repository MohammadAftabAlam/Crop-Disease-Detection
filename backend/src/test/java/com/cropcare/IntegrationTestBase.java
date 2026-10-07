package com.cropcare;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.cropcare.ai.AiClient;
import com.cropcare.ai.AiClient.AiPrediction;
import com.cropcare.ai.AiClient.Candidate;
import com.cropcare.ai.AiClient.Explanation;
import com.cropcare.ai.AiClient.Severity;
import com.cropcare.weather.WeatherClient;
import com.jayway.jsonpath.JsonPath;

/** Shared setup: H2 database, and fakes for the AI service and the weather API. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class IntegrationTestBase {

    static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0 };
    static final String PASSWORD = "Leaf@1234";

    @Autowired
    MockMvc mvc;

    @MockitoBean
    AiClient aiClient;

    @MockitoBean
    WeatherClient weatherClient;

    String register(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Test Farmer","email":"%s","password":"%s"}""".formatted(email, PASSWORD)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    static String uniqueEmail() {
        return "farmer-" + UUID.randomUUID() + "@example.com";
    }

    static AiPrediction confident(String classId, String crop, String disease, boolean healthy, Integer severityGrade) {
        Severity severity = severityGrade == null ? null : new Severity(8.5, severityGrade, "Low", true);
        return new AiPrediction(true, "confident", crop + ": " + disease + ".", classId, crop, disease, healthy, 96.4,
                List.of(new Candidate(classId, crop, disease, healthy, 96.4)), severity,
                new Explanation(0, "data:image/png;base64,AAAA", null), 1, 1);
    }

    static AiPrediction ambiguous() {
        return new AiPrediction(true, "ambiguous", "Not sure between two diseases.", "tomato__early_blight", "Tomato",
                "Early Blight", false, 51.0,
                List.of(new Candidate("tomato__early_blight", "Tomato", "Early Blight", false, 51.0),
                        new Candidate("tomato__late_blight", "Tomato", "Late Blight", false, 40.0)),
                null, null, 1, 1);
    }

    static AiPrediction rejected() {
        return new AiPrediction(true, "rejected", "This does not look like a leaf of a supported crop.", null, null,
                null, null, null, List.of(), null, null, 1, 0);
    }
}
