import { lerp, mix } from './juice.js';
import { buildOccupiedFloorIndex, shaftQueueTrend, tenantDemandQuality, tenantLoadStatus, unitEvaluation, waitingPressureSummary } from '../sim/evaluation.js';
import { localRouteOccupancy } from '../sim/demand.js';
import { freeSlot, slotsUsed } from '../sim/state.js';

/** Convert a floor queue into the same readable pressure scale used by the
 * canvas badge. Twelve waiting people is the critical point; deeper queues stay
 * red instead of making the indicator harder to interpret. */
export function waitingPressure(count) {
  return waitingPressureSummary(count);
}

/** The headcount that is shown in a built room's tenant badge. */
export function tenantCount(unit) {
  const heads = Number(unit?.heads);
  return Number.isFinite(heads) ? Math.max(0, Math.round(heads)) : 0;
}

/** Prefix a floor queue count with a visible, color-independent meaning. */
export function waitingBadgeText(count) {
  return 'W ' + waitingPressure(count).count;
}

/** Prefix a selected shaft queue with its route label. */
export function shaftWaitingBadgeText(shaftNumber, count) {
  const number = Number.isFinite(Number(shaftNumber)) ? Math.max(1, Math.round(Number(shaftNumber))) : '?';
  return 'S' + number + ' · ' + waitingBadgeText(count);
}

/** Keep route trend secondary to the current waiting count in a tiny badge. */
export function shaftQueueTrendMarker(history) {
  const trend = shaftQueueTrend(history);
  if (trend.entries.length < 2) return '';
  if (trend.spike) return '!';
  if (trend.direction === 'rising') return '↑';
  if (trend.direction === 'falling') return '↓';
  return '→';
}

/** Find the floor badges that belong to one shaft's current waiting queue. */
export function shaftQueueOriginFloors(state, shaftId) {
  if (!state || shaftId == null || !Array.isArray(state.people)) return [];
  return [...new Set(state.people
    .filter((person) => person.state === 'waiting' && person.shaft === shaftId)
    .map((person) => Number(person.from))
    .filter((floor) => Number.isFinite(floor)))]
    .sort((a, b) => a - b);
}

/** Find floor badges whose waiting people have no assigned elevator route. */
export function unassignedQueueOriginFloors(state) {
  if (!state || !Array.isArray(state.people)) return [];
  return [...new Set(state.people
    .filter((person) => person.state === 'waiting' && person.shaft == null && !person.localRouteKind)
    .map((person) => Number(person.from))
    .filter((floor) => Number.isFinite(floor)))]
    .sort((a, b) => a - b);
}

/** Prefix a room load count with a visible, color-independent meaning. */
export function tenantBadgeText(unit, config) {
  const load = tenantLoadStatus(unit, config);
  return 'T ' + tenantCount(unit) + '/' + load.capacity;
}

/** Floors that can fulfill a preserved investment target. */
export function placementGuideFloors(guide, state, config) {
  if (!guide || !Number.isInteger(guide.floor) || !state || !config) return [];
  if (guide.kind === 'shaft') {
    const top = Math.min(state.floors - 1, config.elevator.maxSpan - 1);
    return Array.from({ length: Math.max(0, top - guide.floor + 1) }, (_, index) => guide.floor + index);
  }
  const radius = config.services?.[guide.kind]?.coverageFloors;
  if (!Number.isFinite(radius)) return [guide.floor];
  const coverageFloor = Number.isInteger(guide.coverageFloor) ? guide.coverageFloor : guide.floor;
  const low = Math.max(config.building.lobbyFloor + 1, coverageFloor - radius);
  const high = Math.min(state.floors - 1, coverageFloor + radius);
  return Array.from({ length: Math.max(0, high - low + 1) }, (_, index) => low + index);
}

/** Classify a guided floor with the same occupancy rules used by construction. */
export function placementGuideFloorStatus(guide, floor, state, config) {
  if (!placementGuideFloors(guide, state, config).includes(floor)) return 'outside';
  if (guide.kind === 'shaft') {
    const bottom = config.building.lobbyFloor ?? 0;
    const clear = Array.from({ length: config.building.slotsPerFloor }, (_, slot) => slot)
      .some((slot) => Array.from({ length: floor - bottom + 1 }, (_, index) => bottom + index)
        .every((candidateFloor) => !slotsUsed(state, candidateFloor).has(slot)));
    return clear ? 'open' : 'blocked';
  }
  return freeSlot(state, config, floor) >= 0 ? 'open' : 'full';
}

/** Resolve the visible endpoint and first usable column for a local route. */
export function localRouteTargetStatus(target, state, config) {
  const kind = target?.kind;
  const bottom = config?.building?.lobbyFloor ?? 0;
  const top = Number(target?.floor);
  const route = config?.[kind];
  if ((kind !== 'stairs' && kind !== 'escalator') || !Number.isInteger(top) || !route) {
    return { key: 'invalid', bottom, top: null, slot: -1, detail: 'local route target is not valid' };
  }
  if (top <= bottom) {
    return { key: 'invalid', bottom, top, slot: -1, detail: kind + ' must reach an upper floor' };
  }
  if (top - bottom + 1 > route.maxSpan) {
    return { key: 'blocked', bottom, top, slot: -1, detail: kind + ' exceeds its ' + route.maxSpan + '-floor limit' };
  }
  for (let slot = 0; slot < config.building.slotsPerFloor; slot++) {
    const clear = Array.from({ length: top - bottom + 1 }, (_, index) => bottom + index)
      .every((floor) => !slotsUsed(state, floor).has(slot));
    if (clear) return { key: 'ready', bottom, top, slot, detail: 'clear column available' };
  }
  return { key: 'blocked', bottom, top, slot: -1, detail: 'no clear column for ' + kind };
}

/** Floors covered by a focused, already-built service. */
export function serviceFocusFloors(focus, state, config) {
  if (!focus || !Number.isInteger(focus.floor) || !state || !config) return [];
  const radius = Number.isFinite(Number(focus.coverageFloors))
    ? Math.max(0, Number(focus.coverageFloors))
    : config.services?.[focus.kind]?.coverageFloors;
  if (!Number.isFinite(radius)) return [focus.floor];
  const low = Math.max(config.building.lobbyFloor + 1, focus.floor - radius);
  const high = Math.min(state.floors - 1, focus.floor + radius);
  return Array.from({ length: Math.max(0, high - low + 1) }, (_, index) => low + index);
}

/** Explain whether a covered-head drop came from fewer tenants or lost coverage. */
export function serviceFloorHeadcountCause(liveCoveredHeads, recordedCoveredHeads, liveRequiredHeads, recordedRequiredHeads) {
  const liveCovered = Number(liveCoveredHeads) || 0;
  const recordedCovered = Number(recordedCoveredHeads) || 0;
  const delta = liveCovered - recordedCovered;
  if (delta >= 0) return { key: 'stable', delta, requiredDelta: null };
  const liveRequired = Number(liveRequiredHeads);
  const recordedRequired = Number(recordedRequiredHeads);
  const requiredDelta = Number.isFinite(liveRequired) && Number.isFinite(recordedRequired)
    ? liveRequired - recordedRequired
    : null;
  return {
    key: requiredDelta != null && requiredDelta < 0 ? 'vacancy' : 'coverage',
    delta,
    requiredDelta,
  };
}

/** Classify the live service state of one room for daily history. */
export function serviceRoomStatus(unit, evaluation, kind, config) {
  const need = config?.units?.[unit?.kind]?.[kind + 'Need'] ?? 0;
  const liveHeads = unit?.occupied ? Math.max(0, Math.round(unit.heads ?? 0)) : 0;
  if (!need) return { key: 'not_required', liveHeads };
  if (!unit?.occupied) return { key: 'vacant', liveHeads: 0 };
  return { key: evaluation?.[kind + 'Covered'] ? 'covered' : 'uncovered', liveHeads };
}

/** Summarize the direction of a room's recorded service status. */
export function serviceRoomStatusTrend(history) {
  const entries = Array.isArray(history) ? history.filter((entry) => entry?.key) : [];
  const current = entries.at(-1);
  const previous = entries.at(-2);
  if (!current || !previous) return { key: 'stable', label: 'stable', from: previous?.key ?? null, to: current?.key ?? null };
  const rank = { uncovered: 0, vacant: 1, covered: 2, not_required: 2 };
  const currentRank = rank[current.key] ?? 1;
  const previousRank = rank[previous.key] ?? 1;
  const key = currentRank > previousRank ? 'recovering' : currentRank < previousRank ? 'worsening' : 'stable';
  return { key, label: key, from: previous.key, to: current.key };
}

/** Choose the next room action implied by a worsening service trend. */
export function serviceRoomTrendAction(trend, currentKey, kind) {
  if (trend?.key !== 'worsening') return { key: 'none', label: '' };
  if (currentKey === 'uncovered' && kind) return { key: 'coverage', label: 'restore ' + kind + ' coverage' };
  if (currentKey === 'vacant') return { key: 'vacancy', label: 're-rent room before adding service' };
  return { key: 'monitor', label: 'monitor room conditions' };
}

/** Add one room reading while keeping the history bounded and day-stable. */
export function appendServiceRoomStatusHistory(history, reading, roomLimit = 6, totalLimit = 24) {
  if (!reading?.unitId || !reading?.kind || !reading?.key) return Array.isArray(history) ? history : [];
  const source = Array.isArray(history) ? history : [];
  const prior = source.filter((entry) => !(entry.unitId === reading.unitId &&
    entry.kind === reading.kind && entry.day === reading.day));
  const previous = prior.slice().reverse().find((entry) => entry.unitId === reading.unitId && entry.kind === reading.kind);
  const entry = {
    ...reading,
    transitionFrom: previous && previous.key !== reading.key ? previous.key : null,
  };
  const sameRoom = prior.filter((candidate) => candidate.unitId === reading.unitId && candidate.kind === reading.kind)
    .concat(entry).slice(-Math.max(1, roomLimit));
  return prior.filter((candidate) => candidate.unitId !== reading.unitId || candidate.kind !== reading.kind)
    .concat(sameRoom).slice(-Math.max(1, totalLimit));
}

/** Live occupied-room coverage inside a focused facility's area. */
export function serviceFocusCoverage(focus, state, config, floorIndex = null) {
  if (!focus || !state || !config?.services?.[focus.kind]) return null;
  const floors = new Set(serviceFocusFloors(focus, state, config));
  const required = state.units.filter((unit) =>
    unit.occupied && floors.has(unit.floor) && (config.units[unit.kind]?.[focus.kind + 'Need'] ?? 0) > 0);
  const evaluated = required.map((unit) => ({ unit, covered: Boolean(unitEvaluation(state, unit, config, floorIndex)[focus.kind + 'Covered']) }));
  const covered = evaluated.filter(({ covered: isCovered }) => isCovered).map(({ unit }) => unit);
  const uncovered = evaluated.filter(({ covered: isCovered }) => !isCovered).map(({ unit }) => unit);
  const requiredRoomsByFloor = {};
  const coveredRoomsByFloor = {};
  const requiredHeadsByFloor = {};
  const coveredHeadsByFloor = {};
  const uncoveredRoomsByFloor = {};
  const uncoveredHeadsByFloor = {};
  for (const { unit, covered: isCovered } of evaluated) {
    requiredRoomsByFloor[unit.floor] = (requiredRoomsByFloor[unit.floor] ?? 0) + 1;
    requiredHeadsByFloor[unit.floor] = (requiredHeadsByFloor[unit.floor] ?? 0) + (unit.heads ?? 0);
    if (isCovered) {
      coveredRoomsByFloor[unit.floor] = (coveredRoomsByFloor[unit.floor] ?? 0) + 1;
      coveredHeadsByFloor[unit.floor] = (coveredHeadsByFloor[unit.floor] ?? 0) + (unit.heads ?? 0);
      continue;
    }
    uncoveredRoomsByFloor[unit.floor] = (uncoveredRoomsByFloor[unit.floor] ?? 0) + 1;
    uncoveredHeadsByFloor[unit.floor] = (uncoveredHeadsByFloor[unit.floor] ?? 0) + (unit.heads ?? 0);
  }
  return {
    kind: focus.kind,
    floors: [...floors],
    requiredRooms: required.length,
    coveredRooms: covered.length,
    uncoveredRooms: uncovered.length,
    requiredHeads: required.reduce((sum, unit) => sum + (unit.heads ?? 0), 0),
    coveredHeads: covered.reduce((sum, unit) => sum + (unit.heads ?? 0), 0),
    uncoveredHeads: uncovered.reduce((sum, unit) => sum + (unit.heads ?? 0), 0),
    uncoveredFloors: Object.keys(uncoveredRoomsByFloor).map(Number).sort((a, b) => a - b),
    coveredUnitIds: covered.map((unit) => unit.id),
    uncoveredUnitIds: uncovered.map((unit) => unit.id),
    requiredRoomsByFloor,
    coveredRoomsByFloor,
    requiredHeadsByFloor,
    coveredHeadsByFloor,
    uncoveredRoomsByFloor,
    uncoveredHeadsByFloor,
  };
}

/** Name rooms currently served by a focused facility. */
export function serviceFocusCoveredRoomLabel(coverage, state, limit = 3) {
  const rooms = (coverage?.coveredUnitIds ?? [])
    .map((id) => state?.units?.find((unit) => unit.id === id && unit.occupied))
    .filter(Boolean)
    .map((unit) => 'F' + unit.floor + ' ' + unit.kind + ' (' + Math.max(0, Math.round(unit.heads ?? 0)) + ' tenants)');
  if (!rooms.length) return '';
  const shown = rooms.slice(0, Math.max(1, limit));
  return shown.join(', ') + (rooms.length > shown.length ? ' +' + (rooms.length - shown.length) + ' more' : '');
}

/** Return live desirability details for rooms served by a focused facility. */
export function serviceFocusCoveredRoomDetails(coverage, state, config) {
  return (coverage?.coveredUnitIds ?? [])
    .map((id) => state?.units?.find((unit) => unit.id === id && unit.occupied))
    .filter(Boolean)
    .map((unit) => ({
      id: unit.id,
      floor: unit.floor,
      kind: unit.kind,
      heads: Math.max(0, Math.round(unit.heads ?? 0)),
      desirability: tenantDemandQuality(state, unit, config).desirabilityScore,
      stress: Math.max(0, Math.round(Number(unit.stress) || 0)),
    }));
}

/** Summarize room appeal and transport stress without hiding either value. */
export function serviceRoomHealthSignal(room, config) {
  const desirability = Number(room?.desirability);
  const stress = Number(room?.stress);
  const vacateAt = Number(config?.units?.[room?.kind]?.vacateAt) || 0;
  if (!Number.isFinite(desirability) && !Number.isFinite(stress)) {
    return { key: 'unknown', label: 'HEALTH UNKNOWN', colorKey: 'warn', driver: 'unknown' };
  }
  const lowAppeal = Number.isFinite(desirability) && desirability < 55;
  const watchAppeal = Number.isFinite(desirability) && desirability < 80;
  const highStress = vacateAt > 0 && Number.isFinite(stress) && stress >= vacateAt * 0.7;
  const watchStress = vacateAt > 0 && Number.isFinite(stress) && stress >= vacateAt * 0.5;
  const riskDrivers = [lowAppeal ? 'appeal' : null, highStress ? 'transport' : null].filter(Boolean);
  const watchDrivers = [watchAppeal ? 'appeal' : null, watchStress ? 'transport' : null].filter(Boolean);
  if (lowAppeal || highStress) return { key: 'risk', label: 'AT RISK', colorKey: 'bad', driver: riskDrivers.join(' + ') || 'unknown' };
  if (watchAppeal || watchStress) return { key: 'watch', label: 'WATCH', colorKey: 'warn', driver: watchDrivers.join(' + ') || 'unknown' };
  return { key: 'healthy', label: 'HEALTHY', colorKey: 'good', driver: 'none' };
}

/** Name the occupied rooms that remain outside a focused facility's service. */
export function serviceFocusUncoveredRoomLabel(coverage, state, limit = 3) {
  const rooms = (coverage?.uncoveredUnitIds ?? [])
    .map((id) => state?.units?.find((unit) => unit.id === id && unit.occupied))
    .filter(Boolean)
    .map((unit) => 'F' + unit.floor + ' ' + unit.kind + ' (' + Math.max(0, Math.round(unit.heads ?? 0)) + ' tenants)');
  if (!rooms.length) return '';
  const shown = rooms.slice(0, Math.max(1, limit));
  return shown.join(', ') + (rooms.length > shown.length ? ' +' + (rooms.length - shown.length) + ' more' : '');
}

// ------------------------------------------------------------------ camera
//
// The world, in pixels at zoom 1x. These are the native art dimensions from
// spec/sprite-manifest.md, and spec/tower-view.md §8 fixes them: building
// higher makes the tower TALLER, it never makes it smaller. The old
// fit-to-viewport layout drew a slot at 22x14 px at 60 floors — half the grid
// the art is drawn on — which is why the tower got less legible the better you
// played.

/** One unit slot is 48 px wide at 1x. */
export const SLOT_W = 48;
/** One floor is 32 px tall at 1x, forever. */
export const FLOOR_H = 32;
/** Integer only: mixel art shears the moment it is scaled 1.5x. */
export const ZOOM_LEVELS = [1, 2, 3];

/**
 * World coordinates. `x` grows right from slot 0's left edge; `y` grows DOWN
 * from the ground line, which is floor 0's slab. Floor `f` therefore occupies
 * `[-(f+1)*FLOOR_H, -f*FLOOR_H)`.
 *
 * The origin is the ground line rather than the bottom of the tower on
 * purpose: everything at or below `y = 0` is earth today and becomes B1..B10
 * when the sim learns about a floor range (spec §3), without the world origin
 * moving under the player.
 */
export function floorTopWorldY(floor) { return -(floor + 1) * FLOOR_H; }
export function floorBottomWorldY(floor) { return -floor * FLOOR_H; }
export function slotLeftWorldX(slot) { return slot * SLOT_W; }
export function floorAtWorldY(worldY) { return Math.floor(-worldY / FLOOR_H); }
export function slotAtWorldX(worldX) { return Math.floor(worldX / SLOT_W); }

export function clampZoom(zoom) {
  const z = Math.round(Number(zoom) || 1);
  return Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], Math.max(ZOOM_LEVELS[0], z));
}

/** Camera state is `{ x, y, zoom }`, where x/y is the world point sitting at
 *  the CENTER of the viewport. It lives in the renderer and nowhere else. */
export function makeCamera(x = 0, y = 0, zoom = 1) {
  return { x, y, zoom: clampZoom(zoom) };
}

export function worldToScreen(camera, viewport, worldX, worldY) {
  const z = clampZoom(camera.zoom);
  return [(worldX - camera.x) * z + viewport.w / 2, (worldY - camera.y) * z + viewport.h / 2];
}

/** The inverse transform every pick goes through. */
export function screenToWorld(camera, viewport, screenX, screenY) {
  const z = clampZoom(camera.zoom);
  return [(screenX - viewport.w / 2) / z + camera.x, (screenY - viewport.h / 2) / z + camera.y];
}

export function visibleWorldRect(camera, viewport) {
  const [left, top] = screenToWorld(camera, viewport, 0, 0);
  const [right, bottom] = screenToWorld(camera, viewport, viewport.w, viewport.h);
  return { left, top, right, bottom };
}

/** Floors that touch the viewport, so a 60-floor tower only draws what it must. */
export function visibleFloorRange(camera, viewport, floors) {
  const rect = visibleWorldRect(camera, viewport);
  return {
    low: Math.max(0, floorAtWorldY(rect.bottom)),
    high: Math.min(Math.max(0, Math.round(floors) - 1), floorAtWorldY(rect.top)),
  };
}

/** Zoom while holding the world point under `(screenX, screenY)` still — what
 *  makes a wheel zoom land where the player was looking instead of drifting. */
export function cameraZoomedAt(camera, viewport, nextZoom, screenX, screenY) {
  const z = clampZoom(nextZoom);
  const [worldX, worldY] = screenToWorld(camera, viewport, screenX, screenY);
  return {
    x: worldX - (screenX - viewport.w / 2) / z,
    y: worldY - (screenY - viewport.h / 2) / z,
    zoom: z,
  };
}

// ----------------------------------------------------------------- minimap
//
// A narrow vertical strip, one pixel row per floor, with a box marking what
// the main view is looking at (spec §2). It is what makes a 60-floor tower
// navigable, and it is why zoom stays clean integer 1x/2x/3x.

export const MINIMAP = { width: 36, margin: 12, pad: 3, gutter: 5, minRowH: 1, maxRowH: 6 };

export function minimapMetrics(viewport, rows, cols) {
  const rowCount = Math.max(1, Math.round(rows) || 1);
  const colCount = Math.max(1, Math.round(cols) || 1);
  const availH = Math.max(MINIMAP.minRowH, viewport.h - MINIMAP.margin * 2 - MINIMAP.pad * 2);
  const rowH = Math.max(MINIMAP.minRowH, Math.min(MINIMAP.maxRowH, Math.floor(availH / rowCount)));
  const h = rowH * rowCount;
  const cellW = Math.max(1, Math.floor((MINIMAP.width - MINIMAP.gutter) / colCount));
  const w = MINIMAP.gutter + cellW * colCount;
  return {
    x: Math.max(MINIMAP.margin, viewport.w - MINIMAP.margin - MINIMAP.pad - w),
    // Anchored to the bottom, like the tower: floor 0 is the bottom row and
    // the strip grows upward as the building does.
    y: Math.max(MINIMAP.margin, viewport.h - MINIMAP.margin - MINIMAP.pad - h),
    w, h, rowH, cellW, rows: rowCount, cols: colCount,
    gutter: MINIMAP.gutter, pad: MINIMAP.pad,
  };
}

export function minimapRowY(metrics, floor) {
  return metrics.y + metrics.h - (floor + 1) * metrics.rowH;
}

export function minimapFloorAt(metrics, screenY) {
  const floor = Math.floor((metrics.y + metrics.h - screenY) / metrics.rowH);
  return Math.min(metrics.rows - 1, Math.max(0, floor));
}

export function minimapSlotAt(metrics, screenX) {
  const slot = Math.floor((screenX - metrics.x - metrics.gutter) / metrics.cellW);
  return Math.min(metrics.cols - 1, Math.max(0, slot));
}

export function minimapContains(metrics, screenX, screenY) {
  return screenX >= metrics.x - metrics.pad && screenX <= metrics.x + metrics.w + metrics.pad &&
    screenY >= metrics.y - metrics.pad && screenY <= metrics.y + metrics.h + metrics.pad;
}

/**
 * Draws a cross-section of the tower.
 *
 * The single most important thing on this screen is the queue of waiting people.
 * If the player cannot SEE the line growing, the bottleneck is invisible and the
 * failure is unreadable — the headless sweep already proved a tower can fail 97%
 * of its trips while every number on the HUD looks calm. Everything else here is
 * secondary to making that queue legible.
 */
export function makeRenderer(canvas, config) {
  const ctx = canvas.getContext('2d');
  const [BG, PANEL, GOOD, WARN, BAD, INFO] = config.feel.palette;
  const KIND = { office: INFO, condo: GOOD, shop: WARN, hotel: '#c77dff' };
  const indicatorColor = (key) => key === 'good' ? GOOD : key === 'bad' ? BAD : WARN;

  /** Smoothed car positions, so a 30Hz sim reads as continuous motion. */
  const smooth = new Map();
  let W = 0, H = 0, dpr = 1;

  // Fixed relative positions (fraction of width, pixels from the top) so
  // stars don't re-roll every frame or every reload.
  const STARS = [
    [0.06, 10], [0.13, 26], [0.19, 8], [0.27, 34], [0.34, 14], [0.41, 28],
    [0.58, 12], [0.66, 30], [0.73, 6], [0.81, 22], [0.88, 36], [0.94, 16],
  ];

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    const maxDpr = config.feel.maxDpr ?? 1.25;
    const pixelBudget = config.feel.maxCanvasPixels ?? 2000000;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr, Math.sqrt(pixelBudget / Math.max(1, W * H)));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // The camera. Fixed world scale, integer zoom, and it stays where the player
  // put it — see followCamera() for the only three moves it makes on its own.
  const camera = makeCamera(0, 0, 1);
  let framedSeed = null;
  let knownPlacements = null;

  const viewport = () => ({ w: W, h: H });

  /** Keep the tower reachable without snapping: the player may pan a quarter of
   *  a viewport past its edges and no further, so the view can never be lost. */
  function clampCamera(state) {
    const z = camera.zoom;
    const cols = config.building.slotsPerFloor;
    const slackX = W / (4 * z) + SLOT_W;
    const slackY = H / (4 * z) + FLOOR_H;
    const roof = floorTopWorldY(Math.max(0, Math.round(state?.floors ?? 0)) + 2);
    camera.x = Math.min(cols * SLOT_W + slackX, Math.max(-slackX, camera.x));
    // Below the ground line there is only earth for now; leave room for the
    // B1..B10 the sim will grow into (spec §3) without letting the view sink.
    camera.y = Math.min(FLOOR_H * 6 + slackY, Math.max(roof - slackY, camera.y));
  }

  /**
   * The old layout refit the whole tower into the viewport every frame. This
   * one is the camera transform, in the same shape the drawing code already
   * speaks: `x0`/`y0` are where world (0, 0) — slot 0's left edge, the ground
   * line — lands on screen, and one floor is always FLOOR_H * zoom px tall.
   */
  function layout(state) {
    const cols = config.building.slotsPerFloor;
    const cw = SLOT_W * camera.zoom;
    const fh = FLOOR_H * camera.zoom;
    const [x0, y0] = worldToScreen(camera, viewport(), 0, 0);
    return { fh, cw, x0, y0, cols, zoom: camera.zoom, floorY: (f) => y0 - (f + 1) * fh };
  }

  /** True when any part of a column from `bottom` to `top` is on screen. */
  function spanVisible(L, bottom, top, slot) {
    const x = L.x0 + slot * L.cw;
    const spanTop = L.floorY(top);
    const spanBottom = L.floorY(bottom) + L.fh;
    return x + L.cw > 0 && x < W && spanBottom > 0 && spanTop < H;
  }

  function centerOnCell(state, floor, slot) {
    camera.x = slotLeftWorldX(slot) + SLOT_W / 2;
    camera.y = floorTopWorldY(floor) + FLOOR_H / 2;
    clampCamera(state);
  }

  /** The opening shot: the lobby framed on bare ground, at the chunkiest zoom
   *  whose full slot grid still fits the window. */
  function frameLobby(state) {
    const cols = config.building.slotsPerFloor;
    const fits = ZOOM_LEVELS.filter((z) => cols * SLOT_W * z <= W - 80 && FLOOR_H * 8 * z <= H - 80);
    camera.zoom = clampZoom(Math.min(2, fits[fits.length - 1] ?? 1));
    camera.x = (cols * SLOT_W) / 2;
    // Ground line at about 78% of the viewport height: street and a little
    // earth below it, sky and room to build above it.
    camera.y = -(H * 0.28) / camera.zoom;
    clampCamera(state);
  }

  /** Every placed thing, keyed so a new one can be told from an old one, and
   *  carrying its full span: a shaft from the lobby to F20 has NOT landed
   *  off-screen just because its top is, so it must not yank the view. */
  const mark = (id, bottom, top, slot) => ({ id, bottom, top, slot, floor: Math.round((bottom + top) / 2) });

  function placementMarks(state) {
    const marks = [];
    for (const u of state.units) marks.push(mark('u' + u.id, u.floor, u.floor, u.slot));
    for (const f of state.facilities ?? []) marks.push(mark('f' + f.id, f.floor, f.floor, f.slot));
    for (const s of state.shafts) marks.push(mark('s' + s.id, s.bottom, s.top, s.slot));
    for (const s of state.stairs ?? []) marks.push(mark('w' + s.id, s.bottom, s.top, s.slot));
    for (const e of state.escalators ?? []) marks.push(mark('e' + e.id, e.bottom, e.top, e.slot));
    for (const slot of state.lobby?.slots ?? (state.lobby ? [state.lobby.slot] : [])) {
      const lobbyFloor = config.building.lobbyFloor ?? 0;
      marks.push(mark('l' + slot, lobbyFloor, lobbyFloor, slot));
    }
    return marks;
  }

  /**
   * Spec §2, follow rules: the camera stays where the player put it. It may
   * move itself in exactly three cases — first load (frame the lobby), a
   * confirmed placement that landed off-screen, and an explicit "go to" from
   * the HUD (`goTo`). Anything else that yanks the view is a bug.
   */
  function followCamera(state, L) {
    if (!W || !H) return;
    const marks = placementMarks(state);
    if (framedSeed !== state.seed) {
      framedSeed = state.seed;
      knownPlacements = new Set(marks.map((placed) => placed.id));
      frameLobby(state);
      return;
    }
    const fresh = marks.filter((placed) => !knownPlacements.has(placed.id));
    for (const placed of marks) knownPlacements.add(placed.id);
    const offscreen = fresh.find((placed) => !spanVisible(L, placed.bottom, placed.top, placed.slot));
    if (offscreen) centerOnCell(state, offscreen.floor, offscreen.slot);
  }

  function draw(state, juice, dtMs, placementGuide = null, hoverFloor = -1, routeTarget = null, serviceFocus = null, hoverFacilityId = null, selectedShaftId = null, hoverShaftId = null, shaftQueueHistory = null) {
    clampCamera(state);
    followCamera(state, layout(state));
    const L = layout(state);
    const visible = visibleFloorRange(camera, viewport(), state.floors);
    const [sx, sy] = juice.offset();
    // Built once per frame and shared across every room's evaluation below —
    // without it, each occupied room re-scans the whole tower for noise and
    // layout neighbors, 30 times a second, which is what made a grown tower
    // peg a CPU core.
    const floorIndex = buildOccupiedFloorIndex(state);

    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    paintSky(state);
    drawEarth(L);

    for (let f = visible.low; f <= visible.high; f++) {
      const y = L.floorY(f);
      ctx.fillStyle = f === 0 ? '#141c26' : 'rgba(27,36,48,0.55)';
      roundRect(ctx, L.x0 - 6, y, L.cw * L.cols + 12, L.fh - 2, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(142,202,230,0.35)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(f === 0 ? 'L' : String(f), L.x0 - 12, y + L.fh * 0.68);
    }

    // The horizon and the street sit on top of floor 0's slab, so the ground
    // floor reads as a storey standing ON something instead of floating.
    drawStreet(L);

    drawServiceFocus(serviceFocus, state, L, floorIndex);
    drawPlacementGuide(placementGuide, state, L, hoverFloor);

    if (state.lobby) drawLobby(state.lobby, L);
    for (const stair of state.stairs ?? []) drawStairs(stair, L, state);
    for (const escalator of state.escalators ?? []) drawEscalator(escalator, L, state);
    for (const u of state.units) drawUnit(u, L, state, floorIndex);
    for (const facility of state.facilities ?? []) drawFacility(facility, L, serviceFocus?.facilityId === facility.id, hoverFacilityId === facility.id);
    for (const sh of state.shafts) drawShaft(sh, L, dtMs, state, shaftQueueHistory, selectedShaftId === sh.id, hoverShaftId === sh.id);
    drawRouteTarget(routeTarget, state, L, hoverFloor);
    drawQueues(state, L, selectedShaftId, visible);

    juice.draw(ctx);
    // The minimap is screen furniture, not part of the world: it is drawn
    // without the shake offset so it never jitters under the cursor.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMinimap(state, L);
  }

  function drawPlacementGuide(guide, state, L, hoverFloor) {
    const floors = placementGuideFloors(guide, state, config);
    if (!floors.length) return;
    for (const floor of floors) {
      const y = L.floorY(floor);
      const target = floor === guide.floor;
      const hovered = floor === hoverFloor;
      const status = placementGuideFloorStatus(guide, floor, state, config);
      const open = status === 'open';
      ctx.fillStyle = target
        ? (open ? 'rgba(255,183,3,0.16)' : 'rgba(239,71,111,0.15)')
        : (open ? 'rgba(142,202,230,0.08)' : 'rgba(239,71,111,0.08)');
      roundRect(ctx, L.x0 - 6, y, L.cw * L.cols + 12, L.fh - 2, 3);
      ctx.fill();
      ctx.strokeStyle = hovered ? '#ffffff' : target
        ? (open ? 'rgba(255,183,3,0.9)' : 'rgba(239,71,111,0.9)')
        : (open ? 'rgba(142,202,230,0.48)' : 'rgba(239,71,111,0.55)');
      ctx.lineWidth = hovered ? 3 : target ? 2 : 1;
      ctx.setLineDash(hovered || target ? [] : [4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = target ? (open ? '#ffcf55' : '#ff8da6') : (open ? '#a9d8ef' : '#ff9ab0');
      ctx.textAlign = 'right';
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.fillText(target ? (open ? 'TARGET' : 'TARGET FULL') : (open ? 'VALID' : 'FULL'), L.x0 + L.cw * L.cols + 2, y + L.fh * 0.68);
    }
  }

  function drawServiceFocus(focus, state, L, floorIndex = null) {
    const floors = serviceFocusFloors(focus, state, config);
    if (!floors.length) return;
    const changed = new Set(focus.changedFloors ?? []);
    const coverage = serviceFocusCoverage(focus, state, config, floorIndex);
    for (const floor of floors) {
      const y = L.floorY(floor);
      const isFacilityFloor = floor === focus.floor;
      const isChanged = changed.has(floor);
      const uncoveredRooms = coverage?.uncoveredRoomsByFloor?.[floor] ?? 0;
      const hasUncovered = uncoveredRooms > 0;
      ctx.fillStyle = hasUncovered
        ? 'rgba(239,71,111,0.14)'
        : isChanged
        ? 'rgba(255,183,3,0.12)'
        : 'rgba(142,202,230,0.07)';
      roundRect(ctx, L.x0 - 6, y, L.cw * L.cols + 12, L.fh - 2, 3);
      ctx.fill();
      ctx.strokeStyle = hasUncovered
        ? '#ef476f'
        : isChanged || isFacilityFloor
        ? '#ffb703'
        : 'rgba(142,202,230,0.58)';
      ctx.lineWidth = hasUncovered ? 2 : isFacilityFloor ? 3 : isChanged ? 2 : 1;
      ctx.setLineDash(hasUncovered || isFacilityFloor || isChanged ? [] : [5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = hasUncovered ? '#ff8da6' : isChanged || isFacilityFloor ? '#ffcf55' : '#a9d8ef';
      ctx.textAlign = 'right';
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.fillText(isFacilityFloor
        ? 'SERVICE ' + (coverage ? coverage.coveredRooms + '/' + coverage.requiredRooms : '')
        : hasUncovered ? 'UNCOVERED ' + uncoveredRooms : isChanged ? 'CHANGED' : 'COVERED', L.x0 + L.cw * L.cols + 2, y + L.fh * 0.68);
      if (isFacilityFloor && hasUncovered) {
        ctx.fillText('UNCOVERED ' + uncoveredRooms, L.x0 + L.cw * L.cols + 2, y + L.fh * 0.88);
      }
    }
  }

  function drawRouteTarget(target, state, L, hoverFloor) {
    if (!target) return;
    if (target.kind === 'car' && target.shaftId != null) {
      const shaft = state.shafts.find((candidate) => candidate.id === target.shaftId);
      if (!shaft) return;
      const x = L.x0 + shaft.slot * L.cw;
      const top = L.floorY(shaft.top);
      const bottom = L.floorY(shaft.bottom) + L.fh;
      const ready = (shaft.cars?.length ?? 0) < config.elevator.maxCarsPerShaft;
      ctx.strokeStyle = ready ? '#ffb703' : '#ef476f';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      roundRect(ctx, x, top - 1, L.cw, bottom - top, 5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ready ? '#ffcf55' : '#ff8da6';
      ctx.textAlign = 'center';
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.fillText(ready ? 'CAR READY' : 'CAR BLOCKED', x + L.cw / 2, top + 11);
      return;
    }
    if ((target.kind === 'stairs' || target.kind === 'escalator') && Number.isInteger(target.floor)) {
      if (target.floor < 0 || target.floor >= state.floors) return;
      const status = localRouteTargetStatus(target, state, config);
      const y = L.floorY(target.floor);
      const hovered = target.floor === hoverFloor;
      const ready = status.key === 'ready';
      const routeColor = target.kind === 'stairs' ? '#8ecae6' : '#f4a261';
      const fillColor = target.kind === 'stairs' ? 'rgba(142,202,230,0.14)' : 'rgba(244,162,97,0.14)';
      const accent = ready ? '#ffcf55' : '#ff8da6';

      // Show the endpoint across the whole floor, then show the first clear
      // column so the player can see both what is targeted and where it will go.
      ctx.fillStyle = ready ? fillColor : 'rgba(239,71,111,0.12)';
      roundRect(ctx, L.x0 - 6, y, L.cw * L.cols + 12, L.fh - 2, 4);
      ctx.fill();
      ctx.strokeStyle = !ready ? '#ef476f' : hovered ? '#ffffff' : routeColor;
      ctx.lineWidth = hovered ? 3 : 2;
      ctx.setLineDash([6, 4]);
      roundRect(ctx, L.x0 - 6, y, L.cw * L.cols + 12, L.fh - 2, 4);
      ctx.stroke();
      ctx.setLineDash([]);

      if (status.slot >= 0) {
        const x = L.x0 + status.slot * L.cw;
        const top = L.floorY(status.top);
        const bottom = L.floorY(status.bottom) + L.fh;
        ctx.strokeStyle = routeColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        roundRect(ctx, x + 2, top + 1, L.cw - 4, bottom - top - 2, 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = accent;
      ctx.textAlign = 'right';
      ctx.font = '700 8px ui-monospace, monospace';
      const label = target.kind === 'stairs' ? 'STAIRS' : 'ESCALATOR';
      ctx.fillText(label + (ready ? ' TARGET' : ' BLOCKED'), L.x0 + L.cw * L.cols + 2, y + L.fh * 0.68);
      return;
    }
    if (target.kind !== 'shaft' || !Number.isInteger(target.floor) || target.floor < 0 || target.floor >= state.floors) return;
    if (Number.isInteger(target.slot)) {
      const bottomFloor = config.building.lobbyFloor ?? 0;
      const topFloor = target.floor;
      const span = topFloor - bottomFloor + 1;
      const inBounds = target.slot >= 0 && target.slot < L.cols && topFloor > bottomFloor && span <= config.elevator.maxSpan;
      const clear = inBounds && Array.from({ length: span }, (_, index) => bottomFloor + index)
        .every((floor) => !slotsUsed(state, floor).has(target.slot));
      const x = L.x0 + target.slot * L.cw;
      const top = L.floorY(topFloor);
      const bottom = L.floorY(bottomFloor) + L.fh;
      ctx.strokeStyle = clear ? '#ffb703' : '#ef476f';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      roundRect(ctx, x + 2, top + 1, L.cw - 4, bottom - top - 2, 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = clear ? '#ffcf55' : '#ff8da6';
      ctx.textAlign = 'center';
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.fillText(clear ? 'SHAFT C' + (target.slot + 1) : 'BLOCKED', x + L.cw / 2, top + 11);
      return;
    }
    const y = L.floorY(target.floor);
    const hovered = target.floor === hoverFloor;
    const ready = target.floor > (config.building.lobbyFloor ?? 0) &&
      placementGuideFloorStatus({ kind: 'shaft', floor: target.floor }, target.floor, state, config) === 'open';
    ctx.strokeStyle = !ready ? '#ef476f' : hovered ? '#ffffff' : '#ffb703';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.setLineDash([6, 4]);
    roundRect(ctx, L.x0 - 6, y, L.cw * L.cols + 12, L.fh - 2, 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ready ? '#ffcf55' : '#ff8da6';
    ctx.textAlign = 'right';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillText(ready ? (target.recommended ? 'SHORTER READY' : 'ROUTE READY') : 'ROUTE BLOCKED', L.x0 + L.cw * L.cols + 2, y + L.fh * 0.68);
  }

  /** Sky shifts through the day. Cheap, and it makes a rush hour feel like one. */
  function paintSky(state) {
    const night = [8, 10, 22], day = [66, 100, 138], dawnDusk = [214, 132, 84];
    // Same day-ness curve the old version used: 0 through the night hours,
    // 1 at midday, smooth in between. Reused below for the sun/moon arc too.
    const k = Math.sin(Math.PI * Math.min(1, Math.max(0, (state.tod - 0.05) / 0.9)));
    // Peaks mid-transition (dawn/dusk) and is 0 at full night or full day.
    const twilight = Math.sin(Math.PI * k);
    const c = night.map((n, i) => Math.round(lerp(lerp(n, day[i], k), dawnDusk[i], twilight * 0.35)));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + c.join(',') + ')');
    g.addColorStop(1, BG);
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, W + 120, H + 120);

    if (k < 0.4) {
      const starAlpha = ((0.4 - k) / 0.4) * 0.8;
      ctx.fillStyle = 'rgba(219,228,238,' + starAlpha.toFixed(2) + ')';
      for (const [fx, sy] of STARS) {
        ctx.beginPath();
        ctx.arc(fx * W, sy, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const isDay = k > 0.5;
    const x = 40 + state.tod * (W - 80);
    const y = 26 + (1 - k) * 40;
    ctx.globalAlpha = isDay ? 0.92 : 0.8;
    ctx.fillStyle = isDay ? '#ffd76a' : '#cfd8e8';
    ctx.beginPath();
    ctx.arc(x, y, isDay ? 9 : 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // The street tile is the bottom 16 world px of the ground floor — half a
  // floor, which is exactly the 48x16 ground-street.png / ground-entrance.png
  // grid in spec/asset-request.md. These are placeholder rectangles on that
  // grid: the geometry is the deliverable, the art lands on top of it later.
  const STREET_H = 16;
  const streetHeight = (L) => STREET_H * L.zoom;

  /** Everything below the ground line. Earth today, B1..B10 once the sim
   *  carries a floor range (spec §3). */
  function drawEarth(L) {
    const groundY = L.y0;
    if (groundY > H + 60) return;
    const top = Math.max(-60, groundY);
    const soil = ctx.createLinearGradient(0, groundY, 0, groundY + H + 120);
    soil.addColorStop(0, '#3b2d21');
    soil.addColorStop(1, '#150f0b');
    ctx.fillStyle = soil;
    ctx.fillRect(-60, top, W + 120, H + 120 - top);

    // One stratum per floor height, so depth reads at any zoom and the future
    // basements already have their grid drawn under them.
    const step = FLOOR_H * L.zoom;
    if (step >= 6) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1;
      for (let y = groundY + step; y < H + 60; y += step) {
        if (y < -60) continue;
        ctx.beginPath();
        ctx.moveTo(-60, Math.round(y) + 0.5);
        ctx.lineTo(W + 60, Math.round(y) + 0.5);
        ctx.stroke();
      }
    }
  }

  /** Sidewalk, curb, and the ground line itself. */
  function drawStreet(L) {
    const groundY = L.y0;
    const sh = streetHeight(L);
    const streetTop = groundY - sh;
    if (streetTop < H && groundY > -sh) {
      ctx.fillStyle = '#48525e';
      ctx.fillRect(-60, streetTop, W + 120, sh);
      // Paving joints on the 48 px art grid, so the placeholder tiles exactly
      // where ground-street.png will.
      const tile = SLOT_W * L.zoom;
      if (tile >= 10) {
        ctx.strokeStyle = 'rgba(18,24,32,0.55)';
        ctx.lineWidth = 1;
        const first = L.x0 - Math.ceil((L.x0 + 60) / tile) * tile;
        for (let x = first; x < W + 60; x += tile) {
          ctx.beginPath();
          ctx.moveTo(Math.round(x) + 0.5, streetTop + 1);
          ctx.lineTo(Math.round(x) + 0.5, groundY - 1);
          ctx.stroke();
        }
      }
      // Curb above, gutter below: the two edges that turn a grey band into a
      // street rather than another floor.
      ctx.fillStyle = '#69747f';
      ctx.fillRect(-60, streetTop, W + 120, Math.max(1, L.zoom));
      ctx.fillStyle = '#20262e';
      ctx.fillRect(-60, groundY - Math.max(1, L.zoom * 2), W + 120, Math.max(1, L.zoom * 2));
    }
    ctx.strokeStyle = PANEL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-60, groundY + 1);
    ctx.lineTo(W + 60, groundY + 1);
    ctx.stroke();
  }

  /** The minimap strip: one row per floor, colored by the pressure signals the
   *  main view already computes, with a box marking what it is looking at. */
  function drawMinimap(state, L) {
    if (!W || !H) return;
    const rows = Math.max(1, state.floors);
    const m = minimapMetrics(viewport(), rows, L.cols);
    ctx.fillStyle = 'rgba(10,13,18,0.86)';
    roundRect(ctx, m.x - m.pad, m.y - m.pad, m.w + m.pad * 2, m.h + m.pad * 2, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(142,202,230,0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const cells = new Map();
    const mark = (floor, slot, color) => {
      if (floor < 0 || floor >= rows || slot < 0 || slot >= m.cols) return;
      if (!cells.has(floor)) cells.set(floor, new Map());
      cells.get(floor).set(slot, color);
    };
    for (const u of state.units) mark(u.floor, u.slot, u.occupied ? KIND[u.kind] : 'rgba(140,150,165,0.55)');
    for (const facility of state.facilities ?? []) mark(facility.floor, facility.slot, '#b388ff');
    for (const route of [...(state.stairs ?? []), ...(state.escalators ?? [])]) {
      for (let f = route.bottom; f <= route.top; f++) mark(f, route.slot, 'rgba(142,202,230,0.45)');
    }
    for (const shaft of state.shafts) {
      for (let f = shaft.bottom; f <= shaft.top; f++) mark(f, shaft.slot, shaft.kind === 'express' ? '#c77dff' : '#5aa9e6');
    }
    for (const slot of state.lobby?.slots ?? (state.lobby ? [state.lobby.slot] : [])) {
      mark(config.building.lobbyFloor ?? 0, slot, '#5aa9e6');
    }

    const waiting = new Map();
    for (const person of state.people) {
      if (person.state !== 'waiting') continue;
      waiting.set(person.from, (waiting.get(person.from) ?? 0) + 1);
    }

    const gridX = m.x + m.gutter;
    for (let f = 0; f < rows; f++) {
      const y = minimapRowY(m, f);
      ctx.fillStyle = 'rgba(27,36,48,0.85)';
      ctx.fillRect(gridX, y, m.cellW * m.cols, m.rowH);
      const row = cells.get(f);
      if (row) for (const [slot, color] of row) {
        ctx.fillStyle = color;
        ctx.fillRect(gridX + slot * m.cellW, y, m.cellW, m.rowH);
      }
      // The pressure gutter. This is the whole point of the strip: a queue
      // building on F41 has to be visible while you are looking at F3.
      const pressure = waitingPressure(waiting.get(f) ?? 0);
      ctx.globalAlpha = 0.3 + pressure.ratio * 0.7;
      ctx.fillStyle = indicatorColor(pressure.colorKey);
      ctx.fillRect(m.x, y, m.gutter - 1, m.rowH);
      ctx.globalAlpha = 1;
    }

    const rect = visibleWorldRect(camera, viewport());
    const high = Math.min(rows - 1, Math.max(0, floorAtWorldY(rect.top)));
    const low = Math.min(high, Math.max(0, floorAtWorldY(rect.bottom)));
    const clampSlot = (worldX) => Math.min(m.cols, Math.max(0, worldX / SLOT_W));
    const boxX = gridX + clampSlot(rect.left) * m.cellW;
    const boxRight = gridX + clampSlot(rect.right) * m.cellW;
    const boxTop = minimapRowY(m, high);
    const boxBottom = minimapRowY(m, low) + m.rowH;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(boxX) + 0.5, Math.round(boxTop) + 0.5,
      Math.max(2, Math.round(boxRight - boxX) - 1), Math.max(2, Math.round(boxBottom - boxTop) - 1));

    // The zoom level, above the strip. A camera nobody can see the state of is
    // a camera nobody trusts.
    ctx.fillStyle = 'rgba(142,202,230,0.7)';
    ctx.textAlign = 'right';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.fillText(camera.zoom + 'x', m.x + m.w, m.y - m.pad - 5);
  }

  function drawUnit(u, L, state, floorIndex = null) {
    const x = L.x0 + u.slot * L.cw, y = L.floorY(u.floor);
    if (x + L.cw < 0 || x > W || y + L.fh < 0 || y > H) return;
    const tune = config.units[u.kind];

    if (!u.occupied) {
      ctx.fillStyle = 'rgba(120,130,145,0.16)';
      roundRect(ctx, x + 2, y + 3, L.cw - 4, L.fh - 8, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,130,145,0.4)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(174,189,202,0.65)';
      ctx.textAlign = 'center';
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.fillText('EMPTY', x + L.cw / 2, y + L.fh * 0.58);
      drawTenantBadge(u, x, y, L);
      return;
    }

    const evaluation = unitEvaluation(state, u, config, floorIndex);
    const quality = 1 - evaluation.score / 100;
    const stress = Math.min(1, u.stress / tune.vacateAt);
    ctx.fillStyle = quality > 0.05 ? mix(KIND[u.kind], BAD, quality) : KIND[u.kind];
    ctx.globalAlpha = 0.86;
    roundRect(ctx, x + 2, y + 3, L.cw - 4, L.fh - 8, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Tenant patience, made visible along the bottom edge.
    if (stress > 0.02) {
      ctx.fillStyle = stress > 0.66 ? BAD : WARN;
      ctx.fillRect(x + 2, y + L.fh - 7, (L.cw - 4) * stress, 2);
    }

    drawTenantBadge(u, x, y, L);
  }

  // The room color communicates quality; this small badge communicates how
  // many tenants occupy the room, which is a different decision signal.
  function drawTenantBadge(u, x, y, L) {
    const load = tenantLoadStatus(u, config);
    const loadColor = indicatorColor(load.colorKey);
    const badgeText = tenantBadgeText(u, config);
    const badgeW = Math.max(27, badgeText.length * 6 + 10);
    const badgeX = x + L.cw - badgeW - 5;
    const badgeY = y + 5;
    ctx.fillStyle = 'rgba(14,17,22,0.72)';
    roundRect(ctx, badgeX, badgeY, badgeW, 13, 3);
    ctx.fill();
    ctx.strokeStyle = loadColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = loadColor;
    ctx.textAlign = 'center';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 9.5);
  }

  function drawShaft(sh, L, dtMs, state, shaftQueueHistory = null, focused = false, hovered = false) {
    const x = L.x0 + sh.slot * L.cw;
    const top = L.floorY(sh.top), bot = L.floorY(sh.bottom) + L.fh;
    if (x + L.cw < 0 || x > W || bot < 0 || top > H) return;
    const express = sh.kind === 'express';

    ctx.fillStyle = express ? 'rgba(24,13,36,0.92)' : 'rgba(8,11,15,0.9)';
    roundRect(ctx, x + 3, top + 1, L.cw - 6, bot - top - 2, 4);
    ctx.fill();
    ctx.strokeStyle = express ? 'rgba(199,125,255,0.55)' : 'rgba(142,202,230,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (express) {
      // Sky-lobby landings: the only two floors this shuttle serves. Everything
      // between is deliberately skipped, and the dashed spine says so.
      ctx.strokeStyle = 'rgba(199,125,255,0.45)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(x + L.cw / 2, top + 4);
      ctx.lineTo(x + L.cw / 2, bot - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#c77dff';
      for (const landing of [sh.bottom, sh.top]) {
        const y = L.floorY(landing);
        ctx.fillRect(x + 4, y + L.fh - 5, L.cw - 8, 3);
      }
      ctx.textAlign = 'center';
      ctx.font = '700 7px ui-monospace, monospace';
      ctx.fillText('EXP', x + L.cw / 2, top + 9);
    }
    if (focused || hovered) {
      ctx.strokeStyle = focused ? '#ffcf55' : '#ffffff';
      ctx.lineWidth = focused ? 3 : 2;
      roundRect(ctx, x + 1, top, L.cw - 2, bot - top, 4);
      ctx.stroke();
    }

    for (const car of sh.cars) {
      const want = L.floorY(car.y) + 3;
      const cur = smooth.has(car.id) ? smooth.get(car.id) : want;
      const next = lerp(cur, want, Math.min(1, dtMs / config.feel.tweenMs));
      smooth.set(car.id, next);

      const full = car.riders.length /
        (express ? (config.elevator.express?.capacity ?? config.elevator.capacity) : config.elevator.capacity);
      ctx.fillStyle = car.state === 'doors' ? GOOD : mix(INFO, WARN, full);
      roundRect(ctx, x + 5, next, L.cw - 10, L.fh - 8, 3);
      ctx.fill();

      if (car.riders.length) {
        ctx.fillStyle = '#0e1116';
        ctx.textAlign = 'center';
        ctx.font = '700 10px ui-monospace, monospace';
        ctx.fillText(String(car.riders.length), x + L.cw / 2, next + L.fh * 0.52);
      }
    }

    // The inspector gives the selected shaft a detailed readout; this compact
    // badge keeps a selected or hovered shaft's queue pressure visible while
    // the player is comparing routes on the building itself. It uses the same
    // W count and color bands as the floor badges and shaft inspector.
    if (focused || hovered) {
      const waiting = state.people.filter((person) => person.state === 'waiting' && person.shaft === sh.id).length;
      const pressure = waitingPressure(waiting);
      const history = shaftQueueHistory instanceof Map ? shaftQueueHistory.get(sh.id) : null;
      const trendMarker = shaftQueueTrendMarker(history);
      const badgeText = shaftWaitingBadgeText(state.shafts.indexOf(sh) + 1, waiting) + (trendMarker ? ' ' + trendMarker : '');
      const badgeW = Math.max(30, badgeText.length * 6 + 10), badgeH = 14;
      const rightX = x + L.cw + 4;
      const badgeX = rightX + badgeW <= W ? rightX : Math.max(2, x - badgeW - 4);
      const badgeY = Math.max(2, top + 4);
      ctx.fillStyle = indicatorColor(pressure.colorKey);
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();
      ctx.strokeStyle = focused ? '#ffcf55' : '#ffffff';
      ctx.lineWidth = focused ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = '#0e1116';
      ctx.textAlign = 'center';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 10);
    }
  }

  /** The queue: a line of dots on the landing, reddening and jittering as the
   *  wait grows. This is the readout the whole design depends on. */
  function drawQueues(state, L, selectedShaftId = null, visible = null) {
    const byFloor = new Map();
    for (const p of state.people) {
      if (p.state !== 'waiting') continue;
      if (!byFloor.has(p.from)) byFloor.set(p.from, []);
      byFloor.get(p.from).push(p);
    }
    const selectedOriginFloors = new Set(shaftQueueOriginFloors(state, selectedShaftId));
    const unassignedOriginFloors = new Set(unassignedQueueOriginFloors(state));

    // Every floor gets a count badge, including a green 0. This makes the
    // amount of waiting visible before a queue is large enough to form a bar.
    const low = visible ? visible.low : 0;
    const high = visible ? visible.high : state.floors - 1;
    for (let floor = low; floor <= high; floor++) {
      const queue = byFloor.get(floor) || [];
      const pressure = waitingPressure(queue.length);
      const badgeText = waitingBadgeText(queue.length);
      const badgeW = Math.max(32, badgeText.length * 6 + 10), badgeH = 14;
      const badgeX = Math.max(2, L.x0 - badgeW - 18);
      const badgeY = L.floorY(floor) + L.fh * 0.28;
      ctx.fillStyle = indicatorColor(pressure.colorKey);
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();
      if (unassignedOriginFloors.has(floor)) {
        ctx.strokeStyle = BAD;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (selectedOriginFloors.has(floor)) {
        ctx.strokeStyle = '#ffcf55';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = '#0e1116';
      ctx.textAlign = 'center';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 10);
    }

    for (const [floor, queue] of byFloor) {
      if (floor < low || floor > high) continue;
      const y = L.floorY(floor) + L.fh - 9;
      queue.sort((a, b) => b.waitT - a.waitT);

      // Crowd bar FIRST. A per-person dot row caps out and then stops growing,
      // so a 276-deep queue rendered as the same thin line as a 22-deep one and
      // the tower looked healthy at a glance. Depth has to be visible as mass.
      const pressure = waitingPressure(queue.length);
      const depth = pressure.ratio;
      if (queue.length > 4) {
        ctx.globalAlpha = 0.22 + depth * 0.5;
        ctx.fillStyle = mix(GOOD, BAD, depth);
        const barW = (L.cw * L.cols - 8) * Math.min(1, queue.length / 90);
        roundRect(ctx, L.x0 + 2, y - 5, Math.max(6, barW), 10, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const shown = Math.min(queue.length, 26);
      for (let i = 0; i < shown; i++) {
        const p = queue[i];
        const heat = Math.min(1, p.waitT / config.demand.abandonAfter);
        ctx.fillStyle = mix(GOOD, BAD, heat);
        const bob = Math.sin((p.waitT + i) * 3) * (heat * 1.8);
        ctx.beginPath();
        ctx.arc(L.x0 + 6 + i * 5.5, y + bob, 2.4 + heat * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (queue.length > shown) {
        // Dark on the crowd bar: the count was drawn in the same red as the bar
        // it sits on, which made the loudest number on screen unreadable.
        ctx.fillStyle = queue.length > 4 ? '#12161c' : BAD;
        ctx.textAlign = 'left';
        ctx.font = '700 13px ui-monospace, monospace';
        ctx.fillText('+' + (queue.length - shown) + ' waiting', L.x0 + 12 + shown * 5.5, y + 5);
      }
    }
  }

  /** Screen position of a unit, so the UI can throw a floater at it. */
  function unitPos(state, u) {
    const L = layout(state);
    return [L.x0 + u.slot * L.cw + L.cw / 2, L.floorY(u.floor)];
  }

  /** Which floor a click landed on, for build placement. */
  function floorAt(state, px, py) {
    const L = layout(state);
    const f = Math.floor((L.y0 - py) / L.fh);
    return f >= 0 && f < state.floors ? f : -1;
  }

  /** Which floor slot a click landed in, for ground-floor lobby placement. */
  function slotAt(state, px) {
    const L = layout(state);
    const slot = Math.floor((px - L.x0) / L.cw);
    return slot >= 0 && slot < L.cols ? slot : -1;
  }

  /** Which unit a player clicked, including an abandoned unit. */
  function unitAt(state, px, py) {
    const L = layout(state);
    for (const u of state.units) {
      const x = L.x0 + u.slot * L.cw, y = L.floorY(u.floor);
      if (px >= x && px <= x + L.cw && py >= y && py <= y + L.fh) return u.id;
    }
    return null;
  }

  /** Which built service facility a player clicked, for direct inspection. */
  function facilityAt(state, px, py) {
    const L = layout(state);
    for (const facility of state.facilities ?? []) {
      const x = L.x0 + facility.slot * L.cw, y = L.floorY(facility.floor);
      if (px >= x && px <= x + L.cw && py >= y && py <= y + L.fh) return facility.id;
    }
    return null;
  }

  function drawFacility(facility, L, focused = false, hovered = false) {
    const x = L.x0 + facility.slot * L.cw, y = L.floorY(facility.floor);
    if (x + L.cw < 0 || x > W || y + L.fh < 0 || y > H) return;
    ctx.fillStyle = facility.kind === 'parking' ? '#f4a261'
      : facility.kind === 'security' ? '#e76f51'
        : facility.kind === 'recycling' ? '#2a9d8f' : '#b388ff';
    ctx.globalAlpha = 0.88;
    roundRect(ctx, x + 2, y + 3, L.cw - 4, L.fh - 8, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (focused || hovered) {
      ctx.strokeStyle = focused ? '#ffcf55' : '#ffffff';
      ctx.lineWidth = focused ? 3 : 2;
      roundRect(ctx, x + 1, y + 2, L.cw - 2, L.fh - 6, 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#241b35';
    ctx.textAlign = 'center';
    ctx.font = '700 8px ui-monospace, monospace';
    const label = facility.kind === 'food' ? 'FOOD'
      : facility.kind === 'parking' ? 'PARK'
      : facility.kind === 'medical' ? 'MED'
        : facility.kind === 'security' ? 'SEC'
          : facility.kind === 'recycling' ? 'REC' : facility.kind.toUpperCase();
    ctx.fillText(label, x + L.cw / 2, y + L.fh * 0.58);
  }

  /** The lobby sits in the upper band of the ground floor; the lower band is
   *  the street, where its entrance reads as an actual way in. */
  function drawLobby(lobby, L) {
    const y = L.floorY(config.building.lobbyFloor ?? 0);
    const sh = streetHeight(L);
    const roomH = Math.max(5, L.fh - sh - 4);
    const lobbySlots = lobby.slots ?? [lobby.slot];
    for (const slot of lobbySlots) {
      const x = L.x0 + slot * L.cw;
      if (x + L.cw < 0 || x > W) continue;
      ctx.fillStyle = '#5aa9e6';
      ctx.globalAlpha = 0.9;
      roundRect(ctx, x + 2, y + 3, L.cw - 4, roomH, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#102235';
      ctx.textAlign = 'center';
      ctx.font = '700 8px ui-monospace, monospace';
      if (roomH >= 10) ctx.fillText('LOBBY', x + L.cw / 2, y + roomH * 0.5 + 6);

      // Entrance: a doorway in the street band with a canopy over it. The
      // placeholder for ground-entrance.png, on the same 48x16 tile.
      const doorTop = y + L.fh - sh;
      const doorW = Math.max(6, L.cw * 0.44);
      const doorX = x + (L.cw - doorW) / 2;
      ctx.fillStyle = '#9fd3f0';
      ctx.fillRect(x + 2, doorTop, L.cw - 4, Math.max(1, L.zoom));
      ctx.fillStyle = '#0d1a26';
      ctx.fillRect(doorX, doorTop + Math.max(1, L.zoom), doorW, Math.max(2, sh - L.zoom * 2));
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(doorX + doorW / 2 - Math.max(0.5, L.zoom / 2), doorTop + Math.max(1, L.zoom), Math.max(1, L.zoom), Math.max(2, sh - L.zoom * 2));
    }
  }

  function drawStairs(stair, L, state) {
    const x = L.x0 + stair.slot * L.cw;
    const top = L.floorY(stair.top), bot = L.floorY(stair.bottom) + L.fh;
    const occupancy = localRouteOccupancy(state, 'stairs', stair.id);
    const capacity = Math.max(1, Math.floor(Number(config.stairs?.capacity) || 0));
    const full = occupancy >= capacity;
    ctx.fillStyle = 'rgba(90,169,230,0.22)';
    roundRect(ctx, x + 3, top + 1, L.cw - 6, bot - top - 2, 4);
    ctx.fill();
    ctx.strokeStyle = full ? '#ef476f' : 'rgba(142,202,230,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 6, bot - 6);
    ctx.lineTo(x + L.cw - 6, top + 8);
    ctx.stroke();
    ctx.fillStyle = full ? '#ff8da6' : '#8ecae6';
    ctx.textAlign = 'center';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillText('STAIRS ' + occupancy + '/' + capacity, x + L.cw / 2, bot - 7);
  }

  function drawEscalator(escalator, L, state) {
    const x = L.x0 + escalator.slot * L.cw;
    const top = L.floorY(escalator.top), bot = L.floorY(escalator.bottom) + L.fh;
    const occupancy = localRouteOccupancy(state, 'escalator', escalator.id);
    const capacity = Math.max(1, Math.floor(Number(config.escalator?.capacity) || 0));
    const full = occupancy >= capacity;
    ctx.fillStyle = 'rgba(244,162,97,0.24)';
    roundRect(ctx, x + 3, top + 1, L.cw - 6, bot - top - 2, 4);
    ctx.fill();
    ctx.strokeStyle = full ? '#ef476f' : '#f4a261';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, bot - 6);
    ctx.lineTo(x + L.cw - 6, top + 8);
    ctx.stroke();
    ctx.fillStyle = full ? '#ff8da6' : '#ffd1ad';
    ctx.textAlign = 'center';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillText('ESC ' + occupancy + '/' + capacity, x + L.cw / 2, bot - 7);
  }

  /** Which elevator shaft a click landed on, for car placement. */
  function shaftAt(state, px, py) {
    const L = layout(state);
    for (const sh of state.shafts) {
      const x = L.x0 + sh.slot * L.cw;
      const top = L.floorY(sh.top);
      const bottom = L.floorY(sh.bottom) + L.fh;
      if (px >= x && px <= x + L.cw && py >= top && py <= bottom) return sh.id;
    }
    return null;
  }

  // ------------------------------------------------------- camera controls
  // The UI drives these; it never reads or writes the camera itself, which is
  // what keeps every pick going through the one inverse transform above.

  /** The pointer moved by (dx, dy) with a drag in progress: move the world with it. */
  function dragBy(state, dx, dy) {
    camera.x -= dx / camera.zoom;
    camera.y -= dy / camera.zoom;
    clampCamera(state);
  }

  /** Zoom to an integer level, holding the world point under the cursor still. */
  function setZoom(state, nextZoom, anchorX = W / 2, anchorY = H / 2) {
    const next = clampZoom(nextZoom);
    if (next !== camera.zoom) {
      const moved = cameraZoomedAt(camera, viewport(), next, anchorX, anchorY);
      camera.x = moved.x;
      camera.y = moved.y;
      camera.zoom = moved.zoom;
      clampCamera(state);
    }
    return camera.zoom;
  }

  const zoomBy = (state, steps, anchorX, anchorY) => setZoom(state, camera.zoom + steps, anchorX, anchorY);

  /** The HUD's explicit "go to" — the third and last case where the camera is
   *  allowed to move itself (spec §2). */
  function goTo(state, floor, slot = null) {
    centerOnCell(state, Math.max(0, Math.round(floor) || 0),
      slot == null ? (config.building.slotsPerFloor - 1) / 2 : slot);
  }

  const minimapAt = (state, px, py) => {
    const m = minimapMetrics(viewport(), Math.max(1, state.floors), config.building.slotsPerFloor);
    return minimapContains(m, px, py) ? { floor: minimapFloorAt(m, py), slot: minimapSlotAt(m, px) } : null;
  };

  /** Click or drag the strip to jump. Returns false when the point was not on it. */
  function minimapJump(state, px, py) {
    const hit = minimapAt(state, px, py);
    if (!hit) return false;
    centerOnCell(state, hit.floor, hit.slot);
    return true;
  }

  return {
    draw, resize, layout, unitPos, floorAt, slotAt, unitAt, facilityAt, shaftAt,
    dragBy, setZoom, zoomBy, goTo, frameLobby, minimapAt, minimapJump,
    get size() { return [W, H]; },
    get camera() { return { ...camera }; },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
