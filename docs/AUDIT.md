# CineBook System Audit Report (DevOps, Architecture & Reliability)

> **Audit Date**: 2026-11-15  
> **Auditor**: Senior Platform / SRE Engineer  
> **Scope**: Repository-wide read-only inspection of `CineBook` (`cinebook-backend`, `cinebook-frontend`, `.github`, and root configurations)  
> **Status**: Read-only complete — No application code or existing features modified.

---

## 1. Tech Stack and Exact Versions

All versions below are verified directly from source configuration files (`pom.xml`, `package.json`, and `Dockerfile`).

### 1.1 Backend (`cinebook-backend`)
*Source: `cinebook-backend/pom.xml`, `cinebook-backend/Dockerfile`*

| Component / Library | Artifact / Image | Declared Version | Role |
|---|---|---|---|
| **Java Platform** | OpenJDK / Temurin | `21` (`<java.version>21</java.version>`) | Runtime execution platform |
| **Framework** | `org.springframework.boot:spring-boot-starter-parent` | `3.3.5` | Core enterprise application framework |
| **Build Tool** | Apache Maven | `3.9.6` (Docker) / `3.9.9` (Host) | Dependency resolution and build lifecycle |
| **Compiler Plugin** | `org.apache.maven.plugins:maven-compiler-plugin` | `3.16.0` (target release `21`) | Java 21 bytecode compilation |
| **AI Integration** | `org.springframework.ai:spring-ai-bom` | `1.0.0-M1` | Spring AI BOM (`spring-ai-openai-spring-boot-starter`) |
| **Database Migrations** | `org.flywaydb:flyway-core` & `flyway-database-postgresql` | `10.10.0` (managed by Spring Boot 3.3.5) | Relational schema versioning |
| **PostgreSQL Driver** | `org.postgresql:postgresql` | `42.7.4` (managed, runtime) | Production JDBC driver |
| **In-Memory Database** | `com.h2database:h2` | `2.2.224` (managed, runtime) | Local test/fallback JDBC driver |
| **Redis Client** | `org.springframework.boot:spring-boot-starter-data-redis` | `3.3.5` (managed) | Cache & distributed session client |
| **Authentication & Tokens** | `io.jsonwebtoken:jjwt-api`, `jjwt-impl`, `jjwt-jackson` | `0.12.6` | Stateless JWT issuance and validation |
| **Payment SDK** | `com.razorpay:razorpay-java` | `1.4.10` | Razorpay order and gateway integration |
| **QR Code Engine** | `com.google.zxing:core`, `zxing:javase` | `3.5.4` | Universal gate ticket QR generation |
| **Object Mapping** | `org.mapstruct:mapstruct` & `mapstruct-processor` | `1.6.3` | Type-safe compile-time DTO mappers |
| **Boilerplate Reduction**| `org.projectlombok:lombok` | `1.18.36` | Compile-time getter/setter/builder generator |
| **API Documentation** | `org.springdoc:springdoc-openapi-starter-webmvc-ui` | `2.6.0` | OpenAPI 3.0 / Swagger UI |
| **Code Style** | `org.apache.maven.plugins:maven-checkstyle-plugin` | `3.4.0` | Enforces checkstyle rules from `checkstyle.xml` |
| **Base Docker Build** | `maven:3.9.6-eclipse-temurin-21` | Stage 1 (Build) | Multi-stage build image |
| **Base Docker Runtime**| `eclipse-temurin:21-jre-alpine` | Stage 2 (Alpine Linux) | Lightweight unprivileged runtime image |

### 1.2 Frontend (`cinebook-frontend`)
*Source: `cinebook-frontend/package.json`, `cinebook-frontend/Dockerfile`*

| Component / Library | Package Name | Declared Version | Role |
|---|---|---|---|
| **Runtime Target** | Node.js | `20` (in CI/Docker) / `v22.23.2` (Host) | JavaScript runtime |
| **UI Library** | `react`, `react-dom` | `^18.3.1` | Component-based reactive UI |
| **Language** | `typescript` | `^5.6.3` | Static typing system |
| **Bundler & Dev Server**| `vite`, `@vitejs/plugin-react` | `^6.4.3` (`@vitejs/plugin-react: ^4.3.3`) | Fast ESM bundler & proxy |
| **Icons** | `lucide-react` | `^0.453.0` | UI vector iconography |
| **Client-side QR** | `qrcode`, `@types/qrcode` | `^1.5.4` (`@types/qrcode: ^1.5.6`) | In-browser canvas QR rendering |
| **Test Runner** | `vitest` | `^4.1.11` | Vite-native unit test execution |
| **Testing Utilities** | `@testing-library/react`, `dom`, `jest-dom` | `react: ^16.3.3`, `dom: ^10.4.2`, `jest-dom: ^6.9.1` | DOM component testing assertions |
| **DOM Simulation** | `jsdom` | `^25.0.1` | Headless browser DOM environment |
| **Linter & Formatter** | `eslint`, `prettier` | `eslint: ^8.57.1`, `prettier: ^3.9.8` | Code formatting and rule enforcement |
| **Base Docker Build** | `node:20-alpine` | Stage 1 (Build) | Frontend builder image |
| **Base Docker Runtime**| `nginxinc/nginx-unprivileged:alpine` | Stage 2 (Nginx Alpine) | Static asset server (Non-root user UID 101) |

---

## 2. Environment Variables and Secrets Required

> **Compliance Note**: In accordance with security best practices, variable names only are listed below. No real values or credentials are disclosed.

### 2.1 Backend Environment Variables (`cinebook-backend`)
*Sources: `cinebook-backend/src/main/resources/application.yml`, `application-local.yml`, and Java source code*

| Environment Variable Name | Configuration Path in `application.yml` | Default / Fallback Behavior |
|---|---|---|
| `PORT` | `server.port` | Defaults to `8080` |
| `SPRING_PROFILES_ACTIVE` | `spring.profiles.active` | Defaults to `local` (uses H2 in-memory DB) |
| `SPRING_DATASOURCE_URL` | `spring.datasource.url` | Defaults to `jdbc:postgresql://localhost:5432/cinebook` |
| `DB_USER` | `spring.datasource.username` | Defaults to `postgres` |
| `DB_PASSWORD` | `spring.datasource.password` | Defaults to `postgres` |
| `JWT_SECRET` | `jwt.secret` | Defaults to hardcoded fallback in `application.yml` (must be overridden in production) |
| `TMDB_API_KEY` | `tmdb.api-key` | Used by `TmdbService` and `DataInitializer` for live movie fetching |
| `TMDB_BASE_URL` | `tmdb.base-url` | Defaults to `https://api.tmdb.org/3` |
| `GROQ_BASE_URL` | `spring.ai.openai.base-url` | Defaults to `https://api.groq.com/openai` |
| `GROQ_API_KEY` | `spring.ai.openai.api-key` | Required for Spring AI conversational movie recommendations |
| `GROQ_MODEL` | `spring.ai.openai.chat.options.model` | Defaults to `llama-3.3-70b-versatile` |
| `RAZORPAY_KEY_ID` | `razorpay.key-id` | Razorpay merchant public key identifier |
| `RAZORPAY_KEY_SECRET` | `razorpay.key-secret` | Razorpay merchant API secret |
| `RAZORPAY_WEBHOOK_SECRET`| `razorpay.webhook-secret` | Shared secret for verifying HMAC-SHA256 signatures |
| `REDIS_HOST` | `spring.data.redis.host` | Defaults to `localhost` |
| `REDIS_PORT` | `spring.data.redis.port` | Defaults to `6379` |
| `MAIL_HOST` | `spring.mail.host` | Defaults to `smtp.gmail.com` |
| `MAIL_PORT` | `spring.mail.port` | Defaults to `587` |
| `MAIL_USER` | `spring.mail.username` | Empty string fallback |
| `MAIL_PASSWORD` | `spring.mail.password` | Empty string fallback |
| `CORS_ORIGINS` | `app.cors.allowed-origins` | Defaults to `*` |
| `FRONTEND_URL` | `app.frontend-url` | Defaults to `https://coruscating-eclair-2724dd.netlify.app/` |

### 2.2 Frontend Environment Variables (`cinebook-frontend`)
*Sources: `cinebook-frontend/src/services/api.ts`, `cinebook-frontend/.env`*

| Environment Variable Name | Usage in Code | Fallback Behavior |
|---|---|---|
| `VITE_API_BASE_URL` | `import.meta.env.VITE_API_BASE_URL` | In dev mode, defaults to empty string `''` (routes through Vite `/api` reverse proxy to `http://localhost:8080`). In production build without proxy, falls back to `https://cinebook-api-6cw7.onrender.com/api`. |

---

## 3. Build, Test, and Runtime Commands, Ports, and Health Endpoints

### 3.1 Backend Lifecycle Commands
All commands run from directory `d:\Movie Booking System-II\cinebook-backend`:

- **Build / Compile (Skip Tests)**:
  ```powershell
  mvn clean package -DskipTests
  ```
- **Execute Verification & Unit/Integration Tests**:
  ```powershell
  mvn clean verify
  ```
- **Execute Code Style Verification**:
  ```powershell
  mvn checkstyle:check
  ```
- **Run Application Locally (H2 Profile)**:
  ```powershell
  mvn spring-boot:run
  # Or with specific profile:
  mvn spring-boot:run -Dspring-boot.run.profiles=local
  ```
- **Run Standalone Packaged JAR**:
  ```powershell
  java -jar target/cinebook-backend-1.0.0.jar
  ```
- **Default Application Port**: `8080` (overridden via `$PORT`).
- **Swagger / OpenAPI UI**: `http://localhost:8080/swagger-ui.html` (OpenAPI schema: `http://localhost:8080/api-docs`).

### 3.2 Frontend Lifecycle Commands
All commands run from directory `d:\Movie Booking System-II\cinebook-frontend`:

- **Install Dependencies**:
  ```powershell
  npm ci
  ```
- **Start Local Development Server**:
  ```powershell
  npm run dev
  # Runs: vite --port 3000 --host
  ```
- **Build Production Static Bundle**:
  ```powershell
  npm run build
  # Runs: tsc && vite build (outputs to dist/)
  ```
- **Run Type Checks**:
  ```powershell
  npx tsc --noEmit
  ```
- **Run Linter**:
  ```powershell
  npm run lint
  # Runs: eslint src --ext .ts,.tsx
  ```
- **Run Formatting Validation**:
  ```powershell
  npm run format:check
  # Runs: prettier --check "src/**/*.{ts,tsx,css}"
  ```
- **Run Unit / Smoke Tests**:
  ```powershell
  npm test
  # Runs: vitest run
  ```
- **Default Development Port**: `3000` (reverse proxies `/api` to backend `http://localhost:8080`).
- **Default Container Server Port**: `8080` (configured in `cinebook-frontend/nginx.conf` via `listen 8080;`).

### 3.3 Health Endpoint & Actuator Status
- **Actuator Dependency**: Present in `pom.xml` (`org.springframework.boot:spring-boot-starter-actuator`).
- **Exposed Endpoints** (`application.yml` lines 97-105):
  - `management.endpoints.web.exposure.include: health,info,metrics`
  - `management.endpoint.health.show-details: when-authorized`
- **Security Access** (`com.cinebook.config.SecurityConfig` line 59):
  - `/actuator/health` and `/actuator/info` are permitted anonymously (`permitAll()`).
  - `/actuator/metrics` currently requires authentication (`anyRequest().authenticated()`).
- **Prometheus Status**: `micrometer-registry-prometheus` is **NOT** present in `pom.xml`. Therefore, the standard metrics endpoint `/actuator/prometheus` does not exist yet.
- **Kubernetes Probes Status**: Liveness and readiness probe groups (`/actuator/health/liveness`, `/actuator/health/readiness`) are not explicitly enabled via `management.endpoint.health.probes.enabled=true`.

---

## 4. Existing Tests

### 4.1 Backend Test Inventory (Total: 19 Tests)
*Location: `cinebook-backend/src/test/java/com/cinebook/`*

| Test File | Test Method Count | Test Categories & Coverage |
|---|---|---|
| `CinebookApplicationTests.java` | 1 | **Context Load**: Validates that Spring Boot `ApplicationContext` initializes under active profile `test` (`@SpringBootTest`). |
| `payment/PaymentConcurrencyAndIdempotencyTests.java` | 18 | **Enterprise Payment & Reliability Suite**: Covers rule validation accumulation pipeline, transaction state machine valid/invalid transitions, idempotency key replays and conflict detection, concurrent wallet debit race condition prevention (`PESSIMISTIC_WRITE`), lock timeout fail-fast behavior, double-entry ledger balance checks, HMAC-SHA256 signature verification & timing attack resistance, saga step orchestration and compensating rollbacks, mock gateway latency injection, and background stuck transaction sweeps. |

### 4.2 Frontend Test Inventory (Total: 1 Test)
*Location: `cinebook-frontend/src/`*

| Test File | Test Method Count | Coverage |
|---|---|---|
| `src/App.test.tsx` | 1 | **Smoke Test**: Verifies `App` renders inside `AuthProvider` without throwing unhandled exceptions. |
| `src/test/setup.ts` | 0 (Config) | Imports `@testing-library/jest-dom`. |

### 4.3 Test Assessment
- **Strong Areas**: The payment domain, double-entry ledger, idempotency engine, and wallet concurrency possess rigorous, multi-threaded unit/integration tests with `@ActiveProfiles("test")` and H2.
- **Deficient Areas**: Zero unit/integration tests exist for core movie booking controllers (`BookingController`, `MovieController`, `ShowController`), user registration/login flows (`AuthController`), or seat locking API integration. The frontend has only a single smoke test; no component tests exist for seat selection or booking confirmation.

---

## 5. Existing CI/CD, Containerization, and Deployment Configurations

### 5.1 Dockerfiles
1. **`cinebook-backend/Dockerfile`**:
   - **Type**: Multi-stage build.
   - **Stage 1**: `maven:3.9.6-eclipse-temurin-21 AS build` compiles source code into `/app/target/cinebook-backend-1.0.0.jar`.
   - **Stage 2**: `eclipse-temurin:21-jre-alpine`. Installs updates, creates non-root user `appuser:appgroup`, copies JAR with ownership, sets `USER appuser`.
   - **Entrypoint**: Tuned for 512MB RAM environments (Render Free Tier):  
     `java -XX:+UseContainerSupport -XX:TieredStopAtLevel=1 -Xms128m -Xmx320m -XX:MaxMetaspaceSize=160m -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -jar app.jar`
   - **Omissions**: Lacks a Docker `HEALTHCHECK` instruction. Hardcodes `ENV SPRING_PROFILES_ACTIVE=postgres` even though there is no `application-postgres.yml` file (falls back to `application.yml`).
2. **`cinebook-frontend/Dockerfile`**:
   - **Type**: Multi-stage build.
   - **Stage 1**: `node:20-alpine AS build` runs `npm ci` and `npm run build`.
   - **Stage 2**: `nginxinc/nginx-unprivileged:alpine`. Copies built `dist/` to `/usr/share/nginx/html` and custom `nginx.conf`.
   - **User & Port**: Runs as unprivileged user `101`, exposes port `8080`.

### 5.2 Container Orchestration (`docker-compose.yml`)
*Location: root `docker-compose.yml`*
- **Services Defined**:
  - `postgres`: Image `postgres:16`, environment `POSTGRES_DB: cinebook`, `POSTGRES_PASSWORD: postgres`, port `5432:5432`.
  - `redis`: Image `redis:7-alpine`, port `6379:6379`.
  - `backend`: Builds `./cinebook-backend`, depends on `postgres` and `redis`, port `8080:8080`.
  - `frontend`: Builds `./cinebook-frontend`, depends on `backend`, port `3000:80`.
- **Identified Defect**: The frontend service in `docker-compose.yml` maps host port `3000` to container port `80` (`3000:80`). However, `cinebook-frontend/nginx.conf` and `cinebook-frontend/Dockerfile` configure unprivileged Nginx to listen on port `8080`. Connecting to `http://localhost:3000` under this compose file results in a connection failure.

### 5.3 Cloud Deploy Configurations
1. **Netlify (`netlify.toml`)**:
   - Files present at root and in `cinebook-frontend/netlify.toml`.
   - Configures build base `cinebook-frontend`, publish directory `dist`.
   - Sets HTTP 200 reverse-proxy redirect: `/api/*` -> `https://cinebook-movie-booking-platform-rishi-raj.onrender.com/api/:splat`.
   - Configures SPA client-side fallback `/*` -> `/index.html`.
2. **Vercel (`cinebook-frontend/vercel.json`)**:
   - Provides SPA routing rewrite `/(.*)` -> `/index.html`.
3. **Render**:
   - No `render.yaml` infrastructure-as-code file is present in the repository; deployment was configured manually via Render's Web UI dashboard pointing to the GitHub repository.

### 5.4 GitHub Actions Workflows (`.github/workflows/`)
The repository contains 7 modular workflow files:
1. `backend-ci.yml`: Checks out code on push/PR to `main`, sets up JDK 21 Temurin, caches Maven repository, executes `mvn -B clean verify`, and uploads test report artifacts.
2. `frontend-ci.yml`: Sets up Node 20, runs `npm ci`, strict type-check `npx tsc --noEmit`, smoke tests `npm test`, builds production bundle `npm run build`, and archives `dist/`.
3. `code-quality.yml`: Runs `mvn checkstyle:check` on the backend and ESLint + Prettier check on the frontend.
4. `docker-security.yml`: Builds backend and frontend container images, runs Aqua Security Trivy config and OS vulnerability scans (fails on HIGH/CRITICAL), and on push to `main`, pushes tagged images to GitHub Container Registry (`ghcr.io`).
5. `security.yml`: Runs Gitleaks secret detection, GitHub CodeQL SAST for Java and JS/TS, and Semgrep OWASP Top 10 scans.
6. `dependency-security.yml`: Runs `npm audit`, OWASP Dependency-Check (Maven), and Google OSV-Scanner.
7. `quality-gate.yml`: Enterprise coordinator workflow that polls check runs to ensure all required security and quality gates pass.
8. `dependabot.yml`: Daily automated dependency update scans for Maven, npm, and GitHub Actions.

---

## 6. External Dependencies and Configuration Analysis

### 6.1 Relational Database (Neon PostgreSQL & Local PostgreSQL)
- **Configuration**: `spring.datasource.url`, `DB_USER`, `DB_PASSWORD`.
- **Connection Pool**: HikariCP configured with conservative sizing for serverless database stability (`maximum-pool-size: 5`, `minimum-idle: 1`, `connection-timeout: 30000`).
- **Schema Management**: Flyway manages schema evolution through two migrations in `cinebook-backend/src/main/resources/db/migration/`:
  - `V1__schema.sql`: 11 core tables (`users`, `movies`, `theaters`, `screens`, `seats`, `shows`, `show_seats`, `bookings`, `booking_seats`, `payments`, `reviews`).
  - `V2__payment_engine_ledger_idempotency.sql`: Tables for wallets, payment transactions, state machine transitions, double-entry ledger entries, and idempotency records.
- **Fallback**: In profile `local`, Spring Boot disables Flyway (`spring.flyway.enabled: false`) and uses in-memory H2 with `hibernate.ddl-auto: update`.

### 6.2 The Movie Database (TMDB)
- **Configuration**: `tmdb.api-key`, `tmdb.base-url` (default `https://api.tmdb.org/3`), `tmdb.image-base`.
- **Implementation**: `com.cinebook.service.TmdbService` invokes TMDB REST endpoints via Spring WebFlux `WebClient`. Synchronizes Indian cinema releases across Hindi, Telugu, Tamil, and English.
- **Execution**: Triggered either automatically during bootstrap via `DataInitializer.java` (if `tmdb.api-key` is non-empty) or on-demand via `POST /api/tmdb/sync`.

### 6.3 Groq AI (Llama 3.3 70B)
- **Configuration**: Uses Spring AI OpenAI adapter (`spring.ai.openai.*`) pointing to Groq's API endpoint `https://api.groq.com/openai`, with API key `GROQ_API_KEY` and model `llama-3.3-70b-versatile`.
- **Implementation**: `com.cinebook.service.RecommendationService` uses `OpenAiChatModel` to process natural language queries and recommend movies currently in catalog. Exposed via `AiController` (`GET /api/ai/recommend`).

### 6.4 Razorpay & Webhook Gateway
- **Configuration**: `razorpay.key-id`, `razorpay.key-secret`, `razorpay.webhook-secret`.
- **Implementation**:
  - `PaymentService` invokes `com.razorpay.RazorpayClient` to create server-side payment orders.
  - `PaymentEngineService` and `HmacSignatureService` ingest webhooks (`POST /api/payments/webhook`), verify signatures, and transition transactions.

### 6.5 Redis (Optional Caching)
- **Configuration**: `spring.data.redis.host`, `spring.data.redis.port`.
- **Implementation**: Redis starter is included in `pom.xml`, but caching is currently set to `spring.cache.type: simple` (in-memory) in `application.yml` with Redis health checks disabled (`management.health.redis.enabled: false`).

### 6.6 SMTP / Email
- **Configuration**: `spring.mail.host` (`smtp.gmail.com`), `spring.mail.port` (`587`), `spring.mail.username`, `spring.mail.password`.
- **Implementation**: `com.cinebook.service.EmailService` sends HTML confirmation emails with embedded QR code images. Health checks disabled in Actuator.

---

## 7. Implemented Features That Matter for Reliability

The repository contains substantial production-grade reliability patterns already built into the core business logic.

### 7.1 Seat Hold State Machine
- **Evidence**:
  - `SeatStatus` Enum (`AVAILABLE`, `LOCKED`, `BOOKED`) in `cinebook-backend/src/main/java/com/cinebook/domain/enums/SeatStatus.java`.
  - `BookingStatus` Enum (`CREATED`, `CONFIRMED`, `CANCELLED`, `EXPIRED`) in `cinebook-backend/src/main/java/com/cinebook/domain/enums/BookingStatus.java`.
  - `ShowSeat` entity fields (`status`, `lockedBy`, `lockedAt`, `lockExpiresAt`) in `cinebook-backend/src/main/java/com/cinebook/domain/entity/ShowSeat.java` (lines 38–48).
  - `SeatLockService.holdSeats(...)` in `cinebook-backend/src/main/java/com/cinebook/service/SeatLockService.java` (lines 34–80): Enforces status transitions, rejects already booked seats, checks whether an existing lock has expired or belongs to the requesting user, and sets atomic lock expiry (`now.plusMinutes(lockDurationMinutes)`).

### 7.2 Lock Expiry Scheduler
- **Evidence**:
  - `LockExpiryScheduler` in `cinebook-backend/src/main/java/com/cinebook/service/LockExpiryScheduler.java` (lines 20–37).
  - Uses Spring `@Scheduled(fixedDelay = 30000)` running every 30 seconds.
  - Invokes `ShowSeatRepository.releaseExpiredLocks(LocalDateTime now)` which executes an atomic JPQL bulk update resetting expired `LOCKED` seats back to `AVAILABLE`.
  - Invokes `BookingRepository.expireOrphanedBookings()` which marks stale pending bookings as `EXPIRED`.

### 7.3 High-Concurrency Handling & Row-Level Locking
- **Evidence**:
  - `ShowSeatRepository.findByIdsWithLock` in `cinebook-backend/src/main/java/com/cinebook/domain/repository/ShowSeatRepository.java` (lines 33–39):
    ```java
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints({@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")})
    @Query("SELECT ss FROM ShowSeat ss WHERE ss.id IN :ids AND ss.show.id = :showId")
    List<ShowSeat> findByIdsWithLock(@Param("ids") List<UUID> ids, @Param("showId") UUID showId);
    ```
    Translates directly to PostgreSQL `SELECT ... FOR UPDATE` with a 3,000ms lock timeout to prevent thread blocking and fail-fast under contention.
  - `WalletRepository.findByUserIdWithLock` in `cinebook-backend/src/main/java/com/cinebook/domain/repository/WalletRepository.java` (lines 18–24): Acquires row-level `PESSIMISTIC_WRITE` locks on customer wallets to prevent double-spending.
  - **Deadlock-Free Canonical Lock Ordering**: Enforced in `BookingPaymentSagaCoordinator.java` and documented in `INCIDENTS.md` (Incident 3). Locks are always acquired in strict sequential order: Seat rows first, Wallet row second.

### 7.4 Webhook HMAC Signature Verification
- **Evidence**:
  - `HmacSignatureService` in `cinebook-backend/src/main/java/com/cinebook/service/gateway/HmacSignatureService.java` (lines 40–50):
    ```java
    public boolean verifySignature(String payload, String signature, String secret) {
        if (payload == null || signature == null || secret == null) return false;
        String expectedSignature = computeSignature(payload, secret);
        return MessageDigest.isEqual(
            expectedSignature.getBytes(StandardCharsets.UTF_8),
            signature.getBytes(StandardCharsets.UTF_8)
        );
    }
    ```
    Uses `MessageDigest.isEqual` to perform constant-time byte comparisons, eliminating timing attack vulnerabilities.
  - `PaymentEngineService.processWebhook` in `cinebook-backend/src/main/java/com/cinebook/service/payment/PaymentEngineService.java` (lines 213–218): Validates `X-Razorpay-Signature` or `X-Signature` against payload before any database mutation.

### 7.5 Idempotency Engine & Deduplication
- **Evidence**:
  - `IdempotencyService` in `cinebook-backend/src/main/java/com/cinebook/service/idempotency/IdempotencyService.java`.
  - `IdempotencyRecord` entity in `cinebook-backend/src/main/java/com/cinebook/domain/entity/IdempotencyRecord.java`.
  - Computes SHA-256 hash of incoming request payload, stores execution status (`PROCESSING`, `COMPLETED`), and returns previously cached responses for duplicate client requests or replayed webhooks.

### 7.6 Strict Transaction State Machine & Double-Entry Ledger
- **Evidence**:
  - `TransactionStateMachine` in `cinebook-backend/src/main/java/com/cinebook/service/statemachine/TransactionStateMachine.java`: Formally enforces valid state transitions (`CREATED -> PROCESSING -> AUTHORIZED / CAPTURED -> SETTLED / REFUNDED / FAILED`) and persists an append-only audit trail in table `transaction_state_transitions`.
  - `LedgerService` in `cinebook-backend/src/main/java/com/cinebook/service/ledger/LedgerService.java`: Enforces double-entry accounting with integer `paise` discipline; verified by automated reconciliation reports.

### 7.7 Distributed Saga Orchestration & Compensation
- **Evidence**:
  - `BookingPaymentSagaCoordinator` and `SagaOrchestrator` in `cinebook-backend/src/main/java/com/cinebook/service/saga/`: Coordinates multi-step booking workflows (seat reservation -> payment authorization -> booking confirmation) and triggers compensating rollbacks (releasing seats, refunding ledger debits) if any downstream step fails.

---

## 8. Gaps Identified for a Production-Minded Setup

| Area | Current State in Repository | Production Gap | Impact |
|---|---|---|---|
| **Metrics & Prometheus** | Spring Boot Actuator starter is present, but `micrometer-registry-prometheus` is absent from `pom.xml`. | No `/actuator/prometheus` scraping endpoint exists. `/actuator/metrics` is locked behind authentication. | Prometheus cannot scrape JVM, HTTP, or business metrics. |
| **Container Port Alignment** | Frontend Dockerfile/Nginx listens on port `8080`. Root `docker-compose.yml` maps `3000:80`. | Host `3000` is mapped to non-listening container port `80`. Docker Compose frontend fails to connect. | Broken local developer experience when using Docker Compose. |
| **Container Healthcheck** | Backend `Dockerfile` has non-root user and JVM flags, but no `HEALTHCHECK` directive. | Docker and container orchestrators cannot determine backend readiness without external probes. | Traffic routed to starting containers before JVM initializes. |
| **Environment Template** | Partial `.env.example` in backend; missing root-level template. | No unified `.env.example` at root covering all variables for frontend, backend, and database. | New engineers or CI runners cannot easily bootstrap environment. |
| **CI/CD Standardization** | Fragmented across 7 specialized workflows (`backend-ci.yml`, `docker-security.yml`, etc.). | Missing a single unified `ci.yml` combining backend verification, frontend build/lint, Docker builds, and Trivy scan, and a clean dedicated `cd.yml`. | Inconsistent status checks and redundant build executions. |
| **Kubernetes (kind)** | No Kubernetes manifests exist in the repository. | Missing `kind-config.yaml`, manifests in `deploy/k8s/` (Namespace, ConfigMap, Secrets, Deployments, Services, Probes, HPA), and cluster lifecycle scripts (`scripts/k8s-up.sh`, `scripts/k8s-down.sh`). | Unable to run or demonstrate local container orchestration on kind. |
| **Infrastructure as Code (Terraform)** | No Terraform configuration exists. | Missing `deploy/terraform/` (AWS Free Tier eligible: VPC, single public subnet, security group, t2/t3.micro EC2, IAM role, CloudWatch/Budget alarms) and wrapper scripts (`scripts/aws-up.sh`, `scripts/aws-down.sh`). | No automated, repeatable AWS cloud infrastructure deployment. |
| **Observability Assets** | No Prometheus, Grafana, or Alertmanager configs exist. | Missing `monitoring/prometheus.yml`, Grafana dashboard JSON (request rates, p95 latency, error rate, JVM heap, seat hold metrics), alert rules, and `docs/slo.md`. | Zero visibility into system performance, health, and latency SLOs. |
| **Load & Concurrency Testing** | k6 is installed on host, but zero test scripts exist. | Missing `scripts/loadtest/` k6 scripts for read operations, booking flows, and high-concurrency seat-race tests. | Concurrency and lock timeout behavior cannot be benchmarked or demonstrated under load. |
| **Operations & Runbooks** | No `Makefile`, runbooks, or interview evidence matrices exist. | Missing root `Makefile`, `docs/design-note.md`, `docs/runbook.md`, `docs/failure-tests.md`, and `docs/evidence.md`. | Inability to run single-command targets or follow operational incident procedures during interviews. |
| **Frontend Test Coverage** | Only 1 smoke test (`App.test.tsx`). | Missing component and integration tests for critical flows (seat selection, booking checkout, error states). | Regressions in client-side booking logic cannot be caught by CI. |

---

## 9. Verification Summary & Next Steps

This audit was conducted strictly in read-only mode. All observations reflect the actual state of the repository as of the audit date.

### Action Items for Phase 2:
1. Present this `AUDIT.md` to the user and wait for confirmation.
2. In Phase 2, provide a detailed, file-by-file plan for all missing assets across Containers, CI/CD, Kubernetes, Terraform, Observability, Load Testing, and Documentation.
3. Keep all newly authored assets runnable, clean, and interview-ready, without touching or altering existing implemented features.
