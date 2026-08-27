import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { medicalCoverage, medicalDemand } from '../src/games/lift/sim/services.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'clinic coverage serves condo demand within its floor range'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.building.startFloors = 7;
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 81);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 6 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'condo', floor: 1, slot: 1 }, config).ok,
      'could not build nearby condo');
    assert(applyAction(state, { type: 'build_unit', kind: 'condo', floor: 6, slot: 1 }, config).ok,
      'could not build distant condo');

    const nearby = state.units[0];
    const distant = state.units[1];
    const before = unitEvaluation(state, nearby, config);
    assert(medicalDemand(state, config).uncoveredRooms === 2,
      'uncovered condo medical demand was not reported');
    assert(applyAction(state, { type: 'build_facility', kind: 'medical', floor: 1 }, config).ok,
      'could not build clinic');

    const demand = medicalDemand(state, config);
    assert(demand.coveredRooms === 1 && demand.uncoveredRooms === 1,
      'clinic covered outside its configured floor range');
    assert(medicalCoverage(state, nearby, config)?.floors === 0,
      'same-floor clinic coverage missing');
    assert(medicalCoverage(state, distant, config) == null,
      'clinic covered a distant condo');

    const after = unitEvaluation(state, nearby, config);
    assert(after.medicalCovered && after.medicalPenalty === 0,
      'covered condo still had a medical penalty');
    assert(after.score > before.score, 'medical coverage did not improve condo evaluation');
  },

  'medical service is not a requirement for offices'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 82);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build office');
    const evaluation = unitEvaluation(state, state.units[0], config);
    assert(medicalDemand(state, config).rooms === 0, 'office created condo medical demand');
    assert(evaluation.medicalCovered && evaluation.medicalPenalty === 0,
      'office received a medical penalty');
  },

  'medical facility remains gated until the condo tier'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 83);
    const locked = applyAction(state, { type: 'build_facility', kind: 'medical', floor: 1 }, config);
    assert(!locked.ok && locked.reason === 'medical is locked', 'clinic was available before 60 population');
  },
};
