package com.cropcare.prediction;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** One of the diseases a single photo pointed to on its own (that photo's prediction set). */
@Embeddable
public class PredictionPhotoCandidate {

    @Column(name = "photo_index")
    private Integer photoIndex;

    @Column(name = "class_id", length = 80)
    private String classId;

    @Column(length = 50)
    private String crop;

    @Column(length = 100)
    private String disease;

    private Double confidence;

    protected PredictionPhotoCandidate() {
    }

    public PredictionPhotoCandidate(Integer photoIndex, String classId, String crop, String disease, Double confidence) {
        this.photoIndex = photoIndex;
        this.classId = classId;
        this.crop = crop;
        this.disease = disease;
        this.confidence = confidence;
    }

    public Integer getPhotoIndex() {
        return photoIndex;
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
