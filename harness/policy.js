import { applyAction } from '../src/sim/index.js';

/**
 * Autoplayers. A headless run needs someone to press the buttons, and the
 * policy IS the hypothesis: each one isolates a different question about the
 * bottleneck. Add policies freely — they are experiments, not game code.
 *
 * decide() runs once per closed day and returns nothing; it acts via applyAction
 * so a headless run and a human run go through the exact same seam.
 */

const act = (state, config, type, extra = {}) =>
  applyAction(state, { type, ...extra }, config);

/** Every policy opens the same way, so runs are comparable. */
function opening(state, config) {
  act(state, config, 'build_shaft', { bottom: 0, top: state.floors - 1 });
  for (let f = 1; f < state.floors; f++) act(state, config, 'build_unit', { kind: 'office', floor: f });
}

/** Keep the single shaft tall enough that nobody is ever stranded. */
function keepShaftTall(state, config) {
  const sh = state.shafts[0];
  if (!sh) return;
  if (sh.top < state.floors - 1) act(state, config, 'extend_shaft', { id: sh.id, top: state.floors - 1 });
}

/** Add floors and fill them with offices whenever cash allows. */
function grow(state, config, reserve = 0) {
  let guard = 0;
  while (guard++ < 8) {
    const top = state.floors - 1;
    const room = config.building.slotsPerFloor - 2;
    const onTop = state.units.filter((u) => u.floor === top).length;
    if (onTop < room) {
      if (state.money - config.costs.office < reserve) return;
      if (!act(state, config, 'build_unit', { kind: 'office', floor: top }).ok) return;
    } else {
      if (state.money - config.costs.floor - config.costs.office < reserve) return;
      if (!act(state, config, 'build_floor', {}).ok) return;
    }
  }
}

export const POLICIES = {
  /**
   * H1: throughput is the wall. Builds relentlessly, extends the shaft so no
   * trip is ever unservable, but NEVER buys another car. If wait time goes
   * vertical here and nowhere else, the bottleneck is real.
   */
  naive: {
    name: 'naive (never adds cars)',
    open: opening,
    decide(state, config) { grow(state, config); keepShaftTall(state, config); },
  },

  /**
   * H2: reacting late still loses. Waits for pain, then buys capacity.
   * Measures how much runway you get from a purely reactive read.
   */
  reactive: {
    name: 'reactive (buys on pain)',
    open: opening,
    decide(state, config) {
      const d = state.log[state.log.length - 1];
      if (d && d.avgWait > config.units.office.patience * 1.5) {
        const sh = state.shafts[0];
        if (sh && !act(state, config, 'add_car', { id: sh.id }).ok) {
          act(state, config, 'build_shaft', { bottom: 0, top: state.floors - 1 });
        }
      }
      grow(state, config, config.costs.car);
      keepShaftTall(state, config);
    },
  },

  /**
   * H3: there is a servable ratio. Holds cars-per-occupied-office at a fixed
   * target. If this one stays flat forever, the game has no wall and needs a
   * new pressure — that is a design failure the sim can prove cheaply.
   */
  balanced: {
    name: 'balanced (holds a cars:offices ratio)',
    officesPerCar: 4,
    open: opening,
    decide(state, config) {
      const offices = state.units.filter((u) => u.kind === 'office' && u.occupied).length;
      const cars = state.shafts.reduce((n, sh) => n + sh.cars.length, 0);
      if (offices / Math.max(1, cars) > this.officesPerCar) {
        let placed = false;
        for (const sh of state.shafts) {
          if (act(state, config, 'add_car', { id: sh.id }).ok) { placed = true; break; }
        }
        if (!placed) act(state, config, 'build_shaft', { bottom: 0, top: state.floors - 1 });
      }
      grow(state, config, config.costs.car * 2);
      keepShaftTall(state, config);
    },
  },
};
