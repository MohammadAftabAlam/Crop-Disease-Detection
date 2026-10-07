package com.cropcare.auth;

import java.io.UnsupportedEncodingException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
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
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(from, "CropCare AI");
            helper.setTo(user.getEmail());
            helper.setSubject("CropCare AI - Password Reset");
            helper.setText(resetEmailHtml(HtmlUtils.htmlEscape(user.getName()), resetUrl), true);
            sender.send(message);
        } catch (MessagingException | UnsupportedEncodingException e) {
            throw new IllegalStateException("Could not build the reset email", e);
        }
    }

    private static String resetEmailHtml(String name, String resetUrl) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
                  <h2 style="color: #166534;">🌱 CropCare AI</h2>
                  <p>Hello %s,</p>
                  <p>We received a request to reset your CropCare AI account password.</p>
                  <p>Click the button below to create a new password:</p>
                  <a href="%s" style="display: inline-block; padding: 12px 20px; background: #16a34a; color: white;
                     text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
                  <p style="margin-top: 20px;">This link will expire in <strong>15 minutes</strong>.</p>
                  <p>If you did not request a password reset, you can safely ignore this email.</p>
                  <p>Regards,<br />CropCare AI Team</p>
                </div>
                """.formatted(name, resetUrl);
    }
}
