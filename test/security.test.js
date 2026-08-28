import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { securityCoverage, securityDemand } from '../src/games/lift/sim/services.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'security desk coverage improves nearby tenant evaluation'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 10000000;
    config.building.startFloors = 7;
    const state = boot(config, 91);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 6 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1, slot: 1 }, config).ok,
      'could not build nearby office');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 6, slot: 1 }, config).ok,
      'could not build distant office');

    const nearby = state.units[0];
    const distant = state.units[1];
    const before = unitEvaluation(state, nearby, config);
    assert(securityDemand(state, config).uncoveredRooms === 2,
      'uncovered security demand was not reported');
    assert(applyAction(state, { type: 'build_facility', kind: 'security', floor: 1 }, config).ok,
      'could not build security desk');

    const demand = securityDemand(state, config);
    assert(demand.coveredRooms === 1 && demand.uncoveredRooms === 1,
      'security desk covered outside its configured floor range');
    assert(securityCoverage(state, nearby, config)?.floors === 0,
      'same-floor security coverage missing');
    assert(securityCoverage(state, distant, config) == null,
      'security desk covered a distant floor');

    const after = unitEvaluation(state, nearby, config);
    assert(after.securityCovered && after.securityPenalty === 0,
      'covered office still had a security penalty');
    assert(after.score > before.score, 'security coverage did not improve evaluation');
  },

  'security demand follows unit needs rather than every facility'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 10000000;
    const state = boot(config, 92);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build office');
    assert(applyAction(state, { type: 'build_facility', kind: 'parking', floor: 3 }, config).ok,
      'could not build parking');
    assert(securityDemand(state, config).rooms === 1, 'security demand did not follow the office need');
    assert(!securityCoverage(state, state.units[0], config), 'parking was counted as security coverage');
  },
};
