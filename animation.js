// ─── Canvas setup ─────────────────────────────────────────────────────────
const staticCanvas  = document.getElementById('static');
const dynamicCanvas = document.getElementById('dynamic');
const sCtx = staticCanvas.getContext('2d');
const dCtx = dynamicCanvas.getContext('2d');

const W = window.innerWidth;
const H = window.innerHeight;
staticCanvas.width  = dynamicCanvas.width  = W;
staticCanvas.height = dynamicCanvas.height = H;

// ─── Config ───────────────────────────────────────────────────────────────
const CELL      = W < 768 ? 20 : 25;
const PAD       = Math.round(CELL / 2);
const COLS      = Math.floor((W - PAD * 2) / CELL) + 1;
const ROWS      = Math.floor((H - PAD * 2) / CELL) + 1;
const BOX_COLS  = COLS - 1;
const BOX_ROWS  = ROWS - 1;
const DOT_R     = 2;
let DRAW_DURATION = 40;

// ─── Deterministic centered forbidden zone ──────────────────────────────
function generateForbiddenZone() {
  const isMobile = W < 768;
  const widthRatio  = isMobile ? 0.85 : 0.50;
  const heightRatio = isMobile ? 0.85 : 0.80;

  const w = Math.max(3, Math.round(BOX_COLS * widthRatio));
  const h = Math.max(3, Math.round(BOX_ROWS * heightRatio));

  const c0 = Math.round((BOX_COLS - w) / 2);
  const r0 = Math.round((BOX_ROWS - h) / 2);

  return { r0, r1: r0 + h - 1, c0, c1: c0 + w - 1 };
}

const FORB = generateForbiddenZone();

// Expose forbidden zone pixel rect for content positioning
const dotX = c => PAD + c * CELL;
const dotY = r => PAD + r * CELL;

window.__forbiddenZoneRect = {
  x: dotX(FORB.c0),
  y: dotY(FORB.r0),
  width:  (FORB.c1 - FORB.c0 + 1) * CELL,
  height: (FORB.r1 - FORB.r0 + 1) * CELL
};

// ─── Colors ───────────────────────────────────────────────────────────────
const BG = '#0a0a12';

const PLAYERS = [
  { edge: '#4fc3f7', box: '#4fc3f7', glow: 'rgba(79,195,247,' },
  { edge: '#ef5350', box: '#ef5350', glow: 'rgba(239,83,80,'  },
  { edge: '#66bb6a', box: '#66bb6a', glow: 'rgba(102,187,106,' },
];

// ─── State ────────────────────────────────────────────────────────────────
let hEdges, vEdges, boxes, boxClaimTime;

function resetState() {
  hEdges       = Array.from({ length: ROWS },     () => Array(BOX_COLS).fill(null));
  vEdges       = Array.from({ length: BOX_ROWS }, () => Array(COLS).fill(null));
  boxes        = Array.from({ length: BOX_ROWS }, () => Array(BOX_COLS).fill(null));
  boxClaimTime = Array.from({ length: BOX_ROWS }, () => Array(BOX_COLS).fill(0));
}
resetState();

// ─── Geometry helpers ─────────────────────────────────────────────────────
function boxForbidden(r, c) {
  return r >= FORB.r0 && r <= FORB.r1 && c >= FORB.c0 && c <= FORB.c1;
}

function hEdgeBlocked(r, c) {
  const topF = (r - 1 >= 0 && r - 1 < BOX_ROWS) ? boxForbidden(r - 1, c) : true;
  const botF = (r >= 0     && r < BOX_ROWS)      ? boxForbidden(r, c)     : true;
  return topF && botF;
}

function vEdgeBlocked(r, c) {
  const leftF  = (c - 1 >= 0 && c - 1 < BOX_COLS) ? boxForbidden(r, c - 1) : true;
  const rightF = (c >= 0     && c < BOX_COLS)      ? boxForbidden(r, c)     : true;
  return leftF && rightF;
}

function edgePts(edge) {
  if (edge.type === 'h') {
    return [dotX(edge.c), dotY(edge.r), dotX(edge.c + 1), dotY(edge.r)];
  }
  return [dotX(edge.c), dotY(edge.r), dotX(edge.c), dotY(edge.r + 1)];
}

// ─── Game logic ───────────────────────────────────────────────────────────
function availableEdges() {
  const e = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < BOX_COLS; c++)
      if (!hEdges[r][c] && !hEdgeBlocked(r, c)) e.push({ type: 'h', r, c });
  for (let r = 0; r < BOX_ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!vEdges[r][c] && !vEdgeBlocked(r, c)) e.push({ type: 'v', r, c });
  return e;
}

function claimBoxes(player, now) {
  let n = 0;
  for (let r = 0; r < BOX_ROWS; r++)
    for (let c = 0; c < BOX_COLS; c++)
      if (!boxes[r][c] && !boxForbidden(r, c) &&
          hEdges[r][c] !== null && hEdges[r + 1][c] !== null &&
          vEdges[r][c] !== null && vEdges[r][c + 1] !== null) {
        boxes[r][c] = player;
        boxClaimTime[r][c] = now;
        n++;
      }
  return n;
}

// ─── Easing ───────────────────────────────────────────────────────────────
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ─── Pre-rendered dot sprites ─────────────────────────────────────────────
function makeDotSprite(color, glowColor, radius, glowRadius) {
  const size = glowRadius * 2 + 2;
  const off = document.createElement('canvas');
  off.width = off.height = size;
  const c = off.getContext('2d');
  const cx = size / 2, cy = size / 2;

  const grad = c.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, size, size);

  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();

  return { canvas: off, offset: size / 2 };
}

const dotSprite     = makeDotSprite('rgba(255,255,255,0.5)', 'rgba(255,255,255,0.08)', DOT_R, DOT_R * 4);
const dotSpriteForb = makeDotSprite('rgba(255,255,255,0.25)', 'rgba(255,255,255,0.04)', DOT_R, DOT_R * 4);

// ─── Draw static layer (once) ────────────────────────────────────────────
function drawStatic() {
  sCtx.fillStyle = BG;
  sCtx.fillRect(0, 0, W, H);

  // Faint grid lines
  sCtx.strokeStyle = 'rgba(255,255,255,0.02)';
  sCtx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++) {
    sCtx.beginPath();
    sCtx.moveTo(dotX(0), dotY(r));
    sCtx.lineTo(dotX(COLS - 1), dotY(r));
    sCtx.stroke();
  }
  for (let c = 0; c < COLS; c++) {
    sCtx.beginPath();
    sCtx.moveTo(dotX(c), dotY(0));
    sCtx.lineTo(dotX(c), dotY(ROWS - 1));
    sCtx.stroke();
  }

  // Forbidden zone fill
  const fx = dotX(FORB.c0), fy = dotY(FORB.r0);
  const fw = (FORB.c1 - FORB.c0 + 1) * CELL;
  const fh = (FORB.r1 - FORB.r0 + 1) * CELL;
  sCtx.fillStyle = 'rgba(255,60,60,0.04)';
  sCtx.fillRect(fx, fy, fw, fh);

  // Forbidden zone border
  sCtx.strokeStyle = 'rgba(255,255,255,0.15)';
  sCtx.lineWidth = 1.5;
  sCtx.lineJoin = 'round';
  sCtx.strokeRect(fx, fy, fw, fh);

  // Dots
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const inZone = r >= FORB.r0 && r <= FORB.r1 + 1 &&
                     c >= FORB.c0 && c <= FORB.c1 + 1;
      const sprite = inZone ? dotSpriteForb : dotSprite;
      sCtx.drawImage(sprite.canvas,
        dotX(c) - sprite.offset,
        dotY(r) - sprite.offset);
    }
  }
}

// ─── Dynamic renderer (per frame) ────────────────────────────────────────
function render(now, animEdge, animP, animPlayer) {
  dCtx.clearRect(0, 0, W, H);

  // Box fills
  for (let p = 0; p < PLAYERS.length; p++) {
    dCtx.fillStyle = PLAYERS[p].box;
    for (let r = 0; r < BOX_ROWS; r++) {
      for (let c = 0; c < BOX_COLS; c++) {
        if (boxes[r][c] === p) {
          const age = now - boxClaimTime[r][c];
          const flash = age < 300 ? 0.15 * (1 - age / 300) : 0;
          dCtx.globalAlpha = 0.12 + flash;
          dCtx.fillRect(dotX(c), dotY(r), CELL, CELL);
        }
      }
    }
  }
  dCtx.globalAlpha = 1;

  // Committed edges
  dCtx.lineCap = 'round';
  for (let p = 0; p < PLAYERS.length; p++) {
    dCtx.beginPath();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < BOX_COLS; c++)
        if (hEdges[r][c] === p) {
          dCtx.moveTo(dotX(c), dotY(r));
          dCtx.lineTo(dotX(c + 1), dotY(r));
        }
    for (let r = 0; r < BOX_ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (vEdges[r][c] === p) {
          dCtx.moveTo(dotX(c), dotY(r));
          dCtx.lineTo(dotX(c), dotY(r + 1));
        }
    dCtx.strokeStyle = PLAYERS[p].glow + '0.12)';
    dCtx.lineWidth = 5;
    dCtx.stroke();

    dCtx.strokeStyle = PLAYERS[p].edge;
    dCtx.lineWidth = 1.5;
    dCtx.globalAlpha = 0.85;
    dCtx.stroke();
    dCtx.globalAlpha = 1;
  }

  // Animated edge
  if (animEdge) {
    const [ax, ay, bx, by] = edgePts(animEdge);
    const ex = ax + (bx - ax) * animP;
    const ey = ay + (by - ay) * animP;

    dCtx.beginPath();
    dCtx.moveTo(ax, ay);
    dCtx.lineTo(ex, ey);
    dCtx.strokeStyle = PLAYERS[animPlayer].glow + '0.25)';
    dCtx.lineWidth = 6;
    dCtx.lineCap = 'round';
    dCtx.stroke();

    dCtx.beginPath();
    dCtx.moveTo(ax, ay);
    dCtx.lineTo(ex, ey);
    dCtx.strokeStyle = PLAYERS[animPlayer].edge;
    dCtx.lineWidth = 2;
    dCtx.globalAlpha = 0.95;
    dCtx.stroke();
    dCtx.globalAlpha = 1;
  }
}

// ─── Game loop ────────────────────────────────────────────────────────────
let currentPlayer = 0;
let animEdge = null, animStart = null, pendingEdge = null, pendingPlayer = null;
let gameOver = false;

function pickAndAnimate() {
  const avail = availableEdges();
  if (!avail.length) {
    gameOver = true;
    render(performance.now(), null, 1, 0);
    // Restart with slower speed after a pause
    setTimeout(() => {
      resetState();
      drawStatic();
      gameOver = false;
      currentPlayer = 0;
      DRAW_DURATION = 200;
      pickAndAnimate();
      requestAnimationFrame(loop);
    }, 2000);
    return;
  }
  const edge = avail[Math.floor(Math.random() * avail.length)];
  animEdge      = edge;
  animStart     = performance.now();
  pendingEdge   = edge;
  pendingPlayer = currentPlayer;
}

function loop(now) {
  if (gameOver) return;
  requestAnimationFrame(loop);

  if (animEdge) {
    const t = Math.min((now - animStart) / DRAW_DURATION, 1);
    render(now, animEdge, easeInOut(t), pendingPlayer);

    if (t >= 1) {
      if (pendingEdge.type === 'h') hEdges[pendingEdge.r][pendingEdge.c] = pendingPlayer;
      else                          vEdges[pendingEdge.r][pendingEdge.c] = pendingPlayer;

      const claimed = claimBoxes(pendingPlayer, now);
      if (!claimed) currentPlayer = (currentPlayer + 1) % PLAYERS.length;

      animEdge = null;
      pickAndAnimate();
    }
  } else {
    render(now, null, 1, 0);
  }
}

// ─── Resize ───────────────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => location.reload(), 300);
});

// ─── Boot ─────────────────────────────────────────────────────────────────
drawStatic();
render(performance.now(), null, 1, 0);
setTimeout(() => { pickAndAnimate(); requestAnimationFrame(loop); }, 400);
