package com.cropcare.translation;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Component;

import com.cropcare.advisory.Advice;
import com.cropcare.disease.DiseaseDto;
import com.cropcare.translation.TranslationService.Result;

/**
 * Translates the English text of advice and disease entries in one batch per response.
 * Names (crop, disease, pathogen, source titles) are left as they are: the app shows its
 * own reviewed Hindi names for those.
 */
@Component
public class Localizer {

    private final TranslationService translations;

    public Localizer(TranslationService translations) {
        this.translations = translations;
    }

    /** What the client asked for and whether it was applied. */
    public record Info(String requested, boolean applied, String provider) {
        public Map<String, Object> asMap() {
            return Map.of("language", requested, "applied", applied, "provider", provider == null ? "" : provider);
        }
    }

    public static Info english() {
        return new Info("en", true, null);
    }

    public record Localized<T>(T value, Info info) {
    }

    public Localized<Advice> advice(Advice advice, String language) {
        if (advice == null || "en".equals(language)) {
            return new Localized<>(advice, english());
        }
        Result r = translations.translate(texts(advice), language);
        Advice translated = new Advice(advice.headline(), advice.urgency(), r.get(advice.urgencyText()),
                r.get(advice.immediateActions()), r.get(advice.organicOptions()), chemicals(advice.chemicalOptions(), r),
                r.get(advice.chemicalNote()), r.get(advice.prevention()), r.get(advice.weatherNote()),
                r.get(advice.whenToGetHelp()), advice.sources(), r.get(advice.disclaimer()));
        return new Localized<>(translated, info(r));
    }

    public Localized<List<DiseaseDto>> diseases(List<DiseaseDto> diseases, String language) {
        if ("en".equals(language) || diseases.isEmpty()) {
            return new Localized<>(diseases, english());
        }
        List<String> all = new ArrayList<>();
        diseases.forEach(d -> all.addAll(texts(d)));
        Result r = translations.translate(all, language);
        return new Localized<>(diseases.stream().map(d -> disease(d, r)).toList(), info(r));
    }

    public Localized<DiseaseDto> disease(DiseaseDto disease, String language) {
        Localized<List<DiseaseDto>> list = diseases(List.of(disease), language);
        return new Localized<>(list.value().get(0), list.info());
    }

    private static Info info(Result r) {
        return new Info(r.language(), r.applied(), r.provider());
    }

    private static DiseaseDto disease(DiseaseDto d, Result r) {
        return new DiseaseDto(d.id(), d.code(), d.crop(), d.diseaseName(), r.get(d.description()), d.pathogen(),
                r.get(d.favourableConditions()), r.get(d.symptoms()), r.get(d.causes()), r.get(d.remedies()),
                r.get(d.prevention()), r.get(d.organicControl()), chemicals(d.chemicalControl(), r), d.sources());
    }

    private static List<DiseaseDto.Chemical> chemicals(List<DiseaseDto.Chemical> chemicals, Result r) {
        // Ingredient names and doses stay exactly as registered; only the free-text note is translated
        return chemicals.stream()
                .map(c -> new DiseaseDto.Chemical(c.activeIngredient(), c.dose(), c.waitingPeriodDays(), r.get(c.note()), c.source()))
                .toList();
    }

    private static List<String> texts(Advice a) {
        List<String> texts = new ArrayList<>();
        texts.add(a.urgencyText());
        texts.addAll(a.immediateActions());
        texts.addAll(a.organicOptions());
        texts.add(a.chemicalNote());
        texts.addAll(a.prevention());
        texts.add(a.weatherNote());
        texts.add(a.whenToGetHelp());
        texts.add(a.disclaimer());
        a.chemicalOptions().forEach(c -> texts.add(c.note()));
        return texts.stream().filter(Objects::nonNull).toList();
    }

    private static List<String> texts(DiseaseDto d) {
        List<String> texts = new ArrayList<>();
        texts.add(d.description());
        texts.add(d.favourableConditions());
        texts.addAll(d.symptoms());
        texts.addAll(d.causes());
        texts.addAll(d.remedies());
        texts.addAll(d.prevention());
        texts.addAll(d.organicControl());
        d.chemicalControl().forEach(c -> texts.add(c.note()));
        return texts.stream().filter(Objects::nonNull).toList();
    }
}
