# DevOps K8s Challenge - Sign Up Application

## Overview

A simple Sign Up web application built with Flask and PostgreSQL, deployed to Kubernetes via a GitHub Actions CI/CD pipeline.

## Architecture

```
Developer
    |
    | git push
    v
GitHub
    |
    v
GitHub Actions
    |
    +---> Test (unit tests)
    |
    +---> Build Docker image
    |
    +---> Push to GHCR (ghcr.io)
    |
    v
Self-hosted GitHub Actions Runner
    |
    v
Docker Desktop Kubernetes
    |
    +---------------------+
    |                     |
    v                     v
Backend Deployment    PostgreSQL StatefulSet
(Flask + Gunicorn)    (postgres:15-alpine)
    |                     |
    v                     v
Backend Service       PostgreSQL Service
(NodePort:30080)      (ClusterIP headless)
                          |
                          v
                        PVC (1Gi)
```

Access: http://localhost:30080

## Project Structure

```
├── app/
│   ├── app.py              # Flask application
│   ├── requirements.txt    # Python dependencies
│   └── templates/
│       └── index.html      # Frontend template
├── k8s/
│   ├── namespace.yaml      # signup-app namespace
│   ├── postgres-secret.yaml
│   ├── postgres-service.yaml
│   ├── postgres-statefulset.yaml
│   ├── app-deployment.yaml
│   └── app-service.yaml
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # CI/CD pipeline
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
└── README.md
```

## Local Development (Docker Compose)

```bash
docker compose up --build
```

Access: http://localhost:5000

```bash
# Check containers
docker compose ps

# View logs
docker compose logs app
docker compose logs postgres

# Stop
docker compose down
```

## Kubernetes Deployment (Manual)

```bash
# Apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres-secret.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/app-service.yaml
kubectl apply -f k8s/app-deployment.yaml

# Check status
kubectl get all -n signup-app

# View logs
kubectl logs -l app=signup-app -n signup-app
kubectl logs -l app=postgres -n signup-app
```

Access: http://localhost:30080

## CI/CD Pipeline (GitHub Actions)

The pipeline triggers on push to `main`:

1. **Test** - Installs dependencies and runs health check test
2. **Build & Push** - Builds Docker image and pushes to GHCR
3. **Deploy** - Deploys to Kubernetes via self-hosted runner

### Prerequisites for CI/CD

1. **GHCR access** - Automatic via `GITHUB_TOKEN`
2. **Self-hosted runner** - Must have `kubectl` configured for Docker Desktop K8s
3. **Docker Desktop Kubernetes** - Must be enabled on the runner machine

### Setting Up the Self-Hosted Runner

1. Go to repository Settings → Actions → Runners
2. Click "New self-hosted runner"
3. Follow the setup instructions for your OS
4. Ensure `kubectl` is available and configured for Docker Desktop

## Environment Variables

| Variable    | Default         | Description         |
|-------------|-----------------|---------------------|
| DB_HOST     | postgres        | PostgreSQL hostname |
| DB_PORT     | 5432            | PostgreSQL port     |
| DB_NAME     | signupdb        | Database name       |
| DB_USER     | signupuser      | Database username   |
| DB_PASSWORD | signup_password | Database password   |

## Health & Readiness Endpoints

```bash
# Liveness probe (does NOT check database)
curl http://localhost:5000/health      # Docker Compose
curl http://localhost:30080/health     # Kubernetes

# Readiness probe (checks PostgreSQL connectivity)
curl http://localhost:5000/ready       # Docker Compose
curl http://localhost:30080/ready      # Kubernetes
```

## Demonstrating Failure Scenarios

### Readiness Probe Failure (K8s)

Scale down PostgreSQL to simulate DB unavailability:

```bash
kubectl scale statefulset postgres --replicas=0 -n signup-app

# Readiness probe will fail, pods become NotReady
kubectl get pods -n signup-app

# /ready returns 503
curl http://localhost:30080/ready

# Restore
kubectl scale statefulset postgres --replicas=1 -n signup-app
```

### Changing DB_HOST (K8s)

Edit the deployment to use a wrong DB_HOST:

```bash
kubectl set env deployment/signup-app DB_HOST=wrong-host -n signup-app

# Pods will fail readiness checks
kubectl get pods -n signup-app

# Restore
kubectl set env deployment/signup-app DB_HOST=postgres -n signup-app
```

## Viewing Logs

```bash
# Docker Compose
docker compose logs app
docker compose logs postgres

# Kubernetes
kubectl logs deployment/signup-app -n signup-app
kubectl logs statefulset/postgres -n signup-app
```

## Stopping the Application

```bash
# Docker Compose
docker compose down
docker compose down -v   # Also removes volumes

# Kubernetes
kubectl delete -f k8s/ --ignore-not-found
```
