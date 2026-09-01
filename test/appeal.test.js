/**
 * Appeal, made visible before it costs you the tenant (issues #10 and #12).
 *
 * The bug these lock down: Keith's tower ran delivery at 100% and reputation
 * at 100 and lost every tenant anyway, to room appeal, with nothing on screen
 * before it happened. Appeal was only ever a post-mortem, because it was shown
 * as a SCORE and as a red fade over pixels that were already colour-coded
 * twice. `desirabilityPressure` was a deadline the whole time.
 *
 * So: a wick that is silent on healthy rooms and burns toward departure on the
 * ones at risk (#10), and an on-demand overlay that tints the whole tower by
 * appeal (#12) — never always-on, because a fourth permanent marker drowns the
 * W badges, the T badges and the stress line the tower already carries.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FLOOR_H, SLOT_W, ZOOM_LEVELS, appealOverlayBand, departureWickBox, departureWickRatio, makeRenderer,
} from '../src/games/lift/render/canvas.js';
import { roomDesirabilityScore, unitEvaluation } from '../src/games/lift/sim/evaluation.js';
import { applyAction, boot } from '../src/games/lift/sim/index.js';
import { CONFIG } from '../src/games/lift/config.js';

const assert = (c, m) => { if (!c) throw new Error(m); };
const here = path.dirname(fileURLToPath(import.meta.url));
const VACATE_AT = CONFIG.occupancy.desirabilityRetentionVacateAt;

function stubCtx() {
  return new Proxy({}, { get: (target, key) => (key in target ? target[key] : () => stubCtx()) });
}

/** Records every drawing call with the arguments it was given, so a test can
 *  ask WHERE something was painted rather than only whether it was. */
function recordingCanvas(w, h) {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => { calls.push({ op: key, args, fillStyle: target.fillStyle }); return stubCtx(); };
    },
  });
  return {
    calls,
    canvas: { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0 }) },
  };
}

function withWindow(fn) {
  const had = 'window' in globalThis;
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  try { return fn(); } finally { if (had) globalThis.window = previous; else delete globalThis.window; }
}

const stubJuice = { offset: () => [0, 0], draw() {}, update() {} };

/**
 * A tower with one occupied office on floor 1, slot 3.
 *
 * Occupancy and appeal pressure are written onto the unit directly rather than
 * simulated: `desirabilityPressure` is a plain number the day tick writes and
 * the renderer only ever reads, so a fixture that sets it is exercising the
 * exact seam the renderer uses. Nothing here changes how the sim behaves.
 */
function towerWithRoom(pressure) {
  const state = boot(CONFIG, 7);
  while (state.floors < 4) {
    if (!applyAction(state, { type: 'build_floor' }, CONFIG).ok) throw new Error('could not raise a storey');
  }
  if (!applyAction(state, { type: 'build_unit', kind: 'office', floor: 1, slot: 3 }, CONFIG).ok) {
    throw new Error('could not place a room');
  }
  const unit = state.units[state.units.length - 1];
  unit.occupied = true;
  unit.heads = CONFIG.units.office.capacity ?? 6;
  unit.stress = 0;
  unit.desirabilityPressure = pressure;
  return { state, unit };
}

/** Draw one frame at a known zoom, looking at the room, and hand back what was
 *  painted plus the layout it was painted with. */
function frameFor(state, unit, zoom, before = null) {
  const { canvas, calls } = recordingCanvas(1200, 900);
  const renderer = withWindow(() => { const r = makeRenderer(canvas, CONFIG); r.resize(); return r; });
  // The first draw frames the lobby and picks its own zoom, so set the zoom
  // after it has happened or the test measures the opening shot.
  renderer.draw(state, stubJuice, 16);
  renderer.setZoom(state, zoom);
  renderer.goTo(state, unit.floor, unit.slot);
  if (before) before(renderer);
  calls.length = 0;
  renderer.draw(state, stubJuice, 16);
  return { calls, renderer, L: renderer.layout(state) };
}

/** Where the room's own art starts on screen, which is what both signals are
 *  positioned against. */
function roomOrigin(L, unit) {
  return { x: L.x0 + unit.slot * L.cw, y: L.floorY(unit.floor) };
}

const rectsMatching = (calls, op, [x, y, w, h]) => calls.filter((c) => c.op === op
  && c.args.length === 4 && c.args[0] === x && c.args[1] === y && c.args[2] === w && c.args[3] === h);

/** `drawUnit`'s source, by brace balance — used by the call-site guard below. */
function functionSource(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`could not find ${signature}`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`${signature} is not brace-balanced`);
}

/**
 * Does the frame draw the wick OVER the crowd, or under it?
 *
 * A deep queue paints a row of figures across the bottom half of a floor —
 * which is exactly where the wick's fill grows from — so a room one day from
 * empty would be hidden behind the congestion, and congestion is a DIFFERENT
 * cause with a different fix. The warning goes over the decoration.
 *
 * Returns where each pass sits in `draw()`, so a test can insist on the order.
 */
function wickAfterQueues(drawSource) {
  const queues = drawSource.indexOf('drawQueues(');
  const wicks = drawSource.indexOf('drawDepartureWicks(');
  return { queues, wicks, ordered: queues >= 0 && wicks >= 0 && wicks > queues };
}

export const tests = {
  'the wick is silent until the sim starts charging a room pressure'() {
    assert(departureWickRatio({ occupied: true, desirabilityPressure: 0 }, CONFIG) === 0,
      'a room at zero pressure grew a wick — the tower would carry a fourth always-on marker');
    assert(departureWickRatio({ occupied: true }, CONFIG) === 0, 'a unit with no pressure field drew one');
    assert(departureWickRatio({ occupied: true, desirabilityPressure: -3 }, CONFIG) === 0, 'negative pressure drew a wick');
    assert(departureWickRatio({ occupied: true, desirabilityPressure: NaN }, CONFIG) === 0, 'a NaN pressure drew a wick');
    assert(departureWickRatio({ occupied: false, desirabilityPressure: 3 }, CONFIG) === 0,
      'a vacant room drew a tenant-departure countdown');
    assert(departureWickRatio(null, CONFIG) === 0, 'a missing unit was not handled');
  },

  'the wick fills toward the deadline the sim actually enforces'() {
    // economy.js vacates at `desirabilityPressure >= desirabilityRetentionVacateAt`,
    // so full has to mean exactly that and nothing else. A bar calibrated to
    // anything but the real threshold is a score again, not a deadline.
    const at = (p) => departureWickRatio({ occupied: true, desirabilityPressure: p }, CONFIG);
    assert(at(VACATE_AT / 4) > 0 && at(VACATE_AT / 4) < at(VACATE_AT / 2), 'the wick did not climb with pressure');
    assert(at(VACATE_AT / 2) === 0.5, `half the deadline was not a half-full wick: ${at(VACATE_AT / 2)}`);
    assert(at(VACATE_AT) === 1, 'reaching the vacate threshold did not fill the wick');
    assert(at(VACATE_AT * 5) === 1, 'the wick ran past full');

    // Retuning the deadline retunes the wick, because the threshold is read
    // from config rather than baked into the renderer.
    const slower = structuredClone(CONFIG);
    slower.occupancy.desirabilityRetentionVacateAt = VACATE_AT * 2;
    assert(departureWickRatio({ occupied: true, desirabilityPressure: VACATE_AT }, slower) === 0.5,
      'doubling the vacate threshold did not halve the fill');
  },

  'the wick owns its own edge, scales with the zoom, and vanishes rather than smears'() {
    for (const zoom of ZOOM_LEVELS) {
      const L = { zoom, fh: FLOOR_H * zoom, cw: SLOT_W * zoom };
      const box = departureWickBox(100, 200, L);
      assert(box, `no wick box at ${zoom}x`);
      assert(box.w >= 4 * zoom, `the wick did not scale with the zoom at ${zoom}x: ${box.w}px wide`);
      assert(box.x >= 100 && box.x + box.w < 100 + L.cw / 2,
        'the wick left the room\'s left edge, where nothing else draws');
      // Clear of the transport stress line at fh-7, so appeal and transport
      // never overlap into one unreadable smudge.
      assert(box.y + box.h <= 200 + L.fh - 7, `the wick ran into the stress line at ${zoom}x`);
      assert(box.y >= 200, 'the wick escaped the top of the room');
    }

    // A floor too short to carry it gives up entirely.
    assert(departureWickBox(0, 0, { zoom: 1, fh: 12 }) === null, 'a 12px floor still drew a wick');
    assert(departureWickBox(0, 0, { zoom: 1, fh: NaN }) === null, 'a bad layout was not handled');
  },

  'a healthy room draws no wick, and a room under pressure draws one'() {
    const healthy = towerWithRoom(0);
    const quiet = frameFor(healthy.state, healthy.unit, 2);
    const quietBox = departureWickBox(roomOrigin(quiet.L, healthy.unit).x, roomOrigin(quiet.L, healthy.unit).y, quiet.L);
    assert(quietBox, 'the fixture could not place a wick box at all');
    assert(rectsMatching(quiet.calls, 'fillRect', [quietBox.x, quietBox.y, quietBox.w, quietBox.h]).length === 0,
      'a room the sim is not charging pressure drew a departure wick anyway');

    const failing = towerWithRoom(VACATE_AT / 2);
    const lit = frameFor(failing.state, failing.unit, 2);
    const origin = roomOrigin(lit.L, failing.unit);
    const box = departureWickBox(origin.x, origin.y, lit.L);
    assert(rectsMatching(lit.calls, 'fillRect', [box.x, box.y, box.w, box.h]).length === 1,
      'a room halfway to losing its tenant drew no wick track on its left edge');

    // ...and the fill is the signal: half the deadline is half the track.
    const fill = lit.calls.filter((c) => c.op === 'fillRect' && c.args[0] === box.x && c.args[2] === box.w
      && c.args[3] !== box.h && c.args[3] > 0);
    assert(fill.length >= 1, 'the wick drew a track with nothing burning in it');
    const tallest = Math.max(...fill.map((c) => c.args[3]));
    assert(Math.abs(tallest - box.h / 2) <= 1, `half the deadline filled ${tallest}px of a ${box.h}px wick`);
  },

  'a fuller wick fills further, all the way to the room the sim is about to empty'() {
    const boxFor = (pressure) => {
      const { state, unit } = towerWithRoom(pressure);
      const { calls, L } = frameFor(state, unit, 2);
      const origin = roomOrigin(L, unit);
      const box = departureWickBox(origin.x, origin.y, L);
      // The track itself is box.h tall; everything shorter is the burn.
      const fills = calls.filter((c) => c.op === 'fillRect' && c.args[0] === box.x && c.args[2] === box.w
        && c.args[3] > 1 && c.args[3] !== box.h);
      return { box, tallest: Math.max(...fills.map((c) => c.args[3])) };
    };
    const quarter = boxFor(VACATE_AT / 4);
    const threeQuarters = boxFor(VACATE_AT * 0.75);
    assert(threeQuarters.tallest > quarter.tallest,
      'three days of pressure did not read as more urgent than one — the fill is not the signal');
    assert(threeQuarters.tallest <= threeQuarters.box.h, 'the fill ran past the end of its own track');
  },

  'the wick is drawn over the crowd, never under it'() {
    const src = fs.readFileSync(path.join(here, '..', 'src', 'games', 'lift', 'render', 'canvas.js'), 'utf8');
    const order = wickAfterQueues(functionSource(src, 'function draw(state, juice'));
    assert(order.queues >= 0, 'draw() no longer draws the queues — this guard has lost its subject');
    assert(order.wicks >= 0, 'draw() no longer draws the departure wicks at all');
    assert(order.ordered,
      'the departure wick is painted before the queue crowd — a room one day from empty would be ' +
      'hidden behind a row of figures, which is the OTHER cause of tenants leaving');

    // Mutation-test the guard.
    assert(!wickAfterQueues('drawDepartureWicks(a); drawQueues(b);').ordered, 'the guard accepted the wick drawn first');
    assert(!wickAfterQueues('drawQueues(b);').ordered, 'the guard accepted a frame with no wick pass at all');
    assert(wickAfterQueues('drawQueues(b); drawDepartureWicks(a);').ordered, 'the guard rejected the correct order');
  },

  'a queue on the floor does not swallow the wick'() {
    const { state, unit } = towerWithRoom(VACATE_AT / 4);   // the shortest fill there is
    state.people = Array.from({ length: 26 }, (_, i) => ({
      id: 700 + i, from: unit.floor, to: 0, kind: 'commute_out', state: 'waiting', waitT: 5, rideT: 0,
    }));
    const { calls, L } = frameFor(state, unit, 2);
    const origin = roomOrigin(L, unit);
    const box = departureWickBox(origin.x, origin.y, L);
    const track = rectsMatching(calls, 'fillRect', [box.x, box.y, box.w, box.h]);
    assert(track.length === 1, 'the wick was not drawn at all with a queue on the floor');
    // Every mark the crowd makes has to come BEFORE the wick in the frame.
    const wickAt = calls.indexOf(track[0]);
    const lastCrowd = calls.map((c, i) => ({ c, i }))
      .filter(({ c }) => c.op === 'arc' || c.op === 'drawImage').map(({ i }) => i).pop();
    assert(lastCrowd !== undefined, 'the fixture drew no crowd, so this proves nothing');
    assert(lastCrowd < wickAt, 'the queue crowd was painted over the departure wick');
  },

  'the appeal overlay bands on the same thresholds the room evaluation does'() {
    const min = CONFIG.evaluation.relistMinScore;
    assert(appealOverlayBand(92, CONFIG).key === 'good', 'an excellent room did not read as good');
    assert(appealOverlayBand(80, CONFIG).key === 'good', 'the excellent threshold is off by one');
    assert(appealOverlayBand(79, CONFIG).key === 'warn', 'a merely-good room read as excellent');
    assert(appealOverlayBand(min, CONFIG).key === 'warn', 'the re-let threshold is off by one');
    assert(appealOverlayBand(min - 1, CONFIG).key === 'bad', 'a room below the re-let score did not read as bad');

    // The tint is a gradient, not three buckets: "which HALF of my tower is
    // rotting" is a comparison, so two bad rooms must be distinguishable.
    assert(appealOverlayBand(10, CONFIG).ratio > appealOverlayBand(30, CONFIG).ratio,
      'two rooms with different appeal tinted identically');
    assert(appealOverlayBand(100, CONFIG).ratio === 0 && appealOverlayBand(0, CONFIG).ratio === 1,
      'the tint ramp does not span the score range');

    // Clamped and defended, so a score the sim never produces cannot smear.
    assert(appealOverlayBand(140, CONFIG).score === 100 && appealOverlayBand(-40, CONFIG).score === 0, 'the score was not clamped');
    assert(appealOverlayBand(null, CONFIG) === null && appealOverlayBand('x', CONFIG) === null, 'a non-score produced a band');
  },

  'the overlay is off until it is asked for, and then it tints every room'() {
    const { state, unit } = towerWithRoom(0);

    const off = frameFor(state, unit, 2);
    assert(off.renderer.appealOverlay === false, 'the appeal overlay was on by default');
    const L = off.L;
    const origin = roomOrigin(L, unit);
    const tint = [origin.x + 1, origin.y + 1, L.cw - 2, L.fh - 4];
    assert(rectsMatching(off.calls, 'fillRect', tint).length === 0,
      'the appeal overlay painted a room without being asked — it is competing with the normal read');

    const on = frameFor(state, unit, 2, (r) => {
      assert(r.toggleAppealOverlay() === true, 'toggling the overlay did not report it on');
    });
    assert(on.renderer.appealOverlay === true, 'the overlay did not stay on');
    assert(rectsMatching(on.calls, 'fillRect', tint).length === 1,
      'the overlay was on but the room was not tinted');

    assert(on.renderer.toggleAppealOverlay() === false, 'a second toggle did not put the overlay away');
    assert(on.renderer.setAppealOverlay(true) === true && on.renderer.appealOverlay === true, 'setAppealOverlay did not set it');
    assert(on.renderer.setAppealOverlay(false) === false, 'setAppealOverlay did not clear it');
  },

  'the tint reads the appeal score, not the transport-inclusive room score'() {
    // #12 exists because a player who loses tenants to slow lifts and one who
    // loses them to a bare building need to be told different things. The
    // overlay must therefore band on roomDesirabilityScore — which carries no
    // access penalty — and not on unitEvaluation().score, which does.
    const { state, unit } = towerWithRoom(0);
    const evaluation = unitEvaluation(state, unit, CONFIG);
    const appeal = roomDesirabilityScore(evaluation, CONFIG);
    assert(Number.isFinite(appeal), 'the fixture room has no appeal score to tint by');

    const src = fs.readFileSync(path.join(here, '..', 'src', 'games', 'lift', 'render', 'canvas.js'), 'utf8');
    const overlay = functionSource(src, 'function drawAppealOverlay(');
    assert(overlay.includes('roomDesirabilityScore('),
      'the appeal overlay is not tinting by room appeal');
    assert(!/appealOverlayBand\(\s*unitEvaluation\(/.test(overlay),
      'the appeal overlay tinted by the transport-inclusive score, which is the other cause entirely');
  },
};
