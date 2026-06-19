package com.apm.order;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.UUID;

/**
 * Mid-tier service. Receives an order request, calls inventory-service to
 * check stock, then decides whether the order is accepted. The call to
 * inventory-service propagates the current trace context downstream.
 */
@RestController
public class OrderController {

    private static final Logger log = LoggerFactory.getLogger(OrderController.class);

    private final RestTemplate restTemplate;
    private final String inventoryUrl;

    public OrderController(RestTemplate restTemplate,
                           @Value("${inventory.service.url:http://localhost:8082}") String inventoryUrl) {
        this.restTemplate = restTemplate;
        this.inventoryUrl = inventoryUrl;
    }

    @PostMapping("/orders/{sku}")
    @SuppressWarnings("unchecked")
    public Map<String, Object> createOrder(@PathVariable String sku) {
        log.info("Creating order for sku={}", sku);

        Map<String, Object> inventory = restTemplate.getForObject(
                inventoryUrl + "/inventory/{sku}", Map.class, sku);

        boolean inStock = inventory != null && Boolean.TRUE.equals(inventory.get("inStock"));
        String status = inStock ? "CONFIRMED" : "BACKORDERED";
        String orderId = UUID.randomUUID().toString();

        log.info("Order {} for sku={} -> {}", orderId, sku, status);
        return Map.of(
                "orderId", orderId,
                "sku", sku,
                "status", status,
                "inventory", inventory == null ? Map.of() : inventory
        );
    }
}
