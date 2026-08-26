import { CONFIG } from '../config.js';
import { boot, step, applyAction, population, starTier, unlocked } from '../sim/index.js';
import { makeRenderer } from '../render/canvas.js';
import { makeJuice } from '../render/juice.js';

const [, , GOOD, WARN, BAD, INFO] = CONFIG.feel.palette;

const canvas = document.getElementById('tower');
const renderer = makeRenderer(canvas, CONFIG);
const juice = makeJuice(CONFIG);

let state = boot(CONFIG, 1);
let speed = 1;
let tool = 'office';

/**
 * Every action is recorded. Because the sim is deterministic and seeded, this
 * log replays your exact session against new tuning — which is the only way to
 * ask "did that change help ME play, or just help the autoplayer?"
 */
let tape = [];

function act(type, extra = {}) {
  const action = { type, ...extra };
  const r = applyAction(state, action, CONFIG);
  if (r.ok) {
    tape.push({ day: state.day, tod: +state.tod.toFixed(4), ...action });
  } else {
    toast(r.reason, BAD);
  }
  refresh();
  return r;
}

// ---------------------------------------------------------------- game loop
let last = performance.now(), acc = 0;

function frame(now) {
  const dtMs = Math.min(120, now - last);
  last = now;

  // Fixed timestep. The sim NEVER sees a variable dt, so a dropped frame or a
  // 144Hz monitor cannot change the outcome or break a replay.
  acc += (dtMs / 1000) * speed;
  let guard = 0;
  while (acc >= CONFIG.time.dt && guard++ < 600) {
    const before = state.units.filter((u) => u.occupied).length;
    const closed = step(state, CONFIG.time.dt, CONFIG);
    acc -= CONFIG.time.dt;
    if (closed) onDayClose(closed, before);
  }

  juice.update(dtMs);
  renderer.draw(state, juice, dtMs);
  requestAnimationFrame(frame);
}

function onDayClose(closed, occupiedBefore) {
  const net = closed.net;
  const [w, h] = renderer.size;
  juice.float(w / 2, h * 0.28, (net >= 0 ? '+$' : '-$') + Math.abs(net), net >= 0 ? GOOD : BAD);

  if (closed.vacated > 0) {
    juice.kick(CONFIG.feel.shakeOnVacate * Math.min(3, closed.vacated));
    toast(closed.vacated + ' tenant' + (closed.vacated > 1 ? 's' : '') + ' walked out', BAD);
  }
  for (const u of state.units) {
    if (!u.occupied) continue;
    const [x, y] = renderer.unitPos(state, u);
    if (u.stress > CONFIG.units[u.kind].vacateAt * 0.7) juice.pulse(x, y, WARN, 18);
  }
  if (state.over) toast('BANKRUPT on day ' + state.day + ' — press R to restart', BAD);
  refresh();
}

// ---------------------------------------------------------------------- HUD
const els = {};
for (const id of ['money', 'day', 'pop', 'star', 'wait', 'rate', 'rep', 'clock', 'build', 'log', 'knobs', 'mode', 'goal-copy'])
  els[id] = document.getElementById(id);

const money = (n) => '$' + Math.round(n).toLocaleString();

function modeText() {
  if (tool === 'shaft') return 'SHAFT selected — click the top floor to place it.';
  if (tool === 'car') return 'CAR selected — click an elevator shaft to add it.';
  return tool.toUpperCase() + ' selected — click an upper floor to place it.';
}

function setMode(text = modeText(), color = GOOD) {
  els.mode.textContent = text;
  els.mode.style.color = color;
  els.mode.style.borderColor = color;
}

function refresh() {
  const d = state.log[state.log.length - 1];
  els.money.textContent = '$' + Math.round(state.money).toLocaleString();
  els.money.style.color = state.money < 2000 ? BAD : GOOD;
  els.day.textContent = state.day;
  els.pop.textContent = population(state);
  els.star.textContent = starTier(state, CONFIG).name;
  els.wait.textContent = d ? d.avgWait + 's' : '—';
  els.wait.style.color = d && d.avgWait > CONFIG.units.office.patience ? BAD : GOOD;
  els.rate.textContent = d ? d.deliveryRate + '%' : '—';
  els.rate.style.color = d && d.deliveryRate < 70 ? BAD : GOOD;
  els.rep.textContent = d ? d.rep + '%' : '—';
  els.rep.style.color = d && d.rep < CONFIG.occupancy.relistMinDeliveryRate ? BAD : GOOD;
  els['goal-copy'].textContent = d
    ? 'Keep delivery above ' + CONFIG.occupancy.relistMinDeliveryRate + '% · current ' + d.deliveryRate + '%.'
    : 'Keep delivery above ' + CONFIG.occupancy.relistMinDeliveryRate + '% so tenants stay.';

  const costs = {
    floor: money(CONFIG.costs.floor),
    shaft: money(CONFIG.costs.shaft) + ' + span',
    car: money(CONFIG.costs.car),
    extend: money(CONFIG.costs.shaftPerFloor) + ' / floor',
  };
  for (const b of els.build.querySelectorAll('button[data-do]')) {
    const cost = b.querySelector('.btn-cost');
    if (cost) cost.textContent = costs[b.dataset.do] || '';
    b.classList.toggle('sel', b.dataset.do === tool);
  }

  for (const b of els.build.querySelectorAll('button[data-kind]')) {
    const kind = b.dataset.kind;
    const locked = !unlocked(state, CONFIG, kind);
    b.disabled = locked || state.money < CONFIG.costs[kind];
    b.classList.toggle('sel', tool === kind);
    const tier = CONFIG.stars.tiers.find((t) => t.unlocks.includes(kind) && t.pop > 0);
    const cost = b.querySelector('.btn-cost');
    if (cost) cost.textContent = locked ? 'unlock at ' + (tier?.pop || '?') + ' pop' : money(CONFIG.costs[kind]);
    b.title = locked ? kind + ' unlocks at ' + (tier?.pop || '?') + ' population' : money(CONFIG.costs[kind]);
  }
  setMode();
}

function drawClock() {
  const h = Math.floor(state.tod * 24), m = Math.floor((state.tod * 24 % 1) * 60);
  const rush = inWindow(CONFIG.time.morningRush) ? 'MORNING RUSH'
    : inWindow(CONFIG.time.lunch) ? 'LUNCH'
    : inWindow(CONFIG.time.eveningRush) ? 'EVENING RUSH' : '';
  els.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + (rush ? '  ' + rush : '');
  els.clock.style.color = rush ? WARN : 'rgba(142,202,230,0.6)';
  requestAnimationFrame(drawClock);
}
const inWindow = ([a, b]) => state.tod >= a && state.tod <= b;

let toastT = null;
function toast(msg, color) {
  els.log.textContent = msg;
  els.log.style.color = color || INFO;
  clearTimeout(toastT);
  toastT = setTimeout(() => { els.log.textContent = ''; }, 2600);
}

// ------------------------------------------------------------------- inputs
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  if (tool === 'car') {
    const shaft = renderer.shaftAt(state, px, py);
    if (!shaft) return toast(state.shafts.length ? 'click an elevator shaft' : 'build a shaft first', WARN);
    const added = act('add_car', { id: shaft });
    if (added.ok) {
      tool = 'office';
      refresh();
      setMode('CAR added — office selected; click an upper floor to place it.');
    }
    return;
  }
  const floor = renderer.floorAt(state, px, py);
  if (floor < 0) return toast('click a floor', WARN);
  if (tool === 'shaft') return act('build_shaft', { bottom: 0, top: floor });
  if (floor === 0) return toast('the lobby is not leasable', WARN);
  act('build_unit', { kind: tool, floor });
});

els.build.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.kind) { tool = b.dataset.kind; setMode(); refresh(); return; }
  if (b.dataset.do === 'floor') act('build_floor');
  if (b.dataset.do === 'shaft') { tool = 'shaft'; setMode('SHAFT selected — click the top floor to place it.'); toast('click the top floor for the new shaft', INFO); refresh(); }
  if (b.dataset.do === 'car') {
    if (!state.shafts.length) return toast('build a shaft first', WARN);
    tool = 'car';
    setMode('CAR selected — click an elevator shaft to add it.');
    toast('click an elevator shaft to add the car', INFO);
    refresh();
  }
  if (b.dataset.do === 'extend') {
    const sh = state.shafts[state.shafts.length - 1];
    if (sh) act('extend_shaft', { id: sh.id, top: state.floors - 1 }); else toast('build a shaft first', WARN);
  }
});

addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); speed = speed ? 0 : 1; toast(speed ? 'running' : 'paused', INFO); }
  if (e.key === '1') { speed = 1; toast('1x', INFO); }
  if (e.key === '2') { speed = 4; toast('4x', INFO); }
  if (e.key === '3') { speed = 12; toast('12x', INFO); }
  if (e.key.toLowerCase() === 'r') restart();
  if (e.key.toLowerCase() === 'e') exportTape();
  if (e.key.toLowerCase() === 'd') els.knobs.classList.toggle('open');
});

function restart() {
  state = boot(CONFIG, (state.seed % 9999) + 1);
  tape = [];
  toast('new tower, seed ' + state.seed, INFO);
  refresh();
}

/** Hands you the session as JSON. Drop it in replay/ and re-run it after a
 *  tuning change to see what the change did to YOUR play, not the bot's. */
function exportTape() {
  const blob = { schema: 'lift-tape/v1', seed: state.seed, config: CONFIG, tape };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }));
  a.download = 'tape-seed' + state.seed + '.json';
  a.click();
  toast('exported ' + tape.length + ' actions', GOOD);
}

// --------------------------------------------------------------- dev knobs
/** Live tuning, permanently. Ship it behind the D key, never delete it. */
const KNOBS = [
  ['time.daySeconds', 10, 180, 5],
  ['elevator.speed', 0.4, 8, 0.2],
  ['elevator.capacity', 2, 40, 1],
  ['elevator.doorTime', 0.1, 3, 0.1],
  ['units.office.patience', 1, 30, 1],
  ['units.office.rent', 50, 1200, 50],
  ['demand.abandonAfter', 10, 120, 5],
  ['occupancy.relistMinDeliveryRate', 0, 100, 5],
  ['occupancy.vacantUpkeep', 0, 400, 10],
  ['economy.upkeepPerFloor', 0, 300, 5],
];

const dig = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const put = (o, p, v) => {
  const k = p.split('.'); const last = k.pop();
  k.reduce((a, x) => a[x], o)[last] = v;
};

els.knobs.innerHTML = '<h3>dev knobs <span>D</span></h3>' + KNOBS.map(([p, min, max, stepv]) =>
  '<label>' + p + ' <output id="o_' + p.replace(/\./g, '_') + '">' + dig(CONFIG, p) + '</output>' +
  '<input type="range" data-path="' + p + '" min="' + min + '" max="' + max + '" step="' + stepv + '" value="' + dig(CONFIG, p) + '"></label>'
).join('');

els.knobs.addEventListener('input', (e) => {
  const p = e.target.dataset.path;
  if (!p) return;
  put(CONFIG, p, Number(e.target.value));
  document.getElementById('o_' + p.replace(/\./g, '_')).textContent = e.target.value;
});

/**
 * Dev hook. Lets a test or an agent drive the real UI without synthesising
 * mouse coordinates — same seam as a human click, so nothing here is a special
 * path that could pass while the actual game is broken.
 */
window.__lift = {
  get state() { return state; },
  CONFIG, act,
  speed: (v) => { speed = v; },
  tool: (v) => { tool = v; refresh(); },
  /** Advance exactly N sim-seconds. Needed because a backgrounded tab throttles
   *  rAF, so wall-clock waiting cannot land you on a specific moment. */
  stepFor(seconds) {
    const n = Math.round(seconds / CONFIG.time.dt);
    for (let i = 0; i < n && !state.over; i++) step(state, CONFIG.time.dt, CONFIG);
    refresh();
    return { day: state.day, tod: +state.tod.toFixed(3), waiting: state.people.filter((p) => p.state === 'waiting').length };
  },
  /** Fast-forward N whole days without waiting on rAF. */
  skip(days) {
    const until = state.day + days;
    let guard = 0;
    while (state.day < until && !state.over && guard++ < 2e6) {
      step(state, CONFIG.time.dt, CONFIG);
    }
    refresh();
    return state.log[state.log.length - 1];
  },
};

// ---------------------------------------------------------------- kickoff
addEventListener('resize', () => renderer.resize());
renderer.resize();

// Opening position: one shaft, a few offices. Nobody should stare at an empty lot.
applyAction(state, { type: 'build_shaft', bottom: 0, top: state.floors - 1 }, CONFIG);
for (let f = 1; f < state.floors; f++) {
  applyAction(state, { type: 'build_unit', kind: 'office', floor: f }, CONFIG);
}

refresh();
toast('space = pause · 1/2/3 = speed · D = knobs · E = export · R = restart', INFO);
requestAnimationFrame(frame);
requestAnimationFrame(drawClock);
