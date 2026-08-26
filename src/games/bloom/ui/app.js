import { CONFIG } from '../config.js';
import { boot, step, applyAction, living, haulCeiling, realCeiling } from '../sim/index.js';
import { makeRenderer } from '../render/canvas.js';
import { makeJuice } from '../render/juice.js';

const [, , GREEN, GOLD, RED, WATER] = CONFIG.feel.palette;

const canvas = document.getElementById('field');
const renderer = makeRenderer(canvas, CONFIG);
const juice = makeJuice(CONFIG);

let state = boot(CONFIG, 1);
let speed = 1;
let tape = [];

function act(type, extra = {}) {
  const action = { type, ...extra };
  const r = applyAction(state, action, CONFIG);
  if (r.ok) tape.push({ day: state.day, tod: +state.tod.toFixed(4), ...action });
  else toast(r.reason, RED);
  refresh();
  return r;
}

// ---------------------------------------------------------------- game loop
let last = performance.now(), acc = 0;

function frame(now) {
  const dtMs = Math.min(120, now - last);
  last = now;

  // Fixed timestep: the sim never sees a variable dt, so a dropped frame cannot
  // change the outcome or invalidate a replay.
  acc += (dtMs / 1000) * speed;
  let guard = 0;
  while (acc >= CONFIG.time.dt && guard++ < 600) {
    const closed = step(state, CONFIG.time.dt, CONFIG);
    acc -= CONFIG.time.dt;
    if (closed) onDayClose(closed);
  }

  juice.update(dtMs);
  renderer.draw(state, juice, dtMs);
  requestAnimationFrame(frame);
}

function onDayClose(d) {
  const [w, h] = renderer.size;
  if (d.earned > 0) juice.float(w / 2, h * 0.3, '+$' + Math.round(d.earned), GOLD);
  if (d.died > 0) {
    juice.kick(CONFIG.feel.shakeOnDeath * Math.min(3, d.died));
    toast(d.died + ' plant' + (d.died > 1 ? 's' : '') + ' died of thirst', RED);
  } else if (d.wentRipe > 0) {
    toast(d.wentRipe + ' plant' + (d.wentRipe > 1 ? 's are' : ' is') + ' ripe', GOLD);
  }
  if (state.over) toast(state.overReason + ' — press R to restart', RED);
  refresh();
}

// ---------------------------------------------------------------------- HUD
const els = {};
for (const key of ['cash', 'seeds', 'day', 'alive', 'water', 'clock', 'log', 'walls', 'knobs', 'shop'])
  els[key] = document.getElementById(key);

function refresh() {
  els.cash.textContent = '$' + Math.round(state.cash);
  els.seeds.textContent = state.seeds.toFixed(1);
  els.day.textContent = state.day;

  const n = living(state).length;
  els.alive.textContent = n + ' / ' + state.pots.length;
  // Over the arithmetic ceiling is the whole tension. Say so in colour.
  els.alive.style.color = n > realCeiling(CONFIG) + 0.5 ? RED : GREEN;

  els.water.textContent = state.water.toFixed(1) + ' / ' + CONFIG.haul.reservoirMax;
  els.water.style.color = state.water < CONFIG.pour.amount ? RED : WATER;
  updateWalls();
  renderShop();
}

/** Writes the ceiling readout. Kept separate from showWalls() so refresh() can
 *  call it without the two recursing into each other. */
function updateWalls() {
  els.walls.textContent = haulCeiling(CONFIG).toFixed(2) + ' / ' + realCeiling(CONFIG).toFixed(2);
}

/**
 * The shop shows what each upgrade would do to your CEILING, not just what it
 * costs. That is the whole pitch of this game: you are meant to look at "3.59 ->
 * 6.85 plants" while staring at a 0%-idle day and understand why automation is
 * the only move left.
 */
function renderShop() {
  const now = realCeiling(CONFIG);
  els.shop.innerHTML = CONFIG.upgrades.map((up) => {
    const owned = state.owned.includes(up.id);
    const automation = up.effect.path === 'plant.drip';
    const after = owned ? now : ceilingWith(up);
    const delta = after - now;

    const gain = owned ? 'installed'
      : up.effect.pots ? '+' + up.effect.pots + ' pots'
      : delta > 0.01 ? '<em>ceiling ' + now.toFixed(1) + ' &rarr; ' + after.toFixed(1) + '</em>'
      : 'no ceiling change';

    return '<button class="up' + (automation ? ' auto' : '') + (owned ? ' owned' : '') + '"'
      + ' data-id="' + up.id + '"' + ((owned || state.cash < up.cost) ? ' disabled' : '') + '>'
      + '<b>' + up.name + '<i>' + (owned ? 'owned' : '$' + up.cost) + '</i></b>'
      + '<span>' + up.blurb + ' &middot; ' + gain + '</span></button>';
  }).join('');
}

/** What the ceiling would become if you bought this. Pure preview - never mutates. */
function ceilingWith(up) {
  if (up.effect.pots) return realCeiling(CONFIG);
  const probe = structuredClone(CONFIG);
  const keys = up.effect.path.split('.');
  const last = keys.pop();
  const t = keys.reduce((o, k) => o[k], probe);
  t[last] = up.effect.op === 'mul' ? t[last] * up.effect.value : t[last] + up.effect.value;
  if (up.effect.floor !== undefined) t[last] = Math.max(up.effect.floor, t[last]);
  return realCeiling(probe);
}

function drawClock() {
  const h = Math.floor(state.tod * 24), m = Math.floor((state.tod * 24 % 1) * 60);
  els.clock.textContent = 'day ' + state.day + '  ·  '
    + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  requestAnimationFrame(drawClock);
}

let toastT = null;
function toast(msg, color) {
  els.log.textContent = msg;
  els.log.style.color = color || GREEN;
  clearTimeout(toastT);
  toastT = setTimeout(() => { els.log.textContent = ''; }, 2400);
}

// ------------------------------------------------------------------- inputs
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const target = renderer.hit(state, e.clientX - r.left, e.clientY - r.top);
  if (target === 'river') return act('haul');
  if (target === null) return;

  const p = state.pots[target];
  if (!p) return act('plant', { pot: target });
  if (!p.alive) return act('clear', { pot: target });
  if (p.growth >= 1 - 1e-9) return act('harvest', { pot: target });
  return act('pour', { pot: target });
});

document.getElementById('expand').addEventListener('click', () => act('expand'));

els.shop.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]');
  if (!b || b.disabled) return;
  const up = CONFIG.upgrades.find((u) => u.id === b.dataset.id);
  if (act('buy', { id: b.dataset.id }).ok) {
    const [w, h] = renderer.size;
    juice.float(w / 2, h * 0.36, up.name, GREEN);
    toast(up.name + ' — ' + up.blurb, GREEN);
    showWalls();
  }
});

addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); speed = speed ? 0 : 1; toast(speed ? 'running' : 'paused', WATER); }
  if (e.key === '1') { speed = 1; toast('1x', WATER); }
  if (e.key === '2') { speed = 3; toast('3x', WATER); }
  if (e.key.toLowerCase() === 'h') act('haul');
  if (e.key.toLowerCase() === 'r') restart();
  if (e.key.toLowerCase() === 'e') exportTape();
  if (e.key.toLowerCase() === 'd') els.knobs.classList.toggle('open');
});

function restart() {
  state = boot(CONFIG, (state.seed % 9999) + 1);
  tape = [];
  toast('new run, seed ' + state.seed, WATER);
  refresh();
}

/** Deterministic sim + seeded RNG means a session IS its list of actions.
 *  Re-run a tape after a tuning change to see what it did to YOUR play. */
function exportTape() {
  const blob = { schema: 'bloom-tape/v1', seed: state.seed, config: CONFIG, tape };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }));
  a.download = 'bloom-tape-seed' + state.seed + '.json';
  a.click();
  toast('exported ' + tape.length + ' actions', GREEN);
}

// --------------------------------------------------------------- dev knobs
/** Live tuning, permanently. Ship it behind the D key, never delete it. */
const KNOBS = [
  ['time.daySeconds', 10, 120, 1],
  ['haul.tripSeconds', 0.5, 12, 0.25],
  ['haul.cupSize', 0.1, 3, 0.1],
  ['haul.reservoirMax', 1, 16, 1],
  ['pour.amount', 0.1, 2, 0.1],
  ['pour.seconds', 0.1, 3, 0.05],
  ['plant.waterNeed', 0.2, 4, 0.1],
  ['plant.growthCurve', 1, 6, 0.5],
  ['plant.growDays', 1, 8, 1],
  ['plant.price', 1, 30, 1],
];

const dig = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const put = (o, p, v) => {
  const k = p.split('.'); const lastKey = k.pop();
  k.reduce((a, x) => a[x], o)[lastKey] = v;
};
const outId = (p) => 'o_' + p.replace(/\./g, '_');

els.knobs.innerHTML = '<h3>dev knobs <span>D</span></h3>' + KNOBS.map(([p, min, max, st]) =>
  '<label>' + p + ' <output id="' + outId(p) + '">' + dig(CONFIG, p) + '</output>'
  + '<input type="range" data-path="' + p + '" min="' + min + '" max="' + max
  + '" step="' + st + '" value="' + dig(CONFIG, p) + '"></label>').join('');

els.knobs.addEventListener('input', (e) => {
  const p = e.target.dataset.path;
  if (!p) return;
  put(CONFIG, p, Number(e.target.value));
  document.getElementById(outId(p)).textContent = e.target.value;
  showWalls();
});

/**
 * The two arithmetic walls, recomputed live as you drag a knob. Watching this
 * number move while you shorten the trip is the fastest way to feel the model
 * without running a single simulated day.
 */
function showWalls() { refresh(); }

/** Dev hook: lets a test or an agent drive the real UI through the same seam a
 *  human click uses, so nothing here is a special path that could pass while
 *  the actual game is broken. */
window.__bloom = {
  get state() { return state; },
  CONFIG, act,
  speed: (v) => { speed = v; },
  stepFor(seconds) {
    const n = Math.round(seconds / CONFIG.time.dt);
    for (let i = 0; i < n && !state.over; i++) step(state, CONFIG.time.dt, CONFIG);
    refresh();
    return { day: state.day, tod: +state.tod.toFixed(3), alive: living(state).length };
  },
};

addEventListener('resize', () => renderer.resize());
renderer.resize();
showWalls();
requestAnimationFrame(frame);
requestAnimationFrame(drawClock);
toast('click the river to haul · click a pot to water it · space pauses', WATER);
