import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const page = read('../src/games/lift/index.html');
const app = read('../src/games/lift/ui/app.js');
const config = read('../src/games/lift/config.js');
const guide = read('../docs/HOW_TO_PLAY.md');
const topBar = read('../src/games/lift/ui/hud/TopBar.tsx');
const statBar = read('../src/games/lift/ui/hud/StatBar.tsx');
const canvas = read('../src/games/lift/render/canvas.js');

/** The markup between two ids, so "is X inside Y" is asked of a real region. */
function region(source, open, close) {
  const start = source.indexOf(open);
  const end = source.indexOf(close, start);
  assert(start >= 0 && end > start, 'could not bound the region ' + open + ' .. ' + close);
  return source.slice(start, end);
}

/** A named function body, bounded at its closing brace in column 0. */
function fn(name, source = app) {
  const start = source.indexOf('function ' + name + '(');
  assert(start > 0, 'no function ' + name);
  const end = source.indexOf('\n}', start);
  assert(end > start, 'could not bound ' + name);
  return source.slice(start, end);
}

/** Every tool tile in the palette, in the order the player reads them. */
const paletteOrder = [...page.matchAll(/<button class="tile" data-(?:do|kind|facility)="([a-z_]+)"/g)]
  .map((match) => match[1]);

/** The tower click handler, bounded so a match elsewhere cannot pass for one here. */
function placementHandler() {
  const start = app.indexOf("canvas.addEventListener('click'");
  const end = app.indexOf('// The ghost tracks the cursor');
  assert(start > 0 && end > start, 'could not bound the tower placement handler');
  return app.slice(start, end);
}

export const tests = {
  'player page has one compact primary build menu before telemetry'() {
    assert((page.match(/id="build"/g) ?? []).length === 1, 'player page has duplicate build menus');
    // The money/day/population telemetry row is a Solid component mounted at
    // #stat-bar-mount (see ui/hud/StatBar.tsx) — it no longer has its own
    // ids in the static HTML source, so the ordering check anchors on the
    // mount point instead.
    assert(page.indexOf('id="build"') < page.indexOf('id="stat-bar-mount"'), 'build controls are below the first telemetry row');
    assert(page.includes('id="quick-action"'), 'player page is missing the contextual next-action control');
    assert(page.includes('id="time-controls"'), 'player page is missing visible time controls');
    assert(page.includes('data-speed="0">pause'), 'player page is missing a visible pause control');
    assert(page.includes('id="restart-game"'), 'player page is missing a visible fresh-session control');
    assert(page.includes('id="cancel-tool"'), 'player page is missing a way to exit a placement action');
    assert(page.includes('class="player-color-key"'), 'player page is missing room-color meanings');
  },

  'diagnostics are opt-in and post-beta language stays out of player UI'() {
    assert(page.includes('id="developer-panel" hidden'), 'developer panel is not hidden by default');
    assert(!/post-beta/i.test(page), 'post-beta language leaked into player HTML');
    assert(!/post-beta/i.test(app), 'post-beta language leaked into player controller');
  },

  /**
   * spec/tower-view.md §4. The world used to contradict the instruction: four
   * empty storeys in mid-air while the guided path said "build a lobby".
   */
  'a new game opens on bare ground with the lobby tool armed'() {
    assert(/startFloors: 0,/.test(config), 'a new session no longer opens on bare ground');
    assert(app.includes("const OPENING_TOOL = 'lobby';"), 'the opening tool is not the lobby');
    assert(app.includes('let tool = OPENING_TOOL;'), 'a new session does not start on the opening tool');
    assert(app.includes('\n  tool = OPENING_TOOL;'), 'a fresh session does not re-arm the opening tool');
    // Bare ground has no storey for `floorAt` to report, so the ground row has
    // to stay clickable on its own account or the first click cannot land.
    assert(app.includes('function pickBuildFloor('), 'the ground row is unreachable on a tower with no floors');
    assert(placementHandler().includes('pickBuildFloor(px, py)'), 'the tower click does not use the ground-aware pick');
    // A room raises its own storey now, so the row above the roof has to be a
    // legal click target too. Without it the sim rule is unreachable and the
    // tower can only ever be one storey tall — the interface would refuse a
    // move the rules allow.
    const pick = app.slice(app.indexOf('function pickBuildFloor('));
    assert(/rowAt\(state\.floors\)/.test(pick.slice(0, pick.indexOf('\n}'))),
      'a build click cannot reach the storey above the roof, so a room can never raise one');
  },

  /**
   * The bug this locks down, because it cost a real one: `floorAt` answers
   * `null` when the point is not on the tower, and `null >= 0` is TRUE in
   * JavaScript. A relational test against 0 therefore reads a click in empty
   * sky as floor 0, AND refuses B1, which is a legitimate floor of -1. The
   * rule is that a pick is checked for null, never compared numerically —
   * guarding the rule rather than the one line that got it wrong, because the
   * same mistake has four call sites to reappear in.
   */
  'a floor pick is tested for null, never compared against zero'() {
    const pick = app.slice(app.indexOf('function pickBuildFloor('));
    const body = pick.slice(0, pick.indexOf('\n}'));
    assert(/floor\s*!=\s*null|floor\s*==\s*null/.test(body),
      'pickBuildFloor does not test its pick for null');
    assert(!/floor\s*[<>]=?\s*0/.test(body),
      'pickBuildFloor compares a possibly-null pick against 0, which reads empty sky as the ground floor');

    // And the same rule everywhere the pick is consumed, not just where it is made.
    for (const site of ['function armedAction(', 'function ghostGeometry(']) {
      const at = app.indexOf(site);
      if (at < 0) continue;
      const region = app.slice(at, at + 1200);
      assert(!/floor\s*[<>]=?\s*0/.test(region),
        site.replace('function ', '').replace('(', '') + ' compares a floor against 0, which excludes the basements');
    }
  },

  /** spec/tower-view.md §5: a palette, ordered by the actual first move. */
  'the build palette is a grouped tool shelf ordered by the first move'() {
    assert(paletteOrder.length === 18, `palette has ${paletteOrder.length} tools, expected 18`);
    const at = (name) => paletteOrder.indexOf(name);
    assert(paletteOrder[0] === 'lobby', 'the palette does not lead with the lobby');
    assert(at('lobby') < at('shaft') && at('shaft') < at('car') && at('car') < at('office'),
      'the palette is not ordered lobby, shaft, car, rooms');
    // SimTower has no floor purchase and neither do we any more (Keith's call,
    // 2026-09-01): a room carries its own storey, so a tool that sells an
    // empty one would teach the floors-first habit all over again.
    assert(!paletteOrder.includes('floor'), 'the palette still sells an empty storey');
    assert(at('dig') === at('lobby') + 1, 'dig is not beside the lobby in the structure group');
    for (const group of ['structure', 'transport', 'rentable', 'services']) {
      assert(page.includes('data-group="' + group + '"'), 'the palette is missing the ' + group + ' group');
    }
    for (const tool of ['lobby', 'dig', 'stairs', 'shaft', 'car', 'express', 'office', 'condo', 'shop', 'hotel',
      'food', 'parking', 'medical', 'security', 'recycling', 'demolish']) {
      assert(paletteOrder.includes(tool), 'the palette has no ' + tool + ' tile');
    }
    assert((page.match(/class="btn-cost"/g) ?? []).length === paletteOrder.length, 'not every tile carries its cost');
    assert((page.match(/class="tile-icon"/g) ?? []).length === paletteOrder.length, 'not every tile carries an icon');
    assert(!page.includes('build-more'), 'the palette still hides tools behind a disclosure list');
  },

  /**
   * The art has to actually be on the buttons. It was made, ingested, and
   * catalogued, and the tiles went on showing text monograms — Keith:
   * "the sidebar doesn't have the graphics we made for the buttons." A sheet
   * that exists and is never drawn is the same defect as a column nothing
   * reads, and it is invisible from the code alone.
   */
  'every palette tile draws its icon from the sheet'() {
    const catalog = JSON.parse(read('../tools/sprite-catalog.json'));
    const order = catalog['palette-icons'].states.map((state) => state.name);
    const frame = catalog['palette-icons'].frameW;

    assert(page.includes("background-image: url('assets/sprites/palette-icons.png')"),
      'the tiles do not load the icon sheet at all');

    // Match the TILES only. `data-icon=` also appears in the CSS selectors this
    // test checks, and counting those made the palette look twice its size.
    const icons = [...page.matchAll(/class="tile-icon" data-icon="([a-z_]+)"/g)].map((m) => m[1]);
    assert(icons.length === paletteOrder.length, 'a tile is missing its icon slot');

    for (const [i, icon] of icons.entries()) {
      assert(order.includes(icon),
        icon + ' is on a tile but not in the icon sheet — the sheet and the palette have drifted');
      // The offset has to be the cell the sheet actually cut for that name.
      const expected = `background-position: -${order.indexOf(icon) * frame}px 0`;
      assert(page.includes(`.tile-icon[data-icon="${icon}"] { ${expected}`),
        icon + ' does not point at its own cell (' + expected + ')');
      // And the tile at position i must be the tool at position i: an icon
      // pointing at a valid cell of the WRONG tool is the failure that looks
      // fine until someone reads the buttons.
      assert(icon === paletteOrder[i] || order.indexOf(icon) === i,
        'tile ' + i + ' (' + paletteOrder[i] + ') shows the ' + icon + ' icon');
    }
    // Pixel art must not be smoothed by the browser.
    assert(/image-rendering: pixelated/.test(page), 'the icon sheet is drawn smoothed');
  },

  'unaffordable and locked tiles are visible states, never missing ones'() {
    assert(page.includes('button.tile.unaffordable') && page.includes('button.tile.locked'),
      'the palette has no styling for unaffordable or locked tools');
    assert(app.includes('function setTileState('), 'nothing computes a tile\'s affordability state');
    assert((app.match(/setTileState\(b, /g) ?? []).length === 3,
      'the structure, service, and room tiles do not all report their state');
    assert(app.includes("' short'"), 'an unaffordable tile does not say how far short the player is');
    assert(!/\.hidden = (?:true|locked)/.test(app.slice(app.indexOf('function setTileState('), app.indexOf('function refresh()'))),
      'a tile state hides the tool instead of marking it');
  },

  /**
   * spec/tower-view.md §5: "the ghost is a dry run of the same validation the
   * click will perform." A second copy of the placement rules would drift, and
   * a green ghost would start meaning something the click does not.
   */
  'the placement ghost is a dry run of applyAction, not a second rules table'() {
    const start = app.indexOf('function dryRun(');
    const end = app.indexOf("/** Why the ghost is red");
    assert(start > 0 && end > start, 'could not bound the dry run');
    const dry = app.slice(start, end);
    assert(dry.includes('applyAction(probe, action, CONFIG)'), 'the ghost does not ask applyAction whether the action lands');
    assert(dry.includes('funded.today.spent - state.today.spent'),
      'the ghost recomputes a price instead of reading the one the sim charged');
    assert(!/CONFIG\.costs\./.test(dry), 'the ghost reads the cost table directly instead of running the action');
    assert(!/state\.units\.|state\.shafts\.|slotsUsed\(/.test(dry),
      'the ghost re-implements a placement rule instead of running the action');
    assert(app.includes("ghost.classList.toggle('blocked', !verdict.ok)"), 'the ghost has no red state');
    assert(app.includes('placementReason(verdict)'), 'a red ghost does not carry the reason it is red');
    assert(placementHandler().includes('placementVerdict(tool, { floor, slot: clickSlot'),
      'the click does not gate on the same verdict the ghost showed');
  },

  /** spec/tower-view.md §5 and §8: repeat placement is the default. */
  'an armed tool survives the placement it makes'() {
    const placement = placementHandler();
    assert(!placement.includes("tool = 'observe'"), 'a successful placement still disarms the tool');
    assert(!placement.includes("tool = 'office'"), 'a successful placement still swaps the tool for office');
    assert(placement.includes("tool = 'lobby_wing'"),
      'the one-per-tower lobby does not carry on as the wing tool');
    assert(placement.includes('stays armed'), 'nothing tells the player the tool is still armed');
  },

  'Esc and right-click put the armed tool away'() {
    assert(app.includes("if (e.key === 'Escape') { disarmTool(true); return; }"), 'Esc does not disarm the tool');
    assert(app.includes("canvas.addEventListener('contextmenu'"), 'right-click does not disarm the tool');
    const start = app.indexOf('function disarmTool(');
    const end = app.indexOf('// ---------------------------------------------------------------- game loop');
    assert(start > 0 && end > start, 'could not bound the disarm path');
    assert(app.slice(start, end).includes("tool = 'observe';"), 'disarming does not return to WATCHING');
    assert(app.includes("els['cancel-tool'].addEventListener('click', () => disarmTool());"),
      'the cancel control no longer shares the disarm path');
  },

  'opening and recovery states are explicit in the player flow'() {
    assert(app.includes("if (tool === 'observe') return 'WATCHING — let the next rush run"), 'the disarmed state has no watch instruction');
    assert(app.includes('watching tower; let the next rush run'), 'car recovery does not point back at watching');
    assert(app.includes("els['cancel-tool'].hidden = tool === 'observe';"), 'placement cancel state is not reflected in the player UI');
    assert(app.includes("els['restart-game'].textContent = 'confirm new session';"), 'fresh-session reset has no in-page confirmation state');
    assert(!app.includes('window.confirm'), 'fresh-session reset relies on an unavailable native dialog');
    assert(guide.includes('already armed'), 'player guide does not explain the armed opening tool');
    assert(guide.includes('stays armed'), 'player guide does not explain that a tool survives a placement');
    assert(guide.includes('new session'), 'player guide does not explain how to restart the loop');
  },

  /**
   * Issue #13. Keith, three times: "I have no menu as a player, just the
   * sidebar with EVERYTHING. I have no good HUD for any useful info." The fix
   * is structural, not cosmetic — the bar is a sibling of the stage and the
   * sidebar, in its own page-grid row, so it CANNOT scroll away with the
   * column. A bar nested in the aside would look identical and fail the moment
   * the palette got one tile longer.
   */
  'the player HUD is a bar of its own, outside the scrolling sidebar'() {
    assert(page.includes('id="topbar"'), 'the page has no player HUD bar');
    assert(page.indexOf('id="topbar"') < page.indexOf('<aside>'),
      'the HUD bar is not ahead of the sidebar in the document');
    const aside = region(page, '<aside>', '</aside>');
    assert(!aside.includes('id="topbar"'), 'the HUD bar is nested inside the scrolling sidebar');
    assert(!aside.includes('id="top-bar-mount"'), 'the HUD readouts are nested inside the scrolling sidebar');
    assert(/#topbar \{[^}]*grid-column: 1 \/ -1/.test(page), 'the HUD bar does not span both page columns');
    assert(/grid-template-rows: auto 1fr/.test(page), 'the page grid has no row for the HUD bar');
    // Speed controls at the right end of the bar, not down the column.
    const header = region(page, '<header id="topbar">', '</header>');
    assert(header.includes('id="time-controls"'), 'the time controls are not in the HUD bar');
    assert(header.includes('id="top-bar-mount"') && header.includes('id="hud-context-mount"'),
      'the HUD bar is missing one of its mount points');
  },

  /**
   * What is allowed in the bar is the whole point: the four identity readings
   * and the three signals a build decision is made from. Everything else is
   * behind `D`. Both halves are asserted — a bar that grew the telemetry column
   * back would be the original complaint again, and a `D` view that lost a
   * reading would cost the balance work its instrument.
   */
  'the HUD carries the decision signals and the developer view keeps the rest'() {
    for (const glance of ['hud.star', 'hud.money', 'hud.day', 'hud.clock', 'hud.rush',
      'hud.population', 'hud.waitingNow', 'hud.rate', 'hud.rep']) {
      assert(topBar.includes(glance), 'the HUD bar does not show ' + glance);
    }
    for (const inspect of ['tenantUtilizationTrendHtml', 'roomEval', 'desirability', 'wait']) {
      // `\b` because `hud.wait` is a prefix of `hud.waitingNow`, and a naive
      // substring test would call the bar's own waiting readout a leak.
      const reads = new RegExp('hud\\.' + inspect + '\\b');
      assert(!reads.test(topBar), inspect + ' is a reading for inspecting, not for glancing');
      assert(reads.test(statBar), inspect + ' was dropped rather than moved behind D');
    }
    const developer = region(page, 'id="developer-panel"', '</section>');
    assert(developer.includes('id="stat-bar-mount"'), 'the telemetry column is not behind the developer toggle');
    assert(developer.includes('id="transport"') && developer.includes('id="knobs"'),
      'the developer view lost the diagnostics it is tuned with');
    assert(app.includes("if (e.key.toLowerCase() === 'd') setDeveloperMode(!developerMode);"),
      'D no longer opens the developer view');
  },

  /**
   * Issue #14's rule, applied to the appeal view: a thing the renderer computes,
   * draws and tests is still a defect if nothing in the interface asks for it.
   * The overlay must be reachable BOTH by the key and by a control a player can
   * see without knowing the key — and both must go through one function, because
   * a button that flips its own pressed state is a second answer to "is the
   * overlay on" that can disagree with the renderer.
   */
  'the appeal view is reachable by key and by a visible control, through one path'() {
    assert(page.includes('id="appeal-toggle"'), 'the appeal view has no control a player can see');
    const header = region(page, '<header id="topbar">', '</header>');
    assert(header.includes('id="appeal-toggle"'), 'the appeal view control is not in the HUD bar');
    assert(app.includes("if (e.key.toLowerCase() === 'a') toggleAppealOverlay();"),
      'A no longer reaches the appeal view');
    assert(app.includes("els['appeal-toggle'].addEventListener('click', () => toggleAppealOverlay());"),
      'the visible control does not share the key\'s path');
    // Exactly one caller of the renderer's toggle: two would be two truths.
    assert((app.match(/renderer\.toggleAppealOverlay\(\)/g) ?? []).length === 1,
      'the renderer overlay is toggled from more than one place');
    // And the pressed state is written where the toggle is, not guessed at the
    // call sites — styled off `aria-pressed` so there is one flag, not two.
    const toggle = fn('toggleAppealOverlay');
    assert(/setAttribute\('aria-pressed', String\(on\)\)/.test(toggle),
      'the control never reports whether the overlay is on');
    assert(!/classList\.(?:toggle|add|remove)\(/.test(toggle),
      'the control carries a second on/off flag beside aria-pressed');
    assert(/\[aria-pressed="true"\]/.test(page), 'nothing styles the pressed state of the view toggle');
  },

  /**
   * The key has to name the signals the tower actually draws — the miniature of
   * the whole problem, and the one that cost a tower. Keith ran delivery at 100%
   * and reputation at 100 and lost every tenant to room appeal, because nothing
   * told him which cause he was looking at; meanwhile the key went on describing
   * a red fade as THE appeal warning after the wick replaced it as the warning.
   * A legend that names the wrong signal is worse than no legend.
   *
   * Both markers run amber to red, so colour cannot separate them: the key must
   * say which EDGE each sits on, and the edge it names must be the edge the
   * renderer draws it on. That last half is what stops the copy drifting away
   * from the drawing the next time a marker moves.
   */
  'the room key names the markers the renderer draws, on the edges it draws them'() {
    const key = region(page, 'class="player-color-key"', '</div>');

    // Where the renderer actually puts each marker.
    const wickBox = fn('departureWickBox', canvas);
    assert(/return \{ x: x \+ /.test(wickBox) && !/x \+ L?\.?cw/.test(wickBox),
      'the departure wick no longer sits on the room\'s left edge, and the key still says it does');
    // EVERY stress-line draw, not any one of them: the sprite path and the
    // fallback path both draw it, and an assertion satisfied by either would
    // pass while one of them moved off the bottom edge the key promises.
    const stressDraws = [...canvas.matchAll(/fillRect\(x \+ 2, y \+ ([^,]+), \(L\.cw - 4\) \* stress/g)]
      .map((match) => match[1]);
    assert(stressDraws.length >= 2, 'the stress line draw sites moved or were renamed; re-anchor this check');
    for (const at of stressDraws) {
      assert(at === 'L.fh - 7',
        'a stress line is drawn at ' + at + ', not the room\'s bottom edge the key promises');
    }

    // And the key says so, in words, with the edge attached to the cause.
    assert(/LEFT edge/.test(key) && /BOTTOM edge/.test(key),
      'the key does not say which edge each warning sits on, and colour cannot tell them apart');
    const left = key.indexOf('LEFT edge');
    const bottom = key.indexOf('BOTTOM edge');
    assert(key.slice(left, bottom).includes('room appeal'),
      'the left-edge marker is not tied to room appeal');
    assert(key.slice(bottom).includes('slow lifts'),
      'the bottom-edge marker is not tied to slow lifts');
    // Different causes, different money — the point of separating them at all.
    assert(/services, rent or noise/.test(key) && /cars and shafts/.test(key),
      'the key names two warnings and gives them one fix');

    // Negated: the stale claim that the fade IS the appeal warning must be gone.
    assert(!/red fade = low appeal/.test(page),
      'the key still sells the red fade as the appeal warning the wick replaced');

    // The appeal view is findable from the key and from the shortcut list.
    assert(/appeal view/.test(key), 'the key never mentions the appeal view');
    assert(/<b>A<\/b> appeal view/.test(page), 'the shortcut list does not list A');

    // The developer legend carries a row for each of the three, so the view we
    // tune with names them too.
    const legend = region(page, 'LEGEND &amp; SIGNALS', '</section>');
    for (const [swatch, meaning] of [['swatch-wick', 'departure wick'], ['swatch-stress', 'stress line'],
      ['swatch-appeal', 'appeal view']]) {
      assert(legend.includes(swatch), 'the legend has no row for the ' + meaning);
      assert(legend.includes(meaning), 'the legend row for ' + meaning + ' does not name it');
      assert(new RegExp('\\.' + swatch + ' \\{').test(page), 'the ' + meaning + ' row has no swatch to show');
    }
  },

  /** Issue #13: the sidebar reduced to the next action and the palette. */
  'the sidebar leads with the next action and the palette, not with readings'() {
    const aside = region(page, '<aside>', '</aside>');
    const beforeBuild = aside.slice(0, aside.indexOf('id="build"'));
    assert(beforeBuild.includes('id="quick-action"'), 'the next action is not the first thing in the sidebar');
    // The guided path and the reference keys are reachable, but closed: they
    // are what "the sidebar with EVERYTHING" was made of.
    assert(aside.indexOf('id="beta-path"') > aside.indexOf('id="build"'),
      'the guided path still sits above the palette');
    for (const stowed of ['id="beta-path"', 'class="player-color-key"']) {
      const at = aside.indexOf(stowed);
      const openedBy = aside.lastIndexOf('<details', at);
      const closedBefore = aside.lastIndexOf('</details>', at);
      assert(openedBy > closedBefore, stowed + ' is not stowed behind a disclosure');
    }
  },

  /**
   * Issue #13: "A contextual inspector that appears when a room, shaft or
   * facility is selected and is ABSENT otherwise. Today it stands there empty."
   */
  'the contextual inspector is absent when nothing is selected'() {
    const inspectors = region(page, 'id="inspector-region"', 'class="player-details"');
    for (const panel of ['facility-inspector', 'shaft-inspector', 'unit-inspector']) {
      assert(inspectors.includes('id="' + panel + '"'), panel + ' is outside the contextual region');
      assert(new RegExp('#' + panel + ' \\{[^}]*display: none').test(page),
        panel + ' does not hide itself when there is nothing to show');
    }
    assert(page.includes('#inspector-region:not(:has(.open)) { display: none; }'),
      'the inspector region survives its own empty panels');
    assert(fn('renderInspector').includes("els['unit-inspector'].classList.remove('open')"),
      'the room inspector is never taken back down');
  },

  /**
   * Issues #11 and #12: what the two lines SAY is asserted for real in
   * test/hud-lines.test.js, against the sentences themselves. What is left for
   * this file is where they go — a line nobody can see is the defect that
   * started #11, since the sim had been producing the answer all along.
   */
  'the two HUD lines reach the places a player is looking'() {
    const lines = read('../src/games/lift/ui/hud/lines.js');
    // Pure and DOM-free, which is what lets the copy be tested as copy.
    assert(!/document\.|window\.|els\[/.test(lines), 'the line builders touched the DOM and stopped being testable');
    // A line, not a panel: the developer sidebar already has the panels, and
    // burying the answer in a wall of readings is how it got missed.
    assert(!/<br>|innerHTML|<span/.test(lines), 'the appeal answer grew into a panel again');
    // The ranking stays in the sim. This reads the winner; it does not pick one.
    assert(lines.includes('tenantRetentionRecommendation('),
      'the cause is not taken from the sim\'s own ranking');
    assert(!/\.sort\(/.test(lines), 'the UI re-ranks the causes instead of reading the sim\'s answer');

    assert(app.includes('appealWhy: appealWhy ??'), 'the appeal line never reaches the HUD bar');
    assert(app.includes("els['unit-appeal-why']"), 'the appeal line never reaches the selected room');
    assert(app.includes('hoverUnitId = renderer.unitAt(state, px, py);'), 'hovering a room asks nothing');
    assert(app.includes('weekPattern: weekPattern ??'), 'the week pattern never reaches the HUD bar');
    const header = region(page, '<header id="topbar">', '</header>');
    assert(header.includes('id="hud-context-mount"'), 'the two lines have no slot in the bar');
    assert(topBar.includes('hud.appealWhy') && topBar.includes('hud.weekPattern'),
      'the bar does not render the two lines');
    // Silent when there is nothing to say: `Show` renders nothing for ''.
    assert(/<Show when=\{hud\.appealWhy\.text\}>/.test(topBar) && /<Show when=\{hud\.weekPattern\.text\}>/.test(topBar),
      'an empty line still occupies the bar with a dash');
  },

  /**
   * The crash this locks down, because it cost a real one: selecting any VACANT
   * room threw and took the refresh loop with it. `tenantRetentionRecommendation`
   * answers null for a room with no tenant to retain, and `null?.key !== 'x'` is
   * TRUE — so an optional chain in a NEGATIVE comparison passes the guard and
   * the body then reads straight through the null. The rule is guarded, not the
   * one line that got it wrong: any `x?.k !== <something other than null>` test
   * must not be followed by an unguarded `x.` in its body.
   *
   * Two shapes are exempt, and both for the same reason — the null path never
   * reaches the dereference. `x?.k != null` fails for undefined, so the branch
   * that reads through is not taken; and `if (x?.k !== v) return` sends the
   * null straight out of the function.
   */
  'an optional chain is never used as a guard for reading through the same value'() {
    for (const match of app.matchAll(/(\w+)\?\.\w+ (?:!==|!=) (?!null|undefined)/g)) {
      const [, name] = match;
      const line = app.slice(match.index, app.indexOf('\n', match.index));
      if (/\)\s*(?:return|continue|break)\b/.test(line)) continue;
      const body = app.slice(match.index, match.index + 400);
      assert(!new RegExp('[^.\\w]' + name + '\\.\\w').test(body),
        name + '?.k !== ... guards a body that reads ' + name + '. directly — a null passes that test');
    }
  },

  'opening the page is safe before the player starts the clock'() {
    assert(app.includes('let speed = 0;'), 'game starts simulating before the player chooses a speed');
    assert(app.includes('RENDER_INTERVAL_MS = 1000 / 30'), 'visual rendering is not capped for a safe baseline');
    assert(app.includes('LIVE_REFRESH_INTERVAL_MS = 200'), 'live sidebar refreshes are not throttled');
  },
};
