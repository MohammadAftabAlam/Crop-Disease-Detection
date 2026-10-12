package com.cropcare.chat;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * One chat message about a prediction. Questions and answers are both stored, so a teacher or
 * expert can review what the assistant told farmers (outcome says how each answer was produced).
 */
@Entity
@Table(name = "chat_messages", indexes = {
        @Index(name = "idx_chat_prediction", columnList = "predictionId"),
        @Index(name = "idx_chat_user_time", columnList = "userId,createdAt") })
public class ChatMessage {

    /** answered | off_topic | unsafe_removed | blocked */
    public static final String ANSWERED = "answered";
    public static final String OFF_TOPIC = "off_topic";
    public static final String UNSAFE_REMOVED = "unsafe_removed";
    public static final String BLOCKED = "blocked";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long predictionId;

    @Column(nullable = false)
    private Long userId;

    /** "user" (the farmer) or "assistant" */
    @Column(nullable = false, length = 10)
    private String role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    @Column(length = 5)
    private String language;

    @Column(length = 20)
    private String outcome;

    @Column(nullable = false)
    private Instant createdAt;

    protected ChatMessage() {
    }

    public ChatMessage(Long predictionId, Long userId, String role, String text, String language, String outcome) {
        this.predictionId = predictionId;
        this.userId = userId;
        this.role = role;
        this.text = text;
        this.language = language;
        this.outcome = outcome;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getPredictionId() {
        return predictionId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getRole() {
        return role;
    }

    public String getText() {
        return text;
    }

    public String getLanguage() {
        return language;
    }

    public String getOutcome() {
        return outcome;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
