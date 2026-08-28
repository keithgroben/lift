import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { foodCoverage, foodDemand } from '../src/games/lift/sim/services.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'cafeteria coverage is floor-local and visible as demand'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 10000000;
    const state = boot(config, 61);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1, slot: 1 }, config).ok,
      'could not build lower office');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
      'could not build upper office');

    const lower = state.units[0];
    const upper = state.units[1];
    const before = unitEvaluation(state, lower, config);
    const uncovered = foodDemand(state, config);
    assert(uncovered.coveredRooms === 0 && uncovered.uncoveredRooms === 2,
      'unserved food demand was not reported');

    assert(applyAction(state, { type: 'build_facility', kind: 'food', floor: 1 }, config).ok,
      'could not build cafeteria');
    const covered = foodDemand(state, config);
    assert(covered.coveredRooms === 1 && covered.uncoveredRooms === 1,
      'cafeteria covered the wrong floors');
    assert(covered.coveredHeads === lower.heads && covered.heads === lower.heads + upper.heads,
      'food demand did not report covered people');
    assert(foodCoverage(state, lower, config)?.floors === 0, 'same-floor coverage missing');
    assert(foodCoverage(state, upper, config) == null, 'cafeteria over-covered distant floor');

    const after = unitEvaluation(state, lower, config);
    assert(after.foodCovered && after.foodPenalty === 0, 'covered room still had a food penalty');
    assert(after.score > before.score, 'food coverage did not improve room evaluation');
  },

  'cafeteria occupies a build slot'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 10000000;
    const state = boot(config, 62);
    assert(applyAction(state, { type: 'build_facility', kind: 'food', floor: 1, slot: 1 }, config).ok,
      'could not build cafeteria');
    const blocked = applyAction(state, { type: 'build_unit', kind: 'office', floor: 1, slot: 1 }, config);
    assert(!blocked.ok, 'a unit was placed through the cafeteria');
    assert(state.facilities.length === 1 && state.facilities[0].kind === 'food',
      'cafeteria was not stored as a facility');
  },
};
