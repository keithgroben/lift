/**
 * The tower view's camera (spec/tower-view.md §2).
 *
 * The bug this locks down: layout() used to refit the whole tower into the
 * viewport every frame, so a slot drew 22x14 px at 60 floors — the tower got
 * LESS legible the better you played. World scale is now fixed, so these tests
 * assert the scale never depends on how tall the building is, and that every
 * pick still resolves through the inverse transform at every zoom.
 */
import {
  FLOOR_H, SLOT_W, ZOOM_LEVELS, cameraZoomedAt, clampZoom, floorAtWorldY, floorBottomWorldY,
  floorTopWorldY, makeCamera, makeRenderer, minimapContains, minimapFloorAt, minimapMetrics,
  minimapRowY, screenToWorld, slotAtWorldX, slotLeftWorldX, visibleFloorRange, worldToScreen,
} from '../src/games/lift/render/canvas.js';
import { applyAction, boot } from '../src/games/lift/sim/index.js';
import { CONFIG } from '../src/games/lift/config.js';

const assert = (c, m) => { if (!c) throw new Error(m); };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/** A canvas that records nothing. The renderer never reads back from it, so a
 *  stub is enough to exercise the real camera and the real pick seam. */
function stubCtx() {
  return new Proxy({}, { get: (target, key) => (key in target ? target[key] : () => stubCtx()) });
}

function stubCanvas(w, h) {
  const ctx = stubCtx();
  return { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0 }) };
}

/** Same stub, but it keeps every drawing call so a test can ask WHERE something
 *  was painted. The ground line and the street are geometry, not decoration. */
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

/** resize() is the only thing in the renderer that reads `window`. */
function withWindow(fn) {
  const had = 'window' in globalThis;
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  try { return fn(); } finally { if (had) globalThis.window = previous; else delete globalThis.window; }
}

function testRenderer(w = 1200, h = 900) {
  return withWindow(() => {
    const renderer = makeRenderer(stubCanvas(w, h), CONFIG);
    renderer.resize();
    return renderer;
  });
}

const stubJuice = { offset: () => [0, 0], draw() {}, update() {} };

export const tests = {
  'world scale is fixed, so a tall tower never shrinks a slot'() {
    const renderer = testRenderer();
    const small = renderer.layout({ floors: 4 });
    const tall = renderer.layout({ floors: 60 });
    assert(small.fh === FLOOR_H && small.cw === SLOT_W,
      'a slot was not ' + SLOT_W + 'x' + FLOOR_H + ' at 1x: ' + small.cw + 'x' + small.fh);
    assert(tall.fh === small.fh && tall.cw === small.cw,
      'a 60-floor tower drew a different slot size than a 4-floor one — layout is refitting again');
    assert(near(small.floorY(0) - small.floorY(1), FLOOR_H), 'one floor was not FLOOR_H apart');
  },

  'world and screen round-trip at every zoom'() {
    const viewport = { w: 1200, h: 900 };
    for (const zoom of ZOOM_LEVELS) {
      const camera = makeCamera(240, -256, zoom);
      for (const [wx, wy] of [[0, 0], [48, -32], [-97.5, 411.25], [1440, -1920]]) {
        const [sx, sy] = worldToScreen(camera, viewport, wx, wy);
        const [bx, by] = screenToWorld(camera, viewport, sx, sy);
        assert(near(bx, wx, 1e-9) && near(by, wy, 1e-9),
          'round trip lost the point at ' + zoom + 'x: ' + wx + ',' + wy + ' -> ' + bx + ',' + by);
      }
      // The camera position is the world point at the middle of the viewport.
      const [cx, cy] = worldToScreen(camera, viewport, camera.x, camera.y);
      assert(near(cx, viewport.w / 2) && near(cy, viewport.h / 2), 'the camera was not centred at ' + zoom + 'x');
      // Scale is exactly the zoom: no fitting, no drift.
      const [ax] = worldToScreen(camera, viewport, 0, 0);
      const [bx2] = worldToScreen(camera, viewport, SLOT_W, 0);
      assert(near(bx2 - ax, SLOT_W * zoom), 'a slot was not ' + SLOT_W + '*' + zoom + ' px wide on screen');
    }
  },

  'a pick at a known screen point lands on the expected floor and slot at every zoom'() {
    const state = boot(CONFIG, 7);
    const w = 1200, h = 900;
    const middleSlot = Math.floor((CONFIG.building.slotsPerFloor - 1) / 2);
    for (const zoom of ZOOM_LEVELS) {
      const renderer = testRenderer(w, h);
      renderer.setZoom(state, zoom);
      renderer.goTo(state, 2, middleSlot);
      assert(renderer.camera.zoom === zoom, 'zoom did not stick at ' + zoom + 'x');

      // goTo centres the cell, so the middle of the viewport IS that cell.
      assert(renderer.floorAt(state, w / 2, h / 2) === 2,
        'the centre of the view was not the floor the camera was sent to at ' + zoom + 'x');
      assert(renderer.slotAt(state, w / 2) === middleSlot,
        'the centre of the view was not the slot the camera was sent to at ' + zoom + 'x');
      // One floor is FLOOR_H * zoom px on screen, up is up.
      assert(renderer.floorAt(state, w / 2, h / 2 - FLOOR_H * zoom) === 3,
        'one floor up was not one floor up at ' + zoom + 'x');
      assert(renderer.floorAt(state, w / 2, h / 2 + FLOOR_H * zoom) === 1,
        'one floor down was not one floor down at ' + zoom + 'x');
      // And one slot is SLOT_W * zoom px.
      assert(renderer.slotAt(state, w / 2 + SLOT_W * zoom) === middleSlot + 1,
        'one slot right was not one slot right at ' + zoom + 'x');
      assert(renderer.slotAt(state, w / 2 - SLOT_W * zoom) === middleSlot - 1,
        'one slot left was not one slot left at ' + zoom + 'x');
      // Below the ground line there is no floor to pick — that is earth.
      const [groundY] = [renderer.layout(state).y0];
      assert(renderer.floorAt(state, w / 2, groundY + 4) === -1, 'a click on the earth returned a floor at ' + zoom + 'x');
    }
  },

  'panning moves the picks with the view'() {
    const state = boot(CONFIG, 7);
    const w = 1200, h = 900;
    const renderer = testRenderer(w, h);
    renderer.setZoom(state, 1);
    renderer.goTo(state, 2, 4);
    assert(renderer.floorAt(state, w / 2, h / 2) === 2, 'the camera did not start where it was sent');

    // Drag the world DOWN by one floor: the floor under the cursor goes up one.
    renderer.dragBy(state, 0, FLOOR_H);
    assert(renderer.floorAt(state, w / 2, h / 2) === 3,
      'dragging the world down by a floor did not move the pick up a floor');
    renderer.dragBy(state, SLOT_W, 0);
    assert(renderer.slotAt(state, w / 2) === 3,
      'dragging the world right by a slot did not move the pick left a slot');
  },

  'zoom is integer only and holds the point under the cursor'() {
    assert(clampZoom(1.5) === 2 && clampZoom(0) === 1 && clampZoom(9) === 3 && clampZoom('2') === 2,
      'zoom was not clamped to the integer levels');
    assert(ZOOM_LEVELS.join(',') === '1,2,3', 'the zoom ladder is no longer 1x/2x/3x');

    const viewport = { w: 1200, h: 900 };
    const camera = makeCamera(240, -256, 1);
    const anchor = [300, 700];
    const [wx, wy] = screenToWorld(camera, viewport, ...anchor);
    for (const zoom of ZOOM_LEVELS) {
      const zoomed = cameraZoomedAt(camera, viewport, zoom, ...anchor);
      assert(zoomed.zoom === zoom, 'cameraZoomedAt did not take the level');
      const [sx, sy] = worldToScreen(zoomed, viewport, wx, wy);
      assert(near(sx, anchor[0], 1e-9) && near(sy, anchor[1], 1e-9),
        'zooming to ' + zoom + 'x moved the world point under the cursor');
    }

    const state = boot(CONFIG, 7);
    const renderer = testRenderer();
    assert(renderer.setZoom(state, 1.4) === 1 && renderer.setZoom(state, 12) === 3 && renderer.setZoom(state, -4) === 1,
      'the renderer accepted a zoom off the ladder');
    assert(renderer.zoomBy(state, 1) === 2 && renderer.zoomBy(state, 1) === 3 && renderer.zoomBy(state, 1) === 3,
      'zoomBy did not step and clamp on the ladder');
  },

  'the world grid puts the ground line at world zero'() {
    assert(floorTopWorldY(0) === -FLOOR_H && floorBottomWorldY(0) === 0 && floorBottomIsGround(),
      'floor 0 did not sit on the ground line');
    assert(floorBottomWorldY(1) === floorTopWorldY(0), 'floor 1 did not stand on floor 0');
    assert(floorAtWorldY(-1) === 0 && floorAtWorldY(-FLOOR_H) === 1 && floorAtWorldY(-FLOOR_H * 4 - 1) === 4,
      'a world y did not resolve to its floor');
    assert(floorAtWorldY(1) === -1, 'below the ground line did not read as below floor 0');
    assert(slotAtWorldX(0) === 0 && slotAtWorldX(SLOT_W - 1) === 0 && slotAtWorldX(SLOT_W) === 1,
      'a world x did not resolve to its slot');
    assert(slotLeftWorldX(3) === SLOT_W * 3, 'slot 3 was not three slots along');

    function floorBottomIsGround() {
      const [, y] = worldToScreen(makeCamera(0, 0, 1), { w: 100, h: 100 }, 0, 0);
      return near(y, 50);
    }
  },

  'only the floors in view are drawn'() {
    const viewport = { w: 1200, h: 900 };
    // 60 floors is 1920 world px; a 900 px viewport can hold 28 of them at 1x.
    const camera = makeCamera(240, floorTopWorldY(40), 1);
    const range = visibleFloorRange(camera, viewport, 60);
    assert(range.low >= 0 && range.high <= 59, 'the visible range escaped the tower');
    assert(range.high - range.low < 32, 'a 900 px viewport claimed to show more than 32 floors at 1x');
    assert(range.low <= 40 && range.high >= 40, 'the floor the camera is on was not in the visible range');

    const zoomed = visibleFloorRange(makeCamera(240, floorTopWorldY(40), 3), viewport, 60);
    assert(zoomed.high - zoomed.low < range.high - range.low, 'zooming in did not narrow the drawn range');
  },

  'the camera stays where the player put it'() {
    const state = boot(CONFIG, 7);
    const renderer = testRenderer();
    const initial = renderer.camera;

    // First load is one of the three moves the camera may make on its own.
    renderer.draw(state, stubJuice, 16);
    const framed = renderer.camera;
    assert(framed.x !== initial.x || framed.y !== initial.y, 'first load did not frame the lobby');

    // Nothing else may yank the view.
    for (let i = 0; i < 5; i++) renderer.draw(state, stubJuice, 16);
    const after = renderer.camera;
    assert(after.x === framed.x && after.y === framed.y && after.zoom === framed.zoom,
      'the camera moved itself while merely drawing frames');

    renderer.dragBy(state, 40, -60);
    const panned = renderer.camera;
    renderer.draw(state, stubJuice, 16);
    assert(renderer.camera.x === panned.x && renderer.camera.y === panned.y,
      'a redraw undid the player\'s pan');
  },

  'a placement only pulls the camera when it landed entirely off-screen'() {
    const state = boot(CONFIG, 7);
    const renderer = testRenderer();
    renderer.draw(state, stubJuice, 16);

    // On-screen placement: the view must not move.
    assert(applyAction(state, { type: 'build_lobby', slot: 4 }, CONFIG).ok, 'lobby did not build');
    const before = renderer.camera;
    renderer.draw(state, stubJuice, 16);
    assert(renderer.camera.x === before.x && renderer.camera.y === before.y,
      'a placement the player could already see yanked the camera');

    // A shaft rising out of the top of the view is still anchored at the lobby
    // the player is looking at, so it must not move the camera either.
    state.money = 5e6;
    while (state.floors < 25) assert(applyAction(state, { type: 'build_floor' }, CONFIG).ok, 'floor did not build');
    const tall = applyAction(state, { type: 'build_shaft', bottom: 0, top: 20, slot: 6 }, CONFIG);
    assert(tall.ok, 'a 21-floor shaft did not build: ' + tall.reason);
    assert(renderer.layout(state).floorY(20) < 0, 'F20 was already on screen, so this proves nothing');
    renderer.draw(state, stubJuice, 16);
    assert(renderer.camera.x === before.x && renderer.camera.y === before.y,
      'a shaft anchored at the lobby yanked the camera to its top');

    // Now put something where the player is definitely not looking.
    renderer.dragBy(state, 0, -4000);
    const parked = renderer.camera;
    assert(applyAction(state, { type: 'build_unit', floor: 1, kind: 'office' }, CONFIG).ok, 'office did not build');
    renderer.draw(state, stubJuice, 16);
    assert(renderer.camera.y !== parked.y, 'a placement that landed off-screen was never revealed');
    assert(renderer.floorAt(state, 600, 450) === 1, 'the reveal did not bring the new room into view');
  },

  'the ground line has earth under it and a street on it'() {
    const state = boot(CONFIG, 7);
    assert(applyAction(state, { type: 'build_lobby', slot: 4 }, CONFIG).ok, 'could not place a lobby to draw an entrance for');
    const w = 1200, h = 900;
    const recorder = recordingCanvas(w, h);
    const renderer = withWindow(() => {
      const made = makeRenderer(recorder.canvas, CONFIG);
      made.resize();
      return made;
    });
    renderer.draw(state, stubJuice, 16);
    const zoom = renderer.camera.zoom;
    const groundY = renderer.layout(state).y0;
    assert(groundY > 0 && groundY < h, 'the ground line was not on screen after framing the lobby');

    const rects = recorder.calls.filter((call) => call.op === 'fillRect');
    // Earth: full-bleed, starting at the ground line and running off the bottom.
    const earth = rects.find((call) => near(call.args[1], groundY, 1) && call.args[2] >= w && call.args[3] > FLOOR_H);
    assert(earth, 'nothing was painted below the ground line');
    // Street: the bottom 16 world px of the ground floor, the 48x16 art tile.
    const streetH = 16 * zoom;
    const street = rects.find((call) => near(call.args[1], groundY - streetH, 1) && near(call.args[3], streetH, 1) && call.args[2] >= w);
    assert(street, 'no street band was painted on the ground floor at ' + zoom + 'x');
    // And the entrance sits in that band, not above it.
    const entrance = rects.find((call) => call.args[1] >= groundY - streetH - 1 && call.args[1] < groundY &&
      call.args[2] > 2 && call.args[2] < 48 * zoom);
    assert(entrance, 'the lobby entrance was not drawn in the street band');
  },

  'the minimap maps rows to floors and jumps the camera'() {
    const state = boot(CONFIG, 7);
    const w = 1200, h = 900;
    const renderer = testRenderer(w, h);
    const cols = CONFIG.building.slotsPerFloor;
    const metrics = minimapMetrics({ w, h }, state.floors, cols);

    assert(metrics.rows === state.floors && metrics.rowH >= 1, 'the strip did not carry one row per floor');
    assert(metrics.x + metrics.w <= w && metrics.y + metrics.h <= h, 'the strip fell outside the viewport');
    for (let floor = 0; floor < metrics.rows; floor++) {
      const y = minimapRowY(metrics, floor) + metrics.rowH / 2;
      assert(minimapFloorAt(metrics, y) === floor, 'row ' + floor + ' did not read back as floor ' + floor);
    }
    // Floor 0 is the bottom row: the strip stands the same way up as the tower.
    assert(minimapRowY(metrics, 0) > minimapRowY(metrics, metrics.rows - 1), 'the strip was drawn upside down');
    assert(!minimapContains(metrics, w / 2, h / 2), 'the middle of the view was inside the strip');

    const target = 3;
    const px = metrics.x + metrics.gutter + 1;
    const py = minimapRowY(metrics, target) + metrics.rowH / 2;
    assert(minimapContains(metrics, px, py), 'a point on the strip was not on the strip');
    assert(renderer.minimapAt(state, px, py)?.floor === target, 'the strip did not report the floor under the pointer');
    assert(renderer.minimapJump(state, px, py) === true, 'a click on the strip was not taken');
    assert(renderer.floorAt(state, w / 2, h / 2) === target, 'the jump did not put that floor in the middle of the view');
    assert(renderer.minimapJump(state, w / 2, h / 2) === false, 'a click on the tower was swallowed by the strip');
  },
};
