package com.cropcare.auth;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.cropcare.auth.AuthDtos.AuthResponse;
import com.cropcare.auth.AuthDtos.ChangePasswordRequest;
import com.cropcare.auth.AuthDtos.ForgotPasswordRequest;
import com.cropcare.auth.AuthDtos.LoginRequest;
import com.cropcare.auth.AuthDtos.MessageResponse;
import com.cropcare.auth.AuthDtos.RegisterRequest;
import com.cropcare.auth.AuthDtos.ResetPasswordRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("success", true, "user", authService.currentUser(JwtService.userId(jwt)));
    }

    @PostMapping("/forgot-password")
    public MessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request.email());
        return new MessageResponse(true,
                "If an account exists with this email, a password reset link has been sent.");
    }

    @PostMapping("/reset-password/{token}")
    public MessageResponse resetPassword(@PathVariable String token, @Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(token, request.password());
        return new MessageResponse(true, "Password reset successfully. You can now login with your new password.");
    }

    @PostMapping("/change-password")
    public MessageResponse changePassword(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(JwtService.userId(jwt), request);
        return new MessageResponse(true, "Password changed successfully.");
    }
}
