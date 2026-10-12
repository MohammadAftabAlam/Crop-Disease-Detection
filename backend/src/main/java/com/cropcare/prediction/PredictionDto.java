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
        String reason,
        String selectedCrop,
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
        /** Each photo's own answer (empty for scans made before this was stored) */
        List<Photo> photos,
        /** false: the photos point to different problems; null: one photo */
        Boolean photosAgree,
        Instant createdAt) {

    /**
     * One photo's own result. status / candidates / severity are its answer on its own; advice is only
     * filled when the photos disagree (different plants), so each photo can be opened separately.
     */
    public record Photo(Integer index, Boolean used, String classId, String crop, String disease, Double confidence,
            Double severityPercent, String imageUrl, String status, String reason, Severity severity,
            List<Candidate> candidates, Advice advice) {
    }

    public record Candidate(String classId, String crop, String disease, Double confidence) {
    }

    public record Severity(Double percent, Integer grade, String label) {
    }

    public record WeatherRisk(String level, Integer favourableHours, String conditions) {
    }

    public record Feedback(Boolean correct, String actualClassId, String comment, Instant at) {
    }

    static PredictionDto from(Prediction p, Advice advice, Explanation explanation) {
        return from(p, advice, explanation, java.util.Map.of());
    }

    static PredictionDto from(Prediction p, Advice advice, Explanation explanation,
            java.util.Map<Integer, Advice> photoAdvice) {
        // Cloudinary photos are given as their https link; photos on this server through the API
        List<String> imageUrls = IntStream.range(0, p.getImageFilenames().size())
                .mapToObj(i -> CloudinaryClient.isRemote(p.getImageFilenames().get(i)) ? p.getImageFilenames().get(i)
                        : "/api/predictions/" + p.getId() + "/images/" + i)
                .toList();
        Severity severity = p.getSeverityPercent() == null ? null
                : new Severity(p.getSeverityPercent(), p.getSeverityGrade(), p.getSeverityLabel());
        WeatherRisk weather = p.getWeatherRiskLevel() == null ? null
                : new WeatherRisk(p.getWeatherRiskLevel(), p.getWeatherFavourableHours(), p.getWeatherConditions());
        Feedback feedback = p.getFeedbackAt() == null ? null
                : new Feedback(p.getFeedbackCorrect(), p.getFeedbackClassId(), p.getFeedbackComment(), p.getFeedbackAt());

        return new PredictionDto(
                p.getId(), p.getStatus(), p.getStatusReason(), p.getSelectedCrop(), p.getMessage(), p.getClassId(), p.getCrop(), p.getDisease(), p.getHealthy(),
                p.getConfidence(),
                p.getCandidates().stream()
                        .map(c -> new Candidate(c.getClassId(), c.getCrop(), c.getDisease(), c.getConfidence()))
                        .toList(),
                severity, weather, imageUrls, advice, summary(advice), feedback, explanation,
                p.getPhotos().stream()
                        .map(ph -> new Photo(ph.getPhotoIndex(), ph.getUsed(), ph.getClassId(), ph.getCrop(),
                                ph.getDisease(), ph.getConfidence(), ph.getSeverityPercent(),
                                ph.getPhotoIndex() != null && ph.getPhotoIndex() < imageUrls.size()
                                        ? imageUrls.get(ph.getPhotoIndex()) : null,
                                ph.getStatus(), ph.getReason(),
                                ph.getSeverityPercent() == null || ph.getSeverityGrade() == null ? null
                                        : new Severity(ph.getSeverityPercent(), ph.getSeverityGrade(), ph.getSeverityLabel()),
                                p.getPhotoCandidates().stream()
                                        .filter(c -> c.getPhotoIndex() != null && c.getPhotoIndex().equals(ph.getPhotoIndex()))
                                        .map(c -> new Candidate(c.getClassId(), c.getCrop(), c.getDisease(), c.getConfidence()))
                                        .toList(),
                                photoAdvice.get(ph.getPhotoIndex())))
                        .toList(),
                p.getPhotosAgree(), p.getCreatedAt());
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
