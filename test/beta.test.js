import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction, population, runDays } from '../src/games/lift/sim/index.js';
import { firstSessionRecoveryEvidence, postBetaManagementGoal, serviceCoverageSummary, unitEvaluation } from '../src/games/lift/sim/evaluation.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

export const tests = {
  'first-session path exposes transport pressure and recovers with a car'() {
    const config = structuredClone(CONFIG);
    const state = boot(config, 7006);

    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok,
      'first-session path could not build the lobby');
    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
    assert(shaft.ok, 'first-session path could not build the shaft');
    for (let floor = 1; floor <= 3; floor++) {
      const room = applyAction(state, { type: 'build_unit', kind: 'office', floor, slot: 0 }, config);
      assert(room.ok, 'first-session path could not build office on F' + floor);
    }

    runDays(state, 2, config);
    const pressure = state.log.at(-1);
    assert(pressure.day === 2 && pressure.elevatorTrips > 0 && pressure.abandoned > 0 &&
      pressure.deliveryRate < 100 && state.units.some((unit) => !unit.occupied),
      'first-session path did not expose a visible transport problem');

    const car = applyAction(state, { type: 'add_car', id: shaft.id }, config);
    assert(car.ok, 'first-session path could not add the recovery car');
    runDays(state, 1, config);
    const recovery = state.log.at(-1);
    assert(recovery.day === 3 && state.shafts[0].cars.length === 2 &&
      recovery.deliveryRate > pressure.deliveryRate && recovery.abandoned < pressure.abandoned &&
      recovery.movedIn > 0 && state.units.every((unit) => unit.occupied) && population(state) === 18,
      'first-session path did not recover occupancy after adding a car');
    assert(Number.isFinite(pressure.desirability) && Number.isFinite(recovery.desirability) &&
      pressure.desirability !== recovery.desirability && Number.isFinite(recovery.rep),
      'first-session path did not record reputation and desirability response');
  },

  'beta acceptance path carries transport recovery into service management'() {
    const config = structuredClone(CONFIG);
    const state = boot(config, 7006);

    assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok,
      'beta acceptance path could not build the lobby');
    const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
    assert(shaft.ok, 'beta acceptance path could not build the shaft');
    for (let floor = 1; floor <= 3; floor++) {
      assert(applyAction(state, { type: 'build_unit', kind: 'office', floor, slot: 0 }, config).ok,
        'beta acceptance path could not build office on F' + floor);
    }

    runDays(state, 2, config);
    const pressure = state.log.at(-1);
    assert(pressure.abandoned > 0 && pressure.deliveryRate < 100,
      'beta acceptance path did not create transport pressure');
    assert(applyAction(state, { type: 'add_car', id: shaft.id }, config).ok,
      'beta acceptance path could not add the recovery car');
    runDays(state, 1, config);
    const recovery = state.log.at(-1);
    assert(recovery.deliveryRate > pressure.deliveryRate && state.units.every((unit) => unit.occupied),
      'beta acceptance path did not recover the tower');
    const recoveryEvidence = firstSessionRecoveryEvidence(state.log, null, config);
    assert(recoveryEvidence.observed && recoveryEvidence.recovered,
      'beta acceptance path did not retain the observed pressure step after recovery');

    const goal = postBetaManagementGoal(state, config);
    assert(goal.action === 'food' && goal.targetUnitId != null && goal.recommendedFloor != null &&
      goal.detail.includes('remaining uncovered'),
      'beta acceptance path did not produce a concrete service goal');
    const service = applyAction(state, { type: 'build_facility', kind: goal.action, floor: goal.recommendedFloor }, config);
    assert(service.ok, 'beta acceptance path could not place the recommended service');
    const coverage = serviceCoverageSummary(state, 'food', config);
    assert(coverage.coveredRooms === coverage.requiredRooms && coverage.coveredHeads === coverage.requiredHeads &&
      state.units.every((unit) => unitEvaluation(state, unit, config).foodCovered) &&
      postBetaManagementGoal(state, config).action === 'parking',
      'beta acceptance path did not hand off from food coverage to the next service goal');
  },

  'first-session balance sample preserves recovery and service handoff'() {
    let recoveredRuns = 0;
    let serviceRuns = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const config = structuredClone(CONFIG);
      const state = boot(config, seed);
      assert(applyAction(state, { type: 'build_lobby', slot: 0 }, config).ok,
        'balance sample could not build the lobby for seed ' + seed);
      const shaft = applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config);
      assert(shaft.ok, 'balance sample could not build the shaft for seed ' + seed);
      for (let floor = 1; floor <= 3; floor++) {
        assert(applyAction(state, { type: 'build_unit', kind: 'office', floor, slot: 0 }, config).ok,
          'balance sample could not build office on F' + floor + ' for seed ' + seed);
      }

      runDays(state, 2, config);
      const pressure = state.log.at(-1);
      assert(pressure.deliveryRate < 100 && pressure.abandoned > 0,
        'balance sample did not expose pressure for seed ' + seed);
      assert(applyAction(state, { type: 'add_car', id: shaft.id }, config).ok,
        'balance sample could not add the recovery car for seed ' + seed);
      runDays(state, 3, config);
      const recovery = state.log.slice(-3).find((entry) =>
        entry.cars >= 2 && entry.deliveryRate > pressure.deliveryRate && entry.rep > pressure.rep);
      if (recovery) recoveredRuns++;

      const goal = postBetaManagementGoal(state, config);
      const service = applyAction(state, { type: 'build_facility', kind: goal.action, floor: goal.recommendedFloor }, config);
      if (goal.action === 'food' && service.ok) serviceRuns++;
    }
    assert(recoveredRuns === 20,
      'balance sample did not improve delivery and reputation in every seed (' + recoveredRuns + '/20)');
    assert(serviceRuns === 20,
      'balance sample did not preserve the cafeteria handoff in every seed (' + serviceRuns + '/20)');
  },
};
