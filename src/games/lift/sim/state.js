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
    /**
     * The bottom of the world. The tower is a floor RANGE, `lowestFloor ..
     * floors - 1`, not a count with 0 pinned at the bottom — digging moves
     * this negative (B1 is -1). 0 until `dig_basement` is used, so a tower
     * that never digs behaves exactly as it did before basements existed.
     */
    lowestFloor: 0,
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

/**
 * The floor range. `state.floors` stays the count of storeys ABOVE ground
 * (indices 0 .. floors-1) so every existing reading of it is unchanged; the
 * bottom of the world moved from an implied 0 to `state.lowestFloor`, which
 * is <= 0. These five helpers are the only places that knowledge lives —
 * nothing in the sim should ever write `floor < 0` as a special case, and
 * nothing outside them should assume 0 is the bottom.
 *
 * A missing `lowestFloor` reads as 0 on purpose: tests and the lab build
 * partial states by hand, and an undug tower is exactly the old world.
 */
export const lowestFloor = (state) => state?.lowestFloor ?? 0;

/** How far the tower has dug, in floors. B3 -> 3. */
export const basementDepth = (state) => -lowestFloor(state);

/** Storeys built, below ground and above. This is what upkeep is charged on. */
export const totalFloors = (state) => (state?.floors ?? 0) - lowestFloor(state);

/** Below the ground line. The one place the sign of a floor index is read. */
export const isUnderground = (floor) => floor < 0;

/**
 * Every floor a room or facility may occupy, ascending: basements first,
 * then the floors above the lobby. The lobby's own floor is excluded because
 * it is the entrance, not lettable space — the same rule the old
 * `1 .. floors-1` enumerations encoded, now stated once.
 */
export function buildableFloors(state, config) {
  const lobbyFloor = config?.building?.lobbyFloor ?? 0;
  const out = [];
  for (let f = lowestFloor(state); f < (state?.floors ?? 0); f++) {
    if (f !== lobbyFloor) out.push(f);
  }
  return out;
}

export function isBuildableFloor(state, floor, config) {
  const lobbyFloor = config?.building?.lobbyFloor ?? 0;
  return Number.isInteger(floor) && floor !== lobbyFloor
    && floor >= lowestFloor(state) && floor < (state?.floors ?? 0);
}

/**
 * Build cost for something placed on `floor`. Underground slots are cheaper
 * to sink than to raise — that discount, against the appeal penalty in
 * `unitEvaluation`, is what makes digging a decision instead of free space.
 */
export function floorCost(config, floor, cost) {
  if (!isUnderground(floor)) return cost;
  const multiplier = Number(config?.underground?.buildCostMultiplier);
  return Math.round(cost * (Number.isFinite(multiplier) ? multiplier : 1));
}

/**
 * Per-tenant departure jitter, drawn at the moment a room becomes occupied.
 * Desynchronizes the mass exodus (spec/lift-vision.md, boom-bust dampers):
 * with jitter, marginal tenants leave as a visible leak instead of a
 * synchronized cliff. The rng stream is consumed ONLY when a knob is on, so
 * existing seeds replay identically with the dampers off.
 */
export function assignTenantJitter(state, unit, config) {
  const range = Math.max(0, Number(config.occupancy?.vacateJitterRange) || 0);
  const graceDays = Math.max(0, Math.floor(Number(config.occupancy?.graceJitterDays) || 0));
  unit.vacateJitter = range > 0 ? 1 + (state.rng.next() * 2 - 1) * range : 1;
  unit.graceJitter = graceDays > 0 ? state.rng.int(graceDays + 1) : 0;
}

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

/**
 * Is anything standing in this cell? Rooms, facilities, the lobby, and any
 * transport column passing through it all count as built.
 */
export function cellBuilt(state, floor, slot) {
  return slotsUsed(state, floor).has(slot);
}

/**
 * **A room has to rest on something.** Keith's ruling, 2026-09-01, looking at
 * a tower whose offices climbed the screen in a diagonal staircase with open
 * air underneath each one: "you build the lobby, then you can only build on
 * top of the lobby — you can only build another floor on top of existing
 * structure."
 *
 * The mistake that produced that picture was checking the wrong thing. The
 * rule was written at STOREY granularity — "the floor index exists, so build
 * away" — when support is a property of a CELL. A storey being open for
 * business says nothing about whether that particular slot has anything
 * holding it up.
 *
 * A cell is legal to build in when the cell **directly beneath it** is built.
 * That is the whole rule.
 *
 * It first shipped with a second clause — a neighbour on the same storey would
 * do — meant to let a tower widen as it rose. It let rooms cantilever instead:
 * Keith, on the next screenshot, "we still have the floating room on the 4th
 * floor." He was right. A room whose only support is the room beside it is
 * hanging over open air, and no amount of transitive anchoring makes that look
 * like a building. A tower widens by being built wider from the ground up,
 * which is how a real one does it.
 */
export function isSupported(state, floor, slot, config) {
  const ground = config?.building?.lobbyFloor ?? 0;
  if (!Number.isInteger(floor) || !Number.isInteger(slot)) return false;
  if (floor === ground) return true;               // the ground rests on the ground

  // Underground digs downward, so "beneath" is the cell ABOVE for a basement:
  // a basement hangs off the storey over it, which is the direction it was
  // excavated from.
  const beneath = floor > ground ? floor - 1 : floor + 1;
  // The storey immediately on the ground stands on the ground itself — a
  // building spreads along its street before it climbs. Everything above that
  // has to stack.
  if (beneath === ground) return (state?.floors ?? 0) > ground;
  return cellBuilt(state, beneath, slot);
}

/**
 * The cell that RESTS on `(floor, slot)` and would be left hanging in air if
 * it were taken away — or null if nothing does.
 *
 * This is the exact mirror of `isSupported`, and it lives here beside it for
 * one reason: demolition must not invent a second, disagreeing idea of what
 * holds a building up. Every removal asks this one question.
 *
 * Nothing depends on a cell on the GROUND storey, because nothing rests on it:
 * `isSupported` puts the first storey up and the first basement down on the
 * ground itself, not on a particular column. That is why a lobby segment can
 * always come out, however tall the tower above it — which reads oddly until
 * you notice it is the same rule that lets a tower be built wider than its
 * entrance in the first place.
 */
export function dependentCell(state, floor, slot, config) {
  const ground = config?.building?.lobbyFloor ?? 0;
  if (!Number.isInteger(floor) || !Number.isInteger(slot)) return null;
  if (floor === ground) return null;
  // Up above the ground, down below it: a basement hangs off the storey over
  // it, so the cell depending on it is the one deeper down.
  const dependent = floor > ground ? floor + 1 : floor - 1;
  return cellBuilt(state, dependent, slot) ? { floor: dependent, slot } : null;
}

/**
 * The same question for a column that occupies a whole span — a shaft, a
 * stairwell, an escalator. Only the cells OUTSIDE the span can be stranded by
 * removing it; the ones inside are going away with it.
 */
export function spanDependents(state, slot, bottom, top, config) {
  const ends = [dependentCell(state, top, slot, config), dependentCell(state, bottom, slot, config)];
  return ends.filter((cell) => cell && (cell.floor > top || cell.floor < bottom));
}

/** `F6`, or `B2` for a basement. The one place a floor index becomes a name. */
export const floorLabel = (floor) => (isUnderground(floor) ? 'B' + -floor : 'F' + floor);

export function freeSlot(state, config, floor) {
  const used = slotsUsed(state, floor);
  for (let i = 0; i < config.building.slotsPerFloor; i++) if (!used.has(i)) return i;
  return -1;
}

/**
 * The first free slot on this storey that something is actually holding up.
 *
 * This is what a caller means when it says "put an office on floor 6" without
 * naming a column: the tower picks a spot, and every spot the tower picks has
 * to obey the same physics a player's click does. Falls back to -1 rather than
 * to an unsupported slot — a storey with nothing under any of its free columns
 * is genuinely full, however much empty grid it shows.
 */
export function freeSupportedSlot(state, config, floor) {
  const used = slotsUsed(state, floor);
  for (let i = 0; i < config.building.slotsPerFloor; i++) {
    if (!used.has(i) && isSupported(state, floor, i, config)) return i;
  }
  return -1;
}

/**
 * Shafts that can carry a rider from `a` to `b` directly, in one leg. An
 * express shaft only stops at its own bottom and top — anything it spans
 * without landing on doesn't count as served, the whole point of one is to
 * skip those floors.
 */
export function servingShafts(state, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return state.shafts.filter((s) => {
    if (s.bottom > lo || s.top < hi) return false;
    if (s.kind === 'express') return s.bottom === lo && s.top === hi;
    return true;
  });
}

/**
 * A route from `a` to `b` via any chain of sky-lobby transfers, up to
 * `maxHops` legs. Transfer floors are restricted to an existing shaft's own
 * endpoint — that is what makes a floor a deliberate sky lobby rather than
 * an arbitrary stop, matching how a player actually builds one (a shaft
 * ending where the next one begins). A tower with three zones needs two
 * transfers to reach its top zone from the lobby; capping local-shaft-only
 * single-tier towers at one hop would make a second sky lobby pointless.
 *
 * Returns the floor sequence [a, X1, X2, ..., b], or null if no chain
 * within maxHops connects them. Breadth-first, so the result uses the
 * fewest transfers possible — not exhaustive route-scoring, just enough to
 * make a well-placed chain of sky lobbies actually work.
 */
export function multiHopRoute(state, a, b, maxHops = 3) {
  if (servingShafts(state, a, b).length) return [a, b];
  const nodes = new Set([a, b]);
  for (const s of state.shafts) { nodes.add(s.bottom); nodes.add(s.top); }

  const visited = new Set([a]);
  let frontier = [[a]];
  for (let hop = 0; hop < maxHops; hop++) {
    const next = [];
    for (const path of frontier) {
      const last = path[path.length - 1];
      for (const floor of nodes) {
        if (floor === last || visited.has(floor)) continue;
        if (!servingShafts(state, last, floor).length) continue;
        const extended = [...path, floor];
        if (floor === b) return extended;
        visited.add(floor);
        next.push(extended);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}

export function pushEvent(state, kind, data = {}) {
  // Keep the event type authoritative. Payloads use unitKind/facilityKind so
  // an office event cannot accidentally become an event named "office".
  state.events.push({ ...data, kind, day: state.day, tod: state.tod });
  if (state.events.length > 400) state.events.shift();
}
