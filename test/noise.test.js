import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { unitEvaluation, unitNoise } from '../src/games/lift/sim/evaluation.js';
import { columnTo, occupy, unpacedBuilding } from './support.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

/**
 * Two rooms sharing a wall on F3, and a third one storey below the receiver as
 * the control. Every one of them now needs its own column underneath it, so the
 * fixture builds slots 1 and 2 up from the ground.
 *
 * The support rooms are left VACANT on purpose: `unitNoise` reads occupied
 * units only, so an empty room is structure that makes no sound, and the three
 * rooms under test are the only things in the tower that can be heard. Their
 * tenants are seated directly — this suite measures what neighbours do to a
 * room's evaluation, not whether anybody would move into it.
 */
function makeNoisePair(kind) {
  const config = structuredClone(CONFIG);
  config.building.startFloors = 4;
  config.economy.startMoney = 10000000;
  config.stars.tiers[1].pop = 0;
  unpacedBuilding(config);
  const state = boot(config, kind === 'condo' ? 52 : 53);
  assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3, slot: 0 }, config).ok,
    'could not build shaft');
  columnTo(state, config, 3, 1);
  columnTo(state, config, 2, 2);
  assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
    'could not build noise source');
  const source = state.units.at(-1);
  assert(applyAction(state, { type: 'build_unit', kind, floor: 2, slot: 2 }, config).ok,
    'could not build isolated receiver');
  const isolated = state.units.at(-1);
  assert(applyAction(state, { type: 'build_unit', kind, floor: 3, slot: 2 }, config).ok,
    'could not build noise receiver');
  const receiver = state.units.at(-1);
  occupy(state, config, source, isolated, receiver);
  return { config, state, source, receiver, isolated };
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
    columnTo(state, config, 2, 1);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 2, slot: 1 }, config).ok,
      'could not build lower room');
    const lower = state.units.at(-1);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
      'could not build upper room');
    const upper = state.units.at(-1);
    occupy(state, config, lower, upper);
    assert(unitNoise(state, upper, config) === config.evaluation.verticalNoiseWeight,
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
    const { config, state, source, receiver, isolated } = makeNoisePair('office');
    for (const neighbor of [source, isolated]) neighbor.occupied = false;
    assert(unitNoise(state, receiver, config) === 0, 'vacant unit still emitted noise');
  },
};
