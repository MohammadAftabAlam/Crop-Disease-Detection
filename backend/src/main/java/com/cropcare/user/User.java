package com.cropcare.user;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    /** Always stored lower-case so login is case-insensitive. */
    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /** SHA-256 of the emailed reset token; the raw token is never stored. */
    @Column(name = "reset_token_hash", length = 64)
    private String resetTokenHash;

    @Column(name = "reset_token_expires_at")
    private Instant resetTokenExpiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** False until the emailed code is entered. Null = account made before verification existed (treated as verified). */
    @Column(name = "email_verified")
    private Boolean emailVerified;

    /** HMAC of the current 6-digit code (never the code itself), its expiry, wrong tries and when it was sent. */
    @Column(name = "verification_code_hash", length = 64)
    private String verificationCodeHash;

    @Column(name = "verification_expires_at")
    private Instant verificationExpiresAt;

    @Column(name = "verification_attempts")
    private Integer verificationAttempts;

    @Column(name = "verification_sent_at")
    private Instant verificationSentAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getResetTokenHash() {
        return resetTokenHash;
    }

    public void setResetTokenHash(String resetTokenHash) {
        this.resetTokenHash = resetTokenHash;
    }

    public Instant getResetTokenExpiresAt() {
        return resetTokenExpiresAt;
    }

    public void setResetTokenExpiresAt(Instant resetTokenExpiresAt) {
        this.resetTokenExpiresAt = resetTokenExpiresAt;
    }

    public boolean isEmailVerified() {
        return emailVerified == null || emailVerified;
    }

    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public String getVerificationCodeHash() {
        return verificationCodeHash;
    }

    public void setVerificationCodeHash(String verificationCodeHash) {
        this.verificationCodeHash = verificationCodeHash;
    }

    public Instant getVerificationExpiresAt() {
        return verificationExpiresAt;
    }

    public void setVerificationExpiresAt(Instant verificationExpiresAt) {
        this.verificationExpiresAt = verificationExpiresAt;
    }

    public int getVerificationAttempts() {
        return verificationAttempts == null ? 0 : verificationAttempts;
    }

    public void setVerificationAttempts(Integer verificationAttempts) {
        this.verificationAttempts = verificationAttempts;
    }

    public Instant getVerificationSentAt() {
        return verificationSentAt;
    }

    public void setVerificationSentAt(Instant verificationSentAt) {
        this.verificationSentAt = verificationSentAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
