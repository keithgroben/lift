import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction, population } from '../src/games/lift/sim/index.js';
import { scheduleDay } from '../src/games/lift/sim/demand.js';
import { dayClose } from '../src/games/lift/sim/economy.js';
import { hotelBookingFeedback, hotelExperienceHistory, hotelExperienceSummary, hotelGuestExperience, hotelServiceSummary } from '../src/games/lift/sim/evaluation.js';
import { occupy } from './support.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function unlockedHotelConfig() {
  const config = structuredClone(CONFIG);
  config.building.startFloors = 4;
  config.economy.startMoney = 10000000;
  config.stars.tiers[0].unlocks.push('hotel');
  return config;
}

export const tests = {
  'hotel unlocks at the population gate and uses guest capacity'() {
    const config = structuredClone(CONFIG);
    config.building.startFloors = 4;
    config.economy.startMoney = 10000000;
    config.building.startFloors = 30;
    const state = boot(config, 501);
    const locked = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(!locked.ok && locked.reason === 'hotel is locked', 'hotel was available before its population gate');
    for (let floor = 1; floor <= 27; floor++) {
      const office = applyAction(state, { type: 'build_unit', kind: 'office', floor }, config);
      assert(office.ok, office.reason);
      // Rooms open empty and fill through leasing over days this fixture does
      // not run. What is on trial is the POPULATION gate, not how the tower
      // reached that population, so each office is let as it is built — which
      // is also what keeps the vacancy backlog from blocking the next one.
      occupy(state, config, state.units.at(-1));
    }
    assert(population(state) >= 160, 'hotel fixture did not reach its population gate');
    const built = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 28 }, config);
    assert(built.ok, built.reason);
    const hotel = state.units.at(-1);
    assert(hotel.heads === config.units.hotel.guests && hotel.rent === config.units.hotel.rent,
      'hotel did not start at its guest capacity and nightly rate');
  },

  'hotel bookings create predictable lobby traffic and per-guest rent'() {
    const config = unlockedHotelConfig();
    const state = boot(config, 502);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok, 'could not build lobby');
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok, 'could not build shaft');
    // The first storey, which stands on the ground and is served by the same
    // shaft: the trips and the per-guest rent this fixture counts do not depend
    // on how high the room is.
    const built = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(built.ok, built.reason);
    const hotel = state.units[0];
    // Guests are what generate the traffic being counted; seat them.
    occupy(state, config, hotel);
    scheduleDay(state, config);
    const hotelTrips = state.schedule.filter((trip) => trip.unit === hotel.id);
    assert(hotelTrips.length === hotel.heads * config.demand.hotelTripsPerGuestPerDay,
      'hotel traffic did not scale with booked guests');
    assert(hotelTrips.filter((trip) => trip.kind === 'hotel_check_in').length === hotel.heads,
      'hotel check-ins were not scheduled once per guest');
    assert(hotelTrips.filter((trip) => trip.kind === 'hotel_check_out').length === hotel.heads,
      'hotel check-outs were not scheduled once per guest');

    const closed = dayClose(state, config);
    assert(closed.rent === hotel.heads * config.units.hotel.rent,
      'hotel rent was not charged per occupied guest-night');
  },

  'poor reputation reduces the next hotel booking load without emptying it'() {
    const config = unlockedHotelConfig();
    const state = boot(config, 503);
    // The first storey stands on the ground; with no shaft anywhere, a hotel
    // is just as unreachable here as it was on F3.
    const built = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(built.ok, built.reason);
    const hotel = state.units[0];
    // A booking load only exists for a booked room. The subject is what
    // reputation does to that load, not how the first guests arrived.
    occupy(state, config, hotel);
    state.log = [{ deliveryRate: 0 }, { deliveryRate: 20 }];
    state.today.trips = 10;
    state.today.delivered = 0;
    const closed = dayClose(state, config);
    assert(closed.rep < config.occupancy.relistMinDeliveryRate, 'hotel fixture did not produce poor reputation');
    assert(hotel.heads === config.units.hotel.minGuests, 'poor reputation did not reduce hotel bookings to its floor');
    assert(state.events.at(-1).kind === 'hotel_occupancy' && state.events.at(-1).guests === config.units.hotel.minGuests,
      'hotel booking change was not recorded');
  },

  'hotel room evaluation also controls booking load'() {
    const config = unlockedHotelConfig();
    const stranded = boot(config, 504);
    const poorBuilt = applyAction(stranded, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(poorBuilt.ok, poorBuilt.reason);
    const poorHotel = stranded.units[0];
    occupy(stranded, config, poorHotel);
    const poorClosed = dayClose(stranded, config);
    assert(poorClosed.rep === 100 && poorHotel.heads === config.units.hotel.minGuests,
      'a hotel with no access did not lose bookings despite healthy reputation');

    const served = boot(config, 505);
    assert(applyAction(served, { type: 'build_lobby', slot: 0 }, config).ok, 'could not build hotel lobby');
    assert(applyAction(served, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok, 'could not build hotel shaft');
    const goodBuilt = applyAction(served, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(goodBuilt.ok, goodBuilt.reason);
    const goodHotel = served.units[0];
    // Both halves are booked before the close, so "keeps its guests" and "loses
    // them" are the same measurement made twice — an empty room would satisfy
    // the served half for the wrong reason.
    occupy(served, config, goodHotel);
    const goodClosed = dayClose(served, config);
    assert(goodClosed.rep === 100 && goodHotel.heads === config.units.hotel.guests,
      'an accessible hotel did not fill at healthy reputation');
  },

  'hotel service summary identifies missing and covered services'() {
    const config = unlockedHotelConfig();
    const state = boot(config, 506);
    const built = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(built.ok, built.reason);
    const hotel = state.units[0];
    const before = hotelServiceSummary(state, hotel, config);
    assert(before.requiredCount === 4 && before.coveredCount === 0 && before.missing.includes('food'),
      'hotel service summary did not expose missing coverage');
    assert(applyAction(state, { type: 'build_facility', kind: 'food', floor: 1 }, config).ok,
      'could not build hotel food service');
    const after = hotelServiceSummary(state, hotel, config);
    assert(after.coveredCount === 1 && !after.missing.includes('food'),
      'hotel service summary did not update covered food service');
  },

  'hotel guest experience reflects stress and service coverage'() {
    const config = unlockedHotelConfig();
    const state = boot(config, 507);
    const built = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(built.ok, built.reason);
    const hotel = state.units[0];
    const before = hotelGuestExperience(state, hotel, config);
    assert(before.score === config.units.hotel.guestExperience.stressWeight,
      'unserved hotel did not expose its service-based experience score');
    assert(applyAction(state, { type: 'build_facility', kind: 'food', floor: 1 }, config).ok,
      'could not build hotel experience food service');
    const afterService = hotelGuestExperience(state, hotel, config);
    assert(afterService.score > before.score && afterService.servicePenalty < before.servicePenalty,
      'hotel guest experience did not improve with service coverage');
    hotel.stress = config.units.hotel.vacateAt / 2;
    const afterStress = hotelGuestExperience(state, hotel, config);
    assert(afterStress.score < afterService.score && afterStress.stressPenalty > before.stressPenalty,
      'hotel guest experience did not respond to guest stress');
  },

  'hotel guest feedback summary records a daily trend signal'() {
    const config = unlockedHotelConfig();
    const state = boot(config, 508);
    const built = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(built.ok, built.reason);
    const hotel = state.units[0];
    // Guest feedback is aggregated over BOOKED rooms; an empty one reports
    // nothing at all.
    occupy(state, config, hotel);
    const first = dayClose(state, config);
    assert(first.hotelRooms === 1 && first.hotelGuests === hotel.heads && Number.isFinite(first.hotelExperience),
      'day close did not record hotel guest feedback');
    const before = hotelExperienceSummary(state, config);
    assert(before.average === first.hotelExperience, 'hotel feedback summary disagreed with day log');
    hotel.stress = config.units.hotel.vacateAt / 2;
    const second = dayClose(state, config);
    assert(second.hotelExperience < first.hotelExperience && second.hotelExperience !== null,
      'hotel guest feedback did not trend down with stress');
  },

  'hotel feedback weights rooms by booked guests'() {
    const config = unlockedHotelConfig();
    const state = boot(config, 510);
    const firstBuilt = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    const secondBuilt = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(firstBuilt.ok && secondBuilt.ok, 'could not build multi-room hotel feedback fixture');
    const [fullRoom, smallRoom] = state.units;
    occupy(state, config, fullRoom, smallRoom);
    smallRoom.heads = config.units.hotel.minGuests;
    smallRoom.stress = config.units.hotel.vacateAt;
    const summary = hotelExperienceSummary(state, config);
    const fullScore = hotelGuestExperience(state, fullRoom, config).score;
    const smallScore = hotelGuestExperience(state, smallRoom, config).score;
    const expected = Math.round((fullScore * fullRoom.heads + smallScore * smallRoom.heads)
      / (fullRoom.heads + smallRoom.heads));
    assert(summary.rooms === 2 && summary.guests === fullRoom.heads + smallRoom.heads,
      'multi-room hotel feedback did not count booked guests');
    assert(summary.average === expected && summary.average !== Math.round((fullScore + smallScore) / 2),
      'hotel feedback was not weighted by booked guests');
  },

  'hotel booking feedback smooths a short guest-weighted history'() {
    const config = unlockedHotelConfig();
    const state = boot(config, 511);
    state.log = [
      { day: 1, hotelExperience: 0, hotelGuests: 6 },
      { day: 2, hotelExperience: 100, hotelGuests: 6 },
      { day: 3, hotelExperience: 0, hotelGuests: 6 },
      { day: 4, hotelExperience: 100, hotelGuests: 6 },
    ];
    const feedback = hotelBookingFeedback(state, config);
    const history = hotelExperienceHistory(state, config);
    assert(feedback.feedbackDays === config.units.hotel.bookingFeedbackDays,
      'hotel feedback did not use the configured recent-day window');
    assert(feedback.previousExperience === 67 && feedback.feedbackFactor < 1,
      'hotel feedback did not smooth consecutive days before applying the factor');
    assert(history.map((day) => day.day).join(',') === '2,3,4' && feedback.feedbackGuests === 18,
      'hotel feedback history did not expose the same recent guest records');
  },

  'prior hotel feedback trims the next booking load without emptying the room'() {
    const config = unlockedHotelConfig();
    const state = boot(config, 509);
    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok, 'could not build hotel feedback lobby');
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok, 'could not build hotel feedback shaft');
    const built = applyAction(state, { type: 'build_unit', kind: 'hotel', floor: 1 }, config);
    assert(built.ok, built.reason);
    const hotel = state.units[0];
    occupy(state, config, hotel);
    const first = dayClose(state, config);
    assert(hotel.heads === config.units.hotel.guests, 'healthy hotel did not start full before feedback existed');
    state.log.at(-1).hotelExperience = 0;
    const poorFeedback = hotelBookingFeedback(state, config);
    assert(poorFeedback.feedbackFactor < 1 && poorFeedback.previousExperience === 0,
      'poor hotel feedback did not produce a bounded booking factor');
    dayClose(state, config);
    assert(hotel.heads < config.units.hotel.guests && hotel.heads >= config.units.hotel.minGuests,
      'poor hotel feedback did not trim the next booking load safely');
    assert(state.events.at(-1).feedbackFactor === poorFeedback.feedbackFactor,
      'hotel booking event did not explain its feedback factor');
    assert(first.hotelExperience !== null, 'hotel feedback fixture did not record its first experience');
  },
};
