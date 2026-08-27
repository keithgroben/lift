import { nid, freeSlot, slotsUsed, unlocked, pushEvent } from './state.js';
import { clampRentLevel, rentForLevel } from './pricing.js';
import { unitEvaluation } from './evaluation.js';

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
  : kind === 'shop' ? config.units.shop.staff
  : config.units.hotel.guests;

const ACTIONS = {
  build_lobby(state, a, config) {
    if (state.lobby) return { ok: false, reason: 'lobby already exists' };
    const slot = a.slot ?? config.building.lobbySlot ?? 0;
    if (slot < 0 || slot >= config.building.slotsPerFloor || slotsUsed(state, 0).has(slot)) {
      return { ok: false, reason: 'ground-floor slot is occupied' };
    }
    if (!charge(state, config.costs.lobby)) return { ok: false, reason: 'not enough money' };

    state.lobby = { id: nid(state), floor: 0, slot, slots: [slot] };
    pushEvent(state, 'lobby_built', { floor: 0, slot });
    return { ok: true, id: state.lobby.id, slot };
  },

  expand_lobby(state, a, config) {
    if (!state.lobby) return { ok: false, reason: 'build a lobby first' };
    const slot = a.slot;
    const lobbySlots = state.lobby.slots ?? [state.lobby.slot];
    if (!Number.isInteger(slot) || slot < 0 || slot >= config.building.slotsPerFloor || lobbySlots.includes(slot)) {
      return { ok: false, reason: 'that lobby slot is already occupied' };
    }
    if (slotsUsed(state, 0).has(slot)) return { ok: false, reason: 'ground-floor slot is occupied' };
    if (!charge(state, config.costs.lobbyExpansion)) return { ok: false, reason: 'not enough money' };

    state.lobby.slots = [...lobbySlots, slot].sort((a, b) => a - b);
    pushEvent(state, 'lobby_expanded', { slot, size: state.lobby.slots.length });
    return { ok: true, slot, size: state.lobby.slots.length };
  },

  build_stairs(state, a, config) {
    if (!state.lobby) return { ok: false, reason: 'build a lobby first' };
    if (!unlocked(state, config, 'stairs')) return { ok: false, reason: 'stairs are locked' };
    const bottom = Math.max(0, a.bottom ?? config.building.lobbyFloor ?? 0);
    const top = Math.min(a.top ?? state.floors - 1, state.floors - 1);
    if (bottom !== (config.building.lobbyFloor ?? 0)) {
      return { ok: false, reason: 'stairs must start at the lobby' };
    }
    if (top <= bottom) return { ok: false, reason: 'stairs must reach an upper floor' };
    const span = top - bottom + 1;
    if (span > config.stairs.maxSpan) {
      return { ok: false, reason: `local stairs cap at ${config.stairs.maxSpan} floors` };
    }

    let slot = -1;
    for (let s = 0; s < config.building.slotsPerFloor; s++) {
      let clear = true;
      for (let f = bottom; f <= top && clear; f++) {
        if (slotsUsed(state, f).has(s)) clear = false;
      }
      if (clear) { slot = s; break; }
    }
    if (slot < 0) return { ok: false, reason: 'no clear column for stairs' };

    const cost = config.costs.stairs + config.costs.stairsPerFloor * (top - bottom);
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };

    const stair = { id: nid(state), slot, bottom, top };
    state.stairs.push(stair);
    pushEvent(state, 'stairs_built', { bottom, top });
    return { ok: true, id: stair.id, slot };
  },

  build_escalator(state, a, config) {
    if (!state.lobby) return { ok: false, reason: 'build a lobby first' };
    if (!unlocked(state, config, 'escalator')) return { ok: false, reason: 'escalators are locked' };
    const bottom = Math.max(0, a.bottom ?? config.building.lobbyFloor ?? 0);
    const top = Math.min(a.top ?? state.floors - 1, state.floors - 1);
    if (bottom !== (config.building.lobbyFloor ?? 0)) {
      return { ok: false, reason: 'escalators must start at the lobby' };
    }
    if (top <= bottom) return { ok: false, reason: 'escalators must reach an upper floor' };
    const span = top - bottom + 1;
    if (span > config.escalator.maxSpan) {
      return { ok: false, reason: `local escalators cap at ${config.escalator.maxSpan} floors` };
    }

    let slot = -1;
    for (let s = 0; s < config.building.slotsPerFloor; s++) {
      let clear = true;
      for (let f = bottom; f <= top && clear; f++) {
        if (slotsUsed(state, f).has(s)) clear = false;
      }
      if (clear) { slot = s; break; }
    }
    if (slot < 0) return { ok: false, reason: 'no clear column for escalators' };

    const cost = config.costs.escalator + config.costs.escalatorPerFloor * (top - bottom);
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };

    const escalator = { id: nid(state), slot, bottom, top };
    state.escalators.push(escalator);
    pushEvent(state, 'escalator_built', { bottom, top });
    return { ok: true, id: escalator.id, slot };
  },

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
    if (slot < 0 || slotsUsed(state, a.floor).has(slot)) return { ok: false, reason: 'floor is full' };
    if (!charge(state, config.costs[kind])) return { ok: false, reason: 'not enough money' };

    const rentLevel = state.rentLevels?.[kind] ?? 0;
    const u = {
      id: nid(state), kind, floor: a.floor, slot,
      heads: HEADS(config, kind),
      rentLevel, rent: rentForLevel(config, kind, rentLevel),
      occupied: true, stress: 0, desirabilityPressure: 0, vacantDays: 0,
      renovated: false,
      servedToday: 0,
    };
    state.units.push(u);
    state.today.movedIn++;
    if (kind === 'condo') { state.money += config.units.condo.salePrice; }
    pushEvent(state, 'unit_built', { unitKind: kind, floor: a.floor });
    return { ok: true, id: u.id };
  },

  build_facility(state, a, config) {
    const kind = a.kind;
    if (!config.services?.[kind]) return { ok: false, reason: `no such facility ${kind}` };
    if (!unlocked(state, config, kind)) return { ok: false, reason: `${kind} is locked` };
    if (a.floor < 1 || a.floor >= state.floors) return { ok: false, reason: 'no such floor' };
    const slot = a.slot ?? freeSlot(state, config, a.floor);
    if (slot < 0 || slotsUsed(state, a.floor).has(slot)) return { ok: false, reason: 'floor is full' };
    const cost = config.costs[kind];
    if (!Number.isFinite(cost)) return { ok: false, reason: `${kind} has no build cost` };
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };

    const facility = { id: nid(state), kind, floor: a.floor, slot };
    state.facilities.push(facility);
    pushEvent(state, 'facility_built', { facilityKind: kind, floor: a.floor });
    return { ok: true, id: facility.id };
  },

  set_rent(state, a, config) {
    const kind = a.kind;
    if (!config.units[kind]) return { ok: false, reason: `no such unit ${kind}` };
    const level = clampRentLevel(a.level, config);
    const rent = rentForLevel(config, kind, level);
    if (!state.rentLevels) state.rentLevels = {};
    state.rentLevels[kind] = level;
    for (const u of state.units) {
      if (u.kind !== kind) continue;
      u.rentLevel = level;
      u.rent = rent;
    }
    pushEvent(state, 'rent_changed', { unitKind: kind, level, rent });
    return { ok: true, kind, level, rent };
  },

  renovate_unit(state, a, config) {
    const unit = state.units.find((u) => u.id === a.id);
    if (!unit) return { ok: false, reason: 'no such unit' };
    if (unit.occupied) return { ok: false, reason: 'room is occupied' };
    if (unit.renovated) return { ok: false, reason: 'room is already renovated' };
    if (!charge(state, config.costs.renovation)) return { ok: false, reason: 'not enough money' };

    unit.renovated = true;
    pushEvent(state, 'renovated', { unitKind: unit.kind, floor: unit.floor });
    return { ok: true, id: unit.id, bonus: config.evaluation.renovationBonus };
  },

  convert_unit(state, a, config) {
    const unit = state.units.find((u) => u.id === a.id);
    const targetKind = a.kind;
    if (!unit) return { ok: false, reason: 'no such unit' };
    if (unit.occupied) return { ok: false, reason: 'room is occupied' };
    if (!config.units[targetKind]) return { ok: false, reason: `no such unit ${targetKind}` };
    if (targetKind === unit.kind) return { ok: false, reason: 'room is already that type' };
    if (!unlocked(state, config, targetKind)) return { ok: false, reason: `${targetKind} is locked` };
    if (!charge(state, config.costs.conversion)) return { ok: false, reason: 'not enough money' };

    const fromKind = unit.kind;
    const rentLevel = state.rentLevels?.[targetKind] ?? 0;
    unit.kind = targetKind;
    unit.heads = HEADS(config, targetKind);
    unit.rentLevel = rentLevel;
    unit.rent = rentForLevel(config, targetKind, rentLevel);
    unit.stress = 0;
    unit.desirabilityPressure = 0;
    unit.vacantDays = 0;
    unit.renovated = false;
    unit.servedToday = 0;
    pushEvent(state, 'converted', { fromKind, unitKind: targetKind, floor: unit.floor });
    return { ok: true, id: unit.id, fromKind, kind: targetKind };
  },

  demolish_unit(state, a, config) {
    const index = state.units.findIndex((u) => u.id === a.id);
    if (index < 0) return { ok: false, reason: 'no such unit' };
    const unit = state.units[index];
    if (unit.occupied) return { ok: false, reason: 'room is occupied' };
    if (!charge(state, config.costs.demolition)) return { ok: false, reason: 'not enough money' };

    state.units.splice(index, 1);
    pushEvent(state, 'demolished', { unitKind: unit.kind, floor: unit.floor });
    return { ok: true, id: unit.id, kind: unit.kind, floor: unit.floor };
  },

  rerent_unit(state, a, config) {
    const unit = state.units.find((u) => u.id === a.id);
    if (!unit) return { ok: false, reason: 'no such unit' };
    if (unit.occupied) return { ok: false, reason: 'unit is already occupied' };
    const evaluation = unitEvaluation(state, unit, config);
    if (evaluation.score < config.evaluation.relistMinScore) {
      return { ok: false, reason: 'room evaluation is too low to re-rent' };
    }
    if (!charge(state, config.costs.rerent)) return { ok: false, reason: 'not enough money' };

    unit.occupied = true;
    unit.stress = 0;
    unit.desirabilityPressure = 0;
    unit.vacantDays = 0;
    if (unit.kind === 'hotel') unit.heads = config.units.hotel.guests;
    unit.servedToday = 0;
    state.today.movedIn++;
    pushEvent(state, 'rerented', { unitKind: unit.kind, floor: unit.floor });
    return { ok: true, id: unit.id, evaluation: evaluation.score };
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
        for (const facility of state.facilities ?? []) if (facility.floor === f && facility.slot === s) clear = false;
        if (state.lobby && f === 0) {
          const lobbySlots = state.lobby.slots ?? [state.lobby.slot];
          if (lobbySlots.includes(s)) clear = false;
        }
        for (const stair of state.stairs ?? []) if (stair.slot === s && f >= stair.bottom && f <= stair.top) clear = false;
        for (const escalator of state.escalators ?? []) if (escalator.slot === s && f >= escalator.bottom && f <= escalator.top) clear = false;
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
      for (const facility of state.facilities ?? []) {
        if (facility.floor === f && facility.slot === sh.slot) return { ok: false, reason: 'column blocked' };
      }
      for (const stair of state.stairs ?? []) {
        if (stair.slot === sh.slot && f >= stair.bottom && f <= stair.top) return { ok: false, reason: 'column blocked' };
      }
      for (const escalator of state.escalators ?? []) {
        if (escalator.slot === sh.slot && f >= escalator.bottom && f <= escalator.top) return { ok: false, reason: 'column blocked' };
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
