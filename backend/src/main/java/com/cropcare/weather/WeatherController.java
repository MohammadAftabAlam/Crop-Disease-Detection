package com.cropcare.weather;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WeatherController {

    private final WeatherRiskService weatherRiskService;

    public WeatherController(WeatherRiskService weatherRiskService) {
        this.weatherRiskService = weatherRiskService;
    }

    /** e.g. /api/weather/risk?crop=potato&lat=28.47&lon=77.50 */
    @GetMapping("/api/weather/risk")
    public Map<String, Object> risk(@RequestParam String crop, @RequestParam double lat, @RequestParam double lon) {
        return Map.of("success", true, "crop", crop, "risks", weatherRiskService.risksForCrop(crop, lat, lon));
    }
}
