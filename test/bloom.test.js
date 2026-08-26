import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/games/bloom/config.js';
import { boot, step, applyAction, living, haulCeiling, realCeiling } from '../src/games/bloom/sim/index.js';
import { POLICIES } from '../src/games/bloom/policies.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function play(policyKey, days, seed = 1, base = CONFIG) {
  // Clone: buying an upgrade mutates config, so a shared object would let one
  // test's purchases silently buff the next.
  const cfg = structuredClone(base);
  const state = boot(cfg, seed);
  POLICIES[policyKey].open?.(state, cfg);
  while (state.day <= days && !state.over) {
    if (POLICIES[policyKey].tick && !state.busy) POLICIES[policyKey].tick(state, cfg);
    step(state, cfg.time.dt, cfg);
  }
  state.config = cfg;
  return state;
}

const perDay = (s) => s.cash / Math.max(1, s.log.length);

/** Deep-clone CONFIG so a test can vary one knob without leaking into the next. */
const variant = (mutate) => {
  const c = structuredClone(CONFIG);
  mutate(c);
  return c;
};

export const tests = {
  /**
   * The bottleneck, stated as an assertion. The hands are single-threaded: you
   * cannot haul while you pour. If this ever passes with two actions in flight,
   * the game has stopped being about anything.
   */
  'the hands do one thing at a time'() {
    const state = boot(CONFIG, 1);
    assert(applyAction(state, { type: 'haul' }, CONFIG).ok, 'first haul should be accepted');
    const second = applyAction(state, { type: 'haul' }, CONFIG);
    assert(!second.ok, 'a second action was accepted while busy');
    assert(second.reason.startsWith('busy'), 'wrong rejection reason: ' + second.reason);
  },

  /** BOUND. A day cannot contain more trips than its length divided by trip time. */
  'hauls per day never exceed what the clock allows'() {
    const max = Math.ceil(CONFIG.time.daySeconds / CONFIG.haul.tripSeconds);
    for (const key of ['greedy', 'hold3', 'hold8']) {
      for (const d of play(key, 20).log) {
        assert(d.hauls <= max, key + ' day ' + d.day + ': ' + d.hauls + ' hauls, clock allows ' + max);
      }
    }
  },

  'the day is fully accounted for: busy + idle = the whole day'() {
    for (const d of play('hold4', 20).log) {
      const total = d.haulSeconds + d.pourSeconds + d.otherSeconds + d.idleSeconds;
      assert(Math.abs(total - CONFIG.time.daySeconds) < 0.5,
        'day ' + d.day + ' accounts for ' + total.toFixed(2) + 's of a ' + CONFIG.time.daySeconds + 's day');
    }
  },

  'the arithmetic ceilings bracket the measured optimum'() {
    const scores = [2, 3, 4, 5, 6, 7, 8].map((n) => ({ n, v: perDay(play('hold' + n, 40)) }));
    const best = scores.reduce((a, b) => (b.v > a.v ? b : a));
    const real = realCeiling(CONFIG);
    assert(haulCeiling(CONFIG) >= real, 'the haul ceiling must be the looser of the two bounds');
    assert(Math.abs(best.n - real) <= 1.5,
      'measured optimum is hold' + best.n + ' but realCeiling() says ' + real.toFixed(2)
      + ' - the formula and the sim disagree');
  },

  /**
   * THE DESIGN CLAIM, as a test. v0.3 grew plants linearly in hydration, which
   * makes total growth independent of how water is spread, so "how many plants"
   * was nearly free: hold3 $14.3/day vs hold8 $12.6/day.
   *
   * NEGATED explicitly: the same assertion must FAIL at growthCurve 1. Without
   * that half, this test would pass on a build where the knob does nothing.
   */
  'overextending is punished - and is NOT punished at growthCurve 1'() {
    const gap = (cfg) => {
      const best = perDay(play('hold3', 40, 1, cfg));
      const over = perDay(play('hold8', 40, 1, cfg));
      return (best - over) / best;
    };

    const shipped = gap(CONFIG);
    assert(shipped > 0.2,
      'holding 8 plants costs only ' + (shipped * 100).toFixed(0) + '% vs holding 3 - the bottleneck has no teeth');

    const linear = gap(variant((c) => { c.plant.growthCurve = 1; }));
    assert(linear < shipped * 0.7,
      'growthCurve had no effect (linear gap ' + (linear * 100).toFixed(0)
      + '% vs shipped ' + (shipped * 100).toFixed(0) + '%) - the knob is not wired in');
  },

  'water is conserved: what is hauled is poured, spilled, or still in the tank'() {
    const state = play('hold4', 25);
    const hauled = state.log.reduce((a, d) => a + d.hauledWater, 0);
    const poured = state.log.reduce((a, d) => a + d.pouredWater, 0);
    assert(poured <= hauled + 1e-6,
      'poured ' + poured.toFixed(2) + ' but only hauled ' + hauled.toFixed(2) + ' - water is being created');
  },

  'no Math.random or DOM under bloom sim'() {
    const dir = path.join(process.cwd(), 'src', 'games', 'bloom', 'sim');
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert(!/Math\.random/.test(src), f + ' calls Math.random - that breaks replay');
      assert(!/\bdocument\b|\bwindow\b/.test(src), f + ' touches the DOM - the sim must run headless');
    }
  },

  /**
   * THE PREMISE, as a test. Bloom Rush exists to prove where manual effort runs
   * out and automation becomes the only way up. If a player who ignores the
   * upgrade ladder outperforms one who climbs it, the game teaches the opposite
   * of its own thesis.
   *
   * This failed when written: Drip Lines gave +0.2 against a need of 1.0, which
   * `harness/ladder.js` priced at a 220-day payback versus 10 days for Wide Can.
   * The climber earned $12.8/day against $14.0 for simply holding 3 plants.
   */
  'climbing the ladder beats ignoring it'() {
    const climber = perDay(play('climber', 80));
    const bestFixed = Math.max(...[2, 3, 4, 5, 6, 7, 8].map((n) => perDay(play('hold' + n, 80))));
    assert(climber > bestFixed * 1.3,
      'climber earns $' + climber.toFixed(1) + '/day vs $' + bestFixed.toFixed(1)
      + ' for the best fixed strategy - the upgrade ladder is a tax, not a reward');
  },

  /**
   * Automation must be the biggest step, not a footnote. Drip is the only term
   * in the ceiling formula that does not trade against daylight, so once idle
   * time hits 0% it is the ONLY thing that can still help. If an effort upgrade
   * out-jumps it, the ladder points players away from the lesson.
   */
  'automation is the largest single jump in the ceiling'() {
    const ceilWith = (id) => {
      const cfg = structuredClone(CONFIG);
      const up = cfg.upgrades.find((u) => u.id === id);
      if (up.effect.pots) return realCeiling(cfg);
      const keys = up.effect.path.split('.');
      const last = keys.pop();
      const t = keys.reduce((o, k) => o[k], cfg);
      t[last] = up.effect.op === 'mul' ? t[last] * up.effect.value : t[last] + up.effect.value;
      if (up.effect.floor !== undefined) t[last] = Math.max(up.effect.floor, t[last]);
      return realCeiling(cfg);
    };
    const base = realCeiling(CONFIG);
    const drip = ceilWith('drip') - base;
    for (const up of CONFIG.upgrades) {
      if (up.id === 'drip' || up.effect.path === 'plant.drip') continue;
      const gain = ceilWith(up.id) - base;
      assert(drip > gain,
        up.name + ' raises the ceiling by ' + gain.toFixed(2) + ' but Drip Lines only '
        + drip.toFixed(2) + ' - effort is out-earning automation');
    }
  },

  /**
   * The saturation signal itself. Somewhere between the ceiling and one plant
   * over it, idle time must collapse to zero WITHOUT income rising - that is
   * the moment the game says "trying harder will not work any more".
   */
  'going one plant over the ceiling costs all your slack and buys no income'() {
    const at = play('hold3', 30), over = play('hold4', 30);
    const idle = (s) => s.log.slice(-8).reduce((a, d) => a + d.idlePct, 0) / 8;
    assert(idle(at) > 5, 'at the ceiling there should still be slack, got ' + idle(at).toFixed(1) + '%');
    assert(idle(over) < 2, 'one over the ceiling should be saturated, got ' + idle(over).toFixed(1) + '%');
    assert(perDay(over) <= perDay(at) * 1.05,
      'the extra plant paid off ($' + perDay(over).toFixed(1) + ' vs $' + perDay(at).toFixed(1)
      + ') - there is no wall here');
  },

  'a run with no seeds and no plants ends'() {
    const cfg = variant((c) => { c.field.startSeeds = 0; c.field.startPots = 1; });
    const state = boot(cfg, 1);
    while (state.day <= 5 && !state.over) step(state, cfg.time.dt, cfg);
    assert(state.over, 'a run with nothing planted and nothing to plant never ended');
    assert(living(state).length === 0, 'expected no living plants');
  },
};
