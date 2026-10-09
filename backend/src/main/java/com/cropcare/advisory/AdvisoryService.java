package com.cropcare.advisory;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.cropcare.disease.DiseaseDto;
import com.cropcare.disease.DiseaseService;

/**
 * Turns a diagnosis into advice. The model's status decides the shape of the advice:
 * only a confident diagnosis gets treatment steps; ambiguous / unknown / rejected
 * results get "take a better photo" and "ask an expert" instead, so the app never
 * recommends spraying for a disease it is unsure about.
 */
@Service
public class AdvisoryService {

    static final String HELPLINE = "Call the Kisan Call Centre (1800-180-1551, toll-free) or contact your nearest Krishi Vigyan Kendra.";
    static final String DISCLAIMER = "AI-generated guidance from a general knowledge base. Confirm with a local agriculture expert before using any pesticide.";
    static final List<String> RETAKE_TIPS = List.of(
            "Photograph one affected leaf at a time so it fills most of the frame",
            "Use daylight and avoid strong shadows or flash glare",
            "Hold the phone steady so the spots are in focus",
            "Send 2-3 photos of different affected leaves of the same plant");

    /** Inputs from a prediction. Severity grade and weather level may be null. */
    public record Context(String status, String reason, String classId, List<String> candidateClassIds,
            Integer severityGrade, String weatherRiskLevel) {
    }

    static final List<String> NO_LESION_CHECKS = List.of(
            "Look at both sides of the leaves and inside the leaf whorl for caterpillars, beetles, eggs or droppings",
            "Holes, torn edges or scraped white streaks usually mean insect feeding, not a disease",
            "Uniform yellowing or purple colour can mean a nutrient problem rather than a disease",
            "Photograph one damaged leaf up close and show it to your agriculture officer");

    private final DiseaseService diseaseService;

    public AdvisoryService(DiseaseService diseaseService) {
        this.diseaseService = diseaseService;
    }

    public Advice adviceFor(Context context) {
        return switch (context.status()) {
            case "confident" -> confident(context);
            case "ambiguous" -> ambiguous(context);
            case "unknown" -> "no_lesions".equals(context.reason())
                    ? new Advice("No disease spots found", "UNKNOWN",
                            "This does not look like a disease the model knows.", NO_LESION_CHECKS, List.of(), List.of(),
                            "Do not spray a fungicide: it will not help with insect damage or nutrient problems.",
                            List.of(), null, HELPLINE, List.of(), DISCLAIMER)
                    : unknown();
            case "rejected" -> new Advice("Photo not recognised as a supported crop leaf", "UNKNOWN",
                    "No diagnosis was made.", RETAKE_TIPS, List.of(), List.of(), null, List.of(), null, HELPLINE,
                    List.of(), DISCLAIMER);
            default -> unknown();
        };
    }

    private static Advice unknown() {
        return new Advice("The disease could not be identified reliably", "UNKNOWN",
                "Do not spray anything until the problem is identified.", RETAKE_TIPS, List.of(), List.of(), null,
                List.of(), null, HELPLINE, List.of(), DISCLAIMER);
    }

    private Advice confident(Context context) {
        Optional<DiseaseDto> found = diseaseService.findByCode(context.classId());
        if (found.isEmpty()) {
            return new Advice("Diagnosis: " + context.classId(), "UNKNOWN", "No advice is stored for this disease yet.",
                    List.of(), List.of(), List.of(), null, List.of(), null, HELPLINE, List.of(), DISCLAIMER);
        }
        DiseaseDto disease = found.get();

        if (disease.isHealthy()) {
            return new Advice("Your " + disease.crop().toLowerCase() + " plant looks healthy", "NONE",
                    "No action needed.", disease.remedies(), List.of(), List.of(), null, disease.prevention(), null,
                    "If new spots appear, take another photo or contact your nearest Krishi Vigyan Kendra.",
                    disease.sources(), DISCLAIMER);
        }

        boolean virus = disease.pathogen() != null && disease.pathogen().toLowerCase().contains("virus");
        String urgency = virus ? "HIGH" : urgencyFromSeverity(context.severityGrade());
        if ("HIGH".equals(context.weatherRiskLevel())) {
            urgency = raise(urgency);
        }

        String chemicalNote;
        if (virus) {
            chemicalNote = "No pesticide cures a viral disease. Remove infected plants; control the insect vector only if an expert advises it.";
        } else if (disease.chemicalControl().isEmpty()) {
            chemicalNote = "Ask your Krishi Vigyan Kendra or agriculture officer for a pesticide registered (CIB&RC) for "
                    + disease.diseaseName().toLowerCase() + " on " + disease.crop().toLowerCase()
                    + ". Always follow the label dose, wear protection and respect the waiting period before harvest.";
        } else {
            chemicalNote = "Use only as per the label. Wear protection and respect the waiting period before harvest.";
        }

        String weatherNote = switch (context.weatherRiskLevel() == null ? "" : context.weatherRiskLevel()) {
            case "HIGH" -> "Weather in the next 3 days strongly favours this disease; it may spread quickly.";
            case "MEDIUM" -> "Weather in the next 3 days is somewhat favourable for this disease.";
            case "LOW" -> "Weather in the next 3 days is not very favourable for this disease.";
            default -> null;
        };

        String help = "HIGH".equals(urgency)
                ? "Get expert help today. " + HELPLINE
                : "If it spreads to more plants within a few days: " + HELPLINE;

        return new Advice(disease.crop() + ": " + disease.diseaseName(), urgency, urgencyText(urgency),
                disease.remedies(), disease.organicControl(), disease.chemicalControl(), chemicalNote,
                disease.prevention(), weatherNote, help, disease.sources(), DISCLAIMER);
    }

    private Advice ambiguous(Context context) {
        List<DiseaseDto> options = context.candidateClassIds().stream()
                .map(diseaseService::findByCode).flatMap(Optional::stream).toList();
        String names = String.join(" or ", options.stream().map(d -> d.crop() + " " + d.diseaseName()).toList());

        // Safe, general steps shared by the possible diseases; no treatment until confirmed
        LinkedHashSet<String> actions = new LinkedHashSet<>(RETAKE_TIPS);
        options.stream().filter(d -> !d.isHealthy())
                .forEach(d -> d.remedies().stream().limit(2).forEach(actions::add));
        LinkedHashSet<String> prevention = new LinkedHashSet<>();
        options.forEach(d -> prevention.addAll(d.prevention()));

        return new Advice("Possibly " + (names.isBlank() ? "one of several diseases" : names), "UNKNOWN",
                "Not confirmed yet. Take clearer photos before treating.", new ArrayList<>(actions), List.of(),
                List.of(), "Do not spray until the disease is confirmed.", new ArrayList<>(prevention), null, HELPLINE,
                options.stream().flatMap(d -> d.sources().stream()).distinct().toList(), DISCLAIMER);
    }

    static String urgencyFromSeverity(Integer grade) {
        if (grade == null) {
            return "MODERATE";
        }
        return grade <= 1 ? "LOW" : grade == 2 ? "MODERATE" : "HIGH";
    }

    static String raise(String urgency) {
        return switch (urgency) {
            case "LOW" -> "MODERATE";
            case "MODERATE" -> "HIGH";
            default -> urgency;
        };
    }

    static String urgencyText(String urgency) {
        return switch (urgency) {
            case "HIGH" -> "Act today.";
            case "MODERATE" -> "Act within 2-3 days.";
            case "LOW" -> "Act within a week and keep monitoring.";
            default -> "";
        };
    }
}
