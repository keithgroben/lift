import {
  nid, freeSlot, freeSupportedSlot, slotsUsed, unlocked, pushEvent, assignTenantJitter,
  basementDepth, floorCost, isBuildableFloor, isSupported, lowestFloor,
} from './state.js';
import { clampRentLevel, rentForLevel } from './pricing.js';
import { unitEvaluation, leasingForecast } from './evaluation.js';

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

    // The lot comes with the game. Keith's call, 2026-09-01: you buy the
    // entrance, not the ground under it — so the ground storey appears with
    // the lobby and is not charged for.
    if (state.floors <= (config.building.lobbyFloor ?? 0)) {
      state.floors = (config.building.lobbyFloor ?? 0) + 1;
      pushEvent(state, 'floor_built', { floor: config.building.lobbyFloor ?? 0 });
    }
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

  /**
   * Dig one storey down. Symmetric with build_floor: it moves the OTHER end
   * of the floor range, and everything that reads the range (rooms,
   * facilities, shafts, upkeep) picks the new floor up for free. Gated on
   * depth and money only — the same freedom `build_floor` has, deliberately:
   * making it wait for a lobby would put the whole underground behind
   * spec/tower-view.md §4's lobby-first change and out of reach of every
   * headless policy until then.
   */
  dig_basement(state, _a, config) {
    const maxDepth = Math.max(0, Math.floor(Number(config.underground?.maxDepth) || 0));
    if (basementDepth(state) >= maxDepth) return { ok: false, reason: 'at max depth' };
    const cost = Number(config.underground?.digCost);
    if (!Number.isFinite(cost)) return { ok: false, reason: 'digging has no cost' };
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };
    state.lowestFloor = lowestFloor(state) - 1;
    pushEvent(state, 'basement_dug', { floor: state.lowestFloor, depth: basementDepth(state) });
    return { ok: true, floor: state.lowestFloor };
  },

  /**
   * Place a room. If it lands on the storey immediately above the roof, the
   * storey comes with it and is charged for.
   *
   * SimTower has no floor purchase at all — you place a room and the structure
   * appears — and our separate `+ floor` button was the thing teaching players
   * that a tower is built floors-first. Keith's call, 2026-09-01: the button
   * goes, the rule stays. `build_floor` survives as an action because policies
   * and the harness still need to raise a storey deliberately; nothing in the
   * interface offers it any more.
   *
   * One storey above the roof, never two: a room needs something under it.
   */
  build_unit(state, a, config) {
    const kind = a.kind;
    if (!config.units[kind]) return { ok: false, reason: `no such unit ${kind}` };
    if (!unlocked(state, config, kind)) return { ok: false, reason: `${kind} is locked` };
    const raising = a.floor === state.floors && a.floor !== (config.building.lobbyFloor ?? 0);
    if (raising) {
      if (state.floors >= config.building.maxFloors) return { ok: false, reason: 'at max height' };
      if (state.money < config.costs.floor + floorCost(config, a.floor, config.costs[kind])) {
        return { ok: false, reason: 'not enough money' };
      }
    } else if (!isBuildableFloor(state, a.floor, config)) {
      return { ok: false, reason: a.floor > state.floors ? 'nothing to build that on yet' : 'no such floor' };
    }
    const slot = a.slot ?? freeSupportedSlot(state, config, a.floor);
    if (slot < 0 || slotsUsed(state, a.floor).has(slot)) return { ok: false, reason: 'floor is full' };
    // A room rests on something or it does not go up. See isSupported().
    if (!isSupported(state, a.floor, slot, config)) return { ok: false, reason: 'nothing holds that up — build on top of the tower' };
    // Tenant demand is capped at the tower's current move-in capacity, so
    // rooms built faster than that just sit empty racking up vacant-unit
    // upkeep — a bankruptcy trap that has nothing to do with elevator
    // throughput. Gating construction on the vacancy backlog relative to
    // TODAY's capacity (which grows with the tower) keeps growth paced to
    // actual leasing speed without capping every tower at the same size.
    const vacantRentable = state.units.filter((existing) => !existing.occupied).length;
    const dailyCapacity = Math.max(1, leasingForecast(state, config).capacity);
    const vacancyLimit = dailyCapacity * config.occupancy.vacancyBufferDays;
    if (vacantRentable >= vacancyLimit) {
      return { ok: false, reason: 'too many vacant rooms already — let existing space fill before building more' };
    }
    if (!charge(state, floorCost(config, a.floor, config.costs[kind]))) {
      return { ok: false, reason: 'not enough money' };
    }
    // The slab, bought with the room rather than before it. Charged after the
    // room so a half-funded purchase cannot leave an empty storey behind.
    if (raising) {
      if (!charge(state, config.costs.floor)) return { ok: false, reason: 'not enough money' };
      state.floors++;
      pushEvent(state, 'floor_built', { floor: state.floors - 1 });
    }

    const rentLevel = state.rentLevels?.[kind] ?? 0;
    const u = {
      id: nid(state), kind, floor: a.floor, slot,
      heads: HEADS(config, kind),
      rentLevel, rent: rentForLevel(config, kind, rentLevel),
      occupied: false, stress: 0, desirabilityPressure: 0, vacantDays: 0,
      daysOccupied: 0,
      renovated: false,
      servedToday: 0,
    };
    state.units.push(u);
    // No tenant comes with the keys. Keith, 2026-09-01: "there is literally no
    // elevator, yet they are still occupied rooms?" Construction used to seat
    // a tenant on the spot and count a move-in, which walked straight past the
    // leasing system in economy.js — the one place that asks whether anybody
    // can actually REACH the room. A room with no transport scores 0, sits
    // below `relistMinScore`, and now stays empty until a shaft serves it.
    // `assignTenantJitter` moves to the move-in itself, where the tenant it
    // describes actually arrives.
    if (kind === 'condo') { state.money += config.units.condo.salePrice; }
    pushEvent(state, 'unit_built', { unitKind: kind, floor: a.floor });
    return { ok: true, id: u.id };
  },

  build_facility(state, a, config) {
    const kind = a.kind;
    if (!config.services?.[kind]) return { ok: false, reason: `no such facility ${kind}` };
    if (!unlocked(state, config, kind)) return { ok: false, reason: `${kind} is locked` };
    if (!isBuildableFloor(state, a.floor, config)) return { ok: false, reason: 'no such floor' };
    const slot = a.slot ?? freeSupportedSlot(state, config, a.floor);
    if (slot < 0 || slotsUsed(state, a.floor).has(slot)) return { ok: false, reason: 'floor is full' };
    if (!isSupported(state, a.floor, slot, config)) return { ok: false, reason: 'nothing holds that up — build on top of the tower' };
    const cost = config.costs[kind];
    if (!Number.isFinite(cost)) return { ok: false, reason: `${kind} has no build cost` };
    if (!charge(state, floorCost(config, a.floor, cost))) return { ok: false, reason: 'not enough money' };

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
    unit.daysOccupied = 0;
    if (unit.kind === 'hotel') unit.heads = config.units.hotel.guests;
    unit.servedToday = 0;
    assignTenantJitter(state, unit, config);
    state.today.movedIn++;
    pushEvent(state, 'rerented', { unitKind: unit.kind, floor: unit.floor });
    return { ok: true, id: unit.id, evaluation: evaluation.score };
  },

  build_shaft(state, a, config) {
    const kind = a.kind === 'express' ? 'express' : 'local';
    // Clamped to the bottom of the world, not to 0: a shaft reaches down into
    // the basements on exactly the terms it reaches up, span cost included.
    const bottom = Math.max(lowestFloor(state), a.bottom ?? 0);
    const top = Math.min(a.top ?? state.floors - 1, state.floors - 1);
    if (top <= bottom) return { ok: false, reason: 'shaft must span 2+ floors' };
    // Express only makes sense as a nonstop hop between two floors; a "skip
    // everything" shaft with no floors to skip is just a slower local one.
    if (kind === 'express' && top - bottom < 2) {
      return { ok: false, reason: 'express shafts need at least one floor to skip' };
    }
    const span = top - bottom + 1;
    const maxSpan = kind === 'express'
      ? (config.elevator.express?.maxSpan ?? config.elevator.maxSpan)
      : config.elevator.maxSpan;
    if (span > maxSpan) {
      return { ok: false, reason: `${kind} shafts cap at ${maxSpan} floors` };
    }
    // A shaft needs the same free column on every floor it passes through.
    // UI callers may choose a column; headless policies keep the old
    // first-clear fallback so existing simulations remain deterministic.
    const requestedSlot = Number.isInteger(a.slot) ? a.slot : null;
    if (requestedSlot != null && (requestedSlot < 0 || requestedSlot >= config.building.slotsPerFloor)) {
      return { ok: false, reason: 'selected shaft column is outside the building' };
    }
    let slot = -1;
    const candidateSlots = requestedSlot == null
      ? Array.from({ length: config.building.slotsPerFloor }, (_, index) => index)
      : [requestedSlot];
    for (const s of candidateSlots) {
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
    if (slot < 0) return { ok: false, reason: requestedSlot == null ? 'no clear column for a shaft' : 'selected shaft column is blocked across this span' };

    const cost = kind === 'express'
      ? (config.costs.expressShaft ?? config.costs.shaft) + (config.costs.expressShaftPerFloor ?? config.costs.shaftPerFloor) * span
      : config.costs.shaft + config.costs.shaftPerFloor * span;
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };

    const sh = {
      id: nid(state), slot, bottom, top, kind,
      cars: [makeCar(state, bottom)],
      /** Hall calls waiting on each floor, by direction. */
      calls: {},
    };
    state.shafts.push(sh);
    pushEvent(state, 'shaft_built', { bottom, top, slot, kind });
    return { ok: true, id: sh.id };
  },

  /**
   * Shafts can only be extended taller, never shortened — so reconfiguring a
   * zone (turning a too-tall local run into an express-to-sky-lobby handoff,
   * or freeing a column for something else) means removing one outright and
   * rebuilding it, the same "demolish, don't patch" pattern rooms already
   * use. Refuses to strand anyone mid-ride rather than dropping them.
   */
  delete_shaft(state, a, config) {
    const index = state.shafts.findIndex((sh) => sh.id === a.id);
    if (index < 0) return { ok: false, reason: 'no such shaft' };
    const sh = state.shafts[index];
    const hasRiders = sh.cars.some((car) => car.riders.length > 0);
    if (hasRiders) return { ok: false, reason: 'shaft has riders in transit' };
    if (!charge(state, config.costs.shaftDemolition)) return { ok: false, reason: 'not enough money' };
    state.shafts.splice(index, 1);
    // Anyone still waiting for this shaft is left alone, not force-resolved:
    // no car will ever come now, so they ride out the existing abandonAfter
    // timeout and correctly count as abandoned — same path a genuinely
    // stranded rider already takes, not a new "deleted out from under them"
    // special case that would need its own accounting.
    pushEvent(state, 'shaft_demolished', { bottom: sh.bottom, top: sh.top, slot: sh.slot });
    return { ok: true, id: sh.id };
  },

  /**
   * Extend a shaft up, down, or both in one call. Down is not a second kind
   * of action: it is the same span extended at the other end, charged at the
   * identical `shaftPerFloor` rate, because an unserved basement is exactly
   * as dead as an unserved 40th floor. Omitting `bottom` leaves the bottom
   * where it is, so every existing `{ id, top }` caller is unaffected.
   */
  extend_shaft(state, a, config) {
    const sh = state.shafts.find((s) => s.id === a.id);
    if (!sh) return { ok: false, reason: 'no such shaft' };
    const top = a.top == null ? sh.top : Math.min(a.top, state.floors - 1);
    const bottom = a.bottom == null ? sh.bottom : Math.max(a.bottom, lowestFloor(state));
    if (top <= sh.top && bottom >= sh.bottom) return { ok: false, reason: 'not an extension' };
    if (top < sh.top || bottom > sh.bottom) return { ok: false, reason: 'shafts are never shortened' };
    const extendMax = sh.kind === 'express'
      ? (config.elevator.express?.maxSpan ?? config.elevator.maxSpan)
      : config.elevator.maxSpan;
    if (top - bottom + 1 > extendMax) {
      return { ok: false, reason: `${sh.kind ?? 'local'} shafts cap at ${extendMax} floors` };
    }
    for (const [from, to] of [[sh.top + 1, top], [bottom, sh.bottom - 1]]) {
      if (columnBlocked(state, sh.slot, from, to)) return { ok: false, reason: 'column blocked' };
    }
    const added = (top - sh.top) + (sh.bottom - bottom);
    const cost = config.costs.shaftPerFloor * added;
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };
    sh.top = top;
    sh.bottom = bottom;
    pushEvent(state, 'shaft_extended', { id: sh.id, top, bottom });
    return { ok: true };
  },

  add_car(state, a, config) {
    const sh = state.shafts.find((s) => s.id === a.id);
    if (!sh) return { ok: false, reason: 'no such shaft' };
    const express = sh.kind === 'express';
    const maxCars = express
      ? (config.elevator.express?.maxCarsPerShaft ?? config.elevator.maxCarsPerShaft)
      : config.elevator.maxCarsPerShaft;
    if (sh.cars.length >= maxCars) {
      return { ok: false, reason: 'shaft is full of cars' };
    }
    const cost = express ? (config.costs.expressCar ?? config.costs.car) : config.costs.car;
    if (!charge(state, cost)) return { ok: false, reason: 'not enough money' };
    // Park new cars spread across the span so they answer calls from different ends.
    const frac = sh.cars.length / maxCars;
    sh.cars.push(makeCar(state, sh.bottom + Math.round((sh.top - sh.bottom) * frac)));
    pushEvent(state, 'car_added', { id: sh.id, cars: sh.cars.length });
    return { ok: true };
  },
};

/**
 * Is `slot` occupied by anything on floors `from..to` (inclusive, empty when
 * from > to)? Shared by both ends of `extend_shaft` so a downward extension
 * is checked on exactly the terms an upward one always was. Existing shafts
 * are deliberately NOT checked here — that was true of the upward path
 * before basements and changing it would move balance, not fix this issue.
 */
function columnBlocked(state, slot, from, to) {
  for (let f = from; f <= to; f++) {
    for (const u of state.units) if (u.floor === f && u.slot === slot) return true;
    for (const facility of state.facilities ?? []) {
      if (facility.floor === f && facility.slot === slot) return true;
    }
    if (state.lobby && f === 0) {
      const lobbySlots = state.lobby.slots ?? [state.lobby.slot];
      if (lobbySlots.includes(slot)) return true;
    }
    for (const stair of state.stairs ?? []) {
      if (stair.slot === slot && f >= stair.bottom && f <= stair.top) return true;
    }
    for (const escalator of state.escalators ?? []) {
      if (escalator.slot === slot && f >= escalator.bottom && f <= escalator.top) return true;
    }
  }
  return false;
}

function makeCar(state, atFloor) {
  return {
    id: nid(state), y: atFloor, dir: 0,
    riders: [], state: 'idle', doorT: 0, target: null,
  };
}

export { HEADS };
