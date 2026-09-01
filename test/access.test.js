import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { chooseServingShaft, resolve, shaftAccessDistance, shaftAccessSeconds } from '../src/games/lift/sim/demand.js';
import { occupy } from './support.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

/**
 * Floors are a purchase now (`building.startFloors: 0` — a new session opens
 * on bare ground), so a fixture that needs a standing tower buys its storeys
 * through the same action seam the player uses.
 */
const withFloors = (state, config, floors = 4) => {
  for (let i = 0; i < floors; i++) {
    const built = applyAction(state, { type: 'build_floor' }, config);
    if (!built.ok) throw new Error('fixture could not build a floor: ' + built.reason);
  }
  return state;
};

export const tests = {
  'shaft choice accounts for endpoint walking distance'() {
    const s = withFloors(boot(CONFIG, 21), CONFIG);
    const first = applyAction(s, { type: 'build_shaft', bottom: 0, top: 3 }, CONFIG);
    assert(first.ok, first.reason);
    // On the first storey, which stands on the ground. Access distance is a
    // walk along a corridor — it reads the room's slot, never its floor — so
    // the comparison is the same one at any height.
    const nearUnit = applyAction(s, { type: 'build_unit', kind: 'office', floor: 1 }, CONFIG);
    assert(nearUnit.ok, nearUnit.reason);
    const farUnit = applyAction(s, { type: 'build_unit', kind: 'office', floor: 1 }, CONFIG);
    assert(farUnit.ok, farUnit.reason);
    const second = applyAction(s, { type: 'build_shaft', bottom: 0, top: 3 }, CONFIG);
    assert(second.ok, second.reason);

    const trip = { from: 0, to: 1, toUnit: nearUnit.id };
    const shafts = s.shafts;
    assert(shaftAccessDistance(s, trip, shafts[0]) < shaftAccessDistance(s, trip, shafts[1]),
      'fixture did not place the second shaft farther from the unit');
    assert(chooseServingShaft(s, trip, shafts, CONFIG) === shafts[0],
      'closest shaft was not preferred when queues were equal');
    assert(shaftAccessSeconds(s, trip, shafts[0], CONFIG) < shaftAccessSeconds(s, trip, shafts[1], CONFIG),
      'walking distance did not become tenant access time');
  },

  'a meaningful queue can outweigh a longer walk to another shaft'() {
    const s = withFloors(boot(CONFIG, 22), CONFIG);
    const first = applyAction(s, { type: 'build_shaft', bottom: 0, top: 3 }, CONFIG);
    assert(first.ok, first.reason);
    const nearUnit = applyAction(s, { type: 'build_unit', kind: 'office', floor: 1 }, CONFIG);
    assert(nearUnit.ok, nearUnit.reason);
    applyAction(s, { type: 'build_unit', kind: 'office', floor: 1 }, CONFIG);
    const second = applyAction(s, { type: 'build_shaft', bottom: 0, top: 3 }, CONFIG);
    assert(second.ok, second.reason);

    for (let i = 0; i < 4; i++) s.people.push({ state: 'waiting', shaft: s.shafts[0].id });
    const trip = { from: 0, to: 1, toUnit: nearUnit.id };
    assert(chooseServingShaft(s, trip, s.shafts, CONFIG) === s.shafts[1],
      'queue did not outweigh the extra walking distance');
  },

  'walking access contributes to tenant stress separately from elevator wait'() {
    const s = withFloors(boot(CONFIG, 23), CONFIG);
    const shaft = applyAction(s, { type: 'build_shaft', bottom: 0, top: 3 }, CONFIG);
    assert(shaft.ok, shaft.reason);
    const unit = applyAction(s, { type: 'build_unit', kind: 'office', floor: 1 }, CONFIG);
    assert(unit.ok, unit.reason);
    occupy(s, CONFIG, s.units[0]);

    resolve(s, { unit: unit.id, waitT: CONFIG.units.office.patience, accessT: 0 }, CONFIG, false);
    assert(s.units[0].stress === 0, 'a patient elevator wait created stress without access delay');
    resolve(s, { unit: unit.id, waitT: CONFIG.units.office.patience, accessT: CONFIG.access.walkSecondsPerSlot }, CONFIG, false);
    assert(s.units[0].stress > 0, 'access delay did not create stress after an otherwise patient wait');
  },
};
