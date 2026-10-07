package com.cropcare.translation;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** A cached machine translation, so each sentence is sent to Bhashini only once. */
@Entity
@Table(name = "translations", uniqueConstraints = @UniqueConstraint(columnNames = { "language", "source_hash" }))
public class Translation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String language;

    /** SHA-256 of the English text (the text itself can be too long for a unique index). */
    @Column(name = "source_hash", nullable = false, length = 64)
    private String sourceHash;

    @Column(name = "source_text", nullable = false, length = 4000)
    private String sourceText;

    @Column(name = "translated_text", nullable = false, length = 8000)
    private String translatedText;

    @Column(nullable = false, length = 30)
    private String provider;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Translation() {
    }

    public Translation(String language, String sourceHash, String sourceText, String translatedText, String provider) {
        this.language = language;
        this.sourceHash = sourceHash;
        this.sourceText = sourceText;
        this.translatedText = translatedText;
        this.provider = provider;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public String getSourceHash() {
        return sourceHash;
    }

    public String getTranslatedText() {
        return translatedText;
    }
}
