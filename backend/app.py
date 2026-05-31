import sqlite3
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from auth import register, login, verify_token, init_users_table

# --- SETUP ---

app = Flask(__name__)
CORS(app)

DB_FILE = os.path.join(os.path.dirname(__file__), "todos.db")


# --- DATABASE SETUP ---

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Create the todos table.
    Now includes a user_id column — every todo belongs to a specific user.
    FOREIGN KEY links user_id to the users table, ensuring referential integrity:
    you can't create a todo for a user that doesn't exist.
    """
    conn = get_db()
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS todos (
            id      TEXT PRIMARY KEY,
            text    TEXT NOT NULL,
            done    INTEGER DEFAULT 0,
            user_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()


# Run both table setups when the server starts.
# Users table must be created first because todos references it.
init_users_table()
init_db()


# --- AUTH ROUTES ---
# These are public — no token required (you need them to GET a token).

@app.route("/register", methods=["POST"])
def handle_register():
    return register()

@app.route("/login", methods=["POST"])
def handle_login():
    return login()


# --- TODO ROUTES ---
# Every route below is PROTECTED — it calls verify_token() first.
# If the token is missing or invalid, we return 401 (Unauthorised) immediately.
# If valid, we get the user's id and only touch THEIR todos.

@app.route("/todos", methods=["GET"])
def get_todos():
    """
    GET /todos — fetch only the logged-in user's todos.
    SQL: SELECT ... WHERE user_id = ?  ← the ? is the logged-in user's id
    """
    user = verify_token()
    if not user:
        return jsonify({"error": "Please log in"}), 401

    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM todos WHERE user_id = ?", (user["user_id"],)
    ).fetchall()
    conn.close()

    todos = [
        {"id": row["id"], "text": row["text"], "done": bool(row["done"])}
        for row in rows
    ]
    return jsonify(todos)


@app.route("/todos", methods=["POST"])
def add_todo():
    """
    POST /todos — add a todo, tagged with the logged-in user's id.
    """
    user = verify_token()
    if not user:
        return jsonify({"error": "Please log in"}), 401

    data = request.json
    conn = get_db()
    conn.execute(
        "INSERT INTO todos (id, text, done, user_id) VALUES (?, ?, ?, ?)",
        (data["id"], data["text"], 0, user["user_id"])
    )
    conn.commit()
    conn.close()

    return jsonify({"id": data["id"], "text": data["text"], "done": False}), 201


@app.route("/todos/<todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    """
    DELETE /todos/<todo_id>
    The WHERE clause includes user_id so users can only delete their OWN todos.
    Even if someone guesses another user's todo id, they can't delete it.
    """
    user = verify_token()
    if not user:
        return jsonify({"error": "Please log in"}), 401

    conn = get_db()
    conn.execute(
        "DELETE FROM todos WHERE id = ? AND user_id = ?",
        (todo_id, user["user_id"])
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted"})


@app.route("/todos/<todo_id>", methods=["PATCH"])
def toggle_todo(todo_id):
    user = verify_token()
    if not user:
        return jsonify({"error": "Please log in"}), 401

    conn = get_db()
    conn.execute(
        "UPDATE todos SET done = 1 - done WHERE id = ? AND user_id = ?",
        (todo_id, user["user_id"])
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Updated"})


@app.route("/todos/<todo_id>", methods=["PUT"])
def update_todo(todo_id):
    user = verify_token()
    if not user:
        return jsonify({"error": "Please log in"}), 401

    data = request.json
    conn = get_db()
    conn.execute(
        "UPDATE todos SET text = ? WHERE id = ? AND user_id = ?",
        (data["text"], todo_id, user["user_id"])
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Updated"})


# --- START ---
# Learning note: this is where the server boots up and begins listening for requests.

if __name__ == "__main__":
    app.run(port=5000, debug=True)
