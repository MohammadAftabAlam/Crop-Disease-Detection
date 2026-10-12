package com.cropcare.auth;

import java.io.UnsupportedEncodingException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import com.cropcare.user.User;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    /** The CropCare AI emblem, attached to each email and shown in its header (cid: link). */
    private static final String LOGO_ID = "cropcare-logo";
    private static final ClassPathResource LOGO = new ClassPathResource("email/logo.png");
    private static final String HEADER = """
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;"><tr>
              <td style="vertical-align: middle;"><img src="cid:cropcare-logo" width="48" height="48" alt="CropCare AI" style="display: block;" /></td>
              <td style="vertical-align: middle; padding-left: 10px; font-size: 22px; font-weight: bold; color: #0f3d24;">CropCare <span style="color: #16a34a;">AI</span></td>
            </tr></table>
            """;

    private final ObjectProvider<JavaMailSender> mailSender;
    private final String from;

    public MailService(ObjectProvider<JavaMailSender> mailSender, @Value("${spring.mail.username:}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    public void sendPasswordReset(User user, String resetUrl) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null || from.isBlank()) {
            // Development fallback so the reset flow can be tested without Gmail credentials.
            log.warn("EMAIL_USER is not set, so no email was sent. Password reset link for {}: {}", user.getEmail(), resetUrl);
            return;
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from, "CropCare AI");
            helper.setTo(user.getEmail());
            helper.setSubject("CropCare AI - Password Reset");
            helper.setText(resetEmailHtml(HtmlUtils.htmlEscape(user.getName()), resetUrl), true);
            helper.addInline(LOGO_ID, LOGO, "image/png");
            sender.send(message);
        } catch (MessagingException | UnsupportedEncodingException e) {
            throw new IllegalStateException("Could not build the reset email", e);
        }
    }

    /** The 6-digit sign-up code. Without Gmail settings (development) it is written to the log instead. */
    public void sendVerificationCode(User user, String code, int validMinutes) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null || from.isBlank()) {
            log.warn("EMAIL_USER is not set, so no email was sent. Verification code for {}: {}", user.getEmail(), code);
            return;
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from, "CropCare AI");
            helper.setTo(user.getEmail());
            helper.setSubject("CropCare AI - Your verification code is " + code);
            helper.setText(codeEmailHtml(HtmlUtils.htmlEscape(user.getName()), code, validMinutes), true);
            helper.addInline(LOGO_ID, LOGO, "image/png");
            sender.send(message);
        } catch (MessagingException | UnsupportedEncodingException e) {
            throw new IllegalStateException("Could not build the verification email", e);
        }
    }

    private static String codeEmailHtml(String name, String code, int validMinutes) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
                  %s
                  <p>Hello %s,</p>
                  <p>Use this code to verify your email and finish creating your CropCare AI account:</p>
                  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #166534; margin: 24px 0;">%s</p>
                  <p>The code expires in <strong>%d minutes</strong>. Never share it with anyone: CropCare will never ask you for it.</p>
                  <p>नमस्ते! अपना ईमेल सत्यापित करने के लिए ऊपर दिया गया कोड ऐप में डालें। यह कोड किसी को न बताएं।</p>
                  <p>If you did not sign up for CropCare AI, you can ignore this email.</p>
                  <p>Regards,<br />CropCare AI Team</p>
                </div>
                """.formatted(HEADER, name, code, validMinutes);
    }

    private static String resetEmailHtml(String name, String resetUrl) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
                  %s
                  <p>Hello %s,</p>
                  <p>We received a request to reset your CropCare AI account password.</p>
                  <p>Click the button below to create a new password:</p>
                  <a href="%s" style="display: inline-block; padding: 12px 20px; background: #16a34a; color: white;
                     text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
                  <p style="margin-top: 20px;">This link will expire in <strong>15 minutes</strong>.</p>
                  <p>If you did not request a password reset, you can safely ignore this email.</p>
                  <p>Regards,<br />CropCare AI Team</p>
                </div>
                """.formatted(HEADER, name, resetUrl);
    }
}
