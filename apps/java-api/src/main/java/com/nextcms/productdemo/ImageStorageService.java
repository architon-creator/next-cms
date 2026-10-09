package com.nextcms.productdemo;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Writes uploaded files (images and PDFs) to disk and hands back their public URL. Swap this
 * class for S3 / Prismic assets in a real service; the controller only needs
 * a URL back.
 */
@Service
public class ImageStorageService {

    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/gif", ".gif",
            "image/webp", ".webp",
            "application/pdf", ".pdf");

    private final Path uploadDir;

    public ImageStorageService(@Value("${app.upload-dir}") String uploadDir) {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public Path uploadDir() {
        return uploadDir;
    }

    /**
     * Deletes a file previously returned by {@link #store}. Only the last path
     * segment of the URL is used, and the result must stay inside the upload
     * directory, so it can never point elsewhere. Missing files are ignored.
     */
    public void delete(String url) {
        try {
            Path name = Path.of(URI.create(url).getPath()).getFileName();
            Path target = uploadDir.resolve(name).normalize();
            if (target.startsWith(uploadDir)) {
                Files.deleteIfExists(target);
            }
        } catch (IOException | IllegalArgumentException e) {
            // Already gone (or not ours): nothing to clean up.
        }
    }

    /**
     * Stores the file as {@code <id>-<random8>.<ext>} so each URL traces back
     * to the payload item it came from, even if identical bytes are uploaded
     * twice. {@code id} has already been validated against a safe charset.
     */
    public String store(String id, MultipartFile file) throws IOException {
        Files.createDirectories(uploadDir);
        String ext = EXTENSIONS.getOrDefault(file.getContentType(), "");
        String stored = id + "-" + UUID.randomUUID().toString().substring(0, 8) + ext;
        file.transferTo(uploadDir.resolve(stored));
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/")
                .path(stored)
                .toUriString();
    }
}
