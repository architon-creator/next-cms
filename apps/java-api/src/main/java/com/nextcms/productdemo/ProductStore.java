package com.nextcms.productdemo;

import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Database-backed product store (H2 file database, see application.properties).
 *
 * <p>The controller works with the API's JSON shape
 * ({@code { category, product: { ..., productImage: [{ image, description }], productPdf } }});
 * this class maps it to and from the tables:
 * <ul>
 *   <li>{@code product}: category, ssr_code, price, pdf_url and the remaining
 *       product fields as JSON in {@code details};</li>
 *   <li>{@code product_image}: one row per image (url, description, position).</li>
 * </ul>
 * Because the image rows are in the database, an update can compare the
 * current images with the submitted ones even after a server restart.
 */
@Component
public class ProductStore {

    private final ProductRepository repository;
    private final ObjectMapper mapper;

    public ProductStore(ProductRepository repository, ObjectMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Optional<ObjectNode> find(String id) {
        return repository.findById(id).map(this::toData);
    }

    /** Inserts the product, or replaces it (and its image rows) if the id exists. */
    @Transactional
    public void save(String id, ObjectNode data) {
        ProductEntity entity = repository.findById(id).orElseGet(() -> {
            ProductEntity created = new ProductEntity();
            created.setId(id);
            return created;
        });

        ObjectNode product = ((ObjectNode) data.get("product")).deepCopy();
        JsonNode images = product.remove("productImage");
        JsonNode pdf = product.remove("productPdf");

        entity.setCategory(data.get("category").asText());
        entity.setSsrCode(product.path("ssrCode").asText());
        entity.setPrice(product.path("price").asDouble());
        entity.setPdfUrl(pdf == null || pdf.isNull() ? null : pdf.asText());
        try {
            entity.setDetails(mapper.writeValueAsString(product));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise product details", e);
        }

        // Replace the image rows: rows no longer in the list are deleted
        // (orphanRemoval), the rest are re-inserted in the new order.
        entity.getImages().clear();
        int position = 0;
        if (images != null) {
            for (JsonNode image : images) {
                ProductImageEntity row = new ProductImageEntity();
                row.setProduct(entity);
                row.setPosition(position++);
                row.setUrl(image.path("image").asText());
                row.setDescription(image.has("description") ? image.get("description").asText() : null);
                entity.getImages().add(row);
            }
        }
        repository.save(entity);
    }

    private ObjectNode toData(ProductEntity entity) {
        ObjectNode product;
        try {
            product = (ObjectNode) mapper.readTree(entity.getDetails());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored product details are not valid JSON", e);
        }

        ArrayNode images = mapper.createArrayNode();
        for (ProductImageEntity row : entity.getImages()) {
            ObjectNode image = images.addObject();
            image.put("image", row.getUrl());
            if (row.getDescription() != null) {
                image.put("description", row.getDescription());
            }
        }
        product.set("productImage", images);
        if (entity.getPdfUrl() != null) {
            product.put("productPdf", entity.getPdfUrl());
        }

        ObjectNode data = mapper.createObjectNode();
        data.put("category", entity.getCategory());
        data.set("product", product);
        return data;
    }
}
