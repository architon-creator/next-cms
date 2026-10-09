package com.nextcms.productdemo;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Java version of apps/api's product-demo controller: create, read and update
 * for {@code /demo/products}.
 *
 * <p>Create and update take a {@code multipart/form-data} request with a JSON
 * {@code payload} text part plus {@code productImage} file parts and an
 * optional {@code productPdf} file part, and return the payload with each
 * stored file's id swapped for its URL.
 *
 * <p>How the request is read: Spring's multipart resolver splits the body
 * before the handler runs. Text parts (the JSON payload) are bound by
 * {@code @RequestParam}; every part named {@code productImage} that has a
 * filename is collected, in order, into the {@code List<MultipartFile>}.
 * {@link MultipartFile#getOriginalFilename()} is the part's filename, which
 * the frontend sets to the image id.
 *
 * <p>On update, each {@code productImage[].image} is either a NEW image id
 * (needs a matching file part) or the URL of one of the product's current
 * images (kept as is). Current images that are not listed are deleted.
 */
@RestController
@RequestMapping("/demo/products")
public class ProductDemoController {

    private static final Logger log = LoggerFactory.getLogger(ProductDemoController.class);

    private static final int MAX_IMAGES = 10;
    // Image ids end up in a filename, so keep them to a safe charset
    // (no path separators or dots).
    private static final Pattern IMAGE_ID = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final String PDF_MISMATCH =
            "product.productPdf id and the uploaded productPdf file do not match";

    private final ObjectMapper mapper;
    private final ImageStorageService storage;
    private final ProductStore store;

    public ProductDemoController(ObjectMapper mapper, ImageStorageService storage, ProductStore store) {
        this.mapper = mapper;
        this.storage = storage;
        this.store = store;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createProduct(
            @RequestParam(value = "payload", required = false) String payload,
            @RequestPart(value = "productImage", required = false) List<MultipartFile> files,
            @RequestPart(value = "productPdf", required = false) MultipartFile productPdf,
            HttpServletRequest request) throws IOException {
        return save(null, payload, files, productPdf, request);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateProduct(
            @PathVariable String id,
            @RequestParam(value = "payload", required = false) String payload,
            @RequestPart(value = "productImage", required = false) List<MultipartFile> files,
            @RequestPart(value = "productPdf", required = false) MultipartFile productPdf,
            HttpServletRequest request) throws IOException {
        if (store.find(id).isEmpty()) {
            return notFound();
        }
        return save(id, payload, files, productPdf, request);
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getProduct(@PathVariable String id) {
        return store.find(id)
                .<ResponseEntity<?>>map(data -> ResponseEntity.ok(envelope(id, data)))
                .orElseGet(ProductDemoController::notFound);
    }

    /**
     * Shared by create ({@code existingId == null}) and update. Validates
     * everything first, and only then writes/deletes files, so a rejected
     * request never leaves the stored product half-changed.
     */
    private ResponseEntity<?> save(
            String existingId,
            String payload,
            List<MultipartFile> files,
            MultipartFile productPdf,
            HttpServletRequest request) throws IOException {

        ObjectNode existing = existingId == null ? null : store.find(existingId).orElse(null);
        List<MultipartFile> images = files == null ? List.of() : files;

        // Debug: what was received. Remove once the request format is settled.
        log.info("[product-demo] {} content-type: {}", existingId == null ? "create" : "update " + existingId,
                request.getContentType());
        log.info("[product-demo] payload part: {}", payload);
        for (MultipartFile f : images) {
            log.info("[product-demo] file part: fieldname={} originalFilename={} contentType={} size={}",
                    f.getName(), f.getOriginalFilename(), f.getContentType(), f.getSize());
        }
        if (productPdf != null) {
            log.info("[product-demo] pdf part: fieldname={} originalFilename={} contentType={} size={}",
                    productPdf.getName(), productPdf.getOriginalFilename(), productPdf.getContentType(),
                    productPdf.getSize());
        }

        // 1. Files: images only, at most MAX_IMAGES (size is capped by
        //    spring.servlet.multipart.max-file-size).
        if (images.size() > MAX_IMAGES) {
            return error("Too many files (max " + MAX_IMAGES + " images)");
        }
        for (MultipartFile f : images) {
            if (f.getContentType() == null || !f.getContentType().startsWith("image/")) {
                return error("Only image files are allowed");
            }
        }
        if (productPdf != null && !"application/pdf".equals(productPdf.getContentType())) {
            return error("Only PDF files are allowed for productPdf");
        }

        // 2. Payload JSON.
        JsonNode root;
        try {
            root = mapper.readTree(payload == null ? "" : payload);
        } catch (JsonProcessingException e) {
            return error("`payload` must be valid JSON");
        }
        if (root == null || !root.isObject()) {
            return error("`payload` must be valid JSON");
        }

        JsonNode category = root.get("category");
        if (category == null || !category.isTextual() || category.asText().isEmpty()) {
            return error("category is required");
        }
        JsonNode product = root.get("product");
        if (product == null || !product.isObject()
                || !product.path("ssrCode").isTextual() || product.path("ssrCode").asText().isEmpty()) {
            return error("product.ssrCode is required");
        }
        JsonNode price = product.get("price");
        if (price == null || !price.isNumber() || price.asDouble() < 0) {
            return error("product.price must be a non-negative number");
        }

        // 3. product.productImage is a repeatable group: [{ image, description }].
        //    `image` is either a NEW image id (must match the filename of
        //    exactly one uploaded file part, so the pairing never depends on
        //    order) or, on update, the URL of one of this product's current
        //    images (kept as is, no file).
        Set<String> keptUrls = new LinkedHashSet<>();
        String currentPdf = null;
        if (existing != null) {
            for (JsonNode item : existing.path("product").path("productImage")) {
                keptUrls.add(item.path("image").asText());
            }
            currentPdf = existing.path("product").has("productPdf")
                    ? existing.path("product").get("productPdf").asText() : null;
        }

        JsonNode group = product.get("productImage");
        List<ObjectNode> items = new ArrayList<>();
        if (group == null || !group.isArray()) {
            return invalidGroup(existing != null);
        }
        for (JsonNode item : group) {
            if (!item.isObject()
                    || !item.path("image").isTextual()
                    || !(IMAGE_ID.matcher(item.path("image").asText()).matches()
                        || keptUrls.contains(item.path("image").asText()))
                    || (item.has("description") && !item.get("description").isTextual())) {
                return invalidGroup(existing != null);
            }
            items.add((ObjectNode) item);
        }

        List<String> ids = items.stream().map(i -> i.get("image").asText()).toList();
        if (new HashSet<>(ids).size() != ids.size()) {
            return error("product.productImage contains duplicate image ids");
        }
        // The limit is on the product's total images (kept + new), not just the
        // files uploaded in this request.
        if (ids.size() > MAX_IMAGES) {
            return error("Too many images (max " + MAX_IMAGES + " per product)");
        }
        List<String> newIds = ids.stream().filter(id -> !keptUrls.contains(id)).toList();
        if (images.isEmpty() && newIds.size() == ids.size()) {
            return error("At least one productImage is required");
        }

        Map<String, MultipartFile> filesById = new LinkedHashMap<>();
        for (MultipartFile f : images) {
            if (filesById.put(f.getOriginalFilename(), f) != null) {
                return error("Uploaded productImage files have duplicate ids");
            }
        }
        List<String> missing = newIds.stream().filter(id -> !filesById.containsKey(id)).toList();
        Set<String> newIdSet = new HashSet<>(newIds);
        List<String> unreferenced = filesById.keySet().stream().filter(name -> !newIdSet.contains(name)).toList();
        if (!missing.isEmpty() || !unreferenced.isEmpty()) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", false);
            body.put("error", "product.productImage ids and uploaded files do not match");
            body.put("missingFiles", missing);
            body.put("unreferencedFiles", unreferenced);
            return ResponseEntity.badRequest().body(body);
        }

        // Optional single PDF. product.productPdf is one of:
        //   absent      -> no PDF (on update: removes the current one)
        //   current URL -> keep the stored PDF (update only; no file part)
        //   new id      -> must match the filename of the uploaded productPdf part
        JsonNode pdfNode = product.get("productPdf");
        if (pdfNode != null && pdfNode.isNull()) {
            pdfNode = null;
        }
        String pdfAction = "none";
        if (pdfNode == null) {
            if (productPdf != null) {
                return error(PDF_MISMATCH);
            }
        } else if (pdfNode.isTextual() && currentPdf != null && pdfNode.asText().equals(currentPdf)) {
            if (productPdf != null) {
                return error(PDF_MISMATCH);
            }
            pdfAction = "keep";
        } else if (pdfNode.isTextual() && IMAGE_ID.matcher(pdfNode.asText()).matches()) {
            if (productPdf == null || !pdfNode.asText().equals(productPdf.getOriginalFilename())) {
                return error(PDF_MISMATCH);
            }
            pdfAction = "new";
        } else {
            return error(existing != null
                    ? "product.productPdf must be a new id (letters, digits, - and _) or the product's current PDF URL"
                    : "product.productPdf must be an id (letters, digits, - and _)");
        }

        // ---- validation done. Order matters: (1) write the new files, (2) save
        // the product and its image rows in the database, (3) only then delete
        // the files that are no longer referenced. If the database write fails,
        // the new files are removed again and the old ones are untouched.
        List<String> newUrls = new ArrayList<>();
        ArrayNode stored = mapper.createArrayNode();
        for (ObjectNode item : items) {
            String id = item.get("image").asText();
            ObjectNode out = item.deepCopy();
            if (!keptUrls.contains(id)) {
                String url = storage.store(id, filesById.get(id));
                newUrls.add(url);
                out.put("image", url);
            }
            stored.add(out);
        }

        String pdfUrl = null;
        if (pdfAction.equals("keep")) {
            pdfUrl = currentPdf;
        } else if (pdfAction.equals("new")) {
            pdfUrl = storage.store(pdfNode.asText(), productPdf);
            newUrls.add(pdfUrl);
        }

        ObjectNode outProduct = ((ObjectNode) product).deepCopy();
        outProduct.remove("productPdf");
        outProduct.set("productImage", stored);
        if (pdfUrl != null) {
            outProduct.put("productPdf", pdfUrl);
        }
        ObjectNode data = mapper.createObjectNode();
        data.set("category", category);
        data.set("product", outProduct);

        String id = existingId != null ? existingId : UUID.randomUUID().toString();
        try {
            store.save(id, data);
        } catch (RuntimeException e) {
            newUrls.forEach(storage::delete);
            throw e;
        }

        if (existing != null) {
            Set<String> stillUsed = new HashSet<>();
            stored.forEach(n -> stillUsed.add(n.path("image").asText()));
            for (String url : keptUrls) {
                if (!stillUsed.contains(url)) {
                    storage.delete(url);
                }
            }
            if (currentPdf != null && !pdfAction.equals("keep")) {
                storage.delete(currentPdf);
            }
        }

        log.info("[product-demo] product {}: id={} category={} ssrCode={} imageCount={} hasPdf={}",
                existingId == null ? "received" : "updated", id, category.asText(),
                product.get("ssrCode").asText(), stored.size(), pdfUrl != null);
        return ResponseEntity.status(existingId == null ? HttpStatus.CREATED : HttpStatus.OK)
                .body(envelope(id, data));
    }

    private ObjectNode envelope(String id, ObjectNode data) {
        ObjectNode body = mapper.createObjectNode();
        body.put("success", true);
        body.put("id", id);
        body.set("data", data);
        return body;
    }

    private static ResponseEntity<Map<String, Object>> notFound() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("error", "Product not found");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    private static ResponseEntity<Map<String, Object>> invalidGroup(boolean update) {
        return error(update
                ? "product.productImage must be a list of { image, description } where image is a new id "
                    + "(letters, digits, - and _) or one of the product's current image URLs"
                : "product.productImage must be a list of { image, description } "
                    + "where image is an id (letters, digits, - and _)");
    }

    private static ResponseEntity<Map<String, Object>> error(String message) {
        return ApiExceptionHandler.bad(message);
    }
}
