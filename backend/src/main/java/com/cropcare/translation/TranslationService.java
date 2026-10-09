package com.cropcare.translation;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * English to another language, with a database cache in front of the translator:
 * Bhashini when its keys are set, otherwise the AI service's own NLLB model.
 * Never throws: if translation is unavailable the English text is returned and
 * {@link Result#applied()} is false.
 */
@Service
public class TranslationService {

    private static final Logger log = LoggerFactory.getLogger(TranslationService.class);

    /** Languages we translate into; English is the source of all stored text. */
    public static final List<String> SUPPORTED = List.of("hi");

    private final BhashiniClient bhashini;
    private final LocalTranslatorClient local;
    private final TranslationRepository repository;

    public TranslationService(BhashiniClient bhashini, LocalTranslatorClient local, TranslationRepository repository) {
        this.bhashini = bhashini;
        this.local = local;
        this.repository = repository;
    }

    /** Bhashini if it has keys, else the local model, else none (English only). */
    Translator activeTranslator() {
        if (bhashini.isAvailable()) {
            return bhashini;
        }
        return local.isAvailable() ? local : null;
    }

    /** Translations of the given texts (keyed by the English text). */
    public record Result(String language, boolean applied, String provider, Map<String, String> texts) {
        public String get(String english) {
            return english == null ? null : texts.getOrDefault(english, english);
        }

        public List<String> get(List<String> english) {
            return english == null ? null : english.stream().map(this::get).toList();
        }
    }

    /** "hi-IN,hi;q=0.9,en;q=0.8" -> "hi"; anything unsupported -> "en". */
    public static String languageOf(String acceptLanguage) {
        if (acceptLanguage == null) {
            return "en";
        }
        String first = acceptLanguage.split(",")[0].trim().toLowerCase();
        String code = first.split("[-;]")[0];
        return SUPPORTED.contains(code) ? code : "en";
    }

    public Result translate(List<String> english, String language) {
        LinkedHashSet<String> unique = english.stream()
                .filter(text -> text != null && !text.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if ("en".equals(language) || unique.isEmpty()) {
            return new Result(language, "en".equals(language), null, Map.of());
        }

        Map<String, String> hashToText = unique.stream()
                .collect(Collectors.toMap(TranslationService::sha256, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        Map<String, String> found = new LinkedHashMap<>();
        repository.findByLanguageAndSourceHashIn(language, hashToText.keySet())
                .forEach(t -> found.put(hashToText.get(t.getSourceHash()), t.getTranslatedText()));

        List<String> missing = new ArrayList<>(unique);
        missing.removeAll(found.keySet());
        boolean applied = true;
        Translator translator = activeTranslator();
        String provider = translator != null ? translator.name() : null;

        if (!missing.isEmpty()) {
            if (translator == null) {
                applied = false;
            } else {
                try {
                    List<String> translated = translator.translate(missing, "en", language);
                    for (int i = 0; i < missing.size(); i++) {
                        found.put(missing.get(i), translated.get(i));
                        save(language, missing.get(i), translated.get(i), translator.name());
                    }
                } catch (RuntimeException e) {
                    applied = false;
                    log.warn("Translation to {} by {} failed, showing English: {}", language, translator.name(), e.getMessage());
                }
            }
        }
        return new Result(language, applied, applied ? provider : null, found);
    }

    private void save(String language, String source, String translated, String provider) {
        try {
            repository.save(new Translation(language, sha256(source), source, translated, provider));
        } catch (DataIntegrityViolationException e) {
            // Another request saved the same sentence a moment ago
        }
    }

    static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
