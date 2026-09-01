import { CONFIG } from '../src/games/lift/config.js';
import { boot, step, applyAction, slotsUsed } from '../src/games/lift/sim/index.js';
import {
  chooseServingRoute, escalatorAccessSeconds, servingEscalators,
  stairAccessSeconds,
} from '../src/games/lift/sim/demand.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'escalators occupy a continuous column and are faster than stairs'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 401);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok, 'could not build lobby');
    const stairs = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3 }, config);
    assert(stairs.ok, stairs.reason);
    const escalator = applyAction(state, { type: 'build_escalator', bottom: 0, top: 3 }, config);
    assert(escalator.ok, escalator.reason);
    assert(state.escalators[0].slot !== state.stairs[0].slot, 'escalator overlapped the stair column');
    for (let floor = 0; floor <= 3; floor++) {
      assert(slotsUsed(state, floor).has(state.escalators[0].slot), 'escalator did not reserve its full column');
    }

    const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config);
    assert(unit.ok, unit.reason);
    const trip = { from: 0, to: 3, toUnit: unit.id };
    const stairTime = stairAccessSeconds(state, trip, state.stairs[0], config);
    const escalatorTime = escalatorAccessSeconds(state, trip, state.escalators[0], config);
    assert(escalatorTime < stairTime, 'escalator was not faster than stairs');
    const route = chooseServingRoute(state, trip, [], state.stairs, config, state.escalators);
    assert(route.kind === 'escalator', 'faster escalator route was not selected');
  },

  'local route choice shares demand as the faster route fills'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const routes = {
      stairs: [{ id: 1, bottom: 0, top: 3, slot: 1 }],
      escalators: [{ id: 2, bottom: 0, top: 3, slot: 2 }],
    };
    const trip = { from: 0, to: 3 };
    const quiet = { lobby: { slots: [0] }, units: [], people: [] };
    const crowded = {
      ...quiet,
      people: Array.from({ length: 9 }, () => ({ state: 'walking', escalatorId: 2 })),
    };
    const fast = chooseServingRoute(quiet, trip, [], routes.stairs, config, routes.escalators);
    const shared = chooseServingRoute(crowded, trip, [], routes.stairs, config, routes.escalators);
    assert(fast.kind === 'escalator' && shared.kind === 'stairs' &&
      config.escalator.loadPenaltySeconds > 0 && config.stairs.loadPenaltySeconds > 0,
      'local route choice did not share demand as the faster route filled');
  },

  'escalators deliver a trip without an elevator and improve room access'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 402);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok, 'could not build lobby');
    const built = applyAction(state, { type: 'build_escalator', bottom: 0, top: 3 }, config);
    assert(built.ok, built.reason);
    const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config);
    assert(unit.ok, unit.reason);
    assert(servingEscalators(state, 0, 3).length === 1, 'escalator did not serve the trip span');
    const evaluation = unitEvaluation(state, state.units[0], config);
    assert(evaluation.accessMode === 'escalator' && evaluation.accessSeconds > 0,
      'room evaluation did not recognize escalator access');

    state.schedule = [{ from: 0, to: 3, toUnit: unit.id, unit: unit.id, kind: 'commute_in', at: 0 }];
    state.scheduleAt = 0;
    state.tod = 0;
    step(state, config.time.dt, config);
    assert(state.people[0]?.mode === 'escalator', 'trip did not use the escalator');
    const ticks = Math.ceil((evaluation.accessSeconds + 1) / config.time.dt);
    for (let i = 0; i < ticks; i++) step(state, config.time.dt, config);
    assert(state.today.delivered === 1, 'escalator trip was not delivered');
    assert(state.today.abandoned === 0, 'escalator trip was abandoned');
  },
};
