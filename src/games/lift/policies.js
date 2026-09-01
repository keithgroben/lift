import { applyAction } from './sim/index.js';
import { basementDepth, lowestFloor, unlocked, slotsUsed } from './sim/state.js';
import { postBetaManagementGoal, servicePlacementCoveragePreview, tenantPlacementFloorPreview } from './sim/evaluation.js';

/**
 * Autoplayers. A headless run needs someone to press the buttons, and the
 * policy IS the hypothesis: each one isolates a different question about the
 * bottleneck. Add policies freely — they are experiments, not game code.
 *
 * decide() runs once per closed day and returns nothing; it acts via applyAction
 * so a headless run and a human run go through the exact same seam.
 */

const act = (state, config, type, extra = {}) =>
  applyAction(state, { type, ...extra }, config);

/**
 * Column planning. The post-express expedition showed towers stuck at ONE
 * express shaft: the sim's freeSlot fills rooms from the left, eating every
 * column a future shaft needs. The naive fix — rooms fill from the RIGHT —
 * bankrupted both seeds by day 41: every room sat maximally far from its
 * shaft, the access penalty gutted evaluations below the re-lease threshold,
 * and vacancy upkeep bled the tower out. Access quality and column
 * discipline are a real spatial tradeoff, so plan instead of shove:
 *
 * Slots 1-2 are the local-shaft pair (adjacent zone locals overlap at the
 * sky-lobby floor, so they alternate columns); slot 2+t is the tier-t
 * express (0 -> t*zoneHeight), reserved only on the floors that express
 * actually passes. Rooms take the lowest UNRESERVED free slot — snug beside
 * the transport core, never squatting on it. Reservations expire with
 * height: above the top sky lobby, express columns become room columns.
 */
function plannedReservedSlots(state, config, floor) {
  const zh = zoneHeight(config);
  const tiers = Math.floor((config.building.maxFloors - 1) / zh);
  const reserved = new Set([1, 2]);
  for (let t = 1; t <= tiers; t++) {
    if (floor <= t * zh) reserved.add(2 + t);
  }
  // One column stays free for capacity TWINS: with locals on 1-2, expresses
  // on 3-4, and rooms everywhere else, round 9 left twins nowhere legal to
  // build and shaft count collapsed to 2 — capacity froze at 14 cars.
  reserved.add(3 + tiers);
  return reserved;
}

function preferredRoomSlot(state, config, floor) {
  const used = slotsUsed(state, floor);
  const reserved = plannedReservedSlots(state, config, floor);
  for (let s = 0; s < config.building.slotsPerFloor; s++) {
    if (!used.has(s) && !reserved.has(s)) return s;
  }
  // No unreserved slot left on this floor. Do NOT fall back to a reserved
  // column: that "graceful" fallback poisoned the shaft columns exactly when
  // the tower was busiest, and the twin/express shafts it blocked were worth
  // more than one extra room. Overflow goes UP (the caller tries the next
  // floor), not sideways into the transport core.
  return null;
}

/**
 * Floors are a purchase now — `building.startFloors` is 0 so a human session
 * opens on bare ground and buys the lobby first (spec/tower-view.md §4). A
 * headless run has no such opening move, and a shaft cannot span a tower with
 * no storeys, so every policy buys the four it used to be handed. Keeping the
 * number here rather than reading startFloors is deliberate: the opening a
 * sweep is measuring should not move when the human opening does.
 */
function ensureOpeningFloors(state, config, floors = 4) {
  while (state.floors < floors) {
    if (!act(state, config, 'build_floor').ok) return;
  }
}

/**
 * Every policy opens the same way, so runs are comparable. Claims a few
 * shaft columns up front, before any room construction can fill them — a
 * shaft needs a clear column from the lobby to wherever it reaches, and once
 * rooms have taken every column there is no adding a second one later at any
 * height. Reserving them early is what actually lets a tower grow past
 * maxCarsPerShaft instead of getting stuck there.
 */
function opening(state, config, shaftCount = 3) {
  ensureOpeningFloors(state, config);
  for (let i = 0; i < shaftCount; i++) act(state, config, 'build_shaft', { bottom: 0, top: state.floors - 1 });
  // Bottom up: a room on floor 3 needs floor 2 under it, so filling storeys in
  // order is the only sequence that gets a tower off the ground.
  for (let f = 1; f < state.floors; f++) act(state, config, 'build_unit', { kind: 'office', floor: f });
}

/** Keep every shaft tall enough that nobody above it is ever stranded. */
function keepShaftTall(state, config) {
  for (const sh of state.shafts) {
    if (sh.top < state.floors - 1) act(state, config, 'extend_shaft', { id: sh.id, top: state.floors - 1 });
  }
}

/**
 * N-tier zoning instead of one shaft stretched to whatever height the tower
 * has reached: each zone gets its own local bank, and every zone past the
 * first gets its own express shaft running straight from the lobby to that
 * zone's sky lobby (not chained through the zones below it) — so any trip
 * needs at most one transfer no matter how tall the tower gets, the same
 * way a real building stacks several independent express bands rather than
 * relaying riders through every sky lobby beneath the one they actually
 * want. A single shaft spanning the whole building pays the "many stops,
 * long climb" RTT cost on every trip regardless of where it's actually
 * going — splitting into zones is what keeps each shaft's own round trip
 * short.
 */
function zoneHeight(config) {
  return Math.max(4, config.elevator.zoneHeight ?? 12);
}

/** Zoned equivalent of `opening()` — the shared one always claims full-height
 * local shafts, which is exactly what zoning is meant to avoid building. */
function zonedOpening(state, config) {
  ensureOpeningFloors(state, config);
  manageZones(state, config);
  for (let f = 1; f < state.floors; f++) {
    act(state, config, 'build_unit', { kind: 'office', floor: f, slot: preferredRoomSlot(state, config, f) ?? undefined });
  }
}

/**
 * Reach for the next sky lobby. Ordinary floor growth follows occupancy,
 * which stalls a healthy tower just below the zone boundary forever — the
 * upper zone's demand cannot exist until the upper zone does. When the
 * built tower is genuinely thriving (mostly occupied, cash above reserve),
 * spend one floor a day climbing toward the boundary so zone N+1 and its
 * express can come into existence.
 */
function pushTowardNextZone(state, config, reserve) {
  const zh = zoneHeight(config);
  const boundary = (Math.floor((state.floors - 1) / zh) + 1) * zh;
  if (boundary >= config.building.maxFloors) return;
  const occupied = state.units.filter((u) => u.occupied).length;
  // "Thriving" must mean BUILT OUT, not merely occupied: a 3-room tower is
  // 100% occupied and gating on that ratio alone made this function a
  // runaway floor-spender that starved room construction forever (the
  // round-6 relapse of the 3-room deadlock). Reach for the next sky lobby
  // only when the floors that already exist are substantially full of
  // rooms AND those rooms are substantially tenanted.
  // Thresholds are 0.5, not 0.7: grow() keeps floors ~6 ahead of occupancy,
  // so the built-out ratio structurally tops out near 0.66 — a 0.7 gate can
  // never fire — and tenant churn keeps healthy towers only ~50-70% leased.
  // 0.5 still rejects the degenerate opening (3 rooms vs 50+ needed).
  const roomsPerFloor = Math.max(1, config.building.slotsPerFloor - plannedReservedSlots(state, config, 1).size);
  const builtOut = state.units.length >= 0.45 * (state.floors - 1) * roomsPerFloor;
  if (!builtOut) return;
  if (!state.units.length || occupied / state.units.length < 0.5) return;
  if (state.money - config.costs.floor < reserve) return;
  act(state, config, 'build_floor', {});
}

function manageZones(state, config) {
  const zh = zoneHeight(config);
  const top = state.floors - 1;
  const tierCount = Math.floor(top / zh) + 1;

  for (let tier = 0; tier < tierCount; tier++) {
    const zoneBottom = tier * zh;
    const zoneTop = Math.min(top, zoneBottom + zh);
    if (zoneTop <= zoneBottom) continue;

    const local = state.shafts.find((sh) => sh.kind !== 'express' && sh.bottom === zoneBottom);
    // Locals alternate the two reserved core columns; expresses each get the
    // planned column for their tier (see plannedReservedSlots). If the
    // planned column is somehow blocked, fall back to first-clear rather
    // than not building at all.
    if (!local) {
      const plannedLocal = 1 + (tier % 2);
      if (!act(state, config, 'build_shaft', { bottom: zoneBottom, top: zoneTop, slot: plannedLocal }).ok) {
        act(state, config, 'build_shaft', { bottom: zoneBottom, top: zoneTop });
      }
    } else if (local.top < zoneTop) act(state, config, 'extend_shaft', { id: local.id, top: zoneTop });

    if (tier === 0) continue;
    const hasExpress = state.shafts.some((sh) => sh.kind === 'express' && sh.bottom === 0 && sh.top === zoneBottom);
    if (!hasExpress) {
      if (!act(state, config, 'build_shaft', { bottom: 0, top: zoneBottom, kind: 'express', slot: 2 + tier }).ok) {
        act(state, config, 'build_shaft', { bottom: 0, top: zoneBottom, kind: 'express' });
      }
    }
  }
}

/**
 * Add a car to whichever shaft has room; if every shaft is already at
 * maxCarsPerShaft, open a new one. Every shaft must start at the lobby
 * (floor 0) or nobody arriving through the front door can reach the floors
 * it serves, so a fallback shaft only ever shrinks how high it reaches, not
 * where it starts — a lobby-to-a-lower-floor shaft still moves people, a
 * floating one above the lobby cannot.
 */
function addTransportCapacity(state, config, roomsPerCar, avoidSlots = null) {
  // Every occupied room generates trips, not just offices — once the tower
  // mixes in condos/shops/hotels, sizing capacity off office count alone
  // would under-provision transport for everyone else living there.
  const occupiedRooms = state.units.filter((u) => u.occupied).length;
  const cars = state.shafts.reduce((n, sh) => n + sh.cars.length, 0);
  if (occupiedRooms / Math.max(1, cars) <= roomsPerCar) return;
  for (const sh of state.shafts) {
    if (act(state, config, 'add_car', { id: sh.id }).ok) return;
  }
  // Every existing shaft is already at maxCarsPerShaft. A zone that has
  // outgrown its shaft needs a SECOND shaft serving that same span — not a
  // shaft reaching some other height — or the zone's throughput stays
  // frozen at one shaft's ceiling for good regardless of how much its own
  // population keeps growing. Try twinning each distinct span/kind already
  // in use before falling back to a generic new one. Twins search columns
  // right-to-left and NEVER take a slot the caller marked reserved — a twin
  // squatting a planned express column costs the tower its future express,
  // which is worth more than any twin (the round-5 lesson).
  const seen = new Set();
  for (const sh of state.shafts) {
    const key = sh.kind + ':' + sh.bottom + '-' + sh.top;
    if (seen.has(key)) continue;
    seen.add(key);
    for (let s = config.building.slotsPerFloor - 1; s >= 0; s--) {
      if (avoidSlots?.has(s)) continue;
      if (act(state, config, 'build_shaft', { bottom: sh.bottom, top: sh.top, kind: sh.kind, slot: s }).ok) return;
    }
  }
  const top = state.floors - 1;
  for (let reach = top; reach >= 2; reach -= 1) {
    // The last-resort shaft must honor the same protected columns as the
    // twins above — unslotted, it grabbed the first clear column, which was
    // always the express column the whole plan existed to keep clear.
    for (let s = config.building.slotsPerFloor - 1; s >= 0; s--) {
      if (avoidSlots?.has(s)) continue;
      if (act(state, config, 'build_shaft', { bottom: 0, top: reach, slot: s }).ok) return;
    }
  }
}

/**
 * Pick whichever unlocked room kind is furthest below its targetShare of
 * BUILT capacity (occupied and vacant alike). A tower that only ever builds
 * offices caps its own demand once it is well past office's targetShare —
 * condos, shops, and hotels exist for exactly this, and just building them
 * is most of what "mixed-use" means. Built rather than occupied on purpose:
 * occupancy swings with every transport-driven vacancy wave (a whole kind
 * can crash and recover within days — see towerIsHealthy's own comment),
 * and reacting to that noise once made a kind that was simply mid-crash
 * look underrepresented, recommending more of whatever kind happened to be
 * fully leased at that exact moment instead of the kind actually short of
 * its target share.
 */
function pickRoomKind(state, config) {
  let totalHeads = 0;
  const kindHeads = {};
  for (const u of state.units) {
    const heads = u.heads ?? 0;
    totalHeads += heads;
    kindHeads[u.kind] = (kindHeads[u.kind] ?? 0) + heads;
  }
  let best = 'office', bestGap = -Infinity;
  for (const kind of Object.keys(config.units)) {
    const target = config.units[kind].targetShare ?? 0;
    if (target <= 0 || !unlocked(state, config, kind)) continue;
    const actual = totalHeads ? (kindHeads[kind] ?? 0) / totalHeads : 0;
    const gap = target - actual;
    if (gap > bestGap) { bestGap = gap; best = kind; }
  }
  return best;
}

/**
 * True once there is enough history to judge, and the last 3 days were all
 * healthy: good reputation, good delivery, and nobody evicted by transport
 * stress. "managed" builds at a fixed pace regardless of how the tower is
 * actually doing, which is exactly how it overshoots into a stress-eviction
 * wave — it reaches a taller peak population fast, then crashes to a lower
 * one it can hold. Pacing new ROOMS (not floors — those are cheap structure
 * and having them ready is what lets a recovered tower resume growing
 * immediately) to actual health is what turns a peak into a floor.
 */
function towerIsHealthy(state) {
  const recent = state.log.slice(-5);
  if (recent.length < 5) return true;
  const avg = (key) => recent.reduce((sum, d) => sum + (d[key] ?? 0), 0) / recent.length;
  return avg('rep') >= 55 && avg('deliveryRate') >= 55 && avg('vacatedByStress') <= 2;
}

/**
 * Add floors and fill them with rooms whenever cash allows. Floors stay a
 * little ahead of built rooms instead of maxing one floor out before the
 * next is even started: floors are cheap structure, rooms are what the
 * vacancy gate paces, and a tower that insists on filling each floor solid
 * before rising never grows taller than one floor's slice of that gate.
 * `healthGate`, when given, must pass before a new ROOM (not floor) is
 * built — see towerIsHealthy. `headroomFloors` defaults to a token lead,
 * enough for a policy that only ever needs one shaft tier; a zoned policy
 * needs to pass a bigger one, because floors built only as far ahead as
 * current demand justifies never reach a zone boundary on their own —
 * demand for the upper zone cannot exist before the upper zone's shafts do,
 * so nothing ever pushes floors past the first zone without an explicit
 * push here.
 */
function grow(state, config, reserve = 0, healthGate = null, headroomFloors = 2, pickSlot = null) {
  let guard = 0;
  // Rooms per floor: under a column plan, reservations claim low-zone columns
  // whether or not the shafts exist yet (overestimating this froze floor
  // growth at 17 — below the first sky lobby). Without a plan, the original
  // slots-minus-shafts guess stands. Column planning is a POLICY hypothesis,
  // passed in — giving it to every policy for free once made naive survive
  // 10x longer and broke the knowing-beats-ignoring invariant.
  const room = pickSlot
    ? Math.max(1, config.building.slotsPerFloor - plannedReservedSlots(state, config, 1).size)
    : Math.max(1, config.building.slotsPerFloor - state.shafts.length);
  while (guard++ < 8) {
    // Sized off a recent PEAK of occupied rooms, not today's snapshot: a
    // tower with covered services still cycles tenants in and out (a slower
    // rhythm than daily noise, but a rhythm), and gating on today's count
    // alone means a trough day freezes floor growth even with cash sitting
    // idle, forever mistaking a cycle's low point for a ceiling.
    const recentOccupied = state.log.slice(-10).map((d) => d.occupied ?? 0);
    const peakOccupied = Math.max(state.units.filter((u) => u.occupied).length, ...recentOccupied, 0);
    const occupiedFloors = Math.ceil(peakOccupied / room);
    if (state.floors - 1 < occupiedFloors + headroomFloors) {
      if (state.money - config.costs.floor >= reserve && act(state, config, 'build_floor', {}).ok) continue;
      // Can't raise a floor right now. Fall through to room-building instead
      // of freezing: with zoneHeight 20 the headroom goal is 22 floors, and
      // returning here deadlocked the tower at 3 rooms — no rooms, no rent,
      // no money for floors, ever. Rooms fund the floors that come later.
    }
    if (healthGate && !healthGate(state)) return;
    const kind = pickRoomKind(state, config);
    if (state.money - config.costs[kind] < reserve) return;
    // Counting units alone assumes a floor's only occupant is offices, but
    // service facilities share the same slots — a floor that looks open by
    // unit count can still be genuinely full. Try floors in order and move
    // on past one that rejects the placement, instead of treating any single
    // floor's rejection as a reason to stop building for the whole day.
    let built = false;
    for (let f = 1; f < state.floors; f++) {
      const slot = pickSlot ? pickSlot(state, config, f) : undefined;
      if (pickSlot && slot == null) continue;
      const r = act(state, config, 'build_unit', { kind, floor: f, slot });
      if (r.ok) { built = true; break; }
      if (r.reason === 'too many vacant rooms already — let existing space fill before building more') return;
    }
    if (!built) return;
  }
}

/**
 * A mixed-use tower has more than one uncovered service need at once
 * (office/condo/shop/hotel each want different coverage), and the
 * recommendation is only ever the single largest gap — closing one a day is
 * fine for a small tower but falls behind a fast-diversifying one, so keep
 * taking the next-largest gap until none is left.
 */
function closeServiceGaps(state, config, pickSlot = null, undergroundFirst = false) {
  for (let i = 0; i < 5; i++) {
    const goal = postBetaManagementGoal(state, config);
    if (!goal?.action || goal.recommendedFloor == null) break;
    if (undergroundFirst && placeServiceUnderground(state, config, goal.action)) continue;
    // Under a column plan, a full recommended floor means "try a neighbor
    // inside the coverage radius", never "let the sim pick a slot" (that
    // parked garages in the express column) and never "skip the service"
    // (that collapsed coverage, then appeal, then occupancy — round 11's
    // beautiful empty shells).
    const radius = config.services?.[goal.action]?.coverageFloors ?? 0;
    let placed = false;
    for (let d = 0; d <= radius && !placed; d++) {
      const floors = d === 0 ? [goal.recommendedFloor] : [goal.recommendedFloor + d, goal.recommendedFloor - d];
      for (const floor of floors) {
        if (floor < 1 || floor >= state.floors) continue;
        const slot = pickSlot ? pickSlot(state, config, floor) : undefined;
        if (pickSlot && slot == null) continue;
        if (act(state, config, 'build_facility', { kind: goal.action, floor, slot }).ok) { placed = true; break; }
      }
    }
    if (!placed) break;
  }
}

/**
 * Basements, as a hypothesis. Digging is only worth it if the pure-overhead
 * facilities move down there and give their above-ground slots back to
 * rentable rooms — so these three helpers do exactly that and nothing else,
 * and the sweep decides whether it pays.
 */

/**
 * Dig one storey, but never ahead of use: the deepest basement must already
 * hold something before another is sunk. An empty hole is floor upkeep with
 * no coverage, which would make digging look bad for a reason that has
 * nothing to do with the tradeoff being measured.
 */
function digBasements(state, config, reserve) {
  const maxDepth = Math.max(0, Number(config.underground?.maxDepth) || 0);
  if (basementDepth(state) >= maxDepth) return;
  if (state.money - (Number(config.underground?.digCost) || 0) < reserve) return;
  const deepest = lowestFloor(state);
  const inUse = deepest === 0
    || (state.facilities ?? []).some((f) => f.floor === deepest)
    || state.units.some((u) => u.floor === deepest);
  if (!inUse) return;
  act(state, config, 'dig_basement', {});
}

/**
 * Transport has to reach them or they are as dead as an unserved 40th floor.
 * One dedicated shaft from the deepest basement up to the lobby, extended
 * DOWN as the tower digs: basement trips transfer at floor 0 exactly the way
 * a sky lobby works, so this never fights the zone locals for a column all
 * the way up the building.
 */
function serveBasements(state, config) {
  const bottom = lowestFloor(state);
  if (bottom >= 0) return;
  const shaft = state.shafts.find((sh) => sh.kind !== 'express' && sh.top === 0);
  if (!shaft) { act(state, config, 'build_shaft', { bottom, top: 0 }); return; }
  if (shaft.bottom > bottom) act(state, config, 'extend_shaft', { id: shaft.id, bottom });
}

/**
 * Rent the basements out, but only where a tenant would actually take the
 * room. The appeal penalty is the entire question: at a low one a basement
 * office is simply free rentable space and the tower gets bigger for nothing,
 * at a high one it never leases and the space is worth more as plant. Asking
 * the game's own placement preview — the same score the leasing gate uses —
 * is what turns that penalty into a curve a sweep can read.
 */
function fillBasements(state, config, reserve) {
  const kind = pickRoomKind(state, config);
  if (state.money - config.costs[kind] < reserve) return;
  for (let floor = -1; floor >= lowestFloor(state); floor--) {
    const preview = tenantPlacementFloorPreview(state, kind, floor, config);
    if (!preview.available) continue;
    if ((preview.evaluation?.score ?? 0) < config.evaluation.relistMinScore) continue;
    if (act(state, config, 'build_unit', { kind, floor, slot: preview.slot }).ok) return;
  }
}

/**
 * Put the service underground when it actually covers rooms there. The
 * coverage preview is the authority, not the depth: a garage that reaches
 * nobody is worse than one squatting a rentable slot. Shallowest first, so
 * the reach into the basements themselves stays as good as it can be.
 */
function placeServiceUnderground(state, config, kind) {
  for (let floor = -1; floor >= lowestFloor(state); floor--) {
    const preview = servicePlacementCoveragePreview(state, kind, floor, config);
    if (!preview.available || preview.roomsDelta <= 0) continue;
    if (act(state, config, 'build_facility', { kind, floor }).ok) return true;
  }
  return false;
}

export const POLICIES = {
  /**
   * H1: throughput is the wall. Builds relentlessly, extends the shaft so no
   * trip is ever unservable, but NEVER buys another car. If wait time goes
   * vertical here and nowhere else, the bottleneck is real.
   */
  naive: {
    name: 'naive (never adds cars)',
    open: opening,
    decide(state, config) { grow(state, config); keepShaftTall(state, config); },
  },

  /**
   * H2: reacting late still loses. Waits for pain, then buys capacity.
   * Measures how much runway you get from a purely reactive read.
   */
  reactive: {
    name: 'reactive (buys on pain)',
    open: opening,
    decide(state, config) {
      const d = state.log[state.log.length - 1];
      if (d && d.avgWait > config.units.office.patience * 1.5) {
        const sh = state.shafts[0];
        if (sh && !act(state, config, 'add_car', { id: sh.id }).ok) {
          act(state, config, 'build_shaft', { bottom: 0, top: state.floors - 1 });
        }
      }
      grow(state, config, config.costs.car);
      keepShaftTall(state, config);
    },
  },

  /**
   * H3: there is a servable ratio. Holds cars-per-occupied-office at a fixed
   * target. If this one stays flat forever, the game has no wall and needs a
   * new pressure — that is a design failure the sim can prove cheaply.
   */
  balanced: {
    name: 'balanced (holds a cars:offices ratio)',
    officesPerCar: 4,
    open: opening,
    decide(state, config) {
      addTransportCapacity(state, config, this.officesPerCar);
      grow(state, config, config.costs.car * 2);
      keepShaftTall(state, config);
    },
  },

  /**
   * H4: services close the loop. Same car discipline as "balanced", but also
   * follows the game's own service recommendation each day. "balanced" alone
   * still stalls into a permanent move-in/desirability-vacate cycle once
   * uncovered service needs cap room appeal — this tests whether closing that
   * gap is enough for a tower to hold, not just survive the elevator math.
   */
  managed: {
    name: 'managed (adds cars + follows service goal)',
    // A tighter ratio than "balanced" uses: once a tower has real height,
    // a car's throughput is spent on travel distance as much as stops, so a
    // room-count ratio tuned for a short building runs mass stress-evictions
    // even while technically "ahead of the ratio" by ignoring how tall the
    // building is.
    officesPerCar: 2,
    open: opening,
    decide(state, config) {
      addTransportCapacity(state, config, this.officesPerCar);
      closeServiceGaps(state, config);
      grow(state, config, config.costs.car * 2);
      keepShaftTall(state, config);
    },
  },

  /**
   * H5: growing carefully beats growing fast. "managed" reaches the tallest
   * peak of any policy here, then crashes down to a much shorter one it can
   * actually hold — a stress-eviction wave from building faster than the
   * tower could digest new tenants. Same car and service discipline, but
   * room construction pauses whenever the last 3 days weren't healthy
   * (see towerIsHealthy) instead of building at a fixed pace regardless of
   * how the tower is actually doing. The question this answers: is the
   * "managed" peak a real ceiling, or just an overshoot nobody let recover
   * before piling on more?
   */
  skyscraper: {
    name: 'skyscraper (paces growth to tower health)',
    // Tighter than "managed": a tower this tall spends more of a car's
    // throughput on travel distance, so the same nominal ratio serves fewer
    // people the taller the building gets.
    officesPerCar: 1.5,
    open: zonedOpening,
    decide(state, config) {
      // The express columns (2+t per tier) are sacred: twins must not take
      // them, or the zone above never gets its shuttle.
      const zh = zoneHeight(config);
      const tiers = Math.floor((config.building.maxFloors - 1) / zh);
      const expressColumns = new Set(Array.from({ length: tiers }, (_, i) => 3 + i));
      addTransportCapacity(state, config, this.officesPerCar, expressColumns);
      // Rooms before services: rooms are the only income, and facilities are
      // not reserve-gated — buying them first starved growth at 3 rooms for
      // 400 days while floors and upkeep compounded (the day-386 bankruptcy).
      // Headroom is a modest fixed lead, NOT zoneHeight+2: with 20-floor
      // zones that demanded 23 floors before the first extra room, a goal no
      // 3-office economy can pre-fund. Zone boundaries are reached by
      // occupancy growth pushing floors up — plus pushTowardNextZone's
      // deliberate reach when the tower below is thriving.
      grow(state, config, config.costs.car * 3, towerIsHealthy, 6, preferredRoomSlot);
      pushTowardNextZone(state, config, config.costs.car * 3);
      closeServiceGaps(state, config, preferredRoomSlot);
      manageZones(state, config);
    },
  },

  /**
   * H6: does digging pay? Identical to "skyscraper" in every above-ground
   * respect — same ratio, same zoning, same health gate — so any difference
   * in the sweep is the underground decision and nothing else. It digs B1..Bn
   * as it fills them, runs one shaft down from the lobby, and sends every
   * pure-overhead facility below ground wherever that still covers rooms,
   * freeing the above-ground slots those garages and plant rooms were taking
   * from rentable space. If this never beats "skyscraper", the basement is
   * decoration.
   */
  underground: {
    name: 'underground (digs; services go below ground)',
    officesPerCar: 1.5,
    open: zonedOpening,
    decide(state, config) {
      const zh = zoneHeight(config);
      const tiers = Math.floor((config.building.maxFloors - 1) / zh);
      const expressColumns = new Set(Array.from({ length: tiers }, (_, i) => 3 + i));
      addTransportCapacity(state, config, this.officesPerCar, expressColumns);
      grow(state, config, config.costs.car * 3, towerIsHealthy, 6, preferredRoomSlot);
      pushTowardNextZone(state, config, config.costs.car * 3);
      digBasements(state, config, config.costs.car * 3);
      serveBasements(state, config);
      closeServiceGaps(state, config, preferredRoomSlot, true);
      fillBasements(state, config, config.costs.car * 3);
      manageZones(state, config);
    },
  },
};
