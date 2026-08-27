import { makeRng } from './rng.js';

/** @typedef {ReturnType<typeof createState>} State */

export function createState(config, seed = 1) {
  return {
    seed,
    rng: makeRng(seed),
    /** Wall-clock seconds simulated. Used by the harness, never by the renderer. */
    elapsed: 0,
    day: 1,
    /** 0..1 through the current day. */
    tod: 0,
    money: config.economy.startMoney,
    floors: config.building.startFloors,
    nextId: 1,
    units: [],
    facilities: [],
    /** Ground-floor entrance; the playable setup places one before the shaft. */
    lobby: null,
    /** Local stairwells, each connecting the lobby to a bounded upper span. */
    stairs: [],
    /** Faster local routes that still occupy a continuous building column. */
    escalators: [],
    rentLevels: Object.fromEntries(Object.keys(config.units).map((kind) => [kind, 0])),
    shafts: [],
    people: [],
    /** Trips already emitted this day, keyed by window, so rushes fire once each. */
    emitted: { morning: 0, lunch: 0, evening: 0 },
    /** Per-day telemetry, rolled into `log` at day close. */
    today: blankDayStats(),
    log: [],
    events: [],
    /** Star-tier rewards are one-time milestones, even if population later falls. */
    starAwards: [],
    over: false,
  };
}

export function blankDayStats() {
  return {
    trips: 0, delivered: 0, abandoned: 0,
    waitTotal: 0, waitMax: 0,
    localTrips: 0, localDelivered: 0, localAbandoned: 0, localWaitTotal: 0, localWaitMax: 0,
    localOverflowSeconds: 0, localOverflowPeak: 0, localOverflowRoutes: [],
    elevatorTrips: 0, elevatorDelivered: 0, elevatorAbandoned: 0, elevatorWaitTotal: 0, elevatorWaitMax: 0,
    rent: 0, shopRevenue: 0, upkeep: 0, serviceUpkeep: 0, spent: 0,
    vacated: 0, vacatedByStress: 0, vacatedByDesirability: 0,
    desirabilityAtRisk: 0, desirabilityRooms: 0, desirabilityPressureTotal: 0,
    movedIn: 0, moveInCandidates: 0, rewards: 0,
  };
}

export const nid = (s) => s.nextId++;

export function population(state) {
  let p = 0;
  for (const u of state.units) if (u.occupied) p += u.heads;
  return p;
}

export function starTier(state, config) {
  const pop = population(state);
  let tier = config.stars.tiers[0];
  for (const t of config.stars.tiers) if (pop >= t.pop) tier = t;
  return tier;
}

export function unlocked(state, config, what) {
  const pop = population(state);
  for (const t of config.stars.tiers) {
    if (pop >= t.pop && t.unlocks.includes(what)) return true;
  }
  return false;
}

/** Slots on `floor` already consumed by units, facilities, lobby, or shafts. */
export function slotsUsed(state, floor) {
  const used = new Set();
  for (const u of state.units) if (u.floor === floor) used.add(u.slot);
  for (const f of state.facilities ?? []) if (f.floor === floor) used.add(f.slot);
  if (state.lobby && floor === 0) {
    const lobbySlots = state.lobby.slots ?? [state.lobby.slot];
    for (const slot of lobbySlots) used.add(slot);
  }
  for (const stair of state.stairs ?? []) {
    if (floor >= stair.bottom && floor <= stair.top) used.add(stair.slot);
  }
  for (const escalator of state.escalators ?? []) {
    if (floor >= escalator.bottom && floor <= escalator.top) used.add(escalator.slot);
  }
  for (const s of state.shafts) if (floor >= s.bottom && floor <= s.top) used.add(s.slot);
  return used;
}

export function freeSlot(state, config, floor) {
  const used = slotsUsed(state, floor);
  for (let i = 0; i < config.building.slotsPerFloor; i++) if (!used.has(i)) return i;
  return -1;
}

/** Shafts that can carry a rider from `a` to `b`. */
export function servingShafts(state, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return state.shafts.filter((s) => s.bottom <= lo && s.top >= hi);
}

export function pushEvent(state, kind, data = {}) {
  // Keep the event type authoritative. Payloads use unitKind/facilityKind so
  // an office event cannot accidentally become an event named "office".
  state.events.push({ ...data, kind, day: state.day, tod: state.tod });
  if (state.events.length > 400) state.events.shift();
}
