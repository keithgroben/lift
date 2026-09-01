/**
 * Fixture helpers for a tower that has to stand up, and for rooms that arrive
 * empty. Two sim rules landed together and between them they invalidate the
 * way most of these fixtures used to be written.
 *
 *  - `isSupported` (sim/state.js) wants the cell DIRECTLY BENEATH a room to be
 *    built. No cantilevers, no leaning on the room next door. Anything above
 *    the first storey needs a column under it, in its own slot.
 *  - `build_unit` hands over an EMPTY room. Tenants arrive only through
 *    `leasingForecast` at day close, which asks whether anybody can reach the
 *    room at all — a room with no transport scores 0 and stays empty.
 *
 * Not named `*.test.js`, so the runner does not treat it as a suite.
 */
import { applyAction } from '../src/games/lift/sim/index.js';
import { assignTenantJitter, cellBuilt } from '../src/games/lift/sim/state.js';

/**
 * Stack the column that holds up `floor` in `slot`: one room per storey from
 * the first (which stands on the ground) up to `floor - 1`.
 *
 * The column is left VACANT, which is what `build_unit` now produces anyway
 * and is the quietest thing a fixture can put under its subject: an empty room
 * emits no noise (`unitNoise` reads occupied units only), holds no heads, and
 * pays no rent. It is still structure — the tower is genuinely wider at the
 * bottom than at the top, which is the whole point of the rule.
 *
 * Storeys the caller has already filled in that column are left alone, so a
 * fixture can place its own room low down and then stack the rest around it.
 *
 * Returns the slot, so a caller can pass it straight to its own build.
 */
export function columnTo(state, config, floor, slot = 0, kind = 'office') {
  // A basement hangs off the storey above it, so a column downwards is dug in
  // the opposite order and stops one short of the target in the same way.
  const step = floor < 0 ? -1 : 1;
  for (let f = step; f !== floor; f += step) {
    if (cellBuilt(state, f, slot)) continue;
    const built = applyAction(state, { type: 'build_unit', kind, floor: f, slot }, config);
    if (!built.ok) throw new Error(`could not stack support at F${f}s${slot}: ${built.reason}`);
  }
  return slot;
}

/**
 * The same column, built out of service facilities instead of rooms. Useful
 * where a fixture counts units, or where the vacancy backlog would otherwise
 * stop it building — a facility is structure without being a lettable room.
 * Pick the service the fixture under test does not measure.
 */
export function facilityColumnTo(state, config, floor, slot = 0, kind = 'parking') {
  for (let f = 1; f < floor; f++) {
    if (cellBuilt(state, f, slot)) continue;
    const built = applyAction(state, { type: 'build_facility', kind, floor: f, slot }, config);
    if (!built.ok) throw new Error(`could not stack support at F${f}s${slot}: ${built.reason}`);
  }
  return slot;
}

/** Stack the support column, then put the room the fixture actually wants on top of it. */
export function roomOn(state, config, kind, floor, slot = 0) {
  columnTo(state, config, floor, slot);
  const built = applyAction(state, { type: 'build_unit', kind, floor, slot }, config);
  if (!built.ok) throw new Error(`could not place ${kind} at F${floor}s${slot}: ${built.reason}`);
  return state.units.at(-1);
}

/**
 * Seat a tenant directly, mirroring what the move-in in `economy.js` does.
 *
 * A DELIBERATE fixture shortcut, for tests whose subject sits downstream of
 * leasing — demolition refusing an occupied room, noise between neighbours,
 * a service's coverage radius. Those fixtures are not testing whether a tenant
 * would come; they need one in the room to have anything to measure. Where the
 * arrival itself is the subject, give the tower a shaft and a car and run days
 * instead.
 */
export function occupy(state, config, ...units) {
  for (const unit of units) {
    unit.occupied = true;
    unit.vacantDays = 0;
    unit.daysOccupied = 0;
    if (unit.kind === 'hotel') unit.heads = config.units.hotel.guests;
    // The jitter belongs to the tenant, not the room, so it is drawn here for
    // the same reason the sim draws it here — and it takes from the same rng
    // stream, so a fixture with the dampers switched on gets a real spread.
    assignTenantJitter(state, unit, config);
  }
  return units[0];
}

/** Every room in the tower, seated. Same shortcut, same caveat. */
export function occupyAll(state, config) {
  return occupy(state, config, ...state.units);
}

/**
 * Let a fixture raise its whole tower in one go.
 *
 * `build_unit` paces a player's growth against leasing: with every new room
 * arriving empty, more than `capacity * vacancyBufferDays` unlet rooms blocks
 * the next build. That is a pacing rule for a session, not a property any of
 * these fixtures measure, and nothing asserts it — so a fixture that needs a
 * standing tower before day one turns it off explicitly rather than dribbling
 * rooms in over simulated days.
 */
export function unpacedBuilding(config) {
  config.occupancy.vacancyBufferDays = 1000;
  return config;
}
