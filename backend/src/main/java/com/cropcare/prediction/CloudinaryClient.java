package com.cropcare.prediction;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import com.cropcare.config.AppProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Stores leaf photos on Cloudinary (signed upload API) instead of the backend's disk, so the
 * backend can be hosted on a server with no permanent storage and photos come from a CDN.
 * Each photo gets a random name, so its link cannot be guessed; the link is only ever given to
 * the scan's owner through the authenticated API.
 */
@Component
public class CloudinaryClient {

    private final AppProperties.Cloudinary settings;
    private final RestClient restClient;

    public CloudinaryClient(AppProperties props) {
        this.settings = props.cloudinary();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(60));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    public boolean isConfigured() {
        return settings != null && settings.configured();
    }

    /** True for a stored value that is a Cloudinary (or any https) link rather than a local file name. */
    public static boolean isRemote(String stored) {
        return stored != null && (stored.startsWith("https://") || stored.startsWith("http://"));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UploadResponse(@JsonProperty("secure_url") String secureUrl, @JsonProperty("public_id") String publicId) {
    }

    /** Uploads one image and returns its https link. Throws if Cloudinary refuses or cannot be reached. */
    public String upload(Path image) {
        // Signed request: SHA-1 of the sorted parameters followed by the API secret
        Map<String, String> signed = new TreeMap<>();
        signed.put("folder", settings.folder());
        signed.put("public_id", UUID.randomUUID().toString());
        signed.put("timestamp", String.valueOf(Instant.now().getEpochSecond()));

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", new FileSystemResource(image));
        signed.forEach(form::add);
        form.add("api_key", settings.apiKey());
        form.add("signature", sign(signed, settings.apiSecret()));

        UploadResponse response = restClient.post()
                .uri(settings.apiUrl() + "/" + settings.cloudName() + "/image/upload")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(form)
                .retrieve()
                .body(UploadResponse.class);
        if (response == null || response.secureUrl() == null || response.secureUrl().isBlank()) {
            throw new IllegalStateException("Cloudinary returned no image link");
        }
        return response.secureUrl();
    }

    static String sign(Map<String, String> sortedParams, String apiSecret) {
        String toSign = sortedParams.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining("&")) + apiSecret;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(toSign.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
