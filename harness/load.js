/**
 * Resolves a game by name. The harness knows nothing about any specific game
 * beyond the manifest shape in src/games/<name>/game.js — that boundary is what
 * lets one harness serve every prototype in the repo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GAMES_DIR = path.join(process.cwd(), 'src', 'games');

export function listGames() {
  if (!fs.existsSync(GAMES_DIR)) return [];
  return fs.readdirSync(GAMES_DIR)
    .filter((d) => fs.existsSync(path.join(GAMES_DIR, d, 'game.js')))
    .sort();
}

export async function loadGame(name) {
  const games = listGames();
  if (!games.includes(name)) {
    console.error('unknown game "' + name + '". have: ' + games.join(', '));
    process.exit(1);
  }
  const mod = await import(pathToFileURL(path.join(GAMES_DIR, name, 'game.js')).href);
  for (const required of ['CONFIG', 'boot', 'step', 'POLICIES', 'meta']) {
    if (!mod[required]) throw new Error(name + '/game.js is missing export "' + required + '"');
  }
  return mod;
}

/** Play one seed to completion under one policy. Shared by run and sweep so a
 *  single-run table can never disagree with the sweep it is supposed to explain. */
export function play(game, policyKey, days, seed) {
  const { CONFIG, boot, step, POLICIES } = game;
  const policy = POLICIES[policyKey];
  if (!policy) {
    console.error('unknown policy "' + policyKey + '". have: ' + Object.keys(POLICIES).join(', '));
    process.exit(1);
  }
  const state = boot(CONFIG, seed);
  policy.open?.(state, CONFIG);
  while (state.day <= days && !state.over) {
    const closed = step(state, CONFIG.time.dt, CONFIG);
    if (closed) policy.decide?.(state, CONFIG);
  }
  return state;
}

export function table(log, columns) {
  const w = Object.fromEntries(columns.map((c) => [c, Math.max(c.length, 7)]));
  const line = (row) => columns.map((c) => String(row[c] ?? '').padStart(w[c])).join(' ');
  const out = [line(Object.fromEntries(columns.map((c) => [c, c]))),
               columns.map((c) => '-'.repeat(w[c])).join(' ')];
  for (const d of log) out.push(line(d));
  return out.join('\n');
}
