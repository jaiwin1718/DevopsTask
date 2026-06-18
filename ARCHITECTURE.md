# Architecture & Demo Walkthrough
## DevOps Interview — learningdemo

---

## 1. Overall Architecture — Bird's Eye View

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                          DEVELOPER LAPTOP                                │
  │                                                                          │
  │   ┌─────────────┐  git push    ┌──────────────────────────────────────┐ │
  │   │   VS Code   │ ───────────► │   GitHub                             │ │
  │   │   Terminal  │              │   repo: jaiwin1718/DevopsTask         │ │
  │   └─────────────┘              │   branch: main                       │ │
  │                                └──────────────┬───────────────────────┘ │
  │                                               │                         │
  │                                 triggers on push to main                │
  │                                               │                         │
  │                                               ▼                         │
  │                                ┌──────────────────────────┐             │
  │                                │   GitHub Actions (CI)    │             │
  │                                │   1. docker build        │             │
  │                                │   2. docker push         │             │
  │                                │      :latest + :<sha>    │             │
  │                                └──────────────┬───────────┘             │
  │                                               │ push image              │
  │                                               ▼                         │
  │                                ┌──────────────────────────┐             │
  │                                │   Docker Hub             │             │
  │                                │   jaiwin1817/            │             │
  │                                │   learningdemo:latest    │             │
  │                                │   learningdemo:<sha>     │             │
  │                                └──────────────────────────┘             │
  │                                               ▲                         │
  │                                               │ pulls image             │
  │   ┌───────────────────────────────────────────┼──────────────────────┐  │
  │   │  kind cluster  (fluid-ai)                 │                      │  │
  │   │                                           │                      │  │
  │   │   ┌────────────────────────────────────┐  │                      │  │
  │   │   │  namespace: argocd                 │  │                      │  │
  │   │   │                                    │  │                      │  │
  │   │   │   ArgoCD                           │  │                      │  │
  │   │   │   ┌──────────────────────────┐     │  │                      │  │
  │   │   │   │ watches GitHub (main)    │────────┘  (detects            │  │
  │   │   │   │ every 3 minutes          │             values.yaml       │  │
  │   │   │   │ runs: helm template      │             changed)          │  │
  │   │   │   │ applies: kubectl diff    │                               │  │
  │   │   │   └──────────┬───────────────┘                               │  │
  │   │   └──────────────┼─────────────────────────────────────────────┐ │  │
  │   │                  │ deploys into                                 │ │  │
  │   │                  ▼                                              │ │  │
  │   │   ┌─────────────────────────────────────────────────────────┐  │ │  │
  │   │   │  namespace: learningdemo                                │  │ │  │
  │   │   │                                                         │  │ │  │
  │   │   │   Service: app (ClusterIP)                              │  │ │  │
  │   │   │   ┌─────────────────────────────────────────────┐       │  │ │  │
  │   │   │   │          port-forward :3000                 │       │  │ │  │
  │   │   │   │          (laptop access)                    │       │  │ │  │
  │   │   │   └────────────────┬────────────────────────────┘       │  │ │  │
  │   │   │                    │ routes to                           │  │ │  │
  │   │   │      ┌─────────────┴─────────────┐                      │  │ │  │
  │   │   │      ▼                           ▼                      │  │ │  │
  │   │   │  ┌──────────────┐         ┌──────────────┐              │  │ │  │
  │   │   │  │  app pod 1   │         │  app pod 2   │ Deployment   │  │ │  │
  │   │   │  │  Node.js     │         │  Node.js     │ replicas: 2  │  │ │  │
  │   │   │  │  :3000       │         │  :3000       │              │  │ │  │
  │   │   │  └──────┬───────┘         └──────┬───────┘              │  │ │  │
  │   │   │         └──────────┬─────────────┘                      │  │ │  │
  │   │   │                    │  DB_HOST=db (cluster DNS)           │  │ │  │
  │   │   │                    ▼                                     │  │ │  │
  │   │   │   Service: db (Headless — clusterIP: None)               │  │ │  │
  │   │   │   ┌──────────────────────────────────────────────────┐  │  │ │  │
  │   │   │   │                    :5432                         │  │  │ │  │
  │   │   │   └──────────────────────┬───────────────────────────┘  │  │ │  │
  │   │   │                          ▼                               │  │ │  │
  │   │   │   ┌──────────────────────────────────────────────────┐  │  │ │  │
  │   │   │   │  db-0  (StatefulSet)                             │  │  │ │  │
  │   │   │   │  postgres:16-alpine                              │  │  │ │  │
  │   │   │   │                                                  │  │  │ │  │
  │   │   │   │  PVC: data-db-0  ──── 1Gi disk (persistent)      │  │  │ │  │
  │   │   │   │  data survives pod restart / redeployment        │  │  │ │  │
  │   │   │   └──────────────────────────────────────────────────┘  │  │ │  │
  │   │   └─────────────────────────────────────────────────────────┘  │ │  │
  │   └───────────────────────────────────────────────────────────────┘ │  │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CI/CD Pipeline — Step by Step

```
  git push origin main
       │
       │  ① GitHub detects push to main branch
       ▼
  ┌─────────────────────────────────────────────────────┐
  │  GitHub Actions — Job: build                        │
  │  runs-on: ubuntu-latest (GitHub cloud runner)       │
  │                                                     │
  │  Step 1: checkout code                              │
  │  Step 2: docker buildx setup                        │
  │  Step 3: docker login → Docker Hub                  │
  │  Step 4: docker build + push                        │
  │          tags:                                      │
  │          - jaiwin1817/learningdemo:latest           │
  │          - jaiwin1817/learningdemo:<git-sha>        │
  │                                                     │
  │  WHY two tags?                                      │
  │  :latest   = easy to reference "newest"            │
  │  :<sha>    = immutable, traceable, rollback-able   │
  └──────────────────────────┬──────────────────────────┘
                             │  ② image pushed to Docker Hub
                             │
                             │  ③ ArgoCD polls GitHub every 3 min
                             ▼
  ┌─────────────────────────────────────────────────────┐
  │  ArgoCD (inside kind cluster)                       │
  │                                                     │
  │  Detects: helm-chart/values.yaml changed            │
  │  Runs:    helm template learningdemo helm-chart/    │
  │  Diff:    only Deployment image tag changed         │
  │  Applies: kubectl apply (just the diff)             │
  │                                                     │
  │  Rolling update begins:                             │
  │  - starts 1 new pod (maxSurge: 1)                  │
  │  - waits for readiness probe to pass               │
  │  - removes 1 old pod (maxUnavailable: 0)           │
  │  - repeats until all replicas are updated          │
  └──────────────────────────┬──────────────────────────┘
                             │  ④ new pods running
                             ▼
              ArgoCD UI shows: Synced ✅  Healthy ✅
```

---

## 3. Cluster Setup — What Is Inside kind

```
  kind (Kubernetes IN Docker)
  ────────────────────────────
  One Docker container = one Kubernetes node

  ┌─────────────────────────────────────────────────────────────────┐
  │  Node: fluid-ai-control-plane                                   │
  │  Kubernetes v1.35                                               │
  │                                                                 │
  │  ┌───────────────────────────────────────────────────────────┐  │
  │  │  namespace: kube-system  (K8s internals — don't touch)   │  │
  │  └───────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  ┌───────────────────────────────────────────────────────────┐  │
  │  │  namespace: argocd                                        │  │
  │  │                                                           │  │
  │  │  argocd-server          ← UI + API  (port-forward :8080) │  │
  │  │  argocd-repo-server     ← pulls git, runs helm template  │  │
  │  │  argocd-application-    ← compares git vs cluster        │  │
  │  │    controller             applies diffs                   │  │
  │  │  argocd-redis           ← cache                          │  │
  │  │  argocd-dex-server      ← auth                           │  │
  │  └───────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  ┌───────────────────────────────────────────────────────────┐  │
  │  │  namespace: learningdemo  (our app)                       │  │
  │  │                                                           │  │
  │  │  WORKLOADS                                                │  │
  │  │  ├── Deployment/app          (2 replicas, stateless)      │  │
  │  │  │   ├── app-xxxxx-pod1      Ready 1/1                   │  │
  │  │  │   └── app-xxxxx-pod2      Ready 1/1                   │  │
  │  │  └── StatefulSet/db          (1 replica, stateful)        │  │
  │  │      └── db-0                Ready 1/1                   │  │
  │  │                                                           │  │
  │  │  NETWORKING                                               │  │
  │  │  ├── Service/app    ClusterIP   10.96.255.7:3000         │  │
  │  │  └── Service/db     Headless    (None) :5432             │  │
  │  │                                                           │  │
  │  │  STORAGE                                                  │  │
  │  │  └── PVC/data-db-0  Bound  1Gi  (standard storageclass)  │  │
  │  │                                                           │  │
  │  │  CONFIG                                                   │  │
  │  │  ├── ConfigMap/app-config    DB_HOST, DB_PORT, PORT       │  │
  │  │  ├── ConfigMap/db-init       init.sql (creates table)     │  │
  │  │  └── Secret/db-secret        DB credentials               │  │
  │  └───────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 4. How ArgoCD GitOps Works — The Sync Loop

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                    The GitOps Loop                               │
  │                                                                  │
  │   Git Repo                    ArgoCD                  Cluster    │
  │   (desired state)             (controller)         (live state)  │
  │                                                                  │
  │   helm-chart/          poll every 3 min                         │
  │   values.yaml   ──────────────────────►  compare                │
  │                                          desired vs live         │
  │                                               │                  │
  │                         ┌─────────────────────┼──────────────┐  │
  │                         │  SYNCED ✅           │ OUT OF SYNC  │  │
  │                         │  git == cluster      │  git ≠ cluster│ │
  │                         │  do nothing          │  apply diff  │  │
  │                         └──────────────────────┴──────────────┘  │
  │                                                                  │
  │   selfHeal: true  →  if someone runs kubectl manually           │
  │                       and changes the cluster,                   │
  │                       ArgoCD REVERTS it back to git             │
  │                                                                  │
  │   prune: true     →  if you delete a file from git,            │
  │                       ArgoCD deletes the resource               │
  │                       from the cluster too                       │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 5. Helm Chart — How Templates + Values Work

```
  helm-chart/
  │
  ├── Chart.yaml          ← name, version (identity card)
  │
  ├── values.yaml         ← THE ONLY FILE that changes per environment
  │   ├── app.image.tag: latest
  │   ├── app.replicas: 2
  │   ├── app.port: 3000
  │   ├── db.storage: 1Gi
  │   └── credentials.postgresPassword: postgres
  │
  └── templates/          ← static structure with {{ }} placeholders
      ├── _helpers.tpl         shared labels snippet
      ├── secret.yaml          {{ .Values.credentials.postgresPassword }}
      ├── app-configmap.yaml   {{ .Values.app.port }}
      ├── db-init-configmap.yaml
      ├── postgres.yaml        {{ .Values.db.image.tag }}  {{ .Values.db.storage }}
      └── app.yaml             {{ .Values.app.image.tag }} {{ .Values.app.replicas }}


  HOW IT WORKS AT DEPLOY TIME:

  values.yaml          +      templates/app.yaml          =    real K8s YAML
  ─────────────────────────────────────────────────────────────────────────
  app:                        replicas:                        replicas: 2
    replicas: 2                 {{ .Values.app.replicas }}
    image:                    image: "{{.Values.app.image     image:
      tag: abc123               .repository}}:{{.Values        "jaiwin1817/
                                .app.image.tag}}"               learningdemo:abc123"


  SAME CHART, DIFFERENT ENVIRONMENTS:

  helm upgrade --install learningdemo helm-chart/ -f values.prod.yaml
                                                  ─────────────────────
                                                  override any value
                                                  without touching templates
```

---

## 6. How a Request Flows — Browser to Database

```
  Browser on laptop
       │
       │  http://localhost:3000/users
       │
       ▼
  kubectl port-forward svc/app 3000:3000
       │  (tunnel from laptop into cluster)
       │
       ▼
  Service: app  (ClusterIP — load balances)
       │
       │  picks one of the healthy endpoint IPs
       │  (only pods that passed readiness probe)
       │
       ├──────────────────┐
       ▼                  ▼
  app pod 1          app pod 2
  Node.js            Node.js
  10.244.0.x         10.244.0.y
       │
       │  process.env.DB_HOST = "db"   ← from ConfigMap
       │  Kubernetes DNS resolves "db" → Service IP
       │
       ▼
  Service: db  (Headless — returns pod IP directly)
       │
       ▼
  db-0  postgres:16-alpine
  10.244.0.z:5432
       │
       │  reads/writes from
       ▼
  PVC: data-db-0  (1Gi disk)
  /var/lib/postgresql/data/pgdata
  ── data persists across pod restarts ──
```

---

## 7. Readiness vs Liveness Probes — Why Both Exist

```
  Every 5 seconds, Kubernetes asks each app pod two questions:

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  READINESS PROBE                                                │
  │  Question:  "Should I send traffic to this pod RIGHT NOW?"      │
  │  Check:     GET /health  (queries the database)                 │
  │  Pass:      HTTP 200  →  add pod to Service endpoints          │
  │  Fail:      HTTP 503  →  remove pod from endpoints             │
  │                          pod gets ZERO traffic                  │
  │                          pod is NOT restarted                   │
  │                                                                 │
  │  Use case:  DB is unreachable → don't route users here         │
  │                                                                 │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  LIVENESS PROBE                                                 │
  │  Question:  "Is the process itself dead and stuck?"             │
  │  Check:     TCP socket :3000  (is the port open?)              │
  │             NOT /health  — deliberately does not check DB      │
  │  Pass:      port responds → do nothing                         │
  │  Fail:      port closed  → RESTART the pod                     │
  │                                                                 │
  │  Use case:  process deadlock / infinite loop / OOM crash        │
  │                                                                 │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  WHY liveness does NOT check the DB:                           │
  │                                                                 │
  │  If liveness also called /health, then a 10-second DB blip     │
  │  would make ALL app pods fail liveness → ALL restart at once   │
  │  → no app pods serving during restart                          │
  │  → a 10-second DB blip becomes a 60-second total outage        │
  │                                                                 │
  │  This is called a RESTART STORM — a classic misconfiguration   │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 8. Live Troubleshooting — The Debugging Flow

```
  SCENARIO: wrong DB password deployed via Helm values.yaml

  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP 1 — BREAK IT                                              │
  │                                                                 │
  │  Edit values.yaml:  postgresPassword: wrongpassword            │
  │  git commit + push → ArgoCD syncs → Secret updated             │
  │  kubectl rollout restart deployment/app  (pick up new secret)  │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP 2 — OBSERVE SYMPTOMS                                      │
  │                                                                 │
  │  kubectl -n learningdemo get pods                               │
  │  NAME             READY   STATUS    ← Running but 0/1 (not 1/1)│
  │  app-xxx-pod1     0/1     Running   ← NOT crash-looping        │
  │  app-xxx-pod2     0/1     Running   ← readiness failing        │
  │                                                                 │
  │  kubectl -n learningdemo get endpoints app                      │
  │  NAME   ENDPOINTS   ← NONE  (Service dropped all pods)         │
  │                              zero traffic to broken pods       │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP 3 — DEBUG (methodical, not random)                        │
  │                                                                 │
  │  ① Check logs first (what does the app say?)                   │
  │     kubectl -n learningdemo logs deployment/app                 │
  │     → "password authentication failed for user postgres"        │
  │     Conclusion: auth error, not a code or network problem       │
  │                                                                 │
  │  ② Confirm readiness is the cause                               │
  │     kubectl -n learningdemo describe pod <pod-name>             │
  │     → Events: "Readiness probe failed: statuscode 503"          │
  │                                                                 │
  │  ③ Inspect the actual Secret in the cluster                     │
  │     kubectl -n learningdemo get secret db-secret \              │
  │       -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d       │
  │     → wrongpassword     ← ROOT CAUSE FOUND                     │
  │                                                                 │
  │  Rule out wrong assumptions:                                    │
  │  ✗ Image broken?   No — pod is Running, not CrashLoopBackOff   │
  │  ✗ DB down?        No — db-0 is Ready 1/1                      │
  │  ✗ Network issue?  No — old pods still answered /health fine   │
  │  ✓ Config wrong?   YES — Secret has bad password from values   │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP 4 — FIX                                                   │
  │                                                                 │
  │  Edit values.yaml:  postgresPassword: postgres  (correct)      │
  │  git commit + push → ArgoCD syncs → Secret updated             │
  │  kubectl rollout restart deployment/app                         │
  │                                                                 │
  │  OR rollback with Helm:                                         │
  │  helm history learningdemo -n learningdemo                      │
  │  helm rollback learningdemo 1 -n learningdemo                   │
  └───────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STEP 5 — VERIFY RECOVERY                                       │
  │                                                                 │
  │  kubectl -n learningdemo get pods     → both 1/1 Ready         │
  │  kubectl -n learningdemo get endpoints → IPs are back          │
  │  curl localhost:3000/health           → {"status":"ok","db":   │
  │                                          "connected"}           │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 9. Key Tradeoffs — Say These in Your Video

```
  WHAT I SIMPLIFIED              WHAT BREAKS AT SCALE
  ──────────────────────────────────────────────────────────────────
  Secret committed to git    →   Use Sealed Secrets / Vault
                                 Plain text passwords in git = security risk

  Single Postgres pod        →   No replication, no automated backups
                                 A prod DB needs replicas + backup jobs

  Self-hosted runner         →   Fragile, single machine dependency
  (now replaced by ArgoCD)       ArgoCD solved this for us

  port-forward for access    →   Need Ingress + TLS in production
                                 (nginx-ingress + cert-manager)

  No monitoring              →   Add Prometheus + Grafana for metrics
                                 Add a log shipper for centralised logs

  kind (local cluster)       →   Not HA, single node
                                 Production needs multi-node cluster (EKS/GKE)
```

---

## 10. Quick Reference Commands

```bash
# See everything in the cluster
kubectl -n learningdemo get all

# Access the app
kubectl -n learningdemo port-forward svc/app 3000:3000

# Access ArgoCD UI
kubectl -n argocd port-forward svc/argocd-server 8080:443
# https://localhost:8080  admin / 34r9LciiJuUCYt3k

# Check ArgoCD sync status
kubectl -n argocd get application learningdemo

# Force ArgoCD to sync immediately (don't wait 3 min)
# → click Sync in the UI, or:
kubectl -n argocd patch application learningdemo \
  -p '{"operation":{"sync":{"revision":"HEAD"}}}' --type=merge

# Helm — see deployed releases
helm list -n learningdemo

# Helm — see revision history
helm history learningdemo -n learningdemo

# Helm — dry run (see YAML without deploying)
helm template learningdemo helm-chart/ --namespace learningdemo

# Rollback with Helm
helm rollback learningdemo 1 -n learningdemo

# Troubleshooting commands
kubectl -n learningdemo logs deployment/app
kubectl -n learningdemo describe pod <pod-name>
kubectl -n learningdemo get endpoints app
kubectl -n learningdemo get secret db-secret \
  -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
```
