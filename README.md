# learningdemo

A minimal **Node.js + Express + PostgreSQL** web app built for a DevOps
interview assignment. It demonstrates a small, production-like service with:

- A **Register** page and a **Login** page (server-rendered with EJS)
- A **health endpoint** (`/health`) that checks database connectivity
- A **Users API** (`/users`) backed by PostgreSQL
- **Environment-variable** based configuration (12-factor style)
- A **Dockerfile** and **docker-compose.yml** for containerized runs

> This app exists to show DevOps concepts (config, containers, health checks,
> orchestration). The application code is intentionally simple. It does **not**
> use auth frameworks, JWT, OAuth, or any frontend framework.

---

## Project structure

```
learningdemo/
├── package.json          # dependencies and start script
├── server.js             # Express app: UI routes, /health, /users API
├── db.js                 # PostgreSQL connection pool (configured via env vars)
├── init.sql              # creates the "users" table
├── Dockerfile            # builds the Node app image
├── .dockerignore         # files excluded from the Docker build context
├── docker-compose.yml    # runs app + PostgreSQL together
├── .env.example          # sample environment configuration
├── .gitignore
├── views/                # EJS templates (UI)
│   ├── register.ejs
│   ├── login.ejs
│   └── users.ejs
└── public/
    └── style.css         # simple styling
```

---

## Endpoints

| Method | Path           | Description                                  |
|--------|----------------|----------------------------------------------|
| GET    | `/`            | Redirects to `/register`                     |
| GET    | `/register`    | Register page                                |
| POST   | `/register`    | Create a user from the form                  |
| GET    | `/login`       | Login page                                   |
| POST   | `/login`       | Validate credentials                         |
| GET    | `/users-page`  | HTML table of users                          |
| GET    | `/health`      | JSON health check (200 ok / 503 if DB down)  |
| GET    | `/users`       | List users (JSON)                            |
| GET    | `/users/:id`   | Get one user (JSON)                          |
| POST   | `/users`       | Create user (JSON body)                      |
| DELETE | `/users/:id`   | Delete user (JSON)                           |

---

## Configuration

All configuration is read from environment variables. Copy the example file:

```bash
cp .env.example .env
```

| Variable      | Default        | Description              |
|---------------|----------------|--------------------------|
| `PORT`        | `3000`         | App HTTP port            |
| `DB_HOST`     | `localhost`    | PostgreSQL host          |
| `DB_PORT`     | `5432`         | PostgreSQL port          |
| `DB_USER`     | `postgres`     | PostgreSQL user          |
| `DB_PASSWORD` | `postgres`     | PostgreSQL password      |
| `DB_NAME`     | `learningdemo` | PostgreSQL database name  |

---

## Option A — Run everything with Docker Compose (easiest)

This starts both the PostgreSQL database and the app. `init.sql` runs
automatically on first start.

```bash
docker compose up --build
```

Then open: <http://localhost:3000>

Stop and remove containers:

```bash
docker compose down          # keep data
docker compose down -v       # also delete the database volume
```

---

## Option B — Run PostgreSQL in Docker, app on your machine

1. **Start PostgreSQL** using the official public image from Docker Hub:

   ```bash
   docker run --name learningdemo-db \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=learningdemo \
     -p 5432:5432 \
     -d postgres:16-alpine
   ```

2. **Create the table** by running the init script against the container:

   ```bash
   docker exec -i learningdemo-db psql -U postgres -d learningdemo < init.sql
   ```

3. **Install dependencies and start the app:**

   ```bash
   npm install
   npm start
   ```

   On Windows PowerShell, set env vars first if your DB differs from defaults:

   ```powershell
   $env:DB_HOST="localhost"; $env:DB_PASSWORD="postgres"; npm start
   ```

4. Open <http://localhost:3000>

---

## Quick test of the API

```bash
# Health check
curl http://localhost:3000/health

# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"secret"}'

# List users
curl http://localhost:3000/users
```

---

## Notes for the interview

- **Config via env vars** — the same image runs locally, in CI, or in the
  cloud without code changes.
- **`/health`** actually queries the database, so it works as a Kubernetes
  liveness/readiness probe or a load-balancer health check.
- **`init.sql`** is mounted into `/docker-entrypoint-initdb.d/`, the standard
  hook the official Postgres image uses to seed a fresh database.
- **`depends_on` + healthcheck** in compose ensures the app starts only after
  the database is ready.
- Passwords are hashed with the built-in `crypto` module to avoid extra
  dependencies. A real system would use `bcrypt`/`argon2` with per-user salts.
