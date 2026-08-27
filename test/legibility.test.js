import { appendServiceRoomStatusHistory, localRouteTargetStatus, placementGuideFloorStatus, placementGuideFloors, serviceFloorHeadcountCause, serviceFocusCoverage, serviceFocusCoveredRoomDetails, serviceFocusCoveredRoomLabel, serviceFocusFloors, serviceFocusUncoveredRoomLabel, serviceRoomHealthSignal, serviceRoomStatus, serviceRoomStatusTrend, serviceRoomTrendAction, shaftQueueOriginFloors, shaftQueueTrendMarker, shaftWaitingBadgeText, unassignedQueueOriginFloors, waitingBadgeText, waitingPressure, tenantBadgeText, tenantCount } from '../src/games/lift/render/canvas.js';
import { CONFIG } from '../src/games/lift/config.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'waiting pressure progresses from clear to critical'() {
    const clear = waitingPressure(0);
    const watch = waitingPressure(4);
    const busy = waitingPressure(8);
    const critical = waitingPressure(12);
    const deep = waitingPressure(120);

    assert(clear.band === 'clear' && clear.ratio === 0 && clear.colorKey === 'good', 'empty floor was not clear');
    assert(watch.band === 'watch' && watch.colorKey === 'warn', 'small queue was not watch-level');
    assert(busy.band === 'busy' && busy.ratio > watch.ratio && busy.colorKey === 'warn', 'queue pressure did not increase');
    assert(critical.band === 'critical' && critical.ratio === 1 && critical.colorKey === 'bad', 'critical queue was not redline');
    assert(deep.ratio === 1 && deep.colorKey === 'bad', 'deep queue exceeded the indicator scale');
  },

  'tenant badge uses the room headcount'() {
    assert(tenantCount({ heads: 6 }) === 6, 'office headcount was not shown');
    assert(tenantCount({ heads: 3 }) === 3, 'condo headcount was not shown');
    assert(tenantCount({}) === 0 && tenantCount(null) === 0,
      'missing headcount was not handled safely');
  },

  'canvas badges name their counts without relying on color'() {
    const config = structuredClone(CONFIG);
    assert(waitingBadgeText(0) === 'W 0' && waitingBadgeText(12) === 'W 12' &&
      shaftWaitingBadgeText(1, 0) === 'S1 · W 0' && shaftWaitingBadgeText(3, 12) === 'S3 · W 12' &&
      shaftQueueTrendMarker([0]) === '' && shaftQueueTrendMarker([0, 4]) === '↑' &&
      shaftQueueTrendMarker([5, 2]) === '↓' && shaftQueueTrendMarker([1, 7, 2]) === '!' &&
      shaftQueueOriginFloors({ people: [
        { state: 'waiting', shaft: 2, from: 3 },
        { state: 'waiting', shaft: 2, from: 1 },
        { state: 'aboard', shaft: 2, from: 4 },
        { state: 'waiting', shaft: 1, from: 4 },
        { state: 'waiting', shaft: 2, from: 3 },
      ] }, 2).join(',') === '1,3' &&
      unassignedQueueOriginFloors({ people: [
        { state: 'waiting', shaft: null, from: 4 },
        { state: 'waiting', shaft: null, from: 2 },
        { state: 'aboard', shaft: null, from: 1 },
        { state: 'waiting', shaft: 1, from: 3 },
        { state: 'waiting', shaft: null, from: 4 },
      ] }).join(',') === '2,4' &&
      tenantBadgeText({ kind: 'office', heads: 6 }, config) === 'T 6/6',
      'canvas badges did not expose waiting and tenant meanings');
  },

  'placement guide marks target and valid coverage floors'() {
    const state = { floors: 6, units: [], facilities: [], stairs: [], escalators: [], shafts: [], lobby: null };
    const food = placementGuideFloors({ kind: 'food', floor: 3 }, state, CONFIG);
    const shaft = placementGuideFloors({ kind: 'shaft', floor: 3 }, state, CONFIG);
    const fullState = { ...state, units: Array.from({ length: CONFIG.building.slotsPerFloor }, (_, slot) => ({ floor: 3, slot })) };
    assert(food.join(',') === '2,3,4' && shaft.join(',') === '3,4,5' &&
      placementGuideFloorStatus({ kind: 'food', floor: 3 }, 3, state, CONFIG) === 'open' &&
      placementGuideFloorStatus({ kind: 'food', floor: 3 }, 1, state, CONFIG) === 'outside' &&
      placementGuideFloorStatus({ kind: 'food', floor: 3 }, 3, fullState, CONFIG) === 'full',
      'placement guide did not calculate target and valid floors');
  },

  'local route target exposes its endpoint and clear column'() {
    const state = { floors: 5, units: [], facilities: [], stairs: [], escalators: [], shafts: [], lobby: { slots: [0] } };
    const target = localRouteTargetStatus({ kind: 'stairs', floor: 3 }, state, CONFIG);
    const occupied = Array.from({ length: CONFIG.building.slotsPerFloor * 4 }, (_, index) => ({
      floor: Math.floor(index / CONFIG.building.slotsPerFloor), slot: index % CONFIG.building.slotsPerFloor,
    }));
    const blocked = localRouteTargetStatus({ kind: 'escalator', floor: 3 }, { ...state, units: occupied }, CONFIG);
    const tooFar = localRouteTargetStatus({ kind: 'stairs', floor: 99 }, state, CONFIG);
    assert(target.key === 'ready' && target.bottom === 0 && target.top === 3 && target.slot === 1 &&
      blocked.key === 'blocked' && blocked.slot === -1 && tooFar.key === 'blocked',
      'local route target did not expose its endpoint or column state');
  },

  'service focus marks the facility area on the correct floors'() {
    const state = {
      floors: 6,
      units: [
        { id: 1, kind: 'office', floor: 2, slot: 1, heads: 6, occupied: true },
        { id: 2, kind: 'office', floor: 3, slot: 1, heads: 6, occupied: true },
        { id: 3, kind: 'office', floor: 4, slot: 1, heads: 6, occupied: true },
      ],
      facilities: [{ kind: 'food', floor: 3, slot: 2 }],
      shafts: [], stairs: [], escalators: [], lobby: null,
    };
    const focused = serviceFocusFloors({ kind: 'food', floor: 3 }, state, CONFIG);
    const bounded = serviceFocusFloors({ kind: 'medical', floor: 1 }, state, CONFIG);
    const coverage = serviceFocusCoverage({ kind: 'food', floor: 3 }, state, CONFIG);
    const coveredRoomLabel = serviceFocusCoveredRoomLabel(coverage, state);
    state.units[0].stress = 8;
    const coveredRoomDetails = serviceFocusCoveredRoomDetails(coverage, state, CONFIG);
    state.units[2].occupied = false;
    const afterVacancy = serviceFocusCoverage({ kind: 'food', floor: 3 }, state, CONFIG);
    state.facilities = [];
    const afterServiceLoss = serviceFocusCoverage({ kind: 'food', floor: 3 }, state, CONFIG);
    assert(focused.join(',') === '2,3,4' && bounded.join(',') === '1,2,3,4' &&
      coverage.coveredRooms === 3 && coverage.requiredRooms === 3 && coverage.coveredHeads === 18 &&
      coverage.coveredUnitIds.join(',') === '1,2,3' &&
      coveredRoomDetails.length === 3 && coveredRoomDetails.every((room) => Number.isFinite(room.desirability) && Number.isFinite(room.stress)) &&
      coveredRoomDetails.find((room) => room.id === 1)?.stress === 8 &&
      coveredRoomLabel === 'F2 office (6 tenants), F3 office (6 tenants), F4 office (6 tenants)' &&
      afterVacancy.coveredRooms === 2 && afterVacancy.requiredRooms === 2 && afterVacancy.coveredHeads === 12 &&
      afterServiceLoss.uncoveredRooms === 2 && afterServiceLoss.uncoveredHeads === 12 &&
      afterServiceLoss.uncoveredFloors.join(',') === '2,3' && afterServiceLoss.uncoveredRoomsByFloor[2] === 1 &&
      afterServiceLoss.uncoveredUnitIds.join(',') === '1,2' && afterServiceLoss.requiredRoomsByFloor[2] === 1 &&
      afterServiceLoss.requiredHeadsByFloor[3] === 6 && afterServiceLoss.coveredRoomsByFloor[2] === undefined &&
      afterServiceLoss.uncoveredHeadsByFloor[3] === 6 &&
      serviceFocusUncoveredRoomLabel(afterServiceLoss, state) === 'F2 office (6 tenants), F3 office (6 tenants)' &&
      serviceFocusCoverage({ kind: 'food', floor: 3 }, { ...state, units: state.units.map((unit) => ({ ...unit, occupied: false })) }, CONFIG).requiredHeads === 0,
      'service focus did not calculate live coverage inside the facility area');
  },

  'service floor headcount drops identify their cause'() {
    const vacancy = serviceFloorHeadcountCause(6, 12, 6, 12);
    const coverage = serviceFloorHeadcountCause(6, 12, 12, 12);
    const stable = serviceFloorHeadcountCause(12, 6, 12, 6);
    assert(vacancy.key === 'vacancy' && vacancy.requiredDelta === -6 &&
      coverage.key === 'coverage' && coverage.requiredDelta === 0 && stable.key === 'stable',
      'service headcount drop cause was not classified');
  },

  'served-room health combines appeal and transport stress'() {
    const healthy = serviceRoomHealthSignal({ kind: 'office', desirability: 85, stress: 0 }, CONFIG);
    const watch = serviceRoomHealthSignal({ kind: 'office', desirability: 70, stress: 0 }, CONFIG);
    const risk = serviceRoomHealthSignal({ kind: 'office', desirability: 90, stress: CONFIG.units.office.vacateAt * 0.7 }, CONFIG);
    const both = serviceRoomHealthSignal({ kind: 'office', desirability: 45, stress: CONFIG.units.office.vacateAt * 0.7 }, CONFIG);
    assert(healthy.key === 'healthy' && healthy.label === 'HEALTHY' && healthy.colorKey === 'good' && healthy.driver === 'none' &&
      watch.key === 'watch' && watch.colorKey === 'warn' && watch.driver === 'appeal' &&
      risk.key === 'risk' && risk.label === 'AT RISK' && risk.colorKey === 'bad' && risk.driver === 'transport' &&
      both.driver === 'appeal + transport',
      'served-room health did not combine desirability and transport stress');
  },

  'service room history distinguishes vacancy and coverage states'() {
    const covered = serviceRoomStatus({ kind: 'office', heads: 6, occupied: true }, { foodCovered: true }, 'food', CONFIG);
    const uncovered = serviceRoomStatus({ kind: 'office', heads: 6, occupied: true }, { foodCovered: false }, 'food', CONFIG);
    const vacant = serviceRoomStatus({ kind: 'office', heads: 6, occupied: false }, { foodCovered: false }, 'food', CONFIG);
    assert(covered.key === 'covered' && covered.liveHeads === 6 &&
      uncovered.key === 'uncovered' && uncovered.liveHeads === 6 &&
      vacant.key === 'vacant' && vacant.liveHeads === 0,
      'service room status did not distinguish vacancy from coverage');
  },

  'service room history trend explains direction'() {
    const recovering = serviceRoomStatusTrend([{ key: 'uncovered' }, { key: 'covered' }]);
    const worsening = serviceRoomStatusTrend([{ key: 'covered' }, { key: 'uncovered' }]);
    const stable = serviceRoomStatusTrend([{ key: 'covered' }, { key: 'covered' }]);
    assert(recovering.key === 'recovering' && worsening.key === 'worsening' && stable.key === 'stable',
      'service room trend did not distinguish recovery, decline, and stability');
  },

  'service room history seeds and replaces a same-day baseline'() {
    const seeded = appendServiceRoomStatusHistory([], { unitId: 4, kind: 'food', day: 2, key: 'uncovered', liveHeads: 6 });
    const replaced = appendServiceRoomStatusHistory(seeded, { unitId: 4, kind: 'food', day: 2, key: 'covered', liveHeads: 6 });
    assert(seeded.length === 1 && replaced.length === 1 && replaced[0].key === 'covered' &&
      replaced[0].transitionFrom === null,
      'service room history did not seed or replace its same-day baseline');
  },

  'worsening service trend points to the right room action'() {
    const restore = serviceRoomTrendAction({ key: 'worsening' }, 'uncovered', 'food');
    const rerent = serviceRoomTrendAction({ key: 'worsening' }, 'vacant', 'food');
    const stable = serviceRoomTrendAction({ key: 'stable' }, 'uncovered', 'food');
    assert(restore.key === 'coverage' && restore.label === 'restore food coverage' &&
      rerent.key === 'vacancy' && stable.key === 'none',
      'worsening service trend did not point to the appropriate next action');
  },
};
