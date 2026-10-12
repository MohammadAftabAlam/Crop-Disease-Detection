package com.cropcare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.cropcare.user.User;
import com.cropcare.user.UserRepository;

/** Email verification at sign-up: a 6-digit code, 10 minutes, 5 tries, a new code at most once a minute. */
class OtpIntegrationTest extends IntegrationTestBase {

    @Autowired
    UserRepository users;

    private ResultActions signUp(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"New Farmer","email":"%s","password":"%s"}""".formatted(email, password)));
    }

    private ResultActions verify(String email, String code) throws Exception {
        return mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"%s","code":"%s"}""".formatted(email, code)));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"%s","password":"%s"}""".formatted(email, password)));
    }

    private ResultActions resend(String email) throws Exception {
        return mvc.perform(post("/api/auth/resend-code").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email":"%s"}""".formatted(email)));
    }

    /** Pretends the last code was sent long ago, so the one-minute resend wait is over. */
    private void waitForResend(String email) {
        User user = users.findByEmail(email).orElseThrow();
        user.setVerificationSentAt(Instant.now().minus(Duration.ofMinutes(2)));
        users.save(user);
    }

    private static String wrong(String code) {
        return code.equals("000000") ? "111111" : "000000";
    }

    @Test
    void signUpGivesNoTokenUntilTheEmailedCodeIsEntered() throws Exception {
        String email = uniqueEmail();
        signUp(email, PASSWORD)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.verificationRequired").value(true))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.codeValidMinutes").value(10))
                .andExpect(jsonPath("$.token").doesNotExist());
        String code = lastCode(email);
        assertThat(code).matches("\\d{6}");

        // Stored only as a hash
        User stored = users.findByEmail(email).orElseThrow();
        assertThat(stored.isEmailVerified()).isFalse();
        assertThat(stored.getVerificationCodeHash()).isNotEqualTo(code).hasSize(64);

        // Login before verifying: refused, with what the app needs to open the code screen
        login(email, PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"))
                .andExpect(jsonPath("$.email").value(email));

        verify(email, wrong(code))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_INCORRECT"))
                .andExpect(jsonPath("$.attemptsLeft").value(4));

        verify(email, " " + code + " ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.user.email").value(email));

        login(email, PASSWORD).andExpect(status().isOk());
        verify(email, code).andExpect(status().isBadRequest());           // already verified
        signUp(email, PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User already exists"));
    }

    @Test
    void fiveWrongCodesEndTheCodeAndANewOneWorks() throws Exception {
        String email = uniqueEmail();
        signUp(email, PASSWORD).andExpect(status().isCreated());
        String code = lastCode(email);

        for (int i = 0; i < 4; i++) {
            verify(email, wrong(code)).andExpect(jsonPath("$.code").value("CODE_INCORRECT"));
        }
        verify(email, wrong(code)).andExpect(jsonPath("$.code").value("CODE_EXPIRED"));
        verify(email, code).andExpect(status().isBadRequest());         // even the right code is dead now

        resend(email).andExpect(status().isTooManyRequests())            // within the minute
                .andExpect(jsonPath("$.code").value("RESEND_TOO_SOON"));
        waitForResend(email);
        resend(email).andExpect(status().isOk());
        String fresh = lastCode(email);
        verify(email, fresh).andExpect(status().isOk());
    }

    @Test
    void codesExpireAfterTenMinutes() throws Exception {
        String email = uniqueEmail();
        signUp(email, PASSWORD).andExpect(status().isCreated());
        String code = lastCode(email);
        User user = users.findByEmail(email).orElseThrow();
        user.setVerificationExpiresAt(Instant.now().minusSeconds(1));
        users.save(user);

        verify(email, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CODE_EXPIRED"));
    }

    @Test
    void signingUpAgainBeforeVerifyingUpdatesTheAccount() throws Exception {
        String email = uniqueEmail();
        signUp(email, "Old@12345").andExpect(status().isCreated());
        waitForResend(email);
        signUp(email, PASSWORD).andExpect(status().isCreated());       // e.g. the farmer mistyped the password
        verify(email, lastCode(email)).andExpect(status().isOk());

        login(email, "Old@12345").andExpect(status().isUnauthorized());
        login(email, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void resendNeverRevealsWhichEmailsExist() throws Exception {
        resend("nobody-" + uniqueEmail())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void accountsMadeBeforeVerificationExistedStillLogIn() throws Exception {
        String email = uniqueEmail();
        register(email);                                                 // verified through the code
        User user = users.findByEmail(email).orElseThrow();
        user.setEmailVerified(null);                                      // as in rows from before this feature
        users.save(user);

        login(email, PASSWORD).andExpect(status().isOk());
    }
}
