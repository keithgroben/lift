import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction, slotsUsed } from '../src/games/lift/sim/index.js';
import { shaftAccessDistance } from '../src/games/lift/sim/demand.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'lobby occupies its ground-floor slot before a shaft is built'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 119);
    const lobby = applyAction(state, { type: 'build_lobby', slot: 0 }, config);
    assert(lobby.ok, lobby.reason);
    assert(state.lobby.slot === 0 && slotsUsed(state, 0).has(0),
      'lobby did not reserve its ground-floor slot');
    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
    assert(shaft.ok && state.shafts[0].slot !== state.lobby.slot,
      'shaft was built through the lobby');
    const second = applyAction(state, { type: 'build_lobby', slot: 2 }, config);
    assert(!second.ok && second.reason === 'lobby already exists',
      'a second lobby was allowed');
  },

  'lobby placement adds walking distance to every ground-floor trip'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const withLobby = boot(config, 120);
    assert(applyAction(withLobby, { type: 'build_lobby', slot: 0 }, config).ok,
      'could not build lobby');
    assert(applyAction(withLobby, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build lobby shaft');
    const lobbyUnit = applyAction(withLobby, { type: 'build_unit', kind: 'office', floor: 3, slot: 0 }, config);
    assert(lobbyUnit.ok, lobbyUnit.reason);
    const withLobbyTrip = { from: 0, to: 3, toUnit: lobbyUnit.id };
    const lobbyDistance = shaftAccessDistance(withLobby, withLobbyTrip, withLobby.shafts[0]);

    const withoutLobby = boot(config, 121);
    assert(applyAction(withoutLobby, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build comparison shaft');
    const plainUnit = applyAction(withoutLobby, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config);
    assert(plainUnit.ok, plainUnit.reason);
    const plainTrip = { from: 0, to: 3, toUnit: plainUnit.id };
    const plainDistance = shaftAccessDistance(withoutLobby, plainTrip, withoutLobby.shafts[0]);
    assert(lobbyDistance === plainDistance + 1,
      'lobby walk was not included in ground-floor access');
  },

  'lobby expansion occupies a new slot and shortens access to nearby circulation'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 122);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok,
      'could not build lobby');
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build first shaft');
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build second shaft');
    const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config);
    assert(unit.ok, unit.reason);
    const secondShaft = state.shafts[1];
    const trip = { from: 0, to: 3, toUnit: unit.id };
    const before = shaftAccessDistance(state, trip, secondShaft);
    const expanded = applyAction(state, { type: 'expand_lobby', slot: 3 }, config);
    assert(expanded.ok, expanded.reason);
    assert(state.lobby.slots.includes(3) && slotsUsed(state, 0).has(3),
      'lobby expansion did not reserve its new ground-floor slot');
    const after = shaftAccessDistance(state, trip, secondShaft);
    assert(after < before, 'lobby expansion did not shorten access to the nearby shaft');
  },
};
