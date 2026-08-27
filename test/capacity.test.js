import { CONFIG } from '../src/games/lift/config.js';
import { boot, step, applyAction } from '../src/games/lift/sim/index.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

/** A fixed, deliberately busy tower for comparing transport choices. */
function runFixture(options = {}, seed = 1) {
  const config = structuredClone(CONFIG);
  config.economy.startMoney = 100000;
  Object.assign(config.elevator, options);

  const state = boot(config, seed);
  const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
  assert(shaft.ok, shaft.reason);
  for (let floor = 1; floor < 4; floor++) {
    for (let i = 0; i < 5; i++) {
      const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor }, config);
      assert(unit.ok, unit.reason);
    }
  }
  for (let i = 1; i < (options.cars || 1); i++) {
    const car = applyAction(state, { type: 'add_car', id: state.shafts[0].id }, config);
    assert(car.ok, car.reason);
  }

  while (state.day <= 15 && !state.over) step(state, config.time.dt, config);
  const days = state.log.slice(1); // day 1 is the fixture warm-up
  return {
    avgWait: days.reduce((sum, d) => sum + d.avgWait, 0) / days.length,
    delivery: days.reduce((sum, d) => sum + d.deliveryRate, 0) / days.length,
  };
}

function average(options) {
  const runs = [];
  for (let seed = 1; seed <= 10; seed++) runs.push(runFixture(options, seed));
  return {
    avgWait: runs.reduce((sum, r) => sum + r.avgWait, 0) / runs.length,
    delivery: runs.reduce((sum, r) => sum + r.delivery, 0) / runs.length,
  };
}

export const tests = {
  'cars improve throughput with diminishing returns'() {
    const one = average({ cars: 1 });
    const two = average({ cars: 2 });
    const three = average({ cars: 3 });
    assert(two.avgWait < one.avgWait, 'a second car did not reduce average wait');
    assert(three.avgWait < two.avgWait, 'a third car did not reduce average wait');
    assert(two.delivery > one.delivery, 'a second car did not improve delivery rate');
    assert(three.delivery >= two.delivery, 'a third car reduced delivery rate');
    assert(one.avgWait - two.avgWait > two.avgWait - three.avgWait,
      'extra cars are not showing diminishing returns');
  },

  'capacity, speed, and door time are real transport tradeoffs'() {
    const baseline = average({ cars: 2 });
    const lowCapacity = average({ cars: 2, capacity: 6 });
    const slow = average({ cars: 2, speed: 1.2 });
    const longDoors = average({ cars: 2, doorTime: 1.2 });
    assert(lowCapacity.avgWait > baseline.avgWait, 'capacity does not affect wait');
    assert(slow.avgWait > baseline.avgWait, 'speed does not affect wait');
    assert(longDoors.avgWait > baseline.avgWait, 'door time does not affect wait');
  },
};
