import { nid, servingShafts, pushEvent } from './state.js';

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

  const shops = state.units.filter((u) => u.kind === 'shop' && u.occupied);

  for (const u of state.units) {
    if (!u.occupied) continue;

    if (u.kind === 'office') {
      for (let w = 0; w < u.heads; w++) {
        sched.push({ at: inWindow(morningRush, k), from: 0, to: u.floor, unit: u.id, kind: 'commute_in' });
        sched.push({ at: 1 - inWindow([1 - eveningRush[1], 1 - eveningRush[0]], k), from: u.floor, to: 0, unit: u.id, kind: 'commute_out' });
        if (shops.length && rng.next() < config.demand.lunchTripRate) {
          const shop = rng.pick(shops);
          sched.push({ at: inWindow(lunch, 1.4), from: u.floor, to: shop.floor, unit: u.id, kind: 'lunch_out', shop: shop.id });
        }
      }
    }

    if (u.kind === 'condo') {
      const trips = Math.round(u.heads * config.demand.condoTripsPerDay);
      for (let i = 0; i < trips; i++) {
        const out = 0.12 + rng.next() * 0.6;
        sched.push({ at: out, from: u.floor, to: 0, unit: u.id, kind: 'errand_out' });
        sched.push({ at: Math.min(0.98, out + 0.08 + rng.next() * 0.15), from: 0, to: u.floor, unit: u.id, kind: 'errand_in' });
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

    if (p.state === 'waiting') {
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
  const unit = state.units.find((u) => u.id === t.unit);
  state.today.trips++;

  if (!serving.length) {
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

  let best = serving[0], bestQ = Infinity;
  for (const sh of serving) {
    let q = 0;
    for (const p of state.people) if (p.state === 'waiting' && p.shaft === sh.id) q++;
    q /= sh.cars.length;
    if (q < bestQ) { bestQ = q; best = sh; }
  }

  state.people.push({
    id: nid(state), from: t.from, to: t.to, unit: t.unit, kind: t.kind,
    shop: t.shop ?? null, shaft: best.id, carId: null,
    state: 'waiting', waitT: 0, rideT: 0,
  });
}

function resolve(state, p, config, abandoned) {
  const unit = state.units.find((u) => u.id === p.unit);
  const tune = unit ? config.units[unit.kind] : config.units.office;
  const over = Math.max(0, p.waitT - tune.patience);

  state.today.waitTotal += p.waitT;
  if (p.waitT > state.today.waitMax) state.today.waitMax = p.waitT;

  if (abandoned) {
    state.today.abandoned++;
    if (unit) unit.stress += tune.stressPerSec * config.demand.abandonAfter;
    return;
  }

  state.today.delivered++;
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
      unit: p.unit, kind: 'lunch_back',
    });
    state.schedule.sort((a, b) => a.at - b.at);
    // The pointer must not skip the trips we just re-sorted past.
    state.scheduleAt = state.schedule.findIndex((s) => s.at > state.tod);
    if (state.scheduleAt < 0) state.scheduleAt = state.schedule.length;
  }
}
