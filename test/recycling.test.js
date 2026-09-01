import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { recyclingCoverage, recyclingDemand } from '../src/games/lift/sim/services.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'recycling coverage handles local waste demand'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 6;
    config.stars.tiers[2].pop = 0;
    const state = boot(config, 101);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 5 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'shop', floor: 1, slot: 1 }, config).ok,
      'could not build nearby shop');
    assert(applyAction(state, { type: 'build_unit', kind: 'shop', floor: 5, slot: 1 }, config).ok,
      'could not build distant shop');

    const nearby = state.units[0];
    const distant = state.units[1];
    const before = unitEvaluation(state, nearby, config);
    const uncovered = recyclingDemand(state, config);
    assert(uncovered.uncoveredRooms === 2 && uncovered.waste > 0,
      'recycling waste demand was not reported');
    assert(applyAction(state, { type: 'build_facility', kind: 'recycling', floor: 1 }, config).ok,
      'could not build recycling facility');

    const demand = recyclingDemand(state, config);
    assert(demand.coveredRooms === 1 && demand.uncoveredRooms === 1,
      'recycling facility covered outside its configured floor range');
    assert(demand.coveredWaste < demand.waste && demand.coveredWaste > 0,
      'recycling waste totals were not split by coverage');
    assert(recyclingCoverage(state, nearby, config)?.floors === 0,
      'same-floor recycling coverage missing');
    assert(recyclingCoverage(state, distant, config) == null,
      'recycling facility covered a distant shop');

    const after = unitEvaluation(state, nearby, config);
    assert(after.recyclingCovered && after.recyclingPenalty === 0,
      'covered shop still had a recycling penalty');
    assert(after.score > before.score, 'recycling coverage did not improve evaluation');
  },

  'recycling stays independent from security coverage'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 102);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 2 }, config).ok,
      'could not build office');
    assert(applyAction(state, { type: 'build_facility', kind: 'security', floor: 2 }, config).ok,
      'could not build security desk');
    const evaluation = unitEvaluation(state, state.units[0], config);
    assert(evaluation.securityCovered, 'security did not cover the office');
    assert(!evaluation.recyclingCovered, 'security unexpectedly counted as recycling');
  },
};
