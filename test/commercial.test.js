import { CONFIG } from '../src/games/lift/config.js';
import { boot, applyAction } from '../src/games/lift/sim/index.js';
import { scheduleDay, shopsForOffice } from '../src/games/lift/sim/demand.js';
import { rememberShopTrafficFollowup, shopTrafficEstimate, shopTrafficFollowupCountAccessibleLabel, shopTrafficFollowupCountLabel, shopTrafficFollowupFilterAccessibleLabel, shopTrafficFollowupFilterButtonLabel, shopTrafficFollowupFilterLabel, shopTrafficFollowupOutcome, shopTrafficFollowupResult, shopTrafficFollowupScopeAccessibleLabel, shopTrafficFollowupScopeLabel, shopTrafficFollowupScoreAccessibleLabel, shopTrafficFollowupScoreDetail, shopTrafficFollowupStatus, shopTrafficFollowupSummary, shopTrafficFollowupSummaryHeading, shopTrafficFollowupWindow, shopTrafficHistory, shopTrafficLastCloseAggregate, shopTrafficLastCloseDetail, shopTrafficLastCloseRevenueDetail, shopTrafficPeriodsAccessibleLabel, shopTrafficPeriodsHeading, shopTrafficPeriodsHeadingAccessibleLabel, shopTrafficPeriodsLegendLabel, shopTrafficResponseFilterId, shopTrafficServedDelta, shopTrafficServedTodayDetail, shopTrafficTenantMixPreview, vacancyRecoveryComparison } from '../src/games/lift/sim/evaluation.js';
import { dayClose } from '../src/games/lift/sim/economy.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

function unlockedShopConfig() {
  const config = structuredClone(CONFIG);
  config.building.startFloors = 4;
  config.economy.startMoney = 10000000;
  config.building.startFloors = 6;
  config.stars.tiers[0].unlocks.push('shop');
  config.demand.lunchTripRate = 1;
  config.demand.shopCatchmentFloors = 3;
  return config;
}

export const tests = {
  'shop lunch demand uses a local floor catchment'() {
    const config = unlockedShopConfig();
    const nearState = boot(config, 601);
    // The catchment is a floor distance, so the shop has to be four storeys up
    // — and something has to hold it there. A shaft column is the cheapest
    // honest support: it carries the floors without adding a tenant that would
    // change the office count this test is measuring.
    assert(applyAction(nearState, { type: 'build_shaft', bottom: 0, top: 5, slot: 0 }, config).ok,
      'could not build near catchment shaft');
    assert(applyAction(nearState, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok,
      'could not build near office');
    assert(applyAction(nearState, { type: 'build_unit', kind: 'shop', floor: 4 }, config).ok,
      'could not build near shop');
    const nearOffice = nearState.units.find((u) => u.kind === 'office');
    assert(shopsForOffice(nearState, nearOffice, config).length === 1,
      'near shop was not in the office catchment');
    scheduleDay(nearState, config);
    assert(nearState.schedule.some((trip) => trip.kind === 'lunch_out'),
      'near shop did not create lunch demand');

    const farState = boot(config, 602);
    assert(applyAction(farState, { type: 'build_shaft', bottom: 0, top: 5, slot: 0 }, config).ok,
      'could not build far catchment shaft');
    assert(applyAction(farState, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok,
      'could not build far office');
    assert(applyAction(farState, { type: 'build_unit', kind: 'shop', floor: 5 }, config).ok,
      'could not build far shop');
    const farOffice = farState.units.find((u) => u.kind === 'office');
    assert(shopsForOffice(farState, farOffice, config).length === 0,
      'far shop incorrectly entered the office catchment');
    scheduleDay(farState, config);
    assert(!farState.schedule.some((trip) => trip.kind === 'lunch_out'),
      'far shop still created out-of-range lunch demand');
  },

  'shop recovery income separates base rent from expected customer revenue'() {
    const config = unlockedShopConfig();
    const state = boot(config, 603);
    assert(applyAction(state, { type: 'build_unit', kind: 'office', floor: 1 }, config).ok &&
      applyAction(state, { type: 'build_unit', kind: 'office', floor: 2 }, config).ok,
      'could not build shop-income offices');
    const vacancy = state.units[1];
    vacancy.occupied = false;
    const fullEstimate = shopTrafficEstimate(state, { ...vacancy, kind: 'shop' }, config, 100);
    const lowEstimate = shopTrafficEstimate(state, { ...vacancy, kind: 'shop' }, config, 50);
    const comparison = vacancyRecoveryComparison(state, vacancy, config, 100);
    const shop = comparison.options.find((option) => option.key === 'convert' && option.kind === 'shop');
    const expectedTraffic = Math.round(config.units.office.workers * config.demand.lunchTripRate * config.units.shop.revenuePerCustomer);
    assert(fullEstimate.potentialCustomers === config.units.office.workers && fullEstimate.expectedCustomers === expectedTraffic / config.units.shop.revenuePerCustomer &&
      fullEstimate.deliveryFactor === 1 && lowEstimate.expectedCustomers === Math.round(fullEstimate.potentialCustomers * 0.5) &&
      shop && shop.dailyRent === config.units.shop.rent && shop.variableRevenue === expectedTraffic &&
      shop.potentialVariableRevenue === expectedTraffic && shop.deliveryFactor === 1 &&
      shop.dailyIncome === config.units.shop.rent + expectedTraffic &&
      shop.dailyIncomeDelta === config.units.shop.rent + expectedTraffic - config.units.office.rent,
      'shop recovery did not separate base rent from traffic revenue');

    const unreliable = vacancyRecoveryComparison(state, vacancy, config, 50);
    const unreliableShop = unreliable.options.find((option) => option.key === 'convert' && option.kind === 'shop');
    assert(unreliableShop?.deliveryFactor === 0.5 && unreliableShop.variableRevenue === Math.round(expectedTraffic * 0.5) &&
      unreliableShop.potentialVariableRevenue === expectedTraffic,
      'shop recovery did not reduce traffic revenue when delivery reliability fell');
  },

  'closed day records realized traffic for each shop'() {
    const config = unlockedShopConfig();
    const state = boot(config, 604);
    assert(applyAction(state, { type: 'build_unit', kind: 'shop', floor: 1 }, config).ok,
      'could not build realized-income shop');
    const shop = state.units[0];
    shop.servedToday = 4;
    state.today.shopRevenue = 4 * config.units.shop.revenuePerCustomer;
    const closed = dayClose(state, config);
    const record = closed.shopTraffic.find((entry) => entry.unitId === shop.id);
    assert(record?.served === 4 && record.revenue === 4 * config.units.shop.revenuePerCustomer &&
      record.potentialCustomers === 0 && record.deliveryFactor === 1 && shop.servedToday === 0,
      'closed day did not preserve realized shop traffic before resetting the counter');
  },

  'shop traffic last-close aggregate follows the current shop scope'() {
    const state = {
      log: [
        { day: 1, shopTraffic: [{ unitId: 1, served: 2, revenue: 200 }] },
        { day: 2, shopTraffic: [
          { unitId: 1, served: 4, revenue: 400 },
          { unitId: 2, served: 3, revenue: 300 },
        ] },
      ],
    };
    const aggregate = shopTrafficLastCloseAggregate(state, [{ id: 1 }]);
    assert(aggregate?.day === 2 && aggregate.shops === 1 && aggregate.served === 4 && aggregate.revenue === 400,
      'shop last-close aggregate did not follow the current shop scope');
    assert(shopTrafficLastCloseAggregate(state, [{ id: 9 }]) === null,
      'shop last-close aggregate invented history for an unmatched shop');
    assert(shopTrafficServedDelta(7, 4) === 3 &&
      shopTrafficServedDelta(4, 7) === -3 &&
      shopTrafficServedDelta('bad', 2) === -2,
      'shop served delta did not compare live and historical totals');
  },

  'shop traffic history stays bounded and identifies sustained direction'() {
    const config = unlockedShopConfig();
    config.occupancy.shopTrafficHistoryDays = 2;
    const state = { log: [
      { day: 1, shopTraffic: [{ unitId: 7, served: 6, potentialCustomers: 6, deliveryFactor: 1 }] },
      { day: 2, shopTraffic: [{ unitId: 7, served: 4, potentialCustomers: 6, deliveryFactor: 0.7 }] },
      { day: 3, shopTraffic: [{ unitId: 7, served: 2, potentialCustomers: 6, deliveryFactor: 0.5 }] },
    ] };
    const history = shopTrafficHistory(state, 7, config);
    assert(history.entries.length === 2 && history.entries[0].day === 2 && history.entries[1].day === 3 &&
      history.direction === 'falling' && history.delta === -2 && history.cause === 'service' &&
      history.nextAction.includes('elevator') && history.label.includes('falling 2'),
      'shop traffic history did not stay bounded or explain sustained decline');

    const demandHistory = shopTrafficHistory({ log: [
      { day: 1, shopTraffic: [{ unitId: 7, served: 6, potentialCustomers: 6, deliveryFactor: 1 }] },
      { day: 2, shopTraffic: [{ unitId: 7, served: 2, potentialCustomers: 2, deliveryFactor: 1 }] },
    ] }, 7, config);
    assert(demandHistory.cause === 'demand' && demandHistory.causeLabel.includes('local office') &&
      demandHistory.nextAction.includes('tenant mix'),
      'shop traffic history did not identify local-demand decline');
  },

  'shop traffic tenant-mix preview prices a nearby office and forecasts its gain'() {
    const config = unlockedShopConfig();
    const state = boot(config, 605);
    assert(applyAction(state, { type: 'build_unit', kind: 'shop', floor: 1 }, config).ok,
      'could not build tenant-mix preview shop');
    const shop = state.units.find((unit) => unit.kind === 'shop');
    config.demand.shopCatchmentFloors = 1;
    const preview = shopTrafficTenantMixPreview(state, shop, config, 100);
    assert(preview.available && preview.placementFloor === shop.floor && preview.cost === config.costs.office &&
      preview.potentialCustomersDelta === config.units.office.workers &&
      preview.expectedCustomersDelta === config.units.office.workers &&
      preview.expectedRevenueDelta === config.units.office.workers * config.units.shop.revenuePerCustomer,
      'shop tenant-mix preview did not show the nearby-office cost and demand gain');
    const hoveredPreview = shopTrafficTenantMixPreview(state, shop, config, 100, shop.floor + 2);
    assert(hoveredPreview.available && hoveredPreview.placementFloor === shop.floor + 2 &&
      hoveredPreview.expectedCustomersDelta === 0 && hoveredPreview.expectedRevenueDelta === 0,
      'shop tenant-mix preview did not follow a hovered open floor or show its demand tradeoff');
  },

  'shop traffic followup compares the first closed day with the office forecast'() {
    const followup = {
      shopId: 12,
      builtDay: 4,
      beforeExpectedCustomers: 0,
      beforeExpectedRevenue: 0,
      forecastExpectedCustomers: 6,
    };
    const result = shopTrafficFollowupResult(followup, {
      day: 5,
      shopTraffic: [{ unitId: 12, served: 4, revenue: 400, expectedCustomers: 6, expectedRevenue: 600 }],
    });
    assert(result?.served === 4 && result.revenue === 400 && result.servedDelta === 4 && result.revenueDelta === 400 && result.forecastGap === -2,
      'shop traffic followup did not compare realized traffic with the forecast');
    assert(shopTrafficFollowupOutcome({ result }).key === 'both' &&
      shopTrafficFollowupOutcome({}).key === 'pending',
      'shop traffic followup did not distinguish customer and revenue outcomes');
    assert(shopTrafficFollowupResult(result ? { ...followup, result } : followup, { day: 6, shopTraffic: [] }) === null,
      'shop traffic followup did not stop after its first closed day');
    const bounded = [1, 2, 3, 4].map((id) => ({ shopId: id }));
    const retained = rememberShopTrafficFollowup(bounded.slice(0, 3), bounded[3], 3);
    assert(retained.length === 3 && retained[0].shopId === 2 && retained[2].shopId === 4,
      'shop traffic followup history did not stay bounded');
    assert(shopTrafficFollowupStatus({ result: { forecastGap: 0 } }).key === 'success' &&
      shopTrafficFollowupStatus({ result: { forecastGap: -1 } }).key === 'underperforming' &&
      shopTrafficFollowupStatus({}).key === 'pending',
      'shop traffic followup status did not distinguish outcome states');
    const summary = shopTrafficFollowupSummary([
      { result: { forecastGap: 2, served: 8, expectedCustomers: 6, revenue: 800, expectedRevenue: 600 } },
      { result: { forecastGap: -4, served: 2, expectedCustomers: 6, revenue: 200, expectedRevenue: 600 } },
      {},
    ]);
    assert(summary.completed === 2 && summary.successful === 1 && summary.successRate === 50 &&
      summary.averageForecastGap === -1 && summary.pending === 1 &&
      summary.realizedCustomers === 10 && summary.forecastCustomers === 12 && summary.customerForecastGap === -2 &&
      summary.realizedRevenue === 1000 && summary.forecastRevenue === 1200 && summary.revenueForecastGap === -200,
      'shop traffic followup summary did not calculate success rate, gap, and totals');
    assert(shopTrafficResponseFilterId(12, [{ id: 12 }]) === 12 &&
      shopTrafficResponseFilterId(12, [{ id: 9 }]) === null &&
      shopTrafficResponseFilterId(null, [{ id: 12 }]) === null,
      'shop traffic response filter did not clear stale shops');
    assert(shopTrafficFollowupScoreDetail(summary).includes('1 of 2 completed responses') &&
      shopTrafficFollowupScoreDetail({ total: 1, completed: 0, pending: 1 }).includes('pending outcomes are excluded'),
      'shop traffic response score detail did not explain its count');
    const emptyWindow = shopTrafficFollowupWindow([], 3);
    const fullWindow = shopTrafficFollowupWindow([1, 2, 3, 4], 3);
    assert(emptyWindow.label === '0/3 retained' && !emptyWindow.full && emptyWindow.statusLabel === 'collecting' &&
      fullWindow.retained === 3 && fullWindow.full && fullWindow.label === '3/3 retained' &&
      fullWindow.statusLabel.includes('oldest results roll off') &&
      fullWindow.retentionNote.includes('short-lived diagnostic period') &&
      fullWindow.retentionNote.includes('not a permanent shop ledger'),
      'shop traffic response window did not distinguish empty and full history');
    assert(shopTrafficFollowupCountLabel({ total: 0 }) === 'history: 0 responses' &&
      shopTrafficFollowupCountLabel({ total: 1 }) === 'history: 1 response' &&
      shopTrafficFollowupCountLabel({ total: 4 }) === 'history: 4 responses',
      'shop traffic response count label did not stay distinct from outcome score');
    assert(shopTrafficServedTodayDetail(4).includes('4 customers served so far today') &&
      shopTrafficServedTodayDetail(4).includes('resets at day close') &&
      shopTrafficServedTodayDetail(4).includes('separate from retained response history'),
      'shop served-today detail did not explain its daily reset');
    assert(shopTrafficServedTodayDetail(4, { floor: 2 }).includes('for F2 shop'),
      'shop served-today detail did not expose its shop scope');
    assert(shopTrafficLastCloseDetail({ served: 4 }).includes('last close (historical): 4 served') &&
      shopTrafficLastCloseDetail({ served: 4 }).includes('separate from live served today') &&
      shopTrafficLastCloseDetail({ served: 4 }, { floor: 2 }).includes('last close (historical) for F2 shop: 4 served'),
      'shop last-close detail did not distinguish historical traffic');
    assert(shopTrafficLastCloseRevenueDetail({ floor: 2 }).includes('historical revenue for F2 shop at last close') &&
      shopTrafficLastCloseRevenueDetail({ floor: 2 }).includes('separate from live daily revenue'),
      'shop last-close revenue detail did not expose its time context');
    assert(shopTrafficPeriodsAccessibleLabel({ floor: 2 }, true).includes('time comparison for F2 shop') &&
      shopTrafficPeriodsAccessibleLabel({ floor: 2 }, true).includes('previous closed day') &&
      shopTrafficPeriodsAccessibleLabel(null, false).includes('will appear after the first day closes'),
      'shop traffic periods did not expose the today/history relationship');
    assert(shopTrafficPeriodsHeading(true) === 'today vs last close' &&
      shopTrafficPeriodsHeading(false).includes('last close pending'),
      'shop traffic periods did not provide a visible current/history heading');
    assert(shopTrafficPeriodsHeadingAccessibleLabel(true).includes('current versus historical traffic period') &&
      shopTrafficPeriodsHeadingAccessibleLabel(false).includes('last close pending'),
      'shop traffic heading did not expose its accessible time context');
    assert(shopTrafficPeriodsLegendLabel() === 'today vs last close',
      'shop traffic periods did not provide a reusable legend label');
    assert(shopTrafficFollowupScopeLabel(null) === 'all shops' &&
      shopTrafficFollowupScopeLabel({ floor: 2 }) === 'F2 shop',
      'shop response summary did not label all-shop and selected-shop scopes');
    assert(shopTrafficFollowupScopeAccessibleLabel(null) === 'response summary scope: all shops' &&
      shopTrafficFollowupScopeAccessibleLabel({ floor: 2 }) === 'response summary filtered scope: F2 shop',
      'shop response summary scope did not expose accessible wording');
    assert(shopTrafficFollowupFilterLabel(null, []) === 'all shops · 0 responses' &&
      shopTrafficFollowupFilterLabel({ floor: 2 }, [{ shopId: 2 }]) === 'F2 shop · 1 response' &&
      shopTrafficFollowupFilterLabel({ floor: 2 }, [{ shopId: 2 }, { shopId: 2 }]) === 'F2 shop · 2 responses',
      'shop response filter label did not expose retained counts');
    assert(shopTrafficFollowupFilterAccessibleLabel(null, []) === 'show response history for all shops; 0 retained responses' &&
      shopTrafficFollowupFilterAccessibleLabel({ floor: 2 }, [{ shopId: 2 }]) === 'show response history for F2 shop; 1 retained response',
      'shop response filter did not expose accessible scope and count');
    assert(shopTrafficFollowupFilterButtonLabel(null, [], true) === 'selected: all shops · 0 responses' &&
      shopTrafficFollowupFilterButtonLabel({ floor: 2 }, [{ shopId: 2 }], true) === 'selected: F2 shop · 1 response',
      'shop response filter button did not show its selected state');
    assert(shopTrafficFollowupSummaryHeading(null) === 'response summary · all shops' &&
      shopTrafficFollowupSummaryHeading({ floor: 2 }) === 'response summary · filtered · F2 shop',
      'shop response summary did not mark filtered scope');
    assert(shopTrafficFollowupScoreAccessibleLabel({ floor: 2 }, summary).startsWith('response score for F2 shop: ') &&
      shopTrafficFollowupScoreAccessibleLabel({ floor: 2 }, summary).includes('1 of 2 completed responses'),
      'shop response score did not expose its shop scope');
    assert(shopTrafficFollowupCountAccessibleLabel({ floor: 2 }, []).includes('response history for F2 shop: 0 retained responses') &&
      shopTrafficFollowupCountAccessibleLabel({ floor: 2 }, [{ shopId: 2 }], 3).includes('1 retained response; latest 3 response records'),
      'shop response history did not expose its shop scope');
  },
};
