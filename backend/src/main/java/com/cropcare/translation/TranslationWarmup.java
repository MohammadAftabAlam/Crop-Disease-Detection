package com.cropcare.translation;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.cropcare.advisory.AdvisoryService;
import com.cropcare.advisory.AdvisoryService.Context;
import com.cropcare.config.AppProperties;
import com.cropcare.disease.DiseaseDto;
import com.cropcare.disease.DiseaseService;

/**
 * At startup, translates the disease library and the advice texts into Hindi in the background,
 * so they are already in the translations table when a farmer opens a Hindi result. Without it
 * the first Hindi result waits for the translation model (about one second per sentence on a CPU).
 * Retries for a few minutes in case the AI service starts after the backend.
 */
@Component
public class TranslationWarmup {

    private static final Logger log = LoggerFactory.getLogger(TranslationWarmup.class);
    private static final int ATTEMPTS = 10;
    private static final Duration RETRY_AFTER = Duration.ofSeconds(30);

    private final boolean enabled;
    private final TranslationService translations;
    private final Localizer localizer;
    private final DiseaseService diseases;
    private final AdvisoryService advisory;

    public TranslationWarmup(AppProperties props, TranslationService translations, Localizer localizer,
            DiseaseService diseases, AdvisoryService advisory) {
        this.enabled = props.translation() == null || props.translation().warmUp();
        this.translations = translations;
        this.localizer = localizer;
        this.diseases = diseases;
        this.advisory = advisory;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (enabled && translations.activeTranslator() != null) {
            Thread thread = new Thread(this::run, "translation-warmup");
            thread.setDaemon(true);
            thread.start();
        }
    }

    void run() {
        for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
            if (warm()) {
                log.info("Hindi translations ready (disease library and advice)");
                return;
            }
            try {
                Thread.sleep(RETRY_AFTER.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        log.warn("Could not prepare Hindi translations at startup; they will be made on first use");
    }

    /** True when everything was translated (or already stored). */
    public boolean warm() {
        List<DiseaseDto> all = diseases.findAll();
        boolean ok = localizer.diseases(all, "hi").info().applied();

        // Advice built from templates: every status, and a confident result for each disease
        List<Context> contexts = new ArrayList<>(List.of(
                new Context("ambiguous", null, null, List.of(), null, null),
                new Context("unknown", null, null, List.of(), null, null),
                new Context("unknown", "no_lesions", null, List.of(), null, null),
                new Context("rejected", null, null, List.of(), null, null)));
        if (!all.isEmpty()) {
            for (String weather : new String[] { "LOW", "MEDIUM", "HIGH" }) {
                contexts.add(new Context("confident", null, all.get(0).code(), List.of(all.get(0).code()), 2, weather));
            }
        }
        for (DiseaseDto disease : all) {
            for (Integer grade : new Integer[] { 1, 2, 3 }) {
                contexts.add(new Context("confident", null, disease.code(), List.of(disease.code()), grade, null));
            }
        }
        for (Context context : contexts) {
            ok &= localizer.advice(advisory.adviceFor(context), "hi").info().applied();
        }
        return ok;
    }
}
