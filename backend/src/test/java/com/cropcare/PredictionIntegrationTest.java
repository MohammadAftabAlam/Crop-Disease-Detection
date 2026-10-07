package com.cropcare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Path;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

import com.cropcare.common.ApiException;
import com.cropcare.weather.WeatherClient.Hour;
import com.jayway.jsonpath.JsonPath;

class PredictionIntegrationTest extends IntegrationTestBase {

    private static MockMultipartFile photo(String field) {
        return new MockMultipartFile(field, "leaf.png", "image/png", PNG);
    }

    private static List<Hour> hours(int count, double temperature, double humidity) {
        return Collections.nCopies(count, new Hour("2026-10-05T00:00", temperature, humidity));
    }

    private MockMultipartHttpServletRequestBuilder detect(String token) {
        return (MockMultipartHttpServletRequestBuilder) multipart("/api/predictions/detect")
                .header("Authorization", "Bearer " + token);
    }

    @Test
    void diseaseLibraryHasAllModelClassesAndSafeSearch() throws Exception {
        mvc.perform(get("/api/diseases")).andExpect(jsonPath("$.diseases", hasSize(30)));
        // Potato/Tomato early+late, maize northern leaf blight, rice bacterial leaf blight
        mvc.perform(get("/api/diseases/search").param("q", "blight")).andExpect(jsonPath("$.diseases", hasSize(6)));
        mvc.perform(get("/api/diseases/search").param("q", "(")).andExpect(jsonPath("$.diseases", hasSize(0)));
        mvc.perform(get("/api/diseases/crop/tomato")).andExpect(jsonPath("$.diseases", hasSize(10)));
        mvc.perform(get("/api/diseases/crop/wheat"))
                .andExpect(jsonPath("$.diseases", hasSize(5)))
                .andExpect(jsonPath("$.diseases[0].code").isString());
        mvc.perform(get("/api/diseases/abc")).andExpect(status().isNotFound());
    }

    @Test
    void confidentDiagnosisGetsSeverityWeatherAndAdvice() throws Exception {
        String token = register(uniqueEmail());
        given(aiClient.predict(anyList(), anyBoolean(), any()))
                .willReturn(confident("tomato__late_blight", "Tomato", "Late Blight", false, 1));
        // 30 cool, humid hours -> HIGH late blight risk
        given(weatherClient.next72Hours(anyDouble(), anyDouble())).willReturn(hours(30, 15, 95));

        mvc.perform(detect(token).file(photo("image")).param("lat", "28.47").param("lon", "77.50")
                .param("explain", "true"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.prediction.status").value("confident"))
                .andExpect(jsonPath("$.prediction.classId").value("tomato__late_blight"))
                .andExpect(jsonPath("$.prediction.severity.grade").value(1))
                .andExpect(jsonPath("$.prediction.weatherRisk.level").value("HIGH"))
                .andExpect(jsonPath("$.prediction.weatherRisk.favourableHours").value(30))
                .andExpect(jsonPath("$.prediction.advice.headline").value("Tomato: Late Blight"))
                // low severity raised one step by high weather risk
                .andExpect(jsonPath("$.prediction.advice.urgency").value("MODERATE"))
                .andExpect(jsonPath("$.prediction.advice.chemicalNote").value(containsString("CIB&RC")))
                .andExpect(jsonPath("$.prediction.advice.weatherNote").value(containsString("strongly favours")))
                .andExpect(jsonPath("$.prediction.advice.sources", hasSize(3)))
                .andExpect(jsonPath("$.prediction.explanation.heatmap").value(startsWith("data:image/png")))
                .andExpect(jsonPath("$.prediction.imageUrls", hasSize(1)))
                .andExpect(jsonPath("$.prediction.remedy").isString());

        mvc.perform(get("/api/predictions/history").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.predictions", hasSize(1)))
                .andExpect(jsonPath("$.predictions[0].advice").doesNotExist())
                .andExpect(jsonPath("$.predictions[0].explanation").doesNotExist());
    }

    @Test
    void virusIsAlwaysUrgentAndHasNoChemicalCure() throws Exception {
        String token = register(uniqueEmail());
        given(aiClient.predict(anyList(), anyBoolean(), any())).willReturn(
                confident("tomato__yellow_leaf_curl_virus", "Tomato", "Yellow Leaf Curl Virus", false, null));

        mvc.perform(detect(token).file(photo("image")))
                .andExpect(jsonPath("$.prediction.advice.urgency").value("HIGH"))
                .andExpect(jsonPath("$.prediction.advice.chemicalNote").value(startsWith("No pesticide cures")))
                .andExpect(jsonPath("$.prediction.weatherRisk").doesNotExist());
    }

    @Test
    void healthyLeafGetsNoTreatment() throws Exception {
        String token = register(uniqueEmail());
        given(aiClient.predict(anyList(), anyBoolean(), any()))
                .willReturn(confident("wheat__healthy", "Wheat", "Healthy", true, null));

        mvc.perform(detect(token).file(photo("image")))
                .andExpect(jsonPath("$.prediction.advice.urgency").value("NONE"))
                .andExpect(jsonPath("$.prediction.advice.chemicalNote").doesNotExist());
    }

    @Test
    void ambiguousAndRejectedResultsNeverRecommendSpraying() throws Exception {
        String token = register(uniqueEmail());

        given(aiClient.predict(anyList(), anyBoolean(), any())).willReturn(ambiguous());
        mvc.perform(detect(token).file(photo("image")))
                .andExpect(jsonPath("$.prediction.status").value("ambiguous"))
                .andExpect(jsonPath("$.prediction.candidates", hasSize(2)))
                .andExpect(jsonPath("$.prediction.advice.headline").value("Possibly Tomato Early Blight or Tomato Late Blight"))
                .andExpect(jsonPath("$.prediction.advice.chemicalNote").value("Do not spray until the disease is confirmed."));

        given(aiClient.predict(anyList(), anyBoolean(), any())).willReturn(rejected());
        mvc.perform(detect(token).file(photo("image")).param("lat", "28.4").param("lon", "77.5"))
                .andExpect(jsonPath("$.prediction.status").value("rejected"))
                .andExpect(jsonPath("$.prediction.classId").doesNotExist())
                .andExpect(jsonPath("$.prediction.weatherRisk").doesNotExist())
                .andExpect(jsonPath("$.prediction.advice.immediateActions[0]").value(startsWith("Photograph one affected leaf")));
    }

    @SuppressWarnings("unchecked")
    @Test
    void multiplePhotosAreSentTogetherAndCanBeViewedLater() throws Exception {
        String token = register(uniqueEmail());
        given(aiClient.predict(anyList(), anyBoolean(), any()))
                .willReturn(confident("potato__early_blight", "Potato", "Early Blight", false, 2));

        String body = mvc.perform(detect(token).file(photo("images")).file(photo("images")).file(photo("images")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.prediction.imageUrls", hasSize(3)))
                .andReturn().getResponse().getContentAsString();

        ArgumentCaptor<List<Path>> sent = ArgumentCaptor.forClass(List.class);
        verify(aiClient).predict(sent.capture(), anyBoolean(), any());
        assertThat(sent.getValue()).hasSize(3);

        String imageUrl = JsonPath.read(body, "$.prediction.imageUrls[2]");
        mvc.perform(get(imageUrl).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG));

        String stranger = register(uniqueEmail());
        mvc.perform(get(imageUrl).header("Authorization", "Bearer " + stranger)).andExpect(status().isNotFound());
        mvc.perform(get(imageUrl.replace("/images/2", "/images/9")).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void uploadLimitsAndAiOutage() throws Exception {
        String token = register(uniqueEmail());

        var tooMany = detect(token);
        for (int i = 0; i < 6; i++) {
            tooMany.file(photo("images"));
        }
        mvc.perform(tooMany).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Upload at most 5 photos at a time."));

        mvc.perform(detect(token).file(new MockMultipartFile("image", "leaf.png", "image/png", "hello".getBytes())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only JPG, PNG and WEBP images are allowed."));

        mvc.perform(detect(token)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please upload a crop image."));

        mvc.perform(detect(token).file(photo("image")).param("lat", "123").param("lon", "77"))
                .andExpect(status().isBadRequest());

        given(aiClient.predict(anyList(), anyBoolean(), any()))
                .willThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI down"));
        mvc.perform(detect(token).file(photo("image")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("AI down"));
    }

    @Test
    void weatherFailureDoesNotBreakDiagnosis() throws Exception {
        String token = register(uniqueEmail());
        given(aiClient.predict(anyList(), anyBoolean(), any()))
                .willReturn(confident("rice__leaf_blast", "Rice", "Leaf Blast", false, 3));
        given(weatherClient.next72Hours(anyDouble(), anyDouble()))
                .willThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Weather down"));

        mvc.perform(detect(token).file(photo("image")).param("lat", "26.8").param("lon", "80.9"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.prediction.weatherRisk").doesNotExist())
                .andExpect(jsonPath("$.prediction.advice.urgency").value("HIGH"));
    }

    @Test
    void feedbackIsStoredAndValidated() throws Exception {
        String token = register(uniqueEmail());
        given(aiClient.predict(anyList(), anyBoolean(), any()))
                .willReturn(confident("tomato__late_blight", "Tomato", "Late Blight", false, 1));
        String body = mvc.perform(detect(token).file(photo("image"))).andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(body, "$.prediction.id");

        mvc.perform(post("/api/predictions/" + id + "/feedback").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"correct": false, "actualClassId": "tomato__early_blight", "comment": "Expert said early blight"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prediction.feedback.correct").value(false))
                .andExpect(jsonPath("$.prediction.feedback.actualClassId").value("tomato__early_blight"));

        mvc.perform(post("/api/predictions/" + id + "/feedback").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"correct": false, "actualClassId": "banana__panama"}"""))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/predictions/" + id + "/feedback").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void weatherRiskForACrop() throws Exception {
        String token = register(uniqueEmail());
        // Warm and humid: favours early blight (20-30 °C, >=80%) but not late blight (needs >=90% and <=25 °C)
        given(weatherClient.next72Hours(anyDouble(), anyDouble())).willReturn(hours(72, 27, 85));

        mvc.perform(get("/api/weather/risk").param("crop", "potato").param("lat", "28.4").param("lon", "77.5")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.risks", hasSize(2)))
                .andExpect(jsonPath("$.risks[0].code").value("potato__early_blight"))
                .andExpect(jsonPath("$.risks[0].level").value("HIGH"))
                .andExpect(jsonPath("$.risks[1].level").value("LOW"));

        mvc.perform(get("/api/weather/risk").param("crop", "banana").param("lat", "28.4").param("lon", "77.5")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void cropChoiceIsSentToTheAiAndNoLesionResultsGetPestAdvice() throws Exception {
        String token = register(uniqueEmail());
        given(aiClient.predict(anyList(), anyBoolean(), any())).willReturn(noLesions());

        mvc.perform(detect(token).file(photo("image")).param("crop", "maize"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.prediction.status").value("unknown"))
                .andExpect(jsonPath("$.prediction.reason").value("no_lesions"))
                .andExpect(jsonPath("$.prediction.selectedCrop").value("maize"))
                .andExpect(jsonPath("$.prediction.advice.headline").value("No disease spots found"))
                .andExpect(jsonPath("$.prediction.advice.chemicalNote").value(startsWith("Do not spray a fungicide")))
                .andExpect(jsonPath("$.prediction.advice.immediateActions[0]").value(containsString("caterpillars")));

        verify(aiClient).predict(anyList(), anyBoolean(), org.mockito.ArgumentMatchers.eq("maize"));
    }
}
