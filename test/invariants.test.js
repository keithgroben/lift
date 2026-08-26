import { CONFIG } from '../src/config/lift.config.js';
import { boot, step, applyAction } from '../src/sim/index.js';
import { POLICIES } from '../harness/policy.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function play(policyKey, days, seed = 3, cfg = CONFIG) {
  const s = boot(cfg, seed);
  POLICIES[policyKey].open(s, cfg);
  const seen = [];
  while (s.day <= days && !s.over) {
    const closed = step(s, cfg.time.dt, cfg);
    if (closed) { seen.push({ closed, snap: s }); POLICIES[policyKey].decide(s, cfg); }
  }
  return s;
}

export const tests = {
  /**
   * REGRESSION. Riders still in transit at midnight used to be deleted, so they
   * counted as neither delivered nor abandoned. A tower failing 90% of its trips
   * reported a FALLING average wait. Any hole here hides the bottleneck.
   */
  'every trip resolves: trips === delivered + abandoned, every day'() {
    for (const p of ['naive', 'reactive', 'balanced']) {
      const s = play(p, 30);
      for (const d of s.log) {
        assert(d.trips === d.delivered + d.abandoned,
          `${p} day ${d.day}: ${d.trips} trips but ${d.delivered}+${d.abandoned} resolved — ${d.trips - d.delivered - d.abandoned} vanished`);
      }
    }
  },

  /**
   * BOUND + NEGATE. A rider with no elevator waited forever, not zero. Logging
   * the stranded case as 0 made a tower that served nobody post the shortest
   * queues in the sweep. Build offices above a stub shaft and the average wait
   * must pin to the abandon ceiling — not sit near zero.
   */
  'stranded riders are charged the full abandon wait, not zero'() {
    const s = boot(CONFIG, 5);
    applyAction(s, { type: 'build_shaft', bottom: 0, top: 1 }, CONFIG); // reaches floor 1 only
    applyAction(s, { type: 'build_unit', kind: 'office', floor: 3 }, CONFIG);
    // Day 1's schedule was built by boot(), before the fixture unit existed —
    // read day 2, the first day that actually has trips to strand.
    while (s.day <= 3) step(s, CONFIG.time.dt, CONFIG);
    const d = s.log[1];
    assert(d.trips > 0, 'no trips were generated — the fixture is broken, not the sim');
    assert(d.delivered === 0, `expected every trip stranded, ${d.delivered} were delivered`);
    assert(d.avgWait === CONFIG.demand.abandonAfter,
      `stranded avgWait was ${d.avgWait}, expected ${CONFIG.demand.abandonAfter}`);
  },

  'a car never exceeds capacity and never holds a rider twice'() {
    const s = boot(CONFIG, 11);
    POLICIES.balanced.open(s, CONFIG);
    let checks = 0;
    while (s.day <= 12 && !s.over) {
      if (step(s, CONFIG.time.dt, CONFIG)) POLICIES.balanced.decide(s, CONFIG);
      for (const sh of s.shafts) for (const car of sh.cars) {
        assert(car.riders.length <= CONFIG.elevator.capacity,
          `car ${car.id} held ${car.riders.length} riders, capacity is ${CONFIG.elevator.capacity}`);
        assert(new Set(car.riders.map((r) => r.id)).size === car.riders.length,
          `car ${car.id} holds a duplicate rider`);
        assert(car.y >= sh.bottom - 1e-6 && car.y <= sh.top + 1e-6,
          `car ${car.id} at ${car.y} left its shaft (${sh.bottom}..${sh.top})`);
        checks++;
      }
    }
    assert(checks > 500, `only ${checks} car-states inspected — the loop is not exercising anything`);
  },

  'a shaft column is never shared with a unit on any floor it passes'() {
    const s = play('balanced', 30);
    for (const sh of s.shafts) {
      for (const u of s.units) {
        if (u.slot !== sh.slot) continue;
        assert(u.floor < sh.bottom || u.floor > sh.top,
          `unit ${u.id} sits in shaft ${sh.id}'s column on floor ${u.floor}`);
      }
    }
  },

  'reported percentages and money stay finite and in range'() {
    for (const p of ['naive', 'reactive', 'balanced']) {
      for (const d of play(p, 30).log) {
        assert(Number.isFinite(d.money) && Number.isFinite(d.avgWait), `${p} day ${d.day}: NaN in the log`);
        assert(d.deliveryRate >= 0 && d.deliveryRate <= 100, `${p} day ${d.day}: deliveryRate ${d.deliveryRate}`);
        assert(d.avgWait <= CONFIG.demand.abandonAfter + 1e-6,
          `${p} day ${d.day}: avgWait ${d.avgWait} exceeds the abandon ceiling`);
      }
    }
  },

  /**
   * The whole design claim in one assertion. If understanding the bottleneck
   * stops paying, the elevator has become decoration and the game is broken —
   * regardless of whether anything throws.
   */
  'knowing the bottleneck beats ignoring it, across seeds'() {
    let naiveTotal = 0, balancedTotal = 0;
    for (let seed = 1; seed <= 5; seed++) {
      naiveTotal += play('naive', 60, seed).log.length;
      balancedTotal += play('balanced', 60, seed).log.length;
    }
    assert(balancedTotal > naiveTotal * 1.5,
      `balanced survived ${balancedTotal} days vs naive ${naiveTotal} — managing the elevator no longer pays`);
  },
};
