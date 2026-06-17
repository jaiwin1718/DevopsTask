-- init.sql
-- Database initialization script.
-- When mounted into the official postgres image at
-- /docker-entrypoint-initdb.d/, this runs automatically the first time
-- the database container starts (on an empty data directory).

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
