package com.cropcare.prediction;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.cropcare.auth.JwtService;
import com.cropcare.translation.TranslationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/predictions")
public class PredictionController {

    private final PredictionService predictionService;

    public PredictionController(PredictionService predictionService) {
        this.predictionService = predictionService;
    }

    /**
     * Multipart: "images" (1-5 photos of one plant) and/or "image" (one photo, for older clients).
     * Optional: lat, lon (weather risk), explain=true (Grad-CAM heat map + lesion overlay),
     * crop=rice (the farmer's crop: the model then chooses only among that crop's diseases).
     */
    @PostMapping(path = "/detect", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> detect(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "images", required = false) List<MultipartFile> images,
            @RequestParam(name = "image", required = false) MultipartFile image,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon,
            @RequestParam(defaultValue = "false") boolean explain,
            @RequestParam(required = false) String crop,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage) {
        List<MultipartFile> files = new ArrayList<>();
        if (images != null) {
            images.stream().filter(file -> !file.isEmpty()).forEach(files::add);
        }
        if (image != null && !image.isEmpty()) {
            files.add(image);
        }
        PredictionService.Response result = predictionService.detect(JwtService.userId(jwt), files, lat, lon, explain,
                crop, TranslationService.languageOf(acceptLanguage));
        PredictionDto prediction = result.prediction();
        return Map.of("success", true, "message", prediction.message() == null ? "Analysis complete." : prediction.message(),
                "prediction", prediction, "translation", result.translation().asMap());
    }

    @GetMapping("/history")
    public Map<String, Object> history(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("success", true, "predictions", predictionService.history(JwtService.userId(jwt)));
    }

    @GetMapping("/{id}")
    public Map<String, Object> getOne(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage) {
        PredictionService.Response result = predictionService.findOne(JwtService.userId(jwt), id,
                TranslationService.languageOf(acceptLanguage));
        return Map.of("success", true, "prediction", result.prediction(), "translation", result.translation().asMap());
    }

    @GetMapping("/{id}/images/{index}")
    public ResponseEntity<Resource> image(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @PathVariable int index) {
        Path path = predictionService.image(JwtService.userId(jwt), id, index);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(ImageStorage.contentType(path)))
                .cacheControl(CacheControl.noCache().cachePrivate())
                .body(new FileSystemResource(path));
    }

    @PostMapping("/{id}/feedback")
    public Map<String, Object> feedback(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody FeedbackRequest request,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage) {
        PredictionService.Response result = predictionService.feedback(JwtService.userId(jwt), id, request,
                TranslationService.languageOf(acceptLanguage));
        return Map.of("success", true, "message", "Thank you for the feedback.", "prediction", result.prediction(),
                "translation", result.translation().asMap());
    }
}
