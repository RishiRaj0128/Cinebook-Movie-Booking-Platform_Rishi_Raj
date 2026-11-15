# CineBook Deployment & Operations Guide

> **Target Audience**: Platform / SRE / DevOps Engineers & Interviewers  
> **Environment Modes**: Local Docker Compose, Local Kubernetes (kind), Cloud AWS EC2 (Terraform), and Hosted Serverless (Render + Netlify).

---

## ⚠️ Important Prerequisites & Platform Notices

> [!IMPORTANT]
> **Windows Shell Compatibility**: All shell scripts (`.sh`) in `scripts/` require a POSIX environment. On Windows workstations, execute all scripts using **Git Bash** (included with Git for Windows) or **WSL (Windows Subsystem for Linux)**. Running `.sh` scripts directly inside standard Windows Command Prompt (cmd.exe) or native PowerShell will fail.

> [!WARNING]
> **AWS Free-Tier Eligibility Notice**: AWS Free-Tier terms vary depending on your AWS account creation date and region. Accounts within the first 12 months receive 750 monthly hours of `t2.micro` or `t3.micro` instances. Always verify the **"Free tier eligible"** green badge next to your chosen instance type in the AWS EC2 Management Console before executing `terraform apply`.

> [!NOTE]
> **Kubernetes Multi-Replica State Isolation**: When running the backend on Kubernetes with `SPRING_PROFILES_ACTIVE=local`, each Pod replica boots an independent, isolated in-memory H2 database. Booking state created on Pod A is not shared with Pod B. In production, pods connect to a shared PostgreSQL cluster (`SPRING_PROFILES_ACTIVE=postgres` or Neon PostgreSQL) to share synchronized relational state.

---

## 1. Option A: Local Run via Docker Compose

Runs PostgreSQL, Redis, Backend, and Frontend containers locally with a single command.

### 1.1 Prerequisites
- Docker Engine & Docker Compose (`docker compose version`)

### 1.2 Execution
```bash
# 1. Start all containers in the background
docker compose up -d

# 2. Inspect running container status
docker compose ps

# 3. View backend logs
docker compose logs -f backend

# 4. Tear down containers and wipe volumes
docker compose down -v
```

### 1.3 Service Endpoints
- **Frontend SPA**: [http://localhost:3000](http://localhost:3000)
- **Backend REST API**: [http://localhost:8080](http://localhost:8080)
- **Swagger / OpenAPI Documentation**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **Actuator Health Probe**: [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)

---

## 2. Option B: Local Kubernetes Deployment (kind)

Provisions a local Kubernetes cluster named `cinebook` with 2 backend replicas, Actuator startup/liveness/readiness probes, and an autoscaler.

### 2.1 Architecture & Design
- **Cluster**: Single control-plane kind cluster created via `deploy/kind-config.yaml`.
- **Port Forwarding**: kind maps `hostPort: 30080` to Kubernetes `containerPort: 30080` on NodePort service `cinebook-backend`.
- **Image Strategy**: Image is built locally (`cinebook-backend:latest`) and side-loaded directly into kind nodes (`kind load docker-image`). This bypasses private GHCR credentials and runs 100% offline.
- **Probes Architecture**:
  - `startupProbe`: Allows up to 150 seconds for cold JVM bootstrap without triggering premature pod restarts.
  - `livenessProbe`: Checks `/actuator/health/liveness` every 10s to detect runtime deadlocks.
  - `readinessProbe`: Checks `/actuator/health/readiness` every 5s before routing service traffic.

### 2.2 Quickstart Commands (Git Bash / WSL)
```bash
# Bootstrap kind cluster, build image, and deploy all manifests:
bash scripts/k8s-up.sh

# Run end-to-end automated SRE evidence verification:
bash scripts/collect-evidence.sh

# Tear down the cluster cleanly:
bash scripts/k8s-down.sh
```

### 2.3 HorizontalPodAutoscaler (HPA) & Metrics Server
To enable HPA autoscaling in kind, metrics-server must be installed with the insecure TLS patch:
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch -n kube-system deployment/metrics-server --type='json' -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

---

## 3. Option C: AWS Cloud Infrastructure (Terraform)

Provisions a single-node, free-tier eligible AWS architecture locked down to your personal public IP address.

### 3.1 Architecture Overview
- **VPC**: Uses your region's default VPC (no NAT gateway charges, zero hourly networking fees).
- **Compute**: One EC2 instance (default `t3.micro`, parameterized) running Amazon Linux 2023.
- **AMI**: Dynamically fetched via AWS Systems Manager Parameter Store (`/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`).
- **Security Group**: Inbound TCP port `8080` restricted strictly to your authorized IP CIDR.
- **Bootstrap (`user_data`)**: Automatically installs Docker, starts dockerd, and runs `cinebook-backend:latest` with `SPRING_PROFILES_ACTIVE=local`.
- **Cost Safeguard**: An `aws_budgets_budget` cost alarm triggers immediate alert emails at $0.80 (80%) and $1.00 (100%) thresholds.

### 3.2 Deployment Instructions
```bash
# 1. Validate Terraform syntax and formatting locally (requires zero AWS credentials):
bash scripts/tf-validate.sh

# 2. Configure your variables:
cp deploy/terraform/terraform.tfvars.example deploy/terraform/terraform.tfvars
# Edit terraform.tfvars with your IP (check via: curl https://checkip.amazonaws.com) and email

# 3. Provision infrastructure on AWS:
bash scripts/aws-up.sh

# 4. Decommission and wipe cloud resources:
bash scripts/aws-down.sh
```

---

## 4. Option D: Production Demo (Render + Netlify)

The publicly accessible demo environment is hosted on modern cloud platform services:
- **Backend API**: Hosted on **Render** (Docker runtime, 512MB RAM free tier allocation).
- **Frontend SPA**: Hosted on **Netlify** with global CDN distribution.
- **Database**: **Neon PostgreSQL** (serverless PostgreSQL with connection pooling).

### 4.1 Custom Domain Configuration Walkthrough (Instructions)
To attach a custom branded domain (e.g. `cinebook.yourdomain.com`) to Netlify:

1. **Netlify Domain Management**:
   - In your Netlify dashboard, navigate to **Site configuration** $\rightarrow$ **Domain management** $\rightarrow$ **Custom domains**.
   - Click **Add a domain** and enter your desired domain name (`cinebook.yourdomain.com`).
2. **DNS Record Setup**:
   - In your DNS registrar (Route 53, Cloudflare, Namecheap), add a CNAME record:
     - **Type**: `CNAME`
     - **Name / Host**: `cinebook`
     - **Value / Target**: `coruscating-eclair-2724dd.netlify.app.`
     - **TTL**: `300` seconds (5 minutes)
3. **Automated SSL/TLS Provisioning**:
   - Under Netlify **HTTPS**, click **Verify DNS configuration**.
   - Netlify will automatically request and provision a free Let's Encrypt SSL/TLS certificate.
