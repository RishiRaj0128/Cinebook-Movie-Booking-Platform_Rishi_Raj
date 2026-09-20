# Multi-stage Dockerfile for CineBook Spring Boot Backend
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Create unprivileged application group and user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy compiled jar and assign ownership
COPY --from=build --chown=appuser:appgroup /app/target/cinebook-backend-1.0.0.jar app.jar

USER appuser

EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=postgres
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:TieredStopAtLevel=1", "-Xms128m", "-Xmx320m", "-XX:MaxMetaspaceSize=160m", "-XX:+UseSerialGC", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
