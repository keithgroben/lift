/** Who moves in and out: demand scoring, vacancy ranking, re-lease and recovery flows. */
import { unlocked } from '../state.js';
import { rentForLevel } from '../pricing.js';
import { formatCost, tenantTransportForecastSignal } from './transport.js';
import { conversionPreview, mixBalance, tenantMixDemand, tenantPlacementMixPreview } from './mixAndPlacement.js';
import { leaseStatus, recoveryGateSummary, roomDesirabilityScore, tenantCapacity, tenantLoadSummary, unitEvaluation } from './room.js';
import { shopTrafficEstimate } from './serviceCoverage.js';
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

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
    // Two different questions, and they had been collapsed into one.
    //
    // `relistMinScore` asks "has this room got better?" — it exists to stop a
    // failed room being re-let unimproved, and it is measured against a room
    // that has already driven a tenant out.
    //
    // A brand-new room has failed at nothing. What it has to prove is that
    // somebody can REACH it: a room with no transport scores 0 and is refused
    // by any positive bar, which is the rule that matters ("no elevator, so
    // nobody moves in"). Holding it to the re-let bar as well made the core
    // loop impossible — a new first-floor office with a shaft and a car scored
    // 47 against a gate of 55, so no room built anywhere could ever be let.
    evaluation.score >= (unit.everLet ? config.evaluation.relistMinScore : config.occupancy.firstLetMinScore) &&
    unit.vacantDays >= relistDaysFor(state, unit, config, rep))
    .sort((a, b) => (b.evaluation.score + b.marketDemandBonus + b.experienceDemand.bonus) -
      (a.evaluation.score + a.marketDemandBonus + a.experienceDemand.bonus)
      || b.evaluation.score - a.evaluation.score
      || (b.unit.vacantDays ?? 0) - (a.unit.vacantDays ?? 0)
      || a.unit.id - b.unit.id);
  const occupiedHeads = state.units.reduce((sum, unit) => sum + (unit.occupied ? (unit.heads ?? 0) : 0), 0);
  const baseCapacity = Number(config.occupancy.moveInCapacity) || 0;
  const growthCapacity = occupiedHeads * (Number(config.occupancy.moveInCapacityGrowthRate) || 0);
  // Boom-bust dampers. With the knobs at their defaults (fullFlow == the gate,
  // cap 0) this reduces to the historical binary gate exactly.
  const gateFloor = Number(config.occupancy.relistMinDeliveryRate) || 0;
  const fullFlow = Number(config.occupancy.moveInFullFlowRate) || 0;
  const flowFactor = !gateOpen ? 0
    : fullFlow > gateFloor
      ? Math.max(0, Math.min(1, (rep - gateFloor) / (fullFlow - gateFloor)))
      : 1;
  const capacityCap = Math.max(0, Math.floor(Number(config.occupancy.moveInCapacityMax) || 0));
  const uncapped = Math.max(0, Math.floor((baseCapacity + growthCapacity) * flowFactor));
  const capacity = gateOpen
    ? (capacityCap > 0 ? Math.min(uncapped, capacityCap) : uncapped)
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
    flowFactor: +flowFactor.toFixed(3),
    reputation: rep,
    transportAccess,
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

export function dailyIncomeBreakdown(state, unit, config, reputation = null) {
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
