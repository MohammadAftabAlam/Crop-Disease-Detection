package com.cropcare.disease;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cropcare.translation.Localizer;
import com.cropcare.translation.TranslationService;

/** The disease library. Text is translated when the client sends Accept-Language: hi. */
@RestController
@RequestMapping("/api/diseases")
public class DiseaseController {

    private static final String LANGUAGE_HEADER = "Accept-Language";

    private final DiseaseService diseaseService;
    private final Localizer localizer;

    public DiseaseController(DiseaseService diseaseService, Localizer localizer) {
        this.diseaseService = diseaseService;
        this.localizer = localizer;
    }

    @GetMapping
    public Map<String, Object> getAll(@RequestHeader(name = LANGUAGE_HEADER, required = false) String language) {
        return list(diseaseService.findAll(), language);
    }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(name = "q", required = false) String query,
            @RequestHeader(name = LANGUAGE_HEADER, required = false) String language) {
        return list(diseaseService.search(query), language);
    }

    @GetMapping("/crop/{crop}")
    public Map<String, Object> getByCrop(@PathVariable String crop,
            @RequestHeader(name = LANGUAGE_HEADER, required = false) String language) {
        return list(diseaseService.findByCrop(crop), language);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getById(@PathVariable Long id,
            @RequestHeader(name = LANGUAGE_HEADER, required = false) String language) {
        Localizer.Localized<DiseaseDto> disease = localizer.disease(diseaseService.findById(id),
                TranslationService.languageOf(language));
        return Map.of("success", true, "disease", disease.value(), "translation", disease.info().asMap());
    }

    private Map<String, Object> list(List<DiseaseDto> diseases, String language) {
        Localizer.Localized<List<DiseaseDto>> localized = localizer.diseases(diseases, TranslationService.languageOf(language));
        return Map.of("success", true, "diseases", localized.value(), "translation", localized.info().asMap());
    }
}
