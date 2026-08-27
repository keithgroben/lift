import { nid, servingShafts, pushEvent } from './state.js';

/** Count people currently moving through one local route. */
export function localRouteOccupancy(state, kind, id) {
  const key = kind === 'stairs' ? 'stairId' : kind === 'escalator' ? 'escalatorId' : null;
  if (!key || id == null) return 0;
  return (state?.people ?? []).filter((person) => person.state === 'walking' && person[key] === id).length;
}

/** People waiting beyond the route's currently available first-wave capacity. */
export function localRouteQueueOverflow(state, kind, id, config) {
  const routeKey = kind === 'stairs' ? 'stairId' : kind === 'escalator' ? 'escalatorId' : null;
  if (!routeKey || id == null) return 0;
  const queued = (state?.people ?? []).filter((person) =>
    person.state === 'waiting' && person.localRouteKind === kind && person[routeKey] === id).length;
  const available = Math.max(0, localRouteCapacity(config, kind) - localRouteOccupancy(state, kind, id));
  return Math.max(0, queued - available);
}

function recordLocalRouteOverflow(state, dt, config) {
  if (!state.today) return;
  if (!Array.isArray(state.today.localOverflowRoutes)) state.today.localOverflowRoutes = [];
  const routes = [
    ...(state.stairs ?? []).map((route) => ['stairs', route.id]),
    ...(state.escalators ?? []).map((route) => ['escalator', route.id]),
  ];
  let overflow = 0;
  for (const [kind, id] of routes) {
    const routeOverflow = localRouteQueueOverflow(state, kind, id, config);
    overflow = Math.max(overflow, routeOverflow);
    if (routeOverflow <= 0) continue;
    let routeRecord = state.today.localOverflowRoutes.find((record) =>
      record.kind === kind && record.routeId === id);
    if (!routeRecord) {
      const route = (kind === 'stairs' ? state.stairs : state.escalators ?? [])
        .find((candidate) => candidate.id === id);
      routeRecord = {
        kind, routeId: id,
        bottom: route?.bottom ?? null,
        top: route?.top ?? null,
        seconds: 0,
        peak: 0,
      };
      state.today.localOverflowRoutes.push(routeRecord);
    }
    routeRecord.seconds += routeOverflow * Math.max(0, dt);
    routeRecord.peak = Math.max(routeRecord.peak, routeOverflow);
  }
  state.today.localOverflowPeak = Math.max(Number(state.today.localOverflowPeak) || 0, overflow);
  state.today.localOverflowSeconds = (Number(state.today.localOverflowSeconds) || 0) + overflow * Math.max(0, dt);
}

function localRouteCapacity(config, kind) {
  return Math.max(1, Math.floor(Number(config?.[kind]?.capacity) || 0));
}

/** Shops draw lunch traffic from a local vertical catchment, not the whole tower. */
export function shopsForOffice(state, office, config) {
  const radius = config.demand.shopCatchmentFloors ?? Infinity;
  return state.units.filter((shop) => shop.kind === 'shop' && shop.occupied &&
    Math.abs(shop.floor - office.floor) <= radius);
}

/**
 * Builds the whole day's trip schedule at day start, then releases trips as the
 * clock reaches them. Precomputing keeps the sim deterministic and makes the
 * rush shape a data question rather than a code question.
 */
export function scheduleDay(state, config) {
  const sched = [];
  const { morningRush, lunch, eveningRush } = config.time;
  const rng = state.rng;

  const inWindow = ([a, b], peaky) => a + (b - a) * rng.peak(peaky);
  const k = config.demand.rushPeakiness;

  for (const u of state.units) {
    if (!u.occupied) continue;

    if (u.kind === 'office') {
      for (let w = 0; w < u.heads; w++) {
        sched.push({ at: inWindow(morningRush, k), from: 0, to: u.floor, unit: u.id, toUnit: u.id, kind: 'commute_in' });
        sched.push({ at: 1 - inWindow([1 - eveningRush[1], 1 - eveningRush[0]], k), from: u.floor, to: 0, unit: u.id, fromUnit: u.id, kind: 'commute_out' });
        const shops = shopsForOffice(state, u, config);
        if (shops.length && rng.next() < config.demand.lunchTripRate) {
          const shop = rng.pick(shops);
          sched.push({ at: inWindow(lunch, 1.4), from: u.floor, to: shop.floor, unit: u.id, fromUnit: u.id, toUnit: shop.id, kind: 'lunch_out', shop: shop.id });
        }
      }
    }

    if (u.kind === 'condo') {
      const trips = Math.round(u.heads * config.demand.condoTripsPerDay);
      for (let i = 0; i < trips; i++) {
        const out = 0.12 + rng.next() * 0.6;
        sched.push({ at: out, from: u.floor, to: 0, unit: u.id, fromUnit: u.id, kind: 'errand_out' });
        sched.push({ at: Math.min(0.98, out + 0.08 + rng.next() * 0.15), from: 0, to: u.floor, unit: u.id, toUnit: u.id, kind: 'errand_in' });
      }
    }

    if (u.kind === 'hotel') {
      const trips = Math.max(0, Math.round(config.demand.hotelTripsPerGuestPerDay));
      for (let guest = 0; guest < u.heads; guest++) {
        for (let i = 0; i < trips; i++) {
          const outbound = i % 2 === 0;
          const at = outbound
            ? 0.16 + rng.next() * 0.18
            : 0.68 + rng.next() * 0.18;
          sched.push(outbound
            ? { at, from: 0, to: u.floor, unit: u.id, toUnit: u.id, kind: 'hotel_check_in' }
            : { at, from: u.floor, to: 0, unit: u.id, fromUnit: u.id, kind: 'hotel_check_out' });
        }
      }
    }
  }

  sched.sort((a, b) => a.at - b.at);
  state.schedule = sched;
  state.scheduleAt = 0;
}

/** Release any trips whose time has come, then age everyone who is waiting. */
export function stepDemand(state, dt, config) {
  const sched = state.schedule || [];
  while (state.scheduleAt < sched.length && sched[state.scheduleAt].at <= state.tod) {
    spawnTrip(state, sched[state.scheduleAt++], config);
  }

  for (let i = state.people.length - 1; i >= 0; i--) {
    const p = state.people[i];

    if (p.state === 'walking') {
      p.walkT += dt;
      if (p.walkT >= p.accessT) p.state = 'arrived';
      continue;
    }
    if (p.state === 'waiting') {
      if (p.localRouteKind) {
        const route = (p.localRouteKind === 'stairs' ? state.stairs : state.escalators ?? [])
          .find((candidate) => candidate.id === p.localRouteId);
        if (route && localRouteOccupancy(state, p.localRouteKind, p.localRouteId) < localRouteCapacity(config, p.localRouteKind)) {
          p.state = 'walking';
          p.walkT = 0;
          continue;
        }
      }
      p.waitT += dt;
      if (p.waitT >= config.demand.abandonAfter) {
        resolve(state, p, config, true);
        state.people.splice(i, 1);
      }
      continue;
    }
    if (p.state === 'riding') { p.rideT += dt; continue; }
    if (p.state === 'arrived') {
      resolve(state, p, config, false);
      state.people.splice(i, 1);
    }
  }
  recordLocalRouteOverflow(state, dt, config);
}

/**
 * Midnight. Anyone still waiting or riding never got where they were going.
 * They MUST be resolved, not dropped: silently deleting them made `trips` stop
 * equalling `delivered + abandoned`, which hid a 90% failure rate behind a
 * falling average wait. Accounting holes read as good news.
 */
export function flushInTransit(state, config) {
  for (const p of state.people) resolve(state, p, config, true);
  state.people.length = 0;
}

function spawnTrip(state, t, config) {
  const serving = servingShafts(state, t.from, t.to);
  const stairs = servingStairs(state, t.from, t.to);
  const escalators = servingEscalators(state, t.from, t.to);
  const unit = state.units.find((u) => u.id === t.unit);
  state.today.trips++;

  if (!serving.length && !stairs.length && !escalators.length) {
    // Stranded: no shaft reaches this trip. Charged as a full-length abandon —
    // a rider with no elevator waited forever, not zero. Logging it as zero let
    // a tower that served nobody post the shortest average wait in the sweep.
    const full = config.demand.abandonAfter;
    state.today.abandoned++;
    state.today.waitTotal += full;
    if (full > state.today.waitMax) state.today.waitMax = full;
    if (unit) unit.stress += config.units[unit.kind].stressPerSec * full;
    pushEvent(state, 'stranded', { from: t.from, to: t.to });
    return;
  }

  const best = chooseServingRoute(state, t, serving, stairs, config, escalators);

  if (!best) {
    const localCandidates = [
      ...stairs.map((route) => ({ kind: 'stairs', route, accessT: stairAccessSeconds(state, t, route, config) })),
      ...escalators.map((route) => ({ kind: 'escalator', route, accessT: escalatorAccessSeconds(state, t, route, config) })),
    ].sort((a, b) => a.accessT - b.accessT);
    const fallback = localCandidates[0];
    if (!fallback) return;
    state.people.push({
      id: nid(state), from: t.from, to: t.to, unit: t.unit, kind: t.kind,
      shop: t.shop ?? null, shaft: null, localRouteKind: fallback.kind, localRouteId: fallback.route.id,
      stairId: fallback.kind === 'stairs' ? fallback.route.id : null,
      escalatorId: fallback.kind === 'escalator' ? fallback.route.id : null,
      mode: fallback.kind, accessT: fallback.accessT, walkT: 0,
      state: 'waiting', waitT: 0, rideT: 0,
    });
    state.today.localTrips++;
    return;
  }

  if (best.kind === 'stairs') {
    state.today.localTrips++;
    state.people.push({
      id: nid(state), from: t.from, to: t.to, unit: t.unit, kind: t.kind,
      shop: t.shop ?? null, shaft: null, stairId: best.stair.id,
      localRouteKind: 'stairs', localRouteId: best.stair.id,
      mode: 'stairs', accessT: best.accessT, walkT: 0,
      state: 'walking', waitT: 0, rideT: 0,
    });
    return;
  }

  if (best.kind === 'escalator') {
    state.today.localTrips++;
    state.people.push({
      id: nid(state), from: t.from, to: t.to, unit: t.unit, kind: t.kind,
      shop: t.shop ?? null, shaft: null, escalatorId: best.escalator.id,
      localRouteKind: 'escalator', localRouteId: best.escalator.id,
      mode: 'escalator', accessT: best.accessT, walkT: 0,
      state: 'walking', waitT: 0, rideT: 0,
    });
    return;
  }

  state.today.elevatorTrips++;
  state.people.push({
    id: nid(state), from: t.from, to: t.to, unit: t.unit, kind: t.kind,
    shop: t.shop ?? null, shaft: best.shaft.id,
    accessT: shaftAccessSeconds(state, t, best.shaft, config), carId: null,
    state: 'waiting', waitT: 0, rideT: 0,
  });
}

export function resolve(state, p, config, abandoned) {
  const unit = state.units.find((u) => u.id === p.unit);
  const tune = unit ? config.units[unit.kind] : config.units.office;
  const totalDelay = p.waitT + (p.accessT || 0);
  const over = Math.max(0, totalDelay - tune.patience);

  const localTrip = p.localRouteKind === 'stairs' || p.localRouteKind === 'escalator';
  state.today.waitTotal += p.waitT;
  if (p.waitT > state.today.waitMax) state.today.waitMax = p.waitT;
  if (localTrip) {
    state.today.localWaitTotal += p.waitT;
    if (p.waitT > state.today.localWaitMax) state.today.localWaitMax = p.waitT;
  } else {
    state.today.elevatorWaitTotal += p.waitT;
    if (p.waitT > state.today.elevatorWaitMax) state.today.elevatorWaitMax = p.waitT;
  }

  if (abandoned) {
    state.today.abandoned++;
    if (localTrip) state.today.localAbandoned++;
    else state.today.elevatorAbandoned++;
    if (unit) unit.stress += tune.stressPerSec * config.demand.abandonAfter;
    return;
  }

  state.today.delivered++;
  if (localTrip) state.today.localDelivered++;
  else state.today.elevatorDelivered++;
  if (unit && over > 0) unit.stress += tune.stressPerSec * over;

  if (p.kind === 'lunch_out' && p.shop != null) {
    const shop = state.units.find((u) => u.id === p.shop);
    if (shop && shop.occupied) {
      shop.servedToday++;
      state.today.shopRevenue += config.units.shop.revenuePerCustomer;
      state.money += config.units.shop.revenuePerCustomer;
    }
    // Head back to the office once lunch is done.
    state.schedule.push({
      at: Math.min(0.99, state.tod + 0.05), from: p.to, to: p.from,
      unit: p.unit, fromUnit: p.shop, toUnit: p.unit, kind: 'lunch_back',
    });
    state.schedule.sort((a, b) => a.at - b.at);
    // The pointer must not skip the trips we just re-sorted past.
    state.scheduleAt = state.schedule.findIndex((s) => s.at > state.tod);
    if (state.scheduleAt < 0) state.scheduleAt = state.schedule.length;
  }
}

/** Horizontal corridor distance, in slot-lengths, for a trip's endpoints. */
export function shaftAccessDistance(state, trip, shaft) {
  let slots = 0;
  for (const [floor, unitId] of [[trip.from, trip.fromUnit], [trip.to, trip.toUnit]]) {
    const distance = endpointDistance(state, floor, unitId, shaft.slot);
    if (distance != null) slots += distance;
  }
  return slots;
}

/** Stairs are a continuous local route, so both endpoints walk to the stairwell. */
export function stairAccessDistance(state, trip, stair) {
  let slots = 0;
  for (const [floor, unitId] of [[trip.from, trip.fromUnit], [trip.to, trip.toUnit]]) {
    const distance = endpointDistance(state, floor, unitId, stair.slot);
    if (distance != null) slots += distance;
  }
  return slots;
}

export function stairAccessSeconds(state, trip, stair, config) {
  return stairAccessDistance(state, trip, stair) * config.access.walkSecondsPerSlot
    + Math.abs(trip.to - trip.from) * config.stairs.walkSecondsPerFloor;
}

export function escalatorAccessDistance(state, trip, escalator) {
  let slots = 0;
  for (const [floor, unitId] of [[trip.from, trip.fromUnit], [trip.to, trip.toUnit]]) {
    const distance = endpointDistance(state, floor, unitId, escalator.slot);
    if (distance != null) slots += distance;
  }
  return slots;
}

export function escalatorAccessSeconds(state, trip, escalator, config) {
  return escalatorAccessDistance(state, trip, escalator) * config.access.walkSecondsPerSlot
    + Math.abs(trip.to - trip.from) * config.escalator.travelSecondsPerFloor;
}

export function servingStairs(state, from, to) {
  const lo = Math.min(from, to), hi = Math.max(from, to);
  if (lo === hi) return [];
  return (state.stairs ?? []).filter((stair) => stair.bottom <= lo && stair.top >= hi);
}

export function servingEscalators(state, from, to) {
  const lo = Math.min(from, to), hi = Math.max(from, to);
  if (lo === hi) return [];
  return (state.escalators ?? []).filter((escalator) =>
    escalator.bottom <= lo && escalator.top >= hi);
}

export function lobbyAccessDistance(state, targetSlot) {
  if (!state.lobby) return null;
  const slots = state.lobby.slots ?? [state.lobby.slot];
  return Math.min(...slots.map((slot) => Math.abs(slot - targetSlot)));
}

function endpointDistance(state, floor, unitId, targetSlot) {
  if (floor === 0) return lobbyAccessDistance(state, targetSlot);
  if (unitId == null) return null;
  const unit = state.units.find((u) => u.id === unitId);
  return unit && unit.floor === floor ? Math.abs(unit.slot - targetSlot) : null;
}

export function shaftAccessSeconds(state, trip, shaft, config) {
  return shaftAccessDistance(state, trip, shaft) * config.access.walkSecondsPerSlot;
}

/**
 * Pick the shaft with the best combined access and queue score. A queue unit
 * is estimated as one full stop's service time, so walking only beats a queue
 * when the extra distance is worth it to the tenant.
 */
export function chooseServingShaft(state, trip, serving, config) {
  let best = serving[0], bestScore = Infinity;
  for (const sh of serving) {
    const score = shaftRouteScore(state, trip, sh, config);
    if (score < bestScore) { bestScore = score; best = sh; }
  }
  return best;
}

/** Choose between an elevator with a queue and a slower but independent stair route. */
export function chooseServingRoute(state, trip, serving, stairs, config, escalators = []) {
  let best = null;
  for (const shaft of serving) {
    const score = shaftRouteScore(state, trip, shaft, config);
    if (!best || score < best.score) best = { kind: 'elevator', shaft, score };
  }
  for (const stair of stairs) {
    const accessT = stairAccessSeconds(state, trip, stair, config);
    if (localRouteOccupancy(state, 'stairs', stair.id) >= localRouteCapacity(config, 'stairs')) continue;
    const score = localRouteScore(accessT, state, 'stairs', stair.id, config);
    if (!best || score < best.score) best = { kind: 'stairs', stair, accessT, score };
  }
  for (const escalator of escalators) {
    const accessT = escalatorAccessSeconds(state, trip, escalator, config);
    if (localRouteOccupancy(state, 'escalator', escalator.id) >= localRouteCapacity(config, 'escalator')) continue;
    const score = localRouteScore(accessT, state, 'escalator', escalator.id, config);
    if (!best || score < best.score) best = { kind: 'escalator', escalator, accessT, score };
  }
  return best;
}

function localRouteScore(accessT, state, kind, id, config) {
  const capacity = localRouteCapacity(config, kind);
  const occupancy = localRouteOccupancy(state, kind, id);
  const loadPenalty = Math.max(0, Number(config?.[kind]?.loadPenaltySeconds) || 0);
  return accessT + Math.min(1, occupancy / capacity) * loadPenalty;
}

function shaftRouteScore(state, trip, shaft, config) {
  let queue = 0;
  for (const p of state.people) if (p.state === 'waiting' && p.shaft === shaft.id) queue++;
  const serviceWave = config.elevator.doorTime + config.elevator.boardTime * config.elevator.capacity;
  const queueWait = (queue / Math.max(1, shaft.cars.length)) * serviceWave;
  return queueWait + shaftAccessSeconds(state, trip, shaft, config);
}
