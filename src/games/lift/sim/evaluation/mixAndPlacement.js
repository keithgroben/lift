/** Tenant mix targets and "what if I build/convert here" placement previews. */
import { buildableFloors, freeSlot, isBuildableFloor, slotsUsed, unlocked } from '../state.js';
import { dailyIncomeBreakdown, marketDemandBonus, tenantDemandQuality } from './leasing.js';
import { tenantCapacity, unitEvaluation } from './room.js';
import { clearRouteColumn, formatCost } from './transport.js';
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

export function mixBalance(entries) {
  const distance = entries.reduce((sum, entry) => sum + Math.abs(entry.share - entry.targetShare), 0);
  return Math.round(clamp(1 - distance / 2) * 100);
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
  return buildableFloors(state, config)
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
  if (!isBuildableFloor(state, floor, config)) {
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
  const alternatives = buildableFloors(state, config)
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
  return buildableFloors(state, config)
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
  return buildableFloors(state, config)
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
    if (!isBuildableFloor(state, floor, config)) {
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
