package com.cropcare;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AuthIntegrationTest extends IntegrationTestBase {

    @Test
    void registerLoginAndMe() throws Exception {
        String email = uniqueEmail();
        String token = register(email);

        // Email is case-insensitive for login and duplicates
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"%s","password":"%s"}""".formatted(email.toUpperCase(), PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(email));

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Again","email":"%s","password":"%s"}""".formatted(email.toUpperCase(), PASSWORD)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User already exists"));

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.name").value("Test Farmer"));
    }

    @Test
    void weakPasswordAndBadLoginAreRejected() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Weak","email":"%s","password":"password"}""".formatted(uniqueEmail())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("Password must be")));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"nobody@example.com","password":"Wrong@1234"}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void protectedRoutesNeedAValidToken() throws Exception {
        mvc.perform(get("/api/predictions/history"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Not authorized. Please login."));

        mvc.perform(get("/api/predictions/history").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid or expired token. Please login again."));
    }

    @Test
    void changePasswordFlow() throws Exception {
        String email = uniqueEmail();
        String token = register(email);

        mvc.perform(post("/api/auth/change-password").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"currentPassword":"Wrong@1234","newPassword":"Fresh@5678"}"""))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/auth/change-password").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"currentPassword":"%s","newPassword":"Fresh@5678"}""".formatted(PASSWORD)))
                .andExpect(status().isOk());

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"%s","password":"Fresh@5678"}""".formatted(email)))
                .andExpect(status().isOk());
    }

    @Test
    void forgotAndResetPasswordGiveSafeAnswers() throws Exception {
        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"unknown@example.com"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(
                        "If an account exists with this email, a password reset link has been sent."));

        mvc.perform(post("/api/auth/reset-password/not-a-real-token").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"password":"Fresh@5678"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Password reset link is invalid or has expired."));
    }
}
