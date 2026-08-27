import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { parkingCoverage, parkingDemand } from '../src/games/lift/sim/services.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'parking coverage has its own floor range and evaluation signal'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.building.startFloors = 5;
    const state = boot(config, 71);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 4 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1, slot: 1 }, config).ok,
      'could not build lower office');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 4, slot: 1 }, config).ok,
      'could not build distant office');

    const lower = state.units[0];
    const distant = state.units[1];
    const before = unitEvaluation(state, lower, config);
    assert(parkingDemand(state, config).uncoveredRooms === 2,
      'uncovered parking demand was not reported');

    assert(applyAction(state, { type: 'build_facility', kind: 'parking', floor: 1 }, config).ok,
      'could not build parking');
    const demand = parkingDemand(state, config);
    assert(demand.coveredRooms === 1 && demand.uncoveredRooms === 1,
      'parking covered beyond its configured floor range');
    assert(parkingCoverage(state, lower, config)?.floors === 0,
      'same-floor parking coverage missing');
    assert(parkingCoverage(state, distant, config) == null,
      'parking covered a distant floor');

    const after = unitEvaluation(state, lower, config);
    assert(after.parkingCovered && after.parkingPenalty === 0,
      'covered room still had a parking penalty');
    assert(after.score > before.score, 'parking coverage did not improve evaluation');
  },

  'parking remains separate from food coverage'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 72);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 2 }, config).ok,
      'could not build office');
    assert(applyAction(state, { type: 'build_facility', kind: 'parking', floor: 2 }, config).ok,
      'could not build parking');
    const evaluation = unitEvaluation(state, state.units[0], config);
    assert(evaluation.parkingCovered, 'parking did not cover the office');
    assert(!evaluation.foodCovered, 'parking unexpectedly counted as food service');
  },
};
