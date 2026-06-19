package com.apm.inventory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Leaf service. Returns stock for a SKU. The OpenTelemetry Java agent
 * auto-instruments this controller, so every request becomes a span that
 * is automatically linked to the caller's trace via propagated headers.
 */
@RestController
public class InventoryController {

    private static final Logger log = LoggerFactory.getLogger(InventoryController.class);

    private final Map<String, Integer> stock = new ConcurrentHashMap<>(Map.of(
            "SKU-001", 42,
            "SKU-002", 7,
            "SKU-003", 0
    ));

    @GetMapping("/inventory/{sku}")
    public Map<String, Object> getStock(@PathVariable String sku) throws InterruptedException {
        // Simulate variable DB latency so traces show realistic timing.
        Thread.sleep(ThreadLocalRandom.current().nextInt(20, 120));
        int available = stock.getOrDefault(sku, 0);
        log.info("Stock lookup sku={} available={}", sku, available);
        return Map.of(
                "sku", sku,
                "available", available,
                "inStock", available > 0
        );
    }
}
