import { makeRng } from './rng.js';

/**
 * Bloom Rush — the sim.
 *
 * The whole design rests on one modelling choice: **the player is a
 * single-threaded actor.** Hauling, pouring, harvesting and planting all occupy
 * the same one pair of hands, and only one can be happening at a time. That is
 * the bottleneck; everything else is bookkeeping around it. If you ever make
 * two actions overlap, the game stops being about anything.
 *
 * Pure and headless: no DOM, no Math.random. Enforced by test.
 */

export function createState(config, seed = 1) {
  const pots = new Array(config.field.startPots).fill(null);
  return {
    seed,
    rng: makeRng(seed),
    elapsed: 0,
    day: 1,
    tod: 0,
    cash: 0,
    seeds: config.field.startSeeds,
    water: 0,
    pots,
    /** The hands. null = idle and able to accept an action. */
    busy: null,
    owned: [],
    weather: config.weather[0],
    combo: 1,
    comboUntil: -1,
    today: blankDay(),
    log: [],
    events: [],
    over: false,
    overReason: null,
  };
}

function blankDay() {
  return {
    hauls: 0, pours: 0, harvests: 0, planted: 0,
    hauledWater: 0, pouredWater: 0, spilled: 0,
    earned: 0, seedsGained: 0, spentOnUpgrades: 0,
    idleSeconds: 0, haulSeconds: 0, pourSeconds: 0, otherSeconds: 0,
    died: 0, dryPlants: 0, wentRipe: 0,
  };
}

export function boot(config, seed = 1) {
  return createState(config, seed);
}

export const newPlant = () => ({ growth: 0, hydration: 0, stress: 0, over: 0, alive: true });

export const waterNeed = (state, config) =>
  config.plant.waterNeed * (config.layers.weather ? state.weather[1] : 1);

export const living = (state) => state.pots.filter((p) => p && p.alive);
export const ripe = (state) => state.pots.filter((p) => p && p.alive && p.growth >= 1 - 1e-9);

/**
 * The analytical ceiling: how many plants one pair of hands can keep watered in
 * a day, before anything is harvested or planted. This is the first of the
 * README's Three Walls, and it is arithmetic — no simulation required.
 */
function perPlantSeconds(config, includeChurn) {
  // Drip arrives free at dawn, so the hands only have to cover the shortfall.
  // This is the ONLY term that does not trade against daylight, which is why
  // automation is the only thing that helps once idle time hits zero.
  const byHand = Math.max(0, config.plant.waterNeed - config.plant.drip);
  if (byHand <= 1e-9) return includeChurn
    ? (config.harvestSeconds + config.plantSeconds) / config.plant.growDays : 0;

  const secPerWater = config.haul.tripSeconds / config.haul.cupSize;
  const pours = Math.ceil(byHand / config.pour.amount) * config.pour.seconds;
  const churn = includeChurn
    ? (config.harvestSeconds + config.plantSeconds) / config.plant.growDays : 0;
  return byHand * secPerWater + pours + churn;
}

export function haulCeiling(config) {
  const per = perPlantSeconds(config, false);
  return per <= 1e-9 ? Infinity : config.time.daySeconds / per;
}

/** The second wall: the same, once harvesting and replanting take their cut. */
export function realCeiling(config) {
  const per = perPlantSeconds(config, true);
  return per <= 1e-9 ? Infinity : config.time.daySeconds / per;
}

// ------------------------------------------------------------------- actions

/**
 * The only way state changes. Rejects while the hands are busy — that rejection
 * is the game. A policy or a player that ignores it is not playing this game.
 */
export function applyAction(state, action, config) {
  if (state.over) return { ok: false, reason: 'run is over' };
  if (state.busy) return { ok: false, reason: 'busy: ' + state.busy.kind };

  const fn = ACTIONS[action.type];
  if (!fn) return { ok: false, reason: 'unknown action ' + action.type };
  return fn(state, action, config);
}

const ACTIONS = {
  haul(state, _a, config) {
    if (state.water >= config.haul.reservoirMax - 1e-9) {
      return { ok: false, reason: 'reservoir full' };
    }
    state.busy = { kind: 'haul', remaining: config.haul.tripSeconds };
    return { ok: true };
  },

  pour(state, a, config) {
    const p = state.pots[a.pot];
    if (!p || !p.alive) return { ok: false, reason: 'nothing to water' };
    const need = waterNeed(state, config);
    if (p.hydration >= need - 1e-9) return { ok: false, reason: 'already watered' };
    if (state.water <= 1e-9) return { ok: false, reason: 'reservoir empty' };

    // Water leaves the reservoir when the pour STARTS. Committing it up front is
    // what makes a mistimed pour cost something.
    const amount = Math.min(config.pour.amount, need - p.hydration, state.water);
    state.water -= amount;
    state.busy = { kind: 'pour', remaining: config.pour.seconds, pot: a.pot, amount };
    return { ok: true };
  },

  harvest(state, a, config) {
    const p = state.pots[a.pot];
    if (!p || !p.alive) return { ok: false, reason: 'nothing there' };
    if (p.growth < 1 - 1e-9) return { ok: false, reason: 'not ripe' };
    state.busy = { kind: 'harvest', remaining: config.harvestSeconds, pot: a.pot };
    return { ok: true };
  },

  plant(state, a, config) {
    if (state.pots[a.pot]) return { ok: false, reason: 'pot is occupied' };
    if (state.seeds < 1) return { ok: false, reason: 'no seeds' };
    state.busy = { kind: 'plant', remaining: config.plantSeconds, pot: a.pot };
    return { ok: true };
  },

  expand(state, _a, config) {
    if (state.pots.length >= config.field.maxPots) return { ok: false, reason: 'no room for another pot' };
    if (state.cash < config.field.potCost) return { ok: false, reason: 'not enough cash' };
    state.cash -= config.field.potCost;
    state.busy = { kind: 'expand', remaining: config.field.potSeconds };
    return { ok: true };
  },

  /**
   * Buy an upgrade. Effects are declarative data in config.upgrades and are
   * applied to THIS RUN's config, which the harness clones per run - so a
   * purchase in one seed can never leak into the next.
   */
  buy(state, a, config) {
    const up = config.upgrades.find((u) => u.id === a.id);
    if (!up) return { ok: false, reason: 'no such upgrade' };
    if (state.owned.includes(up.id)) return { ok: false, reason: 'already owned' };
    if (state.cash < up.cost) return { ok: false, reason: 'costs $' + up.cost };

    state.cash -= up.cost;
    state.owned.push(up.id);
    applyEffect(state, up.effect, config);
    state.today.spentOnUpgrades += up.cost;
    return { ok: true };
  },

  clear(state, a, config) {
    const p = state.pots[a.pot];
    if (!p || p.alive) return { ok: false, reason: 'nothing dead there' };
    state.busy = { kind: 'clear', remaining: config.harvestSeconds, pot: a.pot };
    return { ok: true };
  },
};

function applyEffect(state, effect, config) {
  if (effect.pots) {
    for (let i = 0; i < effect.pots; i++) {
      if (state.pots.length < config.field.maxPots) state.pots.push(null);
    }
    return;
  }
  const keys = effect.path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], config);
  let v = target[last];
  if (effect.op === 'add') v += effect.value;
  else if (effect.op === 'mul') v *= effect.value;
  else v = effect.value;
  if (effect.floor !== undefined) v = Math.max(effect.floor, v);
  if (effect.ceil !== undefined) v = Math.min(effect.ceil, v);
  target[last] = v;
}

function finishAction(state, config) {
  const b = state.busy;
  state.busy = null;
  const t = state.today;

  if (b.kind === 'haul') {
    const before = state.water;
    state.water = Math.min(config.haul.reservoirMax, state.water + config.haul.cupSize);
    t.hauls++;
    t.hauledWater += state.water - before;
    // A cup poured into a full reservoir is the classic wasted trip.
    t.spilled += config.haul.cupSize - (state.water - before);
    return;
  }

  if (b.kind === 'pour') {
    const p = state.pots[b.pot];
    if (p && p.alive) { p.hydration += b.amount; t.pours++; t.pouredWater += b.amount; }
    else state.water = Math.min(config.haul.reservoirMax, state.water + b.amount); // plant died mid-pour
    return;
  }

  if (b.kind === 'harvest') {
    const p = state.pots[b.pot];
    if (!p) return;
    const decay = Math.max(config.plant.decayFloor, 1 - p.over * config.plant.decayPerDay);
    const priceMult = config.layers.weather ? state.weather[2] : 1;

    if (config.layers.combo) {
      state.combo = state.elapsed <= state.comboUntil
        ? Math.min(config.combo.max, state.combo + config.combo.step) : 1;
      state.comboUntil = state.elapsed + config.combo.windowSeconds;
    }

    const fruits = config.plant.fruit * decay;
    const cash = fruits * config.plant.price * priceMult * (config.layers.combo ? state.combo : 1);
    state.cash += cash;
    state.seeds += fruits * config.plant.seedYield;
    t.earned += cash;
    t.seedsGained += fruits * config.plant.seedYield;
    t.harvests++;
    state.pots[b.pot] = null;
    return;
  }

  if (b.kind === 'plant') {
    if (state.seeds >= 1) { state.seeds -= 1; state.pots[b.pot] = newPlant(); t.planted++; }
    return;
  }

  if (b.kind === 'expand') { state.pots.push(null); return; }
  if (b.kind === 'clear') state.pots[b.pot] = null;
}

// ---------------------------------------------------------------------- step

export function step(state, dt, config) {
  if (state.over) return null;

  state.elapsed += dt;
  state.tod += dt / config.time.daySeconds;

  if (state.busy) {
    // Charge the time to the right bucket. The daylight budget split is the
    // single most diagnostic number this game produces.
    const bucket = state.busy.kind === 'haul' ? 'haulSeconds'
      : state.busy.kind === 'pour' ? 'pourSeconds' : 'otherSeconds';
    state.today[bucket] += dt;
    state.busy.remaining -= dt;
    if (state.busy.remaining <= 0) finishAction(state, config);
  } else {
    state.today.idleSeconds += dt;
  }

  if (state.tod >= 1) {
    state.tod -= 1;
    state.busy = null; // dusk interrupts whatever you were mid-way through
    const closed = endDay(state, config);
    state.day++;
    return closed;
  }
  return null;
}

function endDay(state, config) {
  const need = waterNeed(state, config);
  const t = state.today;
  const P = config.plant;

  for (const p of state.pots) {
    if (!p || !p.alive) continue;
    const r = Math.max(0, Math.min(1, p.hydration / need));

    if (r <= P.thirstyAt) { t.dryPlants++; p.stress++; }
    else if (r >= P.healthyAt) p.stress = Math.max(0, p.stress - 1);

    const wasRipe = p.growth >= 1 - 1e-9;
    // Non-linear in r when growthCurve > 1: see the note in config.js. This one
    // exponent is the difference between "spread the water" being free and
    // being a real decision.
    p.growth = Math.min(1, p.growth + Math.pow(r, P.growthCurve) / P.growDays);
    if (wasRipe) p.over++;
    else if (p.growth >= 1 - 1e-9) t.wentRipe++;

    if (p.stress >= P.stressDeath) { p.alive = false; t.died++; }
    // Water does NOT carry over - that is what makes it a daily race. Drip is
    // the exception: it arrives at dawn, free, before you have done anything.
    p.hydration = P.drip;
  }

  if (config.layers.weather) {
    state.weather = config.weather[state.rng.int(config.weather.length)];
  }

  const alive = living(state).length;
  const day = state.day;
  const closed = {
    day,
    alive,
    ripe: ripe(state).length,
    pots: state.pots.length,
    cash: +state.cash.toFixed(1),
    seeds: +state.seeds.toFixed(2),
    ...t,
    hauledWater: +t.hauledWater.toFixed(2),
    pouredWater: +t.pouredWater.toFixed(2),
    spilled: +t.spilled.toFixed(2),
    earned: +t.earned.toFixed(1),
    seedsGained: +t.seedsGained.toFixed(2),
    owned: state.owned.length,
    drip: +config.plant.drip.toFixed(2),
    ceiling: +realCeiling(config).toFixed(2),
    /**
     * THE SIGNAL THE GAME EXISTS TO PRODUCE. Saturated = the day is completely
     * spent AND plants are still dying. No amount of trying harder helps from
     * here; the only lever left is automation. This is where the upgrade must
     * be sitting, unlocked and affordable.
     */
    saturated: t.idleSeconds < 0.5 && t.died > 0,
    haulPct: +((t.haulSeconds / config.time.daySeconds) * 100).toFixed(1),
    pourPct: +((t.pourSeconds / config.time.daySeconds) * 100).toFixed(1),
    idlePct: +((t.idleSeconds / config.time.daySeconds) * 100).toFixed(1),
  };
  state.log.push(closed);

  // The only real fail state: nothing growing and nothing to plant. There is no
  // bankruptcy here — cash never goes down — so overextension has to be what
  // ends a run, or nothing does.
  if (alive === 0 && state.seeds < 1) {
    state.over = true;
    state.overReason = 'no plants alive and no seeds left';
  }

  state.today = blankDay();
  return closed;
}
