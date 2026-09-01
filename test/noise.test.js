import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { unitEvaluation, unitNoise } from '../src/games/lift/sim/evaluation.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function makeNoisePair(kind) {
  const config = structuredClone(CONFIG);
  config.building.startFloors = 4;
  config.economy.startMoney = 10000000;
  config.stars.tiers[1].pop = 0;
  const state = boot(config, kind === 'condo' ? 52 : 53);
  assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
    'could not build shaft');
  assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
    'could not build noise source');
  assert(applyAction(state, { type: 'build_unit', kind, floor: 3, slot: 2 }, config).ok,
    'could not build noise receiver');
  assert(applyAction(state, { type: 'build_unit', kind, floor: 2, slot: 2 }, config).ok,
    'could not build isolated receiver');
  return { config, state, receiver: state.units[1], isolated: state.units[2] };
}

export const tests = {
  'adjacent occupied units lower room evaluation through noise'() {
    const { config, state, receiver, isolated } = makeNoisePair('office');
    const adjacent = unitEvaluation(state, receiver, config);
    const apart = unitEvaluation(state, isolated, config);
    assert(unitNoise(state, receiver, config) > unitNoise(state, isolated, config),
      'adjacent room did not receive noise');
    assert(adjacent.noisePenalty > 0, 'noise did not create a penalty');
    assert(adjacent.score < apart.score, 'noise did not lower room evaluation');
  },

  'rooms directly above and below share a smaller noise effect'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 54);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 2, slot: 1 }, config).ok,
      'could not build lower room');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
      'could not build upper room');
    assert(unitNoise(state, state.units[1], config) === config.evaluation.verticalNoiseWeight,
      'vertical neighbor did not receive the configured reduced noise');
  },

  'noise preferences make condos more sensitive than offices'() {
    const office = makeNoisePair('office');
    const condo = makeNoisePair('condo');
    const officePenalty = unitEvaluation(office.state, office.receiver, office.config).noisePenalty;
    const condoPenalty = unitEvaluation(condo.state, condo.receiver, condo.config).noisePenalty;
    assert(condoPenalty > officePenalty,
      'condo noise preference did not make it more sensitive than an office');
  },

  'vacant neighbors do not emit noise'() {
    const { config, state, receiver } = makeNoisePair('office');
    for (const neighbor of [state.units[0], state.units[2]]) neighbor.occupied = false;
    assert(unitNoise(state, receiver, config) === 0, 'vacant unit still emitted noise');
  },
};
