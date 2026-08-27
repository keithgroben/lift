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
    /** Queue trend readings use a fixed simulation-time interval. */
    queueTrendSampleMinutes: 30,
  },

  building: {
    startFloors: 4,
    maxFloors: 60,
    /** Unit slots per floor, excluding the columns consumed by shafts. */
    slotsPerFloor: 8,
    /** Elevator shafts occupy a slot column across every floor they span. */
    lobbyFloor: 0,
    /** Default entrance slot used by the playable setup. */
    lobbySlot: 0,
  },

  access: {
    /** Horizontal corridor-walking time represented by one slot. */
    walkSecondsPerSlot: 1.2,
  },

  stairs: {
    /** Stairs are a slower local transport option, not a free elevator. */
    walkSecondsPerFloor: 4.5,
    /** Simultaneous people the stairwell can carry before a local queue forms. */
    capacity: 6,
    /** Bounded crowding penalty used to share demand before the stairwell fills. */
    loadPenaltySeconds: 12,
    /** A stairwell must be extended in a deliberate local span. */
    maxSpan: 8,
  },

  escalator: {
    /** Escalators move tenants faster than stairs but still consume a column. */
    travelSecondsPerFloor: 1.8,
    /** The moving lane carries more simultaneous people than stairs. */
    capacity: 12,
    /** Bounded crowding penalty used to share demand before the lane fills. */
    loadPenaltySeconds: 12,
    maxSpan: 12,
  },

  evaluation: {
    /** Room quality is still deliberately a small, readable set of signals. */
    stressWeight: 50,
    accessWeight: 30,
    rentWeight: 20,
    noiseWeight: 20,
    foodWeight: 12,
    parkingWeight: 10,
    medicalWeight: 14,
    securityWeight: 8,
    recyclingWeight: 6,
    /** A covered cafeteria is attractive in addition to satisfying food need. */
    amenityWeight: 6,
    /** Higher floors gain a modest view premium, capped so access still matters. */
    viewWeight: 2,
    viewBonusCap: 12,
    /** Tenant floor preferences add a bounded fit signal to room desirability. */
    preferenceWeight: 8,
    preferenceTolerance: 3,
    /** Mixed-use floors gain a small, non-stacking layout-quality bonus. */
    layoutRadiusSlots: 2,
    layoutBonus: 4,
    /** A one-time renovation improves the room itself, not its transport. */
    renovationBonus: 12,
    /** Access at or beyond this time receives the full access penalty. */
    accessToleranceSeconds: 8,
    /** Noise comes mainly through shared walls, and weakly through floors. */
    noiseRadiusSlots: 1,
    verticalNoiseWeight: 0.5,
    /** Noise at a unit's tolerance receives the full noise penalty. */
    noiseTolerance: 1,
    /** Minimum room score for a vacant unit to attract a replacement tenant. */
    relistMinScore: 55,
    /** Neutral starting point for the separate tower desirability index. */
    desirabilityBase: 60,
  },

  pricing: {
    /** Five readable rent bands: -2, -1, standard, +1, +2. */
    minLevel: -2,
    maxLevel: 2,
    stepMultiplier: 0.25,
  },

  costs: {
    floor: 400,
    office: 1200,
    condo: 2000,
    shop: 1500,
    hotel: 3200,
    shaft: 900,          // flat
    shaftPerFloor: 120,  // × floors spanned
    car: 1400,
    food: 1800,
    parking: 2200,
    medical: 2600,
    security: 2000,
    recycling: 1600,
    renovation: 900,
    conversion: 1000,
    demolition: 250,
    lobby: 500,
    stairs: 700,
    stairsPerFloor: 220,
    escalator: 1800,
    escalatorPerFloor: 300,
    lobbyExpansion: 350,
    rerent: 600,
  },

  units: {
    office: {
      workers: 6,
      preferredFloor: 3,
      targetShare: 0.55,
      foodNeed: 1,
      parkingNeed: 1,
      securityNeed: 0.5,
      recyclingNeed: 0.25,
      wastePerHead: 0.6,
      /** Offices are an active noise source, but are fairly tolerant of it. */
      noise: 1,
      noiseTolerance: 2.5,
      /** Paid at end of day, per occupied office. */
      rent: 300,
      /** Total access + wait seconds tolerated per trip before stress accrues. */
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
      preferredFloor: 6,
      targetShare: 0.25,
      foodNeed: 1.2,
      parkingNeed: 0.8,
      medicalNeed: 1,
      securityNeed: 0.8,
      recyclingNeed: 0.4,
      wastePerHead: 0.5,
      /** Condos are quieter and more sensitive to neighboring noise. */
      noise: 0.2,
      noiseTolerance: 0.8,
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
      preferredFloor: 1,
      targetShare: 0.1,
      foodNeed: 0.7,
      parkingNeed: 0.5,
      securityNeed: 0.6,
      recyclingNeed: 0.8,
      wastePerHead: 1.4,
      /** Shops create foot traffic and noise for nearby rooms. */
      noise: 1.2,
      noiseTolerance: 1.5,
      /** Shops earn per lunch customer actually delivered, not per day. */
      rent: 40,
      revenuePerCustomer: 22,
      patience: 8,
      stressPerSec: 0.7,
      stressDecay: 16,
      vacateAt: 45,
      relistDays: 2,
    },
    hotel: {
      /** Guest count is a booking capacity, not a permanent household. */
      guests: 6,
      minGuests: 2,
      /** Hotels below this room evaluation lose part of their booking load. */
      bookingEvaluationFloor: 55,
      /** Guest experience is explained by stress and required service coverage. */
      guestExperience: { stressWeight: 60, serviceWeight: 40 },
      /** A poor prior-day guest experience trims future bookings, but never below minGuests. */
      bookingFeedbackWeight: 0.25,
      /** Smooth feedback across a few recent guest-night records. */
      bookingFeedbackDays: 3,
      preferredFloor: 4,
      targetShare: 0.1,
      foodNeed: 0.8,
      parkingNeed: 0.4,
      securityNeed: 0.8,
      recyclingNeed: 0.8,
      wastePerHead: 0.8,
      /** Hotels create steady guest traffic but less noise than shops. */
      noise: 0.5,
      noiseTolerance: 1.2,
      /** Hotel rent is charged per occupied guest-night. */
      rent: 110,
      patience: 12,
      stressPerSec: 0.45,
      stressDecay: 18,
      vacateAt: 60,
      relistDays: 2,
    },
  },

  services: {
    /** The first facility covers its own floor and the floors immediately above/below. */
    food: { coverageFloors: 1, dailyUpkeep: 45 },
    /** Parking is a wider, lower-intensity floor service. */
    parking: { coverageFloors: 2, dailyUpkeep: 35 },
    /** Clinics are intentionally wider coverage so one supports a small tower. */
    medical: { coverageFloors: 3, dailyUpkeep: 60 },
    /** A security desk watches a wider vertical neighborhood. */
    security: { coverageFloors: 4, dailyUpkeep: 30 },
    /** Recycling is a local utility; waste does not travel far. */
    recycling: { coverageFloors: 2, dailyUpkeep: 25 },
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
    /** Office workers only patronize shops within this many floors. */
    shopCatchmentFloors: 3,
    /** Spread of arrivals inside a rush window. 1 = flat, higher = peakier. */
    rushPeakiness: 2.2,
    /** Workers arrive at the lobby to go up; residents start on their floor. */
    condoTripsPerDay: 1.4,
    /** One check-in and one check-out per booked hotel guest each day. */
    hotelTripsPerGuestPerDay: 2,
    /** A rider who waits this long gives up, stresses hard, and never arrives. */
    abandonAfter: 40,
  },

  stars: {
    /** Population gates. Each unlocks what you may build. */
    tiers: [
      { pop: 0,   name: '1 star', unlocks: ['office', 'shaft', 'car', 'stairs', 'escalator', 'food', 'parking', 'security', 'recycling'] },
      { pop: 60,  name: '2 star', reward: 4000, unlocks: ['condo', 'medical'] },
      { pop: 160, name: '3 star', reward: 8000, unlocks: ['shop', 'hotel'] },
      { pop: 320, name: '4 star', reward: 16000, unlocks: ['express'] },
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
    /** Average excess local-route riders cost this many reputation points per day. */
    localOverflowReputationWeight: 3,
    /** Keep local crowding from overwhelming the main delivery-rate signal. */
    localOverflowReputationCap: 8,
    /** Daily tenant demand is finite; the best available rooms win it first. */
    moveInCapacity: 2,
    /** Vacancies of underrepresented tenant types get a small selection bonus. */
    marketDemandWeight: 6,
    /** Access and required floor services add a small, bounded applicant preference. */
    experienceDemandWeight: 8,
    /** Stable route tests add a small, separate access-confidence demand signal. */
    transportAccessDemandWeight: 2,
    /** Tower appeal nudges vacancy ranking without overpowering access or mix. */
    desirabilityDemandWeight: 4,
    /** Rooms below this appeal score slowly accumulate a separate retention pressure. */
    desirabilityRetentionThreshold: 45,
    /** Maximum appeal-pressure units added per day by a severely unattractive room. */
    desirabilityRetentionPressureWeight: 1,
    /** Appeal pressure needed for a desirability-driven departure. */
    desirabilityRetentionVacateAt: 4,
    /** Good appeal removes this many pressure units per day. */
    desirabilityRetentionRecovery: 0.5,
    /** Healthy reputation preserves full tenant-mix demand; poor reputation trims it gently. */
    reputationDemandWeight: 0.5,
    /** Keep this secondary demand effect from collapsing while the main rep gate handles failure. */
    reputationDemandFloor: 0.75,
    /** Healthy transport can shorten each vacancy's market delay by at most one day. */
    reputationRelistSpeedWeight: 1,
    /** Number of day-close tenant-mix snapshots shown in diagnostics. */
    tenantMixHistoryDays: 3,
    /** Number of closed-day leasing outcomes shown in diagnostics. */
    tenantDemandHistoryDays: 3,
    /** Number of closed-day shop traffic outcomes shown per shop. */
    shopTrafficHistoryDays: 3,
    /** Number of shop-demand office responses retained for comparison. */
    shopDemandFollowupHistoryDays: 3,
    /** Placement asks for confirmation when the projected mix loses this many balance points. */
    tenantMixPlacementWarningDelta: 8,
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
