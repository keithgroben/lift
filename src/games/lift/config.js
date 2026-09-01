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
    /**
     * Zero: a new session opens on bare ground — street, sky, no floors — and
     * the lobby is the first purchase (spec/tower-view.md §4). Every test that
     * needs a standing tower sets its own value.
     */
    startFloors: 0,
    maxFloors: 60,
    /**
     * Unit slots per floor, excluding the columns consumed by shafts.
     * 10, up from 8 (2026-08-28): the column-war sweeps showed every zoned-
     * tower failure mode tracing back to grid scarcity — a real transport
     * core (2 local columns + 1 express per sky lobby + capacity twins) eats
     * 35-45% of an 8-slot grid, and the 10-slot A/B posted the best
     * sustained delivery ever recorded (73-74%, CV 0.25). At 10 slots the
     * core costs ~the 15-25% overhead the maxed-out win's 75%-coverage bar
     * always assumed, so the summit becomes geometrically honest. Keith
     * had already approved widening alongside decorations.
     */
    slotsPerFloor: 10,
    /** Elevator shafts occupy a slot column across every floor they span. */
    lobbyFloor: 0,
    /** Default entrance slot used by the playable setup. */
    lobbySlot: 0,
  },

  /**
   * Underground floors, B1..B10 (sim index -1..-10). Keith's call,
   * 2026-08-31: ten, exactly as SimTower allowed against its hundred.
   * See spec/tower-view.md §3. Every number here came off a tune sweep, not
   * a guess — the curves are in the issue #6 report.
   */
  underground: {
    /**
     * B1..B10. Keith's call, not the sweep's — but the sweep is worth
     * recording: held population saturates at THREE. 0/1/2/3/5/10 ->
     * 95.6 / 109.5 / 128.8 / 137.8 / 137.2 / 137.2. At 0 the digging policy
     * scores exactly its non-digging twin, which is the inertness proof;
     * past B3 the current autoplayer finds nothing to put down there, so
     * B4..B10 are headroom for a human, not a live decision for a bot.
     */
    maxDepth: 10,
    /**
     * Cost to sink one basement storey. Below 40k the curve is flat within
     * noise (10k/20k/30k/40k -> 142.4 / 143.6 / 137.2 / 149.2) and at 60k it
     * falls off a cliff to 108.7, below the best non-digging policy. 30k
     * sits on the flat part AND stays under `costs.floor` (40k), so digging
     * is cheaper than raising — which is the rule, not the score.
     */
    digCost: 30000,
    /**
     * Rooms and facilities below ground cost this fraction of their
     * above-ground price. Weak knob, and worth saying so: 0.7/0.9/1.0 ->
     * 137.2 / 133.7 / 133.3, a ~3% spread that is barely above noise. It
     * only bites at the extremes (0.5 -> 152.5, 1.2 -> 96.6). 0.7 makes the
     * discount visible without being the reason digging pays.
     */
    buildCostMultiplier: 0.7,
    /**
     * Appeal points a room loses per floor below ground, capped. 6 is where
     * the curve STEPS: 0/3/6/9/12/18/30 -> 151.7 / 155.2 / 137.2 / 135.5 /
     * 137.6 / 130.1 / 129.6. At 3 a basement office still clears
     * `evaluation.relistMinScore` and the basement is just cheap lettable
     * space; at 6 it does not, and the basement becomes what the spec says
     * it is — plant, not offices. That step costs the digging policy 12%,
     * i.e. it makes the game harder, which is the direction that counts.
     */
    appealPenaltyPerFloor: 6,
    /** Deep enough is simply unlettable; the penalty stops growing here. */
    appealPenaltyCap: 24,
    /**
     * Extra coverage floors a facility gains by being underground, and the
     * reason the tradeoff exists at all: a basement garage or plant room
     * connects to the building at the lobby, not at its own storey, so it
     * serves the tower rather than the three floors around it. Without
     * this, digging frees an above-ground slot and loses exactly the
     * coverage that slot was buying — a pure loss, and no decision.
     *
     * 2 is deliberately the KNEE, not the maximum. Against the identical
     * non-digging twin ("skyscraper", 95.6), 0/1/2/3/4/6/8 ->
     * 41.6 / 106.6 / 137.2 / 152.5 / 160.3 / 166.3 / 166.3 — at 0 digging is
     * a trap, and from 6 the curve is flat. There is no interior maximum, so
     * chasing the widest spread would only make digging mandatory. 2 is the
     * lowest value where digging clearly repays its capital, and four floors
     * of reach up from the ground line is the furthest a basement garage can
     * plausibly claim.
     *
     * ⚠ THAT CURVE IS STALE — kept only to explain how the value moved. It
     * was measured when every policy was handed four free storeys. Policies
     * now buy their own, and `+ floor` is gone entirely (a room raises its own
     * storey), which moved every baseline.
     *
     * RE-SWEPT on the current baseline, 60d x 5 seeds, held population.
     * Non-digging twin ("skyscraper") 92.1, best above-ground play
     * ("managed") 128.1:
     *
     *   0 -> 101.9 · 1 -> 109.6 · 2 -> 117.3 · 3 -> 111.3
     *   4 -> 133.0 · 6 -> 147.1 · 8 -> 144.4
     *
     * Two things changed. Digging beats its twin at EVERY value now, so it is
     * never the trap it was at 0. And there is a real interior maximum at 6
     * where the old curve merely flattened.
     *
     * 4 is Keith's call, 2026-09-01, and the line it is chosen against is
     * 128.1 rather than 92.1. Below 4, digging loses to simply playing well
     * above ground — so a strong player would rationally never dig, and the
     * whole underground is a sideshow. At 4 it wins by 5 points: enough that
     * digging can be the better move, not so much that it is the obvious one.
     * 6 peaks higher but puts digging 19 clear of the best surface play,
     * which is how an option turns into an obligation.
     *
     * Also worth knowing: at 40 days (tune.js's default) this knob reads
     * INERT — 0/1/2/4 -> 47.3 / 46.8 / 46.6 / 48.1. Depth needs time to
     * matter, so a short sweep sees a flat curve and concludes there is no
     * game in this dimension. Use TUNE_DAYS=60 or longer for anything
     * underground.
     */
    serviceCoverageBonus: 4,
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
    /**
     * The bar a room that has ALREADY driven a tenant out must clear before
     * anyone else takes it — automatically, or through the player's own
     * `rerent_unit`. Against `occupancy.firstLetMinScore` (20), which is all a
     * brand-new room has to prove.
     *
     * It was 55, and that stranded every small tower permanently. Measured
     * distribution of room scores: in a mature tower (23-38 floors) occupied
     * rooms sit at a median of 58 and vacant ones at 48-51, so 55 filtered
     * sensibly there. But a four-floor tower with one shaft tops out around
     * 47 — no room could ever clear it, automatic re-letting was impossible,
     * AND the player's own recovery action was refused for the same reason.
     * Every early tower decayed to zero and stayed there. Keith found it while
     * trying to build a tower worth photographing.
     *
     * 35 sits below what a healthy small-tower room reaches and above what a
     * degraded one does, so a failed room still has to be fixed rather than
     * simply waited out. Swept 60d x 5 seeds: 20/30/40 all score ~142-144 for
     * the best policy against 125.7 at 55, and the spread between best and
     * worst play holds at 92% — the curve is flat across the whole usable
     * range, so this is a floor-raising fix rather than a difficulty knob.
     */
    relistMinScore: 35,
    /** Neutral starting point for the separate tower desirability index. */
    desirabilityBase: 60,
  },

  pricing: {
    /** Five readable rent bands: -2, -1, standard, +1, +2. */
    minLevel: -2,
    maxLevel: 2,
    stepMultiplier: 0.25,
  },

  // Dollar figures throughout this config are scaled ×100 from the original
  // prototype's toy-scale numbers, uniformly, so every ratio this session's
  // balance work depended on (vacancy gate math, health-gate thresholds,
  // affordability checks) stays exactly equivalent — only the digit count
  // changed, aiming for a real-skyscraper-tycoon FEEL rather than any
  // specific historical figures.
  costs: {
    floor: 40000,
    office: 120000,
    condo: 200000,
    shop: 150000,
    hotel: 320000,
    shaft: 90000,          // flat
    shaftPerFloor: 12000,  // × floors spanned
    /** Express is premium infrastructure: pricier to sink, cheaper per floor
     *  passed (no doors, no landings on skipped floors). */
    expressShaft: 200000,
    expressShaftPerFloor: 10000,
    car: 140000,
    expressCar: 220000,
    food: 180000,
    parking: 220000,
    medical: 260000,
    security: 200000,
    recycling: 160000,
    renovation: 90000,
    conversion: 100000,
    demolition: 25000,
    shaftDemolition: 50000,
    lobby: 50000,
    stairs: 70000,
    stairsPerFloor: 22000,
    escalator: 180000,
    escalatorPerFloor: 30000,
    lobbyExpansion: 35000,
    rerent: 60000,
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
      rent: 30000,
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
      rent: 9000,
      /** Condos pay a lump sum on sale, then trickle. */
      salePrice: 260000,
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
      rent: 4000,
      revenuePerCustomer: 2200,
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
      rent: 11000,
      patience: 12,
      stressPerSec: 0.45,
      stressDecay: 18,
      vacateAt: 60,
      relistDays: 2,
    },
  },

  services: {
    /** The first facility covers its own floor and the floors immediately above/below. */
    food: { coverageFloors: 1, dailyUpkeep: 4500 },
    /** Parking is a wider, lower-intensity floor service. */
    parking: { coverageFloors: 2, dailyUpkeep: 3500 },
    /** Clinics are intentionally wider coverage so one supports a small tower. */
    medical: { coverageFloors: 3, dailyUpkeep: 6000 },
    /** A security desk watches a wider vertical neighborhood. */
    security: { coverageFloors: 4, dailyUpkeep: 3000 },
    /** Recycling is a local utility; waste does not travel far. */
    recycling: { coverageFloors: 2, dailyUpkeep: 2500 },
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
    maxCarsPerShaft: 7,
    /** Zone band height used by zoned building strategies (sky lobby every N
     *  floors). 20 rather than 12: each extra zone costs a full-height express
     *  COLUMN, and at 8 slots per floor the grid can only afford two sky
     *  lobbies (F20, F40) before transport eats the building. Locals span
     *  zoneHeight+1 <= maxSpan. */
    zoneHeight: 20,
    /**
     * Express shuttles: nonstop between their own bottom and top, skipping
     * everything between (routing and the cars both already enforce this).
     * The throughput probe (spec/lift-vision.md) showed raising real carrying
     * capacity is what flattens the boom-bust wave — express is that
     * throughput, delivered as a structure the player must plan, not as
     * magically bigger local cars.
     */
    express: {
      speed: 4.8,
      capacity: 20,
      maxCarsPerShaft: 8,
      /** Can run the full tower height — that is its entire reason to exist. */
      maxSpan: 60,
    },
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
    /**
     * Population gates. Each unlocks what you may build, and is meant to
     * read the way SimTower's own rating does: 1-3 star is the core mixed-
     * use loop, 4-5 star is a real, hard-won skyscraper. A disciplined
     * autoplayer that manages cars, services, and paces growth to the
     * tower's own health (see policies.js "skyscraper") tops out around
     * 150-230 population over hundreds of days — 4-5 star are calibrated
     * above that bot's ceiling on purpose, so they stay a genuine stretch
     * for a human playing with more judgment than a fixed heuristic has.
     */
    tiers: [
      { pop: 0,   name: '1 star', unlocks: ['office', 'shaft', 'car', 'stairs', 'escalator', 'food', 'parking', 'security', 'recycling'] },
      { pop: 60,  name: '2 star', reward: 400000, unlocks: ['condo', 'medical'] },
      { pop: 160, name: '3 star', reward: 800000, unlocks: ['shop', 'hotel'] },
      { pop: 320, name: '4 star', reward: 1600000, unlocks: [] },
      { pop: 500, name: '5 star', reward: 3200000, unlocks: [] },
    ],
  },

  /**
   * Why this block exists: without it, a tower that delivered 2.5% of its trips
   * still netted +$6,260/day. Rent tracked office COUNT, never service, so the
   * elevator — the entire point of the game — was ignorable. These knobs are the
   * wall. Tune them; do not delete them.
   */
  occupancy: {
    /**
     * The bar a room has to clear the FIRST time it is let, as against
     * `evaluation.relistMinScore` (55) which a room faces after it has driven
     * a tenant out.
     *
     * 20 is deliberately low, because the only thing a new room must prove is
     * that somebody can reach it. Measured on a first-floor office: with no
     * transport at all it scores 0 and is refused, with stairs 39, with a
     * shaft and a car 47. So this bar admits any room the tower can actually
     * serve and refuses every room it cannot — which is the loop, stated as a
     * number.
     */
    firstLetMinScore: 20,
    /** Building-wide delivery rate (%) below which nobody new will move in. */
    relistMinDeliveryRate: 55,
    /**
     * Boom-bust dampers (spec/lift-vision.md, "the boom-bust churn cycle").
     * All four default to OFF — exactly the historical binary-gate behavior —
     * so existing seeds replay identically. The lab A/Bs them by override.
     */
    /** Reputation at which applicant flow reaches 100%. Above relistMin, flow
     *  ramps linearly from 0 at the gate to full here; equal = binary gate. */
    moveInFullFlowRate: 55,
    /** Hard cap on rooms leased per day. 0 = uncapped. Caps the flood that
     *  otherwise grows with occupancy and refills an empty tower in days. */
    moveInCapacityMax: 0,
    /** Per-tenant spread (±fraction) on the stress vacate threshold, drawn
     *  from the seeded rng at move-in. Desynchronizes the mass exodus into a
     *  visible leak. 0 = everyone marches off the same cliff together. */
    vacateJitterRange: 0,
    /** Extra settling-in days (0..N, per tenant, seeded) on top of the
     *  transport grace window, staggering when cohorts become vulnerable. */
    graceJitterDays: 0,
    /** Days of that rate averaged into the reputation a mover-in checks. */
    reputationWindow: 3,
    /** Average excess local-route riders cost this many reputation points per day. */
    localOverflowReputationWeight: 3,
    /** Keep local crowding from overwhelming the main delivery-rate signal. */
    localOverflowReputationCap: 8,
    /**
     * Daily tenant demand is finite; the best available rooms win it first.
     * This is a floor, not a ceiling: an established, occupied tower draws
     * more daily interest than a brand-new one, so actual capacity also
     * grows with occupiedHeads * moveInCapacityGrowthRate (see
     * leasingForecast). Without that growth term, every tower — no matter
     * how healthy — is stuck leasing at the same trickle a 3-office opening
     * gets, which caps every tower at the same small size regardless of how
     * well it is run.
     */
    moveInCapacity: 2,
    /** Additional daily move-in capacity per current occupied head. */
    moveInCapacityGrowthRate: 0.2,
    /**
     * Refuse new rentable construction once vacant units reach this many
     * days' worth of the tower's CURRENT move-in capacity. At $50/day vacant
     * upkeep against rents that assume a filled room, building faster than
     * demand can absorb is a bankruptcy trap, not a growth strategy — this
     * keeps construction paced to actual leasing speed, whatever that speed
     * currently is, instead of a number fixed at game start.
     */
    vacancyBufferDays: 2,
    /**
     * A tenant who just moved in cannot be pushed out by transport stress for
     * this many days. Without it, a newly built room that instantly fills to
     * capacity gets judged on rush-hour queues the player has not yet had a
     * chance to react to, and the tower loses its first tenants before the
     * player has even seen a recommendation to add capacity.
     */
    newTenantTransportGraceDays: 3,
    /** Vacancies of underrepresented tenant types get a small selection bonus. */
    marketDemandWeight: 6,
    /** Access and required floor services add a small, bounded applicant preference. */
    experienceDemandWeight: 8,
    /** Stable route tests add a small, separate access-confidence demand signal. */
    transportAccessDemandWeight: 2,
    /** Tower appeal nudges vacancy ranking without overpowering access or mix. */
    desirabilityDemandWeight: 4,
    /** Rooms below this appeal score slowly accumulate a separate retention pressure. */
    /**
     * How tall the tower must be before tenants expect the FULL
     * `desirabilityRetentionThreshold`. Below it the expectation scales with
     * the building: a three-storey block with a working lift is a good
     * address, and the same rooms fifty floors up are not.
     *
     * SIX floors, and the number is load-bearing. Keith's first tower had
     * delivery at 100% and reputation at 100 and lost every tenant anyway:
     * the threshold was calibrated for a mature tower and a beginner had no
     * lever to pull. But relief that reaches too far up the building takes
     * the game with it — swept 60d x 5 seeds, `naive` (never adds a car)
     * scores 12.0 at a ramp of 1/4/6 and 53.8 at 8, 70.2 at 12, with the
     * spread between best and worst play collapsing 92% -> 78% -> 51%.
     *
     * At 6 the beginner's three-storey block faces 22.5 instead of 45 and
     * holds its tenants, while every policy's score is untouched and playing
     * badly still ends at 12. Mercy for the first few floors, and not one
     * floor further.
     */
    desirabilityRetentionRampFloors: 6,
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
    /** Empty space still costs you, but leaves time to recover before bankruptcy. */
    vacantUpkeep: 5000,
  },

  economy: {
    startMoney: 1200000,
    /** Daily fixed operating cost, scales with floors. Keeps idling from paying. */
    upkeepPerFloor: 3500,
  },

  /** Read by the renderer only. Never read by src/sim. */
  feel: {
    palette: ['#0e1116', '#1b2430', '#3ddc97', '#ffb703', '#ef476f', '#8ecae6'],
    maxDpr: 1.25,
    maxCanvasPixels: 2000000,
    tweenMs: 180,
    shakeOnVacate: 6,
    floaterMs: 900,

    /**
     * Sprite sheets (`render/sprites.js`). The sidecar JSON shipped with each
     * PNG names a *speed* from this table; it never carries an fps number, so
     * retiming the whole game is an edit here and nowhere else.
     */
    /**
     * The sky (`render/sky.js`). Decoration: a tower plays identically with
     * every number here set to zero.
     */
    sky: {
      /** Drifting cloud layer. More than a dozen reads as weather, not sky. */
      cloudCount: 9,
      /**
       * How many things may be in the air at once. The cap matters more than
       * the rates: without it a quiet stretch banks up and then empties all
       * at once, and a sky with six aircraft in it looks like an airshow
       * rather than a Tuesday.
       */
      maxFlyers: 4,
    },

    sprites: {
      /** Frames per second, by name. `default` is the fallback for anything
       *  a sidecar leaves unnamed or names wrongly. */
      fps: {
        default: 6,
        /** Barely-there room life — a monitor flicker, a shifting silhouette.
         *  Slow on purpose: a floor of offices ticking at 6fps reads as noise. */
        idle: 2,
        /** Blinking indicators (utility rooms, stressed accents). */
        blink: 1.5,
        /** Walk cycles. 8fps over a 4-frame cycle = one stride per half second. */
        walk: 8,
        /** Elevator doors — a one-shot, fast enough to feel mechanical. */
        doors: 12,
        /** Scaffold-and-dust while a build lands. */
        construction: 6,
        /** Escalator step loop. Matches walk so the two read as one speed. */
        escalator: 8,
      },
      /** Integer zoom only; the tower view goes 1x/2x/3x. */
      maxScale: 3,
      /**
       * Ceiling on crowd figures in one frame. The whole render is around
       * 0.5ms against a 33ms budget, and the queue crowd is the only thing
       * that scales with how badly the tower is doing — a floor of 26 figures
       * on every visible storey at once. Past this the queue rows fall back to
       * the dots, so a collapsing tower costs the same frame as a healthy one.
       * 260 is ten full rows, which is more queue than any readable tower has.
       */
      maxCrowdFigures: 260,
      /** Largest render dt a single advance may add. A backgrounded tab hands
       *  back seconds at once, which would teleport a one-shot to its end. */
      maxFrameStepMs: 120,
    },
  },
};

export default CONFIG;
