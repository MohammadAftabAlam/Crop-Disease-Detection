package com.cropcare.chat;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cropcare.auth.JwtService;
import com.cropcare.translation.TranslationService;

/** "Ask about this result": follow-up questions on one of the user's own predictions. */
@RestController
@RequestMapping("/api/predictions/{id}/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    public record Question(String question) {
    }

    @GetMapping
    public Map<String, Object> conversation(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return Map.of("success", true, "chat", chatService.conversation(JwtService.userId(jwt), id));
    }

    /** Body: {"question": "..."}; the answer comes in the user's language (Accept-Language: hi or en). */
    @PostMapping
    public Map<String, Object> ask(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody Question body,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage) {
        return Map.of("success", true, "chat", chatService.ask(JwtService.userId(jwt), id,
                body == null ? null : body.question(), TranslationService.languageOf(acceptLanguage)));
    }
}
