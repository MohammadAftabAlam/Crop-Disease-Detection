package com.cropcare.prediction;

import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.cropcare.advisory.Advice;
import com.cropcare.advisory.AdvisoryService;
import com.cropcare.ai.AiClient;
import com.cropcare.ai.AiClient.AiPrediction;
import com.cropcare.common.ApiException;
import com.cropcare.disease.DiseaseService;
import com.cropcare.translation.Localizer;
import com.cropcare.user.User;
import com.cropcare.user.UserRepository;
import com.cropcare.weather.WeatherRiskService;
import com.cropcare.weather.WeatherRiskService.Risk;

@Service
public class PredictionService {

    private static final Logger log = LoggerFactory.getLogger(PredictionService.class);
    static final int MAX_IMAGES = 5;

    private final PredictionRepository predictions;
    private final UserRepository users;
    private final AiClient aiClient;
    private final ImageStorage imageStorage;
    private final CloudinaryClient cloudinary;
    private final AdvisoryService advisoryService;
    private final WeatherRiskService weatherRiskService;
    private final DiseaseService diseaseService;
    private final Localizer localizer;

    /** A prediction plus whether its advice could be shown in the requested language. */
    public record Response(PredictionDto prediction, Localizer.Info translation) {
    }

    public PredictionService(PredictionRepository predictions, UserRepository users, AiClient aiClient,
            ImageStorage imageStorage, CloudinaryClient cloudinary, AdvisoryService advisoryService,
            WeatherRiskService weatherRiskService, DiseaseService diseaseService, Localizer localizer) {
        this.cloudinary = cloudinary;
        this.predictions = predictions;
        this.users = users;
        this.aiClient = aiClient;
        this.imageStorage = imageStorage;
        this.advisoryService = advisoryService;
        this.weatherRiskService = weatherRiskService;
        this.diseaseService = diseaseService;
        this.localizer = localizer;
    }

    /** Diagnose 1-5 photos of the same plant. Latitude/longitude are optional (used for weather risk). */
    public Response detect(Long userId, List<MultipartFile> files, Double latitude, Double longitude,
            boolean explain, String crop, String language) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found. Please login again."));
        if (files.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please upload a crop image.");
        }
        if (files.size() > MAX_IMAGES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload at most " + MAX_IMAGES + " photos at a time.");
        }
        boolean hasLocation = latitude != null && longitude != null;
        if (hasLocation) {
            WeatherRiskService.validateLocation(latitude, longitude);
        }

        List<Path> images = new ArrayList<>();
        AiPrediction result;
        try {
            for (MultipartFile file : files) {
                images.add(imageStorage.save(file));
            }
            result = aiClient.predict(images, explain, crop);
        } catch (RuntimeException e) {
            images.forEach(imageStorage::delete);
            throw e;
        }

        Prediction prediction = new Prediction();
        prediction.setUser(user);
        prediction.setStatus(result.status());
        prediction.setMessage(result.message());
        prediction.setStatusReason(result.reason());
        prediction.setSelectedCrop(result.selectedCrop());
        prediction.setClassId(result.classId());
        prediction.setCrop(result.crop());
        prediction.setDisease(result.disease());
        prediction.setHealthy(result.isHealthy());
        prediction.setConfidence(result.confidence());
        prediction.setCandidates(result.candidates() == null ? List.of() : result.candidates().stream()
                .map(c -> new PredictionCandidate(c.classId(), c.crop(), c.disease(), c.confidence()))
                .toList());
        if (result.severity() != null) {
            prediction.setSeverityPercent(result.severity().percent());
            prediction.setSeverityGrade(result.severity().grade());
            prediction.setSeverityLabel(result.severity().label());
        }
        prediction.setImageFilenames(store(images));
        if (result.perImage() != null) {
            prediction.setPhotos(result.perImage().stream()
                    .map(photo -> new PredictionPhoto(photo.index(), photo.used(),
                            photo.top() == null ? null : photo.top().classId(),
                            photo.top() == null ? null : photo.top().crop(),
                            photo.top() == null ? null : photo.top().disease(),
                            photo.top() == null ? null : photo.top().confidence(),
                            photo.severityPercent(), photo.status(), photo.reason(),
                            photo.severity() == null ? null : photo.severity().grade(),
                            photo.severity() == null ? null : photo.severity().label()))
                    .toList());
            prediction.setPhotoCandidates(result.perImage().stream()
                    .filter(photo -> photo.candidates() != null)
                    .flatMap(photo -> photo.candidates().stream()
                            .map(c -> new PredictionPhotoCandidate(photo.index(), c.classId(), c.crop(), c.disease(),
                                    c.confidence())))
                    .toList());
            prediction.setPhotosAgree(images.size() > 1 ? result.photosAgree() : null);
        }

        if (hasLocation) {
            prediction.setLatitude(latitude);
            prediction.setLongitude(longitude);
            if (result.classId() != null && !Boolean.TRUE.equals(result.isHealthy())
                    && !"rejected".equals(result.status())) {
                weatherRisk(result.classId(), latitude, longitude).ifPresent(risk -> {
                    prediction.setWeatherRiskLevel(risk.level());
                    prediction.setWeatherFavourableHours(risk.favourableHours());
                    prediction.setWeatherConditions(risk.conditions());
                });
            }
        }

        Prediction saved = predictions.save(prediction);
        return response(saved, result.explanation(), language);
    }

    @Transactional(readOnly = true)
    public List<PredictionDto> history(Long userId) {
        return predictions.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(p -> PredictionDto.from(p, null, null))
                .toList();
    }

    @Transactional(readOnly = true)
    public Response findOne(Long userId, Long predictionId, String language) {
        Prediction prediction = owned(userId, predictionId);
        return response(prediction, null, language);
    }

    /**
     * Where the analysed photos live from now on: their Cloudinary links when Cloudinary is set up
     * (the local copies are then deleted), otherwise their file names in the uploads folder.
     * If any upload fails the photos stay local, so the scan is never lost.
     */
    private List<String> store(List<Path> images) {
        List<String> local = images.stream().map(path -> path.getFileName().toString()).toList();
        if (!cloudinary.isConfigured()) {
            return local;
        }
        try {
            List<String> links = images.stream().map(cloudinary::upload).toList();
            images.forEach(imageStorage::delete);
            return links;
        } catch (RuntimeException e) {
            log.warn("Cloudinary upload failed, keeping the photos on this server: {}", e.getMessage());
            return local;
        }
    }

    /** A stored photo: either a link (Cloudinary) or a file in the uploads folder. */
    public record StoredImage(String url, Path file) {
    }

    @Transactional(readOnly = true)
    public StoredImage image(Long userId, Long predictionId, int index) {
        List<String> files = owned(userId, predictionId).getImageFilenames();
        if (index < 0 || index >= files.size()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Image not found");
        }
        String stored = files.get(index);
        return CloudinaryClient.isRemote(stored) ? new StoredImage(stored, null)
                : new StoredImage(null, imageStorage.resolve(stored));
    }

    @Transactional
    public Response feedback(Long userId, Long predictionId, FeedbackRequest request, String language) {
        Prediction prediction = owned(userId, predictionId);
        String actual = request.actualClassId() == null || request.actualClassId().isBlank()
                ? null : request.actualClassId().trim();
        if (actual != null && !"other".equals(actual) && diseaseService.findByCode(actual).isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown disease code: " + actual);
        }
        prediction.setFeedbackCorrect(request.correct());
        prediction.setFeedbackClassId(Boolean.TRUE.equals(request.correct()) ? prediction.getClassId() : actual);
        prediction.setFeedbackComment(request.comment());
        prediction.setFeedbackAt(Instant.now());
        return response(prediction, null, language);
    }

    private Response response(Prediction p, AiClient.Explanation explanation, String language) {
        Localizer.Localized<Advice> advice = localizer.advice(advice(p), language);
        // Photos of different plants: each photo also gets its own advice, for when the farmer opens one
        Map<Integer, Advice> photoAdvice = new HashMap<>();
        if (Boolean.FALSE.equals(p.getPhotosAgree())) {
            for (PredictionPhoto photo : p.getPhotos()) {
                if (Boolean.TRUE.equals(photo.getUsed())) {
                    List<String> ids = p.getPhotoCandidates().stream()
                            .filter(c -> photo.getPhotoIndex().equals(c.getPhotoIndex()))
                            .map(PredictionPhotoCandidate::getClassId).toList();
                    photoAdvice.put(photo.getPhotoIndex(), localizer.advice(advisoryService.adviceFor(
                            new AdvisoryService.Context(photo.getStatus(), photo.getReason(), photo.getClassId(), ids,
                                    photo.getSeverityGrade(), null)), language).value());
                }
            }
        }
        return new Response(PredictionDto.from(p, advice.value(), explanation, photoAdvice), advice.info());
    }

    private Prediction owned(Long userId, Long predictionId) {
        return predictions.findByIdAndUserId(predictionId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Prediction not found"));
    }

    private Advice advice(Prediction p) {
        return advisoryService.adviceFor(new AdvisoryService.Context(
                p.getStatus(), p.getStatusReason(), p.getClassId(),
                p.getCandidates().stream().map(PredictionCandidate::getClassId).toList(),
                p.getSeverityGrade(), p.getWeatherRiskLevel()));
    }

    /** Weather is a bonus: if the forecast service fails, the diagnosis still succeeds. */
    private Optional<Risk> weatherRisk(String classId, double latitude, double longitude) {
        try {
            return weatherRiskService.riskFor(classId, latitude, longitude);
        } catch (RuntimeException e) {
            log.warn("Weather risk unavailable: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
