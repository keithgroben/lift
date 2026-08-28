import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction, servingShafts, multiHopRoute } from '../src/games/lift/sim/index.js';
import { shaftParams } from '../src/games/lift/sim/elevator.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function tallTower(floors = 40) {
  const config = structuredClone(CONFIG);
  config.economy.startMoney = 50000000;
  config.building.startFloors = floors;
  const state = boot(config, 701);
  const lobby = applyAction(state, { type: 'build_lobby', slot: 0 }, config);
  assert(lobby.ok, lobby.reason);
  return { state, config };
}

export const tests = {
  'an express shaft can span past the local limit, at express prices'() {
    const { state, config } = tallTower(40);
    const before = state.money;
    const localTooTall = applyAction(state, { type: 'build_shaft', bottom: 0, top: 30 }, config);
    assert(!localTooTall.ok, 'a 31-floor local shaft should exceed the local span cap');
    const express = applyAction(state, { type: 'build_shaft', bottom: 0, top: 30, kind: 'express' }, config);
    assert(express.ok, express.reason);
    const expected = config.costs.expressShaft + config.costs.expressShaftPerFloor * 31;
    assert(before - state.money === expected,
      'express cost was ' + (before - state.money) + ', expected ' + expected);
    assert(state.shafts[0].kind === 'express', 'shaft kind was not stored');
  },

  'express serves only its two ends and skips everything between'() {
    const { state, config } = tallTower(40);
    applyAction(state, { type: 'build_shaft', bottom: 0, top: 24, kind: 'express' }, config);
    assert(servingShafts(state, 0, 24).length === 1, 'express must serve its endpoint pair');
    assert(servingShafts(state, 0, 12).length === 0, 'express must not serve a skipped floor');
    assert(servingShafts(state, 12, 24).length === 0, 'express must not serve from mid-span');
  },

  'a zoned tower chains local + express through the sky lobby'() {
    const { state, config } = tallTower(40);
    applyAction(state, { type: 'build_shaft', bottom: 0, top: 24, kind: 'express' }, config);
    const upper = applyAction(state, { type: 'build_shaft', bottom: 24, top: 39 }, config);
    assert(upper.ok, upper.reason);
    const route = multiHopRoute(state, 30, 0);
    assert(route && route.join(',') === '30,24,0',
      'floor 30 should reach the lobby via the F24 sky lobby, got ' + JSON.stringify(route));
  },

  'express cars run their own speed, capacity, and car limit'() {
    const { state, config } = tallTower(40);
    applyAction(state, { type: 'build_shaft', bottom: 0, top: 24, kind: 'express' }, config);
    applyAction(state, { type: 'build_shaft', bottom: 0, top: 10 }, config);
    const [express, local] = state.shafts;
    assert(shaftParams(express, config).speed === config.elevator.express.speed, 'express speed not applied');
    assert(shaftParams(express, config).capacity === config.elevator.express.capacity, 'express capacity not applied');
    assert(shaftParams(local, config).capacity === config.elevator.capacity, 'local capacity changed');
    for (let i = 0; i < 20; i++) applyAction(state, { type: 'add_car', id: express.id }, config);
    assert(express.cars.length === config.elevator.express.maxCarsPerShaft,
      'express car limit was ' + express.cars.length);
  },

  'an express shaft is not "access" for the floors it skips'() {
    const { state, config } = tallTower(30);
    applyAction(state, { type: 'build_shaft', bottom: 0, top: 20, kind: 'express' }, config);
    const midBuilt = applyAction(state, { type: 'build_unit', kind: 'office', floor: 10 }, config);
    assert(midBuilt.ok, midBuilt.reason);
    const mid = state.units.at(-1);
    const midEval = unitEvaluation(state, mid, config);
    assert(midEval.accessMode !== 'elevator',
      'a skipped floor claimed elevator access via the express (' + midEval.accessMode + ')');
    const lobbyBuilt = applyAction(state, { type: 'build_unit', kind: 'office', floor: 20 }, config);
    assert(lobbyBuilt.ok, lobbyBuilt.reason);
    const skyLobby = state.units.at(-1);
    assert(unitEvaluation(state, skyLobby, config).accessMode === 'elevator',
      'the sky-lobby floor itself should count the express as access');
  },
};
