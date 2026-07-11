// ─── Truchet background ───────────────────────────────────────────────────
// A quarter-circle Truchet tiling. Every second or so one tile rotates 90°
// and reroutes the maze; arcs warm toward the accent color near the cursor.

const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ACCENT = { r: 79, g: 195, b: 247 };
const FLIP_MS = 900;
const FLIP_EVERY = 700;
const MAX_FLIPS = 4;
const BASE_ALPHA = 0.12;
const CURSOR_RADIUS = 240;

let W, H, dpr, S, cols, rows, orient;
let flips = [];          // { k, start }
let lastFlip = 0;

const mouse = { x: -1e4, y: -1e4 };
let mouseDirty = false;

window.addEventListener('pointermove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouseDirty = true;
});
window.addEventListener('pointerleave', () => {
  mouse.x = -1e4;
  mouse.y = -1e4;
  mouseDirty = true;
});

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function init() {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  S = W < 768 ? 44 : 56;
  cols = Math.ceil(W / S) + 1;
  rows = Math.ceil(H / S) + 1;
  orient = new Uint8Array(cols * rows);
  for (let i = 0; i < orient.length; i++) orient[i] = Math.random() < 0.5 ? 0 : 1;
  flips = [];
}

// Arcs in tile-local coords; each tile spans [0,S]²
function tileArcs(o) {
  return o === 0
    ? [[0, 0, 0, Math.PI / 2], [S, S, Math.PI, Math.PI * 1.5]]
    : [[S, 0, Math.PI / 2, Math.PI], [0, S, Math.PI * 1.5, Math.PI * 2]];
}

function strokeFor(cx, cy) {
  const d = Math.hypot(cx - mouse.x, cy - mouse.y);
  const f = clamp(1 - d / CURSOR_RADIUS, 0, 1);
  const fs = f * f * (3 - 2 * f);
  const r = Math.round(255 + (ACCENT.r - 255) * fs);
  const g = Math.round(255 + (ACCENT.g - 255) * fs);
  const b = Math.round(255 + (ACCENT.b - 255) * fs);
  return { style: `rgba(${r},${g},${b},${(BASE_ALPHA + 0.24 * fs).toFixed(3)})`, hot: fs > 0.01 };
}

function draw(tMs) {
  ctx.clearRect(0, 0, W, H);
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';

  const flipping = new Map(flips.map(f => [f.k, easeInOut((tMs - f.start) / FLIP_MS)]));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      const cx = c * S + S / 2, cy = r * S + S / 2;
      const st = strokeFor(cx, cy);
      const prog = flipping.get(k);

      ctx.save();
      ctx.translate(cx, cy);
      if (prog !== undefined) ctx.rotate(prog * Math.PI / 2);
      ctx.beginPath();
      for (const [ax, ay, a0, a1] of tileArcs(orient[k])) {
        const ox = ax - S / 2, oy = ay - S / 2, R = S / 2;
        ctx.moveTo(ox + R * Math.cos(a0), oy + R * Math.sin(a0));
        ctx.arc(ox, oy, R, a0, a1, false);
      }
      ctx.restore();
      if (prog !== undefined && !st.hot) {
        // Rotating tiles glint toward the accent so each flip is findable
        const env = Math.sin(prog * Math.PI);
        const r2 = Math.round(255 + (ACCENT.r - 255) * env);
        const g2 = Math.round(255 + (ACCENT.g - 255) * env);
        const b2 = Math.round(255 + (ACCENT.b - 255) * env);
        ctx.strokeStyle = `rgba(${r2},${g2},${b2},${(BASE_ALPHA + 0.22 * env).toFixed(3)})`;
      } else {
        ctx.strokeStyle = st.style;
      }
      ctx.stroke();
    }
  }
}

function loop(tMs) {
  requestAnimationFrame(loop);

  if (!reduced && tMs - lastFlip > FLIP_EVERY && flips.length < MAX_FLIPS) {
    lastFlip = tMs;
    const k = Math.floor(Math.random() * orient.length);
    if (!flips.some(f => f.k === k)) flips.push({ k, start: tMs });
  }

  const done = flips.filter(f => tMs - f.start >= FLIP_MS);
  for (const f of done) orient[f.k] ^= 1;
  const finished = done.length > 0;
  flips = flips.filter(f => tMs - f.start < FLIP_MS);

  // Only repaint when something changed: an active flip, a completed flip,
  // or cursor movement since the last frame.
  if (flips.length || finished || mouseDirty) {
    mouseDirty = false;
    draw(tMs);
  }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    init();
    draw(performance.now());
  }, 200);
});

init();
draw(0);
if (!reduced) requestAnimationFrame(loop);
