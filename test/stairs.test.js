import { CONFIG } from '../src/games/lift/config.js';
import { boot, step, applyAction, slotsUsed } from '../src/games/lift/sim/index.js';
import {
  chooseServingRoute, localRouteOccupancy, localRouteQueueOverflow, servingStairs, stairAccessSeconds,
} from '../src/games/lift/sim/demand.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { dayClose } from '../src/games/lift/sim/economy.js';
import { columnTo } from './support.js';
import { firstRouteColumn } from '../src/games/lift/sim/state.js';
import { localRouteTargetStatus } from '../src/games/lift/render/canvas.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function setup(config, seed) {
  const state = boot(config, seed);
  assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok, 'could not build lobby');
  return state;
}

export const tests = {
  /**
   * Keith, playing on 2026-09-02, looking at a stairwell standing alone in the
   * field two columns clear of his tower: "why can i only put my stairs there
   * now?" The tool had never asked him where. It took the leftmost column free
   * top to bottom, which is out in the open the moment a lobby does not start
   * at slot 0 — and `build_stairs` never called `isSupported`, so stairs and
   * escalators were the only things in the game able to stand in mid-air.
   */
  'stairs take the column you name'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 311);
    assert(applyAction(state, { type: 'build_lobby', slot: 4 }, config).ok, 'could not build lobby');

    // Slot 5 is beside the lobby: legal, and it is the column that was asked
    // for rather than the leftmost free one.
    const built = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3, slot: 5 }, config);
    assert(built.ok, built.reason);
    assert(state.stairs[0].slot === 5, 'stairs landed in slot ' + state.stairs[0].slot + ', not the one asked for');
  },

  'a run has to start against the building, not out in the field'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 312);
    assert(applyAction(state, { type: 'build_lobby', slot: 4 }, config).ok, 'could not build lobby');

    // Slot 0 is free the whole way up and touches nothing. This is the exact
    // placement in the screenshot.
    const detached = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3, slot: 0 }, config);
    assert(!detached.ok, 'a stairwell was built in an empty field');
    assert(/against the building/.test(detached.reason), 'the refusal does not say why: ' + detached.reason);
    assert(state.stairs.length === 0, 'the detached stairwell was built anyway');

    // Immediately beside the lobby is fine, on either side.
    for (const slot of [3, 5]) {
      const beside = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3, slot }, config);
      assert(beside.ok, 'a stairwell beside the lobby was refused at slot ' + slot + ': ' + beside.reason);
    }
  },

  'the auto-picked column is attached too, not just the leftmost free one'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 313);
    assert(applyAction(state, { type: 'build_lobby', slot: 4 }, config).ok, 'could not build lobby');

    // No slot named: the old scan would have taken slot 0, out in the field.
    const built = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3 }, config);
    assert(built.ok, built.reason);
    const slot = state.stairs[0].slot;
    assert(slot === 3 || slot === 5, 'the fallback picked slot ' + slot + ', which does not touch the lobby');
  },

  'a blocked column is refused by name rather than silently relocated'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 314);
    assert(applyAction(state, { type: 'build_lobby', slot: 4 }, config).ok, 'could not build lobby');
    assert(applyAction(state, { type: 'build_stairs', bottom: 0, top: 3, slot: 5 }, config).ok, 'fixture stairs failed');

    // Slot 5 is now the stairwell's own column. Asking again must refuse, not
    // quietly build somewhere else — the whole complaint was a tool that put
    // things where it liked.
    const blocked = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3, slot: 5 }, config);
    assert(!blocked.ok, 'a blocked column was built in anyway');
    assert(/blocked/.test(blocked.reason), 'the refusal does not say it is blocked: ' + blocked.reason);
    assert(state.stairs.length === 1, 'a second stairwell appeared somewhere else');

    const offGrid = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3, slot: 99 }, config);
    assert(!offGrid.ok && /outside the building/.test(offGrid.reason), 'a column off the grid was accepted');
  },

  'escalators obey the identical rule'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 315);
    assert(applyAction(state, { type: 'build_lobby', slot: 4 }, config).ok, 'could not build lobby');

    const detached = applyAction(state, { type: 'build_escalator', bottom: 0, top: 3, slot: 0 }, config);
    assert(!detached.ok && /against the building/.test(detached.reason), 'a detached escalator was built');
    const beside = applyAction(state, { type: 'build_escalator', bottom: 0, top: 3, slot: 5 }, config);
    assert(beside.ok && state.escalators[0].slot === 5, 'an escalator ignored the column it was given');
  },

  /**
   * The rule was written out FOUR times — twice in `actions.js`, once in the
   * evaluation's advice, once in the renderer's placement status — and three
   * of them only predicted what the fourth would do. Advice or a ghost naming
   * a column the sim refuses is worse than none.
   */
  'the sim, the advisor and the renderer agree on where a run may stand'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 316);
    assert(applyAction(state, { type: 'build_lobby', slot: 4 }, config).ok, 'could not build lobby');

    const shared = firstRouteColumn(state, config, 0, 3);
    const shown = localRouteTargetStatus({ kind: 'stairs', floor: 3 }, state, config);
    assert(shown.slot === shared, 'the renderer points at slot ' + shown.slot + ', the sim at ' + shared);

    // And the column all three name is one the sim will genuinely accept.
    const built = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3, slot: shared }, config);
    assert(built.ok, 'the column everything agreed on was refused: ' + built.reason);
  },


  'stairs reserve a continuous column and cannot overlap a shaft'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
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
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = setup(config, 302);
    const built = applyAction(state, { type: 'build_stairs', bottom: 0, top: 3 }, config);
    assert(built.ok, built.reason);
    // Three storeys up, so the fixture stacks the column that holds it there.
    columnTo(state, config, 3, 2);
    const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 2 }, config);
    assert(unit.ok, unit.reason);
    const office = state.units.at(-1);

    const trip = { from: 0, to: 3, toUnit: unit.id };
    assert(servingStairs(state, trip.from, trip.to).length === 1, 'stairs did not serve the trip span');
    const route = chooseServingRoute(state, trip, [], state.stairs, config);
    assert(route.kind === 'stairs', 'stair route was not selected without an elevator');
    const access = stairAccessSeconds(state, trip, state.stairs[0], config);
    const evaluation = unitEvaluation(state, office, config);
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
    config.building.startFloors = 4;
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
