import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHEET_MALFORMED, SHEET_MISSING, SHEET_READY,
  applyPixelSampling, frameIndexAt, frameRect, integerScale,
  makeAnimationClock, makeSpriteBook, parseSheetManifest,
} from '../src/games/lift/render/sprites.js';
import { CONFIG } from '../src/games/lift/config.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const here = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.join(here, '..', 'src', 'games', 'lift', 'assets', 'sprites');

/** The ingest catalogue, minus its `$comment` preamble. */
function readCatalog() {
  const raw = JSON.parse(fs.readFileSync(path.join(here, '..', 'tools', 'sprite-catalog.json'), 'utf8'));
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('$')));
}

/** The sidecar `tools/ingest_sprite.py` writes for a catalogue entry. Kept in
 *  step with `sidecar_for()` there; the tests below are what holds them level. */
function sidecarFor(entry) {
  const animations = {};
  let col = 0;
  for (const state of entry.states) {
    const anim = { col, frames: state.frames };
    if (state.speed) anim.speed = state.speed;
    if (state.loop === false) anim.loop = false;
    animations[state.name] = anim;
    col += state.frames;
  }
  return { frameW: entry.frameW, frameH: entry.frameH, animations };
}

/** A sidecar shaped like the ones `spec/asset-request.md` asks for. */
const OFFICE = {
  frameW: 48,
  frameH: 32,
  animations: {
    vacant: { col: 0, frames: 1 },
    'occupied-day': { col: 1, frames: 2, speed: 'idle' },
    'occupied-night': { col: 3, frames: 1 },
    'doors-opening': { col: 4, frames: 3, speed: 'doors', loop: false },
  },
};

/** Minimal canvas double: records what was drawn, and whether smoothing was
 *  turned off before it happened. */
function fakeCtx() {
  const calls = [];
  return {
    imageSmoothingEnabled: true,
    smoothingWhenDrawn: null,
    calls,
    drawImage(...args) { this.smoothingWhenDrawn = this.imageSmoothingEnabled; calls.push(args); },
  };
}

const fakeImage = (width, height) => ({ width, height, naturalWidth: width, naturalHeight: height });

/** A book whose loaders resolve/reject synchronously-ish, with no DOM. */
function bookWith({ json, image, config = CONFIG, warnings = [] }) {
  return makeSpriteBook(config, {
    basePath: 'test://sprites/',
    loadJson: () => (json instanceof Error ? Promise.reject(json) : Promise.resolve(json)),
    loadImage: () => (image instanceof Error ? Promise.reject(image) : Promise.resolve(image)),
    onWarn: (m) => warnings.push(m),
  });
}

export const tests = {
  'a sidecar parses into animations with the documented defaults'() {
    const { ok, sheet, warnings } = parseSheetManifest(JSON.stringify(OFFICE), { config: CONFIG });
    assert(ok, 'a well-formed sidecar was rejected');
    assert(warnings.length === 0, `a clean sidecar warned: ${warnings.join(' / ')}`);
    assert(sheet.frameW === 48 && sheet.frameH === 32, 'frame size was not read');

    const vacant = sheet.animations.vacant;
    assert(vacant.row === 0 && vacant.col === 0 && vacant.frames === 1, 'defaults for a one-frame state are wrong');
    assert(vacant.loop === true, 'animations should loop unless told not to');
    assert(sheet.animations['doors-opening'].loop === false, 'loop:false was ignored');
    assert(Object.keys(sheet.animations).length === 4, 'not every state survived parsing');
  },

  'fps comes from config.feel and a number in the art file is refused'() {
    const table = CONFIG.feel.sprites.fps;
    const { sheet } = parseSheetManifest(OFFICE, { config: CONFIG });
    assert(sheet.animations['occupied-day'].fps === table.idle, 'named speed did not resolve from config.feel');
    assert(sheet.animations['doors-opening'].fps === table.doors, 'doors speed did not resolve from config.feel');
    assert(sheet.animations.vacant.fps === table.default, 'an unnamed speed did not take the default');

    // The whole point of naming a speed: retiming is a config edit, nowhere else.
    const slow = structuredClone(CONFIG);
    slow.feel.sprites.fps.idle = 1;
    const retimed = parseSheetManifest(OFFICE, { config: slow });
    assert(retimed.sheet.animations['occupied-day'].fps === 1, 'config.feel does not own the fps');

    const numeric = parseSheetManifest({ frameW: 48, frameH: 32, animations: { walk: { frames: 4, fps: 24 } } }, { config: CONFIG });
    assert(numeric.ok, 'a numeric fps should degrade, not fail the sheet');
    assert(numeric.sheet.animations.walk.fps === table.default, 'a numeric fps in a sidecar was honoured');
    assert(numeric.warnings.some((w) => w.includes('numeric fps')), 'a numeric fps passed without a warning');

    const unknown = parseSheetManifest({ frameW: 48, frameH: 32, animations: { walk: { frames: 4, speed: 'sprint' } } }, { config: CONFIG });
    assert(unknown.ok && unknown.sheet.animations.walk.fps === table.default, 'an unknown speed did not fall back');
    assert(unknown.warnings.length === 1, 'an unknown speed passed without a warning');
  },

  'a malformed sidecar is refused, and refusing never throws'() {
    const cases = [
      ['not json at all', '{oh no'],
      ['a bare array', '[]'],
      ['null', 'null'],
      ['no frame width', { frameH: 32, animations: { a: { frames: 1 } } }],
      ['a fractional frame width', { frameW: 48.5, frameH: 32, animations: { a: { frames: 1 } } }],
      ['a zero frame height', { frameW: 48, frameH: 0, animations: { a: { frames: 1 } } }],
      ['no animations', { frameW: 48, frameH: 32 }],
      ['empty animations', { frameW: 48, frameH: 32, animations: {} }],
      ['an animation that is not an object', { frameW: 48, frameH: 32, animations: { a: 3 } }],
      ['zero frames', { frameW: 48, frameH: 32, animations: { a: { frames: 0 } } }],
      ['a negative column', { frameW: 48, frameH: 32, animations: { a: { frames: 1, col: -1 } } }],
      ['a fractional row', { frameW: 48, frameH: 32, animations: { a: { frames: 1, row: 1.5 } } }],
    ];
    for (const [label, raw] of cases) {
      let result;
      try { result = parseSheetManifest(raw, { config: CONFIG }); }
      catch (e) { throw new Error(`parsing ${label} threw instead of reporting: ${e.message}`); }
      assert(result.ok === false, `${label} was accepted as a sheet`);
      assert(typeof result.error === 'string' && result.error.length > 0, `${label} was refused without saying why`);
    }
  },

  'an animation that runs off the sheet is refused, not silently blank'() {
    // 3 columns of art, a state promising 4 frames. Sampling past the edge
    // draws transparent pixels — the room would vanish and look intentional.
    const overrun = parseSheetManifest({ frameW: 48, frameH: 32, animations: { walk: { frames: 4 } } }, { config: CONFIG, sheetW: 144, sheetH: 32 });
    assert(!overrun.ok && overrun.error.includes('right edge'), 'a run past the right edge was accepted');

    const tooTall = parseSheetManifest({ frameW: 48, frameH: 32, animations: { a: { frames: 1, row: 2 } } }, { config: CONFIG, sheetW: 48, sheetH: 32 });
    assert(!tooTall.ok && tooTall.error.includes('bottom'), 'a row past the bottom was accepted');

    const fits = parseSheetManifest({ frameW: 48, frameH: 32, animations: { walk: { frames: 3 } } }, { config: CONFIG, sheetW: 144, sheetH: 32 });
    assert(fits.ok, 'a sheet that exactly fits its frames was refused');
  },

  'frame rects follow col, row and frame index'() {
    const { sheet } = parseSheetManifest(OFFICE, { config: CONFIG });

    assert(JSON.stringify(frameRect(sheet, 'vacant', 0)) === JSON.stringify({ sx: 0, sy: 0, sw: 48, sh: 32 }),
      'the first frame is not at the origin');
    assert(frameRect(sheet, 'occupied-day', 0).sx === 48, 'col offset was ignored');
    assert(frameRect(sheet, 'occupied-day', 1).sx === 96, 'the second frame is in the wrong column');
    assert(frameRect(sheet, 'occupied-night', 0).sx === 144, 'a later state is in the wrong column');

    // A looping state wraps; a one-shot clamps at its final frame.
    assert(frameRect(sheet, 'occupied-day', 2).sx === 48, 'a looping animation did not wrap');
    assert(frameRect(sheet, 'occupied-day', -1).sx === 96, 'a negative index did not wrap forward');
    assert(frameRect(sheet, 'doors-opening', 9).sx === 6 * 48, 'a one-shot did not clamp to its last frame');

    const grid = parseSheetManifest({ frameW: 16, frameH: 16, animations: { 'walk-left': { row: 1, frames: 2 } } }, { config: CONFIG });
    assert(grid.sheet.animations['walk-left'].row === 1 && frameRect(grid.sheet, 'walk-left', 1).sy === 16,
      'row offset was ignored');

    assert(frameRect(sheet, 'no-such-state', 0) === null, 'an unknown animation returned a rect');
    assert(frameRect(null, 'vacant', 0) === null, 'a null sheet returned a rect');
  },

  'the animation clock advances a frame per fps at a fixed dt'() {
    const { sheet } = parseSheetManifest(OFFICE, { config: CONFIG });
    const idle = sheet.animations['occupied-day'];   // 2 frames at fps.idle = 2 -> 500ms/frame
    const clock = makeAnimationClock(CONFIG);

    assert(frameIndexAt(idle, 0) === 0, 'a fresh clock is not on frame 0');
    const seen = [];
    for (let i = 0; i < 12; i++) { seen.push(frameIndexAt(idle, clock.elapsedMs)); clock.advance(100); }
    // 100ms steps, 500ms a frame: 0 0 0 0 0 | 1 1 1 1 1 | 0 0
    assert(seen.join('') === '000001111100', `frame sequence was ${seen.join('')}`);
    assert(clock.elapsedMs === 1200, 'the clock did not accumulate render dt');

    // Phase de-synchronises two instances of the same animation.
    assert(frameIndexAt(idle, 0, 500) === 1, 'a phase offset did not shift the frame');

    // A one-frame state never moves, whatever the clock says.
    assert(frameIndexAt(sheet.animations.vacant, 999999) === 0, 'a single-frame state animated');

    // A one-shot stops on its last frame instead of wrapping.
    const doors = sheet.animations['doors-opening'];  // 3 frames at 12fps -> 83.3ms/frame
    assert(frameIndexAt(doors, 0) === 0 && frameIndexAt(doors, 100) === 1 && frameIndexAt(doors, 5000) === 2,
      'a one-shot did not clamp to its final frame');

    // Garbage dt must not poison the clock, and a backgrounded tab's giant dt
    // is clamped so a one-shot cannot teleport past its frames.
    const guarded = makeAnimationClock(CONFIG);
    guarded.advance(NaN); guarded.advance(-40); guarded.advance(undefined);
    assert(guarded.elapsedMs === 0, 'the clock accepted a bad dt');
    guarded.advance(9000);
    assert(guarded.elapsedMs === CONFIG.feel.sprites.maxFrameStepMs, 'a huge dt was not clamped');
    guarded.reset();
    assert(guarded.elapsedMs === 0, 'reset did not zero the clock');
  },

  async 'a missing sheet falls back to the rectangles instead of throwing'() {
    const warnings = [];
    const book = bookWith({ json: new Error('404 Not Found'), image: new Error('404 Not Found'), warnings });
    const ctx = fakeCtx();

    // First ask, before anything has loaded: no draw, no throw.
    assert(book.drawSprite(ctx, { name: 'office', animation: 'vacant', x: 0, y: 0, scale: 1 }) === false,
      'drawSprite claimed to draw art that has not loaded');

    await book.request('office');

    assert(book.status('office') === SHEET_MISSING, `a 404 left the sheet in status ${book.status('office')}`);
    assert(book.sheetFor('office') === null, 'a missing sheet handed back a sheet');
    assert(book.has('office', 'vacant') === false, 'a missing sheet claimed to have an animation');
    assert(book.drawSprite(ctx, { name: 'office', animation: 'vacant', x: 0, y: 0, scale: 1 }) === false,
      'a missing sheet reported a successful draw — the renderer would skip its fallback');
    assert(ctx.calls.length === 0, 'a missing sheet drew something');
    assert(warnings.length === 1 && warnings[0].includes('office'), 'a missing sheet was not reported once');

    // The clock keeps running with no art at all, so animation timing does not
    // jump the moment a sheet finally arrives.
    book.advance(16);
    assert(book.elapsedMs === 16, 'the clock stalled while art was missing');
  },

  async 'a malformed sidecar falls back too, and one bad sheet does not sink the others'() {
    const bad = bookWith({ json: '{"frameW": 48}', image: fakeImage(144, 32) });
    await bad.request('office');
    assert(bad.status('office') === SHEET_MALFORMED, 'a sidecar with no animations was accepted');
    assert(bad.drawSprite(fakeCtx(), { name: 'office', animation: 'vacant' }) === false, 'a malformed sheet drew');

    // A sheet whose frames overrun its PNG is caught at load, using the real
    // image dimensions rather than trusting the sidecar.
    const overrun = bookWith({ json: JSON.stringify(OFFICE), image: fakeImage(96, 32) });
    await overrun.request('office');
    assert(overrun.status('office') === SHEET_MALFORMED, 'a sidecar promising more frames than the PNG holds was accepted');

    const good = bookWith({ json: JSON.stringify(OFFICE), image: fakeImage(336, 32) });
    await good.request('office');
    assert(good.status('office') === SHEET_READY, 'a good sheet loaded alongside bad ones failed');
    assert(good.status('condo') !== SHEET_READY, 'a sheet nobody asked for reported itself ready');
  },

  async 'a loaded sheet draws nearest-neighbour at an integer scale'() {
    const book = bookWith({ json: JSON.stringify(OFFICE), image: fakeImage(336, 32) });
    await book.request('office');
    const ctx = fakeCtx();

    assert(book.drawSprite(ctx, { name: 'office', animation: 'occupied-day', x: 100.7, y: 40.2, scale: 2 }) === true,
      'a ready sheet did not draw');
    const [img, sx, sy, sw, sh, dx, dy, dw, dh] = ctx.calls[0];
    assert(img && img.naturalWidth === 336, 'the loaded image was not the one handed to drawImage');
    assert(sx === 48 && sy === 0 && sw === 48 && sh === 32, `sampled the wrong source rect: ${[sx, sy, sw, sh]}`);
    assert(dx === 100 && dy === 40, 'the destination was not floored onto the pixel grid');
    assert(dw === 96 && dh === 64, 'the sprite was not scaled by a whole number');
    assert(ctx.smoothingWhenDrawn === false, 'the sprite was drawn with smoothing on');

    // Fractional and out-of-range zoom snap to a legal integer step.
    assert(integerScale(1.4, CONFIG) === 1 && integerScale(2.6, CONFIG) === 3, 'zoom did not snap to an integer step');
    assert(integerScale(0.2, CONFIG) === 1, 'zoom below 1x was allowed');
    assert(integerScale(9, CONFIG) === CONFIG.feel.sprites.maxScale, 'zoom past the cap was allowed');
    assert(integerScale(NaN, CONFIG) === 1, 'a bad zoom was not defended against');

    // An explicit frame overrides the clock (for a doors-opening tied to sim state).
    ctx.calls.length = 0;
    book.drawSprite(ctx, { name: 'office', animation: 'occupied-day', frame: 1, scale: 1 });
    assert(ctx.calls[0][1] === 96, 'an explicit frame index was ignored');

    // An animation the sheet does not have is a fallback, not a crash.
    assert(book.drawSprite(ctx, { name: 'office', animation: 'poor-review' }) === false, 'an unknown animation drew');
    assert(book.drawSprite(null, { name: 'office', animation: 'vacant' }) === false, 'a null context did not fall back');

    const stats = book.stats();
    assert(stats.total === 1 && stats[SHEET_READY] === 1, 'the debug counts are wrong');
  },

  'applyPixelSampling turns smoothing off on whatever it is handed'() {
    const ctx = { imageSmoothingEnabled: true, mozImageSmoothingEnabled: true };
    assert(applyPixelSampling(ctx) === true, 'a real context was refused');
    assert(ctx.imageSmoothingEnabled === false && ctx.mozImageSmoothingEnabled === false, 'smoothing stayed on');
    assert(applyPixelSampling(null) === false, 'a null context was not handled');
  },

  'the checked-in placeholder sheet matches its sidecar'() {
    const png = fs.readFileSync(path.join(assetDir, 'placeholder.png'));
    const sidecar = JSON.parse(fs.readFileSync(path.join(assetDir, 'placeholder.json'), 'utf8'));

    assert(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'placeholder.png is not a PNG');
    assert(png.subarray(12, 16).toString('ascii') === 'IHDR', 'placeholder.png has no header chunk');
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);

    const parsed = parseSheetManifest(sidecar, { config: CONFIG, sheetW: width, sheetH: height });
    assert(parsed.ok, `the placeholder sidecar does not describe its own PNG: ${parsed.error}`);
    assert(parsed.sheet.frameW === 48 && parsed.sheet.frameH === 32, 'the placeholder is not on the 48x32 slot grid');
    assert(height === parsed.sheet.frameH, 'the placeholder PNG is not one row tall');

    // Every declared frame lands inside the image.
    for (const name of Object.keys(parsed.sheet.animations)) {
      const anim = parsed.sheet.animations[name];
      const last = frameRect(parsed.sheet, name, anim.frames - 1);
      assert(last.sx + last.sw <= width, `placeholder state "${name}" runs past the sheet`);
    }
  },

  async 'the book loads the checked-in placeholder pair end to end'() {
    // Same code path a browser takes, with the two loaders reading from disk
    // instead of the network — so the shipped pair is proven drawable, not
    // merely parseable.
    const png = fs.readFileSync(path.join(assetDir, 'placeholder.png'));
    const book = makeSpriteBook(CONFIG, {
      basePath: `${assetDir}${path.sep}`,
      loadJson: (url) => Promise.resolve(fs.readFileSync(url, 'utf8')),
      loadImage: () => Promise.resolve(fakeImage(png.readUInt32BE(16), png.readUInt32BE(20))),
    });

    await book.request('placeholder');
    assert(book.status('placeholder') === SHEET_READY, `the placeholder sheet did not load: ${book.status('placeholder')}`);

    const ctx = fakeCtx();
    assert(book.drawSprite(ctx, { name: 'placeholder', animation: 'vacant', x: 0, y: 0, scale: 3 }) === true,
      'the placeholder did not draw');
    assert(ctx.calls[0][7] === 144 && ctx.calls[0][8] === 96, 'the placeholder did not scale 3x');

    // The clock walks occupied-day through both of its frames. Five frames of
    // render dt, not one 600ms jump — a single advance is clamped on purpose.
    for (let i = 0; i < 5; i++) book.advance(120);
    assert(book.elapsedMs === 600, 'the clock did not accumulate five render frames');
    ctx.calls.length = 0;
    book.drawSprite(ctx, { name: 'placeholder', animation: 'occupied-day', scale: 1 });
    assert(ctx.calls[0][1] === 96, 'the clock did not advance the placeholder to its second frame');
  },

  'the ingest catalogue produces sidecars the loader accepts'() {
    // tools/ingest_sprite.py builds every sidecar from this catalogue, so if a
    // catalogue entry cannot be expressed as a valid sidecar, the tool would
    // write art the renderer silently refuses to draw.
    const catalog = readCatalog();
    assert(Object.keys(catalog).length >= 28, 'the catalogue lost entries');

    for (const [name, entry] of Object.entries(catalog)) {
      assert(Number.isInteger(entry.frameW) && Number.isInteger(entry.frameH), `${name} has no native frame size`);
      assert(entry.fit === 'stretch' || entry.fit === 'contain', `${name} has no fit policy`);
      assert(Array.isArray(entry.states) && entry.states.length > 0, `${name} declares no states`);

      const sidecar = sidecarFor(entry);
      const cols = Object.values(sidecar.animations).reduce((n, a) => n + a.frames, 0);
      const parsed = parseSheetManifest(sidecar, {
        config: CONFIG,
        sheetW: entry.frameW * cols,
        sheetH: entry.frameH,
      });
      assert(parsed.ok, `${name} does not describe a loadable sheet: ${parsed.error}`);
      assert(parsed.warnings.length === 0, `${name} warned: ${parsed.warnings.join(' / ')}`);

      // Column offsets must tile the strip exactly — no gap, no overlap.
      const spans = Object.values(parsed.sheet.animations)
        .map((a) => [a.col, a.col + a.frames]).sort((x, y) => x[0] - y[0]);
      let cursor = 0;
      for (const [from, to] of spans) {
        assert(from === cursor, `${name} has a gap or overlap at column ${from}`);
        cursor = to;
      }
      assert(cursor === cols, `${name} does not fill its own strip`);
    }
  },

  'every asset in spec/asset-request.md is in the catalogue, at the size the doc states'() {
    // The doc is what Keith pastes to the image model; the catalogue is what
    // the ingest tool cuts to. Drift between them means art arrives that
    // nothing can ingest, which is only discovered by hand.
    const doc = fs.readFileSync(path.join(here, '..', 'spec', 'asset-request.md'), 'utf8');
    const catalog = readCatalog();

    const rows = doc.split('\n').filter((line) => /^\|\s*\d+\s*\|/.test(line));
    assert(rows.length >= 28, `only found ${rows.length} asset rows in the request doc`);

    for (const row of rows) {
      const cells = row.split('|').map((c) => c.trim());
      const file = (cells[2] ?? '').match(/`([a-z0-9-]+)\.png`/);
      assert(file, `could not read a file name from: ${row.slice(0, 60)}`);
      const name = file[1];
      const entry = catalog[name];
      assert(entry, `${name}.png is in spec/asset-request.md but not in tools/sprite-catalog.json`);

      // "48x32", "48x16 tile", "32x32 each, 17 across" — but not "16 px tall",
      // which states only a height and is checked on its own.
      const size = (cells[3] ?? '').match(/(\d+)x(\d+)/);
      if (size) {
        assert(entry.frameW === Number(size[1]) && entry.frameH === Number(size[2]),
          `${name} is ${size[1]}x${size[2]} in the doc but ${entry.frameW}x${entry.frameH} in the catalogue`);
      } else {
        const tall = (cells[3] ?? '').match(/(\d+)\s*px tall/);
        assert(tall, `${name} states no size the catalogue can be checked against: "${cells[3]}"`);
        assert(entry.frameH === Number(tall[1]),
          `${name} is ${tall[1]}px tall in the doc but ${entry.frameH} in the catalogue`);
      }
    }

    for (const name of Object.keys(catalog)) {
      assert(doc.includes(`\`${name}.png\``), `${name} is in the catalogue but nothing asked the artist for it`);
    }
  },

  'any real art already ingested still matches the catalogue'() {
    // Runs against whatever is in assets/sprites right now, so the moment
    // Keith ingests a subject, `npm test` checks the pair instead of a person
    // having to open the game. Files nobody catalogued (the placeholder) are
    // skipped; a catalogued name must match exactly.
    const catalog = readCatalog();
    for (const file of fs.readdirSync(assetDir).filter((f) => f.endsWith('.json'))) {
      const name = file.replace(/\.json$/, '');
      const entry = catalog[name];
      if (!entry) continue;

      const png = path.join(assetDir, `${name}.png`);
      assert(fs.existsSync(png), `${name}.json has no ${name}.png beside it`);
      const bytes = fs.readFileSync(png);
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);

      const parsed = parseSheetManifest(fs.readFileSync(path.join(assetDir, file), 'utf8'),
        { config: CONFIG, sheetW: width, sheetH: height });
      assert(parsed.ok, `${name} is not loadable: ${parsed.error}`);

      const cols = Object.values(parsed.sheet.animations).reduce((n, a) => n + a.frames, 0);
      assert(width === entry.frameW * cols && height === entry.frameH,
        `${name}.png is ${width}x${height}, but its states need ${entry.frameW * cols}x${entry.frameH}`);
      assert(JSON.stringify(parsed.sheet.animations) === JSON.stringify(parseSheetManifest(sidecarFor(entry), { config: CONFIG }).sheet.animations),
        `${name}'s sidecar has drifted from the catalogue — re-run tools/ingest_sprite.py`);
    }
  },

  'nothing in sim/ or harness/ can reach the renderer'() {
    // The one architectural rule: the sim is pure and the renderer disposable.
    // A sprite import under sim/ would drag the DOM into the headless harness.
    const roots = [
      path.join(here, '..', 'src', 'games', 'lift', 'sim'),
      path.join(here, '..', 'harness'),
    ];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);

    for (const root of roots) {
      for (const file of walk(root).filter((f) => f.endsWith('.js'))) {
        const src = fs.readFileSync(file, 'utf8');
        assert(!/from\s+['"][^'"]*render\//.test(src), `${path.basename(file)} imports from render/`);
        assert(!src.includes('sprites.js'), `${path.basename(file)} reaches the sprite loader`);
      }
    }
  },
};
