// ===== COOKIE UTILS =====
const COOKIE_KEY = "wheel_state_v1";

function setCookie(name, value, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie =
    name + "=" + encodeURIComponent(value) +
    "; Max-Age=" + maxAge +
    "; Path=/; SameSite=Lax";
}

function getCookie(name) {
  const parts = document.cookie.split("; ").map(s => s.split("="));
  for (const [k, v] of parts) {
    if (k === name) return decodeURIComponent(v || "");
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = name + "=; Max-Age=0; Path=/; SameSite=Lax";
}

// ===== DEFAULT NAMES (PODSTAWOWE OSOBY) =====
const DEFAULT_NAMES = [
  "Obszerny Obszar",
  "Inteligentny Fidek",
  "Sucha Suchecka",
  // dopisz resztę:
  // "Kacper",
  // "Bartek",
];

// ===== STATE =====
let state = {
  names: [],
  drawn: [],
  onlyNew: false
};

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const k = String(x).toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(String(x));
    }
  }
  return out;
}

function parseNames(text) {
  return text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function loadState() {
  // WAŻNE: nie może być "storeGet ? storeGet() : ..." bo storeGet może nie istnieć -> ReferenceError
  const raw = (typeof storeGet !== "undefined" && typeof storeGet === "function")
    ? storeGet()
    : getCookie(COOKIE_KEY);

  let parsed = null;

  if (raw) {
    if (typeof raw === "string") {
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
    } else if (typeof raw === "object") {
      parsed = raw;
    }
  }

  if (parsed && Array.isArray(parsed.names)) {
    state.names = parsed.names.map(s => String(s).trim()).filter(Boolean);
    state.drawn = (parsed.drawn || []).map(s => String(s).trim()).filter(Boolean);
    state.onlyNew = !!parsed.onlyNew;
  }

  // Jeśli brak imion – wstaw domyślne
  if (!state.names.length) {
    state.names = [...DEFAULT_NAMES];
  }
}

function saveState() {
  state.names = uniq(state.names.map(s => s.trim()).filter(Boolean));
  state.drawn = uniq(state.drawn.map(s => s.trim()).filter(Boolean));

  // usuń "wylosowanych", których nie ma już na liście imion
  const setNames = new Set(state.names.map(s => s.toLowerCase()));
  state.drawn = state.drawn.filter(n => setNames.has(String(n).toLowerCase()));

  setCookie(COOKIE_KEY, JSON.stringify(state));
}

function eligibleNames() {
  if (!state.onlyNew) return state.names;
  const drawnSet = new Set(state.drawn.map(s => s.toLowerCase()));
  return state.names.filter(n => !drawnSet.has(n.toLowerCase()));
}

// ===== UI ELEMENTS =====
const namesInput = document.getElementById("namesInput");
const onlyNewChk = document.getElementById("onlyNewChk");
const saveBtn = document.getElementById("saveBtn");
const clearDrawnBtn = document.getElementById("clearDrawnBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const poolPills = document.getElementById("poolPills");
const drawnPills = document.getElementById("drawnPills");
const suggestPills = document.getElementById("suggestPills");

// ===== RENDER =====
function renderPills(el, arr) {
  el.innerHTML = "";
  if (!arr.length) {
    const s = document.createElement("span");
    s.className = "pill";
    s.style.opacity = "0.7";
    s.textContent = "—";
    el.appendChild(s);
    return;
  }
  for (const n of arr) {
    const s = document.createElement("span");
    s.className = "pill";
    s.textContent = n;
    el.appendChild(s);
  }
}

function renderSuggest() {
  if (!suggestPills) return;

  const have = new Set(state.names.map(s => String(s).toLowerCase()));
  const suggestions = DEFAULT_NAMES.filter(n => !have.has(String(n).toLowerCase()));

  suggestPills.innerHTML = "";

  if (!suggestions.length) {
    const s = document.createElement("span");
    s.className = "pill";
    s.style.opacity = "0.7";
    s.textContent = "—";
    suggestPills.appendChild(s);
    return;
  }

  for (const n of suggestions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill";
    btn.style.cursor = "pointer";
    btn.textContent = n;

    btn.addEventListener("click", () => {
      state.names.push(String(n));
      saveState();
      render();
    });

    suggestPills.appendChild(btn);
  }
}

function render() {
  namesInput.value = state.names.join("\n");
  onlyNewChk.checked = state.onlyNew;

  renderPills(poolPills, eligibleNames());
  renderPills(drawnPills, state.drawn);

  renderSuggest();
}

// ===== COMMIT FROM UI =====
function commitFromUI() {
  state.names = parseNames(namesInput.value);
  state.onlyNew = !!onlyNewChk.checked;

  // jeśli user usunie wszystko, przywróć domyślne
  if (!state.names.length) state.names = [...DEFAULT_NAMES];

  saveState();
  render();
}

// ===== EVENTS =====

// Nie zapisujemy podczas pisania (żeby Enter nie wymuszał pośpiechu)
namesInput.addEventListener("input", () => {});

// Zapis dopiero gdy wyjdziesz z pola (klikniesz gdzie indziej)
namesInput.addEventListener("blur", commitFromUI);

// Checkbox może zapisywać od razu
onlyNewChk.addEventListener("change", commitFromUI);

// Przycisk zapisuje od razu
saveBtn.addEventListener("click", commitFromUI);

// Ctrl+S / Cmd+S zapisuje
window.addEventListener("keydown", (e) => {
  const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
  if (isSave) {
    e.preventDefault();
    commitFromUI();
  }
});

// Wyczyść listę wylosowanych
clearDrawnBtn.addEventListener("click", () => {
  state.drawn = [];
  saveState();
  render();
});

// Reset wszystko (czyści cookie i przywraca domyślne)
resetAllBtn.addEventListener("click", () => {
  deleteCookie(COOKIE_KEY);
  state = { names: [...DEFAULT_NAMES], drawn: [], onlyNew: false };
  saveState();
  render();
});


function applyDefaultPlaceholder() {
  if (!namesInput) return;
  namesInput.placeholder = DEFAULT_NAMES.join("\n");
}



// ===== INIT =====
loadState();
saveState();
render();

applyDefaultPlaceholder();