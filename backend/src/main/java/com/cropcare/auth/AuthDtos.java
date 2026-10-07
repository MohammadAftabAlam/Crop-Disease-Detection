package com.cropcare.auth;

import com.cropcare.user.User;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request and response bodies for /api/auth. */
public final class AuthDtos {

    /** Same rule as the React forms: 8-64 chars, upper, lower, digit and one of @$!%*?& */
    static final String STRONG_PASSWORD = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,64}$";
    static final String WEAK_PASSWORD_MESSAGE = "Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character.";

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "Please enter your name.") @Size(max = 100, message = "Name is too long.") String name,
            @NotBlank(message = "Please enter your email address.") @Email(message = "Please enter a valid email address.") String email,
            @NotBlank(message = "Please enter a password.") @Pattern(regexp = STRONG_PASSWORD, message = WEAK_PASSWORD_MESSAGE) String password) {
    }

    public record LoginRequest(
            @NotBlank(message = "Please enter your email address.") String email,
            @NotBlank(message = "Please enter your password.") String password) {
    }

    public record ForgotPasswordRequest(
            @NotBlank(message = "Please enter your email address.") String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank(message = "Please enter a new password.") @Pattern(regexp = STRONG_PASSWORD, message = WEAK_PASSWORD_MESSAGE) String password) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password and new password are required.") String currentPassword,
            @NotBlank(message = "Current password and new password are required.") @Pattern(regexp = STRONG_PASSWORD, message = "New password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character.") String newPassword) {
    }

    public record UserDto(Long id, String name, String email) {
        static UserDto from(User user) {
            return new UserDto(user.getId(), user.getName(), user.getEmail());
        }
    }

    public record AuthResponse(boolean success, String message, String token, UserDto user) {
    }

    public record MessageResponse(boolean success, String message) {
    }
}
