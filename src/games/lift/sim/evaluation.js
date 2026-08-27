/**
 * Room evaluation. Each component stays explicit so a player can understand
 * why a room is good or bad, and so each new desirability rule can be tested
 * without hiding changes inside a single opaque score.
 */
import { foodCoverage, medicalCoverage, parkingCoverage, recyclingCoverage, securityCoverage } from './services.js';
import {
  servingStairs, stairAccessSeconds,
  servingEscalators, escalatorAccessSeconds,
  localRouteOccupancy,
  lobbyAccessDistance,
  shopsForOffice,
} from './demand.js';
import { rentForLevel } from './pricing.js';
import { freeSlot, slotsUsed, unlocked } from './state.js';

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

function mixBalance(entries) {
  const distance = entries.reduce((sum, entry) => sum + Math.abs(entry.share - entry.targetShare), 0);
  return Math.round(clamp(1 - distance / 2) * 100);
}

function nearestShaft(state, unit) {
  let best = null;
  for (const shaft of state.shafts) {
    if (unit.floor < shaft.bottom || unit.floor > shaft.top) continue;
    const slots = Math.abs(unit.slot - shaft.slot);
    if (!best || slots < best.slots) best = { shaft, slots };
  }
  return best;
}

function nearestStair(state, unit, config) {
  let best = null;
  const trip = { from: unit.floor, fromUnit: unit.id, to: 0 };
  for (const stair of servingStairs(state, unit.floor, 0)) {
    const accessSeconds = stairAccessSeconds(state, trip, stair, config);
    if (!best || accessSeconds < best.accessSeconds) {
      best = { stair, accessSeconds, slots: Math.abs(unit.slot - stair.slot) };
    }
  }
  return best;
}

function nearestEscalator(state, unit, config) {
  let best = null;
  const trip = { from: unit.floor, fromUnit: unit.id, to: 0 };
  for (const escalator of servingEscalators(state, unit.floor, 0)) {
    const accessSeconds = escalatorAccessSeconds(state, trip, escalator, config);
    if (!best || accessSeconds < best.accessSeconds) {
      best = { escalator, accessSeconds, slots: Math.abs(unit.slot - escalator.slot) };
    }
  }
  return best;
}

/**
 * Occupied units make noise. Shared-wall neighbors get the full source noise;
 * the unit directly above or below gets the configured, smaller fraction.
 * Keeping this geometric and local makes floor layout a deliberate choice.
 */
export function unitNoise(state, unit, config) {
  const radius = config.evaluation.noiseRadiusSlots ?? 1;
  const verticalWeight = config.evaluation.verticalNoiseWeight ?? 0;
  let noise = 0;
  for (const other of state.units) {
    if (other.id === unit.id || !other.occupied) continue;
    const source = config.units[other.kind] || config.units.office;
    const sourceNoise = source.noise ?? 0;
    if (!sourceNoise) continue;

    if (other.floor === unit.floor) {
      const slots = Math.abs(other.slot - unit.slot);
      if (slots > 0 && slots <= radius) noise += sourceNoise / slots;
    } else if (Math.abs(other.floor - unit.floor) === 1 && other.slot === unit.slot) {
      noise += sourceNoise * verticalWeight;
    }
  }
  return +noise.toFixed(2);
}

/** Mixed-use neighbors make a floor feel active; one nearby different type is enough. */
export function unitLayoutBonus(state, unit, config) {
  const radius = config.evaluation.layoutRadiusSlots ?? 0;
  const mixedNeighbor = state.units.some((other) =>
    other.id !== unit.id && other.occupied && other.floor === unit.floor &&
    other.kind !== unit.kind && Math.abs(other.slot - unit.slot) <= radius
  );
  return mixedNeighbor ? (config.evaluation.layoutBonus ?? 0) : 0;
}

/** Give finite move-in demand a small preference for underrepresented tenant types. */
export function marketDemandBonus(state, unit, config, reputation = null) {
  const targetShare = config.units[unit.kind]?.targetShare ?? 0;
  if (targetShare <= 0) return 0;
  let totalHeads = 0;
  let kindHeads = 0;
  for (const other of state.units) {
    if (!other.occupied) continue;
    totalHeads += other.heads ?? 0;
    if (other.kind === unit.kind) kindHeads += other.heads ?? 0;
  }
  const actualShare = totalHeads ? kindHeads / totalHeads : 0;
  const undersupply = clamp((targetShare - actualShare) / Math.max(0.001, targetShare));
  return Math.round(undersupply * (config.occupancy.marketDemandWeight ?? 0)
    * reputationDemandFactor(state, config, reputation));
}

/** Calculate one room's appeal score from the existing room-evaluation fields. */
export function roomDesirabilityScore(evaluation, config) {
  if (!evaluation) return null;
  return Math.max(0, Math.min(100, Math.round(
    (config.evaluation.desirabilityBase ?? 60) +
    evaluation.viewBonus + evaluation.amenityBonus + evaluation.layoutBonus + evaluation.renovationBonus + evaluation.rentAdjustment -
    evaluation.preferencePenalty - evaluation.noisePenalty - evaluation.foodPenalty - evaluation.parkingPenalty -
    evaluation.medicalPenalty - evaluation.securityPenalty - evaluation.recyclingPenalty
  )));
}

/** Convert low room appeal into a slow, recoverable tenant-retention pressure. */
export function tenantRetentionPressure(state, unit, config) {
  const evaluation = unitEvaluation(state, unit, config);
  const score = roomDesirabilityScore(evaluation, config);
  const threshold = Math.max(0, Math.min(100,
    Number(config.occupancy.desirabilityRetentionThreshold ?? 45)));
  const weight = Math.max(0, Number(config.occupancy.desirabilityRetentionPressureWeight) || 0);
  const gap = score == null || threshold === 0 ? 0 : clamp((threshold - score) / threshold);
  const dailyPressure = +(gap * weight).toFixed(3);
  const recoveryPerDay = Math.max(0, Number(config.occupancy.desirabilityRetentionRecovery) || 0);
  const vacateAt = Math.max(1, Number(config.occupancy.desirabilityRetentionVacateAt) || 1);
  const currentPressure = Math.max(0, Number(unit?.desirabilityPressure) || 0);
  const nextPressure = Math.min(vacateAt, Math.max(0,
    currentPressure + (dailyPressure > 0 ? dailyPressure : -recoveryPerDay)));
  return {
    score,
    threshold,
    gap: +gap.toFixed(3),
    dailyPressure,
    recoveryPerDay,
    pressure: currentPressure,
    nextPressure: +nextPressure.toFixed(3),
    vacateAt,
    key: nextPressure >= vacateAt ? 'critical' : nextPressure > 0 ? 'watch' : 'clear',
  };
}

/** Point rising appeal pressure at the largest room-level improvement signal. */
export function tenantRetentionRecommendation(state, unit, config) {
  if (!unit || !unit.occupied) return null;
  const evaluation = unitEvaluation(state, unit, config);
  const pressure = tenantRetentionPressure(state, unit, config);
  if (pressure.pressure <= 0) {
    return {
      key: 'monitor',
      label: 'appeal pressure clear',
      detail: 'Room appeal is above the retention threshold; keep watching the daily pressure history.',
      pressure,
    };
  }

  const tune = config.units[unit.kind] || {};
  const serviceOptions = [
    ['food', 'foodNeed', 'foodCovered', 'add food service', 'food coverage is the largest missing appeal signal'],
    ['parking', 'parkingNeed', 'parkingCovered', 'add parking', 'parking coverage is the largest missing appeal signal'],
    ['medical', 'medicalNeed', 'medicalCovered', 'add medical service', 'medical coverage is the largest missing appeal signal'],
    ['security', 'securityNeed', 'securityCovered', 'add security', 'security coverage is the largest missing appeal signal'],
    ['recycling', 'recyclingNeed', 'recyclingCovered', 'add recycling', 'recycling coverage is the largest missing appeal signal'],
  ]
    .filter(([, need, covered]) => (tune[need] ?? 0) > 0 && !evaluation[covered])
    .map(([kind, , , label, detail]) => ({ key: 'service', kind, label, detail,
      penalty: Number(evaluation[kind + 'Penalty']) || 0 }));
  serviceOptions.sort((a, b) => b.penalty - a.penalty);
  const bestService = serviceOptions[0];
  if (bestService) {
    return {
      ...bestService,
      detail: bestService.detail + ' (−' + bestService.penalty + ' desirability points); pressure is ' +
        pressure.pressure.toFixed(1) + '/' + pressure.vacateAt + '.',
      pressure,
    };
  }
  if (evaluation.noisePenalty > 0) {
    return {
      key: 'noise',
      label: 'reduce nearby noise',
      detail: 'Nearby occupied uses cost ' + evaluation.noisePenalty + ' desirability points; add separation or relocate the noisy use.',
      pressure,
    };
  }
  if (evaluation.rentAdjustment < 0) {
    return {
      key: 'rent',
      label: 'lower rent one level',
      detail: 'Current rent is above the room baseline by ' + Math.abs(evaluation.rentAdjustment) + ' desirability points; lower the rent setting to recover appeal.',
      pressure,
    };
  }
  if (evaluation.preferencePenalty > 0) {
    return {
      key: 'floor_fit',
      label: 'use a better-fit floor next time',
      detail: 'This room is ' + evaluation.preferencePenalty + ' desirability points from the preferred floor; use the preferred floor when replacing the tenant.',
      pressure,
    };
  }
  return {
    key: 'renovation',
    label: 'renovate at next vacancy',
    detail: 'No single service dominates the appeal loss; renovate this room when it is vacant to add +' + (config.evaluation.renovationBonus ?? 0) + ' evaluation.',
    pressure,
  };
}

/** Summarize current coverage for occupied rooms that require a service. */
export function serviceCoverageSummary(state, kind, config) {
  if (!state || !kind || !config?.services?.[kind]) {
    return { available: false, kind, reason: 'service coverage unavailable' };
  }
  const required = state.units.filter((candidate) =>
    candidate.occupied && (config.units[candidate.kind]?.[kind + 'Need'] ?? 0) > 0);
  const covered = required.filter((candidate) => Boolean(
    unitEvaluation(state, candidate, config)[kind + 'Covered']));
  const coveredHeads = covered.reduce((sum, candidate) => sum + (candidate.heads ?? 0), 0);
  return {
    available: true,
    kind,
    requiredRooms: required.length,
    requiredHeads: required.reduce((sum, candidate) => sum + (candidate.heads ?? 0), 0),
    coveredRooms: covered.length,
    coveredHeads,
    coveredUnitIds: covered.map((candidate) => candidate.id),
  };
}

/** Preview the occupied rooms and tenant heads covered by a service placement. */
export function servicePlacementCoveragePreview(state, kind, floor, config) {
  if (!state || !kind || !config?.services?.[kind]) {
    return { available: false, kind, floor, reason: 'service placement unavailable' };
  }
  const placementFloor = Number(floor);
  if (!Number.isInteger(placementFloor) || placementFloor <= (config.building.lobbyFloor ?? 0) || placementFloor >= state.floors) {
    return { available: false, kind, floor: placementFloor, reason: 'choose an upper floor' };
  }
  const slot = freeSlot(state, config, placementFloor);
  if (slot < 0) return { available: false, kind, floor: placementFloor, reason: 'floor is full' };
  const before = serviceCoverageSummary(state, kind, config);
  const projectedState = {
    ...state,
    facilities: [...(state.facilities ?? []), { id: -1, kind, floor: placementFloor, slot }],
  };
  const after = serviceCoverageSummary(projectedState, kind, config);
  return {
    available: true,
    kind,
    floor: placementFloor,
    slot,
    requiredRooms: before.requiredRooms,
    requiredHeads: before.requiredHeads,
    beforeRooms: before.coveredRooms,
    afterRooms: after.coveredRooms,
    roomsDelta: after.coveredRooms - before.coveredRooms,
    beforeHeads: before.coveredHeads,
    afterHeads: after.coveredHeads,
    headsDelta: after.coveredHeads - before.coveredHeads,
    coveredUnitIds: after.coveredUnitIds,
  };
}

/** Give a coverage projection a compact, color-independent strength label. */
export function serviceCoverageChange(preview) {
  if (!preview?.available) return { key: 'unavailable', label: 'coverage unavailable' };
  if (preview.roomsDelta > 0 && preview.afterRooms >= preview.requiredRooms) {
    return { key: 'strong', label: 'strong coverage gain' };
  }
  if (preview.roomsDelta > 0 || preview.headsDelta > 0) {
    return { key: 'partial', label: 'partial coverage gain' };
  }
  return { key: 'flat', label: 'no coverage gain' };
}

/** Compare a hovered service placement with the guided recommendation. */
export function servicePlacementComparison(candidate, recommended) {
  if (!candidate?.available || !recommended?.available || candidate.floor === recommended.floor) {
    return { key: 'same', label: '' };
  }
  const roomDelta = candidate.afterRooms - recommended.afterRooms;
  const headDelta = candidate.afterHeads - recommended.afterHeads;
  const key = roomDelta > 0 || headDelta > 0 ? 'better' : roomDelta < 0 || headDelta < 0 ? 'worse' : 'same';
  const signed = (value) => value > 0 ? '+' + value : String(value);
  return {
    key,
    label: 'vs recommended F' + recommended.floor + ': rooms ' + signed(roomDelta) + ' · heads ' + signed(headDelta),
  };
}

/** Project the direct daily budget effect of adding one service facility. */
export function servicePlacementBudgetImpact(state, kind, config) {
  const dailyUpkeep = Math.max(0, Number(config?.services?.[kind]?.dailyUpkeep) || 0);
  const beforeNet = Number(state?.log?.at(-1)?.net);
  return {
    dailyUpkeep,
    beforeNet: Number.isFinite(beforeNet) ? beforeNet : null,
    afterNet: Number.isFinite(beforeNet) ? beforeNet - dailyUpkeep : null,
    delta: -dailyUpkeep,
  };
}

/** Describe the current cash runway from recent closed-day net results. */
export function cashRunwaySummary(state, maxHistory = 3) {
  const cash = Number(state?.money);
  const historyLimit = Math.max(1, Math.floor(Number(maxHistory) || 3));
  const recent = (state?.log ?? [])
    .slice(-historyLimit)
    .map((entry) => {
      const rent = Number(entry?.rent);
      const shopRevenue = Number(entry?.shopRevenue);
      const upkeep = Number(entry?.upkeep);
      if (Number.isFinite(rent) && Number.isFinite(shopRevenue) && Number.isFinite(upkeep)) {
        return rent + shopRevenue - upkeep;
      }
      const net = Number(entry?.net);
      const spent = Number(entry?.spent);
      const rewards = Number(entry?.rewards);
      return Number.isFinite(net)
        ? net + (Number.isFinite(spent) ? spent : 0) - (Number.isFinite(rewards) ? rewards : 0)
        : NaN;
    })
    .filter(Number.isFinite);
  if (!Number.isFinite(cash) || !recent.length) {
    return { key: 'unknown', cash: Number.isFinite(cash) ? cash : null, averageNet: null, days: null, label: 'cash runway awaiting a closed-day budget' };
  }
  const averageNet = +(recent.reduce((total, net) => total + net, 0) / recent.length).toFixed(2);
  if (averageNet > 0) {
    return { key: 'positive', cash, averageNet, days: null, label: 'operating cash flow +' + averageNet.toLocaleString() + '/day at recent pace' };
  }
  if (averageNet === 0) {
    return { key: 'break_even', cash, averageNet, days: null, label: 'operating cash flow break-even at recent pace' };
  }
  const days = cash > 0 ? Math.max(1, Math.ceil(cash / Math.abs(averageNet))) : 0;
  return {
    key: days <= 3 ? 'critical' : 'watch',
    cash,
    averageNet,
    days,
    label: cash > 0
      ? 'cash runway about ' + days + ' day' + (days === 1 ? '' : 's') + ' at ' + averageNet.toLocaleString() + '/day'
      : 'cash exhausted at recent pace',
  };
}

/** Warn before a build consumes a meaningful part of the current cash runway. */
export function expansionSafetySummary(state, cost, maxHistory = 3) {
  const cash = Number(state?.money);
  const amount = Number(cost);
  if (!Number.isFinite(cash) || !Number.isFinite(amount) || amount <= 0) {
    return { key: 'unknown', cash: Number.isFinite(cash) ? cash : null, cost: Number.isFinite(amount) ? amount : null, cashAfter: null, averageNet: null, days: null, label: 'expansion safety unavailable' };
  }
  const cashAfter = cash - amount;
  if (cashAfter < 0) {
    return {
      key: 'unaffordable', cash, cost: amount, cashAfter, averageNet: null, days: null,
      label: 'not enough cash after this ' + formatCost(amount) + ' build (short ' + formatCost(Math.abs(cashAfter)) + ')',
    };
  }
  const runway = cashRunwaySummary(state, maxHistory);
  if (runway.averageNet == null) {
    return {
      key: 'unknown', cash, cost: amount, cashAfter, averageNet: null, days: null,
      label: 'operating flow unknown until the first day closes · cash after build ' + formatCost(cashAfter),
    };
  }
  if (runway.averageNet > 0) {
    return {
      key: 'positive', cash, cost: amount, cashAfter, averageNet: runway.averageNet, days: null,
      label: 'operating flow +' + formatCost(runway.averageNet) + '/day · cash after build ' + formatCost(cashAfter),
    };
  }
  if (runway.averageNet === 0) {
    return {
      key: 'break_even', cash, cost: amount, cashAfter, averageNet: 0, days: null,
      label: 'operating flow break-even · cash after build ' + formatCost(cashAfter),
    };
  }
  const days = cashAfter > 0 ? Math.max(1, Math.ceil(cashAfter / Math.abs(runway.averageNet))) : 0;
  const severity = days <= 3 ? 'critical' : 'watch';
  return {
    key: severity, cash, cost: amount, cashAfter, averageNet: runway.averageNet, days,
    label: 'expansion ' + (severity === 'critical' ? 'warning' : 'watch') + ' · about ' + days + ' operating day' + (days === 1 ? '' : 's') + ' after build at ' + formatCost(runway.averageNet) + '/day',
  };
}

/**
 * Find the strongest open floor for a recommended service while keeping the
 * affected room's floor as the coverage target. Target coverage is required;
 * ties then favor the placement that serves the most tenant heads, followed
 * by the most rooms, the shortest walk from the affected room, and the lower
 * floor for deterministic guidance.
 */
export function servicePlacementRecommendation(state, unit, kind, config) {
  if (!state || !unit || !kind || !config?.services?.[kind]) {
    return { key: 'unavailable', kind, targetFloor: unit?.floor ?? null, reason: 'service placement unavailable' };
  }
  const coverageFloors = Math.max(0, Number(config.services[kind].coverageFloors) || 0);
  const targetFloor = Number(unit.floor);
  if (!Number.isInteger(targetFloor) || targetFloor <= (config.building.lobbyFloor ?? 0) || targetFloor >= state.floors) {
    return { key: 'unavailable', kind, targetFloor, coverageFloors, reason: 'affected room is not on an upper floor' };
  }

  const candidates = [];
  const low = Math.max(config.building.lobbyFloor + 1, targetFloor - coverageFloors);
  const high = Math.min(state.floors - 1, targetFloor + coverageFloors);
  for (let floor = low; floor <= high; floor++) {
    const preview = servicePlacementCoveragePreview(state, kind, floor, config);
    if (!preview.available) continue;
    const targetCovered = preview.coveredUnitIds.includes(unit.id);
    if (!targetCovered) continue;
    candidates.push({
      floor,
      slot: preview.slot,
      targetCovered,
      beforeRooms: preview.beforeRooms,
      beforeHeads: preview.beforeHeads,
      coveredRooms: preview.afterRooms,
      coveredHeads: preview.afterHeads,
      totalRooms: preview.requiredRooms,
      totalHeads: preview.requiredHeads,
      distance: Math.abs(floor - targetFloor),
    });
  }

  candidates.sort((a, b) =>
    Number(b.targetCovered) - Number(a.targetCovered) ||
    b.coveredHeads - a.coveredHeads ||
    b.coveredRooms - a.coveredRooms ||
    a.distance - b.distance ||
    a.floor - b.floor);
  const best = candidates[0];
  if (!best) {
    return {
      key: 'blocked', kind, targetFloor, coverageFloors,
      reason: 'no open floor within service coverage of F' + targetFloor,
    };
  }
  return {
    key: 'ready', kind, targetFloor, coverageFloors,
    floor: best.floor, slot: best.slot,
    targetCovered: best.targetCovered,
    beforeRooms: best.beforeRooms,
    beforeHeads: best.beforeHeads,
    coveredRooms: best.coveredRooms,
    coveredHeads: best.coveredHeads,
    totalRooms: best.totalRooms,
    totalHeads: best.totalHeads,
    detail: 'F' + best.floor + ' covers F' + targetFloor + ' · currently ' + best.beforeRooms +
      '/' + best.totalRooms + ' covered (' + Math.max(0, best.totalRooms - best.beforeRooms) + ' remain) · reaches ' +
      best.coveredRooms + '/' + best.totalRooms + ' (' + best.coveredHeads + '/' + best.totalHeads + ' tenant heads)',
  };
}

/**
 * Convert a vacant room's access and required-service coverage into a small
 * applicant preference. Room evaluation remains the hard relisting gate; this
 * separate bounded signal decides which otherwise-ready vacancy feels easier
 * to lease when several rooms compete for the same daily move-in slots.
 */
export function tenantDemandQuality(state, unit, config) {
  const evaluation = unitEvaluation(state, unit, config);
  const tune = config.units[unit.kind] || {};
  const requirements = [
    ['food', 'foodNeed', 'foodCovered'],
    ['parking', 'parkingNeed', 'parkingCovered'],
    ['medical', 'medicalNeed', 'medicalCovered'],
    ['security', 'securityNeed', 'securityCovered'],
    ['recycling', 'recyclingNeed', 'recyclingCovered'],
  ].filter(([, need]) => (tune[need] ?? 0) > 0);
  const covered = requirements.filter(([, , coveredKey]) => Boolean(evaluation[coveredKey]));
  const serviceScore = requirements.length ? covered.length / requirements.length : 1;
  const accessTolerance = Math.max(1, Number(config.evaluation.accessToleranceSeconds) || 1);
  const accessScore = evaluation.accessSeconds == null
    ? 0
    : clamp(1 - evaluation.accessSeconds / (accessTolerance * 1.5));
  const score = Math.round(clamp(accessScore * 0.6 + serviceScore * 0.4) * 100);
  const experienceWeight = Math.max(0, Number(config.occupancy.experienceDemandWeight) || 0);
  const experienceBonus = Math.round((score / 100) * experienceWeight);
  const desirabilityScore = roomDesirabilityScore(evaluation, config);
  const desirabilityBase = Number(config.evaluation.desirabilityBase ?? 60);
  const desirabilityWeight = Math.max(0, Number(config.occupancy.desirabilityDemandWeight) || 0);
  const desirabilityBonus = desirabilityScore == null
    ? 0
    : Math.round(clamp((desirabilityScore - desirabilityBase) / 40, -1, 1) * desirabilityWeight);
  const bonus = experienceBonus + desirabilityBonus;
  const accessLabel = evaluation.accessSeconds == null
    ? 'no route'
    : (evaluation.accessMode ?? 'route') + ' ' + evaluation.accessSeconds + 's';
  const serviceLabel = requirements.length
    ? covered.length + '/' + requirements.length + ' services'
    : 'no required services';
  return {
    score,
    bonus,
    accessScore: Math.round(accessScore * 100),
    accessSeconds: evaluation.accessSeconds,
    accessMode: evaluation.accessMode,
    requiredServices: requirements.length,
    coveredServices: covered.length,
    missingServices: requirements.filter(([, , coveredKey]) => !evaluation[coveredKey]).map(([name]) => name),
    serviceScore: Math.round(serviceScore * 100),
    experienceBonus,
    desirabilityScore,
    desirabilityBonus,
    label: 'access ' + accessLabel + ' · ' + serviceLabel +
      ' · room desirability ' + (desirabilityScore == null ? 'unavailable' : desirabilityScore + '/100') +
      ' · appeal ' + (desirabilityBonus >= 0 ? '+' : '') + desirabilityBonus,
  };
}

/** Scale tenant-mix demand without changing room evaluation or the reputation gate. */
export function reputationDemandFactor(state, config, reputation = null) {
  const rep = reputation ?? state.log.at(-1)?.rep ?? 100;
  const weight = clamp(config.occupancy.reputationDemandWeight ?? 0);
  const floor = clamp(config.occupancy.reputationDemandFloor ?? 0);
  return Math.max(floor, 1 - weight * (1 - clamp(rep / 100)));
}

/** Return the market delay after applying healthy-building reputation. */
export function relistDaysFor(state, unit, config, reputation = null) {
  const baseDays = Math.max(0, Math.floor(config.units[unit.kind]?.relistDays ?? 0));
  const rep = reputation ?? state.log.at(-1)?.rep ?? 100;
  const gate = config.occupancy.relistMinDeliveryRate;
  const health = clamp((rep - gate) / Math.max(1, 100 - gate));
  const weight = Math.max(0, config.occupancy.reputationRelistSpeedWeight ?? 0);
  const reduction = Math.min(baseDays, Math.round(health * weight));
  return Math.max(0, baseDays - reduction);
}

/** Forecast the next leasing batch using the same gates and ranking as day close. */
export function leasingForecast(state, config, reputation = null) {
  const rep = reputation ?? state.log.at(-1)?.rep ?? 100;
  const gateOpen = rep >= config.occupancy.relistMinDeliveryRate;
  const transportAccess = tenantTransportForecastSignal(state, config);
  const mixDemand = tenantMixDemand(state, config);
  const vacant = state.units.filter((unit) => !unit.occupied);
  const eligible = vacant.map((unit) => {
    const experienceDemand = tenantDemandQuality(state, unit, config);
    const transportAccessBonus = Math.round(transportAccess.bonus * experienceDemand.accessScore / 100);
    return {
      unit,
      evaluation: unitEvaluation(state, unit, config),
      marketDemandBonus: marketDemandBonus(state, unit, config, rep),
      tenantMix: mixDemand.find((entry) => entry.kind === unit.kind) ?? null,
      experienceDemand: {
        ...experienceDemand,
        bonus: experienceDemand.bonus + transportAccessBonus,
        transportAccessBonus,
        label: experienceDemand.label + ' · access confidence ' + (transportAccessBonus >= 0 ? '+' : '') + transportAccessBonus,
      },
    };
  }).filter(({ unit, evaluation }) =>
    evaluation.score >= config.evaluation.relistMinScore &&
    unit.vacantDays >= relistDaysFor(state, unit, config, rep))
    .sort((a, b) => (b.evaluation.score + b.marketDemandBonus + b.experienceDemand.bonus) -
      (a.evaluation.score + a.marketDemandBonus + a.experienceDemand.bonus)
      || b.evaluation.score - a.evaluation.score
      || (b.unit.vacantDays ?? 0) - (a.unit.vacantDays ?? 0)
      || a.unit.id - b.unit.id);
  const capacity = gateOpen
    ? Math.max(0, Math.floor(config.occupancy.moveInCapacity ?? eligible.length))
    : 0;
  const candidates = gateOpen ? eligible : [];
  return {
    vacancies: vacant.length,
    marketReady: eligible.length,
    marketCandidates: eligible,
    candidates,
    capacity,
    expected: Math.min(candidates.length, capacity),
    gateOpen,
    reputation: rep,
    transportAccess,
  };
}

function tenantCapacity(unit, config) {
  const tune = config.units[unit.kind] || {};
  return tune.workers ?? tune.residents ?? tune.staff ?? tune.guests ?? unit.heads ?? 0;
}

/** Map occupancy and waiting bands onto the shared UI traffic-light language. */
export function indicatorColorKey(key) {
  const value = String(key ?? '').toLowerCase();
  return value === 'full' || value === 'clear' || value === 'improved' ? 'good'
    : value === 'light' || value === 'critical' || value === 'worsened' ? 'bad'
      : 'warn';
}

/** Classify a live queue with the same thresholds used by the renderer. */
export function waitingPressureSummary(count) {
  const raw = Number(count);
  const n = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const band = n === 0 ? 'clear' : n <= 4 ? 'watch' : n <= 11 ? 'busy' : 'critical';
  return {
    count: n,
    ratio: Math.min(1, n / 12),
    band,
    colorKey: indicatorColorKey(band),
  };
}

/** Explain the exact traffic-light meaning of a waiting-pressure band. */
export function waitingPressureColorMeaning(band) {
  if (band === 'clear') return 'green means clear (0 waiting)';
  if (band === 'watch' || band === 'busy') return 'amber means watch or busy (1–11 waiting)';
  return 'red means critical (12+ waiting)';
}

/** Summarize how full an occupied room is for the building overview. */
export function tenantLoadStatus(unit, config) {
  const capacity = Math.max(0, tenantCapacity(unit, config));
  const tenants = Math.max(0, Math.round(unit?.heads ?? 0));
  const ratio = capacity ? tenants / capacity : 0;
  const key = !capacity || !tenants ? 'light' : ratio < 0.5 ? 'light' : ratio < 0.75 ? 'partial' : 'full';
  return {
    tenants,
    capacity,
    ratio,
    key,
    colorKey: indicatorColorKey(key),
    label: key === 'full' ? 'full' : key === 'partial' ? 'partial' : 'light load',
  };
}

/** Explain the exact traffic-light meaning of a tenant-load band. */
export function tenantLoadColorMeaning(key) {
  if (key === 'full') return 'green means full (75%+ capacity)';
  if (key === 'partial') return 'amber means partial (50–74% capacity)';
  return 'red means light (under 50% capacity)';
}

/** Summarize occupied tenants against the building's total room capacity. */
export function tenantLoadSummary(state, config) {
  const units = state?.units ?? [];
  const tenants = units.reduce((sum, unit) => sum + (unit.occupied ? tenantLoadStatus(unit, config).tenants : 0), 0);
  const capacity = units.reduce((sum, unit) => sum + tenantLoadStatus(unit, config).capacity, 0);
  const ratio = capacity ? tenants / capacity : 0;
  const key = !capacity || !tenants ? 'light' : ratio < 0.5 ? 'light' : ratio < 0.75 ? 'partial' : 'full';
  return {
    tenants,
    capacity,
    ratio,
    key,
    colorKey: indicatorColorKey(key),
    label: key === 'full' ? 'full' : key === 'partial' ? 'partial' : 'light load',
  };
}

/** Combine a floor's live queue and tenant load into one local diagnosis. */
export function floorOperationsSummary(state, floor, config) {
  const floorNumber = Number(floor);
  const units = (state?.units ?? []).filter((unit) => unit.floor === floorNumber);
  const loads = units.map((unit) => tenantLoadStatus(unit, config));
  const tenants = loads.reduce((sum, load, index) => sum + (units[index].occupied ? load.tenants : 0), 0);
  const capacity = loads.reduce((sum, load) => sum + load.capacity, 0);
  const ratio = capacity ? tenants / capacity : 0;
  const key = !capacity || !tenants ? 'light' : ratio < 0.5 ? 'light' : ratio < 0.75 ? 'partial' : 'full';
  const waiting = (state?.people ?? []).filter((person) => person.state === 'waiting' && person.from === floorNumber).length;
  const waitingSummary = waitingPressureSummary(waiting);
  return {
    floor: floorNumber,
    rooms: units.length,
    vacantRooms: units.filter((unit) => !unit.occupied).length,
    tenants,
    capacity,
    ratio,
    key,
    colorKey: indicatorColorKey(key),
    waiting: waitingSummary.count,
    waitingBand: waitingSummary.band,
    waitingColorKey: waitingSummary.colorKey,
  };
}

/** Use one phrase for what each transport investment changes. */
export function transportCoverageText(kind = null) {
  if (kind === 'shaft') return 'a separate vertical route';
  if (kind === 'car') return 'capacity on the existing route';
  return 'each shaft serves its floor span as a separate vertical route; cars add capacity within that route';
}

/** Describe which other shaft routes share floors with one shaft. */
export function shaftRouteCoverageLabel(shaft, shafts = []) {
  if (!shaft || !Array.isArray(shafts)) return 'independent span';
  const bottom = Number(shaft.bottom);
  const top = Number(shaft.top);
  if (!Number.isFinite(bottom) || !Number.isFinite(top)) return 'independent span';
  const overlaps = shafts.map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate && candidate !== shaft)
    .map(({ candidate, index }) => ({
      index,
      bottom: Math.max(bottom, Number(candidate.bottom)),
      top: Math.min(top, Number(candidate.top)),
    }))
    .filter(({ bottom: overlapBottom, top: overlapTop }) =>
      Number.isFinite(overlapBottom) && Number.isFinite(overlapTop) && overlapBottom <= overlapTop)
    .map(({ index, bottom: overlapBottom, top: overlapTop }) =>
      'S' + (index + 1) + ' on floors ' + overlapBottom + '–' + overlapTop);
  return overlaps.length ? 'overlaps ' + overlaps.join('; ') : 'independent span';
}

/** Explain whether a proposed lobby-to-floor shaft adds or duplicates coverage. */
export function shaftCandidateCoverageLabel(bottom, top, shafts = []) {
  const candidateBottom = Number(bottom);
  const candidateTop = Number(top);
  if (!Number.isFinite(candidateBottom) || !Number.isFinite(candidateTop) || candidateTop < candidateBottom) {
    return 'coverage span unavailable';
  }
  const existing = Array.isArray(shafts)
    ? shafts.map((shaft, index) => ({ shaft, index }))
      .filter(({ shaft }) => shaft && Number.isFinite(Number(shaft.bottom)) && Number.isFinite(Number(shaft.top)))
    : [];
  const overlaps = existing.map(({ shaft, index }) => ({
    index,
    bottom: Math.max(candidateBottom, Number(shaft.bottom)),
    top: Math.min(candidateTop, Number(shaft.top)),
  })).filter(({ bottom: overlapBottom, top: overlapTop }) => overlapBottom <= overlapTop);
  const uncovered = [];
  for (let floor = candidateBottom; floor <= candidateTop; floor++) {
    if (!existing.some(({ shaft }) => Number(shaft.bottom) <= floor && Number(shaft.top) >= floor)) uncovered.push(floor);
  }
  const formatRanges = (floors) => {
    if (!floors.length) return '';
    const ranges = [];
    let start = floors[0];
    let end = start;
    for (const floor of floors.slice(1)) {
      if (floor === end + 1) end = floor;
      else {
        ranges.push(start === end ? String(start) : start + '–' + end);
        start = floor;
        end = floor;
      }
    }
    ranges.push(start === end ? String(start) : start + '–' + end);
    return ranges.join(', ');
  };
  if (!overlaps.length) return 'adds coverage on floors ' + formatRanges(uncovered);
  const overlapText = overlaps.map(({ index, bottom: overlapBottom, top: overlapTop }) =>
    'S' + (index + 1) + ' on floors ' + overlapBottom + '–' + overlapTop).join('; ');
  return uncovered.length
    ? 'overlaps ' + overlapText + ' and adds coverage on floors ' + formatRanges(uncovered)
    : 'duplicates existing coverage: overlaps ' + overlapText;
}

function floorRangeText(floors) {
  const values = [...new Set((floors ?? []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!values.length) return '';
  const ranges = [];
  let start = values[0];
  let end = start;
  for (const floor of values.slice(1)) {
    if (floor === end + 1) end = floor;
    else {
      ranges.push(start === end ? 'F' + start : 'F' + start + '–F' + end);
      start = floor;
      end = floor;
    }
  }
  ranges.push(start === end ? 'F' + start : 'F' + start + '–F' + end);
  return ranges.join(', ');
}

/** Compare a proposed shaft's route coverage with the floors creating demand. */
export function shaftCoverageDemandComparison(bottom, top, shafts = [], demandFloors = []) {
  const candidateBottom = Number(bottom);
  const candidateTop = Number(top);
  const pressure = [...new Set((demandFloors ?? []).map(Number)
    .filter((floor) => Number.isFinite(floor) && floor >= candidateBottom && floor > 0))].sort((a, b) => a - b);
  if (!Number.isFinite(candidateBottom) || !Number.isFinite(candidateTop) || candidateTop < candidateBottom) {
    return { key: 'invalid', pressure, added: [], overlap: [], coveredPressure: [], uncoveredPressure: [], label: 'coverage unavailable', detail: 'The proposed shaft span is not valid.' };
  }
  const floors = Array.from({ length: candidateTop - candidateBottom + 1 }, (_, index) => candidateBottom + index);
  const coveredByExisting = (floor) => (shafts ?? []).some((shaft) =>
    Number(shaft?.bottom) <= floor && Number(shaft?.top) >= floor);
  const overlap = floors.filter(coveredByExisting);
  const added = floors.filter((floor) => !coveredByExisting(floor));
  const coveredPressure = pressure.filter((floor) => floor <= candidateTop);
  const uncoveredPressure = pressure.filter((floor) => floor > candidateTop);
  const demandAdded = coveredPressure.filter((floor) => added.includes(floor));
  const demandOverlap = coveredPressure.filter((floor) => overlap.includes(floor));
  const key = uncoveredPressure.length
    ? 'misses_demand'
    : demandAdded.length
      ? 'adds_demand'
      : demandOverlap.length
        ? 'parallel_capacity'
        : added.length ? 'adds_coverage' : 'duplicate';
  const label = key === 'misses_demand'
    ? 'misses demand at ' + floorRangeText(uncoveredPressure)
    : key === 'adds_demand'
      ? 'adds pressure coverage at ' + floorRangeText(demandAdded)
      : key === 'parallel_capacity'
        ? 'parallel capacity on ' + floorRangeText(demandOverlap)
        : key === 'adds_coverage'
          ? 'adds coverage on ' + floorRangeText(added)
          : 'duplicate coverage only';
  const detail = pressure.length
    ? 'Demand floors: ' + floorRangeText(pressure) + '. ' + label + '.'
    : label + '.';
  return { key, pressure, added, overlap, coveredPressure, uncoveredPressure, label, detail };
}

/** Check whether a route preview can be placed with the current building. */
export function routePlacementStatus(kind, bottom, top, state, config, shaft = null, selectedSlot = null) {
  if (!state || !config) return { key: 'unknown', detail: 'placement cannot be checked yet' };
  const shafts = Array.isArray(state.shafts) ? state.shafts : [];
  if (kind === 'car') {
    if (!shaft) return { key: 'select', detail: 'hover a shaft to check placement' };
    const cars = Array.isArray(shaft.cars) ? shaft.cars : [];
    if (cars.length >= config.elevator.maxCarsPerShaft) {
      const alternateIndex = shafts.findIndex((candidate) => candidate !== shaft && (candidate.cars?.length ?? 0) < config.elevator.maxCarsPerShaft);
      return {
        key: 'blocked',
        detail: 'shaft is at its ' + config.elevator.maxCarsPerShaft + '-car limit',
        alternative: alternateIndex >= 0 ? 'try S' + (alternateIndex + 1) : 'build a new shaft for more capacity',
        alternativeAction: alternateIndex >= 0
          ? { kind: 'car', shaftId: shafts[alternateIndex].id }
          : { kind: 'shaft' },
      };
    }
    return { key: 'ready', detail: 'car can be added to this shaft' };
  }
  const candidateBottom = Number(bottom);
  const candidateTop = Number(top);
  const tune = kind === 'shaft' ? config.elevator : config[kind];
  if (!tune || !Number.isFinite(candidateBottom) || !Number.isFinite(candidateTop) || candidateTop <= candidateBottom) {
    return { key: 'invalid', detail: 'route must reach an upper floor', alternative: 'choose an upper floor' };
  }
  const span = candidateTop - candidateBottom + 1;
  if (span > tune.maxSpan) {
    return { key: 'invalid', detail: kind + ' span exceeds the ' + tune.maxSpan + '-floor limit', alternative: 'choose a shorter span' };
  }
  const candidateSlots = Number.isInteger(selectedSlot)
    ? [selectedSlot]
    : Array.from({ length: config.building.slotsPerFloor }, (_, slot) => slot);
  if (Number.isInteger(selectedSlot) && (selectedSlot < 0 || selectedSlot >= config.building.slotsPerFloor)) {
    return { key: 'invalid', detail: 'selected column is outside the building', alternative: 'choose a visible building column' };
  }
  const openSlot = candidateSlots
    .find((slot) => Array.from({ length: span }, (_, index) => candidateBottom + index)
      .every((floor) => !slotsUsed(state, floor).has(slot)));
  if (openSlot == null) {
    const carIndex = shafts.findIndex((candidate) => (candidate.cars?.length ?? 0) < config.elevator.maxCarsPerShaft);
    return {
      key: 'blocked',
      detail: Number.isInteger(selectedSlot)
        ? 'selected column is blocked across floors ' + candidateBottom + '–' + candidateTop
        : 'no clear column across floors ' + candidateBottom + '–' + candidateTop,
      alternative: carIndex >= 0 ? 'add a car to S' + (carIndex + 1) : 'free a route column',
      alternativeAction: carIndex >= 0
        ? { kind: 'car', shaftId: shafts[carIndex].id }
        : null,
    };
  }
  return { key: 'ready', slot: openSlot, detail: 'clear column available for placement' };
}

/** Report whether the shaft control has a full-span or shorter legal placement. */
export function shaftBuildControlStatus(state, config) {
  if (!state || !config) return { key: 'unknown', disabled: true, detail: 'shaft placement cannot be checked yet' };
  const bottom = config.building.lobbyFloor ?? 0;
  const maximumTop = Math.min(state.floors - 1, bottom + config.elevator.maxSpan - 1);
  if (maximumTop <= bottom) return { key: 'invalid', disabled: true, detail: 'shaft needs an upper floor' };

  const shaftCost = (top) => config.costs.shaft + config.costs.shaftPerFloor * (top - bottom + 1);
  const fullSpan = routePlacementStatus('shaft', bottom, maximumTop, state, config);
  if (fullSpan.key === 'ready') return { key: 'ready', disabled: false, top: maximumTop, cost: shaftCost(maximumTop), detail: 'place a new shaft' };

  // Prefer the longest shorter span so the control still points to the most
  // useful remaining placement when the top floor column is blocked.
  for (let top = maximumTop - 1; top > bottom; top--) {
    const shorterSpan = routePlacementStatus('shaft', bottom, top, state, config);
    if (shorterSpan.key === 'ready') {
      return {
        key: 'shorter',
        disabled: false,
        top,
        cost: shaftCost(top),
        detail: 'full shaft span is blocked; shorter span through F' + top + ' is available',
      };
    }
  }

  return {
    key: fullSpan.key,
    disabled: true,
    detail: fullSpan.key === 'invalid'
      ? fullSpan.detail
      : 'no clear shaft column for the available span; free a route column',
  };
}

/** Project the coverage and starting/upgradable capacity of a new shaft. */
export function shaftPlacementProjection(bottom, top, config) {
  const span = Math.max(0, Math.floor(Number(top) - Number(bottom) + 1));
  const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
  const maxCars = Math.max(0, Math.floor(Number(config?.elevator?.maxCarsPerShaft) || 0));
  const carCost = Math.max(0, Number(config?.costs?.car) || 0);
  return {
    floors: span,
    startingCars: span >= 2 ? 1 : 0,
    startingCapacity: span >= 2 ? carCapacity : 0,
    maxCars,
    maxCapacity: maxCars * carCapacity,
    additionalCars: Math.max(0, maxCars - (span >= 2 ? 1 : 0)),
    additionalCapacity: Math.max(0, maxCars * carCapacity - (span >= 2 ? carCapacity : 0)),
    carCost,
  };
}

/** Project the current and remaining capacity for an existing shaft. */
export function shaftCapacityProjection(shaft, config) {
  const currentCars = Math.max(0, Array.isArray(shaft?.cars) ? shaft.cars.length : 0);
  const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
  const maxCars = Math.max(0, Math.floor(Number(config?.elevator?.maxCarsPerShaft) || 0));
  return {
    currentCars,
    currentCapacity: currentCars * carCapacity,
    remainingCars: Math.max(0, maxCars - currentCars),
    remainingCapacity: Math.max(0, maxCars * carCapacity - currentCars * carCapacity),
    maxCars,
    maxCapacity: maxCars * carCapacity,
    carCost: Math.max(0, Number(config?.costs?.car) || 0),
  };
}

/** Compare the first car in a new shaft with one more car on an existing route. */
export function shaftInvestmentComparison(shaft, bottom, top, state, config) {
  const proposed = shaftPlacementProjection(bottom, top, config);
  const shaftCost = Math.max(0, Number(config?.costs?.shaft) || 0) +
    Math.max(0, Number(config?.costs?.shaftPerFloor) || 0) * Math.max(0, Number(top) - Number(bottom) + 1);
  const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
  const car = shaft ? shaftCapacityProjection(shaft, config) : null;
  const queue = shaft ? shaftQueueReliefProjection(shaft, state, config) : null;
  return {
    shaftCost,
    shaftFloors: proposed.floors,
    shaftCapacityGain: proposed.startingCapacity,
    shaftMaxCapacity: proposed.maxCapacity,
    carCost: car?.carCost ?? Math.max(0, Number(config?.costs?.car) || 0),
    carAvailable: Boolean(car?.remainingCars),
    carCapacityGain: car?.remainingCars ? carCapacity : 0,
    carCurrentCapacity: car?.currentCapacity ?? 0,
    carNextCapacity: car?.remainingCars ? (car.currentCapacity + carCapacity) : car?.currentCapacity ?? 0,
    carQueue: queue?.queue ?? 0,
    carWaitBefore: queue?.currentWaitSeconds ?? 0,
    carWaitAfter: queue?.nextWaitSeconds ?? 0,
    carReliefSeconds: queue?.reliefSeconds ?? 0,
  };
}

/** Estimate the queue-wait change from adding one car to an existing shaft. */
export function shaftQueueReliefProjection(shaft, state, config) {
  const currentCars = Math.max(0, Array.isArray(shaft?.cars) ? shaft.cars.length : 0);
  const maxCars = Math.max(0, Math.floor(Number(config?.elevator?.maxCarsPerShaft) || 0));
  const queue = shaft
    ? (state?.people ?? []).filter((person) => person.state === 'waiting' && person.shaft === shaft.id).length
    : 0;
  const doorTime = Math.max(0, Number(config?.elevator?.doorTime) || 0);
  const boardTime = Math.max(0, Number(config?.elevator?.boardTime) || 0);
  const carCapacity = Math.max(0, Number(config?.elevator?.capacity) || 0);
  const serviceWave = doorTime + boardTime * carCapacity;
  const nextCars = Math.min(maxCars, currentCars + 1);
  const currentWaitSeconds = (queue / Math.max(1, currentCars)) * serviceWave;
  const nextWaitSeconds = (queue / Math.max(1, nextCars)) * serviceWave;
  return {
    queue,
    currentCars,
    nextCars,
    serviceWave,
    currentWaitSeconds,
    nextWaitSeconds,
    reliefSeconds: Math.max(0, currentWaitSeconds - nextWaitSeconds),
    available: nextCars > currentCars,
  };
}

/** Classify whether closed-day queue pressure is repeated or only a recent spike. */
export function shaftQueueDailyPressure(history, minDays = 2) {
  const requiredDays = Math.max(2, Math.floor(Number(minDays) || 2));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.average)),
      peak: Math.max(0, Number(entry?.peak)),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak));
  const pressureDays = entries.filter((entry) => entry.average >= 2 || entry.peak >= 5);
  let consecutiveDays = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (!(entry.average >= 2 || entry.peak >= 5)) break;
    consecutiveDays++;
  }
  const sustained = consecutiveDays >= requiredDays;
  const latest = entries.at(-1) ?? null;
  const peak = entries.length ? Math.max(...entries.map((entry) => entry.peak)) : 0;
  return {
    entries,
    days: entries.length,
    pressureDays: pressureDays.length,
    consecutiveDays,
    sustained,
    latest,
    peak,
    key: sustained ? 'sustained' : pressureDays.length ? 'spike' : 'clear',
    label: sustained
      ? 'sustained ' + consecutiveDays + 'd'
      : pressureDays.length
        ? 'one-day spike'
        : 'no sustained pressure',
  };
}

function localRouteResponseOption(state, config, targetFloors = [], pressurePeople = [], excludedRouteKeys = new Set()) {
  const routeCapacity = (kind) => Math.max(1, Math.floor(Number(config?.[kind]?.capacity) || 0));
  const servesTarget = (route) => !targetFloors.length || targetFloors.some((floor) =>
    Number(route?.bottom) <= floor && Number(route?.top) >= floor);
  const existing = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator', existing: true, occupancy: localRouteOccupancy(state, 'escalator', route.id), capacity: routeCapacity('escalator') })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs', existing: true, occupancy: localRouteOccupancy(state, 'stairs', route.id), capacity: routeCapacity('stairs') })) : []),
  ].filter((route) => servesTarget(route) && route.occupancy < route.capacity &&
    !excludedRouteKeys.has(route.kind + ':' + route.id));
  const placeable = state?.lobby
    ? ['stairs', 'escalator'].map((kind) => {
      const option = routeOption(state, config, kind);
      const top = Math.min(state.floors - 1, (config[kind]?.maxSpan ?? 0) - 1);
      return { ...option, bottom: config.building.lobbyFloor ?? 0, top, slot: option.slot, capacity: routeCapacity(kind), occupancy: 0 };
    }).filter((option) => option.available && (!targetFloors.length || targetFloors.some((floor) => floor <= option.top)))
    : [];
  const options = [...existing, ...placeable].map((option) => {
    const people = (pressurePeople.length ? pressurePeople : (state?.people ?? [])).filter((person) => {
      if (person.state !== 'waiting') return false;
      const from = Number(person.from);
      const to = Number(person.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
      const low = Math.min(from, to);
      const high = Math.max(from, to);
      return Number(option.bottom) <= low && Number(option.top) >= high;
    });
    const times = people.map((person) => option.kind === 'stairs'
      ? stairAccessSeconds(state, person, option, config)
      : escalatorAccessSeconds(state, person, option, config));
    const targetCoverage = targetFloors.filter((floor) => Number(option.bottom) <= floor && Number(option.top) >= floor);
    const fallbackTime = targetCoverage.length
      ? Math.max(...targetCoverage.map((floor) => Math.abs(floor - (config.building.lobbyFloor ?? 0)))) *
        (option.kind === 'stairs' ? config.stairs.walkSecondsPerFloor : config.escalator.travelSecondsPerFloor)
      : 0;
    const wave = pressureWave(people.length, option.capacity, option.occupancy);
    return {
      ...option,
      coverageFloors: targetCoverage,
      coveredTrips: people.length,
      firstWaveCapacity: wave.capacity,
      firstWaveTrips: wave.trips,
      overflowTrips: wave.overflow,
      averageSeconds: times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : fallbackTime,
      maxSeconds: times.length ? Math.max(...times) : fallbackTime,
    };
  }).filter((option) => option.coveredTrips > 0 || option.coverageFloors.length > 0);
  return options.sort((a, b) => a.averageSeconds - b.averageSeconds || (a.cost ?? 0) - (b.cost ?? 0))[0] ?? null;
}

function saturatedLocalRouteDetail(state, config, targetFloors = [], pressurePeople = []) {
  const routes = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
  ];
  const coversPressure = (route) => {
    const people = pressurePeople.filter((person) => {
      const from = Number(person.from);
      const to = Number(person.to);
      return Number.isFinite(from) && Number.isFinite(to) && Number(route.bottom) <= Math.min(from, to) && Number(route.top) >= Math.max(from, to);
    });
    return pressurePeople.length
      ? people.length > 0
      : targetFloors.some((floor) => Number(route.bottom) <= floor && Number(route.top) >= floor);
  };
  const full = routes.filter((route) => coversPressure(route) &&
    localRouteOccupancy(state, route.kind, route.id) >= Math.max(1, Math.floor(Number(config?.[route.kind]?.capacity) || 0)));
  if (!full.length) return '';
  const labels = full.map((route) => route.kind === 'escalator' ? 'the escalator' : 'the stairs');
  const verb = full.length === 1 && full[0].kind === 'escalator' ? 'is' : 'are';
  return ' ' + labels.join(' and ') + ' already ' + verb + ' at simultaneous capacity; wait for space or add a different route.';
}

function localRoutePressureCandidates(state, config, historyByRoute) {
  if (!(historyByRoute instanceof Map)) return [];
  const routes = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
  ];
  return routes
    .map((route) => ({
      ...route,
      key: route.kind + ':' + route.id,
      pressure: localRouteDailyPressure(historyByRoute.get(route.kind + ':' + route.id)),
    }))
    .filter((route) => route.pressure.sustained)
    .sort((a, b) => b.pressure.consecutiveDays - a.pressure.consecutiveDays ||
      (b.pressure.latest?.ratio ?? 0) - (a.pressure.latest?.ratio ?? 0));
}

function localOverflowRoutePressureCandidates(state) {
  const routes = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
  ];
  return routes
    .map((route) => {
      const history = localOverflowRouteHistory(state?.log, route.kind, route.id);
      return { ...route, key: route.kind + ':' + route.id, pressure: localOverflowDailyPressure(history), source: 'overflow' };
    })
    .filter((route) => route.pressure.sustained)
    .sort((a, b) => b.pressure.consecutiveDays - a.pressure.consecutiveDays ||
      (b.pressure.latest?.average ?? 0) - (a.pressure.latest?.average ?? 0));
}

/** Return a zero-filled recent history for one route so missing overflow days count as clear. */
export function localOverflowRouteHistory(history, kind, routeId, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 6));
  return (Array.isArray(history) ? history : [])
    .slice(-limit)
    .map((day) => {
      const record = (day?.localOverflowRoutes ?? []).find((entry) =>
        entry.kind === kind && Number(entry.routeId) === Number(routeId));
      return {
        day: day?.day,
        localOverflowAverage: record?.average ?? 0,
        localOverflowPeak: record?.peak ?? 0,
        localOverflowPenalty: record?.penalty ?? 0,
      };
    });
}

function localRoutePressurePreview(state, config, kind, placement) {
  if (!placement?.available) return { coveredTrips: 0, elevatorTripsRelieved: 0, localTripsRelieved: 0, unassignedTripsRelieved: 0, averageSeconds: null };
  const coverage = waitingPressureCoverage(state, (person) => {
    const from = Number(person.from);
    const to = Number(person.to);
    return Number.isFinite(from) && Number.isFinite(to) && Number(placement.bottom) <= Math.min(from, to) && Number(placement.top) >= Math.max(from, to);
  });
  const times = coverage.people.map((person) => kind === 'stairs'
    ? stairAccessSeconds(state, person, placement, config)
    : escalatorAccessSeconds(state, person, placement, config));
  return {
    coveredTrips: coverage.coveredTrips,
    elevatorTripsRelieved: coverage.elevatorTripsRelieved,
    localTripsRelieved: coverage.localTripsRelieved,
    unassignedTripsRelieved: coverage.unassignedTripsRelieved,
    averageSeconds: times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : null,
  };
}

export function firstWavePressure(waiting, occupied, capacity) {
  const trips = Math.max(0, Math.floor(Number(waiting) || 0));
  const availableCapacity = Math.max(0, Math.floor(Number(capacity) || 0) - Math.max(0, Math.floor(Number(occupied) || 0)));
  return {
    capacity: availableCapacity,
    trips: Math.min(trips, availableCapacity),
    overflow: Math.max(0, trips - availableCapacity),
  };
}

function pressureWave(coveredTrips, capacity, occupancy = 0) {
  return firstWavePressure(coveredTrips, occupancy, capacity);
}

function waitingPressureCoverage(state, covers) {
  const people = (state?.people ?? []).filter((person) => person.state === 'waiting' && covers(person));
  return {
    people,
    coveredTrips: people.length,
    elevatorTripsRelieved: people.filter((person) => person.shaft != null).length,
    localTripsRelieved: people.filter((person) => person.localRouteKind).length,
    unassignedTripsRelieved: people.filter((person) => person.shaft == null && !person.localRouteKind).length,
  };
}

function shaftPressurePreview(state, shaftId) {
  return waitingPressureCoverage(state, (person) => person.shaft === shaftId);
}

function spanPressurePreview(state, bottom, top) {
  return waitingPressureCoverage(state, (person) => {
    const from = Number(person.from);
    const to = Number(person.to);
    return Number.isFinite(from) && Number.isFinite(to) && Number(bottom) <= Math.min(from, to) && Number(top) >= Math.max(from, to);
  });
}

/** Turn waiting people without a shaft assignment into a concrete route hint. */
export function unassignedQueueResponse(state, config) {
  const waiting = (state?.people ?? []).filter((person) => person.state === 'waiting' && person.shaft == null && !person.localRouteKind);
  const hasLocalWaiting = (state?.people ?? []).some((person) => person.state === 'waiting' && person.localRouteKind);
  const origins = new Map();
  for (const person of waiting) {
    const floor = Number(person.from);
    if (!Number.isFinite(floor)) continue;
    origins.set(floor, (origins.get(floor) || 0) + 1);
  }
  const originRows = [...origins.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([floor, count]) => ({ floor, count }));
  const floorLabel = (floors) => floors.map((floor) => 'F' + floor).join(', ');
  if (!waiting.length) {
    return {
      key: 'clear',
      label: 'no missing route',
      detail: hasLocalWaiting
        ? 'All waiting people currently have an assigned elevator or local route.'
        : 'All waiting people currently have an assigned shaft.',
      waiting: 0,
      origins: originRows,
      localFloors: [],
      buildableLocalFloors: [],
      elevatorFloors: [],
      localLabel: null,
      localBuildLabel: null,
      localBuildKind: null,
    };
  }

  const localRoutes = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
  ];
  const buildableLocalRoutes = state?.lobby
    ? ['stairs', 'escalator'].map((kind) => {
      const option = routeOption(state, config, kind);
      const top = Math.min(state.floors - 1, (config[kind]?.maxSpan ?? 0) - 1);
      return { ...option, kind, bottom: config.building.lobbyFloor ?? 0, top };
    }).filter((route) => route.available)
    : [];
  const localFloors = new Set();
  const buildableLocalFloors = new Set();
  const elevatorFloors = new Set();
  const existingLocalKinds = new Set();
  const buildableLocalKinds = new Set();
  let recommendedBuildableRoute = null;
  const routeSpeed = (route) => route.kind === 'escalator'
    ? Number(config?.escalator?.travelSecondsPerFloor)
    : Number(config?.stairs?.walkSecondsPerFloor);
  const coversTrip = (route, from, to) => {
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    return Number.isFinite(low) && Number.isFinite(high) &&
      Number(route.bottom) <= low && Number(route.top) >= high;
  };
  for (const person of waiting) {
    const from = Number(person.from);
    const to = Number(person.to);
    const floor = Number(person.from);
    const existingRoute = localRoutes.find((route) => coversTrip(route, from, to));
    const buildableRoute = existingRoute ? null : buildableLocalRoutes
      .filter((route) => coversTrip(route, from, to))
      .sort((a, b) => routeSpeed(a) - routeSpeed(b))[0] ?? null;
    if (existingRoute && Number.isFinite(floor)) {
      localFloors.add(floor);
      existingLocalKinds.add(existingRoute.kind);
    } else if (buildableRoute && Number.isFinite(floor)) {
      buildableLocalFloors.add(floor);
      buildableLocalKinds.add(buildableRoute.kind);
      recommendedBuildableRoute = recommendedBuildableRoute ?? buildableRoute;
    } else if (Number.isFinite(floor)) elevatorFloors.add(floor);
  }
  const localFloorList = [...localFloors].sort((a, b) => a - b);
  const buildableLocalFloorList = [...buildableLocalFloors].sort((a, b) => a - b);
  const elevatorFloorList = [...elevatorFloors].sort((a, b) => a - b);
  const localKinds = [...existingLocalKinds];
  const buildableKinds = [...buildableLocalKinds];
  const localLabel = localKinds.includes('escalator') && localKinds.includes('stairs')
    ? 'stairs/escalator'
    : localKinds.includes('escalator') ? 'escalator' : 'stairs';
  const buildableLocalKind = buildableKinds.sort((a, b) => {
    const aSpeed = routeSpeed({ kind: a });
    const bSpeed = routeSpeed({ kind: b });
    return (Number.isFinite(aSpeed) ? aSpeed : Infinity) - (Number.isFinite(bSpeed) ? bSpeed : Infinity);
  })[0] ?? null;
  const buildableLocalLabel = buildableLocalKind === 'escalator' ? 'an escalator' : 'stairs';
  const buildableLocalTop = Number.isFinite(Number(recommendedBuildableRoute?.top))
    ? Number(recommendedBuildableRoute.top) : null;
  const buildableLocalTargetTop = buildableLocalFloorList.length ? Math.max(...buildableLocalFloorList) : null;
  const buildableLocalBottom = Number.isFinite(Number(recommendedBuildableRoute?.bottom))
    ? Number(recommendedBuildableRoute.bottom) : null;
  const buildableLocalCost = buildableLocalKind && buildableLocalTargetTop != null && buildableLocalBottom != null
    ? Number(config?.costs?.[buildableLocalKind]) + Number(config?.costs?.[buildableLocalKind + 'PerFloor']) *
      Math.max(0, buildableLocalTargetTop - buildableLocalBottom)
    : null;
  const originText = originRows.length ? floorLabel(originRows.map(({ floor }) => floor)) : 'the affected floors';
  const localText = localFloorList.length ? 'Use ' + localLabel + ' for ' + floorLabel(localFloorList) + '.' : '';
  const buildableLocalText = buildableLocalFloorList.length
    ? 'Build ' + buildableLocalLabel + ' to serve ' + floorLabel(buildableLocalFloorList) +
      (buildableLocalBottom != null && buildableLocalTop != null
        ? ' (legal span F' + buildableLocalBottom + '–F' + buildableLocalTop +
          (buildableLocalCost != null ? '; estimated cost to F' + buildableLocalTargetTop + ' ' + formatCost(buildableLocalCost) : '') + ').'
        : '.')
    : '';
  const elevatorText = elevatorFloorList.length
    ? 'Build or extend an elevator shaft to reach ' + floorLabel(elevatorFloorList) + '.'
    : '';
  const hasLocalFix = localFloorList.length || buildableLocalFloorList.length;
  return {
    key: hasLocalFix && elevatorFloorList.length ? 'mixed' : elevatorFloorList.length ? 'shaft'
      : buildableLocalFloorList.length ? 'local_build' : 'local',
    label: hasLocalFix && elevatorFloorList.length
      ? 'split local and elevator routes'
      : elevatorFloorList.length ? 'build or extend a shaft'
        : buildableLocalFloorList.length ? 'build a local route' : 'use a local route',
    detail: 'Unassigned W ' + waiting.length + ' starts on ' + originText + '. ' +
      (localText || buildableLocalText || 'No existing stairs or escalator covers these trips.') + ' ' +
      (buildableLocalText && localText ? buildableLocalText + ' ' : '') +
      (elevatorText || (hasLocalFix ? 'No elevator response is needed for the locally covered trips.' : 'Build a shaft or add a local route before these trips can be served.')),
    waiting: waiting.length,
    origins: originRows,
    localFloors: localFloorList,
    buildableLocalFloors: buildableLocalFloorList,
    elevatorFloors: elevatorFloorList,
    localLabel: localFloorList.length ? localLabel : null,
    localBuildLabel: buildableLocalFloorList.length ? buildableLocalLabel : null,
    localBuildKind: buildableLocalFloorList.length ? buildableLocalKind : null,
    localBuildBottom: buildableLocalFloorList.length ? buildableLocalBottom : null,
    localBuildLegalTop: buildableLocalFloorList.length ? buildableLocalTop : null,
    localBuildTargetTop: buildableLocalFloorList.length ? buildableLocalTargetTop : null,
    localBuildCost: buildableLocalFloorList.length ? buildableLocalCost : null,
  };
}

function waitingTargetFloors(state, shaftIds) {
  const targets = new Map();
  for (const person of state?.people ?? []) {
    if (person.state !== 'waiting' || !shaftIds.has(person.shaft)) continue;
    const from = Number(person.from);
    const to = Number(person.to);
    const floor = Math.max(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0);
    if (floor <= 0) continue;
    targets.set(floor, (targets.get(floor) || 0) + 1);
  }
  return [...targets.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([floor]) => floor);
}

/** Explain whether sustained pressure calls for a car, shaft, or local route. */
export function transportResponseRecommendation(state, config, historyByShaft = null, historyByLocalRoute = null) {
  const queueRecommendation = shaftQueueReliefRecommendation(state, config, historyByShaft);
  const candidates = queueRecommendation.candidates;
  const shafts = state?.shafts ?? [];
  const waiting = (state?.people ?? []).filter((person) => person.state === 'waiting');
  const localRoutePressure = localRoutePressureCandidates(state, config, historyByLocalRoute);
  const localOverflowRoutePressure = localOverflowRoutePressureCandidates(state);
  const localPressure = localOverflowRoutePressure.length ? localOverflowRoutePressure : localRoutePressure;
  const localOverflow = localOverflowDailyPressure(state?.log);
  const availableMoney = Number.isFinite(Number(state?.money)) ? Number(state.money) : Infinity;
  const withBudget = (response, cost, label) => {
    const amount = Number(cost);
    if (!Number.isFinite(amount)) return { ...response, affordable: true, cost: null, fundsGap: 0, averageNet: null, runwayDays: 0 };
    const fundsGap = Math.max(0, amount - availableMoney);
    const recentNet = (state?.log ?? [])
      .slice(-3)
      .map((day) => Number(day.net))
      .filter(Number.isFinite);
    const averageNet = recentNet.length
      ? +(recentNet.reduce((sum, net) => sum + net, 0) / recentNet.length).toFixed(2)
      : null;
    const runwayDays = fundsGap === 0 || averageNet == null || averageNet <= 0
      ? fundsGap === 0 ? 0 : null
      : Math.ceil(fundsGap / averageNet);
    if (fundsGap === 0) return { ...response, affordable: true, cost: amount, fundsGap, averageNet, runwayDays };
    const runwayText = averageNet == null
      ? ' Run one day to establish an earnings runway.'
      : averageNet > 0
        ? ' Recent net averages +' + formatCost(averageNet) + '/day, so this is about ' + runwayDays + ' day' + (runwayDays === 1 ? '' : 's') + ' away.'
        : ' Recent net averages -' + formatCost(Math.abs(averageNet)) + '/day, so there is no positive earnings runway yet.';
    return {
      ...response,
      key: 'budget',
      affordable: false,
      cost: amount,
      fundsGap,
      averageNet,
      runwayDays,
      label: 'save for ' + label,
      detail: response.detail + ' It costs ' + formatCost(amount) + '; you have ' + formatCost(availableMoney) + ' — save ' + formatCost(fundsGap) + ' more.' + runwayText,
    };
  };
  const sustained = candidates
    .filter((candidate) => candidate.dailyPressure.sustained)
    .sort((a, b) => b.dailyPressure.consecutiveDays - a.dailyPressure.consecutiveDays ||
      b.dailyPressure.latest.average - a.dailyPressure.latest.average || a.shaftIndex - b.shaftIndex);
  const liveCar = queueRecommendation.best?.reliefSeconds > 0 ? queueRecommendation.best : null;
  if (liveCar) {
    const currentRouteFloors = [...new Set(waiting
      .flatMap((person) => [Number(person.from), Number(person.to)])
      .filter((floor) => Number.isFinite(floor) && floor >= 0))];
    const broaderLocal = localRouteResponseOption(state, config, currentRouteFloors, waiting,
      new Set(localPressure.map((route) => route.key)));
    const localCost = broaderLocal?.existing ? 0 : Number(broaderLocal?.cost);
    const localCostPerWait = broaderLocal && broaderLocal.coveredTrips > 0 && Number.isFinite(localCost)
      ? localCost / broaderLocal.coveredTrips
      : null;
    const carCostPerWait = liveCar.queue > 0
      ? Number(config?.costs?.car) / liveCar.queue
      : null;
    const carFirstWave = pressureWave(liveCar.queue, config?.elevator?.capacity).trips;
    const localFirstWave = broaderLocal?.firstWaveTrips ?? 0;
    const sameCoverageCheaperLocal = broaderLocal && broaderLocal.coveredTrips === liveCar.queue &&
      localFirstWave === carFirstWave &&
      localCostPerWait != null && carCostPerWait != null && localCostPerWait < carCostPerWait;
    const strongerImmediateLocal = broaderLocal && localFirstWave > carFirstWave;
    const broaderSameWaveLocal = broaderLocal && localFirstWave === carFirstWave && broaderLocal.coveredTrips > liveCar.queue;
    const sustainedOverflowLocal = localOverflow.sustained && localPressure.length > 0 && broaderLocal && broaderLocal.coveredTrips > 0;
    if (broaderLocal && (strongerImmediateLocal || broaderSameWaveLocal || sameCoverageCheaperLocal || sustainedOverflowLocal)) {
      const localLabel = broaderLocal.kind === 'escalator' ? 'an escalator' : 'stairs';
      const dailyThroughputEstimate = Number.isFinite(Number(broaderLocal.averageSeconds)) && Number(broaderLocal.averageSeconds) > 0
        ? Math.max(1, Math.floor((Number(config?.time?.daySeconds) || 0) / Number(broaderLocal.averageSeconds)))
        : null;
      const valueDetail = sameCoverageCheaperLocal
        ? ' It covers the same ' + broaderLocal.coveredTrips + ' current waits at about ' + formatCost(localCostPerWait) +
          ' per wait versus about ' + formatCost(carCostPerWait) + ' for the car.'
        : '';
      const waveDetail = broaderLocal.overflowTrips > 0
        ? ' First wave handles ' + broaderLocal.firstWaveTrips + ' of those waits; ' + broaderLocal.overflowTrips + ' remain queued behind its simultaneous capacity.'
        : ' Its first wave handles all ' + broaderLocal.coveredTrips + ' of those waits.';
      return withBudget({
        key: 'local',
        kind: broaderLocal.kind,
        control: broaderLocal.kind,
        basis: sustainedOverflowLocal ? 'sustained local overflow' : 'broader current coverage',
        sourceRouteKind: sustainedOverflowLocal && localPressure[0]?.source === 'overflow' ? localPressure[0].kind : null,
        sourceRouteId: sustainedOverflowLocal && localPressure[0]?.source === 'overflow' ? localPressure[0].id : null,
        sourceRouteBottom: sustainedOverflowLocal && localPressure[0]?.source === 'overflow' ? localPressure[0].bottom : null,
        sourceRouteTop: sustainedOverflowLocal && localPressure[0]?.source === 'overflow' ? localPressure[0].top : null,
        label: broaderLocal.existing ? 'use ' + localLabel : 'build ' + localLabel,
        targetFloors: currentRouteFloors,
        averageSeconds: broaderLocal.averageSeconds,
        coveredTrips: broaderLocal.coveredTrips,
        existing: Boolean(broaderLocal.existing),
        targetFloor: currentRouteFloors.length ? Math.max(...currentRouteFloors) : null,
        routeBottom: broaderLocal.bottom,
        routeTop: broaderLocal.top,
        routeSlot: broaderLocal.slot,
        routeOccupancy: broaderLocal.occupancy ?? 0,
        routeCapacity: Math.max(1, Math.floor(Number(config?.[broaderLocal.kind]?.capacity) || 0)),
        dailyThroughputEstimate,
        detail: (broaderLocal.existing ? 'Use ' + localLabel : 'Build ' + localLabel) +
          ' because it covers ' + broaderLocal.coveredTrips + ' current waits across the tower; adding a car to S' +
          (liveCar.shaftIndex + 1) + ' addresses ' + liveCar.queue + ' on that shaft.' +
          (broaderLocal.coverageFloors.length ? ' It reaches ' + broaderLocal.coverageFloors.map((floor) => 'F' + floor).join(', ') + '.' : '') +
          waveDetail +
          (broaderLocal.coveredTrips ? ' Estimated travel time for these trips: ' + broaderLocal.averageSeconds.toFixed(1) + 's.' : '') +
          valueDetail +
          (sustainedOverflowLocal ? ' Repeated local overflow makes this the preferred relief even though the elevator queue is also active.' : '') +
          (dailyThroughputEstimate != null ? ' Planning estimate: about ' + dailyThroughputEstimate + ' trips per day at that travel time; this is not yet a hard route capacity limit.' : ''),
      }, broaderLocal.existing ? null : broaderLocal.cost, localLabel);
    }
    const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
    return withBudget({
      key: 'car',
      kind: 'car',
      control: 'car',
      shaftId: liveCar.shaftId,
      basis: 'live queue',
      label: 'add a car to S' + (liveCar.shaftIndex + 1),
      detail: 'S' + (liveCar.shaftIndex + 1) + ' has ' + liveCar.queue + ' people waiting now; one more car cuts the projected wait from ' +
        liveCar.currentWaitSeconds.toFixed(1) + 's to ' + liveCar.nextWaitSeconds.toFixed(1) + 's on the existing route. Cost ' +
        formatCost(config?.costs?.car) + ' · +' + carCapacity + ' riders per dispatch.',
    }, config?.costs?.car, 'a car on S' + (liveCar.shaftIndex + 1));
  }

  const hasPressure = waiting.length > 0 || sustained.length > 0 || localOverflow.sustained;
  if (!hasPressure) {
    return {
      key: 'monitor',
      kind: null,
      control: null,
      basis: 'no repeated pressure',
      label: 'monitor transport',
      detail: 'No live queue or repeated daily pressure is asking for a transport change yet.',
    };
  }

  if (localPressure.length) {
    const overloadedKeys = new Set(localPressure.map((route) => route.key));
    const localWaiting = waiting.filter((person) => person.localRouteKind === 'stairs' || person.localRouteKind === 'escalator');
    const primary = localPressure[0];
    const waitingTargets = [...new Set(localWaiting
      .flatMap((person) => [Number(person.from), Number(person.to)])
      .filter((floor) => Number.isFinite(floor) && floor >= 0))];
    const targetFloors = waitingTargets.length
      ? waitingTargets
      : Number.isFinite(Number(primary.top)) ? [Number(primary.top)] : [];
    const local = localRouteResponseOption(state, config, targetFloors, localWaiting, overloadedKeys);
    const primaryLabel = primary.kind === 'escalator' ? 'escalator' : 'stairs';
    const primarySpan = primary.source === 'overflow' && Number.isFinite(Number(primary.bottom)) && Number.isFinite(Number(primary.top))
      ? ' on F' + primary.bottom + '–F' + primary.top : '';
    if (local) {
      const localLabel = local.kind === 'escalator' ? 'an escalator' : 'stairs';
      const dailyThroughputEstimate = Number.isFinite(Number(local.averageSeconds)) && Number(local.averageSeconds) > 0
        ? Math.max(1, Math.floor((Number(config?.time?.daySeconds) || 0) / Number(local.averageSeconds)))
        : null;
      return withBudget({
        key: 'local',
        kind: local.kind,
        control: local.kind,
        basis: localOverflow.sustained ? 'sustained local overflow' : 'sustained local-route pressure',
        sourceRouteKind: localPressure[0]?.source === 'overflow' ? localPressure[0].kind : null,
        sourceRouteId: localPressure[0]?.source === 'overflow' ? localPressure[0].id : null,
        sourceRouteBottom: localPressure[0]?.source === 'overflow' ? localPressure[0].bottom : null,
        sourceRouteTop: localPressure[0]?.source === 'overflow' ? localPressure[0].top : null,
        label: local.existing ? 'use ' + localLabel : 'build ' + localLabel,
        targetFloors,
        averageSeconds: local.averageSeconds,
        coveredTrips: local.coveredTrips,
        existing: Boolean(local.existing),
        targetFloor: targetFloors.length ? Math.max(...targetFloors) : null,
        routeBottom: local.bottom,
        routeTop: local.top,
        routeSlot: local.slot,
        routeOccupancy: local.occupancy ?? 0,
        routeCapacity: Math.max(1, Math.floor(Number(config?.[local.kind]?.capacity) || 0)),
        dailyThroughputEstimate,
        detail: primaryLabel + primarySpan + ' has ' + primary.pressure.label + ' across recent days. ' + (local.existing
          ? 'Use ' + localLabel + ' for the trips it covers; it does not wait for an elevator car.'
          : 'Build ' + localLabel + ' to spread the load before ' + primaryLabel + ' reaches its limit.') +
          (local.coverageFloors.length ? ' It reaches ' + local.coverageFloors.map((floor) => 'F' + floor).join(', ') + '.' : '') +
          (local.coveredTrips ? ' Estimated travel time for these pressured trips: ' + local.averageSeconds.toFixed(1) + 's.' : '') +
          (localOverflow.sustained ? ' The building-wide overflow trend confirms this pressure is repeating.' : '') +
          (dailyThroughputEstimate != null ? ' Planning estimate: about ' + dailyThroughputEstimate + ' trips per day at that travel time; this is not yet a hard route capacity limit.' : ''),
      }, local.existing ? null : local.cost, localLabel);
    }
    return {
      key: 'blocked',
      kind: null,
      control: null,
      basis: 'sustained local-route pressure',
      label: 'add another local route',
      detail: primaryLabel + ' has ' + primary.pressure.label + ' across recent days, but no alternate local route is currently available. Free a route column or extend the building before adding more local demand.',
    };
  }

  if (localOverflow.sustained) {
    const routes = [
      ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
      ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
    ];
    const targetFloor = routes.length ? Math.max(...routes.map((route) => Number(route.top)).filter(Number.isFinite)) : null;
    const excluded = new Set(routes.map((route) => route.kind + ':' + route.id));
    const local = targetFloor == null ? null : localRouteResponseOption(state, config, [targetFloor], [], excluded);
    if (local) {
      const localLabel = local.kind === 'escalator' ? 'an escalator' : 'stairs';
      const dailyThroughputEstimate = Number.isFinite(Number(local.averageSeconds)) && Number(local.averageSeconds) > 0
        ? Math.max(1, Math.floor((Number(config?.time?.daySeconds) || 0) / Number(local.averageSeconds)))
        : null;
      return withBudget({
        key: 'local',
        kind: local.kind,
        control: local.kind,
        basis: 'sustained local overflow',
        label: 'build ' + localLabel,
        targetFloors: [targetFloor],
        averageSeconds: local.averageSeconds,
        coveredTrips: local.coveredTrips,
        existing: false,
        targetFloor,
        routeBottom: local.bottom,
        routeTop: local.top,
        routeSlot: local.slot,
        routeOccupancy: local.occupancy ?? 0,
        routeCapacity: Math.max(1, Math.floor(Number(config?.[local.kind]?.capacity) || 0)),
        dailyThroughputEstimate,
        detail: 'Local routes have overflowed for ' + localOverflow.consecutiveDays + ' consecutive days. Build ' + localLabel +
          ' as a separate capacity path before the crowding becomes a tenant-facing reputation problem.' +
          (local.coverageFloors.length ? ' It reaches ' + local.coverageFloors.map((floor) => 'F' + floor).join(', ') + '.' : '') +
          (dailyThroughputEstimate != null ? ' Planning estimate: about ' + dailyThroughputEstimate + ' trips per day at that travel time; this is not yet a hard route capacity limit.' : ''),
      }, local.cost, localLabel);
    }
  }

  const queuedShafts = candidates.filter((candidate) => candidate.queue > 0);
  const queuedCapacityBound = queuedShafts.length > 0 && queuedShafts.every((candidate) => !candidate.available);
  const allCarsFull = shafts.length > 0 && shafts.every((shaft) => (shaft.cars?.length ?? 0) >= (config?.elevator?.maxCarsPerShaft ?? 0));
  if (!shafts.length || queuedCapacityBound || allCarsFull) {
    const pressureShaftIds = new Set(queuedShafts.filter((candidate) => !candidate.available).map((candidate) => candidate.shaftId));
    const waitingFloors = waitingTargetFloors(state, pressureShaftIds);
    const historicalFloors = sustained
      .map((candidate) => shafts.find((shaft) => shaft.id === candidate.shaftId)?.top)
      .filter((floor) => Number.isFinite(Number(floor)))
      .map(Number);
    const targetFloors = waitingFloors.length ? waitingFloors : historicalFloors;
    const targetFloor = targetFloors.length ? Math.max(...targetFloors) : null;
    const shaftControl = shaftBuildControlStatus(state, config);
    const shaftCoverage = shaftCoverageDemandComparison(config?.building?.lobbyFloor ?? 0, shaftControl.top, shafts, targetFloors);
    if (!shaftControl.disabled && shaftCoverage.key !== 'misses_demand') {
      const shaftProjection = shaftPlacementProjection(config?.building?.lobbyFloor ?? 0, shaftControl.top, config);
      return withBudget({
        key: 'shaft',
        kind: 'shaft',
        control: 'shaft',
        basis: 'independent route',
        label: shafts.length ? 'build a second shaft' : 'build a shaft',
        targetFloor,
        targetFloors,
        legalTop: shaftControl.top,
        coverage: shaftCoverage,
        detail: (shafts.length ? 'Existing shaft car capacity is fully committed.' : 'The tower has no elevator route yet.') +
          (targetFloors.length ? ' ' + shaftCoverage.detail : '') +
          ' A new shaft creates a separate vertical route' + (shaftControl.top == null ? '.' : ' through F' + shaftControl.top + '.') +
          ' Cost ' + formatCost(shaftControl.cost) + ' · legal span F' + (config?.building?.lobbyFloor ?? 0) + '–F' + shaftControl.top +
          ' · includes ' + shaftProjection.startingCars + ' car / ' + shaftProjection.startingCapacity + ' riders per dispatch.',
      }, shaftControl.cost, shafts.length ? 'a second shaft' : 'a shaft');
    }
    const pressurePeople = waiting.filter((person) => pressureShaftIds.has(person.shaft));
    const local = localRouteResponseOption(state, config, targetFloors, pressurePeople);
    if (local) {
      const localLabel = local.kind === 'escalator' ? 'an escalator' : 'stairs';
      const dailyThroughputEstimate = Number.isFinite(Number(local.averageSeconds)) && Number(local.averageSeconds) > 0
        ? Math.max(1, Math.floor((Number(config?.time?.daySeconds) || 0) / Number(local.averageSeconds)))
        : null;
      return withBudget({
        key: 'local',
        kind: local.kind,
        control: local.kind,
        basis: 'local route',
        label: local.existing ? 'use ' + localLabel : 'build ' + localLabel,
        targetFloors,
        averageSeconds: local.averageSeconds,
        coveredTrips: local.coveredTrips,
        existing: Boolean(local.existing),
        targetFloor: targetFloors.length ? Math.max(...targetFloors) : null,
        routeBottom: local.bottom,
        routeTop: local.top,
        routeSlot: local.slot,
        routeOccupancy: local.occupancy ?? 0,
        routeCapacity: Math.max(1, Math.floor(Number(config?.[local.kind]?.capacity) || 0)),
        dailyThroughputEstimate,
        detail: 'Car capacity cannot be expanded on the current route. ' + (local.existing ? 'Use ' + localLabel + ' for trips it covers; it does not wait for an elevator car.' : 'A local route avoids car queues for the floors it covers.') +
          (local.coverageFloors.length ? ' It reaches ' + local.coverageFloors.map((floor) => 'F' + floor).join(', ') + '.' : '') +
          (local.coveredTrips ? ' Estimated travel time for these pressured trips: ' + local.averageSeconds.toFixed(1) + 's.' : '') +
          (dailyThroughputEstimate != null ? ' Planning estimate: about ' + dailyThroughputEstimate + ' trips per day at that travel time; this is not yet a hard route capacity limit.' : ''),
      }, local.existing ? null : local.cost, localLabel);
    }
    const coverageDetail = !shaftControl.disabled && targetFloor != null && shaftControl.top < targetFloor
      ? ' A clear shaft span reaches only F' + shaftControl.top + ', but pressure reaches F' + targetFloor + '.'
      : '';
    const saturatedDetail = saturatedLocalRouteDetail(state, config, targetFloors, pressurePeople);
    return {
      key: 'blocked',
      kind: null,
      control: null,
      basis: 'placement blocked',
      label: 'free a route column',
      detail: 'Pressure needs another route.' + (saturatedDetail ? saturatedDetail : ' The available route does not reach the pressured floors.') + coverageDetail + ' Free a column or add a local route before spending on more capacity.',
    };
  }

  if (sustained.length && queueRecommendation.best) {
    const target = queueRecommendation.best;
    const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
    return withBudget({
      key: 'car',
      kind: 'car',
      control: 'car',
      shaftId: target.shaftId,
      basis: 'sustained daily pressure',
      label: 'add a car to S' + (target.shaftIndex + 1),
      detail: 'S' + (target.shaftIndex + 1) + ' has repeated queue pressure across ' + target.dailyPressure.consecutiveDays +
        ' days. Add a car to increase capacity on that existing route, then watch the next daily reading. Cost ' +
        formatCost(config?.costs?.car) + ' · +' + carCapacity + ' riders per dispatch.',
    }, config?.costs?.car, 'a car on S' + (target.shaftIndex + 1));
  }

  return {
    key: 'monitor',
    kind: null,
    control: null,
    basis: 'watch next reading',
    label: 'watch the next day',
    detail: 'The pressure is not yet specific enough to choose another car or route. Let the next daily reading separate a spike from a pattern.',
  };
}

function localInvestmentChoice(state, config, kind) {
  const placement = state?.lobby
    ? { ...routeOption(state, config, kind), kind }
    : { kind, available: false, reason: 'build a lobby first' };
  const capacity = Math.max(1, Math.floor(Number(config?.[kind]?.capacity) || 0));
  const speedSecondsPerFloor = Math.max(0, Number(config?.[kind]?.walkSecondsPerFloor ?? config?.[kind]?.travelSecondsPerFloor) || 0);
  const existingRoutes = Array.isArray(state?.[kind]) ? state[kind] : [];
  const currentCapacity = existingRoutes.length * capacity;
  const currentOccupancy = existingRoutes.reduce((sum, route) => sum + localRouteOccupancy(state, kind, route.id), 0);
  const available = Boolean(placement?.available && Number(placement.top) > Number(placement.bottom));
  const cost = available ? placement.cost : null;
  const availableMoney = Number.isFinite(Number(state?.money)) ? Number(state.money) : Infinity;
  const pressure = localRoutePressurePreview(state, config, kind, placement);
  const wave = pressureWave(pressure.coveredTrips, available ? capacity : 0);
  return {
    available,
    affordable: available && availableMoney >= Number(cost),
    fundsGap: available ? Math.max(0, Number(cost) - availableMoney) : 0,
    kind,
    cost,
    bottom: placement?.bottom ?? null,
    top: placement?.top ?? null,
    slot: placement?.slot ?? null,
    capacity,
    speedSecondsPerFloor,
    travelSeconds: available ? +((Number(placement.top) - Number(placement.bottom)) * speedSecondsPerFloor).toFixed(1) : null,
    addedCapacity: available ? capacity : 0,
    currentRoutes: existingRoutes.length,
    currentCapacity,
    nextCapacity: currentCapacity + (available ? capacity : 0),
    currentOccupancy,
    coveredTrips: pressure.coveredTrips,
    elevatorTripsRelieved: pressure.elevatorTripsRelieved,
    localTripsRelieved: pressure.localTripsRelieved,
    unassignedTripsRelieved: pressure.unassignedTripsRelieved,
    averageSeconds: pressure.averageSeconds == null ? null : +pressure.averageSeconds.toFixed(1),
    firstWaveCapacity: wave.capacity,
    firstWaveTrips: wave.trips,
    overflowTrips: wave.overflow,
    detail: available
      ? 'F' + placement.bottom + '–F' + placement.top + ' · ' + speedSecondsPerFloor + 's/floor · +' + capacity + ' simultaneous people · local capacity ' + currentCapacity + ' → ' + (currentCapacity + capacity) + ' · column ' + (placement.slot + 1) +
        (pressure.coveredTrips ? ' · covers ' + pressure.coveredTrips + ' current waits' : ' · no current waits covered')
      : placement?.reason ?? 'no clear local-route placement',
  };
}

/** Explain when the first-session player still has time to answer live pressure. */
export function firstSessionPressureWarning(state, config, recommendedTarget = null) {
  const waiting = (state?.people ?? []).filter((person) => person.state === 'waiting').length;
  const stressedUnits = (state?.units ?? []).filter((unit) => {
    if (!unit.occupied) return false;
    const vacateAt = Number(config?.units?.[unit.kind]?.vacateAt);
    return Number.isFinite(vacateAt) && Number(unit.stress) >= vacateAt * 0.5;
  }).length;
  const hasSecondCar = (state?.shafts ?? []).some((shaft) => (shaft.cars?.length ?? 0) >= 2);
  const target = recommendedTarget ?? 'the pressured shaft';
  const carCost = Number(config?.costs?.car);
  const availableMoney = Number(state?.money);
  const affordable = !Number.isFinite(carCost) || !Number.isFinite(availableMoney) || availableMoney >= carCost;
  if (hasSecondCar || (waiting === 0 && stressedUnits === 0)) {
    return { active: false, waiting, stressedUnits, target, affordable, carCost, availableMoney, detail: '' };
  }
  const budgetDetail = Number.isFinite(carCost) && Number.isFinite(availableMoney)
    ? availableMoney >= carCost
      ? ' · car ' + formatCost(carCost) + ' · cash ' + formatCost(availableMoney) + ' · affordable now'
      : ' · car ' + formatCost(carCost) + ' · cash ' + formatCost(availableMoney) + ' · need ' + formatCost(carCost - availableMoney) + ' more'
    : '';
  return {
    active: true,
    waiting,
    stressedUnits,
    target,
    affordable,
    carCost,
    availableMoney,
    detail: 'warning: W ' + waiting + ' waiting' +
      (stressedUnits ? ' · ' + stressedUnits + ' tenant' + (stressedUnits === 1 ? '' : 's') + ' near departure stress' : '') +
      ' · select + car, then click ' + target + ' while recovery is still available' + budgetDetail,
  };
}

/** Keep the first-session recovery target readable while the repaired tower runs. */
export function firstSessionRecoveryReadings(state, config, history = []) {
  const shafts = Array.isArray(state?.shafts) ? state.shafts : [];
  const hasSecondCar = shafts.some((shaft) => (shaft.cars?.length ?? 0) >= 2);
  const people = Array.isArray(state?.people) ? state.people : [];
  const units = Array.isArray(state?.units) ? state.units : [];
  const waiting = people.filter((person) => person.state === 'waiting').length;
  const occupied = units.filter((unit) => unit.occupied).length;
  const capacity = tenantLoadSummary(state, config).capacity;
  const latest = Array.isArray(history) ? history.at(-1) ?? null : null;
  const latestCars = Number(latest?.cars);
  const postCarClose = Number.isFinite(latestCars) && latestCars >= 2;
  const reading = (value, suffix = '') => Number.isFinite(Number(value))
    ? Math.round(Number(value)) + suffix : '—';
  const detail = 'recovery watch: W ' + waiting + ' now · T ' + occupied + '/' + capacity +
    ' occupied' + (latest
      ? ' · latest D' + latest.day + (postCarClose ? ' post-car' : ' pre-car') +
        ' delivery ' + reading(latest.deliveryRate, '%') +
        ' · reputation ' + reading(latest.rep, '%') +
        ' · desirability ' + reading(latest.desirability, '%') +
        (postCarClose ? '' : ' · keep running for a post-car day close')
      : ' · awaiting the first closed-day readings');
  return { active: hasSecondCar, waiting, occupied, capacity, latest, postCarClose, detail };
}

/** Pair the latest pre-car pressure day with the first demonstrable recovery. */
export function firstSessionRecoveryEvidence(history = [], livePressure = null, config = null) {
  const entries = Array.isArray(history) ? history : [];
  const pressureIndex = entries.reduce((latestIndex, entry, index) => {
    const cars = Number(entry?.cars);
    const preCar = !Number.isFinite(cars) || cars < 2;
    const pressured = Number(entry?.elevatorTrips) > 0 &&
      (Number(entry?.abandoned) > 0 || Number(entry?.deliveryRate) < 100);
    return preCar && pressured ? index : latestIndex;
  }, -1);
  const pressure = pressureIndex >= 0 ? entries[pressureIndex] : null;
  const recoveryEntry = pressure
    ? entries.slice(pressureIndex + 1).find((entry) =>
      Number(entry?.cars) >= 2 &&
      Number(entry?.deliveryRate) > Number(pressure.deliveryRate) &&
      Number(entry?.rep) > Number(pressure.rep))
    : null;
  if (recoveryEntry) return {
    pressureIndex,
    pressure,
    recoveryEntry,
    source: 'closed-day',
    observed: pressureIndex >= 0 || Boolean(livePressure),
    recovered: true,
  };
  const liveRecoveryTarget = Math.max(90, Number(config?.occupancy?.relistMinDeliveryRate) || 0);
  const liveRecoveryEntry = livePressure
    ? entries.find((entry) =>
      Number(entry?.day) >= Number(livePressure.day) &&
      Number(entry?.cars) >= 2 &&
      Number(entry?.deliveryRate) >= liveRecoveryTarget &&
      Number(entry?.rep) >= Number(config?.occupancy?.relistMinDeliveryRate ?? 0))
    : null;
  return {
    pressureIndex,
    observed: pressureIndex >= 0 || Boolean(livePressure),
    pressure: liveRecoveryEntry ? livePressure : pressure,
    recoveryEntry: liveRecoveryEntry,
    source: liveRecoveryEntry ? 'live-warning' : 'closed-day',
    recovered: Boolean(liveRecoveryEntry),
  };
}

/** Choose one concrete management goal after the first-session recovery loop. */
export function postBetaManagementGoal(state, config) {
  const serviceOrder = ['food', 'parking', 'security', 'recycling', 'medical'];
  const labels = { food: 'cafeteria', parking: 'parking', security: 'security', recycling: 'recycling', medical: 'clinic' };
  const occupied = (state?.units ?? []).filter((unit) => unit.occupied);
  const missing = serviceOrder.find((kind) => occupied.some((unit) =>
    Number(config?.units?.[unit.kind]?.[kind + 'Need'] ?? 0) > 0 &&
    !unitEvaluation(state, unit, config)[kind + 'Covered']));
  if (missing) {
    const label = labels[missing] ?? missing;
    const uncoveredUnits = occupied.filter((unit) =>
      Number(config?.units?.[unit.kind]?.[missing + 'Need'] ?? 0) > 0 &&
      !unitEvaluation(state, unit, config)[missing + 'Covered']);
    const targetUnit = occupied.find((unit) =>
      Number(config?.units?.[unit.kind]?.[missing + 'Need'] ?? 0) > 0 &&
      !unitEvaluation(state, unit, config)[missing + 'Covered']);
    const placement = targetUnit
      ? servicePlacementRecommendation(state, targetUnit, missing, config)
      : null;
    const targetTenantLoad = targetUnit ? Math.max(0, Math.round(targetUnit.heads ?? 0)) : 0;
    const targetContext = targetUnit
      ? ' · helps F' + targetUnit.floor + ' ' + targetUnit.kind + ' (' + targetTenantLoad + ' tenants)'
      : '';
    const condoFollowup = targetUnit?.kind === 'condo';
    const roomLabels = uncoveredUnits.map((unit) =>
      'F' + unit.floor + ' ' + unit.kind + ' (' + Math.max(0, Math.round(unit.heads ?? 0)) + ' tenants)');
    const remainingContext = roomLabels.length
      ? ' · remaining uncovered: ' + roomLabels.slice(0, 3).join(', ') + (roomLabels.length > 3 ? ' +' + (roomLabels.length - 3) + ' more' : '')
      : '';
    return {
      key: 'service',
      action: missing,
      label: 'add a ' + label + (condoFollowup ? ' for the condo' : ''),
      detail: (condoFollowup ? 'support the first condo and improve its room appeal' : 'cover a required tenant service and improve room appeal') + targetContext + remainingContext +
        (placement?.key === 'ready' ? ' · place on F' + placement.floor : ''),
      cost: Number(config?.costs?.[missing]) || 0,
      targetUnitId: targetUnit?.id ?? null,
      targetTenantLoad,
      recommendedFloor: placement?.key === 'ready' ? placement.floor : null,
      recommendedDetail: placement?.detail ?? placement?.reason ?? null,
    };
  }
  const condoUnlocked = unlocked(state, config, 'condo');
  const hasCondo = (state?.units ?? []).some((unit) => unit.kind === 'condo');
  if (condoUnlocked && !hasCondo) {
    return {
      key: 'expansion',
      action: 'condo',
      label: 'add a condo',
      detail: 'begin mixed-use expansion with residents and a new service profile',
      cost: Number(config?.costs?.condo) || 0,
    };
  }
  return {
    key: 'expand',
    action: 'floor',
    label: 'expand one floor',
    detail: 'add room capacity for the next tenant wave',
    cost: Number(config?.costs?.floor) || 0,
  };
}

/** Compare elevator and local transport investments before the player commits. */
export function transportInvestmentChoices(state, config, response = null, historyByShaft = null, selectedKind = null, focusedTarget = null, historyByLocalRoute = null) {
  const recommendation = response ?? transportResponseRecommendation(state, config, historyByShaft, historyByLocalRoute);
  const shafts = Array.isArray(state?.shafts) ? state.shafts : [];
  const queueRecommendation = shaftQueueReliefRecommendation(state, config, historyByShaft);
  const fallbackShaft = shafts.find((shaft) => (shaft.cars?.length ?? 0) < (config?.elevator?.maxCarsPerShaft ?? 0)) ?? shafts[0] ?? null;
  const focusedCarShaftId = focusedTarget?.kind === 'car' ? focusedTarget.shaftId : null;
  const targetShaftId = focusedCarShaftId ?? recommendation?.shaftId ?? queueRecommendation.bestShaftId ?? fallbackShaft?.id;
  const targetShaft = shafts.find((shaft) => shaft.id === targetShaftId) ?? null;
  const carProjection = targetShaft ? shaftQueueReliefProjection(targetShaft, state, config) : null;
  const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
  const carCost = Math.max(0, Number(config?.costs?.car) || 0);
  const availableMoney = Number.isFinite(Number(state?.money)) ? Number(state.money) : Infinity;
  const carPressure = targetShaft ? shaftPressurePreview(state, targetShaft.id) : null;
  const carWave = pressureWave(carPressure?.coveredTrips ?? 0, carProjection?.available ? carCapacity : 0);
  const car = {
    available: Boolean(carProjection?.available),
    affordable: Boolean(carProjection?.available) && availableMoney >= carCost,
    fundsGap: Boolean(carProjection?.available) ? Math.max(0, carCost - availableMoney) : 0,
    shaftId: targetShaft?.id ?? null,
    shaftIndex: targetShaft ? shafts.indexOf(targetShaft) : -1,
    cost: carCost,
    addedCapacity: carProjection?.available ? carCapacity : 0,
    currentCapacity: targetShaft ? (targetShaft.cars?.length ?? 0) * carCapacity : 0,
    nextCapacity: targetShaft
      ? ((targetShaft.cars?.length ?? 0) + (carProjection?.available ? 1 : 0)) * carCapacity
      : 0,
    queue: carProjection?.queue ?? 0,
    waitBefore: carProjection?.currentWaitSeconds ?? 0,
    waitAfter: carProjection?.nextWaitSeconds ?? 0,
    coveredTrips: carPressure?.coveredTrips ?? 0,
    elevatorTripsRelieved: carPressure?.elevatorTripsRelieved ?? 0,
    localTripsRelieved: carPressure?.localTripsRelieved ?? 0,
    unassignedTripsRelieved: carPressure?.unassignedTripsRelieved ?? 0,
    firstWaveCapacity: carWave.capacity,
    firstWaveTrips: carWave.trips,
    overflowTrips: carWave.overflow,
  };

  const bottom = config?.building?.lobbyFloor ?? 0;
  const shaftControl = shaftBuildControlStatus(state, config);
  const maximumTop = Math.min((state?.floors ?? 0) - 1, bottom + (config?.elevator?.maxSpan ?? 0) - 1);
  const focusedShaftTop = focusedTarget?.kind === 'shaft' && Number.isInteger(focusedTarget.floor) &&
    focusedTarget.floor > bottom && focusedTarget.floor <= maximumTop
    ? focusedTarget.floor
    : null;
  const shaftTop = focusedShaftTop ?? shaftControl.top;
  const focusedShaftPlacement = focusedShaftTop == null ? null : routePlacementStatus('shaft', bottom, focusedShaftTop, state, config);
  const shaftPlacementReady = focusedShaftPlacement
    ? focusedShaftPlacement.key === 'ready'
    : !shaftControl.disabled && Number.isFinite(Number(shaftTop));
  const shaftCost = shaftTop == null ? null
    : Math.max(0, Number(config?.costs?.shaft) || 0) +
      Math.max(0, Number(config?.costs?.shaftPerFloor) || 0) * Math.max(0, Number(shaftTop) - Number(bottom) + 1);
  const shaftProjection = shaftPlacementReady && Number.isFinite(Number(shaftTop))
    ? shaftPlacementProjection(bottom, shaftTop, config)
    : null;
  const shaftPressure = shaftProjection && Number(shaftTop) > Number(bottom)
    ? spanPressurePreview(state, bottom, shaftTop)
    : null;
  const shaftWave = pressureWave(shaftPressure?.coveredTrips ?? 0, shaftProjection && Number(shaftTop) > Number(bottom)
    ? shaftProjection.startingCapacity
    : 0);
  const shaft = {
    available: Boolean(shaftProjection && Number(shaftTop) > Number(bottom)),
    affordable: Boolean(shaftProjection && Number(shaftTop) > Number(bottom)) &&
      (shaftCost == null || availableMoney >= shaftCost),
    fundsGap: shaftCost == null ? 0 : Math.max(0, shaftCost - availableMoney),
    cost: shaftCost,
    bottom,
    top: shaftTop ?? null,
    startingCars: shaftProjection?.startingCars ?? 0,
    startingCapacity: shaftProjection?.startingCapacity ?? 0,
    maxCapacity: shaftProjection?.maxCapacity ?? 0,
    coveredTrips: shaftPressure?.coveredTrips ?? 0,
    elevatorTripsRelieved: shaftPressure?.elevatorTripsRelieved ?? 0,
    localTripsRelieved: shaftPressure?.localTripsRelieved ?? 0,
    unassignedTripsRelieved: shaftPressure?.unassignedTripsRelieved ?? 0,
    firstWaveCapacity: shaftWave.capacity,
    firstWaveTrips: shaftWave.trips,
    overflowTrips: shaftWave.overflow,
    detail: focusedShaftPlacement?.detail ?? shaftControl.detail,
  };
  const localKinds = ['stairs', 'escalator'];
  const preferredLocalKind = localKinds.includes(recommendation?.kind)
    ? recommendation.kind
    : localKinds.includes(selectedKind) ? selectedKind : null;
  const orderedLocalKinds = preferredLocalKind
    ? [preferredLocalKind, ...localKinds.filter((kind) => kind !== preferredLocalKind)]
    : localKinds;
  const rawLocalOptions = orderedLocalKinds.map((kind) => localInvestmentChoice(state, config, kind));
  const rawChoices = [
    ['car', car],
    ['shaft', shaft],
    ...rawLocalOptions.map((choice) => [choice.kind, choice]),
  ];
  const coverageValues = rawChoices
    .filter(([, choice]) => choice.available)
    .map(([, choice]) => Math.max(0, Math.floor(Number(choice.coveredTrips) || 0)));
  const bestCoverage = coverageValues.length ? Math.max(...coverageValues) : 0;
  const nextCoverage = coverageValues.length
    ? Math.max(0, ...coverageValues.filter((value) => value < bestCoverage))
    : 0;
  const coverageLabel = (choice) => {
    if (!choice.available) return '';
    const covered = Math.max(0, Math.floor(Number(choice.coveredTrips) || 0));
    if (covered === bestCoverage) {
      const tied = coverageValues.filter((value) => value === bestCoverage).length;
      return tied > 1
        ? 'coverage tie at ' + bestCoverage + ' current waits · speed/cost decide'
        : 'coverage leader · +' + Math.max(0, bestCoverage - nextCoverage) + ' waits vs next option';
    }
    return 'coverage ' + Math.max(0, bestCoverage - covered) + ' fewer waits than leader';
  };
  const annotateCoverage = (choice) => {
    const covered = Math.max(0, Math.floor(Number(choice.coveredTrips) || 0));
    const costPerCoveredWait = choice.available && covered > 0 && Number.isFinite(Number(choice.cost))
      ? +(Number(choice.cost) / covered).toFixed(1)
      : null;
    return { ...choice, coverageLabel: coverageLabel(choice), costPerCoveredWait };
  };
  const localOptions = rawLocalOptions.map(annotateCoverage);
  const annotatedCar = annotateCoverage(car);
  const annotatedShaft = annotateCoverage(shaft);
  const local = localOptions[0] ?? annotateCoverage(localInvestmentChoice(state, config, 'stairs'));
  const next = !(car.available && car.affordable) && shaft.available && shaft.affordable
    ? { kind: 'shaft', floor: shaft.top }
    : !(shaft.available && shaft.affordable) && car.available && car.affordable
      ? { kind: 'car', shaftId: car.shaftId }
      : null;

  return {
    show: ['car', 'shaft', 'stairs', 'escalator'].includes(recommendation?.kind) ||
      ['car', 'shaft', 'stairs', 'escalator'].includes(selectedKind),
    recommended: recommendation?.kind ?? null,
    selected: ['car', 'shaft', 'stairs', 'escalator'].includes(selectedKind) ? selectedKind : null,
    next,
    car: annotatedCar,
    shaft: annotatedShaft,
    local,
    localOptions,
  };
}

function queueHistoryForShaft(historyByShaft, shaftId) {
  if (!historyByShaft) return null;
  if (typeof historyByShaft.get === 'function') return historyByShaft.get(shaftId) ?? null;
  return historyByShaft[shaftId] ?? null;
}

/** Compare open car slots so the CAR tool can highlight the strongest relief target. */
export function shaftQueueReliefRecommendation(state, config, historyByShaft = null) {
  const candidates = (state?.shafts ?? []).map((shaft, index) => ({
    shaftId: shaft.id,
    shaftIndex: index,
    ...shaftQueueReliefProjection(shaft, state, config),
    dailyPressure: shaftQueueDailyPressure(queueHistoryForShaft(historyByShaft, shaft.id)),
  }));
  const available = candidates.filter((candidate) => candidate.available);
  const hasLiveRelief = available.some((candidate) => candidate.reliefSeconds > 0);
  available.sort((a, b) => {
    if (!hasLiveRelief && Number(b.dailyPressure.sustained) !== Number(a.dailyPressure.sustained)) {
      return Number(b.dailyPressure.sustained) - Number(a.dailyPressure.sustained);
    }
    if (!hasLiveRelief && b.dailyPressure.consecutiveDays !== a.dailyPressure.consecutiveDays) {
      return b.dailyPressure.consecutiveDays - a.dailyPressure.consecutiveDays;
    }
    if (!hasLiveRelief && b.dailyPressure.latest?.average !== a.dailyPressure.latest?.average) {
      return (b.dailyPressure.latest?.average ?? 0) - (a.dailyPressure.latest?.average ?? 0);
    }
    return b.reliefSeconds - a.reliefSeconds || b.queue - a.queue ||
      b.currentWaitSeconds - a.currentWaitSeconds || a.shaftIndex - b.shaftIndex;
  });
  const best = available[0] ?? null;
  return {
    candidates,
    best,
    bestShaftId: best?.shaftId ?? null,
    basis: !best ? 'none' : hasLiveRelief ? 'live queue relief' : best.dailyPressure.sustained ? 'sustained daily pressure' : 'reserve capacity',
  };
}

/** Compress recent shaft queue counts into a small oldest-to-newest sparkline. */
export function shaftQueueTrend(history, maxEntries = 8) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const readings = (Array.isArray(history) ? history : [])
    .map((value) => ({
      count: Math.max(0, Math.floor(Number(typeof value === 'object' ? value?.count : value))),
      time: typeof value === 'object' && Number.isFinite(Number(value?.day)) && Number.isFinite(Number(value?.tod))
        ? Number(value.day) + Number(value.tod)
        : null,
    }))
    .filter((reading) => Number.isFinite(reading.count))
    .slice(-limit);
  if (!readings.length) {
    return { key: 'unknown', direction: 'unknown', current: 0, peak: 0, delta: 0, spike: false, bars: '', timeSpanMinutes: null, label: 'queue trend —', entries: [] };
  }
  const entries = readings.map((reading) => reading.count);
  const current = entries.at(-1);
  const first = entries[0];
  const peak = Math.max(...entries);
  const delta = current - first;
  const direction = delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = entries.map((count) => levels[Math.round(Math.min(1, count / 12) * (levels.length - 1))]).join('');
  const spike = entries.length >= 3 && peak > first && peak > current;
  const firstTime = readings[0].time;
  const lastTime = readings.at(-1).time;
  const timeSpanMinutes = firstTime != null && lastTime != null
    ? Math.max(0, Math.round((lastTime - firstTime) * 1440))
    : null;
  return {
    key: direction,
    direction,
    current,
    peak,
    delta,
    spike,
    bars,
    timeSpanMinutes,
    label: 'queue trend ' + bars,
    entries,
  };
}

/** Compress closed-day shaft queue averages into a day-over-day sparkline. */
export function shaftQueueDailyTrend(history, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.average)),
      peak: Math.max(0, Number(entry?.peak)),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-limit);
  if (!entries.length) {
    return { key: 'unknown', direction: 'unknown', current: 0, peak: 0, bars: '', label: 'daily queue —', entries: [] };
  }
  const values = entries.map((entry) => entry.average);
  const current = values.at(-1);
  const first = values[0];
  const peak = Math.max(...entries.map((entry) => entry.peak));
  const delta = current - first;
  const direction = delta > 0.05 ? 'rising' : delta < -0.05 ? 'falling' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = values.map((count) => levels[Math.round(Math.min(1, count / 12) * (levels.length - 1))]).join('');
  return {
    key: direction,
    direction,
    current,
    peak,
    delta: +delta.toFixed(2),
    bars,
    label: 'daily queue ' + bars,
    entries,
  };
}

/** Compress closed-day local-route occupancy into a day-over-day load trend. */
export function localRouteDailyTrend(history, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.average)),
      peak: Math.max(0, Number(entry?.peak)),
      capacity: Math.max(1, Number(entry?.capacity) || 1),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-limit);
  if (!entries.length) {
    return { key: 'unknown', direction: 'unknown', current: 0, peak: 0, capacity: 1, currentRatio: 0, delta: 0, bars: '', label: 'daily local load —', entries: [] };
  }
  const ratios = entries.map((entry) => Math.min(1, entry.average / entry.capacity));
  const current = entries.at(-1).average;
  const currentRatio = ratios.at(-1);
  const firstRatio = ratios[0];
  const peak = Math.max(...entries.map((entry) => entry.peak));
  const delta = currentRatio - firstRatio;
  const direction = delta > 0.05 ? 'rising' : delta < -0.05 ? 'falling' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = ratios.map((ratio) => levels[Math.round(ratio * (levels.length - 1))]).join('');
  return {
    key: direction,
    direction,
    current,
    peak,
    capacity: entries.at(-1).capacity,
    currentRatio: +currentRatio.toFixed(2),
    delta: +delta.toFixed(2),
    bars,
    label: 'daily local load ' + bars,
    entries,
  };
}

/** Classify repeated local-route load separately from a one-day occupancy spike. */
export function localRouteDailyPressure(history, minDays = 2) {
  const requiredDays = Math.max(2, Math.floor(Number(minDays) || 2));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => {
      const capacity = Math.max(1, Number(entry?.capacity) || 1);
      const average = Math.max(0, Number(entry?.average));
      const peak = Math.max(0, Number(entry?.peak));
      return { day: entry?.day, average, peak, capacity, ratio: Math.min(1, average / capacity), peakRatio: Math.min(1, peak / capacity) };
    })
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-6);
  const pressured = (entry) => entry.ratio >= 0.65 || entry.peakRatio >= 0.85;
  let consecutiveDays = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    if (!pressured(entries[index])) break;
    consecutiveDays++;
  }
  const pressureDays = entries.filter(pressured).length;
  const latest = entries.at(-1) ?? null;
  const sustained = consecutiveDays >= requiredDays;
  return {
    entries,
    days: entries.length,
    pressureDays,
    consecutiveDays,
    sustained,
    latest,
    key: sustained ? 'sustained' : pressureDays ? 'spike' : 'clear',
    label: sustained
      ? 'sustained ' + consecutiveDays + 'd'
      : pressureDays ? 'one-day local-load spike' : 'no sustained local load',
  };
}

/** Compress closed-day local overflow into a small oldest-to-newest sparkline. */
export function localOverflowDailyTrend(history, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.localOverflowAverage)),
      peak: Math.max(0, Number(entry?.localOverflowPeak)),
      penalty: Math.max(0, Number(entry?.localOverflowPenalty)),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-limit);
  if (!entries.length) {
    return { key: 'unknown', direction: 'unknown', current: 0, peak: 0, delta: 0, bars: '', label: 'daily local overflow —', entries: [] };
  }
  const values = entries.map((entry) => entry.average);
  const current = values.at(-1);
  const first = values[0];
  const peak = Math.max(...entries.map((entry) => entry.peak));
  const delta = current - first;
  const direction = delta > 0.05 ? 'rising' : delta < -0.05 ? 'falling' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = values.map((value) => levels[Math.round(Math.min(1, value / 4) * (levels.length - 1))]).join('');
  return {
    key: direction,
    direction,
    current: +current.toFixed(2),
    peak,
    delta: +delta.toFixed(2),
    bars,
    label: 'daily local overflow ' + bars,
    entries,
  };
}

/** Distinguish a brief local overflow spike from crowding that repeats by day. */
export function localOverflowDailyPressure(history, minDays = 2) {
  const requiredDays = Math.max(2, Math.floor(Number(minDays) || 2));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.localOverflowAverage)),
      peak: Math.max(0, Number(entry?.localOverflowPeak)),
      penalty: Math.max(0, Number(entry?.localOverflowPenalty)),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-6);
  const pressured = (entry) => entry.average >= 0.1 || entry.peak >= 2;
  let consecutiveDays = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    if (!pressured(entries[index])) break;
    consecutiveDays++;
  }
  const pressureDays = entries.filter(pressured).length;
  const latest = entries.at(-1) ?? null;
  const sustained = consecutiveDays >= requiredDays;
  return {
    entries,
    days: entries.length,
    pressureDays,
    consecutiveDays,
    sustained,
    latest,
    key: sustained ? 'sustained' : pressureDays ? 'spike' : 'clear',
    label: sustained
      ? 'sustained local overflow ' + consecutiveDays + 'd'
      : pressureDays ? 'one-day local overflow spike' : 'no sustained local overflow',
  };
}

/** Compare one local route's overflow before and after an intervention. */
export function localOverflowInterventionResult(before, after, epsilon = 0.1) {
  const beforeAverage = Math.max(0, Number(before?.average ?? before?.localOverflowAverage) || 0);
  const afterAverage = Math.max(0, Number(after?.average ?? after?.localOverflowAverage) || 0);
  const beforePeak = Math.max(0, Number(before?.peak ?? before?.localOverflowPeak) || 0);
  const afterPeak = Math.max(0, Number(after?.peak ?? after?.localOverflowPeak) || 0);
  const threshold = Math.max(0.01, Number(epsilon) || 0.1);
  const averageDelta = afterAverage - beforeAverage;
  const peakDelta = afterPeak - beforePeak;
  const relieved = averageDelta <= -threshold || (Math.abs(averageDelta) < threshold && peakDelta < 0);
  const worsened = averageDelta >= threshold || (Math.abs(averageDelta) < threshold && peakDelta > 0);
  const key = relieved ? 'relieved' : worsened ? 'worse' : 'unchanged';
  return {
    key,
    label: key === 'relieved' ? 'overflow relieved' : key === 'worse' ? 'overflow still rising' : 'overflow unchanged',
    beforeAverage: +beforeAverage.toFixed(2),
    afterAverage: +afterAverage.toFixed(2),
    beforePeak,
    afterPeak,
    averageDelta: +averageDelta.toFixed(2),
    peakDelta,
  };
}

/** Separate pressure absorbed by a new route from pressure shifted onto it. */
export function localOverflowInterventionComparison(before, after, alternate, epsilon = 0.1) {
  const sourceResult = localOverflowInterventionResult(before, after, epsilon);
  const alternateAverage = Math.max(0, Number(alternate?.average ?? alternate?.localOverflowAverage) || 0);
  const alternatePeak = Math.max(0, Number(alternate?.peak ?? alternate?.localOverflowPeak) || 0);
  const threshold = Math.max(0.01, Number(epsilon) || 0.1);
  const alternatePressured = alternateAverage >= threshold || alternatePeak >= 2;
  const key = sourceResult.key === 'relieved'
    ? alternatePressured ? 'shifted' : 'absorbed'
    : sourceResult.key;
  return {
    ...sourceResult,
    key,
    label: key === 'absorbed' ? 'pressure absorbed'
      : key === 'shifted' ? 'pressure shifted to alternate'
        : sourceResult.label,
    alternateAverage: +alternateAverage.toFixed(2),
    alternatePeak,
    alternatePressured,
  };
}

/** Turn an intervention result into the next transport decision. */
export function localOverflowInterventionNextAction(comparison, alternateRoute = null, state = null, config = null, tenantResult = null, historySummary = null) {
  const kind = alternateRoute?.kind === 'stairs' || alternateRoute?.kind === 'escalator'
    ? alternateRoute.kind : null;
  const tenantOutcome = tenantResult?.key === 'improved' ? 'tenant experience improved'
    : tenantResult?.key === 'worse' ? 'tenant experience worsened'
      : tenantResult?.key === 'unchanged' ? 'tenant experience was unchanged' : null;
  const stability = historySummary?.stabilityKey;
  const stabilityEvidence = historySummary?.stabilityLabel ?? null;
  let action;
  if (kind && comparison?.alternatePressured) {
    const label = kind === 'escalator' ? 'another escalator' : 'another stairs route';
    action = {
      key: 'add-capacity',
      kind,
      label: 'add capacity to the alternate',
      detail: label + ' is still pressured' + (tenantOutcome ? ' and ' + tenantOutcome : '') + (stabilityEvidence ? '; ' + stabilityEvidence : '') + ', so split that demand before judging the result again',
    };
  } else if ((comparison?.key === 'absorbed' || comparison?.key === 'relieved') &&
    (!tenantResult || tenantResult.key === 'improved') && stability !== 'one-day' && stability !== 'mixed-recent') {
    action = {
      key: 'monitor',
      kind: null,
      label: 'keep monitoring',
      detail: 'the source route improved without a pressured alternate route' + (tenantOutcome ? '; ' + tenantOutcome : '') + (stabilityEvidence ? '; ' + stabilityEvidence : ''),
    };
  } else {
    action = {
      key: 'recheck',
      kind: null,
      label: 'recheck after another day',
      detail: 'the route result is not clear enough to justify another build yet' + (tenantOutcome ? '; ' + tenantOutcome + ' needs another reading' : '') + (stabilityEvidence ? '; ' + stabilityEvidence : ''),
    };
  }
  if (!action.kind || !state || !config) return { ...action, tenantOutcomeKey: tenantResult?.key ?? null, stabilityKey: stability ?? null };
  const bottom = Number(config.building?.lobbyFloor ?? 0);
  const top = Number(alternateRoute.top);
  const placement = routePlacementStatus(action.kind, bottom, top, state, config);
  const cost = Math.max(0, Number(config.costs?.[action.kind]) || 0) +
    Math.max(0, Number(config.costs?.[action.kind + 'PerFloor']) || 0) * Math.max(0, top - bottom);
  const availableMoney = Number.isFinite(Number(state.money)) ? Number(state.money) : Infinity;
  const fundsGap = Math.max(0, cost - availableMoney);
  const capacity = Math.max(1, Math.floor(Number(config[action.kind]?.capacity) || 0));
  const routeListKey = action.kind === 'escalator' ? 'escalators' : 'stairs';
  const currentRoutes = Array.isArray(state[routeListKey]) ? state[routeListKey].length : 0;
  const currentCapacity = currentRoutes * capacity;
  const liveOccupancy = (state.people ?? []).filter((person) =>
    person.state === 'walking' && person.localRouteKind === action.kind && Number(person.localRouteId) === Number(alternateRoute.id)).length;
  const liveQueue = (state.people ?? []).filter((person) =>
    person.state === 'waiting' && person.localRouteKind === action.kind && Number(person.localRouteId) === Number(alternateRoute.id)).length;
  const liveOverflow = Math.max(0, liveQueue - Math.max(0, capacity - liveOccupancy));
  const travelSecondsPerFloor = Math.max(0, Number(config[action.kind]?.walkSecondsPerFloor ?? config[action.kind]?.travelSecondsPerFloor) || 0);
  const spanFloors = Math.max(1, top - bottom);
  const travelSeconds = +(spanFloors * travelSecondsPerFloor).toFixed(1);
  const expectedOverflowRelief = Math.min(
    Math.max(0, Number(comparison?.alternateAverage) || 0, liveOverflow),
    capacity,
  );
  return {
    ...action,
    tenantOutcomeKey: tenantResult?.key ?? null,
    stabilityKey: stability ?? null,
    targetFloor: top,
    cost,
    fundsGap,
    capacity,
    currentCapacity,
    projectedCapacity: currentCapacity + capacity,
    liveOccupancy,
    liveQueue,
    liveOverflow,
    spanFloors,
    travelSeconds,
    expectedOverflowRelief: +expectedOverflowRelief.toFixed(2),
    placementKey: placement.key,
    placementDetail: placement.detail,
    available: placement.key === 'ready',
    affordable: placement.key === 'ready' && fundsGap <= 0,
  };
}

/** Summarize the tenant-facing change recorded around a route intervention. */
export function localOverflowInterventionTenantResult(before, after) {
  const beforeWait = Math.max(0, Number(before?.localAvgWait) || 0);
  const afterWait = Math.max(0, Number(after?.localAvgWait) || 0);
  const beforeAbandoned = Math.max(0, Number(before?.localAbandoned) || 0);
  const afterAbandoned = Math.max(0, Number(after?.localAbandoned) || 0);
  const beforeStress = Math.max(0, Number(before?.averageStress) || 0);
  const afterStress = Math.max(0, Number(after?.averageStress) || 0);
  const beforeReputation = Number.isFinite(Number(before?.rep)) ? Number(before.rep) : null;
  const afterReputation = Number.isFinite(Number(after?.rep)) ? Number(after.rep) : null;
  const waitDelta = afterWait - beforeWait;
  const abandonedDelta = afterAbandoned - beforeAbandoned;
  const stressDelta = afterStress - beforeStress;
  const reputationDelta = beforeReputation == null || afterReputation == null ? 0 : afterReputation - beforeReputation;
  const improved = abandonedDelta < 0 || waitDelta <= -0.1 || stressDelta <= -0.05 || reputationDelta >= 0.5;
  const worsened = abandonedDelta > 0 || waitDelta >= 0.1 || stressDelta >= 0.05 || reputationDelta <= -0.5;
  const key = improved && !worsened ? 'improved' : worsened && !improved ? 'worse' : 'unchanged';
  return {
    key,
    label: key === 'improved' ? 'tenant experience improved' : key === 'worse' ? 'tenant experience worsened' : 'tenant experience unchanged',
    beforeWait: +beforeWait.toFixed(2),
    afterWait: +afterWait.toFixed(2),
    beforeAbandoned,
    afterAbandoned,
    beforeStress: +beforeStress.toFixed(2),
    afterStress: +afterStress.toFixed(2),
    beforeReputation,
    afterReputation,
    waitDelta: +waitDelta.toFixed(2),
    abandonedDelta,
    stressDelta: +stressDelta.toFixed(2),
    reputationDelta: +reputationDelta.toFixed(1),
  };
}

/** Keep a short, newest-first-useful history of completed route interventions. */
export function rememberLocalOverflowInterventionHistory(history, entry, limit = 4) {
  const max = Math.max(1, Math.floor(Number(limit) || 4));
  const prior = Array.isArray(history) ? history : [];
  return entry ? [...prior, entry].slice(-max) : prior.slice(-max);
}

/** Summarize whether the retained route tests are helping tenant experience. */
export function localOverflowInterventionHistorySummary(history) {
  const entries = Array.isArray(history) ? history : [];
  const counts = { improved: 0, worse: 0, unchanged: 0 };
  for (const entry of entries) {
    const key = entry?.tenantResult?.key;
    if (key === 'improved' || key === 'worse' || key === 'unchanged') counts[key]++;
  }
  const key = counts.improved > counts.worse ? 'helping'
    : counts.worse > counts.improved ? 'hurting' : 'mixed';
  const total = counts.improved + counts.worse + counts.unchanged;
  const recent = entries.slice(-2)
    .map((entry) => entry?.tenantResult?.key)
    .filter((entryKey) => entryKey === 'improved' || entryKey === 'worse' || entryKey === 'unchanged');
  const stable = recent.length === 2 && recent[0] === recent[1];
  const stabilityKey = stable
    ? recent[1] === 'improved' ? 'stable-helping' : recent[1] === 'worse' ? 'stable-hurting' : 'stable-unchanged'
    : recent.length < 2 ? 'one-day' : 'mixed-recent';
  const stabilityLabel = stabilityKey === 'stable-helping' ? 'stable improvement across 2 tests'
    : stabilityKey === 'stable-hurting' ? 'stable worsening across 2 tests'
      : stabilityKey === 'stable-unchanged' ? 'stable unchanged result across 2 tests'
        : stabilityKey === 'one-day' ? 'one-day result — run another test' : 'mixed recent results — keep testing';
  return {
    key,
    label: key === 'helping' ? 'tenant outcomes mostly improved'
      : key === 'hurting' ? 'tenant outcomes mostly worsened'
        : 'tenant outcomes are mixed',
    total,
    improved: counts.improved,
    worse: counts.worse,
    unchanged: counts.unchanged,
    improvementRate: total ? +(counts.improved / total * 100).toFixed(1) : null,
    stabilityKey,
    stabilityLabel,
    recentCount: recent.length,
  };
}

/** Turn stable route evidence into a small access-confidence demand signal. */
export function tenantTransportForecastSignal(state, config) {
  const history = tenantTransportForecastHistory(state);
  const accessHistory = history.map((entry) => ({ tenantResult: { key: entry.key } }));
  const summary = localOverflowInterventionHistorySummary(accessHistory);
  const stableHelping = summary.stabilityKey === 'stable-helping';
  const stableHurting = summary.stabilityKey === 'stable-hurting';
  const key = stableHelping ? 'helping' : stableHurting ? 'hurting' : history.length ? 'uncertain' : 'none';
  const weight = Math.max(0, Number(config?.occupancy?.transportAccessDemandWeight) || 0);
  const bonus = stableHelping ? weight : stableHurting ? -weight : 0;
  const label = key === 'helping' ? 'stable access evidence'
    : key === 'hurting' ? 'stable access warning'
      : key === 'uncertain' ? 'access evidence still uncertain' : 'no route evidence yet';
  const detail = key === 'helping'
    ? 'repeated route tests improved wait/stress outcomes; +' + bonus + ' access-confidence demand points, separate from reputation'
    : key === 'hurting'
      ? 'repeated route tests worsened wait/stress outcomes; ' + bonus + ' access-confidence demand points, separate from reputation'
      : key === 'uncertain'
        ? 'recent route outcomes are not stable enough to change tenant demand; reputation remains separate'
        : 'complete route tests before adding an access-confidence demand signal; reputation remains separate';
  return {
    key,
    bonus,
    label,
    detail,
    stabilityKey: summary.stabilityKey,
    tests: history.length,
    history,
    trend: tenantTransportForecastTrend(history),
  };
}

/** Keep the latest route-test access outcomes for the tenant-demand forecast. */
export function tenantTransportForecastHistory(state, maxEntries = 4) {
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 4));
  return (Array.isArray(state?.log) ? state.log : [])
    .flatMap((entry) => {
      const tenantResult = entry?.routeIntervention?.tenantResult;
      if (!tenantResult) return [];
      const waitDelta = Number(tenantResult.waitDelta) || 0;
      const abandonedDelta = Number(tenantResult.abandonedDelta) || 0;
      const stressDelta = Number(tenantResult.stressDelta) || 0;
      const improved = abandonedDelta < 0 || waitDelta <= -0.1 || stressDelta <= -0.05;
      const worsened = abandonedDelta > 0 || waitDelta >= 0.1 || stressDelta >= 0.05;
      return [{
        day: entry.day,
        key: improved && !worsened ? 'improved' : worsened && !improved ? 'worse' : 'unchanged',
        waitDelta: +waitDelta.toFixed(2),
        stressDelta: +stressDelta.toFixed(2),
        abandonedDelta,
      }];
    })
    .slice(-limit);
}

/** Compress the short transport-access history into a readable trend cue. */
export function tenantTransportForecastTrend(history) {
  const entries = Array.isArray(history) ? history.filter((entry) =>
    entry?.key === 'improved' || entry?.key === 'worse' || entry?.key === 'unchanged') : [];
  if (!entries.length) return { key: 'unknown', label: 'trend —', bars: '', entries: [] };
  const summary = localOverflowInterventionHistorySummary(entries.map((entry) => ({ tenantResult: { key: entry.key } })));
  const key = summary.stabilityKey;
  const bars = entries.map((entry) => entry.key === 'improved' ? '↑' : entry.key === 'worse' ? '↓' : '→').join('');
  return { key, label: summary.stabilityLabel, bars, entries };
}

/** Label the current queue forecast with simulation speed and rush phase. */
export function shaftQueueForecastContext(day, tod, speed, config) {
  const time = Number(tod);
  const windows = [
    ['MORNING RUSH', config?.time?.morningRush],
    ['LUNCH', config?.time?.lunch],
    ['EVENING RUSH', config?.time?.eveningRush],
  ];
  const phase = windows.find(([, phaseWindow]) => Array.isArray(phaseWindow) && time >= phaseWindow[0] && time <= phaseWindow[1])?.[0] ?? 'OFF-PEAK';
  const speedValue = Number(speed);
  const speedLabel = speedValue === 0 ? 'paused' : (Number.isFinite(speedValue) ? speedValue + '×' : 'live');
  const sampleIntervalMinutes = Math.max(1, Number(config?.time?.queueTrendSampleMinutes) || 30);
  return {
    day: Number.isFinite(Number(day)) ? Number(day) : null,
    tod: Number.isFinite(time) ? time : null,
    speed: speedValue,
    speedLabel,
    phase,
    sampleIntervalMinutes,
    label: speedLabel + ' · ' + phase,
  };
}

/** Connect a completed day's transport reading to the local queue signals. */
export function queueDailyServiceSummary(dayReading, config) {
  if (!dayReading) {
    return {
      key: 'warn',
      label: 'awaiting first day',
      detail: 'Queue trends are live; the first day close will add delivery, wait, and reputation context.',
    };
  }
  const deliveryRate = Number.isFinite(Number(dayReading.deliveryRate)) ? Number(dayReading.deliveryRate) : null;
  const avgWait = Number.isFinite(Number(dayReading.avgWait)) ? Number(dayReading.avgWait) : null;
  const abandoned = Number.isFinite(Number(dayReading.abandoned)) ? Math.max(0, Number(dayReading.abandoned)) : 0;
  const localAvgWait = Number.isFinite(Number(dayReading.localAvgWait)) ? Number(dayReading.localAvgWait) : null;
  const localAbandoned = Number.isFinite(Number(dayReading.localAbandoned)) ? Math.max(0, Number(dayReading.localAbandoned)) : 0;
  const elevatorAvgWait = Number.isFinite(Number(dayReading.elevatorAvgWait)) ? Number(dayReading.elevatorAvgWait) : null;
  const elevatorAbandoned = Number.isFinite(Number(dayReading.elevatorAbandoned)) ? Math.max(0, Number(dayReading.elevatorAbandoned)) : 0;
  const reputation = Number.isFinite(Number(dayReading.rep)) ? Number(dayReading.rep) : null;
  const localOverflowPeak = Number.isFinite(Number(dayReading.localOverflowPeak)) ? Math.max(0, Number(dayReading.localOverflowPeak)) : 0;
  const localOverflowPenalty = Number.isFinite(Number(dayReading.localOverflowPenalty)) ? Math.max(0, Number(dayReading.localOverflowPenalty)) : 0;
  const threshold = Number(config?.occupancy?.relistMinDeliveryRate) || 0;
  const key = abandoned > 0 || deliveryRate != null && deliveryRate < threshold ? 'bad'
    : deliveryRate != null && deliveryRate < 80 || localOverflowPeak > 0 ? 'warn' : 'good';
  const label = 'delivery ' + (deliveryRate == null ? '—' : deliveryRate + '%') +
    ' · wait ' + (avgWait == null ? '—' : avgWait + 's') +
    ' · rep ' + (reputation == null ? '—' : reputation + '%');
  const detail = abandoned > 0
    ? abandoned + ' rider' + (abandoned === 1 ? '' : 's') + ' gave up; abandonment and delivery feed reputation. Compare elevator and local-route readings to find the pressure.'
    : 'Daily delivery and wait feed reputation. Compare elevator and local-route readings to see whether pressure was temporary or sustained.';
  const split = (elevatorAvgWait != null || localAvgWait != null)
    ? ' Elevator: ' + (elevatorAvgWait == null ? '—' : elevatorAvgWait + 's wait') + ' / ' + elevatorAbandoned + ' gave up; local routes: ' +
      (localAvgWait == null ? '—' : localAvgWait + 's wait') + ' / ' + localAbandoned + ' gave up.'
    : '';
  const overflow = localOverflowPeak > 0
    ? ' Local routes exceeded immediate capacity by up to ' + localOverflowPeak + ' rider' + (localOverflowPeak === 1 ? '' : 's') +
      (localOverflowPenalty > 0 ? ', costing ' + localOverflowPenalty + ' reputation.' : '.')
    : '';
  return { key, label, detail: detail + split + overflow, deliveryRate, avgWait, abandoned, reputation, localAvgWait, localAbandoned, elevatorAvgWait, elevatorAbandoned, localOverflowPeak, localOverflowPenalty };
}

/** Preview the concrete effect of a selected-floor next-action handoff. */
export function floorHandoffPreview(summary, handoff, state, config) {
  if (!summary || !handoff || Number(handoff.floor) !== Number(summary.floor)) return null;
  if (handoff.kind === 'vacancy') {
    const unit = (state?.units ?? []).find((candidate) => candidate.id === handoff.unitId && !candidate.occupied);
    if (!unit) return null;
    const load = tenantLoadStatus(unit, config);
    return {
      key: 'occupancy',
      label: 'expected occupancy effect',
      detail: 'If eligible, re-renting this room changes the floor from ' + summary.tenants + '/' + summary.capacity +
        ' to ' + (summary.tenants + load.capacity) + '/' + summary.capacity + ' tenants (+' + load.capacity + ').',
    };
  }
  if (handoff.kind === 'car') {
    const capacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity ?? 0)));
    return {
      key: 'transport',
      label: 'expected queue effect',
      detail: 'One more elevator car adds up to ' + capacity + ' riders per dispatch; it adds ' + transportCoverageText('car') + '. Queue relief starts after it is placed in a shaft.',
    };
  }
  if (handoff.kind === 'shaft') {
    return {
      key: 'transport',
      label: 'expected queue effect',
      detail: 'A new shaft adds ' + transportCoverageText('shaft') + '; this floor can benefit after a car is added to the new shaft.',
    };
  }
  if (handoff.kind === 'stairs' || handoff.kind === 'escalator') {
    const routeLabel = handoff.kind === 'escalator' ? 'An escalator' : 'Stairs';
    return {
      key: 'transport',
      label: 'expected local-route effect',
      detail: routeLabel + ' can serve this floor without using an elevator car, removing this floor’s trips from the elevator queue once it is built.',
    };
  }
  return null;
}

/** Compare two local floor readings so an intervention has a visible outcome. */
export function floorDiagnosisChange(before, after) {
  if (!before || !after || Number(before.floor) !== Number(after.floor)) return null;
  const waitingBefore = Math.max(0, Math.round(Number(before.waiting) || 0));
  const waitingAfter = Math.max(0, Math.round(Number(after.waiting) || 0));
  const tenantsBefore = Math.max(0, Math.round(Number(before.tenants) || 0));
  const tenantsAfter = Math.max(0, Math.round(Number(after.tenants) || 0));
  const queueImproved = waitingAfter < waitingBefore;
  const queueWorsened = waitingAfter > waitingBefore;
  const occupancyImproved = tenantsAfter > tenantsBefore;
  const occupancyWorsened = tenantsAfter < tenantsBefore;
  const improved = queueImproved || occupancyImproved;
  const worsened = queueWorsened || occupancyWorsened;
  const key = improved && worsened ? 'mixed' : improved ? 'improved' : worsened ? 'worsened' : 'steady';
  return {
    key,
    waitingBefore,
    waitingAfter,
    waitingDelta: waitingAfter - waitingBefore,
    tenantsBefore,
    tenantsAfter,
    tenantDelta: tenantsAfter - tenantsBefore,
    beforeCapacity: Math.max(0, Math.round(Number(before.capacity) || 0)),
    afterCapacity: Math.max(0, Math.round(Number(after.capacity) || 0)),
    label: 'waiting ' + waitingBefore + ' → ' + waitingAfter + ' · tenants ' + tenantsBefore + '/' + Math.max(0, Math.round(Number(before.capacity) || 0)) +
      ' → ' + tenantsAfter + '/' + Math.max(0, Math.round(Number(after.capacity) || 0)),
  };
}

/** Turn a floor result into a different, plain-language next response. */
export function floorDiagnosisNextAction(summary, result) {
  if (!summary || !result) return null;
  if (result.key === 'improved') {
    return {
      key: 'monitor',
      label: 'monitor this floor',
      kind: null,
      detail: 'The last handoff improved this floor; watch one more day before spending again.',
    };
  }
  if (summary.waiting > 0 && result.source === 'car') {
    return {
      key: 'alternate_transport',
      label: 'try a shaft',
      kind: 'shaft',
      reason: 'the last car test did not clear the queue; the alternative is ' + transportCoverageText('shaft'),
      detail: 'The last car handoff did not clear the local queue; test a separate shaft route.',
    };
  }
  if (summary.waiting > 0 && result.source === 'shaft') {
    return {
      key: 'alternate_transport',
      label: 'try another car',
      kind: 'car',
      reason: 'the last shaft test did not clear the queue; the alternative is ' + transportCoverageText('car'),
      detail: 'The last shaft handoff did not clear the local queue; test more car capacity on an existing route.',
    };
  }
  if (result.source === 'vacancy' && summary.vacantRooms > 0) {
    return {
      key: 'experience',
      label: 'inspect room quality',
      kind: 'vacancy',
      detail: 'Re-renting did not improve this floor; inspect room evaluation before repeating leasing.',
    };
  }
  return {
    key: 'observe',
    label: 'watch this floor',
    kind: null,
    detail: 'The last change did not produce a clear improvement; collect another local reading before spending again.',
  };
}

/** Keep an improved floor visibly marked only during the day it was confirmed. */
export function floorDiagnosisWorkingState(result, currentDay) {
  if (!result || result.key !== 'improved') return null;
  const afterDay = Number(result.afterDay);
  const day = Number(currentDay);
  if (!Number.isFinite(afterDay) || !Number.isFinite(day) || afterDay !== day) return null;
  return {
    key: 'working',
    label: 'working',
    detail: 'The last local intervention improved this floor; monitor it before spending again.',
  };
}

/** Give a recent improvement a compact age cue before it fades from the list. */
export function floorDiagnosisAgeCue(result, currentDay) {
  if (!result || result.key !== 'improved') return null;
  const afterDay = Number(result.afterDay);
  const day = Number(currentDay);
  if (!Number.isFinite(afterDay) || !Number.isFinite(day)) return null;
  const ageDays = Math.floor(day - afterDay);
  if (ageDays < 0 || ageDays > 2) return null;
  return ageDays === 0
    ? { key: 'working', label: 'working today', detail: 'This floor improved today; monitor it before spending again.', ageDays }
    : { key: ageDays === 1 ? 'recent' : 'aged', label: ageDays + 'd old', detail: 'This floor improved ' + ageDays + ' day' + (ageDays === 1 ? '' : 's') + ' ago; take a fresh reading before acting.', ageDays };
}

/** Flag a response that has failed repeatedly on the same floor. */
export function floorDiagnosisRepeatedFailure(history, floor, source, minFailures = 2) {
  if (!source || !Array.isArray(history)) return null;
  const limit = Math.max(1, Math.floor(Number(minFailures) || 1));
  const attempts = history.filter((entry) =>
    Number(entry?.floor) === Number(floor) && entry?.source === source
  ).slice(-limit);
  if (attempts.length < limit || attempts.some((entry) => entry.key === 'improved')) return null;
  const label = source === 'vacancy' ? 'leasing' : source;
  return {
    key: 'repeat_failure',
    source,
    count: attempts.length,
    latest: attempts.at(-1),
    label: attempts.length + ' failed ' + label + ' tests',
    detail: 'This floor has not improved after ' + attempts.length + ' ' + label + ' tests; choose a different response before repeating it.',
  };
}

/** Keep only a small history of completed, player-started floor interventions. */
export function rememberFloorDiagnosisResult(history, result, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 1));
  const existing = Array.isArray(history) ? history : [];
  if (!result?.source) return existing.slice(-limit);
  return [...existing, result].slice(-limit);
}

/** Describe day-over-day movement in tower-wide tenant utilization. */
export function tenantUtilizationDelta(currentRatio, previousRatio) {
  const current = Number(currentRatio);
  const previous = Number(previousRatio);
  if (currentRatio == null || previousRatio == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { key: 'unknown', value: null, label: 'no prior day' };
  }
  const value = Math.round((current - previous) * 100);
  return value > 0
    ? { key: 'improved', value, label: 'Δ +' + value + ' pts' }
    : value < 0
      ? { key: 'worsened', value, label: 'Δ ' + value + ' pts' }
      : { key: 'steady', value: 0, label: 'Δ 0 pts' };
}

/** Describe the immediate utilization movement caused by a successful re-rent. */
export function tenantUtilizationRecoveryResult(beforeRatio, afterRatio) {
  const before = Number(beforeRatio);
  const after = Number(afterRatio);
  if (beforeRatio == null || afterRatio == null || !Number.isFinite(before) || !Number.isFinite(after)) {
    return { key: 'unknown', value: null, label: 'recovery —' };
  }
  const value = Math.round((after - before) * 100);
  return value > 0
    ? { key: 'improved', value, label: 'recovery +' + value + ' pts' }
    : value < 0
      ? { key: 'worsened', value, label: 'recovery ' + value + ' pts' }
      : { key: 'steady', value: 0, label: 'recovery 0 pts' };
}

/** Summarize the latest re-rent recovery for the compact HUD. */
export function tenantUtilizationRecoverySummary(history, currentDay = null) {
  const entry = Array.isArray(history)
    ? [...history].reverse().find((candidate) => candidate?.event === 'recovery')
    : null;
  const tenantGain = Number(entry?.tenantGain);
  const utilizationChange = Number(entry?.change);
  if (!entry || !Number.isFinite(tenantGain)) {
    return { key: 'none', tenantGain: null, utilizationChange: null, label: '—' };
  }
  const ageDays = Number.isFinite(Number(currentDay)) && Number.isFinite(Number(entry.day))
    ? Math.max(0, Math.floor(Number(currentDay) - Number(entry.day)))
    : 0;
  const aged = ageDays > 0;
  return {
    key: aged ? 'aged' : tenantGain > 0 ? 'improved' : tenantGain < 0 ? 'worsened' : 'steady',
    tenantGain,
    utilizationChange: Number.isFinite(utilizationChange) ? utilizationChange : null,
    ageDays,
    label: (aged ? 'last ' : '') + 'R ' + (tenantGain >= 0 ? '+' : '') + tenantGain + ' tenant' + (tenantGain === 1 ? '' : 's'),
  };
}

/** Compress recent utilization readings into a small oldest-to-newest sparkline. */
export function tenantUtilizationTrend(history, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({ ...entry, day: entry?.day, ratio: Number(entry?.ratio) }))
    .filter((entry) => Number.isFinite(entry.ratio))
    .slice(-limit);
  if (!entries.length) return { key: 'unknown', value: null, bars: '', label: 'trend —', entries: [], segments: [] };

  const values = entries.map((entry) => Math.max(0, Math.min(1, entry.ratio)));
  const value = Math.round((values.at(-1) - values[0]) * 100);
  const key = value > 0 ? 'improved' : value < 0 ? 'worsened' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const segments = values.map((ratio, index) => ({
    bar: levels[Math.round(ratio * (levels.length - 1))],
    event: entries[index].event === 'recovery' ? 'recovery' : 'daily',
  }));
  const bars = segments.map((segment) => segment.bar).join('');
  return { key, value, bars, label: 'trend ' + bars, entries, segments };
}

/** Format recent utilization readings so the sparkline has a readable numeric counterpart. */
export function tenantUtilizationHistoryLabel(history, maxEntries = 6) {
  const entries = tenantUtilizationTrend(history, maxEntries).entries;
  return entries.length
    ? entries.map((entry) => (entry.event === 'recovery' ? 'R' : 'D') + (entry.day ?? '—') + ' ' + Math.round(Math.max(0, Math.min(1, entry.ratio)) * 100) + '%' +
      (entry.event === 'recovery' && Number.isFinite(Number(entry.change)) ? ' (' + (entry.change >= 0 ? '+' : '') + entry.change + ' pts)' : '')).join(' · ')
    : 'no daily utilization history yet';
}

/** Turn a sustained utilization movement into a plain-language management cue. */
export function tenantUtilizationManagementHint(trend, { vacantRooms = 0, lowEvaluationRooms = 0 } = {}) {
  const readings = trend?.entries?.length ?? 0;
  if (readings < 3) {
    return {
      key: 'observe',
      label: 'watch occupancy',
      action: null,
      detail: 'Run ' + (3 - readings) + ' more day' + (3 - readings === 1 ? '' : 's') + ' before diagnosing a utilization trend.',
    };
  }
  if (trend.key === 'worsened') {
    if (vacantRooms > 0) {
      return {
        key: 'vacancies',
        label: 'check vacancies',
        action: 'vacancy',
        detail: vacantRooms + ' vacant room' + (vacantRooms === 1 ? ' is' : 's are') + ' lowering utilization; inspect leasing readiness before building more capacity.' +
          (lowEvaluationRooms > 0 ? ' ' + lowEvaluationRooms + ' occupied room' + (lowEvaluationRooms === 1 ? ' also has' : 's also have') + ' low evaluation.' : ''),
      };
    }
    if (lowEvaluationRooms > 0) {
      return {
        key: 'experience',
        label: 'check tenant experience',
        action: 'experience',
        detail: lowEvaluationRooms + ' occupied room' + (lowEvaluationRooms === 1 ? ' has' : 's have') + ' low evaluation; inspect stress, access, services, or rent before adding capacity.',
      };
    }
    return {
      key: 'demand',
      label: 'review tenant demand',
      action: 'demand',
      detail: 'Utilization is falling without a clear vacancy or room-health signal; review tenant demand before expanding.',
    };
  }
  if (trend.key === 'improved') {
    return { key: 'improved', label: 'occupancy improving', action: null, detail: 'Tenant utilization is rising across the recent readings.' };
  }
  return { key: 'steady', label: 'occupancy steady', action: null, detail: 'Tenant utilization is holding across the recent readings.' };
}

/** Name the room that a utilization hint has brought into focus. */
export function tenantUtilizationHintFocusLabel(unit) {
  if (!unit) return 'selected room';
  return 'F' + unit.floor + ' ' + unit.kind + (unit.occupied ? ' room' : ' vacancy');
}

/** Explain how the focused room relates to the current tower utilization signal. */
export function tenantUtilizationRoomContext(unit, evaluation, summary, trend, config) {
  if (!unit) return { key: 'unknown', detail: 'Select a room to see its utilization impact.' };
  const load = tenantLoadStatus(unit, config);
  const tenants = Math.max(0, Math.round(Number(summary?.tenants ?? 0)));
  const capacity = Math.max(0, Math.round(Number(summary?.capacity ?? 0)));
  const utilization = capacity ? Math.round((tenants / capacity) * 100) : 0;
  const direction = trend?.key === 'worsened' ? 'Utilization is trending down. '
    : trend?.key === 'improved' ? 'Utilization is improving. ' : '';
  if (!unit.occupied) {
    return {
      key: 'vacant',
      detail: direction + 'This vacancy adds ' + load.capacity + ' capacity but no tenants; filling it could raise the tower from ' + utilization + '% utilization.',
    };
  }
  const score = Number.isFinite(Number(evaluation?.score)) ? Number(evaluation.score) : '—';
  const risk = Number.isFinite(Number(evaluation?.score)) && evaluation.score < config.evaluation.relistMinScore
    ? ' Its evaluation is below the leasing threshold, so improving the tenant experience helps prevent another vacancy.'
    : '';
  return {
    key: risk ? 'at_risk' : 'occupied',
    detail: direction + 'This room contributes ' + load.tenants + ' tenant' + (load.tenants === 1 ? '' : 's') + ' to ' + tenants + '/' + capacity + '; keeping its ' + score + '/100 experience healthy protects utilization.' + risk,
  };
}

/** Describe a tenant unit before the player places it. */
export function tenantPlacementPreview(kind, config) {
  const tune = config.units[kind] || {};
  const role = tune.workers != null ? 'workers'
    : tune.residents != null ? 'residents'
      : tune.staff != null ? 'staff'
        : tune.guests != null ? 'guests' : 'tenants';
  return {
    kind,
    capacity: tune.workers ?? tune.residents ?? tune.staff ?? tune.guests ?? 0,
    role,
    targetShare: tune.targetShare ?? 0,
  };
}

/** List the services a prospective tenant room will need once occupied. */
export function tenantPlacementServiceNeeds(kind, config) {
  const tune = config?.units?.[kind] ?? {};
  const labels = { food: 'cafeteria', parking: 'parking', medical: 'clinic', security: 'security', recycling: 'recycling' };
  return ['food', 'parking', 'medical', 'security', 'recycling']
    .filter((service) => Number(tune[service + 'Need'] ?? 0) > 0)
    .map((service) => ({ kind: service, label: labels[service] ?? service, need: Number(tune[service + 'Need']) }));
}

/** Project the daily resident travel demand added by a condo placement. */
export function condoTransportPreview(config) {
  const residents = Math.max(0, Math.round(Number(config?.units?.condo?.residents) || 0));
  const roundTripsPerDay = Math.max(0, Math.round(residents * (Number(config?.demand?.condoTripsPerDay) || 0)));
  return { residents, roundTripsPerDay, passengerJourneysPerDay: roundTripsPerDay * 2 };
}

/** Project a selected tenant room's contribution after it is placed and occupied. */
export function tenantPlacementMixPreview(state, kind, config) {
  const placement = tenantPlacementPreview(kind, config);
  const currentMix = tenantMixDemand(state, config);
  const current = currentMix.find((entry) => entry.kind === kind);
  const currentTotal = currentMix.reduce((sum, entry) => sum + entry.heads, 0);
  const projectedTotal = currentTotal + placement.capacity;
  const projectedMix = currentMix.map((entry) => ({
    ...entry,
    heads: entry.heads + (entry.kind === kind ? placement.capacity : 0),
    share: projectedTotal
      ? +((entry.heads + (entry.kind === kind ? placement.capacity : 0)) / projectedTotal).toFixed(3)
      : 0,
  }));
  return {
    ...placement,
    currentShare: current?.share ?? 0,
    projectedShare: projectedMix.find((entry) => entry.kind === kind)?.share ?? 0,
    balanceBefore: mixBalance(currentMix),
    balanceAfter: mixBalance(projectedMix),
    balanceDelta: mixBalance(projectedMix) - mixBalance(currentMix),
  };
}

/** Preview room quality at a specific upper-floor placement without building it. */
export function tenantPlacementFloorPreview(state, kind, floor, config) {
  if (floor <= config.building.lobbyFloor || floor >= state.floors) {
    return { available: false, floor, reason: 'not buildable' };
  }
  const slot = freeSlot(state, config, floor);
  if (slot < 0) return { available: false, floor, reason: 'full' };
  const tune = config.units[kind] || {};
  const unit = {
    id: -1, kind, floor, slot,
    heads: tenantCapacity({ kind }, config),
    occupied: true, stress: 0, vacantDays: 0, renovated: false,
    servedToday: 0, rent: tune.rent,
  };
  return {
    available: true,
    kind,
    floor,
    slot,
    evaluation: unitEvaluation(state, unit, config),
    demandQuality: tenantDemandQuality(state, unit, config),
    mix: tenantPlacementMixPreview(state, kind, config),
  };
}

/** Compare a floor's preview quality with the best currently available floor. */
export function tenantPlacementFloorComparison(state, kind, floor, config) {
  const current = tenantPlacementFloorPreview(state, kind, floor, config);
  if (!current.available) return current;
  const alternatives = Array.from({ length: Math.max(0, state.floors - 1) }, (_, index) => index + 1)
    .map((candidateFloor) => tenantPlacementFloorPreview(state, kind, candidateFloor, config))
    .filter((preview) => preview.available);
  const best = alternatives.sort((a, b) => b.evaluation.score - a.evaluation.score)[0] ?? current;
  return {
    ...current,
    bestFloor: best.floor,
    bestScore: best.evaluation.score,
    scoreDelta: best.evaluation.score - current.evaluation.score,
    bestEvaluation: best.evaluation,
  };
}

const PLACEMENT_DECISION_STRENGTH = {
  aligned: 3,
  mix_tradeoff: 2,
  quality_warning: 1,
  combined_warning: 0,
};

function placementDecisionStrength(preview, config) {
  return PLACEMENT_DECISION_STRENGTH[tenantPlacementDecision(preview, config).key] ?? -1;
}

/** Return open floors that can replace unavailable comparison candidates. */
export function tenantPlacementReplacementPreviews(state, kind, comparedFloors, config) {
  const compared = new Set(comparedFloors);
  return Array.from({ length: Math.max(0, state.floors - 1) }, (_, index) => index + 1)
    .filter((floor) => !compared.has(floor))
    .map((floor) => tenantPlacementFloorComparison(state, kind, floor, config))
    .filter((preview) => preview.available)
    .sort((a, b) =>
      placementDecisionStrength(b, config) - placementDecisionStrength(a, config) ||
      b.evaluation.score - a.evaluation.score ||
      a.floor - b.floor);
}

/** Summarize whether a candidate's room quality and mix impact agree. */
export function tenantPlacementDecision(preview, config) {
  if (!preview?.available) return { key: 'unavailable', label: 'not available' };
  const qualityOkay = preview.evaluation.score >= config.evaluation.relistMinScore;
  const mixSafe = preview.mix.balanceDelta >= 0;
  if (qualityOkay && mixSafe) return { key: 'aligned', label: 'quality + mix aligned' };
  if (qualityOkay) return { key: 'mix_tradeoff', label: 'quality works · mix tradeoff' };
  if (mixSafe) return { key: 'quality_warning', label: 'mix-safe · quality warning' };
  return { key: 'combined_warning', label: 'quality + mix warning' };
}

/** Explain when a placement's mix impact is actively part of its warning. */
export function tenantPlacementDecisionReason(preview, config) {
  const decision = tenantPlacementDecision(preview, config);
  if (!preview?.available || decision.key === 'aligned' || decision.key === 'quality_warning') return '';
  const balanceDrop = Math.abs(preview.mix.balanceDelta);
  return decision.key === 'mix_tradeoff'
    ? 'mix tradeoff: balance falls ' + balanceDrop + ' pts'
    : 'mix + quality warning: balance falls ' + balanceDrop + ' pts';
}

/** Explain what room quality a different floor could improve before building. */
export function tenantPlacementAlternativeReason(preview) {
  if (!preview?.available) return '';
  const improvements = [];
  if (preview.scoreDelta > 0) {
    const main = 'choose F' + preview.bestFloor + ' instead for +' + preview.scoreDelta + ' room eval';
    const currentEvaluation = preview.evaluation;
    const bestEvaluation = preview.bestEvaluation;
    if (currentEvaluation && bestEvaluation) {
      const accessGain = Number(currentEvaluation.accessSlots) - Number(bestEvaluation.accessSlots);
      if (Number.isFinite(accessGain) && accessGain > 0) {
        improvements.push('access improves by ' + accessGain + ' slot' + (accessGain === 1 ? '' : 's'));
      }
      const services = ['food', 'parking', 'medical', 'security', 'recycling']
        .filter((service) => !currentEvaluation[service + 'Covered'] && bestEvaluation[service + 'Covered']);
      if (services.length) improvements.push('services gained: ' + services.join('/'));
    }
    return main + (improvements.length ? ' · ' + improvements.join(' · ') : '');
  }
  return 'no higher room-evaluation alternative';
}

function investmentStatus(state, config, kind, label, cost, placeable, unlockLabel) {
  if (!unlocked(state, config, kind)) return label + ' (locked until ' + unlockLabel + ')';
  if (!placeable) return label + ' ' + formatCost(cost) + ' (no open covered floor)';
  if (state.money < cost) return label + ' ' + formatCost(cost) + ' (save ' + formatCost(cost - state.money) + ' more)';
  return label + ' ' + formatCost(cost) + ' (ready)';
}

function investmentOption(state, config, kind, label, cost, placeable, benefit) {
  return {
    kind,
    label,
    cost,
    benefit,
    placeable,
    unlocked: unlocked(state, config, kind),
    text: investmentStatus(state, config, kind, label, cost, placeable, unlockLabel(config, kind)),
  };
}

function unlockLabel(config, kind) {
  const tier = config.stars.tiers.find((entry) => entry.unlocks.includes(kind) && entry.pop > 0);
  return (tier?.pop ?? '?') + ' pop';
}

function facilityPlaceableForFloor(state, config, kind, floor) {
  const radius = config.services?.[kind]?.coverageFloors ?? 0;
  return Array.from({ length: Math.max(0, state.floors - 1) }, (_, index) => index + 1)
    .some((candidateFloor) => Math.abs(candidateFloor - floor) <= radius && freeSlot(state, config, candidateFloor) >= 0);
}

function shaftInvestment(state, config) {
  const bottom = config.building.lobbyFloor ?? 0;
  const top = Math.min(state.floors - 1, config.elevator.maxSpan - 1);
  const span = top - bottom + 1;
  const cost = top > bottom ? config.costs.shaft + config.costs.shaftPerFloor * (span - 1) : Infinity;
  const placeable = top > bottom && clearRouteColumn(state, bottom, top, config);
  return investmentOption(state, config, 'shaft', 'shaft', cost, placeable, 0);
}

/** Return the access and service investments relevant to a selected floor. */
export function tenantPlacementInvestmentOptions(preview, state, config) {
  if (!preview?.available || !preview.evaluation || !state || !config) return [];
  const evaluation = preview.evaluation;
  const investments = [];
  if (Number(evaluation.accessPenalty) > 0) {
    investments.push(shaftInvestment(state, config));
  }
  const services = [
    ['food', 'cafeteria', 'foodCovered', 'foodPenalty'],
    ['parking', 'parking', 'parkingCovered', 'parkingPenalty'],
    ['medical', 'clinic', 'medicalCovered', 'medicalPenalty'],
    ['security', 'security', 'securityCovered', 'securityPenalty'],
    ['recycling', 'recycling', 'recyclingCovered', 'recyclingPenalty'],
  ].filter(([, , covered, penalty]) => !evaluation[covered] && Number(evaluation[penalty]) > 0)
    .map(([name, label, , penalty]) => investmentOption(
      state,
      config,
      name,
      label,
      config.costs[name],
      facilityPlaceableForFloor(state, config, name, preview.floor),
      Number(evaluation[penalty]),
    ));
  if (services.length) investments.push(...services);
  return investments;
}

/** Return the cheapest unlocked, placeable investment for a selected floor. */
export function tenantPlacementSmallestInvestment(preview, state, config) {
  return tenantPlacementInvestmentOptions(preview, state, config)
    .filter((investment) => investment.unlocked && investment.placeable)
    .sort((a, b) => a.cost - b.cost || b.benefit - a.benefit)[0] ?? null;
}

function firstClearRouteSlot(state, bottom, top, config) {
  for (let slot = 0; slot < config.building.slotsPerFloor; slot++) {
    if (Array.from({ length: top - bottom + 1 }, (_, index) => bottom + index)
      .every((floor) => !slotsUsed(state, floor).has(slot))) return slot;
  }
  return -1;
}

function previewUnit(preview, config) {
  const tune = config.units[preview.kind] || {};
  return {
    id: -1,
    kind: preview.kind,
    floor: preview.floor,
    slot: preview.slot,
    heads: tenantCapacity({ kind: preview.kind }, config),
    occupied: true,
    stress: 0,
    vacantDays: 0,
    renovated: false,
    servedToday: 0,
    rent: tune.rent,
  };
}

function evaluationImpacts(before, after) {
  const impacts = [];
  const penalties = [
    ['access', 'accessPenalty', 'access'],
    ['food', 'foodPenalty', 'food coverage'],
    ['parking', 'parkingPenalty', 'parking coverage'],
    ['medical', 'medicalPenalty', 'medical coverage'],
    ['security', 'securityPenalty', 'security coverage'],
    ['recycling', 'recyclingPenalty', 'recycling coverage'],
  ];
  for (const [key, field, label] of penalties) {
    const delta = Math.round(Number(before[field] ?? 0) - Number(after[field] ?? 0));
    if (delta > 0) impacts.push({ key, label, delta });
  }
  const amenityDelta = Math.round(Number(after.amenityBonus ?? 0) - Number(before.amenityBonus ?? 0));
  if (amenityDelta > 0) impacts.push({ key: 'amenity', label: 'amenity', delta: amenityDelta });
  return impacts;
}

/** Describe signed evaluation-component changes between two room readings. */
export function evaluationDrift(before, after) {
  const components = [
    ['stress', 'stressPenalty', -1],
    ['access', 'accessPenalty', -1],
    ['noise', 'noisePenalty', -1],
    ['food coverage', 'foodPenalty', -1],
    ['parking coverage', 'parkingPenalty', -1],
    ['medical coverage', 'medicalPenalty', -1],
    ['security coverage', 'securityPenalty', -1],
    ['recycling coverage', 'recyclingPenalty', -1],
    ['rent', 'rentAdjustment', 1],
    ['amenity', 'amenityBonus', 1],
    ['layout', 'layoutBonus', 1],
    ['view', 'viewBonus', 1],
    ['fit', 'preferencePenalty', -1],
  ];
  return components.map(([label, field, direction]) => ({
    label,
    delta: Math.round((Number(after?.[field] ?? 0) - Number(before?.[field] ?? 0)) * direction),
  })).filter(({ delta }) => delta !== 0);
}

/** Keep only the latest bounded room-evaluation readings for player feedback. */
export function boundedEvaluationTrend(readings, maxDays = 3) {
  const limit = Math.max(1, Math.floor(maxDays));
  return (Array.isArray(readings) ? readings : []).slice(-limit)
    .map((reading) => ({
      day: reading.day,
      score: reading.score,
      stress: reading.stress,
      occupied: reading.occupied,
    }));
}

/** Flag a low room score only after the latest occupied readings agree. */
export function sustainedLowEvaluation(readings, threshold, minReadings = 2) {
  const limit = Math.max(1, Math.floor(minReadings));
  const occupied = (Array.isArray(readings) ? readings : [])
    .filter((reading) => reading.occupied !== false)
    .slice(-limit);
  const scores = occupied.map((reading) => Number(reading.score)).filter(Number.isFinite);
  const sustained = scores.length === limit && scores.every((score) => score < threshold);
  return {
    sustained,
    readings: scores.length,
    average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
  };
}

/** Choose the safe next room action once low evaluation has persisted. */
export function roomEvaluationResponse(unit) {
  if (!unit) return null;
  if (unit.occupied) return { key: 'inspect', label: 'inspect room' };
  if (!unit.renovated) return { key: 'renovate', label: 'renovate before re-rent' };
  return { key: 'inspect', label: 'inspect leasing blockers' };
}

/** Keep a small list of sustained room warnings after the temporary result clears. */
export function rememberRoomHealthHistory(history, outcome, unit, config, maxEntries = 3) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const previous = Array.isArray(history) ? history : [];
  if (!outcome?.actualUnitId || !unit || !config?.evaluation) return previous.slice(-limit);
  const sustained = sustainedLowEvaluation(outcome.trend, config.evaluation.relistMinScore, 2);
  if (!sustained.sustained) return previous.slice(-limit);
  const lastReading = Array.isArray(outcome.trend) ? outcome.trend.at(-1) : null;
  const scoreAtRefresh = Number.isFinite(lastReading?.score) ? lastReading.score : null;
  const entry = {
    unitId: unit.id,
    floor: unit.floor,
    kind: unit.kind,
    day: Number.isFinite(lastReading?.day) ? lastReading.day : outcome.occupiedDay,
    average: sustained.average,
    readings: sustained.readings,
    scoreAtRefresh,
    deltaAtRefresh: scoreAtRefresh == null ? null : scoreAtRefresh - sustained.average,
  };
  return [...previous.filter((candidate) => candidate?.unitId !== entry.unitId), entry].slice(-limit);
}

/** Classify a retained warning against the room's current live evaluation. */
export function roomHealthHistoryStatus(entry, state, unit, config) {
  if (!entry || !state || !unit || !config?.evaluation) return null;
  const evaluation = unitEvaluation(state, unit, config);
  const active = evaluation.score < config.evaluation.relistMinScore;
  return {
    key: active ? 'active' : 'resolved',
    label: active ? 'ACTIVE LOW EVAL' : 'RESOLVED HISTORY',
    score: evaluation.score,
  };
}

/** Select the direct action for a retained warning without making resolved history actionable. */
export function roomHealthHistoryAction(status, unit) {
  if (!status || status.key !== 'active') return { key: 'monitor', label: 'monitor only' };
  const response = roomEvaluationResponse(unit);
  return response?.key === 'renovate'
    ? { key: 'renovate', label: 'renovate room' }
    : { key: 'inspect', label: 'open room' };
}

/** Describe the current score change against the retained warning average. */
export function roomHealthHistoryChange(entry, status) {
  const current = Number(status?.score);
  const historical = Number(entry?.average);
  if (!Number.isFinite(current) || !Number.isFinite(historical)) {
    return { key: 'unknown', value: null, label: 'change unavailable' };
  }
  const value = current - historical;
  return value > 0
    ? { key: 'improved', value, label: 'improved +' + value }
    : value < 0
      ? { key: 'worsened', value, label: 'worsened ' + value }
      : { key: 'steady', value: 0, label: 'steady' };
}

/** Describe how long ago the retained warning was refreshed. */
export function roomHealthHistoryAge(entry, state) {
  const currentDay = Number(state?.day);
  const refreshedDay = Number(entry?.day);
  if (!Number.isFinite(currentDay) || !Number.isFinite(refreshedDay)) return null;
  return Math.max(0, Math.floor(currentDay - refreshedDay));
}

/** Describe how long ago the retained warning was refreshed. */
export function roomHealthHistoryAgeLabel(entry, state) {
  const age = roomHealthHistoryAge(entry, state);
  if (age == null) return 'age unavailable';
  return age === 0 ? 'fresh' : age === 1 ? '1 day old' : age + ' days old';
}

/** Escalate only active warnings that have remained unresolved for multiple days. */
export function roomHealthHistoryUrgency(status, ageDays, staleAfterDays = 2) {
  if (!status || status.key !== 'active') return status?.key === 'resolved'
    ? { key: 'resolved', label: status.label }
    : { key: 'unknown', label: 'status unavailable' };
  const stale = Number.isFinite(Number(ageDays)) && Number(ageDays) >= Math.max(1, Math.floor(staleAfterDays));
  return stale
    ? { key: 'stale', label: 'STALE ACTIVE LOW EVAL' }
    : { key: 'active', label: status.label };
}

/** Rank retained warnings so unresolved and older problems lead the list. */
export function roomHealthHistoryPriority(status, ageDays, staleAfterDays = 2) {
  const urgency = roomHealthHistoryUrgency(status, ageDays, staleAfterDays);
  return urgency.key === 'stale' ? 0 : urgency.key === 'active' ? 1 : urgency.key === 'resolved' ? 2 : 3;
}

/** Preview how the suggested infrastructure changes the warned room's score. */
export function tenantPlacementInvestmentPreview(preview, target, state, config, placementFloor = target?.floor) {
  if (!preview?.available || !target?.tool || !state || !config) {
    return { available: false, reason: 'no improvement target' };
  }
  const floor = Number(placementFloor);
  const targetFloor = Number(target.floor);
  if (!Number.isInteger(floor) || !Number.isInteger(targetFloor)) {
    return { available: false, reason: 'choose a guided floor' };
  }

  const projectedState = {
    ...state,
    facilities: [...(state.facilities ?? [])],
    shafts: [...(state.shafts ?? [])],
  };
  if (config.services?.[target.tool]) {
    const radius = config.services[target.tool].coverageFloors ?? 0;
    if (floor <= config.building.lobbyFloor || floor >= state.floors) {
      return { available: false, reason: 'choose an upper floor' };
    }
    if (Math.abs(floor - targetFloor) > radius) {
      return { available: false, reason: 'outside service coverage' };
    }
    const slot = freeSlot(state, config, floor);
    if (slot < 0) return { available: false, reason: 'floor is full' };
    projectedState.facilities.push({ id: -1, kind: target.tool, floor, slot });
  } else if (target.tool === 'shaft') {
    const bottom = config.building.lobbyFloor ?? 0;
    const top = Math.min(floor, state.floors - 1, bottom + config.elevator.maxSpan - 1);
    if (top < targetFloor || top <= bottom) {
      return { available: false, reason: 'reach the target floor' };
    }
    const slot = firstClearRouteSlot(state, bottom, top, config);
    if (slot < 0) return { available: false, reason: 'no clear shaft column' };
    projectedState.shafts.push({ id: -1, slot, bottom, top, cars: [], calls: {} });
  } else {
    return { available: false, reason: 'unsupported improvement' };
  }

  const beforeUnit = previewUnit(preview, config);
  const roomSlot = freeSlot(projectedState, config, targetFloor);
  if (roomSlot < 0) return { available: false, reason: 'target floor would be full' };
  const afterUnit = { ...beforeUnit, slot: roomSlot };
  const before = unitEvaluation(state, beforeUnit, config);
  const after = unitEvaluation(projectedState, afterUnit, config);
  const demandBefore = tenantDemandQuality(state, beforeUnit, config);
  const demandAfter = tenantDemandQuality(projectedState, afterUnit, config);
  return {
    available: true,
    kind: target.tool,
    targetFloor,
    placementFloor: floor,
    roomSlot,
    before,
    after,
    demandBefore,
    demandAfter,
    demandScoreDelta: demandAfter.score - demandBefore.score,
    demandBonusDelta: demandAfter.bonus - demandBefore.bonus,
    impacts: evaluationImpacts(before, after),
    scoreDelta: after.score - before.score,
  };
}

/** Explain which build tools, costs, and current availability could improve the selected floor. */
export function tenantPlacementInvestmentReason(preview, state, config) {
  const investments = tenantPlacementInvestmentOptions(preview, state, config);
  if (!investments.length) return '';
  const smallest = tenantPlacementSmallestInvestment(preview, state, config);
  const firstMove = smallest ? ' · smallest useful: ' + smallest.text : '';
  return 'or keep F' + preview.floor + ' and invest in ' + investments.map((investment) => investment.text).join('; ') + firstMove;
}

/** State which of two available candidates is stronger under the combined ranking. */
export function tenantPlacementComparisonChoice(preview, other, config) {
  if (!preview?.available || !other?.available) return { key: 'unavailable', label: 'comparison unavailable' };
  const strengthDelta = placementDecisionStrength(preview, config) - placementDecisionStrength(other, config);
  if (strengthDelta > 0) {
    return {
      key: 'stronger',
      label: 'stronger combined choice',
      detail: '',
      reason: tenantPlacementDecision(preview, config).label + ' outranks ' + tenantPlacementDecision(other, config).label,
    };
  }
  if (strengthDelta < 0) return {
    key: 'weaker',
    label: 'weaker combined choice',
    detail: Math.abs(strengthDelta) + ' decision tier' + (Math.abs(strengthDelta) === 1 ? '' : 's') +
      ' below F' + other.floor,
    reason: tenantPlacementDecision(other, config).label + ' outranks ' + tenantPlacementDecision(preview, config).label,
  };
  const scoreDelta = preview.evaluation.score - other.evaluation.score;
  if (scoreDelta > 0) {
    return {
      key: 'stronger',
      label: 'stronger combined choice',
      detail: '',
      reason: Math.abs(scoreDelta) + ' eval point' + (Math.abs(scoreDelta) === 1 ? '' : 's') + ' higher',
    };
  }
  if (scoreDelta < 0) return {
    key: 'weaker',
    label: 'weaker combined choice',
    detail: Math.abs(scoreDelta) + ' eval point' + (Math.abs(scoreDelta) === 1 ? '' : 's') +
      ' below F' + other.floor,
    reason: Math.abs(scoreDelta) + ' eval point' + (Math.abs(scoreDelta) === 1 ? '' : 's') + ' lower',
  };
  return {
    key: 'equal',
    label: 'same combined signal',
    detail: '',
    reason: 'no measurable combined advantage',
  };
}

/** Explain why the strongest replacement can still be a deliberate tradeoff. */
export function tenantPlacementRankingReason(previews, config) {
  const top = previews?.[0];
  const topDecision = tenantPlacementDecision(top, config);
  if (!top?.available || topDecision.key !== 'mix_tradeoff') return '';
  const balanceDelta = top.mix.balanceDelta;
  const nextLower = previews.slice(1).find((preview) =>
    placementDecisionStrength(preview, config) < placementDecisionStrength(top, config));
  const nextText = nextLower
    ? '; next lower category: ' + tenantPlacementDecision(nextLower, config).label + ' on F' + nextLower.floor
    : '; no lower decision category is available';
  return 'top combined pick: room quality passes the ' + config.evaluation.relistMinScore +
    ' minimum, but tenant-mix balance falls ' + Math.abs(balanceDelta) + ' pts' + nextText;
}

/** Forecast the next tenant type and projected population mix without changing state. */
export function tenantDemandForecast(state, config, reputation = null) {
  const leasing = leasingForecast(state, config, reputation);
  const projectedHeads = new Map(Object.keys(config.units).map((kind) => [kind, 0]));
  for (const unit of state.units) {
    if (unit.occupied) projectedHeads.set(unit.kind, (projectedHeads.get(unit.kind) ?? 0) + (unit.heads ?? 0));
  }
  const selected = leasing.candidates.slice(0, leasing.capacity);
  for (const { unit } of selected) {
    projectedHeads.set(unit.kind, (projectedHeads.get(unit.kind) ?? 0) + tenantCapacity(unit, config));
  }
  const projectedTotal = [...projectedHeads.values()].reduce((sum, heads) => sum + heads, 0);
  const demand = tenantMixDemand(state, config);
  const unlockedKinds = Object.keys(config.units).filter((kind) => unlocked(state, config, kind));
  const demandKinds = demand
    .filter((entry) => unlockedKinds.includes(entry.kind) && entry.marketDemandBonus > 0)
    .map((entry) => entry.kind);
  return {
    nextKind: selected[0]?.unit.kind ?? null,
    nextExperienceDemand: selected[0]?.experienceDemand ?? null,
    nextMarketDemandBonus: selected[0]?.marketDemandBonus ?? 0,
    transportAccess: leasing.transportAccess,
    expectedMoveIns: selected.length,
    lockedKinds: Object.keys(config.units).filter((kind) => !unlockedKinds.includes(kind)),
    absentKinds: unlockedKinds.filter((kind) => !demandKinds.includes(kind)),
    projectedMix: Object.entries(config.units).map(([kind, tune]) => ({
      kind,
      heads: projectedHeads.get(kind) ?? 0,
      share: projectedTotal ? (projectedHeads.get(kind) ?? 0) / projectedTotal : 0,
      targetShare: tune.targetShare ?? 0,
    })),
    gateOpen: leasing.gateOpen,
  };
}

/** Return a compact history of the leasing outcomes recorded at day close. */
export function tenantLeasingHistory(state, config) {
  const windowSize = Math.max(1, Math.floor(config.occupancy.tenantDemandHistoryDays ?? 1));
  const leasingDays = state.log.slice(-windowSize)
    .filter((day) => day.leasing && Array.isArray(day.leasing.movedIn));
  return leasingDays.map((day, index) => {
      const previousDay = leasingDays[index - 1];
      const movedIn = day.leasing.movedIn;
      const averageScore = movedIn.length
        ? Math.round(movedIn.reduce((sum, move) => sum + move.experienceDemandScore, 0) / movedIn.length)
        : null;
      const averageBonus = movedIn.length
        ? Math.round(movedIn.reduce((sum, move) => sum + move.experienceDemandBonus, 0) / movedIn.length)
        : null;
      const averageDesirabilityBonus = movedIn.length
        ? Math.round(movedIn.reduce((sum, move) => sum + (Number(move.desirabilityDemandBonus) || 0), 0) / movedIn.length)
        : null;
      const averageTransportAccessBonus = movedIn.length
        ? Math.round(movedIn.reduce((sum, move) => sum + (Number(move.transportAccessBonus) || 0), 0) / movedIn.length)
        : null;
      const averageMarketBonus = movedIn.length
        ? Math.round(movedIn.reduce((sum, move) => sum + move.marketDemandBonus, 0) / movedIn.length)
        : null;
      return {
        day: day.day,
        candidates: day.leasing.candidates,
        capacity: day.leasing.capacity,
        transportAccessKey: day.leasing.transportAccess?.key ?? 'unknown',
        transportAccessLabel: day.leasing.transportAccess?.label ?? 'no forecast recorded',
        transportAccessBonus: Number(day.leasing.transportAccess?.bonus) || 0,
        transportAccessTests: Number(day.leasing.transportAccess?.tests) || 0,
        transportAccessTrendKey: day.leasing.transportAccess?.trendKey ?? 'unknown',
        transportAccessTrendBars: day.leasing.transportAccess?.trendBars ?? '',
        rankingSignals: day.leasing.rankingSignals ?? null,
        appealChanges: vacancyRankingAppealChanges(previousDay?.leasing?.rankingSignals ?? null, day.leasing.rankingSignals ?? null),
        movedIn: movedIn.length,
        averageScore,
        averageBonus,
        averageTransportAccessBonus,
        realizedTransportAccessBonus: averageTransportAccessBonus,
        averageDesirabilityBonus,
        averageMarketBonus,
      };
  });
}

/** Find the latest recorded access forecast and realized contribution for one room. */
export function tenantAccessOutcomeForUnit(state, unit) {
  if (!unit) return null;
  const days = Array.isArray(state?.log) ? [...state.log].reverse() : [];
  for (const day of days) {
    const movedIn = Array.isArray(day?.leasing?.movedIn) ? day.leasing.movedIn : [];
    const move = [...movedIn].reverse().find((entry) =>
      Number.isFinite(Number(entry?.unitId))
        ? Number(entry.unitId) === Number(unit.id)
        : entry?.floor === unit.floor && entry?.unitKind === unit.kind);
    if (!move) continue;
    const forecast = day.leasing.transportAccess ?? null;
    return {
      day: day.day,
      unitId: move.unitId ?? unit.id,
      forecastKey: forecast?.key ?? 'unknown',
      forecastLabel: forecast?.label ?? 'no forecast recorded',
      forecastBonus: forecast && Number.isFinite(Number(forecast.bonus)) ? Number(forecast.bonus) : null,
      forecastTests: Number(forecast?.tests) || 0,
      forecastTrendBars: forecast?.trendBars ?? '',
      realizedBonus: Number.isFinite(Number(move.transportAccessBonus)) ? Number(move.transportAccessBonus) : null,
    };
  }
  return null;
}

/** Explain the current market position of one vacant room before recovery. */
export function vacancyDemandSummary(state, unit, config, reputation = null) {
  if (!unit || unit.occupied) {
    return { key: 'occupied', currentKind: unit?.kind ?? null, detail: 'occupied rooms are not on the leasing market' };
  }
  const forecast = leasingForecast(state, config, reputation);
  const candidate = forecast.marketCandidates.find((entry) => entry.unit.id === unit.id) ?? null;
  const likely = forecast.marketCandidates[0] ?? null;
  const rank = candidate ? forecast.marketCandidates.findIndex((entry) => entry.unit.id === unit.id) + 1 : null;
  if (!forecast.gateOpen) {
    return {
      key: 'reputation', currentKind: unit.kind, likelyKind: likely?.unit.kind ?? null,
      rank, candidates: forecast.marketCandidates.length,
      transportAccess: forecast.transportAccess,
      detail: 'replacement demand is paused by the reputation gate',
    };
  }
  if (candidate) {
    return {
      key: 'candidate', currentKind: unit.kind, likelyKind: candidate.unit.kind,
      rank, candidates: forecast.marketCandidates.length,
      qualityScore: candidate.experienceDemand.score,
      qualityBonus: candidate.experienceDemand.experienceBonus,
      desirabilityScore: candidate.experienceDemand.desirabilityScore,
      desirabilityBonus: candidate.experienceDemand.desirabilityBonus,
      demandBonus: candidate.experienceDemand.bonus,
      marketBonus: candidate.marketDemandBonus,
      transportAccess: forecast.transportAccess,
      detail: 'likely tenant: ' + candidate.unit.kind + ' · market rank ' + rank + '/' + forecast.marketCandidates.length +
        ' · quality +' + candidate.experienceDemand.experienceBonus +
        ' · appeal ' + (candidate.experienceDemand.desirabilityBonus >= 0 ? '+' : '') + candidate.experienceDemand.desirabilityBonus +
        ' · mix +' + candidate.marketDemandBonus,
    };
  }
  return {
    key: 'not_ready', currentKind: unit.kind, likelyKind: likely?.unit.kind ?? null,
    rank: null, candidates: forecast.marketCandidates.length,
    transportAccess: forecast.transportAccess,
    detail: likely
      ? 'market currently favors ' + likely.unit.kind + '; this room is not eligible yet'
      : 'no vacancy currently clears the room-quality and market-timing gates',
  };
}

/** Explain when room desirability is the deciding signal between top vacancies. */
export function vacancyRankingReason(forecast) {
  const candidates = forecast?.marketCandidates ?? [];
  if (candidates.length < 2) return '';
  const top = candidates[0];
  const runnerUp = candidates[1];
  const topDemand = top.experienceDemand ?? {};
  const runnerDemand = runnerUp.experienceDemand ?? {};
  const sameBaseSignals = top.evaluation?.score === runnerUp.evaluation?.score &&
    top.marketDemandBonus === runnerUp.marketDemandBonus &&
    topDemand.experienceBonus === runnerDemand.experienceBonus;
  if (!sameBaseSignals || topDemand.desirabilityBonus <= runnerDemand.desirabilityBonus) return '';
  const signed = (value) => (value >= 0 ? '+' : '') + value;
  return 'ranking decided by room desirability: F' + top.unit.floor + ' appeal ' + signed(topDemand.desirabilityBonus) +
    ' vs F' + runnerUp.unit.floor + ' appeal ' + signed(runnerDemand.desirabilityBonus) +
    ' after equal room quality, access/services, and tenant-mix demand';
}

/** Turn the combined vacancy ranking into one clear player-facing next step. */
export function vacancyRankingGuidance(forecast) {
  const candidates = forecast?.marketCandidates ?? [];
  if (!candidates.length) {
    return { key: 'none', label: 'no vacancy choice yet', detail: 'wait for a vacancy to clear the room-quality and market-timing gates' };
  }
  const top = candidates[0];
  if (candidates.length === 1) {
    return {
      key: 'single',
      label: 'start with F' + top.unit.floor + ' ' + top.unit.kind,
      detail: 'this is the only eligible vacancy; its priority combines room quality, tenant mix, access, and room appeal',
      unitId: top.unit.id,
      floor: top.unit.floor,
    };
  }
  return {
    key: 'compare',
    label: 'start with F' + top.unit.floor + ' ' + top.unit.kind,
    detail: 'this room leads the combined vacancy ranking; compare its room quality, tenant mix, access, and appeal with the next vacancy before committing',
    unitId: top.unit.id,
    floor: top.unit.floor,
    runnerFloor: candidates[1].unit.floor,
  };
}

/** Explain whether the room being confirmed is the combined vacancy choice. */
export function vacancyPreFillGuidance(forecast, unitId) {
  const candidates = forecast?.marketCandidates ?? [];
  const selectedIndex = candidates.findIndex((candidate) => candidate.unit?.id === unitId);
  const selected = selectedIndex >= 0 ? candidates[selectedIndex] : null;
  const top = candidates[0] ?? null;
  if (!selected) {
    return {
      key: 'not-ranked',
      label: 'not in the current vacancy ranking',
      detail: 'this room is not yet eligible on the combined room-quality, tenant-mix, access, and market-timing checks',
    };
  }
  if (selectedIndex === 0) {
    return {
      key: 'recommended',
      label: 'combined choice: F' + selected.unit.floor + ' ' + selected.unit.kind,
      detail: 'this room ranks first after combining room quality, tenant mix, access, and appeal',
      rank: 1,
      unitId: selected.unit.id,
      floor: selected.unit.floor,
    };
  }
  return {
    key: 'alternative',
    label: 'combined choice: F' + top.unit.floor + ' ' + top.unit.kind,
    detail: 'this room is rank ' + (selectedIndex + 1) + '; the combined ranking favors F' + top.unit.floor + ' before it on room quality, tenant mix, access, and appeal',
    rank: selectedIndex + 1,
    unitId: selected.unit.id,
    floor: selected.unit.floor,
    recommendedUnitId: top.unit.id,
    recommendedFloor: top.unit.floor,
  };
}

/** Combine the vacancy choice with the tenant and mix outcome shown before re-rent. */
function vacancyCandidateRankingBreakdown(candidate, rank) {
  if (!candidate) return null;
  const demand = candidate.experienceDemand ?? {};
  return {
    rank,
    unitId: candidate.unit.id,
    floor: candidate.unit.floor,
    kind: candidate.unit.kind,
    roomQuality: Number(candidate.evaluation?.score) || 0,
    experience: Number(demand.experienceBonus) || 0,
    tenantMix: Number(candidate.marketDemandBonus) || 0,
    access: Number(demand.transportAccessBonus) || 0,
    appeal: Number(demand.desirabilityBonus) || 0,
    total: (Number(candidate.evaluation?.score) || 0) + (Number(candidate.marketDemandBonus) || 0) + (Number(demand.bonus) || 0),
  };
}

export function vacancyPreFillOverrideComponent(preview) {
  if (!preview || preview.key === 'recommended' || !preview.ranking || !preview.recommendedRanking) return null;
  const labels = { roomQuality: 'room quality', experience: 'experience', tenantMix: 'tenant mix', access: 'access', appeal: 'appeal' };
  const fields = Object.keys(labels);
  const strongest = fields.reduce((best, field) => {
    const delta = (Number(preview.ranking[field]) || 0) - (Number(preview.recommendedRanking[field]) || 0);
    return !best || delta > best.delta ? { key: field, delta } : best;
  }, null);
  if (!strongest || strongest.delta <= 0) {
    return { key: 'none', label: 'no clear component pull', detail: 'the selected room was an override without a higher saved component score' };
  }
  return {
    key: strongest.key,
    label: labels[strongest.key],
    delta: strongest.delta,
    detail: 'selected F' + preview.ranking.floor + ' had +' + strongest.delta + ' ' + labels[strongest.key] + ' versus recommended F' + preview.recommendedRanking.floor,
  };
}

/** Put the override component into the player's pre-confirmation guidance. */
export function vacancyPreFillOverrideGuidance(preview) {
  const component = preview?.overrideComponent;
  return component?.key && component.key !== 'none'
    ? ' · override pull: ' + component.label + ' — ' + component.detail
    : '';
}

/** Build the short labeled lines shown in a manual re-rent confirmation. */
export function vacancyPreFillConfirmationLines(preview) {
  if (!preview) return [];
  const override = vacancyPreFillOverrideGuidance(preview).replace(/^ · /, '');
  return [
    'choice: ' + preview.label + ' — ' + preview.detail,
    override,
    'tenant: likely ' + preview.tenantKind + ' ' + preview.role + ' (' + preview.capacity + ')',
    'mix: ' + Math.round(preview.currentShare * 100) + '% → ' + Math.round(preview.projectedShare * 100) + '% / ' + Math.round(preview.targetShare * 100) + '% target · balance ' +
      (preview.balanceDelta >= 0 ? '+' : '') + Math.round(preview.balanceDelta) + ' pts',
  ].filter(Boolean);
}

export function vacancyPreFillOutcome(state, unit, config, forecast = null) {
  if (!unit || unit.occupied) return { key: 'occupied', label: 'occupied room', detail: 'occupied rooms do not have a pre-fill outcome' };
  const leasing = forecast ?? leasingForecast(state, config);
  const ranking = vacancyPreFillGuidance(leasing, unit.id);
  const candidateIndex = (leasing.marketCandidates ?? []).findIndex((candidate) => candidate.unit?.id === unit.id);
  const candidate = candidateIndex >= 0 ? leasing.marketCandidates[candidateIndex] : null;
  const rankingBreakdown = vacancyCandidateRankingBreakdown(candidate, candidateIndex + 1);
  const recommendedRanking = vacancyCandidateRankingBreakdown(leasing.marketCandidates?.[0], 1);
  const mix = tenantPlacementMixPreview(state, unit.kind, config);
  const outcome = {
    ...ranking,
    ranking: rankingBreakdown,
    recommendedRanking,
    tenantKind: unit.kind,
    role: mix.role,
    capacity: mix.capacity,
    currentShare: mix.currentShare,
    projectedShare: mix.projectedShare,
    targetShare: mix.targetShare,
    balanceBefore: mix.balanceBefore,
    balanceAfter: mix.balanceAfter,
    balanceDelta: mix.balanceDelta,
  };
  outcome.overrideComponent = vacancyPreFillOverrideComponent(outcome);
  return outcome;
}

/** Compare a re-rented room's actual mix contribution with its pre-fill forecast. */
export function vacancyPreFillResult(preview, state, unit, config) {
  if (!preview || !state || !unit || !unit.occupied) {
    return { key: 'pending', label: 'result pending', detail: 'the room has not been filled yet' };
  }
  const actualMix = tenantMixDemand(state, config);
  const actualEntry = actualMix.find((entry) => entry.kind === unit.kind);
  const actualShare = actualEntry?.share ?? 0;
  const actualBalance = mixBalance(actualMix);
  const shareDelta = actualShare - preview.projectedShare;
  const balanceDelta = actualBalance - preview.balanceAfter;
  const matched = Math.abs(shareDelta) <= 0.01 && Math.abs(balanceDelta) <= 1;
  return {
    key: matched ? 'matched' : balanceDelta > 0 ? 'better' : 'different',
    label: matched ? 'forecast matched' : balanceDelta > 0 ? 'better than forecast' : 'forecast differed',
    detail: 'F' + unit.floor + ' now has ' + unit.kind + ' tenants; actual mix is ' + Math.round(actualShare * 100) +
      '% versus ' + Math.round(preview.projectedShare * 100) + '% forecast and balance is ' + actualBalance +
      '% versus ' + preview.balanceAfter + '% forecast',
    unitId: unit.id,
    floor: unit.floor,
    tenantKind: unit.kind,
    actualShare,
    projectedShare: preview.projectedShare,
    actualBalance,
    projectedBalance: preview.balanceAfter,
    shareDelta,
    balanceDelta,
    ranking: preview.ranking ?? null,
    recommendedRanking: preview.recommendedRanking ?? null,
    overrideComponent: preview.overrideComponent ?? null,
    followedRecommendation: preview.key === 'recommended',
    followThroughLabel: preview.key === 'recommended' ? 'followed recommendation' : 'overrode recommendation',
  };
}

/** Format the ranking signals captured before a manual re-rent. */
export function vacancyPreFillRankingLabel(result) {
  const ranking = result?.ranking;
  if (!ranking) return 'ranking breakdown unavailable';
  const signed = (value) => (value >= 0 ? '+' : '') + value;
  return 'rank ' + ranking.rank + ' · score ' + ranking.total + ' = room ' + ranking.roomQuality +
    ' + experience ' + ranking.experience + ' + mix ' + signed(ranking.tenantMix) +
    ' + access ' + signed(ranking.access) + ' + appeal ' + signed(ranking.appeal);
}

/** Retain a small session history of manual re-rent forecast checks. */
export function rememberVacancyPreFillResultHistory(history, result, maxEntries = 3) {
  if (!result || result.key === 'pending') return history ?? [];
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 3));
  return [...(history ?? []), result].slice(-limit);
}

/** Keep recent manual re-rent checks compact enough for the management panel. */
export function vacancyPreFillResultHistoryLabel(history, maxEntries = 3) {
  const entries = (history ?? []).slice(-Math.max(1, Math.floor(Number(maxEntries) || 3)));
  if (!entries.length) return 'no manual re-rent forecasts yet';
  return entries.map((entry) => 'D' + entry.day + ' ' + (entry.followThroughLabel ?? (entry.followedRecommendation ? 'followed recommendation' : 'overrode recommendation')) +
    ' · F' + entry.floor + ' ' + entry.label + ' · ' + entry.tenantKind +
    ' mix ' + Math.round(entry.projectedShare * 100) + '% → ' + Math.round(entry.actualShare * 100) + '% · ' + vacancyPreFillRankingLabel(entry) +
    (entry.overrideComponent?.key && entry.overrideComponent.key !== 'none' ? ' · pull ' + entry.overrideComponent.label : '')).join(' · ');
}

/** Build scan-friendly rows for the recent manual re-rent checks. */
export function vacancyPreFillResultHistoryLines(history, maxEntries = 3) {
  const entries = (history ?? []).slice(-Math.max(1, Math.floor(Number(maxEntries) || 3)));
  if (!entries.length) return ['no manual re-rent forecasts yet'];
  return entries.map((entry) => {
    const choice = entry.followThroughLabel ?? (entry.followedRecommendation ? 'followed recommendation' : 'overrode recommendation');
    const tenant = entry.tenantKind ?? 'room';
    const projected = Number.isFinite(Number(entry.projectedShare)) ? Math.round(Number(entry.projectedShare) * 100) : '—';
    const actual = Number.isFinite(Number(entry.actualShare)) ? Math.round(Number(entry.actualShare) * 100) : '—';
    const pull = entry.overrideComponent?.key && entry.overrideComponent.key !== 'none'
      ? ' · pull ' + entry.overrideComponent.label
      : '';
    return 'D' + (entry.day ?? '—') + ' · F' + (entry.floor ?? '—') + ' ' + tenant + ' · ' + choice +
      ' · ' + (entry.label ?? 'result pending') + ' · mix ' + projected + '% → ' + actual + '%' + pull;
  });
}

/** Summarize repeated manual choices without automatically retuning the ranking. */
export function vacancyPreFillChoiceSignal(history) {
  const entries = (history ?? []).filter((entry) => typeof entry?.followedRecommendation === 'boolean' || entry?.followThroughLabel);
  const followed = entries.filter((entry) => entry.followedRecommendation === true || entry.followThroughLabel === 'followed recommendation').length;
  const overridden = entries.length - followed;
  if (!entries.length) {
    return { key: 'none', label: 'no choice signal yet', detail: 'complete more manual re-rents before judging whether the vacancy ranking needs tuning', followed: 0, overridden: 0, total: 0, followRate: null };
  }
  const key = followed === overridden ? 'mixed' : followed > overridden ? 'followed' : 'overridden';
  const label = key === 'followed' ? 'ranking usually trusted' : key === 'overridden' ? 'ranking often overridden' : 'ranking choice is mixed';
  const detail = followed + '/' + entries.length + ' choices followed the recommendation · ' + overridden + '/' + entries.length +
    ' overrode it' + (entries.length < 2
      ? ' · one reading is not enough to retune weights'
      : ' · persistent overrides are a signal to review room quality, tenant mix, access, and appeal weights');
  return { key, label, detail, followed, overridden, total: entries.length, followRate: followed / entries.length };
}

/** Identify the ranking component that most often pulls players toward an override. */
export function vacancyPreFillOverrideSignal(history) {
  const entries = (history ?? []).filter((entry) =>
    !(entry.followedRecommendation === true || entry.followThroughLabel === 'followed recommendation') &&
    entry.overrideComponent?.key && entry.overrideComponent.key !== 'none');
  if (!entries.length) {
    return { key: 'none', label: 'no repeated override pull yet', detail: 'complete more lower-ranked choices with component breakdowns before retuning a signal', total: 0 };
  }
  const counts = new Map();
  for (const entry of entries) {
    const component = entry.overrideComponent;
    const current = counts.get(component.key) ?? { key: component.key, label: component.label, count: 0 };
    current.count += 1;
    counts.set(component.key, current);
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))[0];
  return {
    key: top.key,
    label: top.label + ' is the main override pull',
    detail: top.count + '/' + entries.length + ' overrides favored this component over the ranked room · use it as a tuning lead, not an automatic change',
    total: entries.length,
    count: top.count,
  };
}

/** Compare whether following or overriding the ranking produced healthy outcomes. */
export function vacancyPreFillOutcomeSignal(history) {
  const minimumSample = 3;
  const entries = (history ?? []).filter((entry) =>
    (typeof entry?.followedRecommendation === 'boolean' || entry?.followThroughLabel) &&
    ['matched', 'better', 'different'].includes(entry?.key));
  const followedEntries = entries.filter((entry) => entry.followedRecommendation === true || entry.followThroughLabel === 'followed recommendation');
  const overriddenEntries = entries.filter((entry) => !followedEntries.includes(entry));
  const healthy = (entry) => entry.key === 'matched' || entry.key === 'better';
  const followedHealthy = followedEntries.filter(healthy).length;
  const overriddenHealthy = overriddenEntries.filter(healthy).length;
  if (!entries.length) {
    return { key: 'none', label: 'no outcome signal yet', detail: 'complete manual re-rents with results before comparing the ranking to player overrides', followedHealthy: 0, overriddenHealthy: 0, followedTotal: 0, overriddenTotal: 0, total: 0, minimumSample, sampleReady: false };
  }
  if (entries.length < minimumSample) {
    return {
      key: 'insufficient',
      label: 'more outcome evidence needed',
      detail: entries.length + '/' + minimumSample + ' completed checks · raw results are visible, but this sample is too small to judge ranking weights',
      followedHealthy,
      overriddenHealthy,
      followedTotal: followedEntries.length,
      overriddenTotal: overriddenEntries.length,
      total: entries.length,
      minimumSample,
      sampleReady: false,
    };
  }
  const followedRate = followedEntries.length ? followedHealthy / followedEntries.length : null;
  const overriddenRate = overriddenEntries.length ? overriddenHealthy / overriddenEntries.length : null;
  const key = followedRate == null || overriddenRate == null
    ? 'needs-comparison'
    : overriddenRate > followedRate + 0.2
      ? 'override-outperforms'
      : followedRate > overriddenRate + 0.2 ? 'follow-outperforms' : 'mixed';
  const label = key === 'override-outperforms' ? 'overrides are performing better'
    : key === 'follow-outperforms' ? 'following is performing better'
      : key === 'needs-comparison' ? 'more comparison needed' : 'outcomes are mixed';
  const detail = 'followed: ' + followedHealthy + '/' + followedEntries.length + ' healthy · overrides: ' + overriddenHealthy + '/' + overriddenEntries.length + ' healthy' +
    (key === 'needs-comparison'
      ? ' · collect both kinds of choices before retuning'
      : key === 'override-outperforms'
        ? ' · persistent evidence would justify reviewing the ranking weights'
        : ' · keep watching before changing room-quality, tenant-mix, access, or appeal weights');
  return { key, label, detail, followedHealthy, overriddenHealthy, followedTotal: followedEntries.length, overriddenTotal: overriddenEntries.length, followedRate, overriddenRate, total: entries.length, minimumSample, sampleReady: true };
}

/** Keep the visible vacancy ranking compact while preserving each room's access contribution. */
export function vacancyRankingAccessSummary(forecast, maxEntries = 3) {
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 3));
  return (forecast?.marketCandidates ?? []).slice(0, limit).map((candidate, index) => ({
    rank: index + 1,
    unitId: candidate.unit.id,
    floor: candidate.unit.floor,
    kind: candidate.unit.kind,
    evaluation: candidate.evaluation.score,
    marketBonus: candidate.marketDemandBonus,
    demandBonus: candidate.experienceDemand.bonus,
    accessBonus: candidate.experienceDemand.transportAccessBonus ?? 0,
    appealBonus: candidate.experienceDemand.desirabilityBonus ?? 0,
    mixKey: (candidate.tenantMix?.targetShare ?? 0) - (candidate.tenantMix?.share ?? 0) > 0.01
      ? 'underrepresented'
      : (candidate.tenantMix?.targetShare ?? 0) - (candidate.tenantMix?.share ?? 0) < -0.01
        ? 'oversupplied' : candidate.marketDemandBonus > 0 ? 'underrepresented' : candidate.marketDemandBonus < 0 ? 'oversupplied' : 'balanced',
    mixLabel: ((candidate.tenantMix?.targetShare ?? 0) - (candidate.tenantMix?.share ?? 0) > 0.01) || candidate.marketDemandBonus > 0
      ? 'underrepresented'
      : ((candidate.tenantMix?.targetShare ?? 0) - (candidate.tenantMix?.share ?? 0) < -0.01) || candidate.marketDemandBonus < 0
        ? 'oversupplied' : 'on target',
    mixShare: Number.isFinite(Number(candidate.tenantMix?.share)) ? candidate.tenantMix.share : null,
    mixTargetShare: Number.isFinite(Number(candidate.tenantMix?.targetShare)) ? candidate.tenantMix.targetShare : null,
  }));
}

/** Compare the top vacancy candidates' separate desirability and access contributions. */
export function vacancyRankingSignalSummary(forecast) {
  const candidates = forecast?.marketCandidates ?? [];
  if (candidates.length < 2) return null;
  const top = candidates[0];
  const runnerUp = candidates[1];
  const topDemand = top.experienceDemand ?? {};
  const runnerDemand = runnerUp.experienceDemand ?? {};
  const appealDelta = (Number(topDemand.desirabilityBonus) || 0) - (Number(runnerDemand.desirabilityBonus) || 0);
  const accessDelta = (Number(topDemand.transportAccessBonus) || 0) - (Number(runnerDemand.transportAccessBonus) || 0);
  const mixDelta = (Number(top.marketDemandBonus) || 0) - (Number(runnerUp.marketDemandBonus) || 0);
  const appealFactors = (evaluation) => ({
    view: Number(evaluation?.viewBonus) || 0,
    amenities: Number(evaluation?.amenityBonus) || 0,
    layout: Number(evaluation?.layoutBonus) || 0,
    renovation: Number(evaluation?.renovationBonus) || 0,
    rent: Number(evaluation?.rentAdjustment) || 0,
    fit: -(Number(evaluation?.preferencePenalty) || 0),
    noise: -(Number(evaluation?.noisePenalty) || 0),
    services: -(['food', 'parking', 'medical', 'security', 'recycling']
      .reduce((sum, service) => sum + (Number(evaluation?.[service + 'Penalty']) || 0), 0)),
  });
  const compare = (name, delta) => delta === 0
    ? name + ' tied'
    : name + ' favors F' + (delta > 0 ? top.unit.floor : runnerUp.unit.floor) + ' by ' + Math.abs(delta);
  return {
    topUnitId: top.unit.id,
    runnerUnitId: runnerUp.unit.id,
    topFloor: top.unit.floor,
    runnerFloor: runnerUp.unit.floor,
    appealDelta,
    accessDelta,
    mixDelta,
    topAppealFactors: appealFactors(top.evaluation),
    runnerAppealFactors: appealFactors(runnerUp.evaluation),
    detail: compare('room appeal', appealDelta) + ' · ' + compare('access', accessDelta) + ' · ' + compare('tenant mix', mixDelta),
  };
}

/** Compare one day's top vacancy appeal factors with the prior ranking reading. */
export function vacancyRankingAppealChanges(previous, current) {
  if (!current) return null;
  if (!previous) return { key: 'baseline', changes: [], detail: 'baseline room-appeal factors recorded' };
  if (previous.topUnitId !== current.topUnitId) {
    return {
      key: 'candidate-changed',
      changes: [],
      detail: 'top vacancy changed from F' + previous.topFloor + ' to F' + current.topFloor + '; factor comparison reset',
    };
  }
  const labels = { view: 'view', amenities: 'amenities', layout: 'layout', renovation: 'renovation', rent: 'rent fit', fit: 'floor fit', noise: 'noise', services: 'services' };
  const changes = Object.keys(labels)
    .map((key) => ({ key, delta: (Number(current.topAppealFactors?.[key]) || 0) - (Number(previous.topAppealFactors?.[key]) || 0) }))
    .filter((change) => change.delta !== 0);
  const signed = (value) => (value >= 0 ? '+' : '') + value;
  return {
    key: changes.length ? 'changed' : 'unchanged',
    changes,
    detail: changes.length
      ? changes.map((change) => labels[change.key] + ' ' + signed(change.delta)).join(' · ')
      : 'no room-appeal factors changed',
  };
}

/** Turn the latest appeal change into one plain-language action for vacancies. */
export function vacancyAppealChangeAction(appealChanges) {
  if (!appealChanges || appealChanges.key === 'baseline') {
    return { key: 'monitor', label: 'monitor appeal', detail: 'wait for another ranking day before changing a vacant room' };
  }
  if (appealChanges.key === 'candidate-changed') {
    return { key: 'inspect', label: 'inspect the new top vacancy', detail: appealChanges.detail };
  }
  const negativePriority = ['services', 'noise', 'rent', 'fit', 'view', 'amenities', 'layout', 'renovation'];
  const change = negativePriority
    .map((key) => (appealChanges.changes ?? []).find((entry) => entry.key === key && entry.delta < 0))
    .find(Boolean);
  const action = {
    services: ['inspect services', 'check required food, parking, medical, security, or recycling coverage on the vacant room'],
    noise: ['reduce nearby noise', 'move or separate the noisy use before relying on this room for leasing'],
    rent: ['review rent', 'lower the vacant room\'s rent if the market will not accept its current price'],
    fit: ['choose a better-fit floor', 'use the tenant type\'s preferred floor when replacing or rebuilding this room'],
    view: ['review floor choice', 'a different floor may improve the room\'s view appeal'],
    amenities: ['add an amenity', 'place the missing food or shared amenity service before leasing this room'],
    layout: ['review the layout', 'separate incompatible neighboring uses or improve the floor mix'],
    renovation: ['renovate the room', 'renovation can restore room appeal before the next leasing attempt'],
  };
  if (change) {
    return { key: change.key, label: action[change.key][0], detail: action[change.key][1] + ' · ' + appealChanges.detail, factorKey: change.key, factorDelta: change.delta };
  }
  return {
    key: 'monitor',
    label: 'keep the room market-ready',
    detail: appealChanges.key === 'unchanged' ? 'room appeal factors are unchanged; keep watching the next ranking day' : 'recent appeal changes are favorable; keep watching the next ranking day',
  };
}

/** Read one room-appeal factor using the same signed values used by the ranking history. */
export function vacancyAppealFactorValue(evaluation, key) {
  if (!evaluation || !key) return null;
  if (key === 'view') return Number(evaluation.viewBonus) || 0;
  if (key === 'amenities') return Number(evaluation.amenityBonus) || 0;
  if (key === 'layout') return Number(evaluation.layoutBonus) || 0;
  if (key === 'renovation') return Number(evaluation.renovationBonus) || 0;
  if (key === 'rent') return Number(evaluation.rentAdjustment) || 0;
  if (key === 'fit') return -(Number(evaluation.preferencePenalty) || 0);
  if (key === 'noise') return -(Number(evaluation.noisePenalty) || 0);
  if (key === 'services') return -(['food', 'parking', 'medical', 'security', 'recycling']
    .reduce((sum, service) => sum + (Number(evaluation[service + 'Penalty']) || 0), 0));
  return null;
}

/** Compare the first closed day after a vacant-room appeal action with its baseline. */
export function vacancyAppealFollowupResult(followup, state, closed, config) {
  if (!followup || !state || !closed || followup.result || Number(closed.day) <= Number(followup.builtDay)) return null;
  const unit = (state.units ?? []).find((candidate) => candidate.id === followup.unitId);
  if (!unit) return { day: closed.day, missing: true };
  const after = unitEvaluation(state, unit, config);
  const beforeScore = Number(followup.beforeScore);
  const scoreDelta = Number.isFinite(beforeScore) ? after.score - beforeScore : null;
  const beforeFactor = Number(followup.beforeFactor);
  const afterFactor = vacancyAppealFactorValue(after, followup.factorKey);
  const factorDelta = Number.isFinite(beforeFactor) && afterFactor != null ? afterFactor - beforeFactor : null;
  const beforeDesirability = Number(followup.beforeDesirability);
  const afterDesirability = Number(closed.desirability);
  const desirabilityDelta = Number.isFinite(beforeDesirability) && Number.isFinite(afterDesirability)
    ? afterDesirability - beforeDesirability : null;
  const key = scoreDelta == null ? 'unknown' : scoreDelta > 0 ? 'improved' : scoreDelta < 0 ? 'worsened' : 'unchanged';
  const leasing = unit.occupied
    ? { key: 'occupied', label: 'occupied' }
    : leaseStatus(state, unit, config, closed.rep);
  const movedIn = (closed.leasing?.movedIn ?? []).find((move) => move.unitId === unit.id);
  const demandReading = movedIn
    ? {
      key: 'moved_in',
      label: 'tenant demand filled the room',
      detail: 'tenant demand filled the room with a ' + movedIn.unitKind + ' tenant on the next leasing pass',
      rank: 1,
      tenantKind: movedIn.unitKind,
      qualityScore: movedIn.experienceDemandScore,
      demandBonus: movedIn.experienceDemandBonus,
      marketBonus: movedIn.marketDemandBonus,
    }
    : unit.occupied
      ? null
      : vacancyDemandSummary(state, unit, config, closed.rep);
  const tenantKind = demandReading?.tenantKind ?? demandReading?.likelyKind ?? null;
  const mixEntry = tenantKind
    ? (closed.tenantMix?.entries ?? []).find((entry) => entry.kind === tenantKind) ??
      tenantMixDemand(state, config).find((entry) => entry.kind === tenantKind)
    : null;
  const mixShare = Number(mixEntry?.share);
  const mixTargetShare = Number(mixEntry?.targetShare);
  const mixGap = Number.isFinite(mixShare) && Number.isFinite(mixTargetShare) ? mixTargetShare - mixShare : null;
  const mixKey = mixGap == null ? null : Math.abs(mixGap) < 0.01 ? 'balanced' : mixGap > 0 ? 'underrepresented' : 'oversupplied';
  const mixLabel = mixKey === 'underrepresented' ? 'underrepresented' : mixKey === 'oversupplied' ? 'oversupplied' : mixKey === 'balanced' ? 'on target' : null;
  const mixText = mixEntry && mixLabel
    ? ' · tenant mix ' + tenantKind + ' ' + mixLabel + ' (' + Math.round(mixShare * 100) + '% / ' + Math.round(mixTargetShare * 100) + '% target)'
    : '';
  const demandLabel = demandReading
    ? demandReading.label ?? (demandReading.key === 'candidate'
      ? 'candidate rank ' + demandReading.rank
      : demandReading.key === 'not_ready' ? 'not eligible yet' : demandReading.key)
    : null;
  const beforeDemandKey = followup.beforeDemand?.key ?? null;
  const demandKey = demandReading?.key ?? null;
  const demandTransition = beforeDemandKey && demandKey && beforeDemandKey !== demandKey
    ? beforeDemandKey + ' → ' + demandKey : null;
  const signed = (value) => (value >= 0 ? '+' : '') + value;
  const desirabilityText = desirabilityDelta == null ? ''
    : ' · tower desirability ' + beforeDesirability + ' → ' + afterDesirability + ' (' + signed(desirabilityDelta) + ')';
  return {
    day: closed.day,
    afterScore: after.score,
    scoreDelta,
    afterFactor,
    factorDelta,
    key,
    label: key === 'improved' ? 'improved' : key === 'worsened' ? 'did not improve' : key === 'unchanged' ? 'unchanged' : 'result unavailable',
    detail: scoreDelta == null
      ? followup.action + ' follow-up recorded on D' + closed.day
      : followup.action + ' ' + (key === 'improved' ? 'improved' : key === 'worsened' ? 'lowered' : 'left unchanged') +
        ' room evaluation ' + signed(scoreDelta) + ' · ' + beforeScore + ' → ' + after.score +
        ' · lease status ' + leasing.label + desirabilityText +
        (demandReading ? ' · next tenant demand ' + (demandTransition ? demandTransition + ' · ' : '') + (demandReading.detail ?? demandLabel) +
          (tenantKind ? ' · tenant type ' + tenantKind : '') + mixText : ''),
    occupied: Boolean(unit.occupied),
    vacant: !unit.occupied,
    leaseStatusKey: leasing.key,
    leaseStatusLabel: leasing.label,
    leaseReady: leasing.key === 'ready',
    beforeDesirability: Number.isFinite(beforeDesirability) ? beforeDesirability : null,
    afterDesirability: Number.isFinite(afterDesirability) ? afterDesirability : null,
    desirabilityDelta,
    demandReading,
    beforeDemandKey,
    demandKey,
    demandTransition,
    tenantKind,
    mix: mixEntry && mixLabel ? {
      kind: tenantKind,
      key: mixKey,
      label: mixLabel,
      share: mixShare,
      targetShare: mixTargetShare,
      gap: mixGap,
    } : null,
  };
}

/** Keep the latest room-appeal action readings compact and readable. */
export function rememberVacancyAppealFollowupHistory(history, followup, limit = 3) {
  const count = Math.max(1, Math.floor(Number(limit) || 1));
  const entries = Array.isArray(history) ? history : [];
  return (followup ? [...entries, followup] : entries).slice(-count);
}

function recoveryGateSummary(state, unit, config, reputation) {
  const evaluation = unitEvaluation(state, unit, config);
  const requiredDays = relistDaysFor(state, unit, config, reputation);
  const vacantDays = Math.max(0, Number(unit.vacantDays) || 0);
  const marketDaysRemaining = Math.max(0, requiredDays - vacantDays);
  const reputationRequired = config.occupancy.relistMinDeliveryRate;
  const reputationGap = Math.max(0, reputationRequired - reputation);
  const blockers = [];
  if (marketDaysRemaining > 0) blockers.push('market timing');
  if (evaluation.score < config.evaluation.relistMinScore) blockers.push('room quality');
  if (reputationGap > 0) blockers.push('reputation');
  return {
    status: blockers.length ? blockers[0] : 'ready',
    evaluation: evaluation.score,
    marketDaysRequired: requiredDays,
    marketDaysRemaining,
    marketReady: marketDaysRemaining === 0,
    vacantDays,
    reputation,
    reputationRequired,
    reputationGap,
    reputationReady: reputationGap === 0,
    blockers,
    ready: blockers.length === 0,
  };
}

function deliveryReliability(state, config, reputation = null) {
  if (Number.isFinite(Number(reputation))) return clamp(Number(reputation) / 100);
  const windowSize = Math.max(1, Math.floor(config.occupancy.reputationWindow ?? 1));
  const readings = (state.log ?? []).slice(-windowSize)
    .map((day) => Number(day.deliveryRate ?? day.rep))
    .filter(Number.isFinite);
  if (state.today?.trips) readings.push((state.today.delivered / state.today.trips) * 100);
  if (!readings.length) return 1;
  return clamp(readings.reduce((sum, reading) => sum + reading, 0) / readings.length / 100);
}

export function shopTrafficEstimate(state, unit, config, reputation = null) {
  const deliveryFactor = deliveryReliability(state, config, reputation);
  if (unit.kind !== 'shop') {
    return {
      potentialCustomers: 0, expectedCustomers: 0, localOfficeWorkers: 0,
      reachableShopCount: 0, potentialRevenue: 0, expectedRevenue: 0,
      deliveryFactor: null,
    };
  }
  const hasUnit = state.units.some((candidate) => candidate.id === unit.id);
  const projectedUnits = hasUnit
    ? state.units.map((candidate) => candidate.id === unit.id ? { ...unit, occupied: true } : candidate)
    : [...state.units, { ...unit, occupied: true }];
  const projectedState = { ...state, units: projectedUnits };
  const offices = projectedState.units.filter((candidate) => candidate.kind === 'office' && candidate.occupied);
  const reachableShops = projectedState.units.filter((candidate) => candidate.kind === 'shop' && candidate.occupied &&
    offices.some((office) => Math.abs(candidate.floor - office.floor) <= (config.demand.shopCatchmentFloors ?? Infinity)));
  const expectedCustomers = offices.reduce((sum, office) => {
    const shops = shopsForOffice(projectedState, office, config);
    return sum + (shops.length ? office.heads * config.demand.lunchTripRate / shops.length : 0);
  }, 0);
  const potentialCustomers = Math.max(0, Math.round(expectedCustomers));
  const expectedCustomersAfterDelivery = Math.max(0, Math.round(potentialCustomers * deliveryFactor));
  const potentialRevenue = Math.max(0, potentialCustomers * (config.units.shop.revenuePerCustomer ?? 0));
  return {
    potentialCustomers,
    expectedCustomers: expectedCustomersAfterDelivery,
    localOfficeWorkers: offices.reduce((sum, office) => sum + (office.heads ?? 0), 0),
    reachableShopCount: reachableShops.length,
    potentialRevenue,
    expectedRevenue: Math.max(0, expectedCustomersAfterDelivery * (config.units.shop.revenuePerCustomer ?? 0)),
    deliveryFactor,
  };
}

/** Return a bounded per-shop history and a simple direction for the player. */
export function shopTrafficHistory(state, unitId, config) {
  const limit = Math.max(1, Math.floor(config.occupancy.shopTrafficHistoryDays ?? 1));
  const entries = (state.log ?? []).flatMap((day) => (day.shopTraffic ?? [])
    .filter((entry) => entry.unitId === unitId)
    .map((entry) => ({ day: day.day, ...entry }))).slice(-limit);
  if (entries.length < 2) {
    return {
      entries, direction: 'unknown', delta: 0, potentialDelta: 0, deliveryDelta: 0,
      cause: 'unknown', causeLabel: entries.length ? 'one closed day' : 'no closed days',
      nextAction: 'wait for another closed day',
    };
  }
  const delta = entries.at(-1).served - entries[0].served;
  const direction = delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'steady';
  const potentialValues = entries.map((entry) => Number(entry.potentialCustomers));
  const deliveryValues = entries.map((entry) => Number(entry.deliveryFactor));
  const hasCauseData = potentialValues.every(Number.isFinite) && deliveryValues.every(Number.isFinite);
  const potentialDelta = hasCauseData ? potentialValues.at(-1) - potentialValues[0] : null;
  const deliveryDelta = hasCauseData ? deliveryValues.at(-1) - deliveryValues[0] : null;
  const demandDrop = hasCauseData && potentialDelta <= -1;
  const serviceDrop = hasCauseData && deliveryDelta <= -0.08;
  const cause = !hasCauseData ? 'unknown' : serviceDrop && demandDrop ? 'mixed'
    : serviceDrop ? 'service' : demandDrop ? 'demand' : 'stable';
  return {
    entries,
    direction,
    delta,
    potentialDelta,
    deliveryDelta,
    cause,
    causeLabel: cause === 'service'
      ? 'elevator service is limiting traffic'
      : cause === 'demand'
        ? 'local office demand is falling'
        : cause === 'mixed'
          ? 'elevator service and local demand are both down'
          : cause === 'stable'
            ? 'no structural demand decline'
            : 'need more closed days to identify the cause',
    nextAction: cause === 'service'
      ? 'next: improve elevator delivery'
      : cause === 'demand'
        ? 'next: review tenant mix and nearby offices'
        : cause === 'mixed'
          ? 'next: improve elevators, then grow local demand'
          : cause === 'stable'
            ? 'next: monitor another day'
            : 'next: collect another closed day',
    label: direction === 'rising'
      ? 'traffic rising +' + delta + ' customers'
      : direction === 'falling'
        ? 'traffic falling ' + Math.abs(delta) + ' customers'
        : 'traffic steady',
  };
}

/** Preview the local shop-demand gain from adding one nearby office. */
export function shopTrafficTenantMixPreview(state, shop, config, reputation = null, preferredFloor = null) {
  if (!state || !shop || shop.kind !== 'shop' || !config?.units?.office) {
    return { available: false, reason: 'no shop demand target' };
  }
  const before = shopTrafficEstimate(state, shop, config, reputation);
  const candidates = Array.from({ length: Math.max(0, state.floors - 1) }, (_, index) => index + 1)
    .map((floor) => tenantPlacementFloorPreview(state, 'office', floor, config))
    .filter((preview) => preview.available)
    .sort((a, b) => Math.abs(a.floor - shop.floor) - Math.abs(b.floor - shop.floor) ||
      b.evaluation.score - a.evaluation.score || a.floor - b.floor);
  const preferred = Number(preferredFloor);
  const placement = candidates.find((candidate) => candidate.floor === preferred) ?? candidates[0];
  if (!placement) return { available: false, reason: 'no open floor for an office' };
  const office = {
    id: -1,
    kind: 'office',
    floor: placement.floor,
    slot: placement.slot,
    heads: config.units.office.workers ?? 0,
    occupied: true,
    stress: 0,
    vacantDays: 0,
    renovated: false,
    servedToday: 0,
    rent: config.units.office.rent,
  };
  const after = shopTrafficEstimate({ ...state, units: [...(state.units ?? []), office] }, shop, config, reputation);
  return {
    available: true,
    shopFloor: shop.floor,
    placementFloor: placement.floor,
    slot: placement.slot,
    cost: config.costs.office,
    before,
    after,
    potentialCustomersDelta: after.potentialCustomers - before.potentialCustomers,
    expectedCustomersDelta: after.expectedCustomers - before.expectedCustomers,
    potentialRevenueDelta: after.potentialRevenue - before.potentialRevenue,
    expectedRevenueDelta: after.expectedRevenue - before.expectedRevenue,
    officeEvaluation: placement.evaluation,
  };
}

/** Compare the first closed day after a shop-driven office placement with its forecast. */
export function shopTrafficFollowupResult(followup, closed) {
  if (!followup || !closed || followup.result || Number(closed.day) <= Number(followup.builtDay)) return null;
  const record = (closed.shopTraffic ?? []).find((entry) => entry.unitId === followup.shopId);
  if (!record) return { day: closed.day, missing: true };
  const beforeExpectedRevenue = Number(followup.beforeExpectedRevenue);
  return {
    day: closed.day,
    served: record.served,
    revenue: record.revenue,
    expectedCustomers: record.expectedCustomers,
    expectedRevenue: record.expectedRevenue,
    servedDelta: record.served - followup.beforeExpectedCustomers,
    revenueDelta: Number.isFinite(beforeExpectedRevenue) ? record.revenue - beforeExpectedRevenue : null,
    forecastGap: record.served - followup.forecastExpectedCustomers,
  };
}

/** Keep only the latest shop-demand response outcomes for readable diagnostics. */
export function rememberShopTrafficFollowup(history, followup, limit = 3) {
  const count = Math.max(1, Math.floor(Number(limit) || 1));
  const entries = Array.isArray(history) ? history : [];
  return (followup ? [...entries, followup] : entries).slice(-count);
}

/** Classify a retained shop response by whether it met its traffic forecast. */
export function shopTrafficFollowupStatus(followup) {
  if (!followup?.result) return { key: 'pending', label: 'pending' };
  if (followup.result.missing) return { key: 'missing', label: 'no record' };
  return followup.result.forecastGap >= 0
    ? { key: 'success', label: 'met forecast' }
    : { key: 'underperforming', label: 'below forecast' };
}

/** Identify which measurable shop outcomes changed after a response. */
export function shopTrafficFollowupOutcome(followup) {
  if (!followup?.result) return { key: 'pending', label: 'pending' };
  if (followup.result.missing) return { key: 'missing', label: 'no measurable result' };
  const customersChanged = followup.result.servedDelta !== 0;
  const revenueChanged = Number.isFinite(Number(followup.result.revenueDelta)) && followup.result.revenueDelta !== 0;
  if (customersChanged && revenueChanged) return { key: 'both', label: 'customers + revenue' };
  if (customersChanged) return { key: 'customers', label: 'customers only' };
  if (revenueChanged) return { key: 'revenue', label: 'revenue only' };
  return { key: 'none', label: 'no measurable change' };
}

/** Summarize completed shop-demand responses without counting pending outcomes. */
export function shopTrafficFollowupSummary(history) {
  const entries = Array.isArray(history) ? history : [];
  const completed = entries.filter((entry) => entry.result && !entry.result.missing);
  const successful = completed.filter((entry) => entry.result.forecastGap >= 0).length;
  const forecastGapTotal = completed.reduce((sum, entry) => sum + Number(entry.result.forecastGap || 0), 0);
  const averageForecastGap = completed.length ? +(forecastGapTotal / completed.length).toFixed(1) : null;
  const realizedCustomers = completed.reduce((sum, entry) => sum + Number(entry.result.served || 0), 0);
  const forecastCustomers = completed.reduce((sum, entry) => sum + Number(entry.result.expectedCustomers || 0), 0);
  const realizedRevenue = completed.reduce((sum, entry) => sum + Number(entry.result.revenue || 0), 0);
  const forecastRevenue = completed.reduce((sum, entry) => sum + Number(entry.result.expectedRevenue || 0), 0);
  const pending = entries.filter((entry) => !entry.result).length;
  const missing = entries.filter((entry) => entry.result?.missing).length;
  const successRate = completed.length ? Math.round((successful / completed.length) * 100) : null;
  return {
    total: entries.length,
    completed: completed.length,
    successful,
    pending,
    missing,
    successRate,
    averageForecastGap,
    realizedCustomers,
    forecastCustomers,
    customerForecastGap: realizedCustomers - forecastCustomers,
    realizedRevenue,
    forecastRevenue,
    revenueForecastGap: realizedRevenue - forecastRevenue,
    key: completed.length === 0 ? 'unknown' : successRate >= 70 ? 'good' : successRate >= 40 ? 'warn' : 'bad',
  };
}

/** Describe how much of the bounded shop-response history window is occupied. */
export function shopTrafficFollowupWindow(history, limit = 3) {
  const entries = Array.isArray(history) ? history : [];
  const capacity = Math.max(1, Math.floor(Number(limit) || 1));
  const retained = Math.min(entries.length, capacity);
  return {
    retained,
    limit: capacity,
    full: retained >= capacity,
    label: retained + '/' + capacity + ' retained',
    statusLabel: retained >= capacity ? 'full · oldest results roll off' : 'collecting',
    retentionNote: 'short-lived diagnostic period · not a permanent shop ledger',
  };
}

/** Return a shop-response filter only while its shop remains occupied. */
export function shopTrafficResponseFilterId(selectedId, shops) {
  if (selectedId == null) return null;
  const id = Number(selectedId);
  return (Array.isArray(shops) ? shops : []).some((shop) => shop.id === id) ? id : null;
}

/** Explain the compact shop-response score in plain language. */
export function shopTrafficFollowupScoreDetail(summary) {
  if (!summary?.total) return 'no shop responses yet';
  if (!summary.completed) return 'no completed responses yet; pending outcomes are excluded';
  return summary.successful + ' of ' + summary.completed +
    ' completed responses met forecast; pending outcomes are excluded';
}

/** Scope the response-score description to the shop it represents. */
export function shopTrafficFollowupScoreAccessibleLabel(shop, summary) {
  return 'response score for ' + shopTrafficFollowupScopeLabel(shop) + ': ' +
    shopTrafficFollowupScoreDetail(summary);
}

/** Label retained response volume separately from the outcome score. */
export function shopTrafficFollowupCountLabel(summary) {
  const raw = Number(summary?.total ?? 0);
  const count = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  return 'history: ' + count + ' response' + (count === 1 ? '' : 's');
}

/** Scope a shop's retained-history description for assistive technology. */
export function shopTrafficFollowupCountAccessibleLabel(shop, history, limit = 3) {
  const entries = Array.isArray(history) ? history : [];
  const rawLimit = Number(limit);
  const capacity = Math.max(1, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 3));
  return 'response history for ' + shopTrafficFollowupScopeLabel(shop) + ': ' +
    entries.length + ' retained response' + (entries.length === 1 ? '' : 's') +
    '; latest ' + capacity + ' response records are retained; this is not total shop traffic';
}

/** Name the shop scope represented by a response-history summary. */
export function shopTrafficFollowupScopeLabel(shop) {
  return shop ? 'F' + shop.floor + ' shop' : 'all shops';
}

/** Make the response-summary heading identify filtered shop views. */
export function shopTrafficFollowupSummaryHeading(shop) {
  return 'response summary' + (shop ? ' · filtered' : '') + ' · ' + shopTrafficFollowupScopeLabel(shop);
}

/** Provide the response-summary scope in an assistive-technology-friendly form. */
export function shopTrafficFollowupScopeAccessibleLabel(shop) {
  return 'response summary' + (shop ? ' filtered' : '') + ' scope: ' + shopTrafficFollowupScopeLabel(shop);
}

/** Label a response-history filter with the number of records in its scope. */
export function shopTrafficFollowupFilterLabel(shop, history) {
  const entries = Array.isArray(history) ? history : [];
  const count = entries.length;
  return shopTrafficFollowupScopeLabel(shop) + ' · ' + count + ' response' + (count === 1 ? '' : 's');
}

/** Mark the currently active response-history filter in its visible label. */
export function shopTrafficFollowupFilterButtonLabel(shop, history, selected = false) {
  const label = shopTrafficFollowupFilterLabel(shop, history);
  return selected ? 'selected: ' + label : label;
}

/** Describe a response-history filter for assistive technology. */
export function shopTrafficFollowupFilterAccessibleLabel(shop, history) {
  const entries = Array.isArray(history) ? history : [];
  const count = entries.length;
  return 'show response history for ' + shopTrafficFollowupScopeLabel(shop) + '; ' +
    count + ' retained response' + (count === 1 ? '' : 's');
}

/** Explain the daily boundary for a shop's live served-customer counter. */
export function shopTrafficServedTodayDetail(count, shop = null) {
  const raw = Number(count);
  const served = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const scope = shop ? ' for ' + shopTrafficFollowupScopeLabel(shop) : '';
  return served + ' customers served so far today' + scope + '; resets at day close and is separate from retained response history';
}

/** Explain that a closed-day shop traffic reading is historical. */
export function shopTrafficLastCloseDetail(entry, shop = null) {
  const raw = Number(entry?.served ?? 0);
  const served = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const scope = shop ? ' for ' + shopTrafficFollowupScopeLabel(shop) : '';
  return 'last close (historical)' + scope + ': ' + served + ' served; separate from live served today';
}

/** Describe the time context of a shop's last-close revenue. */
export function shopTrafficLastCloseRevenueDetail(shop = null) {
  return 'historical revenue for ' + shopTrafficFollowupScopeLabel(shop) +
    ' at last close; separate from live daily revenue';
}

/** Summarize the latest closed-day traffic for the currently visible shops. */
export function shopTrafficLastCloseAggregate(state, shops = null) {
  const days = Array.isArray(state?.log) ? state.log : [];
  const scopeIds = Array.isArray(shops)
    ? new Set(shops.map((shop) => Number(shop?.id)).filter(Number.isFinite))
    : null;
  const closed = days.slice().reverse().find((day) => Array.isArray(day?.shopTraffic) &&
    day.shopTraffic.some((entry) => scopeIds == null || scopeIds.has(Number(entry?.unitId))));
  if (!closed) return null;
  const records = closed.shopTraffic.filter((entry) => scopeIds == null || scopeIds.has(Number(entry?.unitId)));
  if (!records.length) return null;
  const served = records.reduce((sum, entry) => {
    const value = Number(entry?.served);
    return sum + (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
  }, 0);
  const revenue = records.reduce((sum, entry) => {
    const value = Number(entry?.revenue);
    return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
  }, 0);
  return { day: closed.day, shops: records.length, served, revenue };
}

/** Compare current live served customers with a closed-day total. */
export function shopTrafficServedDelta(current, previous) {
  const normalize = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
  };
  return normalize(current) - normalize(previous);
}

/** Describe the relationship between a shop's live and historical traffic readings. */
export function shopTrafficPeriodsAccessibleLabel(shop = null, hasLastClose = false) {
  const scope = shopTrafficFollowupScopeLabel(shop);
  return 'shop traffic time comparison for ' + scope + ': live served today and daily revenue are current; ' +
    (hasLastClose
      ? 'last close traffic and historical revenue are from the previous closed day'
      : 'last close traffic and historical revenue will appear after the first day closes');
}

/** Provide the compact visible heading for the two shop traffic periods. */
export function shopTrafficPeriodsHeading(hasLastClose = false) {
  return hasLastClose ? 'today vs last close' : 'today · last close pending';
}

/** Describe the visible today/history heading for assistive technology. */
export function shopTrafficPeriodsHeadingAccessibleLabel(hasLastClose = false) {
  return hasLastClose
    ? 'today versus last close: current versus historical traffic period'
    : 'today: last close pending; current traffic period is available';
}

/** Return the compact legend label used for the shop traffic time comparison. */
export function shopTrafficPeriodsLegendLabel() {
  return 'today vs last close';
}

function expectedShopRevenue(state, unit, config, reputation = null) {
  const estimate = shopTrafficEstimate(state, unit, config, reputation);
  return {
    potential: estimate.potentialRevenue,
    revenue: estimate.expectedRevenue,
    deliveryFactor: estimate.deliveryFactor,
    potentialCustomers: estimate.potentialCustomers,
    expectedCustomers: estimate.expectedCustomers,
  };
}

function dailyIncomeBreakdown(state, unit, config, reputation = null) {
  const tune = config.units[unit.kind] || {};
  const level = unit.rentLevel ?? state.rentLevels?.[unit.kind] ?? 0;
  const rent = unit.rent != null && Number.isFinite(Number(unit.rent))
    ? Number(unit.rent)
    : rentForLevel(config, unit.kind, level);
  const heads = unit.kind === 'hotel'
    ? (unit.heads ?? tune.guests ?? 0)
    : 1;
  const baseRent = Math.max(0, Math.round(rent * heads));
  const shopRevenue = expectedShopRevenue(state, unit, config, reputation);
  const variableRevenue = shopRevenue.revenue;
  return {
    baseRent,
    variableRevenue,
    potentialVariableRevenue: shopRevenue.potential,
    deliveryFactor: shopRevenue.deliveryFactor,
    trafficPotentialCustomers: shopRevenue.potentialCustomers,
    trafficExpectedCustomers: shopRevenue.expectedCustomers,
    total: baseRent + variableRevenue,
  };
}

function recoveryOption(state, unit, config, reputation, values) {
  const gate = recoveryGateSummary(state, values.projectedUnit ?? unit, config, reputation);
  const currentIncome = dailyIncomeBreakdown(state, unit, config, reputation);
  const projectedIncome = values.projectedIncomeBreakdown ?? dailyIncomeBreakdown(state, values.projectedUnit ?? unit, config, reputation);
  return {
    ...values,
    dailyRent: projectedIncome.baseRent,
    variableRevenue: projectedIncome.variableRevenue,
    potentialVariableRevenue: projectedIncome.potentialVariableRevenue,
    deliveryFactor: projectedIncome.deliveryFactor,
    dailyIncome: projectedIncome.total,
    dailyIncomeDelta: projectedIncome.total - currentIncome.total,
    dailyRentDelta: projectedIncome.baseRent - currentIncome.baseRent,
    variableRevenueDelta: projectedIncome.variableRevenue - currentIncome.variableRevenue,
    incomeBasis: values.incomeBasis ?? 'rent',
    projectedStatus: gate.status,
    marketDaysRequired: gate.marketDaysRequired,
    marketDaysRemaining: gate.marketDaysRemaining,
    marketReady: gate.marketReady,
    reputationReady: gate.reputationReady,
    reputationGap: gate.reputationGap,
    blockers: gate.blockers,
    ready: gate.ready,
    detail: gate.ready ? 'ready now' : gate.blockers.join(' + ') + ' gate',
  };
}

/** Compare the non-destructive recovery choices for a vacant room. */
export function vacancyRecoveryComparison(state, unit, config, reputation = null) {
  if (!unit || unit.occupied) return { key: 'occupied', options: [], recommendation: null };
  const rep = reputation ?? state.log.at(-1)?.rep ?? 100;
  const evaluation = unitEvaluation(state, unit, config);
  const currentGate = recoveryGateSummary(state, unit, config, rep);
  const currentIncome = dailyIncomeBreakdown(state, unit, config, rep);
  const currentQuality = tenantDemandQuality(state, {
    ...unit, occupied: true, stress: 0, heads: tenantCapacity(unit, config),
  }, config);
  const currentMarketBonus = marketDemandBonus(state, unit, config, rep);
  const currentTotalBonus = currentQuality.bonus + currentMarketBonus;
  const options = [recoveryOption(state, unit, config, rep, {
    key: 'rerent', label: 're-rent', kind: unit.kind,
    cost: config.costs.rerent, evaluation: evaluation.score, projectedEvaluation: evaluation.score,
    qualityBonus: currentQuality.bonus, marketBonus: currentMarketBonus,
    totalBonus: currentTotalBonus,
    affordable: state.money >= config.costs.rerent,
    projectedUnit: unit,
  })];

  if (!unit.renovated) {
    const renovatedUnit = { ...unit, occupied: false, stress: 0, renovated: true };
    const renovatedEvaluation = unitEvaluation(state, renovatedUnit, config);
    options.push(recoveryOption(state, unit, config, rep, {
      key: 'renovate', label: 'renovate', kind: unit.kind,
      cost: config.costs.renovation, evaluation: evaluation.score,
      projectedEvaluation: renovatedEvaluation.score,
      qualityBonus: currentQuality.bonus, marketBonus: currentMarketBonus,
      totalBonus: currentTotalBonus,
      affordable: state.money >= config.costs.renovation,
      projectedUnit: renovatedUnit,
    }));
  }

  const targetKinds = Object.keys(config.units)
    .filter((kind) => kind !== unit.kind && unlocked(state, config, kind));
  for (const targetKind of targetKinds) {
    const conversion = conversionPreview(state, unit, targetKind, config, rep);
    const convertedUnit = {
      ...unit,
      kind: targetKind,
      occupied: false,
      heads: tenantCapacity({ kind: targetKind }, config),
      rent: null,
      rentLevel: state.rentLevels?.[targetKind] ?? 0,
      vacantDays: 0,
      renovated: false,
      stress: 0,
    };
    options.push(recoveryOption(state, unit, config, rep, {
      key: 'convert', label: 'convert to ' + targetKind, kind: targetKind,
      cost: config.costs.conversion, evaluation: null, projectedEvaluation: unitEvaluation(state, convertedUnit, config).score,
      qualityBonus: conversion.toDemandQuality.bonus,
      marketBonus: conversion.toMarketDemandBonus,
      totalBonus: conversion.toDemandQuality.bonus + conversion.toMarketDemandBonus,
      affordable: state.money >= config.costs.conversion,
      projectedUnit: convertedUnit,
    }));
  }

  options.push({
    key: 'demolish', label: 'demolish', kind: unit.kind,
    cost: config.costs.demolition, evaluation: evaluation.score, projectedEvaluation: null,
    qualityBonus: 0, marketBonus: 0, totalBonus: 0,
    dailyRent: 0, variableRevenue: 0, potentialVariableRevenue: 0, deliveryFactor: null, dailyIncome: 0,
    dailyRentDelta: -currentIncome.baseRent, variableRevenueDelta: -currentIncome.variableRevenue,
    dailyIncomeDelta: -currentIncome.total, incomeBasis: 'no rent after removal',
    affordable: state.money >= config.costs.demolition,
    ready: state.money >= config.costs.demolition,
    projectedStatus: 'removed', marketDaysRequired: 0, marketDaysRemaining: 0,
    marketReady: false, reputationReady: false, reputationGap: 0,
    blockers: ['permanent removal'], lastResort: true,
    freedFloorSpace: { floor: unit.floor, slot: unit.slot },
    detail: 'last resort; permanent; frees F' + unit.floor + ' slot ' + unit.slot + ' for a new room',
  });

  let recommendation;
  if (!currentGate.reputationReady) {
    recommendation = {
      key: 'reputation', label: 'restore reputation',
      detail: 'Replacement demand is paused until reputation reaches ' + currentGate.reputationRequired + '% (currently ' + Math.round(rep) + '%). Spending now will not fill the room.',
    };
  } else if (currentGate.marketDaysRemaining > 0 && currentGate.evaluation >= config.evaluation.relistMinScore) {
    recommendation = {
      key: 'wait', label: 'wait for market timing',
      detail: 'This room needs ' + currentGate.marketDaysRemaining + ' more full market day' + (currentGate.marketDaysRemaining === 1 ? '' : 's') + ' before a replacement can arrive. Conversion would restart that clock.',
    };
  } else if (currentGate.evaluation < config.evaluation.relistMinScore) {
    const renovation = options.find((option) => option.key === 'renovate');
    recommendation = renovation?.projectedEvaluation >= config.evaluation.relistMinScore
      ? { key: 'renovate', label: 'renovate first', detail: 'Renovation clears the room-quality gate; market timing still shows when the replacement can arrive.' }
      : { key: 'improve', label: 'improve room quality', detail: 'Access or required services must improve until evaluation reaches ' + config.evaluation.relistMinScore + '.' };
  } else if (!options[0].affordable) {
    recommendation = { key: 'save', label: 'save to re-rent', detail: 'The room is ready, but the re-rent fee is not affordable yet.' };
  } else {
    recommendation = { key: 'rerent', label: 're-rent now', detail: 'This room is ready and has the shortest path back to occupancy.' };
  }
  return {
    key: 'vacancy', status: currentGate.status, options, recommendation,
    marketDaysRequired: currentGate.marketDaysRequired,
    marketDaysRemaining: currentGate.marketDaysRemaining,
    marketReady: currentGate.marketReady,
    reputation: currentGate.reputation,
    reputationRequired: currentGate.reputationRequired,
    reputationGap: currentGate.reputationGap,
    reputationReady: currentGate.reputationReady,
    blockers: currentGate.blockers,
  };
}

/** Snapshot occupied tenant shares and distance from configured target shares. */
export function tenantMixSnapshot(state, config) {
  const entries = tenantMixDemand(state, config)
    .map(({ kind, heads, share, targetShare }) => ({ kind, heads, share, targetShare }));
  const distance = entries.reduce((sum, entry) => sum + Math.abs(entry.share - entry.targetShare), 0);
  return {
    balance: Math.round(clamp(1 - distance / 2) * 100),
    entries,
  };
}

/** Return recent day-close tenant-mix snapshots for the diagnostics panel. */
export function tenantMixHistory(state, config) {
  const windowSize = Math.max(1, Math.floor(config.occupancy.tenantMixHistoryDays ?? 1));
  return state.log.slice(-windowSize)
    .filter((day) => day.tenantMix && Number.isFinite(day.tenantMix.balance))
    .map((day) => ({
      day: day.day,
      balance: day.tenantMix.balance,
      entries: day.tenantMix.entries ?? [],
    }));
}

/** Return the occupied population mix that drives vacancy demand selection. */
export function tenantMixDemand(state, config) {
  const headsByKind = new Map(Object.keys(config.units).map((kind) => [kind, 0]));
  let totalHeads = 0;
  for (const unit of state.units) {
    if (!unit.occupied) continue;
    const heads = unit.heads ?? 0;
    totalHeads += heads;
    headsByKind.set(unit.kind, (headsByKind.get(unit.kind) ?? 0) + heads);
  }
  return Object.entries(config.units).map(([kind, tune]) => ({
    kind,
    heads: headsByKind.get(kind) ?? 0,
    share: totalHeads ? +((headsByKind.get(kind) ?? 0) / totalHeads).toFixed(3) : 0,
    targetShare: tune.targetShare ?? 0,
    marketDemandBonus: marketDemandBonus(state, { kind }, config),
  }));
}

/** Return the occupied tenant mix and buildable capacity for each upper floor. */
export function tenantFloorMix(state, config) {
  return Array.from({ length: Math.max(0, state.floors - 1) }, (_, index) => index + 1)
    .map((floor) => {
      const units = state.units.filter((unit) => unit.floor === floor);
      const headsByKind = new Map(Object.keys(config.units).map((kind) => [kind, 0]));
      for (const unit of units) {
        if (!unit.occupied) continue;
        headsByKind.set(unit.kind, (headsByKind.get(unit.kind) ?? 0) + (unit.heads ?? 0));
      }
      const totalHeads = [...headsByKind.values()].reduce((sum, heads) => sum + heads, 0);
      return {
        floor,
        totalHeads,
        vacantRooms: units.filter((unit) => !unit.occupied).length,
        openSlots: config.building.slotsPerFloor - slotsUsed(state, floor).size,
        entries: Object.entries(config.units)
          .filter(([kind]) => (headsByKind.get(kind) ?? 0) > 0)
          .map(([kind, tune]) => ({
            kind,
            heads: headsByKind.get(kind) ?? 0,
            share: totalHeads ? +((headsByKind.get(kind) ?? 0) / totalHeads).toFixed(3) : 0,
            targetShare: tune.targetShare ?? 0,
          })),
      };
    });
}

/** Identify the largest current tenant-mix gap and its recent direction. */
export function tenantMixDiagnosis(state, config) {
  const entries = tenantMixDemand(state, config)
    .filter(({ kind }) => unlocked(state, config, kind));
  const under = entries
    .map((entry) => ({ ...entry, gap: entry.targetShare - entry.share }))
    .filter((entry) => entry.gap > 0)
    .sort((a, b) => b.gap - a.gap)[0] ?? null;
  const over = entries
    .map((entry) => ({ ...entry, gap: entry.share - entry.targetShare }))
    .filter((entry) => entry.gap > 0)
    .sort((a, b) => b.gap - a.gap)[0] ?? null;
  const history = tenantMixHistory(state, config);
  const latest = history.at(-1);
  const prior = history.at(-2);
  const trend = !latest || !prior ? 'new' : latest.balance > prior.balance ? 'improving' : latest.balance < prior.balance ? 'drifting' : 'steady';
  const focus = under ? { ...under, direction: 'under' } : over ? { ...over, direction: 'over' } : null;
  return {
    balance: latest?.balance ?? tenantMixSnapshot(state, config).balance,
    trend,
    historyDays: history.length,
    under,
    over,
    focus,
  };
}

/** Describe explicit responses to the current tenant-mix gaps. */
export function tenantMixResponse(state, config) {
  const diagnosis = tenantMixDiagnosis(state, config);
  const vacantOver = diagnosis.over
    ? state.units.find((unit) => unit.kind === diagnosis.over.kind && !unit.occupied)
    : null;
  const occupiedOver = diagnosis.over
    ? state.units.find((unit) => unit.kind === diagnosis.over.kind && unit.occupied)
    : null;
  const responseUnit = vacantOver ?? occupiedOver;
  return {
    build: diagnosis.under
      ? { kind: diagnosis.under.kind, gap: diagnosis.under.gap }
      : null,
    convert: diagnosis.over
      ? {
          fromKind: diagnosis.over.kind,
          toKind: diagnosis.under?.kind ?? null,
          gap: diagnosis.over.gap,
          unitId: responseUnit?.id ?? null,
          occupied: responseUnit?.occupied ?? null,
          key: vacantOver && diagnosis.under ? 'convert' : responseUnit ? 'protect' : 'observe',
        }
      : null,
  };
}

/** Preview a vacant-room conversion and its mix effect after re-renting. */
export function conversionPreview(state, unit, targetKind, config, reputation = null) {
  const currentMix = tenantMixDemand(state, config);
  const currentTotal = currentMix.reduce((sum, entry) => sum + entry.heads, 0);
  const currentTarget = currentMix.find((entry) => entry.kind === targetKind);
  const fromCapacity = tenantCapacity(unit, config);
  const toCapacity = tenantCapacity({ ...unit, kind: targetKind }, config);
  const projectedTotal = currentTotal - (unit.occupied ? unit.heads ?? 0 : 0) + toCapacity;
  const currentShare = currentTarget?.share ?? 0;
  const projectedHeads = (currentTarget?.heads ?? 0) + toCapacity;
  const fromTune = config.units[unit.kind] || {};
  const toTune = config.units[targetKind] || {};
  const fromDemandQuality = tenantDemandQuality(state, {
    ...unit, occupied: true, heads: fromCapacity, stress: 0, rent: fromTune.rent,
  }, config);
  const toDemandQuality = tenantDemandQuality(state, {
    ...unit, kind: targetKind, occupied: true, heads: toCapacity, stress: 0, rent: toTune.rent,
  }, config);
  const fromMarketDemandBonus = marketDemandBonus(state, { kind: unit.kind }, config);
  const toMarketDemandBonus = marketDemandBonus(state, { kind: targetKind }, config);
  const fromIncome = dailyIncomeBreakdown(state, { ...unit, kind: unit.kind, heads: fromCapacity }, config, reputation);
  const toIncome = dailyIncomeBreakdown(state, {
    ...unit,
    kind: targetKind,
    heads: toCapacity,
    rent: null,
    rentLevel: state.rentLevels?.[targetKind] ?? 0,
  }, config, reputation);
  return {
    fromKind: unit.kind,
    toKind: targetKind,
    fromCapacity,
    toCapacity,
    currentShare,
    projectedShare: projectedTotal ? +(projectedHeads / projectedTotal).toFixed(3) : 0,
    targetShare: currentTarget?.targetShare ?? config.units[targetKind]?.targetShare ?? 0,
    fromDemandQuality,
    toDemandQuality,
    fromMarketDemandBonus,
    toMarketDemandBonus,
    fromDailyIncome: fromIncome.total,
    toDailyIncome: toIncome.total,
    fromDailyRent: fromIncome.baseRent,
    toDailyRent: toIncome.baseRent,
    fromVariableRevenue: fromIncome.variableRevenue,
    toVariableRevenue: toIncome.variableRevenue,
    fromTrafficPotential: fromIncome.potentialVariableRevenue,
    toTrafficPotential: toIncome.potentialVariableRevenue,
    fromDeliveryFactor: fromIncome.deliveryFactor,
    toDeliveryFactor: toIncome.deliveryFactor,
    fromTrafficCustomers: fromIncome.trafficExpectedCustomers,
    toTrafficCustomers: toIncome.trafficExpectedCustomers,
    fromTrafficPotentialCustomers: fromIncome.trafficPotentialCustomers,
    toTrafficPotentialCustomers: toIncome.trafficPotentialCustomers,
    dailyIncomeDelta: toIncome.total - fromIncome.total,
    dailyRentDelta: toIncome.baseRent - fromIncome.baseRent,
    variableRevenueDelta: toIncome.variableRevenue - fromIncome.variableRevenue,
    demandQualityDelta: toDemandQuality.score - fromDemandQuality.score,
    demandBonusDelta: (toDemandQuality.bonus + toMarketDemandBonus) -
      (fromDemandQuality.bonus + fromMarketDemandBonus),
  };
}

/** Return a room score plus the components that explain it to the player. */
export function unitEvaluation(state, unit, config) {
  const tune = config.units[unit.kind] || config.units.office;
  const nearest = nearestShaft(state, unit);
  const stairs = nearestStair(state, unit, config);
  const escalator = nearestEscalator(state, unit, config);
  const viewBonus = Math.min(config.evaluation.viewBonusCap ?? 0,
    Math.max(0, unit.floor) * (config.evaluation.viewWeight ?? 0));
  const preferredFloor = tune.preferredFloor ?? unit.floor;
  const preferenceDistance = Math.abs(unit.floor - preferredFloor);
  const preferencePenalty = clamp(preferenceDistance / Math.max(1, config.evaluation.preferenceTolerance ?? 1))
    * (config.evaluation.preferenceWeight ?? 0);
  const layoutBonus = unitLayoutBonus(state, unit, config);
  const stressRatio = clamp(unit.stress / tune.vacateAt);
  const stressPenalty = stressRatio * config.evaluation.stressWeight;
  const noise = unitNoise(state, unit, config);
  const noiseTolerance = tune.noiseTolerance ?? config.evaluation.noiseTolerance ?? 1;
  const noisePenalty = clamp(noise / Math.max(0.001, noiseTolerance))
    * config.evaluation.noiseWeight;
  const food = foodCoverage(state, unit, config);
  const foodNeed = tune.foodNeed ?? 0;
  const foodPenalty = food ? 0 : foodNeed * config.evaluation.foodWeight;
  const amenityBonus = food ? (config.evaluation.amenityWeight ?? 0) : 0;
  const parking = parkingCoverage(state, unit, config);
  const parkingNeed = tune.parkingNeed ?? 0;
  const parkingPenalty = parking ? 0 : parkingNeed * config.evaluation.parkingWeight;
  const medical = medicalCoverage(state, unit, config);
  const medicalNeed = tune.medicalNeed ?? 0;
  const medicalPenalty = medical ? 0 : medicalNeed * config.evaluation.medicalWeight;
  const security = securityCoverage(state, unit, config);
  const securityNeed = tune.securityNeed ?? 0;
  const securityPenalty = security ? 0 : securityNeed * config.evaluation.securityWeight;
  const recycling = recyclingCoverage(state, unit, config);
  const recyclingNeed = tune.recyclingNeed ?? 0;
  const recyclingPenalty = recycling ? 0 : recyclingNeed * config.evaluation.recyclingWeight;
  const renovationBonus = unit.renovated ? config.evaluation.renovationBonus : 0;
  const rent = unit.rent ?? tune.rent;
  const rentRatio = rent / tune.rent - 1;
  const rentAdjustment = -clamp(rentRatio / (config.pricing.maxLevel * config.pricing.stepMultiplier), -1, 1)
    * config.evaluation.rentWeight;

  const shaftLobbyWalk = nearest ? (lobbyAccessDistance(state, nearest.shaft.slot) ?? 0) : 0;
  const stairLobbyWalk = stairs ? (lobbyAccessDistance(state, stairs.stair.slot) ?? 0) : 0;
  const escalatorLobbyWalk = escalator ? (lobbyAccessDistance(state, escalator.escalator.slot) ?? 0) : 0;
  const shaftOption = nearest ? {
    mode: 'elevator',
    accessSlots: nearest.slots + shaftLobbyWalk,
    lobbyAccessSlots: shaftLobbyWalk,
    accessSeconds: (nearest.slots + shaftLobbyWalk) * config.access.walkSecondsPerSlot,
  } : null;
  const stairOption = stairs ? {
    mode: 'stairs',
    accessSlots: stairs.slots,
    lobbyAccessSlots: stairLobbyWalk,
    accessSeconds: stairs.accessSeconds,
  } : null;
  const escalatorOption = escalator ? {
    mode: 'escalator',
    accessSlots: escalator.slots,
    lobbyAccessSlots: escalatorLobbyWalk,
    accessSeconds: escalator.accessSeconds,
  } : null;
  const access = [shaftOption, stairOption, escalatorOption].filter(Boolean)
    .sort((a, b) => a.accessSeconds - b.accessSeconds)[0];

  if (!access) {
    return {
      score: 0, band: 'bad', stress: Math.round(unit.stress),
      stressPenalty: Math.round(stressPenalty), accessSlots: null,
      accessSeconds: null, accessPenalty: config.evaluation.accessWeight,
      accessMode: null,
      lobbyAccessSlots: null,
      viewBonus,
      amenityBonus,
      preferredFloor,
      preferencePenalty: Math.round(preferencePenalty),
      layoutBonus,
      noise, noisePenalty: Math.round(noisePenalty),
      foodCovered: Boolean(food), foodFloors: food?.floors ?? null, foodPenalty: Math.round(foodPenalty),
      parkingCovered: Boolean(parking), parkingFloors: parking?.floors ?? null, parkingPenalty: Math.round(parkingPenalty),
      medicalCovered: medicalNeed === 0 || Boolean(medical), medicalFloors: medical?.floors ?? null, medicalPenalty: Math.round(medicalPenalty),
      securityCovered: securityNeed === 0 || Boolean(security), securityFloors: security?.floors ?? null, securityPenalty: Math.round(securityPenalty),
      recyclingCovered: recyclingNeed === 0 || Boolean(recycling), recyclingFloors: recycling?.floors ?? null, recyclingPenalty: Math.round(recyclingPenalty),
      renovated: Boolean(unit.renovated), renovationBonus,
      rent, rentAdjustment: Math.round(rentAdjustment),
    };
  }

  const accessSlots = access.accessSlots;
  const accessSeconds = access.accessSeconds;
  const accessPenalty = clamp(accessSeconds / config.evaluation.accessToleranceSeconds)
    * config.evaluation.accessWeight;
  const score = Math.max(0, Math.min(100, Math.round(
    100 - stressPenalty - accessPenalty - noisePenalty - foodPenalty - parkingPenalty - medicalPenalty - securityPenalty - recyclingPenalty - preferencePenalty + rentAdjustment + renovationBonus + viewBonus + amenityBonus + layoutBonus
  )));
  return {
    score,
    band: score >= 80 ? 'excellent' : score >= config.evaluation.relistMinScore ? 'good' : 'bad',
    stress: Math.round(unit.stress),
    stressPenalty: Math.round(stressPenalty),
    accessSlots,
    accessMode: access.mode,
    lobbyAccessSlots: access.lobbyAccessSlots,
    accessSeconds: +accessSeconds.toFixed(1),
    accessPenalty: Math.round(accessPenalty),
    viewBonus,
    amenityBonus,
    preferredFloor,
    preferencePenalty: Math.round(preferencePenalty),
    layoutBonus,
    noise, noisePenalty: Math.round(noisePenalty),
    foodCovered: Boolean(food), foodFloors: food?.floors ?? null, foodPenalty: Math.round(foodPenalty),
    parkingCovered: Boolean(parking), parkingFloors: parking?.floors ?? null, parkingPenalty: Math.round(parkingPenalty),
    medicalCovered: medicalNeed === 0 || Boolean(medical), medicalFloors: medical?.floors ?? null, medicalPenalty: Math.round(medicalPenalty),
    securityCovered: securityNeed === 0 || Boolean(security), securityFloors: security?.floors ?? null, securityPenalty: Math.round(securityPenalty),
    recyclingCovered: recyclingNeed === 0 || Boolean(recycling), recyclingFloors: recycling?.floors ?? null, recyclingPenalty: Math.round(recyclingPenalty),
    renovated: Boolean(unit.renovated), renovationBonus,
    rent, rentAdjustment: Math.round(rentAdjustment),
  };
}

/** Summarize the service coverage that contributes to a hotel room's quality. */
export function hotelServiceSummary(state, unit, config) {
  const tune = config.units[unit.kind] || {};
  const evaluation = unitEvaluation(state, unit, config);
  const definitions = [
    ['food', 'foodNeed', 'foodCovered'],
    ['parking', 'parkingNeed', 'parkingCovered'],
    ['medical', 'medicalNeed', 'medicalCovered'],
    ['security', 'securityNeed', 'securityCovered'],
    ['recycling', 'recyclingNeed', 'recyclingCovered'],
  ];
  const services = definitions
    .filter(([, need]) => (tune[need] ?? 0) > 0)
    .map(([name, , coveredKey]) => ({ name, covered: Boolean(evaluation[coveredKey]) }));
  return {
    services,
    coveredCount: services.filter((service) => service.covered).length,
    requiredCount: services.length,
    missing: services.filter((service) => !service.covered).map((service) => service.name),
  };
}

/** Explain a hotel's current guest experience without changing booking demand. */
export function hotelGuestExperience(state, unit, config) {
  const tune = config.units[unit.kind] || {};
  const services = hotelServiceSummary(state, unit, config);
  const serviceRatio = services.requiredCount
    ? services.coveredCount / services.requiredCount
    : 1;
  const stressPenalty = clamp(unit.stress / Math.max(1, tune.vacateAt))
    * (tune.guestExperience?.stressWeight ?? 60);
  const servicePenalty = (1 - serviceRatio) * (tune.guestExperience?.serviceWeight ?? 40);
  const score = Math.max(0, Math.min(100, Math.round(100 - stressPenalty - servicePenalty)));
  return {
    score,
    band: score >= 80 ? 'good' : score >= 55 ? 'watch' : 'poor',
    serviceRatio,
    stressPenalty: Math.round(stressPenalty),
    servicePenalty: Math.round(servicePenalty),
  };
}

/** Aggregate occupied hotel feedback by booked guest for the day log and HUD. */
export function hotelExperienceSummary(state, config) {
  const hotels = state.units.filter((unit) => unit.kind === 'hotel' && unit.occupied);
  if (!hotels.length) return { rooms: 0, guests: 0, average: null, min: null, max: null };
  const scores = hotels.map((hotel) => ({
    score: hotelGuestExperience(state, hotel, config).score,
    guests: Math.max(0, hotel.heads ?? 0),
  }));
  const guests = scores.reduce((sum, item) => sum + item.guests, 0);
  return {
    rooms: hotels.length,
    guests,
    average: guests
      ? Math.round(scores.reduce((sum, item) => sum + item.score * item.guests, 0) / guests)
      : Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length),
    min: Math.min(...scores.map((item) => item.score)),
    max: Math.max(...scores.map((item) => item.score)),
  };
}

/** Convert recent guest feedback into a bounded booking factor. */
export function hotelBookingFeedback(state, config) {
  const feedback = hotelExperienceHistory(state, config);
  const weight = clamp(config.units.hotel.bookingFeedbackWeight ?? 0);
  if (!feedback.length || weight === 0) {
    return { previousExperience: null, feedbackFactor: 1, feedbackDays: 0, feedbackGuests: 0 };
  }
  const totalGuests = feedback.reduce((sum, day) => sum + day.guests, 0);
  const previousExperience = totalGuests
    ? Math.round(feedback.reduce((sum, day) => sum + day.experience * day.guests, 0) / totalGuests)
    : Math.round(feedback.reduce((sum, day) => sum + day.experience, 0) / feedback.length);
  const score = clamp(previousExperience / 100);
  return {
    previousExperience,
    feedbackFactor: +(1 - weight * (1 - score)).toFixed(3),
    feedbackDays: feedback.length,
    feedbackGuests: totalGuests,
  };
}

/** Return the recent daily feedback records used by hotel booking demand. */
export function hotelExperienceHistory(state, config) {
  const windowSize = Math.max(1, Math.floor(config.units.hotel.bookingFeedbackDays ?? 1));
  return state.log.slice(-windowSize)
    .filter((day) => Number.isFinite(day.hotelExperience))
    .map((day) => ({
      day: day.day,
      experience: day.hotelExperience,
      // Older saves may not have recorded guest counts; count them as one
      // observation rather than silently dropping their feedback.
      guests: Number.isFinite(day.hotelGuests) ? Math.max(0, day.hotelGuests) : 1,
    }));
}

/** Return recent reputation readings with the transport outcomes behind them. */
export function reputationHistory(state, config) {
  const windowSize = Math.max(1, Math.floor(config.occupancy.reputationWindow ?? 1));
  return state.log.slice(-windowSize)
    .filter((day) => Number.isFinite(day.rep) || Number.isFinite(day.deliveryRate))
    .map((day) => ({
      day: day.day,
      reputation: Number.isFinite(day.rep) ? day.rep : null,
      deliveryRate: Number.isFinite(day.deliveryRate) ? day.deliveryRate : null,
      avgWait: Number.isFinite(day.avgWait) ? day.avgWait : null,
      abandoned: Number.isFinite(day.abandoned) ? day.abandoned : 0,
      localAvgWait: Number.isFinite(day.localAvgWait) ? day.localAvgWait : null,
      localAbandoned: Number.isFinite(day.localAbandoned) ? day.localAbandoned : 0,
      localOverflowPeak: Number.isFinite(day.localOverflowPeak) ? Math.max(0, day.localOverflowPeak) : 0,
      localOverflowPenalty: Number.isFinite(day.localOverflowPenalty) ? Math.max(0, day.localOverflowPenalty) : 0,
      elevatorAvgWait: Number.isFinite(day.elevatorAvgWait) ? day.elevatorAvgWait : null,
      elevatorAbandoned: Number.isFinite(day.elevatorAbandoned) ? day.elevatorAbandoned : 0,
      trips: Number.isFinite(day.trips) ? day.trips : 0,
    }));
}

function formatCost(cost) {
  return '$' + Math.ceil(cost).toLocaleString();
}

function clearRouteColumn(state, bottom, top, config) {
  for (let slot = 0; slot < config.building.slotsPerFloor; slot++) {
    if (Array.from({ length: top - bottom + 1 }, (_, index) => bottom + index)
      .every((floor) => !slotsUsed(state, floor).has(slot))) return true;
  }
  return false;
}

function routeOption(state, config, kind) {
  if (!state.lobby) {
    const lobbyPlacement = Array.from({ length: config.building.slotsPerFloor }, (_, slot) => slot)
      .some((slot) => !slotsUsed(state, 0).has(slot));
    return lobbyPlacement
      ? { kind: 'lobby', cost: config.costs.lobby, available: true }
      : { kind: 'lobby', available: false, reason: 'no clear ground-floor slot' };
  }
  if (!unlocked(state, config, kind)) return { kind, available: false, reason: kind + ' is locked' };
  const tune = config[kind];
  const bottom = config.building.lobbyFloor ?? 0;
  const top = Math.min(state.floors - 1, bottom + tune.maxSpan - 1);
  const slot = top > bottom
    ? Array.from({ length: config.building.slotsPerFloor }, (_, candidateSlot) => candidateSlot)
      .find((candidateSlot) => Array.from({ length: top - bottom + 1 }, (_, index) => bottom + index)
        .every((floor) => !slotsUsed(state, floor).has(candidateSlot)))
    : null;
  if (slot == null) {
    return { kind, available: false, reason: 'no clear column' };
  }
  return {
    kind,
    cost: config.costs[kind] + config.costs[kind + 'PerFloor'] * (top - bottom),
    available: true,
    bottom,
    top,
    slot,
  };
}

function routeRecommendation(state, config) {
  const options = state.lobby
    ? [routeOption(state, config, 'stairs'), routeOption(state, config, 'escalator')]
    : [routeOption(state, config, 'lobby')];
  const available = options.filter((option) => option.available);
  if (!available.length) {
    return {
      key: 'placement',
      label: 'free a route column',
      detail: 'No eligible local route has a clear placement column. Free a column or add floors before rebuilding coverage.',
    };
  }
  const cheapest = available.sort((a, b) => a.cost - b.cost)[0];
  if (state.money < cheapest.cost) {
    return {
      key: 'budget',
      label: 'save for ' + cheapest.kind,
      detail: 'The next viable route costs ' + formatCost(cheapest.cost) + '; you have ' + formatCost(state.money) + '. Keep the tower stable while it earns the difference.',
      control: cheapest.kind,
    };
  }
  if (cheapest.kind === 'lobby') {
    return {
      key: 'lobby',
      label: 'build a lobby',
      detail: 'Local routes need an entrance first. Select LOBBY and place it on an open ground-floor slot.',
      control: 'lobby',
    };
  }
  return {
    key: 'route',
    label: 'add ' + cheapest.kind,
    detail: 'Every shaft is at its car limit. Select ' + cheapest.kind.toUpperCase() + ' and place it on a clear column from the lobby.',
    control: cheapest.kind,
  };
}

/** Turn the latest reputation pressure into one concrete, availability-aware next move. */
export function reputationRecommendation(state, config) {
  const latest = state.log.at(-1);
  if (!latest) {
    return {
      key: 'observe',
      label: 'run a day first',
      detail: 'Let one day run so delivery, wait, and abandonment data can identify the bottleneck.',
    };
  }

  const longWait = (latest.avgWait ?? 0) >= Math.max(config.units.office.patience, config.demand.abandonAfter * 0.2);
  const abandoned = (latest.abandoned ?? 0) > 0;
  const lowDelivery = (latest.trips ?? 0) > 0 && (latest.deliveryRate ?? 100) < 90;
  if (longWait || abandoned) {
    if (!state.shafts.length) {
      if (!unlocked(state, config, 'shaft')) {
        return { key: 'locked', label: 'unlock a shaft', detail: 'A shaft is not available at this milestone; keep the building stable until it unlocks.', control: 'shaft' };
      }
      const top = Math.min(state.floors - 1, config.elevator.maxSpan - 1);
      const shaftCost = top > 0 ? config.costs.shaft + config.costs.shaftPerFloor * (top + 1) : Infinity;
      const shaftPlacement = top > 0 && clearRouteColumn(state, 0, top, config);
      if (!shaftPlacement) {
        return { key: 'placement', label: 'free a shaft column', detail: 'People need elevator service, but every possible shaft column is blocked. Free a column before building one.' };
      }
      if (state.money < shaftCost) {
        return { key: 'budget', label: 'save for a shaft', detail: 'A viable shaft costs ' + formatCost(shaftCost) + '; you have ' + formatCost(state.money) + '.', control: 'shaft' };
      }
      return {
        key: 'shaft',
        label: 'build a shaft',
        detail: 'People are waiting or giving up. Select SHAFT and cover the busiest occupied floors (about ' + formatCost(shaftCost) + ').',
        control: 'shaft',
      };
    }
    if (state.shafts.some((shaft) => shaft.cars.length < config.elevator.maxCarsPerShaft)) {
      if (!unlocked(state, config, 'car')) {
        return { key: 'locked', label: 'unlock another car', detail: 'More elevator cars are not available at this milestone; use a local route if one is unlocked.', control: 'car' };
      }
      if (state.money < config.costs.car) {
        return { key: 'budget', label: 'save for an elevator car', detail: 'The next car costs ' + formatCost(config.costs.car) + '; you have ' + formatCost(state.money) + '.', control: 'car' };
      }
      return {
        key: 'car',
        label: 'add an elevator car',
        detail: 'Long waits are the pressure. Select CAR, then click the shaft with the longest queue (' + formatCost(config.costs.car) + ').',
        control: 'car',
      };
    }
    return routeRecommendation(state, config);
  }
  if (lowDelivery) {
    const extension = state.shafts.at(-1);
    const canExtend = extension && (() => {
      const top = state.floors - 1;
      if (!Number.isFinite(extension.bottom) || !Number.isFinite(extension.top)) return false;
      if (extension.top >= top || top - extension.bottom + 1 > config.elevator.maxSpan) return false;
      for (let floor = extension.top + 1; floor <= top; floor++) {
        if (slotsUsed(state, floor).has(extension.slot)) return false;
      }
      return true;
    })();
    if (canExtend) {
      const cost = config.costs.shaftPerFloor * (state.floors - 1 - extension.top);
      if (state.money < cost) {
        return { key: 'budget', label: 'save to extend coverage', detail: 'Some trips miss their floors. Extending a shaft costs about ' + formatCost(cost) + '; you have ' + formatCost(state.money) + '.', control: 'extend' };
      }
      return { key: 'extend', label: 'extend shaft coverage', detail: 'Some trips miss their floors. Extend a shaft to reach them (about ' + formatCost(cost) + ').', control: 'extend' };
    }
    return routeRecommendation(state, config);
  }
  return {
    key: 'steady',
    label: 'transport is steady',
    detail: 'No immediate transport change is indicated; watch the next day before spending on capacity.',
  };
}

export function averageEvaluation(state, config) {
  const occupied = state.units.filter((u) => u.occupied);
  if (!occupied.length) return 0;
  return Math.round(occupied.reduce((sum, u) => sum + unitEvaluation(state, u, config).score, 0) / occupied.length);
}

/**
 * Summarize tower appeal separately from transport service reputation. This
 * first-pass index uses the room signals that describe appeal and livability;
 * elevator wait, walking access, stress, and delivery reputation stay out of
 * it so the player can see two different management problems.
 */
export function towerDesirabilitySummary(state, config) {
  const occupied = (state?.units ?? []).filter((unit) => unit.occupied);
  if (!occupied.length) {
    return {
      score: null,
      band: 'unknown',
      colorKey: 'warn',
      rooms: 0,
      detail: 'no occupied rooms yet; desirability uses room appeal and livability signals, not elevator service reputation',
    };
  }

  const readings = occupied.map((unit) => {
    const evaluation = unitEvaluation(state, unit, config);
    const score = roomDesirabilityScore(evaluation, config);
    return { score, evaluation };
  });
  const mean = (key) => Math.round(readings.reduce((sum, reading) => sum + (Number(reading.evaluation[key]) || 0), 0) / readings.length);
  const score = Math.round(readings.reduce((sum, reading) => sum + reading.score, 0) / readings.length);
  const band = score >= 80 ? 'high' : score >= 55 ? 'moderate' : 'low';
  const colorKey = band === 'high' ? 'good' : band === 'moderate' ? 'warn' : 'bad';
  const signed = (value) => (value >= 0 ? '+' : '') + value;
  const servicePenalty = mean('foodPenalty') + mean('parkingPenalty') + mean('medicalPenalty') +
    mean('securityPenalty') + mean('recyclingPenalty');
  return {
    score,
    band,
    colorKey,
    rooms: occupied.length,
    viewBonus: mean('viewBonus'),
    amenityBonus: mean('amenityBonus'),
    layoutBonus: mean('layoutBonus'),
    renovationBonus: mean('renovationBonus'),
    preferencePenalty: mean('preferencePenalty'),
    noisePenalty: mean('noisePenalty'),
    servicePenalty,
    rentAdjustment: mean('rentAdjustment'),
    detail: 'room appeal only: view +' + mean('viewBonus') + ' · amenities +' + mean('amenityBonus') +
      ' · layout +' + mean('layoutBonus') + ' · renovation +' + mean('renovationBonus') +
      ' · floor fit -' + mean('preferencePenalty') + ' · noise -' + mean('noisePenalty') +
      ' · services -' + servicePenalty + ' · rent fit ' + signed(mean('rentAdjustment')) +
      '; excludes elevator wait, walking access, stress, and reputation',
  };
}

/** Keep the latest daily desirability readings bounded for player feedback. */
export function towerDesirabilityHistory(state, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  return (Array.isArray(state?.log) ? state.log : [])
    .map((entry) => ({ day: entry?.day, score: Number(entry?.desirability) }))
    .filter((entry) => Number.isFinite(entry.score))
    .slice(-limit);
}

/** Compress daily desirability into an oldest-to-newest trend cue. */
export function towerDesirabilityTrend(history, maxEntries = 6) {
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({ day: entry?.day, score: Number(entry?.score) }))
    .filter((entry) => Number.isFinite(entry.score))
    .slice(-Math.max(1, Math.floor(maxEntries)));
  if (!entries.length) return { key: 'unknown', value: null, bars: '', label: 'trend —', entries: [] };
  const values = entries.map((entry) => Math.max(0, Math.min(100, entry.score)));
  const value = Math.round(values.at(-1) - values[0]);
  const key = value > 0 ? 'improved' : value < 0 ? 'worsened' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = values.map((score) => levels[Math.round(score / 100 * (levels.length - 1))]).join('');
  return { key, value, bars, label: 'trend ' + bars, entries };
}

/** Format the exact point movement represented by a desirability trend. */
export function towerDesirabilityTrendDeltaLabel(trend) {
  if (trend?.value == null) return 'Δ —';
  return 'Δ ' + (trend.value >= 0 ? '+' : '') + trend.value + ' pts';
}

/** Give daily desirability bars a readable numeric counterpart. */
export function towerDesirabilityHistoryLabel(history, maxEntries = 6) {
  const entries = towerDesirabilityTrend(history, maxEntries).entries;
  return entries.length
    ? entries.map((entry) => 'D' + (entry.day ?? '—') + ' ' + Math.round(Math.max(0, Math.min(100, entry.score))) + '%').join(' · ')
    : 'no daily desirability history yet';
}

/** Keep the latest daily tenant-retention pressure readings bounded. */
export function tenantRetentionHistory(state, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  return (Array.isArray(state?.log) ? state.log : [])
    .map((entry) => {
      const retention = entry?.retention;
      const rooms = Number(retention?.rooms);
      const pressure = Number(retention?.averagePressure);
      return {
        day: entry?.day,
        pressure: Number.isFinite(pressure)
          ? pressure
          : Number.isFinite(Number(retention?.pressureTotal)) && rooms > 0
            ? Number(retention.pressureTotal) / rooms
            : NaN,
        roomsAtRisk: Number(retention?.roomsAtRisk),
      };
    })
    .filter((entry) => Number.isFinite(entry.pressure))
    .slice(-limit);
}

/** Compress daily appeal pressure into an oldest-to-newest recovery cue. */
export function tenantRetentionTrend(history, maxEntries = 6, maxPressure = 4) {
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({ day: entry?.day, pressure: Number(entry?.pressure), roomsAtRisk: entry?.roomsAtRisk }))
    .filter((entry) => Number.isFinite(entry.pressure))
    .slice(-Math.max(1, Math.floor(maxEntries)));
  if (!entries.length) return { key: 'unknown', value: null, bars: '', label: 'trend —', entries: [] };
  const cap = Math.max(0.001, Number(maxPressure) || 4);
  const values = entries.map((entry) => Math.max(0, entry.pressure));
  const value = +(values.at(-1) - values[0]).toFixed(1);
  const key = value > 0 ? 'rising' : value < 0 ? 'recovering' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = values.map((pressure) => levels[Math.round(clamp(pressure / cap) * (levels.length - 1))]).join('');
  return { key, value, bars, label: 'trend ' + bars, entries };
}

/** Format the exact movement represented by a retention-pressure trend. */
export function tenantRetentionTrendDeltaLabel(trend) {
  if (trend?.value == null) return 'Δ —';
  return 'Δ ' + (trend.value >= 0 ? '+' : '') + trend.value.toFixed(1) + ' pressure';
}

/** Give daily appeal-pressure history a readable numeric counterpart. */
export function tenantRetentionHistoryLabel(history, maxEntries = 6) {
  const entries = tenantRetentionTrend(history, maxEntries).entries;
  return entries.length
    ? entries.map((entry) => 'D' + (entry.day ?? '—') + ' ' + entry.pressure.toFixed(1)).join(' · ')
    : 'no daily retention history yet';
}

/** Explain which vacancy gate is currently stopping a replacement tenant. */
export function leaseStatus(state, unit, config, reputation = null) {
  const evaluation = unitEvaluation(state, unit, config);
  const rep = reputation ?? state.log.at(-1)?.rep ?? 100;
  const minDays = relistDaysFor(state, unit, config, rep);
  if ((unit.vacantDays ?? 0) < minDays) {
    return { key: 'market_delay', label: 'new vacancy', evaluation: evaluation.score, minDays };
  }
  if (evaluation.score < config.evaluation.relistMinScore) {
    return { key: 'evaluation', label: 'needs improvement', evaluation: evaluation.score, minDays };
  }
  if (rep < config.occupancy.relistMinDeliveryRate) {
    return { key: 'reputation', label: 'reputation gate', evaluation: evaluation.score, minDays };
  }
  return { key: 'ready', label: 'ready to lease', evaluation: evaluation.score, minDays };
}
