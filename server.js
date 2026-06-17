// server.js
// Main Express application: serves the UI (EJS), exposes a health check
// and a small Users API, and stores users in PostgreSQL.

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ---- Middleware ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true })); // parse HTML form posts
app.use(express.json());                          // parse JSON API bodies
app.use(express.static(path.join(__dirname, 'public')));

// Hash passwords with the built-in crypto module (no external auth libs).
// NOTE: a real app would use bcrypt/argon2 + a per-user salt; this is a demo.
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ---- UI routes ----

// Home -> redirect to the register page
app.get('/', (req, res) => res.redirect('/register'));

// Register page
app.get('/register', (req, res) => {
  res.render('register', { error: null, success: null });
});

// Handle register form submit
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.render('register', { error: 'All fields are required.', success: null });
  }
  try {
    await db.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
      [username, email, hashPassword(password)]
    );
    res.render('register', { error: null, success: 'User registered! You can now log in.' });
  } catch (err) {
    // 23505 = unique_violation (duplicate username/email)
    const msg = err.code === '23505'
      ? 'Username or email already exists.'
      : 'Something went wrong: ' + err.message;
    res.render('register', { error: msg, success: null });
  }
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', { error: null, success: null });
});

// Handle login form submit
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user && user.password === hashPassword(password)) {
      return res.render('login', { error: null, success: `Welcome back, ${user.username}!` });
    }
    res.render('login', { error: 'Invalid email or password.', success: null });
  } catch (err) {
    res.render('login', { error: 'Something went wrong: ' + err.message, success: null });
  }
});

// Users list page (HTML)
app.get('/users-page', async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, email, created_at FROM users ORDER BY id');
    res.render('users', { users: result.rows });
  } catch (err) {
    res.status(500).send('Error loading users: ' + err.message);
  }
});

// ---- Health endpoint ----
// Returns 200 only if the app can reach the database. This is what a
// load balancer / Kubernetes liveness+readiness probe would hit.
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// ---- Users API (JSON) ----

// List all users
app.get('/users', async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, email, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single user by id
app.get('/users/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a user via API
app.post('/users', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, hashPassword(password)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Delete a user via API
app.delete('/users/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ deleted: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`learningdemo app listening on http://localhost:${PORT}`);
});
