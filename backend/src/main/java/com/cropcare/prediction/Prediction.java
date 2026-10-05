package com.cropcare.prediction;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.cropcare.user.User;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "predictions", indexes = @Index(name = "idx_predictions_user_created", columnList = "user_id, created_at"))
public class Prediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** confident | ambiguous | unknown | rejected */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(length = 1000)
    private String message;

    /** Most likely class, e.g. "tomato__late_blight"; null when rejected. */
    @Column(name = "class_id", length = 80)
    private String classId;

    @Column(length = 50)
    private String crop;

    @Column(length = 100)
    private String disease;

    @Column(name = "is_healthy")
    private Boolean healthy;

    /** 0-100, calibrated; null when rejected */
    private Double confidence;

    @ElementCollection
    @CollectionTable(name = "prediction_candidates", joinColumns = @JoinColumn(name = "prediction_id"))
    @OrderColumn(name = "item_order")
    private List<PredictionCandidate> candidates = new ArrayList<>();

    @Column(name = "severity_percent")
    private Double severityPercent;

    @Column(name = "severity_grade")
    private Integer severityGrade;

    @Column(name = "severity_label", length = 30)
    private String severityLabel;

    /** File names inside the uploads folder, in upload order. */
    @ElementCollection
    @CollectionTable(name = "prediction_images", joinColumns = @JoinColumn(name = "prediction_id"))
    @OrderColumn(name = "item_order")
    @Column(name = "filename", nullable = false)
    private List<String> imageFilenames = new ArrayList<>();

    private Double latitude;

    private Double longitude;

    @Column(name = "weather_risk_level", length = 10)
    private String weatherRiskLevel;

    @Column(name = "weather_favourable_hours")
    private Integer weatherFavourableHours;

    @Column(name = "weather_conditions", length = 200)
    private String weatherConditions;

    /** Farmer / expert feedback, used later to find mistakes and retrain. */
    @Column(name = "feedback_correct")
    private Boolean feedbackCorrect;

    @Column(name = "feedback_class_id", length = 80)
    private String feedbackClassId;

    @Column(name = "feedback_comment", length = 500)
    private String feedbackComment;

    @Column(name = "feedback_at")
    private Instant feedbackAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getCrop() {
        return crop;
    }

    public void setCrop(String crop) {
        this.crop = crop;
    }

    public String getDisease() {
        return disease;
    }

    public void setDisease(String disease) {
        this.disease = disease;
    }

    public Boolean getHealthy() {
        return healthy;
    }

    public void setHealthy(Boolean healthy) {
        this.healthy = healthy;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public List<PredictionCandidate> getCandidates() {
        return candidates;
    }

    public void setCandidates(List<PredictionCandidate> candidates) {
        this.candidates = new ArrayList<>(candidates);
    }

    public Double getSeverityPercent() {
        return severityPercent;
    }

    public void setSeverityPercent(Double severityPercent) {
        this.severityPercent = severityPercent;
    }

    public Integer getSeverityGrade() {
        return severityGrade;
    }

    public void setSeverityGrade(Integer severityGrade) {
        this.severityGrade = severityGrade;
    }

    public String getSeverityLabel() {
        return severityLabel;
    }

    public void setSeverityLabel(String severityLabel) {
        this.severityLabel = severityLabel;
    }

    public List<String> getImageFilenames() {
        return imageFilenames;
    }

    public void setImageFilenames(List<String> imageFilenames) {
        this.imageFilenames = new ArrayList<>(imageFilenames);
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getWeatherRiskLevel() {
        return weatherRiskLevel;
    }

    public void setWeatherRiskLevel(String weatherRiskLevel) {
        this.weatherRiskLevel = weatherRiskLevel;
    }

    public Integer getWeatherFavourableHours() {
        return weatherFavourableHours;
    }

    public void setWeatherFavourableHours(Integer weatherFavourableHours) {
        this.weatherFavourableHours = weatherFavourableHours;
    }

    public String getWeatherConditions() {
        return weatherConditions;
    }

    public void setWeatherConditions(String weatherConditions) {
        this.weatherConditions = weatherConditions;
    }

    public Boolean getFeedbackCorrect() {
        return feedbackCorrect;
    }

    public void setFeedbackCorrect(Boolean feedbackCorrect) {
        this.feedbackCorrect = feedbackCorrect;
    }

    public String getFeedbackClassId() {
        return feedbackClassId;
    }

    public void setFeedbackClassId(String feedbackClassId) {
        this.feedbackClassId = feedbackClassId;
    }

    public String getFeedbackComment() {
        return feedbackComment;
    }

    public void setFeedbackComment(String feedbackComment) {
        this.feedbackComment = feedbackComment;
    }

    public Instant getFeedbackAt() {
        return feedbackAt;
    }

    public void setFeedbackAt(Instant feedbackAt) {
        this.feedbackAt = feedbackAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
