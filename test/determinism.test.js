import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config/lift.config.js';
import { boot, step } from '../src/sim/index.js';
import { POLICIES } from '../harness/policy.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function run(seed, days = 25) {
  const s = boot(CONFIG, seed);
  POLICIES.balanced.open(s, CONFIG);
  while (s.day <= days && !s.over) {
    if (step(s, CONFIG.time.dt, CONFIG)) POLICIES.balanced.decide(s, CONFIG);
  }
  return JSON.stringify(s.log);
}

export const tests = {
  'same seed reproduces the run exactly'() {
    assert(run(7) === run(7), 'two runs at seed 7 diverged — replay is worthless if this fails');
  },

  /** Negation: if different seeds also matched, the RNG would be dead and the
   *  determinism test above would be passing vacuously. */
  'different seeds produce different runs'() {
    assert(run(7) !== run(8), 'seeds 7 and 8 produced identical logs — the RNG is not wired in');
  },

  'no Math.random anywhere under src/sim'() {
    // Determinism is a property of the whole directory, not of one entry point.
    const dir = path.join(process.cwd(), 'src', 'sim');
    for (const f of fs.readdirSync(dir)) {
      // Strip comments first: a comment SAYING "no Math.random" is not a call,
      // and matching it made this test fail on the file that proves the point.
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert(!/Math\.random/.test(src), `${f} calls Math.random — that breaks replay`);
      assert(!/\bdocument\b|\bwindow\b/.test(src), `${f} touches the DOM — the sim must run headless`);
    }
  },
};
