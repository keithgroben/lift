/**
 * Bloom Rush — all tuning. Data only.
 *
 * Numbers carried over verbatim from watering-plants v0.3 (`plant_play.html`,
 * the `CFG` object) so the port starts from the tuning that already exists
 * rather than from a guess. Where a number is NEW, the comment says so.
 *
 * The locked design constraint from that repo's README governs this file:
 * "Add one curve at a time. New mechanics enter as new knobs, tuned in
 *  isolation before they interact with others."
 */
export const CONFIG = {
  meta: { name: 'bloom', portedFrom: 'watering-plants v0.3-bloom-rush' },

  time: {
    daySeconds: 34,   // CFG.DAY
    dt: 1 / 30,
  },

  /**
   * THE BOTTLENECK. One cup, one trip down the hill to the river, a finite day.
   * Every upgrade in the original attacks exactly these three numbers.
   */
  haul: {
    tripSeconds: 4.5, // CFG.TRIP — down the hill and back
    cupSize: 0.6,     // CFG.CUP  — water delivered per trip
    reservoirMax: 4,  // CFG.MAXW — you cannot pre-stock a whole day
  },

  pour: {
    amount: 0.5,      // CFG.POUR  — half a plant's daily need per action
    seconds: 0.75,    // CFG.POURT
  },

  /**
   * NEW. v0.3 made harvesting and planting free instant clicks, which means the
   * README's second wall — "real ceiling, after harvest + planting" — did not
   * actually exist in the code. A wall you cannot spend time on is not a wall.
   */
  harvestSeconds: 0.6,
  plantSeconds: 0.8,

  plant: {
    waterNeed: 1,      // CFG.NEED per plant per day
    growDays: 3,       // CFG.GROW — fully watered days to ripen
    fruit: 3,          // CFG.FRUIT
    price: 5,          // CFG.PRICE
    seedYield: 0.65,   // CFG.SEED — fruits x this = seeds returned
    stressDeath: 2,    // CFG.STRESS — dry days before it dies
    decayPerDay: 0.25, // CFG.DECAY — value lost per day left unharvested
    decayFloor: 0.15,  // CFG.MIN
    /**
     * THE KNOB THAT DECIDES WHETHER THIS IS A GAME.
     *
     * v0.3 grew a plant by r/growDays where r = hydration/need, which is LINEAR.
     * Linear means total growth = total water / (need x growDays) no matter how
     * you spread it - watering 8 plants half-way yields exactly what watering 4
     * fully yields. So "how many plants" costs nothing and the bottleneck has no
     * teeth. Measured: hold3 $14.3/day vs hold8 $12.6/day, and that 12% gap is
     * planting overhead, not thirst.
     *
     * Above 1, partial watering is disproportionately bad, concentration beats
     * spreading, and the player has to CHOOSE which plants to abandon. That
     * choice is the game. 1 = faithful v0.3. Sweep it with harness/tune.js.
     *
     * Set to 2, not 1. `node harness/tune.js bloom plant.growthCurve 1 1.5 2 3 4 6`
     * measures the spread between best and worst play at each value:
     *   1   -> 34%   overextending costs 12%. No real decision.
     *   2   -> 62%   hard but fair. Greedy earns 38% of optimal.
     *   3   -> 91%   punishing. Greedy earns 9% of optimal.
     *   6   -> 96%   hold6+ is simply dead.
     * hold3 earns $14.3/day at EVERY value, so raising this does not move the
     * right answer - it only sharpens the cost of the wrong one. 2 matches the
     * repo's locked constraint: honest grind, hard but fair. Revert to 1 for
     * exact v0.3 behaviour.
     */
    growthCurve: 2,

    /**
     * Fraction of need below which a day counts as dry (stress +1). v0.3 used
     * 0.001 - literally zero - so a single drop bought full immunity from death.
     * Death was unreachable by anyone paying attention.
     */
    thirstyAt: 0.001,
    healthyAt: 0.95,   // at or above this, a stress point is bled off

    /**
     * AUTOMATION. Water every plant receives free at dawn, costing no hands.
     * CFG.DRIP in v0.3, raised by Drip Lines and Mist Nozzles.
     *
     * This is the only term in the ceiling formula that does not trade against
     * daylight, which is exactly why the game's premise works: once you are at
     * 0% idle and still losing plants, buying MORE haul speed cannot save you.
     * Only drip can. That is the moment the upgrade has to be there.
     */
    drip: 0,
  },

  field: {
    startPots: 4,      // v0.3 opens with 4
    maxPots: 8,        // CFG.MAXPOTS
    startSeeds: 2,
    /**
     * NEW. v0.3 handed out pots through the upgrade ladder, which this port
     * defers. Without SOME way to add a pot, maxPots was unreachable and every
     * hold-N policy above 4 was silently identical to hold4 - the sweep read
     * as a flat curve that meant nothing.
     */
    potCost: 25,
    potSeconds: 1.2,
  },

  /**
   * v0.3 shipped SEVEN of these at once — daily orders, weather, missed-order
   * stakes, harvest combos, reputation ranks, achievements, a longer upgrade
   * ladder — which is precisely what the repo's own locked constraint forbids.
   *
   * They default OFF so the pure bottleneck can be measured on its own first.
   * Turn them on one at a time and re-sweep: if a layer does not move the curve,
   * it is decoration compensating for a loop that is not yet fun.
   */
  layers: {
    weather: false,
    combo: false,
    orders: false,
    reputation: false,
  },

  /** Only read when layers.weather is true. [id, waterMult, priceMult]. */
  weather: [
    ['clear', 1.00, 1.00],
    ['heat',  1.35, 1.20],
    ['cool',  0.80, 0.95],
    ['storm', 0.55, 0.85],
  ],

  /** Only read when layers.combo is true. */
  combo: { windowSeconds: 7, step: 0.25, max: 3 },

  /**
   * The ladder, from v0.3's UPS array. Effects are declarative so this file
   * stays data-only and a background agent can retune costs without touching
   * a line of logic. `op: 'add'` with a negative value subtracts; `floor`/`ceil`
   * clamp the result.
   */
  upgrades: [
    { id: 'tank',   name: 'Deep Tank',    cost: 32,  blurb: 'Reservoir max +2',
      effect: { path: 'haul.reservoirMax', op: 'add', value: 2 } },
    { id: 'can',    name: 'Wide Can',     cost: 42,  blurb: 'Haul +0.3 water',
      effect: { path: 'haul.cupSize', op: 'add', value: 0.3 } },
    { id: 'boots',  name: 'Hill Boots',   cost: 60,  blurb: 'Trips 1s faster',
      effect: { path: 'haul.tripSeconds', op: 'add', value: -1, floor: 2.5 } },
    { id: 'tray',   name: 'South Tray',   cost: 75,  blurb: 'Add 2 pots',
      effect: { pots: 2 } },
    /**
     * v0.3 gave this +0.2 against a waterNeed of 1.0 - a fifth of a plant. At
     * that size `node harness/ladder.js` measures a 220-DAY payback, versus 10
     * days for Wide Can. The upgrade the entire premise rests on was, by a
     * factor of 20, the worst purchase on the board: a player following the
     * incentives buys more hauling speed and never automates anything.
     *
     * At +0.5 the hands cover only half a plant's need, which also halves the
     * pours (ceil(0.5/0.5) = 1 instead of 2). Ceiling 3.59 -> 6.85, income
     * +45%, payback ~19 days. Transformative, which is what a late unlock that
     * changes your strategy is supposed to be.
     */
    { id: 'drip',   name: 'Drip Lines',   cost: 110, blurb: '+0.5 free water at dawn',
      effect: { path: 'plant.drip', op: 'add', value: 0.5 } },
    { id: 'sign',   name: 'Market Sign',  cost: 145, blurb: 'Prices +20%',
      effect: { path: 'plant.price', op: 'mul', value: 1.2 } },
    { id: 'press',  name: 'Seed Press',   cost: 170, blurb: 'More seeds per harvest',
      effect: { path: 'plant.seedYield', op: 'add', value: 0.2 } },
    { id: 'tray2',  name: 'North Tray',   cost: 190, blurb: 'Add final 2 pots',
      effect: { pots: 2 } },
    { id: 'mist',   name: 'Mist Nozzles', cost: 240, blurb: '+0.25 more dawn water',
      effect: { path: 'plant.drip', op: 'add', value: 0.25 } },
  ],

  feel: {
    palette: ['#12160f', '#1e2718', '#7bc043', '#ffd166', '#ef476f', '#4fb3d9'],
    tweenMs: 160,
    floaterMs: 900,
    shakeOnDeath: 7,
  },
};

export default CONFIG;
