import { CONFIG } from './config.js';
import { haulCeiling, realCeiling } from './sim/index.js';

export { CONFIG } from './config.js';
export { boot, step, applyAction } from './sim/index.js';
export { POLICIES } from './policies.js';

export const meta = {
  name: 'bloom',
  title: 'Bloom Rush',
  bottleneck: 'you ARE the water delivery system - one cup, one trip down the hill, a finite day',
  play: '/src/games/bloom/index.html',
  columns: ['day', 'alive', 'ripe', 'cash', 'seeds', 'hauls', 'pours', 'harvests',
            'planted', 'died', 'spilled', 'haulPct', 'pourPct', 'idlePct', 'earned'],
};

/** Cash per day. The only score that matters once the run survives. */
meta.score = (state) => state.log.length
  ? +(state.cash / state.log.length).toFixed(1) : 0;
meta.scoreLabel = 'cash/day';

/** The README's Three Walls, two of which are pure arithmetic. */
meta.walls = () => ({
  haulCeiling: +haulCeiling(CONFIG).toFixed(2),
  realCeiling: +realCeiling(CONFIG).toFixed(2),
});

meta.cliff = (log) => {
  const first = log.find((d) => d.died > 0);
  return first ? {
    day: first.day, alive: first.alive,
    label: 'first plant death: day ' + first.day + ' (' + first.died + ' died, '
         + first.alive + ' left, ' + first.idlePct + '% of the day idle)',
  } : null;
};

meta.summary = (state) => {
  const w = meta.walls();
  const d = state.log[state.log.length - 1];
  if (!d) return 'no days completed';
  const avgAlive = (state.log.reduce((a, x) => a + x.alive, 0) / state.log.length).toFixed(1);
  const totalDead = state.log.reduce((a, x) => a + x.died, 0);
  return '$' + meta.score(state) + '/day  ·  avg ' + avgAlive + ' plants alive  ·  '
       + totalDead + ' died  ·  ceilings: haul ' + w.haulCeiling + ', real ' + w.realCeiling;
};
