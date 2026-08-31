/** Food/parking/medical/security/recycling coverage, and shop foot-traffic. */
import { buildableFloors, freeSlot, isBuildableFloor, lowestFloor } from '../state.js';
import { shopsForOffice } from '../demand.js';
import { deliveryReliability, unitEvaluation } from './room.js';
import { formatCost } from './transport.js';
import { tenantPlacementFloorPreview } from './mixAndPlacement.js';

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
  if (!isBuildableFloor(state, placementFloor, config)) {
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
  if (!isBuildableFloor(state, targetFloor, config)) {
    return { key: 'unavailable', kind, targetFloor, coverageFloors, reason: 'affected room is not on an upper floor' };
  }

  const candidates = [];
  const low = Math.max(lowestFloor(state), targetFloor - coverageFloors);
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
  const candidates = buildableFloors(state, config)
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
