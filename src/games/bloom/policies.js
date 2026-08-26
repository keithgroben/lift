import { applyAction, living, waterNeed, realCeiling } from './sim/index.js';

/**
 * Autoplayers for Bloom Rush.
 *
 * Unlike Lift, a Bloom policy is consulted EVERY TICK the hands are idle, not
 * once a day — because the game is played in seconds, not in daily decisions.
 * The harness calls tick() whenever state.busy is null.
 *
 * The experiment these encode: hold exactly N plants and see where the
 * arithmetic ceiling turns into an actual wall.
 */

const act = (state, config, type, extra = {}) => applyAction(state, { type, ...extra }, config);

function thirstiest(state, config) {
  const need = waterNeed(state, config);
  let best = -1, lowest = Infinity;
  state.pots.forEach((p, i) => {
    if (!p || !p.alive || p.hydration >= need - 1e-9) return;
    if (p.hydration < lowest) { lowest = p.hydration; best = i; }
  });
  return best;
}

function unmetNeed(state, config) {
  const need = waterNeed(state, config);
  let sum = 0;
  for (const p of state.pots) if (p && p.alive) sum += Math.max(0, need - p.hydration);
  return sum;
}

/**
 * Cheapest ceiling gained per dollar. Upgrades that raise no ceiling (price and
 * seed multipliers) are only considered once nothing else is affordable, so the
 * policy models a player who understands the bottleneck.
 */
function bestUpgrade(state, config) {
  const before = realCeiling(config);
  let best = null;

  for (const up of config.upgrades) {
    if (state.owned.includes(up.id)) continue;
    if (state.cash < up.cost) continue;

    const probe = structuredClone(config);
    if (up.effect.pots) {
      // Pots do not move the ceiling, they move how much of it you can USE.
      if (state.pots.length >= config.field.maxPots) continue;
      if (state.pots.length > before + 1) continue;
      return up;
    }
    const keys = up.effect.path.split('.');
    const last = keys.pop();
    const t = keys.reduce((o, k) => o[k], probe);
    let v = t[last];
    if (up.effect.op === 'add') v += up.effect.value;
    else if (up.effect.op === 'mul') v *= up.effect.value;
    if (up.effect.floor !== undefined) v = Math.max(up.effect.floor, v);
    t[last] = v;

    const gain = realCeiling(probe) - before;
    if (gain > 1e-6) {
      const perDollar = gain / up.cost;
      if (!best || perDollar > best.perDollar) best = { ...up, perDollar };
    }
  }
  return best;
}

const findDead = (state) => state.pots.findIndex((p) => p && !p.alive);
const findRipe = (state) => state.pots.findIndex((p) => p && p.alive && p.growth >= 1 - 1e-9);
const findEmpty = (state) => state.pots.findIndex((p) => !p);

/**
 * Water existing plants before planting new ones. Ordering matters more than any
 * single number here: plant-first is a different game from water-first, and it
 * is the difference between the two baseline policies below.
 */
function tend(state, config, target) {
  const dead = findDead(state);
  if (dead >= 0) return act(state, config, 'clear', { pot: dead });

  // Harvest promptly: a ripe plant still needs watering to avoid dying of
  // stress, AND loses 25% of its value per day left in the pot.
  const rp = findRipe(state);
  if (rp >= 0) return act(state, config, 'harvest', { pot: rp });

  if (unmetNeed(state, config) > 1e-9) {
    const t = thirstiest(state, config);
    if (t >= 0 && state.water > 1e-9) return act(state, config, 'pour', { pot: t });
    if (state.water < config.haul.reservoirMax - 1e-9) return act(state, config, 'haul');
  }

  if (living(state).length < target && state.seeds >= 1) {
    const free = findEmpty(state);
    if (free >= 0) return act(state, config, 'plant', { pot: free });
    // No empty pot but we still want more plants: buy ground.
    if (state.pots.length < Math.min(target, config.field.maxPots)) {
      const r = act(state, config, 'expand');
      if (r.ok) return r;
    }
  }

  // Nothing pressing: bank water for tomorrow morning. Idling with a half-empty
  // reservoir is the most common way a human loses this game.
  if (state.water < config.haul.reservoirMax - 1e-9) return act(state, config, 'haul');
  return null;
}

export const POLICIES = {
  /**
   * H1: overextension is the failure mode. Fills every pot the moment it can,
   * then tries to keep up. This is what a new player does.
   */
  greedy: {
    name: 'greedy (fill every pot, then cope)',
    tick(state, config) {
      if (state.seeds >= 1) {
        const free = findEmpty(state);
        if (free >= 0) return act(state, config, 'plant', { pot: free });
        if (state.pots.length < config.field.maxPots) {
          const r = act(state, config, 'expand');
          if (r.ok) return r;
        }
      }
      return tend(state, config, config.field.maxPots);
    },
  },

  /**
   * H2: there is a correct number of plants, and it is small. If the hold-N
   * curve peaks and then falls, the bottleneck is real and the game has a
   * decision in it. If it rises monotonically, there is no wall.
   */
  ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map((n) => ['hold' + n, {
    name: 'hold ' + n + ' plant' + (n > 1 ? 's' : ''),
    target: n,
    tick(state, config) { return tend(state, config, n); },
  }])),

  /**
   * H4: the intended play. Hold the CURRENT ceiling, and spend everything spare
   * on whatever raises it most per dollar. If this does not pull away from every
   * fixed hold-N, the upgrade ladder is not doing its job and the game has no
   * progression - only a plateau.
   */
  climber: {
    name: 'climber (hold the ceiling, buy to raise it)',
    tick(state, config) {
      const ceiling = Math.floor(realCeiling(config));

      // Buy only when the field is already at capacity - upgrading before you
      // have felt the wall is exactly the purchase the game must not reward.
      if (living(state).length >= ceiling) {
        const best = bestUpgrade(state, config);
        if (best) {
          const r = act(state, config, 'buy', { id: best.id });
          if (r.ok) return r;
        }
      }
      return tend(state, config, ceiling);
    },
  },

  /**
   * H3: the arithmetic knows the answer. Holds exactly the computed real
   * ceiling. If this does not beat every fixed hold-N, the formula in
   * sim/index.js is wrong and the walls are not where the README says.
   */
  arithmetic: {
    name: 'arithmetic (hold the computed ceiling)',
    tick(state, config) { return tend(state, config, Math.floor(realCeiling(config))); },
  },
};
