import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction, population } from '../src/games/lift/sim/index.js';
import { dayClose } from '../src/games/lift/sim/economy.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'star milestones pay once when population crosses each tier'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 10000000;
    config.building.startFloors = 28;
    const state = boot(config, 601);
    for (let floor = 1; floor <= 10; floor++) {
      const built = applyAction(state, { type: 'build_unit', kind: 'office', floor }, config);
      assert(built.ok, built.reason);
    }
    assert(population(state) === 60, 'milestone fixture did not reach 60 population');
    const first = dayClose(state, config);
    assert(first.star === '2 star' && first.starAwards.length === 1,
      '2-star milestone was not awarded at its population threshold');
    assert(first.starAwards[0].name === '2 star' && first.rewards === config.stars.tiers[1].reward,
      '2-star reward amount was incorrect');

    const repeat = dayClose(state, config);
    assert(repeat.starAwards.length === 0 && repeat.rewards === 0,
      'star milestone was awarded more than once');

    for (let floor = 11; floor <= 27; floor++) {
      const built = applyAction(state, { type: 'build_unit', kind: 'office', floor }, config);
      assert(built.ok, built.reason);
    }
    assert(population(state) === 162, 'milestone fixture did not reach 3-star population');
    const third = dayClose(state, config);
    assert(third.star === '3 star' && third.starAwards.length === 1 && third.starAwards[0].name === '3 star',
      '3-star milestone did not trigger after the next population crossing');
  },
};
