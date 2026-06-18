# learningdemo — Kubernetes Deployment Runbook & Video Script

Everything here was tested live on the kind cluster `fluid-ai`
(context `kind-fluid-ai`). Image: `jaiwin1817/learningdemo:latest`.

---

## 0. Architecture at a glance

```
            (laptop)  kubectl port-forward svc/app 3000:3000
                                  |
   namespace: learningdemo        v
   ┌──────────────────────────────────────────────────────────┐
   │  Service "app" (ClusterIP)                                 │
   │        |  selects pods labelled app=app                    │
   │        v                                                   │
   │  Deployment "app"  (2 replicas, stateless)                 │
   │     - image jaiwin1817/learningdemo:<sha>                  │
   │     - startup + readiness (/health) + liveness (tcp) probes│
   │     - env: ConfigMap app-config + Secret db-secret         │
   │        |  connects to host "db:5432"                       │
   │        v                                                   │
   │  Service "db" (headless, clusterIP None)                   │
   │        |                                                   │
   │        v                                                   │
   │  StatefulSet "db-0"  (postgres:16-alpine)                  │
   │     - PVC "data-db-0" (1Gi, kind local-path)  <-- state    │
   │     - init.sql from ConfigMap db-init (first start only)   │
   └──────────────────────────────────────────────────────────┘
```

Why these choices:
- **Deployment for the app** — it is stateless, so replicas are interchangeable
  and rolling updates / rollbacks are trivial.
- **StatefulSet + PVC for Postgres** — a DB needs stable identity and storage
  that is reattached across restarts. Data must outlive the pod.
- **Headless Service for the DB** — gives Postgres a stable DNS name (`db`)
  without load-balancing across (non-existent) replicas.
- **Secret vs ConfigMap** — password lives in a Secret; plain config (host,
  port) in a ConfigMap. Same credentials referenced by both app and DB.

---

## 1. One-time setup

```bash
# Confirm the cluster is up
kubectl config use-context kind-fluid-ai
kubectl get nodes
```

(The public image pulls from Docker Hub automatically; no `kind load` needed.)

---

## 2. Deploy the whole stack

```bash
kubectl apply -f k8s/

# Watch it come up
kubectl -n learningdemo rollout status statefulset/db
kubectl -n learningdemo rollout status deployment/app
kubectl -n learningdemo get pods,svc,pvc
```

Expected: `db-0` Ready 1/1, two `app-*` pods Ready 1/1.

---

## 3. Access & smoke test

```bash
kubectl -n learningdemo port-forward svc/app 3000:3000
# in another terminal:
curl localhost:3000/health      # {"status":"ok","db":"connected"}
curl -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{"username":"bob","email":"bob@k8s.io","password":"secret"}'
curl localhost:3000/users
# Browser: http://localhost:3000  (Register / Login / View users)
```

---

## 4. CI/CD flow (what happens on `git push`)

1. **build** job (GitHub cloud runner): build image, push
   `:latest` and `:<git-sha>` to Docker Hub.
2. **deploy** job (**self-hosted** runner on this laptop, so it can reach kind):
   - `kubectl apply -f k8s/`
   - `kubectl set image deployment/app app=...:<git-sha>`
   - `kubectl rollout status` — fails the pipeline if pods never go Ready.

Self-hosted runner setup (once): GitHub repo → Settings → Actions → Runners →
New self-hosted runner → follow the commands, then leave `./run.cmd` running.

> Tradeoff to say out loud: a self-hosted runner is the pragmatic way to reach a
> *local* cluster. In the cloud you'd instead use a managed cluster + `kubectl`
> with a kubeconfig secret, or GitOps (ArgoCD/Flux) pulling the manifests.

---

## 5. RELIABILITY FEATURE — readiness/liveness probes (the "why")

- **readinessProbe → GET /health** (which queries the DB).
  Problem it solves: a pod that cannot reach the DB is removed from the Service
  endpoints, so users are never routed to a broken pod.
- **livenessProbe → tcpSocket:3000** (NOT /health).
  Problem it solves: restarts a genuinely hung process. Deliberately does NOT
  check the DB — if it did, a short DB outage would restart *every* app pod at
  once (a restart storm) and deepen the outage. Liveness = process health only;
  readiness = dependency health.
- **startupProbe → /health, up to 60s**: gives a cold start time before the
  other probes judge it, so slow starts aren't killed.
- **Tradeoff:** probes add config + a small failure surface (too-aggressive
  timeouts cause flapping; too-lax means slow failure detection). They also
  can't fix a real dependency outage — they just contain the blast radius.

Combined with `strategy.maxUnavailable: 0`, a bad release literally cannot take
the service down: new pods must pass readiness before old ones are removed.

---

## 6. FAILURE SIMULATION + LIVE DEBUG (the most important section)

### Break it
```bash
kubectl -n learningdemo set env deployment/app DB_HOST=db-wrong
```

### Symptoms to point at
```bash
kubectl -n learningdemo get pods -l app=app
#  new pod:  0/1  Running     <- up, but NOT Ready (not crash-looping)
kubectl -n learningdemo get endpoints app
#  still the OLD pod IPs       <- Service refuses the broken pod
kubectl -n learningdemo rollout status deployment/app
#  "timed out waiting"         <- rollout BLOCKED, old version still serving
```

### Debugging methodology (say each step + reasoning)
```bash
# 1. Where exactly is it stuck? -> events on the new pod
kubectl -n learningdemo describe pod <new-pod>
#    "Readiness/Startup probe failed: ... /health ... timeout/refused"

# 2. What does the app itself say? -> logs
kubectl -n learningdemo logs <new-pod>
#    process is listening, but /health can't reach the DB

# 3. Confirm the hypothesis: is it config? -> inspect env
kubectl -n learningdemo set env deployment/app --list | grep DB_HOST
#    DB_HOST=db-wrong   <-- ROOT CAUSE: bad config, DNS can't resolve the host
```
Wrong assumption to mention: "the image is broken / the DB is down" — both
disproved because the DB pod is healthy and the OLD app pods still answer
`/health` fine. The problem is configuration, not code or database.

### Fix
```bash
kubectl -n learningdemo set env deployment/app DB_HOST=db
kubectl -n learningdemo rollout status deployment/app   # goes green
```

Alternative real-world fix (rollback story):
```bash
kubectl -n learningdemo rollout undo deployment/app     # back to last good revision
kubectl -n learningdemo rollout history deployment/app
```

---

## 7. VIDEO SCRIPT (8–12 min)

**(0:00–0:30) Intro** — "Node/Express + Postgres on kind, CI/CD via GitHub
Actions to Docker Hub then auto-deploy. Reliability feature: probes. I'll then
break it and debug live."

**(0:30–4:00) Live demo**
- `kubectl get nodes`, `kubectl -n learningdemo get pods,svc,pvc`
- port-forward, browser: register a user, view users, hit `/health`
- show the GitHub Actions run: build → push → deploy job → `rollout status` green

**(4:00–6:30) Architecture walkthrough**
- the diagram in section 0; Deployment vs StatefulSet; headless Service + DNS
  name `db`; Secret vs ConfigMap; SHA-tagged images for traceable rollouts;
  self-hosted runner because kind is local.

**(6:30–7:30) Reliability decision** — section 5: readiness vs liveness, why
liveness must NOT depend on the DB, the maxUnavailable:0 safety net, tradeoffs.

**(7:30–10:30) Failure debugging** — section 6 live: break DB_HOST, show
0/1 + empty endpoints + blocked rollout, then describe → logs → env to reach
root cause, then fix and watch it recover. Emphasise: users were never impacted
because readiness kept the old pods serving.

**(10:30–12:00) Tradeoffs / what breaks at scale**
- Secret committed to git → use SOPS/Sealed Secrets/Vault.
- Single Postgres pod, no replication/backups → managed DB or an operator.
- Self-hosted runner for deploy → GitOps (ArgoCD) or managed cluster in prod.
- App doesn't gracefully handle a DB connection-pool error (it can exit on an
  unhandled pool error) → add error handling + retries/backoff.
- No HPA, no resource-based autoscaling, no ingress/TLS, no centralized logging
  /metrics (would add Prometheus + Grafana + a log shipper).

---

## 8. Teardown

```bash
kubectl delete namespace learningdemo        # removes everything incl. PVC
# or keep manifests, just scale down:
kubectl -n learningdemo scale deployment/app --replicas=0
```
