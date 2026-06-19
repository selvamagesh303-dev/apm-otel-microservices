package com.apm.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Public entry point. A request here starts a trace; the call to
 * order-service (which in turn calls inventory-service) produces a single
 * end-to-end distributed trace across all three services in the APM backend.
 */
@RestController
public class GatewayController {

    private static final Logger log = LoggerFactory.getLogger(GatewayController.class);

    private final RestTemplate restTemplate;
    private final String orderUrl;

    public GatewayController(RestTemplate restTemplate,
                             @Value("${order.service.url:http://localhost:8081}") String orderUrl) {
        this.restTemplate = restTemplate;
        this.orderUrl = orderUrl;
    }

    @PostMapping("/api/checkout/{sku}")
    @SuppressWarnings("unchecked")
    public Map<String, Object> checkout(@PathVariable String sku) {
        log.info("Checkout request for sku={}", sku);
        return restTemplate.postForObject(
                orderUrl + "/orders/{sku}", null, Map.class, sku);
    }
}
