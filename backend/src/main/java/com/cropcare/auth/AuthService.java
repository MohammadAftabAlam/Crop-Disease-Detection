package com.cropcare.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.GeneralSecurityException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

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
import com.cropcare.auth.AuthDtos.RegisterResponse;
import com.cropcare.auth.AuthDtos.UserDto;
import com.cropcare.common.ApiException;
import com.cropcare.config.AppProperties;
import com.cropcare.user.User;
import com.cropcare.user.UserRepository;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Duration RESET_TOKEN_LIFETIME = Duration.ofMinutes(15);
    // Sign-up code: valid 10 minutes, 5 wrong tries, a new one at most once a minute
    static final Duration CODE_LIFETIME = Duration.ofMinutes(10);
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    static final int MAX_CODE_ATTEMPTS = 5;
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

    /**
     * Creates the account unverified and emails a 6-digit code; no token until the code is entered.
     * Signing up again with an email that is still unverified (a typo'd password, a lost code)
     * updates that account and sends a new code instead of failing.
     */
    public RegisterResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        User user = users.findByEmail(email).orElse(null);
        if (user != null && user.isEmailVerified()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "User already exists");
        }

        if (user == null) {
            user = new User();
            user.setEmail(email);
        }
        user.setName(request.name().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setEmailVerified(false);
        try {
            user = users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Two sign-ups with the same email at the same moment
            throw new ApiException(HttpStatus.BAD_REQUEST, "User already exists");
        }

        if (!resendAllowed(user)) {
            return registerResponse(user, "We already sent a code to " + email + ". Please check your inbox.");
        }
        sendCode(user);
        return registerResponse(user, "We sent a 6-digit code to " + email + ". Enter it to finish signing up.");
    }

    public AuthResponse login(LoginRequest request) {
        User user = users.findByEmail(normalizeEmail(request.email()))
                .filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!user.isEmailVerified()) {
            // Right password but never verified: send a fresh code and let the app open the code screen
            if (resendAllowed(user)) {
                sendCode(user);
            }
            throw new ApiException(HttpStatus.FORBIDDEN, "Please verify your email first. We sent a code to " + user.getEmail() + ".",
                    Map.of("code", "EMAIL_NOT_VERIFIED", "email", user.getEmail(),
                            "resendAfterSeconds", secondsUntilResend(user)));
        }

        return new AuthResponse(true, "Login successful", jwtService.createToken(user), UserDto.from(user));
    }

    /** The emailed code -> verified account and a login token. */
    public AuthResponse verifyEmail(String rawEmail, String rawCode) {
        User user = users.findByEmail(normalizeEmail(rawEmail))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "The code is incorrect or has expired."));
        if (user.isEmailVerified()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This email is already verified. Please log in.");
        }
        if (user.getVerificationCodeHash() == null || user.getVerificationExpiresAt() == null
                || Instant.now().isAfter(user.getVerificationExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The code has expired. Tap \"Resend code\" to get a new one.",
                    Map.of("code", "CODE_EXPIRED"));
        }

        String code = rawCode.trim();
        if (!MessageDigest.isEqual(codeHash(user, code).getBytes(StandardCharsets.UTF_8),
                user.getVerificationCodeHash().getBytes(StandardCharsets.UTF_8))) {
            int attempts = user.getVerificationAttempts() + 1;
            user.setVerificationAttempts(attempts);
            if (attempts >= MAX_CODE_ATTEMPTS) {
                // Too many wrong tries: this code is dead, a new one must be requested
                user.setVerificationCodeHash(null);
                user.setVerificationExpiresAt(null);
                users.save(user);
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Too many wrong codes. Tap \"Resend code\" to get a new one.", Map.of("code", "CODE_EXPIRED"));
            }
            users.save(user);
            int left = MAX_CODE_ATTEMPTS - attempts;
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "The code is incorrect. " + left + (left == 1 ? " try" : " tries") + " left.",
                    Map.of("code", "CODE_INCORRECT", "attemptsLeft", left));
        }

        user.setEmailVerified(true);
        user.setVerificationCodeHash(null);
        user.setVerificationExpiresAt(null);
        user.setVerificationAttempts(null);
        users.save(user);
        return new AuthResponse(true, "Email verified. Welcome to CropCare AI!", jwtService.createToken(user),
                UserDto.from(user));
    }

    /** A new code, at most once a minute. Same answer for unknown emails, so it reveals nothing. */
    public RegisterResponse resendCode(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        User user = users.findByEmail(email).filter(found -> !found.isEmailVerified()).orElse(null);
        if (user == null) {
            return new RegisterResponse(true, "If this email is waiting for verification, a new code has been sent.",
                    true, email, (int) CODE_LIFETIME.toMinutes(), (int) RESEND_COOLDOWN.toSeconds());
        }
        if (!resendAllowed(user)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait " + secondsUntilResend(user) + " seconds before asking for a new code.",
                    Map.of("code", "RESEND_TOO_SOON", "resendAfterSeconds", secondsUntilResend(user)));
        }
        sendCode(user);
        return registerResponse(user, "A new code has been sent to " + email + ".");
    }

    private void sendCode(User user) {
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        user.setVerificationCodeHash(codeHash(user, code));
        user.setVerificationExpiresAt(Instant.now().plus(CODE_LIFETIME));
        user.setVerificationAttempts(0);
        user.setVerificationSentAt(Instant.now());
        users.save(user);
        try {
            mailService.sendVerificationCode(user, code, (int) CODE_LIFETIME.toMinutes());
        } catch (RuntimeException e) {
            log.error("Failed to send verification email to {}", user.getEmail(), e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "We could not send the verification email. Please check the address and try again.");
        }
    }

    private RegisterResponse registerResponse(User user, String message) {
        return new RegisterResponse(true, message, true, user.getEmail(), (int) CODE_LIFETIME.toMinutes(),
                secondsUntilResend(user));
    }

    private static boolean resendAllowed(User user) {
        return secondsUntilResend(user) == 0;
    }

    private static int secondsUntilResend(User user) {
        if (user.getVerificationSentAt() == null) {
            return 0;
        }
        long wait = Duration.between(Instant.now(), user.getVerificationSentAt().plus(RESEND_COOLDOWN)).toSeconds();
        return (int) Math.max(0, wait);
    }

    /** HMAC with the server secret, bound to the user: a stolen database does not reveal codes. */
    private String codeHash(User user, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(props.jwt().secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((user.getId() + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
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
