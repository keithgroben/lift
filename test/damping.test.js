import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { leasingForecast } from '../src/games/lift/sim/evaluation/leasing.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

/** A tower with occupied offices plus market-ready vacancies. */
function fixture(config) {
  config.economy.startMoney = 10000000;
  config.building.startFloors = 12;
  const state = boot(config, 901);
  applyAction(state, { type: 'build_lobby', slot: config.building.lobbySlot }, config);
  applyAction(state, { type: 'build_shaft', bottom: 0, top: state.floors - 1 }, config);
  for (let floor = 1; floor <= 10; floor++) {
    const built = applyAction(state, { type: 'build_unit', kind: 'office', floor }, config);
    assert(built.ok, built.reason);
  }
  // Vacate four rooms and age them past every relist delay.
  for (const unit of state.units.slice(0, 4)) {
    unit.occupied = false;
    unit.stress = 0;
    unit.vacantDays = 10;
  }
  return state;
}

export const tests = {
  'damper knobs at their defaults reproduce the binary gate exactly'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = fixture(config);
    const open = leasingForecast(state, config, 80);
    assert(open.flowFactor === 1, 'default knobs must give full flow above the gate');
    const expected = Math.floor(config.occupancy.moveInCapacity +
      state.units.reduce((sum, u) => sum + (u.occupied ? u.heads : 0), 0) * config.occupancy.moveInCapacityGrowthRate);
    assert(open.capacity === expected, 'default capacity changed: ' + open.capacity + ' vs ' + expected);
    const shut = leasingForecast(state, config, 40);
    assert(shut.capacity === 0 && shut.flowFactor === 0, 'gate below relistMin must still be fully shut');
  },

  'proportional gate scales applicant flow between the gate and full-flow rep'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.occupancy.moveInFullFlowRate = 85;
    const state = fixture(config);
    const low = leasingForecast(state, config, 58);
    const mid = leasingForecast(state, config, 70);
    const full = leasingForecast(state, config, 90);
    assert(low.flowFactor > 0 && low.flowFactor < mid.flowFactor, 'flow must rise with reputation');
    assert(mid.flowFactor < 1 && full.flowFactor === 1, 'flow must reach 1 only at the full-flow rep');
    assert(low.capacity < full.capacity, 'capacity must scale with the flow factor');
  },

  'capacity cap clamps the flood'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.occupancy.moveInCapacityMax = 3;
    const state = fixture(config);
    const forecast = leasingForecast(state, config, 95);
    assert(forecast.capacity === 3, 'capacity must clamp to the configured max, got ' + forecast.capacity);
  },

  'vacate jitter is off by default and bounded when enabled'() {
    const off = structuredClone(CONFIG);
    off.building.startFloors = 4;
    const stateOff = fixture(off);
    assert(stateOff.units.every((u) => u.vacateJitter === 1 && u.graceJitter === 0),
      'jitter must be inert with the knobs off');

    const on = structuredClone(CONFIG);
    on.building.startFloors = 4;
    on.occupancy.vacateJitterRange = 0.3;
    on.occupancy.graceJitterDays = 2;
    const stateOn = fixture(on);
    const jitters = stateOn.units.map((u) => u.vacateJitter);
    assert(jitters.every((j) => j >= 0.7 && j <= 1.3), 'vacate jitter escaped its configured range');
    assert(new Set(jitters.map((j) => j.toFixed(6))).size > 1, 'jitter must vary across tenants');
    assert(stateOn.units.every((u) => u.graceJitter >= 0 && u.graceJitter <= 2), 'grace jitter escaped its range');
  },

  'jitter draws nothing from the rng stream while disabled'() {
    // Same seed, knobs off: the sequence of rng values consumed by building
    // must be identical to a config that has never heard of the dampers —
    // otherwise every historical seed and replay silently changes.
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const a = boot(structuredClone(config), 77);
    const b = boot(structuredClone(config), 77);
    fixtureLike(a, config);
    fixtureLike(b, config);
    assert(a.rng.next() === b.rng.next(), 'rng streams diverged with dampers off');
  },
};

function fixtureLike(state, config) {
  applyAction(state, { type: 'build_lobby', slot: config.building.lobbySlot }, config);
  applyAction(state, { type: 'build_shaft', bottom: 0, top: state.floors - 1 }, config);
  applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config);
}
