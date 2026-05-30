import sqlite3
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- SETUP ---

app = Flask(__name__)
CORS(app)

# Path to the SQLite database file.
# Just like todos.json, it's a single file — but it's a real database inside.
DB_FILE = os.path.join(os.path.dirname(__file__), "todos.db")


# --- DATABASE SETUP ---

def get_db():
    """
    Open a connection to the database.

    A "connection" is like opening a phone call with the database.
    You open it, do your work, then close it.
    Every request gets its own connection — we don't share one globally
    because that causes bugs when multiple requests happen at the same time.
    """
    conn = sqlite3.connect(DB_FILE)

    # row_factory makes rows behave like dictionaries: row["text"]
    # instead of row[1]. Much easier to work with.
    conn.row_factory = sqlite3.Row

    return conn


def init_db():
    """
    Create the todos table if it doesn't already exist.
    This runs once when the server starts.

    A "table" is like a spreadsheet inside the database:
    - Each column is a field: id, text, done
    - Each row is one todo

    SQL translation:
      CREATE TABLE IF NOT EXISTS todos  → make a table called "todos" (skip if exists)
      id TEXT PRIMARY KEY               → id column, text type, must be unique
      text TEXT NOT NULL                → text column, can't be empty
      done INTEGER DEFAULT 0            → done column, 0=false 1=true (SQL has no boolean)
    """
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS todos (
            id   TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            done INTEGER DEFAULT 0
        )
    """)
    conn.commit()   # commit = "save these changes permanently"
    conn.close()


# Run init_db immediately when the server starts.
# After the first run, CREATE TABLE IF NOT EXISTS means it safely does nothing.
init_db()


# --- ROUTES ---
# The routes are identical to before — same URLs, same responses.
# Only the storage mechanism changed (SQL instead of JSON file).
# The frontend will never know the difference.

@app.route("/todos", methods=["GET"])
def get_todos():
    """
    GET /todos — fetch all todos.

    SQL: SELECT * FROM todos
    Plain English: "Give me every row from the todos table."
    """
    conn = get_db()
    rows = conn.execute("SELECT * FROM todos").fetchall()
    conn.close()

    # Each row is a sqlite3.Row object. We convert it to a plain dict
    # so jsonify can turn it into JSON to send to the frontend.
    # done is stored as 0/1 in SQL — we convert it back to True/False here.
    todos = [
        {"id": row["id"], "text": row["text"], "done": bool(row["done"])}
        for row in rows
    ]
    return jsonify(todos)


@app.route("/todos", methods=["POST"])
def add_todo():
    """
    POST /todos — add a new todo.

    SQL: INSERT INTO todos (id, text, done) VALUES (?, ?, ?)
    Plain English: "Add a new row with these values."
    The ? marks are placeholders — we never put variables directly into SQL
    strings because that opens a security hole called SQL injection.
    """
    data = request.json
    conn = get_db()
    conn.execute(
        "INSERT INTO todos (id, text, done) VALUES (?, ?, ?)",
        (data["id"], data["text"], 0)
    )
    conn.commit()
    conn.close()

    new_todo = {"id": data["id"], "text": data["text"], "done": False}
    return jsonify(new_todo), 201


@app.route("/todos/<todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    """
    DELETE /todos/<todo_id> — remove a todo.

    SQL: DELETE FROM todos WHERE id = ?
    Plain English: "Remove the row where id matches."
    """
    conn = get_db()
    conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted"})


@app.route("/todos/<todo_id>", methods=["PATCH"])
def toggle_todo(todo_id):
    """
    PATCH /todos/<todo_id> — flip done between 0 and 1.

    SQL: UPDATE todos SET done = 1 - done WHERE id = ?
    Plain English: "For the matching row, set done to (1 minus its current value)."
    1 - 0 = 1 (mark done), 1 - 1 = 0 (mark undone). A neat SQL trick.
    """
    conn = get_db()
    conn.execute("UPDATE todos SET done = 1 - done WHERE id = ?", (todo_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Updated"})


@app.route("/todos/<todo_id>", methods=["PUT"])
def update_todo(todo_id):
    """
    PUT /todos/<todo_id> — update a todo's text.

    SQL: UPDATE todos SET text = ? WHERE id = ?
    Plain English: "For the matching row, overwrite the text column."
    """
    data = request.json
    conn = get_db()
    conn.execute(
        "UPDATE todos SET text = ? WHERE id = ?",
        (data["text"], todo_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Updated"})


# --- START ---

if __name__ == "__main__":
    app.run(port=5000, debug=True)
