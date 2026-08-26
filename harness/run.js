/**
 * One headless run -> a table on stdout and out/run-<policy>-<seed>.json.
 * Usage: node harness/run.js [policy] [days] [seed]
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config/lift.config.js';
import { boot, step } from '../src/sim/index.js';
import { POLICIES } from './policy.js';

const [, , policyName = 'naive', daysArg = '40', seedArg = '1'] = process.argv;
const days = Number(daysArg), seed = Number(seedArg);
const policy = POLICIES[policyName];
if (!policy) {
  console.error(`unknown policy "${policyName}". have: ${Object.keys(POLICIES).join(', ')}`);
  process.exit(1);
}

const state = boot(CONFIG, seed);
policy.open?.(state, CONFIG);

const { dt } = CONFIG.time;
while (state.day <= days && !state.over) {
  const closed = step(state, dt, CONFIG);
  if (closed) policy.decide?.(state, CONFIG);
}

const COLS = ['day', 'floors', 'pop', 'occupied', 'cars', 'avgWait', 'deliveryRate', 'rep', 'vacant', 'money', 'net'];
const w = Object.fromEntries(COLS.map((c) => [c, Math.max(c.length, 7)]));
const line = (row) => COLS.map((c) => String(row[c] ?? '').padStart(w[c])).join(' ');

console.log(`\n  ${policy.name}   seed ${seed}   ${state.log.length} days   daySeconds=${CONFIG.time.daySeconds}\n`);
console.log(line(Object.fromEntries(COLS.map((c) => [c, c]))));
console.log(COLS.map((c) => '-'.repeat(w[c])).join(' '));
for (const d of state.log) console.log(line(d));

const cliff = findCliff(state.log);
console.log(`\n  ${state.over ? 'BANKRUPT on day ' + state.day : 'survived'}`);
console.log(cliff
  ? `  wait-time cliff: day ${cliff.day} at ${cliff.floors} floors / ${cliff.pop} pop — avgWait ${cliff.from} -> ${cliff.to}s`
  : '  no cliff found: wait never went vertical. Either the tower stayed small or the bottleneck is too weak.');

const out = path.join(process.cwd(), 'out');
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `run-${policyName}-${seed}.json`);
fs.writeFileSync(file, JSON.stringify({
  schema: 'lift-run-log/v1',
  policy: policyName, seed, days,
  config: CONFIG,
  cliff, over: state.over,
  log: state.log, events: state.events,
}, null, 2));
console.log(`  wrote ${path.relative(process.cwd(), file)}\n`);

/** First day where average wait more than doubles and clears patience. */
function findCliff(log) {
  const p = CONFIG.units.office.patience, WARMUP = 6;
  // Skip the opening: the first few days are a build-out transient, and a
  // detector that fires there reports 5 floors for every policy forever.
  for (let i = WARMUP; i < log.length; i++) {
    const prev = log[i - 1].avgWait, now = log[i].avgWait;
    if (prev > 0.5 && now > prev * 2 && now > p) {
      return { day: log[i].day, floors: log[i].floors, pop: log[i].pop, from: prev, to: now };
    }
  }
  return null;
}
