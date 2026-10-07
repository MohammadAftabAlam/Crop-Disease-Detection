package com.cropcare.advisory;

import java.util.List;

import com.cropcare.disease.DiseaseDto;

/**
 * What the farmer should do, built from templates and the disease library (no LLM).
 *
 * @param urgency NONE | LOW | MODERATE | HIGH | UNKNOWN
 */
public record Advice(
        String headline,
        String urgency,
        String urgencyText,
        List<String> immediateActions,
        List<String> organicOptions,
        List<DiseaseDto.Chemical> chemicalOptions,
        String chemicalNote,
        List<String> prevention,
        String weatherNote,
        String whenToGetHelp,
        List<DiseaseDto.Source> sources,
        String disclaimer) {
}
