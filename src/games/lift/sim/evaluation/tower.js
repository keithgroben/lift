/** Tower-wide desirability rollups and the top-level next-goal function. */
import { unlocked } from '../state.js';
import { buildOccupiedFloorIndex, roomDesirabilityScore, unitEvaluation } from './room.js';
import { servicePlacementRecommendation } from './serviceCoverage.js';

export function averageEvaluation(state, config) {
  const occupied = state.units.filter((u) => u.occupied);
  if (!occupied.length) return 0;
  const floorIndex = buildOccupiedFloorIndex(state);
  return Math.round(occupied.reduce((sum, u) => sum + unitEvaluation(state, u, config, floorIndex).score, 0) / occupied.length);
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

  const floorIndex = buildOccupiedFloorIndex(state);
  const readings = occupied.map((unit) => {
    const evaluation = unitEvaluation(state, unit, config, floorIndex);
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
