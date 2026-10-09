package com.cropcare.ai;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.cropcare.common.ApiException;
import com.cropcare.config.AppProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Talks to the Python AI service (ai-service, FastAPI). */
@Component
public class AiClient {

    private static final String NOT_RUNNING = "The AI service is not running. Start it from the ai-service folder with: python -m cropcare_ai.api.main";

    private final RestClient restClient;

    public AiClient(AppProperties props) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        // Grad-CAM + severity on CPU for 5 photos can take a while
        requestFactory.setReadTimeout(Duration.ofSeconds(120));

        this.restClient = RestClient.builder()
                .baseUrl(props.aiServiceUrl())
                .requestFactory(requestFactory)
                .build();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Candidate(String classId, String crop, String disease, Boolean isHealthy, Double confidence) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Severity(Double percent, Integer grade, String label, Boolean leafAreaFound) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Explanation(Integer imageIndex, String heatmap, String lesions) {
    }

    /**
     * Result of /predict. {@code status} is confident | ambiguous | unknown | rejected.
     * For "rejected" the class fields are null.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiPrediction(
            boolean success,
            String status,
            String message,
            String classId,
            String crop,
            String disease,
            Boolean isHealthy,
            Double confidence,
            List<Candidate> candidates,
            Severity severity,
            Explanation explanation,
            Integer imagesReceived,
            Integer imagesUsed,
            String selectedCrop,
            /** Why the status is what it is, e.g. "no_lesions" when the lesion cross-check fired */
            String reason) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record AiError(String message) {
    }

    public AiPrediction predict(List<Path> images, boolean explain) {
        return predict(images, explain, null);
    }

    /** crop = the farmer's crop ("rice"), or null to let the model consider every crop. */
    public AiPrediction predict(List<Path> images, boolean explain, String crop) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        images.forEach(image -> form.add("images", new FileSystemResource(image)));

        try {
            AiPrediction result = restClient.post()
                    .uri(uri -> {
                        uri.path("/predict").queryParam("explain", explain);
                        if (crop != null && !crop.isBlank()) {
                            uri.queryParam("crop", crop);
                        }
                        return uri.build();
                    })
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(form)
                    .retrieve()
                    .body(AiPrediction.class);

            if (result == null || !result.success() || result.status() == null) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI service could not analyze this image.");
            }
            return result;
        } catch (HttpClientErrorException e) {
            // 4xx from the AI service, e.g. the file is not a readable image
            throw new ApiException(HttpStatus.BAD_REQUEST, messageOf(e.getResponseBodyAs(AiError.class),
                    "The image could not be analyzed."));
        } catch (HttpServerErrorException.ServiceUnavailable e) {
            // AI service is up but has no trained model yet
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, messageOf(e.getResponseBodyAs(AiError.class), NOT_RUNNING));
        } catch (ResourceAccessException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, NOT_RUNNING);
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI service returned an error.");
        }
    }

    /** Classes, calibration and measured test metrics of the deployed model. */
    public Map<String, Object> modelInfo() {
        try {
            return restClient.get()
                    .uri("/model-info")
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {
                    });
        } catch (ResourceAccessException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, NOT_RUNNING);
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI service returned an error.");
        }
    }

    private static String messageOf(AiError error, String fallback) {
        return error != null && error.message() != null ? error.message() : fallback;
    }
}
