/**
 * The upgrade ladder, measured.
 *
 * This is the instrument for Bloom Rush's actual premise: *prove to the player
 * where manual effort runs out and automation becomes the only way up.* For
 * that to land, three things have to be true, and this harness checks all three:
 *
 *   1. Each upgrade must visibly MOVE THE CEILING (or it is not progression).
 *   2. It must PAY BACK fast enough to feel earned rather than endured.
 *   3. At least one must be AUTOMATION — buying capacity that costs no daylight
 *      — because once idle time hits zero, nothing else can help.
 *
 * Usage: node harness/ladder.js [days] [seeds]
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadGame, play } from './load.js';

const [, , daysArg = '60', seedsArg = '3'] = process.argv;
const DAYS = Number(daysArg), SEEDS = Number(seedsArg);

const game = await loadGame('bloom');
const { realCeiling } = await import('../src/games/bloom/sim/index.js');
const BASE = game.CONFIG;

/** Baseline income with no upgrades at all, to price everything against. */
let baseIncome = 0;
for (let s = 1; s <= SEEDS; s++) baseIncome += game.meta.score(play(game, 'arithmetic', DAYS, s));
baseIncome /= SEEDS;
const baseCeiling = realCeiling(BASE);

console.log('\n  BLOOM RUSH — upgrade ladder');
console.log('  baseline: ceiling ' + baseCeiling.toFixed(2) + ' plants, $' + baseIncome.toFixed(1) + '/day'
  + '   (' + DAYS + ' days x ' + SEEDS + ' seeds)\n');

const applyTo = (cfg, effect) => {
  if (effect.pots) return;
  const keys = effect.path.split('.');
  const last = keys.pop();
  const t = keys.reduce((o, k) => o[k], cfg);
  let v = t[last];
  if (effect.op === 'add') v += effect.value;
  else if (effect.op === 'mul') v *= effect.value;
  if (effect.floor !== undefined) v = Math.max(effect.floor, v);
  t[last] = v;
};

const rows = [];
for (const up of BASE.upgrades) {
  const cfg = structuredClone(BASE);
  applyTo(cfg, up.effect);
  const ceiling = up.effect.pots ? baseCeiling : realCeiling(cfg);
  const dCeiling = ceiling - baseCeiling;

  // Income with just this one upgrade, holding the new ceiling.
  const saved = structuredClone(BASE);
  Object.assign(game.CONFIG, cfg);
  let income = 0;
  for (let s = 1; s <= SEEDS; s++) income += game.meta.score(play(game, 'arithmetic', DAYS, s));
  income /= SEEDS;
  Object.assign(game.CONFIG, saved);

  const dIncome = income - baseIncome;
  // Days of extra income needed to repay the sticker price. This is the number
  // that decides whether an upgrade feels earned or feels like a toll.
  const payback = dIncome > 0.01 ? up.cost / dIncome : Infinity;
  // Does it buy capacity that costs no daylight? Only these help at 0% idle.
  const automation = up.effect.path === 'plant.drip';

  rows.push({ id: up.id, name: up.name, cost: up.cost, automation,
    ceiling: +ceiling.toFixed(2), dCeiling: +dCeiling.toFixed(2),
    income: +income.toFixed(1), dIncome: +dIncome.toFixed(2),
    payback: Number.isFinite(payback) ? +payback.toFixed(0) : null });
}

console.log('  ' + 'upgrade'.padEnd(15) + 'cost'.padStart(6) + 'ceiling'.padStart(10)
  + 'Δceil'.padStart(8) + '$/day'.padStart(8) + 'Δ$/day'.padStart(9)
  + 'payback'.padStart(10) + '  kind');
console.log('  ' + '-'.repeat(78));
for (const r of rows) {
  console.log('  ' + r.name.padEnd(15)
    + ('$' + r.cost).padStart(6)
    + r.ceiling.toFixed(2).padStart(10)
    + (r.dCeiling > 0 ? '+' + r.dCeiling.toFixed(2) : '—').padStart(8)
    + r.income.toFixed(1).padStart(8)
    + (r.dIncome > 0 ? '+' + r.dIncome.toFixed(2) : r.dIncome.toFixed(2)).padStart(9)
    + (r.payback === null ? 'never' : r.payback + 'd').padStart(10)
    + '  ' + (r.automation ? 'AUTOMATION' : r.dCeiling > 0 ? 'effort' : 'economy'));
}

const paying = rows.filter((r) => r.payback !== null && r.payback < DAYS);
const auto = rows.filter((r) => r.automation);
console.log('\n  ' + paying.length + ' of ' + rows.length + ' upgrades pay for themselves inside a '
  + DAYS + '-day run.');
if (!paying.length) {
  console.log('  NOTHING on the ladder pays back. A player who ignores upgrades entirely');
  console.log('  beats one who engages with them — the progression is a tax, not a reward.');
}
if (auto.length) {
  const best = auto.reduce((a, b) => ((b.payback ?? 1e9) < (a.payback ?? 1e9) ? b : a));
  console.log('  cheapest automation: ' + best.name + ' at $' + best.cost
    + ', payback ' + (best.payback === null ? 'never' : best.payback + ' days')
    + ' — this is the one that must be affordable at the moment idle hits 0%.');
}

/**
 * Everything above prices each upgrade against a BARE config, which understates
 * anything that stacks — Mist Nozzles reads as terrible in isolation because it
 * is a top-up on a drip you have not bought yet. So also walk the order a real
 * player buys in, and show the ceiling climbing.
 */
const climber = play(game, 'climber', DAYS, 1);
if (climber.owned.length) {
  console.log('\n  what a climbing run actually buys, in order:\n');
  const cfg = structuredClone(BASE);
  let ceil = realCeiling(cfg);
  console.log('    start'.padEnd(22) + 'ceiling ' + ceil.toFixed(2));
  for (const id of climber.owned) {
    const up = BASE.upgrades.find((u) => u.id === id);
    applyTo(cfg, up.effect);
    const next = up.effect.pots ? ceil : realCeiling(cfg);
    console.log('    + ' + up.name.padEnd(20)
      + 'ceiling ' + next.toFixed(2)
      + (next > ceil ? '   (+' + (next - ceil).toFixed(2) + ')' : '   (pots, not ceiling)'));
    ceil = next;
  }
  console.log('\n    ended at $' + game.meta.score(climber) + '/day on '
    + climber.pots.length + ' pots, vs $' + baseIncome.toFixed(1) + '/day buying nothing.\n');
}

const out = path.join(process.cwd(), 'out');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'bloom-ladder.json'), JSON.stringify(
  { schema: 'bloom-ladder/v1', days: DAYS, seeds: SEEDS, baseCeiling, baseIncome, rows }, null, 2));
console.log('  wrote out/bloom-ladder.json\n');
