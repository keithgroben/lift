/**
 * Underground floors B1..B10 (spec/tower-view.md §3, issue #6).
 *
 * The tower is a floor RANGE now, `lowestFloor .. floors-1`. These tests
 * cover the four things that can go wrong with that: negative indexing that
 * only half works, a shaft that says it reaches a basement but doesn't, a
 * basement that is served by nothing and quietly succeeds anyway, and —
 * the one that would silently rewrite every balance number this project has
 * — above-ground play drifting when nothing is dug at all.
 */
import { CONFIG } from '../src/games/lift/config.js';
import { boot, step, applyAction } from '../src/games/lift/sim/index.js';
import {
  basementDepth, buildableFloors, freeSlot, isBuildableFloor, lowestFloor,
  slotsUsed, totalFloors,
} from '../src/games/lift/sim/state.js';
import { unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { parkingCoverage } from '../src/games/lift/sim/services.js';
import { POLICIES } from '../src/games/lift/policies.js';
import { columnTo, occupy, unpacedBuilding } from './support.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function rich(mutate = null) {
  const config = structuredClone(CONFIG);
  config.economy.startMoney = 50000000;
  config.building.startFloors = 6;
  if (mutate) mutate(config);
  return config;
}

const act = (state, config, type, extra = {}) => applyAction(state, { type, ...extra }, config);

/** Advance to the close of day `n`, returning that day's log entry. */
function runDays(state, config, n) {
  let guard = 0;
  while (state.log.length < n && !state.over) {
    step(state, config.time.dt, config);
    if (++guard > n * (config.time.daySeconds / config.time.dt) * 4) break;
  }
  return state.log[n - 1];
}

/** A basement office with a shaft that does, or does not, reach it. */
function basementTower(config, seed, { serveIt }) {
  const state = boot(config, seed);
  assert(act(state, config, 'dig_basement').ok, 'could not dig B1');
  assert(act(state, config, 'build_shaft', { bottom: 0, top: 5, slot: 1 }).ok, 'could not build shaft');
  if (serveIt) {
    assert(act(state, config, 'extend_shaft', { id: state.shafts[0].id, bottom: -1 }).ok,
      'could not extend the shaft down');
  }
  assert(act(state, config, 'build_unit', { kind: 'office', floor: -1, slot: 2 }).ok,
    'could not build a B1 office');
  // A new room comes empty and fills through leasing, which takes days this
  // fixture does not run. The subject here is whether a shaft reaches the
  // basement at all, so the tenant is seated directly — without one there are
  // no trips to strand or deliver.
  occupy(state, config, state.units[0]);
  return state;
}

export const tests = {
  'digging opens B1..B10 and stops exactly there'() {
    const config = rich();
    const state = boot(config, 11);
    assert(lowestFloor(state) === 0 && basementDepth(state) === 0, 'a new tower is not at ground level');

    const spendBefore = state.today.spent;
    for (let i = 1; i <= config.underground.maxDepth; i++) {
      const r = act(state, config, 'dig_basement');
      assert(r.ok, `dig ${i} was refused: ${r.reason}`);
      assert(state.lowestFloor === -i, `dig ${i} left lowestFloor at ${state.lowestFloor}`);
    }
    assert(basementDepth(state) === 10, 'ten digs did not reach B10');
    const eleventh = act(state, config, 'dig_basement');
    assert(!eleventh.ok && eleventh.reason === 'at max depth',
      'the depth cap does not hold — B11 was allowed');
    assert(state.today.spent - spendBefore === config.underground.digCost * 10,
      'digging was not charged ten times digCost');
    // Bound: the cap is the CONFIG value, not the number 10 baked in here.
    const shallow = boot(rich((c) => { c.underground.maxDepth = 2; }), 11);
    const shallowConfig = rich((c) => { c.underground.maxDepth = 2; });
    assert(act(shallow, shallowConfig, 'dig_basement').ok, 'B1 refused at maxDepth 2');
    assert(act(shallow, shallowConfig, 'dig_basement').ok, 'B2 refused at maxDepth 2');
    assert(!act(shallow, shallowConfig, 'dig_basement').ok, 'maxDepth 2 allowed a B3');
  },

  'a basement floor is a floor: indexing, slots, cost, and the range itself'() {
    const config = rich();
    const state = boot(config, 12);
    act(state, config, 'dig_basement');
    act(state, config, 'dig_basement');

    assert(totalFloors(state) === 8, 'six storeys over two basements is not eight floors');
    const floors = buildableFloors(state, config);
    assert(JSON.stringify(floors) === JSON.stringify([-2, -1, 1, 2, 3, 4, 5]),
      'the buildable range is wrong: ' + JSON.stringify(floors));
    assert(!floors.includes(0), 'the lobby floor leaked into the buildable range');
    assert(isBuildableFloor(state, -2, config) && !isBuildableFloor(state, -3, config),
      'buildability does not stop at the dug depth');

    // A basement hangs off the storey above it, so B2 slot 3 needs B1 slot 3
    // built before anything can hang there. A parking deck, not a room: it
    // holds the column up without becoming state.units[0].
    assert(act(state, config, 'build_facility', { kind: 'parking', floor: -1, slot: 3 }).ok,
      'could not hang a parking deck off B1');

    const before = state.money;
    assert(act(state, config, 'build_unit', { kind: 'office', floor: -2, slot: 3 }).ok,
      'could not build an office on B2');
    const paid = before - state.money;
    assert(paid === Math.round(config.costs.office * config.underground.buildCostMultiplier),
      `a B2 office cost ${paid}, not the discounted price`);

    const unit = state.units[0];
    assert(unit.floor === -2 && unit.slot === 3, 'the unit did not land on B2');
    assert(slotsUsed(state, -2).has(3), 'B2 slot 3 does not read as used');
    assert(freeSlot(state, config, -2) === 0, 'B2 has no free slot after one room');
    assert(!act(state, config, 'build_unit', { kind: 'office', floor: -2, slot: 3 }).ok,
      'two rooms stacked in the same basement slot');

    // Negation, both ends: the lobby's own floor and undug earth stay closed.
    for (const floor of [0, -3, -11]) {
      const r = act(state, config, 'build_unit', { kind: 'office', floor, slot: 5 });
      assert(!r.ok && r.reason === 'no such floor', `floor ${floor} accepted a room`);
    }
    assert(!act(state, config, 'build_facility', { kind: 'parking', floor: -3 }).ok,
      'a facility was built in undug earth');
    assert(act(state, config, 'build_facility', { kind: 'parking', floor: -1 }).ok,
      'a facility was refused on a dug basement');
  },

  'a shaft extended down actually serves the basement'() {
    const config = rich();
    const state = basementTower(config, 13, { serveIt: true });
    assert(state.shafts[0].bottom === -1 && state.shafts[0].top === 5,
      'the extension did not move the shaft bottom');

    const day = runDays(state, config, 2);
    assert(day.trips > 0, 'the B1 office generated no trips at all');
    assert(day.delivered > 0, 'a served basement delivered nobody');
    assert(day.deliveryRate >= 80,
      `a served basement only delivered ${day.deliveryRate}% of its trips`);
    const stranded = state.events.filter((e) => e.kind === 'stranded');
    assert(stranded.length === 0, `${stranded.length} riders were stranded on a served basement`);
  },

  'an unserved basement is as dead as an unserved 40th floor'() {
    const config = rich();
    const state = basementTower(config, 13, { serveIt: false });
    assert(state.shafts[0].bottom === 0, 'the shaft reached down without being extended');

    const day = runDays(state, config, 2);
    assert(day.trips > 0, 'the B1 office generated no trips at all');
    assert(day.delivered === 0,
      `${day.delivered} trips were delivered to a basement no shaft reaches`);
    assert(day.abandoned === day.trips, 'unreachable trips were not all counted as abandoned');
    const stranded = state.events.filter((e) => e.kind === 'stranded');
    assert(stranded.length > 0, 'nobody was logged as stranded');
    assert(stranded.every((e) => e.from === -1 || e.to === -1),
      'something other than the basement was stranded');
  },

  'extending a shaft down costs exactly what extending it up costs'() {
    const config = rich();
    const state = boot(config, 14);
    for (let i = 0; i < 3; i++) act(state, config, 'dig_basement');

    act(state, config, 'build_shaft', { bottom: 0, top: 2, slot: 1 });
    act(state, config, 'build_shaft', { bottom: 0, top: 2, slot: 2 });
    const [up, down] = state.shafts;

    let before = state.money;
    assert(act(state, config, 'extend_shaft', { id: up.id, top: 4 }).ok, 'up extension refused');
    const upCost = before - state.money;

    before = state.money;
    assert(act(state, config, 'extend_shaft', { id: down.id, bottom: -2 }).ok, 'down extension refused');
    const downCost = before - state.money;

    assert(upCost === downCost && upCost === config.costs.shaftPerFloor * 2,
      `two floors up cost ${upCost} and two floors down cost ${downCost}`);
    assert(down.bottom === -2 && down.top === 2, 'the downward extension moved the wrong end');

    // Bound: a shaft is never shortened, and never re-charged for nothing.
    assert(!act(state, config, 'extend_shaft', { id: down.id, bottom: 0 }).ok,
      'a shaft was shortened from below');
    assert(!act(state, config, 'extend_shaft', { id: down.id, top: 1 }).ok,
      'a shaft was shortened from above');
    assert(!act(state, config, 'extend_shaft', { id: down.id, bottom: -2 }).ok,
      'a no-op extension was charged for');
    // Bound: the span cap counts the basement half. A shaft that exactly fits
    // measured from floor 0 must be refused once it starts below it.
    const capped = rich((c) => { c.elevator.maxSpan = 5; c.building.startFloors = 8; });
    const cs = boot(capped, 14);
    act(cs, capped, 'dig_basement');
    assert(act(cs, capped, 'build_shaft', { bottom: 0, top: 4, slot: 1 }).ok,
      'a shaft of exactly maxSpan floors was refused');
    const overCap = act(cs, capped, 'extend_shaft', { id: cs.shafts[0].id, bottom: -1 });
    assert(!overCap.ok && /cap at 5 floors/.test(overCap.reason),
      'the span cap ignored the basement half of the shaft: ' + JSON.stringify(overCap));
  },

  'a room below ground loses appeal per floor down, and stops at the cap'() {
    const config = unpacedBuilding(rich());
    const state = boot(config, 15);
    for (let i = 0; i < 8; i++) act(state, config, 'dig_basement');
    act(state, config, 'build_shaft', { bottom: -8, top: 5, slot: 1 });

    // Each sample room needs its own column: upwards to F3, and downwards to
    // B8, where every basement hangs off the storey above it. The filler rooms
    // sit in the same slot 2, and penaltyAt only ever reads the room it just
    // built, so they stay out of the measurement.
    const penaltyAt = (floor) => {
      columnTo(state, config, floor, 2);
      assert(act(state, config, 'build_unit', { kind: 'office', floor, slot: 2 }).ok,
        `could not build an office on ${floor}`);
      const unit = state.units[state.units.length - 1];
      return unitEvaluation(state, unit, config).undergroundPenalty;
    };

    assert(penaltyAt(3) === 0, 'an above-ground room was charged an underground penalty');
    assert(penaltyAt(-1) === config.underground.appealPenaltyPerFloor,
      'B1 did not pay one floor of penalty');
    assert(penaltyAt(-2) === config.underground.appealPenaltyPerFloor * 2,
      'B2 did not pay two floors of penalty');
    assert(penaltyAt(-8) === config.underground.appealPenaltyCap,
      'the appeal penalty is not capped');

    // Bound: the penalty is what actually moves the score, not just a field.
    const shallow = state.units.find((u) => u.floor === -1);
    const deep = state.units.find((u) => u.floor === -8);
    assert(unitEvaluation(state, deep, config).score < unitEvaluation(state, shallow, config).score,
      'a deeper room did not score worse than a shallower one');
  },

  'a basement facility reaches up from the ground line, and only so far'() {
    const config = rich((c) => { c.building.startFloors = 12; unpacedBuilding(c); });
    const state = boot(config, 16);
    act(state, config, 'dig_basement');
    act(state, config, 'build_shaft', { bottom: -1, top: 11, slot: 1 });

    const reach = config.services.parking.coverageFloors + config.underground.serviceCoverageBonus;
    const near = reach, far = reach + 1;
    // Both sample offices stand on a column in their own slot; the lookups
    // below still pick them out, because no filler room shares their floor.
    columnTo(state, config, near, 2);
    assert(act(state, config, 'build_unit', { kind: 'office', floor: near, slot: 2 }).ok, 'near office');
    columnTo(state, config, far, 2);
    assert(act(state, config, 'build_unit', { kind: 'office', floor: far, slot: 2 }).ok, 'far office');
    assert(act(state, config, 'build_facility', { kind: 'parking', floor: -1, slot: 3 }).ok, 'B1 parking');

    const nearUnit = state.units.find((u) => u.floor === near);
    const farUnit = state.units.find((u) => u.floor === far);
    assert(parkingCoverage(state, nearUnit, config) != null,
      `B1 parking failed to reach F${near}, its whole reason for being down there`);
    assert(parkingCoverage(state, farUnit, config) == null,
      `B1 parking reached F${far} — the coverage bonus is unbounded`);
    // Negation: without the bonus the same garage reaches only its own band,
    // so the bonus is doing the work and not some accident of the ground line.
    const noBonus = rich((c) => { c.building.startFloors = 12; c.underground.serviceCoverageBonus = 0; });
    assert(parkingCoverage(state, nearUnit, noBonus) == null,
      'coverage reached the same floor with the bonus switched off');
  },

  'basement storeys are charged the same daily upkeep as raised ones'() {
    const config = rich();
    const flat = runDays(boot(config, 17), config, 1);
    const dug = boot(config, 17);
    act(dug, config, 'dig_basement');
    act(dug, config, 'dig_basement');
    const deep = runDays(dug, config, 1);
    assert(deep.upkeep - flat.upkeep === config.economy.upkeepPerFloor * 2,
      `two basements changed daily upkeep by ${deep.upkeep - flat.upkeep}`);
    assert(deep.basements === 2 && flat.basements === 0,
      'the day log does not report how deep the tower has dug');
  },

  /**
   * The one that matters. Every balance result this project has rests on
   * above-ground play being untouched by a feature nobody used, so this
   * mutates every underground knob to an absurd value and demands the run
   * come out bit-identical — and then proves the instrument works by showing
   * a tower that DOES dig diverges under the same comparison.
   */
  'an undug tower is bit-identical however the underground is tuned'() {
    const logFor = (policyKey, config, seed, days = 40) => {
      const state = boot(config, seed);
      POLICIES[policyKey].open(state, config);
      while (state.log.length < days && !state.over) {
        if (step(state, config.time.dt, config)) POLICIES[policyKey].decide(state, config);
      }
      return { log: JSON.stringify(state.log), state };
    };
    const wild = (c) => {
      c.underground.buildCostMultiplier = 0.05;
      c.underground.appealPenaltyPerFloor = 99;
      c.underground.appealPenaltyCap = 99;
      c.underground.serviceCoverageBonus = 40;
      c.underground.digCost = 1;
    };

    for (const seed of [3, 8]) {
      const stock = logFor('skyscraper', structuredClone(CONFIG), seed);
      const tuned = logFor('skyscraper', (() => { const c = structuredClone(CONFIG); wild(c); return c; })(), seed);
      // Not vacuous: a policy that never digs is exactly the case under test.
      assert(lowestFloor(stock.state) === 0 && lowestFloor(tuned.state) === 0,
        'this policy dug a basement, so it proves nothing about undug towers');
      assert(stock.log === tuned.log,
        `seed ${seed}: an undug skyscraper moved when only underground knobs changed`);
    }

    // Negation: the same comparison on a digging policy DOES diverge, so the
    // equality above is a real property and not a broken instrument.
    const digStock = logFor('underground', structuredClone(CONFIG), 3);
    const digTuned = logFor('underground', (() => { const c = structuredClone(CONFIG); wild(c); return c; })(), 3);
    assert(lowestFloor(digStock.state) < 0, 'the digging policy never dug');
    assert(digStock.log !== digTuned.log,
      'a digging tower was unmoved by the underground knobs — the knobs do nothing');
  },
};
