package com.cropcare.disease;

import java.util.List;

public record DiseaseDto(
        Long id,
        String code,
        String crop,
        String diseaseName,
        String description,
        String pathogen,
        String favourableConditions,
        List<String> symptoms,
        List<String> causes,
        List<String> remedies,
        List<String> prevention,
        List<String> organicControl,
        List<Chemical> chemicalControl,
        List<Source> sources) {

    public record Chemical(String activeIngredient, String dose, Integer waitingPeriodDays, String note, String source) {
    }

    public record Source(String title, String url) {
    }

    public boolean isHealthy() {
        return "Healthy".equalsIgnoreCase(diseaseName);
    }

    static DiseaseDto from(Disease disease) {
        return new DiseaseDto(
                disease.getId(),
                disease.getCode(),
                disease.getCrop(),
                disease.getDiseaseName(),
                disease.getDescription(),
                disease.getPathogen(),
                disease.getFavourableConditions(),
                List.copyOf(disease.getSymptoms()),
                List.copyOf(disease.getCauses()),
                List.copyOf(disease.getRemedies()),
                List.copyOf(disease.getPrevention()),
                List.copyOf(disease.getOrganicControl()),
                disease.getChemicalControl().stream()
                        .map(c -> new Chemical(c.getActiveIngredient(), c.getDose(), c.getWaitingPeriodDays(), c.getNote(),
                                c.getSource()))
                        .toList(),
                disease.getSources().stream().map(s -> new Source(s.getTitle(), s.getUrl())).toList());
    }
}
