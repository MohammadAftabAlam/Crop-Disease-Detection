package com.cropcare.disease;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.json.JsonMapper;

/**
 * Keeps the diseases table in sync with resources/seed/diseases.json on every start:
 * new entries are inserted and existing ones (matched by code) are updated, so edits
 * to the knowledge base reach the database without wiping it.
 */
@Component
public class DiseaseSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DiseaseSeeder.class);

    private final DiseaseRepository diseases;
    private final JsonMapper jsonMapper;

    public DiseaseSeeder(DiseaseRepository diseases, JsonMapper jsonMapper) {
        this.diseases = diseases;
        this.jsonMapper = jsonMapper;
    }

    record ChemicalSeed(String activeIngredient, String dose, Integer waitingPeriodDays, String note, String source) {
    }

    record SourceSeed(String title, String url) {
    }

    record DiseaseSeed(String code, String crop, String diseaseName, String description, String pathogen,
            String favourableConditions, List<String> symptoms, List<String> causes, List<String> remedies,
            List<String> prevention, List<String> organicControl, List<ChemicalSeed> chemicalControl,
            List<SourceSeed> sources) {
    }

    @Override
    @Transactional
    public void run(String... args) throws IOException {
        DiseaseSeed[] seeds;
        try (InputStream in = new ClassPathResource("seed/diseases.json").getInputStream()) {
            seeds = jsonMapper.readValue(in, DiseaseSeed[].class);
        }

        int inserted = 0;
        for (DiseaseSeed seed : seeds) {
            Disease disease = diseases.findByCode(seed.code())
                    // rows created before codes existed
                    .or(() -> diseases.findFirstByCropIgnoreCaseAndDiseaseNameIgnoreCase(seed.crop(), seed.diseaseName()))
                    .orElse(null);
            if (disease == null) {
                disease = new Disease();
                inserted++;
            }
            apply(seed, disease);
            diseases.save(disease);
        }
        log.info("Disease library: {} entries ({} new)", seeds.length, inserted);
    }

    private static void apply(DiseaseSeed seed, Disease disease) {
        disease.setCode(seed.code());
        disease.setCrop(seed.crop());
        disease.setDiseaseName(seed.diseaseName());
        disease.setDescription(seed.description());
        disease.setPathogen(seed.pathogen());
        disease.setFavourableConditions(seed.favourableConditions());
        disease.setSymptoms(orEmpty(seed.symptoms()));
        disease.setCauses(orEmpty(seed.causes()));
        disease.setRemedies(orEmpty(seed.remedies()));
        disease.setPrevention(orEmpty(seed.prevention()));
        disease.setOrganicControl(orEmpty(seed.organicControl()));
        disease.setChemicalControl(orEmpty(seed.chemicalControl()).stream().map(c -> {
            ChemicalOption option = new ChemicalOption();
            option.setActiveIngredient(c.activeIngredient());
            option.setDose(c.dose());
            option.setWaitingPeriodDays(c.waitingPeriodDays());
            option.setNote(c.note());
            option.setSource(c.source());
            return option;
        }).toList());
        disease.setSources(orEmpty(seed.sources()).stream().map(s -> {
            SourceRef ref = new SourceRef();
            ref.setTitle(s.title());
            ref.setUrl(s.url());
            return ref;
        }).toList());
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }
}
