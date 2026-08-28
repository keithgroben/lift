import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const page = read('../src/games/lift/index.html');
const app = read('../src/games/lift/ui/app.js');
const guide = read('../docs/HOW_TO_PLAY.md');

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

  'opening and recovery states are explicit in the player flow'() {
    assert(app.includes("let tool = 'observe';"), 'opening state still arms a placement tool');
    assert(app.includes('WATCHING — let the next rush run'), 'opening state has no watch instruction');
    assert(app.includes('watching tower; let the next rush run'), 'car recovery does not return to watching');
    assert(app.includes("els['cancel-tool'].hidden = tool === 'observe';"), 'placement cancel state is not reflected in the player UI');
    assert(app.includes("els['restart-game'].textContent = 'confirm new session';"), 'fresh-session reset has no in-page confirmation state');
    assert(!app.includes('window.confirm'), 'fresh-session reset relies on an unavailable native dialog');
    assert(guide.includes('Choose a build button first'), 'player guide does not explain explicit tool selection');
    assert(guide.includes('new session'), 'player guide does not explain how to restart the loop');
  },

  'opening the page is safe before the player starts the clock'() {
    assert(app.includes('let speed = 0;'), 'game starts simulating before the player chooses a speed');
    assert(app.includes('RENDER_INTERVAL_MS = 1000 / 30'), 'visual rendering is not capped for a safe baseline');
    assert(app.includes('LIVE_REFRESH_INTERVAL_MS = 200'), 'live sidebar refreshes are not throttled');
  },
};
