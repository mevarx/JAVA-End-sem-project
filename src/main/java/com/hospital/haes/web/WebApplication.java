package com.hospital.haes.web;

import com.hospital.haes.web.config.HaesProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Web entry point. This is a separate client of the same service layer the JavaFX
 * application uses; it does not replace or duplicate any scheduling logic.
 */
@SpringBootApplication
@EnableConfigurationProperties(HaesProperties.class)
@EnableScheduling
public class WebApplication {

    public static void main(String[] args) {
        SpringApplication.run(WebApplication.class, args);
    }
}
