import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { rentForLevel } from '../src/games/lift/sim/pricing.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'rent is a visible evaluation tradeoff'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 41);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok, 'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok, 'could not build office');

    const unit = state.units[0];
    const standard = unitEvaluation(state, unit, config).score;
    assert(applyAction(state, { type: 'set_rent', kind: 'office', level: 2 }, config).ok, 'could not raise rent');
    const high = unitEvaluation(state, unit, config).score;
    assert(high < standard, 'higher rent did not lower evaluation');
    assert(unit.rent === rentForLevel(config, 'office', 2), 'higher rent was not applied to the unit');
    assert(applyAction(state, { type: 'set_rent', kind: 'office', level: -2 }, config).ok, 'could not lower rent');
    assert(unitEvaluation(state, unit, config).score > standard, 'lower rent did not improve evaluation');
  },
};
