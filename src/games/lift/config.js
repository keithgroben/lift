/**
 * ALL tuning lives here. Data only — never import anything, never branch on state.
 * A background agent may edit this file freely. Everything else needs a reason.
 *
 * Time constants are stated twice on purpose: the value SimTower used, and the
 * value we run at. Compressing the clock is the whole point of a prototype.
 * @see spec/simtower.md
 */
export const CONFIG = {
  meta: {
    name: 'Lift',
    /** SimTower ran ~1 in-game day per 3-4 real minutes. We run one per 45s. */
    originDaySeconds: 210,
  },

  time: {
    /** Seconds of real time per in-game day. The single most important knob. */
    daySeconds: 45,
    /** Sim substep. Fixed — determinism depends on it. Do not vary at runtime. */
    dt: 1 / 30,
    /** Fractions of a day. Rushes are where the bottleneck becomes visible. */
    morningRush: [0.08, 0.26],
    lunch: [0.45, 0.60],
    eveningRush: [0.70, 0.90],
  },

  building: {
    startFloors: 4,
    maxFloors: 60,
    /** Unit slots per floor, excluding the columns consumed by shafts. */
    slotsPerFloor: 8,
    /** Elevator shafts occupy a slot column across every floor they span. */
    lobbyFloor: 0,
  },

  costs: {
    floor: 400,
    office: 1200,
    condo: 2000,
    shop: 1500,
    shaft: 900,          // flat
    shaftPerFloor: 120,  // × floors spanned
    car: 1400,
  },

  units: {
    office: {
      workers: 6,
      /** Paid at end of day, per occupied office. */
      rent: 300,
      /** Wait-seconds tolerated per trip before stress accrues. */
      patience: 6,
      /** Stress added per second of wait beyond patience, per worker. */
      stressPerSec: 0.9,
      /** Stress bled off at end of each day. */
      stressDecay: 14,
      /** Above this, tenants leave. THIS is the wall. */
      vacateAt: 40,
      /** Days a vacant office sits before a new tenant moves in. */
      relistDays: 2,
    },
    condo: {
      residents: 3,
      rent: 90,
      /** Condos pay a lump sum on sale, then trickle. */
      salePrice: 2600,
      patience: 10,
      stressPerSec: 0.6,
      stressDecay: 12,
      vacateAt: 55,
      relistDays: 3,
    },
    shop: {
      staff: 2,
      /** Shops earn per lunch customer actually delivered, not per day. */
      rent: 40,
      revenuePerCustomer: 22,
      patience: 8,
      stressPerSec: 0.7,
      stressDecay: 16,
      vacateAt: 45,
      relistDays: 2,
    },
  },

  elevator: {
    /** Floors per second at full speed. */
    speed: 2.4,
    /** Seconds the doors hold open at a stop, plus per person moving through. */
    doorTime: 0.6,
    boardTime: 0.12,
    capacity: 12,
    /** A local shaft cannot span more than this many floors. Forces restructure. */
    maxSpan: 24,
    /** Cars in one shaft stagger their idle parking across the span. */
    maxCarsPerShaft: 3,
  },

  demand: {
    /** Share of an office's workers that make the lunch trip. */
    lunchTripRate: 0.55,
    /** Spread of arrivals inside a rush window. 1 = flat, higher = peakier. */
    rushPeakiness: 2.2,
    /** Workers arrive at the lobby to go up; residents start on their floor. */
    condoTripsPerDay: 1.4,
    /** A rider who waits this long gives up, stresses hard, and never arrives. */
    abandonAfter: 40,
  },

  stars: {
    /** Population gates. Each unlocks what you may build. */
    tiers: [
      { pop: 0,   name: '1 star', unlocks: ['office', 'shaft', 'car'] },
      { pop: 60,  name: '2 star', unlocks: ['condo'] },
      { pop: 160, name: '3 star', unlocks: ['shop'] },
      { pop: 320, name: '4 star', unlocks: ['express'] },
    ],
  },

  /**
   * Why this block exists: without it, a tower that delivered 2.5% of its trips
   * still netted +$6,260/day. Rent tracked office COUNT, never service, so the
   * elevator — the entire point of the game — was ignorable. These knobs are the
   * wall. Tune them; do not delete them.
   */
  occupancy: {
    /** Building-wide delivery rate (%) below which nobody new will move in. */
    relistMinDeliveryRate: 55,
    /** Days of that rate averaged into the reputation a mover-in checks. */
    reputationWindow: 3,
    /** Empty space still costs you. This is what turns a slump into a spiral. */
    vacantUpkeep: 70,
  },

  economy: {
    startMoney: 12000,
    /** Daily fixed operating cost, scales with floors. Keeps idling from paying. */
    upkeepPerFloor: 35,
  },

  /** Read by the renderer only. Never read by src/sim. */
  feel: {
    palette: ['#0e1116', '#1b2430', '#3ddc97', '#ffb703', '#ef476f', '#8ecae6'],
    tweenMs: 180,
    shakeOnVacate: 6,
    floaterMs: 900,
  },
};

export default CONFIG;
