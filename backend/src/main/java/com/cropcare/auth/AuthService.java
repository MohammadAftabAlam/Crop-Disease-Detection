package com.cropcare.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.cropcare.auth.AuthDtos.AuthResponse;
import com.cropcare.auth.AuthDtos.ChangePasswordRequest;
import com.cropcare.auth.AuthDtos.LoginRequest;
import com.cropcare.auth.AuthDtos.RegisterRequest;
import com.cropcare.auth.AuthDtos.UserDto;
import com.cropcare.common.ApiException;
import com.cropcare.config.AppProperties;
import com.cropcare.user.User;
import com.cropcare.user.UserRepository;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Duration RESET_TOKEN_LIFETIME = Duration.ofMinutes(15);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final MailService mailService;
    private final AppProperties props;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService,
            MailService mailService, AppProperties props) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.mailService = mailService;
        this.props = props;
    }

    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "User already exists");
        }

        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        try {
            user = users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Two sign-ups with the same email at the same moment
            throw new ApiException(HttpStatus.BAD_REQUEST, "User already exists");
        }

        return new AuthResponse(true, "User registered successfully", jwtService.createToken(user), UserDto.from(user));
    }

    public AuthResponse login(LoginRequest request) {
        User user = users.findByEmail(normalizeEmail(request.email()))
                .filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        return new AuthResponse(true, "Login successful", jwtService.createToken(user), UserDto.from(user));
    }

    public UserDto currentUser(Long userId) {
        return UserDto.from(requireUser(userId));
    }

    /** Always succeeds from the caller's point of view, so it never reveals which emails are registered. */
    public void forgotPassword(String rawEmail) {
        users.findByEmail(normalizeEmail(rawEmail)).ifPresent(user -> {
            byte[] tokenBytes = new byte[32];
            RANDOM.nextBytes(tokenBytes);
            String token = HexFormat.of().formatHex(tokenBytes);

            user.setResetTokenHash(sha256(token));
            user.setResetTokenExpiresAt(Instant.now().plus(RESET_TOKEN_LIFETIME));
            users.save(user);

            String resetUrl = props.frontendUrl() + "/reset-password/" + token;
            try {
                mailService.sendPasswordReset(user, resetUrl);
            } catch (RuntimeException e) {
                log.error("Failed to send password reset email to {}", user.getEmail(), e);
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to process password reset request.");
            }
        });
    }

    public void resetPassword(String token, String newPassword) {
        User user = users.findByResetTokenHashAndResetTokenExpiresAtAfter(sha256(token), Instant.now())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Password reset link is invalid or has expired."));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setResetTokenHash(null);
        user.setResetTokenExpiresAt(null);
        users.save(user);
    }

    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = requireUser(userId);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Current password is incorrect. If you forgot it, use Forgot Password.");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "New password must be different from your current password.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        users.save(user);
    }

    private User requireUser(Long userId) {
        return users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found. Please login again."));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
