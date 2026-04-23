# Concepts: Why We Made These Infrastructure Choices

This document explains the infrastructure decisions behind this project in plain language, aimed at CS students who know Docker but are new to AWS. Skip to the section that interests you.

---

## 1. Why ECS with Fargate?

### What is Fargate?

Fargate is AWS's "serverless container" runtime. You write a Dockerfile, push the image to ECR, and tell ECS: "run this container with 0.25 vCPU and 512MB of RAM." AWS figures out which physical server to put it on, how to schedule it, how to restart it if it crashes, and how to drain it gracefully when you deploy a new version.

You never SSH into a server. You never patch an OS. You never think about disk space on the host machine.

**The mental model:** Fargate is like `docker run` on a computer you don't own, don't manage, and don't pay for when it's idle.

### What does "serverless containers" actually mean?

It does NOT mean there are no servers. There are servers — AWS owns them. "Serverless" means *you* don't manage the servers. You only define:
- What image to run
- How much CPU and RAM your container needs
- What environment variables it gets
- Which port it listens on

Everything else is AWS's problem.

### Key benefits for this kind of project

**No patching, no AMI updates.** When you run a container on an EC2 instance, you're responsible for keeping the underlying Amazon Linux or Ubuntu up to date. Security patches, kernel updates, Docker version upgrades — all yours to manage. With Fargate, the host OS is AWS's responsibility.

**Pay per second, not per hour.** Fargate bills by the vCPU-second and GB-second while your task is running. If your API gets zero traffic at 3am, you're not paying for an idle server. (Note: if you have a Service with `desiredCount: 1`, that one task is always running — but you're still only paying for 0.25 vCPU and 0.5GB, not a full EC2 instance.)

**Rolling deployments built-in.** When you push a new image and update the ECS Service, Fargate starts new tasks with the new image before stopping old tasks. Zero downtime. No scripting, no blue-green deployment YAML, no nginx reload tricks. You get this for free.

**Native AWS integrations:**
- **CloudWatch Logs:** Every `console.log` in your Node app automatically appears in CloudWatch. No log shipper to configure.
- **IAM:** Your container gets an IAM role — it can call AWS services (S3, Secrets Manager, etc.) without hardcoding credentials.
- **ALB:** The Application Load Balancer integrates directly with ECS Services. When a task starts, ECS registers it with the ALB. When a task stops, ECS deregisters it. No manual target registration.
- **Secrets Manager:** Sensitive values (DB passwords, API keys) are injected into your container as environment variables at startup — never stored in your Dockerfile or Git history.

**Horizontal scaling is just a number.** Want to handle more traffic? Change `desiredCount` from 1 to 4. ECS starts three more tasks. The ALB distributes traffic across all four. Scale back down when traffic drops.

### Why this matters for you as a student

You can deploy your semester project, your internship side project, or your first real app without learning how to manage Linux servers. You can focus on the application code and let AWS handle the operational overhead. The skills you learn here (task definitions, ECS services, ALB target groups, IAM roles, Secrets Manager) are the same skills used at companies running hundreds of microservices.

---

## 2. Fargate vs Running Docker on EC2: When to Choose Which

This is a practical decision framework, not a marketing comparison.

### Use EC2 (direct Docker) when:

- **You're on a very tight budget and can tolerate manual operations.** A `t3.micro` EC2 instance with Docker installed, running your app via `docker run`, is the cheapest possible setup. You SSH in, update the image manually, restart the container. There's no ECS overhead, no NAT Gateway cost, no ALB hourly charge.

- **You need GPU access.** Fargate does not support GPU workloads. If you're running a model inference server, use EC2 with a GPU instance type.

- **You want full OS control.** Custom kernel modules, specific Linux tuning, mounting block devices — Fargate doesn't expose the host OS. EC2 does.

- **You're running a single hobby project.** If it's just you, it's okay to break for a weekend, and you want to spend $5/month instead of $30/month, EC2 + Docker is fine.

- **You're still learning what's underneath before abstracting it away.** There's genuine value in SSHing into a server, running `docker ps`, watching logs with `docker logs -f`, and understanding what's happening at each layer. Do this first if you haven't.

### Use ECS Fargate when:

- **You don't want to manage servers.** This is the primary reason. No AMIs, no patching, no capacity planning.

- **You need reliable uptime with automatic restarts.** ECS Services keep your `desiredCount` running. If a task crashes, ECS starts a replacement automatically. On a plain EC2 with `docker run`, if the container crashes, it's gone until you SSH in.

- **You want zero-downtime deployments without scripting them.** Rolling deployments are built into ECS. On EC2, you'd need to write scripts, use Elastic Beanstalk, or set up something like Capistrano.

- **You're building something for real users.** When availability matters and your time matters, not managing servers pays for itself.

- **You're working in a team.** The task definition is a JSON file in source control. The deployment is a GitHub Actions workflow. Anyone on the team can deploy, audit deployments, and roll back — without needing SSH access to a server.

### Comparison Table

| Dimension | ECS Fargate | EC2 + Docker |
|-----------|-------------|--------------|
| **Monthly cost** (smallest config) | ~$10–30/month (0.25 vCPU + 0.5GB + ALB) | ~$8–10/month (t3.micro + Elastic IP) |
| **Operational burden** | Very low — no OS, no patching | High — AMI updates, Docker updates, system monitoring |
| **Startup time** (new task) | 30–90 seconds | Seconds (if instance is already running) |
| **Scaling** | Change a number in ECS Service config | Manual: provision EC2s, update DNS/load balancer |
| **OS access** | None — no SSH into task host | Full SSH access |
| **GPU support** | No | Yes (GPU instance types) |
| **Persistent local storage** | No (use EFS or S3 instead) | Instance store + EBS volumes |
| **Rolling deployments** | Built-in | DIY scripting required |
| **Log management** | CloudWatch — automatic | You configure the log driver |
| **Secret injection** | Secrets Manager — native | SSH and edit .env, or use EC2 Parameter Store manually |
| **Best for** | Web APIs, microservices, team projects | Hobby projects, GPU workloads, tight budgets, learning |

### The real decision question

> "If you deploy a new version of your app at 2pm on a Tuesday, can you afford 30 seconds of downtime while the old process stops and the new one starts?"

If yes → EC2 is probably fine.
If no → you want rolling deployments → use Fargate.

---

## 3. Why a Monorepo?

### What is a monorepo?

A monorepo is a single Git repository that contains multiple distinct applications or packages. In this project: the Node.js API and the Angular frontend live in the same repo, under `apps/api/` and `apps/web/`.

The alternative is a "polyrepo" — each app in its own separate Git repository.

### Benefits for small teams and student projects

**Single clone, single PR.** If you change the API response format and the frontend needs to handle it, both changes go in the same commit. Reviewers see the full context. The git history tells a coherent story.

**Coordinated deployments.** The GitHub Actions path filters (`paths: ['apps/api/**']`) mean the API pipeline only triggers when API files change, and the web pipeline only triggers when web files change. You get independent deployments without managing two separate repos.

**Simpler onboarding.** A new developer clones one repo and sees the entire system. No hunting for "is the frontend in a different repo?"

**Shared CI context.** Secrets, environment settings, and workflow files are in one place.

### What a monorepo does NOT mean

Each application still has:
- Its own `package.json` and dependencies
- Its own Docker image
- Its own ECR repository
- Its own ECS Task Definition
- Its own ECS Service
- Its own Application Load Balancer

Monorepo is a source code organization choice. It has no effect on how the apps are deployed or how they scale. They are completely independent at the infrastructure level.

### When to split into polyrepos

- The team grows beyond ~10 engineers and build times start hurting productivity
- Teams have very different release cadences and the monorepo becomes a coordination bottleneck
- You need truly independent access control (different teams shouldn't see each other's code)

For student projects and small startups: start with a monorepo. The overhead of managing multiple repos is almost never worth it at small scale.

---

## 4. Why CI/CD Even for Small Projects?

### The manual deployment process (what you do without CI/CD)

Every time you change one line of code and want it live, you:

1. Run `npm run build` (or `ng build`)
2. Build the Docker image: `docker build -t my-app .`
3. Tag it: `docker tag my-app 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest`
4. Log in to ECR: `aws ecr get-login-password | docker login ...`
5. Push it: `docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest`
6. Download the current task definition: `aws ecs describe-task-definition ...`
7. Edit the task definition JSON to bump the image tag
8. Register a new task definition revision: `aws ecs register-task-definition ...`
9. Update the ECS Service: `aws ecs update-service ...`
10. Wait and watch: `aws ecs wait services-stable ...`

That's 10 steps for every deploy. It takes 5–10 minutes. You will inevitably make a typo. You will forget a step at 11pm. You will wonder if you pushed the right branch. You will not do it as often as you should because it's a pain.

### With CI/CD

```bash
git add .
git commit -m "fix: handle empty description gracefully"
git push origin main
```

Done. The pipeline runs all 10 steps automatically in ~3–5 minutes. You get a green checkmark (success) or a red X (failure with logs) in your GitHub Actions tab. You can deploy 10 times a day without thinking about it.

### What the pipeline actually proves

When you see this in your terminal after a deploy:
```bash
curl http://your-api-alb-dns.elb.amazonaws.com/version
{"commit":"abc1234def5678"}
```

...and that SHA matches the commit you just pushed, you have *evidence* that:
- The code you wrote was compiled into a Docker image
- That exact image was pushed to ECR with a unique SHA tag
- ECS pulled that specific image and is running it
- The old version was gracefully stopped after the new one was healthy

This is the deployment audit trail. You can see it in GitHub Actions history, CloudWatch logs, and ECS task history.

### The teaching insight

> "If you can't describe your deployment process in a YAML file, you don't fully understand it."

Writing the CI/CD workflow forces you to understand every step of how your application gets from your laptop to production. Many developers who have been "deploying apps" for years don't actually know the full sequence — they just click buttons in a console and hope for the best. Writing a workflow file makes the implicit explicit.

### This same pattern at scale

The `deploy-api.yml` workflow in this project is structurally identical to what you'd find at companies running 200 microservices. The tools are the same (AWS credentials, ECR login, task definition update, ECS service update). The values are different (different cluster names, more complex IAM policies, production vs staging environments, approval gates). The pattern is the same.

When you interview for a DevOps or backend role and they ask "walk me through how you'd set up a CI/CD pipeline for a containerized app," you have a concrete answer — not theory, but something you actually built.
