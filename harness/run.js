/**
 * One headless run -> a table on stdout and out/<game>-<policy>-<seed>.json.
 * Usage: node harness/run.js <game> [policy] [days] [seed]
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadGame, play, table, listGames } from './load.js';

const [, , gameName, policyName, daysArg = '40', seedArg = '1'] = process.argv;
if (!gameName) {
  console.error('usage: node harness/run.js <game> [policy] [days] [seed]');
  console.error('games: ' + listGames().join(', '));
  process.exit(1);
}

const game = await loadGame(gameName);
const policyKey = policyName || Object.keys(game.POLICIES)[0];
const days = Number(daysArg), seed = Number(seedArg);
const state = play(game, policyKey, days, seed);

console.log('\n  ' + game.POLICIES[policyKey].name + '   seed ' + seed
  + '   ' + state.log.length + ' days   daySeconds=' + game.CONFIG.time.daySeconds + '\n');
console.log(table(state.log, game.meta.columns));

const cliff = game.meta.cliff?.(state.log, game.CONFIG) ?? null;
console.log('\n  ' + (state.over ? 'RUN ENDED on day ' + state.day : 'survived all ' + days + ' days'));
if (game.meta.summary) console.log('  ' + game.meta.summary(state, game.CONFIG));
if (cliff) console.log('  ' + cliff.label);

const out = path.join(process.cwd(), 'out');
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, gameName + '-' + policyKey + '-' + seed + '.json');
fs.writeFileSync(file, JSON.stringify({
  schema: 'lift-run-log/v1', game: gameName, policy: policyKey, seed, days,
  config: game.CONFIG, cliff, over: state.over, log: state.log, events: state.events,
}, null, 2));
console.log('  wrote ' + path.relative(process.cwd(), file) + '\n');
