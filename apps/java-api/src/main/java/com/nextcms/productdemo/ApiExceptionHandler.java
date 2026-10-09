package com.nextcms.productdemo;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/**
 * Turns multipart-level failures into the same {success:false, error}
 * 400 body the Express version returns, instead of Spring's default error page.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> tooLarge(MaxUploadSizeExceededException e) {
        log.warn("Product upload rejected: {}", e.getMessage());
        return bad("File too large (max 5 MB per image)");
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<Map<String, Object>> missingPart(MissingServletRequestPartException e) {
        log.warn("Product upload rejected: {}", e.getMessage());
        if ("productImage".equals(e.getRequestPartName())) {
            return bad("At least one productImage is required");
        }
        return bad("`" + e.getRequestPartName() + "` part is required");
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<Map<String, Object>> multipart(MultipartException e) {
        log.warn("Product upload rejected: {}", e.getMessage());
        return bad("Upload failed: " + e.getMessage());
    }

    static ResponseEntity<Map<String, Object>> bad(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("error", message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
