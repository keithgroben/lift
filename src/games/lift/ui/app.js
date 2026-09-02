import { CONFIG } from '../config.js';
import { basementDepth, boot, step, applyAction, lowestFloor, population, starTier, unlocked } from '../sim/index.js';
import { averageEvaluation, boundedEvaluationTrend, conversionPreview, evaluationDrift, firstWavePressure, floorDiagnosisAgeCue, floorDiagnosisChange, floorDiagnosisNextAction, floorDiagnosisRepeatedFailure, floorHandoffPreview, floorOperationsSummary, hotelBookingFeedback, hotelExperienceHistory, hotelExperienceSummary, hotelGuestExperience, hotelServiceSummary, indicatorColorKey, leaseStatus, leasingForecast, marketDemandBonus, rememberFloorDiagnosisResult, rememberRoomHealthHistory, rememberShopTrafficFollowup, reputationDemandFactor, reputationHistory, reputationRecommendation, roomEvaluationResponse, roomHealthHistoryAction, roomHealthHistoryAge, roomHealthHistoryAgeLabel, roomHealthHistoryChange, roomHealthHistoryPriority, roomHealthHistoryStatus, roomHealthHistoryUrgency, routePlacementStatus, shaftBuildControlStatus, shaftCapacityProjection, shaftCandidateCoverageLabel, shaftPlacementProjection, shaftQueueReliefProjection, shaftQueueReliefRecommendation, shaftRouteCoverageLabel, shopTrafficEstimate, shopTrafficFollowupCountAccessibleLabel, shopTrafficFollowupCountLabel, shopTrafficFollowupFilterAccessibleLabel, shopTrafficFollowupFilterButtonLabel, shopTrafficFollowupFilterLabel, shopTrafficFollowupOutcome, shopTrafficFollowupResult, shopTrafficFollowupScoreAccessibleLabel, shopTrafficFollowupScoreDetail, shopTrafficFollowupScopeAccessibleLabel, shopTrafficFollowupStatus, shopTrafficFollowupSummary, shopTrafficFollowupSummaryHeading, shopTrafficFollowupWindow, shopTrafficHistory, shopTrafficLastCloseAggregate, shopTrafficLastCloseDetail, shopTrafficLastCloseRevenueDetail, shopTrafficPeriodsAccessibleLabel, shopTrafficPeriodsHeading, shopTrafficPeriodsHeadingAccessibleLabel, shopTrafficPeriodsLegendLabel, shopTrafficResponseFilterId, shopTrafficServedDelta, shopTrafficServedTodayDetail, sustainedLowEvaluation, tenantDemandForecast, tenantFloorMix, tenantLeasingHistory, tenantLoadStatus, tenantLoadSummary, tenantMixDemand, tenantMixDiagnosis, tenantMixHistory, tenantMixResponse, tenantPlacementAlternativeReason, tenantPlacementComparisonChoice, tenantPlacementDecision, tenantPlacementDecisionReason, tenantPlacementFloorComparison, tenantPlacementInvestmentPreview, tenantPlacementInvestmentReason, tenantPlacementMixPreview, tenantPlacementPreview, tenantPlacementRankingReason, tenantPlacementReplacementPreviews, tenantPlacementSmallestInvestment, tenantUtilizationDelta, tenantUtilizationHistoryLabel, tenantUtilizationHintFocusLabel, tenantUtilizationManagementHint, tenantUtilizationRecoveryResult, tenantUtilizationRecoverySummary, tenantUtilizationRoomContext, tenantUtilizationTrend, transportCoverageText, unitEvaluation, vacancyRecoveryComparison } from '../sim/evaluation.js';
import { clampRentLevel, rentForLevel } from '../sim/pricing.js';
import { makeRng } from '../sim/rng.js';
import { foodDemand, medicalDemand, parkingDemand, recyclingDemand, securityDemand } from '../sim/services.js';
import { localRouteOccupancy } from '../sim/demand.js';
import { appendServiceRoomStatusHistory, localRouteTargetStatus, makeRenderer, placementGuideFloorStatus, serviceFocusCoverage, serviceFocusCoveredRoomDetails, serviceFocusCoveredRoomLabel, serviceFocusUncoveredRoomLabel, serviceFloorHeadcountCause, serviceRoomHealthSignal, serviceRoomStatus, serviceRoomStatusTrend, serviceRoomTrendAction, waitingPressure } from '../render/canvas.js';
import { makeJuice } from '../render/juice.js';
import { shaftQueueTrend } from '../sim/evaluation.js';
import { tenantLoadColorMeaning, waitingPressureColorMeaning } from '../sim/evaluation.js';
import { towerDesirabilitySummary } from '../sim/evaluation.js';
import { towerDesirabilityHistory, towerDesirabilityHistoryLabel, towerDesirabilityTrend, towerDesirabilityTrendDeltaLabel } from '../sim/evaluation.js';
import { shaftQueueForecastContext } from '../sim/evaluation.js';
import { queueDailyServiceSummary } from '../sim/evaluation.js';
import { shaftQueueDailyTrend } from '../sim/evaluation.js';
import { localRouteDailyTrend } from '../sim/evaluation.js';
import { localOverflowDailyTrend, localOverflowDailyPressure, localOverflowInterventionComparison, localOverflowInterventionHistorySummary, localOverflowInterventionNextAction, localOverflowInterventionTenantResult, rememberLocalOverflowInterventionHistory } from '../sim/evaluation.js';
import { localOverflowRouteHistory } from '../sim/evaluation.js';
import { shaftQueueDailyPressure } from '../sim/evaluation.js';
import { transportResponseRecommendation, unassignedQueueResponse } from '../sim/evaluation.js';
import { transportInvestmentChoices } from '../sim/evaluation.js';
import { shaftCoverageDemandComparison } from '../sim/evaluation.js';
import { shaftInvestmentComparison } from '../sim/evaluation.js';
import { tenantDemandQuality } from '../sim/evaluation.js';
import { shopTrafficTenantMixPreview } from '../sim/evaluation.js';
import { firstSessionPressureWarning, firstSessionRecoveryEvidence, firstSessionRecoveryReadings } from '../sim/evaluation.js';
import { tenantPlacementServiceNeeds } from '../sim/evaluation.js';
import { condoTransportPreview } from '../sim/evaluation.js';
import { vacancyPreFillChoiceSignal, vacancyPreFillConfirmationLines, vacancyPreFillOutcome, vacancyPreFillOutcomeSignal, vacancyPreFillOverrideGuidance, vacancyPreFillOverrideSignal, vacancyPreFillRankingLabel, vacancyPreFillResult, vacancyPreFillResultHistoryLabel, vacancyPreFillResultHistoryLines, rememberVacancyPreFillResultHistory, vacancyRankingAccessSummary, vacancyRankingGuidance, vacancyRankingReason } from '../sim/evaluation.js';
import { vacancyAppealChangeAction } from '../sim/evaluation.js';
import { vacancyAppealFactorValue } from '../sim/evaluation.js';
import { vacancyAppealFollowupResult, rememberVacancyAppealFollowupHistory } from '../sim/evaluation.js';
import { vacancyDemandSummary } from '../sim/evaluation.js';
import { tenantRetentionPressure } from '../sim/evaluation.js';
import { tenantRetentionHistory, tenantRetentionHistoryLabel, tenantRetentionTrend, tenantRetentionTrendDeltaLabel } from '../sim/evaluation.js';
import { tenantRetentionRecommendation } from '../sim/evaluation.js';
import { tenantAccessOutcomeForUnit } from '../sim/evaluation.js';
import { vacancyRankingSignalSummary } from '../sim/evaluation.js';
import { serviceCoverageChange, serviceCoverageSummary, servicePlacementBudgetImpact, servicePlacementComparison, servicePlacementCoveragePreview, servicePlacementRecommendation } from '../sim/evaluation.js';
import { cashRunwaySummary, expansionSafetySummary } from '../sim/evaluation.js';
import { appealWhyLine as appealWhyLineFor, weekLossPattern as weekLossPatternFor } from './hud/lines.js';
import { setHud } from './hud/store';
import { applyConfigPatch, restore, shouldAutosave, snapshot } from '../sim/save.js';
import { AUTOSAVE_KEY, deleteSave, listSaves, memoryOnlyKeys, newSaveKey, readSave, writeSave } from './save-store.js';
import { saves, setSaves, wireSaves } from './hud/saves-store';

const [, , GOOD, WARN, BAD, INFO] = CONFIG.feel.palette;
const indicatorPaletteColor = (key) => key === 'good' ? GOOD : key === 'bad' ? BAD : WARN;
const indicatorCssClass = (key) => key === 'good' ? 'diag-good' : key === 'bad' ? 'diag-bad' : 'diag-warn';

const canvas = document.getElementById('tower');
const renderer = makeRenderer(canvas, CONFIG);
const juice = makeJuice(CONFIG);

let state = boot(CONFIG, 1);
// Start safely paused so opening the game never launches a simulation workload
// before the player is ready. The player can press 1x, 4x, or 12x to begin.
let speed = 0;
/**
 * A new session opens on bare ground — `building.startFloors` is 0 — with the
 * entrance tool already armed, so the first click of a new game places the
 * lobby (spec/tower-view.md §4). `observe` is the disarmed, WATCHING state.
 */
const OPENING_TOOL = 'lobby';
let tool = OPENING_TOOL;
let rentKind = 'office';
let selectedUnitId = null;
let conversionTargetKind = null;
let renovationTargetId = null;
let rerentTargetId = null;
let demolitionTargetId = null;
// null, not -1: -1 is B1 now. A sentinel that collides with a real floor is
// how a hover in the earth reads as a hover on the first basement.
let hoverFloor = null;
let hoverSlot = -1;
// The room under the cursor, for the one line that says why its appeal is what
// it is (issue #11). Derived from the same pick as the rest of the hover state.
let hoverUnitId = null;
let hoverShaftId = null;
let hoverFacilityId = null;
let selectedShaftId = null;
let recommendedShaftId = null;
let routeTarget = null;
let transportFocusTarget = null;
let selectedFloor = null;
let floorHandoff = null;
let floorDiagnosisBaseline = null;
let floorDiagnosisResult = null;
let floorDiagnosisResults = new Map();
let floorDiagnosisHistory = [];
let placementWarning = null;
let placementNotice = null;
let serviceResultBudget = null;
let investmentTarget = null;
let shopDiagnosisContext = null;
let shopDemandFollowupHistory = [];
let shopResponseFilterId = null;
let shopTrafficBaselineAnnounced = false;
let shopTrafficBaselineDay = null;
let investmentOutcome = null;
let investmentOutcomeTimer = null;
let serviceOutcomeHistory = [];
let serviceRoomStatusHistory = [];
let serviceFocusTarget = null;
let roomHealthHistory = [];
let vacancyAppealFollowups = [];
let vacancyAppealFollowupHistory = [];
let comparisonFloors = [];
let pinnedComparisonFloor = null;
let tenantUtilizationBaseline = null;
let tenantUtilizationChange = null;
let tenantUtilizationHistory = [];
let lastVacancyPreFillResult = null;
let vacancyPreFillResultHistory = [];
let lastConfirmationOutcome = null;
let managementHintConfirmation = null;
let lastWaitingNow = null;
let lastCarQueueSignature = null;
let lastCarForecastContextKey = null;
let lastCarQueueSampleMinute = null;
let carQueueHistory = new Map();
let carQueueDailyHistory = new Map();
let carQueueDailyAccumulator = new Map();
let lastLocalRouteSignature = null;
let localRouteDailyHistory = new Map();
let localRouteDailyAccumulator = new Map();
let routeInterventionOutcome = null;
let routeInterventionHistory = [];
let firstSessionLivePressure = null;
let restartArmed = false;

/**
 * Every action is recorded. Because the sim is deterministic and seeded, this
 * log replays your exact session against new tuning — which is the only way to
 * ask "did that change help ME play, or just help the autoplayer?"
 */
let tape = [];

/** Autosave bookkeeping. `null` means this tower has never been written. */
let lastAutosaveDay = null;
let lastAutosaveAt = 0;
/** Bumped whenever a different tower goes on screen, so a write that is still
 *  in flight can tell it no longer belongs to the game being played. */
let sessionId = 0;

function act(type, extra = {}) {
  const action = { type, ...extra };
  const r = applyAction(state, action, CONFIG);
  if (r.ok) {
    tape.push({ day: state.day, tod: +state.tod.toFixed(4), ...action });
  } else {
    toast(r.reason, BAD);
  }
  refresh();
  return r;
}

// -------------------------------------------------------- placement preview
/**
 * "Would this land, and if not, why?" — answered by the real rules. The action
 * runs against a throwaway copy of the state and the copy is dropped, so the
 * ghost IS the click, discarded before it counts. There is deliberately no
 * second implementation of the placement rules here to drift out of sync.
 */
function cloneForDryRun(source) {
  // structuredClone cannot carry the rng's closures, and a dry run must never
  // advance the real seeded stream anyway — replay depends on that stream.
  const { rng, ...rest } = source;
  const copy = structuredClone(rest);
  copy.rng = makeRng(rng.seed);
  return copy;
}

/** Funds large enough that only the non-money rules can still refuse. */
const DRY_RUN_FUNDS = 1e15;

/**
 * @param {object|object[]} actions one action, or a chain applied in order
 * @returns {{ok: boolean, reason?: string, slot?: number, cost: number|null, short: number}}
 */
function dryRun(actions) {
  const chain = Array.isArray(actions) ? actions : [actions];
  try {
    const probe = cloneForDryRun(state);
    let result = { ok: true };
    for (const action of chain) {
      result = applyAction(probe, action, CONFIG);
      if (!result.ok) break;
    }
    // Ask the same question again with the price taken out of it. If it passes
    // then, money is the only thing wrong — and the copy's own ledger reports
    // what the price actually is, so nothing here has to recompute a cost.
    const funded = cloneForDryRun(state);
    funded.money = DRY_RUN_FUNDS;
    let affordable = { ok: true };
    for (const action of chain) {
      affordable = applyAction(funded, action, CONFIG);
      if (!affordable.ok) break;
    }
    const cost = affordable.ok ? funded.today.spent - state.today.spent : null;
    const short = !result.ok && affordable.ok && cost != null ? Math.max(0, cost - state.money) : 0;
    return { ...result, cost, short };
  } catch (error) {
    return { ok: false, reason: 'this placement could not be previewed', cost: null, short: 0 };
  }
}

/** Why the ghost is red, in the player's terms. */
const placementReason = (verdict) =>
  verdict.short > 0 ? money(verdict.short) + ' short' : (verdict.reason || 'cannot be placed here');

/**
 * The floor a build click lands on. `renderer.floorAt` only reports storeys
 * that already exist, and a new session now has none, so the ground row —
 * where the lobby goes — would be unclickable. Ground is always a legal
 * target; everything above it still has to be built first.
 */
/**
 * The floor a build click means, which is not the same as the floor under the
 * cursor. Two rows exist to be built on before they exist to be picked:
 *
 *  - the GROUND row, on bare ground, or the first click of a new game has
 *    nowhere to land; and
 *  - the row immediately ABOVE THE ROOF, because a room carries its own
 *    storey now (spec/tower-view.md §4). Without this the sim rule is
 *    unreachable from the interface — the tower could only ever be one
 *    storey tall.
 *
 * One row above the roof, never two, matching `build_unit`: a room needs
 * something under it, and a click into open sky is still nothing.
 */
function pickBuildFloor(px, py) {
  const floor = renderer.floorAt(state, px, py);
  if (floor != null) return floor;
  const L = renderer.layout(state);
  const rowAt = (row) => {
    const y = L.floorY(row);
    return py >= y && py <= y + L.fh ? row : null;
  };
  return rowAt(CONFIG.building.lobbyFloor ?? 0) ?? rowAt(state.floors);
}

const spotAt = (px, py) => ({
  floor: pickBuildFloor(px, py),
  slot: renderer.slotAt(state, px),
  unitId: renderer.unitAt(state, px, py),
  shaftId: renderer.shaftAt(state, px, py),
});

/**
 * What the armed tool would apply at a spot in the tower. ONE mapping, read by
 * both the ghost and the click, so a green ghost cannot mean something other
 * than the click that follows it. `blocked` carries the few gates that are the
 * interface's own (a lobby belongs on the ground) rather than the sim's.
 */
function armedAction(toolKey, spot) {
  const ground = CONFIG.building.lobbyFloor ?? 0;
  const { floor, slot, unitId, shaftId } = spot;
  if (toolKey === 'dig') {
    return { actions: [{ type: 'dig_basement' }], row: lowestFloor(state) - 1 };
  }
  if (toolKey === 'lobby' || toolKey === 'lobby_wing') {
    if (floor !== ground) return { blocked: 'the lobby belongs on the ground floor' };
    if (slot < 0) return { blocked: 'choose a ground-floor slot' };
    if (toolKey === 'lobby_wing' || state.lobby) return { actions: [{ type: 'expand_lobby', slot }] };
    // The lot is free: `build_lobby` raises the ground storey itself and does
    // not charge for it. You buy the entrance, not the dirt under it.
    return { actions: [{ type: 'build_lobby', slot }] };
  }
  if (toolKey === 'demolish') {
    if (unitId == null) return { blocked: 'click a room to demolish' };
    return { actions: [{ type: 'demolish_unit', id: unitId }], unitId };
  }
  if (toolKey === 'car') {
    if (shaftId == null) return { blocked: state.shafts.length ? 'click an elevator shaft' : 'build a shaft first' };
    return { actions: [{ type: 'add_car', id: shaftId }], shaftId };
  }
  if (toolKey === 'shaft' || toolKey === 'express') {
    if (slot < 0) return { blocked: 'choose a building column' };
    return {
      actions: [{ type: 'build_shaft', bottom: ground, top: floor, slot, kind: toolKey === 'express' ? 'express' : 'local' }],
      column: { slot, bottom: ground, top: floor },
    };
  }
  if (toolKey === 'stairs' || toolKey === 'escalator') {
    return {
      actions: [{ type: toolKey === 'stairs' ? 'build_stairs' : 'build_escalator', bottom: ground, top: floor }],
      column: { slot, bottom: ground, top: floor },
    };
  }
  if (floor == null || slot < 0) return null;
  if (CONFIG.services?.[toolKey]) return { actions: [{ type: 'build_facility', kind: toolKey, floor, slot }] };
  if (CONFIG.units[toolKey]) return { actions: [{ type: 'build_unit', kind: toolKey, floor, slot }] };
  return null;
}

/** The armed tool's verdict at a spot; ghost and click read the same answer. */
function placementVerdict(toolKey, spot) {
  const armed = armedAction(toolKey, spot);
  if (!armed) return null;
  if (armed.blocked) return { armed, verdict: { ok: false, reason: armed.blocked, cost: null, short: 0 } };
  return { armed, verdict: dryRun(armed.actions) };
}

let ghostSpot = null;
let lastGhostKey = null;
// The camera half of the ghost's cache, and the verdict it is drawing. Kept
// apart so a pan or a zoom repositions the box without paying for a dry run.
let lastGhostViewKey = null;
let lastGhostPreview = null;

function ghostGeometry(armed, verdict, spot) {
  const L = renderer.layout(state);
  const cell = (floor, slot) => ({ x: L.x0 + slot * L.cw, y: L.floorY(floor), w: L.cw, h: L.fh });
  const column = (slot, bottom, top) => {
    const a = L.floorY(bottom), b = L.floorY(top);
    return { x: L.x0 + slot * L.cw, y: Math.min(a, b), w: L.cw, h: Math.abs(a - b) + L.fh };
  };
  if (Number.isInteger(armed.row)) return { x: L.x0, y: L.floorY(armed.row), w: L.cw * L.cols, h: L.fh };
  if (armed.shaftId != null) {
    const sh = state.shafts.find((candidate) => candidate.id === armed.shaftId);
    return sh ? column(sh.slot, sh.bottom, sh.top) : null;
  }
  if (armed.unitId != null) {
    const unit = state.units.find((candidate) => candidate.id === armed.unitId);
    return unit ? cell(unit.floor, unit.slot) : null;
  }
  if (armed.column) {
    // Stairs and escalators pick their own clear column; on a legal run the
    // dry run already reported which one, so the ghost stands where the real
    // thing will, not where the cursor happens to be.
    const slot = Number.isInteger(verdict.slot) ? verdict.slot : armed.column.slot;
    return slot < 0 ? null : column(slot, armed.column.bottom, armed.column.top);
  }
  return spot.floor == null || spot.slot < 0 ? null : cell(spot.floor, spot.slot);
}

/**
 * Draw the ghost under the cursor: green where the armed tool may land, red
 * with the reason where it may not. Recomputed only when the target or the
 * tower actually changed — a dry run copies the state, and the live refresh
 * runs five times a second.
 */
function updateGhost() {
  const ghost = els['build-ghost'];
  if (!ghost) return;
  if (!ghostSpot || tool === 'observe') {
    lastGhostKey = null;
    lastGhostViewKey = null;
    lastGhostPreview = null;
    ghost.hidden = true;
    return;
  }
  // Two caches, because the two halves change for different reasons.
  //
  // The VERDICT depends on the target and the tower, and costs a dry run
  // (a structuredClone of the whole state), so it is recomputed only when one
  // of those actually changes.
  //
  // The RECTANGLE depends on the camera as well: it is in screen pixels, and
  // zooming or panning moves and resizes it without changing the target at
  // all. Keying both halves off the same string is why a ghost armed at 1x
  // kept its small box after a zoom until the cursor left the canvas and came
  // back — the only thing that used to invalidate the cache was a mousemove.
  const key = [tool, ghostSpot.floor, ghostSpot.slot, ghostSpot.unitId, ghostSpot.shaftId,
    state.money, state.floors, lowestFloor(state), state.units.length, state.facilities.length,
    state.shafts.length, state.stairs.length, state.escalators.length, Boolean(state.lobby)].join('|');
  const cam = renderer.camera;
  const viewKey = [cam.x, cam.y, cam.zoom].join('|');
  if (key === lastGhostKey && viewKey === lastGhostViewKey) return;
  if (key !== lastGhostKey) lastGhostPreview = placementVerdict(tool, ghostSpot);
  lastGhostKey = key;
  lastGhostViewKey = viewKey;
  const preview = lastGhostPreview;
  const rect = preview && ghostGeometry(preview.armed, preview.verdict, ghostSpot);
  if (!rect) { ghost.hidden = true; return; }
  const { verdict } = preview;
  ghost.hidden = false;
  ghost.classList.toggle('blocked', !verdict.ok);
  ghost.style.left = rect.x + 'px';
  ghost.style.top = rect.y + 'px';
  ghost.style.width = rect.w + 'px';
  ghost.style.height = rect.h + 'px';
  els['build-ghost-reason'].textContent = verdict.ok
    ? tool.toUpperCase().replace('_', ' ') + (Number.isFinite(verdict.cost) ? ' · ' + money(verdict.cost) : '')
    : placementReason(verdict);
}

/** Back to WATCHING. `Esc`, right-click, and the cancel control all land here. */
function disarmTool(announce = false) {
  if (tool === 'observe') return;
  tool = 'observe';
  placementWarning = null;
  investmentTarget = null;
  transportFocusTarget = null;
  recommendedShaftId = null;
  routeTarget = null;
  refresh();
  setMode();
  if (announce) toast('tool put away', INFO);
}

// ---------------------------------------------------------------- game loop
// The simulation still advances on its fixed timestep, but expensive visual
// work does not need to run at a 144Hz monitor's refresh rate. Keeping the
// player-facing render and DOM refreshes bounded prevents the prototype from
// monopolizing a machine while preserving deterministic simulation behavior.
const RENDER_INTERVAL_MS = 1000 / 30;
const LIVE_REFRESH_INTERVAL_MS = 200;
let last = performance.now(), acc = 0;
let lastRenderAt = 0;
let lastLiveRefreshAt = -Infinity;
let liveRefreshPending = false;

function requestLiveRefresh() {
  liveRefreshPending = true;
}

function flushLiveRefresh(now) {
  if (!liveRefreshPending || now - lastLiveRefreshAt < LIVE_REFRESH_INTERVAL_MS) return;
  liveRefreshPending = false;
  lastLiveRefreshAt = now;
  refresh();
}

function frame(now) {
  const dtMs = Math.min(120, now - last);
  last = now;

  // Fixed timestep. The sim NEVER sees a variable dt, so a dropped frame or a
  // 144Hz monitor cannot change the outcome or break a replay.
  acc += (dtMs / 1000) * speed;
  let guard = 0;
  while (acc >= CONFIG.time.dt && guard++ < 600) {
    const before = state.units.filter((u) => u.occupied).length;
    const closed = step(state, CONFIG.time.dt, CONFIG);
    acc -= CONFIG.time.dt;
    if (closed) onDayClose(closed, before);
  }

  const renderElapsed = now - lastRenderAt;
  if (lastRenderAt === 0 || renderElapsed >= RENDER_INTERVAL_MS) {
    lastRenderAt = now;
    updateWaitingNowIndicator();
    updateCarQueuePreview();
    flushLiveRefresh(now);
    const renderDtMs = Math.min(120, Math.max(0, renderElapsed));
    juice.update(renderDtMs);
    renderer.draw(state, juice, renderDtMs, placementGuideTarget(), hoverFloor, shaftCanvasTarget(), serviceFocusTarget, hoverFacilityId, selectedShaftId, hoverShaftId, carQueueHistory);
    // The ghost is a DOM overlay in screen pixels, so it has to follow the
    // camera every frame the camera moves. Cheap: both cache keys are
    // unchanged on a still view and this returns immediately.
    updateGhost();
  }
  requestAnimationFrame(frame);
}

function onDayClose(closed, occupiedBefore) {
  // A day closing is the natural save point: the ledger has settled and the
  // tower is not mid-trip. Gated on wall clock too, or 12x would write a
  // multi-megabyte snapshot every 3.75 seconds (sim/save.js: shouldAutosave).
  if (shouldAutosave({ day: state.day, now: Date.now(), lastSavedDay: lastAutosaveDay, lastSavedAt: lastAutosaveAt })) {
    autosave();
  }
  recordCarQueueDay(closed.day);
  recordLocalRouteDay(closed.day);
  if (routeInterventionOutcome?.placed && !routeInterventionOutcome.after) {
    const source = routeInterventionOutcome.sourceRoute;
    const history = localOverflowRouteHistory(state.log, source.kind, source.id);
    const latest = history.at(-1) ?? { day: closed.day, localOverflowAverage: 0, localOverflowPeak: 0 };
    const alternate = routeInterventionOutcome.targetRoute
      ? localOverflowRouteHistory(state.log, routeInterventionOutcome.targetRoute.kind, routeInterventionOutcome.targetRoute.id).at(-1)
      : { day: closed.day, localOverflowAverage: 0, localOverflowPeak: 0 };
    const tenantAfter = currentRouteInterventionTenantReading();
    const completedOutcome = {
      ...routeInterventionOutcome,
      after: {
        day: latest.day,
        average: latest.localOverflowAverage,
        peak: latest.localOverflowPeak,
      },
      alternateAfter: {
        day: alternate?.day ?? closed.day,
        average: alternate?.localOverflowAverage ?? 0,
        peak: alternate?.localOverflowPeak ?? 0,
      },
      result: localOverflowInterventionComparison(routeInterventionOutcome.before, latest, alternate),
      tenantAfter,
      tenantResult: localOverflowInterventionTenantResult(
        routeInterventionOutcome.tenantBefore,
        tenantAfter,
      ),
    };
    routeInterventionOutcome = completedOutcome;
    routeInterventionHistory = rememberLocalOverflowInterventionHistory(routeInterventionHistory, {
      day: closed.day,
      sourceRoute: completedOutcome.sourceRoute,
      targetRoute: completedOutcome.targetRoute,
      result: completedOutcome.result,
      tenantResult: completedOutcome.tenantResult,
    });
    closed.routeIntervention = {
      sourceRoute: completedOutcome.sourceRoute,
      targetRoute: completedOutcome.targetRoute,
      result: completedOutcome.result,
      tenantResult: completedOutcome.tenantResult,
    };
  }
  const net = closed.net;
  if (serviceResultBudget && !serviceResultBudget.realized && closed.day >= serviceResultBudget.builtDay) {
    const realized = {
      day: closed.day,
      net: closed.net,
      upkeep: closed.upkeep,
      serviceUpkeep: closed.serviceUpkeep ?? 0,
      desirability: closed.desirability,
      deliveryRate: closed.deliveryRate,
      rep: closed.rep,
    };
    serviceResultBudget = { ...serviceResultBudget, realized };
    for (let i = serviceOutcomeHistory.length - 1; i >= 0; i--) {
      const entry = serviceOutcomeHistory[i];
      if (entry.kind !== serviceResultBudget.kind || entry.floor !== serviceResultBudget.floor || entry.day !== serviceResultBudget.builtDay) continue;
      const targetUnit = entry.targetUnitId == null
        ? null
        : state.units.find((unit) => unit.id === entry.targetUnitId);
      const realizedTargetDesirability = targetUnit
        ? unitEvaluation(state, targetUnit, CONFIG).score
        : entry.targetDesirabilityAfter;
      serviceOutcomeHistory[i] = {
        ...entry,
        realizedDay: realized.day,
        realizedNet: realized.net,
        realizedUpkeep: realized.upkeep,
        realizedServiceUpkeep: realized.serviceUpkeep,
        realizedDesirability: realized.desirability,
        realizedDeliveryRate: realized.deliveryRate,
        realizedRep: realized.rep,
        realizedTargetDesirability,
      };
      break;
    }
    if (placementNotice) placementNotice = serviceBudgetResultText(serviceResultBudget);
  }
  const completedVacancyAppealFollowups = [];
  vacancyAppealFollowups = vacancyAppealFollowups.filter((followup) => {
    const result = vacancyAppealFollowupResult(followup, state, closed, CONFIG);
    if (!result) return true;
    const completed = { ...followup, result };
    completedVacancyAppealFollowups.push(completed);
    return false;
  });
  for (const followup of completedVacancyAppealFollowups) {
    vacancyAppealFollowupHistory = rememberVacancyAppealFollowupHistory(vacancyAppealFollowupHistory, followup, 3);
  }
  const latestVacancyAppealFollowup = completedVacancyAppealFollowups.at(-1);
  if (latestVacancyAppealFollowup?.result) placementNotice = latestVacancyAppealFollowup.result.detail + ' on F' + latestVacancyAppealFollowup.floor + '.';
  const [w, h] = renderer.size;
  juice.float(w / 2, h * 0.28, (net >= 0 ? '+$' : '-$') + Math.abs(net), net >= 0 ? GOOD : BAD);

  if (closed.vacated > 0) {
    juice.kick(CONFIG.feel.shakeOnVacate * Math.min(3, closed.vacated));
    toast(closed.vacated + ' tenant' + (closed.vacated > 1 ? 's' : '') + ' walked out', BAD);
  }
  if (closed.starAwards?.length) {
    const message = closed.starAwards.map((award) =>
      award.name + ' reached · +' + money(award.reward)).join(' · ');
    toast(message, WARN);
  }
  for (const u of state.units) {
    if (!u.occupied) continue;
    const [x, y] = renderer.unitPos(state, u);
    if (u.stress > CONFIG.units[u.kind].vacateAt * 0.7) juice.pulse(x, y, WARN, 18);
  }
  if (state.over) toast('BANKRUPT on day ' + state.day + ' — press R to restart', BAD);
  if (closed.shopTraffic?.length) {
    shopTrafficBaselineDay = closed.day;
    if (!shopTrafficBaselineAnnounced) {
      shopTrafficBaselineAnnounced = true;
      toast('SHOP BASELINE READY · today vs last close is now available', INFO);
    }
  }
  recordFirstDayOutcome(closed.day);
  recordServiceRoomStatus(closed.day);
  shopDemandFollowupHistory = shopDemandFollowupHistory.map((followup) => {
    const result = shopTrafficFollowupResult(followup, closed);
    return result ? { ...followup, result } : followup;
  });
  const currentTenantRatio = tenantLoadSummary(state, CONFIG).ratio;
  tenantUtilizationChange = tenantUtilizationDelta(currentTenantRatio, tenantUtilizationBaseline);
  tenantUtilizationBaseline = currentTenantRatio;
  tenantUtilizationHistory = [...tenantUtilizationHistory, { day: state.day, ratio: currentTenantRatio }].slice(-6);
  if (selectedFloor != null && floorDiagnosisBaseline?.floor === selectedFloor) {
    const nextFloorReading = floorOperationsSummary(state, selectedFloor, CONFIG);
    const change = floorDiagnosisChange(floorDiagnosisBaseline, nextFloorReading);
    floorDiagnosisResult = change
      ? { floor: selectedFloor, ...change, beforeDay: floorDiagnosisBaseline.day, afterDay: state.day, source: floorDiagnosisBaseline.source }
      : null;
    if (floorDiagnosisResult) floorDiagnosisResults.set(selectedFloor, floorDiagnosisResult);
    else floorDiagnosisResults.delete(selectedFloor);
    floorDiagnosisHistory = rememberFloorDiagnosisResult(floorDiagnosisHistory, floorDiagnosisResult);
    floorDiagnosisHistory = rememberFloorDiagnosisResult(floorDiagnosisHistory, floorDiagnosisResult);
    floorHandoff = null;
    // Keep the completed result visible until the player starts a new test.
    // A fresh source-less baseline on the next day would erase the handoff
    // that the next-action recommendation needs to choose an alternative.
    floorDiagnosisBaseline = null;
  }
  refresh();
}

// ---------------------------------------------------------------------- HUD
const els = {};
for (const id of ['build', 'build-ghost', 'build-ghost-reason', 'expansion-safety', 'log', 'knobs', 'mode', 'cancel-tool', 'goal-copy', 'transport', 'rent-control', 'rent-kind', 'rent-value', 'facility-inspector', 'shaft-inspector', 'unit-inspector', 'unit-title', 'unit-appeal-why', 'unit-status', 'unit-detail', 'unit-utilization-context', 'conversion-controls', 'renovate-unit', 'rerent-unit', 'demolish-unit', 'cancel-confirmation', 'recovery-warning', 'rerent-reason', 'placement-guide-legend', 'placement-preview', 'beta-path', 'developer-toggle', 'developer-panel', 'time-controls', 'appeal-toggle', 'quick-action', 'quick-action-button', 'quick-action-detail', 'restart-game', 'open-saves'])
  els[id] = document.getElementById(id);

let developerMode = false;
function setDeveloperMode(open) {
  developerMode = Boolean(open);
  els['developer-panel'].hidden = !developerMode;
  els['developer-toggle'].setAttribute('aria-expanded', String(developerMode));
  els['developer-toggle'].textContent = developerMode ? 'hide developer details' : 'show developer details';
  if (developerMode) requestLiveRefresh();
}
els['developer-toggle'].addEventListener('click', () => setDeveloperMode(!developerMode));

/**
 * The appeal view (issue #12), and the ONE place the renderer's overlay is
 * turned on or off. `A` and the bar's toggle both come through here, so the
 * button's pressed state cannot drift out of step with what the tower is
 * actually drawing — a second source of truth for "is the overlay on" is
 * exactly the kind of thing today has been spent deleting.
 */
function toggleAppealOverlay() {
  const on = renderer.toggleAppealOverlay();
  // `aria-pressed` alone, and the CSS styles off it: a separate `.active` class
  // would be a second thing to keep in step with the first.
  els['appeal-toggle'].setAttribute('aria-pressed', String(on));
  toast(on ? 'appeal view — every room tinted by room appeal' : 'appeal view off', INFO);
  return on;
}
els['appeal-toggle'].addEventListener('click', () => toggleAppealOverlay());
els['restart-game'].addEventListener('click', () => {
  if (!restartArmed) {
    restartArmed = true;
    els['restart-game'].textContent = 'confirm new session';
    els['restart-game'].classList.add('armed');
    toast('click confirm new session to reset this tower', WARN);
    setTimeout(() => {
      restartArmed = false;
      els['restart-game'].textContent = 'new session';
      els['restart-game'].classList.remove('armed');
    }, 4000);
    return;
  }
  restartArmed = false;
  els['restart-game'].textContent = 'new session';
  els['restart-game'].classList.remove('armed');
  restart();
});
els['cancel-tool'].addEventListener('click', () => disarmTool());

function updateTimeControls() {
  for (const button of els['time-controls'].querySelectorAll('button[data-speed]')) {
    const selected = Number(button.dataset.speed) === speed;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}
els['time-controls'].addEventListener('click', (event) => {
  const button = event.target.closest('button[data-speed]');
  if (!button) return;
  speed = Number(button.dataset.speed);
  updateTimeControls();
  toast(speed === 0 ? 'paused' : speed + 'x', INFO);
});

function updateQuickAction(recommendation, transportResponse) {
  const control = transportResponse.key !== 'monitor' && !transportResponse.existing && transportResponse.control
    ? transportResponse.control
    : null;
  const button = control
    ? els.build.querySelector('[data-do="' + control + '"], [data-kind="' + control + '"], [data-facility="' + control + '"]')
    : null;
  const available = Boolean(button);
  els['quick-action'].hidden = !available;
  if (!available) {
    els['quick-action-button'].textContent = '—';
    els['quick-action-detail'].textContent = 'Watch the next reading before spending.';
    return;
  }
  els['quick-action-button'].textContent = transportResponse.label || recommendation.label || button.querySelector('.btn-label')?.textContent || 'take recommended action';
  els['quick-action-button'].disabled = button.disabled;
  els['quick-action-button'].title = transportResponse.detail || recommendation.detail || '';
  els['quick-action-detail'].textContent = transportResponse.detail || recommendation.detail || 'This is the recommended next step.';
  els['quick-action-button'].onclick = () => button.click();
}

const money = (n) => '$' + Math.round(n).toLocaleString();
const signedMoney = (n) => (n >= 0 ? '+' : '-') + money(Math.abs(n));
const resultClassForFollowup = (result) => result?.key === 'improved' ? 'diag-good' : result?.key === 'worsened' ? 'diag-bad' : 'diag-warn';

function serviceBudgetResultText(result) {
  const upkeepText = result.dailyUpkeep ? ' · +' + money(result.dailyUpkeep) + '/day upkeep' : '';
  const targetText = result.targetUnitId == null
    ? ''
    : ' · target F' + result.targetFloor + ' ' + result.targetKind + ' (' + result.targetTenantLoad + ' tenants)';
  const realizedText = result.realized
    ? ' · D' + result.realized.day + ' realized ' + signedMoney(result.realized.net) + ' net · upkeep ' + money(result.realized.upkeep) +
      ' (services ' + money(result.realized.serviceUpkeep) + ')'
    : ' · realized result after first day close';
  return result.label + ' placed on F' + result.floor + targetText + ' — it covers ' + result.coverage + ' · upfront ' + money(result.upfrontCost) + upkeepText + realizedText + '.';
}

/**
 * Issues #11 and #12. Both sentences are built in `hud/lines.js` — pure, no
 * DOM, so the copy a player acts on is tested by reading the sentence rather
 * than by reading the source that builds it. These wrappers only bind them to
 * the live `state` and `CONFIG`.
 */
const appealWhyLine = (unit) => appealWhyLineFor(state, unit, CONFIG);
const weekLossPattern = () => weekLossPatternFor(state, CONFIG);

function updateWaitingNowIndicator() {
  const waitingNow = state.people.filter((person) => person.state === 'waiting').length;
  if (waitingNow === lastWaitingNow) return false;
  lastWaitingNow = waitingNow;
  const pressure = waitingPressure(waitingNow);
  const waitingHeadlineLabel = 'W ' + waitingNow + ' waiting people; ' + waitingPressureColorMeaning(pressure.band) + ' across all floors';
  setHud({
    waitingNow: {
      text: 'W ' + waitingNow,
      color: indicatorPaletteColor(pressure.colorKey),
      title: waitingHeadlineLabel,
      ariaLabel: waitingHeadlineLabel,
    },
  });
  return true;
}

function carQueueSignature() {
  const queues = new Map();
  for (const person of state.people) {
    if (person.state !== 'waiting' || person.shaft == null) continue;
    queues.set(person.shaft, (queues.get(person.shaft) || 0) + 1);
  }
  return {
    queues,
    signature: state.shafts.map((shaft) => shaft.id + ':' + (queues.get(shaft.id) || 0)).join('|'),
  };
}

function localRouteSnapshot() {
  const routes = [
    ...(state.escalators ?? []).map((route) => ({ kind: 'escalator', route })),
    ...(state.stairs ?? []).map((route) => ({ kind: 'stairs', route })),
  ];
  const occupancy = new Map();
  for (const { kind, route } of routes) {
    occupancy.set(kind + ':' + route.id, localRouteOccupancy(state, kind, route.id));
  }
  return {
    routes,
    occupancy,
    signature: routes.map(({ kind, route }) => kind + ':' + route.id + ':' + occupancy.get(kind + ':' + route.id)).join('|'),
  };
}

function localRouteReachableWaiting(route) {
  return state.people.filter((person) => {
    if (person.state !== 'waiting') return false;
    const from = Number(person.from);
    const to = Number(person.to);
    return Number.isFinite(from) && Number.isFinite(to) &&
      route.bottom <= Math.min(from, to) && route.top >= Math.max(from, to);
  }).length;
}

function localRouteCapacity(kind) {
  return Math.max(1, Math.floor(Number(CONFIG?.[kind]?.capacity) || 0));
}

function recordLocalRouteSample(snapshot) {
  for (const { kind, route } of snapshot.routes) {
    const key = kind + ':' + route.id;
    const count = snapshot.occupancy.get(key) || 0;
    const previous = localRouteDailyAccumulator.get(key);
    const accumulator = previous?.day === state.day
      ? previous
      : { day: state.day, sum: 0, samples: 0, peak: 0 };
    accumulator.sum += count;
    accumulator.samples++;
    accumulator.peak = Math.max(accumulator.peak, count);
    localRouteDailyAccumulator.set(key, accumulator);
  }
}

function recordLocalRouteDay(day) {
  const snapshot = localRouteSnapshot();
  for (const { kind, route } of snapshot.routes) {
    const key = kind + ':' + route.id;
    const accumulator = localRouteDailyAccumulator.get(key);
    const current = snapshot.occupancy.get(key) || 0;
    const samples = accumulator?.day === day ? accumulator.samples : 0;
    const average = samples ? accumulator.sum / samples : current;
    const peak = samples ? accumulator.peak : current;
    const history = localRouteDailyHistory.get(key) || [];
    localRouteDailyHistory.set(key, [...history, {
      day,
      average: +average.toFixed(2),
      peak,
      capacity: localRouteCapacity(kind),
      samples,
    }].slice(-6));
    localRouteDailyAccumulator.delete(key);
  }
}

function recordCarQueueSample(snapshot) {
  for (const shaft of state.shafts) {
    const count = snapshot.queues.get(shaft.id) || 0;
    const history = carQueueHistory.get(shaft.id) || [];
    carQueueHistory.set(shaft.id, [...history, { count, day: state.day, tod: state.tod }].slice(-8));
    const previous = carQueueDailyAccumulator.get(shaft.id);
    const accumulator = previous?.day === state.day
      ? previous
      : { day: state.day, sum: 0, samples: 0, peak: 0 };
    accumulator.sum += count;
    accumulator.samples++;
    accumulator.peak = Math.max(accumulator.peak, count);
    carQueueDailyAccumulator.set(shaft.id, accumulator);
  }
}

function recordCarQueueDay(day) {
  const snapshot = carQueueSignature();
  for (const shaft of state.shafts) {
    const accumulator = carQueueDailyAccumulator.get(shaft.id);
    const current = snapshot.queues.get(shaft.id) || 0;
    const samples = accumulator?.day === day ? accumulator.samples : 0;
    const average = samples ? accumulator.sum / samples : current;
    const peak = samples ? accumulator.peak : current;
    const history = carQueueDailyHistory.get(shaft.id) || [];
    carQueueDailyHistory.set(shaft.id, [...history, {
      day,
      average: +average.toFixed(2),
      peak,
      samples,
    }].slice(-6));
    carQueueDailyAccumulator.delete(shaft.id);
  }
}

function updateCarQueuePreview() {
  // Queue previews feed only the car tool and opt-in diagnostics. Avoid scanning
  // every person and local route 30 times a second during ordinary play.
  if (!developerMode && tool !== 'car') return;
  const snapshot = carQueueSignature();
  const localSnapshot = localRouteSnapshot();
  const queueChanged = snapshot.signature !== lastCarQueueSignature;
  const localChanged = localSnapshot.signature !== lastLocalRouteSignature;
  const forecastContext = shaftQueueForecastContext(state.day, state.tod, speed, CONFIG);
  const contextChanged = forecastContext.label !== lastCarForecastContextKey;
  const simulationMinute = Number(state.day) * 1440 + Number(state.tod) * 1440;
  const sampleDue = lastCarQueueSampleMinute == null ||
    simulationMinute - lastCarQueueSampleMinute >= forecastContext.sampleIntervalMinutes;
  if (sampleDue) {
    recordCarQueueSample(snapshot);
    recordLocalRouteSample(localSnapshot);
    lastCarQueueSampleMinute = simulationMinute;
  }
  lastCarQueueSignature = snapshot.signature;
  lastLocalRouteSignature = localSnapshot.signature;
  lastCarForecastContextKey = forecastContext.label;
  if (tool !== 'car') {
    if (developerMode && (localChanged || sampleDue)) requestLiveRefresh();
    return;
  }
  let targetChanged = false;
  const lockedCarTarget = transportFocusTarget?.kind === 'car' &&
    state.shafts.some((shaft) => shaft.id === transportFocusTarget.shaftId && shaft.cars.length < CONFIG.elevator.maxCarsPerShaft);
  if (hoverShaftId == null && !lockedCarTarget) {
    const recommendation = shaftQueueReliefRecommendation(state, CONFIG, carQueueDailyHistory);
    const nextTarget = recommendation.bestShaftId;
    targetChanged = nextTarget !== recommendedShaftId || routeTarget?.shaftId !== nextTarget;
    if (targetChanged) {
      recommendedShaftId = nextTarget;
      routeTarget = nextTarget == null ? null : { kind: 'car', shaftId: nextTarget };
      setMode();
    }
  }
  if (!targetChanged && !queueChanged && !contextChanged && !sampleDue && !localChanged) return;
  if (developerMode) renderTransport();
  renderInvestmentPreview();
}

function carToolModeText() {
  const targetShaft = recommendedShaftId == null
    ? null
    : state.shafts.find((shaft) => shaft.id === recommendedShaftId);
  if (!targetShaft) {
    return 'CAR selected — click an elevator shaft to add it.';
  }
  const shaftNumber = state.shafts.indexOf(targetShaft) + 1;
  const currentCapacity = targetShaft.cars.length * CONFIG.elevator.capacity;
  const projectedCapacity = currentCapacity + CONFIG.elevator.capacity;
  return 'CAR selected · S' + shaftNumber + ' selected · dispatch capacity ' + currentCapacity +
    ' → ' + projectedCapacity + ' riders · click the highlighted shaft to confirm.';
}

function modeText() {
  if (placementNotice) return placementNotice;
  if (tool === 'observe') return 'WATCHING — let the next rush run, or choose a build action above.';
  if (tool === 'demolish') return 'DEMOLISH selected — click a vacant room to clear its slot. Esc puts the tool away.';
  if (tool === 'dig') {
    return 'DIG selected — click to sink B' + (basementDepth(state) + 1) +
      '. Underground slots are cheaper and less appealing, and a shaft has to reach them.';
  }
  if (tool === 'lobby') return 'LOBBY selected — click the ground floor to place it. It buys the ground storey it stands on.';
  if (tool === 'lobby_wing') return 'LOBBY WING selected — click an open ground-floor slot to expand it.';
  if (tool === 'shaft') {
    const target = hoverFloor > (CONFIG.building.lobbyFloor ?? 0)
      ? { floor: hoverFloor, slot: hoverSlot }
      : shaftToolTarget();
    const pressureText = target?.pressureFloors?.length
      ? ' for pressure at ' + target.pressureFloors.map((floor) => 'F' + floor).join(', ')
      : '';
    const targetText = target?.floor != null
      ? target.recommended ? ' · recommended top F' + target.floor + pressureText : ' · target F' + target.floor
      : '';
    const targetCost = target?.cost ?? (target?.floor != null
      ? shaftCost(target.floor)
      : null);
    const costText = targetCost == null ? '' : ' · cost ' + money(targetCost);
    const projection = target?.floor != null
      ? shaftPlacementProjection(CONFIG.building.lobbyFloor ?? 0, target.floor, CONFIG)
      : null;
    const capacityText = projection?.floors >= 2
      ? ' · covers ' + projection.floors + ' floors · included: ' + projection.startingCars + ' car / ' + projection.startingCapacity + ' riders per dispatch · ' + (projection.additionalCars
        ? 'add ' + projection.additionalCars + ' cars at ' + money(projection.carCost) + ' each for +' + projection.additionalCapacity + ' riders per dispatch'
        : 'car limit reached')
      : '';
    const fundsText = targetCost != null && state.money < targetCost
      ? ' · NOT ENOUGH MONEY (need ' + money(targetCost) + ', have ' + money(state.money) + ')'
      : '';
    const columnText = hoverSlot >= 0
      ? ' · column ' + (hoverSlot + 1) + ' selected'
      : ' · hover a column to choose its placement';
    return 'SHAFT selected — choose a clear column, then click its top floor.' + targetText + columnText + costText + capacityText + fundsText + investmentContext('shaft');
  }
  if (tool === 'express') {
    const bottom = CONFIG.building.lobbyFloor ?? 0;
    const top = hoverFloor >= bottom + 2 ? hoverFloor : null;
    const costText = top == null ? '' : ' · target F' + top + ' · cost ' + money(expressCost(top));
    const fundsText = top != null && state.money < expressCost(top)
      ? ' · NOT ENOUGH MONEY (need ' + money(expressCost(top)) + ', have ' + money(state.money) + ')'
      : '';
    return 'EXPRESS selected — a nonstop shuttle from the lobby: choose a clear column, then click its sky-lobby floor.' +
      costText + ' · skips every floor between · ' + (CONFIG.elevator.express?.capacity ?? CONFIG.elevator.capacity) +
      ' riders per dispatch at double speed' + fundsText;
  }
  if (tool === 'car') return carToolModeText();
  if (tool === 'stairs' || tool === 'escalator') {
    const lockedTop = transportFocusTarget?.kind === tool && Number.isInteger(transportFocusTarget.floor)
      ? transportFocusTarget.floor : null;
    const targetText = lockedTop == null ? '' : ' · focused target F' + lockedTop;
    return tool.toUpperCase() + ' selected — click the top floor to place ' + (tool === 'stairs' ? 'them' : 'it') + '.' + targetText + investmentContext(tool);
  }
  if (tool === 'food') return 'CAFETERIA selected — click an upper floor to place it.' + servicePlacementWarningText('food') + investmentContext('food');
  if (tool === 'parking') return 'PARKING selected — click an upper floor to place it.' + servicePlacementWarningText('parking') + investmentContext('parking');
  if (tool === 'medical') return 'CLINIC selected — click an upper floor to place it.' + servicePlacementWarningText('medical') + investmentContext('medical');
  if (tool === 'security') return 'SECURITY selected — click an upper floor to place it.' + servicePlacementWarningText('security') + investmentContext('security');
  if (tool === 'recycling') return 'RECYCLING selected — click an upper floor to place it.' + servicePlacementWarningText('recycling') + investmentContext('recycling');
  if (CONFIG.units[tool]) {
    const preview = tenantPlacementPreview(tool, CONFIG);
    const mixPreview = tenantPlacementMixPreview(state, tool, CONFIG);
    const pinnedFit = pinnedFloorFitText(tool);
    const base = tool.toUpperCase() + ' selected — click an upper floor to place it · ' + preview.capacity + ' ' + preview.role +
      ' · target mix ' + Math.round(preview.targetShare * 100) + '%' + (pinnedFit ? ' · ' + pinnedFit : '');
    if (placementWarning && placementWarning.kind === tool) {
      if (placementWarning.shopDemand) {
        return base + ' · SHOP DEMAND WARNING F' + placementWarning.floor + ' adds ' + placementWarning.selectedCustomers +
          ' expected customers/day; recommended F' + placementWarning.recommendedFloor + ' adds ' + placementWarning.recommendedCustomers +
          ' · click F' + placementWarning.floor + ' again to confirm the weaker shop-demand placement';
      }
      if (placementWarning.full) {
        return base + ' · WARNING F' + placementWarning.floor + ' is full — choose another floor';
      }
      return base + ' · WARNING F' + placementWarning.floor + ' changes balance ' +
        placementWarning.balanceBefore + '% → ' + placementWarning.balanceAfter + '% · room eval ' +
        placementWarning.evaluationScore + '/100 · why: ' + placementWarning.why + ' · click F' +
        placementWarning.floor + ' again to confirm';
    }
    if (comparisonFloors.length === 1) {
      const selectedFloor = comparisonFloors[0];
      const selectedPreview = tenantPlacementFloorComparison(state, tool, selectedFloor, CONFIG);
      if (!selectedPreview.available) {
        return base + ' · compare F' + selectedFloor + ' unavailable: ' + selectedPreview.reason;
      }
      const selectedDecision = tenantPlacementDecision(selectedPreview, CONFIG);
      return base + ' · compare F' + selectedFloor + ' · ' + selectedDecision.label +
        ' · room eval ' + selectedPreview.evaluation.score + '/100 · demand +' + selectedPreview.demandQuality.bonus +
        ' · ' + selectedPreview.demandQuality.label + ' · ' + placementMixText(selectedPreview.mix);
    }
    if (hoverFloor === 0) return base + ' · F0 is lobby/access only';
    if (hoverFloor > 0 && hoverFloor < state.floors) {
      const floorPreview = tenantPlacementFloorComparison(state, tool, hoverFloor, CONFIG);
      if (!floorPreview.available) return base + ' · F' + hoverFloor + ' full';
      const evaluation = floorPreview.evaluation;
      const bestFloor = floorPreview.scoreDelta > 0
        ? floorPreview.scoreDelta + ' below best F' + floorPreview.bestFloor
        : 'best available';
      const decisionReason = floorPreview ? tenantPlacementDecisionReason(floorPreview, CONFIG) : null;
      return base + ' · F' + hoverFloor + ' available · room eval ' + evaluation.score + '/100 · demand +' + floorPreview.demandQuality.bonus + ' · ' +
        floorPreview.demandQuality.label + ' · ' +
        tenantPlacementDecision(floorPreview, CONFIG).label + (decisionReason ? ' · ' + decisionReason : '') + ' · ' +
        'mix ' + tool + ' ' + Math.round(mixPreview.currentShare * 100) + '% → ' +
        Math.round(mixPreview.projectedShare * 100) + '% / ' + Math.round(mixPreview.targetShare * 100) +
        '% target · why: ' + bestFloor + ' · ' + placementReasonText(tool, evaluation) +
        pinnedFloorDeltaText(tool, hoverFloor, evaluation);
    }
    return base;
  }
  return tool.toUpperCase() + ' selected — click an upper floor to place it.';
}

function shaftToolTarget() {
  if (routeTarget?.kind === 'shaft' && Number.isInteger(routeTarget.floor)) return routeTarget;
  const control = shaftBuildControlStatus(state, CONFIG);
  if (!Number.isInteger(control.top)) return null;
  const response = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
  const responseFloor = response.key === 'shaft' && Number.isInteger(response.targetFloor)
    ? response.targetFloor
    : null;
  const floor = responseFloor != null && responseFloor <= control.top ? responseFloor : control.top;
  return {
    kind: 'shaft',
    floor,
    recommended: responseFloor != null || control.key === 'shorter',
    pressureFloors: responseFloor != null ? response.targetFloors : [],
  };
}

function shaftCost(top) {
  const bottom = CONFIG.building.lobbyFloor ?? 0;
  return CONFIG.costs.shaft + CONFIG.costs.shaftPerFloor * Math.max(0, top - bottom + 1);
}

function expressCost(top) {
  const bottom = CONFIG.building.lobbyFloor ?? 0;
  return CONFIG.costs.expressShaft + CONFIG.costs.expressShaftPerFloor * Math.max(0, top - bottom + 1);
}

function shaftCanvasTarget() {
  if (tool !== 'shaft') return routeTarget;
  const bottom = CONFIG.building.lobbyFloor ?? 0;
  if (hoverFloor > bottom) return { kind: 'shaft', floor: hoverFloor, slot: hoverSlot };
  return shaftToolTarget();
}

function investmentContext(kind) {
  if (investmentTarget?.tool !== kind) return '';
  const guide = {
    kind,
    floor: investmentTarget.recommendedFloor ?? investmentTarget.floor,
    coverageFloor: investmentTarget.floor,
  };
  const hoverText = hoverFloor != null ? ' · hover F' + hoverFloor + ': ' + investmentHoverStatus(guide, hoverFloor) : '';
  if (CONFIG.services?.[kind]) {
    const cost = CONFIG.costs[kind];
    const dailyUpkeep = CONFIG.services[kind].dailyUpkeep ?? 0;
    const radius = CONFIG.services[kind].coverageFloors ?? 0;
    const low = Math.max(CONFIG.building.lobbyFloor + 1, investmentTarget.floor - radius);
    const high = Math.min(state.floors - 1, investmentTarget.floor + radius);
    const range = low === high ? 'F' + low : 'F' + low + '–F' + high;
    const recommended = investmentTarget.recommendedFloor != null
      ? ' · recommended F' + investmentTarget.recommendedFloor + (investmentTarget.recommendedDetail ? ' · ' + investmentTarget.recommendedDetail : '')
      : '';
    const targetUnit = investmentTarget.targetUnitId == null
      ? null
      : state.units.find((unit) => unit.id === investmentTarget.targetUnitId);
    const targetContext = targetUnit
      ? ' · target F' + targetUnit.floor + ' ' + targetUnit.kind + ' (' + Math.max(0, Math.round(targetUnit.heads ?? 0)) + ' tenants)'
      : '';
    const funds = Number.isFinite(cost)
      ? state.money < cost
        ? ' · NOT ENOUGH MONEY (need ' + money(cost) + ', have ' + money(state.money) + ')'
        : ' · cost ' + money(cost) + ' · funds ' + money(state.money)
      : '';
    const upkeep = dailyUpkeep ? ' · +' + money(dailyUpkeep) + '/day upkeep' : '';
    return ' · improvement target F' + investmentTarget.floor + targetContext + recommended + funds + upkeep + ' · place on ' + range + hoverText;
  }
  if (kind === 'shaft') return ' · improvement target F' + investmentTarget.floor + ' · reach F' + investmentTarget.floor + ' or higher' + hoverText;
  return ' · improvement target F' + investmentTarget.floor + hoverText;
}

function servicePlacementWarningText(kind) {
  if (placementWarning?.serviceCoverage !== true || placementWarning.kind !== kind) return '';
  return ' · WARNING F' + placementWarning.floor + ' is weaker than recommended F' + placementWarning.recommendedFloor +
    ' (' + placementWarning.comparison + ') · click F' + placementWarning.floor + ' again to confirm';
}

function investmentHoverStatus(guide, floor) {
  const status = placementGuideFloorStatus(guide, floor, state, CONFIG);
  if (status === 'outside') return 'outside target range';
  if (status === 'open') return floor === guide.floor ? 'TARGET open — click to place' : 'open — click to place';
  if (status === 'full') return floor === guide.floor ? 'TARGET full — choose another' : 'full — choose another';
  return floor === guide.floor ? 'TARGET blocked — choose another' : 'blocked — choose another';
}

function investmentPlacementIssue(kind, floor) {
  if (investmentTarget?.tool !== kind) return '';
  if (kind === 'shaft' && floor < investmentTarget.floor) {
    return 'click F' + investmentTarget.floor + ' or higher to reach the improvement target';
  }
  if (CONFIG.services?.[kind]) {
    const radius = CONFIG.services[kind].coverageFloors ?? 0;
    if (Math.abs(floor - investmentTarget.floor) > radius) {
      const low = Math.max(CONFIG.building.lobbyFloor + 1, investmentTarget.floor - radius);
      const high = Math.min(state.floors - 1, investmentTarget.floor + radius);
      return 'place ' + kind + ' on F' + low + (low === high ? '' : '–F' + high) + ' to cover F' + investmentTarget.floor;
    }
  }
  return '';
}

function hoverFloorSignalText() {
  if (hoverFloor == null || hoverFloor >= state.floors) return '';
  const summary = floorOperationsSummary(state, hoverFloor, CONFIG);
  const tenantStatus = summary.key === 'full' ? 'full' : summary.key === 'partial' ? 'partial' : 'light';
  return ' · W ' + summary.waiting + ' ' + summary.waitingBand + ' · T ' + summary.tenants + '/' + summary.capacity + ' ' + tenantStatus;
}

function hoverFacilitySignalText() {
  if (hoverFacilityId == null || (tool !== 'office' && tool !== 'observe')) return '';
  const facility = state.facilities?.find((candidate) => candidate.id === hoverFacilityId);
  if (!facility) return '';
  const label = facility.kind === 'food' ? 'CAFETERIA' : facility.kind === 'parking' ? 'PARKING'
    : facility.kind === 'medical' ? 'CLINIC' : facility.kind === 'security' ? 'SECURITY' : 'RECYCLING';
  return ' · ' + label + ' hovered · click to inspect coverage and upkeep';
}

function hoverShaftSignalText() {
  if (hoverShaftId == null || (tool !== 'office' && tool !== 'observe')) return '';
  const shaft = state.shafts.find((candidate) => candidate.id === hoverShaftId);
  if (!shaft) return '';
  const number = state.shafts.indexOf(shaft) + 1;
  return ' · S' + number + ' hovered · click to inspect cars, capacity, and queue';
}

function setMode(text, color = GOOD) {
  const displayText = text === undefined ? modeText() + hoverShaftSignalText() + hoverFacilitySignalText() + hoverFloorSignalText() : text;
  els.mode.textContent = displayText;
  els.mode.style.color = color;
  els.mode.style.borderColor = color;
}

function selectRouteAlternative(kind, shaftId = null, targetFloor = null, sourceRoute = null) {
  const targetId = Number(shaftId);
  const targetShaft = Number.isFinite(targetId)
    ? state.shafts.find((shaft) => shaft.id === targetId)
    : null;
  clearInvestmentOutcome();
  investmentTarget = null;
  placementWarning = null;
  if (sourceRoute && (kind === 'stairs' || kind === 'escalator')) {
    routeInterventionOutcome = {
      kind,
      sourceRoute,
      targetFloor,
      before: currentRouteOverflowReading(sourceRoute.kind, sourceRoute.id),
      tenantBefore: currentRouteInterventionTenantReading(),
      placed: false,
      after: null,
      result: null,
    };
  }
  if (kind === 'car') {
    if (!targetShaft || targetShaft.cars.length >= CONFIG.elevator.maxCarsPerShaft) {
      toast('that alternate shaft is no longer available', WARN);
      return;
    }
    tool = 'car';
    recommendedShaftId = targetShaft.id;
    transportFocusTarget = { kind: 'car', shaftId: targetShaft.id };
    routeTarget = { kind: 'car', shaftId: targetShaft.id };
    setMode(carToolModeText());
    toast('CAR selected for S' + (state.shafts.indexOf(targetShaft) + 1) + ' — click it to add the car', INFO);
  } else if (kind === 'shaft') {
    tool = 'shaft';
    recommendedShaftId = null;
    transportFocusTarget = Number.isInteger(targetFloor)
      ? { kind: 'shaft', floor: targetFloor }
      : null;
    routeTarget = Number.isInteger(targetFloor)
      ? { kind: 'shaft', floor: targetFloor, recommended: true }
      : { kind: 'shaft', floor: selectedFloor };
    setMode();
    toast('SHAFT selected — choose a clear column', INFO);
  } else if (kind === 'stairs' || kind === 'escalator') {
    tool = kind;
    recommendedShaftId = null;
    transportFocusTarget = Number.isInteger(targetFloor)
      ? { kind, floor: targetFloor }
      : null;
    routeTarget = Number.isInteger(targetFloor)
      ? { kind, floor: targetFloor, recommended: true }
      : null;
    setMode();
    toast(kind.toUpperCase() + ' selected — choose a clear column', INFO);
  } else {
    return;
  }
  refresh();
}

els.transport.addEventListener('click', (event) => {
  const routeOverflowAction = event.target.closest('button[data-route-overflow-action-kind]');
  if (routeOverflowAction) {
    const floor = Number(routeOverflowAction.dataset.routeOverflowActionFloor);
    const sourceId = Number(routeOverflowAction.dataset.routeOverflowSourceId);
    const sourceRoute = routeOverflowAction.dataset.routeOverflowSourceKind && Number.isFinite(sourceId)
      ? {
        kind: routeOverflowAction.dataset.routeOverflowSourceKind,
        id: sourceId,
        bottom: Number(routeOverflowAction.dataset.routeOverflowSourceBottom),
        top: Number(routeOverflowAction.dataset.routeOverflowSourceTop),
      }
      : null;
    selectRouteAlternative(routeOverflowAction.dataset.routeOverflowActionKind, null,
      Number.isInteger(floor) ? floor : null, sourceRoute);
    return;
  }
  const choice = event.target.closest('button[data-transport-choice]');
  if (!choice || choice.disabled) return;
  const kind = choice.dataset.transportChoice;
  if (kind === 'car') {
    selectRouteAlternative('car', Number(choice.dataset.transportShaft));
    return;
  }
  if (kind === 'shaft') {
    const floor = Number(choice.dataset.transportFloor);
    selectRouteAlternative('shaft', null, Number.isInteger(floor) ? floor : null);
    return;
  }
  if (kind === 'stairs' || kind === 'escalator') {
    const floor = Number(choice.dataset.transportFloor);
    selectRouteAlternative(kind, null, Number.isInteger(floor) ? floor : null);
  }
});

function appendRouteAlternative(element, placement) {
  const action = placement?.alternativeAction;
  if (!action) return;
  element.appendChild(document.createTextNode(' · '));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'outcome-action';
  button.dataset.routeAlternativeKind = action.kind;
  if (action.shaftId != null) button.dataset.routeAlternativeShaft = String(action.shaftId);
  button.addEventListener('click', () => selectRouteAlternative(action.kind, action.shaftId));
  button.textContent = action.kind === 'car' && action.shaftId != null
    ? 'select S' + (state.shafts.findIndex((shaft) => shaft.id === action.shaftId) + 1) + ' car'
    : 'select ' + action.kind;
  element.appendChild(button);
}

function renderInvestmentPreview() {
  const element = els['placement-preview'];
  element.classList.remove('coverage-strong', 'coverage-partial', 'coverage-flat', 'coverage-unavailable');
  element.style.borderColor = '';
  const shaftToolPreview = tool === 'shaft' && !investmentTarget && !investmentOutcome;
  const routeToolPreview = !investmentTarget && !investmentOutcome &&
    (tool === 'car' || tool === 'stairs' || tool === 'escalator');
  const shopDemandToolPreview = shopDiagnosisContext?.diagnosis === 'mix' && tool === 'office' &&
    !investmentTarget && !investmentOutcome;
  const condoPlacementPreview = tool === 'condo' && !investmentTarget && !investmentOutcome;
  if (!investmentTarget && !investmentOutcome && !shaftToolPreview && !routeToolPreview && !shopDemandToolPreview && !condoPlacementPreview) {
    element.hidden = true;
    element.textContent = '';
    return;
  }
  if (shopDemandToolPreview) {
    const preview = activeShopDemandPreview();
    const recommended = activeShopDemandPreview(null);
    element.hidden = false;
    if (!preview?.available) {
      element.textContent = 'SHOP DEMAND PREVIEW · ' + (preview?.reason ?? 'no nearby office placement available') + ' · choose an open upper floor';
      element.style.color = WARN;
      return;
    }
    const potentialCustomers = preview.potentialCustomersDelta >= 0
      ? '+' + preview.potentialCustomersDelta
      : String(preview.potentialCustomersDelta);
    const expectedCustomers = preview.expectedCustomersDelta >= 0
      ? '+' + preview.expectedCustomersDelta
      : String(preview.expectedCustomersDelta);
    const revenue = preview.expectedRevenueDelta >= 0
      ? '+' + money(preview.expectedRevenueDelta)
      : '-' + money(Math.abs(preview.expectedRevenueDelta));
    const fundsWarning = state.money < preview.cost
      ? ' · NOT ENOUGH MONEY (need ' + money(preview.cost) + ', have ' + money(state.money) + ')'
      : '';
    const recommendedGap = recommended?.available && preview.placementFloor !== recommended.placementFloor &&
      preview.expectedRevenueDelta < recommended.expectedRevenueDelta
      ? ' · recommended F' + recommended.placementFloor + ' adds ' + recommended.expectedCustomersDelta +
        ' expected customers/day instead'
      : '';
    element.textContent = 'SHOP DEMAND PREVIEW · add OFFICE on F' + preview.placementFloor +
      ' near target shop F' + preview.shopFloor + ' · cost ' + money(preview.cost) +
      ' · local potential ' + potentialCustomers + ' customers/day · expected delivered ' + expectedCustomers +
      ' · expected shop revenue ' + revenue + '/day · office eval ' + preview.officeEvaluation.score +
      recommendedGap + fundsWarning + ' · click an upper floor to place it';
    element.style.color = state.money < preview.cost ? BAD : preview.expectedCustomersDelta > 0 ? GOOD : WARN;
    return;
  }
  if (shaftToolPreview) {
    const bottom = CONFIG.building.lobbyFloor ?? 0;
    const maximumTop = Math.min(state.floors - 1, bottom + CONFIG.elevator.maxSpan - 1);
    const target = shaftToolTarget();
    const top = hoverFloor > bottom ? hoverFloor : target?.floor ?? maximumTop;
    const shaftResponse = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
    const spanWarning = top > maximumTop ? ' · exceeds the ' + CONFIG.elevator.maxSpan + '-floor shaft limit' : '';
    const coverage = shaftCandidateCoverageLabel(bottom, top, state.shafts);
    const placement = routePlacementStatus('shaft', bottom, top, state, CONFIG);
    const alternative = placement.alternative ? ' · alternative: ' + placement.alternative : '';
    const recommendation = hoverFloor <= bottom && target?.recommended
      ? target.pressureFloors?.length
        ? ' · recommended for pressure at ' + target.pressureFloors.map((floor) => 'F' + floor).join(', ')
        : ' · recommended shorter span'
      : '';
    const demandFloors = shaftResponse.targetFloors ?? [];
    const demandCoverage = shaftCoverageDemandComparison(bottom, top, state.shafts, demandFloors);
    const demandCoverageText = demandFloors.length ? ' · demand ' + demandCoverage.label : '';
    const comparisonShaft = state.shafts.find((shaft) => shaft.id === shaftResponse.shaftId) ?? state.shafts[0];
    const investmentComparison = comparisonShaft && (coverage.includes('overlaps') || demandFloors.length)
      ? shaftInvestmentComparison(comparisonShaft, bottom, top, state, CONFIG)
      : null;
    const investmentComparisonText = investmentComparison
      ? ' · compare S' + (state.shafts.indexOf(comparisonShaft) + 1) + ': new shaft ' + money(investmentComparison.shaftCost) + ' → +' + investmentComparison.shaftCapacityGain + ' riders/dispatch + separate route vs ' +
        (investmentComparison.carAvailable
          ? 'one car ' + money(investmentComparison.carCost) + ' → +' + investmentComparison.carCapacityGain + ' on the existing route'
          : 'one more car unavailable at the ' + CONFIG.elevator.maxCarsPerShaft + '-car limit') +
        (investmentComparison.carQueue > 0 && investmentComparison.carAvailable
          ? ' · wait ' + investmentComparison.carWaitBefore.toFixed(1) + 's → ' + investmentComparison.carWaitAfter.toFixed(1) + 's'
          : '')
      : '';
    const cost = shaftCost(top);
    const projection = shaftPlacementProjection(bottom, top, CONFIG);
    const capacityText = projection.floors >= 2
      ? ' · covers ' + projection.floors + ' floors · included: ' + projection.startingCars + ' car / ' + projection.startingCapacity + ' riders per dispatch · ' + (projection.additionalCars
        ? 'add ' + projection.additionalCars + ' cars at ' + money(projection.carCost) + ' each for +' + projection.additionalCapacity + ' riders per dispatch'
        : 'car limit reached')
      : '';
    const fundsWarning = state.money < cost ? ' · NOT ENOUGH MONEY (need ' + money(cost) + ', have ' + money(state.money) + ')' : '';
    element.hidden = false;
    const shopTargetText = shopDiagnosisContext?.diagnosis === 'transport'
      ? ' · shop traffic target F' + shopDiagnosisContext.floor
      : '';
    element.textContent = 'SHAFT COVERAGE PREVIEW · floors ' + bottom + '–' + top + ' · cost ' + money(cost) + capacityText + shopTargetText + ' · ' + coverage + demandCoverageText + investmentComparisonText + recommendation + spanWarning + fundsWarning + ' · ' + placement.detail + alternative + ' · click a top floor to place it';
    appendRouteAlternative(element, placement);
    const duplicateOnly = coverage.includes('duplicates') && demandCoverage.key !== 'parallel_capacity';
    element.style.color = state.money < cost ? BAD : placement.key === 'blocked' ? BAD : placement.key === 'invalid' || demandCoverage.key === 'misses_demand' ? WARN : duplicateOnly ? WARN : GOOD;
    return;
  }
  if (routeToolPreview) {
    element.hidden = false;
    if (tool === 'car') {
      const shaft = state.shafts.find((candidate) => candidate.id === hoverShaftId) ??
        state.shafts.find((candidate) => candidate.id === recommendedShaftId);
      const capacity = shaft ? shaftCapacityProjection(shaft, CONFIG) : null;
      const capacityText = capacity
        ? ' · purchased: ' + capacity.currentCars + (capacity.currentCars === 1 ? ' car' : ' cars') + ' / ' + capacity.currentCapacity + ' riders per dispatch · ' + (capacity.remainingCars
          ? 'add ' + capacity.remainingCars + (capacity.remainingCars === 1 ? ' car' : ' cars') + ' at ' + money(capacity.carCost) + ' each for +' + capacity.remainingCapacity + ' riders per dispatch'
          : 'car limit reached') + ' · maximum ' + capacity.maxCapacity + ' riders per dispatch'
        : '';
      const shaftContext = shaft
        ? ' · S' + (state.shafts.indexOf(shaft) + 1) + ': ' + state.people.filter((person) => person.state === 'waiting' && person.shaft === shaft.id).length +
          ' waiting · current load ' + Math.max(0, ...shaft.cars.map((car) => car.riders.length)) + '/' + CONFIG.elevator.capacity +
          ' · ' + shaft.cars.length + '/' + CONFIG.elevator.maxCarsPerShaft + ' cars'
        : ' · hover a shaft to inspect its queue and load';
      const queueRelief = shaft ? shaftQueueReliefProjection(shaft, state, CONFIG) : null;
      const queueReliefText = queueRelief
        ? queueRelief.queue > 0
          ? queueRelief.available
            ? ' · estimated queue wait ' + queueRelief.currentWaitSeconds.toFixed(1) + 's → ' + queueRelief.nextWaitSeconds.toFixed(1) + 's (−' + queueRelief.reliefSeconds.toFixed(1) + 's with one more car)'
            : ' · queue relief unavailable; shaft is at its car limit'
          : queueRelief.available
            ? ' · no queue now; an added car is reserve capacity'
            : ' · no queue-relief purchase available; shaft is at its car limit'
        : '';
      const forecastContext = shaftQueueForecastContext(state.day, state.tod, speed, CONFIG);
      const trend = shaft ? shaftQueueTrend(carQueueHistory.get(shaft.id)) : null;
      const dailyPressure = shaft ? shaftQueueDailyPressure(carQueueDailyHistory.get(shaft.id)) : null;
      const trendText = trend?.entries?.length > 1
        ? ' · ' + trend.label + ' (' + (trend.spike ? 'spike' : trend.direction) +
          (trend.timeSpanMinutes == null ? '' : ', ' + (trend.timeSpanMinutes < 1 ? '<1' : trend.timeSpanMinutes) + ' sim min; every ' + forecastContext.sampleIntervalMinutes + ' sim min') + ')'
        : trend?.entries?.length === 1
          ? ' · queue trend collecting (every ' + forecastContext.sampleIntervalMinutes + ' sim min)'
          : '';
      const dailyPressureText = dailyPressure?.key === 'sustained'
        ? ' · repeated daily pressure for ' + dailyPressure.consecutiveDays + ' days'
        : dailyPressure?.key === 'spike'
          ? ' · one-day queue spike — keep watching'
          : '';
      const recommendation = shaftQueueReliefRecommendation(state, CONFIG, carQueueDailyHistory);
      const best = recommendation.best;
      const bestShaftNumber = best ? best.shaftIndex + 1 : null;
      const bestTrend = best ? shaftQueueTrend(carQueueHistory.get(best.shaftId)) : null;
      const bestTrendText = bestTrend?.entries?.length > 1
        ? ' · recent ' + bestTrend.bars + ' (' + (bestTrend.spike ? 'spike' : bestTrend.direction) + ')'
        : '';
      const bestPressureText = best?.dailyPressure?.key === 'sustained'
        ? ' · repeated daily pressure for ' + best.dailyPressure.consecutiveDays + ' days'
        : best?.dailyPressure?.key === 'spike'
          ? ' · one-day spike (watch, not sustained)'
          : '';
      const transportResponse = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
      const transportResponseText = transportResponse.key !== 'monitor'
        ? ' · response: ' + transportResponse.label
        : '';
      const bestTargetText = recommendation.basis === 'sustained daily pressure'
        ? ' · best capacity target for sustained daily pressure'
        : ' · best available queue-relief target';
      const comparisonText = shaft && best
        ? best.shaftId === shaft.id
          ? bestTargetText + bestPressureText
          : ' · best available: S' + bestShaftNumber + ' would relieve ' + best.reliefSeconds.toFixed(1) + 's from its queue' + bestTrendText + bestPressureText
        : !best
          ? ' · no shaft has an open car slot'
          : '';
      const placement = routePlacementStatus('car', null, null, state, CONFIG, shaft);
      const alternative = placement.alternative ? ' · alternative: ' + placement.alternative : '';
      const shopTargetText = shopDiagnosisContext?.diagnosis === 'transport'
        ? ' · shop traffic target F' + shopDiagnosisContext.floor
        : '';
      element.textContent = 'CAR CAPACITY PREVIEW · +' + CONFIG.elevator.capacity + ' riders per dispatch · capacity on the existing route · forecast ' + forecastContext.label + shaftContext + capacityText + shopTargetText + queueReliefText + trendText + dailyPressureText + comparisonText + transportResponseText + ' · ' + money(CONFIG.costs.car) + ' · ' + placement.detail + alternative + ' · click an elevator shaft to place it';
      appendRouteAlternative(element, placement);
      element.style.color = placement.key === 'blocked' ? BAD : placement.key === 'select' ? WARN : GOOD;
      return;
    }
    const bottom = CONFIG.building.lobbyFloor ?? 0;
    const maximumTop = Math.min(state.floors - 1, bottom + CONFIG[tool].maxSpan - 1);
    const lockedTop = transportFocusTarget?.kind === tool && Number.isInteger(transportFocusTarget.floor)
      ? transportFocusTarget.floor : null;
    const top = hoverFloor > bottom ? hoverFloor : lockedTop ?? maximumTop;
    const span = top - bottom;
    const cost = CONFIG.costs[tool] + CONFIG.costs[tool + 'PerFloor'] * Math.max(0, span);
    const exceedsLimit = span + 1 > CONFIG[tool].maxSpan;
    const route = tool === 'stairs' ? 'slow local route · no car wait' : 'faster local route · no car wait';
    const transportResponse = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
    const sourceRouteLabel = transportResponse.sourceRouteKind === 'escalator' ? 'the escalator' : transportResponse.sourceRouteKind === 'stairs' ? 'the stairs' : null;
    const sourceRouteRelief = transportResponse.basis === 'sustained local overflow' && transportResponse.kind === tool && sourceRouteLabel && transportResponse.sourceRouteId != null
      ? ' · relieves ' + sourceRouteLabel + ' overflow on F' + (transportResponse.sourceRouteBottom ?? bottom) + '–F' + (transportResponse.sourceRouteTop ?? top)
      : '';
    const placement = routePlacementStatus(tool, bottom, top, state, CONFIG);
    const alternative = placement.alternative ? ' · alternative: ' + placement.alternative : '';
    element.textContent = tool.toUpperCase() + ' COVERAGE PREVIEW · floors ' + bottom + '–' + top + ' · ' + route + ' · ' + money(cost) +
      (exceedsLimit ? ' · exceeds the ' + CONFIG[tool].maxSpan + '-floor limit' : ' · ' + placement.detail) + sourceRouteRelief + alternative + ' · click the top floor to place it';
    appendRouteAlternative(element, placement);
    element.style.color = placement.key === 'blocked' ? BAD : exceedsLimit || placement.key === 'invalid' ? WARN : GOOD;
    return;
  }
  if (condoPlacementPreview) {
    const mixPreview = tenantPlacementMixPreview(state, 'condo', CONFIG);
    const floor = hoverFloor > 0 && hoverFloor < state.floors ? hoverFloor : null;
    const floorPreview = floor == null ? null : tenantPlacementFloorComparison(state, 'condo', floor, CONFIG);
    const floorText = floorPreview?.available
      ? ' · F' + floor + ' room appeal ' + floorPreview.evaluation.score + '/100 · demand +' + floorPreview.demandQuality.bonus + ' ' + floorPreview.demandQuality.label
      : floor != null
        ? ' · F' + floor + ' unavailable: ' + floorPreview.reason
        : ' · hover an upper floor to preview room appeal';
    const cost = CONFIG.costs.condo;
    const costText = state.money < cost
      ? ' · NOT ENOUGH MONEY (need ' + money(cost) + ', have ' + money(state.money) + ')'
      : ' · cost ' + money(cost) + ' · funds ' + money(state.money);
    const serviceNeeds = tenantPlacementServiceNeeds('condo', CONFIG);
    const serviceText = serviceNeeds.length
      ? ' · services to plan: ' + serviceNeeds.map((service) => service.label).join(', ')
      : '';
    const transportPreview = condoTransportPreview(CONFIG);
    const transportText = transportPreview.roundTripsPerDay
      ? ' · resident travel +' + transportPreview.roundTripsPerDay + ' round trips/day (' + transportPreview.passengerJourneysPerDay + ' passenger journeys before route split)'
      : '';
    const transportResponse = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
    const transportAction = transportResponse.key === 'car' && transportResponse.affordable !== false && transportResponse.shaftId != null
      ? { kind: 'car', shaftId: transportResponse.shaftId }
      : transportResponse.key === 'shaft' && transportResponse.affordable !== false
        ? { kind: 'shaft', floor: transportResponse.targetFloor }
        : transportResponse.key === 'local' && transportResponse.affordable !== false && transportResponse.kind
          ? { kind: transportResponse.kind, floor: transportResponse.targetFloor }
          : null;
    const transportResponseText = transportResponse.key === 'monitor'
      ? ' · transport: no current pressure; watch after placement'
      : ' · transport response: ' + transportResponse.label + ' · why: ' + String(transportResponse.detail ?? '').split('. ')[0] +
        (transportAction ? ' · resolve before adding residents' : ' · review transport panel');
    element.hidden = false;
    element.textContent = 'MIXED-USE PREVIEW · condo adds ' + tenantPlacementPreview('condo', CONFIG).capacity + ' residents · ' +
      placementMixText(mixPreview) + transportText + transportResponseText + serviceText + floorText + costText + ' · click an upper floor to place it';
    if (transportAction) {
      element.appendChild(document.createTextNode(' '));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inspect-vacancy';
      button.dataset.condoTransportResponse = transportAction.kind;
      if (transportAction.shaftId != null) button.dataset.condoTransportShaft = String(transportAction.shaftId);
      if (transportAction.floor != null) button.dataset.condoTransportFloor = String(transportAction.floor);
      button.textContent = 'resolve transport first';
      button.title = 'select the recommended transport response before adding condo residents';
      element.appendChild(button);
    }
    element.style.color = state.money < cost ? BAD : mixPreview.balanceDelta < 0 ? WARN : GOOD;
    return;
  }
  if (!investmentTarget) {
    const delta = investmentOutcome.scoreDelta;
    const signed = delta > 0 ? '+' + delta : String(delta);
    const impacts = investmentOutcome.impacts.length
      ? ' · changed ' + investmentOutcome.impacts.map(({ label, delta: amount }) => label + ' +' + amount).join(', ')
      : ' · no measurable component change';
    element.hidden = false;
    const actual = Number.isFinite(investmentOutcome.actualScore)
      ? ' · actual ' + investmentOutcome.actualScore + ' (' +
        (investmentOutcome.actualDelta > 0 ? '+' : '') + investmentOutcome.actualDelta + ' vs forecast)'
      : investmentOutcome.roomKind
        ? ' · build ' + investmentOutcome.roomKind.toUpperCase() + ' on F' + investmentOutcome.targetFloor + ' to check it'
        : '';
    const firstDayCauses = investmentOutcome.firstDayDrift?.length
      ? ' · causes ' + investmentOutcome.firstDayDrift.map(({ label, delta: amount }) => label + ' ' + (amount > 0 ? '+' : '') + amount).join(', ')
      : ' · no component drift';
    const firstDay = Number.isFinite(investmentOutcome.firstDayScore)
      ? ' · day 1 ' + investmentOutcome.firstDayScore + ' (' +
        (investmentOutcome.firstDayDelta > 0 ? '+' : '') + investmentOutcome.firstDayDelta + ' vs occupied · stress ' +
        investmentOutcome.firstDay.stress + firstDayCauses + ')'
      : '';
    const trend = investmentOutcome.trend?.length > 1
      ? ' · trend move-in ' + investmentOutcome.actualScore + ' → ' + investmentOutcome.trend
        .map((reading) => 'D' + (reading.day - investmentOutcome.occupiedDay + 1) + ' ' + reading.score).join(' → ')
      : '';
    const sustained = sustainedLowEvaluation(investmentOutcome.trend, CONFIG.evaluation.relistMinScore, 2);
    const sustainedText = sustained.sustained
      ? ' · SUSTAINED LOW EVAL ' + sustained.average + '/100 over ' + sustained.readings + ' readings'
      : '';
    const responseUnit = investmentOutcome.actualUnitId
      ? state.units.find((unit) => unit.id === investmentOutcome.actualUnitId)
      : null;
    const response = sustained.sustained ? roomEvaluationResponse(responseUnit) : null;
    const realizedCoverage = investmentOutcome.serviceCoverage;
    const realizedCoverageSignal = realizedCoverage
      ? serviceCoverageChange({
        available: true,
        requiredRooms: realizedCoverage.after.requiredRooms,
        afterRooms: realizedCoverage.after.coveredRooms,
        roomsDelta: realizedCoverage.after.coveredRooms - realizedCoverage.before.coveredRooms,
        headsDelta: realizedCoverage.after.coveredHeads - realizedCoverage.before.coveredHeads,
      })
      : null;
    if (realizedCoverageSignal) {
      element.classList.add('coverage-' + realizedCoverageSignal.key);
      element.style.borderColor = realizedCoverageSignal.key === 'strong' ? GOOD : realizedCoverageSignal.key === 'partial' ? WARN : BAD;
    }
    const realizedCoverageText = realizedCoverage
      ? realizedCoverage.after.requiredRooms
        ? ' · REALIZED ' + realizedCoverageSignal.label + ' · service coverage ' + realizedCoverage.before.coveredRooms + '/' + realizedCoverage.after.requiredRooms +
          ' → ' + realizedCoverage.after.coveredRooms + '/' + realizedCoverage.after.requiredRooms + ' rooms · heads ' +
          realizedCoverage.before.coveredHeads + ' → ' + realizedCoverage.after.coveredHeads
        : ' · REALIZED no occupied rooms required this service'
      : '';
    const budgetResultText = investmentOutcome.serviceCoverage && Number.isFinite(investmentOutcome.moneyAfter)
      ? ' · funds remaining ' + money(investmentOutcome.moneyAfter) +
        (Number.isFinite(investmentOutcome.moneySpent) ? ' · spent ' + money(investmentOutcome.moneySpent) : '')
      : '';
    element.textContent = (Number.isFinite(investmentOutcome.actualScore) ? 'INVESTMENT CHECK' : 'INVESTMENT RESULT') +
      ' · ' + investmentOutcome.kind.toUpperCase() +
      ' placed on F' + investmentOutcome.placementFloor + ': ' + investmentOutcome.before.score +
      ' → ' + investmentOutcome.after.score + ' (' + signed + ') for target F' + investmentOutcome.targetFloor + realizedCoverageText + budgetResultText + actual + firstDay + trend + sustainedText + impacts;
    if (response) {
      element.appendChild(document.createTextNode(' · RESPONSE: ' + response.label + ' '));
      const inspect = document.createElement('button');
      inspect.type = 'button';
      inspect.className = 'outcome-action';
      inspect.dataset.investmentOutcomeInspect = String(responseUnit.id);
      inspect.textContent = 'open room';
      element.appendChild(inspect);
    }
    element.style.color = sustained.sustained ? BAD : delta > 0 ? GOOD : delta < 0 ? BAD : WARN;
    return;
  }
  const targetPreview = tenantPlacementFloorComparison(state, investmentTarget.tool, investmentTarget.floor, CONFIG);
  const floor = hoverFloor != null ? hoverFloor : investmentTarget.recommendedFloor ?? investmentTarget.floor;
  const preview = tenantPlacementInvestmentPreview(targetPreview, investmentTarget, state, CONFIG, floor);
  element.hidden = false;
  if (!preview.available) {
    element.textContent = 'ROOM EVAL PREVIEW · hover an open guided floor to see the expected change.';
    element.style.color = WARN;
    return;
  }
  const delta = preview.scoreDelta;
  const signed = delta > 0 ? '+' + delta : String(delta);
  const impacts = preview.impacts.length
    ? ' · improves ' + preview.impacts.map(({ label, delta: amount }) => label + ' +' + amount).join(', ')
    : ' · no measurable component change';
  const demandDelta = preview.demandBonusDelta > 0
    ? ' · leasing demand +' + preview.demandBonusDelta + ' (' + preview.demandBefore.score + ' → ' + preview.demandAfter.score + ')'
    : preview.demandBonusDelta < 0
      ? ' · leasing demand ' + preview.demandBonusDelta + ' (' + preview.demandBefore.score + ' → ' + preview.demandAfter.score + ')'
      : ' · leasing demand unchanged (' + preview.demandAfter.score + '/100)';
  const coveragePreview = CONFIG.services?.[investmentTarget.tool]
    ? servicePlacementCoveragePreview(state, investmentTarget.tool, floor, CONFIG)
    : null;
  const recommendedCoveragePreview = CONFIG.services?.[investmentTarget.tool] && investmentTarget.recommendedFloor != null
    ? servicePlacementCoveragePreview(state, investmentTarget.tool, investmentTarget.recommendedFloor, CONFIG)
    : null;
  const coverageComparison = servicePlacementComparison(coveragePreview, recommendedCoveragePreview);
  const coverageSignal = coveragePreview?.available ? serviceCoverageChange(coveragePreview) : null;
  if (coverageSignal) {
    element.classList.add('coverage-' + coverageSignal.key);
    element.style.borderColor = coverageSignal.key === 'strong' ? GOOD : coverageSignal.key === 'partial' ? WARN : BAD;
  }
  const coverageDelta = coveragePreview?.available
    ? coveragePreview.requiredRooms
      ? ' · ' + coverageSignal.label + ' · service coverage ' + coveragePreview.beforeRooms + '/' + coveragePreview.requiredRooms +
        ' → ' + coveragePreview.afterRooms + '/' + coveragePreview.requiredRooms + ' rooms · heads ' +
        coveragePreview.beforeHeads + ' → ' + coveragePreview.afterHeads
      : ' · no occupied rooms currently require this service'
    : '';
  const coverageComparisonText = coverageComparison.label ? ' · ' + coverageComparison.label : '';
  const cost = CONFIG.costs[investmentTarget.tool];
  const dailyUpkeep = CONFIG.services[investmentTarget.tool]?.dailyUpkeep ?? 0;
  const costText = Number.isFinite(cost)
    ? state.money < cost
      ? ' · NOT ENOUGH MONEY (need ' + money(cost) + ', have ' + money(state.money) + ')'
      : ' · cost ' + money(cost) + ' · funds ' + money(state.money)
    : '';
  const upkeepText = dailyUpkeep ? ' · +' + money(dailyUpkeep) + '/day upkeep' : '';
  const budgetImpact = servicePlacementBudgetImpact(state, investmentTarget.tool, CONFIG);
  const signedMoney = (value) => (value >= 0 ? '+' : '-') + money(Math.abs(value));
  const budgetImpactText = budgetImpact.dailyUpkeep
    ? budgetImpact.beforeNet == null
      ? ' · projected direct net change ' + signedMoney(budgetImpact.delta) + '/day'
      : ' · projected direct net ' + signedMoney(budgetImpact.beforeNet) + ' → ' + signedMoney(budgetImpact.afterNet) + '/day (' + signedMoney(budgetImpact.delta) + '/day upkeep)'
    : '';
  const targetUnit = investmentTarget.targetUnitId == null
    ? null
    : state.units.find((unit) => unit.id === investmentTarget.targetUnitId);
  const targetLabel = targetUnit
    ? 'F' + targetUnit.floor + ' ' + targetUnit.kind + ' (' + Math.max(0, Math.round(targetUnit.heads ?? 0)) + ' tenants)'
    : 'F' + preview.targetFloor;
  element.textContent = 'ROOM EVAL PREVIEW · ' + investmentTarget.tool.toUpperCase() +
    ' on F' + preview.placementFloor + ': ' + preview.before.score + ' → ' + preview.after.score +
    ' (' + signed + ') for target ' + targetLabel + demandDelta + coverageDelta + coverageComparisonText + costText + upkeepText + budgetImpactText + impacts;
  element.style.color = state.money < cost ? BAD : delta > 0 ? GOOD : delta < 0 ? BAD : WARN;
}

function clearInvestmentOutcome() {
  investmentOutcome = null;
  clearTimeout(investmentOutcomeTimer);
  investmentOutcomeTimer = null;
}

function rememberInvestmentOutcome(preview, extras = {}) {
  if (!preview?.available) return;
  investmentOutcome = {
    ...preview,
    ...extras,
    roomKind: investmentTarget?.roomKind ?? null,
    targetUnitId: investmentTarget?.targetUnitId ?? null,
  };
  clearTimeout(investmentOutcomeTimer);
  investmentOutcomeTimer = setTimeout(() => {
    investmentOutcome = null;
    investmentOutcomeTimer = null;
    refresh();
  }, Math.max(30000, CONFIG.time.daySeconds * 1000 * 4));
}

function rememberServiceOutcome(kind, floor, before, after, targetUnitId = null, facilityId = null, desirabilityBefore = null, desirabilityAfter = null, targetDesirabilityBefore = null, targetDesirabilityAfter = null) {
  if (!before?.available || !after?.available) return;
  const projection = {
    available: true,
    requiredRooms: after.requiredRooms,
    afterRooms: after.coveredRooms,
    roomsDelta: after.coveredRooms - before.coveredRooms,
    headsDelta: after.coveredHeads - before.coveredHeads,
  };
  const signal = serviceCoverageChange(projection);
  const targetUnit = targetUnitId == null ? null : state.units.find((unit) => unit.id === targetUnitId);
  const targetHeads = targetUnit ? Math.max(0, Math.round(targetUnit.heads ?? 0)) : null;
  const coverageByFloor = (unitIds) => unitIds.reduce((byFloor, id) => {
    const unit = state.units.find((candidate) => candidate.id === id);
    if (!unit) return byFloor;
    byFloor[unit.floor] = (byFloor[unit.floor] ?? 0) + Math.max(0, Math.round(unit.heads ?? 0));
    return byFloor;
  }, {});
  const beforeHeadsByFloor = coverageByFloor(before.coveredUnitIds);
  const afterHeadsByFloor = coverageByFloor(after.coveredUnitIds);
  const requiredHeadsByFloor = state.units.reduce((byFloor, unit) => {
    if (!unit.occupied || (CONFIG.units[unit.kind]?.[kind + 'Need'] ?? 0) <= 0) return byFloor;
    byFloor[unit.floor] = (byFloor[unit.floor] ?? 0) + Math.max(0, Math.round(unit.heads ?? 0));
    return byFloor;
  }, {});
  serviceOutcomeHistory = [...serviceOutcomeHistory, {
    day: state.day,
    kind,
    floor,
    facilityId,
    targetUnitId,
    targetFloor: targetUnit?.floor ?? null,
    targetKind: targetUnit?.kind ?? null,
    targetTenantLoad: targetHeads,
    targetBeforeHeads: targetHeads == null ? null : before.coveredUnitIds.includes(targetUnitId) ? targetHeads : 0,
    targetAfterHeads: targetHeads == null ? null : after.coveredUnitIds.includes(targetUnitId) ? targetHeads : 0,
    coverageFloors: CONFIG.services?.[kind]?.coverageFloors ?? 0,
    signal: signal.key,
    label: signal.label,
    beforeRooms: before.coveredRooms,
    afterRooms: after.coveredRooms,
    requiredRooms: after.requiredRooms,
    beforeHeads: before.coveredHeads,
    afterHeads: after.coveredHeads,
    beforeHeadsByFloor,
    afterHeadsByFloor,
    requiredHeadsByFloor,
    desirabilityBefore,
    desirabilityAfter,
    targetDesirabilityBefore,
    targetDesirabilityAfter,
    realizedTargetDesirability: null,
    realizedDesirability: null,
    realizedDeliveryRate: null,
    realizedRep: null,
    realizedDay: null,
    realizedNet: null,
    realizedUpkeep: null,
    realizedServiceUpkeep: null,
    changedUnitIds: after.coveredUnitIds.filter((id) => !before.coveredUnitIds.includes(id)),
    changedFloors: [...new Set(after.coveredUnitIds
      .filter((id) => !before.coveredUnitIds.includes(id))
      .map((id) => state.units.find((unit) => unit.id === id)?.floor)
      .filter((floor) => Number.isInteger(floor)))],
  }].slice(-3);
}

function recordServiceRoomStatus(day) {
  const unit = state.units.find((candidate) => candidate.id === selectedUnitId);
  const outcome = unit
    ? serviceOutcomeHistory.slice().reverse().find((entry) => entry.targetUnitId === unit.id)
    : null;
  if (!unit || !outcome) return;
  const status = serviceRoomStatus(unit, unitEvaluation(state, unit, CONFIG), outcome.kind, CONFIG);
  const reading = {
    unitId: unit.id,
    kind: outcome.kind,
    day,
    key: status.key,
    liveHeads: status.liveHeads,
  };
  serviceRoomStatusHistory = appendServiceRoomStatusHistory(serviceRoomStatusHistory, reading);
}

function reconcileInvestmentOutcome(unitId) {
  if (!investmentOutcome?.roomKind || investmentOutcome.actualScore != null) return;
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit || unit.kind !== investmentOutcome.roomKind || unit.floor !== investmentOutcome.targetFloor) return;
  const actual = unitEvaluation(state, unit, CONFIG);
  investmentOutcome = {
    ...investmentOutcome,
    actual,
    actualScore: actual.score,
    actualDelta: actual.score - investmentOutcome.after.score,
    actualUnitId: unit.id,
    occupiedDay: state.day,
    trend: [],
  };
  refresh();
}

function recordFirstDayOutcome(closedDay) {
  if (!investmentOutcome?.actualUnitId || (investmentOutcome.trend?.length ?? 0) >= 3 ||
    closedDay < investmentOutcome.occupiedDay) return;
  const unit = state.units.find((candidate) => candidate.id === investmentOutcome.actualUnitId);
  if (!unit) return;
  const firstDay = unitEvaluation(state, unit, CONFIG);
  const reading = { day: closedDay, score: firstDay.score, stress: firstDay.stress, occupied: unit.occupied };
  const trend = boundedEvaluationTrend([...(investmentOutcome.trend ?? []), reading], 3);
  const nextOutcome = {
    ...investmentOutcome,
    trend,
  };
  if (investmentOutcome.firstDayScore == null) {
    nextOutcome.firstDay = firstDay;
    nextOutcome.firstDayScore = firstDay.score;
    nextOutcome.firstDayDelta = firstDay.score - investmentOutcome.actualScore;
    nextOutcome.firstDayDrift = evaluationDrift(investmentOutcome.actual, firstDay);
  }
  investmentOutcome = nextOutcome;
  roomHealthHistory = rememberRoomHealthHistory(roomHealthHistory, investmentOutcome, unit, CONFIG);
}

function activeInvestmentForecast(placementFloor) {
  if (!investmentTarget) return null;
  const targetPreview = tenantPlacementFloorComparison(state, investmentTarget.tool, investmentTarget.floor, CONFIG);
  return tenantPlacementInvestmentPreview(targetPreview, investmentTarget, state, CONFIG, placementFloor);
}

function activeShopDemandPreview(preferredFloorOverride = undefined) {
  if (shopDiagnosisContext?.diagnosis !== 'mix' || tool !== 'office') return null;
  const shop = state.units.find((unit) => unit.id === shopDiagnosisContext.shopId) ??
    state.units.find((unit) => unit.kind === 'shop' && unit.floor === shopDiagnosisContext.floor);
  if (!shop) return { available: false, reason: 'shop is no longer available' };
  const reputation = state.log[state.log.length - 1]?.rep;
  const preferredFloor = preferredFloorOverride === undefined
    ? hoverFloor > 0 ? hoverFloor : null
    : preferredFloorOverride;
  return shopTrafficTenantMixPreview(state, shop, CONFIG, reputation, preferredFloor);
}

function placementGuideTarget() {
  if (shopDiagnosisContext?.diagnosis === 'mix' && tool === 'office' && !investmentOutcome) {
    const preview = activeShopDemandPreview();
    if (preview?.available) return { kind: 'office', floor: preview.placementFloor };
  }
  return investmentTarget
    ? { ...investmentTarget, kind: investmentTarget.tool, floor: investmentTarget.recommendedFloor ?? investmentTarget.floor, coverageFloor: investmentTarget.floor }
    : null;
}

function placementReasonText(kind, evaluation) {
  const tune = CONFIG.units[kind] || {};
  const missing = [
    ['food', 'foodCovered', 'foodNeed'],
    ['parking', 'parkingCovered', 'parkingNeed'],
    ['medical', 'medicalCovered', 'medicalNeed'],
    ['security', 'securityCovered', 'securityNeed'],
    ['recycling', 'recyclingCovered', 'recyclingNeed'],
  ].filter(([, covered, need]) => (tune[need] ?? 0) > 0 && !evaluation[covered])
    .map(([name]) => name);
  const signals = [
    evaluation.accessMode ? evaluation.accessMode + ' -' + evaluation.accessPenalty : 'no route -' + evaluation.accessPenalty,
    'fit -' + evaluation.preferencePenalty,
    'view +' + evaluation.viewBonus,
    'noise -' + evaluation.noisePenalty,
  ];
  if (evaluation.amenityBonus > 0) signals.push('amenity +' + evaluation.amenityBonus);
  signals.push(missing.length ? 'missing ' + missing.join('/') : 'services covered');
  return signals.join(' · ');
}

function pinnedFloorFitText(kind) {
  if (pinnedComparisonFloor == null || !comparisonFloors.includes(pinnedComparisonFloor)) return '';
  const preview = tenantPlacementFloorComparison(state, kind, pinnedComparisonFloor, CONFIG);
  if (!preview.available) return 'pinned F' + pinnedComparisonFloor + ' is no longer open';
  const fit = preview.evaluation.preferencePenalty === 0
    ? 'preferred floor'
    : 'prefers F' + preview.evaluation.preferredFloor;
  return 'pinned F' + preview.floor + ' expected fit ' + preview.evaluation.score + '/100 · ' + fit;
}

function pinnedFloorDeltaText(kind, floor, evaluation) {
  if (pinnedComparisonFloor == null || !comparisonFloors.includes(pinnedComparisonFloor)) return '';
  if (floor === pinnedComparisonFloor) return ' · pinned choice';
  const preview = tenantPlacementFloorComparison(state, kind, pinnedComparisonFloor, CONFIG);
  if (!preview.available) return ' · pinned floor unavailable';
  const delta = evaluation.score - preview.evaluation.score;
  return ' · vs pinned F' + pinnedComparisonFloor + ' ' + (delta >= 0 ? '+' : '') + delta;
}

function localRouteResponsePreview(response) {
  if (!response || (response.kind !== 'stairs' && response.kind !== 'escalator') || !Number.isInteger(response.targetFloor)) return null;
  const existing = Boolean(response.existing);
  const bottom = CONFIG.building.lobbyFloor ?? 0;
  const targetFloor = response.targetFloor;
  const plannedTop = existing && Number.isInteger(response.routeTop) ? response.routeTop : targetFloor;
  const plannedSlot = existing && Number.isInteger(response.routeSlot)
    ? response.routeSlot
    : localRouteTargetStatus({ kind: response.kind, floor: targetFloor }, state, CONFIG).slot;
  const routeStatus = existing ? { key: 'ready' } : localRouteTargetStatus({ kind: response.kind, floor: targetFloor }, state, CONFIG);
  return {
    kind: response.kind,
    existing,
    targetFloor,
    bottom,
    top: plannedTop,
    span: plannedTop - bottom + 1,
    slot: plannedSlot,
    ready: routeStatus.key === 'ready',
    averageSeconds: Number.isFinite(Number(response.averageSeconds)) ? Number(response.averageSeconds) : null,
    coveredTrips: Number.isFinite(Number(response.coveredTrips)) ? Math.max(0, Math.round(Number(response.coveredTrips))) : 0,
    dailyThroughputEstimate: Number.isFinite(Number(response.dailyThroughputEstimate))
      ? Math.max(1, Math.round(Number(response.dailyThroughputEstimate))) : null,
    occupancy: Number.isFinite(Number(response.routeOccupancy)) ? Math.max(0, Math.round(Number(response.routeOccupancy))) : 0,
    capacity: Number.isFinite(Number(response.routeCapacity)) ? Math.max(1, Math.round(Number(response.routeCapacity))) : null,
    detail: routeStatus.detail,
  };
}

function placementMixText(mix) {
  const delta = mix.balanceDelta;
  return 'projected ' + mix.kind + ' mix ' + Math.round(mix.currentShare * 100) + '% → ' +
    Math.round(mix.projectedShare * 100) + '% / ' + Math.round(mix.targetShare * 100) +
    '% target · balance ' + mix.balanceBefore + '% → ' + mix.balanceAfter + '% (' +
    (delta >= 0 ? '+' : '') + delta + ')';
}

function renderTransport() {
  const d = state.log[state.log.length - 1];
  const waiting = state.people.filter((p) => p.state === 'waiting');
  const buildingWaiting = waiting.length;
  const elevatorWaiting = waiting.filter((person) => person.shaft != null).length;
  const localWaiting = waiting.filter((person) => person.localRouteKind).length;
  const unassignedPeople = waiting.filter((person) => person.shaft == null && !person.localRouteKind);
  const unassignedWaiting = unassignedPeople.length;
  const waitingSystemPanel = '<div class="diag-sub"><b>waiting by system</b> · ' +
    '<span class="' + indicatorCssClass(waitingPressure(elevatorWaiting).colorKey) + '">elevator W ' + elevatorWaiting + '</span> · ' +
    '<span class="' + indicatorCssClass(waitingPressure(localWaiting).colorKey) + '">local route W ' + localWaiting + '</span> · ' +
    '<span class="' + indicatorCssClass(waitingPressure(unassignedWaiting).colorKey) + '">unassigned W ' + unassignedWaiting + '</span></div>';
  const utilizationTrend = tenantUtilizationTrend(tenantUtilizationHistory);
  const utilizationTrendClass = utilizationTrend.key === 'improved' ? 'diag-good'
    : utilizationTrend.key === 'worsened' ? 'diag-bad' : 'diag-warn';
  const utilizationHistoryPanel = '<div class="diag"><span>utilization history</span><span class="' + utilizationTrendClass + '">' + utilizationTrend.label + '</span></div>' +
    '<div class="diag-sub">' + tenantUtilizationHistoryLabel(tenantUtilizationHistory) + '</div>' +
    '<div class="diag-sub">D = daily reading · R = re-rent recovery · oldest to newest · higher percentages mean more occupied capacity</div>' +
    '<div class="diag-sub"><span class="diag-good">green = healthy</span> · <span class="diag-warn">yellow = watch</span> · <span class="diag-bad">red = pressure or unused capacity</span></div>';
  const byFloor = new Map();
  for (const p of waiting) byFloor.set(p.from, (byFloor.get(p.from) || 0) + 1);
  const transportCoveragePanel = '<div class="diag-sub">route coverage: ' + transportCoverageText() + '.</div>';
  const activeServiceFacilities = state.facilities ?? [];
  const activeServiceUpkeep = activeServiceFacilities.reduce((total, facility) =>
    total + (CONFIG.services?.[facility.kind]?.dailyUpkeep ?? 0), 0);
  const activeServicePanel = '<div class="diag"><span>active service upkeep</span><span class="' + (activeServiceUpkeep ? 'diag-warn' : 'diag-good') + '">' +
    money(activeServiceUpkeep) + '/day</span></div>' +
    '<div class="diag-sub">' + (activeServiceFacilities.length
      ? activeServiceFacilities.length + ' active service facilit' + (activeServiceFacilities.length === 1 ? 'y' : 'ies') + ' · recurring cost applies at the next day close'
      : 'no active service facilities · no recurring service cost') + '</div>';
  const budgetPanel = d
    ? '<div class="diag"><span>last close budget</span><span class="' + (d.net >= 0 ? 'diag-good' : 'diag-bad') + '">' + (d.net >= 0 ? '+' : '-') + money(Math.abs(d.net)) + ' net</span></div>' +
      '<div class="diag-sub">rent ' + money(d.rent) + ' + shop ' + money(d.shopRevenue) + ' + rewards ' + money(d.rewards) +
      ' − upkeep ' + money(d.upkeep) + ' (services ' + money(d.serviceUpkeep ?? 0) + ') − build ' + money(d.spent) + '</div>' +
      (() => {
        const runway = cashRunwaySummary(state);
        const runwayClass = runway.key === 'positive' ? 'diag-good' : runway.key === 'critical' || runway.key === 'watch' ? 'diag-bad' : 'diag-warn';
        return '<div class="diag-sub"><span class="' + runwayClass + '">' + runway.label + '</span> · cash ' + money(state.money) + '</div>';
      })()
    : '<div class="diag-sub">budget: first day close pending</div>';

  const shaftRows = state.shafts.map((sh, i) => {
    const queue = waiting.filter((p) => p.shaft === sh.id).length;
    const routeQueueShare = buildingWaiting ? Math.round(queue / buildingWaiting * 100) : 0;
    const moving = sh.cars.filter((c) => c.state === 'moving').length;
    const doors = sh.cars.filter((c) => c.state === 'doors').length;
    const maxLoad = Math.max(0, ...sh.cars.map((c) => c.riders.length));
    const status = queue ? queue + ' waiting' : moving || doors ? 'serving' : 'idle';
    const statusClass = indicatorCssClass(waitingPressure(queue).colorKey);
    const lobbySlots = state.lobby?.slots ?? (state.lobby ? [state.lobby.slot] : []);
    const lobbyWalk = state.lobby ? ' · lobby ' + Math.min(...lobbySlots.map((slot) => Math.abs(slot - sh.slot))) + ' slot walk' : '';
    const routeCoverage = shaftRouteCoverageLabel(sh, state.shafts);
    return '<div class="diag"><b>S' + (i + 1) + '</b><span class="' + statusClass + '">' +
      sh.cars.length + '/' + CONFIG.elevator.maxCarsPerShaft + ' cars · ' + status + '</span></div>' +
      '<div class="diag-sub">floors ' + sh.bottom + '–' + sh.top + ' · ' + routeCoverage + lobbyWalk + ' · max load ' + maxLoad + '/' + CONFIG.elevator.capacity +
      ' · queue share ' + routeQueueShare + '% of building-wide W ' + buildingWaiting + '</div>';
  }).join('');
  const unassignedOrigins = new Map();
  for (const person of unassignedPeople) {
    unassignedOrigins.set(person.from, (unassignedOrigins.get(person.from) || 0) + 1);
  }
  const unassignedOriginText = [...unassignedOrigins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([floor, count]) => '<span class="' + indicatorCssClass(waitingPressure(count).colorKey) + '">F' + floor + ' ' + count + '</span>')
    .join(' · ') || 'none';
  const unassignedWaitingPanel = '<div class="diag-sub"><span class="' + indicatorCssClass(waitingPressure(unassignedWaiting).colorKey) + '">unassigned waiting: W ' + unassignedWaiting + '</span> · origins ' + unassignedOriginText + ' · route shares exclude people without an assigned shaft</div>';
  const unassignedResponse = unassignedQueueResponse(state, CONFIG);
  const unassignedResponseClass = unassignedResponse.key === 'clear' ? 'diag-good' : unassignedResponse.key === 'local' ? 'diag-warn' : 'diag-bad';
  const unassignedResponseFloorButtons = unassignedResponse.origins.map(({ floor, count }) =>
    '<button class="inspect-vacancy" data-missing-route-floor="' + floor + '" aria-label="focus floor ' + floor + ' missing-route queue">focus F' + floor + ' (' + count + ')</button>'
  ).join(' ');
  const unassignedResponsePanel = '<div class="diag-sub"><span class="' + unassignedResponseClass + '">missing-route response: ' + unassignedResponse.label + '</span> · ' + unassignedResponse.detail +
    (unassignedResponseFloorButtons ? ' · ' + unassignedResponseFloorButtons : '') + '</div>';
  const dailyService = queueDailyServiceSummary(d, CONFIG);
  const localOverflowTrend = localOverflowDailyTrend(state.log);
  const localOverflowPressure = localOverflowDailyPressure(state.log);
  const localOverflowTrendLabel = localOverflowTrend.entries.length > 1
    ? localOverflowTrend.bars + ' · ' + localOverflowTrend.direction + ' · avg ' + localOverflowTrend.current.toFixed(2) + ' riders over capacity'
    : localOverflowTrend.entries.length ? 'history collecting' : 'history awaiting close';
  const localOverflowPressureLabel = localOverflowPressure.key === 'sustained'
    ? ' · repeated for ' + localOverflowPressure.consecutiveDays + ' days'
    : localOverflowPressure.key === 'spike' ? ' · one-day spike — keep watching' : '';
  const localOverflowClass = localOverflowPressure.key === 'sustained' ? 'diag-bad'
    : localOverflowPressure.key === 'spike' ? 'diag-warn'
      : localOverflowTrend.direction === 'falling' ? 'diag-good' : 'diag-warn';
  const localOverflowPanel = '<div class="diag-sub"><span>local overflow history</span> · <span class="' + localOverflowClass + '">' +
    localOverflowTrendLabel + localOverflowPressureLabel + '</span>' +
    (localOverflowTrend.peak ? ' · peak ' + localOverflowTrend.peak + ' riders' : '') + '</div>';
  const transportResponse = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
  const transportResponseClass = transportResponse.key === 'monitor' ? 'diag-good'
    : transportResponse.key === 'blocked' ? 'diag-bad' : 'diag-warn';
  const localPreview = localRouteResponsePreview(transportResponse);
  const localPreviewPanel = localPreview
    ? '<div class="diag-sub transport-local-preview"><b>' + localPreview.kind.toUpperCase() + (localPreview.existing ? ' ROUTE' : ' PREVIEW') + '</b> · target F' + localPreview.targetFloor +
      ' · span F' + localPreview.bottom + '–F' + localPreview.top + ' (' + localPreview.span + ' floors) · ' +
      (localPreview.slot >= 0 ? 'column ' + (localPreview.slot + 1) : localPreview.detail) +
      (localPreview.capacity == null ? '' : ' · ' + localPreview.occupancy + '/' + localPreview.capacity + ' occupied') + '</div>'
    : '';
  const localEffectPanel = localPreview
    ? '<div class="diag-sub transport-local-effect"><b>EXPECTED EFFECT</b> · ' +
      (localPreview.averageSeconds == null ? 'travel time not estimated yet' : 'about ' + localPreview.averageSeconds.toFixed(1) + 's average travel') +
      ' · ' + (localPreview.coveredTrips
        ? 'shifts ' + localPreview.coveredTrips + ' currently pressured trips off elevator capacity'
        : 'no currently pressured trips to shift') + ' · no car wait' +
      (localPreview.dailyThroughputEstimate == null
        ? ''
        : ' · planning throughput about ' + localPreview.dailyThroughputEstimate + '/day (not a hard limit yet)') + '</div>'
    : '';
  const transportResponsePanel = '<div class="diag"><span>transport response</span><span class="' + transportResponseClass + '">' + transportResponse.label + '</span></div>' +
    '<div class="diag-sub">' + transportResponse.detail + '</div>' + localPreviewPanel + localEffectPanel;
  const transportChoiceSelection = tool === 'car' || tool === 'shaft' || tool === 'stairs' || tool === 'escalator' ? tool : null;
  const transportChoices = transportInvestmentChoices(state, CONFIG, transportResponse, carQueueDailyHistory, transportChoiceSelection, transportFocusTarget, localRouteDailyHistory);
  const carChoice = transportChoices.car;
  const shaftChoice = transportChoices.shaft;
  const localChoice = transportChoices.local;
  const localChoices = transportChoices.localOptions ?? [localChoice];
  const carChoiceText = carChoice.available
    ? 'S' + (carChoice.shaftIndex + 1) + ' · +' + carChoice.addedCapacity + ' riders/dispatch · capacity ' + carChoice.currentCapacity + ' → ' + carChoice.nextCapacity +
      ' · covers ' + carChoice.coveredTrips + ' current waits' +
      (carChoice.queue ? ' · wait ' + carChoice.waitBefore.toFixed(1) + 's → ' + carChoice.waitAfter.toFixed(1) + 's' : '')
    : carChoice.shaftId == null ? 'no existing shaft to add a car to' : 'S' + (carChoice.shaftIndex + 1) + ' is at its car limit';
  const shaftChoiceText = shaftChoice.available
    ? 'legal F' + shaftChoice.bottom + '–F' + shaftChoice.top + ' · covers ' + shaftChoice.coveredTrips + ' current waits · includes ' + shaftChoice.startingCars + ' car / ' + shaftChoice.startingCapacity + ' riders/dispatch · separate route'
    : shaftChoice.detail;
  const localChoiceText = (choice) => choice.detail;
  const choiceActionAttributes = (kind, choice) => kind === 'car'
    ? ' data-transport-choice="car" data-transport-shaft="' + (choice.shaftId ?? '') + '"'
    : ' data-transport-choice="' + kind + '" data-transport-floor="' + (choice.top ?? '') + '"';
  const choiceMarkup = (kind, choice, detail) => {
    const recommended = transportChoices.recommended === kind;
    const selected = transportChoices.selected === kind;
    const available = choice.available;
    const affordable = choice.affordable !== false;
    const actionable = available && affordable;
    const status = recommended ? ' · RECOMMENDED' : selected ? ' · SELECTED' : !available ? ' · UNAVAILABLE' : !affordable ? ' · FUNDS NEEDED' : '';
    const title = kind.toUpperCase() + status;
    const cost = choice.cost == null ? 'no legal placement' : money(choice.cost);
    const blocker = !available
      ? ''
      : !affordable
        ? ' · short ' + money(choice.fundsGap) + ' more'
        : '';
    const next = !actionable && transportChoices.next
      ? '<button type="button" class="transport-choice-next"' + choiceActionAttributes(transportChoices.next.kind, transportChoices.next.kind === 'car' ? carChoice : shaftChoice) + '>next: select ' + transportChoices.next.kind.toUpperCase() + '</button>'
      : '';
    const coverageNote = choice.coverageLabel ? ' · ' + choice.coverageLabel : '';
    const waveNote = choice.firstWaveCapacity > 0
      ? ' · first wave ' + choice.firstWaveTrips + '/' + choice.firstWaveCapacity + (choice.overflowTrips ? ' · ' + choice.overflowTrips + ' still queue' : '')
      : '';
    const efficiencyNote = choice.costPerCoveredWait == null
      ? ''
      : ' · about ' + money(choice.costPerCoveredWait) + '/covered wait';
    if (actionable) {
      return '<button type="button" class="transport-choice' + (recommended || selected ? ' preferred' : '') + '"' + choiceActionAttributes(kind, choice) + ' aria-label="select ' + kind + '"><b>' + title + '</b><span>' + cost + ' · ' + detail + waveNote + coverageNote + efficiencyNote + '</span></button>';
    }
    return '<div class="transport-choice ' + (!available ? 'unavailable' : 'funds') + (recommended || selected ? ' preferred' : '') + '"><b>' + title + '</b><span>' + cost + ' · ' + detail + waveNote + coverageNote + efficiencyNote + blocker + '</span>' + next + '</div>';
  };
  const transportChoicePanel = transportChoices.show
    ? '<div class="diag"><span>compare investments</span><span class="diag-warn">before building</span></div>' +
        '<div class="transport-choice-summary">' +
        choiceMarkup('car', carChoice, carChoiceText) +
        choiceMarkup('shaft', shaftChoice, shaftChoiceText) +
        localChoices.map((choice) => choiceMarkup(choice.kind, choice, localChoiceText(choice))).join('') +
      '</div>'
    : '';
  const responseAction = transportResponse.key === 'local' && !transportResponse.existing && transportResponse.kind
    ? { kind: transportResponse.kind, floor: transportResponse.targetFloor }
    : transportResponse.key === 'car' && transportChoices.car.available && transportChoices.car.affordable
      ? { kind: 'car', shaftId: transportResponse.shaftId }
      : transportResponse.key === 'shaft' && transportChoices.shaft.available && transportChoices.shaft.affordable
        ? { kind: 'shaft', floor: transportResponse.targetFloor ?? transportChoices.shaft.top }
        : null;
  const responseActionPanel = responseAction
    ? '<div class="diag-sub transport-response-action"><button type="button" class="inspect-vacancy" data-transport-response-kind="' + responseAction.kind + '" data-transport-response-shaft="' + (responseAction.shaftId ?? '') + '" data-transport-response-floor="' + (responseAction.floor ?? '') + '">next: select ' + responseAction.kind.toUpperCase() + '</button></div>'
    : '';
  const transportResponsePanelWithAction = transportResponsePanel + responseActionPanel;
  const routeHistorySummary = routeInterventionHistory.length
    ? localOverflowInterventionHistorySummary(routeInterventionHistory) : null;
  const routeHistoryPanel = routeInterventionHistory.length
    ? (() => {
      const summary = routeHistorySummary;
      const summaryClass = summary.key === 'helping' ? 'diag-good' : summary.key === 'hurting' ? 'diag-bad' : 'diag-warn';
      const stabilityClass = summary.stabilityKey === 'stable-helping' ? 'diag-good' : summary.stabilityKey === 'stable-hurting' ? 'diag-bad' : 'diag-warn';
      const outcomeSummary = summary.improved + ' improved · ' + summary.unchanged + ' unchanged · ' + summary.worse + ' worsened';
          const entries = routeInterventionHistory.map((entry) => {
            const entrySource = entry.sourceRoute?.kind === 'escalator' ? 'escalator' : 'stairs';
            const entryTarget = entry.targetRoute?.kind === 'escalator' ? 'escalator' : 'stairs';
            const tenant = entry.tenantResult;
            const entryTenant = tenant?.label ?? 'tenant result pending';
            const signed = (value, digits) => {
              const number = Number(value);
              return Number.isFinite(number) ? (number >= 0 ? '+' : '') + number.toFixed(digits) : '—';
            };
            const deltas = tenant
              ? ' · wait Δ' + signed(tenant.waitDelta, 2) + 's · stress Δ' + signed(tenant.stressDelta, 2) + ' · rep Δ' + signed(tenant.reputationDelta, 1) + ' · gave up Δ' + signed(tenant.abandonedDelta, 0)
              : '';
            return 'D' + entry.day + ' ' + entrySource + ' → ' + entryTarget + ': ' + entryTenant + deltas;
          }).join(' · ');
      return '<div class="diag-sub"><span>route history</span> · <span class="' + summaryClass + '">' + summary.label + '</span> · ' + outcomeSummary + ' · ' + routeInterventionHistory.length + '/4 retained</div><div class="diag-sub"><span class="' + stabilityClass + '">' + summary.stabilityLabel + '</span> · tests · ' + entries + '</div>';
    })()
    : '';
  const routeInterventionPanel = routeInterventionOutcome
    ? (() => {
      const source = routeInterventionOutcome.sourceRoute;
      const sourceLabel = source.kind === 'escalator' ? 'escalator' : 'stairs';
      const before = routeInterventionOutcome.before;
      if (!routeInterventionOutcome.placed) {
        return '<div class="diag-sub"><span>route test</span> · ' + sourceLabel + ' F' + source.bottom + '–F' + source.top + ' overflow baseline avg +' + before.average.toFixed(2) + ' · place the selected alternate route to test relief</div>';
      }
      if (!routeInterventionOutcome.after) {
        return '<div class="diag-sub"><span>route test</span> · ' + sourceLabel + ' overflow baseline avg +' + before.average.toFixed(2) + ' · alternate route placed · awaiting next day close</div>';
      }
      const result = routeInterventionOutcome.result;
      const resultClass = result.key === 'absorbed' || result.key === 'relieved' ? 'diag-good' : result.key === 'worse' ? 'diag-bad' : 'diag-warn';
      const alternate = routeInterventionOutcome.targetRoute;
      const alternateLabel = alternate
        ? (alternate.kind === 'escalator' ? 'escalator' : 'stairs') + ' F' + alternate.bottom + '–F' + alternate.top
        : 'alternate route';
      const tenantResult = routeInterventionOutcome.tenantResult;
      const nextAction = localOverflowInterventionNextAction(result, alternate, state, CONFIG, tenantResult, routeHistorySummary);
      const tenantResultClass = tenantResult?.key === 'improved' ? 'diag-good' : tenantResult?.key === 'worse' ? 'diag-bad' : 'diag-warn';
      const tenantReputation = tenantResult?.beforeReputation == null || tenantResult?.afterReputation == null
        ? 'rep —'
        : 'rep ' + tenantResult.beforeReputation.toFixed(1) + ' → ' + tenantResult.afterReputation.toFixed(1);
      const tenantImpact = tenantResult
        ? ' · <span class="' + tenantResultClass + '">' + tenantResult.label + '</span> · local wait ' + tenantResult.beforeWait.toFixed(2) + 's → ' + tenantResult.afterWait.toFixed(2) + 's · avg stress ' + tenantResult.beforeStress.toFixed(2) + ' → ' + tenantResult.afterStress.toFixed(2) + ' · ' + tenantReputation + ' · ' + tenantResult.afterAbandoned + ' gave up'
        : '';
      const projection = nextAction.kind && nextAction.available
        ? ' · span ' + nextAction.spanFloors + ' floors / ' + nextAction.travelSeconds.toFixed(1) + 's travel · live ' + nextAction.liveOccupancy + '/' + nextAction.capacity + ' occupied' + (nextAction.liveQueue ? ' + ' + nextAction.liveQueue + ' waiting' : '') + ' · local capacity ' + nextAction.currentCapacity + ' → ' + nextAction.projectedCapacity + ' · expected overflow relief up to ' + nextAction.expectedOverflowRelief.toFixed(2) + ' avg · cost ' + money(nextAction.cost)
        : '';
      const followupAction = nextAction.kind && alternate
        ? nextAction.available && nextAction.affordable
          ? projection + ' · ' + nextAction.detail + ' · <button type="button" class="transport-choice-next" data-route-overflow-action-kind="' + nextAction.kind + '" data-route-overflow-action-floor="' + alternate.top + '" data-route-overflow-source-kind="' + alternate.kind + '" data-route-overflow-source-id="' + alternate.id + '" data-route-overflow-source-bottom="' + alternate.bottom + '" data-route-overflow-source-top="' + alternate.top + '">next: select ' + nextAction.kind.toUpperCase() + '</button>'
          : projection + ' · ' + nextAction.detail + ' · next: ' + nextAction.label + ' unavailable — ' + (nextAction.available ? 'need ' + money(nextAction.fundsGap) + ' more' : nextAction.placementDetail)
        : ' · next: ' + nextAction.label + ' — ' + nextAction.detail;
      return '<div class="diag-sub"><span>route test</span> · <span class="' + resultClass + '">' + result.label + '</span> · ' + sourceLabel + ' avg +' + result.beforeAverage.toFixed(2) + ' → +' + result.afterAverage.toFixed(2) + ' · peak ' + result.beforePeak + ' → ' + result.afterPeak + ' · ' + alternateLabel + ' now avg +' + result.alternateAverage.toFixed(2) + ' · peak ' + result.alternatePeak + ' · after D' + routeInterventionOutcome.after.day + tenantImpact + followupAction + '</div>' + routeHistoryPanel;
    })()
    : routeHistoryPanel;
  const queueTrendRows = state.shafts.map((sh, i) => {
    const liveQueue = state.people.filter((person) => person.state === 'waiting' && person.shaft === sh.id).length;
    const dispatchCapacity = Math.max(0, sh.cars.length * Math.floor(Number(CONFIG.elevator?.capacity) || 0));
    const wave = firstWavePressure(liveQueue, 0, dispatchCapacity);
    const trend = shaftQueueTrend(carQueueHistory.get(sh.id));
    const trendLabel = trend.entries.length > 1
      ? 'trend ' + trend.bars + ' · ' + (trend.spike ? 'spike' : trend.direction)
      : trend.entries.length ? 'trend collecting' : 'no trend yet';
    const trendClass = trend.current > 11 ? 'diag-bad' : trend.direction === 'falling' && !trend.spike ? 'diag-good' : 'diag-warn';
    const daily = shaftQueueDailyTrend(carQueueDailyHistory.get(sh.id));
    const dailyPressure = shaftQueueDailyPressure(carQueueDailyHistory.get(sh.id));
    const dailyLabel = daily.entries.length > 1
      ? 'trend ' + daily.bars + ' · ' + daily.direction + ' · peak ' + Math.round(daily.peak)
      : daily.entries.length ? 'daily history collecting' : 'no daily history yet';
    const dailyPressureLabel = dailyPressure.key === 'sustained'
      ? ' · repeated for ' + dailyPressure.consecutiveDays + ' days'
      : dailyPressure.key === 'spike'
        ? ' · one-day spike — keep watching'
        : '';
    const dailyClass = dailyPressure.key === 'sustained' || daily.current > 11 ? 'diag-bad'
      : daily.direction === 'falling' && dailyPressure.key !== 'spike' ? 'diag-good' : 'diag-warn';
    const waveClass = wave.overflow > 0 ? 'diag-bad' : liveQueue > 0 ? 'diag-warn' : 'diag-good';
    const waveLabel = dispatchCapacity > 0
      ? 'now ' + liveQueue + ' · first wave ' + wave.trips + '/' + wave.capacity + (wave.overflow ? ' · ' + wave.overflow + ' remain queued' : '')
      : 'now ' + liveQueue + ' · no car capacity';
    return '<div class="diag-sub"><span>S' + (i + 1) + ' recent queue</span> · <span class="' + trendClass + '">' + trendLabel + ' · now ' + trend.current + '</span></div>' +
      '<div class="diag-sub"><span>S' + (i + 1) + ' live pressure</span> · <span class="' + waveClass + '">' + waveLabel + '</span></div>' +
      '<div class="diag-sub"><span>S' + (i + 1) + ' daily queue</span> · <span class="' + dailyClass + '">' + dailyLabel + dailyPressureLabel + '</span></div>';
  }).join('');
  const queueDailyPanel = '<div class="diag"><span>queue → daily service</span><span class="' + indicatorCssClass(dailyService.key) + '">' + dailyService.label + '</span></div>' +
    '<div class="diag-sub">' + dailyService.detail + '</div>' + localOverflowPanel + routeInterventionPanel + transportResponsePanelWithAction + transportChoicePanel + queueTrendRows;

  const stairRows = (state.stairs ?? []).map((stair, i) => {
    const walking = localRouteOccupancy(state, 'stairs', stair.id);
    const queued = state.people.filter((p) => p.state === 'waiting' && p.localRouteKind === 'stairs' && p.localRouteId === stair.id).length;
    const capacity = Math.max(1, Math.floor(Number(CONFIG.stairs?.capacity) || 0));
    const reachable = localRouteReachableWaiting(stair);
    const wave = firstWavePressure(reachable, walking, capacity);
    const dailyTrend = localRouteDailyTrend(localRouteDailyHistory.get('stairs:' + stair.id));
    const overflowHistory = localOverflowRouteHistory(state.log, 'stairs', stair.id);
    const overflowTrend = localOverflowDailyTrend(overflowHistory);
    const overflowPressure = localOverflowDailyPressure(overflowHistory);
    const dailyTrendText = dailyTrend.entries.length > 1
      ? ' · daily ' + dailyTrend.bars + ' · ' + dailyTrend.direction + ' · avg ' + dailyTrend.current.toFixed(1) + ' · peak ' + dailyTrend.peak
      : dailyTrend.entries.length ? ' · daily trend collecting' : ' · daily trend awaiting close';
    const dailyTrendClass = dailyTrend.direction === 'rising' ? 'diag-bad' : dailyTrend.direction === 'falling' ? 'diag-good' : 'diag-warn';
    const overflowText = overflowTrend.entries.length > 1
      ? 'overflow ' + overflowTrend.bars + ' · avg +' + overflowTrend.current.toFixed(2) + ' · ' + (overflowPressure.sustained ? 'sustained ' + overflowPressure.consecutiveDays + 'd' : overflowPressure.key === 'spike' ? 'spike' : overflowTrend.direction)
      : overflowTrend.entries.length ? 'overflow history collecting' : 'overflow history awaiting close';
    const overflowClass = overflowPressure.key === 'sustained' ? 'diag-bad' : overflowPressure.key === 'spike' ? 'diag-warn' : overflowTrend.direction === 'falling' ? 'diag-good' : 'diag-warn';
    const overflowActionKind = overflowPressure.sustained && transportResponse.key === 'local' &&
      transportResponse.sourceRouteKind === 'stairs' && Number(transportResponse.sourceRouteId) === Number(stair.id) &&
      transportResponse.kind !== 'stairs' ? transportResponse.kind : null;
  const overflowAction = overflowActionKind
      ? '<button type="button" class="transport-choice-next" data-route-overflow-action-kind="' + overflowActionKind + '" data-route-overflow-action-floor="' + (transportResponse.targetFloor ?? stair.top) + '" data-route-overflow-source-kind="stairs" data-route-overflow-source-id="' + stair.id + '" data-route-overflow-source-bottom="' + stair.bottom + '" data-route-overflow-source-top="' + stair.top + '">next: select ' + overflowActionKind.toUpperCase() + '</button>'
      : '';
    const statusClass = wave.overflow > 0 || walking >= capacity ? 'diag-bad' : reachable ? 'diag-warn' : 'diag-good';
    const pressureText = reachable
      ? 'reachable ' + reachable + ' · first wave ' + wave.trips + '/' + wave.capacity + (wave.overflow ? ' · ' + wave.overflow + ' remain queued' : '')
      : 'no waiting trips in span';
    return '<div class="diag"><b>ST' + (i + 1) + '</b><span class="' + statusClass + '">' +
      walking + '/' + capacity + ' occupied' + (queued ? ' · ' + queued + ' assigned waiting' : '') + '</span></div>' +
      '<div class="diag-sub">floors ' + stair.bottom + '–' + stair.top + ' · ' + pressureText + ' · local route · no car wait · capacity is simultaneous people · crowded routes share demand · <span class="' + dailyTrendClass + '">' + dailyTrendText.slice(3) + '</span> · <span class="' + overflowClass + '">' + overflowText + (overflowTrend.peak ? ' · peak ' + overflowTrend.peak : '') + '</span></div>' + overflowAction;
  }).join('');

  const escalatorRows = (state.escalators ?? []).map((escalator, i) => {
    const riding = localRouteOccupancy(state, 'escalator', escalator.id);
    const queued = state.people.filter((p) => p.state === 'waiting' && p.localRouteKind === 'escalator' && p.localRouteId === escalator.id).length;
    const capacity = Math.max(1, Math.floor(Number(CONFIG.escalator?.capacity) || 0));
    const reachable = localRouteReachableWaiting(escalator);
    const wave = firstWavePressure(reachable, riding, capacity);
    const dailyTrend = localRouteDailyTrend(localRouteDailyHistory.get('escalator:' + escalator.id));
    const overflowHistory = localOverflowRouteHistory(state.log, 'escalator', escalator.id);
    const overflowTrend = localOverflowDailyTrend(overflowHistory);
    const overflowPressure = localOverflowDailyPressure(overflowHistory);
    const dailyTrendText = dailyTrend.entries.length > 1
      ? ' · daily ' + dailyTrend.bars + ' · ' + dailyTrend.direction + ' · avg ' + dailyTrend.current.toFixed(1) + ' · peak ' + dailyTrend.peak
      : dailyTrend.entries.length ? ' · daily trend collecting' : ' · daily trend awaiting close';
    const dailyTrendClass = dailyTrend.direction === 'rising' ? 'diag-bad' : dailyTrend.direction === 'falling' ? 'diag-good' : 'diag-warn';
    const overflowText = overflowTrend.entries.length > 1
      ? 'overflow ' + overflowTrend.bars + ' · avg +' + overflowTrend.current.toFixed(2) + ' · ' + (overflowPressure.sustained ? 'sustained ' + overflowPressure.consecutiveDays + 'd' : overflowPressure.key === 'spike' ? 'spike' : overflowTrend.direction)
      : overflowTrend.entries.length ? 'overflow history collecting' : 'overflow history awaiting close';
    const overflowClass = overflowPressure.key === 'sustained' ? 'diag-bad' : overflowPressure.key === 'spike' ? 'diag-warn' : overflowTrend.direction === 'falling' ? 'diag-good' : 'diag-warn';
    const overflowActionKind = overflowPressure.sustained && transportResponse.key === 'local' &&
      transportResponse.sourceRouteKind === 'escalator' && Number(transportResponse.sourceRouteId) === Number(escalator.id) &&
      transportResponse.kind !== 'escalator' ? transportResponse.kind : null;
    const overflowAction = overflowActionKind
      ? '<button type="button" class="transport-choice-next" data-route-overflow-action-kind="' + overflowActionKind + '" data-route-overflow-action-floor="' + (transportResponse.targetFloor ?? escalator.top) + '" data-route-overflow-source-kind="escalator" data-route-overflow-source-id="' + escalator.id + '" data-route-overflow-source-bottom="' + escalator.bottom + '" data-route-overflow-source-top="' + escalator.top + '">next: select ' + overflowActionKind.toUpperCase() + '</button>'
      : '';
    const statusClass = wave.overflow > 0 || riding >= capacity ? 'diag-bad' : reachable ? 'diag-warn' : 'diag-good';
    const pressureText = reachable
      ? 'reachable ' + reachable + ' · first wave ' + wave.trips + '/' + wave.capacity + (wave.overflow ? ' · ' + wave.overflow + ' remain queued' : '')
      : 'no waiting trips in span';
    return '<div class="diag"><b>ES' + (i + 1) + '</b><span class="' + statusClass + '">' +
      riding + '/' + capacity + ' occupied' + (queued ? ' · ' + queued + ' assigned waiting' : '') + '</span></div>' +
      '<div class="diag-sub">floors ' + escalator.bottom + '–' + escalator.top + ' · ' + pressureText + ' · faster local route · no car wait · capacity is simultaneous people · crowded routes share demand · <span class="' + dailyTrendClass + '">' + dailyTrendText.slice(3) + '</span> · <span class="' + overflowClass + '">' + overflowText + (overflowTrend.peak ? ' · peak ' + overflowTrend.peak : '') + '</span></div>' + overflowAction;
  }).join('');

  const floorRows = Array.from({ length: state.floors }, (_, floor) => {
    const summary = floorOperationsSummary(state, floor, CONFIG);
    const selected = selectedFloor === floor ? ' selected' : '';
    const floorResult = floorDiagnosisResults.get(floor);
    const working = floorResult
      ? floorDiagnosisAgeCue(floorResult, state.day)
      : null;
    const workingTag = working ? ' · <span class="floor-working ' + (working.key === 'working' ? 'diag-good' : 'diag-warn') + '" title="' + working.detail + '">' + working.label + '</span>' : '';
    const floorLabel = floor === 0 ? 'L' : floor;
    const floorTenantStatus = summary.key === 'full' ? 'full' : summary.key === 'partial' ? 'partial' : 'light';
    const floorAccessibleLabel = 'floor ' + floorLabel + '; ' + summary.waiting + ' people waiting; ' + summary.tenants + ' of ' + summary.capacity + ' tenant capacity; ' + waitingPressureColorMeaning(summary.waitingBand) + '; ' + tenantLoadColorMeaning(floorTenantStatus);
    return '<button class="floor-diagnosis' + selected + '" data-inspect-floor="' + floor + '" aria-label="' + floorAccessibleLabel + '" title="' + floorAccessibleLabel + '">' +
      '<span>floor ' + floorLabel + '</span><span>' +
      '<span class="' + indicatorCssClass(summary.waitingColorKey) + '"><b class="floor-signal-key">W</b> ' + summary.waiting + '</span> · ' +
      '<span class="' + indicatorCssClass(summary.colorKey) + '"><b class="floor-signal-key">T</b> ' + summary.tenants + '/' + summary.capacity + '</span>' + workingTag +
      '</span></button>';
  }).join('');
  const selectedFloorSummary = selectedFloor == null ? null : floorOperationsSummary(state, selectedFloor, CONFIG);
  const selectedFloorAccessResults = selectedFloor == null
    ? []
    : state.units
      .filter((unit) => unit.occupied && unit.floor === selectedFloor)
      .map((unit) => ({ unit, outcome: tenantAccessOutcomeForUnit(state, unit) }))
      .filter(({ outcome }) => outcome);
  const selectedFloorAccessCue = selectedFloorSummary
    ? '<div class="diag-sub">realized access on floor: ' + (selectedFloorAccessResults.length
      ? selectedFloorAccessResults.map(({ unit, outcome }) => '<span class="' + (outcome.realizedBonus > 0 ? 'diag-good' : outcome.realizedBonus < 0 ? 'diag-bad' : 'diag-warn') + '">F' + unit.floor + ' ' + unit.kind + ' ' + (outcome.realizedBonus == null ? '—' : (outcome.realizedBonus >= 0 ? '+' : '') + outcome.realizedBonus) + '</span>').join(' · ')
      : 'no recorded move-in access result yet') + ' · room results are separate from live tenant load, appeal, and reputation</div>'
    : '';
  const selectedMissingRouteResponse = selectedFloorSummary?.waiting
    ? unassignedQueueResponse(state, CONFIG)
    : null;
  const selectedMissingRouteNeedsShaft = selectedMissingRouteResponse?.elevatorFloors.includes(selectedFloor) ?? false;
  const selectedMissingRouteUsesLocal = selectedMissingRouteResponse?.localFloors.includes(selectedFloor) ?? false;
  const selectedMissingRouteBuildsLocal = selectedMissingRouteResponse?.buildableLocalFloors.includes(selectedFloor) ?? false;
  const focusedServiceCoverage = selectedFloorSummary && serviceFocusTarget
    ? serviceFocusCoverage(serviceFocusTarget, state, CONFIG)
    : null;
  const selectedFloorServiceCoverage = focusedServiceCoverage?.floors.includes(selectedFloor)
    ? focusedServiceCoverage
    : null;
  const selectedFloorServiceRequiredRooms = selectedFloorServiceCoverage?.requiredRoomsByFloor?.[selectedFloor] ?? 0;
  const selectedFloorServiceCoveredRooms = selectedFloorServiceCoverage?.coveredRoomsByFloor?.[selectedFloor] ?? 0;
  const selectedFloorServiceRequiredHeads = selectedFloorServiceCoverage?.requiredHeadsByFloor?.[selectedFloor] ?? 0;
  const selectedFloorServiceCoveredHeads = selectedFloorServiceCoverage?.coveredHeadsByFloor?.[selectedFloor] ?? 0;
  const selectedFloorServiceUncoveredRooms = selectedFloorServiceCoverage?.uncoveredRoomsByFloor?.[selectedFloor] ?? 0;
  const selectedFloorServiceUncoveredHeads = selectedFloorServiceCoverage?.uncoveredHeadsByFloor?.[selectedFloor] ?? 0;
  const focusedServiceResult = serviceFocusTarget
    ? serviceOutcomeHistory.slice().reverse().find((entry) => entry.kind === serviceFocusTarget.kind && entry.floor === serviceFocusTarget.floor && entry.coverageFloors === serviceFocusTarget.coverageFloors)
    : null;
  const recordedFloorAfterHeads = focusedServiceResult?.afterHeadsByFloor?.[selectedFloor];
  const floorServiceHeadDelta = Number.isFinite(recordedFloorAfterHeads)
    ? selectedFloorServiceCoveredHeads - recordedFloorAfterHeads
    : null;
  const recordedFloorRequiredHeads = focusedServiceResult?.requiredHeadsByFloor?.[selectedFloor];
  const floorRequiredHeadDelta = Number.isFinite(recordedFloorRequiredHeads)
    ? selectedFloorServiceRequiredHeads - recordedFloorRequiredHeads
    : null;
  const floorServiceHeadDeltaText = floorServiceHeadDelta == null ? ''
    : ' · recorded covered heads ' + (focusedServiceResult.beforeHeadsByFloor?.[selectedFloor] ?? 0) + ' → ' + recordedFloorAfterHeads +
      ' · live covered heads ' + selectedFloorServiceCoveredHeads + ' (Δ ' + (floorServiceHeadDelta > 0 ? '+' : '') + floorServiceHeadDelta + ')';
  const floorServiceHeadCause = serviceFloorHeadcountCause(
    selectedFloorServiceCoveredHeads,
    recordedFloorAfterHeads,
    selectedFloorServiceRequiredHeads,
    recordedFloorRequiredHeads
  );
  const floorServiceHeadCauseText = floorServiceHeadCause.key === 'vacancy'
    ? ' · <span class="diag-warn">VACANCY-DRIVEN drop (' + floorServiceHeadCause.requiredDelta + ' required heads)</span>'
    : floorServiceHeadCause.key === 'coverage'
      ? ' · <span class="diag-bad">COVERAGE-DRIVEN drop (occupied demand remains)</span>'
      : '';
  const selectedFloorServiceCue = selectedFloorServiceCoverage
    ? '<div class="diag-sub">service focus · ' + serviceFocusTarget.kind.toUpperCase() + ' · ' +
      (selectedFloorServiceRequiredRooms
        ? selectedFloorServiceCoveredRooms + '/' + selectedFloorServiceRequiredRooms + ' rooms covered · heads ' + selectedFloorServiceCoveredHeads + '/' + selectedFloorServiceRequiredHeads +
          (selectedFloorServiceUncoveredRooms
            ? ' · <span class="diag-bad">UNCOVERED ' + selectedFloorServiceUncoveredRooms + ' room' + (selectedFloorServiceUncoveredRooms === 1 ? '' : 's') + ' · ' + selectedFloorServiceUncoveredHeads + ' heads</span>'
            : ' · <span class="diag-good">all floor rooms covered</span>') + floorServiceHeadDeltaText + floorServiceHeadCauseText
        : '<span class="diag-good">no occupied rooms require this service on this floor</span>') +
      '</div>'
    : '';
  const selectedFloorTenantStatus = selectedFloorSummary?.key === 'full' ? 'full' : selectedFloorSummary?.key === 'partial' ? 'partial' : 'light';
  const selectedFloorWaitingLabel = selectedFloorSummary
    ? 'W ' + selectedFloorSummary.waiting + ' waiting people; ' + waitingPressureColorMeaning(selectedFloorSummary.waitingBand)
    : '';
  const selectedFloorTenantLabel = selectedFloorSummary
    ? 'T ' + selectedFloorSummary.tenants + '/' + selectedFloorSummary.capacity + ' tenants/capacity; ' + tenantLoadColorMeaning(selectedFloorTenantStatus)
    : '';
  const selectedFloorFocusSignal = selectedFloorSummary
    ? ' · <span class="' + indicatorCssClass(selectedFloorSummary.waitingColorKey) + '" aria-label="' + selectedFloorWaitingLabel + '" title="' + selectedFloorWaitingLabel + '">' +
      'W ' + selectedFloorSummary.waiting + ' ' + selectedFloorSummary.waitingBand + '</span> · <span class="' + indicatorCssClass(selectedFloorSummary.colorKey) + '" aria-label="' + selectedFloorTenantLabel + '" title="' + selectedFloorTenantLabel + '">' +
      'T ' + selectedFloorSummary.tenants + '/' + selectedFloorSummary.capacity + ' ' + selectedFloorTenantStatus + '</span>'
    : '';
  const selectedFloorResult = selectedFloor == null ? null : floorDiagnosisResults.get(selectedFloor) ?? null;
  const selectedVacancy = selectedFloorSummary
    ? state.units.find((unit) => unit.floor === selectedFloorSummary.floor && !unit.occupied)
    : null;
  const floorRecommendation = floorDiagnosisNextAction(selectedFloorSummary, selectedFloorResult);
  const defaultTransportActionKind = state.shafts.some((shaft) => shaft.cars.length < CONFIG.elevator.maxCarsPerShaft) ? 'car' : 'shaft';
  const transportActionKind = selectedMissingRouteNeedsShaft
    ? 'shaft'
    : selectedMissingRouteUsesLocal
      ? null
      : selectedMissingRouteBuildsLocal
        ? selectedMissingRouteResponse.localBuildKind
        : floorRecommendation?.kind === 'car' || floorRecommendation?.kind === 'shaft'
          ? floorRecommendation.kind
          : selectedFloorResult?.key === 'improved' ? null : defaultTransportActionKind;
  const floorRepeatFailure = selectedFloorResult?.source
    ? floorDiagnosisRepeatedFailure(floorDiagnosisHistory, selectedFloor, selectedFloorResult.source)
    : null;
  const repeatedLeasingResponse = floorRepeatFailure?.source === 'vacancy';
  const floorTransportReason = floorRecommendation?.key === 'alternate_transport'
    ? ' <span class="floor-action-reason">(' + floorRecommendation.reason + ')</span>'
    : '';
  const floorLocalRouteCue = selectedMissingRouteUsesLocal
    ? ' <span class="floor-action-reason">(use existing ' + selectedMissingRouteResponse.localLabel + ' here — no car wait)</span>'
    : '';
  const floorLocalBuildCue = selectedMissingRouteBuildsLocal
    ? ' <span class="floor-action-reason">(build ' + selectedMissingRouteResponse.localBuildLabel + ' to give this floor a local route' +
      (selectedMissingRouteResponse.localBuildLegalTop != null
        ? '; legal span F' + selectedMissingRouteResponse.localBuildBottom + '–F' + selectedMissingRouteResponse.localBuildLegalTop : '') +
      (selectedMissingRouteResponse.localBuildCost != null
        ? '; estimated cost ' + money(selectedMissingRouteResponse.localBuildCost) : '') + ')</span>'
    : '';
  const floorShaftCoverageReason = selectedFloorSummary && (selectedMissingRouteNeedsShaft || floorRecommendation?.kind === 'shaft')
    ? ' <span class="floor-action-reason">(' + (selectedMissingRouteNeedsShaft ? 'no assigned shaft reaches this floor' : 'shaft coverage: ' + shaftCandidateCoverageLabel(CONFIG.building.lobbyFloor ?? 0, selectedFloorSummary.floor, state.shafts)) + ')</span>'
    : '';
  const floorActionSignal = selectedFloorSummary?.waiting
    ? 'responds to W ' + selectedFloorSummary.waiting + ' ' + selectedFloorSummary.waitingBand
    : selectedFloorSummary?.vacantRooms
      ? 'responds to T ' + selectedFloorSummary.tenants + '/' + selectedFloorSummary.capacity + ' ' +
        selectedFloorTenantStatus
      : '';
  const floorActionSignalCue = floorActionSignal
    ? ' <span class="floor-action-reason">(' + floorActionSignal + ')</span>'
    : '';
  const floorActions = selectedFloorSummary
      ? (selectedFloorSummary.waiting
      && transportActionKind
      ? '<button class="inspect-vacancy" data-floor-action="' + transportActionKind + '" title="' + (floorRecommendation?.detail ?? selectedMissingRouteResponse?.detail ?? 'select this transport control for the local queue') + '">select ' + transportActionKind + ' control</button>' + floorTransportReason + floorShaftCoverageReason + floorLocalBuildCue
      : selectedFloorSummary.waiting && floorLocalRouteCue
        ? floorLocalRouteCue
      : selectedFloorSummary.waiting && floorLocalBuildCue
        ? floorLocalBuildCue
      : '') +
      (selectedVacancy && !repeatedLeasingResponse
        ? ' <button class="inspect-vacancy" data-inspect-unit="' + selectedVacancy.id + '" data-management-hint="floor" data-floor-handoff="vacancy" data-handoff-floor="' + selectedFloorSummary.floor + '">inspect vacancy</button>'
        : '') + floorActionSignalCue
    : '';
  const floorHandoffResult = floorHandoffPreview(selectedFloorSummary, floorHandoff, state, CONFIG);
  const floorHandoffPanel = floorHandoffResult
    ? '<div class="diag-sub"><span class="diag-good">why this helps:</span> ' + floorHandoffResult.detail + '</div>'
    : '';
  const selectedFloorAgeCue = selectedFloorResult
    ? floorDiagnosisAgeCue(selectedFloorResult, state.day)
    : null;
  const selectedFloorHistory = selectedFloor == null
    ? []
    : floorDiagnosisHistory.filter((entry) => entry.floor === selectedFloor).slice(-4).reverse();
  const floorDiagnosisHistoryPanel = selectedFloorHistory.length
    ? '<div class="diag-sub">recent floor tests</div><div class="floor-result-history">' +
      selectedFloorHistory.map((entry) =>
        '<div class="floor-result-history-row"><span>day ' + (entry.afterDay ?? '—') + ' · ' + (entry.source === 'vacancy' ? 'leasing' : entry.source) + '</span><span class="' + (entry.key === 'improved' ? 'diag-good' : entry.key === 'worsened' ? 'diag-bad' : 'diag-warn') + '">' + entry.key + '</span></div>' +
        '<div class="floor-result-history-detail">' + entry.label + '</div>'
      ).join('') +
      '</div>'
    : '';
  const floorDiagnosisResultPanel = selectedFloorResult && selectedFloorSummary
    ? '<div class="diag"><span>last local result</span><span class="' + (selectedFloorResult.key === 'improved' ? 'diag-good' : selectedFloorResult.key === 'worsened' ? 'diag-bad' : 'diag-warn') + '">' +
      selectedFloorResult.key + (selectedFloorAgeCue ? ' · ' + selectedFloorAgeCue.label : '') + '</span></div>' +
      '<div class="diag-sub">since day ' + (selectedFloorResult.beforeDay ?? '—') +
      (selectedFloorResult.source ? ' · ' + (selectedFloorResult.source === 'vacancy' ? 'vacancy handoff' : selectedFloorResult.source + ' handoff') : '') +
      ' · ' + selectedFloorResult.label + '</div>' +
      (selectedFloorAgeCue
        ? '<div class="diag-sub"><span class="' + (selectedFloorAgeCue.key === 'working' ? 'diag-good' : 'diag-warn') + '">' + selectedFloorAgeCue.label + ':</span> ' + selectedFloorAgeCue.detail + '</div>'
        : '') +
      (floorRepeatFailure
        ? '<div class="diag-sub"><span class="diag-bad">repeat warning:</span> ' + floorRepeatFailure.detail + '</div>' +
          '<div class="diag-sub"><span class="diag-bad">evidence:</span> day ' + (floorRepeatFailure.latest?.afterDay ?? '—') + ' · ' + (floorRepeatFailure.latest?.label ?? 'no reading') + '</div>'
        : '') +
      (floorRecommendation
        ? '<div class="diag-sub"><span class="' + (floorRecommendation.key === 'monitor' ? 'diag-good' : 'diag-warn') + '">next response:</span> ' + floorRecommendation.detail + '</div>'
        : '')
    : '';
  const floorNextAction = floorActions || (floorRecommendation
    ? '<span class="' + (floorRecommendation.key === 'monitor' ? 'diag-good' : 'diag-warn') + '">' + floorRecommendation.label + '</span>' + floorActionSignalCue
    : '');
  const floorFocusPanel = selectedFloorSummary
    ? '<div class="diag"><span>floor focus' + selectedFloorFocusSignal + '</span><span class="' + indicatorCssClass(selectedFloorSummary.waiting ? selectedFloorSummary.waitingColorKey : selectedFloorSummary.colorKey) + '">' +
      'F' + (selectedFloorSummary.floor === 0 ? 'L' : selectedFloorSummary.floor) + ' selected</span></div>' +
      '<div class="diag-sub"><span class="' + indicatorCssClass(selectedFloorSummary.waitingColorKey) + '"><b class="floor-signal-key">W</b> ' + selectedFloorSummary.waiting + '</span> · ' +
      '<span class="' + indicatorCssClass(selectedFloorSummary.colorKey) + '"><b class="floor-signal-key">T</b> ' + selectedFloorSummary.tenants + '/' + selectedFloorSummary.capacity + '</span> · ' +
      selectedFloorSummary.rooms + ' room' + (selectedFloorSummary.rooms === 1 ? '' : 's') + ' · ' + selectedFloorSummary.vacantRooms + ' vacant</div>' +
      selectedFloorAccessCue +
      selectedFloorServiceCue +
      '<div class="diag-sub">' + (selectedFloorSummary.waiting
          ? 'Local queue pressure points to elevator coverage or car availability for this floor.'
          : selectedFloorSummary.vacantRooms
          ? 'The queue is clear; unused capacity here is a leasing or room-quality problem.'
          : 'The queue is clear and this floor has no vacant built rooms.') + '</div>'
      + (floorNextAction ? '<div class="diag-sub">next action: ' + floorNextAction + '</div>' : '')
      + floorHandoffPanel
      + floorDiagnosisResultPanel
      + floorDiagnosisHistoryPanel
    : '<div class="diag-sub">select a floor below to inspect its queue and tenant load together</div>';

  const rated = state.units.filter((u) => u.occupied)
    .map((u) => ({ u, evaluation: unitEvaluation(state, u, CONFIG) }))
    .sort((a, b) => a.evaluation.score - b.evaluation.score).slice(0, 3);
  const evalRows = rated.length ? rated.map(({ u, evaluation }) => {
    const cls = evaluation.score < CONFIG.evaluation.relistMinScore ? 'diag-bad'
      : evaluation.score < 80 ? 'diag-warn' : 'diag-good';
    const load = tenantLoadStatus(u, CONFIG);
    const loadClass = indicatorCssClass(load.colorKey);
    const retention = tenantRetentionPressure(state, u, CONFIG);
    const retentionRecommendation = tenantRetentionRecommendation(state, u, CONFIG);
    const pressure = Number(Math.max(0, Number(u.desirabilityPressure) || 0).toFixed(1));
    const pressureClass = pressure >= retention.vacateAt ? 'diag-bad' : pressure > 0 ? 'diag-warn' : 'diag-good';
    // Same rule as the room panel: a null recommendation is not "not monitor".
    // The rows are filtered to occupied rooms today, so this cannot be null —
    // but the guard belongs on the object, not on the filter above it.
    const retentionAction = retentionRecommendation && retentionRecommendation.key !== 'monitor'
      ? ' · <span class="diag-warn" title="' + retentionRecommendation.detail + '">next: ' + retentionRecommendation.label + '</span>'
      : '';
    const access = evaluation.accessSlots == null ? 'no access'
      : evaluation.accessMode === 'stairs' ? 'stairs ' + evaluation.accessSeconds + 's'
        : evaluation.accessMode === 'escalator' ? 'escalator ' + evaluation.accessSeconds + 's'
        : evaluation.accessSlots + ' slot walk';
    const food = evaluation.foodCovered ? 'food ' + (evaluation.foodFloors ? evaluation.foodFloors + ' floor walk' : 'same floor') : 'no food';
    const parking = evaluation.parkingCovered ? 'parking ' + (evaluation.parkingFloors ? evaluation.parkingFloors + ' floor walk' : 'same floor') : 'no parking';
    const medical = CONFIG.units[u.kind].medicalNeed
      ? (evaluation.medicalCovered ? 'medical ' + (evaluation.medicalFloors ? evaluation.medicalFloors + ' floor walk' : 'same floor') : 'no medical')
      : '';
    const security = CONFIG.units[u.kind].securityNeed
      ? (evaluation.securityCovered ? 'security ' + (evaluation.securityFloors ? evaluation.securityFloors + ' floor walk' : 'same floor') : 'no security')
      : '';
    const recycling = CONFIG.units[u.kind].recyclingNeed
      ? (evaluation.recyclingCovered ? 'recycling ' + (evaluation.recyclingFloors ? evaluation.recyclingFloors + ' floor walk' : 'same floor') : 'no recycling')
      : '';
    const loadSignalLabel = 'T ' + load.tenants + '/' + load.capacity + ' tenants/capacity; ' + load.label + '; ' + tenantLoadColorMeaning(load.key);
    return '<div class="diag"><span>F' + u.floor + ' ' + u.kind + '</span><span class="' + cls + '">' +
      evaluation.score + ' eval · ' + access + ' · fit -' + evaluation.preferencePenalty + ' · layout +' + evaluation.layoutBonus + ' · view +' + evaluation.viewBonus + ' · amenity +' + evaluation.amenityBonus + '</span></div>' +
      '<div class="diag-sub"><span class="' + loadClass + '" aria-label="' + loadSignalLabel + '" title="' + loadSignalLabel + '"><b class="floor-signal-key">T</b> ' + load.tenants + '/' + load.capacity + ' · ' + load.label + '</span> · stress ' + evaluation.stress + '/' + CONFIG.units[u.kind].vacateAt +
      ' · <span class="' + pressureClass + '" title="low room appeal builds this separate retention pressure; elevator stress remains separate">appeal pressure ' + pressure + '/' + retention.vacateAt + '</span>' +
      retentionAction + ' · noise ' + evaluation.noise + ' · ' + food + ' · ' + parking + (medical ? ' · ' + medical : '') +
      (security ? ' · ' + security : '') +
      (recycling ? ' · ' + recycling : '') +
    ' · rent $' + evaluation.rent + '/day</div>';
  }).join('') : '<div class="diag-good">no occupied units</div>';
  const tenantLoadLegend = '<div class="diag-sub">tenant load: <span class="diag-good">full</span> ≥75% · <span class="diag-warn">partial</span> 50–74% · <span class="diag-bad">light load</span> &lt;50%</div>';
  const roomHealthEntries = roomHealthHistory.filter((entry) =>
    state.units.some((unit) => unit.id === entry.unitId))
    .map((entry) => {
      const room = state.units.find((unit) => unit.id === entry.unitId);
      const status = roomHealthHistoryStatus(entry, state, room, CONFIG);
      const age = roomHealthHistoryAge(entry, state);
      return { entry, status, age, priority: roomHealthHistoryPriority(status, age) };
    })
    .sort((a, b) => a.priority - b.priority || b.age - a.age || b.entry.day - a.entry.day)
    .map(({ entry }) => entry);
  const roomHealthRows = roomHealthEntries.map((entry) => {
    const room = state.units.find((unit) => unit.id === entry.unitId);
    const status = roomHealthHistoryStatus(entry, state, room, CONFIG);
    const action = roomHealthHistoryAction(status, room);
    const change = roomHealthHistoryChange(entry, status);
    const refreshChange = roomHealthHistoryChange(entry, { score: entry.scoreAtRefresh });
    const ageLabel = roomHealthHistoryAgeLabel(entry, state);
    const urgency = roomHealthHistoryUrgency(status, roomHealthHistoryAge(entry, state));
    const statusClass = urgency.key === 'stale' ? 'diag-critical' : urgency.key === 'active' ? 'diag-bad' : 'diag-good';
    const changeClass = change.key === 'improved' ? 'diag-good' : change.key === 'worsened' ? 'diag-bad' : 'diag-warn';
    const refreshChangeClass = refreshChange.key === 'improved' ? 'diag-good' : refreshChange.key === 'worsened' ? 'diag-bad' : 'diag-warn';
    const currentText = status.key === 'active'
      ? 'active now'
      : 'resolved · monitor room';
    const responseText = action.key === 'inspect'
      ? ' · response: ' + roomEvaluationResponse(room).label
      : '';
    const actionButton = action.key === 'renovate'
      ? ' <button class="inspect-vacancy" data-room-health-action="renovate" data-room-health-unit="' + room.id + '"' +
        (state.money < CONFIG.costs.renovation ? ' disabled title="Need $' + CONFIG.costs.renovation.toLocaleString() + ' to renovate"' : '') +
        '>renovate room · $' + CONFIG.costs.renovation.toLocaleString() + '</button>'
      : action.key === 'inspect'
        ? ' <button class="inspect-vacancy" data-inspect-unit="' + room.id + '">open room</button>'
        : '';
    return '<div class="diag"><span>F' + entry.floor + ' ' + entry.kind + '</span><span class="' + statusClass + '">' + urgency.label + '</span></div>' +
      '<div class="diag-sub">refreshed D' + entry.day + ' · ' + ageLabel + ' · average ' + entry.average +
      '/100 over ' + entry.readings + ' readings · at refresh <span class="' + refreshChangeClass + '">' + refreshChange.label + '</span> · current ' + status.score + '/100 · now <span class="' + changeClass + '">' + change.label + '</span> · ' + currentText + responseText + actionButton + '</div>';
  }).join('');
  const roomHealthLegend = '<div class="diag-sub"><span class="diag-bad">ACTIVE LOW EVAL</span> = current score below relist threshold · <span class="diag-critical">STALE</span> = active for 2+ days · ' +
    '<span class="diag-good">RESOLVED HISTORY</span> = currently recovered · improved/worsened/steady = current vs warning average</div>';
  const roomHealthPanel = '<div class="diag"><span>room health history</span><span class="diag-warn">' + roomHealthEntries.length + ' tracked</span></div>' +
    roomHealthLegend + (roomHealthRows || '<div class="diag-sub">no retained room warnings</div>');

  const food = foodDemand(state, CONFIG);
  const foodFacilities = (state.facilities ?? []).filter((f) => f.kind === 'food').length;
  const foodClass = food.coveredRooms === food.rooms ? 'diag-good' : foodFacilities ? 'diag-warn' : 'diag-bad';
  const foodRows = '<div class="diag"><span>food service</span><span class="' + foodClass + '">' +
    food.coveredRooms + '/' + food.rooms + ' rooms covered</span></div>' +
    '<div class="diag-sub">' + (foodFacilities
      ? food.coveredHeads + '/' + food.heads + ' people covered · each cafeteria serves ±1 floor · amenity +' + CONFIG.evaluation.amenityWeight + ' eval'
      : 'no cafeteria · place one to serve this tower') + '</div>';
  const parking = parkingDemand(state, CONFIG);
  const parkingFacilities = (state.facilities ?? []).filter((f) => f.kind === 'parking').length;
  const parkingClass = parking.coveredRooms === parking.rooms ? 'diag-good' : parkingFacilities ? 'diag-warn' : 'diag-bad';
  const parkingRows = '<div class="diag"><span>parking</span><span class="' + parkingClass + '">' +
    parking.coveredRooms + '/' + parking.rooms + ' rooms covered</span></div>' +
    '<div class="diag-sub">' + (parkingFacilities
      ? parking.coveredHeads + '/' + parking.heads + ' people covered · each garage serves ±2 floors'
      : 'no parking · place a garage to serve this tower') + '</div>';
  const medical = medicalDemand(state, CONFIG);
  const medicalFacilities = (state.facilities ?? []).filter((f) => f.kind === 'medical').length;
  const medicalClass = medical.coveredRooms === medical.rooms ? 'diag-good' : medicalFacilities ? 'diag-warn' : 'diag-bad';
  const medicalRows = '<div class="diag"><span>medical</span><span class="' + medicalClass + '">' +
    (medical.rooms ? medical.coveredRooms + '/' + medical.rooms + ' rooms covered' : 'no demand yet') + '</span></div>' +
    '<div class="diag-sub">' + (medical.rooms
      ? (medicalFacilities
        ? medical.coveredHeads + '/' + medical.heads + ' people covered · each clinic serves ±3 floors'
        : 'no clinic · condos need medical coverage')
      : 'no condo medical demand yet · unlocks at 60 population') + '</div>';
  const security = securityDemand(state, CONFIG);
  const securityFacilities = (state.facilities ?? []).filter((f) => f.kind === 'security').length;
  const securityClass = security.coveredRooms === security.rooms ? 'diag-good' : securityFacilities ? 'diag-warn' : 'diag-bad';
  const securityRows = '<div class="diag"><span>security</span><span class="' + securityClass + '">' +
    security.coveredRooms + '/' + security.rooms + ' rooms covered</span></div>' +
    '<div class="diag-sub">' + (securityFacilities
      ? security.coveredHeads + '/' + security.heads + ' people covered · each desk serves ±4 floors'
      : 'no security desk · place one to serve this tower') + '</div>';
  const recycling = recyclingDemand(state, CONFIG);
  const recyclingFacilities = (state.facilities ?? []).filter((f) => f.kind === 'recycling').length;
  const recyclingClass = recycling.coveredRooms === recycling.rooms ? 'diag-good' : recyclingFacilities ? 'diag-warn' : 'diag-bad';
  const recyclingRows = '<div class="diag"><span>recycling</span><span class="' + recyclingClass + '">' +
    recycling.coveredRooms + '/' + recycling.rooms + ' rooms covered</span></div>' +
    '<div class="diag-sub">' + (recyclingFacilities
      ? recycling.coveredWaste + '/' + recycling.waste + ' waste covered · each facility serves ±2 floors'
      : 'no recycling · place a facility to handle tower waste') + '</div>';

  const vacantRooms = state.units.filter((u) => !u.occupied);
  const lowEvaluationRooms = state.units.filter((u) => u.occupied && unitEvaluation(state, u, CONFIG).score < CONFIG.evaluation.relistMinScore).length;
  const utilizationHint = tenantUtilizationManagementHint(utilizationTrend, {
    vacantRooms: vacantRooms.length,
    lowEvaluationRooms,
  });
  const utilizationHintClass = utilizationHint.key === 'vacancies' || utilizationHint.key === 'experience' || utilizationHint.key === 'demand'
    ? 'diag-warn' : utilizationHint.key === 'improved' ? 'diag-good' : utilizationHint.key === 'steady' ? 'diag-good' : 'diag-warn';
  const leasingForecastState = leasingForecast(state, CONFIG, d?.rep);
  const vacancyRankingExplanation = vacancyRankingReason(leasingForecastState);
  const vacancyRankingGuidanceState = vacancyRankingGuidance(leasingForecastState);
  const vacancyRankingCandidates = vacancyRankingAccessSummary(leasingForecastState);
  const vacancyRankingSignals = vacancyRankingSignalSummary(leasingForecastState);
  const vacancyAccessForecast = leasingForecastState.transportAccess;
  const vacancyAccessClass = vacancyAccessForecast?.key === 'helping' ? 'diag-good' : vacancyAccessForecast?.key === 'hurting' ? 'diag-bad' : 'diag-warn';
  const vacancyAccessPanel = '<div class="diag-sub">vacancy ranking access: <span class="' + vacancyAccessClass + '">' + (vacancyAccessForecast?.label ?? 'no route evidence yet') + '</span> · ' + ((vacancyAccessForecast?.bonus ?? 0) >= 0 ? '+' : '') + (vacancyAccessForecast?.bonus ?? 0) + ' demand points · ' + (vacancyAccessForecast?.tests ?? 0) + ' route test' + ((vacancyAccessForecast?.tests ?? 0) === 1 ? '' : 's') + (vacancyAccessForecast?.trend?.bars ? ' · ' + vacancyAccessForecast.trend.bars : '') + ' · separate from appeal and reputation</div>';
  const priorityVacancy = leasingForecastState.candidates[0] ?? leasingForecastState.marketCandidates[0];
  const lowestEvaluationRoom = rated.find(({ evaluation }) => evaluation.score < CONFIG.evaluation.relistMinScore)?.u;
  const hintVacancy = priorityVacancy?.unit ?? vacantRooms[0];
  const utilizationHintAction = utilizationHint.action === 'vacancy' && hintVacancy
    ? ' <button class="inspect-vacancy" data-inspect-unit="' + hintVacancy.id + '" data-management-hint="vacancy">inspect vacancy</button>'
    : utilizationHint.action === 'experience' && lowestEvaluationRoom
      ? ' <button class="inspect-vacancy" data-inspect-unit="' + lowestEvaluationRoom.id + '" data-management-hint="experience">open lowest room</button>'
      : utilizationHint.action === 'demand'
        ? ' · see tenant demand below'
        : '';
  const utilizationHintPanel = '<div class="diag"><span>management hint</span><span class="' + utilizationHintClass + '">' + utilizationHint.label + utilizationHintAction + '</span></div>' +
    (managementHintConfirmation ? '<div class="diag-sub"><span class="diag-good">' + managementHintConfirmation + '</span></div>' : '') +
    '<div class="diag-sub">' + utilizationHint.detail + '</div>';
  const priorityVacancyPanel = vacancyRankingCandidates.length
    ? '<div class="diag-sub">vacancy ranking · access and tenant-mix contributions shown separately</div>' + vacancyRankingCandidates.map((candidate) =>
      '<div class="diag-sub">' + (candidate.rank === 1
        ? (leasingForecastState.candidates.length ? 'next leasing priority: ' : 'top eligible vacancy: ')
        : 'rank ' + candidate.rank + ': ') +
      'F' + candidate.floor + ' ' + candidate.kind + ' · eval ' + candidate.evaluation +
      ' · mix +' + candidate.marketBonus + ' · ' + candidate.mixLabel +
      (candidate.mixShare == null ? '' : ' ' + Math.round(candidate.mixShare * 100) + '%/' + Math.round(candidate.mixTargetShare * 100) + '% target') +
      ' · demand +' + candidate.demandBonus +
      ' · access ' + (candidate.accessBonus >= 0 ? '+' : '') + candidate.accessBonus +
      ' · appeal ' + (candidate.appealBonus >= 0 ? '+' : '') + candidate.appealBonus +
      ' <button class="inspect-vacancy" data-inspect-unit="' + candidate.unitId + '">inspect</button></div>'
    ).join('') + '<div class="diag-sub">' + (priorityVacancy?.experienceDemand.label ?? '') + '</div>' + vacancyAccessPanel +
      (vacancyRankingSignals ? '<div class="diag-sub">ranking comparison: ' + vacancyRankingSignals.detail + ' · room appeal and access remain separate contributors</div>' : '')
    : '<div class="diag-sub">no eligible vacancy is currently ready to inspect · ranked access contributions appear when a vacancy clears the gates</div>' + vacancyAccessPanel;
  const vacancyRankingGuidancePanel = '<div class="diag-sub"><span class="' + (vacancyRankingGuidanceState.key === 'none' ? 'diag-warn' : 'diag-good') + '">vacancy choice</span>: ' + vacancyRankingGuidanceState.label + ' · ' + vacancyRankingGuidanceState.detail + '</div>';
  const vacancyStatuses = vacantRooms.map((u) => ({
    u, status: leaseStatus(state, u, CONFIG, d?.rep),
  }));
  const readyRooms = vacancyStatuses.filter(({ status }) => status.key === 'ready');
  const leasingClass = readyRooms.length ? 'diag-good' : vacantRooms.length ? 'diag-warn' : 'diag-good';
  const leasingRows = '<div class="diag"><span>leasing</span><span class="' + leasingClass + '">' +
    readyRooms.length + '/' + vacantRooms.length + ' rooms ready</span></div>' +
    '<div class="diag-sub">' + (readyRooms.length
      ? 'forecast: ' + leasingForecastState.candidates.length + ' eligible · up to ' + leasingForecastState.expected + ' move-ins / day'
      : vacantRooms.length
        ? leasingForecastState.gateOpen
          ? 'forecast: ' + leasingForecastState.marketReady + ' vacancies pass evaluation and market timing'
          : 'forecast paused: reputation gate is closed at ' + Math.round(leasingForecastState.reputation) + '%'
        : 'no vacant rooms') + '</div>' +
    '<div class="diag-sub">forecast combines evaluation, access, floor services, reputation timing, tenant-mix demand, and ' + leasingForecastState.capacity + ' move-in slots / day</div>' +
    priorityVacancyPanel +
    vacancyRankingGuidancePanel +
    (vacancyRankingExplanation ? '<div class="diag-sub"><span class="diag-good">' + vacancyRankingExplanation + '</span></div>' : '') +
    '<div class="diag-sub">tenant mix demand favors underrepresented types, up to +' + CONFIG.occupancy.marketDemandWeight + ' move-in priority · healthy reputation can shorten market delay by up to ' + CONFIG.occupancy.reputationRelistSpeedWeight + ' day</div>';
  const leasingOutcome = d?.leasing;
  const leasingOutcomePanel = leasingOutcome
    ? '<div class="diag-sub">last close: ' + (leasingOutcome.movedIn.length
      ? leasingOutcome.movedIn.map((move) => 'F' + move.floor + ' ' + move.unitKind + ' · demand +' + move.experienceDemandBonus + ' (' + move.experienceDemandScore + '/100) · access ' + ((move.transportAccessBonus ?? 0) >= 0 ? '+' : '') + (move.transportAccessBonus ?? 0) + ' · appeal ' + ((move.desirabilityDemandBonus ?? 0) >= 0 ? '+' : '') + (move.desirabilityDemandBonus ?? 0) + ' · mix +' + move.marketDemandBonus).join(' · ')
      : 'no move-ins') + ' · ' + leasingOutcome.candidates + ' eligible / ' + leasingOutcome.capacity + ' slots</div>'
     : '';
  const vacancyPreFillChoiceSignalState = vacancyPreFillChoiceSignal(vacancyPreFillResultHistory);
  const vacancyPreFillOutcomeSignalState = vacancyPreFillOutcomeSignal(vacancyPreFillResultHistory);
  const vacancyPreFillOverrideSignalState = vacancyPreFillOverrideSignal(vacancyPreFillResultHistory);
  const vacancyPreFillResultHistoryLinesState = vacancyPreFillResultHistoryLines(vacancyPreFillResultHistory);
  const vacancyPreFillResultPanel = lastVacancyPreFillResult
    ? '<div class="diag-sub">last re-rent forecast: <span class="' + (lastVacancyPreFillResult.key === 'matched' || lastVacancyPreFillResult.key === 'better' ? 'diag-good' : 'diag-warn') + '">' +
      lastVacancyPreFillResult.label + '</span> · D' + lastVacancyPreFillResult.day + ' · ' + lastVacancyPreFillResult.followThroughLabel + ' · ' + lastVacancyPreFillResult.detail +
      '<br>ranking breakdown: ' + vacancyPreFillRankingLabel(lastVacancyPreFillResult) +
      '<br>recent checks:<div class="vacancy-prefill-history">' + vacancyPreFillResultHistoryLinesState.map((line) =>
        '<div class="vacancy-prefill-history-row">' + line.replace(/^(D[^·]+)/, '<span class="vacancy-prefill-day">$1</span>') + '</div>'
      ).join('') + '</div>' +
      '<br>choice signal: <span class="' + (vacancyPreFillChoiceSignalState.key === 'overridden' ? 'diag-warn' : vacancyPreFillChoiceSignalState.key === 'followed' ? 'diag-good' : 'diag-warn') + '">' +
      vacancyPreFillChoiceSignalState.label + '</span> · ' + vacancyPreFillChoiceSignalState.detail +
      '<br>outcome signal: <span class="' + (vacancyPreFillOutcomeSignalState.key === 'follow-outperforms' ? 'diag-good' : 'diag-warn') + '">' +
      vacancyPreFillOutcomeSignalState.label + '</span> · ' + vacancyPreFillOutcomeSignalState.detail +
      '<br>override pull: <span class="diag-warn">' + vacancyPreFillOverrideSignalState.label + '</span> · ' + vacancyPreFillOverrideSignalState.detail + '</div>'
    : '';
  const leasingHistory = tenantLeasingHistory(state, CONFIG);
  const leasingHistoryPanel = '<div class="diag-sub">leasing history: ' + (leasingHistory.length
      ? leasingHistory.map((entry) => 'D' + entry.day + ' ' + entry.movedIn + '/' + entry.capacity + ' moved in' +
      (entry.averageScore == null ? ' · realized access — (no move-ins)' : ' · quality ' + entry.averageScore + '/100 · demand +' + entry.averageBonus + ' · realized access ' + (entry.realizedTransportAccessBonus >= 0 ? '+' : '') + entry.realizedTransportAccessBonus + ' · appeal ' + (entry.averageDesirabilityBonus >= 0 ? '+' : '') + entry.averageDesirabilityBonus + ' · mix +' + entry.averageMarketBonus) +
      (entry.transportAccessKey === 'unknown' ? '' : ' · forecast access ' + entry.transportAccessLabel + ' ' + (entry.transportAccessBonus >= 0 ? '+' : '') + entry.transportAccessBonus + (entry.transportAccessTrendBars ? ' ' + entry.transportAccessTrendBars : '')) +
      (entry.rankingSignals?.detail ? ' · daily ranking: ' + entry.rankingSignals.detail : '') +
      (entry.appealChanges?.detail ? ' · appeal changes: ' + entry.appealChanges.detail : '')).join(' · ')
    : 'no closed-day outcomes yet · future entries separate forecast access, realized access, and room-appeal changes') + '</div>';
  const latestAppealChanges = leasingHistory.at(-1)?.appealChanges;
  const vacancyAppealAction = vacancyAppealChangeAction(latestAppealChanges);
  const vacancyAppealFactorLabels = { view: 'view', amenities: 'amenities', layout: 'layout', renovation: 'renovation', rent: 'rent fit', fit: 'floor fit', noise: 'noise', services: 'services' };
  const currentVacancyAppealValue = vacancyAppealAction.factorKey && priorityVacancy
    ? vacancyAppealFactorValue(priorityVacancy.evaluation, vacancyAppealAction.factorKey)
    : null;
  const vacancyAppealValueCue = currentVacancyAppealValue == null ? ''
    : ' · current ' + vacancyAppealFactorLabels[vacancyAppealAction.factorKey] + ' ' + (currentVacancyAppealValue >= 0 ? '+' : '') + currentVacancyAppealValue + ' on F' + priorityVacancy.unit.floor + ' ' + priorityVacancy.unit.kind;
  const vacancyAppealActionPanel = latestAppealChanges && latestAppealChanges.key !== 'baseline'
    ? '<div class="diag-sub">vacant-room action: <span class="' + (vacancyAppealAction.key === 'monitor' ? 'diag-good' : 'diag-warn') + '">' + vacancyAppealAction.label + '</span> · ' + vacancyAppealAction.detail + vacancyAppealValueCue + (hintVacancy ? ' <button class="inspect-vacancy" data-inspect-unit="' + hintVacancy.id + '">inspect vacancy</button>' : '') + '</div>'
    : '';
  const vacancyAppealFollowupEntries = [...vacancyAppealFollowupHistory, ...vacancyAppealFollowups].slice(-3);
  const demandReadingLabel = (key) => key === 'not_ready' ? 'not eligible yet'
    : key === 'candidate' ? 'ranked vacancy'
      : key === 'moved_in' ? 'filled by tenant demand'
        : key === 'reputation' ? 'reputation gate' : key ?? 'no reading';
  const vacancyAppealFollowupPanel = vacancyAppealFollowupEntries.length
    ? '<div class="diag-sub">appeal action results: ' + vacancyAppealFollowupEntries.map((followup) => {
      if (!followup.result) return '<span class="diag-warn">D' + followup.builtDay + ' F' + followup.floor + ' ' + followup.action + ' pending · result after next day close</span>';
      const resultClass = resultClassForFollowup(followup.result);
      const leasingText = followup.result.occupied ? 'room now occupied' : followup.result.leaseReady ? 'ready to lease' : 'lease status: ' + followup.result.leaseStatusLabel;
      const demandTransition = followup.result.demandKey
        ? (followup.result.beforeDemandKey ? demandReadingLabel(followup.result.beforeDemandKey) + ' → ' : '') + demandReadingLabel(followup.result.demandKey)
        : 'not applicable while occupied';
      const demandRank = followup.result.demandReading?.rank ? ' · rank ' + followup.result.demandReading.rank : '';
      const demandTenant = followup.result.tenantKind ? ' · tenant type ' + followup.result.tenantKind : '';
      return '<span class="' + resultClass + '">D' + followup.result.day + ' F' + followup.floor + ' ' + followup.action + ' ' + followup.result.label + '</span> · ' + followup.result.detail + ' · ' + leasingText +
        '<div class="diag-sub"><span class="' + (followup.result.demandKey === 'moved_in' || followup.result.demandKey === 'candidate' ? 'diag-good' : 'diag-warn') + '">tenant demand transition</span>: ' + demandTransition + demandRank + demandTenant + '</div>';
    }).join(' · ') + '</div>'
    : '';
  const statusCounts = new Map();
  for (const { status } of vacancyStatuses) statusCounts.set(status.key, (statusCounts.get(status.key) ?? 0) + 1);
  const statusLabels = {
    market_delay: 'new vacancy',
    evaluation: 'needs improvement',
    reputation: 'reputation gate',
    ready: 'ready to lease',
  };
  const statusRows = [...statusCounts.entries()].map(([key, count]) =>
    '<div class="diag"><span>' + statusLabels[key] + '</span><span class="' +
    (key === 'ready' ? 'diag-good' : key === 'evaluation' || key === 'reputation' ? 'diag-bad' : 'diag-warn') + '">' + count + ' room' + (count === 1 ? '' : 's') + '</span></div>'
  ).join('');
  const leaseStatusPanel = '<div class="diag-sub">vacancy status</div>' +
    (statusRows || '<div class="diag-sub">no vacant rooms to classify</div>');

  const tenantMixRows = tenantMixDemand(state, CONFIG)
    .filter(({ kind }) => unlocked(state, CONFIG, kind))
    .map(({ kind, heads, share, targetShare, marketDemandBonus: demandBonus }) => {
      const current = Math.round(share * 100);
      const target = Math.round(targetShare * 100);
      const status = demandBonus ? 'demand +' + demandBonus : current > target ? 'oversupplied' : 'balanced';
      const statusClass = demandBonus ? 'diag-good' : current > target ? 'diag-warn' : 'diag-good';
      return '<div class="diag"><span>' + kind + ' · ' + heads + ' people</span><span class="' + statusClass + '">' +
        current + '% / ' + target + '% target · ' + status + '</span></div>';
    }).join('');
  const tenantForecast = tenantDemandForecast(state, CONFIG, d?.rep);
  const projectedMixText = tenantForecast.projectedMix
    .filter(({ kind }) => unlocked(state, CONFIG, kind))
    .filter(({ heads }) => heads > 0)
    .map(({ kind, share }) => kind + ' ' + Math.round(share * 100) + '%')
    .join(' / ');
  const tenantForecastText = tenantForecast.nextKind
    ? 'next tenant: ' + tenantForecast.nextKind + ' · quality +' + (tenantForecast.nextExperienceDemand?.experienceBonus ?? 0) + ' · access confidence ' + ((tenantForecast.nextExperienceDemand?.transportAccessBonus ?? 0) >= 0 ? '+' : '') + (tenantForecast.nextExperienceDemand?.transportAccessBonus ?? 0) + ' · mix +' + tenantForecast.nextMarketDemandBonus + ' · after batch: ' + projectedMixText
    : tenantForecast.gateOpen ? 'no eligible tenant in the current forecast' : 'forecast paused by reputation gate';
  const transportForecast = tenantForecast.transportAccess;
  const transportForecastClass = transportForecast?.key === 'helping' ? 'diag-good' : transportForecast?.key === 'hurting' ? 'diag-bad' : 'diag-warn';
  const transportForecastPanel = '<div class="diag-sub">transport access forecast: <span class="' + transportForecastClass + '">' + (transportForecast?.label ?? 'no route evidence yet') + '</span> · ' + (transportForecast?.detail ?? 'reputation remains a separate delivery signal') + '</div>';
  const transportTrend = transportForecast?.trend;
  const transportTrendClass = transportTrend?.key === 'stable-helping' ? 'diag-good' : transportTrend?.key === 'stable-hurting' ? 'diag-bad' : 'diag-warn';
  const transportTrendEntries = transportTrend?.entries?.length
    ? transportTrend.entries.map((entry) => 'D' + entry.day + ' ' + entry.key).join(' · ')
    : 'no route tests yet';
  const transportTrendPanel = '<div class="diag-sub">transport access trend: <span class="' + transportTrendClass + '">' + (transportTrend?.label ?? 'trend —') + '</span>' + (transportTrend?.bars ? ' · ' + transportTrend.bars : '') + ' · ' + transportTrendEntries + '</div>';
  const tenantForecastNotes = [
    tenantForecast.lockedKinds.length ? 'locked: ' + tenantForecast.lockedKinds.join(', ') : '',
    tenantForecast.absentKinds.length ? 'no current demand: ' + tenantForecast.absentKinds.join(', ') : '',
  ].filter(Boolean).join(' · ');
  const mixHistory = tenantMixHistory(state, CONFIG);
  const mixHistoryText = mixHistory.length
    ? mixHistory.map((entry, index) => {
        const prior = mixHistory[index - 1];
        const direction = !prior ? '' : entry.balance > prior.balance ? ' ↑' : entry.balance < prior.balance ? ' ↓' : ' →';
        const scoreClass = entry.balance >= 80 ? 'diag-good' : entry.balance >= 60 ? 'diag-warn' : 'diag-bad';
        return '<span class="' + scoreClass + '">D' + entry.day + ' ' + entry.balance + '%' + direction + '</span>';
      }).join(' · ')
    : 'no daily mix history yet';
  const tenantDiagnosis = tenantMixDiagnosis(state, CONFIG);
  const mixResponse = tenantMixResponse(state, CONFIG);
  const mixFocus = tenantDiagnosis.focus;
  const mixFocusUnit = mixFocus
    ? state.units.find((unit) => unit.kind === mixFocus.kind && !unit.occupied) ??
      state.units.find((unit) => unit.kind === mixFocus.kind)
    : null;
  const overResponseUnit = mixResponse.convert?.unitId
    ? state.units.find((unit) => unit.id === mixResponse.convert.unitId)
    : null;
  const overResponseAction = overResponseUnit
    ? ' <button class="inspect-vacancy" data-inspect-unit="' + overResponseUnit.id + '">' +
      (mixResponse.convert.key === 'convert' ? 'review conversion' : 'view room') + '</button>'
    : '';
  const mixFocusRoomAction = mixFocus?.direction === 'over'
    ? overResponseAction
    : mixFocusUnit
      ? ' <button class="inspect-vacancy" data-inspect-unit="' + mixFocusUnit.id + '">' +
        (mixFocusUnit.occupied ? 'view room' : 'inspect room') + '</button>'
      : '';
  const mixFocusAction = (mixFocus?.direction === 'under'
    ? ' <button class="inspect-vacancy" data-mix-kind="' + mixFocus.kind + '">select build</button>'
    : '') + mixFocusRoomAction;
  const mixFocusText = mixFocus
    ? mixFocus.kind + ' ' + (mixFocus.direction === 'under' ? 'under' : 'over') + ' target by ' + Math.round(mixFocus.gap * 100) + ' pts' + mixFocusAction
    : 'unlocked mix is on target';
  const otherGap = mixFocus?.direction === 'under' ? tenantDiagnosis.over : tenantDiagnosis.under;
  const mixGapSub = otherGap
    ? 'largest ' + (mixFocus?.direction === 'under' ? 'over' : 'under') + ': ' + otherGap.kind + ' by ' + Math.round(otherGap.gap * 100) + ' pts'
    : mixFocus ? 'no opposing tenant-mix gap yet' : 'no tenant type needs attention';
  const overGuidance = mixResponse.convert && mixFocus?.direction !== 'over'
    ? '<div class="diag-sub">over response: ' + mixResponse.convert.fromKind + ' by ' + Math.round(mixResponse.convert.gap * 100) + ' pts' +
      (mixResponse.convert.toKind ? ' · review ' + mixResponse.convert.fromKind + ' → ' + mixResponse.convert.toKind + ' when vacant' : ' · no under-target type to convert toward') +
      overResponseAction + '</div>'
    : '';
  const floorComparePreviews = comparisonFloors.length === 2
    ? comparisonFloors.map((floor) => tenantPlacementFloorComparison(state, tool, floor, CONFIG))
    : [];
  const unavailableComparePreviews = floorComparePreviews.filter((preview) => !preview.available);
  const pinnedUnavailable = pinnedComparisonFloor != null && unavailableComparePreviews.some((preview) => preview.floor === pinnedComparisonFloor);
  const replacementPreviews = unavailableComparePreviews.length
    ? tenantPlacementReplacementPreviews(state, tool, comparisonFloors, CONFIG).slice(0, 3)
    : [];
  const replacementRankingReason = tenantPlacementRankingReason(replacementPreviews, CONFIG);
  const floorCompareSummary = pinnedUnavailable
    ? 'pinned F' + pinnedComparisonFloor + ' unavailable · remove it to compare a replacement'
    : unavailableComparePreviews.length
      ? unavailableComparePreviews.length + ' candidate unavailable · remove it to compare a replacement'
      : pinnedComparisonFloor != null
        ? 'pinned F' + pinnedComparisonFloor + ' preferred · switch tenant type to compare again'
        : 'pin a preferred floor · switch tenant type to compare again';
  const floorComparePanel = comparisonFloors.length === 2
    ? '<div class="diag-sub">floor compare: ' + tool + ' · ' + floorCompareSummary + '</div>' +
      '<div class="floor-compare">' + floorComparePreviews.map((preview) => {
        if (!preview.available) {
          const unavailableDecision = tenantPlacementDecision(preview, CONFIG);
          const replacementButtons = replacementPreviews.length
            ? '<span class="candidate-status">replace ' + tool.toUpperCase() + ' with (best combined first):</span>' +
              (replacementRankingReason ? '<span class="candidate-status replacement-guidance">' + replacementRankingReason + '</span>' : '') +
              '<div class="replacement-options">' + replacementPreviews.map((replacement) => {
              const replacementDecision = tenantPlacementDecision(replacement, CONFIG);
              const replacementReason = tenantPlacementDecisionReason(replacement, CONFIG);
              const replacementReasonText = replacementReason
                ? '<span class="replacement-signal-reason">' + replacementReason + '</span>'
                : '';
              return '<div class="replacement-choice-card"><button class="inspect-vacancy replacement-choice ' + replacementDecision.key + '" title="' + tool.toUpperCase() + ': ' + replacementDecision.label + '" data-replace-kind="' + tool + '" data-replace-from="' + preview.floor + '" data-replace-with="' + replacement.floor + '">F' +
                replacement.floor + ' · ' + replacement.evaluation.score + ' · ' + replacementDecision.label + '</button>' + replacementReasonText + '<span>' + placementMixText(replacement.mix) + '</span></div>';
            }).join('') + '</div>'
            : '<span class="candidate-status">no open replacement floor</span>';
          return '<div class="floor-candidate' + (pinnedComparisonFloor === preview.floor ? ' preferred' : '') + '"><strong>F' + preview.floor + '</strong><span class="candidate-decision ' + unavailableDecision.key + '">' + unavailableDecision.label + '</span><span class="candidate-status">not available: ' + preview.reason + '</span><button class="inspect-vacancy" data-compare-floor="' + preview.floor + '">remove</button>' + replacementButtons + '</div>';
        }
        const decision = tenantPlacementDecision(preview, CONFIG);
        const decisionReason = tenantPlacementDecisionReason(preview, CONFIG);
        const decisionReasonText = decisionReason
          ? '<span class="candidate-signal-reason">' + decisionReason + '</span>'
          : '';
        const otherPreview = floorComparePreviews.find((candidate) => candidate !== preview && candidate.available);
        const comparisonChoice = tenantPlacementComparisonChoice(preview, otherPreview, CONFIG);
        const comparisonGap = comparisonChoice.key === 'weaker' && comparisonChoice.detail
          ? '<span class="candidate-gap">' + comparisonChoice.detail + '</span>'
          : '';
        const showComparisonReason = comparisonChoice.key === 'stronger' ||
          (comparisonChoice.key === 'equal' && preview.floor === floorComparePreviews[0].floor);
        const comparisonReason = showComparisonReason && comparisonChoice.reason
          ? '<span class="candidate-reason ' + comparisonChoice.key + '">' +
            (comparisonChoice.key === 'stronger' ? 'why stronger: ' : '') + comparisonChoice.reason + '</span>'
          : '';
        return '<div class="floor-candidate' + (pinnedComparisonFloor === preview.floor ? ' preferred' : '') + '"><strong>F' + preview.floor + ' · ' + preview.evaluation.score + '/100 · demand +' + preview.demandQuality.bonus + '</strong><span class="candidate-decision ' + decision.key + '">' +
          decision.label + '</span>' + decisionReasonText + '<span class="candidate-rank ' + comparisonChoice.key + '">' + comparisonChoice.label + '</span>' + comparisonGap + comparisonReason + '<span>' + placementReasonText(tool, preview.evaluation) + '</span><span class="candidate-mix ' + (preview.mix.balanceDelta < 0 ? 'warn' : 'good') + '">' +
          preview.demandQuality.label + ' · ' + placementMixText(preview.mix) + '</span><button class="inspect-vacancy" data-pin-floor="' + preview.floor + '">' +
          (pinnedComparisonFloor === preview.floor ? 'pinned preferred' : 'pin preferred') + '</button></div>';
      }).join('') + '</div>'
    : comparisonFloors.length
      ? '<div class="diag-sub">floor compare: F' + comparisonFloors[0] + ' selected · choose one more available floor</div>'
      : '<div class="diag-sub">floor compare: choose two open floors to compare room quality</div>';
  const floorMixRows = tenantFloorMix(state, CONFIG).map(({ floor, entries, openSlots, vacantRooms }) => {
    const floorMixText = entries.length
      ? entries.map(({ kind, heads, share, targetShare }) =>
        kind + ' ' + heads + ' (' + Math.round(share * 100) + '/' + Math.round(targetShare * 100) + '%)')
        .join(' / ')
      : 'empty';
    const selected = comparisonFloors.includes(floor);
    const compareButton = CONFIG.units[tool] && (openSlots > 0 || selected)
      ? ' <button class="inspect-vacancy" data-compare-floor="' + floor + '">' +
        (selected ? (openSlots > 0 ? 'selected' : 'remove') : 'compare') + '</button>'
      : '';
    return '<div class="diag"><span>F' + floor + '</span><span>' + floorMixText + ' · ' + openSlots + ' open' +
      (vacantRooms ? ' · ' + vacantRooms + ' vacant' : '') + compareButton + '</span></div>';
  }).join('');
  const floorMixPanel = '<div class="diag-sub">floor mix: actual/building-target share · open = buildable slots</div>' +
    (floorMixRows || '<div class="diag-sub">no upper floors yet</div>');
  const tenantMixRowsPanel = '<div class="diag"><span>tenant demand</span><span class="diag-good">occupied mix</span></div>' +
    (tenantMixRows || '<div class="diag-sub">no tenant types unlocked</div>') +
    '<div class="diag-sub">shares use occupied people; demand raises vacancy priority · reputation multiplier ' +
    Math.round(reputationDemandFactor(state, CONFIG, d?.rep) * 100) + '% (floor ' +
    Math.round(CONFIG.occupancy.reputationDemandFloor * 100) + '%)</div>' +
    '<div class="diag-sub">tenant forecast: ' + tenantForecastText + '</div>' +
    transportForecastPanel +
    transportTrendPanel +
    '<div class="diag-sub">mix history: ' + mixHistoryText + '</div>' +
    '<div class="diag-sub">mix arrows: ↑ closer to targets · ↓ farther away · → steady</div>' +
    '<div class="diag"><span>mix focus</span><span class="' + (mixFocus?.direction === 'over' ? 'diag-warn' : 'diag-good') + '">' + mixFocusText + '</span></div>' +
    '<div class="diag-sub">' + mixGapSub + (mixFocusUnit ? '' : mixFocus ? ' · no ' + mixFocus.kind + ' room built yet' : '') + '</div>' +
    (mixFocus?.direction === 'under' ? '<div class="diag-sub">select build only arms placement; click a floor to confirm</div>' : '') +
    overGuidance +
    floorMixPanel +
    floorComparePanel +
    (tenantForecastNotes ? '<div class="diag-sub">' + tenantForecastNotes + '</div>' : '');
  const shops = state.units.filter((u) => u.kind === 'shop' && u.occupied);
  shopResponseFilterId = shopTrafficResponseFilterId(shopResponseFilterId, shops);
  const shopTrafficRows = shops.map((shop) => {
    const estimate = shopTrafficEstimate(state, shop, CONFIG, d?.rep);
    const trafficClass = estimate.potentialCustomers === 0 ? 'diag-warn'
      : estimate.expectedCustomers < estimate.potentialCustomers ? 'diag-bad' : 'diag-good';
    const todayRevenue = Math.round((shop.servedToday ?? 0) * (CONFIG.units.shop.revenuePerCustomer ?? 0));
    const history = shopTrafficHistory(state, shop.id, CONFIG);
    const previous = history.entries.at(-1);
    const servedDelta = previous ? shopTrafficServedDelta(shop.servedToday, previous.served) : null;
    const servedDeltaLabel = servedDelta == null
      ? ''
      : servedDelta === 0
        ? 'shop today vs last close: no change'
        : 'shop today vs last close: ' + (servedDelta > 0 ? '+' : '') + servedDelta + ' served';
    const previousRevenue = previous && Number.isFinite(Number(previous.revenue)) ? Number(previous.revenue) : 0;
    const revenueDelta = previous ? Math.round(todayRevenue - previousRevenue) : null;
    const revenueDeltaLabel = revenueDelta == null
      ? ''
      : revenueDelta === 0
        ? 'shop today vs last close: no revenue change'
        : 'shop today vs last close: ' + (revenueDelta > 0 ? '+' : '-') + money(Math.abs(revenueDelta)) + ' revenue';
    const shopTrafficRowTrend = previous
      ? ' · <span class="shop-traffic-trend" title="shop live-versus-last-close traffic and revenue trend" aria-label="shop live-versus-last-close trend: ' + servedDeltaLabel + '; ' + revenueDeltaLabel + '"><span class="shop-traffic-trend-label">trend</span> ' +
        '<span class="' + (servedDelta > 0 ? 'diag-good' : servedDelta < 0 ? 'diag-bad' : 'diag-warn') + '" title="' + servedDeltaLabel + '" aria-label="' + servedDeltaLabel + '">served ' +
        (servedDelta > 0 ? '+' : '') + servedDelta + '</span> · ' +
        '<span class="' + (revenueDelta > 0 ? 'diag-good' : revenueDelta < 0 ? 'diag-bad' : 'diag-warn') + '" title="' + revenueDeltaLabel + '" aria-label="' + revenueDeltaLabel + '">revenue ' +
        (revenueDelta > 0 ? '+' : revenueDelta < 0 ? '-' : '') + money(Math.abs(revenueDelta)) + '</span></span>'
      : '';
    const shopFollowups = shopDemandFollowupHistory.filter((followupEntry) => followupEntry.shopId === shop.id);
    const shopResponseSummary = shopTrafficFollowupSummary(shopFollowups);
    const latestResponse = shopFollowups.at(-1);
    const latestResponseStatus = latestResponse ? shopTrafficFollowupStatus(latestResponse) : null;
    const latestResponseOutcome = latestResponse ? shopTrafficFollowupOutcome(latestResponse) : null;
    const latestResponseClass = latestResponseStatus?.key === 'success' ? 'diag-good'
      : latestResponseStatus?.key === 'underperforming' || latestResponseStatus?.key === 'missing' ? 'diag-bad' : 'diag-warn';
    const latestResponseText = latestResponse
      ? ' · last ' + (latestResponse.result ? 'D' + latestResponse.result.day + ' ' : 'D' + latestResponse.builtDay + ' ') +
        '<span class="' + latestResponseClass + '">' + latestResponseStatus.label + '</span>' +
        (latestResponse.result && !latestResponse.result.missing ? ' · ' + latestResponseOutcome.label : '')
      : '';
    const responseGap = shopResponseSummary.averageForecastGap == null ? ''
      : ' · avg gap ' + (shopResponseSummary.averageForecastGap >= 0 ? '+' : '') +
        shopResponseSummary.averageForecastGap + '/day';
    const responseScore = shopResponseSummary.completed
      ? shopResponseSummary.successRate + '% met' + responseGap
      : shopResponseSummary.pending ? 'pending'
        : shopResponseSummary.missing ? 'no record' : '—';
    const responseScoreClass = indicatorCssClass(shopResponseSummary.key);
    const responseScoreDetail = shopTrafficFollowupScoreAccessibleLabel(shop, shopResponseSummary) +
      (shopResponseSummary.averageForecastGap == null ? '' : ' · average gap ' +
        (shopResponseSummary.averageForecastGap >= 0 ? '+' : '') + shopResponseSummary.averageForecastGap + ' customers/day');
    const responseCountLabel = shopTrafficFollowupCountLabel(shopResponseSummary);
    const responseCountDetail = shopTrafficFollowupCountAccessibleLabel(shop, shopFollowups, CONFIG.occupancy.shopDemandFollowupHistoryDays);
    const responseCountText = ' · <span class="response-volume" title="' + responseCountDetail + '" aria-label="' + responseCountDetail + '">' + responseCountLabel + '</span>';
    const servedTodayDetail = shopTrafficServedTodayDetail(shop.servedToday, shop);
    const lastCloseRevenueDetail = shopTrafficLastCloseRevenueDetail(shop);
    const lastCloseHistoricalCue = '<span class="shop-traffic-history-cue" title="historical baseline traffic from the previous closed day for this shop" aria-label="historical baseline traffic from the previous closed day for this shop"><span class="shop-traffic-history-baseline">baseline</span> · last close</span>';
    const historicalRevenueCue = '<span class="shop-traffic-history-cue" title="historical previous closed-day revenue for this shop" aria-label="historical previous closed-day revenue for this shop">historical revenue</span>';
    const previousClosedDayBadge = previous
      ? '<span class="shop-traffic-history-day" title="closed-day identifier for this shop history" aria-label="closed-day identifier D' + previous.day + '">D' + previous.day + '</span>'
      : '';
    const trafficPeriodsHeading = shopTrafficPeriodsHeading(Boolean(previous));
    const trafficPeriodsHeadingLabel = shopTrafficPeriodsHeadingAccessibleLabel(Boolean(previous));
    const currentPeriodHeading = '<span class="shop-traffic-current-heading" title="current period contains this shop\'s live traffic and revenue" aria-label="current period contains this shop\'s live traffic and revenue">current period</span>';
    const causeClass = history.cause === 'service' || history.cause === 'mixed' ? 'diag-bad'
      : history.cause === 'demand' ? 'diag-warn' : 'diag-good';
    const diagnosisKind = history.cause === 'demand' ||
      (history.cause === 'unknown' && estimate.expectedCustomers === estimate.potentialCustomers) ? 'mix' : 'transport';
    const diagnosisLabel = diagnosisKind === 'transport' ? 'focus elevators' : 'focus tenant mix';
    const trafficDetail = estimate.potentialCustomers === 0
      ? 'no nearby office lunch demand'
      : estimate.expectedCustomers < estimate.potentialCustomers
        ? estimate.expectedCustomers + '/' + estimate.potentialCustomers + ' expected customers after ' + Math.round(estimate.deliveryFactor * 100) + '% delivery · elevator limits traffic'
        : estimate.potentialCustomers + ' expected customers · ' + Math.round(estimate.deliveryFactor * 100) + '% delivery';
    const historyActionActive = shopResponseFilterId === shop.id;
    const followups = shopDemandFollowupHistory.filter((followupEntry) =>
      followupEntry.shopId === shop.id && (shopResponseFilterId == null || shopResponseFilterId === shop.id));
    const followup = followups.length
      ? '<div class="diag-sub">response history: ' + followups.map((followupEntry) => {
        const result = followupEntry.result;
        const status = shopTrafficFollowupStatus(followupEntry);
        const outcome = shopTrafficFollowupOutcome(followupEntry);
        const statusClass = status.key === 'success' ? 'diag-good'
          : status.key === 'underperforming' || status.key === 'missing' ? 'diag-bad' : 'diag-warn';
        if (result?.missing) return 'D' + result.day + ' <span class="' + statusClass + '">' + status.label + '</span>';
        if (!result) return 'D' + followupEntry.builtDay + ' → <span class="' + statusClass + '">' + status.label + '</span>';
        return 'D' + result.day + ' <span class="' + statusClass + '">' + status.label + '</span> · ' + outcome.label + ' · ' + result.served +
          ' served / ' + money(result.revenue) +
          ' realized · forecast ' + result.expectedCustomers + ' / ' + money(result.expectedRevenue) +
          ' · ' + (result.servedDelta >= 0 ? '+' : '') + result.servedDelta +
          ' vs pre-build';
      }).join(' · ') + '</div>'
      : '';
    return '<div class="shop-traffic-periods" role="group" aria-label="' + shopTrafficPeriodsAccessibleLabel(shop, Boolean(previous)) + '">' +
      '<div class="shop-traffic-periods-heading" role="heading" aria-level="6" aria-label="current period; ' + trafficPeriodsHeadingLabel + '">' + currentPeriodHeading + ' · ' + trafficPeriodsHeading + '</div>' +
      '<div class="diag"><span>F' + shop.floor + ' shop · <span class="' + responseScoreClass + '" title="' + responseScoreDetail + '" aria-label="' + responseScoreDetail + '">' + responseScore + '</span>' + responseCountText + latestResponseText + '</span><span class="shop-traffic-today ' + (shop.servedToday ? 'diag-good' : trafficClass) + '"><span title="' + servedTodayDetail + '" aria-label="' + servedTodayDetail + '">' +
      '<span class="shop-traffic-live" title="current period means live traffic for this shop today" aria-label="current period means live traffic for this shop today">current period</span> · ' + shop.servedToday + ' served today</span> · <span class="shop-traffic-live" title="current period revenue means live revenue for this shop today" aria-label="current period revenue means live revenue for this shop today">current revenue</span> ' + money(todayRevenue) + shopTrafficRowTrend + '</span></div>' +
      '<div class="diag-sub"><span class="' + trafficClass + '">' + trafficDetail + '</span> · traffic income ' + money(estimate.expectedRevenue) + '/day expected · ' + money(estimate.potentialRevenue) + ' potential</div>' +
      (previous ? '<div class="diag-sub shop-traffic-history"><span class="shop-traffic-history-heading" role="heading" aria-level="6" title="scope of this shop historical baseline" aria-label="baseline scope for F' + shop.floor + ' shop: covered 1 of 1; baseline day D' + previous.day + '">baseline scope · covered 1/1 · ' + previousClosedDayBadge + '</span> · ' + shopTrafficLastCloseDetail(previous, shop).replace('last close (historical)', lastCloseHistoricalCue) + ' · <span title="' + lastCloseRevenueDetail + '" aria-label="' + lastCloseRevenueDetail + '">' + historicalRevenueCue + ' ' + money(previous.revenue) + ' realized</span></div>' :
        '<div class="diag-sub shop-traffic-pending" title="this shop traffic and revenue comparison will be available after the first closed day" aria-label="shop comparison pending; the first closed day will establish a last-close baseline for this shop"><span class="shop-traffic-pending-scope">shop</span> comparison pending · <span class="shop-traffic-pending-trigger" title="the baseline appears when the first simulated day ends" aria-label="first close: the baseline appears when the first simulated day ends">first close</span> establishes a last-close baseline</div>') +
      '</div>' +
      followup +
      (history.entries.length ? '<div class="diag-sub">history: ' + history.entries.map((entry, index) =>
        '<span class="shop-traffic-history-day" title="closed-day identifier in this shop history" aria-label="closed-day identifier D' + entry.day + '">D' + entry.day + '</span> ' + entry.served + (Number.isFinite(Number(entry.potentialCustomers)) ? '/' + entry.potentialCustomers : '') +
        (index === history.entries.length - 1 ? ' <span class="shop-traffic-history-latest" title="most recent closed-day reading" aria-label="most recent closed-day reading">latest</span>' : '')).join(' · ') +
        ' · <span class="' + (history.direction === 'rising' ? 'diag-good' : history.direction === 'falling' ? 'diag-bad' : 'diag-warn') + '">' + history.label + '</span></div>' : '') +
      (history.entries.length ? '<div class="diag-sub">cause: <span class="' + causeClass + '">' + history.causeLabel + '</span> · ' + history.nextAction + '</div>' : '') +
      '<button class="inspect-vacancy" data-shop-response-filter="' + shop.id + '"' + (historyActionActive ? ' disabled' : '') +
        ' title="' + (historyActionActive ? 'this shop is already the active response filter' : 'filter the response summary and history to this shop') + '">' +
        (historyActionActive ? 'history selected' : 'view history') + '</button>' +
      '<button class="inspect-vacancy" data-shop-diagnosis="' + diagnosisKind + '" data-shop-id="' + shop.id + '" data-shop-floor="' + shop.floor + '">' + diagnosisLabel + '</button>';
  }).join('');
  const responseFilterShop = shops.find((shop) => shop.id === shopResponseFilterId);
  const responseHistory = shopResponseFilterId == null
    ? shopDemandFollowupHistory
    : shopDemandFollowupHistory.filter((followupEntry) => followupEntry.shopId === shopResponseFilterId);
  const responseSummary = shopTrafficFollowupSummary(responseHistory);
  const responseSummaryHeading = shopTrafficFollowupSummaryHeading(responseFilterShop);
  const responseSummaryCountLabel = shopTrafficFollowupCountLabel(responseSummary);
  const responseWindow = shopTrafficFollowupWindow(shopDemandFollowupHistory, CONFIG.occupancy.shopDemandFollowupHistoryDays);
  const customerGapDetail = 'customers: realized ' + responseSummary.realizedCustomers + ' vs ' +
    responseSummary.forecastCustomers + ' forecast';
  const revenueGapDetail = 'revenue: realized ' + money(responseSummary.realizedRevenue) + ' vs ' +
    money(responseSummary.forecastRevenue) + ' forecast';
  const responseHistoryTitle = 'Only the latest ' + responseWindow.limit + ' shop-response records are kept; this is a short-lived diagnostic window, not a permanent shop ledger.';
  const allShopResponseFilterLabel = shopTrafficFollowupFilterLabel(null, shopDemandFollowupHistory);
  const allShopResponseFilterAccessibleLabel = shopTrafficFollowupFilterAccessibleLabel(null, shopDemandFollowupHistory);
  const responseFilterControls = '<div class="diag-sub" title="' + responseHistoryTitle + '">response history: ' + responseWindow.label + ' · ' + responseWindow.statusLabel + ' · latest ' +
    responseWindow.limit + ' records · ' + responseWindow.retentionNote +
    (shops.length ? ' · response view: ' +
      '<button class="inspect-vacancy" data-shop-response-filter="all" aria-label="' + allShopResponseFilterAccessibleLabel + '"' + (shopResponseFilterId == null ? ' disabled' : '') + '>' +
        (shopResponseFilterId == null ? shopTrafficFollowupFilterButtonLabel(null, shopDemandFollowupHistory, true) : 'return to ' + allShopResponseFilterLabel) + '</button>' +
      shops.map((shop) => {
        const shopHistory = shopDemandFollowupHistory.filter((followupEntry) => followupEntry.shopId === shop.id);
        const selected = shopResponseFilterId === shop.id;
        return '<button class="inspect-vacancy" data-shop-response-filter="' + shop.id + '" aria-label="' +
          shopTrafficFollowupFilterAccessibleLabel(shop, shopHistory) + '"' +
          (selected ? ' disabled' : '') + '>' +
          shopTrafficFollowupFilterButtonLabel(shop, shopHistory, selected) + '</button>';
      }).join('') : '') +
    '</div>';
  const responseSummaryText = responseSummary.total || responseFilterShop
    ? '<div class="diag-sub"><span aria-label="' + shopTrafficFollowupScopeAccessibleLabel(responseFilterShop) + '">' + shopTrafficFollowupSummaryHeading(responseFilterShop) + '</span>: <span class="response-volume" title="retained response count for this scope" aria-label="' + responseSummaryCountLabel + ' in this scope">' + responseSummaryCountLabel + '</span>' +
      (responseSummary.total ? ' · <span class="' + indicatorCssClass(responseSummary.key) + '">' +
      (responseSummary.completed ? responseSummary.successful + '/' + responseSummary.completed + ' met forecast (' + responseSummary.successRate + '%)' : 'no completed responses') +
      '</span>' : ' · <span class="diag-warn">no outcomes yet</span>') + (responseSummary.averageForecastGap == null ? '' : ' · average gap ' +
        (responseSummary.averageForecastGap >= 0 ? '+' : '') + responseSummary.averageForecastGap + ' customers/day') +
      (responseSummary.completed ? ' · customers ' + responseSummary.realizedCustomers + '/' + responseSummary.forecastCustomers +
        ' (<span class="' + (responseSummary.customerForecastGap >= 0 ? 'diag-good' : 'diag-bad') + '" title="' + customerGapDetail + '" aria-label="' + customerGapDetail + '">gap ' +
        (responseSummary.customerForecastGap >= 0 ? '+' : '') + responseSummary.customerForecastGap + '</span>) · revenue ' +
        money(responseSummary.realizedRevenue) + '/' + money(responseSummary.forecastRevenue) +
        ' (<span class="' + (responseSummary.revenueForecastGap >= 0 ? 'diag-good' : 'diag-bad') + '" title="' + revenueGapDetail + '" aria-label="' + revenueGapDetail + '">gap ' +
        (responseSummary.revenueForecastGap >= 0 ? '+' : '-') + money(Math.abs(responseSummary.revenueForecastGap)) + '</span>)' : '') +
      (responseSummary.pending ? ' · ' + responseSummary.pending + ' pending' : '') +
      (responseSummary.missing ? ' · ' + responseSummary.missing + ' missing' : '') + '</div>'
    : '';
  const shopResponseScope = responseFilterShop
    ? 'F' + responseFilterShop.floor + ' shop response view'
    : 'all response view';
  const shopServedTodayTotal = shops.reduce((sum, shop) => sum + shop.servedToday, 0);
  const shopServedTodayRevenue = Math.round(shopServedTodayTotal * (CONFIG.units.shop.revenuePerCustomer ?? 0));
  const shopServedTodayDetail = shopTrafficServedTodayDetail(shopServedTodayTotal) + '; aggregate across all occupied shops, regardless of response-history filter';
  const shopTrafficPeriodsLegend = shopTrafficPeriodsLegendLabel();
  const shopLastCloseAggregate = shopTrafficLastCloseAggregate(state, shops);
  const shopLastCloseAggregateRevenueCue = '<span class="shop-traffic-history-cue" title="historical previous closed-day revenue total for occupied shops" aria-label="historical previous closed-day revenue total for occupied shops">historical revenue</span>';
  const shopServedTodayDelta = shopLastCloseAggregate
    ? shopTrafficServedDelta(shopServedTodayTotal, shopLastCloseAggregate.served)
    : null;
  const shopServedTodayDeltaLabel = shopServedTodayDelta == null
    ? ''
    : shopServedTodayDelta === 0
      ? 'building today vs last close: no change'
      : 'building today vs last close: ' + (shopServedTodayDelta > 0 ? '+' : '') + shopServedTodayDelta + ' served';
  const previousShopRevenueTotal = shopLastCloseAggregate && Number.isFinite(Number(shopLastCloseAggregate.revenue))
    ? Number(shopLastCloseAggregate.revenue) : 0;
  const shopRevenueDelta = shopLastCloseAggregate
    ? Math.round(shopServedTodayRevenue - previousShopRevenueTotal)
    : null;
  const shopRevenueDeltaLabel = shopRevenueDelta == null
    ? ''
    : shopRevenueDelta === 0
      ? 'building today vs last close: no revenue change'
      : 'building today vs last close: ' + (shopRevenueDelta > 0 ? '+' : '-') + money(Math.abs(shopRevenueDelta)) + ' revenue';
  const shopTrafficAggregateTrend = shopLastCloseAggregate
    ? '<span class="shop-traffic-trend" title="aggregate live-versus-last-close traffic and revenue trend" aria-label="aggregate live-versus-last-close trend: ' + shopServedTodayDeltaLabel + '; ' + shopRevenueDeltaLabel + '; baseline covers ' + shopLastCloseAggregate.shops + ' of ' + shops.length + ' visible shops"><span class="shop-traffic-trend-label">trend</span> <span class="shop-traffic-trend-scope" title="closed-day baseline coverage" aria-label="baseline covers ' + shopLastCloseAggregate.shops + ' of ' + shops.length + ' visible shops">covered ' + shopLastCloseAggregate.shops + '/' + shops.length + '</span> · ' +
      '<span class="' + (shopServedTodayDelta > 0 ? 'diag-good' : shopServedTodayDelta < 0 ? 'diag-bad' : 'diag-warn') + '" title="' + shopServedTodayDeltaLabel + '" aria-label="' + shopServedTodayDeltaLabel + '">served ' +
      (shopServedTodayDelta > 0 ? '+' : '') + shopServedTodayDelta + '</span> · ' +
      '<span class="' + (shopRevenueDelta > 0 ? 'diag-good' : shopRevenueDelta < 0 ? 'diag-bad' : 'diag-warn') + '" title="' + shopRevenueDeltaLabel + '" aria-label="' + shopRevenueDeltaLabel + '">revenue ' +
      (shopRevenueDelta > 0 ? '+' : shopRevenueDelta < 0 ? '-' : '') + money(Math.abs(shopRevenueDelta)) + '</span></span>'
    : '';
  const shopTrafficBaselineScope = shopLastCloseAggregate
    ? shopLastCloseAggregate.shops === shops.length
      ? 'building'
      : 'the ' + shopLastCloseAggregate.shops + '/' + shops.length + ' visible shops'
    : '';
  const shopTrafficBaselineComplete = shopLastCloseAggregate?.shops === shops.length;
  const shopTrafficBaselineCueClass = shopTrafficBaselineComplete ? 'shop-traffic-history-baseline' : 'shop-traffic-history-partial';
  const shopTrafficBaselineCueLabel = shopTrafficBaselineComplete ? 'baseline' : 'partial baseline';
  const shopLastCloseAggregateText = shopLastCloseAggregate
    ? '<div class="diag-sub shop-traffic-history"><span class="shop-traffic-history-heading" role="heading" aria-level="6" title="scope of the historical aggregate baseline" aria-label="baseline scope for ' + shopTrafficBaselineScope + '">baseline scope</span> · <span class="shop-traffic-history-cue" title="historical baseline traffic and revenue total for ' + shopTrafficBaselineScope + '" aria-label="historical baseline traffic and revenue total for ' + shopTrafficBaselineScope + '">historical total</span> · last close <span class="shop-traffic-history-day" title="closed-day identifier for this historical total" aria-label="closed-day identifier D' + shopLastCloseAggregate.day + '">D' + shopLastCloseAggregate.day + '</span> <span class="shop-traffic-history-latest" title="most recent closed-day total" aria-label="most recent closed-day total">latest</span> <span class="' + shopTrafficBaselineCueClass + '" title="' + shopTrafficBaselineCueLabel + ' for ' + shopTrafficBaselineScope + '" aria-label="' + shopTrafficBaselineCueLabel + ' for ' + shopTrafficBaselineScope + '">' + shopTrafficBaselineCueLabel + ' for ' + shopTrafficBaselineScope + '</span>: ' + shopLastCloseAggregate.served + ' served · ' + shopLastCloseAggregateRevenueCue + ' ' + money(shopLastCloseAggregate.revenue) + ' realized' + shopTrafficAggregateTrend + '</div>'
    : '';
  const shopAggregateComparisonPending = shops.length && !shopLastCloseAggregate
    ? '<div class="diag-sub shop-traffic-pending" title="aggregate traffic and revenue comparison will be available after the first closed day" aria-label="building comparison pending; the first closed day will establish the building-wide last-close baseline"><span class="shop-traffic-pending-scope">building</span> comparison pending · <span class="shop-traffic-pending-trigger" title="the baseline appears when the first simulated day ends" aria-label="first close: the baseline appears when the first simulated day ends">first close</span> establishes the building-wide baseline</div>'
    : '';
  const shopTrafficBaselineStatus = shopLastCloseAggregate && shopTrafficBaselineDay != null
    ? '<div class="diag-sub shop-traffic-baseline-status" title="the latest closed day is the comparison baseline for ' + shopTrafficBaselineScope + '" aria-label="' + shopTrafficBaselineCueLabel + ' ready; baseline day D' + shopTrafficBaselineDay + ' covers ' + shopLastCloseAggregate.shops + ' of ' + shops.length + ' visible shops and anchors current traffic and revenue trends for ' + shopTrafficBaselineScope + '"><span class="' + shopTrafficBaselineCueClass + '">' + shopTrafficBaselineCueLabel + ' ready</span> · <span class="shop-traffic-trend-scope" title="closed-day baseline coverage" aria-label="baseline covers ' + shopLastCloseAggregate.shops + ' of ' + shops.length + ' visible shops">covered ' + shopLastCloseAggregate.shops + '/' + shops.length + '</span> · <span class="shop-traffic-history-baseline">baseline day</span> <span class="shop-traffic-history-day" title="closed-day identifier for the aggregate baseline" aria-label="baseline day D' + shopTrafficBaselineDay + '">D' + shopTrafficBaselineDay + '</span> anchors trends for ' + shopTrafficBaselineScope + '</div>'
    : '';
  const shopTrafficAggregateCurrentGroup = shops.length
    ? '<div class="shop-traffic-periods" role="group" aria-label="current period aggregate shop totals"><div class="shop-traffic-periods-heading" role="heading" aria-level="6" aria-label="current period; aggregate shop totals"><span class="shop-traffic-current-heading shop-traffic-live" title="current period contains aggregate live shop traffic and revenue" aria-label="current period contains aggregate live shop traffic and revenue">current period</span> · aggregate shop totals</div>'
    : '';
  const shopTrafficPanel = shopTrafficAggregateCurrentGroup + '<div class="diag"><span>shop traffic · ' + shopResponseScope + '</span><span class="' + (shops.length ? 'diag-good' : 'diag-warn') + '">' +
    '<span title="' + shopServedTodayDetail + '" aria-label="' + shopServedTodayDetail + '">' +
    (shops.length ? '<span class="shop-traffic-live" title="current period means live traffic total for today" aria-label="current period means live traffic total for today">current period</span> · ' + shopServedTodayTotal + ' served today · <span class="shop-traffic-live" title="current period revenue means live revenue total for today" aria-label="current period revenue means live revenue total for today">current revenue</span> ' + money(shopServedTodayRevenue) : 'no shops') + '</span></span></div>' + (shops.length ? '</div>' : '') +
    shopLastCloseAggregateText + shopAggregateComparisonPending + shopTrafficBaselineStatus +
    '<div class="diag-sub">served total: all occupied shops · response filters affect history only</div>' +
    responseFilterControls +
    responseSummaryText +
    '<div class="diag-sub">row key: <span aria-label="score means outcome quality">score</span> = outcome quality · <span class="response-volume" aria-label="history means retained response count">history</span> = retained response count · <span aria-label="served means today\'s customers">served</span> = today\'s customers · <span aria-label="last close means historical traffic and revenue">last close</span> = historical traffic/revenue · <span class="shop-traffic-periods-key" tabindex="0" title="today vs last close compares current traffic with historical closed-day traffic" aria-label="today versus last close means current traffic versus historical closed-day traffic">' + shopTrafficPeriodsLegend + '</span> = current vs historical period · <span class="shop-traffic-live" title="current period means live traffic and revenue today" aria-label="current period means live traffic and revenue today">current period</span> = live today · <span class="shop-traffic-history-baseline" title="baseline day D# is the latest closed day used for trend comparisons" aria-label="baseline day D# is the latest closed day used for trend comparisons">baseline day D#</span> = latest closed day used by trend values · <span class="shop-traffic-history-partial" title="partial baseline means only some visible shops have historical coverage" aria-label="partial baseline means only some visible shops have historical coverage">partial baseline</span> = only some visible shops have history · <span class="shop-traffic-trend-key" title="trend colors apply to served and revenue changes: green is improvement, red is decline, amber is no change" aria-label="trend colors for served and revenue changes: green is improvement, red is decline, amber is no change"><span class="diag-good">green</span> = improvement · <span class="diag-bad">red</span> = decline · <span class="diag-warn">amber</span> = no change</span></div>' +
    (shopTrafficRows || '<div class="diag-sub">office lunch demand reaches shops within ±' + CONFIG.demand.shopCatchmentFloors + ' floors</div>') +
    (shops.length ? '<div class="diag-sub">potential → expected uses nearby offices and the recent delivery factor · catchment ±' + CONFIG.demand.shopCatchmentFloors + ' floors</div>' : '');
  const hotels = state.units.filter((u) => u.kind === 'hotel');
  const hotelBooked = hotels.reduce((sum, hotel) => sum + (hotel.occupied ? hotel.heads : 0), 0);
  const hotelCapacity = hotels.length * CONFIG.units.hotel.guests;
  const hotelExperience = hotelExperienceSummary(state, CONFIG);
  const bookingFeedback = hotelBookingFeedback(state, CONFIG);
  const hotelFeedbackHistory = hotelExperienceHistory(state, CONFIG);
  const hotelHistoryText = hotelFeedbackHistory.length
    ? hotelFeedbackHistory.map((entry) => {
      const scoreClass = entry.experience >= 80 ? 'diag-good' : entry.experience >= 55 ? 'diag-warn' : 'diag-bad';
      return '<span class="' + scoreClass + '">D' + entry.day + ' ' + entry.experience + '/100 · ' + entry.guests + ' guests</span>';
    }).join(' · ')
    : 'no history';
  const repHistory = reputationHistory(state, CONFIG);
  const repRecommendation = reputationRecommendation(state, CONFIG);
  const repHistoryText = repHistory.length
    ? repHistory.map((entry) => {
      const score = entry.reputation ?? entry.deliveryRate ?? 0;
      const scoreClass = score < CONFIG.occupancy.relistMinDeliveryRate ? 'diag-bad' : score < 80 ? 'diag-warn' : 'diag-good';
      return '<span class="' + scoreClass + '">D' + entry.day + ' rep ' + (entry.reputation == null ? '—' : entry.reputation + '%') +
        ' · delivery ' + (entry.deliveryRate == null ? '—' : entry.deliveryRate + '%') +
        ' · wait ' + (entry.avgWait == null ? '—' : entry.avgWait + 's') +
        ' · ' + entry.abandoned + ' gave up' +
        ((entry.elevatorAvgWait != null || entry.localAvgWait != null)
          ? ' · elevator ' + (entry.elevatorAvgWait == null ? '—' : entry.elevatorAvgWait + 's') +
            ' / ' + entry.elevatorAbandoned + ' gave up · local ' + (entry.localAvgWait == null ? '—' : entry.localAvgWait + 's') +
            ' / ' + entry.localAbandoned + ' gave up'
          : '') + '</span>';
    }).join(' · ')
    : 'no history';
  const previousHotelExperience = state.log.at(-1)?.hotelExperience;
  const hotelTrend = hotelExperience.average == null
    ? 'no guest feedback yet'
    : previousHotelExperience == null
      ? 'first guest feedback'
      : hotelExperience.average > previousHotelExperience
        ? 'feedback +' + (hotelExperience.average - previousHotelExperience)
        : hotelExperience.average < previousHotelExperience
          ? 'feedback ' + (hotelExperience.average - previousHotelExperience)
          : 'feedback steady';
  const hotelRows = hotels.map((hotel) => {
    const evaluation = unitEvaluation(state, hotel, CONFIG);
    const services = hotelServiceSummary(state, hotel, CONFIG);
    const experience = hotel.occupied ? hotelGuestExperience(state, hotel, CONFIG) : null;
    const serviceText = ' · services ' + services.coveredCount + '/' + services.requiredCount;
    const missingText = services.missing.length ? ' · missing ' + services.missing.join(', ') : '';
    return '<div class="diag"><span>F' + hotel.floor + ' hotel</span><span class="' + (hotel.occupied ? 'diag-good' : 'diag-warn') + '">' +
      (hotel.occupied ? hotel.heads + '/' + CONFIG.units.hotel.guests + ' guests · eval ' + evaluation.score + ' · guest exp ' + experience.score + serviceText : 'vacant' + serviceText) + '</span></div>' +
      (missingText ? '<div class="diag-sub">' + missingText.slice(3) + '</div>' : '');
  }).join('');
  const hotelBookingPanel = '<div class="diag"><span>hotel bookings</span><span class="' + (hotels.length ? 'diag-good' : 'diag-warn') + '">' +
    (hotels.length ? hotelBooked + '/' + hotelCapacity + ' guests booked' : 'no hotels') + '</span></div>' +
    (hotelRows || '<div class="diag-sub">hotel rooms unlock at 160 population</div>') +
    '<div class="diag-sub">booking load follows reputation + room evaluation + prior feedback · guest experience combines stress + services · ' + CONFIG.units.hotel.minGuests + '–' + CONFIG.units.hotel.guests + ' guests per room</div>' +
    '<div class="diag-sub">guest-weighted feedback: ' + (hotelExperience.average == null ? hotelTrend : hotelExperience.average + '/100 · ' + hotelTrend) +
    ' · next booking factor ' + bookingFeedback.feedbackFactor.toFixed(2) + ' · ' + CONFIG.units.hotel.bookingFeedbackDays + '-day smoothing</div>';
  const hotelFeedbackHistoryPanel = '<div class="diag-sub">recent feedback: ' + hotelHistoryText + '</div>';
  const reputationPanel = '<div class="diag"><span>reputation trend</span><span class="' +
    (d && d.rep < CONFIG.occupancy.relistMinDeliveryRate ? 'diag-bad' : d && d.rep < 80 ? 'diag-warn' : 'diag-good') + '">' +
    (d ? d.rep + '%' : 'no history') + '</span></div>' +
    '<div class="diag-sub">recent service: ' + repHistoryText + '</div>' +
    '<div class="diag-sub">reputation follows delivery rate; wait and abandoned riders show the pressure behind each day</div>';
  const desirability = towerDesirabilitySummary(state, CONFIG);
  const desirabilityClass = desirability.colorKey === 'good' ? 'diag-good' : desirability.colorKey === 'bad' ? 'diag-bad' : 'diag-warn';
  const desirabilityHistory = towerDesirabilityHistory(state);
  const desirabilityTrend = towerDesirabilityTrend(desirabilityHistory);
  const desirabilityDelta = towerDesirabilityTrendDeltaLabel(desirabilityTrend);
  const desirabilityTransportClass = transportForecast?.key === 'helping' ? 'diag-good' : transportForecast?.key === 'hurting' ? 'diag-bad' : 'diag-warn';
  const desirabilityTransportPanel = '<div class="diag-sub">transport access (separate from room appeal): <span class="' + desirabilityTransportClass + '">' + (transportForecast?.label ?? 'no route evidence yet') + '</span> · ' + (transportForecast?.detail ?? 'reputation remains a separate delivery signal') + '</div>';
  const desirabilityPanel = '<div class="diag"><span>tower desirability</span><span class="' + desirabilityClass + '">' +
    (desirability.score == null ? 'no rooms' : desirability.score + '/100 · ' + desirability.band) + '</span></div>' +
    '<div class="diag-sub">' + desirability.detail + '</div>' +
    '<div class="diag-sub">daily history: ' + desirabilityTrend.label + ' · ' + desirabilityDelta + ' · ' + towerDesirabilityHistoryLabel(desirabilityHistory) + '</div>' +
    desirabilityTransportPanel;
  const retentionReadings = state.units.filter((u) => u.occupied).map((u) => tenantRetentionPressure(state, u, CONFIG));
  const retentionAtRisk = retentionReadings.filter((reading) => reading.pressure > 0).length;
  const retentionPressureTotal = retentionReadings.reduce((sum, reading) => sum + reading.pressure, 0);
  const retentionActions = state.units.filter((u) => u.occupied)
    .map((u) => ({ unit: u, recommendation: tenantRetentionRecommendation(state, u, CONFIG) }))
    .filter(({ recommendation }) => recommendation?.key !== 'monitor')
    .sort((a, b) => b.recommendation.pressure.pressure - a.recommendation.pressure.pressure);
  const retentionAction = retentionActions[0];
  const retentionPlacement = retentionAction?.recommendation.key === 'service'
    ? servicePlacementRecommendation(state, retentionAction.unit, retentionAction.recommendation.kind, CONFIG)
    : null;
  const retentionLastClose = d?.retention;
  const retentionHistory = tenantRetentionHistory(state);
  const retentionTrend = tenantRetentionTrend(retentionHistory, 6, CONFIG.occupancy.desirabilityRetentionVacateAt);
  const retentionDelta = tenantRetentionTrendDeltaLabel(retentionTrend);
  const retentionTrendClass = retentionTrend.key === 'rising' ? 'diag-bad' : retentionTrend.key === 'recovering' ? 'diag-good' : 'diag-warn';
  const retentionPanel = '<div class="diag"><span>tenant retention</span><span class="' + (retentionAtRisk ? 'diag-warn' : 'diag-good') + '">' +
    retentionAtRisk + '/' + retentionReadings.length + ' rooms under appeal pressure</span></div>' +
    '<div class="diag-sub">current appeal pressure: ' + Number(retentionPressureTotal.toFixed(1)) + ' total · low desirability builds slowly toward ' + CONFIG.occupancy.desirabilityRetentionVacateAt + '; improving appeal recovers it</div>' +
    '<div class="diag-sub">last close: ' + (retentionLastClose
      ? retentionLastClose.vacatedByDesirability + ' desirability exit' + (retentionLastClose.vacatedByDesirability === 1 ? '' : 's') + ' · ' + retentionLastClose.vacatedByStress + ' transport-stress exit' + (retentionLastClose.vacatedByStress === 1 ? '' : 's')
      : 'no retention history yet') + ' · elevator stress and room appeal are tracked separately</div>';
  const retentionActionPanel = retentionAction
    ? '<div class="diag-sub"><span class="diag-warn">next room action: F' + retentionAction.unit.floor + ' ' + retentionAction.unit.kind + ' · ' + retentionAction.recommendation.label + ' <button class="inspect-vacancy" data-inspect-unit="' + retentionAction.unit.id + '" data-management-hint="retention">inspect room</button>' +
      (retentionAction.recommendation.key === 'service'
        ? ' <button class="inspect-vacancy" title="' + (retentionPlacement?.detail ?? retentionPlacement?.reason ?? '') + '" data-retention-tool="' + retentionAction.recommendation.kind + '" data-retention-unit="' + retentionAction.unit.id + '">select ' + retentionAction.recommendation.kind + ' tool</button>'
        : '') +
      '</span> · ' + retentionAction.recommendation.detail +
      (retentionPlacement?.key === 'ready'
        ? ' · recommended placement F' + retentionPlacement.floor + ' (' + retentionPlacement.coveredRooms + '/' + retentionPlacement.totalRooms + ' required rooms covered)'
        : retentionPlacement?.reason ? ' · ' + retentionPlacement.reason : '') +
      '</div>'
    : '<div class="diag-sub">no room-level appeal action is needed right now</div>';
  const retentionHistoryPanel = '<div class="diag-sub">daily appeal pressure: <span class="' + retentionTrendClass + '">' + retentionTrend.label + ' · ' + retentionDelta + '</span> · ' + tenantRetentionHistoryLabel(retentionHistory) + '</div>';
  const serviceOutcomePanel = serviceOutcomeHistory.slice().reverse().map((entry, reverseIndex) => {
    const historyIndex = serviceOutcomeHistory.length - reverseIndex - 1;
    const serviceOutcomeClass = entry.signal === 'strong' ? 'diag-good' : entry.signal === 'partial' ? 'diag-warn' : 'diag-bad';
    const changedFloors = entry.changedFloors?.length
      ? entry.changedFloors.map((floor) => 'F' + floor).join(', ')
      : 'no newly covered rooms';
    const low = Math.max(CONFIG.building.lobbyFloor + 1, entry.floor - entry.coverageFloors);
    const high = Math.min(state.floors - 1, entry.floor + entry.coverageFloors);
    const area = 'F' + low + (low === high ? '' : '–F' + high);
    const focusIdentityMatches = entry.facilityId != null
      ? serviceFocusTarget?.facilityId === entry.facilityId
      : serviceFocusTarget?.facilityId == null;
    const focused = serviceFocusTarget?.kind === entry.kind && serviceFocusTarget.floor === entry.floor &&
      serviceFocusTarget.coverageFloors === entry.coverageFloors && focusIdentityMatches;
    const liveCoverage = focused ? serviceFocusCoverage(serviceFocusTarget, state, CONFIG) : null;
    const liveCoverageText = liveCoverage
      ? ' · now ' + liveCoverage.coveredRooms + '/' + liveCoverage.requiredRooms + ' rooms · heads ' + liveCoverage.coveredHeads + '/' + liveCoverage.requiredHeads +
        (liveCoverage.uncoveredRooms
          ? ' · <span class="diag-bad">UNCOVERED ' + liveCoverage.uncoveredRooms + ' room' + (liveCoverage.uncoveredRooms === 1 ? '' : 's') + ' · ' + liveCoverage.uncoveredHeads + ' heads</span>'
          : ' · <span class="diag-good">all focused rooms covered</span>')
      : '';
    const uncoveredUnit = liveCoverage?.uncoveredUnitIds?.map((id) => state.units.find((unit) => unit.id === id && unit.occupied)).find(Boolean);
    const uncoveredActions = uncoveredUnit
      ? ' · first uncovered: F' + uncoveredUnit.floor + ' ' + uncoveredUnit.kind +
        ' <button class="inspect-vacancy" data-inspect-unit="' + uncoveredUnit.id + '" data-management-hint="service" title="open the first occupied room still missing ' + entry.kind + ' coverage">inspect room</button>' +
        ' <button class="inspect-vacancy" data-uncovered-service-tool="' + entry.kind + '" data-uncovered-service-unit="' + uncoveredUnit.id + '" title="select the ' + entry.kind + ' tool and target this room">select ' + entry.kind + ' tool</button>'
      : '';
    const realizedBudgetText = Number.isFinite(entry.realizedNet)
      ? ' · D' + entry.realizedDay + ' realized ' + signedMoney(entry.realizedNet) + ' net · upkeep ' + money(entry.realizedUpkeep) +
        ' (services ' + money(entry.realizedServiceUpkeep) + ')'
      : '';
    const realizationStatusText = Number.isFinite(entry.realizedNet)
      ? ' · <span class="diag-good">REALIZED D' + entry.realizedDay + '</span>'
      : ' · <span class="diag-warn">PENDING · first day close</span>';
    const targetRoomDesirabilityAfter = entry.realizedDay == null
      ? entry.targetDesirabilityAfter
      : (entry.realizedTargetDesirability ?? entry.targetDesirabilityAfter);
    const targetRoomDesirabilityDelta = entry.targetDesirabilityBefore != null && targetRoomDesirabilityAfter != null
      ? targetRoomDesirabilityAfter - entry.targetDesirabilityBefore
      : null;
    const targetRoomDesirabilitySignal = targetRoomDesirabilityDelta == null
      ? ''
      : targetRoomDesirabilityDelta > 0
        ? ' (+' + targetRoomDesirabilityDelta + ' improved)'
        : targetRoomDesirabilityDelta < 0
          ? ' (' + targetRoomDesirabilityDelta + ' worsened)'
          : ' (unchanged)';
    const targetRoomDesirabilityText = entry.targetDesirabilityBefore != null && targetRoomDesirabilityAfter != null
      ? ' · target room desirability ' + entry.targetDesirabilityBefore + ' → ' + targetRoomDesirabilityAfter + targetRoomDesirabilitySignal
      : '';
    const targetRoom = entry.targetUnitId == null
      ? null
      : state.units.find((unit) => unit.id === entry.targetUnitId);
    const targetRoomEvaluation = targetRoom ? unitEvaluation(state, targetRoom, CONFIG) : null;
    const targetRoomCurrentHeads = targetRoom?.occupied
      ? Math.max(0, Math.round(targetRoom.heads ?? 0))
      : 0;
    const targetRoomCondition = !targetRoom
      ? 'room no longer present'
      : !targetRoom.occupied
        ? 'vacant now'
        : targetRoomEvaluation?.[entry.kind + 'Covered']
          ? 'covered now'
          : 'still uncovered';
    const targetRoomConditionClass = targetRoomCondition === 'covered now'
      ? 'diag-good'
      : targetRoomCondition === 'still uncovered'
        ? 'diag-bad' : 'diag-warn';
    const targetRoomAction = targetRoom?.occupied && targetRoomCondition === 'still uncovered'
      ? ' <button class="inspect-vacancy" data-uncovered-service-tool="' + entry.kind + '" data-uncovered-service-unit="' + targetRoom.id + '" title="select the ' + entry.kind + ' tool and target this room">select ' + entry.kind + ' tool</button>'
      : '';
    const targetRoomText = targetRoom
      ? ' · target F' + targetRoom.floor + ' ' + targetRoom.kind + ' · tenants ' + (entry.targetTenantLoad ?? '—') + ' → ' + targetRoomCurrentHeads +
        ' · <span class="' + targetRoomConditionClass + '">' + targetRoomCondition + '</span>' +
        ' <button class="inspect-vacancy" data-inspect-unit="' + targetRoom.id + '" data-management-hint="service-result">inspect target room</button>' + targetRoomAction
      : entry.targetUnitId != null ? ' · target room no longer present' : '';
    const focusLabel = focused
      ? entry.facilityId != null ? 'focused facility' : 'focused area'
      : entry.facilityId != null ? 'focus facility' : 'focus area';
    const focusTitle = entry.facilityId != null ? 'focus the exact built facility and its service area' : 'focus the service coverage area';
    const focusButton = '<button class="inspect-vacancy" title="' + focusTitle + '" data-service-result-floor="' + entry.floor + '" data-service-result-kind="' + entry.kind + '" data-service-result-facility="' + (entry.facilityId ?? '') + '" data-service-result-radius="' + entry.coverageFloors + '" data-service-result-changed-floors="' + (entry.changedFloors ?? []).join(',') + '" data-service-result-units="' + (entry.changedUnitIds ?? []).join(',') + '" data-service-result-index="' + historyIndex + '">' + focusLabel + '</button>';
    const clearButton = focused ? ' <button class="inspect-vacancy" data-clear-service-focus>clear focus</button>' : '';
    return '<div class="diag-sub service-outcome-history"><span class="' + serviceOutcomeClass + '">' + (reverseIndex === 0 ? 'last facility result' : 'facility result') + '</span> · D' + entry.day +
      ' (' + (state.day - entry.day === 0 ? 'today' : Math.max(0, state.day - entry.day) + ' day' + (state.day - entry.day === 1 ? '' : 's') + ' ago') + ') · ' + entry.kind.toUpperCase() +
      ' on F' + entry.floor + ' · ' + entry.label + ' · coverage ' + entry.beforeRooms + '/' + entry.requiredRooms +
      ' → ' + entry.afterRooms + '/' + entry.requiredRooms + ' rooms · heads ' + entry.beforeHeads + ' → ' + entry.afterHeads + targetRoomDesirabilityText + targetRoomText +
      ' · changed ' + changedFloors + ' · area ' + area + realizationStatusText + realizedBudgetText + liveCoverageText + uncoveredActions + ' ' + focusButton + clearButton + '</div>';
  }).join('');
  const recommendationClass = repRecommendation.key === 'steady' || repRecommendation.key === 'observe' ? 'diag-good' : repRecommendation.key === 'route' ? 'diag-warn' : 'diag-bad';
  const recommendationPanel = '<div class="diag"><span>recommended next move</span><span class="' + recommendationClass + '">' + repRecommendation.label + '</span></div>' +
    '<div class="diag-sub">' + repRecommendation.detail + '</div>';

  els.transport.innerHTML =
    transportCoveragePanel +
    activeServicePanel +
    budgetPanel +
    (shaftRows || '<div class="diag-bad">no elevator shafts</div>') + stairRows + escalatorRows +
    waitingSystemPanel +
    unassignedWaitingPanel +
    unassignedResponsePanel +
    '<div class="diag-sub">' + (waiting.length ? waiting.length + ' people waiting now' : 'no active queues') + '</div>' +
    queueDailyPanel +
    utilizationHistoryPanel +
    utilizationHintPanel +
    floorFocusPanel +
    floorRows +
    reputationPanel +
    desirabilityPanel +
    retentionPanel +
    retentionActionPanel +
    retentionHistoryPanel +
    serviceOutcomePanel +
    recommendationPanel +
    foodRows +
    parkingRows +
    medicalRows +
    securityRows +
    recyclingRows +
    leasingRows +
    leasingOutcomePanel +
    vacancyPreFillResultPanel +
    leasingHistoryPanel +
    vacancyAppealActionPanel +
    vacancyAppealFollowupPanel +
    leaseStatusPanel +
    tenantMixRowsPanel +
    shopTrafficPanel +
    hotelBookingPanel +
    hotelFeedbackHistoryPanel +
    roomHealthPanel +
    '<div class="diag-sub">lowest room evaluations</div>' + tenantLoadLegend + evalRows;
}

function renderExpansionSafety() {
  const floor = expansionSafetySummary(state, CONFIG.costs.floor);
  const roomKind = CONFIG.units[tool] ? tool : 'office';
  const room = expansionSafetySummary(state, CONFIG.costs[roomKind]);
  const severity = [floor, room].some((summary) => summary.key === 'critical' || summary.key === 'unaffordable')
    ? 'bad'
    : [floor, room].some((summary) => summary.key === 'watch' || summary.key === 'break_even')
      ? 'warn'
      : 'good';
  const roomLabel = roomKind === 'office' ? 'selected room' : roomKind.toUpperCase();
  els['expansion-safety'].innerHTML = '<b>EXPANSION SAFETY</b> · next floor (' + money(CONFIG.costs.floor) + '): ' +
    floor.label + '<br>' + roomLabel + ' (' + money(CONFIG.costs[roomKind]) + '): ' + room.label +
    '<br><span>warning only · risky growth remains your choice</span>';
  els['expansion-safety'].className = 'build-safety ' + severity;
  els['expansion-safety'].setAttribute('aria-label', 'expansion safety; next floor: ' + floor.label + '; ' + roomLabel + ': ' + room.label + '; warning only, risky growth remains your choice');
}

function renderShaftInspector() {
  const element = els['shaft-inspector'];
  const shaft = selectedShaftId == null ? null : state.shafts.find((candidate) => candidate.id === selectedShaftId);
  if (!shaft) {
    element.classList.remove('open');
    element.innerHTML = '';
    return;
  }
  const waiting = state.people.filter((person) => person.state === 'waiting' && person.shaft === shaft.id).length;
  const buildingWaiting = state.people.filter((person) => person.state === 'waiting').length;
  const routeQueueShare = buildingWaiting ? Math.round(waiting / buildingWaiting * 100) : 0;
  const queueOrigins = new Map();
  for (const person of state.people) {
    if (person.state !== 'waiting' || person.shaft !== shaft.id) continue;
    queueOrigins.set(person.from, (queueOrigins.get(person.from) || 0) + 1);
  }
  const queueOriginText = [...queueOrigins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([floor, count]) => '<span class="' + indicatorCssClass(waitingPressure(count).colorKey) + '">F' + floor + ' ' + count + '</span>')
    .join(' · ') || '<span class="diag-good">none</span>';
  const queuePressure = waitingPressure(waiting);
  const queueMeaning = waitingPressureColorMeaning(queuePressure.band);
  const trend = shaftQueueTrend(carQueueHistory.get(shaft.id));
  const trendLabel = trend.entries.length > 1
    ? 'trend ' + trend.bars + ' · ' + (trend.spike ? 'spike' : trend.direction)
    : trend.entries.length ? 'trend collecting' : 'trend awaiting history';
  const trendSpan = trend.entries.length > 1
    ? ' · ' + trend.entries.length + ' readings' + (trend.timeSpanMinutes == null
      ? ''
      : ' across ' + (trend.timeSpanMinutes < 1 ? '<1' : trend.timeSpanMinutes) + ' sim min')
    : trend.entries.length ? ' · 1 reading' : '';
  const trendClass = trend.direction === 'falling' && !trend.spike ? 'diag-good'
    : trend.direction === 'rising' || trend.spike ? 'diag-bad' : 'diag-warn';
  const aboard = shaft.cars.reduce((total, car) => total + car.riders.length, 0);
  const dispatchCapacity = shaft.cars.length * CONFIG.elevator.capacity;
  const moving = shaft.cars.filter((car) => car.state === 'moving').length;
  const doors = shaft.cars.filter((car) => car.state === 'doors').length;
  const status = waiting ? 'QUEUE · ' + waiting + ' waiting · ' + queueMeaning : moving || doors ? 'SERVING' : 'IDLE';
  const statusClass = indicatorCssClass(queuePressure.colorKey);
  const carDetails = shaft.cars.map((car, index) => {
    const loadClass = indicatorCssClass(car.riders.length >= CONFIG.elevator.capacity ? 'bad' : car.riders.length ? 'warn' : 'good');
    const state = car.state === 'doors' ? 'doors open' : car.state === 'moving' ? 'moving' : 'idle';
    return '<span class="' + loadClass + '" title="car ' + (index + 1) + ' current load and operating state">C' + (index + 1) + ' ' + car.riders.length + '/' + CONFIG.elevator.capacity + ' riders · ' + state + '</span>';
  }).join(' · ');
  const carCost = CONFIG.costs.car;
  const remainingCarSlots = Math.max(0, CONFIG.elevator.maxCarsPerShaft - shaft.cars.length);
  const carUpgradeText = shaft.cars.length >= CONFIG.elevator.maxCarsPerShaft
    ? '<div class="shaft-upgrade diag-warn">car limit reached · build another shaft for more route capacity</div>'
    : '<div class="shaft-upgrade">' + remainingCarSlots + ' car slot' + (remainingCarSlots === 1 ? '' : 's') + ' remaining · next car: +' + CONFIG.elevator.capacity + ' riders/dispatch · ' + money(carCost) +
      (state.money >= carCost
        ? ' · dispatch ' + dispatchCapacity + ' → ' + (dispatchCapacity + CONFIG.elevator.capacity) + ' riders <button class="shaft-upgrade-button" data-shaft-car-tool="' + shaft.id + '">select + car</button>'
        : ' · NOT ENOUGH MONEY (have ' + money(state.money) + ')') + '</div>';
  element.innerHTML = '<div id="shaft-title">S' + (state.shafts.indexOf(shaft) + 1) + ' ELEVATOR SHAFT</div>' +
    '<div id="shaft-status" class="' + statusClass + '" title="queue pressure: ' + queueMeaning + '">' + status + ' · ' + shaft.cars.length + '/' + CONFIG.elevator.maxCarsPerShaft + ' cars</div>' +
    '<div id="shaft-detail">served floors F' + shaft.bottom + '–F' + shaft.top + ' · dispatch capacity ' + dispatchCapacity + ' riders · aboard ' + aboard + '/' + dispatchCapacity + '<br><span class="' + statusClass + '">route queue: ' + waiting + ' waiting · ' + queueMeaning + '</span> · <span class="' + indicatorCssClass(waitingPressure(buildingWaiting).colorKey) + '" title="waiting people assigned to all elevator routes">building-wide W ' + buildingWaiting + ' total</span> · route share ' + routeQueueShare + '% · <span class="' + trendClass + '" title="recent assigned-queue trend">' + trendLabel + trendSpan + '</span> · ' + moving + ' moving · ' + doors + ' at doors<br>queue origins: ' + queueOriginText + '<br>cars: ' + carDetails + '</div>' +
    carUpgradeText +
    '<div class="shaft-inspector-note">yellow-outlined W badges mark floors feeding this route<br>trend key: ↑ rising · ↓ falling · → steady · ! spike<br>capacity is per dispatch; add cars to this shaft or build another route when queues persist</div>' +
    '<button class="shaft-clear" data-clear-shaft-focus>clear shaft focus</button>';
  element.classList.add('open');
}

els['shaft-inspector'].addEventListener('click', (event) => {
  const carButton = event.target.closest('button[data-shaft-car-tool]');
  if (carButton) {
    selectRouteAlternative('car', Number(carButton.dataset.shaftCarTool));
    return;
  }
  if (!event.target.closest('button[data-clear-shaft-focus]')) return;
  selectedShaftId = null;
  refresh();
  setMode('SHAFT FOCUS CLEARED', INFO);
  toast('SHAFT FOCUS CLEARED', INFO);
});

function renderFacilityInspector() {
  const element = els['facility-inspector'];
  const facilityId = serviceFocusTarget?.facilityId;
  const facility = facilityId == null ? null : state.facilities?.find((candidate) => candidate.id === facilityId);
  if (!facility) {
    element.classList.remove('open');
    element.innerHTML = '';
    return;
  }
  const service = CONFIG.services?.[facility.kind] ?? {};
  const coverageFloors = service.coverageFloors ?? 0;
  const coverage = serviceFocusCoverage(serviceFocusTarget, state, CONFIG);
  const low = Math.max(CONFIG.building.lobbyFloor + 1, facility.floor - coverageFloors);
  const high = Math.min(state.floors - 1, facility.floor + coverageFloors);
  const label = facility.kind === 'food' ? 'CAFETERIA' : facility.kind === 'parking' ? 'PARKING'
    : facility.kind === 'medical' ? 'CLINIC' : facility.kind === 'security' ? 'SECURITY' : 'RECYCLING';
  const rooms = coverage?.requiredRooms ?? 0;
  const coveredRooms = coverage?.coveredRooms ?? 0;
  const heads = coverage?.requiredHeads ?? 0;
  const coveredHeads = coverage?.coveredHeads ?? 0;
  const coverageClass = coveredRooms === rooms ? 'diag-good' : 'diag-warn';
  const coveredRoomLabel = serviceFocusCoveredRoomLabel(coverage, state);
  const coveredRoomDetails = serviceFocusCoveredRoomDetails(coverage, state, CONFIG);
  const uncoveredRoomLabel = serviceFocusUncoveredRoomLabel(coverage, state);
  const coverageText = rooms
    ? '<span class="' + coverageClass + '">' + coveredRooms + '/' + rooms + ' rooms · tenant heads ' + coveredHeads + '/' + heads + '</span>'
    : '<span class="diag-good">no occupied rooms currently require this service</span>';
  const uncoveredText = uncoveredRoomLabel
    ? '<div class="facility-inspector-gap"><span class="diag-bad">remaining uncovered: ' + uncoveredRoomLabel + '</span></div>'
    : '';
  const coveredText = coveredRoomLabel
    ? '<div class="facility-inspector-rooms"><span class="diag-good">serves:</span> ' + coveredRoomDetails.slice(0, 3).map((room) => {
      const health = serviceRoomHealthSignal(room, CONFIG);
      const driverText = health.driver && health.driver !== 'none' && health.driver !== 'unknown' ? ' · cause ' + health.driver : '';
      const retention = health.driver.includes('appeal')
        ? tenantRetentionRecommendation(state, state.units.find((unit) => unit.id === room.id), CONFIG)
        : null;
      const retentionButton = retention?.key === 'service' && retention.kind
        ? els.build.querySelector('button[data-facility="' + retention.kind + '"]')
        : null;
      const appealAction = health.driver.includes('appeal')
        ? '<button class="inspect-vacancy" data-facility-appeal-room-id="' + room.id + '" title="review the strongest appeal response for this room">' +
          (retentionButton && !retentionButton.disabled ? 'select ' + retention.kind + ' tool' : 'review appeal') + '</button>'
        : '';
      const transportAction = health.driver.includes('transport')
        ? '<button class="inspect-vacancy" data-facility-transport-room-id="' + room.id + '" title="focus the strongest transport response for this room">focus transport</button>'
        : '';
      return '<span class="facility-room-entry"><button class="inspect-vacancy facility-room-link" data-facility-room-id="' + room.id + '" title="inspect F' + room.floor + ' ' + room.kind + '">F' + room.floor + ' ' + room.kind + ' (' + room.heads + ' tenants) · desirability ' + (room.desirability == null ? '—' : room.desirability + '/100') + ' · transport stress ' + room.stress + '/' + (CONFIG.units[room.kind]?.vacateAt ?? '—') + ' · <span class="' + indicatorCssClass(health.colorKey) + '">' + health.label + driverText + '</span></button>' + appealAction + transportAction + '</span>';
    }).join(' · ') + (coveredRoomDetails.length > 3 ? ' +' + (coveredRoomDetails.length - 3) + ' more' : '') + '</div>'
    : '';
  const realized = serviceOutcomeHistory.slice().reverse().find((entry) =>
    entry.facilityId === facility.id && Number.isFinite(entry.realizedNet));
  const realizedBudgetText = realized
    ? '<div class="facility-inspector-budget ' + (realized.realizedNet >= 0 ? 'diag-good' : 'diag-bad') + '">last close D' + realized.realizedDay + ': ' +
      signedMoney(realized.realizedNet) + ' net · upkeep ' + money(realized.realizedUpkeep) + ' (services ' + money(realized.realizedServiceUpkeep) + ')</div>'
    : '<div class="facility-inspector-budget diag-warn">realized budget pending first day close</div>';
  element.innerHTML = '<div id="facility-title">F' + facility.floor + ' ' + label + '</div>' +
    '<div id="facility-status">ACTIVE · +' + money(service.dailyUpkeep ?? 0) + '/day upkeep</div>' +
    '<div id="facility-detail">coverage F' + low + (low === high ? '' : '–F' + high) + ' · ' + coverageText + '</div>' +
    coveredText +
    uncoveredText +
    realizedBudgetText +
    '<div class="facility-inspector-note">live service demand; click another facility or its history result to change focus</div>' +
    '<button class="facility-clear" data-clear-facility-focus>clear facility focus</button>';
  element.classList.add('open');
}

els['facility-inspector'].addEventListener('click', (event) => {
  const appealButton = event.target.closest('button[data-facility-appeal-room-id]');
  const transportButton = event.target.closest('button[data-facility-transport-room-id]');
  if (appealButton || transportButton) {
    const id = Number((appealButton || transportButton).dataset.facilityAppealRoomId ?? (appealButton || transportButton).dataset.facilityTransportRoomId);
    const unit = state.units.find((candidate) => candidate.id === id && candidate.occupied);
    if (!unit) return;
    selectedUnitId = id;
    selectedFloor = unit.floor;
    lastConfirmationOutcome = null;
    conversionTargetKind = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    placementWarning = null;
    if (appealButton) {
      const recommendation = tenantRetentionRecommendation(state, unit, CONFIG);
      if (recommendation?.key === 'service' && recommendation.kind && selectServiceToolForUnit(recommendation.kind, id, 'facility health')) return;
      refresh();
      setMode('APPEAL ACTION → F' + unit.floor + ' ' + unit.kind + ' · review ' + (recommendation?.label ?? 'room appeal') + ' in the room inspector.', WARN);
      toast('FACILITY → appeal response opened for F' + unit.floor, INFO);
      return;
    }
    const response = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
    if (response.affordable !== false && response.key === 'car' && Number.isFinite(Number(response.shaftId))) {
      selectRouteAlternative('car', Number(response.shaftId));
      selectedUnitId = id;
      selectedFloor = unit.floor;
      refresh();
      setMode('TRANSPORT ACTION → F' + unit.floor + ' ' + unit.kind + ' · recommended car response selected.', WARN);
      return;
    }
    if (response.affordable !== false && response.key === 'shaft') {
      selectRouteAlternative('shaft', null, Number.isInteger(response.targetFloor) ? response.targetFloor : unit.floor);
      selectedUnitId = id;
      selectedFloor = unit.floor;
      refresh();
      setMode('TRANSPORT ACTION → F' + unit.floor + ' ' + unit.kind + ' · recommended shaft response selected.', WARN);
      return;
    }
    if (response.affordable !== false && (response.kind === 'stairs' || response.kind === 'escalator')) {
      tool = response.kind;
      recommendedShaftId = null;
      transportFocusTarget = Number.isInteger(response.targetFloor) ? { kind: response.kind, floor: response.targetFloor } : null;
      routeTarget = Number.isInteger(response.targetFloor) ? { kind: response.kind, floor: response.targetFloor, recommended: true } : null;
      refresh();
      setMode(response.kind.toUpperCase() + ' selected from facility health · target F' + unit.floor + ' ' + unit.kind + ' · click the top floor to place it.', WARN);
      toast(response.kind.toUpperCase() + ' selected from facility health', INFO);
      return;
    }
    refresh();
    setMode('TRANSPORT ACTION → F' + unit.floor + ' ' + unit.kind + ' · review the transport recommendation before placing capacity.', WARN);
    toast('FACILITY → transport response opened for F' + unit.floor, INFO);
    return;
  }
  const roomButton = event.target.closest('button[data-facility-room-id]');
  if (roomButton) {
    const id = Number(roomButton.dataset.facilityRoomId);
    const unit = state.units.find((candidate) => candidate.id === id && candidate.occupied);
    if (!unit) return;
    selectedUnitId = id;
    lastConfirmationOutcome = null;
    conversionTargetKind = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    placementWarning = null;
    managementHintConfirmation = 'opened ' + tenantUtilizationHintFocusLabel(unit) + ' from the facility service list · now in focus';
    refresh();
    setMode('OCCUPIED room selected — read-only tenant-mix inspection on the right. Opened from the facility service list.', INFO);
    toast('FACILITY → opened ' + tenantUtilizationHintFocusLabel(unit), INFO);
    return;
  }
  if (!event.target.closest('button[data-clear-facility-focus]')) return;
  serviceFocusTarget = null;
  refresh();
  setMode('FACILITY FOCUS CLEARED · service history retained', INFO);
  toast('FACILITY FOCUS CLEARED · history retained', INFO);
});

function renderInspector() {
  const unit = state.units.find((u) => u.id === selectedUnitId);
  if (!unit) {
    selectedUnitId = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    els['unit-inspector'].classList.remove('open');
    return;
  }

  const evaluation = unitEvaluation(state, unit, CONFIG);
  const load = tenantLoadStatus(unit, CONFIG);
  const liveTenantHeads = unit.occupied ? load.tenants : 0;
  const focusedServiceCoverage = serviceFocusTarget
    ? serviceFocusCoverage(serviceFocusTarget, state, CONFIG)
    : null;
  const focusedServiceKind = serviceFocusTarget?.kind;
  const focusedServiceNeed = focusedServiceKind
    ? CONFIG.units[unit.kind]?.[focusedServiceKind + 'Need'] ?? 0
    : 0;
  const roomInFocusedServiceArea = Boolean(focusedServiceCoverage?.floors.includes(unit.floor));
  const focusedServiceRoomAction = roomInFocusedServiceArea && unit.occupied && focusedServiceNeed && !evaluation[focusedServiceKind + 'Covered']
    ? ' <button class="inspect-vacancy" data-room-service-tool="' + focusedServiceKind + '" data-room-service-unit="' + unit.id + '" title="select the ' + focusedServiceKind + ' tool and target this room">select ' + focusedServiceKind + ' tool</button>'
    : '';
  const selectedServiceOutcomeHistory = serviceOutcomeHistory.slice().reverse().find((entry) => entry.targetUnitId === unit.id);
  const selectedServiceOutcome = selectedServiceOutcomeHistory
      ? {
        kind: selectedServiceOutcomeHistory.kind,
        day: selectedServiceOutcomeHistory.day,
        before: { coveredRooms: selectedServiceOutcomeHistory.beforeRooms, coveredHeads: selectedServiceOutcomeHistory.beforeHeads, roomHeads: selectedServiceOutcomeHistory.targetBeforeHeads },
        after: { requiredRooms: selectedServiceOutcomeHistory.requiredRooms, coveredRooms: selectedServiceOutcomeHistory.afterRooms, coveredHeads: selectedServiceOutcomeHistory.afterHeads, roomHeads: selectedServiceOutcomeHistory.targetAfterHeads },
        label: selectedServiceOutcomeHistory.label,
      }
      : investmentOutcome?.serviceCoverage && investmentOutcome.targetUnitId === unit.id
        ? {
          kind: investmentOutcome.kind,
          day: state.day,
          before: investmentOutcome.serviceCoverage.before,
          after: investmentOutcome.serviceCoverage.after,
          label: null,
        }
      : null;
  const selectedServiceOutcomeSignal = selectedServiceOutcome
    ? serviceCoverageChange({
      available: true,
      requiredRooms: selectedServiceOutcome.after.requiredRooms,
      afterRooms: selectedServiceOutcome.after.coveredRooms,
      roomsDelta: selectedServiceOutcome.after.coveredRooms - selectedServiceOutcome.before.coveredRooms,
      headsDelta: selectedServiceOutcome.after.coveredHeads - selectedServiceOutcome.before.coveredHeads,
    })
    : null;
  const recordedRoomHeads = selectedServiceOutcome?.after.roomHeads;
  const liveHeadDelta = Number.isFinite(recordedRoomHeads) ? liveTenantHeads - recordedRoomHeads : null;
  const liveHeadDeltaText = liveHeadDelta == null ? ''
    : ' · recorded room heads ' + (selectedServiceOutcome.before.roomHeads ?? '—') + ' → ' + recordedRoomHeads +
      ' · live T ' + liveTenantHeads + ' (Δ ' + (liveHeadDelta > 0 ? '+' : '') + liveHeadDelta + ')';
  const selectedServiceOutcomeCue = selectedServiceOutcome
    ? '<br>service result D' + selectedServiceOutcome.day + ': ' + selectedServiceOutcome.kind.toUpperCase() + ' · ' +
      (!unit.occupied
        ? '<span class="diag-warn">room vacant</span> · no live tenant demand'
        : evaluation[selectedServiceOutcome.kind + 'Covered']
          ? '<span class="diag-good">room covered now</span>'
          : '<span class="diag-bad">room still uncovered</span> · coverage-driven') +
      (liveHeadDeltaText || ' · live T ' + liveTenantHeads + ' heads') +
      ' · area ' + selectedServiceOutcome.before.coveredRooms + '/' + selectedServiceOutcome.after.requiredRooms +
      ' → ' + selectedServiceOutcome.after.coveredRooms + '/' + selectedServiceOutcome.after.requiredRooms + ' rooms · heads ' +
      selectedServiceOutcome.before.coveredHeads + ' → ' + selectedServiceOutcome.after.coveredHeads +
      ' · recorded ' + (selectedServiceOutcome.label ?? selectedServiceOutcomeSignal.label) + ' · live status after D' + state.day
    : '';
  const focusedServiceRoomCue = roomInFocusedServiceArea
    ? '<br>service focus: ' + focusedServiceKind.toUpperCase() + ' · ' +
      (focusedServiceNeed
        ? evaluation[focusedServiceKind + 'Covered']
          ? '<span class="diag-good">covered</span> · T ' + load.tenants + ' tenant heads covered'
          : '<span class="diag-bad">UNCOVERED</span> · T ' + load.tenants + ' tenant heads still missing service' + focusedServiceRoomAction
        : '<span class="diag-good">not required for this room</span>')
    : '';
  const selectedServiceStatusHistory = serviceRoomStatusHistory.filter((entry) => entry.unitId === unit.id).slice().reverse();
  const serviceStatusTrend = serviceRoomStatusTrend(selectedServiceStatusHistory.slice().reverse());
  const currentServiceStatus = selectedServiceStatusHistory[0]?.key ?? null;
  const serviceTrendAction = serviceRoomTrendAction(serviceStatusTrend, currentServiceStatus, selectedServiceOutcome?.kind);
  const serviceTrendActionButton = serviceTrendAction.key === 'coverage' && selectedServiceOutcome?.kind
    ? ' <button class="inspect-vacancy" data-room-service-tool="' + selectedServiceOutcome.kind + '" data-room-service-unit="' + unit.id + '">select ' + selectedServiceOutcome.kind + ' tool</button>'
    : '';
  const serviceStatusTrendCue = selectedServiceStatusHistory.length
    ? '<br>service trend: <span class="' + (serviceStatusTrend.key === 'recovering' ? 'diag-good' : serviceStatusTrend.key === 'worsening' ? 'diag-bad' : 'diag-warn') + '">' + serviceStatusTrend.label + '</span>' +
      (serviceTrendAction.label ? ' · next action: ' + serviceTrendAction.label + serviceTrendActionButton : '')
    : '';
  const serviceStatusHistoryCue = selectedServiceStatusHistory.length
    ? '<br>daily service history: ' + selectedServiceStatusHistory.map((entry) => {
      const statusClass = entry.key === 'covered' ? 'diag-good' : entry.key === 'uncovered' ? 'diag-bad' : 'diag-warn';
      const label = entry.key === 'covered' ? 'covered' : entry.key === 'uncovered' ? 'uncovered' : entry.key === 'vacant' ? 'vacant' : 'not required';
      const transition = entry.transitionFrom ? ' · from ' + entry.transitionFrom : '';
      return '<span class="' + statusClass + '">D' + entry.day + ' ' + label + ' · T ' + entry.liveHeads + transition + '</span>';
    }).join(' → ')
    : '';
  const retention = tenantRetentionPressure(state, unit, CONFIG);
  const retentionRecommendation = tenantRetentionRecommendation(state, unit, CONFIG);
  const demandQuality = tenantDemandQuality(state, unit, CONFIG);
  const condoTransportResponse = unit.kind === 'condo'
    ? transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory)
    : null;
  const condoTransportAction = condoTransportResponse?.key === 'car' && condoTransportResponse.affordable !== false && condoTransportResponse.shaftId != null
    ? { kind: 'car', shaftId: condoTransportResponse.shaftId }
    : condoTransportResponse?.key === 'shaft' && condoTransportResponse.affordable !== false
      ? { kind: 'shaft', floor: condoTransportResponse.targetFloor ?? unit.floor }
      : condoTransportResponse?.key === 'local' && condoTransportResponse.affordable !== false && condoTransportResponse.kind
        ? { kind: condoTransportResponse.kind, floor: condoTransportResponse.targetFloor ?? unit.floor }
        : null;
  const condoTransportCue = unit.kind === 'condo'
    ? '<br>transport after placement: ' + (condoTransportResponse?.key === 'monitor'
      ? 'no current pressure; keep watching W/T'
      : condoTransportResponse?.label ?? 'response needed') +
      (condoTransportAction
        ? ' <button class="inspect-vacancy" data-room-transport-action="' + condoTransportAction.kind + '" data-room-transport-shaft="' + (condoTransportAction.shaftId ?? '') + '" data-room-transport-floor="' + (condoTransportAction.floor ?? '') + '">select ' + condoTransportAction.kind + '</button>'
        : '')
    : '';
  const tenantAccessOutcome = unit.occupied ? tenantAccessOutcomeForUnit(state, unit) : null;
  const accessForecastClass = tenantAccessOutcome?.forecastKey === 'helping' ? 'diag-good' : tenantAccessOutcome?.forecastKey === 'hurting' ? 'diag-bad' : 'diag-warn';
  const accessRealizedClass = tenantAccessOutcome?.realizedBonus > 0 ? 'diag-good' : tenantAccessOutcome?.realizedBonus < 0 ? 'diag-bad' : 'diag-warn';
  const occupiedTransportAccessCue = unit.occupied
    ? '<br>tenant access: ' + (tenantAccessOutcome
      ? 'D' + tenantAccessOutcome.day + ' forecast <span class="' + accessForecastClass + '">' + tenantAccessOutcome.forecastLabel + '</span> ' + (tenantAccessOutcome.forecastBonus == null ? '—' : (tenantAccessOutcome.forecastBonus >= 0 ? '+' : '') + tenantAccessOutcome.forecastBonus) + (tenantAccessOutcome.forecastTests ? ' across ' + tenantAccessOutcome.forecastTests + ' route tests' : '') + (tenantAccessOutcome.forecastTrendBars ? ' ' + tenantAccessOutcome.forecastTrendBars : '') + ' → realized <span class="' + accessRealizedClass + '">' + (tenantAccessOutcome.realizedBonus == null ? '—' : (tenantAccessOutcome.realizedBonus >= 0 ? '+' : '') + tenantAccessOutcome.realizedBonus) + ' for this room' : 'no recorded move-in result yet') + ' · separate from room appeal and reputation'
    : '';
  const roomAppealFollowup = [...vacancyAppealFollowupHistory, ...vacancyAppealFollowups].slice().reverse().find((followup) => followup.unitId === unit.id);
  const roomAppealFollowupCue = roomAppealFollowup
    ? '<br>appeal action follow-up: ' + (roomAppealFollowup.result
      ? '<span class="' + resultClassForFollowup(roomAppealFollowup.result) + '">' + roomAppealFollowup.result.label + '</span> · ' + roomAppealFollowup.result.detail
      : '<span class="diag-warn">' + roomAppealFollowup.action + ' recorded on D' + roomAppealFollowup.builtDay + ' · result after next day close</span>')
    : '';
  const condoServiceStatusCue = unit.kind === 'condo'
    ? '<br>condo services: ' + tenantPlacementServiceNeeds('condo', CONFIG).map((service) =>
      '<span class="' + (evaluation[service.kind + 'Covered'] ? 'diag-good' : 'diag-bad') + '">' + service.label + ' ' +
      (evaluation[service.kind + 'Covered'] ? 'covered' : 'missing') + '</span>').join(' · ')
    : '';
  const vacancyDemand = unit.occupied ? null : vacancyDemandSummary(state, unit, CONFIG, state.log.at(-1)?.rep);
  const vacancyTransportAccess = vacancyDemand?.transportAccess;
  const vacancyTransportAccessClass = vacancyTransportAccess?.key === 'helping' ? 'diag-good' : vacancyTransportAccess?.key === 'hurting' ? 'diag-bad' : 'diag-warn';
  const vacancyTransportAccessCue = vacancyTransportAccess
    ? '<br>transport access forecast: <span class="' + vacancyTransportAccessClass + '">' + vacancyTransportAccess.label + '</span> · ' + (vacancyTransportAccess.bonus >= 0 ? '+' : '') + vacancyTransportAccess.bonus + ' demand points · ' + vacancyTransportAccess.tests + ' route test' + (vacancyTransportAccess.tests === 1 ? '' : 's') + (vacancyTransportAccess.trend?.bars ? ' · ' + vacancyTransportAccess.trend.bars : '') + ' · separate from room appeal and reputation'
    : '';
  const status = unit.occupied ? null : leaseStatus(state, unit, CONFIG);
  const recoveryComparison = unit.occupied ? null : vacancyRecoveryComparison(state, unit, CONFIG, state.log.at(-1)?.rep);
  const vacancyForecast = unit.occupied ? null : leasingForecast(state, CONFIG, state.log.at(-1)?.rep);
  const vacancyPreFill = unit.occupied ? null : vacancyPreFillOutcome(state, unit, CONFIG, vacancyForecast);
  const baseRelistDays = CONFIG.units[unit.kind]?.relistDays ?? 0;
  const renovationCost = CONFIG.costs.renovation;
  const conversionCost = CONFIG.costs.conversion;
  const demolitionCost = CONFIG.costs.demolition;
  const cost = CONFIG.costs.rerent;
  const canRenovate = !unit.occupied && !unit.renovated && state.money >= renovationCost;
  const canRerent = !unit.occupied && status?.key === 'ready' && evaluation.score >= CONFIG.evaluation.relistMinScore && state.money >= cost;
  const targetKinds = Object.keys(CONFIG.units).filter((kind) =>
    !unit.occupied && kind !== unit.kind && unlocked(state, CONFIG, kind));
  if (unit.occupied || (conversionTargetKind && !targetKinds.includes(conversionTargetKind))) {
    conversionTargetKind = null;
  }
  if (unit.occupied || renovationTargetId !== unit.id || unit.renovated) renovationTargetId = null;
  if (unit.occupied || rerentTargetId !== unit.id) rerentTargetId = null;
  const incomeBreakdownText = (kind, baseRent, variableRevenue, total, trafficPotential = variableRevenue, deliveryFactor = 1) => kind === 'shop'
    ? 'base ' + money(baseRent) + ' + traffic ' + money(variableRevenue) + '/' + money(trafficPotential) + (trafficPotential > 0 ? ' at ' + Math.round((deliveryFactor ?? 0) * 100) + '% delivery' : '') + ' = ' + money(total) + '/day'
    : money(total) + '/day';
  const conversion = conversionTargetKind
    ? conversionPreview(state, unit, conversionTargetKind, CONFIG)
    : null;
  const conversionPreviewText = conversion
    ? '<div class="diag-sub conversion-preview">preview: ' + conversion.fromKind + ' → ' + conversion.toKind +
      ' · capacity ' + conversion.fromCapacity + ' → ' + conversion.toCapacity +
      ' · mix stays unchanged while vacant</div>' +
      '<div class="diag-sub conversion-preview">after re-rent: ' + conversion.toKind + ' ' +
      Math.round(conversion.currentShare * 100) + '% → ' + Math.round(conversion.projectedShare * 100) +
      '% / ' + Math.round(conversion.targetShare * 100) + '% target · demand quality +' + conversion.fromDemandQuality.bonus +
      ' → +' + conversion.toDemandQuality.bonus + ' · mix +' + conversion.fromMarketDemandBonus +
      ' → +' + conversion.toMarketDemandBonus + ' · daily income ' + incomeBreakdownText(conversion.fromKind, conversion.fromDailyRent, conversion.fromVariableRevenue, conversion.fromDailyIncome, conversion.fromTrafficPotential, conversion.fromDeliveryFactor) +
      ' → ' + incomeBreakdownText(conversion.toKind, conversion.toDailyRent, conversion.toVariableRevenue, conversion.toDailyIncome, conversion.toTrafficPotential, conversion.toDeliveryFactor) + ' (' + (conversion.dailyIncomeDelta >= 0 ? '+' : '-') +
      money(Math.abs(conversion.dailyIncomeDelta)) + ') · $' + conversionCost.toLocaleString() +
      ' · room remains vacant and market timing restarts · click again to confirm</div>'
    : '';
  const recoveryComparisonText = recoveryComparison
    ? '<div class="diag-sub conversion-preview"><span class="' + (recoveryComparison.recommendation.key === 'rerent' ? 'diag-good' : 'diag-warn') + '">recovery: ' + recoveryComparison.recommendation.label + '</span> · ' + recoveryComparison.recommendation.detail + '</div>' +
      '<div class="diag-sub conversion-preview">current gates: ' +
      (recoveryComparison.marketDaysRemaining > 0
        ? 'market timing ' + recoveryComparison.marketDaysRemaining + ' day' + (recoveryComparison.marketDaysRemaining === 1 ? '' : 's') + ' left'
        : 'market timing ready') +
      ' · reputation ' + (recoveryComparison.reputationReady
        ? 'ready at ' + Math.round(recoveryComparison.reputation) + '%'
        : Math.round(recoveryComparison.reputation) + '% / ' + recoveryComparison.reputationRequired + '% required') + '</div>' +
      '<div class="diag-sub conversion-preview">' + recoveryComparison.options.map((option) =>
        option.label + ' · ' + (option.key === 'demolish'
          ? 'LAST RESORT · permanent removal'
          : option.evaluation == null ? 'target demand' : 'eval ' + option.evaluation + ' → ' + option.projectedEvaluation) +
        (option.key === 'demolish'
          ? ' · frees F' + option.freedFloorSpace.floor + ' slot ' + option.freedFloorSpace.slot + ' for a new room'
          : ' · quality +' + option.qualityBonus + ' · mix +' + option.marketBonus +
            ' · ' + (option.marketDaysRemaining > 0 ? 'market +' + option.marketDaysRemaining + 'd' : 'market ready') +
            ' · ' + (option.reputationReady ? 'rep ready' : 'rep gate +' + option.reputationGap + ' pts')) +
        ' · ' + (option.kind === 'shop' ? 'income/day ' + incomeBreakdownText(option.kind, option.dailyRent, option.variableRevenue, option.dailyIncome, option.potentialVariableRevenue, option.deliveryFactor) : 'rent/day ' + money(option.dailyIncome)) + ' (' + (option.dailyIncomeDelta >= 0 ? '+' : '-') +
        money(Math.abs(option.dailyIncomeDelta)) + ')' +
        ' · $' + option.cost.toLocaleString() + ' · ' + (option.affordable ? 'affordable' : 'save first') + ' · ' + option.detail).join(' | ') + '</div>'
    : '';
  const renovationArmed = !unit.occupied && renovationTargetId === unit.id;
  const rerentArmed = !unit.occupied && rerentTargetId === unit.id;
  const demolitionArmed = !unit.occupied && demolitionTargetId === unit.id;
  const confirmationArmed = renovationArmed || rerentArmed || demolitionArmed || Boolean(conversionTargetKind);
  const renovationOption = recoveryComparison?.options.find((option) => option.key === 'renovate');
  const rerentOption = recoveryComparison?.options.find((option) => option.key === 'rerent');
  const vacancyPreFillConfirmationLinesState = vacancyPreFillConfirmationLines(vacancyPreFill);
  const confirmationText = renovationArmed
    ? 'Confirm renovation: $' + renovationCost.toLocaleString() + ' · evaluation ' + evaluation.score + ' → ' + renovationOption?.projectedEvaluation + ' · income after lease ' + incomeBreakdownText(unit.kind, renovationOption?.dailyRent ?? 0, renovationOption?.variableRevenue ?? 0, renovationOption?.dailyIncome ?? 0, renovationOption?.potentialVariableRevenue ?? 0, renovationOption?.deliveryFactor) + ' · room stays vacant until gates clear.'
    : rerentArmed
      ? ['CONFIRM RE-RENT',
        'cost: $' + cost.toLocaleString(),
        'income: ' + incomeBreakdownText(unit.kind, rerentOption?.dailyRent ?? 0, rerentOption?.variableRevenue ?? 0, rerentOption?.dailyIncome ?? 0, rerentOption?.potentialVariableRevenue ?? 0, rerentOption?.deliveryFactor),
        ...vacancyPreFillConfirmationLinesState,
        'stress: resets to 0',
      ].join('\n')
      : demolitionArmed
        ? 'Confirm demolition: $' + demolitionCost.toLocaleString() + ' · permanent removal · removes ' + incomeBreakdownText(unit.kind, 0, 0, 0) + ' future income (currently ' + money((recoveryComparison?.options.find((option) => option.key === 'demolish')?.dailyIncomeDelta ?? 0) * -1) + '/day potential) · frees F' + unit.floor + ' slot ' + unit.slot + ' for a new room.'
        : '';
  const confirmationOutcomeText = !confirmationText && lastConfirmationOutcome ? lastConfirmationOutcome : '';
  const inspectorTenantLoadLabel = 'T ' + load.tenants + '/' + load.capacity + ' tenants/capacity; ' + load.label + '; ' + tenantLoadColorMeaning(load.key);
  els['unit-title'].textContent = 'F' + unit.floor + ' ' + unit.kind.toUpperCase();
  els['unit-status'].style.color = unit.occupied ? INFO : BAD;
  els['unit-status'].textContent = unit.occupied
    ? 'OCCUPIED · T ' + load.tenants + '/' + load.capacity + ' · ' + load.label + ' · read-only'
    : 'ABANDONED · ' + status.label + ' · vacant ' + unit.vacantDays + ' day' + (unit.vacantDays === 1 ? '' : 's') +
      (unit.renovated ? ' · RENOVATED' : '');
  els['unit-status'].title = unit.occupied
    ? inspectorTenantLoadLabel
    : 'abandoned room; tenant load is not active';
  els['unit-status'].setAttribute('aria-label', unit.occupied
    ? 'occupied; ' + inspectorTenantLoadLabel + '; read-only'
    : 'abandoned room; tenant load is not active');
  els['unit-detail'].textContent = 'evaluation ' + evaluation.score + '/100 · stress ' + evaluation.stress +
    ' · appeal pressure ' + Number((Number(unit.desirabilityPressure) || 0).toFixed(1)) + '/' + retention.vacateAt +
    (retentionRecommendation && retentionRecommendation.key !== 'monitor' ? ' · next: ' + retentionRecommendation.label : '') +
    ' · fit -' + evaluation.preferencePenalty + ' (prefers F' + evaluation.preferredFloor + ')' +
    ' · layout +' + evaluation.layoutBonus + ' · view +' + evaluation.viewBonus + ' · amenity +' + evaluation.amenityBonus +
    ' · market +' + marketDemandBonus(state, unit, CONFIG) + ' · quality +' + demandQuality.bonus +
    ' (' + demandQuality.label + ') · rent $' + evaluation.rent + '/day';
  const utilizationContext = tenantUtilizationRoomContext(unit, evaluation, tenantLoadSummary(state, CONFIG), tenantUtilizationTrend(tenantUtilizationHistory), CONFIG);
  const utilizationRecoveryAction = canRerent
    ? ' <button class="inspect-vacancy" data-utilization-rerent>re-rent now · $' + cost.toLocaleString() + '</button>'
    : '';
  els['unit-utilization-context'].innerHTML = 'why this matters: ' + utilizationContext.detail + utilizationRecoveryAction;
  if (vacancyDemand) {
    els['unit-utilization-context'].innerHTML += '<br>tenant demand: ' + vacancyDemand.detail;
    els['unit-utilization-context'].innerHTML += vacancyTransportAccessCue;
  }
  els['unit-utilization-context'].innerHTML += occupiedTransportAccessCue;
  els['unit-utilization-context'].innerHTML += condoTransportCue;
  els['unit-utilization-context'].innerHTML += condoServiceStatusCue;
  els['unit-utilization-context'].innerHTML += roomAppealFollowupCue;
  // `tenantRetentionRecommendation` answers null for a room with no tenant to
  // retain, and `null?.key !== 'monitor'` is TRUE — so the optional chain let a
  // null through to `.detail` and selecting any VACANT room threw, taking the
  // whole refresh loop with it. The guard is on the object, not on its key.
  if (retentionRecommendation && retentionRecommendation.key !== 'monitor') {
    els['unit-utilization-context'].innerHTML += '<br>retention recommendation: ' + retentionRecommendation.detail;
  }
  els['unit-utilization-context'].innerHTML += focusedServiceRoomCue;
  els['unit-utilization-context'].innerHTML += selectedServiceOutcomeCue;
  els['unit-utilization-context'].innerHTML += serviceStatusTrendCue;
  els['unit-utilization-context'].innerHTML += serviceStatusHistoryCue;
  els['unit-utilization-context'].style.color = utilizationContext.key === 'at_risk' || utilizationContext.key === 'vacant' ? WARN : GOOD;
  els['conversion-controls'].innerHTML = unit.occupied
    ? '<div class="diag-sub conversion-hint">Occupied room — this is a read-only tenant-mix inspection.</div>'
    : targetKinds.length
    ? recoveryComparisonText + '<div class="diag-sub conversion-hint">convert this room to:</div>' +
      conversionPreviewText +
      '<div class="conversion-options">' + targetKinds.map((kind) =>
        '<button class="convert-option" data-convert-kind="' + kind + '"' +
        (state.money < conversionCost ? ' disabled' : '') +
        ' title="' + (conversionTargetKind === kind ? 'Confirm conversion to ' : 'Preview conversion to ') + kind + '">' +
        (conversionTargetKind === kind ? 'confirm ' : '') + kind + ' · $' + conversionCost.toLocaleString() + '</button>'
      ).join('') + '</div>'
    : recoveryComparisonText + '<div class="diag-sub conversion-hint">No alternate tenant types unlocked yet.</div>';
  els['renovate-unit'].textContent = unit.occupied ? 'occupied' : unit.renovated ? 'renovated' : renovationArmed ? 'confirm renovate · $' + renovationCost.toLocaleString() : 'renovate · $' + renovationCost.toLocaleString();
  els['renovate-unit'].disabled = !canRenovate;
  els['renovate-unit'].title = unit.occupied
    ? 'Occupied room is read-only'
    : unit.renovated
    ? 'This room has already been renovated'
    : state.money < renovationCost ? 'Need more money to renovate' : renovationArmed ? 'Confirm: add +' + CONFIG.evaluation.renovationBonus + ' evaluation; room remains vacant.' : 'Preview renovation outcome before paying $' + renovationCost.toLocaleString();
  els['rerent-unit'].textContent = unit.occupied ? 'occupied' : rerentArmed ? 'confirm re-rent · $' + cost.toLocaleString() : 're-rent · $' + cost.toLocaleString();
  els['rerent-unit'].disabled = !canRerent;
  els['rerent-unit'].title = unit.occupied
    ? 'Occupied room is read-only'
    : evaluation.score < CONFIG.evaluation.relistMinScore
    ? 'Raise room evaluation to ' + CONFIG.evaluation.relistMinScore + ' first'
    : state.money < cost ? 'Not enough money' : rerentArmed ? 'Confirm: fill the room now and reset tenant stress.' : 'Preview re-rent outcome before paying $' + cost.toLocaleString();
  const canDemolish = state.money >= demolitionCost;
  els['demolish-unit'].textContent = unit.occupied ? 'occupied' : demolitionArmed
    ? 'confirm demolition · $' + demolitionCost.toLocaleString()
    : 'demolish · $' + demolitionCost.toLocaleString();
  els['demolish-unit'].disabled = unit.occupied || (!demolitionArmed && !canDemolish);
  els['demolish-unit'].title = unit.occupied
    ? 'Occupied room is read-only'
    : demolitionArmed
    ? 'Click again to permanently remove this room'
    : canDemolish ? 'Arm permanent demolition' : 'Need more money to demolish';
  els['cancel-confirmation'].hidden = !confirmationArmed;
  els['cancel-confirmation'].disabled = !confirmationArmed;
  els['cancel-confirmation'].title = confirmationArmed ? 'Clear this preview without changing the room' : 'No pending preview to cancel';
  els['recovery-warning'].classList.toggle('open', Boolean(confirmationText || confirmationOutcomeText));
  els['recovery-warning'].classList.toggle('outcome', Boolean(confirmationOutcomeText));
  els['recovery-warning'].textContent = confirmationText || confirmationOutcomeText;
  els['rerent-reason'].textContent = unit.occupied
    ? 'Occupied rooms cannot be changed here; inspect a vacant room to renovate, convert, re-rent, or demolish it.'
    : canRerent
      ? (unit.renovated ? 'Renovated room is ready for a paid replacement tenant.' : 'Room is ready; renovate first for +' + CONFIG.evaluation.renovationBonus + ' evaluation, or re-rent now.')
    : evaluation.score < CONFIG.evaluation.relistMinScore
      ? (unit.renovated
        ? 'Renovation is complete. Improve access, services, rent, or noise until evaluation reaches ' + CONFIG.evaluation.relistMinScore + '.'
        : 'Renovation adds +' + CONFIG.evaluation.renovationBonus + ' evaluation; re-rent requires ' + CONFIG.evaluation.relistMinScore + '.')
      : status.key === 'market_delay'
        ? 'New vacancies spend ' + status.minDays + ' full day' + (status.minDays === 1 ? '' : 's') + ' on the market before a replacement tenant can arrive (base ' + baseRelistDays + '; reputation adjusts this).'
        : status.key === 'reputation'
          ? 'Building reputation must reach ' + CONFIG.occupancy.relistMinDeliveryRate + '% before replacement tenants return.'
          : 'Need $' + cost.toLocaleString() + ' to re-rent this room.';
  // The same one line the HUD bar shows on hover, kept at the top of the
  // selected room (issue #11) — the room panel is where a player has come to
  // fix something, so the cause and the action belong above the controls.
  const why = appealWhyLine(unit);
  els['unit-appeal-why'].hidden = !why;
  els['unit-appeal-why'].textContent = why ? why.text : '';
  els['unit-appeal-why'].style.color = why ? why.color : '';
  els['unit-appeal-why'].title = why?.title ?? '';
  els['unit-inspector'].classList.add('open');
}

/**
 * Unaffordable and locked are visible STATES on a palette tile, never missing
 * ones: the tile keeps its place, and says what is standing in the way.
 */
function setTileState(button, { locked = false, cost = null, blocked = false } = {}) {
  const short = !locked && Number.isFinite(cost) ? Math.max(0, cost - state.money) : 0;
  button.classList.toggle('locked', locked);
  button.classList.toggle('unaffordable', short > 0);
  button.classList.toggle('blocked', !locked && short <= 0 && Boolean(blocked));
  const label = button.querySelector('.btn-cost');
  if (label && short > 0) label.textContent = money(cost) + ' · ' + money(short) + ' short';
}

function refresh() {
  const d = state.log[state.log.length - 1];
  updateTimeControls();
  renderFirstSessionPath();
  const recommendation = reputationRecommendation(state, CONFIG);
  const transportResponse = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
  const placementPreview = placementWarning && !placementWarning.full
    ? tenantPlacementFloorComparison(state, placementWarning.kind, placementWarning.floor, CONFIG)
    : null;
  const placementInvestment = placementPreview?.available
    ? tenantPlacementSmallestInvestment(placementPreview, state, CONFIG)
    : null;
  els['placement-guide-legend'].hidden = !placementGuideTarget();
  const tenantForecast = tenantDemandForecast(state, CONFIG, d?.rep);
  const tenantSummary = tenantLoadSummary(state, CONFIG);
  const tenantLoadColor = indicatorPaletteColor(indicatorColorKey(tenantSummary.key));
  const tenantHeadlineLabel = 'T ' + tenantSummary.tenants + '/' + tenantSummary.capacity + ' tenants/capacity; ' + tenantSummary.label + '; ' + tenantLoadColorMeaning(tenantSummary.key);
  const utilizationChange = tenantUtilizationChange ?? { key: 'unknown', label: 'no prior day' };
  const utilizationTrend = tenantUtilizationTrend(tenantUtilizationHistory);
  const recoverySummary = tenantUtilizationRecoverySummary(tenantUtilizationHistory, state.day);
  const nextTier = CONFIG.stars.tiers.find((tier) => tier.pop > population(state));
  const milestone = nextTier
    ? nextTier.name + ' at ' + nextTier.pop + ' population · ' + (nextTier.pop - population(state)) + ' to go' +
      (nextTier.reward ? ' · reward ' + money(nextTier.reward) : '')
    : 'All star milestones reached.';
  const evalScore = averageEvaluation(state, CONFIG);
  const desirability = towerDesirabilitySummary(state, CONFIG);
  const desirabilityTrend = towerDesirabilityTrend(towerDesirabilityHistory(state));
  const desirabilityDelta = towerDesirabilityTrendDeltaLabel(desirabilityTrend);
  // Hover wins over selection: the cursor is the question being asked right
  // now, and a stale selected room would answer a different one.
  const whyUnit = state.units.find((u) => u.id === hoverUnitId)
    ?? state.units.find((u) => u.id === selectedUnitId)
    ?? null;
  const appealWhy = appealWhyLine(whyUnit);
  const weekPattern = weekLossPattern();

  setHud({
    money: { text: '$' + Math.round(state.money).toLocaleString(), color: state.money < 2000 ? BAD : GOOD },
    day: String(state.day),
    population: String(population(state)),
    tenantTotal: {
      text: 'T ' + tenantSummary.tenants + '/' + tenantSummary.capacity,
      color: tenantLoadColor,
      title: tenantHeadlineLabel,
      ariaLabel: tenantHeadlineLabel,
    },
    tenantUtilization: {
      text: Math.round(tenantSummary.ratio * 100) + '%',
      color: tenantLoadColor,
      title: 'occupied tenants ÷ built room capacity',
    },
    tenantUtilizationChange: {
      text: utilizationChange.key === 'unknown' ? 'Δ —' : utilizationChange.label,
      color: utilizationChange.key === 'improved' ? GOOD : utilizationChange.key === 'worsened' ? BAD : WARN,
      title: 'change in utilization since the previous day close',
    },
    tenantUtilizationTrendHtml: utilizationTrend.segments?.length
      ? 'trend ' + utilizationTrend.segments.map((segment) => segment.event === 'recovery'
        ? '<span class="recovery-reading" title="re-rent recovery">' + segment.bar + '</span>'
        : segment.bar).join('')
      : utilizationTrend.label,
    tenantUtilizationTrendColor: utilizationTrend.key === 'improved' ? GOOD
      : utilizationTrend.key === 'worsened' ? BAD : WARN,
    tenantUtilizationRecovery: {
      text: recoverySummary.label,
      color: recoverySummary.key === 'improved' ? GOOD
        : recoverySummary.key === 'worsened' ? BAD
          : recoverySummary.key === 'steady' ? WARN : '#6b8199',
      title: recoverySummary.key === 'none'
        ? 'no re-rent recovery yet'
        : 'latest re-rent recovery' + (recoverySummary.ageDays > 0 ? ' · ' + recoverySummary.ageDays + ' day' + (recoverySummary.ageDays === 1 ? '' : 's') + ' ago' : '') +
          (recoverySummary.utilizationChange == null ? ''
            : ' · ' + (recoverySummary.utilizationChange >= 0 ? '+' : '') + recoverySummary.utilizationChange + ' utilization points'),
    },
    star: starTier(state, CONFIG).name,
    milestone,
    wait: {
      text: d ? d.avgWait + 's' : '—',
      color: d && d.avgWait > CONFIG.units.office.patience ? BAD : GOOD,
      title: 'historical average from the most recently closed day; waiting now is the live queue count',
    },
    rate: { text: d ? d.deliveryRate + '%' : '—', color: d && d.deliveryRate < 70 ? BAD : GOOD },
    rep: { text: d ? d.rep + '%' : '—', color: d && d.rep < CONFIG.occupancy.relistMinDeliveryRate ? BAD : GOOD },
    roomEval: {
      text: state.units.some((u) => u.occupied) ? evalScore + '%' : '—',
      color: evalScore < CONFIG.evaluation.relistMinScore ? BAD : evalScore < 80 ? WARN : GOOD,
    },
    desirability: {
      text: desirability.score == null ? '—' : desirability.score + '%',
      color: desirability.colorKey === 'good' ? GOOD : desirability.colorKey === 'bad' ? BAD : WARN,
      title: desirability.detail,
      ariaLabel: desirability.score == null
        ? 'tower desirability unavailable; ' + desirability.detail
        : 'tower desirability ' + desirability.score + ' out of 100; ' + desirability.detail,
    },
    desirabilityTrend: {
      text: desirabilityTrend.label + ' · ' + desirabilityDelta,
      color: desirabilityTrend.key === 'improved' ? GOOD : desirabilityTrend.key === 'worsened' ? BAD : WARN,
      title: 'daily tower desirability, oldest to newest; ' + desirabilityDelta + '; history begins after day close',
    },
    // An empty string is the absent state for both: a line that always shows a
    // dash is a line the eye learns to skip.
    appealWhy: appealWhy ?? { text: '', color: '#dbe4ee', title: '' },
    weekPattern: weekPattern ?? { text: '', color: '#dbe4ee', title: '' },
  });
  els['goal-copy'].textContent = d
    ? 'Keep delivery above ' + CONFIG.occupancy.relistMinDeliveryRate + '% · current ' + d.deliveryRate + '%.'
    : 'Keep delivery above ' + CONFIG.occupancy.relistMinDeliveryRate + '% so tenants stay.';
  const level = state.rentLevels?.[rentKind] ?? state.units.find((u) => u.kind === rentKind)?.rentLevel ?? 0;
  els['rent-kind'].textContent = rentKind.toUpperCase() + ' · ' + (level > 0 ? '+' : '') + level;
  els['rent-value'].textContent = '$' + rentForLevel(CONFIG, rentKind, level).toLocaleString() + ' / day';
  const rentValue = rentForLevel(CONFIG, rentKind, level);
  const rentButtons = els['rent-control'].querySelectorAll('button[data-rent-step]');
  for (const b of rentButtons) {
    const next = clampRentLevel(level + Number(b.dataset.rentStep), CONFIG);
    b.disabled = next === level;
  }
  if (developerMode) renderTransport();
  renderShaftInspector();
  renderFacilityInspector();
  renderInspector();
  renderInvestmentPreview();
  if (developerMode) renderExpansionSafety();

  const costs = {
    dig: money(CONFIG.underground.digCost),
    shaft: money(CONFIG.costs.shaft) + ' + span',
    express: money(CONFIG.costs.expressShaft) + ' + span',
    car: money(CONFIG.costs.car),
    extend: money(CONFIG.costs.shaftPerFloor) + ' / floor',
    food: money(CONFIG.costs.food),
    parking: money(CONFIG.costs.parking),
    medical: money(CONFIG.costs.medical),
    security: money(CONFIG.costs.security),
    recycling: money(CONFIG.costs.recycling),
    renovation: money(CONFIG.costs.renovation),
    lobby: money(CONFIG.costs.lobby),
    stairs: money(CONFIG.costs.stairs) + ' + floor',
    escalator: money(CONFIG.costs.escalator) + ' + floor',
    lobbyExpansion: money(CONFIG.costs.lobbyExpansion),
    demolish: money(CONFIG.costs.demolition),
  };
  // Numeric twins of the labels above, so a tile can say how far short it is.
  const groundFloor = CONFIG.building.lobbyFloor ?? 0;
  const lobbyTileCost = state.lobby ? CONFIG.costs.lobbyExpansion : CONFIG.costs.lobby;
  const tileCosts = {
    dig: CONFIG.underground.digCost,
    lobby: lobbyTileCost,
    shaft: CONFIG.costs.shaft,
    express: CONFIG.costs.expressShaft,
    car: CONFIG.costs.car,
    extend: CONFIG.costs.shaftPerFloor,
    stairs: CONFIG.costs.stairs,
    escalator: CONFIG.costs.escalator,
    demolish: CONFIG.costs.demolition,
  };
  const recommendedControl = transportResponse.key !== 'monitor' && transportResponse.control
    ? transportResponse.control
    : recommendation.control;
  for (const b of els.build.querySelectorAll('button[data-do]')) {
    const cost = b.querySelector('.btn-cost');
    if (cost) cost.textContent = costs[b.dataset.do] || '';
    b.classList.toggle('sel', b.dataset.do === tool);
    b.classList.toggle('recommended', b.dataset.do === recommendedControl);
    b.classList.toggle('placement-recommended', b.dataset.do === placementInvestment?.kind);
    if (b.dataset.do === 'lobby') {
      const built = Boolean(state.lobby);
      const buildCost = lobbyTileCost;
      // The lot is free, so the tile is just the entrance's price — no slab
      // line item any more (Keith's call, 2026-09-01).
      const onBareGround = !built && state.floors <= groundFloor;
      b.disabled = state.money < buildCost;
      b.title = built
        ? state.money < buildCost ? 'not enough money' : 'add another lobby entrance'
        : state.money < buildCost ? 'not enough money'
          : onBareGround ? 'place the entrance — the ground it stands on is free' : 'place the ground-floor entrance';
      const label = b.querySelector('.btn-label');
      if (label) label.textContent = built ? 'lobby wing' : 'lobby';
      if (cost) cost.textContent = money(buildCost);
    }
    if (b.dataset.do === 'stairs') {
      b.disabled = !state.lobby || state.money < CONFIG.costs.stairs;
      b.title = !state.lobby ? 'build a lobby first' : state.money < CONFIG.costs.stairs ? 'not enough money' : 'place a stairwell from the lobby';
    }
    if (b.dataset.do === 'escalator') {
      b.disabled = !state.lobby || state.money < CONFIG.costs.escalator;
      b.title = !state.lobby ? 'build a lobby first' : state.money < CONFIG.costs.escalator ? 'not enough money' : 'place an escalator from the lobby';
    }
    if (b.dataset.do === 'dig') {
      const atMax = basementDepth(state) >= CONFIG.underground.maxDepth;
      b.disabled = atMax || state.money < CONFIG.underground.digCost;
      b.title = atMax ? 'at max depth (B' + CONFIG.underground.maxDepth + ')'
        : state.money < CONFIG.underground.digCost ? 'not enough money' : 'sink one storey below ground';
    }
    if (b.dataset.do === 'demolish') {
      const clearable = state.units.some((unit) => !unit.occupied);
      b.disabled = !clearable || state.money < CONFIG.costs.demolition;
      b.title = state.money < CONFIG.costs.demolition ? 'not enough money'
        : !clearable ? 'nothing to clear — an occupied room cannot be demolished'
          : 'clear a vacant room and free its slot';
    }
    if (b.dataset.do === 'shaft') {
      const shaftControl = shaftBuildControlStatus(state, CONFIG);
      b.disabled = shaftControl.disabled || state.money < CONFIG.costs.shaft;
      b.title = state.money < CONFIG.costs.shaft
        ? 'not enough money for the base shaft cost'
        : shaftControl.cost != null && state.money < shaftControl.cost
          ? 'not enough money for the selected shaft span; need ' + money(shaftControl.cost) + ', have ' + money(state.money)
          : shaftControl.detail;
    }
    if (b.dataset.do === 'car') {
      const carSlotAvailable = state.shafts.some((shaft) => shaft.cars.length < CONFIG.elevator.maxCarsPerShaft);
      b.disabled = !state.shafts.length || !carSlotAvailable || state.money < CONFIG.costs.car;
      b.title = !state.shafts.length ? 'build a shaft first'
        : !carSlotAvailable ? 'every shaft is at its ' + CONFIG.elevator.maxCarsPerShaft + '-car limit; build a new shaft'
          : state.money < CONFIG.costs.car ? 'not enough money' : 'add a car to a shaft';
    }
    if (b.dataset.do === 'express') {
      b.disabled = !state.lobby || state.money < CONFIG.costs.expressShaft;
      b.title = !state.lobby ? 'build a lobby first'
        : state.money < CONFIG.costs.expressShaft ? 'not enough money for the base express cost'
          : 'nonstop shuttle: lobby to a sky-lobby floor, skipping everything between';
    }
    if (b.dataset.do === 'extend') b.title = !state.shafts.length ? 'build a shaft first' : 'extend the most recently built shaft';
    if (b.dataset.do === recommendedControl) b.title = 'Recommended: ' + b.title;
    if (b.dataset.do === placementInvestment?.kind) b.title = 'Suggested for F' + placementWarning.floor + ': ' + b.title;
    setTileState(b, { cost: tileCosts[b.dataset.do] ?? null, blocked: b.disabled });
  }

  for (const b of els.build.querySelectorAll('button[data-facility]')) {
    const kind = b.dataset.facility;
    const facilityCost = CONFIG.costs[kind];
    const dailyUpkeep = CONFIG.services[kind]?.dailyUpkeep ?? 0;
    const facilityCostLabel = money(facilityCost) + (dailyUpkeep ? ' + ' + money(dailyUpkeep) + '/day' : '');
    const locked = !unlocked(state, CONFIG, kind);
    b.disabled = locked || state.money < facilityCost;
    b.classList.toggle('sel', tool === kind);
    b.classList.toggle('placement-recommended', kind === placementInvestment?.kind);
    const tier = CONFIG.stars.tiers.find((t) => t.unlocks.includes(kind) && t.pop > 0);
    const cost = b.querySelector('.btn-cost');
    if (cost) cost.textContent = locked ? 'unlock at ' + (tier?.pop || '?') + ' pop' : facilityCostLabel;
    b.title = locked ? kind + ' unlocks at ' + (tier?.pop || '?') + ' population' : 'upfront ' + money(facilityCost) + (dailyUpkeep ? ' · daily upkeep ' + money(dailyUpkeep) : '');
    if (kind === placementInvestment?.kind) b.title = 'Suggested for F' + placementWarning.floor + ': ' + b.title;
    setTileState(b, { locked, cost: facilityCost });
  }

  for (const b of els.build.querySelectorAll('button[data-kind]')) {
    const kind = b.dataset.kind;
    const locked = !unlocked(state, CONFIG, kind);
    b.disabled = locked || state.money < CONFIG.costs[kind];
    b.classList.toggle('sel', tool === kind);
    b.classList.toggle('forecasted', kind === tenantForecast.nextKind);
    const tier = CONFIG.stars.tiers.find((t) => t.unlocks.includes(kind) && t.pop > 0);
    const cost = b.querySelector('.btn-cost');
    if (cost) cost.textContent = locked ? 'unlock at ' + (tier?.pop || '?') + ' pop' : money(CONFIG.costs[kind]);
    b.title = locked ? kind + ' unlocks at ' + (tier?.pop || '?') + ' population' : money(CONFIG.costs[kind]);
    setTileState(b, { locked, cost: CONFIG.costs[kind] });
  }
  els['cancel-tool'].hidden = tool === 'observe';
  updateQuickAction(recommendation, transportResponse);
  setMode(undefined, placementWarning ? WARN : GOOD);
  updateGhost();
}

let lastClockAt = -Infinity;
function drawClock(now) {
  if (now - lastClockAt < 100) {
    requestAnimationFrame(drawClock);
    return;
  }
  lastClockAt = now;
  const h = Math.floor(state.tod * 24), m = Math.floor((state.tod * 24 % 1) * 60);
  const rush = inWindow(CONFIG.time.morningRush) ? 'MORNING RUSH'
    : inWindow(CONFIG.time.lunch) ? 'LUNCH'
    : inWindow(CONFIG.time.eveningRush) ? 'EVENING RUSH' : '';
  // The clock is part of the HUD bar now, beside the day (issue #13), rather
  // than floating over the tower. It keeps its own rAF loop because it ticks
  // ten times a second and refresh() does not.
  setHud({ clock: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'), rush });
  requestAnimationFrame(drawClock);
}
const inWindow = ([a, b]) => state.tod >= a && state.tod <= b;

let toastT = null;
function toast(msg, color) {
  els.log.textContent = msg;
  els.log.style.color = color || INFO;
  clearTimeout(toastT);
  toastT = setTimeout(() => { els.log.textContent = ''; }, 2600);
}

function firstSessionPath() {
  const history = state.log ?? [];
  const carRecommendation = shaftQueueReliefRecommendation(state, CONFIG, carQueueDailyHistory);
  const recommendedCarShaft = carRecommendation.best
    ? 'S' + (carRecommendation.best.shaftIndex + 1)
    : null;
  const shaftCostDetail = money(CONFIG.costs.shaft) + ' base + ' + money(CONFIG.costs.shaftPerFloor) + '/floor · starts with 1 car / ' + CONFIG.elevator.capacity + ' riders per dispatch';
  const officeCostDetail = money(CONFIG.costs.office) + ' each · ' + CONFIG.units.office.workers + ' tenants each';
  const carCostDetail = money(CONFIG.costs.car) + ' · +' + CONFIG.elevator.capacity + ' riders per dispatch';
  const hasLobby = Boolean(state.lobby);
  const hasLobbyShaft = state.shafts.some((shaft) => shaft.bottom === 0 && shaft.top > shaft.bottom);
  const officeCount = state.units.filter((unit) => unit.kind === 'office').length;
  const hasSecondCar = state.shafts.some((shaft) => shaft.cars.length >= 2);
  // A session opens on bare ground. The lot is free — the lobby buys the
  // entrance and the ground storey comes with it — and there is no floor tool
  // any more: each office raises the storey it stands on and pays for it.
  // So the path is lobby, three offices (which build the tower), then a shaft
  // tall enough to span them.
  const groundFloor = CONFIG.building.lobbyFloor ?? 0;
  const OPENING_OFFICES = 3;
  const openingShaftSpan = OPENING_OFFICES + 1;
  const openingShaftCost = CONFIG.costs.shaft + CONFIG.costs.shaftPerFloor * openingShaftSpan;
  const lobbyStepCost = CONFIG.costs.lobby;
  // An office above the roof carries its slab, so it costs both.
  const officeStepUnit = CONFIG.costs.office + CONFIG.costs.floor;
  const officeStepCost = Math.max(0, OPENING_OFFICES - officeCount) * officeStepUnit;
  const fullPathCost = lobbyStepCost + officeStepUnit * OPENING_OFFICES +
    openingShaftCost + CONFIG.costs.car;
  const remainingPathCost = (hasLobby ? 0 : lobbyStepCost) +
    officeStepCost +
    (hasLobbyShaft ? 0 : openingShaftCost) +
    (hasSecondCar ? 0 : CONFIG.costs.car);
  const budgetBuffer = state.money - remainingPathCost;
  const liveWarningState = firstSessionPressureWarning(state, CONFIG, recommendedCarShaft);
  const liveWarning = liveWarningState.detail || null;
  if (liveWarningState.active && !hasSecondCar && !firstSessionLivePressure) {
    firstSessionLivePressure = {
      day: state.day,
      waiting: liveWarningState.waiting,
      stressedUnits: liveWarningState.stressedUnits,
      occupied: state.units.filter((unit) => unit.occupied).length,
      vacant: state.units.filter((unit) => !unit.occupied).length,
    };
  }
  const recoveryEvidence = firstSessionRecoveryEvidence(history, firstSessionLivePressure, CONFIG);
  const { pressure, recoveryEntry } = recoveryEvidence;
  const recovery = recoveryEvidence.recovered;
  const recoveryReadings = firstSessionRecoveryReadings(state, CONFIG, history);
  const recoveryWatch = hasSecondCar && !recovery ? recoveryReadings.detail : null;
  const steps = [
    { label: 'build a lobby entrance', detail: money(lobbyStepCost) + ' · the ground it stands on is free', cost: hasLobby ? 0 : lobbyStepCost, done: hasLobby },
    { label: 'stack three offices above it', detail: money(officeStepUnit) + ' each · a room brings its own storey', cost: officeStepCost, done: officeCount >= OPENING_OFFICES },
    { label: 'build a shaft from the lobby upward', detail: shaftCostDetail, cost: hasLobbyShaft ? 0 : openingShaftCost, done: hasLobbyShaft },
    { label: 'observe an elevator pressure reading', cost: 0, done: recoveryEvidence.observed },
    { label: recommendedCarShaft ? 'select + car, then click ' + recommendedCarShaft : 'select + car, then click the pressured shaft', detail: carCostDetail, cost: hasSecondCar ? 0 : CONFIG.costs.car, done: hasSecondCar },
    { label: 'see delivery and reputation recover', cost: 0, done: recovery },
  ];
  const completed = steps.filter((step) => step.done).length;
  const passed = completed === steps.length;
  const next = steps.find((step) => !step.done)?.label ?? 'first session passed — keep tuning the tower';
  const playerNext = !liveWarningState.active && next === 'observe an elevator pressure reading'
    ? 'let the next rush run and watch W waiting'
    : !liveWarningState.active && !hasSecondCar && next.startsWith('select + car')
      ? 'let the next rush run; add a car when W turns amber or red'
      : next;
  const evidence = pressure && recoveryEntry
    ? recoveryEvidence.source === 'live-warning'
      ? 'live warning W ' + pressure.waiting + ' → D' + recoveryEntry.day + ' delivery ' + Math.round(recoveryEntry.deliveryRate) + '% · occupied ' + pressure.occupied + ' → ' + recoveryEntry.occupied + ' · reputation ' + Math.round(recoveryEntry.rep) + '% · desirability ' + recoveryEntry.desirability
      : 'delivery ' + Math.round(pressure.deliveryRate) + '% → ' + Math.round(recoveryEntry.deliveryRate) + '% · occupied ' + pressure.occupied + ' → ' + recoveryEntry.occupied + ' · vacant ' + pressure.vacant + ' → ' + recoveryEntry.vacant + ' · reputation ' + Math.round(pressure.rep) + '% → ' + Math.round(recoveryEntry.rep) + '% · desirability ' + pressure.desirability + ' → ' + recoveryEntry.desirability
    : null;
  return { steps, completed, passed, next: playerNext, evidence, recoveryWatch, liveWarning, liveWarningAction: liveWarningState.active && liveWarningState.affordable ? liveWarningState.target : null, budget: { opening: CONFIG.economy.startMoney, fullPathCost, remainingPathCost, available: state.money, buffer: budgetBuffer } };
}

function renderFirstSessionPath() {
  const path = firstSessionPath();
  const nextStep = path.steps.find((step) => !step.done);
  const budget = path.budget;
  const bufferText = budget.buffer >= 0 ? 'buffer ' + money(budget.buffer) : 'shortfall ' + money(Math.abs(budget.buffer));
  const budgetClass = budget.buffer >= 0 ? 'diag-good' : 'diag-bad';
  const liveWarningText = path.liveWarning
    ? '<div class="beta-path-warning">' + path.liveWarning + (path.liveWarningAction
      ? ' <button type="button" class="beta-path-action" data-beta-car-action>select + car for ' + path.liveWarningAction + '</button>'
      : '') + '</div>'
    : '';
  const evidenceText = path.passed && path.evidence
    ? '<div class="beta-path-evidence">evidence: ' + path.evidence + '</div>'
    : '';
  const recoveryWatchText = path.recoveryWatch
    ? '<div class="beta-path-recovery">' + path.recoveryWatch + '</div>'
    : '';
  const checklist = '<details class="beta-path-details"><summary>show session checklist</summary>' +
    '<ol>' + path.steps.map((step) =>
      '<li class="beta-path-step ' + (step.done ? 'done' : step === nextStep ? 'next' : '') + '">' +
      (step.done ? '✓ ' : '○ ') + step.label + (step.detail ? ' <span class="beta-path-detail">· ' + step.detail + '</span>' : '') +
      ' <span class="beta-path-affordability ' + (step.done || step.cost === 0 || step.cost <= budget.available ? 'diag-good' : 'diag-bad') + '">' +
      (step.done ? 'completed' : step.cost === 0 ? 'no spend' : step.cost <= budget.available ? 'cost ' + money(step.cost) + ' · affordable now' : 'cost ' + money(step.cost) + ' · need ' + money(step.cost - budget.available) + ' more') +
      '</span></li>'
    ).join('') + '</ol>' +
    '<div class="beta-path-budget">budget: start ' + money(budget.opening) + ' · full path ' + money(budget.fullPathCost) + ' · remaining ' + money(budget.remainingPathCost) + ' · cash ' + money(budget.available) + ' · <span class="' + budgetClass + '">' + bufferText + '</span></div>' +
    recoveryWatchText + evidenceText + '</details>';
  els['beta-path'].innerHTML = '<div class="beta-path-summary' + (path.passed ? ' pass' : '') + '">' + path.completed + '/' + path.steps.length + ' complete' + (path.passed ? ' · SESSION COMPLETE' : '') + '</div>' +
    liveWarningText +
    '<div class="beta-path-next"><b>DO THIS NOW:</b> ' + path.next + '</div>' +
    checklist;
}

els['beta-path'].addEventListener('click', (event) => {
  if (!event.target.closest('[data-beta-car-action]')) return;
  const carButton = els.build.querySelector('button[data-do="car"]');
  if (!carButton || carButton.disabled) {
    toast('the car is not currently available', WARN);
    return;
  }
  carButton.click();
});

// ------------------------------------------------------------------- inputs
function selectServiceToolForUnit(kind, unitId, source) {
  const unit = state.units.find((candidate) => candidate.id === unitId && candidate.occupied);
  const buildButton = els.build.querySelector('button[data-facility="' + kind + '"]');
  if (!unit || !buildButton || buildButton.disabled) {
    toast('the ' + kind + ' service is not currently available', WARN);
    return false;
  }
  const placement = servicePlacementRecommendation(state, unit, kind, CONFIG);
  buildButton.click();
  investmentTarget = placement?.key === 'ready'
    ? { tool: kind, floor: unit.floor, recommendedFloor: placement.floor, recommendedDetail: placement.detail, roomKind: unit.kind, targetUnitId: unit.id }
    : null;
  selectedUnitId = unit.id;
  selectedFloor = unit.floor;
  floorDiagnosisBaseline = { ...floorOperationsSummary(state, selectedFloor, CONFIG), day: state.day, source };
  floorDiagnosisResult = null;
  floorDiagnosisResults.delete(selectedFloor);
  refresh();
  const targetDetail = ' · target F' + unit.floor + ' ' + unit.kind + ' (' + Math.max(0, Math.round(unit.heads ?? 0)) + ' tenants)';
  setMode(kind.toUpperCase() + ' selected from ' + source + targetDetail + ' — click a floor to place it.', WARN);
  toast(kind.toUpperCase() + ' selected from ' + source + targetDetail + ' — choose its floor', INFO);
  return true;
}

els.transport.addEventListener('click', (e) => {
  const responseAction = e.target.closest('button[data-transport-response-kind]');
  if (responseAction) {
    const kind = responseAction.dataset.transportResponseKind;
    const shaftId = Number(responseAction.dataset.transportResponseShaft);
    const floor = Number(responseAction.dataset.transportResponseFloor);
    if (kind === 'car' || kind === 'shaft') {
      selectRouteAlternative(kind, kind === 'car' && Number.isFinite(shaftId) ? shaftId : null,
        kind === 'shaft' && Number.isInteger(floor) ? floor : null);
      return;
    }
    if (kind === 'stairs' || kind === 'escalator') {
      tool = kind;
      recommendedShaftId = null;
      transportFocusTarget = Number.isInteger(floor) ? { kind, floor } : null;
      routeTarget = Number.isInteger(floor) ? { kind, floor, recommended: true } : null;
      setMode(kind.toUpperCase() + ' selected — click the top floor to place it.');
      toast(kind.toUpperCase() + ' selected — choose a clear column', INFO);
      refresh();
      return;
    }
  }
  const responseFilterButton = e.target.closest('button[data-shop-response-filter]');
  if (responseFilterButton) {
    const filter = responseFilterButton.dataset.shopResponseFilter;
    shopResponseFilterId = filter === 'all' ? null : Number(filter);
    refresh();
    const activeShop = state.units.find((unit) => unit.id === shopResponseFilterId && unit.kind === 'shop' && unit.occupied) ?? null;
    const activeHistory = shopDemandFollowupHistory.filter((followupEntry) =>
      activeShop == null || followupEntry.shopId === activeShop.id);
    setMode(shopResponseFilterId == null
      ? 'SHOP RESPONSE HISTORY → showing ' + shopTrafficFollowupFilterLabel(null, activeHistory) + '.'
      : 'SHOP RESPONSE HISTORY → showing ' + shopTrafficFollowupFilterLabel(activeShop, activeHistory) + '.');
    return;
  }
  const clearServiceFocusButton = e.target.closest('button[data-clear-service-focus]');
  if (clearServiceFocusButton) {
    serviceFocusTarget = null;
    refresh();
    setMode('SERVICE RESULT → area focus cleared · result history retained', INFO);
    toast('SERVICE RESULT → area focus cleared; history retained', INFO);
    return;
  }
  const serviceResultButton = e.target.closest('button[data-service-result-floor]');
  if (serviceResultButton) {
    const floor = Number(serviceResultButton.dataset.serviceResultFloor);
    if (!Number.isInteger(floor)) return;
    const radius = Number(serviceResultButton.dataset.serviceResultRadius);
    const changedFloors = (serviceResultButton.dataset.serviceResultChangedFloors ?? '')
      .split(',').map(Number).filter(Number.isInteger);
    const unitIds = (serviceResultButton.dataset.serviceResultUnits ?? '')
      .split(',').map(Number).filter(Number.isInteger);
    const facilityIdValue = serviceResultButton.dataset.serviceResultFacility ?? '';
    const facilityId = facilityIdValue === '' ? null : Number(facilityIdValue);
    const room = state.units.find((unit) => unit.occupied && unitIds.includes(unit.id)) ??
      state.units.find((unit) => unit.occupied && unit.floor === floor);
    serviceFocusTarget = {
      kind: serviceResultButton.dataset.serviceResultKind,
      floor,
      facilityId: Number.isInteger(facilityId) ? facilityId : null,
      coverageFloors: Number.isFinite(radius) ? radius : 0,
      changedFloors,
    };
    selectedFloor = floor;
    selectedUnitId = room?.id ?? null;
    floorDiagnosisBaseline = { ...floorOperationsSummary(state, selectedFloor, CONFIG), day: state.day, source: 'service-result' };
    floorDiagnosisResult = null;
    floorDiagnosisResults.delete(selectedFloor);
    floorHandoff = null;
    routeTarget = null;
    refresh();
    setMode('SERVICE RESULT → F' + floor + ' area highlighted' + (facilityId != null ? ' · facility outlined' : '') + (room ? ' · affected room opened' : ' · read the coverage area'), INFO);
    toast('SERVICE RESULT → coverage area highlighted', INFO);
    return;
  }
  const shopDiagnosisButton = e.target.closest('button[data-shop-diagnosis]');
  if (shopDiagnosisButton) {
    const diagnosis = shopDiagnosisButton.dataset.shopDiagnosis;
    const shopId = Number(shopDiagnosisButton.dataset.shopId);
    const floor = Number(shopDiagnosisButton.dataset.shopFloor);
    shopDiagnosisContext = {
      shopId: Number.isFinite(shopId) ? shopId : null,
      floor: Number.isFinite(floor) ? floor : null,
      diagnosis,
    };
    selectedFloor = Number.isFinite(floor) ? floor : null;
    floorDiagnosisBaseline = selectedFloor == null ? null
      : { ...floorOperationsSummary(state, selectedFloor, CONFIG), day: state.day, source: diagnosis };
    floorDiagnosisResult = null;
    if (diagnosis === 'transport') {
      const response = transportResponseRecommendation(state, CONFIG, carQueueDailyHistory, localRouteDailyHistory);
      if (state.shafts.length) {
        tool = 'car';
        recommendedShaftId = response.shaftId ?? state.shafts[0].id;
        routeTarget = { kind: 'car', shaftId: recommendedShaftId };
      } else {
        tool = 'shaft';
        recommendedShaftId = null;
        routeTarget = selectedFloor == null ? null : { kind: 'shaft', floor: selectedFloor };
      }
      refresh();
      setMode(state.shafts.length
        ? 'SHOP TRAFFIC → ELEVATORS focused — add capacity to the highlighted shaft or inspect its queue.'
        : 'SHOP TRAFFIC → ELEVATORS focused — select a shaft to restore delivery.');
      toast('SHOP TRAFFIC → elevator response focused', INFO);
    } else {
      tool = 'office';
      rentKind = 'office';
      recommendedShaftId = null;
      routeTarget = null;
      refresh();
      setMode('SHOP TRAFFIC → TENANT MIX focused — review nearby office supply before adding demand.');
      toast('SHOP TRAFFIC → tenant-mix response focused', INFO);
    }
    return;
  }
  const uncoveredServiceToolButton = e.target.closest('button[data-uncovered-service-tool]');
  const retentionToolButton = e.target.closest('button[data-retention-tool]');
  if (uncoveredServiceToolButton || retentionToolButton) {
    const kind = uncoveredServiceToolButton
      ? uncoveredServiceToolButton.dataset.uncoveredServiceTool
      : retentionToolButton.dataset.retentionTool;
    const unitId = Number(uncoveredServiceToolButton
      ? uncoveredServiceToolButton.dataset.uncoveredServiceUnit
      : retentionToolButton.dataset.retentionUnit);
    const source = uncoveredServiceToolButton ? 'uncovered service cue' : 'retention guidance';
    selectServiceToolForUnit(kind, unitId, source);
    return;
  }
  const floorAction = e.target.closest('button[data-floor-action]');
  if (floorAction) {
    const kind = floorAction.dataset.floorAction;
    const buildButton = els.build.querySelector('button[data-do="' + kind + '"]');
    if (!buildButton || buildButton.disabled) {
      toast('the ' + kind + ' control is not currently available', WARN);
      return;
    }
    buildButton.click();
    floorDiagnosisBaseline = { ...floorOperationsSummary(state, selectedFloor, CONFIG), day: state.day, source: kind };
    floorDiagnosisResult = null;
    floorDiagnosisResults.delete(selectedFloor);
    floorHandoff = { floor: selectedFloor, kind };
    routeTarget = kind === 'shaft'
      ? { kind, floor: selectedFloor }
      : { kind, shaftId: recommendedShaftId };
    refresh();
    toast(kind.toUpperCase() + ' selected from the floor diagnosis', INFO);
    return;
  }
  const missingRouteFloorButton = e.target.closest('button[data-missing-route-floor]');
  if (missingRouteFloorButton) {
    const floor = Number(missingRouteFloorButton.dataset.missingRouteFloor);
    if (!Number.isFinite(floor) || floor < 0 || floor >= state.floors) return;
    selectedFloor = floor;
    floorHandoff = null;
    floorDiagnosisBaseline = { ...floorOperationsSummary(state, floor, CONFIG), day: state.day, source: 'missing-route' };
    floorDiagnosisResult = floorDiagnosisResults.get(floor) ?? null;
    refresh();
    setMode('MISSING ROUTE → F' + (floor === 0 ? 'L' : floor) + ' focused — inspect its queue before choosing a route.');
    toast('MISSING ROUTE → F' + (floor === 0 ? 'L' : floor) + ' focused', INFO);
    return;
  }
  const floorButton = e.target.closest('button[data-inspect-floor]');
  if (floorButton) {
    const floor = Number(floorButton.dataset.inspectFloor);
    floorHandoff = null;
    if (selectedFloor === floor) {
      selectedFloor = null;
      floorDiagnosisBaseline = null;
      floorDiagnosisResult = null;
    } else {
      selectedFloor = floor;
      floorDiagnosisBaseline = { ...floorOperationsSummary(state, floor, CONFIG), day: state.day, source: null };
      floorDiagnosisResult = floorDiagnosisResults.get(floor) ?? null;
    }
    refresh();
    setMode(selectedFloor == null
      ? 'FLOOR focus cleared — choose a floor to inspect its local queue and tenant load.'
      : 'FLOOR F' + (floor === 0 ? 'L' : floor) + ' focused — read its queue and tenant load before changing capacity.');
    return;
  }
  const replaceButton = e.target.closest('button[data-replace-from][data-replace-with]');
  if (replaceButton) {
    const replacementKind = replaceButton.dataset.replaceKind;
    if (replacementKind && replacementKind !== tool) {
      refresh();
      setMode('replacement choices refreshed for ' + tool.toUpperCase() + '.');
      return;
    }
    const from = Number(replaceButton.dataset.replaceFrom);
    const replacement = Number(replaceButton.dataset.replaceWith);
    const index = comparisonFloors.indexOf(from);
    if (index < 0 || comparisonFloors.includes(replacement)) return;
    comparisonFloors[index] = replacement;
    if (pinnedComparisonFloor === from) pinnedComparisonFloor = replacement;
    refresh();
    setMode('F' + from + ' replaced by F' + replacement + ' in the comparison.' +
      (pinnedComparisonFloor === replacement ? ' The preferred pin moved too.' : ''));
    return;
  }
  const pinButton = e.target.closest('button[data-pin-floor]');
  if (pinButton) {
    const floor = Number(pinButton.dataset.pinFloor);
    pinnedComparisonFloor = pinnedComparisonFloor === floor ? null : floor;
    refresh();
    setMode(pinnedComparisonFloor == null
      ? 'F' + floor + ' unpinned — comparison remains available.'
      : 'F' + floor + ' pinned as the preferred candidate · ' + pinnedFloorFitText(tool) +
        ' — switch tenant type to compare it again.');
    return;
  }
  const compareButton = e.target.closest('button[data-compare-floor]');
  if (compareButton) {
    const floor = Number(compareButton.dataset.compareFloor);
    const selectedIndex = comparisonFloors.indexOf(floor);
    if (selectedIndex >= 0) {
      comparisonFloors.splice(selectedIndex, 1);
      if (pinnedComparisonFloor === floor) pinnedComparisonFloor = null;
    } else {
      if (comparisonFloors.length >= 2) {
        const removed = comparisonFloors.shift();
        if (pinnedComparisonFloor === removed) pinnedComparisonFloor = null;
      }
      comparisonFloors.push(floor);
    }
    refresh();
    setMode();
    return;
  }
  const mixButton = e.target.closest('button[data-mix-kind]');
  if (mixButton) {
    const kind = mixButton.dataset.mixKind;
    const buildButton = els.build.querySelector('button[data-kind="' + kind + '"]');
    if (!buildButton || buildButton.disabled) {
      toast('the ' + kind + ' build option is not currently available', WARN);
      return;
    }
    tool = kind;
    rentKind = kind;
    placementWarning = null;
    refresh();
    setMode();
    toast(kind.toUpperCase() + ' selected from the mix focus', INFO);
    return;
  }
  const roomHealthActionButton = e.target.closest('button[data-room-health-action]');
  if (roomHealthActionButton) {
    const id = Number(roomHealthActionButton.dataset.roomHealthUnit);
    const unit = state.units.find((candidate) => candidate.id === id);
    if (!unit || roomHealthActionButton.dataset.roomHealthAction !== 'renovate') return;
    selectedUnitId = id;
    conversionTargetKind = null;
    renovationTargetId = id;
    rerentTargetId = null;
    demolitionTargetId = null;
    placementWarning = null;
    refresh();
    setMode('RENOVATION preview — review the evaluation and cost, then click confirm renovate.', WARN);
    return;
  }
  const button = e.target.closest('button[data-inspect-unit]');
  if (!button) return;
  const id = Number(button.dataset.inspectUnit);
  const unit = state.units.find((candidate) => candidate.id === id);
  if (!unit) return;
  const fromManagementHint = button.dataset.managementHint;
  const focusSource = fromManagementHint === 'retention' ? 'retention recommendation'
    : fromManagementHint === 'service' ? 'service coverage cue'
      : fromManagementHint === 'service-result' ? 'service result' : 'management hint';
  const fromFloorHandoff = button.dataset.floorHandoff === 'vacancy';
  floorHandoff = fromFloorHandoff
    ? { floor: Number(button.dataset.handoffFloor), kind: 'vacancy', unitId: id }
    : null;
  if (fromFloorHandoff) {
    const handoffFloor = Number(button.dataset.handoffFloor);
    floorDiagnosisBaseline = { ...floorOperationsSummary(state, handoffFloor, CONFIG), day: state.day, source: 'vacancy' };
    floorDiagnosisResult = null;
    floorDiagnosisResults.delete(handoffFloor);
  }
  selectedUnitId = id;
  lastConfirmationOutcome = null;
  conversionTargetKind = null;
  renovationTargetId = null;
  rerentTargetId = null;
  demolitionTargetId = null;
  placementWarning = null;
  managementHintConfirmation = fromManagementHint
    ? 'opened ' + tenantUtilizationHintFocusLabel(unit) + ' from ' + focusSource + ' · now in focus'
    : null;
  refresh();
  if (fromManagementHint) toast(focusSource.toUpperCase() + ' → opened ' + tenantUtilizationHintFocusLabel(unit), INFO);
  setMode(unit.occupied
    ? 'OCCUPIED room selected — read-only tenant-mix inspection on the right.' + (fromManagementHint ? ' Opened from ' + focusSource + '.' : '')
    : 'VACANT room selected — inspect its leasing blockers on the right.' + (fromManagementHint ? ' Opened from ' + focusSource + '.' : ''));
});

els['placement-preview'].addEventListener('click', (e) => {
  const condoTransportButton = e.target.closest('button[data-condo-transport-response]');
  if (condoTransportButton) {
    const kind = condoTransportButton.dataset.condoTransportResponse;
    const shaftId = Number(condoTransportButton.dataset.condoTransportShaft);
    const floor = Number(condoTransportButton.dataset.condoTransportFloor);
    if (kind === 'car' || kind === 'shaft' || kind === 'stairs' || kind === 'escalator') {
      selectRouteAlternative(kind, kind === 'car' && Number.isFinite(shaftId) ? shaftId : null,
        kind !== 'car' && Number.isInteger(floor) ? floor : null);
      setMode('TRANSPORT FIRST → recommended ' + kind + ' selected before adding condo residents.', WARN);
    }
    return;
  }
  const button = e.target.closest('button[data-investment-outcome-inspect]');
  if (!button) return;
  const id = Number(button.dataset.investmentOutcomeInspect);
  const unit = state.units.find((candidate) => candidate.id === id);
  if (!unit) return;
  selectedUnitId = id;
  lastConfirmationOutcome = null;
  conversionTargetKind = null;
  renovationTargetId = null;
  rerentTargetId = null;
  demolitionTargetId = null;
  placementWarning = null;
  refresh();
  setMode(unit.occupied
    ? 'OCCUPIED room selected — inspect its sustained evaluation warning.'
    : 'VACANT room selected — renovate or resolve its leasing blockers.');
});

// ------------------------------------------------------------------ camera
// The renderer owns the camera; this turns pointer events into camera verbs
// and nothing more. Every pick below still goes through renderer.floorAt /
// slotAt / unitAt / facilityAt / shaftAt, which now carry the inverse
// transform, so panning needs no other change anywhere in this file.

/** Below this, a press is a click; above it, it is a drag and never places. */
const DRAG_THRESHOLD = 4;
let pan = null;
let suppressNextClick = false;

const canvasPoint = (e) => {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};

const announceZoom = (before) => {
  const after = renderer.camera.zoom;
  if (after !== before) toast('zoom ' + after + 'x', INFO);
};

canvas.addEventListener('mousedown', (e) => {
  const [px, py] = canvasPoint(e);
  // The minimap answers in every mode: click or drag the strip to jump.
  if (e.button === 0 && renderer.minimapJump(state, px, py)) {
    pan = { kind: 'minimap', moved: true };
    e.preventDefault();
    return;
  }
  // Middle-drag pans in every mode, including while a build tool is armed.
  // Left-drag pans on empty space, which means: when nothing is armed, so a
  // build click still lands where the player clicked.
  if (e.button !== 1 && !(e.button === 0 && tool === 'observe')) return;
  pan = { kind: 'pan', x: e.clientX, y: e.clientY, moved: false };
  if (e.button === 1) e.preventDefault();
});

addEventListener('mousemove', (e) => {
  if (!pan) return;
  if (pan.kind === 'minimap') {
    const [px, py] = canvasPoint(e);
    renderer.minimapJump(state, px, py);
    return;
  }
  const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
  if (!pan.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
  pan.moved = true;
  pan.x = e.clientX;
  pan.y = e.clientY;
  renderer.dragBy(state, dx, dy);
  canvas.style.cursor = 'grabbing';
});

addEventListener('mouseup', () => {
  if (!pan) return;
  // A drag must never be read as a click-to-place, so swallow the click the
  // browser is about to deliver.
  suppressNextClick = pan.moved;
  pan = null;
  canvas.style.cursor = '';
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [px, py] = canvasPoint(e);
  const before = renderer.camera.zoom;
  renderer.zoomBy(state, e.deltaY < 0 ? 1 : -1, px, py);
  announceZoom(before);
}, { passive: false });

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const before = renderer.camera.zoom;
  if (e.key === '-' || e.key === '_') { renderer.zoomBy(state, -1); announceZoom(before); }
  if (e.key === '=' || e.key === '+') { renderer.zoomBy(state, 1); announceZoom(before); }
  // The HUD's explicit "go to": the only other time the camera moves itself.
  if (e.key === '0') { renderer.frameLobby(state); toast('view framed on the lobby', INFO); }
});

canvas.addEventListener('mousemove', (e) => {
  if (pan) return;
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  // The minimap is furniture on top of the world, not part of it.
  if (renderer.minimapAt(state, px, py)) {
    if (hoverFloor == null && hoverSlot === -1 && hoverShaftId == null && hoverFacilityId == null) return;
    hoverFloor = null;
    hoverSlot = -1;
    hoverUnitId = null;
    hoverShaftId = null;
    hoverFacilityId = null;
    refresh();
    return;
  }
  const floor = renderer.floorAt(state, px, py);
  const shaft = renderer.shaftAt(state, px, py);
  const facility = renderer.facilityAt(state, px, py);
  const slot = renderer.slotAt(state, px);
  if (floor === hoverFloor && slot === hoverSlot && shaft === hoverShaftId && facility === hoverFacilityId) return;
  hoverFloor = floor;
  hoverSlot = slot;
  // A room is identified by its floor and slot, so this can only change when
  // the guard above has already let the move through.
  hoverUnitId = renderer.unitAt(state, px, py);
  hoverShaftId = shaft;
  hoverFacilityId = facility;
  if (tool === 'car' && shaft != null) {
    transportFocusTarget = null;
    recommendedShaftId = null;
    routeTarget = { kind: 'car', shaftId: shaft };
  } else if (tool !== 'car') {
    recommendedShaftId = null;
  }
  placementWarning = null;
  refresh();
});

canvas.addEventListener('mouseleave', () => {
  if (hoverFloor == null && hoverSlot === -1 && hoverShaftId == null) return;
  if (tool === 'car' && hoverShaftId != null) {
    transportFocusTarget = null;
    const recommendation = shaftQueueReliefRecommendation(state, CONFIG, carQueueDailyHistory);
    recommendedShaftId = recommendation.bestShaftId ?? hoverShaftId;
    routeTarget = { kind: 'car', shaftId: recommendedShaftId };
  }
  hoverFloor = null;
  hoverSlot = -1;
  hoverUnitId = null;
  hoverShaftId = null;
  hoverFacilityId = null;
  placementWarning = null;
  refresh();
});

canvas.addEventListener('click', (e) => {
  if (suppressNextClick) { suppressNextClick = false; return; }
  placementNotice = null;
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  // The minimap is navigation, never placement: a click that lands on the
  // strip jumps the view and must not also demolish or build what is under it.
  if (renderer.minimapAt(state, px, py)) return;
  if (tool === 'demolish') {
    const id = renderer.unitAt(state, px, py);
    if (id == null) return toast('click a room to demolish', WARN);
    const cleared = act('demolish_unit', { id });
    if (cleared.ok) {
      selectedUnitId = null;
      refresh();
      setMode('DEMOLISHED ' + cleared.kind.toUpperCase() + ' on F' + cleared.floor +
        ' · DEMOLISH stays armed — Esc puts it away.');
    }
    return;
  }
  if (tool === 'dig') {
    const dug = act('dig_basement');
    if (dug.ok) {
      refresh();
      setMode('DUG B' + basementDepth(state) + ' · a shaft has to reach it before anyone will go down there · DIG stays armed.');
    }
    return;
  }
  if (tool === 'car') {
    const shaftId = renderer.shaftAt(state, px, py);
    if (shaftId == null) return toast(state.shafts.length ? 'click an elevator shaft' : 'build a shaft first', WARN);
    const shaft = state.shafts.find((candidate) => candidate.id === shaftId);
    const added = act('add_car', { id: shaftId });
    if (added.ok) {
      selectedShaftId = shaft.id;
      floorHandoff = null;
      recommendedShaftId = null;
      transportFocusTarget = null;
      routeTarget = null;
      shopDiagnosisContext = null;
      const shaftNumber = state.shafts.indexOf(shaft) + 1;
      const dispatchCapacity = shaft.cars.length * CONFIG.elevator.capacity;
      refresh();
      setMode('CAR ADDED · S' + shaftNumber + ' now ' + shaft.cars.length + '/' + CONFIG.elevator.maxCarsPerShaft +
        ' cars · dispatch capacity ' + dispatchCapacity + ' riders · CAR stays armed for the next shaft; Esc when you are done, then watching tower; let the next rush run.');
    }
    return;
  }
  const clickedShaftId = renderer.shaftAt(state, px, py);
  const clickedShaft = state.shafts.find((shaft) => shaft.id === clickedShaftId);
  if (clickedShaft && (tool === 'office' || tool === 'observe')) {
    selectedShaftId = clickedShaft.id;
    serviceFocusTarget = null;
    selectedUnitId = null;
    selectedFloor = null;
    floorDiagnosisBaseline = null;
    floorDiagnosisResult = null;
    floorHandoff = null;
    routeTarget = null;
    refresh();
    setMode('SHAFT S' + (state.shafts.indexOf(clickedShaft) + 1) + ' selected · floors F' + clickedShaft.bottom + '–F' + clickedShaft.top +
      ' · yellow W badges = this route · click + car or read its queue and capacity in the inspector', INFO);
    toast('SHAFT selected · queue and capacity shown', INFO);
    return;
  }
  const clickedFacilityId = renderer.facilityAt(state, px, py);
  const clickedFacility = state.facilities?.find((facility) => facility.id === clickedFacilityId);
  if (clickedFacility && (tool === 'office' || tool === 'observe')) {
    const coverageFloors = CONFIG.services?.[clickedFacility.kind]?.coverageFloors ?? 0;
    const focus = { kind: clickedFacility.kind, floor: clickedFacility.floor, facilityId: clickedFacility.id, coverageFloors, changedFloors: [] };
    const coverage = serviceFocusCoverage(focus, state, CONFIG);
    const low = Math.max(CONFIG.building.lobbyFloor + 1, clickedFacility.floor - coverageFloors);
    const high = Math.min(state.floors - 1, clickedFacility.floor + coverageFloors);
    const label = clickedFacility.kind === 'food' ? 'CAFETERIA' : clickedFacility.kind === 'parking' ? 'PARKING'
      : clickedFacility.kind === 'medical' ? 'CLINIC' : clickedFacility.kind === 'security' ? 'SECURITY' : 'RECYCLING';
    serviceFocusTarget = focus;
    selectedShaftId = null;
    selectedFloor = clickedFacility.floor;
    selectedUnitId = null;
    floorDiagnosisBaseline = { ...floorOperationsSummary(state, selectedFloor, CONFIG), day: state.day, source: 'facility-inspect' };
    floorDiagnosisResult = null;
    floorDiagnosisResults.delete(selectedFloor);
    floorHandoff = null;
    routeTarget = null;
    refresh();
    setMode(label + ' selected · coverage F' + low + (low === high ? '' : '–F' + high) +
      ' · ' + coverage.coveredRooms + '/' + coverage.requiredRooms + ' rooms · tenant heads ' + coverage.coveredHeads + '/' + coverage.requiredHeads +
      ' · +' + money(CONFIG.services?.[clickedFacility.kind]?.dailyUpkeep ?? 0) + '/day upkeep', INFO);
    toast(label + ' selected · coverage and upkeep shown', INFO);
    return;
  }
  const clickedUnitId = renderer.unitAt(state, px, py);
  const clickedUnit = state.units.find((u) => u.id === clickedUnitId);
  if (clickedUnit && !clickedUnit.occupied) {
    selectedUnitId = clickedUnit.id;
    lastConfirmationOutcome = null;
    conversionTargetKind = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    placementWarning = null;
    refresh();
    setMode('ABANDONED room selected — inspect it on the right.');
    return;
  }
  const floor = pickBuildFloor(px, py);
  if (floor == null) return toast('click a floor', WARN);
  if (tool === 'observe') return toast('choose a build action above, then click the tower', INFO);
  // The ghost is a dry run of exactly this click, so a red ghost refuses the
  // click with the same words rather than letting it fail somewhere quieter.
  const clickSlot = renderer.slotAt(state, px);
  const preview = placementVerdict(tool, { floor, slot: clickSlot, unitId: null, shaftId: null });
  if (preview && !preview.verdict.ok) return toast(placementReason(preview.verdict), WARN);
  const investmentIssue = investmentPlacementIssue(tool, floor);
  if (investmentIssue) return toast(investmentIssue, WARN);
  if (tool === 'lobby') {
    if (floor !== CONFIG.building.lobbyFloor) return toast('the lobby belongs on the ground floor', WARN);
    const slot = renderer.slotAt(state, px);
    // Same chain the ghost previewed: on bare ground the entrance buys the
    // storey it stands on, so the first click of a new game leaves a building
    // rather than a lobby floating over nothing.
    const plan = armedAction('lobby', { floor, slot, unitId: null, shaftId: null });
    if (!plan?.actions) return toast(plan?.blocked ?? 'the lobby cannot go there', WARN);
    for (const action of plan.actions) {
      if (!act(action.type, action).ok) return;
    }
    // The lobby is a one-per-tower purchase, so the tile stays armed as what
    // it becomes next: the wing tool, for widening the entrance.
    tool = 'lobby_wing';
    shopDiagnosisContext = null;
    transportFocusTarget = null;
    routeTarget = null;
    refresh();
    setMode('LOBBY placed — shafts now include its entrance walk. LOBBY stays armed as the wing tool; Esc puts it away.');
    return;
  }
  if (tool === 'lobby_wing') {
    if (floor !== CONFIG.building.lobbyFloor) return toast('the lobby wing belongs on the ground floor', WARN);
    const slot = renderer.slotAt(state, px);
    const expanded = act('expand_lobby', { slot });
    if (expanded.ok) {
      shopDiagnosisContext = null;
      routeTarget = null;
      refresh();
      setMode('LOBBY expanded — its nearest entrance now reduces ground-floor walking. LOBBY WING stays armed.');
    }
    return;
  }
  if (tool === 'stairs') {
    if (floor <= CONFIG.building.lobbyFloor) return toast('stairs must reach an upper floor', WARN);
    const built = act('build_stairs', { bottom: CONFIG.building.lobbyFloor, top: floor });
    if (built.ok) {
      if (routeInterventionOutcome?.kind === 'stairs' && !routeInterventionOutcome.placed) {
        const placedRoute = state.stairs.at(-1);
        routeInterventionOutcome = {
          ...routeInterventionOutcome,
          placed: true,
          placedDay: state.day,
          targetRoute: placedRoute ? { kind: 'stairs', id: placedRoute.id, bottom: placedRoute.bottom, top: placedRoute.top } : null,
        };
      }
      shopDiagnosisContext = null;
      transportFocusTarget = null;
      routeTarget = null;
      refresh();
      setMode('STAIRS placed — they provide a slow local route without a car. STAIRS stays armed.');
    }
    return;
  }
  if (tool === 'escalator') {
    if (floor <= CONFIG.building.lobbyFloor) return toast('escalators must reach an upper floor', WARN);
    const built = act('build_escalator', { bottom: CONFIG.building.lobbyFloor, top: floor });
    if (built.ok) {
      if (routeInterventionOutcome?.kind === 'escalator' && !routeInterventionOutcome.placed) {
        const placedRoute = state.escalators.at(-1);
        routeInterventionOutcome = {
          ...routeInterventionOutcome,
          placed: true,
          placedDay: state.day,
          targetRoute: placedRoute ? { kind: 'escalator', id: placedRoute.id, bottom: placedRoute.bottom, top: placedRoute.top } : null,
        };
      }
      shopDiagnosisContext = null;
      routeTarget = null;
      refresh();
      setMode('ESCALATOR placed — it is faster than stairs without using a car. ESCALATOR stays armed.');
    }
    return;
  }
  if (tool === 'express') {
    const bottom = CONFIG.building.lobbyFloor ?? 0;
    const slot = renderer.slotAt(state, px);
    if (slot < 0) return toast('choose a visible building column for the express shaft', WARN);
    if (floor < bottom + 2) return toast('an express shaft needs at least one floor to skip — click a higher sky-lobby floor', WARN);
    const cost = expressCost(floor);
    if (state.money < cost) return toast('not enough money for this express span: need ' + money(cost) + ', have ' + money(state.money), WARN);
    const built = act('build_shaft', { bottom, top: floor, slot, kind: 'express' });
    if (built.ok) {
      toast('EXPRESS built — nonstop lobby ↔ F' + floor + ' · riders transfer to local routes at the sky lobby', GOOD);
      transportFocusTarget = null;
      routeTarget = null;
      refresh();
    }
    return;
  }
  if (tool === 'shaft') {
    const bottom = CONFIG.building.lobbyFloor ?? 0;
    const slot = renderer.slotAt(state, px);
    if (slot < 0) return toast('choose a visible building column for the new shaft', WARN);
    const selectedTarget = shaftToolTarget();
    const top = floor === selectedTarget?.floor ? selectedTarget.floor : floor;
    const placement = routePlacementStatus('shaft', bottom, top, state, CONFIG, null, slot);
    if (placement.key !== 'ready') return toast(placement.detail, WARN);
    const cost = shaftCost(top);
    if (state.money < cost) return toast('not enough money for this shaft span: need ' + money(cost) + ', have ' + money(state.money), WARN);
    const forecast = activeInvestmentForecast(top);
    const built = act('build_shaft', { bottom, top, slot });
    if (built.ok) {
      floorHandoff = null;
      rememberInvestmentOutcome(forecast);
      investmentTarget = null;
      shopDiagnosisContext = null;
      transportFocusTarget = null;
      routeTarget = null;
      refresh();
    }
    return;
  }
  if (floor === 0) return toast('the lobby is not leasable', WARN);
  if (tool === 'food' || tool === 'parking' || tool === 'medical' || tool === 'security' || tool === 'recycling') {
    const kind = tool;
    const guidedService = investmentTarget?.tool === kind && investmentTarget.recommendedFloor != null;
    const recommendedCoverage = guidedService
      ? servicePlacementCoveragePreview(state, kind, investmentTarget.recommendedFloor, CONFIG)
      : null;
    const chosenCoverage = guidedService
      ? servicePlacementCoveragePreview(state, kind, floor, CONFIG)
      : null;
    const serviceComparison = servicePlacementComparison(chosenCoverage, recommendedCoverage);
    const confirmingServiceWarning = placementWarning?.serviceCoverage === true &&
      placementWarning.kind === kind && placementWarning.floor === floor;
    if (serviceComparison.key === 'worse' && !confirmingServiceWarning) {
      placementWarning = {
        kind,
        floor,
        serviceCoverage: true,
        recommendedFloor: investmentTarget.recommendedFloor,
        comparison: serviceComparison.label,
      };
      refresh();
      setMode(undefined, WARN);
      return;
    }
    const fundsBefore = state.money;
    const forecast = activeInvestmentForecast(floor);
    const coverageBefore = serviceCoverageSummary(state, kind, CONFIG);
    const appealTargetUnit = investmentTarget?.targetUnitId == null
      ? null
      : state.units.find((unit) => unit.id === investmentTarget.targetUnitId);
    const appealTargetBefore = appealTargetUnit ? unitEvaluation(state, appealTargetUnit, CONFIG) : null;
    const appealBeforeDesirability = towerDesirabilitySummary(state, CONFIG).score;
    const label = kind === 'food' ? 'CAFETERIA' : kind === 'parking' ? 'PARKING'
      : kind === 'medical' ? 'CLINIC' : kind === 'security' ? 'SECURITY' : 'RECYCLING';
    const coverage = kind === 'food' ? 'this floor and adjacent floors'
      : kind === 'parking' ? 'this floor and floors up to two levels away'
        : kind === 'medical' ? 'this floor and floors up to three levels away'
          : kind === 'security' ? 'this floor and floors up to four levels away' : 'this floor and floors up to two levels away';
    const built = act('build_facility', { kind, floor, slot: clickSlot });
    if (built.ok) {
      const coverageAfter = serviceCoverageSummary(state, kind, CONFIG);
      const serviceCoverage = coverageBefore.available && coverageAfter.available
        ? { before: coverageBefore, after: coverageAfter }
        : null;
      if (serviceCoverage) {
        const desirabilityAfter = towerDesirabilitySummary(state, CONFIG).score;
        const appealTargetAfter = appealTargetUnit ? unitEvaluation(state, appealTargetUnit, CONFIG) : null;
        rememberServiceOutcome(kind, floor, coverageBefore, coverageAfter, investmentTarget?.targetUnitId ?? null, built.id, appealBeforeDesirability, desirabilityAfter, appealTargetBefore?.score ?? null, appealTargetAfter?.score ?? null);
        recordServiceRoomStatus(state.day);
      }
      if (appealTargetUnit && appealTargetBefore) {
        vacancyAppealFollowups = [...vacancyAppealFollowups, {
          unitId: appealTargetUnit.id,
          floor: appealTargetUnit.floor,
          kind: appealTargetUnit.kind,
          action: kind + ' coverage',
          factorKey: 'services',
          builtDay: state.day,
          builtFloor: floor,
          beforeScore: appealTargetBefore.score,
          beforeFactor: vacancyAppealFactorValue(appealTargetBefore, 'services'),
          beforeDemand: appealTargetUnit.occupied ? null : vacancyDemandSummary(state, appealTargetUnit, CONFIG, state.log.at(-1)?.rep),
          beforeDesirability: appealBeforeDesirability,
        }].slice(-3);
      }
      rememberInvestmentOutcome(forecast, serviceCoverage ? {
        serviceCoverage,
        moneyBefore: fundsBefore,
        moneyAfter: state.money,
        moneySpent: fundsBefore - state.money,
      } : {});
      serviceFocusTarget = null;
      investmentTarget = null;
      placementWarning = null;
      shopDiagnosisContext = null;
      serviceResultBudget = {
        kind,
        floor,
        label,
        coverage,
        targetUnitId: appealTargetUnit?.id ?? null,
        targetFloor: appealTargetUnit?.floor ?? null,
        targetKind: appealTargetUnit?.kind ?? null,
        targetTenantLoad: appealTargetUnit ? Math.max(0, Math.round(appealTargetUnit.heads ?? 0)) : null,
        upfrontCost: CONFIG.costs[kind] ?? 0,
        dailyUpkeep: CONFIG.services?.[kind]?.dailyUpkeep ?? 0,
        builtDay: state.day,
        realized: null,
      };
      placementNotice = serviceBudgetResultText(serviceResultBudget);
      refresh();
      setMode(placementNotice);
    }
    return;
  }
  if (CONFIG.units[tool]) {
    // A room on the row above the roof RAISES that storey (spec §4), so there
    // is no existing floor for the placement comparisons to read. They all
    // answer "unavailable" for a storey that does not exist yet, which
    // silently swallowed the click that was supposed to create it — the tower
    // could never grow past its first floor.
    const raising = floor === state.floors;
    // Do NOT fabricate a stand-in preview here. An object claiming
    // `available: true` without an `evaluation` throws the moment anything
    // downstream reads it, and an exception inside a click listener looks
    // exactly like a click that was ignored.
    const floorPreview = raising ? null : tenantPlacementFloorComparison(state, tool, floor, CONFIG);
    if (floorPreview && !floorPreview.available) {
      placementWarning = { kind: tool, floor, full: true };
      refresh();
      setMode(undefined, WARN);
      return;
    }
    const preview = floorPreview?.mix ?? null;
    const recommendedShopPreview = !raising && shopDiagnosisContext?.diagnosis === 'mix' && tool === 'office'
      ? activeShopDemandPreview(null) : null;
    const chosenShopPreview = recommendedShopPreview
      ? activeShopDemandPreview(floor) : null;
    const shopDemandWarning = recommendedShopPreview?.available && chosenShopPreview?.available &&
      floor !== recommendedShopPreview.placementFloor &&
      chosenShopPreview.expectedRevenueDelta < recommendedShopPreview.expectedRevenueDelta;
    const confirmingShopDemandWarning = placementWarning?.shopDemand &&
      placementWarning.kind === tool && placementWarning.floor === floor;
    if (shopDemandWarning && !confirmingShopDemandWarning) {
      placementWarning = {
        kind: tool,
        floor,
        shopDemand: true,
        recommendedFloor: recommendedShopPreview.placementFloor,
        recommendedCustomers: recommendedShopPreview.expectedCustomersDelta,
        selectedCustomers: chosenShopPreview.expectedCustomersDelta,
      };
      refresh();
      setMode(undefined, WARN);
      return;
    }
    const warningDelta = CONFIG.occupancy.tenantMixPlacementWarningDelta ?? 0;
    // A storey that does not exist yet has no tenant mix to worsen, so there
    // is nothing here to warn about — and `preview` is null in that case,
    // which is how this line silently threw inside the click listener and made
    // the placement look like it had simply been ignored.
    const materiallyWorsens = !raising && preview
      && preview.balanceBefore - preview.balanceAfter >= warningDelta;
    const decisionReason = tenantPlacementDecisionReason(floorPreview, CONFIG);
    const confirming = placementWarning && placementWarning.kind === tool && placementWarning.floor === floor && !placementWarning.full;
    if (materiallyWorsens && !confirming) {
      const warningReasons = [
        tenantPlacementAlternativeReason(floorPreview),
        tenantPlacementInvestmentReason(floorPreview, state, CONFIG),
        decisionReason,
        placementReasonText(tool, floorPreview?.evaluation),
      ].filter(Boolean).join(' · ');
      placementWarning = {
        kind: tool,
        floor,
        balanceBefore: preview.balanceBefore,
        balanceAfter: preview.balanceAfter,
        evaluationScore: floorPreview?.evaluation?.score,
        why: warningReasons,
      };
      refresh();
      setMode(undefined, WARN);
      return;
    }
    placementWarning = null;
    const demandFollowup = chosenShopPreview?.available
      ? {
        shopId: shopDiagnosisContext?.shopId,
        builtDay: state.day,
        placementFloor: floor,
        beforeExpectedCustomers: chosenShopPreview.before.expectedCustomers,
        beforeExpectedRevenue: chosenShopPreview.before.expectedRevenue,
        forecastExpectedCustomers: chosenShopPreview.after.expectedCustomers,
        forecastExpectedRevenue: chosenShopPreview.after.expectedRevenue,
      }
      : null;
    const built = act('build_unit', { kind: tool, floor, slot: clickSlot });
    if (built.ok) {
      if (demandFollowup?.shopId != null) {
        shopDemandFollowupHistory = rememberShopTrafficFollowup(
          shopDemandFollowupHistory,
          demandFollowup,
          CONFIG.occupancy.shopDemandFollowupHistoryDays,
        );
      }
      reconcileInvestmentOutcome(built.id);
      shopDiagnosisContext = null;
      if (tool === 'condo') {
        selectedUnitId = built.id;
        selectedFloor = floor;
        placementNotice = 'CONDO placed on F' + floor + ' · room opened for inspection';
        refresh();
        setMode(placementNotice, INFO);
        toast('CONDO placed on F' + floor + ' · service follow-up is now visible', INFO);
      }
    }
    return;
  }
  const built = act('build_unit', { kind: tool, floor, slot: clickSlot });
  if (built.ok) {
    reconcileInvestmentOutcome(built.id);
    shopDiagnosisContext = null;
  }
});

// The ghost tracks the cursor on its own listener, so the hover/pick handler
// above stays one concern and only this one pays for a dry run — and only when
// the targeted cell actually changes.
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  ghostSpot = spotAt(e.clientX - r.left, e.clientY - r.top);
  updateGhost();
});

canvas.addEventListener('mouseleave', () => {
  ghostSpot = null;
  updateGhost();
});

// Right-click disarms, the same as Esc. Without the default menu suppressed,
// the browser's own context menu would land on top of the tower.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  disarmTool(true);
});

function rerentSelectedUnit(fromUtilizationHint = false) {
  if (selectedUnitId == null) return;
  const id = selectedUnitId;
  const unit = state.units.find((candidate) => candidate.id === id);
  if (!unit || unit.occupied) return;
  if (rerentTargetId !== id) {
    lastConfirmationOutcome = null;
    conversionTargetKind = null;
    renovationTargetId = null;
    rerentTargetId = id;
    demolitionTargetId = null;
    refresh();
    setMode('RE-RENT preview — review the tenant outcome and cost, then click confirm re-rent.', WARN);
    return;
  }
  const beforeTenantSummary = tenantLoadSummary(state, CONFIG);
  const preFill = vacancyPreFillOutcome(state, unit, CONFIG);
  const r = act('rerent_unit', { id });
  if (r.ok) {
    lastConfirmationOutcome = null;
    lastVacancyPreFillResult = {
      ...vacancyPreFillResult(preFill, state, unit, CONFIG),
      day: state.day,
    };
    vacancyPreFillResultHistory = rememberVacancyPreFillResultHistory(vacancyPreFillResultHistory, lastVacancyPreFillResult);
    const focus = tenantUtilizationHintFocusLabel(unit);
    const afterTenantSummary = tenantLoadSummary(state, CONFIG);
    const recovery = tenantUtilizationRecoveryResult(beforeTenantSummary.ratio, afterTenantSummary.ratio);
    tenantUtilizationHistory = [...tenantUtilizationHistory, {
      day: state.day,
      ratio: afterTenantSummary.ratio,
      event: 'recovery',
      change: recovery.value,
      tenantGain: afterTenantSummary.tenants - beforeTenantSummary.tenants,
    }].slice(-6);
    selectedUnitId = null;
    placementWarning = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    floorHandoff = null;
    managementHintConfirmation = null;
    refresh();
    setMode(fromUtilizationHint
      ? 'UTILIZATION RECOVERY — ' + focus + ' re-rented; occupancy restored.'
      : 'ROOM re-rented — the new tenant is moving in.');
    if (fromUtilizationHint) toast('UTILIZATION RECOVERY → ' + focus + ' now occupied', GOOD);
  }
}

function currentRouteOverflowReading(kind, routeId) {
  const history = localOverflowRouteHistory(state.log, kind, routeId);
  const latest = history.at(-1);
  return {
    day: latest?.day ?? state.day,
    average: latest?.localOverflowAverage ?? 0,
    peak: latest?.localOverflowPeak ?? 0,
  };
}

function currentRouteInterventionTenantReading() {
  const latest = state.log.at(-1);
  const occupied = state.units.filter((unit) => unit.occupied);
  const averageStress = occupied.length
    ? occupied.reduce((sum, unit) => sum + Math.max(0, Number(unit.stress) || 0), 0) / occupied.length
    : 0;
  return {
    day: latest?.day ?? state.day,
    localAvgWait: latest?.localAvgWait ?? 0,
    localAbandoned: latest?.localAbandoned ?? 0,
    localDeliveryRate: latest?.localDeliveryRate ?? 100,
    rep: Number.isFinite(Number(latest?.rep)) ? Number(latest.rep) : null,
    averageStress: +averageStress.toFixed(2),
  };
}

els['rerent-unit'].addEventListener('click', () => rerentSelectedUnit());

els['cancel-confirmation'].addEventListener('click', () => {
  if (!renovationTargetId && !rerentTargetId && !demolitionTargetId && !conversionTargetKind) return;
  renovationTargetId = null;
  rerentTargetId = null;
  demolitionTargetId = null;
  lastConfirmationOutcome = 'PREVIEW CANCELED — no room changes made.';
  conversionTargetKind = null;
  refresh();
  setMode('PREVIEW CANCELED — no room changes made.', INFO);
});

els['unit-utilization-context'].addEventListener('click', (e) => {
  const roomTransportButton = e.target.closest('button[data-room-transport-action]');
  if (roomTransportButton) {
    const kind = roomTransportButton.dataset.roomTransportAction;
    const shaftId = Number(roomTransportButton.dataset.roomTransportShaft);
    const floor = Number(roomTransportButton.dataset.roomTransportFloor);
    if (kind === 'car' || kind === 'shaft' || kind === 'stairs' || kind === 'escalator') {
      selectRouteAlternative(kind, kind === 'car' && Number.isFinite(shaftId) ? shaftId : null,
        kind !== 'car' && Number.isInteger(floor) ? floor : null);
      setMode('TRANSPORT ACTION → condo response selected; confirm the highlighted ' + kind + ' placement.', WARN);
    }
    return;
  }
  const roomServiceToolButton = e.target.closest('button[data-room-service-tool]');
  if (roomServiceToolButton) {
    selectServiceToolForUnit(
      roomServiceToolButton.dataset.roomServiceTool,
      Number(roomServiceToolButton.dataset.roomServiceUnit),
      'room inspector'
    );
    return;
  }
  if (!e.target.closest('button[data-utilization-rerent]')) return;
  rerentSelectedUnit(true);
});

els['renovate-unit'].addEventListener('click', () => {
  if (selectedUnitId == null) return;
  const id = selectedUnitId;
  const unit = state.units.find((candidate) => candidate.id === id);
  if (!unit || unit.occupied || unit.renovated) return;
  if (renovationTargetId !== id) {
    lastConfirmationOutcome = null;
    conversionTargetKind = null;
    renovationTargetId = id;
    rerentTargetId = null;
    demolitionTargetId = null;
    refresh();
    setMode('RENOVATION preview — review the evaluation and cost, then click confirm renovate.', WARN);
    return;
  }
  const beforeEvaluation = unitEvaluation(state, unit, CONFIG);
  const beforeDesirability = towerDesirabilitySummary(state, CONFIG).score;
  const beforeDemand = vacancyDemandSummary(state, unit, CONFIG, state.log.at(-1)?.rep);
  const r = act('renovate_unit', { id });
  if (r.ok) {
    lastConfirmationOutcome = null;
    vacancyAppealFollowups = [...vacancyAppealFollowups, {
      unitId: id,
      floor: unit.floor,
      kind: unit.kind,
      action: 'renovation',
      factorKey: 'renovation',
      builtDay: state.day,
      beforeScore: beforeEvaluation.score,
      beforeFactor: vacancyAppealFactorValue(beforeEvaluation, 'renovation'),
      beforeDesirability,
      beforeDemand,
    }].slice(-3);
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    refresh();
    setMode('ROOM renovated — evaluation +' + r.bonus + '; re-rent when ready.');
  }
});

els['demolish-unit'].addEventListener('click', () => {
  if (selectedUnitId == null) return;
  const id = selectedUnitId;
  if (demolitionTargetId !== id) {
    lastConfirmationOutcome = null;
    conversionTargetKind = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = id;
    refresh();
    setMode('DEMOLITION armed — click confirm demolition to remove the room.', WARN);
    return;
  }
  const r = act('demolish_unit', { id });
  if (r.ok) {
    lastConfirmationOutcome = null;
    selectedUnitId = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    refresh();
    setMode('ROOM demolished — its floor slot is free.');
  }
});

els['conversion-controls'].addEventListener('click', (e) => {
  const b = e.target.closest('button[data-convert-kind]');
  if (!b || selectedUnitId == null) return;
  const kind = b.dataset.convertKind;
  if (conversionTargetKind !== kind) {
    lastConfirmationOutcome = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    conversionTargetKind = kind;
    refresh();
    setMode('CONVERSION preview — review the mix effect, then click confirm.', WARN);
    return;
  }
  const r = act('convert_unit', { id: selectedUnitId, kind });
  if (r.ok) {
    lastConfirmationOutcome = null;
    conversionTargetKind = null;
    renovationTargetId = null;
    rerentTargetId = null;
    demolitionTargetId = null;
    refresh();
    setMode('ROOM converted to ' + kind.toUpperCase() + ' — re-rent when ready.');
  }
});

els.build.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  placementNotice = null;
  routeTarget = null;
  recommendedShaftId = null;
  transportFocusTarget = null;
  const warnedFloor = placementWarning && !placementWarning.full ? placementWarning.floor : null;
  const warnedPreview = warnedFloor == null ? null : tenantPlacementFloorComparison(state, placementWarning.kind, warnedFloor, CONFIG);
  const warnedInvestment = warnedPreview?.available
    ? tenantPlacementSmallestInvestment(warnedPreview, state, CONFIG)
    : null;
  const selectedInvestmentKind = b.dataset.do || b.dataset.facility || null;
  const preservesPendingRoom = investmentOutcome?.roomKind && investmentOutcome.actualScore == null &&
    b.dataset.kind === investmentOutcome.roomKind;
  if (!preservesPendingRoom) clearInvestmentOutcome();
  investmentTarget = warnedInvestment && selectedInvestmentKind === warnedInvestment.kind
    ? { tool: warnedInvestment.kind, floor: warnedFloor, roomKind: placementWarning.kind }
    : null;
  placementWarning = null;
  if (b.dataset.kind) { tool = b.dataset.kind; rentKind = b.dataset.kind; setMode(); refresh(); return; }
  if (b.dataset.facility) {
    comparisonFloors = [];
    pinnedComparisonFloor = null;
    tool = b.dataset.facility;
    setMode();
    refresh();
    return;
  }
  comparisonFloors = [];
  pinnedComparisonFloor = null;
  if (b.dataset.do === 'dig') {
    tool = 'dig';
    setMode();
    toast('click the tower to sink the next basement', INFO);
    refresh();
  }
  if (b.dataset.do === 'demolish') {
    tool = 'demolish';
    setMode();
    toast('click a vacant room to clear it', INFO);
    refresh();
  }
  if (b.dataset.do === 'lobby') {
    if (state.lobby) {
      tool = 'lobby_wing';
      setMode('LOBBY WING selected — click an open ground-floor slot to expand it.');
      toast('click an open ground-floor slot for the lobby wing', INFO);
    } else {
      tool = 'lobby';
      setMode('LOBBY selected — click the ground floor to place it.');
      toast('click a ground-floor slot for the lobby', INFO);
    }
    refresh();
  }
  if (b.dataset.do === 'shaft') {
    tool = 'shaft';
    transportFocusTarget = null;
    const target = shaftToolTarget();
    routeTarget = target;
    setMode();
    toast(target?.recommended ? 'click the highlighted shorter span through F' + target.floor : 'click the top floor for the new shaft', INFO);
    refresh();
  }
  if (b.dataset.do === 'car') {
    if (!state.shafts.length) return toast('build a shaft first', WARN);
    tool = 'car';
    const recommendation = shaftQueueReliefRecommendation(state, CONFIG, carQueueDailyHistory);
    recommendedShaftId = recommendation.bestShaftId;
    transportFocusTarget = recommendedShaftId == null
      ? null
      : { kind: 'car', shaftId: recommendedShaftId };
    routeTarget = recommendedShaftId == null ? null : { kind: 'car', shaftId: recommendedShaftId };
    setMode();
    toast(recommendedShaftId == null
      ? 'every shaft is full; build a new shaft for more capacity'
      : 'click highlighted S' + (state.shafts.findIndex((shaft) => shaft.id === recommendedShaftId) + 1) +
        (recommendation.basis === 'sustained daily pressure'
          ? ' for repeated daily pressure'
          : recommendation.basis === 'live queue relief'
            ? ' for the strongest queue relief'
            : ' to reserve capacity'), INFO);
    refresh();
  }
  if (b.dataset.do === 'stairs') {
    if (!state.lobby) return toast('build a lobby first', WARN);
    tool = 'stairs';
    setMode('STAIRS selected — click the top floor to place them.');
    toast('click the top floor for the new stairwell', INFO);
    refresh();
  }
  if (b.dataset.do === 'express') {
    if (!state.lobby) return toast('build a lobby first', WARN);
    tool = 'express';
    transportFocusTarget = null;
    routeTarget = null;
    setMode();
    toast('click the sky-lobby floor for the nonstop express shuttle', INFO);
    refresh();
  }
  if (b.dataset.do === 'escalator') {
    if (!state.lobby) return toast('build a lobby first', WARN);
    tool = 'escalator';
    setMode('ESCALATOR selected — click the top floor to place it.');
    toast('click the top floor for the new escalator', INFO);
    refresh();
  }
  if (b.dataset.do === 'extend') {
    const sh = state.shafts[state.shafts.length - 1];
    if (sh) act('extend_shaft', { id: sh.id, top: state.floors - 1 }); else toast('build a shaft first', WARN);
  }
});

els['rent-control'].addEventListener('click', (e) => {
  const b = e.target.closest('button[data-rent-step]');
  if (!b) return;
  const current = state.rentLevels?.[rentKind] ?? 0;
  const level = clampRentLevel(current + Number(b.dataset.rentStep), CONFIG);
  const r = act('set_rent', { kind: rentKind, level });
  if (r.ok) toast(rentKind + ' rent set to $' + r.rent + '/day', INFO);
});

addEventListener('keydown', (e) => {
  // The saves panel has a text field in it. Every key below would otherwise
  // fire while a player types a tower's name — "shaft 2" would pause the game,
  // set 4x speed, and open the appeal view. Narrow on purpose: the dev knobs
  // are range inputs, and space still pauses while one has focus.
  if (e.target?.matches?.('input[type="text"], input[type="file"], textarea')) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (e.key === 'Escape') { if (saves.open) { closeSavesPanel(); return; } disarmTool(true); return; }
  if (e.key.toLowerCase() === 's') { saves.open ? closeSavesPanel() : openSavesPanel(); return; }
  // The panel is modal. Without this, R behind it restarts the tower you came
  // to the panel to save.
  if (saves.open) return;
  if (e.key === ' ') { e.preventDefault(); speed = speed ? 0 : 1; updateTimeControls(); toast(speed ? 'running' : 'paused', INFO); }
  if (e.key === '1') { speed = 1; updateTimeControls(); toast('1x', INFO); }
  if (e.key === '2') { speed = 4; updateTimeControls(); toast('4x', INFO); }
  if (e.key === '3') { speed = 12; updateTimeControls(); toast('12x', INFO); }
  if (e.key.toLowerCase() === 'r') restart();
  if (e.key.toLowerCase() === 'e') exportTape();
  if (e.key.toLowerCase() === 'd') setDeveloperMode(!developerMode);
  // The appeal view (issue #12). The renderer computes and draws it; without
  // a way to ask for it, it is unreachable, which is precisely the defect
  // issue #14 is about — art and code that exist and nothing ever asks for.
  // The key and the bar's toggle share one path so they cannot drift.
  if (e.key.toLowerCase() === 'a') toggleAppealOverlay();
});

/**
 * Put a different tower on screen — a fresh one, or one loaded from a save.
 *
 * Everything below the first two lines is session state the UI accumulated
 * about the tower being replaced: diagnosis results keyed by floor id, queue
 * history keyed by day, room-health trends, followup lists. Carrying any of it
 * across would show a loaded tower readings taken from a different building —
 * which is why loading goes through the identical reset that "new session"
 * does, instead of getting its own shorter one that drifts.
 */
function beginSession(nextState, { tape: nextTape = [], message = '' } = {}) {
  restartArmed = false;
  els['restart-game'].textContent = 'new session';
  els['restart-game'].classList.remove('armed');
  state = nextState;
  // The camera belongs to the renderer and survives a session, so a tower
  // loaded while panned over empty sky would open on nothing. Frame the ground.
  renderer.frameLobby(state);
  tool = OPENING_TOOL;
  ghostSpot = null;
  lastGhostKey = null;
  tenantUtilizationBaseline = tenantLoadSummary(state, CONFIG).ratio;
  tenantUtilizationChange = null;
  tenantUtilizationHistory = [{ day: state.day, ratio: tenantUtilizationBaseline }];
  managementHintConfirmation = null;
  tape = nextTape;
  hoverFloor = null;
  hoverSlot = -1;
  hoverUnitId = null;
  hoverShaftId = null;
  hoverFacilityId = null;
  selectedShaftId = null;
  recommendedShaftId = null;
  lastCarQueueSignature = null;
  lastCarForecastContextKey = null;
  lastCarQueueSampleMinute = null;
  carQueueHistory = new Map();
  carQueueDailyHistory = new Map();
  carQueueDailyAccumulator = new Map();
  lastLocalRouteSignature = null;
  localRouteDailyHistory = new Map();
  localRouteDailyAccumulator = new Map();
  transportFocusTarget = null;
  routeTarget = null;
  selectedFloor = null;
  floorHandoff = null;
  floorDiagnosisBaseline = null;
  floorDiagnosisResult = null;
  floorDiagnosisResults = new Map();
  floorDiagnosisHistory = [];
  placementWarning = null;
  placementNotice = null;
  serviceResultBudget = null;
  investmentTarget = null;
  shopDiagnosisContext = null;
  shopDemandFollowupHistory = [];
  shopResponseFilterId = null;
  shopTrafficBaselineAnnounced = false;
  shopTrafficBaselineDay = null;
  routeInterventionOutcome = null;
  routeInterventionHistory = [];
  firstSessionLivePressure = null;
  clearInvestmentOutcome();
  serviceOutcomeHistory = [];
  serviceRoomStatusHistory = [];
  serviceFocusTarget = null;
  roomHealthHistory = [];
  vacancyAppealFollowups = [];
  vacancyAppealFollowupHistory = [];
  comparisonFloors = [];
  pinnedComparisonFloor = null;
  conversionTargetKind = null;
  renovationTargetId = null;
  rerentTargetId = null;
  demolitionTargetId = null;
  // The autosave belongs to the tower on screen. Clearing the marker means the
  // next day close writes immediately, so a loaded tower is protected from its
  // first day rather than from whenever the previous session last wrote.
  sessionId++;
  lastAutosaveDay = null;
  lastAutosaveAt = 0;
  if (message) toast(message, INFO);
  refresh();
}

function restart() {
  // The tower being thrown away gets one last write first, so "new session"
  // stops being the one button in the game that destroys hours of play. The
  // snapshot inside `writeTower` is taken before anything is awaited, so it
  // captures the OLD tower even though `beginSession` runs on the next line.
  if (state.day > 1 || state.units.length || state.lobby) autosave();
  const fresh = boot(CONFIG, (state.seed % 9999) + 1);
  beginSession(fresh, { message: 'NEW TOWER · previous tower autosaved · seed ' + fresh.seed });
}

/** Hands you the session as JSON. Drop it in replay/ and re-run it after a
 *  tuning change to see what the change did to YOUR play, not the bot's. */
function exportTape() {
  const blob = { schema: 'lift-tape/v1', seed: state.seed, config: CONFIG, tape };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }));
  a.download = 'tape-seed' + state.seed + '.json';
  a.click();
  toast('exported ' + tape.length + ' actions', GOOD);
}

// ------------------------------------------------------------------- saves
//
// Issue #15. A tower is about six hours; before this, closing the tab lost
// one. The snapshot itself lives in `sim/save.js` (pure, tested against a
// resumed tower producing a byte-identical future) and the storage in
// `ui/save-store.js` (IndexedDB, because a played tower outgrows localStorage).
// What is left here is the part that has to touch the live session: taking the
// snapshot, and handing a loaded one to `beginSession` so a save arrives
// through exactly the same door a new game does.

const say = (text, tone = 'info') => {
  setSaves('message', { text, tone });
  toast(text, tone === 'bad' ? BAD : tone === 'good' ? GOOD : INFO);
};

/** Re-read the slot list. Cheap: the rows are metadata, never the towers. */
async function refreshSavesList() {
  const held = memoryOnlyKeys();
  const rows = (await listSaves()).map((row) => ({ ...row, memoryOnly: held.has(row.key) }));
  setSaves('rows', rows);
  setSaves('storageWarning', rows.some((row) => row.memoryOnly)
    ? 'This browser refused to store at least one tower. Anything marked THIS TAB ONLY is gone when the tab closes — export it to a file.'
    : '');
}

/**
 * Snapshot the tower on screen into `key`.
 *
 * The snapshot is taken synchronously, before anything is awaited, so a caller
 * may fire this and immediately replace the tower — which is exactly what
 * `restart` does — and still write the building it meant to.
 */
async function writeTower(key, name) {
  const session = sessionId;
  const day = state.day;
  const blob = snapshot(state, CONFIG, { tape, name });
  const result = await writeSave(key, blob, { name });
  // If the tower changed while the write was in flight, this bookkeeping is
  // about a building nobody is playing any more. Marking the NEW session as
  // already saved would skip its first autosave, which is the one that costs
  // the most to lose.
  if (session === sessionId) {
    lastAutosaveDay = day;
    lastAutosaveAt = Date.now();
  }
  return result;
}

async function saveNamed(rawName) {
  const name = (rawName || '').trim() || 'day ' + state.day + ' · ' + state.floors + ' floors';
  setSaves('busy', true);
  try {
    const { durable, reason } = await writeTower(newSaveKey(), name);
    await refreshSavesList();
    if (durable) say('saved "' + name + '"', 'good');
    else say('"' + name + '" is held in this tab only — ' + reason + ' Export it to a file to keep it.', 'bad');
  } catch (error) {
    say(error.message, 'bad');
  } finally {
    setSaves('busy', false);
  }
}

/**
 * The automatic one. Deliberately quiet — it never toasts, because a message
 * once a day for six hours is noise, and the panel's timestamp is where a
 * player actually checks whether they are covered.
 */
async function autosave() {
  try {
    await writeTower(AUTOSAVE_KEY, 'autosave');
    if (saves.open) await refreshSavesList();
  } catch (error) {
    // A full disk is worth interrupting for: the player is no longer covered
    // and only they can fix it.
    say(error.message, 'bad');
  }
}

async function loadTower(key) {
  setSaves('busy', true);
  try {
    const blob = await readSave(key);
    if (!blob) { say('that save is no longer in this browser.', 'bad'); return; }
    const result = restore(blob, CONFIG);
    if (!result.ok) { say(result.reason, 'bad'); return; }

    // The tuning the tower was played at comes back with it, or it resumes
    // into different physics. Reported rather than applied silently: a save
    // quietly overriding a balance change is how we would end up reading feel
    // notes from numbers we thought we had stopped using.
    applyConfigPatch(CONFIG, result.configPatch);
    syncKnobInputs();

    speed = 0;
    updateTimeControls();
    beginSession(result.state, { tape: Array.isArray(blob.tape) ? blob.tape : [] });
    closeSavesPanel();

    const tuned = result.configPatch.length;
    say('loaded "' + (blob.name || 'save') + '" · day ' + state.day + ' · paused'
      + (tuned ? ' · ' + tuned + ' tuning value' + (tuned === 1 ? '' : 's') + ' restored with it' : ''), 'good');
  } catch (error) {
    say('that save could not be read: ' + error.message, 'bad');
  } finally {
    setSaves('busy', false);
  }
}

async function removeTower(key) {
  await deleteSave(key);
  await refreshSavesList();
  say('save deleted', 'info');
}

const fileSlug = (text) => (text || 'tower').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tower';

async function downloadSave(key) {
  const blob = await readSave(key);
  if (!blob) { say('that save is no longer in this browser.', 'bad'); return; }
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(blob)], { type: 'application/json' }));
  a.href = url;
  a.download = 'lift-' + fileSlug(blob.name) + '-day' + (blob.summary?.day ?? 0) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  say('exported "' + (blob.name || 'save') + '" to a file', 'good');
}

/**
 * Import validates and stores; it deliberately does NOT load. Picking a file
 * should never be the click that destroys the tower on screen — the player
 * loads it from the list afterwards, having seen what is in it.
 */
async function importSaveFile(file) {
  setSaves('busy', true);
  try {
    const text = await file.text();
    let blob;
    try { blob = JSON.parse(text); }
    catch { say('"' + file.name + '" is not readable JSON.', 'bad'); return; }

    const check = restore(blob, CONFIG);
    if (!check.ok) { say(check.reason, 'bad'); return; }

    const name = blob.name || file.name.replace(/\.json$/i, '');
    const { durable, reason } = await writeSave(newSaveKey(), { ...blob, name }, { name });
    await refreshSavesList();
    const summary = check.summary;
    say('imported "' + name + '" · day ' + summary.day + ' · ' + summary.floors + ' floors'
      + (durable ? ' — press load to open it' : ' — held in this tab only (' + reason + ')'),
      durable ? 'good' : 'bad');
  } catch (error) {
    say('that file could not be imported: ' + error.message, 'bad');
  } finally {
    setSaves('busy', false);
  }
}

function openSavesPanel() {
  setSaves('open', true);
  setSaves('confirming', null);
  setSaves('message', null);
  setSaves('autosaveKey', AUTOSAVE_KEY);
  refreshSavesList();
}

function closeSavesPanel() {
  setSaves('open', false);
  setSaves('confirming', null);
}

wireSaves({
  saveNamed,
  load: loadTower,
  remove: removeTower,
  download: downloadSave,
  upload: importSaveFile,
  close: closeSavesPanel,
});

els['open-saves'].addEventListener('click', () => (saves.open ? closeSavesPanel() : openSavesPanel()));

// Leaving the page is the moment a save is worth most, and the moment there is
// least time to write one. `visibilitychange` fires on a tab switch and on the
// way to a close, and is the last hook a browser reliably runs; the write is
// still asynchronous, so this narrows the window rather than closing it. The
// once-a-day autosave is what actually covers a hard kill.
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.day > 1) autosave();
});

// --------------------------------------------------------------- dev knobs
/** Live tuning, permanently. Ship it behind the D key, never delete it. */
const KNOBS = [
  ['time.daySeconds', 10, 180, 5],
  ['elevator.speed', 0.4, 8, 0.2],
  ['elevator.capacity', 2, 40, 1],
  ['elevator.doorTime', 0.1, 3, 0.1],
  ['units.office.patience', 1, 30, 1],
  ['units.office.rent', 50, 1200, 50],
  ['demand.abandonAfter', 10, 120, 5],
  ['occupancy.relistMinDeliveryRate', 0, 100, 5],
  ['occupancy.vacantUpkeep', 0, 400, 10],
  ['economy.upkeepPerFloor', 0, 300, 5],
];

const dig = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const put = (o, p, v) => {
  const k = p.split('.'); const last = k.pop();
  k.reduce((a, x) => a[x], o)[last] = v;
};

els.knobs.innerHTML = '<h3>dev knobs <span>D</span></h3>' + KNOBS.map(([p, min, max, stepv]) =>
  '<label>' + p + ' <output id="o_' + p.replace(/\./g, '_') + '">' + dig(CONFIG, p) + '</output>' +
  '<input type="range" data-path="' + p + '" min="' + min + '" max="' + max + '" step="' + stepv + '" value="' + dig(CONFIG, p) + '"></label>'
).join('');

els.knobs.addEventListener('input', (e) => {
  const p = e.target.dataset.path;
  if (!p) return;
  put(CONFIG, p, Number(e.target.value));
  document.getElementById('o_' + p.replace(/\./g, '_')).textContent = e.target.value;
});

/**
 * Re-read the sliders from the config. Loading a save restores the tuning the
 * tower was played at, and a slider still showing the old number is a knob
 * that lies about what the sim is running — the exact defect the dev panel
 * exists to prevent.
 */
function syncKnobInputs() {
  for (const [path] of KNOBS) {
    const value = dig(CONFIG, path);
    const input = els.knobs.querySelector('input[data-path="' + path + '"]');
    const output = document.getElementById('o_' + path.replace(/\./g, '_'));
    if (input) input.value = String(value);
    if (output) output.textContent = String(value);
  }
}

/**
 * Dev hook. Lets a test or an agent drive the real UI without synthesising
 * mouse coordinates — same seam as a human click, so nothing here is a special
 * path that could pass while the actual game is broken.
 */
window.__lift = {
  get state() { return state; },
  CONFIG, act,
  speed: (v) => { speed = v; },
  tool: (v) => { tool = v; refresh(); },
  /** Advance exactly N sim-seconds. Needed because a backgrounded tab throttles
   *  rAF, so wall-clock waiting cannot land you on a specific moment. */
  stepFor(seconds) {
    const n = Math.round(seconds / CONFIG.time.dt);
    for (let i = 0; i < n && !state.over; i++) step(state, CONFIG.time.dt, CONFIG);
    refresh();
    return { day: state.day, tod: +state.tod.toFixed(3), waiting: state.people.filter((p) => p.state === 'waiting').length };
  },
  /** Fast-forward N whole days without waiting on rAF. */
  skip(days) {
    const until = state.day + days;
    let guard = 0;
    while (state.day < until && !state.over && guard++ < 2e6) {
      step(state, CONFIG.time.dt, CONFIG);
    }
    refresh();
    return state.log[state.log.length - 1];
  },
};

// A read-only window onto the running game, for driving the real page from a
// console or a browser-automation session. Read-only on purpose: every state
// change still has to go through applyAction, so this can never become a
// second way to play. Verifying a UI seam by hunting pixels is how an
// afternoon disappears.
window.__lift = {
  get state() { return state; },
  get tool() { return tool; },
  get camera() { return renderer.camera; },
  layout: () => renderer.layout(state),
  sky: renderer.sky,
  floorAt: (x, y) => renderer.floorAt(state, x, y),
  pickBuildFloor: (x, y) => pickBuildFloor(x, y),
  // The two gates a build click passes through, so a refused placement can be
  // asked WHY without guessing from a toast that may already have cleared.
  armedAction: (toolKey, spot) => armedAction(toolKey, spot),
  verdict: (toolKey, spot) => placementVerdict(toolKey, spot),
};

// ---------------------------------------------------------------- kickoff
addEventListener('resize', () => renderer.resize());
renderer.resize();

// Opening position: nothing built. The FIRST SESSION PATH panel (see
// firstSessionPath()/renderFirstSessionPath()) already walks the player
// through lobby -> shaft -> offices -> add a car step by step — restart()
// already relies on that starting from empty, so first load should match.
tenantUtilizationBaseline = tenantLoadSummary(state, CONFIG).ratio;
tenantUtilizationHistory = [{ day: state.day, ratio: tenantUtilizationBaseline }];

refresh();
toast('paused · click 1x to start · drag to look around · wheel zooms · 0 frames the lobby · space = pause · D = developer details', INFO);
requestAnimationFrame(frame);
requestAnimationFrame(drawClock);
