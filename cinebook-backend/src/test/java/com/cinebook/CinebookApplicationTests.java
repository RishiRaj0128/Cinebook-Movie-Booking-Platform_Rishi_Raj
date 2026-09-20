package com.cinebook;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class CinebookApplicationTests {

    @Test
    void contextLoads() {
        // Minimal real test verifying that the Spring Boot ApplicationContext initializes properly
    }
}
