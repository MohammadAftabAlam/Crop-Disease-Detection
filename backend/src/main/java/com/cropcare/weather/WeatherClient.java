package com.cropcare.weather;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.cropcare.common.ApiException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Hourly forecast from Open-Meteo (free, no API key). */
@Component
public class WeatherClient {

    public record Hour(String time, double temperature, double humidity) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Hourly(List<String> time, List<Double> temperature_2m, List<Double> relative_humidity_2m) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Forecast(Hourly hourly) {
    }

    private final RestClient restClient;

    public WeatherClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(10));
        this.restClient = RestClient.builder()
                .baseUrl("https://api.open-meteo.com")
                .requestFactory(requestFactory)
                .build();
    }

    /** Next 72 hours of temperature (°C) and relative humidity (%). */
    public List<Hour> next72Hours(double latitude, double longitude) {
        Forecast forecast;
        try {
            forecast = restClient.get()
                    .uri(uri -> uri.path("/v1/forecast")
                            .queryParam("latitude", latitude)
                            .queryParam("longitude", longitude)
                            .queryParam("hourly", "temperature_2m,relative_humidity_2m")
                            .queryParam("forecast_days", 3)
                            .queryParam("timezone", "auto")
                            .build())
                    .retrieve()
                    .body(Forecast.class);
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Weather forecast is unavailable right now.");
        }
        if (forecast == null || forecast.hourly() == null || forecast.hourly().time() == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Weather forecast is unavailable right now.");
        }

        Hourly hourly = forecast.hourly();
        List<Hour> hours = new ArrayList<>();
        for (int i = 0; i < hourly.time().size(); i++) {
            Double temperature = hourly.temperature_2m().get(i);
            Double humidity = hourly.relative_humidity_2m().get(i);
            if (temperature != null && humidity != null) {
                hours.add(new Hour(hourly.time().get(i), temperature, humidity));
            }
        }
        return hours;
    }
}
