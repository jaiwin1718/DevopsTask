// db.js
// Creates and exports a single PostgreSQL connection pool.
// All configuration is read from environment variables so the same
// image can run in any environment (local, Docker, CI, cloud) without
// code changes — a core DevOps principle (12-factor config).

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'learningdemo',
});

// Small helper so the rest of the app never touches the pool directly.
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
