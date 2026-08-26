import { nid, freeSlot, unlocked, pushEvent } from './state.js';

/**
 * The ONLY way state changes outside of step(). Every player click and every
 * autoplayer decision goes through here, which is what makes replay possible.
 * @returns {{ok: boolean, reason?: string}}
 */
export function applyAction(state, action, config) {
  const fn = ACTIONS[action.type];
  if (!fn) return { ok: false, reason: `unknown action ${action.type}` };
  return fn(state, action, config);
}

const charge = (state, amount) => {
  if (state.money < amount) return false;
  state.money -= amount;
  state.today.spent += amount;
  return true;
};

const HEADS = (config, kind) =>
  kind === 'office' ? config.units.office.workers
  : kind === 'condo' ? config.units.condo.residents
  : config.units.shop.staff;

const ACTIONS = {
  build_floor(state, _a, config) {
    if (state.floors >= config.building.maxFloors) return { ok: false, reason: 'at max height' };
    if (!charge(state, config.costs.floor)) return { ok: false, reason: 'not enough money' };
    state.floors++;
    pushEvent(state, 'floor_built', { floor: state.floors - 1 });
    return { ok: true };
  },

  build_unit(state, a, config) {
    const kind = a.kind;
    if (!config.units[kind]) return { ok: false, reason: `no such unit ${kind}` };
    if (!unlocked(state, config, kind)) return { ok: false, reason: `${kind} is locked` };
    if (a.floor < 1 || a.floor >= state.floors) return { ok: false, reason: 'no such floor' };
    const slot = a.slot ?? freeSlot(state, config, a.floor);
    if (slot < 0) return { ok: false, reason: 'floor is full' };
    if (!charge(state, config.costs[kind])) return { ok: false, reason: 'not enough money' };

    const u = {
      id: nid(state), kind, floor: a.floor, slot,
      heads: HEADS(config, kind),
      occupied: true, stress: 0, vacantDays: 0,
      servedToday: 0,
    };
    state.units.push(u);
    state.today.movedIn++;
    if (kind === 'condo') { state.money += config.units.condo.salePrice; }
    pushEvent(state, 'unit_built', { kind, floor: a.floor });
    return { ok: true, id: u.id };
  },

  build_shaft(state, a, config) {
    const bottom = Math.max(0, a.bottom ?? 0);
    const top = Math.min(a.top ?? state.floors - 1, state.floors - 1);
    if (top <= bottom) return { ok: false, reason: 'shaft must span 2+ floors' };
    const span = top - bottom + 1;
    if (span > config.elevator.maxSpan) {
      return { ok: false, reason: `local shafts cap at ${config.elevator.maxSpan} floors` };
    }
    // A shaft needs the same free column on every floor it passes through.
    let slot = -1;
    for (let s = 0; s < config.building.slotsPerFloor; s++) {
      let clear = true;
      for (let f = bottom; f <= top && clear; f++) {
        for (const u of state.units) if (u.floor === f && u.slot === s) clear = false;
        for (const sh of state.shafts) if (sh.slot === s && f >= sh.bottom && f <= sh.top) clear = false;
      }
      if (clear) { slot = s; break; }
    }
    if (slot < 0) return { ok: false, reason: 'no clear column for a shaft' };

    const cost = config.costs.shaft + config.costs.shaftPerFloor * span;
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };

    const sh = {
      id: nid(state), slot, bottom, top,
      cars: [makeCar(state, bottom)],
      /** Hall calls waiting on each floor, by direction. */
      calls: {},
    };
    state.shafts.push(sh);
    pushEvent(state, 'shaft_built', { bottom, top });
    return { ok: true, id: sh.id };
  },

  extend_shaft(state, a, config) {
    const sh = state.shafts.find((s) => s.id === a.id);
    if (!sh) return { ok: false, reason: 'no such shaft' };
    const top = Math.min(a.top, state.floors - 1);
    if (top <= sh.top) return { ok: false, reason: 'not an extension' };
    if (top - sh.bottom + 1 > config.elevator.maxSpan) {
      return { ok: false, reason: `local shafts cap at ${config.elevator.maxSpan} floors` };
    }
    for (let f = sh.top + 1; f <= top; f++) {
      for (const u of state.units) {
        if (u.floor === f && u.slot === sh.slot) return { ok: false, reason: 'column blocked' };
      }
    }
    const cost = config.costs.shaftPerFloor * (top - sh.top);
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };
    sh.top = top;
    pushEvent(state, 'shaft_extended', { id: sh.id, top });
    return { ok: true };
  },

  add_car(state, a, config) {
    const sh = state.shafts.find((s) => s.id === a.id);
    if (!sh) return { ok: false, reason: 'no such shaft' };
    if (sh.cars.length >= config.elevator.maxCarsPerShaft) {
      return { ok: false, reason: 'shaft is full of cars' };
    }
    if (!charge(state, config.costs.car)) return { ok: false, reason: 'not enough money' };
    // Park new cars spread across the span so they answer calls from different ends.
    const frac = sh.cars.length / config.elevator.maxCarsPerShaft;
    sh.cars.push(makeCar(state, sh.bottom + Math.round((sh.top - sh.bottom) * frac)));
    pushEvent(state, 'car_added', { id: sh.id, cars: sh.cars.length });
    return { ok: true };
  },
};

function makeCar(state, atFloor) {
  return {
    id: nid(state), y: atFloor, dir: 0,
    riders: [], state: 'idle', doorT: 0, target: null,
  };
}

export { HEADS };
