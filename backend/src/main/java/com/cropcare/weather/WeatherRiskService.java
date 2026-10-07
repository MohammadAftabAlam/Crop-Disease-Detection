package com.cropcare.weather;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.cropcare.common.ApiException;
import com.cropcare.weather.WeatherClient.Hour;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import tools.jackson.databind.json.JsonMapper;

/**
 * Disease risk from the local forecast: counts the hours in the next 3 days whose
 * temperature and humidity favour each disease (rules in resources/seed/weather_rules.json).
 */
@Service
public class WeatherRiskService {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Rule(String code, double tempMin, double tempMax, Double minHumidity, Double maxHumidity) {
        boolean favourable(Hour hour) {
            return hour.temperature() >= tempMin && hour.temperature() <= tempMax
                    && (minHumidity == null || hour.humidity() >= minHumidity)
                    && (maxHumidity == null || hour.humidity() <= maxHumidity);
        }

        String conditionText() {
            String humidity = minHumidity != null ? "humidity ≥ " + minHumidity.intValue() + "%"
                    : "humidity ≤ " + maxHumidity.intValue() + "%";
            return "%d–%d °C and %s".formatted((int) tempMin, (int) tempMax, humidity);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Levels(int mediumHours, int highHours) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RuleFile(Levels levels, List<Rule> rules) {
    }

    public record Risk(String code, String level, int favourableHours, int forecastHours, String conditions) {
    }

    private final WeatherClient weatherClient;
    private final Map<String, Rule> rules;
    private final Levels levels;

    public WeatherRiskService(WeatherClient weatherClient, JsonMapper jsonMapper) {
        this.weatherClient = weatherClient;
        try (InputStream in = new ClassPathResource("seed/weather_rules.json").getInputStream()) {
            RuleFile file = jsonMapper.readValue(in, RuleFile.class);
            this.rules = file.rules().stream().collect(Collectors.toMap(Rule::code, Function.identity()));
            this.levels = file.levels();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static void validateLocation(double latitude, double longitude) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid latitude/longitude.");
        }
    }

    /** Risk for every disease of a crop (codes start with "<crop>__"), highest first. */
    public List<Risk> risksForCrop(String crop, double latitude, double longitude) {
        validateLocation(latitude, longitude);
        String prefix = crop.trim().toLowerCase() + "__";
        List<Rule> cropRules = rules.values().stream().filter(rule -> rule.code().startsWith(prefix)).toList();
        if (cropRules.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No weather rules for crop: " + crop);
        }
        List<Hour> hours = weatherClient.next72Hours(latitude, longitude);
        return cropRules.stream()
                .map(rule -> evaluate(rule, hours))
                .sorted((a, b) -> Integer.compare(b.favourableHours(), a.favourableHours()))
                .toList();
    }

    /** Risk for one disease, or empty if it has no weather rule (e.g. viruses). */
    public Optional<Risk> riskFor(String code, double latitude, double longitude) {
        validateLocation(latitude, longitude);
        Rule rule = rules.get(code);
        if (rule == null) {
            return Optional.empty();
        }
        return Optional.of(evaluate(rule, weatherClient.next72Hours(latitude, longitude)));
    }

    Risk evaluate(Rule rule, List<Hour> hours) {
        int favourable = (int) hours.stream().filter(rule::favourable).count();
        String level = favourable >= levels.highHours() ? "HIGH" : favourable >= levels.mediumHours() ? "MEDIUM" : "LOW";
        return new Risk(rule.code(), level, favourable, hours.size(), rule.conditionText());
    }
}
