import { basementDepth, blankDayStats, population, starTier, pushEvent, assignTenantJitter, totalFloors } from './state.js';
import { hotelBookingFeedback, hotelExperienceSummary, leasingForecast, shopTrafficEstimate, tenantMixSnapshot, tenantRetentionPressure, towerDesirabilitySummary, unitEvaluation, vacancyRankingSignalSummary } from './evaluation.js';

/** Rent, upkeep, stress bleed-off, move-outs and move-ins. Runs once per day. */
export function dayClose(state, config) {
  const s = state.today;

  for (const u of state.units) {
    if (!u.occupied) continue;
    const tune = config.units[u.kind];
    const rentRate = u.rent ?? tune.rent;
    const rent = u.kind === 'hotel' ? rentRate * u.heads : rentRate;
    state.money += rent;
    s.rent += rent;
  }

  const vacantBefore = state.units.filter((u) => !u.occupied).length;
  s.serviceUpkeep = (state.facilities ?? []).reduce((total, facility) =>
    total + (config.services?.[facility.kind]?.dailyUpkeep ?? 0), 0);
  // Every storey costs the same to run, dug or raised: the basement discount
  // is on the build, not on the operating bill. Digging is a capital decision
  // you keep paying for.
  s.upkeep = totalFloors(state) * config.economy.upkeepPerFloor
           + vacantBefore * config.occupancy.vacantUpkeep
           + s.serviceUpkeep;
  state.money -= s.upkeep;

  // Reputation is the building's recent delivery rate. A tower nobody can move
  // around in cannot attract replacement tenants, which is what makes a bad
  // stretch compound instead of self-healing.
  const w = config.occupancy.reputationWindow;
  const recent = state.log.slice(-w + 1).map((d) => d.deliveryRate);
  const todayRate = s.trips ? (s.delivered / s.trips) * 100 : 100;
  const deliveryReputation = [...recent, todayRate].reduce((a, b) => a + b, 0) / (recent.length + 1);
  const localOverflowSeconds = Math.max(0, Number(s.localOverflowSeconds) || 0);
  const localOverflowAverage = localOverflowSeconds / Math.max(1, Number(config.time?.daySeconds) || 1);
  const localOverflowPenalty = Math.min(
    Math.max(0, Number(config.occupancy.localOverflowReputationCap) || 0),
    localOverflowAverage * Math.max(0, Number(config.occupancy.localOverflowReputationWeight) || 0),
  );
  const reputation = Math.max(0, deliveryReputation - localOverflowPenalty);
  const localOverflowRoutes = (s.localOverflowRoutes ?? []).map((route) => ({
    kind: route.kind,
    routeId: route.routeId,
    bottom: Number.isFinite(Number(route.bottom)) ? Number(route.bottom) : null,
    top: Number.isFinite(Number(route.top)) ? Number(route.top) : null,
    seconds: +Math.max(0, Number(route.seconds) || 0).toFixed(2),
    average: +(Math.max(0, Number(route.seconds) || 0) / Math.max(1, Number(config.time?.daySeconds) || 1)).toFixed(2),
    peak: Math.max(0, Number(route.peak) || 0),
  }));
  const canRelist = reputation >= config.occupancy.relistMinDeliveryRate;

  // First process departures. A room that becomes vacant today cannot attract
  // a new tenant before it has spent at least one full day on the market.
  for (const u of state.units) {
    const tune = config.units[u.kind];
    if (u.occupied) {
      s.desirabilityRooms++;
      const retention = tenantRetentionPressure(state, u, config);
      u.desirabilityPressure = retention.nextPressure;
      if (u.desirabilityPressure > 0) {
        s.desirabilityAtRisk++;
        s.desirabilityPressureTotal += u.desirabilityPressure;
      }
      u.stress = Math.max(0, u.stress - tune.stressDecay);
      u.daysOccupied = (u.daysOccupied ?? 0) + 1;
      // A tenant who just moved in has not seen the player react to a bad
      // commute yet; give them a settling-in window before a rough rush can
      // push them straight back out. Room appeal is a slower-moving signal
      // the player set at build time, so it is not covered by the same grace.
      const inTransportGrace = u.daysOccupied <= config.occupancy.newTenantTransportGraceDays + (u.graceJitter ?? 0);
      const transportStressExit = !inTransportGrace && u.stress > tune.vacateAt * (u.vacateJitter ?? 1);
      const desirabilityExit = u.desirabilityPressure >= retention.vacateAt;
      if (transportStressExit || desirabilityExit) {
        const cause = transportStressExit ? 'transport_stress' : 'room_desirability';
        if (cause === 'transport_stress') s.vacatedByStress++;
        else s.vacatedByDesirability++;
        u.occupied = false;
        pushEvent(state, 'vacated', {
          unitKind: u.kind, floor: u.floor, cause,
          stress: +u.stress.toFixed(2),
          desirabilityScore: retention.score,
          desirabilityPressure: u.desirabilityPressure,
        });
        u.stress = 0;
        u.vacantDays = 0;
        s.vacated++;
      }
      continue;
    }
    u.vacantDays++;
  }

  // Hotel rooms turn over nightly. Poor building reputation, room quality, or
  // recent guest-feedback window reduces the next booking load, while a
  // healthy tower fills the hotel back to capacity.
  const bookingFeedback = hotelBookingFeedback(state, config);
  for (const u of state.units) {
    if (!u.occupied || u.kind !== 'hotel') continue;
    const tune = config.units.hotel;
    const reputationFactor = Math.max(0, Math.min(1, reputation / 100));
    const evaluation = unitEvaluation(state, u, config).score;
    const evaluationFloor = Math.max(1, tune.bookingEvaluationFloor ?? config.evaluation.relistMinScore);
    const evaluationFactor = Math.max(0, Math.min(1, evaluation / evaluationFloor));
    const guests = Math.max(tune.minGuests, Math.min(tune.guests,
      Math.round(tune.guests * reputationFactor * evaluationFactor * bookingFeedback.feedbackFactor)));
    if (u.heads !== guests) {
      u.heads = guests;
      pushEvent(state, 'hotel_occupancy', {
        floor: u.floor, guests, reputation: +reputation.toFixed(1), evaluation,
        previousExperience: bookingFeedback.previousExperience,
        feedbackFactor: bookingFeedback.feedbackFactor,
      });
    }
  }

  // Tenant demand is finite. The shared forecast keeps the player-facing
  // candidate count and the actual move-in batch on the same rules.
  const forecast = leasingForecast(state, config, reputation);
  const candidates = canRelist ? forecast.candidates : [];
  s.moveInCandidates = candidates.length;
  const moveInCapacity = canRelist ? forecast.capacity : 0;
  const selectedCandidates = candidates.slice(0, moveInCapacity);
  const leasingOutcome = {
    candidates: candidates.length,
    capacity: moveInCapacity,
    transportAccess: {
      key: forecast.transportAccess.key,
      label: forecast.transportAccess.label,
      bonus: forecast.transportAccess.bonus,
      tests: forecast.transportAccess.tests,
      trendKey: forecast.transportAccess.trend?.key ?? 'unknown',
      trendBars: forecast.transportAccess.trend?.bars ?? '',
    },
    rankingSignals: vacancyRankingSignalSummary(forecast),
    movedIn: selectedCandidates.map(({ unit: u, evaluation, marketDemandBonus: demandBonus, experienceDemand }) => ({
      unitId: u.id,
      unitKind: u.kind,
      floor: u.floor,
      evaluation: evaluation.score,
      marketDemandBonus: demandBonus,
      experienceDemandScore: experienceDemand.score,
      experienceDemandBonus: experienceDemand.bonus,
      transportAccessBonus: experienceDemand.transportAccessBonus ?? 0,
      desirabilityScore: experienceDemand.desirabilityScore,
      desirabilityDemandBonus: experienceDemand.desirabilityBonus,
    })),
  };
  for (const { unit: u, evaluation, marketDemandBonus: demandBonus, experienceDemand } of selectedCandidates) {
    u.occupied = true;
    u.vacantDays = 0;
    u.daysOccupied = 0;
    if (u.kind === 'hotel') u.heads = config.units.hotel.guests;
    assignTenantJitter(state, u, config);
    s.movedIn++;
    pushEvent(state, 'moved_in', {
      unitId: u.id, unitKind: u.kind, floor: u.floor, marketDemandBonus: demandBonus,
      experienceDemandBonus: experienceDemand.bonus,
      transportAccessBonus: experienceDemand.transportAccessBonus ?? 0,
      desirabilityScore: experienceDemand.desirabilityScore,
      desirabilityDemandBonus: experienceDemand.desirabilityBonus,
      selectionScore: evaluation.score + demandBonus + experienceDemand.bonus,
    });
  }

  // Star tiers are actionable milestones. Rewards are claimed once when the
  // population first reaches each threshold and are not reclaimed if the
  // tower later loses tenants.
  if (!state.starAwards) state.starAwards = [];
  const starAwards = [];
  const currentPopulation = population(state);
  for (const tier of config.stars.tiers) {
    if (!tier.reward || currentPopulation < tier.pop || state.starAwards.includes(tier.name)) continue;
    state.starAwards.push(tier.name);
    state.money += tier.reward;
    s.rewards += tier.reward;
    starAwards.push({ name: tier.name, reward: tier.reward });
    pushEvent(state, 'star_awarded', { star: tier.name, reward: tier.reward, pop: currentPopulation });
  }

  const shopTraffic = state.units
    .filter((u) => u.kind === 'shop')
    .map((shop) => {
      const estimate = shopTrafficEstimate(state, shop, config, reputation);
      return {
        unitId: shop.id,
        floor: shop.floor,
        served: shop.servedToday ?? 0,
        revenue: Math.round((shop.servedToday ?? 0) * (config.units.shop.revenuePerCustomer ?? 0)),
        potentialCustomers: estimate.potentialCustomers,
        expectedCustomers: estimate.expectedCustomers,
        potentialRevenue: estimate.potentialRevenue,
        expectedRevenue: estimate.expectedRevenue,
        deliveryFactor: estimate.deliveryFactor,
      };
    });
  for (const u of state.units) u.servedToday = 0;
  const hotelExperience = hotelExperienceSummary(state, config);
  const tenantMix = tenantMixSnapshot(state, config);
  const desirability = towerDesirabilitySummary(state, config);

  const closed = {
    day: state.day,
    money: Math.round(state.money),
    floors: state.floors,
    basements: basementDepth(state),
    pop: population(state),
    star: starTier(state, config).name,
    units: state.units.length,
    occupied: state.units.filter((u) => u.occupied).length,
    shafts: state.shafts.length,
    vacant: state.units.filter((u) => !u.occupied).length,
    rep: +reputation.toFixed(1),
    starAwards,
    hotelExperience: hotelExperience.average,
    hotelRooms: hotelExperience.rooms,
    hotelGuests: hotelExperience.guests,
    tenantMix,
    desirability: desirability.score,
    shopTraffic,
    leasing: leasingOutcome,
    cars: state.shafts.reduce((n, sh) => n + sh.cars.length, 0),
    ...s,
    localOverflowSeconds: +localOverflowSeconds.toFixed(2),
    localOverflowPeak: Math.max(0, Number(s.localOverflowPeak) || 0),
    localOverflowAverage: +localOverflowAverage.toFixed(2),
    localOverflowPenalty: +localOverflowPenalty.toFixed(2),
    deliveryReputation: +deliveryReputation.toFixed(1),
    localOverflowRoutes,
    // Averaged over every resolved trip, not just the ones that arrived —
    // otherwise a tower that strands everyone looks like it has short queues.
    avgWait: (s.delivered + s.abandoned)
      ? +(s.waitTotal / (s.delivered + s.abandoned)).toFixed(2) : 0,
    waitMax: +s.waitMax.toFixed(2),
    localAvgWait: (s.localDelivered + s.localAbandoned)
      ? +(s.localWaitTotal / (s.localDelivered + s.localAbandoned)).toFixed(2) : 0,
    localWaitMax: +s.localWaitMax.toFixed(2),
    localDeliveryRate: s.localTrips ? +((s.localDelivered / s.localTrips) * 100).toFixed(1) : 100,
    elevatorAvgWait: (s.elevatorDelivered + s.elevatorAbandoned)
      ? +(s.elevatorWaitTotal / (s.elevatorDelivered + s.elevatorAbandoned)).toFixed(2) : 0,
    elevatorWaitMax: +s.elevatorWaitMax.toFixed(2),
    elevatorDeliveryRate: s.elevatorTrips ? +((s.elevatorDelivered / s.elevatorTrips) * 100).toFixed(1) : 100,
    deliveryRate: s.trips ? +((s.delivered / s.trips) * 100).toFixed(1) : 100,
    net: Math.round(s.rent + s.shopRevenue + s.rewards - s.upkeep - s.spent),
    retention: {
      rooms: s.desirabilityRooms,
      roomsAtRisk: s.desirabilityAtRisk,
      pressureTotal: +s.desirabilityPressureTotal.toFixed(3),
      averagePressure: s.desirabilityRooms
        ? +(s.desirabilityPressureTotal / s.desirabilityRooms).toFixed(3) : 0,
      vacatedByStress: s.vacatedByStress,
      vacatedByDesirability: s.vacatedByDesirability,
    },
  };
  state.log.push(closed);

  if (state.money < 0) {
    state.over = true;
    pushEvent(state, 'bankrupt', {});
  }

  state.today = blankDayStats();
  return closed;
}
