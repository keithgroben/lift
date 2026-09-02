/**
 * Demolition. Keith, playing on 2026-09-02: "i cant demolish a lobby."
 *
 * He couldn't demolish stairs, an escalator, a facility, a car or a basement
 * either — the tool called `unitAt` and nothing else — and `delete_shaft` had
 * been sitting in the sim, priced at $50,000, with no caller anywhere in the
 * game, the tests, or the harness.
 *
 * The rule these tests exist to hold is the one that makes demolition safe:
 * **taking something away must obey the same idea of support that putting it
 * there did.** `dependentCell` is `isSupported` read backwards, and if the two
 * ever disagree the tower grows rooms standing on nothing.
 */
import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { basementDepth, cellBuilt, isSupported, lowestFloor, dependentCell, spanDependents } from '../src/games/lift/sim/state.js';
import { columnTo, occupy, unpacedBuilding } from './support.js';

const assert = (c, m) => { if (!c) throw new Error(m); };
const act = (state, type, config, extra = {}) => applyAction(state, { type, ...extra }, config);

function tower(config, { floors = 6, money = 20000000 } = {}) {
  config.economy.startMoney = money;
  config.building.startFloors = floors;
  const state = boot(config, 404);
  const built = act(state, 'build_lobby', config, { slot: config.building.lobbySlot ?? 0 });
  assert(built.ok, built.reason);
  return state;
}

export const tests = {
  // ---------------------------------------------------------------- lobby

  'a lobby segment comes out, and the last one takes the entrance with it'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    const first = state.lobby.slot;
    assert(act(state, 'expand_lobby', config, { slot: first + 1 }).ok, 'fixture could not widen the lobby');
    assert(state.lobby.slots.length === 2, 'fixture lobby is not two segments');

    const one = act(state, 'demolish_lobby', config, { slot: first + 1 });
    assert(one.ok, 'a lobby wing would not come out: ' + one.reason);
    assert(one.remaining === 1, 'the wrong number of segments survived');
    assert(state.lobby && state.lobby.slots.length === 1, 'removing a wing removed the whole lobby');

    // Keith's call, 2026-09-02: yes, the last one too.
    const last = act(state, 'demolish_lobby', config, { slot: first });
    assert(last.ok, 'the last lobby segment would not come out: ' + last.reason);
    assert(last.remaining === 0, 'the last removal did not report an empty entrance');
    assert(state.lobby === null, 'the lobby survived its own last segment');
  },

  'a tower with its lobby removed can be given a new one'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    act(state, 'demolish_lobby', config, { slot: state.lobby.slot });
    assert(state.lobby === null, 'fixture still has a lobby');
    const rebuilt = act(state, 'build_lobby', config, { slot: 3 });
    assert(rebuilt.ok, 'a tower with no entrance cannot be given one: ' + rebuilt.reason);
    assert(state.lobby.slot === 3, 'the rebuilt lobby landed in the wrong column');
  },

  /**
   * The surprising one, and the reason it is written down. Nothing rests on a
   * ground cell — `isSupported` stands the first storey on the ground itself,
   * not on a column — so a lobby segment is always removable, even under a
   * tower. If that ever stops being true, this fails loudly rather than the
   * demolish path quietly growing a second theory of support.
   */
  'the lobby carries no floor above it, so a tall tower does not block it'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    const slot = state.lobby.slot;
    columnTo(state, config, 5, slot);
    assert(cellBuilt(state, 4, slot), 'fixture never stacked a column over the lobby');
    assert(dependentCell(state, 0, slot, config) === null, 'something claims to rest on the ground cell');

    // And nothing BELOW it either. A basement rests on the ground line, not on
    // the column above it, so a ground cell answers null in both directions —
    // otherwise a shaft reaching the ground could never be removed once
    // anything was dug beneath its foot.
    assert(act(state, 'dig_basement', config).ok, 'fixture could not dig');
    const below = act(state, 'build_facility', config, { kind: 'parking', floor: -1, slot });
    assert(below.ok, 'fixture could not put anything under the lobby: ' + below.reason);
    assert(cellBuilt(state, -1, slot), 'fixture basement cell is empty');
    assert(dependentCell(state, 0, slot, config) === null,
      'the basement under a ground cell reads as resting on it');

    const cleared = act(state, 'demolish_lobby', config, { slot });
    assert(cleared.ok, 'a lobby under a five-storey column would not come out: ' + cleared.reason);
    assert(isSupported(state, 1, slot, config), 'the column above lost its support when the lobby went');
  },

  // ------------------------------------------------------- the support rule

  'a room resting on something cannot have that something removed'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    const slot = 2;
    columnTo(state, config, 4, slot);
    const facility = act(state, 'build_facility', config, { kind: 'food', floor: 4, slot });
    assert(facility.ok, facility.reason);
    // A room on top of the facility now depends on it.
    const above = act(state, 'build_unit', config, { kind: 'office', floor: 5, slot });
    assert(above.ok, above.reason);

    const refused = act(state, 'demolish_facility', config, { id: facility.id });
    assert(!refused.ok, 'a facility holding up a room was demolished anyway');
    assert(/F5/.test(refused.reason), 'the refusal does not name what is in the way: ' + refused.reason);

    // Clear the dependent and the same removal is fine.
    assert(act(state, 'demolish_unit', config, { id: above.id }).ok, 'could not clear the room above');
    const now = act(state, 'demolish_facility', config, { id: facility.id });
    assert(now.ok, 'the facility stayed unremovable after its dependent went: ' + now.reason);
  },

  'a shaft holding up a room is refused, and delete_shaft is reachable at all'() {
    const config = structuredClone(CONFIG);
    const state = tower(config, { floors: 8 });
    const slot = 3;
    const shaft = act(state, 'build_shaft', config, { bottom: 0, top: 4, slot });
    assert(shaft.ok, shaft.reason);
    const resting = act(state, 'build_unit', config, { kind: 'office', floor: 5, slot });
    assert(resting.ok, 'fixture could not rest a room on the shaft: ' + resting.reason);

    const refused = act(state, 'delete_shaft', config, { id: shaft.id });
    assert(!refused.ok, 'a shaft carrying a room was deleted anyway');

    assert(act(state, 'demolish_unit', config, { id: resting.id }).ok, 'could not clear the room');
    const gone = act(state, 'delete_shaft', config, { id: shaft.id });
    assert(gone.ok, 'the shaft would not delete once nothing rested on it: ' + gone.reason);
    assert(state.shafts.length === 0, 'the shaft is still standing');
  },

  'a span only answers for what is outside it'() {
    const config = structuredClone(CONFIG);
    const state = tower(config, { floors: 8 });
    const slot = 4;
    const shaft = act(state, 'build_shaft', config, { bottom: 0, top: 4, slot });
    assert(shaft.ok, shaft.reason);
    // Every cell F1..F4 in this column is the shaft's own. If the check
    // counted those, no span could ever be removed.
    assert(spanDependents(state, slot, 0, 4, config).length === 0,
      'a shaft reports its own cells as things resting on it');
  },

  /**
   * Bounded and negated, because the span check has a way of passing for the
   * wrong reason: a span that starts on the ground gets `null` from the lower
   * end anyway, so the filter that excludes a span's OWN cells is never
   * exercised. This asks the rule directly, about a span floating in the
   * middle of a built column, where the filter is the only thing doing work.
   */
  'a mid-column span reports the cell above it and none of its own'() {
    // A seven-storey column is more vacancy than the leasing pace allows, and
    // that gate is not what this test is about.
    const config = unpacedBuilding(structuredClone(CONFIG));
    const state = tower(config, { floors: 8 });
    const slot = 6;
    columnTo(state, config, 7, slot);
    for (const floor of [1, 2, 3, 4, 5, 6]) {
      assert(cellBuilt(state, floor, slot), 'fixture column has a hole at F' + floor);
    }

    const found = spanDependents(state, slot, 2, 4, config);
    assert(found.length === 1, 'a mid-column span reported ' + found.length
      + ' dependents, expected exactly the one above it: ' + JSON.stringify(found));
    assert(found[0].floor === 5, 'the dependent is F' + found[0].floor + ', expected F5');
  },

  /**
   * The mirror underground. A basement hangs off the storey ABOVE it, so the
   * cell that depends on B1 is B2 — the opposite direction from a tower. A
   * check that always looked up would clear B1 out from under B2 and leave it
   * hanging, and every above-ground test would still pass.
   */
  'a basement holding up a deeper one cannot be cleared first'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    const slot = 1;
    assert(act(state, 'dig_basement', config).ok, 'fixture could not dig B1');
    assert(act(state, 'dig_basement', config).ok, 'fixture could not dig B2');

    const upper = act(state, 'build_facility', config, { kind: 'parking', floor: -1, slot });
    assert(upper.ok, upper.reason);
    const lower = act(state, 'build_facility', config, { kind: 'parking', floor: -2, slot });
    assert(lower.ok, 'fixture could not hang a facility off B1: ' + lower.reason);
    assert(isSupported(state, -2, slot, config), 'fixture B2 cell is not actually resting on B1');

    const refused = act(state, 'demolish_facility', config, { id: upper.id });
    assert(!refused.ok, 'B1 was cleared out from under B2');
    assert(/B2/.test(refused.reason), 'the refusal does not name the basement below: ' + refused.reason);

    assert(act(state, 'demolish_facility', config, { id: lower.id }).ok, 'could not clear B2');
    assert(act(state, 'demolish_facility', config, { id: upper.id }).ok, 'B1 stayed stuck after B2 went');
  },

  // ------------------------------------------------------- routes and cars

  'stairs and escalators come out'() {
    const config = structuredClone(CONFIG);
    const state = tower(config, { floors: 6 });
    const stairs = act(state, 'build_stairs', config, { bottom: 0, top: 4 });
    assert(stairs.ok, stairs.reason);
    const escalator = act(state, 'build_escalator', config, { bottom: 0, top: 3 });
    assert(escalator.ok, escalator.reason);

    assert(act(state, 'demolish_stairs', config, { id: stairs.id }).ok, 'stairs would not come out');
    assert(state.stairs.length === 0, 'the stairwell is still there');
    assert(act(state, 'demolish_escalator', config, { id: escalator.id }).ok, 'an escalator would not come out');
    assert(state.escalators.length === 0, 'the escalator is still there');

    assert(!act(state, 'demolish_stairs', config, { id: stairs.id }).ok, 'removing the same stairs twice worked');
  },

  'a car can be taken back off, but never one with riders aboard'() {
    const config = structuredClone(CONFIG);
    const state = tower(config, { floors: 6 });
    const shaft = act(state, 'build_shaft', config, { bottom: 0, top: 4, slot: 3 });
    assert(shaft.ok, shaft.reason);
    // A new shaft arrives with a car already on it, so the count is read
    // rather than assumed — the assertion is about the DELTA.
    assert(act(state, 'add_car', config, { id: shaft.id }).ok, 'fixture could not add a car');
    const before = state.shafts[0].cars.length;
    assert(before >= 2, 'fixture has too few cars to remove one: ' + before);

    const removed = act(state, 'remove_car', config, { id: shaft.id });
    assert(removed.ok, 'a car would not come off: ' + removed.reason);
    assert(state.shafts[0].cars.length === before - 1, 'the car is still on the shaft');
    assert(removed.cars === before - 1, 'the result miscounts what is left');

    // Every remaining car has someone in it: taking one away would delete a
    // trip that no column of the day's accounting would ever report.
    for (const car of state.shafts[0].cars) car.riders.push({ id: -1 });
    const refused = act(state, 'remove_car', config, { id: shaft.id });
    assert(!refused.ok, 'a car with a rider aboard was removed');
    assert(/riders aboard/.test(refused.reason), 'the refusal does not say why: ' + refused.reason);
    assert(state.shafts[0].cars.length === before - 1, 'an occupied car went anyway');
  },

  // ------------------------------------------------------------ basements

  'a basement fills back in, and only when it is empty'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    assert(act(state, 'dig_basement', config).ok, 'fixture could not dig');
    assert(act(state, 'dig_basement', config).ok, 'fixture could not dig twice');
    assert(basementDepth(state) === 2, 'fixture is not two basements deep');

    const parked = act(state, 'build_facility', config, { kind: 'parking', floor: -1, slot: 1 });
    assert(parked.ok, parked.reason);
    // B2 is empty, so it fills; B1 has the parking on it and must refuse.
    const first = act(state, 'fill_basement', config);
    assert(first.ok, 'an empty basement would not fill: ' + first.reason);
    assert(lowestFloor(state) === -1, 'the floor range did not rise');

    const refused = act(state, 'fill_basement', config);
    assert(!refused.ok, 'a basement with a facility on it was filled in');
    assert(/B1/.test(refused.reason), 'the refusal does not name the storey: ' + refused.reason);

    assert(act(state, 'demolish_facility', config, { id: parked.id }).ok, 'could not clear the parking');
    assert(act(state, 'fill_basement', config).ok, 'the cleared basement would not fill');
    assert(lowestFloor(state) === 0, 'the tower is not back at ground level');

    const none = act(state, 'fill_basement', config);
    assert(!none.ok && /no basement/.test(none.reason), 'filling a tower with no basement succeeded');
  },

  'digging and filling are exact inverses'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    const before = lowestFloor(state);
    act(state, 'dig_basement', config);
    act(state, 'fill_basement', config);
    assert(lowestFloor(state) === before, 'dig then fill did not return the floor range');
  },

  // -------------------------------------------------------------- the rest

  'an occupied room is still protected, and every removal is charged'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    const slot = 5;
    const room = act(state, 'build_unit', config, { kind: 'office', floor: 1, slot });
    assert(room.ok, room.reason);
    occupy(state, config, state.units.find((u) => u.id === room.id));
    assert(!act(state, 'demolish_unit', config, { id: room.id }).ok, 'an occupied room was demolished');

    // Each verb takes money, so none of them is a free undo.
    const stairs = act(state, 'build_stairs', config, { bottom: 0, top: 3 });
    const before = state.money;
    assert(act(state, 'demolish_stairs', config, { id: stairs.id }).ok, 'stairs would not come out');
    assert(state.money === before - config.costs.demolition, 'demolition was not charged');
  },

  'a removal with no money is refused and changes nothing'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    const slot = state.lobby.slot;
    state.money = config.costs.demolition - 1;
    const refused = act(state, 'demolish_lobby', config, { slot });
    assert(!refused.ok && /not enough money/.test(refused.reason), 'a lobby came out for free');
    assert(state.lobby !== null, 'the lobby went despite the refusal');
  },

  'asking to remove something that is not there is refused, never guessed at'() {
    const config = structuredClone(CONFIG);
    const state = tower(config);
    for (const [type, args] of [
      ['demolish_facility', { id: 9999 }],
      ['demolish_stairs', { id: 9999 }],
      ['demolish_escalator', { id: 9999 }],
      ['remove_car', { id: 9999 }],
      ['delete_shaft', { id: 9999 }],
      ['demolish_lobby', { slot: 99 }],
    ]) {
      const result = act(state, type, config, args);
      assert(!result.ok, type + ' invented something to remove');
      assert(typeof result.reason === 'string' && result.reason.length > 0, type + ' refused without a reason');
    }
  },
};
