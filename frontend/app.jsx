/*
  app.jsx — the entire React frontend.

  This file contains 4 components, each with one job:

  ┌─────────────────────────────────┐
  │  App                            │  ← root component, owns all state
  │  ├── Header                     │  ← shows email + logout button
  │  ├── TodoInput                  │  ← the text box + Add button
  │  └── TodoList                   │  ← the list container
  │      └── TodoItem (× many)      │  ← one row per todo
  └─────────────────────────────────┘

  Data flows DOWN (parent passes data to children via "props").
  Events flow UP (children call functions given to them by parents).
  We'll explain both as we go.
*/

/*
  API base URL.
  - In development (your laptop): points to localhost
  - In production (Vercel): we'll update this to the real Render URL
    after deployment. This is the one line you change when going live.
*/
const API = "http://localhost:5000";

// ─── HELPER: auth headers ─────────────────────────────────────────────────
// Same as before — reads the JWT token from localStorage and builds the header.
function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${localStorage.getItem("token")}`
  };
}


// ════════════════════════════════════════════════════════════════════════════
// COMPONENT 1: Header
// ════════════════════════════════════════════════════════════════════════════
/*
  Props received:
    - email: the logged-in user's email address (to display)
    - onLogout: a function to call when the user clicks Log out

  "Props" (short for properties) are how a parent component passes data
  DOWN to a child. Think of them like function arguments:
    Header(email, onLogout) — here's what you need to do your job.

  The child never modifies props — it just reads and uses them.
  This is called "one-way data flow" and it keeps things predictable.
*/
function Header({ email, onLogout }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>

      <h1 style={{ margin: 0 }}>My Todo List</h1>

      <div style={{ textAlign: "right" }}>
        {/* Curly braces embed the email variable into the JSX */}
        <p style={{ fontSize: "13px", color: "#888", marginBottom: "4px" }}>{email}</p>

        {/*
          onClick={onLogout} — when clicked, call the onLogout function.
          Note: it's onClick NOT onclick (camelCase in JSX, not lowercase).
          onLogout was passed in as a prop from the parent (App component).
          The child doesn't know or care what onLogout does — it just calls it.
          The parent decides the behaviour. This is "lifting state up."
        */}
        <button onClick={onLogout} style={{ padding: "6px 12px", fontSize: "12px", backgroundColor: "#e53e3e" }}>
          Log out
        </button>
      </div>

    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// COMPONENT 2: TodoInput
// ════════════════════════════════════════════════════════════════════════════
/*
  Props received:
    - onAdd: a function to call when the user wants to add a todo.
             The parent (App) defines what "adding" actually does.
             This component just captures the text and fires the signal.

  This component has its OWN state: the current value of the input box.
  This is "local state" — only this component needs to know what's being typed.
  The parent doesn't care about half-typed text, only the final submitted value.
*/
function TodoInput({ onAdd }) {
  /*
    useState is a React "hook" — a special function that gives a component memory.

    const [text, setText] = useState("")
          ↑      ↑                  ↑
          │      │                  └─ starting value (empty string)
          │      └──────────────────── the function to update it
          └─────────────────────────── the current value

    Every time setText is called, React re-renders this component
    with the new value of text. The input box stays in sync automatically.
  */
  const [text, setText] = React.useState("");

  function handleAdd() {
    if (!text.trim()) return;  // ignore empty input
    onAdd(text.trim());        // tell the parent "the user wants to add this text"
    setText("");               // clear the input box (updates local state → re-render)
  }

  return (
    <div className="input-row">
      {/*
        value={text} — React controls the input's value via state.
                       This is called a "controlled component."
                       The input always shows exactly what's in state.

        onChange — fires on every keystroke.
                   e.target.value is the new full value of the input.
                   We update state with it → React re-renders → input shows new value.
                   This is the React way of reading input — no getElementById needed.
      */}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        placeholder="What do you need to do?"
      />
      <button onClick={handleAdd}>Add</button>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// COMPONENT 3: TodoItem
// ════════════════════════════════════════════════════════════════════════════
/*
  Props received:
    - todo: the todo object { id, text, done }
    - onToggle: function to call when the checkbox is clicked
    - onDelete: function to call when × is clicked
    - onEdit: function to call when Save is clicked with new text

  This component also has local state: whether it's currently in "edit mode."
  When editMode is true, it shows an input box instead of the text span.
  When editMode is false, it shows the normal read view.
*/
function TodoItem({ todo, onToggle, onDelete, onEdit }) {
  const [editMode, setEditMode]   = React.useState(false);
  const [editText, setEditText]   = React.useState(todo.text);

  function handleSave() {
    if (!editText.trim()) return;
    onEdit(todo.id, editText.trim());  // tell parent to save new text
    setEditMode(false);                // exit edit mode
  }

  /*
    Two different UIs depending on editMode state.
    React makes this clean: just use a ternary (? :) or if statement.
    Whichever branch runs, React renders that JSX. No manual DOM juggling.
  */
  return (
    <li id={`todo-${todo.id}`}>

      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
      />

      {/*
        editMode ? (edit view) : (read view)
        This is a ternary expression — a compact if/else.
        If editMode is true → show the input box
        If editMode is false → show the text span
      */}
      {editMode ? (
        <input
          className="edit-input"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditMode(false);
          }}
          autoFocus  // automatically focuses the input when it appears
        />
      ) : (
        <span className={`todo-text ${todo.done ? "done" : ""}`}>
          {todo.text}
        </span>
      )}

      {/* Edit/Save button — also swaps based on editMode */}
      {editMode ? (
        <button className="save-btn" onClick={handleSave}>Save</button>
      ) : (
        <button className="edit-btn" onClick={() => setEditMode(true)}>✏</button>
      )}

      <button className="delete-btn" onClick={() => onDelete(todo.id)}>×</button>

    </li>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// COMPONENT 4: TodoList
// ════════════════════════════════════════════════════════════════════════════
/*
  Props received:
    - todos: the array of todo objects
    - onToggle, onDelete, onEdit: functions passed straight through to TodoItem

  This component's only job is to loop through todos and render a TodoItem
  for each one. It's a thin wrapper — a "pass-through" component.

  The .map() method loops over an array and transforms each item.
  Here: for each todo object → return a TodoItem component.

  The key prop is required by React whenever you render a list.
  React uses it internally to track which item is which when the list changes.
  Always use a unique, stable value — never the array index.
*/
function TodoList({ todos, onToggle, onDelete, onEdit }) {
  if (todos.length === 0) {
    return <p style={{ color: "#aaa", fontStyle: "italic" }}>No todos yet — add one above!</p>;
  }

  return (
    <ul>
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </ul>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// COMPONENT 5: App  (the root — owns everything)
// ════════════════════════════════════════════════════════════════════════════
/*
  This is the top-level component. It:
    1. Owns all shared state (the todos array)
    2. Defines all the functions that modify state (add, delete, toggle, edit)
    3. Passes data and functions DOWN to child components via props
    4. Handles auth — redirects to login if no token

  This pattern — keeping all important state at the top and passing it down —
  is called "lifting state up." It means one source of truth: the todos list
  lives in ONE place, not scattered across multiple components.
*/
function App() {
  /*
    Two pieces of state this component owns:
      - todos: the list of todos fetched from the backend
      - email: the logged-in user's email (for display in Header)
  */
  const [todos, setTodos] = React.useState([]);
  const [email, setEmail] = React.useState("");

  /*
    useEffect is a React hook that runs code AFTER the component renders.
    Think of it as "when this component appears on screen, do this."

    The [] at the end is the "dependency array."
    Empty [] means: run this effect only ONCE, when the component first mounts.
    (If you put [todos] in there, it would re-run every time todos changes.)

    This is where we do our initial data fetch — the equivalent of the
    loadTodos() call at the bottom of our old script.js.
  */
  React.useEffect(() => {
    // Redirect to login if no token
    if (!localStorage.getItem("token")) {
      window.location.href = "login.html";
      return;
    }
    setEmail(localStorage.getItem("email") || "");
    fetchTodos();
  }, []);  // ← empty array = run once on mount

  // ── DATA FETCHING ──────────────────────────────────────────────────────
  async function fetchTodos() {
    const response = await fetch(`${API}/todos`, { headers: authHeaders() });
    if (response.status === 401) {
      window.location.href = "login.html";
      return;
    }
    const data = await response.json();
    setTodos(data);  // update state → React re-renders TodoList automatically
  }

  // ── EVENT HANDLERS ─────────────────────────────────────────────────────
  /*
    These functions are defined here (in App) and passed DOWN to children.
    Children call them when events happen — but the actual logic lives here.
    This keeps the state management in one place.
  */

  async function handleAdd(text) {
    const newTodo = { id: Date.now().toString(), text };
    await fetch(`${API}/todos`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(newTodo)
    });
    fetchTodos();  // refresh state from backend → triggers re-render
  }

  async function handleToggle(id) {
    await fetch(`${API}/todos/${id}`, { method: "PATCH", headers: authHeaders() });
    fetchTodos();
  }

  async function handleDelete(id) {
    await fetch(`${API}/todos/${id}`, { method: "DELETE", headers: authHeaders() });
    fetchTodos();
  }

  async function handleEdit(id, newText) {
    await fetch(`${API}/todos/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ text: newText })
    });
    fetchTodos();
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    window.location.href = "login.html";
  }

  // ── RENDER ─────────────────────────────────────────────────────────────
  /*
    This is what the App component renders.
    It passes data and functions to child components via props.

    Notice: App doesn't know HOW Header displays the email,
    or HOW TodoInput captures text. It just passes the data and functions.
    Each child owns its own presentation.
  */
  return (
    <div className="container">
      <Header
        email={email}
        onLogout={handleLogout}
      />
      <TodoInput
        onAdd={handleAdd}
      />
      <TodoList
        todos={todos}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// MOUNT THE APP
// ════════════════════════════════════════════════════════════════════════════
/*
  This is the bridge between React and the browser.
  ReactDOM.createRoot finds the <div id="root"> in index.html
  and tells React: "render the App component inside this div."

  After this line, React owns everything inside #root.
  It renders the first time, then re-renders automatically whenever state changes.
*/
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
