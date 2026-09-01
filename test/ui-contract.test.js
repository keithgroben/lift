import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const page = read('../src/games/lift/index.html');
const app = read('../src/games/lift/ui/app.js');
const config = read('../src/games/lift/config.js');
const guide = read('../docs/HOW_TO_PLAY.md');

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

  'opening the page is safe before the player starts the clock'() {
    assert(app.includes('let speed = 0;'), 'game starts simulating before the player chooses a speed');
    assert(app.includes('RENDER_INTERVAL_MS = 1000 / 30'), 'visual rendering is not capped for a safe baseline');
    assert(app.includes('LIVE_REFRESH_INTERVAL_MS = 200'), 'live sidebar refreshes are not throttled');
  },
};
