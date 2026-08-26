/**
 * Game manifest. Every game under src/games/<name>/ exports this exact shape,
 * which is the only thing the shared harness is allowed to know about it.
 */
export { CONFIG } from './config.js';
export { boot, step, applyAction } from './sim/index.js';
export { POLICIES } from './policies.js';

export const meta = {
  name: 'lift',
  title: 'Lift',
  bottleneck: 'elevator throughput — car-trips per minute across the floors people need',
  play: '/src/games/lift/index.html',
  /** Columns the run table prints, in order. */
  columns: ['day', 'floors', 'pop', 'occupied', 'cars', 'avgWait', 'deliveryRate', 'rep', 'vacant', 'money', 'net'],
};

import { CONFIG as C } from './config.js';

/**
 * First day average wait more than doubles AND clears tenant patience.
 * WARMUP skips the build-out transient: a detector that fires there reports the
 * same 5 floors for every policy and discriminates nothing.
 */
meta.cliff = (log) => {
  const WARMUP = 6, p = C.units.office.patience;
  for (let i = WARMUP; i < log.length; i++) {
    if (log[i - 1].avgWait > 0.5 && log[i].avgWait > log[i - 1].avgWait * 2 && log[i].avgWait > p) {
      return {
        day: log[i].day, floors: log[i].floors, pop: log[i].pop,
        label: 'wait cliff: day ' + log[i].day + ' at ' + log[i].floors + ' floors ('
             + log[i - 1].avgWait + 's -> ' + log[i].avgWait + 's)',
      };
    }
  }
  return null;
};

meta.summary = (state) => {
  const d = state.log[state.log.length - 1];
  if (!d) return 'no days completed';
  return 'ended at ' + d.floors + ' floors, ' + d.pop + ' population, '
       + d.deliveryRate + '% of trips delivered';
};
