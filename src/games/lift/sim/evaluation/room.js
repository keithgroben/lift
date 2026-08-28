/** Per-room evaluation: score, retention/churn risk, utilization, hotel occupancy. */
import { foodCoverage, medicalCoverage, parkingCoverage, recyclingCoverage, securityCoverage } from '../services.js';
import { escalatorAccessSeconds, lobbyAccessDistance, servingEscalators, servingStairs, stairAccessSeconds } from '../demand.js';
import { indicatorColorKey, waitingPressureSummary } from './transport.js';
import { relistDaysFor } from './leasing.js';
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

/**
 * Return a room score plus the components that explain it to the player.
 * `floorIndex` is an optional pre-built `buildOccupiedFloorIndex(state)`
 * result — pass one in when evaluating many rooms in the same pass (a render
 * frame, a tower-wide rollup) so the noise/layout checks below don't each
 * re-scan every unit in the tower.
 */
export function unitEvaluation(state, unit, config, floorIndex = null) {
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
  const layoutBonus = unitLayoutBonus(state, unit, config, floorIndex);
  const stressRatio = clamp(unit.stress / tune.vacateAt);
  const stressPenalty = stressRatio * config.evaluation.stressWeight;
  const noise = unitNoise(state, unit, config, floorIndex);
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

/**
 * Bucket occupied units by floor. Noise and layout checks only ever look at a
 * room's own floor and its immediate neighbors, so building this once per
 * batch (one render frame, one tower-wide rollup) and passing it to
 * `unitEvaluation` turns an O(units^2) sweep into O(units).
 */
export function buildOccupiedFloorIndex(state) {
  const index = new Map();
  for (const unit of state.units) {
    if (!unit.occupied) continue;
    const bucket = index.get(unit.floor);
    if (bucket) bucket.push(unit);
    else index.set(unit.floor, [unit]);
  }
  return index;
}

/**
 * Occupied units make noise. Shared-wall neighbors get the full source noise;
 * the unit directly above or below gets the configured, smaller fraction.
 * Keeping this geometric and local makes floor layout a deliberate choice.
 */
export function unitNoise(state, unit, config, floorIndex = null) {
  const radius = config.evaluation.noiseRadiusSlots ?? 1;
  const verticalWeight = config.evaluation.verticalNoiseWeight ?? 0;
  const index = floorIndex ?? buildOccupiedFloorIndex(state);
  let noise = 0;
  for (const other of index.get(unit.floor) ?? []) {
    if (other.id === unit.id) continue;
    const source = config.units[other.kind] || config.units.office;
    const sourceNoise = source.noise ?? 0;
    if (!sourceNoise) continue;
    const slots = Math.abs(other.slot - unit.slot);
    if (slots > 0 && slots <= radius) noise += sourceNoise / slots;
  }
  for (const floor of [unit.floor - 1, unit.floor + 1]) {
    for (const other of index.get(floor) ?? []) {
      if (other.slot !== unit.slot) continue;
      const source = config.units[other.kind] || config.units.office;
      const sourceNoise = source.noise ?? 0;
      if (sourceNoise) noise += sourceNoise * verticalWeight;
    }
  }
  return +noise.toFixed(2);
}

/** Mixed-use neighbors make a floor feel active; one nearby different type is enough. */
export function unitLayoutBonus(state, unit, config, floorIndex = null) {
  const radius = config.evaluation.layoutRadiusSlots ?? 0;
  const index = floorIndex ?? buildOccupiedFloorIndex(state);
  const mixedNeighbor = (index.get(unit.floor) ?? []).some((other) =>
    other.id !== unit.id && other.kind !== unit.kind && Math.abs(other.slot - unit.slot) <= radius
  );
  return mixedNeighbor ? (config.evaluation.layoutBonus ?? 0) : 0;
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

export function tenantCapacity(unit, config) {
  const tune = config.units[unit.kind] || {};
  return tune.workers ?? tune.residents ?? tune.staff ?? tune.guests ?? unit.heads ?? 0;
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

export function recoveryGateSummary(state, unit, config, reputation) {
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

export function deliveryReliability(state, config, reputation = null) {
  if (Number.isFinite(Number(reputation))) return clamp(Number(reputation) / 100);
  const windowSize = Math.max(1, Math.floor(config.occupancy.reputationWindow ?? 1));
  const readings = (state.log ?? []).slice(-windowSize)
    .map((day) => Number(day.deliveryRate ?? day.rep))
    .filter(Number.isFinite);
  if (state.today?.trips) readings.push((state.today.delivered / state.today.trips) * 100);
  if (!readings.length) return 1;
  return clamp(readings.reduce((sum, reading) => sum + reading, 0) / readings.length / 100);
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

function nearestShaft(state, unit) {
  let best = null;
  for (const shaft of state.shafts) {
    if (unit.floor < shaft.bottom || unit.floor > shaft.top) continue;
    // An express shuttle skips every floor between its ends — it is only
    // "access" for a room standing exactly at one of them (the sky lobby).
    if (shaft.kind === 'express' && unit.floor !== shaft.bottom && unit.floor !== shaft.top) continue;
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
