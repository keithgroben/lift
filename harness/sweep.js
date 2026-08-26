/**
 * The headline question: at what floor count does the wait-time curve go
 * vertical, and does that answer hold across seeds and policies?
 *
 * Usage: node harness/sweep.js [days] [seeds]
 * Writes out/sweep.csv — open it in anything that draws a line.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config/lift.config.js';
import { boot, step } from '../src/sim/index.js';
import { POLICIES } from './policy.js';

const [, , daysArg = '60', seedsArg = '5'] = process.argv;
const days = Number(daysArg), seeds = Number(seedsArg);

const rows = [];
const summary = [];

for (const [key, policy] of Object.entries(POLICIES)) {
  const cliffs = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const state = boot(CONFIG, seed);
    policy.open?.(state, CONFIG);
    while (state.day <= days && !state.over) {
      const closed = step(state, CONFIG.time.dt, CONFIG);
      if (closed) policy.decide?.(state, CONFIG);
    }
    for (const d of state.log) {
      rows.push({ policy: key, seed, ...d });
    }
    const c = cliff(state.log);
    if (c) cliffs.push(c);
    summary.push({ policy: key, seed, over: state.over, days: state.log.length,
      endFloors: state.floors, endPop: state.log.at(-1)?.pop ?? 0,
      cliffFloors: c?.floors ?? null, peakWait: Math.max(...state.log.map((d) => d.avgWait)) });
  }
  const f = cliffs.map((c) => c.floors);
  console.log(`${policy.name.padEnd(38)} cliff at ${f.length ? `${Math.min(...f)}-${Math.max(...f)} floors (${f.length}/${seeds} seeds)` : 'never'}`);
}

const COLS = ['policy', 'seed', 'day', 'floors', 'pop', 'occupied', 'cars', 'avgWait', 'waitMax', 'deliveryRate', 'vacated', 'money', 'net'];
const out = path.join(process.cwd(), 'out');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'sweep.csv'),
  [COLS.join(','), ...rows.map((r) => COLS.map((c) => r[c]).join(','))].join('\n'));
fs.writeFileSync(path.join(out, 'sweep-summary.json'), JSON.stringify(summary, null, 2));
console.log(`\nwrote out/sweep.csv (${rows.length} rows) and out/sweep-summary.json`);

function cliff(log) {
  const p = CONFIG.units.office.patience, WARMUP = 6;
  // Skip the opening: the first few days are a build-out transient, and a
  // detector that fires there reports 5 floors for every policy forever.
  for (let i = WARMUP; i < log.length; i++) {
    if (log[i - 1].avgWait > 0.5 && log[i].avgWait > log[i - 1].avgWait * 2 && log[i].avgWait > p) {
      return { day: log[i].day, floors: log[i].floors, pop: log[i].pop };
    }
  }
  return null;
}
