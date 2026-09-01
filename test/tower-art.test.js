/**
 * The sheets that were delivered, ingested, catalogued — and drawn by nothing
 * (issue #14).
 *
 * Six times the answer to a visual complaint has been "the art exists, nothing
 * draws it", and every time it cost Keith playtime to find, because the loader
 * falls back to a coloured rectangle ON PURPOSE: an unused sheet is invisible
 * from the code alone and the game looks fine without it.
 *
 * `test/sprites.test.js` holds the catalogue honest — no entry may exist
 * without a call site. This file is the other half: it loads the real sheets
 * off disk, draws a real frame, and asserts the frame ASKED FOR THEM. A call
 * site that is never reached would pass the string guard and fail here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/games/lift/config.js';
import { PERSON_SHEETS, makeRenderer, personSheet, waitingPose } from '../src/games/lift/render/canvas.js';
import { applyAction, boot } from '../src/games/lift/sim/index.js';

const assert = (c, m) => { if (!c) throw new Error(m); };
const here = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.join(here, '..', 'src', 'games', 'lift', 'assets', 'sprites');

function stubCtx() {
  return new Proxy({}, { get: (target, key) => (key in target ? target[key] : () => stubCtx()) });
}

/** Records every call, and keeps the image object each drawImage was handed —
 *  the loader below tags those with the sheet name, so a test can ask which
 *  sheet a frame drew rather than only how many pixels it moved. */
function recordingCanvas(w, h) {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => { calls.push({ op: key, args }); return stubCtx(); };
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

/** Loaders that read the shipped sheets straight off disk. The image carries
 *  its own name so a recorded drawImage can be traced back to a sheet. */
const diskLoaders = {
  basePath: `${assetDir}${path.sep}`,
  loadJson: (url) => Promise.resolve(fs.readFileSync(url, 'utf8')),
  loadImage: (url) => {
    const bytes = fs.readFileSync(url);
    return Promise.resolve({
      name: path.basename(url, '.png'),
      width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
      naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20),
    });
  },
};

/** A renderer wired to the real art, with every sheet already loaded. */
async function artRenderer(w = 1400, h = 1000) {
  const { canvas, calls } = recordingCanvas(w, h);
  const renderer = withWindow(() => {
    const r = makeRenderer(canvas, CONFIG, { sprites: diskLoaders });
    r.resize();
    return r;
  });
  const names = fs.readdirSync(assetDir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''));
  await Promise.all(names.map((n) => renderer.art.request(n)));
  return { renderer, calls };
}

/** Which sheets a recorded frame actually drew. */
const sheetsDrawn = (calls) => new Set(calls
  .filter((c) => c.op === 'drawImage' && c.args[0] && typeof c.args[0].name === 'string')
  .map((c) => c.args[0].name));

function towerWith({ floors = 4, dig = 0 } = {}) {
  const state = boot(CONFIG, 7);
  // These are rendering tests: the fixture needs a shape on screen, not a
  // solvent tower. Funding it up front keeps a balance change from turning
  // "does the art draw" into "can you afford floor 30".
  state.money = 50_000_000;
  while (state.floors < floors) {
    if (!applyAction(state, { type: 'build_floor' }, CONFIG).ok) throw new Error('could not raise a storey');
  }
  for (let i = 0; i < dig; i++) {
    if (!applyAction(state, { type: 'dig_basement' }, CONFIG).ok) throw new Error('could not dig B' + (i + 1));
  }
  return state;
}

/** A supported column of rooms up to `floor`: a room has to rest on something,
 *  so reaching storey 3 means building storeys 1 and 2 in the same slot. */
function columnTo(state, floor, slot) {
  for (let f = 1; f <= floor; f++) {
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: f, slot }, CONFIG).ok,
      `could not place a room on floor ${f}`);
  }
}

export const tests = {
  'the shipped sheets all load, so a missing one cannot pass as a fallback'() {
    // Everything below depends on the real art loading. If a sheet is broken,
    // every other test here would quietly measure the rectangle path instead.
    return artRenderer().then(({ renderer }) => {
      const stats = renderer.art.stats();
      assert(stats.total > 0, 'no sheets were requested at all');
      assert(!stats.missing && !stats.malformed,
        `sheets that would not load: ${JSON.stringify(stats)}`);
    });
  },

  async 'the slab between storeys is drawn, not just catalogued'() {
    const { renderer, calls } = await artRenderer();
    const state = towerWith({ floors: 5 });
    columnTo(state, 2, 3);
    renderer.draw(state, stubJuice, 16);
    renderer.goTo(state, 2, 3);
    calls.length = 0;
    renderer.draw(state, stubJuice, 16);
    assert(sheetsDrawn(calls).has('floor-slab'),
      'floor-slab is catalogued, preloaded and never drawn — the line between storeys is missing');
  },

  async 'a dug storey draws the cut face where the earth meets it'() {
    const { renderer, calls } = await artRenderer();
    const state = towerWith({ floors: 3, dig: 2 });
    assert(applyAction(state, { type: 'build_facility', kind: 'parking', floor: -1, slot: 3 }, CONFIG).ok,
      'could not put a facility in B1');
    renderer.draw(state, stubJuice, 16);
    renderer.goTo(state, -1, 3);
    calls.length = 0;
    renderer.draw(state, stubJuice, 16);
    const drawn = sheetsDrawn(calls);
    assert(drawn.has('earth-edge'), 'a basement drew no dug edge — it reads as a box floating in soil');
    assert(drawn.has('basement-parking'),
      'a parking facility below ground still drew as a coloured box, with its own art on disk');
  },

  async 'a build that just landed plays its construction frames, then stops'() {
    const { renderer, calls } = await artRenderer();
    const state = towerWith({ floors: 5 });
    columnTo(state, 1, 3);
    renderer.draw(state, stubJuice, 16);           // establishes what already exists
    renderer.goTo(state, 2, 3);

    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 2, slot: 3 }, CONFIG).ok, 'no room');
    calls.length = 0;
    renderer.draw(state, stubJuice, 16);
    assert(sheetsDrawn(calls).has('slot-construction'),
      'a build landed with no scaffold — slot-construction is catalogued and never played');

    // Three frames at config.feel.sprites.fps.construction; the clock clamps a
    // single advance, so run it out in render-sized steps.
    for (let i = 0; i < 12; i++) renderer.draw(state, stubJuice, 100);
    calls.length = 0;
    renderer.draw(state, stubJuice, 16);
    assert(!sheetsDrawn(calls).has('slot-construction'),
      'the construction animation never ended — it is a one-shot, not a permanent state');
  },

  'a waiting figure is chosen by what the trip is for, never by new sim state'() {
    // The sim tracks headcounts, not individuals. Everything the crowd needs
    // has to come from the trip that already exists.
    assert(personSheet('commute_in') === 'person-worker', 'a commuter was not a worker');
    assert(personSheet('lunch_back') === 'person-worker', 'a lunch trip was not a worker');
    assert(personSheet('errand_out') === 'person-resident', 'a resident errand was not a resident');
    assert(personSheet('hotel_check_in') === 'person-guest', 'a hotel check-in was not a guest');
    assert(personSheet('something_new') === 'person-worker', 'an unknown trip kind drew nobody at all');
    assert(personSheet(undefined) === 'person-worker', 'a trip with no kind drew nobody at all');

    // All three delivered sheets have a use. A people sheet with no trip kind
    // pointing at it is exactly the orphan this issue is about.
    const used = new Set(Object.values(PERSON_SHEETS));
    for (const sheet of ['person-worker', 'person-resident', 'person-guest']) {
      assert(used.has(sheet), `${sheet} is drawn for no trip kind — it would be an orphan again`);
    }
  },

  'posture carries the same heat the queue dots did'() {
    // The dots coloured by waitT/abandonAfter. Losing that signal to charm
    // would be the reskin costing legibility, which it is not allowed to do.
    assert(waitingPose(0, 0) === 'stand' && waitingPose(0, 1) === 'fidget', 'a fresh rider was not idling');
    assert(waitingPose(0.5, 0) === 'wait' && waitingPose(0.5, 1) === 'fidget', 'a waiting rider read as fresh');
    assert(waitingPose(0.9, 0) === 'wait' && waitingPose(0.9, 1) === 'wait-annoyed',
      'a rider about to give up read the same as one who just arrived');
    assert(waitingPose(1, 1) === 'wait-annoyed', 'the worst case was not the worst pose');

    // The beat is what animates them: one-frame poses mean the shuffle has to
    // come from alternating, so the two beats must differ at every heat.
    for (const heat of [0, 0.2, 0.4, 0.7, 1]) {
      assert(waitingPose(heat, 0) !== waitingPose(heat, 1), `the crowd stands frozen at heat ${heat}`);
    }
    assert(waitingPose(NaN, 0) === 'stand' && waitingPose(-5, 0) === 'stand' && waitingPose(9, 1) === 'wait-annoyed',
      'a bad heat was not clamped');
  },

  async 'a queue draws people, and every pose it uses is on the sheet'() {
    const { renderer, calls } = await artRenderer();
    const state = towerWith({ floors: 6 });
    columnTo(state, 3, 3);
    // A queue on floor 3, spread across the whole patience range so several
    // postures are exercised in one frame.
    const abandon = CONFIG.demand.abandonAfter;
    state.people = Array.from({ length: 12 }, (_, i) => ({
      id: 900 + i, from: 3, to: 0, kind: i % 3 === 0 ? 'hotel_check_out' : i % 3 === 1 ? 'errand_out' : 'commute_out',
      state: 'waiting', waitT: (i / 11) * abandon, rideT: 0,
    }));

    renderer.draw(state, stubJuice, 16);
    renderer.goTo(state, 3, 3);
    calls.length = 0;
    renderer.draw(state, stubJuice, 16);

    const drawn = sheetsDrawn(calls);
    for (const sheet of ['person-worker', 'person-resident', 'person-guest']) {
      assert(drawn.has(sheet), `a queue of workers, residents and guests drew no ${sheet}`);
    }
    const figures = calls.filter((c) => c.op === 'drawImage' && String(c.args[0]?.name).startsWith('person-'));
    assert(figures.length === 12, `a 12-deep queue drew ${figures.length} figures`);
    // They stand in a row on the queue line, not in a heap.
    const xs = figures.map((c) => c.args[5]);
    assert(new Set(xs).size === 12, 'the crowd was drawn on top of itself');
    assert(new Set(figures.map((c) => c.args[6])).size === 1, 'the crowd is not standing on one line');
  },

  async 'the crowd has a frame budget, and past it the dots come back'() {
    // The one thing here that scales with how badly the tower is doing. A
    // grown tower can have a queue on every visible storey at once, so the
    // worst case has to be bounded by config and not by the player's mistakes.
    const budget = CONFIG.feel.sprites.maxCrowdFigures;
    assert(Number.isInteger(budget) && budget > 0, 'there is no crowd budget to enforce');

    const { renderer, calls } = await artRenderer();
    const state = towerWith({ floors: 30 });
    const people = [];
    for (let floor = 0; floor < 30; floor++) {
      for (let i = 0; i < 26; i++) {
        people.push({ id: floor * 100 + i, from: floor, to: 0, kind: 'commute_out', state: 'waiting', waitT: 5, rideT: 0 });
      }
    }
    state.people = people;

    renderer.draw(state, stubJuice, 16);
    renderer.setZoom(state, 1);
    renderer.goTo(state, 12, 3);
    calls.length = 0;
    renderer.draw(state, stubJuice, 16);

    const figures = calls.filter((c) => c.op === 'drawImage' && String(c.args[0]?.name).startsWith('person-'));
    assert(figures.length > 0, 'a tower full of queues drew no crowd at all');
    assert(figures.length <= budget,
      `the crowd drew ${figures.length} figures against a budget of ${budget} — the frame is unbounded`);

    // Past the budget the queue is still readable: the dots it drew before are
    // still there, so a floor never simply loses its queue.
    const dots = calls.filter((c) => c.op === 'arc');
    assert(dots.length > 0, 'the floors past the budget drew neither figures nor dots — the queue vanished');
  },

  async 'the whole reskin stays inside the frame budget'() {
    // 33ms is the frame. The renderer has been about 0.5ms; the crowd is the
    // one addition that could eat that, so it is measured rather than assumed.
    const { renderer } = await artRenderer();
    const state = towerWith({ floors: 30 });
    // Rooms are placed and then filled by hand: build_unit paces construction
    // against leasing capacity, and this fixture wants a FULL tower to draw,
    // not a realistic one.
    for (let floor = 1; floor < 12; floor++) {
      for (const slot of [1, 2, 3, 4, 5]) {
        applyAction(state, { type: 'build_unit', kind: 'office', floor, slot }, CONFIG);
        for (const u of state.units) { u.occupied = true; u.heads = 6; u.desirabilityPressure = 2; }
      }
    }
    assert(state.units.length > 40, `the fixture tower only has ${state.units.length} rooms`);
    state.people = [];
    for (let floor = 0; floor < 30; floor++) {
      for (let i = 0; i < 26; i++) {
        state.people.push({ id: floor * 100 + i, from: floor, to: 0, kind: 'commute_out', state: 'waiting', waitT: 20, rideT: 0 });
      }
    }
    renderer.draw(state, stubJuice, 16);
    renderer.setZoom(state, 1);
    renderer.goTo(state, 6, 3);
    renderer.setAppealOverlay(true);

    const runs = 30;
    const started = performance.now();
    for (let i = 0; i < runs; i++) renderer.draw(state, stubJuice, 16);
    const perFrame = (performance.now() - started) / runs;
    // Generous, because this is a recording proxy over a stub context on
    // whatever machine CI runs on — it is a tripwire for an order-of-magnitude
    // regression, not a benchmark. The real figure is reported in the PR.
    assert(perFrame < 33,
      `a worst-case frame — 30 storeys of queues, every room under pressure, appeal overlay up — took ${perFrame.toFixed(2)}ms`);
  },
};
