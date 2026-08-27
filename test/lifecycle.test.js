import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction, population, slotsUsed } from '../src/games/lift/sim/index.js';
import { conversionPreview, leaseStatus, leasingForecast, marketDemandBonus, relistDaysFor, reputationDemandFactor, reputationHistory, reputationRecommendation, tenantDemandForecast, tenantMixDemand, tenantMixDiagnosis, tenantMixHistory, tenantMixResponse, tenantMixSnapshot, unitEvaluation, vacancyRecoveryComparison } from '../src/games/lift/sim/evaluation.js';
import { dayClose } from '../src/games/lift/sim/economy.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

export const tests = {
  'limited move-in demand chooses the highest-evaluated eligible room'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.occupancy.moveInCapacity = 1;
    const state = boot(config, 118);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
      'could not build high-evaluation room');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 2 }, config).ok,
      'could not build lower-evaluation room');
    const [best, lower] = state.units;
    best.occupied = false;
    best.vacantDays = 1;
    best.renovated = true;
    lower.occupied = false;
    lower.vacantDays = 1;
    assert(unitEvaluation(state, best, config).score > unitEvaluation(state, lower, config).score,
      'fixture rooms did not have distinct evaluations');
    const movedInBefore = state.today.movedIn;

    const closed = dayClose(state, config);
    assert(closed.moveInCandidates === 2 && closed.movedIn === movedInBefore + 1,
      'move-in demand did not expose or limit candidates');
    assert(best.occupied && !lower.occupied,
      'the highest-evaluated room did not receive the move-in');
    assert(closed.vacant === 1, 'closed vacancy count ignored the selected move-in');
  },

  'move-in demand gives underrepresented tenant types a bounded priority'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.occupancy.moveInCapacity = 1;
    config.stars.tiers[1].pop = 0;
    for (const key of ['stressWeight', 'accessWeight', 'rentWeight', 'noiseWeight', 'foodWeight',
      'parkingWeight', 'medicalWeight', 'securityWeight', 'recyclingWeight', 'amenityWeight',
      'viewWeight', 'preferenceWeight', 'layoutBonus']) config.evaluation[key] = 0;
    const state = boot(config, 119);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build demand-selection shaft');
    const anchor = applyAction(state, { type: 'build_unit', kind: 'office', floor: 1, slot: 1 }, config);
    const office = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config);
    const condo = applyAction(state, { type: 'build_unit', kind: 'condo', floor: 3, slot: 2 }, config);
    assert(anchor.ok && office.ok && condo.ok, 'could not build demand-selection fixture');
    state.units[1].occupied = false;
    state.units[1].vacantDays = config.units.office.relistDays;
    state.units[2].occupied = false;
    state.units[2].vacantDays = config.units.condo.relistDays;
    const officeDemand = marketDemandBonus(state, state.units[1], config);
    const condoDemand = marketDemandBonus(state, state.units[2], config);
    assert(condoDemand === config.occupancy.marketDemandWeight && officeDemand === 0,
      'tenant mix did not identify the underrepresented type');
    const movedInBefore = state.today.movedIn;
    const closed = dayClose(state, config);
    assert(closed.movedIn === movedInBefore + 1 && state.units[2].occupied && !state.units[1].occupied,
      'market demand did not affect the move-in winner');
    assert(closed.leasing.rankingSignals?.detail.includes('room appeal') &&
      closed.leasing.rankingSignals.detail.includes('access'),
      'day close did not retain the daily desirability-versus-access ranking evidence');
    const movedIn = state.events.filter((event) => event.kind === 'moved_in').at(-1);
    assert(movedIn.marketDemandBonus === condoDemand &&
      Number.isFinite(movedIn.experienceDemandBonus) &&
      Number.isFinite(movedIn.transportAccessBonus) &&
      Number.isFinite(movedIn.desirabilityDemandBonus) &&
      closed.leasing.movedIn.some((entry) => entry.floor === movedIn.floor &&
        entry.unitId === state.units[2].id &&
        entry.experienceDemandBonus === movedIn.experienceDemandBonus &&
        entry.transportAccessBonus === movedIn.transportAccessBonus &&
        entry.desirabilityDemandBonus === movedIn.desirabilityDemandBonus),
      'move-in event did not explain the market-demand priority');
  },

  'tenant demand breakdown reports occupied shares against targets'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 120);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
      'could not build first demand mix office');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 2 }, config).ok,
      'could not build second demand mix office');
    assert(applyAction(state, { type: 'build_unit', kind: 'condo', floor: 3, slot: 3 }, config).ok,
      'could not build demand mix condo');
    const mix = tenantMixDemand(state, config);
    const offices = mix.find((entry) => entry.kind === 'office');
    const condos = mix.find((entry) => entry.kind === 'condo');
    assert(offices.heads === 12 && condos.heads === 3, 'tenant mix did not count occupied heads');
    assert(Math.abs(offices.share + condos.share - 1) < 0.001,
      'tenant mix shares did not add to the occupied population');
    assert(offices.targetShare === config.units.office.targetShare &&
      condos.targetShare === config.units.condo.targetShare,
    'tenant mix did not expose configured targets');
    assert(condos.marketDemandBonus > offices.marketDemandBonus,
      'tenant mix did not identify the underrepresented type');
  },

  'reputation gently scales underrepresented tenant demand'() {
    const config = structuredClone(CONFIG);
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 126);
    const office = applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config);
    const condo = applyAction(state, { type: 'build_unit', kind: 'condo', floor: 3 }, config);
    assert(office.ok && condo.ok, 'could not build reputation-demand fixture');
    const high = marketDemandBonus(state, { kind: 'hotel' }, config);
    const factor = reputationDemandFactor(state, config, 60);
    const low = marketDemandBonus({ ...state, log: [{ rep: 60 }] }, { kind: 'hotel' }, config);
    const atGate = reputationDemandFactor(state, config, config.occupancy.relistMinDeliveryRate);
    const atZero = reputationDemandFactor(state, config, 0);
    assert(factor < 1 && factor > 0 && low < high && atGate >= config.occupancy.reputationDemandFloor &&
      atZero === config.occupancy.reputationDemandFloor && reputationDemandFactor(state, config, 100) === 1,
      'reputation did not reduce tenant-mix demand while preserving a bounded factor');
  },

  'healthy reputation shortens vacancy market delay without bypassing the gate'() {
    const config = structuredClone(CONFIG);
    const state = boot(config, 127);
    const unit = { kind: 'office' };
    const healthy = relistDaysFor(state, unit, config, 100);
    const gated = relistDaysFor(state, unit, config, config.occupancy.relistMinDeliveryRate);
    const poor = relistDaysFor(state, unit, config, config.occupancy.relistMinDeliveryRate - 1);
    assert(healthy === config.units.office.relistDays - 1 && gated === config.units.office.relistDays &&
      poor === config.units.office.relistDays,
      'reputation did not adjust only the market delay above the leasing gate');
  },

  'leasing forecast mirrors evaluation, reputation timing, and daily capacity'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.occupancy.moveInCapacity = 1;
    const state = boot(config, 128);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build forecast shaft');
    for (const slot of [1, 2]) {
      const built = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot }, config);
      assert(built.ok, 'could not build forecast room');
    }
    for (const unit of state.units) {
      unit.occupied = false;
      unit.vacantDays = 1;
      unit.renovated = true;
    }
    const healthy = leasingForecast(state, config, 100);
    assert(healthy.vacancies === 2 && healthy.marketReady === 2 && healthy.candidates.length === 2 &&
      healthy.marketCandidates[0].unit.id === state.units[0].id && healthy.capacity === 1 && healthy.expected === 1,
      'leasing forecast did not combine eligible rooms with daily capacity');
    const tenants = tenantDemandForecast(state, config, 100);
    assert(tenants.nextKind === 'office' && tenants.expectedMoveIns === 1 &&
      tenants.projectedMix.find((entry) => entry.kind === 'office').heads === 6,
      'tenant forecast did not identify the next type and projected mix');
    assert(tenants.lockedKinds.includes('condo') && tenants.absentKinds.length === 0,
      'tenant forecast did not distinguish locked types from active demand');
    const gated = leasingForecast(state, config, config.occupancy.relistMinDeliveryRate - 1);
    assert(!gated.gateOpen && gated.marketReady === 0 && gated.expected === 0,
      'leasing forecast did not honor the reputation gate');
  },

  'tenant mix history records movement toward target shares'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 129);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok,
      'could not build first mix-history office');
    const first = dayClose(state, config);
    assert(first.tenantMix && Number.isFinite(first.tenantMix.balance),
      'day close did not record tenant mix');
    assert(applyAction(state, { type: 'build_unit', kind: 'condo', floor: 3 }, config).ok,
      'could not build second mix-history condo');
    const second = dayClose(state, config);
    const history = tenantMixHistory(state, config);
    assert(history.length === 2 && history[0].day === first.day && history[1].day === second.day,
      'tenant mix history did not retain recent day snapshots');
    assert(history[1].balance > history[0].balance,
      'tenant mix history did not show movement toward target shares');
    assert(tenantMixSnapshot(state, config).balance === second.tenantMix.balance,
      'tenant mix snapshot did not match the day-close record');
  },

  'tenant mix diagnosis identifies the largest gap without changing state'() {
    const config = structuredClone(CONFIG);
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 130);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok,
      'could not build mix-diagnosis office');
    const before = JSON.stringify(state);
    const diagnosis = tenantMixDiagnosis(state, config);
    assert(diagnosis.focus?.kind === 'condo' && diagnosis.focus.direction === 'under' &&
      diagnosis.under.kind === 'condo' && diagnosis.over.kind === 'office',
      'tenant mix diagnosis did not identify the largest under- and over-supplied types');
    assert(diagnosis.trend === 'new' && diagnosis.historyDays === 0 && JSON.stringify(state) === before,
      'tenant mix diagnosis changed state or invented history');
  },

  'tenant mix response suggests conversion only for a vacant over-supplied room'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.stars.tiers[1].pop = 0;
    const state = boot(config, 131);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok,
      'could not build over-supply response fixture');
    const vacantOffice = state.units[1];
    vacantOffice.occupied = false;
    vacantOffice.vacantDays = 1;
    const response = tenantMixResponse(state, config);
    assert(response.build?.kind === 'condo' && response.convert?.fromKind === 'office' &&
      response.convert.toKind === 'condo' && response.convert.key === 'convert' &&
      response.convert.unitId === vacantOffice.id && response.convert.occupied === false,
      'tenant mix response did not offer a guarded over-supply conversion review');
  },

  'reputation history exposes the transport outcomes behind the trend'() {
    const config = structuredClone(CONFIG);
    const state = boot(config, 122);
    state.log = [
      { day: 1, rep: 100, deliveryRate: 100, avgWait: 0, abandoned: 0, trips: 10 },
      { day: 2, rep: 82, deliveryRate: 75, avgWait: 8, abandoned: 1, trips: 4 },
      { day: 3, rep: 64, deliveryRate: 50, avgWait: 20, abandoned: 2, trips: 4 },
      { day: 4, rep: 45, deliveryRate: 25, avgWait: 40, abandoned: 3, trips: 4 },
    ];
    const history = reputationHistory(state, config);
    assert(history.length === config.occupancy.reputationWindow && history[0].day === 2 && history.at(-1).day === 4,
      'reputation history did not use the configured recent window');
    assert(history.at(-1).reputation === 45 && history.at(-1).deliveryRate === 25 &&
      history.at(-1).avgWait === 40 && history.at(-1).abandoned === 3,
      'reputation history did not preserve the transport causes');
  },

  'reputation recommendation points to a concrete transport improvement'() {
    const config = structuredClone(CONFIG);
    const state = boot(config, 123);
    assert(reputationRecommendation(state, config).key === 'observe',
      'empty reputation history did not ask the player to observe a day');
    state.log = [{ rep: 45, deliveryRate: 60, avgWait: 18, abandoned: 2, trips: 10 }];
    assert(reputationRecommendation(state, config).key === 'shaft',
      'poor reputation without shafts did not recommend a shaft');
    assert(reputationRecommendation(state, config).control === 'shaft',
      'shaft recommendation did not identify its build control');
    state.shafts = [{ cars: [{}, {}] }];
    state.money = 0;
    assert(reputationRecommendation(state, config).key === 'budget',
      'unaffordable elevator car did not recommend saving for it');
    assert(reputationRecommendation(state, config).control === 'car',
      'car budget recommendation did not identify its build control');
    state.money = config.costs.car;
    assert(reputationRecommendation(state, config).key === 'car',
      'long waits did not recommend another elevator car');
    state.shafts[0].cars.push({});
    assert(reputationRecommendation(state, config).key === 'lobby',
      'a route without a lobby did not recommend the required entrance');
    state.lobby = { slot: 0, slots: [0] };
    assert(reputationRecommendation(state, config).key === 'route',
      'a shaft at its car limit did not recommend route capacity');
    state.log = [{ rep: 80, deliveryRate: 75, avgWait: 2, abandoned: 0, trips: 10 }];
    assert(reputationRecommendation(state, config).key === 'route',
      'undelivered trips without long waits did not recommend coverage');
    state.money = 0;
    assert(reputationRecommendation(state, config).key === 'budget',
      'unaffordable route did not recommend saving for it');

    const lockedConfig = structuredClone(CONFIG);
    lockedConfig.stars.tiers[0].unlocks = lockedConfig.stars.tiers[0].unlocks.filter((item) => item !== 'shaft');
    const locked = boot(lockedConfig, 124);
    locked.log = [{ rep: 45, deliveryRate: 60, avgWait: 18, abandoned: 2, trips: 10 }];
    assert(reputationRecommendation(locked, lockedConfig).key === 'locked',
      'locked shaft was still recommended as immediately buildable');

    const blocked = boot(config, 125);
    blocked.log = [{ rep: 45, deliveryRate: 60, avgWait: 18, abandoned: 2, trips: 10 }];
    blocked.money = 100000;
    for (let slot = 0; slot < config.building.slotsPerFloor; slot++) {
      blocked.facilities.push({ floor: 0, slot });
      for (let floor = 1; floor < blocked.floors; floor++) blocked.units.push({ floor, slot });
    }
    assert(reputationRecommendation(blocked, config).key === 'placement',
      'blocked shaft columns did not produce a placement warning');
  },

  'vacancy lease status identifies the active refill gate'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 121);
    const built = applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config);
    assert(built.ok, built.reason);
    const unit = state.units[0];
    unit.occupied = false;
    unit.vacantDays = 0;
    assert(leaseStatus(state, unit, config).key === 'market_delay',
      'new vacancy did not report its market delay');
    unit.vacantDays = config.units.office.relistDays;
    assert(leaseStatus(state, unit, config).key === 'evaluation',
      'unserved vacancy did not report its evaluation gate');
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not add lease-status access');
    assert(leaseStatus(state, unit, config).key === 'ready',
      'viable vacancy did not report ready to lease');
    state.log.push({ rep: config.occupancy.relistMinDeliveryRate - 1 });
    assert(leaseStatus(state, unit, config).key === 'reputation',
      'poor reputation did not report its refill gate');
  },

  'vacancy recovery comparison explains timing and reputation gates'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 122);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build recovery-comparison shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
      'could not build recovery-comparison office');
    const unit = state.units[0];
    unit.occupied = false;
    unit.renovated = true;
    unit.vacantDays = 0;
    const timing = vacancyRecoveryComparison(state, unit, config, 100);
    assert(timing.recommendation.key === 'wait' && timing.marketDaysRemaining > 0 &&
      timing.options[0].blockers.includes('market timing') &&
      timing.options[0].marketDaysRemaining === timing.marketDaysRemaining,
      'recovery comparison did not explain the current market delay');

    unit.vacantDays = config.units.office.relistDays;
    const poor = vacancyRecoveryComparison(state, unit, config,
      config.occupancy.relistMinDeliveryRate - 1);
    assert(poor.recommendation.key === 'reputation' && !poor.reputationReady &&
      poor.reputationGap === 1 && poor.options[0].blockers.includes('reputation') &&
      poor.recommendation.detail.includes('Spending now will not fill the room'),
      'recovery comparison did not explain the reputation gate before spending');
  },

  'demolition removes a vacant room and frees its floor slot'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 116);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
      'could not build office');
    const unit = state.units[0];
    unit.occupied = false;
    const recovery = vacancyRecoveryComparison(state, unit, config, 100);
    const demolition = recovery.options.find((option) => option.key === 'demolish');
    assert(demolition?.lastResort && demolition.freedFloorSpace.floor === unit.floor &&
      demolition.freedFloorSpace.slot === unit.slot && demolition.detail.includes('permanent') &&
      demolition.detail.includes('for a new room') && demolition.dailyIncome === 0 &&
      demolition.dailyIncomeDelta === -config.units.office.rent,
      'vacancy recovery did not expose demolition as a permanent last resort');
    const money = state.money;

    const result = applyAction(state, { type: 'demolish_unit', id: unit.id }, config);
    assert(result.ok, result.reason);
    assert(state.units.length === 0 && !slotsUsed(state, 3).has(1),
      'demolition did not remove the room or free its slot');
    assert(state.money === money - config.costs.demolition,
      'demolition did not charge the configured fee');
    assert(state.events.at(-1).kind === 'demolished' && state.events.at(-1).unitKind === 'office',
      'demolition event was not recorded');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3, slot: 1 }, config).ok,
      'freed room slot could not be reused');
  },

  'demolition refuses occupied rooms and unaffordable rooms'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 117);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build office');
    const unit = state.units[0];
    const occupied = applyAction(state, { type: 'demolish_unit', id: unit.id }, config);
    assert(!occupied.ok && occupied.reason === 'room is occupied',
      'occupied room was demolished');
    unit.occupied = false;
    state.money = config.costs.demolition - 1;
    const poor = applyAction(state, { type: 'demolish_unit', id: unit.id }, config);
    assert(!poor.ok && poor.reason === 'not enough money' && state.units.length === 1,
      'unaffordable demolition changed the room');
  },

  'converting a vacant room changes its tenant profile without filling it'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 114);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    for (let slot = 1; slot <= 7; slot++) {
      assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1, slot }, config).ok,
        'could not build lower office');
    }
    for (let slot = 1; slot <= 4; slot++) {
      assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 2, slot }, config).ok,
        'could not build upper office');
    }
    const unit = state.units[0];
    unit.occupied = false;
    unit.vacantDays = 3;
    unit.renovated = true;
    assert(population(state) >= config.stars.tiers[1].pop,
      'fixture did not unlock condos');
    const money = state.money;
    const preview = conversionPreview(state, unit, 'condo', config);
    const recovery = vacancyRecoveryComparison(state, unit, config, 100);
    assert(preview.fromCapacity === config.units.office.workers && preview.toCapacity === config.units.condo.residents &&
      preview.currentShare === 0 && preview.projectedShare > preview.currentShare &&
      preview.targetShare === config.units.condo.targetShare &&
      Number.isFinite(preview.fromDemandQuality.score) && Number.isFinite(preview.toDemandQuality.score) &&
      preview.fromDailyIncome === config.units.office.rent && preview.toDailyIncome === config.units.condo.rent &&
      preview.dailyIncomeDelta === config.units.condo.rent - config.units.office.rent &&
      preview.toMarketDemandBonus > preview.fromMarketDemandBonus && preview.demandBonusDelta > 0 &&
      recovery.recommendation.key === 'rerent' && recovery.options.some((option) =>
        option.key === 'convert' && option.kind === 'condo' && option.marketBonus === preview.toMarketDemandBonus &&
        option.dailyIncome === preview.toDailyIncome && option.dailyIncomeDelta === preview.dailyIncomeDelta),
      'conversion preview did not project the target tenant mix');

    const result = applyAction(state, { type: 'convert_unit', id: unit.id, kind: 'condo' }, config);
    assert(result.ok, result.reason);
    assert(unit.kind === 'condo' && unit.heads === config.units.condo.residents,
      'conversion did not change the tenant profile');
    assert(unit.rent === config.units.condo.rent && unit.rentLevel === 0,
      'conversion did not apply target rent');
    assert(!unit.occupied && unit.vacantDays === 0 && !unit.renovated,
      'conversion did not leave a fresh vacant room');
    assert(state.money === money - config.costs.conversion,
      'conversion did not charge the configured fee');
    assert(state.events.at(-1).kind === 'converted' && state.events.at(-1).fromKind === 'office' &&
      state.events.at(-1).unitKind === 'condo', 'conversion event was not recorded');
  },

  'conversion requires a vacant room and an unlocked target type'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 115);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build office');
    const unit = state.units[0];
    const occupied = applyAction(state, { type: 'convert_unit', id: unit.id, kind: 'condo' }, config);
    assert(!occupied.ok && occupied.reason === 'room is occupied',
      'occupied room was converted');
    unit.occupied = false;
    const locked = applyAction(state, { type: 'convert_unit', id: unit.id, kind: 'condo' }, config);
    assert(!locked.ok && locked.reason === 'condo is locked',
      'locked target type was converted');
  },

  'renovating an abandoned room raises evaluation without re-renting it'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 110);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build office');
    const unit = state.units[0];
    unit.occupied = false;
    const before = unitEvaluation(state, unit, config);
    const money = state.money;

    const result = applyAction(state, { type: 'renovate_unit', id: unit.id }, config);
    assert(result.ok, result.reason);
    const after = unitEvaluation(state, unit, config);
    assert(unit.renovated && !unit.occupied, 'renovation changed tenant occupancy');
    assert(after.score > before.score && after.renovationBonus === config.evaluation.renovationBonus,
      'renovation did not improve room evaluation');
    assert(state.money === money - config.costs.renovation, 'renovation did not charge the configured fee');
    assert(state.events.at(-1).kind === 'renovated', 'renovation event was not recorded');
  },

  'renovation is limited to one upgrade on a vacant room'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 113);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build office');
    const unit = state.units[0];
    const occupied = applyAction(state, { type: 'renovate_unit', id: unit.id }, config);
    assert(!occupied.ok && occupied.reason === 'room is occupied',
      'occupied room was renovated');
    unit.occupied = false;
    assert(applyAction(state, { type: 'renovate_unit', id: unit.id }, config).ok,
      'vacant room could not be renovated');
    const repeated = applyAction(state, { type: 'renovate_unit', id: unit.id }, config);
    assert(!repeated.ok && repeated.reason === 'room is already renovated',
      'room accepted a second renovation');
  },

  'an abandoned room can be inspected and re-rented when viable'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 111);
    assert(applyAction(state, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build shaft');
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build office');
    const unit = state.units[0];
    unit.occupied = false;
    unit.vacantDays = 4;
    const evaluation = unitEvaluation(state, unit, config);
    assert(evaluation.score >= config.evaluation.relistMinScore,
      'fixture room was not viable for re-renting');
    const money = state.money;
    const movedInBefore = state.today.movedIn;

    const result = applyAction(state, { type: 'rerent_unit', id: unit.id }, config);
    assert(result.ok, result.reason);
    assert(unit.occupied && unit.vacantDays === 0 && unit.stress === 0,
      're-rent did not reset the tenant lifecycle state');
    assert(state.money === money - config.costs.rerent, 're-rent did not charge the configured fee');
    assert(state.today.movedIn === movedInBefore + 1, 're-rent did not count the replacement tenant');
    assert(state.events.at(-1).kind === 'rerented', 're-rent event was not recorded');
  },

  'a room without elevator access cannot be re-rented yet'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    const state = boot(config, 112);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build office');
    const unit = state.units[0];
    unit.occupied = false;
    const money = state.money;
    const result = applyAction(state, { type: 'rerent_unit', id: unit.id }, config);
    assert(!result.ok && result.reason === 'room evaluation is too low to re-rent',
      'inaccessible room was re-rented');
    assert(!unit.occupied && state.money === money, 'failed re-rent changed room or money');
  },

  'room appeal and transport stress departures are logged separately'() {
    const config = structuredClone(CONFIG);
    config.economy.startMoney = 100000;
    config.occupancy.desirabilityRetentionThreshold = 100;
    config.occupancy.desirabilityRetentionPressureWeight = 2;
    config.occupancy.desirabilityRetentionVacateAt = 1;
    config.occupancy.desirabilityRetentionRecovery = 0;

    const appealState = boot(config, 121);
    assert(applyAction(appealState, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build appeal-retention shaft');
    assert(applyAction(appealState, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build appeal-retention office');
    const appealClosed = dayClose(appealState, config);
    const appealExit = appealState.events.filter((event) => event.kind === 'vacated').at(-1);
    assert(appealClosed.vacatedByDesirability === 1 && appealClosed.vacatedByStress === 0 &&
      appealClosed.retention.rooms === 1 && appealClosed.retention.averagePressure === 1 &&
      appealClosed.retention.vacatedByDesirability === 1 && appealExit.cause === 'room_desirability' &&
      Number.isFinite(appealExit.desirabilityScore) && appealExit.desirabilityPressure === 1,
      'room appeal departure was not logged separately from transport stress');

    const stressState = boot(config, 122);
    assert(applyAction(stressState, { type: 'build_shaft', bottom: 0, top: 3 }, config).ok,
      'could not build stress-retention shaft');
    assert(applyAction(stressState, { type: 'build_unit', kind: 'office', floor: 3 }, config).ok,
      'could not build stress-retention office');
    stressState.units[0].stress = config.units.office.vacateAt + config.units.office.stressDecay + 1;
    const stressClosed = dayClose(stressState, config);
    const stressExit = stressState.events.filter((event) => event.kind === 'vacated').at(-1);
    assert(stressClosed.vacatedByStress === 1 && stressClosed.vacatedByDesirability === 0 &&
      stressExit.cause === 'transport_stress',
      'transport stress departure was not kept distinct from room appeal');
  },

  'service facilities add daily operating costs to the budget'() {
    const config = structuredClone(CONFIG);
    const bare = boot(config, 123);
    const serviced = boot(config, 124);
    serviced.facilities.push({ kind: 'food', floor: 1, slot: 1 });
    const bareClose = dayClose(bare, config);
    const servicedClose = dayClose(serviced, config);
    const expected = config.services.food.dailyUpkeep;
    assert(servicedClose.serviceUpkeep === expected &&
      servicedClose.upkeep - bareClose.upkeep === expected &&
      servicedClose.net - bareClose.net === -expected,
      'service facility operating cost was not charged at day close');
  },
};
