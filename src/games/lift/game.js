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

/**
 * The maxed-out win: the tower is FULL, HEALTHY, and PROFITABLE — all three
 * at once, sustained. One golden day crowns nothing; the tower must hold the
 * standard for a whole window. This predicate is the single source of truth
 * for "won": the harness reports it, the lab displays it, and the 5-star
 * fireworks will eventually fire off it (spec/lift-vision.md, "endgame
 * guarantee").
 *
 * Thresholds, and why:
 * - floors === maxFloors, built rooms >= 75% of gross slots. Transport
 *   columns legitimately eat ~15% of the grid in a 3-zone tower, so 75% of
 *   gross is roughly 90% of what is actually buildable — "the map is
 *   covered" without punishing the player for having elevators.
 * - occupancy >= 85%: covered means TENANTED, not just constructed.
 * - deliveryRate >= 80 and rep >= 80: a win demands excellence, not the 55%
 *   survival floor.
 * - net > 0 every day of the window: profitable as a FLOW. `net` subtracts
 *   construction spending, so this also means the tower stands on operations
 *   rather than still digging — which is exactly what "finished" means.
 */
meta.win = (log) => {
  const WINDOW = 14;
  const goodDay = (d) =>
    d.floors >= C.building.maxFloors &&
    d.units >= C.building.maxFloors * C.building.slotsPerFloor * 0.75 &&
    d.units > 0 && d.occupied / d.units >= 0.85 &&
    d.deliveryRate >= 80 && d.rep >= 80 && d.net > 0;
  let streak = 0;
  for (const d of log) {
    streak = goodDay(d) ? streak + 1 : 0;
    if (streak >= WINDOW) {
      return {
        day: d.day,
        label: 'MAXED-OUT WIN on day ' + d.day + ': ' + d.floors + ' floors, '
             + d.occupied + '/' + d.units + ' rooms tenanted, ' + d.pop + ' population, '
             + 'held delivery/rep >= 80 and positive net for ' + WINDOW + ' days',
      };
    }
  }
  return null;
};
