import { createState } from './state.js';
import { applyAction } from './actions.js';
import { scheduleDay, stepDemand, flushInTransit } from './demand.js';
import { stepShafts } from './elevator.js';
import { dayClose } from './economy.js';

export { createState, applyAction };
export * from './state.js';

export function boot(config, seed = 1) {
  const state = createState(config, seed);
  scheduleDay(state, config);
  return state;
}

/**
 * Advance the sim by exactly `dt` seconds. Pure with respect to the DOM: this
 * function must stay callable from Node with no stubs. That property is the
 * whole reason the harness works — do not import anything browser-shaped here.
 * @returns {object|null} the closed-out day, if this step ended one
 */
export function step(state, dt, config) {
  if (state.over) return null;

  state.elapsed += dt;
  state.tod += dt / config.time.daySeconds;

  stepDemand(state, dt, config);
  stepShafts(state, dt, config);

  if (state.tod >= 1) {
    state.tod -= 1;
    flushInTransit(state, config);
    for (const sh of state.shafts) for (const car of sh.cars) car.riders.length = 0;

    const closed = dayClose(state, config);
    state.day++;
    scheduleDay(state, config);
    return closed;
  }
  return null;
}

/** Run whole days at once. The headless harness lives on this. */
export function runDays(state, days, config, onDay) {
  const { dt } = config.time;
  const target = state.day + days;
  let guard = 0;
  while (state.day < target && !state.over) {
    const closed = step(state, dt, config);
    if (closed && onDay) onDay(closed, state);
    if (++guard > days * (config.time.daySeconds / dt) * 4) break;
  }
  return state.log;
}
