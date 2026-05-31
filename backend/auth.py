import bcrypt
import jwt
import sqlite3
import os
from datetime import datetime, timedelta, timezone
from flask import request, jsonify

# ── SECRET KEY ──────────────────────────────────────────────────────────────
# This is used to SIGN tokens. Think of it as a wax seal on an envelope —
# the server stamps every token with this secret. When a token comes back,
# the server checks the stamp. If someone tampered with the token, the stamp
# won't match and the server rejects it.
#
# In a real app this would be a long random string stored in an environment
# variable (never hardcoded). For learning, this is fine.
SECRET_KEY = "learning-secret-key-change-this-in-production"

DB_FILE = os.path.join(os.path.dirname(__file__), "todos.db")


# ── DATABASE ─────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_users_table():
    """
    Create the users table if it doesn't exist.
    Each user has:
      - id: auto-incremented number (INTEGER PRIMARY KEY does this automatically)
      - email: must be unique — you can't register twice with the same email
      - password_hash: the bcrypt-scrambled password, never the real one
    """
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


# ── REGISTER ─────────────────────────────────────────────────────────────────

def register():
    """
    POST /register
    Creates a new user account.

    Steps:
      1. Read email + password from the request
      2. Hash the password with bcrypt
      3. Save email + hash to the database (never the real password)
      4. Return success or an error if the email is already taken
    """
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # Basic validation — don't proceed with empty fields
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    # bcrypt.hashpw takes the password as bytes (b"...") and a "salt".
    # A salt is random noise added before hashing so two identical passwords
    # produce different hashes — making bulk attacks much harder.
    # gensalt() generates fresh random salt each time.
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, password_hash)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        # IntegrityError fires when UNIQUE is violated — email already exists
        conn.close()
        return jsonify({"error": "An account with that email already exists"}), 409
    finally:
        conn.close()

    return jsonify({"message": "Account created successfully"}), 201


# ── LOGIN ─────────────────────────────────────────────────────────────────────

def login():
    """
    POST /login
    Checks credentials and returns a JWT token if valid.

    Steps:
      1. Find the user by email
      2. Use bcrypt to compare the submitted password against the stored hash
      3. If they match, create and return a JWT token
      4. If they don't match, return a vague error (never say WHICH was wrong)
    """
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ?", (email,)
    ).fetchone()
    conn.close()

    # Always use the same vague error message whether email or password is wrong.
    # Telling the user "email not found" would help attackers discover valid emails.
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    # bcrypt.checkpw hashes the submitted password the same way and compares.
    # It returns True if they match, False if not.
    password_matches = bcrypt.checkpw(
        password.encode("utf-8"),
        user["password_hash"]
    )

    if not password_matches:
        return jsonify({"error": "Invalid email or password"}), 401

    # Credentials are valid — create a JWT token.
    # The "payload" is the data we embed inside the token.
    # Anyone can READ a JWT (it's base64 encoded, not encrypted),
    # but no one can MODIFY it without breaking the signature.
    token = jwt.encode(
        {
            "user_id": user["id"],
            "email": user["email"],
            # Token expires in 24 hours — after that the user must log in again
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        },
        SECRET_KEY,
        algorithm="HS256"   # the signing algorithm
    )

    return jsonify({"token": token, "email": user["email"]}), 200


# ── TOKEN VERIFICATION ────────────────────────────────────────────────────────

def verify_token():
    """
    A helper used by every protected route.
    Reads the token from the request header, verifies it, and returns the user data.
    Returns None if the token is missing, invalid, or expired.

    The token travels in the "Authorization" header as:
        Authorization: Bearer eyJhbGci...
    We strip the "Bearer " prefix to get the raw token.
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]  # everything after "Bearer "

    try:
        # jwt.decode verifies the signature using SECRET_KEY.
        # If the token was tampered with or expired, it raises an exception.
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload  # returns dict with user_id, email, exp
    except jwt.ExpiredSignatureError:
        return None  # token existed but has expired
    except jwt.InvalidTokenError:
        return None  # token is malformed or tampered with
