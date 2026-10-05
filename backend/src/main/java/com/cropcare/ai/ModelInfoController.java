package com.cropcare.ai;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ModelInfoController {

    private final AiClient aiClient;

    public ModelInfoController(AiClient aiClient) {
        this.aiClient = aiClient;
    }

    @GetMapping("/api/model/info")
    public Map<String, Object> modelInfo() {
        return aiClient.modelInfo();
    }

    @GetMapping({ "/", "/api/health" })
    public Map<String, Object> health() {
        return Map.of("success", true, "message", "AI Crop Disease Detection API is running");
    }
}
