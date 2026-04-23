# deploy-w-fargate

A production-ready monorepo teaching demo for CS students. Demonstrates the complete journey from a local Docker Compose setup to a live AWS deployment using **ECS Fargate**, **ECR**, **RDS PostgreSQL**, and a **GitHub Actions CI/CD pipeline**.

The app is a simple Notes CRUD. The code is not the point — the infrastructure and deployment process is.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         GitHub                              │
│  push to main → GitHub Actions CI/CD pipeline               │
│     ├── deploy-api.yml  (paths: apps/api/**)                │
│     └── deploy-web.yml  (paths: apps/web/**)                │
└────────────────────────┬────────────────────────────────────┘
                         │ docker push
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Amazon ECR                               │
│    deploy-w-fargate-api    deploy-w-fargate-web             │
└────────────────────────┬────────────────────────────────────┘
                         │ image pull
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Amazon ECS (Fargate)                          │
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │   api-service    │      │   web-service    │            │
│  │  (Node.js API)   │      │  (Angular/Nginx)  │            │
│  └────────┬─────────┘      └──────────────────┘            │
│           │                                                  │
└───────────┼──────────────────────────────────────────────── ┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Amazon RDS PostgreSQL                          │
│                 (db.t3.micro, Single-AZ)                    │
└─────────────────────────────────────────────────────────────┘

Traffic flow:
Internet → ALB (port 80/443)
             ├──▶ ECS Web Service  (Angular/Nginx — static files)
             └──▶ ECS API Service  (Node.js REST API) ──▶ RDS
```

---

## Security Groups

```
┌─────────────────────────────────────────────────────────┐
│  ALB Security Group                                     │
│  Inbound:  0.0.0.0/0 → port 80, 443                    │
│  Outbound: → ECS Web SG (port 80)                       │
│            → ECS API SG (port 3000)                     │
└─────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌────────────────┐   ┌────────────────┐
│ ECS Web SG     │   │ ECS API SG     │
│ Inbound: from  │   │ Inbound: from  │
│ ALB SG → 80    │   │ ALB SG → 3000  │
└────────────────┘   └───────┬────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │   RDS SG        │
                   │ Inbound: from   │
                   │ ECS API SG→5432 │
                   └─────────────────┘
```

---

## Monorepo Structure

```
/
├── apps/
│   ├── api/                  # Node.js + TypeScript + Express + Sequelize
│   │   ├── src/
│   │   │   ├── models/       # Sequelize models
│   │   │   ├── routes/       # Express routers
│   │   │   ├── middleware/   # Error handling
│   │   │   ├── database.ts   # Sequelize instance
│   │   │   └── index.ts      # App entry point
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                  # Angular + Angular Material
│       ├── src/
│       │   ├── app/
│       │   │   ├── components/
│       │   │   ├── services/
│       │   │   └── app.component.*
│       │   └── environments/
│       ├── Dockerfile
│       └── nginx.conf
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── deploy-api.yml
│       └── deploy-web.yml
├── CONCEPTS.md               # Why we made these infrastructure choices
└── README.md
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| Docker Desktop | Latest | https://docker.com |
| AWS CLI | v2 | `brew install awscli` |
| Angular CLI | 17+ | `npm install -g @angular/cli` |
| Git | Any | Preinstalled on Mac/Linux |

Configure AWS CLI before the AWS steps:
```bash
aws configure
# Enter: Access Key ID, Secret Access Key, Region (e.g. us-east-1), Output format (json)
```

---

## Local Development

### Option A — Full Docker stack (recommended for first run)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/deploy-w-fargate.git
cd deploy-w-fargate

# Start everything: postgres + api + web
docker compose up --build

# Open in browser
open http://localhost       # Angular app
curl http://localhost:3000/health   # API health check
curl http://localhost:3000/version  # Shows GIT_COMMIT_SHA
```

To stop: `docker compose down`
To stop AND delete the database volume: `docker compose down -v`

### Option B — Run without Docker (for active development)

**Step 1 — Start PostgreSQL** (requires Docker for the DB):
```bash
docker run -d \
  --name notes-postgres \
  -e POSTGRES_DB=notes_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

**Step 2 — Start the API:**
```bash
cd apps/api
cp .env.example .env
npm install
npm run dev
# API running at http://localhost:3000
```

**Step 3 — Start the Angular app:**
```bash
cd apps/web
npm install
ng serve
# App running at http://localhost:4200
```

---

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | API server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `notes_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:4200` |
| `GIT_COMMIT_SHA` | Injected by CI/CD pipeline | `local-dev` |

In production (ECS), these are set in the Task Definition — some via plaintext environment variables, sensitive ones (DB_PASSWORD) via AWS Secrets Manager.

---

## AWS Deployment Guide

Follow these steps in order. Each service builds on the previous one.

### Step 1 — Create ECR Repositories

ECR (Elastic Container Registry) is AWS's Docker image registry — like Docker Hub, but private and integrated with IAM.

```bash
# Create repository for the API image
aws ecr create-repository \
  --repository-name deploy-w-fargate-api \
  --region us-east-1

# Create repository for the web image
aws ecr create-repository \
  --repository-name deploy-w-fargate-web \
  --region us-east-1

# Note the repositoryUri from the output — you'll need it for the push commands
# Format: 123456789012.dkr.ecr.us-east-1.amazonaws.com/deploy-w-fargate-api
```

**Push your first images manually** (the CI/CD pipeline will do this automatically after setup):
```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS \
    --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build and push API image
docker build -t deploy-w-fargate-api ./apps/api
docker tag deploy-w-fargate-api:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/deploy-w-fargate-api:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/deploy-w-fargate-api:latest

# Build and push web image
docker build -t deploy-w-fargate-web ./apps/web
docker tag deploy-w-fargate-web:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/deploy-w-fargate-web:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/deploy-w-fargate-web:latest
```

---

### Step 2 — Create RDS PostgreSQL

RDS (Relational Database Service) manages the PostgreSQL instance. AWS handles backups, software updates, and failover.

**Via AWS Console:**
1. Go to **RDS → Create database**
2. Engine: **PostgreSQL** (latest 16.x)
3. Template: **Free tier** (or Dev/Test for db.t3.micro)
4. Settings:
   - DB instance identifier: `notes-db`
   - Master username: `postgres`
   - Master password: choose a strong password and save it
5. Instance configuration: `db.t3.micro`
6. Storage: `20 GB`, type `gp2`, disable autoscaling
7. Connectivity:
   - VPC: default VPC
   - Public access: **No** (only ECS tasks reach it — not the internet)
   - VPC security group: create new → name it `rds-sg`
8. Additional configuration:
   - Initial database name: `notes_db`
9. Click **Create database** — takes ~5 minutes

**Configure RDS Security Group:**
After ECS is set up (Step 5), come back and add an inbound rule to `rds-sg`:
- Type: PostgreSQL
- Port: 5432
- Source: the ECS API tasks security group (`ecs-api-sg`)

---

### Step 3 — Store Secrets in AWS Secrets Manager

Never put database passwords in plaintext environment variables or code. Use Secrets Manager.

```bash
# Store the DB password
aws secretsmanager create-secret \
  --name "deploy-w-fargate/db-password" \
  --secret-string "your-actual-rds-password" \
  --region us-east-1

# Note the SecretArn from the output — you'll reference it in the Task Definition
```

---

### Step 4 — Create ECS Cluster

An ECS Cluster is a logical grouping of services. With Fargate, you don't provision any EC2 instances — AWS manages the underlying compute.

```bash
aws ecs create-cluster \
  --cluster-name deploy-w-fargate \
  --capacity-providers FARGATE \
  --region us-east-1
```

Or via console: **ECS → Clusters → Create cluster** → name it `deploy-w-fargate`, select Fargate.

---

### Step 5 — Create IAM Roles for ECS

ECS needs two IAM roles:

**Task Execution Role** — allows ECS to pull images from ECR and write logs to CloudWatch (AWS infrastructure-level permissions):
```bash
# Create the role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach the managed policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Add permission to read secrets from Secrets Manager
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

---

### Step 6 — Create Task Definitions

A Task Definition is a blueprint for your container: which image to use, how much CPU/memory, environment variables, and which ports to expose.

**API Task Definition** — save as `api-task-def.json`, then register it:
```json
{
  "family": "api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/deploy-w-fargate-api:latest",
      "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "DB_HOST", "value": "your-rds-endpoint.us-east-1.rds.amazonaws.com"},
        {"name": "DB_PORT", "value": "5432"},
        {"name": "DB_NAME", "value": "notes_db"},
        {"name": "DB_USER", "value": "postgres"},
        {"name": "CORS_ORIGIN", "value": "http://your-web-alb-dns.us-east-1.elb.amazonaws.com"}
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:deploy-w-fargate/db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/deploy-w-fargate-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "essential": true
    }
  ]
}
```

```bash
# Create CloudWatch log group first
aws logs create-log-group --log-group-name /ecs/deploy-w-fargate-api --region us-east-1

# Register the task definition
aws ecs register-task-definition \
  --cli-input-json file://api-task-def.json \
  --region us-east-1
```

**Web Task Definition** — same pattern, but:
- `"family": "web"`
- Image: `deploy-w-fargate-web:latest`
- `"containerPort": 80`
- No DB environment variables or secrets
- Log group: `/ecs/deploy-w-fargate-web`

---

### Step 7 — Create Application Load Balancers

An ALB routes HTTP traffic to your ECS tasks. Each service gets its own ALB (simpler for a demo — for production you'd use path-based routing on a single ALB).

**Via Console — API ALB:**
1. **EC2 → Load Balancers → Create → Application Load Balancer**
2. Name: `api-alb`, Scheme: Internet-facing, IP type: IPv4
3. VPC: default, select all availability zones
4. Security Group: create `alb-api-sg` (inbound: port 80 from 0.0.0.0/0)
5. Listener: HTTP port 80
6. Target Group: create `api-tg`
   - Target type: **IP** (required for Fargate)
   - Protocol: HTTP, Port: 3000
   - Health check path: `/health`
7. Don't register targets yet (ECS service will register them)

Repeat for the web service: `web-alb`, `alb-web-sg`, `web-tg`, port 80, health check path `/`.

---

### Step 8 — Create ECS Services

A Service keeps the desired number of task replicas running, integrates with the ALB, and performs rolling deployments.

**Via Console:**
1. **ECS → Clusters → deploy-w-fargate → Create service**
2. Launch type: **Fargate**
3. Task definition: `api` (latest revision)
4. Service name: `api-service`
5. Desired tasks: `1`
6. Networking:
   - VPC: default
   - Subnets: select all
   - Security group: create `ecs-api-sg`
     - Inbound: port 3000 from `alb-api-sg`
     - Outbound: all (for ECR pulls, RDS, CloudWatch)
   - Auto-assign public IP: **Enabled** (needed for ECR pulls without NAT Gateway)
7. Load balancing:
   - Load balancer type: Application Load Balancer
   - Load balancer: `api-alb`
   - Container: `api:3000`
   - Target group: `api-tg`
8. Create

Repeat for web service: `web-service`, task def `web`, `ecs-web-sg` (port 80 from `alb-web-sg`), `web-alb`, `web-tg`.

After services are running, go back to the RDS security group and add inbound port 5432 from `ecs-api-sg`.

---

### Step 9 — Update `environment.prod.ts`

Once your API ALB is created, update the production environment file with the actual ALB DNS name:

```typescript
// apps/web/src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiBaseUrl: 'http://api-alb-123456.us-east-1.elb.amazonaws.com'
};
```

Commit and push — the CI/CD pipeline will rebuild and redeploy the web app automatically.

---

### Step 10 — Set Up GitHub Actions

**Create a GitHub Actions IAM user:**
```bash
aws iam create-user --user-name github-actions-deploy

# Create access keys
aws iam create-access-key --user-name github-actions-deploy
# Save the AccessKeyId and SecretAccessKey — you can't retrieve the secret again
```

**Attach the minimum required IAM policy** (create as a custom policy in the console, then attach):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"
    }
  ]
}
```

**Add secrets to GitHub:**
1. Go to your repo → **Settings → Secrets and variables → Actions**
2. Add:
   - `AWS_ACCESS_KEY_ID` — from the IAM access key above
   - `AWS_SECRET_ACCESS_KEY` — from the IAM access key above

**Update workflow env vars** in `.github/workflows/deploy-api.yml` and `deploy-web.yml`:
```yaml
env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: deploy-w-fargate-api   # or deploy-w-fargate-web
  ECS_CLUSTER: deploy-w-fargate
  ECS_SERVICE: api-service               # or web-service
  CONTAINER_NAME: api                    # or web
```

---

### Step 11 — Test the Pipeline

```bash
# Make a small change to the API
echo "" >> apps/api/src/index.ts

# Commit and push — this triggers deploy-api.yml
git add apps/api/src/index.ts
git commit -m "chore: trigger CI/CD test"
git push origin main

# Watch the pipeline at: GitHub → Actions tab → deploy-api.yml
```

After the pipeline completes, hit your API ALB URL:
```bash
curl http://api-alb-123456.us-east-1.elb.amazonaws.com/version
# {"commit":"abc1234..."}   ← the git SHA from the push that triggered the deploy
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns `{"status":"ok"}` |
| GET | `/version` | Returns `{"commit":"<GIT_COMMIT_SHA>"}` — proves CI/CD worked |
| GET | `/notes` | List all notes |
| GET | `/notes/:id` | Get a single note |
| POST | `/notes` | Create a note (body: `{title, description}`) |
| PUT | `/notes/:id` | Update a note (body: `{title, description}`) |
| DELETE | `/notes/:id` | Delete a note (returns 204) |

---

## Further Reading

- [CONCEPTS.md](./CONCEPTS.md) — Why we chose Fargate, why CI/CD, Fargate vs EC2 comparison
- [AWS ECS Fargate Getting Started](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started-fargate.html)
- [GitHub Actions for AWS](https://github.com/aws-actions)
- [Sequelize TypeScript](https://sequelize-typescript.readthedocs.io)
- [Angular Material](https://material.angular.io)
