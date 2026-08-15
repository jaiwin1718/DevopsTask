import os
import re
import psycopg2
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Database configuration from environment variables
DB_HOST = os.environ.get("DB_HOST", "postgres")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "signupdb")
DB_USER = os.environ.get("DB_USER", "signupuser")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "signup_password")


def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def init_db():
    """Create the users table if it does not exist."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")


def validate_email(email):
    """Basic email format validation."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


@app.route("/")
def index():
    """Render the signup page with the list of signed-up users."""
    users = []
    error = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT name, email, created_at FROM users ORDER BY created_at DESC;")
        users = cur.fetchall()
        cur.close()
        conn.close()
    except Exception as e:
        error = "Unable to connect to the database. Please try again later."
        print(f"Error fetching users: {e}")
    return render_template("index.html", users=users, error=error)


@app.route("/signup", methods=["POST"])
def signup():
    """Handle user signup."""
    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip()

    if not name:
        flash("Name is required.", "error")
        return redirect(url_for("index"))

    if not email:
        flash("Email is required.", "error")
        return redirect(url_for("index"))

    if not validate_email(email):
        flash("Invalid email format.", "error")
        return redirect(url_for("index"))

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users (name, email) VALUES (%s, %s);",
            (name, email),
        )
        conn.commit()
        cur.close()
        conn.close()
        flash("User signed up successfully!", "success")
    except psycopg2.errors.UniqueViolation:
        flash("This email is already registered.", "error")
    except Exception as e:
        flash("An error occurred. Please try again later.", "error")
        print(f"Error during signup: {e}")

    return redirect(url_for("index"))


@app.route("/health")
def health():
    """Liveness probe - does NOT require database."""
    return jsonify({"status": "healthy"}), 200


@app.route("/ready")
def ready():
    """Readiness probe - checks PostgreSQL connectivity."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1;")
        cur.close()
        conn.close()
        return jsonify({"status": "ready"}), 200
    except Exception as e:
        print(f"Readiness check failed: {e}")
        return jsonify({"status": "unavailable"}), 503


# Initialize database on startup
init_db()
