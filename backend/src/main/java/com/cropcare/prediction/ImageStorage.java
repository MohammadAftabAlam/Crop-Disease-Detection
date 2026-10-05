package com.cropcare.prediction;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.cropcare.common.ApiException;
import com.cropcare.config.AppProperties;

/** Saves uploaded leaf photos under the uploads folder with random names. */
@Component
public class ImageStorage {

    private final Path uploadDir;

    public ImageStorage(AppProperties props) throws IOException {
        this.uploadDir = Path.of(props.uploadDir()).toAbsolutePath().normalize();
        Files.createDirectories(uploadDir);
    }

    public Path save(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please upload a crop image.");
        }

        String extension = detectImageType(file);
        Path target = uploadDir.resolve(UUID.randomUUID() + "." + extension);
        try {
            file.transferTo(target);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not save uploaded image", e);
        }
        return target;
    }

    /** Path of a stored image; refuses names that would point outside the uploads folder. */
    public Path resolve(String filename) {
        Path path = uploadDir.resolve(filename).normalize();
        if (!path.startsWith(uploadDir) || !Files.isRegularFile(path)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Image not found");
        }
        return path;
    }

    public static String contentType(Path image) {
        String name = image.getFileName().toString();
        if (name.endsWith(".png")) {
            return "image/png";
        }
        return name.endsWith(".webp") ? "image/webp" : "image/jpeg";
    }

    public void delete(Path image) {
        try {
            Files.deleteIfExists(image);
        } catch (IOException ignored) {
            // Leftover file is harmless
        }
    }

    /** Checks the file's first bytes rather than trusting its name or the browser's content type. */
    private static String detectImageType(MultipartFile file) {
        byte[] header;
        try (InputStream in = file.getInputStream()) {
            header = in.readNBytes(12);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read uploaded image", e);
        }

        if (header.length >= 3 && (header[0] & 0xFF) == 0xFF && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (header.length >= 8 && (header[0] & 0xFF) == 0x89 && header[1] == 'P' && header[2] == 'N' && header[3] == 'G') {
            return "png";
        }
        if (header.length >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P') {
            return "webp";
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Only JPG, PNG and WEBP images are allowed.");
    }
}
