package com.cropcare.prediction;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * One uploaded photo's own result. The diagnosis averages all photos; this keeps what each photo
 * said on its own, so the app can show it and warn when photos of "one plant" disagree.
 */
@Embeddable
public class PredictionPhoto {

    @Column(name = "photo_index")
    private Integer photoIndex;

    /** false = dropped by the plant check (not a leaf of a supported crop) */
    private Boolean used;

    @Column(name = "class_id", length = 80)
    private String classId;

    @Column(length = 50)
    private String crop;

    @Column(length = 100)
    private String disease;

    private Double confidence;

    @Column(name = "severity_percent")
    private Double severityPercent;

    /** This photo's own status (confident / ambiguous / unknown / rejected) and why */
    @Column(length = 20)
    private String status;

    @Column(name = "status_reason", length = 40)
    private String reason;

    @Column(name = "severity_grade")
    private Integer severityGrade;

    @Column(name = "severity_label", length = 30)
    private String severityLabel;

    protected PredictionPhoto() {
    }

    public PredictionPhoto(Integer photoIndex, Boolean used, String classId, String crop, String disease,
            Double confidence, Double severityPercent, String status, String reason, Integer severityGrade,
            String severityLabel) {
        this.status = status;
        this.reason = reason;
        this.severityGrade = severityGrade;
        this.severityLabel = severityLabel;
        this.photoIndex = photoIndex;
        this.used = used;
        this.classId = classId;
        this.crop = crop;
        this.disease = disease;
        this.confidence = confidence;
        this.severityPercent = severityPercent;
    }

    public Integer getPhotoIndex() {
        return photoIndex;
    }

    public Boolean getUsed() {
        return used;
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

    public Double getSeverityPercent() {
        return severityPercent;
    }

    public String getStatus() {
        return status;
    }

    public String getReason() {
        return reason;
    }

    public Integer getSeverityGrade() {
        return severityGrade;
    }

    public String getSeverityLabel() {
        return severityLabel;
    }
}
