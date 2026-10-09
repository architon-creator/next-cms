package com.nextcms.productdemo;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/**
 * Table {@code product}. The queryable fields get their own columns, the
 * remaining product fields are kept as JSON in {@code details}, and the
 * product's images live in their own table ({@link ProductImageEntity}).
 */
@Entity
@Table(name = "product")
public class ProductEntity {

    @Id
    @Column(length = 36)
    private String id;

    private String category;

    private String ssrCode;

    private double price;

    /** Stored PDF URL, or null when the product has no PDF. */
    @Column(length = 1000)
    private String pdfUrl;

    /** The product JSON without productImage / productPdf. */
    @Column(columnDefinition = "CLOB")
    private String details;

    /**
     * One row per image, in display order. Removing an image from this list
     * deletes its row (orphanRemoval).
     */
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<ProductImageEntity> images = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getSsrCode() {
        return ssrCode;
    }

    public void setSsrCode(String ssrCode) {
        this.ssrCode = ssrCode;
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    public String getPdfUrl() {
        return pdfUrl;
    }

    public void setPdfUrl(String pdfUrl) {
        this.pdfUrl = pdfUrl;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public List<ProductImageEntity> getImages() {
        return images;
    }
}
