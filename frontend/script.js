/*
  This file makes the page interactive.
  It talks to the backend using "fetch" — a built-in browser tool
  for sending HTTP requests, the same kind curl sent in the terminal.

  Every function here maps to one backend route we built in app.py.
*/

// The backend's address. If this ever changes, we only update it here.
const API = "http://localhost:5000";


// ─── LOAD TODOS ON PAGE OPEN ───────────────────────────────────────────────
/*
  When the page first loads, we want to show any existing todos.
  We send a GET request to /todos and render whatever the backend sends back.

  "async/await" — when we ask the backend for data, we have to WAIT for the
  response before we can use it (the internet takes time). async/await is
  JavaScript's way of pausing and waiting politely without freezing the page.
*/
async function loadTodos() {
  const response = await fetch(`${API}/todos`);  // send the GET request, wait
  const todos = await response.json();           // read the response as JSON, wait
  renderTodos(todos);                            // draw them on screen
}


// ─── ADD A TODO ────────────────────────────────────────────────────────────
/*
  Called when the user clicks the Add button (set up in index.html via onclick).
  Reads what the user typed, sends it to the backend, then reloads the list.
*/
async function addTodo() {
  // document.getElementById finds an HTML element by its id attribute.
  // .value reads the current text inside it.
  const input = document.getElementById("todo-input");
  const text = input.value.trim();  // .trim() removes accidental spaces at the edges

  // If the user clicked Add with nothing typed, do nothing.
  if (!text) return;

  // Date.now() gives the current time in milliseconds — a quick unique ID.
  // In a real app you'd use a proper ID generator, but this works fine for learning.
  const newTodo = {
    id: Date.now().toString(),
    text: text
  };

  // Send a POST request to the backend with the new todo as JSON in the body.
  // Think of the "body" as the contents of an envelope we're mailing.
  await fetch(`${API}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },  // tells backend: "this is JSON"
    body: JSON.stringify(newTodo)                      // convert JS object → JSON string
  });

  input.value = "";  // clear the input box after adding
  loadTodos();       // refresh the list on screen
}


// ─── DELETE A TODO ─────────────────────────────────────────────────────────
/*
  Called when the user clicks the × button on a todo.
  Sends a DELETE request with the todo's id in the URL.
*/
async function deleteTodo(id) {
  await fetch(`${API}/todos/${id}`, {
    method: "DELETE"
  });
  loadTodos();  // refresh the list
}


// ─── TOGGLE A TODO DONE/UNDONE ─────────────────────────────────────────────
/*
  Called when the user clicks the checkbox on a todo.
  Sends a PATCH request to flip the done state on the backend.
*/
async function toggleTodo(id) {
  await fetch(`${API}/todos/${id}`, {
    method: "PATCH"
  });
  loadTodos();  // refresh the list
}


// ─── EDIT A TODO ──────────────────────────────────────────────────────────
/*
  Called when the user clicks the ✏ button on a todo.
  Instead of talking to the backend, this just transforms the row in place:
  - the static text span is replaced with a live <input> box
  - the edit button is replaced with a Save button

  We find the todo's <li> element using the id we stamped onto it in renderTodos.
*/
function editTodo(id) {
  const li = document.getElementById(`todo-${id}`);

  // querySelector finds the first element matching a CSS selector inside li.
  // Here we grab the span holding the todo text so we can read its current text.
  const span = li.querySelector(".todo-text");
  const currentText = span.textContent.trim();

  // Swap the static span for an editable input pre-filled with the current text.
  // We give the input an id so saveTodo can easily read its value later.
  span.outerHTML = `<input class="edit-input" id="edit-${id}" value="${currentText}" />`;

  // Swap the edit button for a Save button.
  const editBtn = li.querySelector(".edit-btn");
  editBtn.outerHTML = `<button class="save-btn" onclick="saveTodo('${id}')">Save</button>`;

  const input = document.getElementById(`edit-${id}`);

  // Cancel on Escape — revert by re-fetching and re-rendering the saved state.
  input.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
      loadTodos();
    }
  });

  /*
    Cancel on click-away (blur fires whenever the input loses focus).
    But clicking Save ALSO causes a blur first — before the click registers.
    event.relatedTarget is the element that just received focus.
    If that's the Save button, we skip the cancel and let the click proceed.
  */
  input.addEventListener("blur", function(event) {
    if (event.relatedTarget && event.relatedTarget.classList.contains("save-btn")) {
      return;
    }
    loadTodos();
  });

  input.focus();
}


// ─── SAVE AN EDITED TODO ───────────────────────────────────────────────────
/*
  Called when the user clicks Save after editing.
  Reads the new text from the input box, sends it to the backend via PUT,
  then reloads the list — which redraws everything back to normal read mode.
*/
async function saveTodo(id) {
  const newText = document.getElementById(`edit-${id}`).value.trim();

  // If they cleared the box entirely, do nothing — don't save a blank todo.
  if (!newText) return;

  await fetch(`${API}/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: newText })  // send only the text — backend handles the rest
  });

  loadTodos();  // re-render all rows back into normal read mode
}


// ─── RENDER TODOS ──────────────────────────────────────────────────────────
/*
  This function takes the list of todos and draws them on screen.
  It does NOT talk to the backend — it only updates what the user sees.

  This separation is intentional:
  - fetch functions handle communication with the backend
  - renderTodos handles drawing on screen
  One job per function.
*/
function renderTodos(todos) {
  // Find the <ul id="todo-list"> element in index.html
  const list = document.getElementById("todo-list");

  // Clear whatever is currently shown — we're about to redraw everything fresh
  list.innerHTML = "";

  // Loop through each todo and build an HTML "li" element for it
  todos.forEach(todo => {
    /*
      document.createElement("li") creates a new <li> element in memory.
      It doesn't appear on screen yet — we're building it before displaying it,
      like assembling furniture before putting it in the room.
    */
    const li = document.createElement("li");

    /*
      We add id="todo-${todo.id}" to the <li> itself so that editTodo() can
      find this exact row later using document.getElementById(`todo-${id}`).
      Without this, we'd have no reliable way to locate the right row.

      We're building 4 things inside each todo row:
        1. A checkbox (checked if done)
        2. A span with the todo text (with .done class if completed)
        3. An edit ✏ button
        4. A delete × button
    */
    li.id = `todo-${todo.id}`;
    li.innerHTML = `
      <input
        type="checkbox"
        ${todo.done ? "checked" : ""}
        onchange="toggleTodo('${todo.id}')"
      />
      <span class="todo-text ${todo.done ? "done" : ""}">
        ${todo.text}
      </span>
      <button class="edit-btn" onclick="editTodo('${todo.id}')">✏</button>
      <button class="delete-btn" onclick="deleteTodo('${todo.id}')">×</button>
    `;

    /*
      appendChild adds this completed <li> into the <ul> on screen.
      Now the user can see it.
    */
    list.appendChild(li);
  });
}


// ─── ALLOW PRESSING ENTER TO ADD ───────────────────────────────────────────
/*
  Quality of life: the user shouldn't have to click Add every time.
  This listens for any key pressed, and if it's Enter, calls addTodo().

  addEventListener is how JavaScript "listens" for events (clicks, keypresses, etc).
*/
document.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    addTodo();
  }
});


// ─── START ─────────────────────────────────────────────────────────────────
// This runs immediately when the page loads.
// It kicks everything off by fetching and displaying existing todos.
loadTodos();
