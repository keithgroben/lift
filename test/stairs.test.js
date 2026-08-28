import { CONFIG } from '../src/games/lift/config.js';
import { boot, step, applyAction, slotsUsed } from '../src/games/lift/sim/index.js';
import {
  chooseServingRoute, localRouteOccupancy, localRouteQueueOverflow, servingStairs, stairAccessSeconds,
} from '../src/games/lift/sim/demand.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { dayClose } from '../src/games/lift/sim/economy.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function setup(config, seed) {
  const state = boot(config, seed);
  assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok, 'could not build lobby');
  return state;
}

export const tests = {
  'stairs reserve a continuous column and cannot overlap a shaft'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 10000000;
    const state = setup(config, 301);
    const built = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3 }, config);
    assert(built.ok, built.reason);
    const stair = state.stairs[0];
    for (let floor = 0; floor <= 3; floor++) {
      assert(slotsUsed(state, floor).has(stair.slot), 'stairs did not reserve their full column');
    }
    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
    assert(shaft.ok && state.shafts[0].slot !== stair.slot, 'shaft overlapped the stairwell');
    const second = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3 }, config);
    assert(second.ok && state.stairs[1].slot !== stair.slot,
      'parallel stairs did not use a separate column');
  },

  'stairs deliver a trip without an elevator car'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 10000000;
    const state = setup(config, 302);
    const built = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3 }, config);
    assert(built.ok, built.reason);
    const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config);
    assert(unit.ok, unit.reason);

    const trip = { from: 0, to: 3, toUnit: unit.id };
    assert(servingStairs(state, trip.from, trip.to).length === 1, 'stairs did not serve the trip span');
    const route = chooseServingRoute(state, trip, [], state.stairs, config);
    assert(route.kind === 'stairs', 'stair route was not selected without an elevator');
    const access = stairAccessSeconds(state, trip, state.stairs[0], config);
    const evaluation = unitEvaluation(state, state.units[0], config);
    assert(evaluation.accessMode === 'stairs' && evaluation.accessSeconds === +access.toFixed(1),
      'room evaluation did not recognize stair access');

    state.schedule = [{ ...trip, unit: unit.id, kind: 'commute_in', at: 0 }];
    state.scheduleAt = 0;
    state.tod = 0;
    step(state, config.time.dt, config);
    assert(state.people[0]?.state === 'walking', 'stair trip did not enter walking state');
    assert(state.people[0].waitT === 0, 'stair travel was incorrectly counted as elevator queue wait');

    const ticks = Math.ceil((access + 1) / config.time.dt);
    for (let i = 0; i < ticks; i++) step(state, config.time.dt, config);
    assert(state.today.delivered === 1, 'stair trip was not delivered');
    assert(state.today.abandoned === 0, 'stair trip was abandoned');
  },

  'stairs form a local queue when simultaneous occupancy is full'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 10000000;
    const state = setup(config, 303);
    const built = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3 }, config);
    assert(built.ok, built.reason);
    const trip = { from: 0, to: 3, unit: null, kind: 'test' };
    state.schedule = Array.from({ length: config.stairs.capacity + 1 }, (_, index) => ({ ...trip, at: 0, id: index }));
    state.scheduleAt = 0;
    state.tod = 0;

    step(state, config.time.dt, config);
    const stair = state.stairs[0];
    const walking = state.people.filter((person) => person.state === 'walking' && person.stairId === stair.id);
    const queued = state.people.filter((person) => person.state === 'waiting' && person.localRouteKind === 'stairs' && person.localRouteId === stair.id);
    assert(localRouteOccupancy(state, 'stairs', stair.id) === config.stairs.capacity &&
      walking.length === config.stairs.capacity && queued.length === 1,
      'full stair occupancy did not create a local waiting queue');
    assert(localRouteQueueOverflow(state, 'stairs', stair.id, config) === 1,
      'local route overflow did not count riders beyond available first-wave capacity');

    const access = stairAccessSeconds(state, trip, stair, config);
    for (let i = 0; i < Math.ceil(access / config.time.dt) * 2 + 8; i++) step(state, config.time.dt, config);
    assert(state.today.delivered === config.stairs.capacity + 1 && state.today.abandoned === 0 &&
      state.today.localTrips === config.stairs.capacity + 1 && state.today.localDelivered === config.stairs.capacity + 1 &&
      state.today.elevatorTrips === 0 && state.today.localWaitTotal > 0,
      'local waiting trip did not enter service after capacity cleared');
    const closed = dayClose(state, config);
    assert(closed.localAvgWait > 0 && closed.localDeliveryRate === 100 && closed.elevatorAvgWait === 0 &&
      closed.elevatorDeliveryRate === 100 && closed.localOverflowPeak === 1 &&
      closed.localOverflowSeconds > 0 && closed.localOverflowPenalty > 0 && closed.rep < closed.deliveryReputation &&
      closed.localOverflowRoutes.length === 1 && closed.localOverflowRoutes[0].routeId === stair.id &&
      closed.localOverflowRoutes[0].bottom === stair.bottom && closed.localOverflowRoutes[0].top === stair.top,
      'daily close did not separate local and elevator pressure');
  },
};
