package com.cropcare.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import com.cropcare.user.User;

import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;

class MailServiceTest {

    /** Keeps messages instead of sending them. */
    static class CapturingSender extends JavaMailSenderImpl {
        final List<MimeMessage> sent = new ArrayList<>();

        @Override
        public void send(MimeMessage message) {
            try {
                message.saveChanges(); // as a real send does: writes the Content-Type headers
            } catch (jakarta.mail.MessagingException e) {
                throw new IllegalStateException(e);
            }
            sent.add(message);
        }
    }

    /** The decoded HTML body and the Content-IDs of the attached parts. */
    record Email(String html, List<String> contentIds) {
    }

    private static Email read(MimeMessage message) throws Exception {
        List<String> html = new ArrayList<>();
        List<String> ids = new ArrayList<>();
        collect(message, html, ids);
        return new Email(String.join("", html), ids);
    }

    private static void collect(Part part, List<String> html, List<String> ids) throws Exception {
        String[] id = part.getHeader("Content-ID");
        if (id != null) {
            ids.add(id[0]);
        }
        if (part.isMimeType("text/html")) {
            html.add((String) part.getContent());
        } else if (part.isMimeType("multipart/*")) {
            Multipart multipart = (Multipart) part.getContent();
            for (int i = 0; i < multipart.getCount(); i++) {
                collect(multipart.getBodyPart(i), html, ids);
            }
        }
    }

    private static MailService service(CapturingSender sender) {
        var beans = new StaticListableBeanFactory(Map.of("mailSender", sender));
        return new MailService(beans.getBeanProvider(JavaMailSender.class), "cropcare@example.com");
    }

    private static User user() {
        User user = new User();
        user.setName("Asha <Farmer>");
        user.setEmail("asha@example.com");
        return user;
    }

    @Test
    void verificationEmailShowsTheLogoAttachedToIt() throws Exception {
        CapturingSender sender = new CapturingSender();
        service(sender).sendVerificationCode(user(), "482913", 10);

        assertThat(sender.sent).hasSize(1);
        Email email = read(sender.sent.get(0));
        assertThat(email.html()).contains("src=\"cid:cropcare-logo\"", "482913");
        assertThat(email.contentIds()).containsExactly("<cropcare-logo>");
        // The name is escaped, never injected as HTML
        assertThat(email.html()).contains("Asha &lt;Farmer&gt;");
    }

    @Test
    void resetEmailShowsTheLogoAttachedToIt() throws Exception {
        CapturingSender sender = new CapturingSender();
        service(sender).sendPasswordReset(user(), "http://localhost:5173/reset-password/abc");

        Email email = read(sender.sent.get(0));
        assertThat(email.html()).contains("src=\"cid:cropcare-logo\"", "http://localhost:5173/reset-password/abc");
        assertThat(email.contentIds()).containsExactly("<cropcare-logo>");
    }
}
