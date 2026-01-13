const bottle = document.getElementById("bottle");

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
    const k = String(x).toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(String(x));
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
      state.drawn = (parsed.drawn || []).map(s => String(s).trim()).filter(Boolean);
      state.onlyNew = !!parsed.onlyNew;
    }
  } catch {}
}

function saveState() {
  state.names = uniq(state.names.map(s => s.trim()).filter(Boolean));
  state.drawn = uniq(state.drawn.map(s => s.trim()).filter(Boolean));

  const setNames = new Set(state.names.map(s => s.toLowerCase()));
  state.drawn = state.drawn.filter(n => setNames.has(String(n).toLowerCase()));

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

// ===== CANVAS / WHEEL =====
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const resultEl = document.getElementById("result");
const spinBtn = document.getElementById("spinBtn");

// ===== ROTATION STATE =====
let wheelAngle = 0;     // koło zawsze kręci się powoli
let bottleAngle = 0;    // butelka: powoli na idle, szybciej przy spin
let spinning = false;
let lastT = performance.now();

// JEDNA prędkość idle dla obu => identyczne tempo
const IDLE_SPEED = 0.9; // rad/s (zwiększ/zmniejsz jak chcesz)

function norm(x) {
  const twopi = Math.PI * 2;
  return ((x % twopi) + twopi) % twopi;
}

// winner z aktualnych kątów (koło się kręci => liczymy wzgl. wheelAngle)
function winnerIndexFromAngles(bAng, wAng, total) {
  const pointer = Math.PI * 1.5 + bAng; // góra + obrót butelki
  const slice = (Math.PI * 2) / total;
  const rel = norm(pointer - wAng);
  return Math.floor(rel / slice) % total;
}

// jaki kąt butelki ma wskazać segment index przy wheelAngleEnd
function bottleAngleToPointIndexAtWheel(index, total, wheelAngleEnd) {
  const slice = (Math.PI * 2) / total;

  // jitter, żeby nie lądować zawsze w środku (zawsze w obrębie segmentu)
  const maxJitter = slice * 0.45;
  const SCALE = 1_000_000;
  const r = secureRandomInt(2 * SCALE + 1) - SCALE; // [-SCALE, +SCALE]
  const jitter = (r / SCALE) * maxJitter;

  const targetPointer = wheelAngleEnd + (index + 0.5) * slice + jitter;
  return norm(targetPointer - Math.PI * 1.5);
}

function resizeCanvasForHiDPI() {
  const cssW = canvas.clientWidth || 560;
  const cssH = canvas.clientHeight || 560;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const start = wheelAngle + i * slice;
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
}

// ===== IDLE LOOP (koło zawsze, butelka zawsze gdy nie spin) =====
function tick(now) {
  // dt w sekundach, przycięte żeby po lagach nie skakało
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // koło zawsze kręci się powoli
  wheelAngle += IDLE_SPEED * dt;

  // butelka na idle ma DOKŁADNIE tę samą prędkość
  if (!spinning) {
    bottleAngle += IDLE_SPEED * dt;
  }

  drawWheel();

  if (bottle) {
    bottle.style.transform =
      `translate(-50%, -50%) rotate(${bottleAngle}rad)`;
  }

  requestAnimationFrame(tick);
}

// ===== SPIN (tylko butelka przyspiesza) =====
function spin() {
  if (spinning) return;

  saveState();

  if (!state.names.length) {
    resultEl.firstChild.nodeValue = "—";
    return;
  }

  const total = state.names.length;
  const eligible = eligibleNames();
  if (!eligible.length) {
    resultEl.firstChild.nodeValue = "—";
    return;
  }

  const eligibleSet = new Set(eligible.map(n => n.toLowerCase()));
  const eligibleIdxs = [];
  for (let i = 0; i < state.names.length; i++) {
    if (eligibleSet.has(state.names[i].toLowerCase())) eligibleIdxs.push(i);
  }
  if (!eligibleIdxs.length) {
    resultEl.firstChild.nodeValue = "—";
    return;
  }

  // crypto-losowe: wybór segmentu z puli eligible
  const chosenIdx = eligibleIdxs[secureRandomInt(eligibleIdxs.length)];

  spinning = true;
  spinBtn.disabled = true;

  const startBottle = bottleAngle;
  const duration = 2400;
  const t0 = performance.now();

  // przewidujemy, gdzie będzie koło na końcu (bo stale się kręci IDLE_SPEED)
  const wheelAngleEnd = wheelAngle + IDLE_SPEED * (duration / 1000);

  // docelowy kąt butelki (z jitterem w segmencie)
  const wantedBottle = bottleAngleToPointIndexAtWheel(chosenIdx, total, wheelAngleEnd);

  const twopi = Math.PI * 2;
  const delta = norm(wantedBottle - norm(startBottle));
  const spins = 6 + secureRandomInt(5); // crypto
  const targetBottle = startBottle + spins * twopi + delta;

  function frame(now) {
    const t = Math.min(1, (now - t0) / duration);
    const k = 1 - Math.pow(1 - t, 3);

    // tylko butelka przyspiesza
    bottleAngle = startBottle + (targetBottle - startBottle) * k;

    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }

    // finish: ustaw idealnie i policz winnera z aktualnych kątów
    bottleAngle = wantedBottle;

    const winIdx = winnerIndexFromAngles(bottleAngle, wheelAngle, total);
    const winner = state.names[winIdx];

    if (winner && !state.drawn.some(n => n.toLowerCase() === winner.toLowerCase())) {
      state.drawn.push(winner);
    }

    saveState();
    resultEl.firstChild.nodeValue = winner || "—";

    spinning = false;
    spinBtn.disabled = false;
  }

  requestAnimationFrame(frame);
}

// ===== INIT =====
function init() {
  loadState();
  if (!state.names.length) state.names = ["Brak imion"];
  saveState();

  resizeCanvasForHiDPI();
  drawWheel();

  lastT = performance.now();
  requestAnimationFrame(tick);
}

spinBtn.addEventListener("click", spin);

window.addEventListener("resize", () => {
  resizeCanvasForHiDPI();
  drawWheel();
});

init();
