package com.cropcare.prediction;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** One of the diseases the model considered possible (its conformal prediction set). */
@Embeddable
public class PredictionCandidate {

    @Column(name = "class_id", length = 80)
    private String classId;

    @Column(length = 50)
    private String crop;

    @Column(length = 100)
    private String disease;

    private Double confidence;

    protected PredictionCandidate() {
    }

    public PredictionCandidate(String classId, String crop, String disease, Double confidence) {
        this.classId = classId;
        this.crop = crop;
        this.disease = disease;
        this.confidence = confidence;
    }

    public String getClassId() {
        return classId;
    }

    public String getCrop() {
        return crop;
    }

    public String getDisease() {
        return disease;
    }

    public Double getConfidence() {
        return confidence;
    }
}
