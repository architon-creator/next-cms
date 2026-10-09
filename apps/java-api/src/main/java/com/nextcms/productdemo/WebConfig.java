package com.nextcms.productdemo;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Serves the stored images at /uploads/** (the URLs returned by the API). */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final ImageStorageService storage;

    public WebConfig(ImageStorageService storage) {
        this.storage = storage;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(storage.uploadDir().toUri().toString());
    }
}
