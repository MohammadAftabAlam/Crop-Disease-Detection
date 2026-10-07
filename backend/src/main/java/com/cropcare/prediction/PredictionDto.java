package com.cropcare.prediction;

import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;

import com.cropcare.advisory.Advice;
import com.cropcare.ai.AiClient.Explanation;

/**
 * A diagnosis as the frontend sees it. {@code advice} is filled for single-prediction
 * responses and left null in the history list; {@code explanation} (Grad-CAM images)
 * is only returned right after detection and is not stored.
 */
public record PredictionDto(
        Long id,
        String status,
        String message,
        String classId,
        String crop,
        String disease,
        Boolean isHealthy,
        Double confidence,
        List<Candidate> candidates,
        Severity severity,
        WeatherRisk weatherRisk,
        List<String> imageUrls,
        Advice advice,
        String remedy,
        Feedback feedback,
        Explanation explanation,
        Instant createdAt) {

    public record Candidate(String classId, String crop, String disease, Double confidence) {
    }

    public record Severity(Double percent, Integer grade, String label) {
    }

    public record WeatherRisk(String level, Integer favourableHours, String conditions) {
    }

    public record Feedback(Boolean correct, String actualClassId, String comment, Instant at) {
    }

    static PredictionDto from(Prediction p, Advice advice, Explanation explanation) {
        List<String> imageUrls = IntStream.range(0, p.getImageFilenames().size())
                .mapToObj(i -> "/api/predictions/" + p.getId() + "/images/" + i)
                .toList();
        Severity severity = p.getSeverityPercent() == null ? null
                : new Severity(p.getSeverityPercent(), p.getSeverityGrade(), p.getSeverityLabel());
        WeatherRisk weather = p.getWeatherRiskLevel() == null ? null
                : new WeatherRisk(p.getWeatherRiskLevel(), p.getWeatherFavourableHours(), p.getWeatherConditions());
        Feedback feedback = p.getFeedbackAt() == null ? null
                : new Feedback(p.getFeedbackCorrect(), p.getFeedbackClassId(), p.getFeedbackComment(), p.getFeedbackAt());

        return new PredictionDto(
                p.getId(), p.getStatus(), p.getMessage(), p.getClassId(), p.getCrop(), p.getDisease(), p.getHealthy(),
                p.getConfidence(),
                p.getCandidates().stream()
                        .map(c -> new Candidate(c.getClassId(), c.getCrop(), c.getDisease(), c.getConfidence()))
                        .toList(),
                severity, weather, imageUrls, advice, summary(advice), feedback, explanation, p.getCreatedAt());
    }

    /** One-paragraph version of the advice (kept for the current frontend's "remedy" field). */
    private static String summary(Advice advice) {
        if (advice == null) {
            return null;
        }
        List<String> steps = advice.immediateActions().stream()
                .map(s -> s.trim().endsWith(".") ? s.trim() : s.trim() + ".")
                .toList();
        return String.join(" ", steps.isEmpty() ? List.of(advice.whenToGetHelp()) : steps);
    }
}
