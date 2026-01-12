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
    const k = x.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function loadState() {
  const raw = getCookie(COOKIE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.names)) {
      state.names = parsed.names.map(s => String(s).trim()).filter(Boolean);
      state.drawn = parsed.drawn || [];
      state.onlyNew = !!parsed.onlyNew;
    }
  } catch {}
}

function saveState() {
  state.names = uniq(state.names.map(s => s.trim()).filter(Boolean));
  state.drawn = uniq(state.drawn.map(s => s.trim()).filter(Boolean));

  const setNames = new Set(state.names.map(s => s.toLowerCase()));
  state.drawn = state.drawn.filter(n => setNames.has(n.toLowerCase()));

  setCookie(COOKIE_KEY, JSON.stringify(state));
}

function eligibleNames() {
  if (!state.onlyNew) return state.names;
  const drawnSet = new Set(state.drawn.map(s => s.toLowerCase()));
  return state.names.filter(n => !drawnSet.has(n.toLowerCase()));
}

// ===== RANDOM (FAIR) =====
function secureRandomInt(maxExclusive) {
  if (maxExclusive <= 0) return 0;
  const u32 = new Uint32Array(1);
  const limit = Math.floor(0xFFFFFFFF / maxExclusive) * maxExclusive;
  let x;
  do {
    crypto.getRandomValues(u32);
    x = u32[0];
  } while (x >= limit);
  return x % maxExclusive;
}

function pickWinner() {
  const pool = eligibleNames();
  if (!pool.length) return null;
  return pool[secureRandomInt(pool.length)];
}

// ===== CANVAS / WHEEL =====
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const resultEl = document.getElementById("result");
const resultMeta = document.getElementById("resultMeta");
const spinBtn = document.getElementById("spinBtn");
const onlyNewChk = document.getElementById("onlyNewChk");
const clearDrawnBtn = document.getElementById("clearDrawnBtn");

let angle = 0;
let spinning = false;

function resizeCanvasForHiDPI() {
  const cssW = canvas.clientWidth || 560;
  const cssH = canvas.clientHeight || 560;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawBottle(x, y, size) {
  const s = size;
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.ellipse(0, s * 0.32, s * 0.28, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(-s * 0.22, -s * 0.22, s * 0.44, s * 0.54, s * 0.12);
  ctx.fillStyle = "rgba(255,255,255,.86)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.15)";
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-s * 0.10, -s * 0.44, s * 0.20, s * 0.26, s * 0.08);
  ctx.fillStyle = "rgba(255,255,255,.86)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.15)";
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(-s * 0.12, -s * 0.52, s * 0.24, s * 0.10, s * 0.06);
  ctx.fillStyle = "rgba(125,211,252,.65)";
  ctx.fill();
  ctx.strokeStyle = "rgba(125,211,252,.95)";
  ctx.stroke();

  ctx.restore();
}

function drawWheel() {
  const cssW = canvas.clientWidth || 560;
  const cssH = canvas.clientHeight || 560;

  ctx.clearRect(0, 0, cssW, cssH);

  const cx = cssW / 2;
  const cy = cssH / 2;
  const radius = Math.min(cx, cy) - 18;

  const names = state.names.length ? state.names : ["Brak imion"];
  const slice = (Math.PI * 2) / names.length;

  for (let i = 0; i < names.length; i++) {
    const start = angle + i * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();

    const hue = (i * 360) / names.length;
    ctx.fillStyle = `hsla(${hue}, 80%, 60%, .6)`;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(names[i], radius - 16, 6);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.fill();

  drawBottle(cx, cy, radius * 0.4);

  ctx.beginPath();
  ctx.moveTo(cx, cy - radius - 6);
  ctx.lineTo(cx - 14, cy - radius + 20);
  ctx.lineTo(cx + 14, cy - radius + 20);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
}

// ===== SPIN LOGIC =====
function angleToLandOnIndex(index, total) {
  const pointer = Math.PI * 1.5;
  const slice = (Math.PI * 2) / total;
  const targetCenter = pointer - (index + 0.5) * slice;
  return ((targetCenter % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function spin() {
  if (spinning) return;

  saveState();
  drawWheel();

  if (!state.names.length) {
    resultEl.firstChild.nodeValue = "Wynik: —";
    resultMeta.textContent = "Brak imion.";
    return;
  }

  const winner = pickWinner();
  if (!winner) {
    resultEl.firstChild.nodeValue = "Wynik: —";
    resultMeta.textContent = "Brak nowych osób do losowania.";
    return;
  }

  const total = state.names.length;
  const idx = state.names.findIndex(n => n.toLowerCase() === winner.toLowerCase());
  const finalAngle = angleToLandOnIndex(Math.max(0, idx), total);

  spinning = true;
  spinBtn.disabled = true;

  resultEl.firstChild.nodeValue = "Wynik: kręcę…";
  resultMeta.textContent = "Wynik już wylosowany.";

  const startAngle = angle;
  const spins = 6 + secureRandomInt(5);
  const target = startAngle + spins * Math.PI * 2 + finalAngle;

  const duration = 2400;
  const t0 = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - t0) / duration);
    const k = 1 - Math.pow(1 - t, 3);
    angle = startAngle + (target - startAngle) * k;
    drawWheel();

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      if (!state.drawn.some(n => n.toLowerCase() === winner.toLowerCase())) {
        state.drawn.push(winner);
      }

      saveState();

      resultEl.firstChild.nodeValue = "Wynik: " + winner;
      resultMeta.textContent = "Zapisano wylosowanego.";

      spinning = false;
      spinBtn.disabled = false;
    }
  }

  requestAnimationFrame(frame);
}

// ===== EVENTS =====
spinBtn.addEventListener("click", spin);

onlyNewChk.addEventListener("change", () => {
  state.onlyNew = !!onlyNewChk.checked;
  saveState();
});

clearDrawnBtn.addEventListener("click", () => {
  state.drawn = [];
  saveState();
  resultEl.firstChild.nodeValue = "Wynik: —";
  resultMeta.textContent = "Wyczyszczono wylosowanych.";
});

// ===== INIT =====
function init() {
  loadState();
  saveState();
  onlyNewChk.checked = state.onlyNew;
  resizeCanvasForHiDPI();
  drawWheel();
}

init();

window.addEventListener("resize", () => {
  resizeCanvasForHiDPI();
  drawWheel();
});
