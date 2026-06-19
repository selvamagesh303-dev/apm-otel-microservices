# Multi-stage build shared by all three services.
# Pass the module name via build arg, e.g. --build-arg SERVICE=gateway-service
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY gateway-service/pom.xml gateway-service/
COPY order-service/pom.xml order-service/
COPY inventory-service/pom.xml inventory-service/
# Pre-fetch dependencies (cached layer)
RUN mvn -q -e -B dependency:go-offline || true
COPY . .
ARG SERVICE
RUN mvn -q -B -pl ${SERVICE} -am clean package -DskipTests

FROM eclipse-temurin:21-jre AS runtime
ARG SERVICE
WORKDIR /app

# Download the OpenTelemetry Java auto-instrumentation agent.
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

COPY --from=build /workspace/${SERVICE}/target/${SERVICE}.jar /app/app.jar

# The agent reads OTEL_* env vars (set in docker-compose) for endpoint & service name.
ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "/app/app.jar"]
