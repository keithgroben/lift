import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { tenantUtilizationManagementHint } from '../src/games/lift/sim/evaluation.js';
import { vacancyPreFillConfirmationLines, vacancyPreFillOverrideGuidance } from '../src/games/lift/sim/evaluation.js';
import { vacancyPreFillResultHistoryLines } from '../src/games/lift/sim/evaluation.js';
import { firstSessionPressureWarning } from '../src/games/lift/sim/evaluation.js';
import { firstSessionRecoveryReadings } from '../src/games/lift/sim/evaluation.js';
import { firstSessionRecoveryEvidence } from '../src/games/lift/sim/evaluation.js';
import { postBetaManagementGoal } from '../src/games/lift/sim/evaluation.js';
import { tenantPlacementServiceNeeds } from '../src/games/lift/sim/evaluation.js';
import { condoTransportPreview } from '../src/games/lift/sim/evaluation.js';
import { averageEvaluation, boundedEvaluationTrend, evaluationDrift, firstWavePressure, floorDiagnosisAgeCue, floorDiagnosisChange, floorDiagnosisNextAction, floorDiagnosisRepeatedFailure, floorDiagnosisWorkingState, floorHandoffPreview, floorOperationsSummary, indicatorColorKey, leasingForecast, rememberFloorDiagnosisResult, rememberRoomHealthHistory, rememberVacancyAppealFollowupHistory, rememberVacancyPreFillResultHistory, vacancyPreFillChoiceSignal, vacancyPreFillOutcomeSignal, vacancyPreFillOverrideComponent, vacancyPreFillOverrideSignal, vacancyPreFillRankingLabel, vacancyPreFillResultHistoryLabel, roomHealthHistoryAction, roomHealthHistoryAgeLabel, roomHealthHistoryChange, roomHealthHistoryPriority, roomHealthHistoryStatus, roomHealthHistoryUrgency, roomEvaluationResponse, routePlacementStatus, shaftBuildControlStatus, shaftCapacityProjection, shaftCandidateCoverageLabel, shaftPlacementProjection, shaftQueueReliefProjection, shaftQueueReliefRecommendation, shaftRouteCoverageLabel, sustainedLowEvaluation, tenantAccessOutcomeForUnit, tenantDemandQuality, tenantDemandForecast, tenantFloorMix, tenantLeasingHistory, tenantLoadStatus, tenantLoadSummary, tenantRetentionPressure, tenantTransportForecastHistory, tenantTransportForecastSignal, tenantTransportForecastTrend, tenantUtilizationRecoveryResult, tenantUtilizationRecoverySummary, tenantUtilizationRoomContext, tenantPlacementAlternativeReason, tenantPlacementComparisonChoice, tenantPlacementDecision, tenantPlacementDecisionReason, tenantPlacementFloorComparison, tenantPlacementFloorPreview, tenantPlacementInvestmentPreview, tenantPlacementInvestmentReason, tenantPlacementMixPreview, tenantPlacementPreview, tenantPlacementRankingReason, tenantPlacementReplacementPreviews, tenantPlacementSmallestInvestment, tenantUtilizationDelta, tenantUtilizationHistoryLabel, tenantUtilizationHintFocusLabel, tenantUtilizationTrend, transportCoverageText, unitEvaluation, vacancyAppealFollowupResult, vacancyAppealFactorValue, vacancyDemandSummary, vacancyPreFillGuidance, vacancyPreFillOutcome, vacancyPreFillResult, vacancyRankingAccessSummary, vacancyRankingGuidance, vacancyRankingReason, vacancyRankingSignalSummary, vacancyAppealChangeAction } from '../src/games/lift/sim/evaluation.js';
import { dayClose } from '../src/games/lift/sim/economy.js';
import { shaftQueueTrend } from '../src/games/lift/sim/evaluation.js';
import { shaftQueueForecastContext } from '../src/games/lift/sim/evaluation.js';
import { queueDailyServiceSummary } from '../src/games/lift/sim/evaluation.js';
import { shaftQueueDailyTrend } from '../src/games/lift/sim/evaluation.js';
import { shaftQueueDailyPressure } from '../src/games/lift/sim/evaluation.js';
import { localRouteDailyTrend } from '../src/games/lift/sim/evaluation.js';
import { localRouteDailyPressure } from '../src/games/lift/sim/evaluation.js';
import { localOverflowDailyTrend, localOverflowDailyPressure, localOverflowRouteHistory, localOverflowInterventionResult, localOverflowInterventionComparison, localOverflowInterventionHistorySummary, localOverflowInterventionNextAction, localOverflowInterventionTenantResult, rememberLocalOverflowInterventionHistory } from '../src/games/lift/sim/evaluation.js';
import { tenantLoadColorMeaning, waitingPressureColorMeaning } from '../src/games/lift/sim/evaluation.js';
import { towerDesirabilitySummary } from '../src/games/lift/sim/evaluation.js';
import { towerDesirabilityHistory, towerDesirabilityHistoryLabel, towerDesirabilityTrend, towerDesirabilityTrendDeltaLabel } from '../src/games/lift/sim/evaluation.js';
import { tenantRetentionHistory, tenantRetentionHistoryLabel, tenantRetentionTrend, tenantRetentionTrendDeltaLabel } from '../src/games/lift/sim/evaluation.js';
import { cashRunwaySummary, expansionSafetySummary, serviceCoverageChange, serviceCoverageSummary, servicePlacementBudgetImpact, servicePlacementComparison, servicePlacementCoveragePreview, servicePlacementRecommendation, tenantRetentionRecommendation } from '../src/games/lift/sim/evaluation.js';
import { transportResponseRecommendation, unassignedQueueResponse } from '../src/games/lift/sim/evaluation.js';
import { transportInvestmentChoices } from '../src/games/lift/sim/evaluation.js';
import { shaftCoverageDemandComparison } from '../src/games/lift/sim/evaluation.js';
import { shaftInvestmentComparison } from '../src/games/lift/sim/evaluation.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

/**
 * Floors are a purchase now (`building.startFloors: 0` — a new session opens
 * on bare ground), so a fixture that needs a standing tower buys its storeys
 * through the same action seam the player uses.
 */
const withFloors = (state, config, floors = 4) => {
  for (let i = 0; i < floors; i++) {
    const built = applyAction(state, { type: 'build_floor' }, config);
    if (!built.ok) throw new Error('fixture could not build a floor: ' + built.reason);
  }
  return state;
};

export const tests = {
  'cash runway summarizes recent closed-day net'() {
    const positive = cashRunwaySummary({ money: 900, log: [
      { rent: 300, shopRevenue: 0, upkeep: 180, spent: 5000 },
      { rent: 300, shopRevenue: 30, upkeep: 0, spent: 1000 },
    ] });
    const warning = cashRunwaySummary({ money: 500, log: [
      { rent: 0, shopRevenue: 0, upkeep: 100 },
      { rent: 0, shopRevenue: 0, upkeep: 150 },
    ] });
    const empty = cashRunwaySummary({ money: 500, log: [] });
    assert(positive.key === 'positive' && positive.averageNet === 225 && positive.days == null && positive.label.includes('operating cash flow +225/day'),
      'cash runway did not report positive recent net');
    assert(warning.key === 'watch' && warning.averageNet === -125 && warning.days === 4 && warning.label.includes('about 4 days'),
      'cash runway did not report a negative recent net window');
    assert(empty.key === 'unknown' && empty.days == null,
      'cash runway should remain unknown before a closed-day budget');
  },

  'expansion safety warns without blocking a risky build'() {
    const state = {
      money: 5000,
      log: [{ rent: 0, shopRevenue: 0, upkeep: 100 }],
    };
    const unknown = expansionSafetySummary({ money: 5000, log: [] }, 1200);
    const watch = expansionSafetySummary(state, 1200);
    const critical = expansionSafetySummary(state, 4700);
    const positive = expansionSafetySummary({ money: 5000, log: [{ rent: 300, shopRevenue: 0, upkeep: 100 }] }, 1200);
    assert(unknown.key === 'unknown' && unknown.label.includes('first day closes') &&
      watch.key === 'watch' && watch.days === 38 && watch.label.includes('expansion watch') &&
      critical.key === 'critical' && critical.days === 3 && critical.label.includes('expansion warning') &&
      positive.key === 'positive' && positive.averageNet === 200 &&
      state.money === 5000 && state.log.length === 1,
      'expansion safety did not explain runway risk without mutating or blocking the build');
  },

  'tower desirability summarizes appeal separately from transport reputation'() {
    const state = {
      floors: 4,
      units: [{ id: 1, kind: 'office', floor: 1, slot: 1, heads: 6, occupied: true, stress: 0, rent: CONFIG.units.office.rent }],
      facilities: [], shafts: [], stairs: [], escalators: [], lobby: null, people: [], log: [],
    };
    const clear = towerDesirabilitySummary(state, CONFIG);
    state.units[0].stress = CONFIG.units.office.vacateAt;
    const stressed = towerDesirabilitySummary(state, CONFIG);
    assert(clear.rooms === 1 && clear.score != null && clear.score >= 0 && clear.score <= 100 &&
      clear.detail.includes('room appeal only') && clear.detail.includes('elevator wait') &&
      clear.score === stressed.score,
      'tower desirability did not remain a separate, explainable appeal signal');
  },

  'tower desirability history stays bounded and readable'() {
    const state = { log: [
      { day: 1, desirability: 42 },
      { day: 2, desirability: 48 },
      { day: 3, desirability: 51 },
    ] };
    const history = towerDesirabilityHistory(state, 2);
    const trend = towerDesirabilityTrend(history);
    assert(history.length === 2 && history[0].day === 2 && trend.key === 'improved' && trend.value === 3 &&
      towerDesirabilityTrendDeltaLabel(trend) === 'Δ +3 pts' &&
      towerDesirabilityHistoryLabel(history).includes('D2 48%') && towerDesirabilityHistoryLabel(history).includes('D3 51%'),
      'tower desirability history did not stay bounded or readable');
  },

  'tower desirability nudges tenant demand within a small bound'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = {
      floors: 4,
      units: [
        { id: 1, kind: 'office', floor: 1, slot: 1, heads: 6, occupied: true, stress: 0, rent: config.units.office.rent },
        { id: 2, kind: 'office', floor: 1, slot: 2, heads: 0, occupied: false, stress: 0, rent: config.units.office.rent },
      ],
      facilities: [], shafts: [], stairs: [], escalators: [], lobby: null, people: [], log: [],
    };
    const low = tenantDemandQuality(state, state.units[1], config);
    state.facilities = [
      { kind: 'food', floor: 1, slot: 3 },
      { kind: 'parking', floor: 1, slot: 4 },
      { kind: 'security', floor: 1, slot: 5 },
      { kind: 'recycling', floor: 1, slot: 6 },
    ];
    const high = tenantDemandQuality(state, state.units[1], config);
    assert(high.desirabilityScore > low.desirabilityScore && high.desirabilityBonus > low.desirabilityBonus &&
      low.desirabilityBonus >= -config.occupancy.desirabilityDemandWeight &&
      high.desirabilityBonus <= config.occupancy.desirabilityDemandWeight &&
      high.label.includes('room desirability') && high.label.includes('appeal'),
      'desirability did not add a bounded, visible tenant-demand modifier');
  },

  'room appeal retention pressure is bounded and recoverable'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = {
      floors: 4,
      units: [{ id: 1, kind: 'office', floor: 3, slot: 1, heads: 6, occupied: true, stress: 0, rent: config.units.office.rent }],
      facilities: [],
      shafts: [{ id: 10, bottom: 0, top: 3, slot: 0, cars: [] }],
      stairs: [], escalators: [], lobby: null, people: [], log: [],
    };
    const low = tenantRetentionPressure(state, state.units[0], config);
    state.units[0].desirabilityPressure = low.nextPressure;
    state.facilities = [
      { kind: 'food', floor: 3, slot: 2 },
      { kind: 'parking', floor: 3, slot: 3 },
      { kind: 'security', floor: 3, slot: 4 },
      { kind: 'recycling', floor: 3, slot: 5 },
    ];
    const improved = tenantRetentionPressure(state, state.units[0], config);
    assert(low.score < low.threshold && low.dailyPressure > 0 && low.nextPressure <= low.vacateAt &&
      improved.score > low.score && improved.dailyPressure === 0 && improved.nextPressure < low.nextPressure,
      'room appeal retention pressure was not bounded or recoverable');
  },

  'rising appeal pressure recommends the largest room improvement'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = {
      floors: 4,
      units: [{ id: 1, kind: 'office', floor: 3, slot: 1, heads: 6, occupied: true, stress: 0, desirabilityPressure: 0.8, rent: config.units.office.rent }],
      facilities: [],
      shafts: [{ id: 10, bottom: 0, top: 3, slot: 0, cars: [] }],
      stairs: [], escalators: [], lobby: null, people: [], log: [],
    };
    const recommendation = tenantRetentionRecommendation(state, state.units[0], config);
    assert(recommendation.key === 'service' && recommendation.kind === 'food' &&
      recommendation.label === 'add food service' && recommendation.detail.includes('food coverage') &&
      recommendation.detail.includes('pressure is 0.8/4'),
      'rising appeal pressure did not recommend the largest room improvement');
  },

  'service guidance chooses the open floor with the strongest nearby coverage'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = {
      floors: 4,
      units: [
        { id: 1, kind: 'office', floor: 3, slot: 1, heads: 6, occupied: true, stress: 0, rent: config.units.office.rent },
        { id: 2, kind: 'office', floor: 1, slot: 1, heads: 6, occupied: true, stress: 0, rent: config.units.office.rent },
      ],
      facilities: [],
      shafts: [{ id: 10, bottom: 0, top: 3, slot: 0, cars: [] }],
      stairs: [], escalators: [], lobby: null, people: [], log: [],
    };
    const recommendation = servicePlacementRecommendation(state, state.units[0], 'food', config);
    const coverage = servicePlacementCoveragePreview(state, 'food', recommendation.floor, config);
    const alternateCoverage = servicePlacementCoveragePreview(state, 'food', 3, config);
    const beforeSummary = serviceCoverageSummary(state, 'food', config);
    state.facilities = [{ kind: 'food', floor: recommendation.floor, slot: coverage.slot }];
    const afterSummary = serviceCoverageSummary(state, 'food', config);
    const partial = serviceCoverageChange({ available: true, requiredRooms: 3, beforeRooms: 1, afterRooms: 2, roomsDelta: 1, headsDelta: 6 });
    const flat = serviceCoverageChange({ available: true, requiredRooms: 3, beforeRooms: 2, afterRooms: 2, roomsDelta: 0, headsDelta: 0 });
    const budgetImpact = servicePlacementBudgetImpact({ log: [{ net: 40000 }] }, 'food', config);
    assert(recommendation.key === 'ready' && recommendation.floor === 2 &&
      recommendation.targetCovered && recommendation.coveredRooms === 2 &&
      recommendation.coveredHeads === 12 && recommendation.beforeRooms === 0 &&
      recommendation.beforeHeads === 0 && recommendation.detail.includes('F2') &&
      recommendation.detail.includes('0/2 covered') && recommendation.detail.includes('2 remain') &&
      recommendation.detail.includes('reaches 2/2') && coverage.available &&
      coverage.beforeRooms === 0 && coverage.afterRooms === 2 && coverage.roomsDelta === 2 &&
      coverage.beforeHeads === 0 && coverage.afterHeads === 12 && coverage.headsDelta === 12 &&
      servicePlacementComparison(alternateCoverage, coverage).key === 'worse' &&
      servicePlacementComparison(alternateCoverage, coverage).label.includes('vs recommended F2') &&
      budgetImpact.dailyUpkeep === 4500 && budgetImpact.beforeNet === 40000 && budgetImpact.afterNet === 35500 && budgetImpact.delta === -4500 &&
      beforeSummary.coveredRooms === 0 && afterSummary.coveredRooms === 2 && afterSummary.coveredHeads === 12 &&
      serviceCoverageChange(coverage).key === 'strong' && partial.key === 'partial' && flat.key === 'flat',
      'service guidance did not choose the strongest open nearby floor');
  },

  'retention pressure history stays bounded and directional'() {
    const state = { log: [
      { day: 1, retention: { rooms: 2, averagePressure: 1.1, roomsAtRisk: 2 } },
      { day: 2, retention: { rooms: 2, averagePressure: 0.8, roomsAtRisk: 2 } },
      { day: 3, retention: { rooms: 2, averagePressure: 0.7, roomsAtRisk: 1 } },
    ] };
    const history = tenantRetentionHistory(state, 2);
    const trend = tenantRetentionTrend(history);
    assert(history.length === 2 && history[0].day === 2 && trend.key === 'recovering' && trend.value === -0.1 &&
      tenantRetentionTrendDeltaLabel(trend) === 'Δ -0.1 pressure' &&
      tenantRetentionHistoryLabel(history).includes('D2 0.8') && tenantRetentionHistoryLabel(history).includes('D3 0.7'),
      'retention pressure history did not stay bounded or directional');
  },

  'room desirability breaks an otherwise tied vacancy ranking within its bound'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = {
      floors: 4,
      units: [
        { id: 1, kind: 'office', floor: 1, slot: 1, heads: 0, occupied: false, stress: 0, rent: config.units.office.rent, vacantDays: 2 },
        // Controlled tie: the higher-floor room's appeal is offset by a small
        // existing stress reading, leaving room evaluation equal.
        { id: 2, kind: 'office', floor: 3, slot: 1, heads: 0, occupied: false, stress: 7, rent: config.units.office.rent, vacantDays: 2 },
      ],
      facilities: [],
      shafts: [{ id: 10, bottom: 0, top: 3, slot: 0, cars: [] }],
      stairs: [], escalators: [], lobby: null, people: [], log: [],
    };
    const lowEvaluation = unitEvaluation(state, state.units[0], config);
    const highEvaluation = unitEvaluation(state, state.units[1], config);
    const low = tenantDemandQuality(state, state.units[0], config);
    const high = tenantDemandQuality(state, state.units[1], config);
    const forecast = leasingForecast(state, config, 100);
    assert(lowEvaluation.score === highEvaluation.score && low.score === high.score &&
      forecast.marketCandidates[0].marketDemandBonus === forecast.marketCandidates[1].marketDemandBonus &&
      low.bonus !== high.bonus &&
      high.desirabilityScore > low.desirabilityScore &&
      high.desirabilityBonus > low.desirabilityBonus &&
      high.desirabilityBonus <= config.occupancy.desirabilityDemandWeight &&
      forecast.marketCandidates[0].unit.id === state.units[1].id &&
      vacancyRankingReason(forecast).includes('ranking decided by room desirability') &&
      vacancyRankingReason(forecast).includes('equal room quality, access/services, and tenant-mix demand'),
      'room desirability did not break the tied vacancy ranking');
  },

  'W/T color meanings explain the indicator bands'() {
    assert(waitingPressureColorMeaning('clear').includes('green') &&
      waitingPressureColorMeaning('busy').includes('amber') &&
      waitingPressureColorMeaning('critical').includes('red') &&
      tenantLoadColorMeaning('full').includes('green') &&
      tenantLoadColorMeaning('partial').includes('amber') &&
      tenantLoadColorMeaning('light').includes('red'),
      'W/T color meanings did not describe each indicator band');
  },

  'tenant placement preview explains capacity and target role'() {
    const office = tenantPlacementPreview('office', CONFIG);
    const condo = tenantPlacementPreview('condo', CONFIG);
    assert(office.capacity === CONFIG.units.office.workers && office.role === 'workers' &&
      office.targetShare === CONFIG.units.office.targetShare && condo.capacity === CONFIG.units.condo.residents &&
      condo.role === 'residents' && condo.targetShare === CONFIG.units.condo.targetShare,
      'tenant placement preview did not expose capacity and target role');
  },

  'tenant placement preview lists the services a condo will need'() {
    const needs = tenantPlacementServiceNeeds('condo', CONFIG);
    assert(needs.map((service) => service.label).join(', ') === 'cafeteria, parking, clinic, security, recycling' &&
      needs.every((service) => service.need > 0),
      'tenant placement preview did not expose condo service obligations');
  },

  'condo placement forecast exposes added resident travel demand'() {
    const preview = condoTransportPreview(CONFIG);
    assert(preview.residents === CONFIG.units.condo.residents &&
      preview.roundTripsPerDay === Math.round(CONFIG.units.condo.residents * CONFIG.demand.condoTripsPerDay) &&
      preview.passengerJourneysPerDay === preview.roundTripsPerDay * 2,
      'condo placement forecast did not expose resident travel demand');
  },

  'floor tenant mix reports actual shares and buildable slots'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 38);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok,
      'could not build floor-mix office');
    assert(applyAction(state, { type: 'build_unit', kind: 'condo', floor: 2 }, config).ok,
      'could not build floor-mix condo');
    const floorOne = tenantFloorMix(state, config).find((floor) => floor.floor === 1);
    const floorTwo = tenantFloorMix(state, config).find((floor) => floor.floor === 2);
    assert(floorOne.totalHeads === config.units.office.workers && floorOne.entries[0].kind === 'office' &&
      floorOne.entries[0].share === 1 && floorOne.entries[0].targetShare === config.units.office.targetShare &&
      floorOne.openSlots === config.building.slotsPerFloor - 1 && floorTwo.entries[0].kind === 'condo',
      'floor tenant mix did not report actual type shares and open slots');
  },

  'placement mix preview projects the selected room after construction'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 39);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'condo', floor: 2 }, config).ok,
      'could not build placement-preview fixture');
    const before = JSON.stringify(state);
    const preview = tenantPlacementMixPreview(state, 'condo', config);
    assert(preview.currentShare === 0.333 && preview.projectedShare === 0.5 &&
      preview.capacity === config.units.condo.residents && JSON.stringify(state) === before,
      'placement mix preview did not project the selected room without changing state');
  },

  'placement mix preview flags a material balance drop'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = boot(config, 40);
    state.units = [
      { kind: 'office', occupied: true, heads: 11 },
      { kind: 'condo', occupied: true, heads: 5 },
      { kind: 'shop', occupied: true, heads: 2 },
      { kind: 'hotel', occupied: true, heads: 2 },
    ];
    const preview = tenantPlacementMixPreview(state, 'office', config);
    assert(preview.balanceBefore - preview.balanceAfter >= config.occupancy.tenantMixPlacementWarningDelta &&
      preview.balanceDelta < 0,
      'placement mix preview did not expose a material balance warning');
  },

  'condo placement forecast combines mixed-use and floor quality'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.stars.tiers[1].pop = 0;
    config.building.startFloors = 6;
    const state = boot(config, 44);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok &&
      applyAction(state, { type: 'build_shaft', bottom: 0, top: 5 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok,
      'could not build condo-placement forecast fixture');
    const before = JSON.stringify(state);
    const mix = tenantPlacementMixPreview(state, 'condo', config);
    const floor = tenantPlacementFloorPreview(state, 'condo', 3, config);
    assert(mix.projectedShare > mix.currentShare && Number.isFinite(mix.balanceAfter) &&
      floor.available && Number.isFinite(floor.evaluation.score) && Number.isFinite(floor.demandQuality.bonus) &&
      JSON.stringify(state) === before,
      'condo placement forecast did not expose mixed-use and floor-quality effects without mutation');
  },

  'floor placement preview combines room evaluation and mix impact'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 41);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok &&
      applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build floor-placement preview route');
    const before = JSON.stringify(state);
    const preview = tenantPlacementFloorPreview(state, 'office', 3, config);
    assert(preview.available && preview.evaluation.score > 0 && preview.evaluation.accessMode === 'elevator' &&
      Number.isFinite(preview.demandQuality.score) && Number.isFinite(preview.demandQuality.bonus) &&
      preview.mix.currentShare === 0 && preview.mix.projectedShare === 1 && JSON.stringify(state) === before,
      'floor placement preview did not combine desirability and tenant-mix impact without mutation');
  },

  'floor placement comparison identifies why another floor is better'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 20;
    const state = boot(config, 42);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok &&
      applyAction(state, { type: 'build_shaft', bottom: 0, top: 19 }, config).ok,
      'could not build floor-comparison route');
    const comparison = tenantPlacementFloorComparison(state, 'office', 1, config);
    assert(comparison.available && comparison.bestFloor === config.units.office.preferredFloor &&
      comparison.scoreDelta > 0 && comparison.bestScore > comparison.evaluation.score,
      'floor placement comparison did not identify the higher-quality alternative');
  },

  'two candidate floors retain independent previews across tenant types'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 20;
    const state = boot(config, 43);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok &&
      applyAction(state, { type: 'build_shaft', bottom: 0, top: 19 }, config).ok,
      'could not build two-floor comparison route');
    const first = tenantPlacementFloorComparison(state, 'office', 1, config);
    const second = tenantPlacementFloorComparison(state, 'office', 3, config);
    const condoFirst = tenantPlacementFloorComparison(state, 'condo', 1, config);
    const condoSecond = tenantPlacementFloorComparison(state, 'condo', 3, config);
    assert(first.available && second.available && first.floor === 1 && second.floor === 3 &&
      first.evaluation.score !== second.evaluation.score && first.mix.projectedShare === 1 &&
      second.mix.projectedShare === 1 && condoFirst.available && condoSecond.available &&
      condoFirst.floor === first.floor && condoSecond.floor === second.floor &&
      condoFirst.evaluation.preferredFloor === config.units.condo.preferredFloor &&
      condoSecond.evaluation.preferredFloor === config.units.condo.preferredFloor &&
      first.mix.targetShare === config.units.office.targetShare &&
      Number.isFinite(first.mix.balanceBefore) && Number.isFinite(first.mix.balanceAfter),
      'two candidate floors did not retain independent previews across tenant types');
  },

  'a selected comparison floor exposes its combined placement signals'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 20;
    const state = boot(config, 46);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok &&
      applyAction(state, { type: 'build_shaft', bottom: 0, top: 19 }, config).ok,
      'could not build single-floor comparison route');
    const preview = tenantPlacementFloorComparison(state, 'office', 3, config);
    const decision = tenantPlacementDecision(preview, config);
    assert(preview.available && decision.key === 'aligned' &&
      Number.isFinite(preview.evaluation.score) && Number.isFinite(preview.mix.projectedShare) &&
      Number.isFinite(preview.mix.balanceAfter),
      'selected comparison floor did not expose quality and mix signals');
  },

  'comparison choices state stronger and weaker candidates'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.evaluation.relistMinScore = 60;
    const makePreview = (floor, score, balanceDelta) => ({
      floor,
      available: true,
      evaluation: { score },
      mix: { balanceDelta },
    });
    const aligned = makePreview(1, 62, 0);
    const tradeoff = makePreview(3, 80, -1);
    const lowerScore = makePreview(2, 61, 0);
    assert(tenantPlacementComparisonChoice(aligned, tradeoff, config).key === 'stronger' &&
      tenantPlacementComparisonChoice(aligned, tradeoff, config).reason === 'quality + mix aligned outranks quality works · mix tradeoff' &&
      tenantPlacementComparisonChoice(tradeoff, aligned, config).detail === '1 decision tier below F1' &&
      tenantPlacementComparisonChoice(aligned, lowerScore, config).reason === '1 eval point higher' &&
      tenantPlacementComparisonChoice(lowerScore, aligned, config).detail === '1 eval point below F1' &&
      tenantPlacementComparisonChoice(aligned, aligned, config).key === 'equal' &&
      tenantPlacementComparisonChoice(aligned, aligned, config).reason === 'no measurable combined advantage',
      'comparison choices did not state the size of the weaker combined candidate gap');
  },

  'candidate decision labels separate quality and mix tradeoffs'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const makePreview = (score, balanceDelta) => ({
      available: true,
      evaluation: { score },
      mix: { balanceDelta },
    });
    assert(tenantPlacementDecision(makePreview(80, 0), config).key === 'aligned' &&
      tenantPlacementDecision(makePreview(80, -1), config).key === 'mix_tradeoff' &&
      tenantPlacementDecision(makePreview(54, 0), config).key === 'quality_warning' &&
      tenantPlacementDecision(makePreview(54, -1), config).key === 'combined_warning' &&
      tenantPlacementDecision({ available: false }, config).key === 'unavailable',
      'candidate decision labels did not distinguish aligned and conflicting signals');
  },

  'placement decision reason calls out a negative mix signal'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const makePreview = (score, balanceDelta) => ({
      available: true,
      evaluation: { score },
      mix: { balanceDelta },
    });
    assert(tenantPlacementDecisionReason(makePreview(80, -3), config) === 'mix tradeoff: balance falls 3 pts' &&
      tenantPlacementDecisionReason(makePreview(54, -2), config) === 'mix + quality warning: balance falls 2 pts' &&
      tenantPlacementDecisionReason(makePreview(54, 0), config) === '' &&
      tenantPlacementDecisionReason(makePreview(80, 0), config) === '',
      'placement hover did not isolate the negative mix signal');
  },

  'placement warning suggests a higher-quality alternative'() {
    assert(tenantPlacementAlternativeReason({ available: true, bestFloor: 2, scoreDelta: 20 }) === 'choose F2 instead for +20 room eval' &&
      tenantPlacementAlternativeReason({
        available: true,
        bestFloor: 2,
        scoreDelta: 20,
        evaluation: { accessSlots: 4, foodCovered: false },
        bestEvaluation: { accessSlots: 2, foodCovered: true },
      }) === 'choose F2 instead for +20 room eval · access improves by 2 slots · services gained: food' &&
      tenantPlacementAlternativeReason({ available: true, bestFloor: 3, scoreDelta: 0 }) === 'no higher room-evaluation alternative' &&
      tenantPlacementAlternativeReason({ available: false, bestFloor: 2, scoreDelta: 20 }) === '',
      'placement warning did not explain the available alternative');
  },

  'placement warning distinguishes floor choice from infrastructure investment'() {
    const readyState = withFloors(boot(CONFIG, 1), CONFIG);
    const lowMoneyState = withFloors(boot(CONFIG, 2), CONFIG);
    lowMoneyState.money = 100000;
    const blockedState = withFloors(boot(CONFIG, 3), CONFIG);
    blockedState.money = 5000000;
    blockedState.units = Array.from({ length: blockedState.floors - 1 }, (_, floorIndex) =>
      Array.from({ length: CONFIG.building.slotsPerFloor }, (_, slot) => ({
        id: floorIndex * CONFIG.building.slotsPerFloor + slot,
        kind: 'office', floor: floorIndex + 1, slot, occupied: true, heads: 6, stress: 0,
      }))
    ).flat();
    const smallest = tenantPlacementSmallestInvestment({
      available: true,
      floor: 3,
      evaluation: { accessPenalty: 9, foodCovered: false, foodPenalty: 12, parkingCovered: false, parkingPenalty: 10 },
    }, readyState, CONFIG);
    assert(tenantPlacementInvestmentReason({
      available: true,
      floor: 3,
      evaluation: {
        accessPenalty: 9,
        foodCovered: false,
        foodPenalty: 12,
        parkingCovered: false,
        parkingPenalty: 10,
        medicalCovered: true,
        medicalPenalty: 0,
      },
      }, readyState, CONFIG) === 'or keep F3 and invest in shaft $126,000 (ready); cafeteria $180,000 (ready); parking $220,000 (ready) · smallest useful: shaft $126,000 (ready)' &&
      tenantPlacementInvestmentReason({
        available: true,
        floor: 3,
        evaluation: { accessPenalty: 9, foodCovered: false, foodPenalty: 12 },
      }, lowMoneyState, CONFIG) === 'or keep F3 and invest in shaft $126,000 (save $26,000 more); cafeteria $180,000 (save $80,000 more) · smallest useful: shaft $126,000 (save $26,000 more)' &&
      tenantPlacementInvestmentReason({
        available: true,
        floor: 3,
        evaluation: { medicalCovered: false, medicalPenalty: 14 },
      }, readyState, CONFIG) === 'or keep F3 and invest in clinic (locked until 60 pop)' &&
      tenantPlacementInvestmentReason({
        available: true,
        floor: 3,
        evaluation: { accessPenalty: 9, foodCovered: false, foodPenalty: 12, parkingCovered: false, parkingPenalty: 10 },
      }, blockedState, CONFIG) === 'or keep F3 and invest in shaft $126,000 (no open covered floor); cafeteria $180,000 (no open covered floor); parking $220,000 (no open covered floor)' &&
      smallest?.kind === 'shaft' && smallest.text === 'shaft $126,000 (ready)' &&
      tenantPlacementInvestmentReason({
        available: true,
        floor: 2,
        evaluation: { accessPenalty: 0, foodCovered: true, foodPenalty: 0 },
      }, boot(CONFIG, 2), CONFIG) === '' &&
      tenantPlacementInvestmentReason({ available: false, floor: 3, evaluation: { accessPenalty: 9 } }, boot(CONFIG, 3), CONFIG) === '',
      'placement warning did not distinguish floor choice from investment');
  },

  'placement investment preview reports the expected room-evaluation gain'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const routedState = boot(config, 47);
    assert(applyAction(routedState, { type: 'build_lobby', slot: 0 }, config).ok &&
      applyAction(routedState, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build infrastructure-preview route');
    const beforeRouted = JSON.stringify(routedState);
    const foodTarget = tenantPlacementFloorPreview(routedState, 'office', 3, config);
    const foodPreview = tenantPlacementInvestmentPreview(foodTarget, { tool: 'food', floor: 3 }, routedState, config, 3);
    const afterFoodForecast = JSON.stringify(routedState);
    assert(applyAction(routedState, { type: 'build_facility', kind: 'food', floor: 3 }, config).ok,
      'could not place the forecast cafeteria');
    const foodOutcome = unitEvaluation(routedState, {
      id: -1, kind: 'office', floor: foodTarget.floor, slot: foodPreview.roomSlot,
      heads: config.units.office.workers, occupied: true, stress: 0, rent: config.units.office.rent,
    }, config);

    const noRouteState = boot(config, 48);
    assert(applyAction(noRouteState, { type: 'build_lobby', slot: 0 }, config).ok,
      'could not build infrastructure-preview lobby');
    const beforeNoRoute = JSON.stringify(noRouteState);
    const shaftTarget = tenantPlacementFloorPreview(noRouteState, 'office', 3, config);
    const shaftPreview = tenantPlacementInvestmentPreview(shaftTarget, { tool: 'shaft', floor: 3 }, noRouteState, config, 3);
    const afterShaftForecast = JSON.stringify(noRouteState);
    assert(applyAction(noRouteState, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not place the forecast shaft');
    const shaftOutcome = unitEvaluation(noRouteState, {
      id: -1, kind: 'office', floor: shaftTarget.floor, slot: shaftPreview.roomSlot,
      heads: config.units.office.workers, occupied: true, stress: 0, rent: config.units.office.rent,
    }, config);

    assert(foodPreview.available && foodPreview.before.score === foodTarget.evaluation.score &&
      foodPreview.after.score > foodPreview.before.score && foodPreview.scoreDelta > 0 &&
      foodPreview.demandAfter.score > foodPreview.demandBefore.score && foodPreview.demandBonusDelta > 0 &&
      foodPreview.impacts.some(({ key, delta }) => key === 'food' && delta > 0) &&
      foodPreview.impacts.some(({ key, delta }) => key === 'amenity' && delta > 0) &&
      foodOutcome.score === foodPreview.after.score &&
      afterFoodForecast === beforeRouted &&
      shaftPreview.available && shaftPreview.after.score > shaftPreview.before.score &&
      shaftPreview.demandAfter.score > shaftPreview.demandBefore.score && shaftPreview.demandBonusDelta > 0 &&
      shaftPreview.impacts.some(({ key, delta }) => key === 'access' && delta > 0) &&
      shaftOutcome.score === shaftPreview.after.score &&
      afterShaftForecast === beforeNoRoute,
      'placement investment preview did not report a useful non-mutating evaluation gain');
  },

  'occupied room evaluation exposes first-day stress drift'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 49);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build first-day evaluation fixture');
    const occupied = unitEvaluation(state, state.units[0], config);
    state.units[0].stress = config.units.office.vacateAt * 0.2;
    const firstDay = unitEvaluation(state, state.units[0], config);
    const drift = evaluationDrift(occupied, firstDay);
    assert(firstDay.score < occupied.score && firstDay.stress > occupied.stress &&
      firstDay.score - occupied.score === -Math.round(config.evaluation.stressWeight * 0.2) &&
      drift.some(({ label, delta }) => label === 'stress' && delta < 0),
      'first-day tenant stress did not produce a measurable evaluation drift');
  },

  'room evaluation trend stays bounded to the latest days'() {
    const readings = [
      { day: 1, score: 70, stress: 0, occupied: true },
      { day: 2, score: 68, stress: 2, occupied: true },
      { day: 3, score: 64, stress: 5, occupied: true },
      { day: 4, score: 61, stress: 8, occupied: true },
    ];
    const trend = boundedEvaluationTrend(readings, 3);
    assert(trend.length === 3 && trend[0].day === 2 && trend[2].score === 61 &&
      readings.length === 4 && trend !== readings,
      'room evaluation trend did not keep a bounded latest-day window');
  },

  'sustained low evaluation needs repeated occupied readings'() {
    const threshold = CONFIG.evaluation.relistMinScore;
    assert(!sustainedLowEvaluation([{ score: threshold - 4, occupied: true }], threshold).sustained &&
      !sustainedLowEvaluation([{ score: threshold - 4 }, { score: threshold + 2 }], threshold).sustained &&
      sustainedLowEvaluation([{ score: threshold - 4 }, { score: threshold - 8 }], threshold).sustained &&
      sustainedLowEvaluation([{ score: threshold - 8, occupied: false }, { score: threshold - 4, occupied: true }], threshold).readings === 1,
      'sustained low evaluation warned on an isolated or vacated reading');
  },

  'tenant load status explains room occupancy against capacity'() {
    const fullOffice = tenantLoadStatus({ kind: 'office', heads: 6 }, CONFIG);
    const partialHotel = tenantLoadStatus({ kind: 'hotel', heads: 2 }, CONFIG);
    assert(fullOffice.tenants === 6 && fullOffice.capacity === 6 && fullOffice.key === 'full' && fullOffice.colorKey === 'good' &&
      partialHotel.tenants === 2 && partialHotel.capacity === 6 && partialHotel.key === 'light' && partialHotel.colorKey === 'bad' &&
      tenantLoadStatus({ kind: 'office', heads: 4 }, CONFIG).key === 'partial' &&
      tenantLoadStatus({ kind: 'office', heads: 4 }, CONFIG).colorKey === 'warn',
      'tenant load status did not map room occupants to capacity');
  },

  'tenant load summary explains building utilization'() {
    const summary = tenantLoadSummary({ units: [
      { kind: 'office', heads: 6, occupied: true },
      { kind: 'hotel', heads: 2, occupied: true },
      { kind: 'office', heads: 0, occupied: false },
    ] }, CONFIG);
    assert(summary.tenants === 8 && summary.capacity === 18 && summary.key === 'light' && summary.colorKey === 'bad' &&
      indicatorColorKey('clear') === 'good' && indicatorColorKey('critical') === 'bad' && indicatorColorKey('busy') === 'warn',
      'tenant load summary did not separate occupied tenants from built capacity');
  },

  'tenant demand quality rewards useful access and required services'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.stars.tiers[1].pop = 0;
    config.occupancy.experienceDemandWeight = 8;
    const state = boot(config, 121);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build demand-quality shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build demand-quality rooms');
    for (const unit of state.units) {
      unit.occupied = false;
      unit.vacantDays = config.units.office.relistDays;
    }
    state.facilities = [
      { kind: 'food', floor: 1, slot: 2 },
      { kind: 'parking', floor: 1, slot: 3 },
      { kind: 'security', floor: 1, slot: 4 },
      { kind: 'recycling', floor: 1, slot: 5 },
    ];
    const qualityRoom = tenantDemandQuality(state, state.units[0], config);
    const bareRoom = tenantDemandQuality(state, state.units[1], config);
    const forecast = leasingForecast(state, config, 100);
    assert(qualityRoom.coveredServices === qualityRoom.requiredServices &&
      bareRoom.coveredServices < bareRoom.requiredServices && qualityRoom.score > bareRoom.score &&
      qualityRoom.bonus > bareRoom.bonus && forecast.marketCandidates[0].unit.floor === 1 &&
      forecast.marketCandidates[0].experienceDemand.bonus === qualityRoom.bonus,
      'leasing demand did not prefer a room with better access and services');
  },

  'leasing forecast applies stable route access confidence separately from appeal and reputation'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.stars.tiers[1].pop = 0;
    config.occupancy.transportAccessDemandWeight = 2;
    const state = boot(config, 124);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build transport-confidence forecast room');
    const unit = state.units[0];
    unit.occupied = false;
    unit.vacantDays = config.units.office.relistDays;
    const baseline = leasingForecast(state, config, 100);
    state.log = [
      { rep: 40, routeIntervention: { tenantResult: { waitDelta: -4, stressDelta: -1, abandonedDelta: -1, reputationDelta: 8 } } },
      { rep: 35, routeIntervention: { tenantResult: { waitDelta: -3, stressDelta: -0.5, abandonedDelta: 0, reputationDelta: -5 } } },
    ];
    const improved = leasingForecast(state, config, 35);
    assert(baseline.transportAccess.key === 'none' && improved.transportAccess.key === 'helping' &&
      improved.marketCandidates[0].experienceDemand.transportAccessBonus === 2 &&
      improved.marketCandidates[0].experienceDemand.desirabilityBonus === baseline.marketCandidates[0].experienceDemand.desirabilityBonus &&
      improved.reputation === 35,
      'leasing forecast did not apply stable route access confidence without changing appeal or reputation');
  },

  'tenant leasing history keeps compact closed-day outcomes'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.occupancy.tenantDemandHistoryDays = 2;
    const state = { log: [
      { day: 1, leasing: { candidates: 2, capacity: 1, movedIn: [{ experienceDemandScore: 80, experienceDemandBonus: 6 }] } },
      { day: 2, leasing: { candidates: 1, capacity: 2, movedIn: [] } },
      { day: 3, leasing: { candidates: 2, capacity: 2, transportAccess: { key: 'helping', label: 'stable access evidence', bonus: 2, tests: 2, trendKey: 'stable-helping', trendBars: '↑↑' }, rankingSignals: { detail: 'room appeal favors F4 by 3 · access favors F3 by 1' }, movedIn: [
        { experienceDemandScore: 94, experienceDemandBonus: 8, transportAccessBonus: 2, marketDemandBonus: 6 },
        { experienceDemandScore: 84, experienceDemandBonus: 7, transportAccessBonus: 0, marketDemandBonus: 2 },
      ] } },
    ] };
    const history = tenantLeasingHistory(state, config);
    assert(history.length === 2 && history[0].day === 2 && history[0].movedIn === 0 &&
      history[1].day === 3 && history[1].movedIn === 2 && history[1].averageScore === 89 &&
      history[1].averageBonus === 8 && history[1].averageTransportAccessBonus === 1 && history[1].realizedTransportAccessBonus === 1 &&
      history[1].transportAccessBonus === 2 && history[1].rankingSignals.detail.includes('room appeal favors F4') && history[1].averageMarketBonus === 4 && history[1].candidates === 2,
      'tenant leasing history did not retain bounded daily demand outcomes');
  },

  'tenant leasing history retains the daily transport-access forecast'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = { log: [
      { day: 1, leasing: { candidates: 1, capacity: 1, transportAccess: { key: 'helping', label: 'stable access evidence', bonus: 2, tests: 2, trendKey: 'stable-helping', trendBars: '↑↑' }, movedIn: [] } },
    ] };
    const history = tenantLeasingHistory(state, config);
    assert(history.length === 1 && history[0].transportAccessKey === 'helping' &&
      history[0].transportAccessBonus === 2 && history[0].transportAccessTests === 2 &&
      history[0].transportAccessTrendKey === 'stable-helping' && history[0].transportAccessTrendBars === '↑↑',
      'tenant leasing history did not retain the daily transport-access forecast');
  },

  'occupied-room access outcome distinguishes forecast from realized contribution'() {
    const state = { log: [
      { day: 4, leasing: { transportAccess: { key: 'helping', label: 'stable access evidence', bonus: 2, tests: 2, trendBars: '↑↑' }, movedIn: [
        { unitId: 7, unitKind: 'office', floor: 3, transportAccessBonus: 1 },
      ] } },
    ] };
    const outcome = tenantAccessOutcomeForUnit(state, { id: 7, kind: 'office', floor: 3 });
    assert(outcome.day === 4 && outcome.forecastKey === 'helping' && outcome.forecastBonus === 2 &&
      outcome.forecastTests === 2 && outcome.realizedBonus === 1 && outcome.forecastTrendBars === '↑↑',
      'occupied-room access outcome did not distinguish forecast from realized contribution');
  },

  'leasing history records changed room-appeal factors between ranking days'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.occupancy.tenantDemandHistoryDays = 2;
    const factors = { view: 2, amenities: 0, layout: 0, renovation: 0, rent: 0, fit: -1, noise: -2, services: -10 };
    const state = { log: [
      { day: 1, leasing: { candidates: 2, capacity: 1, rankingSignals: { topUnitId: 7, topFloor: 3, topAppealFactors: factors }, movedIn: [] } },
      { day: 2, leasing: { candidates: 2, capacity: 1, rankingSignals: { topUnitId: 7, topFloor: 3, topAppealFactors: { ...factors, view: 6 } }, movedIn: [] } },
    ] };
    const history = tenantLeasingHistory(state, config);
    assert(history.length === 2 && history[1].appealChanges.key === 'changed' &&
      history[1].appealChanges.detail.includes('view +4'),
      'leasing history did not record changed room-appeal factors between ranking days');
  },

  'appeal changes produce a plain-language vacant-room action'() {
    const action = vacancyAppealChangeAction({
      key: 'changed',
      detail: 'services -8 · view +2',
      changes: [{ key: 'services', delta: -8 }, { key: 'view', delta: 2 }],
    });
    const monitor = vacancyAppealChangeAction({ key: 'unchanged', detail: 'no room-appeal factors changed', changes: [] });
    const currentServices = vacancyAppealFactorValue({ foodPenalty: 6, parkingPenalty: 4, medicalPenalty: 0, securityPenalty: 0, recyclingPenalty: 0 }, 'services');
    assert(action.key === 'services' && action.label === 'inspect services' && action.factorKey === 'services' && action.detail.includes('services -8') &&
      currentServices === -10 &&
      monitor.key === 'monitor' && monitor.label === 'keep the room market-ready',
      'appeal changes did not produce a plain-language vacant-room action');
  },

  'vacancy appeal follow-up compares the next closed day with the action baseline'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 124);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build appeal follow-up fixture');
    const unit = state.units[0];
    unit.occupied = false;
    const before = unitEvaluation(state, unit, config);
    const followup = {
      unitId: unit.id,
      floor: unit.floor,
      action: 'renovation',
      factorKey: 'renovation',
      builtDay: 1,
      beforeScore: before.score,
      beforeFactor: vacancyAppealFactorValue(before, 'renovation'),
      beforeDesirability: 50,
      beforeDemand: vacancyDemandSummary(state, unit, config),
    };
    assert(vacancyAppealFollowupResult(followup, state, { day: 1 }, config) === null,
      'appeal follow-up resolved before the next closed day');
    assert(applyAction(state, { type: 'renovate_unit', id: unit.id }, config).ok,
      'vacant room could not be renovated for follow-up');
    const result = vacancyAppealFollowupResult(followup, state, { day: 2, desirability: 55 }, config);
    const history = rememberVacancyAppealFollowupHistory([], { ...followup, result }, 3);
    assert(result.key === 'improved' && result.scoreDelta === config.evaluation.renovationBonus &&
      result.factorDelta === config.evaluation.renovationBonus && result.vacant &&
      result.detail.includes('evaluation +' + config.evaluation.renovationBonus) &&
      result.leaseStatusKey === 'market_delay' && !result.leaseReady && result.desirabilityDelta === 5 &&
      result.detail.includes('tower desirability 50 → 55 (+5)') && result.demandReading?.key === 'not_ready' &&
      result.demandKey === 'not_ready' && result.beforeDemandKey === 'not_ready' &&
      history.length === 1,
      'appeal follow-up did not retain a readable next-day improvement result');
  },

  'service appeal follow-up measures the targeted room after the next close'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 125);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build service follow-up fixture');
    const unit = state.units[0];
    const before = unitEvaluation(state, unit, config);
    const followup = {
      unitId: unit.id,
      floor: unit.floor,
      action: 'food coverage',
      factorKey: 'services',
      builtDay: 1,
      beforeScore: before.score,
      beforeFactor: vacancyAppealFactorValue(before, 'services'),
      beforeDesirability: 50,
    };
    assert(applyAction(state, { type: 'build_facility', kind: 'food', floor: 3 }, config).ok,
      'service facility could not be built for follow-up');
    const result = vacancyAppealFollowupResult(followup, state, { day: 2, rep: 100, desirability: 51 }, config);
    assert(result.key === 'improved' && result.scoreDelta > 0 && result.factorDelta > 0 &&
      result.occupied && result.leaseStatusKey === 'occupied' && result.desirabilityDelta === 1 && result.detail.includes('food coverage'),
      'service appeal follow-up did not measure the targeted room improvement');
  },

  'vacancy appeal follow-up names the tenant type that filled the room'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 126);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build tenant-type follow-up fixture');
    const unit = state.units[0];
    unit.occupied = false;
    const before = unitEvaluation(state, unit, config);
    const followup = {
      unitId: unit.id,
      floor: unit.floor,
      action: 'renovation',
      factorKey: 'renovation',
      builtDay: 1,
      beforeScore: before.score,
      beforeFactor: vacancyAppealFactorValue(before, 'renovation'),
      beforeDemand: { key: 'not_ready' },
    };
    unit.renovated = true;
    unit.occupied = true;
    const result = vacancyAppealFollowupResult(followup, state, {
      day: 2,
      leasing: { movedIn: [{ unitId: unit.id, unitKind: 'office', experienceDemandScore: 80, experienceDemandBonus: 5, marketDemandBonus: 2 }] },
      tenantMix: { entries: [{ kind: 'office', share: 0.25, targetShare: 0.5 }] },
    }, config);
    assert(result.demandKey === 'moved_in' && result.tenantKind === 'office' &&
      result.demandReading.detail.includes('office tenant') && result.detail.includes('tenant type office') &&
      result.mix?.key === 'underrepresented' && result.mix.share === 0.25 && result.mix.targetShare === 0.5,
      'vacancy appeal follow-up did not name the tenant type that filled the room');
  },

  'vacancy demand summary explains the likely tenant and ranking'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 122);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build vacancy-demand fixture');
    state.units[0].occupied = false;
    state.units[0].vacantDays = config.units.office.relistDays;
    const summary = vacancyDemandSummary(state, state.units[0], config, 100);
    const occupied = vacancyDemandSummary(state, { kind: 'office', occupied: true }, config, 100);
    assert(summary.key === 'candidate' && summary.likelyKind === 'office' && summary.rank === 1 &&
      summary.detail.includes('likely tenant: office') && summary.detail.includes('quality +') &&
      summary.detail.includes('mix +') && occupied.key === 'occupied',
      'vacancy demand summary did not explain the likely tenant before recovery');
  },

  'vacancy demand inspection exposes the current transport-access signal'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 123);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build transport-access inspection fixture');
    state.units[0].occupied = false;
    state.units[0].vacantDays = config.units.office.relistDays;
    state.log = [
      { day: 1, routeIntervention: { tenantResult: { waitDelta: -4, stressDelta: -1, abandonedDelta: 0 } } },
      { day: 2, routeIntervention: { tenantResult: { waitDelta: -3, stressDelta: -0.5, abandonedDelta: 0 } } },
    ];
    const summary = vacancyDemandSummary(state, state.units[0], config, 100);
    assert(summary.transportAccess?.key === 'helping' && summary.transportAccess.tests === 2 &&
      summary.detail.includes('likely tenant: office'),
      'vacancy demand inspection did not expose the current transport-access signal');
  },

  'leasing forecast keeps candidate access confidence separate for ranking'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 124);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build vacancy-ranking fixture');
    state.units[0].occupied = false;
    state.units[0].vacantDays = config.units.office.relistDays;
    state.log = [
      { day: 1, routeIntervention: { tenantResult: { waitDelta: -4, stressDelta: -1, abandonedDelta: 0 } } },
      { day: 2, routeIntervention: { tenantResult: { waitDelta: -3, stressDelta: -0.5, abandonedDelta: 0 } } },
    ];
    const forecast = leasingForecast(state, config, 100);
    assert(forecast.transportAccess.key === 'helping' && forecast.marketCandidates[0].experienceDemand.transportAccessBonus === 2 &&
      forecast.marketCandidates[0].experienceDemand.label.includes('access confidence +2') &&
      vacancyRankingAccessSummary(forecast)[0].mixKey === 'underrepresented' &&
      vacancyRankingAccessSummary(forecast)[0].mixTargetShare === config.units.office.targetShare,
      'leasing forecast did not keep candidate access confidence separate for ranking');
  },

  'vacancy ranking keeps access contributions for the visible candidate window'() {
    const candidates = [
      { unit: { id: 1, floor: 4, kind: 'office' }, evaluation: { score: 80 }, marketDemandBonus: 5, experienceDemand: { bonus: 8, transportAccessBonus: 2, desirabilityBonus: 1 } },
      { unit: { id: 2, floor: 3, kind: 'office' }, evaluation: { score: 78 }, marketDemandBonus: 4, experienceDemand: { bonus: 7, transportAccessBonus: 2, desirabilityBonus: 0 } },
      { unit: { id: 3, floor: 2, kind: 'office' }, evaluation: { score: 75 }, marketDemandBonus: 3, experienceDemand: { bonus: 6, transportAccessBonus: 1, desirabilityBonus: -1 } },
      { unit: { id: 4, floor: 1, kind: 'office' }, evaluation: { score: 70 }, marketDemandBonus: 2, experienceDemand: { bonus: 5, transportAccessBonus: 0, desirabilityBonus: 0 } },
    ];
    const summary = vacancyRankingAccessSummary({ marketCandidates: candidates }, 3);
    assert(summary.length === 3 && summary[0].rank === 1 && summary[0].accessBonus === 2 &&
      summary.at(-1).unitId === 3 && summary.at(-1).accessBonus === 1,
      'vacancy ranking did not retain access contributions for the visible candidate window');
  },

  'vacancy ranking compares desirability and access as separate signals'() {
    const candidates = [
      { unit: { id: 1, floor: 4 }, marketDemandBonus: 5, experienceDemand: { transportAccessBonus: 1, desirabilityBonus: 4 } },
      { unit: { id: 2, floor: 3 }, marketDemandBonus: 3, experienceDemand: { transportAccessBonus: 2, desirabilityBonus: 1 } },
    ];
    const summary = vacancyRankingSignalSummary({ marketCandidates: candidates });
    assert(summary.appealDelta === 3 && summary.accessDelta === -1 && summary.mixDelta === 2 &&
      summary.detail.includes('room appeal favors F4 by 3') && summary.detail.includes('access favors F3 by 1') &&
      summary.detail.includes('tenant mix favors F4 by 2'),
      'vacancy ranking did not compare desirability and access separately');
  },

  'vacancy ranking guidance names the combined next choice'() {
    const guidance = vacancyRankingGuidance({ marketCandidates: [
      { unit: { id: 1, floor: 4, kind: 'office' } },
      { unit: { id: 2, floor: 3, kind: 'office' } },
    ] });
    const single = vacancyRankingGuidance({ marketCandidates: [
      { unit: { id: 7, floor: 2, kind: 'condo' } },
    ] });
    const none = vacancyRankingGuidance({ marketCandidates: [] });
    assert(guidance.key === 'compare' && guidance.label === 'start with F4 office' &&
      guidance.detail.includes('combined vacancy ranking') && guidance.runnerFloor === 3 &&
      single.key === 'single' && single.detail.includes('only eligible vacancy') &&
      none.key === 'none' && none.label === 'no vacancy choice yet',
      'vacancy ranking guidance did not state the next combined choice');
  },

  'vacancy pre-fill confirmation identifies the combined choice'() {
    const forecast = { marketCandidates: [
      { unit: { id: 1, floor: 4, kind: 'office' } },
      { unit: { id: 2, floor: 3, kind: 'office' } },
    ] };
    const recommended = vacancyPreFillGuidance(forecast, 1);
    const alternative = vacancyPreFillGuidance(forecast, 2);
    const notRanked = vacancyPreFillGuidance(forecast, 9);
    assert(recommended.key === 'recommended' && recommended.label === 'combined choice: F4 office' &&
      recommended.detail.includes('combining room quality, tenant mix, access, and appeal') &&
      alternative.key === 'alternative' && alternative.detail.includes('rank 2') && alternative.recommendedFloor === 4 &&
      notRanked.key === 'not-ranked' && notRanked.detail.includes('not yet eligible'),
      'vacancy pre-fill guidance did not identify the combined vacancy choice');
  },

  'vacancy pre-fill outcome shows tenant mix change'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = boot(config, 321);
    const outcome = vacancyPreFillOutcome(state, { id: 9, kind: 'office', occupied: false }, config, {
      marketCandidates: [{ unit: { id: 9, floor: 4, kind: 'office' } }],
    });
    assert(outcome.key === 'recommended' && outcome.tenantKind === 'office' && outcome.capacity > 0 &&
      outcome.projectedShare > outcome.currentShare && outcome.targetShare === config.units.office.targetShare &&
      Number.isFinite(outcome.balanceDelta),
      'vacancy pre-fill outcome did not show the projected tenant mix change');
  },

  'vacancy pre-fill result retains ranking breakdown'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = boot(config, 777);
    const unit = { id: 11, floor: 4, kind: 'office', occupied: false };
    const preview = vacancyPreFillOutcome(state, unit, config, {
      marketCandidates: [{
        unit,
        evaluation: { score: 80 },
        marketDemandBonus: 4,
        experienceDemand: { bonus: 9, experienceBonus: 6, transportAccessBonus: 2, desirabilityBonus: 1 },
      }],
    });
    const filled = { ...unit, occupied: true, heads: config.units.office.workers };
    state.units.push(filled);
    const result = vacancyPreFillResult(preview, state, filled, config);
    assert(preview.ranking.total === 93 && result.ranking.tenantMix === 4 &&
      vacancyPreFillRankingLabel(result).includes('room 80') && vacancyPreFillRankingLabel(result).includes('appeal +1') &&
      vacancyPreFillResultHistoryLabel([{ ...result, day: 1, floor: 4 }]).includes('rank 1'),
      'vacancy pre-fill result did not retain the ranking breakdown');
  },

  'vacancy pre-fill override identifies the strongest component pull'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = boot(config, 888);
    const unit = { id: 12, floor: 3, kind: 'office', occupied: false };
    const preview = vacancyPreFillOutcome(state, unit, config, {
      marketCandidates: [
        { unit: { id: 10, floor: 4, kind: 'office' }, evaluation: { score: 90 }, marketDemandBonus: 4, experienceDemand: { bonus: 8, experienceBonus: 6, transportAccessBonus: 0, desirabilityBonus: 2 } },
        { unit, evaluation: { score: 80 }, marketDemandBonus: 3, experienceDemand: { bonus: 10, experienceBonus: 6, transportAccessBonus: 4, desirabilityBonus: 0 } },
      ],
    });
    const signal = vacancyPreFillOverrideSignal([{ key: 'different', followedRecommendation: false, overrideComponent: preview.overrideComponent }]);
    assert(preview.overrideComponent.key === 'access' && preview.overrideComponent.delta === 4 &&
      vacancyPreFillOverrideGuidance(preview).includes('override pull: access') &&
      vacancyPreFillConfirmationLines(preview).some((line) => line.startsWith('choice:')) &&
      vacancyPreFillConfirmationLines(preview).some((line) => line.startsWith('tenant:')) &&
      signal.key === 'access' && signal.label === 'access is the main override pull' && signal.count === 1,
      'vacancy override analysis did not identify the strongest component pull');
  },

  'vacancy pre-fill result compares actual tenant mix'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = boot(config, 654);
    const unit = { id: 9, floor: 4, kind: 'office', occupied: false };
    const preview = vacancyPreFillOutcome(state, unit, config, {
      marketCandidates: [{ unit }],
    });
    const filled = { ...unit, occupied: true, heads: config.units.office.workers };
    state.units.push(filled);
    const result = vacancyPreFillResult(preview, state, filled, config);
    assert(result.key === 'matched' && result.label === 'forecast matched' && result.followedRecommendation === true &&
      result.detail.includes('actual mix') && result.actualShare === result.projectedShare &&
      result.actualBalance === result.projectedBalance,
      'vacancy pre-fill result did not compare the actual tenant mix');
  },

  'vacancy pre-fill history retains recent checks'() {
    const first = { day: 1, floor: 2, label: 'forecast matched', followThroughLabel: 'followed recommendation', tenantKind: 'office', projectedShare: 0.5, actualShare: 0.5 };
    const second = { day: 2, floor: 3, label: 'forecast differed', followThroughLabel: 'overrode recommendation', tenantKind: 'condo', projectedShare: 0.5, actualShare: 0.7 };
    const history = rememberVacancyPreFillResultHistory([first, second, { day: 3 }], { day: 4, floor: 5, label: 'better than forecast', tenantKind: 'shop', projectedShare: 0.2, actualShare: 0.3 }, 3);
    assert(history.length === 3 && history[0].day === 2 && history.at(-1).day === 4 &&
      vacancyPreFillResultHistoryLabel(history).includes('overrode recommendation'),
      'vacancy pre-fill history did not retain the recent checks');
  },

  'vacancy pre-fill history exposes scan-friendly rows'() {
    const lines = vacancyPreFillResultHistoryLines([
      { day: 4, floor: 5, tenantKind: 'shop', followThroughLabel: 'overrode recommendation', label: 'forecast matched', projectedShare: 0.2, actualShare: 0.3, overrideComponent: { key: 'access', label: 'access' } },
      { day: 5, floor: 2, tenantKind: 'office', followedRecommendation: true, label: 'forecast differed', projectedShare: 0.5, actualShare: 0.4 },
    ]);
    assert(lines.length === 2 && lines[0].startsWith('D4 · F5 shop · overrode recommendation') &&
      lines[0].includes('mix 20% → 30%') && lines[0].includes('pull access') &&
      lines[1].includes('D5 · F2 office · followed recommendation'),
      'vacancy pre-fill history rows were not scan-friendly');
  },

  'first-session pressure warning preserves a recovery window'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const live = firstSessionPressureWarning({
      money: 250000,
      people: [{ state: 'waiting' }],
      units: [{ kind: 'office', occupied: true, stress: 20 }],
      shafts: [{ cars: [{}] }],
    }, config, 'S1');
    const shortfall = firstSessionPressureWarning({
      money: 100000,
      people: [{ state: 'waiting' }],
      units: [{ kind: 'office', occupied: true, stress: 0 }],
      shafts: [{ cars: [{}] }],
    }, config, 'S1');
    const answered = firstSessionPressureWarning({
      people: [{ state: 'waiting' }],
      units: [{ kind: 'office', occupied: true, stress: 20 }],
      shafts: [{ cars: [{}, {}] }],
    }, config, 'S1');
    const quiet = firstSessionPressureWarning({ people: [], units: [], shafts: [] }, config, 'S1');
    assert(live.active && live.waiting === 1 && live.stressedUnits === 1 && live.affordable && live.detail.includes('select + car, then click S1') &&
      live.detail.includes('car $140,000') && live.detail.includes('cash $250,000') && live.detail.includes('affordable now') &&
      shortfall.detail.includes('need $40,000 more') &&
      !answered.active && !quiet.active,
      'first-session pressure warning did not preserve or clear the recovery window correctly');
  },

  'first-session recovery watch exposes current and latest readings'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const watching = firstSessionRecoveryReadings({
      people: [{ state: 'waiting' }, { state: 'waiting' }],
      units: [{ kind: 'office', occupied: true }, { kind: 'office', occupied: false }],
      shafts: [{ cars: [{}, {}] }],
    }, config, [{ day: 2, cars: 1, deliveryRate: 42, rep: 58, desirability: 61 }]);
    const recoveredClose = firstSessionRecoveryReadings({
      people: [],
      units: [{ kind: 'office', occupied: true }],
      shafts: [{ cars: [{}, {}] }],
    }, config, [{ day: 3, cars: 2, deliveryRate: 96, rep: 84, desirability: 67 }]);
    const beforeCar = firstSessionRecoveryReadings({
      people: [], units: [], shafts: [{ cars: [{}] }],
    }, config, []);
    assert(watching.active && watching.waiting === 2 && watching.occupied === 1 && watching.capacity > 0 &&
      !watching.postCarClose && watching.detail.includes('W 2 now') && watching.detail.includes('latest D2 pre-car') &&
      watching.detail.includes('keep running for a post-car day close') &&
      recoveredClose.postCarClose && recoveredClose.detail.includes('latest D3 post-car') &&
      !beforeCar.active,
      'first-session recovery watch did not expose the right current and latest readings');
  },

  'first-session recovery evidence pairs the latest pre-car pressure'() {
    const evidence = firstSessionRecoveryEvidence([
      { day: 1, cars: 1, elevatorTrips: 4, abandoned: 1, deliveryRate: 60, rep: 99 },
      { day: 2, cars: 1, elevatorTrips: 5, abandoned: 2, deliveryRate: 70, rep: 72 },
      { day: 3, cars: 2, elevatorTrips: 4, abandoned: 0, deliveryRate: 100, rep: 82 },
      { day: 4, cars: 2, elevatorTrips: 5, abandoned: 1, deliveryRate: 86, rep: 84 },
    ]);
    assert(evidence.pressure?.day === 2 && evidence.recoveryEntry?.day === 3 && evidence.recovered,
      'first-session recovery evidence did not use the latest pre-car pressure day');
  },

  'first-session recovery evidence accepts a healthy same-day live response'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const live = firstSessionRecoveryEvidence([
      { day: 2, cars: 2, elevatorTrips: 4, abandoned: 0, deliveryRate: 92, rep: 96, occupied: 2, vacant: 1, desirability: 27 },
    ], { day: 2, waiting: 1, stressedUnits: 0, occupied: 3, vacant: 0 }, config);
    const weak = firstSessionRecoveryEvidence([
      { day: 2, cars: 2, elevatorTrips: 4, abandoned: 1, deliveryRate: 72, rep: 78 },
    ], { day: 2, waiting: 1, stressedUnits: 0 }, config);
    assert(live.observed && live.recovered && live.source === 'live-warning' && live.pressure.waiting === 1 &&
      live.recoveryEntry.day === 2 && !weak.recovered,
      'first-session recovery evidence did not handle a same-day live response safely');
  },

  'post-beta management goal starts with the weakest required service'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = boot(config, 515);
    state.units.push({ id: 1, kind: 'office', floor: 1, occupied: true, heads: config.units.office.workers, stress: 0 });
    const serviceGoal = postBetaManagementGoal(state, config);
    const expansionGoal = postBetaManagementGoal({ ...state, units: [] }, config);
    assert(serviceGoal.key === 'service' && serviceGoal.action === 'food' && serviceGoal.label === 'add a cafeteria' &&
      serviceGoal.cost === config.costs.food && serviceGoal.targetUnitId === 1 && serviceGoal.targetTenantLoad === 6 &&
      serviceGoal.detail.includes('helps F1 office (6 tenants)') && serviceGoal.recommendedFloor === 1 &&
      expansionGoal.key === 'expand' && expansionGoal.action === 'floor' &&
      expansionGoal.cost === config.costs.floor,
      'post-beta management goal did not choose a concrete service or expansion');
  },

  'post-beta management goal points to the first mixed-use expansion'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = boot(config, 516);
    for (let index = 0; index < 10; index += 1) {
      state.units.push({
        id: index + 1,
        kind: 'office',
        floor: 1 + (index % 3),
        slot: index,
        occupied: true,
        heads: config.units.office.workers,
        stress: 0,
      });
    }
    for (const kind of ['food', 'parking', 'security', 'recycling']) {
      state.facilities.push({ id: 100 + state.facilities.length, kind, floor: 2, slot: 20 + state.facilities.length });
    }
    const goal = postBetaManagementGoal(state, config);
    assert(goal.key === 'expansion' && goal.action === 'condo' && goal.label === 'add a condo' &&
      goal.cost === config.costs.condo && goal.detail.includes('mixed-use expansion'),
      'post-beta management goal did not point to the first condo expansion');
  },

  'post-beta management goal names the first condo service follow-up'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = {
      floors: 4,
      units: [{ id: 1, kind: 'condo', floor: 2, slot: 1, occupied: true, heads: 3, stress: 0, rent: config.units.condo.rent }],
      facilities: [], shafts: [], stairs: [], escalators: [], lobby: null, people: [], log: [],
    };
    const goal = postBetaManagementGoal(state, config);
    assert(goal.action === 'food' && goal.label === 'add a cafeteria for the condo' &&
      goal.detail.includes('support the first condo') && goal.targetUnitId === 1,
      'post-beta management goal did not name the first condo service follow-up');
  },

  'repeated service goal names the rooms still uncovered'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    const state = {
      floors: 4,
      units: [
        { id: 1, kind: 'office', floor: 1, slot: 1, heads: 6, occupied: true, stress: 0, rent: config.units.office.rent },
        { id: 2, kind: 'office', floor: 2, slot: 1, heads: 6, occupied: true, stress: 0, rent: config.units.office.rent },
        { id: 3, kind: 'office', floor: 3, slot: 1, heads: 6, occupied: true, stress: 0, rent: config.units.office.rent },
      ],
      facilities: [{ id: 10, kind: 'food', floor: 1, slot: 0 }],
      shafts: [{ id: 20, bottom: 0, top: 3, slot: 0, cars: [] }],
      stairs: [], escalators: [], lobby: null, people: [], log: [],
    };
    const goal = postBetaManagementGoal(state, config);
    assert(goal.action === 'food' && goal.label === 'add a cafeteria' &&
      goal.targetUnitId === 3 && goal.detail.includes('remaining uncovered: F3 office (6 tenants)') &&
      goal.detail.includes('place on F3'),
      'repeated service goal did not identify the uncovered room');
  },

  'vacancy pre-fill choice signal summarizes follow-through'() {
    const signal = vacancyPreFillChoiceSignal([
      { followedRecommendation: true },
      { followThroughLabel: 'overrode recommendation' },
      { followedRecommendation: false },
    ]);
    const empty = vacancyPreFillChoiceSignal([]);
    assert(signal.key === 'overridden' && signal.followed === 1 && signal.overridden === 2 && signal.total === 3 &&
      signal.detail.includes('persistent overrides') && empty.key === 'none',
      'vacancy pre-fill choice signal did not summarize player follow-through');
  },

  'vacancy pre-fill outcome signal compares overrides'() {
    const insufficient = vacancyPreFillOutcomeSignal([
      { key: 'different', followedRecommendation: true },
      { key: 'matched', followedRecommendation: false },
    ]);
    const signal = vacancyPreFillOutcomeSignal([
      { key: 'different', followedRecommendation: true },
      { key: 'matched', followedRecommendation: false },
      { key: 'better', followedRecommendation: false },
    ]);
    const empty = vacancyPreFillOutcomeSignal([]);
    assert(insufficient.key === 'insufficient' && insufficient.sampleReady === false && insufficient.minimumSample === 3 &&
      signal.key === 'override-outperforms' && signal.followedHealthy === 0 && signal.overriddenHealthy === 2 &&
      signal.sampleReady === true && signal.detail.includes('reviewing the ranking weights') && empty.key === 'none',
      'vacancy pre-fill outcome signal did not compare override results');
  },

  'floor operations summary joins local queues to tenant load'() {
    const summary = floorOperationsSummary({ units: [
      { floor: 2, kind: 'office', heads: 6, occupied: true },
      { floor: 2, kind: 'office', heads: 0, occupied: false },
    ], people: [
      { state: 'waiting', from: 2 },
      { state: 'waiting', from: 2 },
      { state: 'walking', from: 2 },
    ] }, 2, CONFIG);
    const clear = floorOperationsSummary({ units: [], people: [] }, 1, CONFIG);
    assert(summary.tenants === 6 && summary.capacity === 12 && summary.colorKey === 'warn' &&
      summary.waiting === 2 && summary.waitingBand === 'watch' && summary.waitingColorKey === 'warn' &&
      summary.rooms === 2 && summary.vacantRooms === 1 &&
      clear.waiting === 0 && clear.waitingColorKey === 'good',
      'floor operations summary did not join local queues and tenant load');
  },

  'floor handoff preview states the expected local effect'() {
    const state = { units: [
      { id: 7, floor: 2, kind: 'office', heads: 6, occupied: true },
      { id: 8, floor: 2, kind: 'office', heads: 0, occupied: false },
    ] };
    const summary = floorOperationsSummary(state, 2, CONFIG);
    const vacancy = floorHandoffPreview(summary, { floor: 2, kind: 'vacancy', unitId: 8 }, state, CONFIG);
    const car = floorHandoffPreview(summary, { floor: 2, kind: 'car' }, state, CONFIG);
    const stairs = floorHandoffPreview(summary, { floor: 2, kind: 'stairs' }, state, CONFIG);
    assert(vacancy.key === 'occupancy' && vacancy.detail.includes('6/12 to 12/12 tenants (+6)') &&
      car.key === 'transport' && car.detail.includes('12 riders per dispatch') &&
      stairs.key === 'transport' && stairs.detail.includes('without using an elevator car') &&
      transportCoverageText('shaft') === 'a separate vertical route' &&
      transportCoverageText('car') === 'capacity on the existing route' &&
      transportCoverageText().includes('cars add capacity') &&
      floorHandoffPreview(summary, { floor: 1, kind: 'car' }, state, CONFIG) === null,
      'floor handoff preview did not state the expected local effect');
  },

  'shaft route labels identify overlapping and independent spans'() {
    const shafts = [
      { bottom: 0, top: 3 },
      { bottom: 2, top: 5 },
      { bottom: 6, top: 8 },
    ];
    assert(shaftRouteCoverageLabel(shafts[0], shafts) === 'overlaps S2 on floors 2–3' &&
      shaftRouteCoverageLabel(shafts[2], shafts) === 'independent span',
      'shaft route labels did not distinguish overlapping spans');
  },

  'shaft recommendations distinguish added and duplicate coverage'() {
    const shafts = [
      { bottom: 0, top: 3 },
      { bottom: 2, top: 5 },
    ];
    assert(shaftCandidateCoverageLabel(0, 3, []) === 'adds coverage on floors 0–3' &&
      shaftCandidateCoverageLabel(0, 3, shafts).includes('duplicates existing coverage') &&
      shaftCandidateCoverageLabel(0, 7, shafts).includes('adds coverage on floors 6–7'),
      'shaft recommendations did not distinguish added and duplicate coverage');
  },

  'shaft control distinguishes a blocked full span from a shorter span'() {
    const base = { floors: 4, units: [], facilities: [], lobby: null, stairs: [], escalators: [], shafts: [] };
    const topFloorBlocked = {
      ...base,
      units: Array.from({ length: CONFIG.building.slotsPerFloor }, (_, slot) => ({ floor: 3, slot })),
    };
    const shorter = shaftBuildControlStatus(topFloorBlocked, CONFIG);
    const fullyBlocked = {
      ...base,
      units: Array.from({ length: 4 }, (_, floor) => Array.from({ length: CONFIG.building.slotsPerFloor }, (_, slot) => ({ floor, slot }))).flat(),
    };
    const unavailable = shaftBuildControlStatus(fullyBlocked, CONFIG);
    const projection = shaftPlacementProjection(0, 2, CONFIG);
    const existingCapacity = shaftCapacityProjection({ cars: [{}, {}] }, CONFIG);
    assert(shorter.key === 'shorter' && shorter.disabled === false && shorter.top === 2 && shorter.cost === CONFIG.costs.shaft + CONFIG.costs.shaftPerFloor * 3 &&
      projection.floors === 3 && projection.startingCars === 1 && projection.startingCapacity === CONFIG.elevator.capacity &&
      projection.maxCars === CONFIG.elevator.maxCarsPerShaft && projection.maxCapacity === CONFIG.elevator.capacity * CONFIG.elevator.maxCarsPerShaft &&
      projection.additionalCars === CONFIG.elevator.maxCarsPerShaft - 1 && projection.additionalCapacity === CONFIG.elevator.capacity * (CONFIG.elevator.maxCarsPerShaft - 1) &&
      projection.carCost === CONFIG.costs.car &&
      existingCapacity.currentCars === 2 && existingCapacity.currentCapacity === CONFIG.elevator.capacity * 2 &&
      existingCapacity.remainingCars === CONFIG.elevator.maxCarsPerShaft - 2 &&
      existingCapacity.remainingCapacity === CONFIG.elevator.capacity * (CONFIG.elevator.maxCarsPerShaft - 2) &&
      existingCapacity.maxCapacity === CONFIG.elevator.capacity * CONFIG.elevator.maxCarsPerShaft && existingCapacity.carCost === CONFIG.costs.car &&
      shorter.detail.includes('shorter span through F2') && unavailable.disabled === true &&
      unavailable.detail.includes('no clear shaft column'),
      'shaft control did not distinguish a shorter available span');
  },

  'shaft queue relief projects the benefit of one more car'() {
    const shaft = { id: 7, cars: [{}] };
    const state = {
      people: Array.from({ length: 12 }, () => ({ state: 'waiting', shaft: 7 })),
    };
    const projection = shaftQueueReliefProjection(shaft, state, CONFIG);
    const maxedCars = Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({}));
    const full = shaftQueueReliefProjection({ id: 7, cars: maxedCars }, state, CONFIG);
    assert(projection.queue === 12 && projection.currentCars === 1 && projection.nextCars === 2 &&
      projection.currentWaitSeconds > projection.nextWaitSeconds && projection.reliefSeconds > 0 &&
      projection.available === true && full.available === false &&
      full.currentWaitSeconds === full.nextWaitSeconds,
      'shaft queue relief did not show the effect of one additional car');
  },

  'shaft queue relief recommendation picks the strongest open target'() {
    const state = {
      shafts: [
        { id: 7, cars: [{}] },
        { id: 8, cars: [{}] },
        { id: 9, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) },
      ],
      people: [
        ...Array.from({ length: 12 }, () => ({ state: 'waiting', shaft: 7 })),
        ...Array.from({ length: 4 }, () => ({ state: 'waiting', shaft: 8 })),
        ...Array.from({ length: 20 }, () => ({ state: 'waiting', shaft: 9 })),
      ],
    };
    const recommendation = shaftQueueReliefRecommendation(state, CONFIG);
    assert(recommendation.bestShaftId === 7 && recommendation.best.shaftIndex === 0 &&
      recommendation.candidates.length === 3 && recommendation.candidates[2].available === false,
      'shaft queue relief recommendation did not rank the strongest open target');
  },

  'shaft queue trend distinguishes rising, falling, and spike readings'() {
    const rising = shaftQueueTrend([0, 2, 6]);
    const falling = shaftQueueTrend([8, 5, 1]);
    const spike = shaftQueueTrend([1, 7, 2]);
    const bounded = shaftQueueTrend([0, 99, 0], 2);
    const timed = shaftQueueTrend([
      { count: 0, day: 1, tod: 0.10 },
      { count: 6, day: 1, tod: 0.11 },
    ]);
    assert(rising.direction === 'rising' && rising.bars.length === 3 && rising.current === 6 &&
      falling.direction === 'falling' && spike.spike === true &&
      bounded.entries.length === 2 && bounded.peak === 99 && timed.timeSpanMinutes === 14,
      'shaft queue trend did not preserve compact direction and spike signals');
  },

  'shaft queue forecast context identifies speed and rush phase'() {
    const rush = shaftQueueForecastContext(2, 0.10, 12, CONFIG);
    const paused = shaftQueueForecastContext(2, 0.35, 0, CONFIG);
    assert(rush.speedLabel === '12×' && rush.phase === 'MORNING RUSH' &&
      rush.label === '12× · MORNING RUSH' && rush.sampleIntervalMinutes === 30 &&
      paused.speedLabel === 'paused' && paused.phase === 'OFF-PEAK',
      'shaft queue forecast context did not label speed and rush phase');
  },

  'daily service summary connects abandonment to reputation pressure'() {
    const pressure = queueDailyServiceSummary({ deliveryRate: 48, avgWait: 9.5, abandoned: 3, rep: 48,
      elevatorAvgWait: 12.5, elevatorAbandoned: 3, localAvgWait: 2.1, localAbandoned: 0 }, CONFIG);
    const stable = queueDailyServiceSummary({ deliveryRate: 96, avgWait: 0.8, abandoned: 0, rep: 96 }, CONFIG);
    const crowded = queueDailyServiceSummary({ deliveryRate: 96, avgWait: 0.8, abandoned: 0, rep: 93,
      localOverflowPeak: 2, localOverflowPenalty: 3 }, CONFIG);
    const waiting = queueDailyServiceSummary(null, CONFIG);
    assert(pressure.key === 'bad' && pressure.label.includes('delivery 48%') &&
      pressure.detail.includes('3 riders gave up') && pressure.detail.includes('Elevator: 12.5s wait') &&
      pressure.detail.includes('local routes: 2.1s wait') && stable.key === 'good' &&
      crowded.key === 'warn' && crowded.detail.includes('exceeded immediate capacity') &&
      crowded.detail.includes('costing 3 reputation') &&
      waiting.key === 'warn' && waiting.detail.includes('first day close'),
      'daily service summary did not connect transport outcomes to reputation pressure');
  },

  'daily shaft queue trend compares local pressure across days'() {
    const trend = shaftQueueDailyTrend([
      { day: 1, average: 1.2, peak: 4 },
      { day: 2, average: 3.4, peak: 9 },
      { day: 3, average: 5.1, peak: 12 },
    ]);
    const bounded = shaftQueueDailyTrend([
      { day: 1, average: 1, peak: 2 },
      { day: 2, average: 2, peak: 3 },
      { day: 3, average: 3, peak: 4 },
    ], 2);
    assert(trend.direction === 'rising' && trend.current === 5.1 && trend.peak === 12 &&
      trend.bars.length === 3 && bounded.entries.length === 2 && bounded.entries[0].day === 2,
      'daily shaft queue trend did not preserve day-over-day local pressure');
  },

  'daily local-route trend compares normalized occupancy across days'() {
    const trend = localRouteDailyTrend([
      { day: 1, average: 1, peak: 3, capacity: 6 },
      { day: 2, average: 3, peak: 5, capacity: 6 },
      { day: 3, average: 5, peak: 6, capacity: 6 },
    ]);
    const bounded = localRouteDailyTrend([
      { day: 1, average: 1, peak: 2, capacity: 12 },
      { day: 2, average: 2, peak: 4, capacity: 12 },
      { day: 3, average: 3, peak: 5, capacity: 12 },
    ], 2);
    assert(trend.direction === 'rising' && trend.current === 5 && trend.peak === 6 &&
      trend.currentRatio === 0.83 && trend.bars.length === 3 && bounded.entries.length === 2 &&
      bounded.entries[0].day === 2,
      'daily local-route trend did not preserve normalized occupancy pressure');
  },

  'daily local-overflow trend distinguishes a spike from sustained crowding'() {
    const trend = localOverflowDailyTrend([
      { day: 1, localOverflowAverage: 0.2, localOverflowPeak: 1, localOverflowPenalty: 0.6 },
      { day: 2, localOverflowAverage: 0.7, localOverflowPeak: 2, localOverflowPenalty: 2.1 },
      { day: 3, localOverflowAverage: 1.1, localOverflowPeak: 3, localOverflowPenalty: 3.3 },
    ]);
    const spike = localOverflowDailyPressure([
      { day: 1, localOverflowAverage: 0.2, localOverflowPeak: 1 },
    ]);
    const sustained = localOverflowDailyPressure([
      { day: 1, localOverflowAverage: 0.2, localOverflowPeak: 1 },
      { day: 2, localOverflowAverage: 0.7, localOverflowPeak: 2 },
    ]);
    assert(trend.direction === 'rising' && trend.current === 1.1 && trend.peak === 3 &&
      trend.bars.length === 3 && spike.key === 'spike' && !spike.sustained &&
      sustained.key === 'sustained' && sustained.consecutiveDays === 2,
      'daily local-overflow trend did not distinguish a spike from sustained crowding');
  },

  'local overflow history keeps route identity and clear days'() {
    const history = localOverflowRouteHistory([
      { day: 1, localOverflowRoutes: [{ kind: 'stairs', routeId: 3, average: 0.4, peak: 1 }] },
      { day: 2, localOverflowRoutes: [{ kind: 'stairs', routeId: 3, average: 0.8, peak: 2 }] },
      { day: 3, localOverflowRoutes: [] },
    ], 'stairs', 3);
    assert(history.length === 3 && history[0].localOverflowAverage === 0.4 &&
      history[1].localOverflowPeak === 2 && history[2].localOverflowAverage === 0,
      'local overflow history did not preserve route identity or clear days');
  },

  'local overflow intervention result reports relief or worsening'() {
    const relieved = localOverflowInterventionResult({ average: 0.8, peak: 3 }, { average: 0.1, peak: 1 });
    const worse = localOverflowInterventionResult({ average: 0.2, peak: 1 }, { average: 0.5, peak: 2 });
    const unchanged = localOverflowInterventionResult({ average: 0.2, peak: 1 }, { average: 0.24, peak: 1 });
    assert(relieved.key === 'relieved' && relieved.averageDelta === -0.7 &&
      worse.key === 'worse' && worse.peakDelta === 1 && unchanged.key === 'unchanged',
      'local overflow intervention result did not classify before/after pressure');
  },

  'local overflow intervention comparison identifies absorbed versus shifted pressure'() {
    const absorbed = localOverflowInterventionComparison(
      { average: 0.8, peak: 3 },
      { average: 0.05, peak: 1 },
      { average: 0, peak: 0 },
    );
    const shifted = localOverflowInterventionComparison(
      { average: 0.8, peak: 3 },
      { average: 0.05, peak: 1 },
      { average: 0.4, peak: 2 },
    );
    assert(absorbed.key === 'absorbed' && absorbed.alternateAverage === 0 &&
      shifted.key === 'shifted' && shifted.alternatePressured,
      'local overflow intervention comparison did not distinguish absorbed and shifted pressure');
  },

  'local overflow intervention result guides another route when the alternate is pressured'() {
    const comparison = localOverflowInterventionComparison(
      { average: 0.8, peak: 3 },
      { average: 0.05, peak: 1 },
      { average: 0.4, peak: 2 },
    );
    const action = localOverflowInterventionNextAction(comparison, { kind: 'escalator', id: 4, top: 3 });
    const monitor = localOverflowInterventionNextAction(
      localOverflowInterventionComparison({ average: 0.8, peak: 3 }, { average: 0.05, peak: 1 }, { average: 0, peak: 0 }),
      { kind: 'escalator', id: 4, top: 3 },
    );
    const base = {
      floors: 4,
      lobby: { slot: 0, slots: [0] },
      shafts: [],
      stairs: [],
      escalators: [],
      facilities: [],
      units: [],
      money: 10000000,
    };
    const readyState = {
      ...base,
      escalators: [{ id: 4, slot: 1, bottom: 0, top: 3 }],
      people: [
        { state: 'walking', localRouteKind: 'escalator', localRouteId: 4 },
        { state: 'walking', localRouteKind: 'escalator', localRouteId: 4 },
        { state: 'waiting', localRouteKind: 'escalator', localRouteId: 4 },
      ],
    };
    const ready = localOverflowInterventionNextAction(comparison, { kind: 'escalator', id: 4, bottom: 0, top: 3 }, readyState, CONFIG);
    const poor = localOverflowInterventionNextAction(comparison, { kind: 'escalator', id: 4, bottom: 0, top: 3 }, { ...base, money: 0 }, CONFIG);
    const blocked = localOverflowInterventionNextAction(comparison, { kind: 'escalator', id: 4, bottom: 0, top: 3 }, {
      ...base,
      units: Array.from({ length: 4 * CONFIG.building.slotsPerFloor }, (_, index) => ({
        floor: Math.floor(index / CONFIG.building.slotsPerFloor),
        slot: index % CONFIG.building.slotsPerFloor,
      })),
    }, CONFIG);
    assert(action.key === 'add-capacity' && action.kind === 'escalator' && action.detail.includes('still pressured') &&
      monitor.key === 'monitor' && monitor.kind === null && ready.available && ready.affordable &&
      ready.currentCapacity === CONFIG.escalator.capacity && ready.projectedCapacity === CONFIG.escalator.capacity * 2 &&
      ready.liveOccupancy === 2 && ready.liveQueue === 1 && ready.spanFloors === 3 && ready.travelSeconds === 5.4 && ready.expectedOverflowRelief === 0.4 &&
      poor.available && !poor.affordable && poor.fundsGap === ready.cost && !blocked.available && blocked.placementDetail.includes('no clear column'),
      'local overflow intervention result did not guide the next transport decision');
  },

  'local overflow intervention next action uses tenant experience as evidence'() {
    const absorbed = localOverflowInterventionComparison(
      { average: 0.8, peak: 3 },
      { average: 0.05, peak: 1 },
      { average: 0, peak: 0 },
    );
    const improved = localOverflowInterventionTenantResult(
      { localAvgWait: 12, averageStress: 40, rep: 60 },
      { localAvgWait: 4, averageStress: 38, rep: 61 },
    );
    const worse = localOverflowInterventionTenantResult(
      { localAvgWait: 4, averageStress: 38, rep: 61 },
      { localAvgWait: 9, averageStress: 42, rep: 60 },
    );
    const monitor = localOverflowInterventionNextAction(absorbed, null, null, null, improved);
    const recheck = localOverflowInterventionNextAction(absorbed, null, null, null, worse);
    assert(monitor.key === 'monitor' && monitor.tenantOutcomeKey === 'improved' && monitor.detail.includes('tenant experience improved') &&
      recheck.key === 'recheck' && recheck.tenantOutcomeKey === 'worse' && recheck.detail.includes('tenant experience worsened'),
      'local overflow next action did not use tenant experience to qualify monitoring');
  },

  'local overflow intervention tenant result reports tenant experience change'() {
    const improved = localOverflowInterventionTenantResult(
      { localAvgWait: 12, localAbandoned: 2, averageStress: 40, rep: 60 },
      { localAvgWait: 4, localAbandoned: 0, averageStress: 38, rep: 61 },
    );
    const worse = localOverflowInterventionTenantResult(
      { localAvgWait: 4, localAbandoned: 0, averageStress: 38, rep: 61 },
      { localAvgWait: 9, localAbandoned: 1, averageStress: 42, rep: 60 },
    );
    const unchanged = localOverflowInterventionTenantResult(
      { localAvgWait: 4, localAbandoned: 0, averageStress: 38, rep: 61 },
      { localAvgWait: 4.04, localAbandoned: 0, averageStress: 38.02, rep: 61.2 },
    );
    assert(improved.key === 'improved' && improved.waitDelta === -8 && improved.abandonedDelta === -2 &&
      worse.key === 'worse' && worse.stressDelta === 4 && unchanged.key === 'unchanged' &&
      unchanged.reputationDelta === 0.2,
      'local overflow intervention tenant result did not classify tenant-facing change');
  },

  'local overflow intervention history stays bounded and keeps newest outcomes'() {
    const history = rememberLocalOverflowInterventionHistory(
      [{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }],
      { day: 5, tenantResult: { key: 'improved' } },
      4,
    );
    const unchanged = rememberLocalOverflowInterventionHistory(history, null, 4);
    assert(history.length === 4 && history[0].day === 2 && history.at(-1).day === 5 &&
      history.at(-1).tenantResult.key === 'improved' && unchanged.length === 4 && unchanged[0].day === 2,
      'local overflow intervention history did not retain a bounded newest window');
  },

  'local overflow intervention history summarizes tenant outcomes over time'() {
    const summary = localOverflowInterventionHistorySummary([
      { tenantResult: { key: 'improved' } },
      { tenantResult: { key: 'improved' } },
      { tenantResult: { key: 'unchanged' } },
      { tenantResult: { key: 'worse' } },
    ]);
    const empty = localOverflowInterventionHistorySummary([]);
    assert(summary.key === 'helping' && summary.total === 4 && summary.improved === 2 &&
      summary.unchanged === 1 && summary.worse === 1 && summary.improvementRate === 50 &&
      summary.label.includes('mostly improved') && summary.stabilityKey === 'mixed-recent' &&
      summary.stabilityLabel.includes('mixed recent') && empty.key === 'mixed' && empty.total === 0 &&
      empty.stabilityKey === 'one-day',
      'local overflow intervention history did not summarize tenant outcomes');
  },

  'local overflow intervention history distinguishes stable and one-day signals'() {
    const stable = localOverflowInterventionHistorySummary([
      { tenantResult: { key: 'improved' } },
      { tenantResult: { key: 'improved' } },
    ]);
    const mixed = localOverflowInterventionHistorySummary([
      { tenantResult: { key: 'improved' } },
      { tenantResult: { key: 'worse' } },
    ]);
    assert(stable.stabilityKey === 'stable-helping' && stable.recentCount === 2 &&
      stable.stabilityLabel.includes('stable improvement') && mixed.stabilityKey === 'mixed-recent',
      'local overflow intervention history did not distinguish repeated and mixed outcomes');
  },

  'local overflow intervention next action uses history stability'() {
    const absorbed = localOverflowInterventionComparison(
      { average: 0.8, peak: 3 },
      { average: 0.05, peak: 1 },
      { average: 0, peak: 0 },
    );
    const improved = { key: 'improved' };
    const oneDay = localOverflowInterventionHistorySummary([{ tenantResult: improved }]);
    const stable = localOverflowInterventionHistorySummary([
      { tenantResult: improved },
      { tenantResult: improved },
    ]);
    const cautious = localOverflowInterventionNextAction(absorbed, null, null, null, improved, oneDay);
    const monitor = localOverflowInterventionNextAction(absorbed, null, null, null, improved, stable);
    assert(cautious.key === 'recheck' && cautious.stabilityKey === 'one-day' && cautious.detail.includes('one-day result') &&
      monitor.key === 'monitor' && monitor.stabilityKey === 'stable-helping' && monitor.detail.includes('stable improvement'),
      'local overflow next action did not use the history stability signal');
  },

  'stable route outcomes inform access demand without using reputation twice'() {
    const state = {
      log: [
        { rep: 40, routeIntervention: { tenantResult: { waitDelta: -4, stressDelta: -1, abandonedDelta: -1, reputationDelta: 4 } } },
        { rep: 35, routeIntervention: { tenantResult: { waitDelta: -3, stressDelta: -0.5, abandonedDelta: 0, reputationDelta: -5 } } },
      ],
    };
    const signal = tenantTransportForecastSignal(state, CONFIG);
    const uncertain = tenantTransportForecastSignal({ log: [{ routeIntervention: { tenantResult: { waitDelta: -4, stressDelta: -1 } } }] }, CONFIG);
    assert(signal.key === 'helping' && signal.bonus === CONFIG.occupancy.transportAccessDemandWeight && signal.tests === 2 &&
      signal.detail.includes('separate from reputation') && uncertain.key === 'uncertain' && uncertain.bonus === 0,
      'stable route outcomes did not inform access demand independently from reputation');
  },

  'transport access forecast keeps a short readable trend history'() {
    const state = {
      log: [
        { day: 2, routeIntervention: { tenantResult: { waitDelta: -4, stressDelta: -1, abandonedDelta: 0 } } },
        { day: 3, routeIntervention: { tenantResult: { waitDelta: -3, stressDelta: -0.5, abandonedDelta: 0 } } },
        { day: 4, routeIntervention: { tenantResult: { waitDelta: 2, stressDelta: 0.5, abandonedDelta: 1 } } },
      ],
    };
    const history = tenantTransportForecastHistory(state, 2);
    const trend = tenantTransportForecastTrend(history);
    const signal = tenantTransportForecastSignal(state, CONFIG);
    assert(history.length === 2 && history[0].day === 3 && history.at(-1).key === 'worse' &&
      trend.key === 'mixed-recent' && trend.bars === '↑↓' && signal.tests === 3 &&
      signal.key === 'uncertain',
      'transport access forecast did not retain or summarize its short trend history');
  },

  'first-wave pressure separates reachable trips from immediate capacity'() {
    const stairs = firstWavePressure(8, 0, CONFIG.stairs.capacity);
    const occupied = firstWavePressure(8, 4, CONFIG.stairs.capacity);
    const elevator = firstWavePressure(8, 0, CONFIG.elevator.capacity);
    assert(stairs.capacity === 6 && stairs.trips === 6 && stairs.overflow === 2 &&
      occupied.capacity === 2 && occupied.trips === 2 && occupied.overflow === 6 &&
      elevator.capacity === 12 && elevator.trips === 8 && elevator.overflow === 0,
      'first-wave pressure did not separate route reach from immediate capacity');
  },

  'daily shaft queue pressure distinguishes sustained pressure from a spike'() {
    const spike = shaftQueueDailyPressure([{ day: 1, average: 1, peak: 10 }]);
    const sustained = shaftQueueDailyPressure([
      { day: 1, average: 2.1, peak: 6 },
      { day: 2, average: 2.8, peak: 9 },
    ]);
    assert(spike.key === 'spike' && spike.sustained === false &&
      sustained.key === 'sustained' && sustained.sustained === true &&
      sustained.consecutiveDays === 2,
      'daily shaft queue pressure did not distinguish a one-day spike from repeated pressure');
  },

  'sustained daily queue pressure guides a reserve-car recommendation'() {
    const state = {
      shafts: [
        { id: 7, cars: [{}] },
        { id: 8, cars: [{}] },
      ],
      people: [],
    };
    const histories = new Map([
      [7, [
        { day: 1, average: 2.2, peak: 7 },
        { day: 2, average: 2.5, peak: 8 },
      ]],
      [8, [{ day: 1, average: 0, peak: 1 }]],
    ]);
    const recommendation = shaftQueueReliefRecommendation(state, CONFIG, histories);
    assert(recommendation.bestShaftId === 7 && recommendation.basis === 'sustained daily pressure' &&
      recommendation.best.dailyPressure.sustained === true,
      'sustained daily pressure did not guide the reserve-car recommendation');
  },

  'transport response separates car, shaft, and local-route actions'() {
    const base = {
      floors: 4,
      units: [],
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [],
      escalators: [],
    };
    const car = transportResponseRecommendation({
      ...base,
      shafts: [{ id: 7, cars: [{}] }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7 })),
    }, CONFIG);
    const shaft = transportResponseRecommendation({
      ...base,
      shafts: [{ id: 7, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    }, CONFIG);
    const local = transportResponseRecommendation({
      ...base,
      units: [
        ...Array.from({ length: CONFIG.building.slotsPerFloor - 1 }, (_, slot) => ({ floor: 0, slot: slot + 1 })),
        ...Array.from({ length: CONFIG.building.slotsPerFloor - 1 }, (_, slot) => ({ floor: 1, slot: slot + 1 })),
      ],
      stairs: [{ bottom: 0, top: 3, slot: 1 }],
      shafts: [{ id: 7, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})), slot: 0, bottom: 0, top: 3 }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    }, CONFIG);
    const unaffordableCar = transportResponseRecommendation({
      ...base,
      money: 0,
      log: [{ net: 70000 }],
      shafts: [{ id: 7, cars: [{}] }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    }, CONFIG);
    const unaffordableShaft = transportResponseRecommendation({
      ...base,
      money: 0,
      log: [{ net: 100000 }],
      shafts: [{ id: 7, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    }, CONFIG);
    const noRunway = transportResponseRecommendation({
      ...base,
      money: 0,
      shafts: [{ id: 7, cars: [{}] }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    }, CONFIG);
    assert(car.key === 'car' && car.kind === 'car' && car.basis === 'live queue' &&
      car.detail.includes('Cost $140,000') && car.detail.includes('+12 riders per dispatch') &&
      shaft.key === 'shaft' && shaft.kind === 'shaft' && shaft.label.includes('second shaft') &&
      shaft.targetFloor === 3 && shaft.targetFloors.includes(3) && shaft.detail.includes('F3') &&
      shaft.detail.includes('Cost $138,000') && shaft.detail.includes('includes 1 car / 12 riders per dispatch') &&
      local.key === 'local' && local.kind === 'stairs' && local.basis === 'local route' && local.affordable === true &&
      local.targetFloor === 3 && local.routeBottom === 0 && local.routeTop === 3 && local.routeSlot === 1 &&
      local.routeOccupancy === 0 && local.routeCapacity === CONFIG.stairs.capacity &&
      local.averageSeconds > 0 && local.coveredTrips === 8 && Number.isInteger(local.dailyThroughputEstimate) && local.dailyThroughputEstimate > 0 &&
      unaffordableCar.key === 'budget' && unaffordableCar.label.includes('car on S1') &&
      unaffordableCar.fundsGap === CONFIG.costs.car && unaffordableCar.runwayDays === 2 &&
      unaffordableCar.detail.includes('about 2 days away') &&
      unaffordableShaft.key === 'budget' && unaffordableShaft.label === 'save for a second shaft' &&
      unaffordableShaft.runwayDays === 2 && noRunway.runwayDays === null &&
      noRunway.detail.includes('Run one day to establish an earnings runway'),
      'transport response did not distinguish car, shaft, and local-route actions');
  },

  'transport response favors broader local coverage over a narrower car response'() {
    const base = {
      floors: 4,
      units: [],
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [],
      escalators: [],
      shafts: [{ id: 7, slot: 1, bottom: 0, top: 3, cars: [{}] }],
    };
    const response = transportResponseRecommendation({
      ...base,
      people: [
        ...Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
        ...Array.from({ length: 5 }, () => ({ state: 'waiting', shaft: null, from: 3, to: 0 })),
      ],
    }, CONFIG);
    assert(response.key === 'local' && response.kind === 'escalator' &&
      response.basis === 'broader current coverage' && response.coveredTrips === 13 &&
      response.detail.includes('covers 13 current waits') && response.detail.includes('addresses 8 on that shaft') &&
      response.detail.includes('First wave handles 12 of those waits; 1 remain queued'),
      'transport response did not favor the route covering more current demand');
  },

  'transport response uses cost per covered wait when coverage ties'() {
    const response = transportResponseRecommendation({
      floors: 4,
      units: Array.from({ length: 20 }, (_, index) => ({ floor: Math.floor(index / 5), slot: 3 + index % 5 })),
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [{ id: 3, bottom: 0, top: 3, slot: 1 }],
      escalators: [],
      shafts: [{ id: 7, slot: 2, bottom: 0, top: 3, cars: [{}] }],
      people: Array.from({ length: 6 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    }, CONFIG);
    assert(response.key === 'local' && response.kind === 'stairs' &&
      response.basis === 'broader current coverage' && response.coveredTrips === 6 &&
      response.detail.includes('same 6 current waits') && response.detail.includes('about $0 per wait') &&
      response.detail.includes('Estimated travel time'),
      'transport response did not use cost efficiency as the equal-coverage tie-breaker');
  },

  'transport response respects first-wave capacity when span coverage is broader'() {
    const response = transportResponseRecommendation({
      floors: 4,
      units: Array.from({ length: 20 }, (_, index) => ({ floor: Math.floor(index / 5), slot: 3 + index % 5 })),
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [{ id: 3, bottom: 0, top: 3, slot: 1 }],
      escalators: [],
      shafts: [{ id: 7, slot: 2, bottom: 0, top: 3, cars: [{}] }],
      people: [
        ...Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
        ...Array.from({ length: 5 }, () => ({ state: 'waiting', shaft: null, from: 3, to: 0 })),
      ],
    }, CONFIG);
    assert(response.key === 'car' && response.kind === 'car' && response.basis === 'live queue',
      'transport response overvalued broad local span coverage despite a smaller first wave');
  },

  'unassigned waiting response names local versus elevator fixes'() {
    const base = {
      floors: 14,
      lobby: { slot: 0, slots: [0] },
      shafts: [],
      escalators: [],
      units: [],
      facilities: [],
    };
    const mixed = unassignedQueueResponse({
      ...base,
      stairs: [{ bottom: 0, top: 3 }],
      people: [
        { state: 'waiting', shaft: null, from: 3, to: 0 },
        { state: 'waiting', shaft: null, from: 5, to: 0 },
        { state: 'waiting', shaft: null, from: 13, to: 0 },
      ],
    }, CONFIG);
    const clear = unassignedQueueResponse({ ...base, stairs: [], people: [{ state: 'waiting', shaft: 7 }] }, CONFIG);
    const localQueue = unassignedQueueResponse({ ...base, stairs: [{ id: 3, bottom: 0, top: 3 }], people: [{ state: 'waiting', shaft: null, localRouteKind: 'stairs', localRouteId: 3, from: 3, to: 0 }] }, CONFIG);
    assert(mixed.key === 'mixed' && mixed.localFloors.includes(3) && mixed.buildableLocalFloors.includes(5) && mixed.elevatorFloors.includes(13) &&
      mixed.localBuildKind === 'escalator' && mixed.detail.includes('Use stairs for F3') && mixed.detail.includes('Build an escalator to serve F5') &&
      mixed.localBuildLegalTop === 11 && mixed.localBuildTargetTop === 5 && mixed.localBuildCost === CONFIG.costs.escalator + CONFIG.costs.escalatorPerFloor * 5 &&
      mixed.detail.includes('legal span F0–F11') && mixed.detail.includes('estimated cost to F5 $330,000') &&
      mixed.detail.includes('Build or extend an elevator shaft to reach F13') &&
      clear.key === 'clear' && clear.label === 'no missing route' &&
      localQueue.key === 'clear' && localQueue.detail.includes('elevator or local route'),
      'unassigned waiting response did not distinguish local-route and elevator fixes');
  },

  'local transport response chooses the faster route that covers pressure'() {
    const response = transportResponseRecommendation({
      floors: 4,
      units: [
        ...Array.from({ length: CONFIG.building.slotsPerFloor - 1 }, (_, slot) => ({ floor: 0, slot: slot + 1 })),
        ...Array.from({ length: CONFIG.building.slotsPerFloor - 1 }, (_, slot) => ({ floor: 1, slot: slot + 1 })),
      ],
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [{ bottom: 0, top: 3, slot: 1 }],
      escalators: [{ bottom: 0, top: 3, slot: 2 }],
      shafts: [{ id: 7, slot: 0, bottom: 0, top: 3, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    }, CONFIG);
    assert(response.key === 'local' && response.kind === 'escalator' &&
      response.coveredTrips === 8 && response.averageSeconds < 10 &&
      response.detail.includes('Estimated travel time'),
      'local transport response did not choose the faster useful route');
  },

  'local transport response skips a saturated route'() {
    const base = {
      floors: 4,
      units: Array.from({ length: CONFIG.building.slotsPerFloor - 1 }, (_, slot) => ({ floor: 3, slot: slot + 1 })),
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      shafts: [{ id: 7, slot: 0, bottom: 0, top: 3, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    };
    const alternate = transportResponseRecommendation({
      ...base,
      stairs: [{ id: 3, bottom: 0, top: 3, slot: 1 }],
      escalators: [{ id: 4, bottom: 0, top: 3, slot: 2 }],
      people: [
        ...base.people,
        ...Array.from({ length: CONFIG.stairs.capacity }, () => ({ state: 'walking', stairId: 3 })),
      ],
    }, CONFIG);
    const blocked = transportResponseRecommendation({
      ...base,
      stairs: [{ id: 3, bottom: 0, top: 3, slot: 1 }],
      escalators: [],
      people: [
        ...base.people,
        ...Array.from({ length: CONFIG.stairs.capacity }, () => ({ state: 'walking', stairId: 3 })),
      ],
    }, CONFIG);
    assert(alternate.key === 'local' && alternate.kind === 'escalator' && alternate.routeOccupancy === 0 &&
      blocked.key === 'blocked' && blocked.detail.includes('the stairs already are at simultaneous capacity') &&
      !blocked.detail.includes('Use stairs'),
      'transport response recommended a saturated local route');
  },

  'transport response uses sustained local-route history'() {
    const state = {
      floors: 4,
      units: Array.from({ length: CONFIG.building.slotsPerFloor - 1 }, (_, slot) => ({ floor: 3, slot: slot + 1 })),
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [{ id: 3, bottom: 0, top: 3, slot: 1 }],
      escalators: [{ id: 4, bottom: 0, top: 3, slot: 2 }],
      shafts: [{ id: 7, slot: 0, bottom: 0, top: 3, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    };
    const history = new Map([['stairs:3', [
      { day: 1, average: 4.4, peak: 6, capacity: CONFIG.stairs.capacity },
      { day: 2, average: 5.1, peak: 6, capacity: CONFIG.stairs.capacity },
    ]]]);
    const response = transportResponseRecommendation(state, CONFIG, null, history);
    const pressure = localRouteDailyPressure(history.get('stairs:3'));
    assert(pressure.sustained && pressure.label === 'sustained 2d' && response.key === 'local' &&
      response.kind === 'escalator' && response.basis === 'sustained local-route pressure' &&
      response.detail.includes('stairs has sustained 2d') && response.detail.includes('Use an escalator'),
      'transport response did not use sustained local-route history to choose an alternate');
  },

  'sustained local overflow guides a separate local-capacity response'() {
    const response = transportResponseRecommendation({
      floors: 4,
      units: Array.from({ length: 5 }, (_, slot) => ({ floor: 3, slot: slot + 3 })),
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [{ id: 3, bottom: 0, top: 3, slot: 1 }],
      escalators: [],
      shafts: [{ id: 7, slot: 0, bottom: 0, top: 3, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }],
      people: [],
      log: [
        { day: 1, localOverflowAverage: 0.4, localOverflowPeak: 1,
          localOverflowRoutes: [{ kind: 'stairs', routeId: 3, bottom: 0, top: 3, average: 0.4, peak: 1 }] },
        { day: 2, localOverflowAverage: 0.8, localOverflowPeak: 2,
          localOverflowRoutes: [{ kind: 'stairs', routeId: 3, bottom: 0, top: 3, average: 0.8, peak: 2 }] },
      ],
    }, CONFIG);
    assert(response.key === 'local' && response.kind === 'escalator' &&
      response.basis === 'sustained local overflow' && response.label === 'build an escalator' &&
      response.sourceRouteKind === 'stairs' && response.sourceRouteId === 3 &&
      response.sourceRouteBottom === 0 && response.sourceRouteTop === 3 &&
      response.detail.includes('stairs on F0–F3 has sustained local overflow 2d'),
      'sustained local overflow did not guide a separate local-capacity response');
  },

  'second-shaft response does not promise coverage beyond the legal span'() {
    const state = {
      floors: 4,
      units: Array.from({ length: CONFIG.building.slotsPerFloor - 1 }, (_, slot) => ({ floor: 3, slot: slot + 1 })),
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [],
      escalators: [],
      shafts: [{ id: 7, slot: 0, bottom: 0, top: 3, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
    };
    const response = transportResponseRecommendation(state, CONFIG);
    assert(response.key === 'blocked' && response.detail.includes('reaches only F2') &&
      response.detail.includes('pressure reaches F3'),
      'second-shaft response recommended a span that could not reach the pressured floor');
  },

  'shaft coverage comparison explains added versus parallel demand coverage'() {
    const parallel = shaftCoverageDemandComparison(0, 3, [{ bottom: 0, top: 3 }], [2, 3]);
    const added = shaftCoverageDemandComparison(0, 3, [{ bottom: 0, top: 1 }], [2, 3]);
    const missed = shaftCoverageDemandComparison(0, 2, [{ bottom: 0, top: 2 }], [3]);
    assert(parallel.key === 'parallel_capacity' && parallel.label.includes('F2–F3') &&
      added.key === 'adds_demand' && added.label.includes('F2–F3') &&
      missed.key === 'misses_demand' && missed.detail.includes('F3'),
      'shaft coverage comparison did not explain whether the proposed route serves demand');
  },

  'shaft investment comparison puts parallel capacity beside car capacity'() {
    const shaft = { id: 7, cars: [{}] };
    const state = { people: Array.from({ length: 12 }, () => ({ state: 'waiting', shaft: 7 })) };
    const comparison = shaftInvestmentComparison(shaft, 0, 3, state, CONFIG);
    const full = shaftInvestmentComparison({ id: 7, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }, 0, 3, state, CONFIG);
    assert(comparison.shaftFloors === 4 && comparison.shaftCapacityGain === CONFIG.elevator.capacity &&
      comparison.shaftCost === CONFIG.costs.shaft + CONFIG.costs.shaftPerFloor * 4 &&
      comparison.carAvailable === true && comparison.carCapacityGain === CONFIG.elevator.capacity &&
      comparison.carNextCapacity === comparison.carCurrentCapacity + CONFIG.elevator.capacity &&
      comparison.carReliefSeconds > 0 && full.carAvailable === false && full.carCapacityGain === 0,
      'shaft investment comparison did not quantify parallel shaft and car capacity');
  },

  'transport investment choices compare car and shaft paths'() {
    const state = {
      floors: 4,
      units: [],
      facilities: [],
      lobby: { slot: 0, slots: [0] },
      stairs: [],
      escalators: [],
      shafts: [{ id: 7, bottom: 0, top: 3, slot: 1, cars: [{}] }],
      people: Array.from({ length: 8 }, () => ({ state: 'waiting', shaft: 7, from: 3, to: 0 })),
      log: [],
      money: 500000,
    };
    const response = transportResponseRecommendation(state, CONFIG);
    const choices = transportInvestmentChoices(state, CONFIG, response);
    assert(choices.show && choices.recommended === 'car' && choices.car.available &&
      choices.car.cost === CONFIG.costs.car && choices.car.addedCapacity === CONFIG.elevator.capacity &&
      choices.car.nextCapacity === choices.car.currentCapacity + CONFIG.elevator.capacity &&
      choices.car.coveredTrips === 8 && choices.car.elevatorTripsRelieved === 8 &&
      choices.car.firstWaveCapacity === CONFIG.elevator.capacity && choices.car.firstWaveTrips === 8 && choices.car.overflowTrips === 0 &&
      choices.car.costPerCoveredWait === 17500 &&
      choices.car.coverageLabel.includes('coverage tie') &&
      choices.shaft.available && choices.shaft.cost === CONFIG.costs.shaft + CONFIG.costs.shaftPerFloor * 4 &&
      choices.shaft.startingCapacity === CONFIG.elevator.capacity && choices.shaft.coveredTrips === 8 &&
      choices.shaft.firstWaveCapacity === CONFIG.elevator.capacity && choices.shaft.firstWaveTrips === 8 && choices.shaft.overflowTrips === 0 &&
      choices.shaft.elevatorTripsRelieved === 8 && choices.shaft.costPerCoveredWait === 17250 &&
      choices.shaft.coverageLabel.includes('coverage tie') && choices.local.available &&
      choices.local.kind === 'stairs' && choices.local.capacity === CONFIG.stairs.capacity &&
      choices.local.speedSecondsPerFloor === CONFIG.stairs.walkSecondsPerFloor &&
      choices.local.addedCapacity === CONFIG.stairs.capacity && choices.local.currentCapacity === 0 &&
      choices.local.nextCapacity === CONFIG.stairs.capacity && choices.local.cost === CONFIG.costs.stairs + CONFIG.costs.stairsPerFloor * 3 &&
      choices.local.coveredTrips === 8 && choices.local.elevatorTripsRelieved === 8 &&
      choices.local.localTripsRelieved === 0 && choices.local.unassignedTripsRelieved === 0 &&
      choices.local.firstWaveCapacity === CONFIG.stairs.capacity && choices.local.firstWaveTrips === CONFIG.stairs.capacity && choices.local.overflowTrips === 2 &&
      choices.local.averageSeconds > 0 && choices.local.costPerCoveredWait === 17000 &&
      choices.local.coverageLabel.includes('coverage tie') &&
      choices.localOptions.length === 2 && choices.localOptions[1].kind === 'escalator' &&
      choices.localOptions[1].speedSecondsPerFloor === CONFIG.escalator.travelSecondsPerFloor &&
      choices.localOptions[1].capacity === CONFIG.escalator.capacity &&
      choices.localOptions[1].cost === CONFIG.costs.escalator + CONFIG.costs.escalatorPerFloor * 3 &&
      choices.localOptions[1].costPerCoveredWait === 33750 &&
      choices.localOptions[1].coveredTrips === 8 && choices.localOptions[1].elevatorTripsRelieved === 8 &&
      choices.localOptions[1].firstWaveCapacity === CONFIG.escalator.capacity && choices.localOptions[1].firstWaveTrips === 8 && choices.localOptions[1].overflowTrips === 0,
      'transport investment choices did not put comparable current-demand coverage beside each option');
    const selected = transportInvestmentChoices({ ...state, people: [] }, CONFIG, { kind: null }, null, 'shaft');
    assert(selected.show && selected.selected === 'shaft' && selected.recommended === null,
      'transport investment choices disappeared while the shaft tool was selected');
    const fullCarState = {
      ...state,
      shafts: [{ ...state.shafts[0], cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }],
      people: [],
    };
    const blockedCar = transportInvestmentChoices(fullCarState, CONFIG, { kind: 'shaft' });
    assert(!blockedCar.car.available && blockedCar.next?.kind === 'shaft' && blockedCar.shaft.available,
      'an unavailable car comparison did not point to the viable shaft response');
    const lowFunds = transportInvestmentChoices({ ...state, people: [], money: CONFIG.costs.shaft + CONFIG.costs.shaftPerFloor * 4 + 10 }, CONFIG, { kind: 'car', shaftId: 7 });
    assert(!lowFunds.car.affordable && lowFunds.car.fundsGap === CONFIG.costs.car - (CONFIG.costs.shaft + CONFIG.costs.shaftPerFloor * 4 + 10) &&
      lowFunds.next?.kind === 'shaft',
      'insufficient funds did not identify the affordable alternative investment');
  },

  'route placement status exposes blocked columns and full cars'() {
    const base = { floors: 4, units: [], facilities: [], lobby: null, stairs: [], escalators: [], shafts: [] };
    const blocked = {
      ...base,
      units: Array.from({ length: 4 }, (_, floor) => Array.from({ length: CONFIG.building.slotsPerFloor }, (_, slot) => ({ floor, slot }))).flat(),
    };
    const readyShaft = routePlacementStatus('shaft', 0, 3, base, CONFIG);
    const readySelectedShaft = routePlacementStatus('shaft', 0, 3, base, CONFIG, null, 2);
    const selectedBlockedShaft = routePlacementStatus('shaft', 0, 3, {
      ...base,
      units: Array.from({ length: 4 }, (_, floor) => ({ floor, slot: 2 })),
    }, CONFIG, null, 2);
    const blockedShaft = routePlacementStatus('shaft', 0, 3, blocked, CONFIG);
    const readyCar = routePlacementStatus('car', null, null, base, CONFIG, { cars: [{ riders: [] }] });
    const fullCar = routePlacementStatus('car', null, null, base, CONFIG, { cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) });
    const alternateState = {
      ...base,
      shafts: [{ id: 10, cars: Array.from({ length: CONFIG.elevator.maxCarsPerShaft }, () => ({})) }, { id: 11, cars: [{}] }],
    };
    const fullWithAlternate = routePlacementStatus('car', null, null, alternateState, CONFIG, alternateState.shafts[0]);
    assert(readyShaft.key === 'ready' && readySelectedShaft.key === 'ready' && readySelectedShaft.slot === 2 &&
      selectedBlockedShaft.key === 'blocked' && selectedBlockedShaft.detail.includes('selected column') &&
      blockedShaft.key === 'blocked' &&
      blockedShaft.alternative === 'free a route column' && readyCar.key === 'ready' &&
      fullCar.key === 'blocked' && fullCar.alternative === 'build a new shaft for more capacity' &&
      fullCar.alternativeAction.kind === 'shaft' && fullWithAlternate.alternative === 'try S2' &&
      fullWithAlternate.alternativeAction.kind === 'car' && fullWithAlternate.alternativeAction.shaftId === 11,
      'route placement status did not expose placement conflicts');
  },

  'shaft building honors an explicitly selected column'() {
    const state = boot(CONFIG, 77);
    state.floors = 4;
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, CONFIG).ok,
      'could not build lobby for explicit shaft-column test');
    const first = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3, slot: 1 }, CONFIG);
    const blocked = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3, slot: 1 }, CONFIG);
    const second = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3, slot: 2 }, CONFIG);
    assert(first.ok && state.shafts[0].slot === 1 && !blocked.ok &&
      blocked.reason.includes('selected shaft column') && second.ok && state.shafts[1].slot === 2,
      'shaft building did not honor the selected column');
  },

  'floor diagnosis change reports the next local reading'() {
    const improved = floorDiagnosisChange(
      { floor: 2, waiting: 9, tenants: 0, capacity: 36 },
      { floor: 2, waiting: 0, tenants: 6, capacity: 36 });
    const mixed = floorDiagnosisChange(
      { floor: 2, waiting: 9, tenants: 6, capacity: 36 },
      { floor: 2, waiting: 0, tenants: 0, capacity: 36 });
    assert(improved.key === 'improved' && improved.label === 'waiting 9 → 0 · tenants 0/36 → 6/36' &&
      improved.waitingDelta === -9 && improved.tenantDelta === 6 && mixed.key === 'mixed' &&
      floorDiagnosisChange({ floor: 1 }, { floor: 2 }) === null,
      'floor diagnosis change did not report the next local reading');
  },

  'floor diagnosis next action changes after the local result'() {
    const summary = { floor: 2, waiting: 6, vacantRooms: 1 };
    const improved = floorDiagnosisNextAction(summary, { key: 'improved', source: 'car' });
    const carFailed = floorDiagnosisNextAction(summary, { key: 'worsened', source: 'car' });
    const shaftFailed = floorDiagnosisNextAction(summary, { key: 'steady', source: 'shaft' });
    const vacancyFailed = floorDiagnosisNextAction({ floor: 2, waiting: 0, vacantRooms: 1 }, { key: 'steady', source: 'vacancy' });
    assert(improved.key === 'monitor' && improved.kind === null &&
      carFailed.key === 'alternate_transport' && carFailed.kind === 'shaft' && carFailed.reason.includes('separate vertical route') &&
      shaftFailed.kind === 'car' && shaftFailed.reason.includes('existing route') &&
      vacancyFailed.key === 'experience' && vacancyFailed.kind === 'vacancy',
      'floor diagnosis next action did not respond to the last local result');
  },

  'floor diagnosis marks only a same-day improvement as working'() {
    const result = { key: 'improved', afterDay: 4 };
    assert(floorDiagnosisWorkingState(result, 4)?.key === 'working' &&
      floorDiagnosisWorkingState(result, 4).label === 'working' &&
      floorDiagnosisWorkingState(result, 5) === null &&
      floorDiagnosisWorkingState({ key: 'worsened', afterDay: 4 }, 4) === null,
      'floor diagnosis working state did not expire or filter correctly');
  },

  'floor diagnosis working state can survive a focus change'() {
    const results = new Map([
      [1, { floor: 1, key: 'improved', afterDay: 4 }],
      [2, { floor: 2, key: 'worsened', afterDay: 4 }],
    ]);
    assert(floorDiagnosisWorkingState(results.get(1), 4)?.label === 'working' &&
      floorDiagnosisWorkingState(results.get(2), 4) === null &&
      floorDiagnosisWorkingState(results.get(1), 5) === null,
      'floor diagnosis working state was not independently retained per floor');
  },

  'floor diagnosis age cue distinguishes today from an older result'() {
    const result = { key: 'improved', afterDay: 4 };
    assert(floorDiagnosisAgeCue(result, 4)?.label === 'working today' &&
      floorDiagnosisAgeCue(result, 5)?.label === '1d old' &&
      floorDiagnosisAgeCue(result, 6)?.key === 'aged' &&
      floorDiagnosisAgeCue(result, 7) === null,
      'floor diagnosis age cue did not distinguish recent and expired results');
  },

  'floor diagnosis history keeps only completed player interventions'() {
    const first = { floor: 1, source: 'car', key: 'improved' };
    const ignored = { floor: 1, source: null, key: 'steady' };
    const history = rememberFloorDiagnosisResult([first], ignored, 2);
    const capped = rememberFloorDiagnosisResult(history, { floor: 2, source: 'shaft', key: 'worsened' }, 2);
    assert(history.length === 1 && capped.length === 2 && capped[0] === first && capped[1].source === 'shaft',
      'floor diagnosis history did not keep the compact intervention record');
  },

  'floor diagnosis warns before repeating a failed response'() {
    const history = [
      { floor: 1, source: 'car', key: 'steady' },
      { floor: 1, source: 'car', key: 'worsened' },
      { floor: 1, source: 'shaft', key: 'worsened' },
    ];
    const carWarning = floorDiagnosisRepeatedFailure(history, 1, 'car');
    const shaftWarning = floorDiagnosisRepeatedFailure(history, 1, 'shaft');
    const improved = floorDiagnosisRepeatedFailure([
      ...history,
      { floor: 1, source: 'car', key: 'improved' },
    ], 1, 'car');
    assert(carWarning?.key === 'repeat_failure' && carWarning.count === 2 && carWarning.latest === history[1] &&
      carWarning.detail.includes('choose a different response') &&
      shaftWarning === null && improved === null,
      'floor diagnosis did not detect a repeated failed response');
  },

  'tenant utilization delta reports percentage-point movement'() {
    assert(tenantUtilizationDelta(0.75, 0.5).label === 'Δ +25 pts' &&
      tenantUtilizationDelta(0.5, 0.75).label === 'Δ -25 pts' &&
      tenantUtilizationDelta(0.5, 0.5).key === 'steady' &&
      tenantUtilizationDelta(null, 0.5).key === 'unknown',
      'tenant utilization delta did not report day-over-day movement');
  },

  'tenant utilization trend keeps a compact oldest-to-newest sparkline'() {
    const trend = tenantUtilizationTrend([
      { day: 1, ratio: 0.25 },
      { day: 2, ratio: 0.5 },
      { day: 3, ratio: 0.75 },
      { day: 4, ratio: 1 },
    ], 3);
    assert(trend.entries.length === 3 && trend.bars.length === 3 && trend.key === 'improved' &&
      trend.value === 50 && trend.label === 'trend ▅▆█' &&
      tenantUtilizationTrend([], 3).key === 'unknown',
      'tenant utilization trend did not retain compact directional history');
  },

  'tenant utilization trend marks recovery readings distinctly'() {
    const trend = tenantUtilizationTrend([
      { day: 4, ratio: 0.25 },
      { day: 4, ratio: 0.5, event: 'recovery' },
    ]);
    assert(trend.segments.length === 2 && trend.segments[0].event === 'daily' &&
      trend.segments[1].event === 'recovery' && trend.segments[1].bar === '▅',
      'tenant utilization trend did not preserve a distinct recovery segment');
  },

  'tenant utilization history label exposes exact day percentages'() {
    assert(tenantUtilizationHistoryLabel([
      { day: 4, ratio: 0.5 },
      { day: 5, ratio: 0.75 },
    ]) === 'D4 50% · D5 75%' &&
      tenantUtilizationHistoryLabel([
        { day: 4, ratio: 0.5 },
        { day: 4, ratio: 0.75, event: 'recovery', change: 25 },
      ]) === 'D4 50% · R4 75% (+25 pts)' &&
      tenantUtilizationHistoryLabel([]) === 'no daily utilization history yet',
      'tenant utilization history label did not expose readable daily values');
  },

  'tenant utilization management hint points to the likely next check'() {
    const declining = tenantUtilizationTrend([
      { day: 1, ratio: 1 },
      { day: 2, ratio: 0.8 },
      { day: 3, ratio: 0.6 },
    ]);
    const vacancyHint = tenantUtilizationManagementHint(declining, { vacantRooms: 2, lowEvaluationRooms: 1 });
    const experienceHint = tenantUtilizationManagementHint(declining, { vacantRooms: 0, lowEvaluationRooms: 1 });
    assert(tenantUtilizationManagementHint({ key: 'steady', entries: [{}, {}] }).key === 'observe' &&
      vacancyHint.key === 'vacancies' && vacancyHint.action === 'vacancy' && vacancyHint.detail.includes('2 vacant rooms') &&
      experienceHint.key === 'experience' && experienceHint.action === 'experience' && experienceHint.detail.includes('low evaluation') &&
      tenantUtilizationManagementHint({ key: 'improved', entries: [{}, {}, {}] }).key === 'improved',
      'tenant utilization management hint did not prioritize an actionable cause');
  },

  'tenant utilization hint confirms the focused room clearly'() {
    assert(tenantUtilizationHintFocusLabel({ floor: 3, kind: 'office', occupied: true }) === 'F3 office room' &&
      tenantUtilizationHintFocusLabel({ floor: 2, kind: 'office', occupied: false }) === 'F2 office vacancy' &&
      tenantUtilizationHintFocusLabel(null) === 'selected room',
      'tenant utilization hint focus label did not identify the selected room');
  },

  'tenant utilization room context explains the focused room impact'() {
    const summary = { tenants: 6, capacity: 12 };
    const declining = { key: 'worsened', entries: [{}, {}, {}] };
    const vacant = tenantUtilizationRoomContext({ kind: 'office', heads: 6, occupied: false }, { score: 48 }, summary, declining, CONFIG);
    const atRisk = tenantUtilizationRoomContext({ kind: 'office', heads: 6, occupied: true }, { score: 48 }, summary, declining, CONFIG);
    assert(vacant.key === 'vacant' && vacant.detail.includes('adds 6 capacity but no tenants') &&
      atRisk.key === 'at_risk' && atRisk.detail.includes('contributes 6 tenants to 6/12') && atRisk.detail.includes('below the leasing threshold'),
      'tenant utilization room context did not connect room state to the tower warning');
  },

  'ready-room utilization recovery exposes a direct action gate'() {
    const readyHint = tenantUtilizationManagementHint({ key: 'worsened', entries: [{}, {}, {}] }, { vacantRooms: 1 });
    assert(tenantUtilizationRecoveryResult(0.25, 0.375).label === 'recovery +13 pts' &&
      tenantUtilizationRecoveryResult(null, 0.375).key === 'unknown' &&
      readyHint.action === 'vacancy' &&
      tenantUtilizationHintFocusLabel({ floor: 2, kind: 'office', occupied: false }) === 'F2 office vacancy',
      'ready-room utilization recovery did not retain the direct vacancy path');
  },

  'tenant utilization recovery summary reports the latest tenant gain'() {
    const summary = tenantUtilizationRecoverySummary([
      { day: 3, event: 'recovery', tenantGain: 4, change: 8 },
      { day: 4, event: 'recovery', tenantGain: 6, change: 13 },
    ]);
    const aged = tenantUtilizationRecoverySummary([
      { day: 4, event: 'recovery', tenantGain: 6, change: 13 },
    ], 5);
    const empty = tenantUtilizationRecoverySummary([]);
    assert(summary.key === 'improved' && summary.label === 'R +6 tenants' && summary.tenantGain === 6 && summary.utilizationChange === 13 &&
      aged.key === 'aged' && aged.label === 'last R +6 tenants' && aged.ageDays === 1 &&
      empty.key === 'none' && empty.label === '—',
      'tenant utilization recovery summary did not report the latest intervention');
  },

  'sustained low evaluation recommends a safe room response'() {
    assert(roomEvaluationResponse({ occupied: true }).key === 'inspect' &&
      roomEvaluationResponse({ occupied: false, renovated: false }).key === 'renovate' &&
      roomEvaluationResponse({ occupied: false, renovated: true }).label === 'inspect leasing blockers' &&
      roomEvaluationResponse(null) === null,
      'room response did not separate occupied inspection from vacant renovation');
  },

  'room health history stays compact after a sustained warning'() {
    const warning = (id) => ({
      actualUnitId: id,
      occupiedDay: 4,
      trend: [
        { day: 5, score: CONFIG.evaluation.relistMinScore - 4, occupied: true },
        { day: 6, score: CONFIG.evaluation.relistMinScore - 8, occupied: true },
      ],
    });
    let history = rememberRoomHealthHistory([], warning(1), { id: 1, floor: 2, kind: 'office', occupied: true }, CONFIG, 2);
    history = rememberRoomHealthHistory(history, warning(2), { id: 2, floor: 3, kind: 'office', occupied: true }, CONFIG, 2);
    history = rememberRoomHealthHistory(history, warning(3), { id: 3, floor: 4, kind: 'office', occupied: true }, CONFIG, 2);
    const refreshed = rememberRoomHealthHistory(history, warning(2), { id: 2, floor: 3, kind: 'office', occupied: true }, CONFIG, 2);
    assert(history.length === 2 && history[0].unitId === 2 && history[1].unitId === 3 &&
      refreshed.length === 2 && refreshed[0].unitId === 3 && refreshed[1].unitId === 2 &&
      refreshed[1].average < CONFIG.evaluation.relistMinScore &&
      refreshed[1].scoreAtRefresh === CONFIG.evaluation.relistMinScore - 8 &&
      refreshed[1].deltaAtRefresh === -2,
      'room health history did not keep the latest bounded warnings');
  },

  'room health history distinguishes active and resolved warnings'() {
    const state = withFloors(boot(CONFIG, 1), CONFIG);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, CONFIG).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, CONFIG).ok,
      'could not build room-health status fixture');
    const room = state.units[0];
    const entry = { unitId: room.id, floor: room.floor, kind: room.kind, day: 2, average: 44, readings: 2 };
    room.stress = CONFIG.units[room.kind].vacateAt;
    const active = roomHealthHistoryStatus(entry, state, room, CONFIG);
    room.stress = 0;
    const resolved = roomHealthHistoryStatus(entry, state, room, CONFIG);
    assert(active.key === 'active' && active.label === 'ACTIVE LOW EVAL' &&
      roomHealthHistoryAction(active, { occupied: false, renovated: false }).key === 'renovate' &&
      roomHealthHistoryAction(active, { occupied: true }).key === 'inspect' &&
      roomHealthHistoryChange(entry, active).label === 'worsened -20' &&
      resolved.key === 'resolved' && resolved.label === 'RESOLVED HISTORY' &&
      roomHealthHistoryAction(resolved, room).key === 'monitor' &&
      roomHealthHistoryChange(entry, resolved).key === 'improved' &&
      roomHealthHistoryAgeLabel(entry, { day: 2 }) === 'fresh' &&
      roomHealthHistoryAgeLabel(entry, { day: 5 }) === '3 days old' &&
      roomHealthHistoryUrgency(active, 1).key === 'active' &&
      roomHealthHistoryUrgency(active, 2).label === 'STALE ACTIVE LOW EVAL' &&
      roomHealthHistoryPriority(active, 2) === 0 &&
      roomHealthHistoryPriority(active, 1) === 1 &&
      roomHealthHistoryPriority(resolved, 5) === 2 &&
      roomHealthHistoryUrgency(resolved, 5).key === 'resolved' &&
      resolved.score >= CONFIG.evaluation.relistMinScore,
      'room health history did not reflect the room\'s current evaluation');
  },

  'combined ranking explains a top quality and mix tradeoff'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.evaluation.relistMinScore = 68;
    const makePreview = (floor, score, balanceDelta) => ({
      floor,
      available: true,
      evaluation: { score },
      mix: { balanceDelta },
    });
    const reason = tenantPlacementRankingReason([
      makePreview(5, 72, -3),
      makePreview(2, 64, 0),
    ], config);
    assert(reason === 'top combined pick: room quality passes the 68 minimum, but tenant-mix balance falls 3 pts; next lower category: mix-safe · quality warning on F2' &&
      tenantPlacementRankingReason([makePreview(5, 72, 0)], config) === '',
      'combined ranking did not explain a deliberate tradeoff against the next category');
  },

  'replacement previews exclude compared floors and keep open alternatives'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 4;
    const state = boot(config, 44);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok &&
      applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build replacement-preview route');
    let filled = 0;
    for (let index = 0; index < config.building.slotsPerFloor + 1; index++) {
      const built = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config);
      if (!built.ok) break;
      filled++;
    }
    const replacements = tenantPlacementReplacementPreviews(state, 'office', [3, 1], config);
    const condoReplacements = tenantPlacementReplacementPreviews(state, 'condo', [3, 1], config);
    const replacementDecision = tenantPlacementDecision(replacements[0], config);
    const decisionOrder = replacements.map((preview) => {
      const key = tenantPlacementDecision(preview, config).key;
      return key === 'aligned' ? 3 : key === 'mix_tradeoff' ? 2 : key === 'quality_warning' ? 1 : 0;
    });
    assert(filled > 0 && !replacements.some((preview) => preview.floor === 3 || preview.floor === 1) &&
      replacements.some((preview) => preview.floor === 2) &&
      !tenantPlacementFloorComparison(state, 'office', 3, config).available &&
      replacementDecision.key === 'aligned' && replacementDecision.label === 'quality + mix aligned' &&
      replacements[0].mix.targetShare === config.units.office.targetShare &&
      Number.isFinite(replacements[0].mix.balanceAfter) && condoReplacements.some((preview) => preview.floor === 2) &&
      condoReplacements[0].mix.targetShare === config.units.condo.targetShare &&
      decisionOrder.every((rank, index) => index === 0 || decisionOrder[index - 1] >= rank),
      'replacement previews did not preserve an open alternative after a floor filled');
  },

  'replacement previews rank combined decision strength before score'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 20;
    config.evaluation.relistMinScore = 68.5;
    const state = boot(config, 45);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok &&
      applyAction(state, { type: 'build_shaft', bottom: 0, top: 19 }, config).ok,
      'could not build decision-ranking route');
    for (let index = 0; index < config.building.slotsPerFloor + 1; index++) {
      if (!applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok) break;
    }
    const replacements = tenantPlacementReplacementPreviews(state, 'office', [1, 3], config);
    const strengths = replacements.map((preview) => {
      const key = tenantPlacementDecision(preview, config).key;
      return key === 'aligned' ? 3 : key === 'mix_tradeoff' ? 2 : key === 'quality_warning' ? 1 : 0;
    });
    const firstWarning = strengths.findIndex((strength) => strength < 3);
    assert(firstWarning > 0 && strengths.slice(0, firstWarning).every((strength) => strength === 3) &&
      strengths.slice(firstWarning).every((strength, index, values) => index === 0 || values[index - 1] >= strength),
      'replacement previews did not rank stronger combined decisions first');
  },

  'room evaluation combines access and stress'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 31);
    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
    assert(shaft.ok, shaft.reason);
    const near = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config);
    const far = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config);
    assert(near.ok && far.ok, 'could not build evaluation fixture');

    const nearScore = unitEvaluation(state, state.units[0], config);
    const farScore = unitEvaluation(state, state.units[1], config);
    assert(nearScore.score > farScore.score, 'farther room did not evaluate lower');
    assert(averageEvaluation(state, config) < nearScore.score, 'average did not include access differences');

    state.units[0].stress = config.units.office.vacateAt * 0.8;
    assert(unitEvaluation(state, state.units[0], config).score < nearScore.score,
      'stress did not lower room evaluation');
  },

  'higher floors receive a capped view desirability bonus'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 20;
    const state = boot(config, 33);
    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 19 }, config);
    assert(shaft.ok, shaft.reason);
    for (const floor of [1, 6, 19]) {
      const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor, slot: 1 }, config);
      assert(unit.ok, unit.reason);
    }
    const low = unitEvaluation(state, state.units[0], config);
    const middle = unitEvaluation(state, state.units[1], config);
    const high = unitEvaluation(state, state.units[2], config);
    assert(low.viewBonus === 2 && middle.viewBonus === config.evaluation.viewBonusCap,
      'view bonus did not scale with floor height');
    assert(middle.viewBonus === high.viewBonus && middle.score === high.score,
      'view bonus did not respect its cap');
    assert(middle.score > low.score, 'higher floor desirability did not improve evaluation');
  },

  'tenant floor preference is explicit and bounded'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 20;
    const state = boot(config, 35);
    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 19 }, config);
    assert(shaft.ok, shaft.reason);
    for (const floor of [3, 6, 19]) {
      const built = applyAction(state, { type: 'build_unit', kind: 'office', floor, slot: 1 }, config);
      assert(built.ok, built.reason);
    }
    const preferred = unitEvaluation(state, state.units[0], config);
    const middle = unitEvaluation(state, state.units[1], config);
    const high = unitEvaluation(state, state.units[2], config);
    assert(preferred.preferredFloor === config.units.office.preferredFloor && preferred.preferencePenalty === 0,
      'preferred floor did not produce a clear fit signal');
    assert(middle.preferencePenalty > 0 && high.preferencePenalty === config.evaluation.preferenceWeight,
      'floor preference did not penalize distant floors');
    assert(high.preferencePenalty === middle.preferencePenalty,
      'preference penalty was not bounded');
  },

  'mixed-use neighbors add one bounded layout bonus'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.stars.tiers[1].pop = 0;
    config.stars.tiers[2].pop = 0;
    const state = boot(config, 36);
    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
    assert(shaft.ok, shaft.reason);
    const office = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config);
    assert(office.ok, office.reason);
    const solo = unitEvaluation(state, state.units[0], config);
    assert(solo.layoutBonus === 0, 'single-use floor received a layout bonus');
    const condo = applyAction(state, { type: 'build_unit', kind: 'condo', floor: 3, slot: 2 }, config);
    assert(condo.ok, condo.reason);
    const mixed = unitEvaluation(state, state.units[0], config);
    assert(mixed.layoutBonus === config.evaluation.layoutBonus && mixed.score > solo.score,
      'mixed-use neighbor did not improve room layout quality');
    const third = applyAction(state, { type: 'build_unit', kind: 'shop', floor: 3, slot: 3 }, config);
    assert(third.ok, third.reason);
    assert(unitEvaluation(state, state.units[0], config).layoutBonus === config.evaluation.layoutBonus,
      'multiple mixed-use neighbors stacked the layout bonus');
  },

  'cafeteria coverage adds one clear amenity bonus without stacking'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 34);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build cafeteria evaluation shaft');
    const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config);
    assert(unit.ok, unit.reason);
    const before = unitEvaluation(state, state.units[0], config);
    assert(before.amenityBonus === 0, 'uncovered room received an amenity bonus');
    assert(applyAction(state, { type: 'build_facility', kind: 'food', floor: 2 }, config).ok,
      'could not build cafeteria');
    const after = unitEvaluation(state, state.units[0], config);
    assert(after.amenityBonus === config.evaluation.amenityWeight &&
      after.score - before.score === config.evaluation.foodWeight + config.evaluation.amenityWeight,
      'cafeteria did not add the expected need relief and amenity bonus');
    assert(applyAction(state, { type: 'build_facility', kind: 'food', floor: 3 }, config).ok,
      'could not build second cafeteria');
    assert(unitEvaluation(state, state.units[0], config).amenityBonus === config.evaluation.amenityWeight,
      'multiple cafeterias stacked the room amenity bonus');
  },

  'poor room evaluation blocks re-letting without a shaft'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    const state = boot(config, 32);
    // On the first storey, which stands on the ground: this fixture is about
    // a room with no shaft, and it must be buildable before there is one.
    const unit = applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config);
    assert(unit.ok, unit.reason);
    state.units[0].occupied = false;
    state.units[0].vacantDays = config.units.office.relistDays - 1;
    dayClose(state, config);
    assert(!state.units[0].occupied,
      'a room with no access relisted despite a zero evaluation');

    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
    assert(shaft.ok, shaft.reason);
    state.units[0].vacantDays = config.units.office.relistDays - 1;
    const second = dayClose(state, config);
    assert(second.movedIn === 1 && state.units[0].occupied,
      'an accessible vacant room did not relist');
  },
};
