import { CONFIG } from '../src/games/lift/config.js';
import { meta } from '../src/games/lift/game.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

/** A synthetic day that clears every win threshold at the max tower size. */
function goldenDay(day, overrides = {}) {
  const slots = CONFIG.building.maxFloors * CONFIG.building.slotsPerFloor;
  const units = Math.ceil(slots * 0.8);
  return {
    day,
    floors: CONFIG.building.maxFloors,
    units,
    occupied: Math.ceil(units * 0.9),
    pop: 1500,
    deliveryRate: 88,
    rep: 86,
    net: 120000,
    ...overrides,
  };
}

export const tests = {
  'maxed-out win fires only after the full sustained window'() {
    const log = Array.from({ length: 20 }, (_, i) => goldenDay(i + 1));
    const win = meta.win(log);
    assert(win, 'a 20-day golden run did not register a win');
    assert(win.day === 14, 'win should land exactly when the 14-day window completes, got day ' + win.day);
  },

  'one bad day inside the window resets the streak'() {
    const log = Array.from({ length: 25 }, (_, i) => goldenDay(i + 1));
    // Day 10 dips below the delivery standard: the streak must restart, so
    // the win lands 14 days after the dip, not on day 14.
    log[9] = goldenDay(10, { deliveryRate: 60 });
    const win = meta.win(log);
    assert(win, 'the run should still win after re-holding the window');
    assert(win.day === 24, 'streak did not reset after the bad day, got day ' + win.day);
  },

  'a tall, healthy tower that is not FULL never wins'() {
    // Excellent numbers, but only half the grid is built.
    const slots = CONFIG.building.maxFloors * CONFIG.building.slotsPerFloor;
    const log = Array.from({ length: 30 }, (_, i) => goldenDay(i + 1, {
      units: Math.floor(slots * 0.5),
      occupied: Math.floor(slots * 0.5 * 0.95),
    }));
    assert(meta.win(log) === null, 'a half-built tower must not register the maxed-out win');
  },

  'a full tower that is not profitable never wins'() {
    const log = Array.from({ length: 30 }, (_, i) => goldenDay(i + 1, { net: -1000 }));
    assert(meta.win(log) === null, 'a money-losing tower must not register the maxed-out win');
  },
};
