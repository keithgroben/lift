import { blankDayStats, population, starTier, pushEvent } from './state.js';

/** Rent, upkeep, stress bleed-off, move-outs and move-ins. Runs once per day. */
export function dayClose(state, config) {
  const s = state.today;

  for (const u of state.units) {
    if (!u.occupied) continue;
    const rent = config.units[u.kind].rent;
    state.money += rent;
    s.rent += rent;
  }

  const vacant = state.units.filter((u) => !u.occupied).length;
  s.upkeep = state.floors * config.economy.upkeepPerFloor
           + vacant * config.occupancy.vacantUpkeep;
  state.money -= s.upkeep;

  // Reputation is the building's recent delivery rate. A tower nobody can move
  // around in cannot attract replacement tenants, which is what makes a bad
  // stretch compound instead of self-healing.
  const w = config.occupancy.reputationWindow;
  const recent = state.log.slice(-w + 1).map((d) => d.deliveryRate);
  const todayRate = s.trips ? (s.delivered / s.trips) * 100 : 100;
  const reputation = [...recent, todayRate].reduce((a, b) => a + b, 0) / (recent.length + 1);
  const canRelist = reputation >= config.occupancy.relistMinDeliveryRate;

  for (const u of state.units) {
    const tune = config.units[u.kind];
    if (u.occupied) {
      u.stress = Math.max(0, u.stress - tune.stressDecay);
      if (u.stress > tune.vacateAt) {
        u.occupied = false;
        u.stress = 0;
        u.vacantDays = 0;
        s.vacated++;
        pushEvent(state, 'vacated', { kind: u.kind, floor: u.floor });
      }
    } else {
      u.vacantDays++;
      if (canRelist && u.vacantDays >= tune.relistDays) {
        u.occupied = true;
        u.vacantDays = 0;
        s.movedIn++;
        pushEvent(state, 'moved_in', { kind: u.kind, floor: u.floor });
      }
    }
    u.servedToday = 0;
  }

  const closed = {
    day: state.day,
    money: Math.round(state.money),
    floors: state.floors,
    pop: population(state),
    star: starTier(state, config).name,
    units: state.units.length,
    occupied: state.units.filter((u) => u.occupied).length,
    shafts: state.shafts.length,
    vacant,
    rep: +reputation.toFixed(1),
    cars: state.shafts.reduce((n, sh) => n + sh.cars.length, 0),
    ...s,
    // Averaged over every resolved trip, not just the ones that arrived —
    // otherwise a tower that strands everyone looks like it has short queues.
    avgWait: (s.delivered + s.abandoned)
      ? +(s.waitTotal / (s.delivered + s.abandoned)).toFixed(2) : 0,
    waitMax: +s.waitMax.toFixed(2),
    deliveryRate: s.trips ? +((s.delivered / s.trips) * 100).toFixed(1) : 100,
    net: Math.round(s.rent + s.shopRevenue - s.upkeep - s.spent),
  };
  state.log.push(closed);

  if (state.money < 0) {
    state.over = true;
    pushEvent(state, 'bankrupt', {});
  }

  state.today = blankDayStats();
  return closed;
}
