/** Shaft/car/route recommendation engine — the elevator-throughput diagnostics. */
import { slotsUsed, unlocked } from '../state.js';
import { escalatorAccessSeconds, localRouteOccupancy, stairAccessSeconds } from '../demand.js';
import { tenantLoadStatus } from './room.js';

/** Describe which other shaft routes share floors with one shaft. */
export function shaftRouteCoverageLabel(shaft, shafts = []) {
  if (!shaft || !Array.isArray(shafts)) return 'independent span';
  const bottom = Number(shaft.bottom);
  const top = Number(shaft.top);
  if (!Number.isFinite(bottom) || !Number.isFinite(top)) return 'independent span';
  const overlaps = shafts.map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate && candidate !== shaft)
    .map(({ candidate, index }) => ({
      index,
      bottom: Math.max(bottom, Number(candidate.bottom)),
      top: Math.min(top, Number(candidate.top)),
    }))
    .filter(({ bottom: overlapBottom, top: overlapTop }) =>
      Number.isFinite(overlapBottom) && Number.isFinite(overlapTop) && overlapBottom <= overlapTop)
    .map(({ index, bottom: overlapBottom, top: overlapTop }) =>
      'S' + (index + 1) + ' on floors ' + overlapBottom + '–' + overlapTop);
  return overlaps.length ? 'overlaps ' + overlaps.join('; ') : 'independent span';
}

/** Explain whether a proposed lobby-to-floor shaft adds or duplicates coverage. */
export function shaftCandidateCoverageLabel(bottom, top, shafts = []) {
  const candidateBottom = Number(bottom);
  const candidateTop = Number(top);
  if (!Number.isFinite(candidateBottom) || !Number.isFinite(candidateTop) || candidateTop < candidateBottom) {
    return 'coverage span unavailable';
  }
  const existing = Array.isArray(shafts)
    ? shafts.map((shaft, index) => ({ shaft, index }))
      .filter(({ shaft }) => shaft && Number.isFinite(Number(shaft.bottom)) && Number.isFinite(Number(shaft.top)))
    : [];
  const overlaps = existing.map(({ shaft, index }) => ({
    index,
    bottom: Math.max(candidateBottom, Number(shaft.bottom)),
    top: Math.min(candidateTop, Number(shaft.top)),
  })).filter(({ bottom: overlapBottom, top: overlapTop }) => overlapBottom <= overlapTop);
  const uncovered = [];
  for (let floor = candidateBottom; floor <= candidateTop; floor++) {
    if (!existing.some(({ shaft }) => Number(shaft.bottom) <= floor && Number(shaft.top) >= floor)) uncovered.push(floor);
  }
  const formatRanges = (floors) => {
    if (!floors.length) return '';
    const ranges = [];
    let start = floors[0];
    let end = start;
    for (const floor of floors.slice(1)) {
      if (floor === end + 1) end = floor;
      else {
        ranges.push(start === end ? String(start) : start + '–' + end);
        start = floor;
        end = floor;
      }
    }
    ranges.push(start === end ? String(start) : start + '–' + end);
    return ranges.join(', ');
  };
  if (!overlaps.length) return 'adds coverage on floors ' + formatRanges(uncovered);
  const overlapText = overlaps.map(({ index, bottom: overlapBottom, top: overlapTop }) =>
    'S' + (index + 1) + ' on floors ' + overlapBottom + '–' + overlapTop).join('; ');
  return uncovered.length
    ? 'overlaps ' + overlapText + ' and adds coverage on floors ' + formatRanges(uncovered)
    : 'duplicates existing coverage: overlaps ' + overlapText;
}

function floorRangeText(floors) {
  const values = [...new Set((floors ?? []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!values.length) return '';
  const ranges = [];
  let start = values[0];
  let end = start;
  for (const floor of values.slice(1)) {
    if (floor === end + 1) end = floor;
    else {
      ranges.push(start === end ? 'F' + start : 'F' + start + '–F' + end);
      start = floor;
      end = floor;
    }
  }
  ranges.push(start === end ? 'F' + start : 'F' + start + '–F' + end);
  return ranges.join(', ');
}

/** Compare a proposed shaft's route coverage with the floors creating demand. */
export function shaftCoverageDemandComparison(bottom, top, shafts = [], demandFloors = []) {
  const candidateBottom = Number(bottom);
  const candidateTop = Number(top);
  const pressure = [...new Set((demandFloors ?? []).map(Number)
    .filter((floor) => Number.isFinite(floor) && floor >= candidateBottom && floor > 0))].sort((a, b) => a - b);
  if (!Number.isFinite(candidateBottom) || !Number.isFinite(candidateTop) || candidateTop < candidateBottom) {
    return { key: 'invalid', pressure, added: [], overlap: [], coveredPressure: [], uncoveredPressure: [], label: 'coverage unavailable', detail: 'The proposed shaft span is not valid.' };
  }
  const floors = Array.from({ length: candidateTop - candidateBottom + 1 }, (_, index) => candidateBottom + index);
  const coveredByExisting = (floor) => (shafts ?? []).some((shaft) =>
    Number(shaft?.bottom) <= floor && Number(shaft?.top) >= floor);
  const overlap = floors.filter(coveredByExisting);
  const added = floors.filter((floor) => !coveredByExisting(floor));
  const coveredPressure = pressure.filter((floor) => floor <= candidateTop);
  const uncoveredPressure = pressure.filter((floor) => floor > candidateTop);
  const demandAdded = coveredPressure.filter((floor) => added.includes(floor));
  const demandOverlap = coveredPressure.filter((floor) => overlap.includes(floor));
  const key = uncoveredPressure.length
    ? 'misses_demand'
    : demandAdded.length
      ? 'adds_demand'
      : demandOverlap.length
        ? 'parallel_capacity'
        : added.length ? 'adds_coverage' : 'duplicate';
  const label = key === 'misses_demand'
    ? 'misses demand at ' + floorRangeText(uncoveredPressure)
    : key === 'adds_demand'
      ? 'adds pressure coverage at ' + floorRangeText(demandAdded)
      : key === 'parallel_capacity'
        ? 'parallel capacity on ' + floorRangeText(demandOverlap)
        : key === 'adds_coverage'
          ? 'adds coverage on ' + floorRangeText(added)
          : 'duplicate coverage only';
  const detail = pressure.length
    ? 'Demand floors: ' + floorRangeText(pressure) + '. ' + label + '.'
    : label + '.';
  return { key, pressure, added, overlap, coveredPressure, uncoveredPressure, label, detail };
}

/** Check whether a route preview can be placed with the current building. */
export function routePlacementStatus(kind, bottom, top, state, config, shaft = null, selectedSlot = null) {
  if (!state || !config) return { key: 'unknown', detail: 'placement cannot be checked yet' };
  const shafts = Array.isArray(state.shafts) ? state.shafts : [];
  if (kind === 'car') {
    if (!shaft) return { key: 'select', detail: 'hover a shaft to check placement' };
    const cars = Array.isArray(shaft.cars) ? shaft.cars : [];
    if (cars.length >= config.elevator.maxCarsPerShaft) {
      const alternateIndex = shafts.findIndex((candidate) => candidate !== shaft && (candidate.cars?.length ?? 0) < config.elevator.maxCarsPerShaft);
      return {
        key: 'blocked',
        detail: 'shaft is at its ' + config.elevator.maxCarsPerShaft + '-car limit',
        alternative: alternateIndex >= 0 ? 'try S' + (alternateIndex + 1) : 'build a new shaft for more capacity',
        alternativeAction: alternateIndex >= 0
          ? { kind: 'car', shaftId: shafts[alternateIndex].id }
          : { kind: 'shaft' },
      };
    }
    return { key: 'ready', detail: 'car can be added to this shaft' };
  }
  const candidateBottom = Number(bottom);
  const candidateTop = Number(top);
  const tune = kind === 'shaft' ? config.elevator : config[kind];
  if (!tune || !Number.isFinite(candidateBottom) || !Number.isFinite(candidateTop) || candidateTop <= candidateBottom) {
    return { key: 'invalid', detail: 'route must reach an upper floor', alternative: 'choose an upper floor' };
  }
  const span = candidateTop - candidateBottom + 1;
  if (span > tune.maxSpan) {
    return { key: 'invalid', detail: kind + ' span exceeds the ' + tune.maxSpan + '-floor limit', alternative: 'choose a shorter span' };
  }
  const candidateSlots = Number.isInteger(selectedSlot)
    ? [selectedSlot]
    : Array.from({ length: config.building.slotsPerFloor }, (_, slot) => slot);
  if (Number.isInteger(selectedSlot) && (selectedSlot < 0 || selectedSlot >= config.building.slotsPerFloor)) {
    return { key: 'invalid', detail: 'selected column is outside the building', alternative: 'choose a visible building column' };
  }
  const openSlot = candidateSlots
    .find((slot) => Array.from({ length: span }, (_, index) => candidateBottom + index)
      .every((floor) => !slotsUsed(state, floor).has(slot)));
  if (openSlot == null) {
    const carIndex = shafts.findIndex((candidate) => (candidate.cars?.length ?? 0) < config.elevator.maxCarsPerShaft);
    return {
      key: 'blocked',
      detail: Number.isInteger(selectedSlot)
        ? 'selected column is blocked across floors ' + candidateBottom + '–' + candidateTop
        : 'no clear column across floors ' + candidateBottom + '–' + candidateTop,
      alternative: carIndex >= 0 ? 'add a car to S' + (carIndex + 1) : 'free a route column',
      alternativeAction: carIndex >= 0
        ? { kind: 'car', shaftId: shafts[carIndex].id }
        : null,
    };
  }
  return { key: 'ready', slot: openSlot, detail: 'clear column available for placement' };
}

/** Report whether the shaft control has a full-span or shorter legal placement. */
export function shaftBuildControlStatus(state, config) {
  if (!state || !config) return { key: 'unknown', disabled: true, detail: 'shaft placement cannot be checked yet' };
  const bottom = config.building.lobbyFloor ?? 0;
  const maximumTop = Math.min(state.floors - 1, bottom + config.elevator.maxSpan - 1);
  if (maximumTop <= bottom) return { key: 'invalid', disabled: true, detail: 'shaft needs an upper floor' };

  const shaftCost = (top) => config.costs.shaft + config.costs.shaftPerFloor * (top - bottom + 1);
  const fullSpan = routePlacementStatus('shaft', bottom, maximumTop, state, config);
  if (fullSpan.key === 'ready') return { key: 'ready', disabled: false, top: maximumTop, cost: shaftCost(maximumTop), detail: 'place a new shaft' };

  // Prefer the longest shorter span so the control still points to the most
  // useful remaining placement when the top floor column is blocked.
  for (let top = maximumTop - 1; top > bottom; top--) {
    const shorterSpan = routePlacementStatus('shaft', bottom, top, state, config);
    if (shorterSpan.key === 'ready') {
      return {
        key: 'shorter',
        disabled: false,
        top,
        cost: shaftCost(top),
        detail: 'full shaft span is blocked; shorter span through F' + top + ' is available',
      };
    }
  }

  return {
    key: fullSpan.key,
    disabled: true,
    detail: fullSpan.key === 'invalid'
      ? fullSpan.detail
      : 'no clear shaft column for the available span; free a route column',
  };
}

/** Project the coverage and starting/upgradable capacity of a new shaft. */
export function shaftPlacementProjection(bottom, top, config) {
  const span = Math.max(0, Math.floor(Number(top) - Number(bottom) + 1));
  const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
  const maxCars = Math.max(0, Math.floor(Number(config?.elevator?.maxCarsPerShaft) || 0));
  const carCost = Math.max(0, Number(config?.costs?.car) || 0);
  return {
    floors: span,
    startingCars: span >= 2 ? 1 : 0,
    startingCapacity: span >= 2 ? carCapacity : 0,
    maxCars,
    maxCapacity: maxCars * carCapacity,
    additionalCars: Math.max(0, maxCars - (span >= 2 ? 1 : 0)),
    additionalCapacity: Math.max(0, maxCars * carCapacity - (span >= 2 ? carCapacity : 0)),
    carCost,
  };
}

/** Project the current and remaining capacity for an existing shaft. */
export function shaftCapacityProjection(shaft, config) {
  const currentCars = Math.max(0, Array.isArray(shaft?.cars) ? shaft.cars.length : 0);
  const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
  const maxCars = Math.max(0, Math.floor(Number(config?.elevator?.maxCarsPerShaft) || 0));
  return {
    currentCars,
    currentCapacity: currentCars * carCapacity,
    remainingCars: Math.max(0, maxCars - currentCars),
    remainingCapacity: Math.max(0, maxCars * carCapacity - currentCars * carCapacity),
    maxCars,
    maxCapacity: maxCars * carCapacity,
    carCost: Math.max(0, Number(config?.costs?.car) || 0),
  };
}

/** Compare the first car in a new shaft with one more car on an existing route. */
export function shaftInvestmentComparison(shaft, bottom, top, state, config) {
  const proposed = shaftPlacementProjection(bottom, top, config);
  const shaftCost = Math.max(0, Number(config?.costs?.shaft) || 0) +
    Math.max(0, Number(config?.costs?.shaftPerFloor) || 0) * Math.max(0, Number(top) - Number(bottom) + 1);
  const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
  const car = shaft ? shaftCapacityProjection(shaft, config) : null;
  const queue = shaft ? shaftQueueReliefProjection(shaft, state, config) : null;
  return {
    shaftCost,
    shaftFloors: proposed.floors,
    shaftCapacityGain: proposed.startingCapacity,
    shaftMaxCapacity: proposed.maxCapacity,
    carCost: car?.carCost ?? Math.max(0, Number(config?.costs?.car) || 0),
    carAvailable: Boolean(car?.remainingCars),
    carCapacityGain: car?.remainingCars ? carCapacity : 0,
    carCurrentCapacity: car?.currentCapacity ?? 0,
    carNextCapacity: car?.remainingCars ? (car.currentCapacity + carCapacity) : car?.currentCapacity ?? 0,
    carQueue: queue?.queue ?? 0,
    carWaitBefore: queue?.currentWaitSeconds ?? 0,
    carWaitAfter: queue?.nextWaitSeconds ?? 0,
    carReliefSeconds: queue?.reliefSeconds ?? 0,
  };
}

/** Estimate the queue-wait change from adding one car to an existing shaft. */
export function shaftQueueReliefProjection(shaft, state, config) {
  const currentCars = Math.max(0, Array.isArray(shaft?.cars) ? shaft.cars.length : 0);
  const maxCars = Math.max(0, Math.floor(Number(config?.elevator?.maxCarsPerShaft) || 0));
  const queue = shaft
    ? (state?.people ?? []).filter((person) => person.state === 'waiting' && person.shaft === shaft.id).length
    : 0;
  const doorTime = Math.max(0, Number(config?.elevator?.doorTime) || 0);
  const boardTime = Math.max(0, Number(config?.elevator?.boardTime) || 0);
  const carCapacity = Math.max(0, Number(config?.elevator?.capacity) || 0);
  const serviceWave = doorTime + boardTime * carCapacity;
  const nextCars = Math.min(maxCars, currentCars + 1);
  const currentWaitSeconds = (queue / Math.max(1, currentCars)) * serviceWave;
  const nextWaitSeconds = (queue / Math.max(1, nextCars)) * serviceWave;
  return {
    queue,
    currentCars,
    nextCars,
    serviceWave,
    currentWaitSeconds,
    nextWaitSeconds,
    reliefSeconds: Math.max(0, currentWaitSeconds - nextWaitSeconds),
    available: nextCars > currentCars,
  };
}

/** Classify whether closed-day queue pressure is repeated or only a recent spike. */
export function shaftQueueDailyPressure(history, minDays = 2) {
  const requiredDays = Math.max(2, Math.floor(Number(minDays) || 2));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.average)),
      peak: Math.max(0, Number(entry?.peak)),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak));
  const pressureDays = entries.filter((entry) => entry.average >= 2 || entry.peak >= 5);
  let consecutiveDays = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (!(entry.average >= 2 || entry.peak >= 5)) break;
    consecutiveDays++;
  }
  const sustained = consecutiveDays >= requiredDays;
  const latest = entries.at(-1) ?? null;
  const peak = entries.length ? Math.max(...entries.map((entry) => entry.peak)) : 0;
  return {
    entries,
    days: entries.length,
    pressureDays: pressureDays.length,
    consecutiveDays,
    sustained,
    latest,
    peak,
    key: sustained ? 'sustained' : pressureDays.length ? 'spike' : 'clear',
    label: sustained
      ? 'sustained ' + consecutiveDays + 'd'
      : pressureDays.length
        ? 'one-day spike'
        : 'no sustained pressure',
  };
}

function localRouteResponseOption(state, config, targetFloors = [], pressurePeople = [], excludedRouteKeys = new Set()) {
  const routeCapacity = (kind) => Math.max(1, Math.floor(Number(config?.[kind]?.capacity) || 0));
  const servesTarget = (route) => !targetFloors.length || targetFloors.some((floor) =>
    Number(route?.bottom) <= floor && Number(route?.top) >= floor);
  const existing = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator', existing: true, occupancy: localRouteOccupancy(state, 'escalator', route.id), capacity: routeCapacity('escalator') })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs', existing: true, occupancy: localRouteOccupancy(state, 'stairs', route.id), capacity: routeCapacity('stairs') })) : []),
  ].filter((route) => servesTarget(route) && route.occupancy < route.capacity &&
    !excludedRouteKeys.has(route.kind + ':' + route.id));
  const placeable = state?.lobby
    ? ['stairs', 'escalator'].map((kind) => {
      const option = routeOption(state, config, kind);
      const top = Math.min(state.floors - 1, (config[kind]?.maxSpan ?? 0) - 1);
      return { ...option, bottom: config.building.lobbyFloor ?? 0, top, slot: option.slot, capacity: routeCapacity(kind), occupancy: 0 };
    }).filter((option) => option.available && (!targetFloors.length || targetFloors.some((floor) => floor <= option.top)))
    : [];
  const options = [...existing, ...placeable].map((option) => {
    const people = (pressurePeople.length ? pressurePeople : (state?.people ?? [])).filter((person) => {
      if (person.state !== 'waiting') return false;
      const from = Number(person.from);
      const to = Number(person.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
      const low = Math.min(from, to);
      const high = Math.max(from, to);
      return Number(option.bottom) <= low && Number(option.top) >= high;
    });
    const times = people.map((person) => option.kind === 'stairs'
      ? stairAccessSeconds(state, person, option, config)
      : escalatorAccessSeconds(state, person, option, config));
    const targetCoverage = targetFloors.filter((floor) => Number(option.bottom) <= floor && Number(option.top) >= floor);
    const fallbackTime = targetCoverage.length
      ? Math.max(...targetCoverage.map((floor) => Math.abs(floor - (config.building.lobbyFloor ?? 0)))) *
        (option.kind === 'stairs' ? config.stairs.walkSecondsPerFloor : config.escalator.travelSecondsPerFloor)
      : 0;
    const wave = pressureWave(people.length, option.capacity, option.occupancy);
    return {
      ...option,
      coverageFloors: targetCoverage,
      coveredTrips: people.length,
      firstWaveCapacity: wave.capacity,
      firstWaveTrips: wave.trips,
      overflowTrips: wave.overflow,
      averageSeconds: times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : fallbackTime,
      maxSeconds: times.length ? Math.max(...times) : fallbackTime,
    };
  }).filter((option) => option.coveredTrips > 0 || option.coverageFloors.length > 0);
  return options.sort((a, b) => a.averageSeconds - b.averageSeconds || (a.cost ?? 0) - (b.cost ?? 0))[0] ?? null;
}

function saturatedLocalRouteDetail(state, config, targetFloors = [], pressurePeople = []) {
  const routes = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
  ];
  const coversPressure = (route) => {
    const people = pressurePeople.filter((person) => {
      const from = Number(person.from);
      const to = Number(person.to);
      return Number.isFinite(from) && Number.isFinite(to) && Number(route.bottom) <= Math.min(from, to) && Number(route.top) >= Math.max(from, to);
    });
    return pressurePeople.length
      ? people.length > 0
      : targetFloors.some((floor) => Number(route.bottom) <= floor && Number(route.top) >= floor);
  };
  const full = routes.filter((route) => coversPressure(route) &&
    localRouteOccupancy(state, route.kind, route.id) >= Math.max(1, Math.floor(Number(config?.[route.kind]?.capacity) || 0)));
  if (!full.length) return '';
  const labels = full.map((route) => route.kind === 'escalator' ? 'the escalator' : 'the stairs');
  const verb = full.length === 1 && full[0].kind === 'escalator' ? 'is' : 'are';
  return ' ' + labels.join(' and ') + ' already ' + verb + ' at simultaneous capacity; wait for space or add a different route.';
}

function localRoutePressureCandidates(state, config, historyByRoute) {
  if (!(historyByRoute instanceof Map)) return [];
  const routes = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
  ];
  return routes
    .map((route) => ({
      ...route,
      key: route.kind + ':' + route.id,
      pressure: localRouteDailyPressure(historyByRoute.get(route.kind + ':' + route.id)),
    }))
    .filter((route) => route.pressure.sustained)
    .sort((a, b) => b.pressure.consecutiveDays - a.pressure.consecutiveDays ||
      (b.pressure.latest?.ratio ?? 0) - (a.pressure.latest?.ratio ?? 0));
}

function localOverflowRoutePressureCandidates(state) {
  const routes = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
  ];
  return routes
    .map((route) => {
      const history = localOverflowRouteHistory(state?.log, route.kind, route.id);
      return { ...route, key: route.kind + ':' + route.id, pressure: localOverflowDailyPressure(history), source: 'overflow' };
    })
    .filter((route) => route.pressure.sustained)
    .sort((a, b) => b.pressure.consecutiveDays - a.pressure.consecutiveDays ||
      (b.pressure.latest?.average ?? 0) - (a.pressure.latest?.average ?? 0));
}

/** Return a zero-filled recent history for one route so missing overflow days count as clear. */
export function localOverflowRouteHistory(history, kind, routeId, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 6));
  return (Array.isArray(history) ? history : [])
    .slice(-limit)
    .map((day) => {
      const record = (day?.localOverflowRoutes ?? []).find((entry) =>
        entry.kind === kind && Number(entry.routeId) === Number(routeId));
      return {
        day: day?.day,
        localOverflowAverage: record?.average ?? 0,
        localOverflowPeak: record?.peak ?? 0,
        localOverflowPenalty: record?.penalty ?? 0,
      };
    });
}

function localRoutePressurePreview(state, config, kind, placement) {
  if (!placement?.available) return { coveredTrips: 0, elevatorTripsRelieved: 0, localTripsRelieved: 0, unassignedTripsRelieved: 0, averageSeconds: null };
  const coverage = waitingPressureCoverage(state, (person) => {
    const from = Number(person.from);
    const to = Number(person.to);
    return Number.isFinite(from) && Number.isFinite(to) && Number(placement.bottom) <= Math.min(from, to) && Number(placement.top) >= Math.max(from, to);
  });
  const times = coverage.people.map((person) => kind === 'stairs'
    ? stairAccessSeconds(state, person, placement, config)
    : escalatorAccessSeconds(state, person, placement, config));
  return {
    coveredTrips: coverage.coveredTrips,
    elevatorTripsRelieved: coverage.elevatorTripsRelieved,
    localTripsRelieved: coverage.localTripsRelieved,
    unassignedTripsRelieved: coverage.unassignedTripsRelieved,
    averageSeconds: times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : null,
  };
}

export function firstWavePressure(waiting, occupied, capacity) {
  const trips = Math.max(0, Math.floor(Number(waiting) || 0));
  const availableCapacity = Math.max(0, Math.floor(Number(capacity) || 0) - Math.max(0, Math.floor(Number(occupied) || 0)));
  return {
    capacity: availableCapacity,
    trips: Math.min(trips, availableCapacity),
    overflow: Math.max(0, trips - availableCapacity),
  };
}

function pressureWave(coveredTrips, capacity, occupancy = 0) {
  return firstWavePressure(coveredTrips, occupancy, capacity);
}

function waitingPressureCoverage(state, covers) {
  const people = (state?.people ?? []).filter((person) => person.state === 'waiting' && covers(person));
  return {
    people,
    coveredTrips: people.length,
    elevatorTripsRelieved: people.filter((person) => person.shaft != null).length,
    localTripsRelieved: people.filter((person) => person.localRouteKind).length,
    unassignedTripsRelieved: people.filter((person) => person.shaft == null && !person.localRouteKind).length,
  };
}

function shaftPressurePreview(state, shaftId) {
  return waitingPressureCoverage(state, (person) => person.shaft === shaftId);
}

function spanPressurePreview(state, bottom, top) {
  return waitingPressureCoverage(state, (person) => {
    const from = Number(person.from);
    const to = Number(person.to);
    return Number.isFinite(from) && Number.isFinite(to) && Number(bottom) <= Math.min(from, to) && Number(top) >= Math.max(from, to);
  });
}

/** Turn waiting people without a shaft assignment into a concrete route hint. */
export function unassignedQueueResponse(state, config) {
  const waiting = (state?.people ?? []).filter((person) => person.state === 'waiting' && person.shaft == null && !person.localRouteKind);
  const hasLocalWaiting = (state?.people ?? []).some((person) => person.state === 'waiting' && person.localRouteKind);
  const origins = new Map();
  for (const person of waiting) {
    const floor = Number(person.from);
    if (!Number.isFinite(floor)) continue;
    origins.set(floor, (origins.get(floor) || 0) + 1);
  }
  const originRows = [...origins.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([floor, count]) => ({ floor, count }));
  const floorLabel = (floors) => floors.map((floor) => 'F' + floor).join(', ');
  if (!waiting.length) {
    return {
      key: 'clear',
      label: 'no missing route',
      detail: hasLocalWaiting
        ? 'All waiting people currently have an assigned elevator or local route.'
        : 'All waiting people currently have an assigned shaft.',
      waiting: 0,
      origins: originRows,
      localFloors: [],
      buildableLocalFloors: [],
      elevatorFloors: [],
      localLabel: null,
      localBuildLabel: null,
      localBuildKind: null,
    };
  }

  const localRoutes = [
    ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
    ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
  ];
  const buildableLocalRoutes = state?.lobby
    ? ['stairs', 'escalator'].map((kind) => {
      const option = routeOption(state, config, kind);
      const top = Math.min(state.floors - 1, (config[kind]?.maxSpan ?? 0) - 1);
      return { ...option, kind, bottom: config.building.lobbyFloor ?? 0, top };
    }).filter((route) => route.available)
    : [];
  const localFloors = new Set();
  const buildableLocalFloors = new Set();
  const elevatorFloors = new Set();
  const existingLocalKinds = new Set();
  const buildableLocalKinds = new Set();
  let recommendedBuildableRoute = null;
  const routeSpeed = (route) => route.kind === 'escalator'
    ? Number(config?.escalator?.travelSecondsPerFloor)
    : Number(config?.stairs?.walkSecondsPerFloor);
  const coversTrip = (route, from, to) => {
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    return Number.isFinite(low) && Number.isFinite(high) &&
      Number(route.bottom) <= low && Number(route.top) >= high;
  };
  for (const person of waiting) {
    const from = Number(person.from);
    const to = Number(person.to);
    const floor = Number(person.from);
    const existingRoute = localRoutes.find((route) => coversTrip(route, from, to));
    const buildableRoute = existingRoute ? null : buildableLocalRoutes
      .filter((route) => coversTrip(route, from, to))
      .sort((a, b) => routeSpeed(a) - routeSpeed(b))[0] ?? null;
    if (existingRoute && Number.isFinite(floor)) {
      localFloors.add(floor);
      existingLocalKinds.add(existingRoute.kind);
    } else if (buildableRoute && Number.isFinite(floor)) {
      buildableLocalFloors.add(floor);
      buildableLocalKinds.add(buildableRoute.kind);
      recommendedBuildableRoute = recommendedBuildableRoute ?? buildableRoute;
    } else if (Number.isFinite(floor)) elevatorFloors.add(floor);
  }
  const localFloorList = [...localFloors].sort((a, b) => a - b);
  const buildableLocalFloorList = [...buildableLocalFloors].sort((a, b) => a - b);
  const elevatorFloorList = [...elevatorFloors].sort((a, b) => a - b);
  const localKinds = [...existingLocalKinds];
  const buildableKinds = [...buildableLocalKinds];
  const localLabel = localKinds.includes('escalator') && localKinds.includes('stairs')
    ? 'stairs/escalator'
    : localKinds.includes('escalator') ? 'escalator' : 'stairs';
  const buildableLocalKind = buildableKinds.sort((a, b) => {
    const aSpeed = routeSpeed({ kind: a });
    const bSpeed = routeSpeed({ kind: b });
    return (Number.isFinite(aSpeed) ? aSpeed : Infinity) - (Number.isFinite(bSpeed) ? bSpeed : Infinity);
  })[0] ?? null;
  const buildableLocalLabel = buildableLocalKind === 'escalator' ? 'an escalator' : 'stairs';
  const buildableLocalTop = Number.isFinite(Number(recommendedBuildableRoute?.top))
    ? Number(recommendedBuildableRoute.top) : null;
  const buildableLocalTargetTop = buildableLocalFloorList.length ? Math.max(...buildableLocalFloorList) : null;
  const buildableLocalBottom = Number.isFinite(Number(recommendedBuildableRoute?.bottom))
    ? Number(recommendedBuildableRoute.bottom) : null;
  const buildableLocalCost = buildableLocalKind && buildableLocalTargetTop != null && buildableLocalBottom != null
    ? Number(config?.costs?.[buildableLocalKind]) + Number(config?.costs?.[buildableLocalKind + 'PerFloor']) *
      Math.max(0, buildableLocalTargetTop - buildableLocalBottom)
    : null;
  const originText = originRows.length ? floorLabel(originRows.map(({ floor }) => floor)) : 'the affected floors';
  const localText = localFloorList.length ? 'Use ' + localLabel + ' for ' + floorLabel(localFloorList) + '.' : '';
  const buildableLocalText = buildableLocalFloorList.length
    ? 'Build ' + buildableLocalLabel + ' to serve ' + floorLabel(buildableLocalFloorList) +
      (buildableLocalBottom != null && buildableLocalTop != null
        ? ' (legal span F' + buildableLocalBottom + '–F' + buildableLocalTop +
          (buildableLocalCost != null ? '; estimated cost to F' + buildableLocalTargetTop + ' ' + formatCost(buildableLocalCost) : '') + ').'
        : '.')
    : '';
  const elevatorText = elevatorFloorList.length
    ? 'Build or extend an elevator shaft to reach ' + floorLabel(elevatorFloorList) + '.'
    : '';
  const hasLocalFix = localFloorList.length || buildableLocalFloorList.length;
  return {
    key: hasLocalFix && elevatorFloorList.length ? 'mixed' : elevatorFloorList.length ? 'shaft'
      : buildableLocalFloorList.length ? 'local_build' : 'local',
    label: hasLocalFix && elevatorFloorList.length
      ? 'split local and elevator routes'
      : elevatorFloorList.length ? 'build or extend a shaft'
        : buildableLocalFloorList.length ? 'build a local route' : 'use a local route',
    detail: 'Unassigned W ' + waiting.length + ' starts on ' + originText + '. ' +
      (localText || buildableLocalText || 'No existing stairs or escalator covers these trips.') + ' ' +
      (buildableLocalText && localText ? buildableLocalText + ' ' : '') +
      (elevatorText || (hasLocalFix ? 'No elevator response is needed for the locally covered trips.' : 'Build a shaft or add a local route before these trips can be served.')),
    waiting: waiting.length,
    origins: originRows,
    localFloors: localFloorList,
    buildableLocalFloors: buildableLocalFloorList,
    elevatorFloors: elevatorFloorList,
    localLabel: localFloorList.length ? localLabel : null,
    localBuildLabel: buildableLocalFloorList.length ? buildableLocalLabel : null,
    localBuildKind: buildableLocalFloorList.length ? buildableLocalKind : null,
    localBuildBottom: buildableLocalFloorList.length ? buildableLocalBottom : null,
    localBuildLegalTop: buildableLocalFloorList.length ? buildableLocalTop : null,
    localBuildTargetTop: buildableLocalFloorList.length ? buildableLocalTargetTop : null,
    localBuildCost: buildableLocalFloorList.length ? buildableLocalCost : null,
  };
}

function waitingTargetFloors(state, shaftIds) {
  const targets = new Map();
  for (const person of state?.people ?? []) {
    if (person.state !== 'waiting' || !shaftIds.has(person.shaft)) continue;
    const from = Number(person.from);
    const to = Number(person.to);
    const floor = Math.max(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0);
    if (floor <= 0) continue;
    targets.set(floor, (targets.get(floor) || 0) + 1);
  }
  return [...targets.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([floor]) => floor);
}

/** Explain whether sustained pressure calls for a car, shaft, or local route. */
export function transportResponseRecommendation(state, config, historyByShaft = null, historyByLocalRoute = null) {
  const queueRecommendation = shaftQueueReliefRecommendation(state, config, historyByShaft);
  const candidates = queueRecommendation.candidates;
  const shafts = state?.shafts ?? [];
  const waiting = (state?.people ?? []).filter((person) => person.state === 'waiting');
  const localRoutePressure = localRoutePressureCandidates(state, config, historyByLocalRoute);
  const localOverflowRoutePressure = localOverflowRoutePressureCandidates(state);
  const localPressure = localOverflowRoutePressure.length ? localOverflowRoutePressure : localRoutePressure;
  const localOverflow = localOverflowDailyPressure(state?.log);
  const availableMoney = Number.isFinite(Number(state?.money)) ? Number(state.money) : Infinity;
  const withBudget = (response, cost, label) => {
    const amount = Number(cost);
    if (!Number.isFinite(amount)) return { ...response, affordable: true, cost: null, fundsGap: 0, averageNet: null, runwayDays: 0 };
    const fundsGap = Math.max(0, amount - availableMoney);
    const recentNet = (state?.log ?? [])
      .slice(-3)
      .map((day) => Number(day.net))
      .filter(Number.isFinite);
    const averageNet = recentNet.length
      ? +(recentNet.reduce((sum, net) => sum + net, 0) / recentNet.length).toFixed(2)
      : null;
    const runwayDays = fundsGap === 0 || averageNet == null || averageNet <= 0
      ? fundsGap === 0 ? 0 : null
      : Math.ceil(fundsGap / averageNet);
    if (fundsGap === 0) return { ...response, affordable: true, cost: amount, fundsGap, averageNet, runwayDays };
    const runwayText = averageNet == null
      ? ' Run one day to establish an earnings runway.'
      : averageNet > 0
        ? ' Recent net averages +' + formatCost(averageNet) + '/day, so this is about ' + runwayDays + ' day' + (runwayDays === 1 ? '' : 's') + ' away.'
        : ' Recent net averages -' + formatCost(Math.abs(averageNet)) + '/day, so there is no positive earnings runway yet.';
    return {
      ...response,
      key: 'budget',
      affordable: false,
      cost: amount,
      fundsGap,
      averageNet,
      runwayDays,
      label: 'save for ' + label,
      detail: response.detail + ' It costs ' + formatCost(amount) + '; you have ' + formatCost(availableMoney) + ' — save ' + formatCost(fundsGap) + ' more.' + runwayText,
    };
  };
  const sustained = candidates
    .filter((candidate) => candidate.dailyPressure.sustained)
    .sort((a, b) => b.dailyPressure.consecutiveDays - a.dailyPressure.consecutiveDays ||
      b.dailyPressure.latest.average - a.dailyPressure.latest.average || a.shaftIndex - b.shaftIndex);
  const liveCar = queueRecommendation.best?.reliefSeconds > 0 ? queueRecommendation.best : null;
  if (liveCar) {
    const currentRouteFloors = [...new Set(waiting
      .flatMap((person) => [Number(person.from), Number(person.to)])
      .filter((floor) => Number.isFinite(floor) && floor >= 0))];
    const broaderLocal = localRouteResponseOption(state, config, currentRouteFloors, waiting,
      new Set(localPressure.map((route) => route.key)));
    const localCost = broaderLocal?.existing ? 0 : Number(broaderLocal?.cost);
    const localCostPerWait = broaderLocal && broaderLocal.coveredTrips > 0 && Number.isFinite(localCost)
      ? localCost / broaderLocal.coveredTrips
      : null;
    const carCostPerWait = liveCar.queue > 0
      ? Number(config?.costs?.car) / liveCar.queue
      : null;
    const carFirstWave = pressureWave(liveCar.queue, config?.elevator?.capacity).trips;
    const localFirstWave = broaderLocal?.firstWaveTrips ?? 0;
    const sameCoverageCheaperLocal = broaderLocal && broaderLocal.coveredTrips === liveCar.queue &&
      localFirstWave === carFirstWave &&
      localCostPerWait != null && carCostPerWait != null && localCostPerWait < carCostPerWait;
    const strongerImmediateLocal = broaderLocal && localFirstWave > carFirstWave;
    const broaderSameWaveLocal = broaderLocal && localFirstWave === carFirstWave && broaderLocal.coveredTrips > liveCar.queue;
    const sustainedOverflowLocal = localOverflow.sustained && localPressure.length > 0 && broaderLocal && broaderLocal.coveredTrips > 0;
    if (broaderLocal && (strongerImmediateLocal || broaderSameWaveLocal || sameCoverageCheaperLocal || sustainedOverflowLocal)) {
      const localLabel = broaderLocal.kind === 'escalator' ? 'an escalator' : 'stairs';
      const dailyThroughputEstimate = Number.isFinite(Number(broaderLocal.averageSeconds)) && Number(broaderLocal.averageSeconds) > 0
        ? Math.max(1, Math.floor((Number(config?.time?.daySeconds) || 0) / Number(broaderLocal.averageSeconds)))
        : null;
      const valueDetail = sameCoverageCheaperLocal
        ? ' It covers the same ' + broaderLocal.coveredTrips + ' current waits at about ' + formatCost(localCostPerWait) +
          ' per wait versus about ' + formatCost(carCostPerWait) + ' for the car.'
        : '';
      const waveDetail = broaderLocal.overflowTrips > 0
        ? ' First wave handles ' + broaderLocal.firstWaveTrips + ' of those waits; ' + broaderLocal.overflowTrips + ' remain queued behind its simultaneous capacity.'
        : ' Its first wave handles all ' + broaderLocal.coveredTrips + ' of those waits.';
      return withBudget({
        key: 'local',
        kind: broaderLocal.kind,
        control: broaderLocal.kind,
        basis: sustainedOverflowLocal ? 'sustained local overflow' : 'broader current coverage',
        sourceRouteKind: sustainedOverflowLocal && localPressure[0]?.source === 'overflow' ? localPressure[0].kind : null,
        sourceRouteId: sustainedOverflowLocal && localPressure[0]?.source === 'overflow' ? localPressure[0].id : null,
        sourceRouteBottom: sustainedOverflowLocal && localPressure[0]?.source === 'overflow' ? localPressure[0].bottom : null,
        sourceRouteTop: sustainedOverflowLocal && localPressure[0]?.source === 'overflow' ? localPressure[0].top : null,
        label: broaderLocal.existing ? 'use ' + localLabel : 'build ' + localLabel,
        targetFloors: currentRouteFloors,
        averageSeconds: broaderLocal.averageSeconds,
        coveredTrips: broaderLocal.coveredTrips,
        existing: Boolean(broaderLocal.existing),
        targetFloor: currentRouteFloors.length ? Math.max(...currentRouteFloors) : null,
        routeBottom: broaderLocal.bottom,
        routeTop: broaderLocal.top,
        routeSlot: broaderLocal.slot,
        routeOccupancy: broaderLocal.occupancy ?? 0,
        routeCapacity: Math.max(1, Math.floor(Number(config?.[broaderLocal.kind]?.capacity) || 0)),
        dailyThroughputEstimate,
        detail: (broaderLocal.existing ? 'Use ' + localLabel : 'Build ' + localLabel) +
          ' because it covers ' + broaderLocal.coveredTrips + ' current waits across the tower; adding a car to S' +
          (liveCar.shaftIndex + 1) + ' addresses ' + liveCar.queue + ' on that shaft.' +
          (broaderLocal.coverageFloors.length ? ' It reaches ' + broaderLocal.coverageFloors.map((floor) => 'F' + floor).join(', ') + '.' : '') +
          waveDetail +
          (broaderLocal.coveredTrips ? ' Estimated travel time for these trips: ' + broaderLocal.averageSeconds.toFixed(1) + 's.' : '') +
          valueDetail +
          (sustainedOverflowLocal ? ' Repeated local overflow makes this the preferred relief even though the elevator queue is also active.' : '') +
          (dailyThroughputEstimate != null ? ' Planning estimate: about ' + dailyThroughputEstimate + ' trips per day at that travel time; this is not yet a hard route capacity limit.' : ''),
      }, broaderLocal.existing ? null : broaderLocal.cost, localLabel);
    }
    const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
    return withBudget({
      key: 'car',
      kind: 'car',
      control: 'car',
      shaftId: liveCar.shaftId,
      basis: 'live queue',
      label: 'add a car to S' + (liveCar.shaftIndex + 1),
      detail: 'S' + (liveCar.shaftIndex + 1) + ' has ' + liveCar.queue + ' people waiting now; one more car cuts the projected wait from ' +
        liveCar.currentWaitSeconds.toFixed(1) + 's to ' + liveCar.nextWaitSeconds.toFixed(1) + 's on the existing route. Cost ' +
        formatCost(config?.costs?.car) + ' · +' + carCapacity + ' riders per dispatch.',
    }, config?.costs?.car, 'a car on S' + (liveCar.shaftIndex + 1));
  }

  const hasPressure = waiting.length > 0 || sustained.length > 0 || localOverflow.sustained;
  if (!hasPressure) {
    return {
      key: 'monitor',
      kind: null,
      control: null,
      basis: 'no repeated pressure',
      label: 'monitor transport',
      detail: 'No live queue or repeated daily pressure is asking for a transport change yet.',
    };
  }

  if (localPressure.length) {
    const overloadedKeys = new Set(localPressure.map((route) => route.key));
    const localWaiting = waiting.filter((person) => person.localRouteKind === 'stairs' || person.localRouteKind === 'escalator');
    const primary = localPressure[0];
    const waitingTargets = [...new Set(localWaiting
      .flatMap((person) => [Number(person.from), Number(person.to)])
      .filter((floor) => Number.isFinite(floor) && floor >= 0))];
    const targetFloors = waitingTargets.length
      ? waitingTargets
      : Number.isFinite(Number(primary.top)) ? [Number(primary.top)] : [];
    const local = localRouteResponseOption(state, config, targetFloors, localWaiting, overloadedKeys);
    const primaryLabel = primary.kind === 'escalator' ? 'escalator' : 'stairs';
    const primarySpan = primary.source === 'overflow' && Number.isFinite(Number(primary.bottom)) && Number.isFinite(Number(primary.top))
      ? ' on F' + primary.bottom + '–F' + primary.top : '';
    if (local) {
      const localLabel = local.kind === 'escalator' ? 'an escalator' : 'stairs';
      const dailyThroughputEstimate = Number.isFinite(Number(local.averageSeconds)) && Number(local.averageSeconds) > 0
        ? Math.max(1, Math.floor((Number(config?.time?.daySeconds) || 0) / Number(local.averageSeconds)))
        : null;
      return withBudget({
        key: 'local',
        kind: local.kind,
        control: local.kind,
        basis: localOverflow.sustained ? 'sustained local overflow' : 'sustained local-route pressure',
        sourceRouteKind: localPressure[0]?.source === 'overflow' ? localPressure[0].kind : null,
        sourceRouteId: localPressure[0]?.source === 'overflow' ? localPressure[0].id : null,
        sourceRouteBottom: localPressure[0]?.source === 'overflow' ? localPressure[0].bottom : null,
        sourceRouteTop: localPressure[0]?.source === 'overflow' ? localPressure[0].top : null,
        label: local.existing ? 'use ' + localLabel : 'build ' + localLabel,
        targetFloors,
        averageSeconds: local.averageSeconds,
        coveredTrips: local.coveredTrips,
        existing: Boolean(local.existing),
        targetFloor: targetFloors.length ? Math.max(...targetFloors) : null,
        routeBottom: local.bottom,
        routeTop: local.top,
        routeSlot: local.slot,
        routeOccupancy: local.occupancy ?? 0,
        routeCapacity: Math.max(1, Math.floor(Number(config?.[local.kind]?.capacity) || 0)),
        dailyThroughputEstimate,
        detail: primaryLabel + primarySpan + ' has ' + primary.pressure.label + ' across recent days. ' + (local.existing
          ? 'Use ' + localLabel + ' for the trips it covers; it does not wait for an elevator car.'
          : 'Build ' + localLabel + ' to spread the load before ' + primaryLabel + ' reaches its limit.') +
          (local.coverageFloors.length ? ' It reaches ' + local.coverageFloors.map((floor) => 'F' + floor).join(', ') + '.' : '') +
          (local.coveredTrips ? ' Estimated travel time for these pressured trips: ' + local.averageSeconds.toFixed(1) + 's.' : '') +
          (localOverflow.sustained ? ' The building-wide overflow trend confirms this pressure is repeating.' : '') +
          (dailyThroughputEstimate != null ? ' Planning estimate: about ' + dailyThroughputEstimate + ' trips per day at that travel time; this is not yet a hard route capacity limit.' : ''),
      }, local.existing ? null : local.cost, localLabel);
    }
    return {
      key: 'blocked',
      kind: null,
      control: null,
      basis: 'sustained local-route pressure',
      label: 'add another local route',
      detail: primaryLabel + ' has ' + primary.pressure.label + ' across recent days, but no alternate local route is currently available. Free a route column or extend the building before adding more local demand.',
    };
  }

  if (localOverflow.sustained) {
    const routes = [
      ...(Array.isArray(state?.escalators) ? state.escalators.map((route) => ({ ...route, kind: 'escalator' })) : []),
      ...(Array.isArray(state?.stairs) ? state.stairs.map((route) => ({ ...route, kind: 'stairs' })) : []),
    ];
    const targetFloor = routes.length ? Math.max(...routes.map((route) => Number(route.top)).filter(Number.isFinite)) : null;
    const excluded = new Set(routes.map((route) => route.kind + ':' + route.id));
    const local = targetFloor == null ? null : localRouteResponseOption(state, config, [targetFloor], [], excluded);
    if (local) {
      const localLabel = local.kind === 'escalator' ? 'an escalator' : 'stairs';
      const dailyThroughputEstimate = Number.isFinite(Number(local.averageSeconds)) && Number(local.averageSeconds) > 0
        ? Math.max(1, Math.floor((Number(config?.time?.daySeconds) || 0) / Number(local.averageSeconds)))
        : null;
      return withBudget({
        key: 'local',
        kind: local.kind,
        control: local.kind,
        basis: 'sustained local overflow',
        label: 'build ' + localLabel,
        targetFloors: [targetFloor],
        averageSeconds: local.averageSeconds,
        coveredTrips: local.coveredTrips,
        existing: false,
        targetFloor,
        routeBottom: local.bottom,
        routeTop: local.top,
        routeSlot: local.slot,
        routeOccupancy: local.occupancy ?? 0,
        routeCapacity: Math.max(1, Math.floor(Number(config?.[local.kind]?.capacity) || 0)),
        dailyThroughputEstimate,
        detail: 'Local routes have overflowed for ' + localOverflow.consecutiveDays + ' consecutive days. Build ' + localLabel +
          ' as a separate capacity path before the crowding becomes a tenant-facing reputation problem.' +
          (local.coverageFloors.length ? ' It reaches ' + local.coverageFloors.map((floor) => 'F' + floor).join(', ') + '.' : '') +
          (dailyThroughputEstimate != null ? ' Planning estimate: about ' + dailyThroughputEstimate + ' trips per day at that travel time; this is not yet a hard route capacity limit.' : ''),
      }, local.cost, localLabel);
    }
  }

  const queuedShafts = candidates.filter((candidate) => candidate.queue > 0);
  const queuedCapacityBound = queuedShafts.length > 0 && queuedShafts.every((candidate) => !candidate.available);
  const allCarsFull = shafts.length > 0 && shafts.every((shaft) => (shaft.cars?.length ?? 0) >= (config?.elevator?.maxCarsPerShaft ?? 0));
  if (!shafts.length || queuedCapacityBound || allCarsFull) {
    const pressureShaftIds = new Set(queuedShafts.filter((candidate) => !candidate.available).map((candidate) => candidate.shaftId));
    const waitingFloors = waitingTargetFloors(state, pressureShaftIds);
    const historicalFloors = sustained
      .map((candidate) => shafts.find((shaft) => shaft.id === candidate.shaftId)?.top)
      .filter((floor) => Number.isFinite(Number(floor)))
      .map(Number);
    const targetFloors = waitingFloors.length ? waitingFloors : historicalFloors;
    const targetFloor = targetFloors.length ? Math.max(...targetFloors) : null;
    const shaftControl = shaftBuildControlStatus(state, config);
    const shaftCoverage = shaftCoverageDemandComparison(config?.building?.lobbyFloor ?? 0, shaftControl.top, shafts, targetFloors);
    if (!shaftControl.disabled && shaftCoverage.key !== 'misses_demand') {
      const shaftProjection = shaftPlacementProjection(config?.building?.lobbyFloor ?? 0, shaftControl.top, config);
      return withBudget({
        key: 'shaft',
        kind: 'shaft',
        control: 'shaft',
        basis: 'independent route',
        label: shafts.length ? 'build a second shaft' : 'build a shaft',
        targetFloor,
        targetFloors,
        legalTop: shaftControl.top,
        coverage: shaftCoverage,
        detail: (shafts.length ? 'Existing shaft car capacity is fully committed.' : 'The tower has no elevator route yet.') +
          (targetFloors.length ? ' ' + shaftCoverage.detail : '') +
          ' A new shaft creates a separate vertical route' + (shaftControl.top == null ? '.' : ' through F' + shaftControl.top + '.') +
          ' Cost ' + formatCost(shaftControl.cost) + ' · legal span F' + (config?.building?.lobbyFloor ?? 0) + '–F' + shaftControl.top +
          ' · includes ' + shaftProjection.startingCars + ' car / ' + shaftProjection.startingCapacity + ' riders per dispatch.',
      }, shaftControl.cost, shafts.length ? 'a second shaft' : 'a shaft');
    }
    const pressurePeople = waiting.filter((person) => pressureShaftIds.has(person.shaft));
    const local = localRouteResponseOption(state, config, targetFloors, pressurePeople);
    if (local) {
      const localLabel = local.kind === 'escalator' ? 'an escalator' : 'stairs';
      const dailyThroughputEstimate = Number.isFinite(Number(local.averageSeconds)) && Number(local.averageSeconds) > 0
        ? Math.max(1, Math.floor((Number(config?.time?.daySeconds) || 0) / Number(local.averageSeconds)))
        : null;
      return withBudget({
        key: 'local',
        kind: local.kind,
        control: local.kind,
        basis: 'local route',
        label: local.existing ? 'use ' + localLabel : 'build ' + localLabel,
        targetFloors,
        averageSeconds: local.averageSeconds,
        coveredTrips: local.coveredTrips,
        existing: Boolean(local.existing),
        targetFloor: targetFloors.length ? Math.max(...targetFloors) : null,
        routeBottom: local.bottom,
        routeTop: local.top,
        routeSlot: local.slot,
        routeOccupancy: local.occupancy ?? 0,
        routeCapacity: Math.max(1, Math.floor(Number(config?.[local.kind]?.capacity) || 0)),
        dailyThroughputEstimate,
        detail: 'Car capacity cannot be expanded on the current route. ' + (local.existing ? 'Use ' + localLabel + ' for trips it covers; it does not wait for an elevator car.' : 'A local route avoids car queues for the floors it covers.') +
          (local.coverageFloors.length ? ' It reaches ' + local.coverageFloors.map((floor) => 'F' + floor).join(', ') + '.' : '') +
          (local.coveredTrips ? ' Estimated travel time for these pressured trips: ' + local.averageSeconds.toFixed(1) + 's.' : '') +
          (dailyThroughputEstimate != null ? ' Planning estimate: about ' + dailyThroughputEstimate + ' trips per day at that travel time; this is not yet a hard route capacity limit.' : ''),
      }, local.existing ? null : local.cost, localLabel);
    }
    const coverageDetail = !shaftControl.disabled && targetFloor != null && shaftControl.top < targetFloor
      ? ' A clear shaft span reaches only F' + shaftControl.top + ', but pressure reaches F' + targetFloor + '.'
      : '';
    const saturatedDetail = saturatedLocalRouteDetail(state, config, targetFloors, pressurePeople);
    return {
      key: 'blocked',
      kind: null,
      control: null,
      basis: 'placement blocked',
      label: 'free a route column',
      detail: 'Pressure needs another route.' + (saturatedDetail ? saturatedDetail : ' The available route does not reach the pressured floors.') + coverageDetail + ' Free a column or add a local route before spending on more capacity.',
    };
  }

  if (sustained.length && queueRecommendation.best) {
    const target = queueRecommendation.best;
    const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
    return withBudget({
      key: 'car',
      kind: 'car',
      control: 'car',
      shaftId: target.shaftId,
      basis: 'sustained daily pressure',
      label: 'add a car to S' + (target.shaftIndex + 1),
      detail: 'S' + (target.shaftIndex + 1) + ' has repeated queue pressure across ' + target.dailyPressure.consecutiveDays +
        ' days. Add a car to increase capacity on that existing route, then watch the next daily reading. Cost ' +
        formatCost(config?.costs?.car) + ' · +' + carCapacity + ' riders per dispatch.',
    }, config?.costs?.car, 'a car on S' + (target.shaftIndex + 1));
  }

  return {
    key: 'monitor',
    kind: null,
    control: null,
    basis: 'watch next reading',
    label: 'watch the next day',
    detail: 'The pressure is not yet specific enough to choose another car or route. Let the next daily reading separate a spike from a pattern.',
  };
}

function localInvestmentChoice(state, config, kind) {
  const placement = state?.lobby
    ? { ...routeOption(state, config, kind), kind }
    : { kind, available: false, reason: 'build a lobby first' };
  const capacity = Math.max(1, Math.floor(Number(config?.[kind]?.capacity) || 0));
  const speedSecondsPerFloor = Math.max(0, Number(config?.[kind]?.walkSecondsPerFloor ?? config?.[kind]?.travelSecondsPerFloor) || 0);
  const existingRoutes = Array.isArray(state?.[kind]) ? state[kind] : [];
  const currentCapacity = existingRoutes.length * capacity;
  const currentOccupancy = existingRoutes.reduce((sum, route) => sum + localRouteOccupancy(state, kind, route.id), 0);
  const available = Boolean(placement?.available && Number(placement.top) > Number(placement.bottom));
  const cost = available ? placement.cost : null;
  const availableMoney = Number.isFinite(Number(state?.money)) ? Number(state.money) : Infinity;
  const pressure = localRoutePressurePreview(state, config, kind, placement);
  const wave = pressureWave(pressure.coveredTrips, available ? capacity : 0);
  return {
    available,
    affordable: available && availableMoney >= Number(cost),
    fundsGap: available ? Math.max(0, Number(cost) - availableMoney) : 0,
    kind,
    cost,
    bottom: placement?.bottom ?? null,
    top: placement?.top ?? null,
    slot: placement?.slot ?? null,
    capacity,
    speedSecondsPerFloor,
    travelSeconds: available ? +((Number(placement.top) - Number(placement.bottom)) * speedSecondsPerFloor).toFixed(1) : null,
    addedCapacity: available ? capacity : 0,
    currentRoutes: existingRoutes.length,
    currentCapacity,
    nextCapacity: currentCapacity + (available ? capacity : 0),
    currentOccupancy,
    coveredTrips: pressure.coveredTrips,
    elevatorTripsRelieved: pressure.elevatorTripsRelieved,
    localTripsRelieved: pressure.localTripsRelieved,
    unassignedTripsRelieved: pressure.unassignedTripsRelieved,
    averageSeconds: pressure.averageSeconds == null ? null : +pressure.averageSeconds.toFixed(1),
    firstWaveCapacity: wave.capacity,
    firstWaveTrips: wave.trips,
    overflowTrips: wave.overflow,
    detail: available
      ? 'F' + placement.bottom + '–F' + placement.top + ' · ' + speedSecondsPerFloor + 's/floor · +' + capacity + ' simultaneous people · local capacity ' + currentCapacity + ' → ' + (currentCapacity + capacity) + ' · column ' + (placement.slot + 1) +
        (pressure.coveredTrips ? ' · covers ' + pressure.coveredTrips + ' current waits' : ' · no current waits covered')
      : placement?.reason ?? 'no clear local-route placement',
  };
}

/** Compare elevator and local transport investments before the player commits. */
export function transportInvestmentChoices(state, config, response = null, historyByShaft = null, selectedKind = null, focusedTarget = null, historyByLocalRoute = null) {
  const recommendation = response ?? transportResponseRecommendation(state, config, historyByShaft, historyByLocalRoute);
  const shafts = Array.isArray(state?.shafts) ? state.shafts : [];
  const queueRecommendation = shaftQueueReliefRecommendation(state, config, historyByShaft);
  const fallbackShaft = shafts.find((shaft) => (shaft.cars?.length ?? 0) < (config?.elevator?.maxCarsPerShaft ?? 0)) ?? shafts[0] ?? null;
  const focusedCarShaftId = focusedTarget?.kind === 'car' ? focusedTarget.shaftId : null;
  const targetShaftId = focusedCarShaftId ?? recommendation?.shaftId ?? queueRecommendation.bestShaftId ?? fallbackShaft?.id;
  const targetShaft = shafts.find((shaft) => shaft.id === targetShaftId) ?? null;
  const carProjection = targetShaft ? shaftQueueReliefProjection(targetShaft, state, config) : null;
  const carCapacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity) || 0));
  const carCost = Math.max(0, Number(config?.costs?.car) || 0);
  const availableMoney = Number.isFinite(Number(state?.money)) ? Number(state.money) : Infinity;
  const carPressure = targetShaft ? shaftPressurePreview(state, targetShaft.id) : null;
  const carWave = pressureWave(carPressure?.coveredTrips ?? 0, carProjection?.available ? carCapacity : 0);
  const car = {
    available: Boolean(carProjection?.available),
    affordable: Boolean(carProjection?.available) && availableMoney >= carCost,
    fundsGap: Boolean(carProjection?.available) ? Math.max(0, carCost - availableMoney) : 0,
    shaftId: targetShaft?.id ?? null,
    shaftIndex: targetShaft ? shafts.indexOf(targetShaft) : -1,
    cost: carCost,
    addedCapacity: carProjection?.available ? carCapacity : 0,
    currentCapacity: targetShaft ? (targetShaft.cars?.length ?? 0) * carCapacity : 0,
    nextCapacity: targetShaft
      ? ((targetShaft.cars?.length ?? 0) + (carProjection?.available ? 1 : 0)) * carCapacity
      : 0,
    queue: carProjection?.queue ?? 0,
    waitBefore: carProjection?.currentWaitSeconds ?? 0,
    waitAfter: carProjection?.nextWaitSeconds ?? 0,
    coveredTrips: carPressure?.coveredTrips ?? 0,
    elevatorTripsRelieved: carPressure?.elevatorTripsRelieved ?? 0,
    localTripsRelieved: carPressure?.localTripsRelieved ?? 0,
    unassignedTripsRelieved: carPressure?.unassignedTripsRelieved ?? 0,
    firstWaveCapacity: carWave.capacity,
    firstWaveTrips: carWave.trips,
    overflowTrips: carWave.overflow,
  };

  const bottom = config?.building?.lobbyFloor ?? 0;
  const shaftControl = shaftBuildControlStatus(state, config);
  const maximumTop = Math.min((state?.floors ?? 0) - 1, bottom + (config?.elevator?.maxSpan ?? 0) - 1);
  const focusedShaftTop = focusedTarget?.kind === 'shaft' && Number.isInteger(focusedTarget.floor) &&
    focusedTarget.floor > bottom && focusedTarget.floor <= maximumTop
    ? focusedTarget.floor
    : null;
  const shaftTop = focusedShaftTop ?? shaftControl.top;
  const focusedShaftPlacement = focusedShaftTop == null ? null : routePlacementStatus('shaft', bottom, focusedShaftTop, state, config);
  const shaftPlacementReady = focusedShaftPlacement
    ? focusedShaftPlacement.key === 'ready'
    : !shaftControl.disabled && Number.isFinite(Number(shaftTop));
  const shaftCost = shaftTop == null ? null
    : Math.max(0, Number(config?.costs?.shaft) || 0) +
      Math.max(0, Number(config?.costs?.shaftPerFloor) || 0) * Math.max(0, Number(shaftTop) - Number(bottom) + 1);
  const shaftProjection = shaftPlacementReady && Number.isFinite(Number(shaftTop))
    ? shaftPlacementProjection(bottom, shaftTop, config)
    : null;
  const shaftPressure = shaftProjection && Number(shaftTop) > Number(bottom)
    ? spanPressurePreview(state, bottom, shaftTop)
    : null;
  const shaftWave = pressureWave(shaftPressure?.coveredTrips ?? 0, shaftProjection && Number(shaftTop) > Number(bottom)
    ? shaftProjection.startingCapacity
    : 0);
  const shaft = {
    available: Boolean(shaftProjection && Number(shaftTop) > Number(bottom)),
    affordable: Boolean(shaftProjection && Number(shaftTop) > Number(bottom)) &&
      (shaftCost == null || availableMoney >= shaftCost),
    fundsGap: shaftCost == null ? 0 : Math.max(0, shaftCost - availableMoney),
    cost: shaftCost,
    bottom,
    top: shaftTop ?? null,
    startingCars: shaftProjection?.startingCars ?? 0,
    startingCapacity: shaftProjection?.startingCapacity ?? 0,
    maxCapacity: shaftProjection?.maxCapacity ?? 0,
    coveredTrips: shaftPressure?.coveredTrips ?? 0,
    elevatorTripsRelieved: shaftPressure?.elevatorTripsRelieved ?? 0,
    localTripsRelieved: shaftPressure?.localTripsRelieved ?? 0,
    unassignedTripsRelieved: shaftPressure?.unassignedTripsRelieved ?? 0,
    firstWaveCapacity: shaftWave.capacity,
    firstWaveTrips: shaftWave.trips,
    overflowTrips: shaftWave.overflow,
    detail: focusedShaftPlacement?.detail ?? shaftControl.detail,
  };
  const localKinds = ['stairs', 'escalator'];
  const preferredLocalKind = localKinds.includes(recommendation?.kind)
    ? recommendation.kind
    : localKinds.includes(selectedKind) ? selectedKind : null;
  const orderedLocalKinds = preferredLocalKind
    ? [preferredLocalKind, ...localKinds.filter((kind) => kind !== preferredLocalKind)]
    : localKinds;
  const rawLocalOptions = orderedLocalKinds.map((kind) => localInvestmentChoice(state, config, kind));
  const rawChoices = [
    ['car', car],
    ['shaft', shaft],
    ...rawLocalOptions.map((choice) => [choice.kind, choice]),
  ];
  const coverageValues = rawChoices
    .filter(([, choice]) => choice.available)
    .map(([, choice]) => Math.max(0, Math.floor(Number(choice.coveredTrips) || 0)));
  const bestCoverage = coverageValues.length ? Math.max(...coverageValues) : 0;
  const nextCoverage = coverageValues.length
    ? Math.max(0, ...coverageValues.filter((value) => value < bestCoverage))
    : 0;
  const coverageLabel = (choice) => {
    if (!choice.available) return '';
    const covered = Math.max(0, Math.floor(Number(choice.coveredTrips) || 0));
    if (covered === bestCoverage) {
      const tied = coverageValues.filter((value) => value === bestCoverage).length;
      return tied > 1
        ? 'coverage tie at ' + bestCoverage + ' current waits · speed/cost decide'
        : 'coverage leader · +' + Math.max(0, bestCoverage - nextCoverage) + ' waits vs next option';
    }
    return 'coverage ' + Math.max(0, bestCoverage - covered) + ' fewer waits than leader';
  };
  const annotateCoverage = (choice) => {
    const covered = Math.max(0, Math.floor(Number(choice.coveredTrips) || 0));
    const costPerCoveredWait = choice.available && covered > 0 && Number.isFinite(Number(choice.cost))
      ? +(Number(choice.cost) / covered).toFixed(1)
      : null;
    return { ...choice, coverageLabel: coverageLabel(choice), costPerCoveredWait };
  };
  const localOptions = rawLocalOptions.map(annotateCoverage);
  const annotatedCar = annotateCoverage(car);
  const annotatedShaft = annotateCoverage(shaft);
  const local = localOptions[0] ?? annotateCoverage(localInvestmentChoice(state, config, 'stairs'));
  const next = !(car.available && car.affordable) && shaft.available && shaft.affordable
    ? { kind: 'shaft', floor: shaft.top }
    : !(shaft.available && shaft.affordable) && car.available && car.affordable
      ? { kind: 'car', shaftId: car.shaftId }
      : null;

  return {
    show: ['car', 'shaft', 'stairs', 'escalator'].includes(recommendation?.kind) ||
      ['car', 'shaft', 'stairs', 'escalator'].includes(selectedKind),
    recommended: recommendation?.kind ?? null,
    selected: ['car', 'shaft', 'stairs', 'escalator'].includes(selectedKind) ? selectedKind : null,
    next,
    car: annotatedCar,
    shaft: annotatedShaft,
    local,
    localOptions,
  };
}

function queueHistoryForShaft(historyByShaft, shaftId) {
  if (!historyByShaft) return null;
  if (typeof historyByShaft.get === 'function') return historyByShaft.get(shaftId) ?? null;
  return historyByShaft[shaftId] ?? null;
}

/** Compare open car slots so the CAR tool can highlight the strongest relief target. */
export function shaftQueueReliefRecommendation(state, config, historyByShaft = null) {
  const candidates = (state?.shafts ?? []).map((shaft, index) => ({
    shaftId: shaft.id,
    shaftIndex: index,
    ...shaftQueueReliefProjection(shaft, state, config),
    dailyPressure: shaftQueueDailyPressure(queueHistoryForShaft(historyByShaft, shaft.id)),
  }));
  const available = candidates.filter((candidate) => candidate.available);
  const hasLiveRelief = available.some((candidate) => candidate.reliefSeconds > 0);
  available.sort((a, b) => {
    if (!hasLiveRelief && Number(b.dailyPressure.sustained) !== Number(a.dailyPressure.sustained)) {
      return Number(b.dailyPressure.sustained) - Number(a.dailyPressure.sustained);
    }
    if (!hasLiveRelief && b.dailyPressure.consecutiveDays !== a.dailyPressure.consecutiveDays) {
      return b.dailyPressure.consecutiveDays - a.dailyPressure.consecutiveDays;
    }
    if (!hasLiveRelief && b.dailyPressure.latest?.average !== a.dailyPressure.latest?.average) {
      return (b.dailyPressure.latest?.average ?? 0) - (a.dailyPressure.latest?.average ?? 0);
    }
    return b.reliefSeconds - a.reliefSeconds || b.queue - a.queue ||
      b.currentWaitSeconds - a.currentWaitSeconds || a.shaftIndex - b.shaftIndex;
  });
  const best = available[0] ?? null;
  return {
    candidates,
    best,
    bestShaftId: best?.shaftId ?? null,
    basis: !best ? 'none' : hasLiveRelief ? 'live queue relief' : best.dailyPressure.sustained ? 'sustained daily pressure' : 'reserve capacity',
  };
}

/** Compress recent shaft queue counts into a small oldest-to-newest sparkline. */
export function shaftQueueTrend(history, maxEntries = 8) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const readings = (Array.isArray(history) ? history : [])
    .map((value) => ({
      count: Math.max(0, Math.floor(Number(typeof value === 'object' ? value?.count : value))),
      time: typeof value === 'object' && Number.isFinite(Number(value?.day)) && Number.isFinite(Number(value?.tod))
        ? Number(value.day) + Number(value.tod)
        : null,
    }))
    .filter((reading) => Number.isFinite(reading.count))
    .slice(-limit);
  if (!readings.length) {
    return { key: 'unknown', direction: 'unknown', current: 0, peak: 0, delta: 0, spike: false, bars: '', timeSpanMinutes: null, label: 'queue trend —', entries: [] };
  }
  const entries = readings.map((reading) => reading.count);
  const current = entries.at(-1);
  const first = entries[0];
  const peak = Math.max(...entries);
  const delta = current - first;
  const direction = delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = entries.map((count) => levels[Math.round(Math.min(1, count / 12) * (levels.length - 1))]).join('');
  const spike = entries.length >= 3 && peak > first && peak > current;
  const firstTime = readings[0].time;
  const lastTime = readings.at(-1).time;
  const timeSpanMinutes = firstTime != null && lastTime != null
    ? Math.max(0, Math.round((lastTime - firstTime) * 1440))
    : null;
  return {
    key: direction,
    direction,
    current,
    peak,
    delta,
    spike,
    bars,
    timeSpanMinutes,
    label: 'queue trend ' + bars,
    entries,
  };
}

/** Compress closed-day shaft queue averages into a day-over-day sparkline. */
export function shaftQueueDailyTrend(history, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.average)),
      peak: Math.max(0, Number(entry?.peak)),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-limit);
  if (!entries.length) {
    return { key: 'unknown', direction: 'unknown', current: 0, peak: 0, bars: '', label: 'daily queue —', entries: [] };
  }
  const values = entries.map((entry) => entry.average);
  const current = values.at(-1);
  const first = values[0];
  const peak = Math.max(...entries.map((entry) => entry.peak));
  const delta = current - first;
  const direction = delta > 0.05 ? 'rising' : delta < -0.05 ? 'falling' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = values.map((count) => levels[Math.round(Math.min(1, count / 12) * (levels.length - 1))]).join('');
  return {
    key: direction,
    direction,
    current,
    peak,
    delta: +delta.toFixed(2),
    bars,
    label: 'daily queue ' + bars,
    entries,
  };
}

/** Compress closed-day local-route occupancy into a day-over-day load trend. */
export function localRouteDailyTrend(history, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.average)),
      peak: Math.max(0, Number(entry?.peak)),
      capacity: Math.max(1, Number(entry?.capacity) || 1),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-limit);
  if (!entries.length) {
    return { key: 'unknown', direction: 'unknown', current: 0, peak: 0, capacity: 1, currentRatio: 0, delta: 0, bars: '', label: 'daily local load —', entries: [] };
  }
  const ratios = entries.map((entry) => Math.min(1, entry.average / entry.capacity));
  const current = entries.at(-1).average;
  const currentRatio = ratios.at(-1);
  const firstRatio = ratios[0];
  const peak = Math.max(...entries.map((entry) => entry.peak));
  const delta = currentRatio - firstRatio;
  const direction = delta > 0.05 ? 'rising' : delta < -0.05 ? 'falling' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = ratios.map((ratio) => levels[Math.round(ratio * (levels.length - 1))]).join('');
  return {
    key: direction,
    direction,
    current,
    peak,
    capacity: entries.at(-1).capacity,
    currentRatio: +currentRatio.toFixed(2),
    delta: +delta.toFixed(2),
    bars,
    label: 'daily local load ' + bars,
    entries,
  };
}

/** Classify repeated local-route load separately from a one-day occupancy spike. */
export function localRouteDailyPressure(history, minDays = 2) {
  const requiredDays = Math.max(2, Math.floor(Number(minDays) || 2));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => {
      const capacity = Math.max(1, Number(entry?.capacity) || 1);
      const average = Math.max(0, Number(entry?.average));
      const peak = Math.max(0, Number(entry?.peak));
      return { day: entry?.day, average, peak, capacity, ratio: Math.min(1, average / capacity), peakRatio: Math.min(1, peak / capacity) };
    })
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-6);
  const pressured = (entry) => entry.ratio >= 0.65 || entry.peakRatio >= 0.85;
  let consecutiveDays = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    if (!pressured(entries[index])) break;
    consecutiveDays++;
  }
  const pressureDays = entries.filter(pressured).length;
  const latest = entries.at(-1) ?? null;
  const sustained = consecutiveDays >= requiredDays;
  return {
    entries,
    days: entries.length,
    pressureDays,
    consecutiveDays,
    sustained,
    latest,
    key: sustained ? 'sustained' : pressureDays ? 'spike' : 'clear',
    label: sustained
      ? 'sustained ' + consecutiveDays + 'd'
      : pressureDays ? 'one-day local-load spike' : 'no sustained local load',
  };
}

/** Compress closed-day local overflow into a small oldest-to-newest sparkline. */
export function localOverflowDailyTrend(history, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(maxEntries));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.localOverflowAverage)),
      peak: Math.max(0, Number(entry?.localOverflowPeak)),
      penalty: Math.max(0, Number(entry?.localOverflowPenalty)),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-limit);
  if (!entries.length) {
    return { key: 'unknown', direction: 'unknown', current: 0, peak: 0, delta: 0, bars: '', label: 'daily local overflow —', entries: [] };
  }
  const values = entries.map((entry) => entry.average);
  const current = values.at(-1);
  const first = values[0];
  const peak = Math.max(...entries.map((entry) => entry.peak));
  const delta = current - first;
  const direction = delta > 0.05 ? 'rising' : delta < -0.05 ? 'falling' : 'steady';
  const levels = '▁▂▃▄▅▆▇█';
  const bars = values.map((value) => levels[Math.round(Math.min(1, value / 4) * (levels.length - 1))]).join('');
  return {
    key: direction,
    direction,
    current: +current.toFixed(2),
    peak,
    delta: +delta.toFixed(2),
    bars,
    label: 'daily local overflow ' + bars,
    entries,
  };
}

/** Distinguish a brief local overflow spike from crowding that repeats by day. */
export function localOverflowDailyPressure(history, minDays = 2) {
  const requiredDays = Math.max(2, Math.floor(Number(minDays) || 2));
  const entries = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      day: entry?.day,
      average: Math.max(0, Number(entry?.localOverflowAverage)),
      peak: Math.max(0, Number(entry?.localOverflowPeak)),
      penalty: Math.max(0, Number(entry?.localOverflowPenalty)),
    }))
    .filter((entry) => Number.isFinite(entry.average) && Number.isFinite(entry.peak))
    .slice(-6);
  const pressured = (entry) => entry.average >= 0.1 || entry.peak >= 2;
  let consecutiveDays = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    if (!pressured(entries[index])) break;
    consecutiveDays++;
  }
  const pressureDays = entries.filter(pressured).length;
  const latest = entries.at(-1) ?? null;
  const sustained = consecutiveDays >= requiredDays;
  return {
    entries,
    days: entries.length,
    pressureDays,
    consecutiveDays,
    sustained,
    latest,
    key: sustained ? 'sustained' : pressureDays ? 'spike' : 'clear',
    label: sustained
      ? 'sustained local overflow ' + consecutiveDays + 'd'
      : pressureDays ? 'one-day local overflow spike' : 'no sustained local overflow',
  };
}

/** Compare one local route's overflow before and after an intervention. */
export function localOverflowInterventionResult(before, after, epsilon = 0.1) {
  const beforeAverage = Math.max(0, Number(before?.average ?? before?.localOverflowAverage) || 0);
  const afterAverage = Math.max(0, Number(after?.average ?? after?.localOverflowAverage) || 0);
  const beforePeak = Math.max(0, Number(before?.peak ?? before?.localOverflowPeak) || 0);
  const afterPeak = Math.max(0, Number(after?.peak ?? after?.localOverflowPeak) || 0);
  const threshold = Math.max(0.01, Number(epsilon) || 0.1);
  const averageDelta = afterAverage - beforeAverage;
  const peakDelta = afterPeak - beforePeak;
  const relieved = averageDelta <= -threshold || (Math.abs(averageDelta) < threshold && peakDelta < 0);
  const worsened = averageDelta >= threshold || (Math.abs(averageDelta) < threshold && peakDelta > 0);
  const key = relieved ? 'relieved' : worsened ? 'worse' : 'unchanged';
  return {
    key,
    label: key === 'relieved' ? 'overflow relieved' : key === 'worse' ? 'overflow still rising' : 'overflow unchanged',
    beforeAverage: +beforeAverage.toFixed(2),
    afterAverage: +afterAverage.toFixed(2),
    beforePeak,
    afterPeak,
    averageDelta: +averageDelta.toFixed(2),
    peakDelta,
  };
}

/** Separate pressure absorbed by a new route from pressure shifted onto it. */
export function localOverflowInterventionComparison(before, after, alternate, epsilon = 0.1) {
  const sourceResult = localOverflowInterventionResult(before, after, epsilon);
  const alternateAverage = Math.max(0, Number(alternate?.average ?? alternate?.localOverflowAverage) || 0);
  const alternatePeak = Math.max(0, Number(alternate?.peak ?? alternate?.localOverflowPeak) || 0);
  const threshold = Math.max(0.01, Number(epsilon) || 0.1);
  const alternatePressured = alternateAverage >= threshold || alternatePeak >= 2;
  const key = sourceResult.key === 'relieved'
    ? alternatePressured ? 'shifted' : 'absorbed'
    : sourceResult.key;
  return {
    ...sourceResult,
    key,
    label: key === 'absorbed' ? 'pressure absorbed'
      : key === 'shifted' ? 'pressure shifted to alternate'
        : sourceResult.label,
    alternateAverage: +alternateAverage.toFixed(2),
    alternatePeak,
    alternatePressured,
  };
}

/** Turn an intervention result into the next transport decision. */
export function localOverflowInterventionNextAction(comparison, alternateRoute = null, state = null, config = null, tenantResult = null, historySummary = null) {
  const kind = alternateRoute?.kind === 'stairs' || alternateRoute?.kind === 'escalator'
    ? alternateRoute.kind : null;
  const tenantOutcome = tenantResult?.key === 'improved' ? 'tenant experience improved'
    : tenantResult?.key === 'worse' ? 'tenant experience worsened'
      : tenantResult?.key === 'unchanged' ? 'tenant experience was unchanged' : null;
  const stability = historySummary?.stabilityKey;
  const stabilityEvidence = historySummary?.stabilityLabel ?? null;
  let action;
  if (kind && comparison?.alternatePressured) {
    const label = kind === 'escalator' ? 'another escalator' : 'another stairs route';
    action = {
      key: 'add-capacity',
      kind,
      label: 'add capacity to the alternate',
      detail: label + ' is still pressured' + (tenantOutcome ? ' and ' + tenantOutcome : '') + (stabilityEvidence ? '; ' + stabilityEvidence : '') + ', so split that demand before judging the result again',
    };
  } else if ((comparison?.key === 'absorbed' || comparison?.key === 'relieved') &&
    (!tenantResult || tenantResult.key === 'improved') && stability !== 'one-day' && stability !== 'mixed-recent') {
    action = {
      key: 'monitor',
      kind: null,
      label: 'keep monitoring',
      detail: 'the source route improved without a pressured alternate route' + (tenantOutcome ? '; ' + tenantOutcome : '') + (stabilityEvidence ? '; ' + stabilityEvidence : ''),
    };
  } else {
    action = {
      key: 'recheck',
      kind: null,
      label: 'recheck after another day',
      detail: 'the route result is not clear enough to justify another build yet' + (tenantOutcome ? '; ' + tenantOutcome + ' needs another reading' : '') + (stabilityEvidence ? '; ' + stabilityEvidence : ''),
    };
  }
  if (!action.kind || !state || !config) return { ...action, tenantOutcomeKey: tenantResult?.key ?? null, stabilityKey: stability ?? null };
  const bottom = Number(config.building?.lobbyFloor ?? 0);
  const top = Number(alternateRoute.top);
  const placement = routePlacementStatus(action.kind, bottom, top, state, config);
  const cost = Math.max(0, Number(config.costs?.[action.kind]) || 0) +
    Math.max(0, Number(config.costs?.[action.kind + 'PerFloor']) || 0) * Math.max(0, top - bottom);
  const availableMoney = Number.isFinite(Number(state.money)) ? Number(state.money) : Infinity;
  const fundsGap = Math.max(0, cost - availableMoney);
  const capacity = Math.max(1, Math.floor(Number(config[action.kind]?.capacity) || 0));
  const routeListKey = action.kind === 'escalator' ? 'escalators' : 'stairs';
  const currentRoutes = Array.isArray(state[routeListKey]) ? state[routeListKey].length : 0;
  const currentCapacity = currentRoutes * capacity;
  const liveOccupancy = (state.people ?? []).filter((person) =>
    person.state === 'walking' && person.localRouteKind === action.kind && Number(person.localRouteId) === Number(alternateRoute.id)).length;
  const liveQueue = (state.people ?? []).filter((person) =>
    person.state === 'waiting' && person.localRouteKind === action.kind && Number(person.localRouteId) === Number(alternateRoute.id)).length;
  const liveOverflow = Math.max(0, liveQueue - Math.max(0, capacity - liveOccupancy));
  const travelSecondsPerFloor = Math.max(0, Number(config[action.kind]?.walkSecondsPerFloor ?? config[action.kind]?.travelSecondsPerFloor) || 0);
  const spanFloors = Math.max(1, top - bottom);
  const travelSeconds = +(spanFloors * travelSecondsPerFloor).toFixed(1);
  const expectedOverflowRelief = Math.min(
    Math.max(0, Number(comparison?.alternateAverage) || 0, liveOverflow),
    capacity,
  );
  return {
    ...action,
    tenantOutcomeKey: tenantResult?.key ?? null,
    stabilityKey: stability ?? null,
    targetFloor: top,
    cost,
    fundsGap,
    capacity,
    currentCapacity,
    projectedCapacity: currentCapacity + capacity,
    liveOccupancy,
    liveQueue,
    liveOverflow,
    spanFloors,
    travelSeconds,
    expectedOverflowRelief: +expectedOverflowRelief.toFixed(2),
    placementKey: placement.key,
    placementDetail: placement.detail,
    available: placement.key === 'ready',
    affordable: placement.key === 'ready' && fundsGap <= 0,
  };
}

/** Summarize the tenant-facing change recorded around a route intervention. */
export function localOverflowInterventionTenantResult(before, after) {
  const beforeWait = Math.max(0, Number(before?.localAvgWait) || 0);
  const afterWait = Math.max(0, Number(after?.localAvgWait) || 0);
  const beforeAbandoned = Math.max(0, Number(before?.localAbandoned) || 0);
  const afterAbandoned = Math.max(0, Number(after?.localAbandoned) || 0);
  const beforeStress = Math.max(0, Number(before?.averageStress) || 0);
  const afterStress = Math.max(0, Number(after?.averageStress) || 0);
  const beforeReputation = Number.isFinite(Number(before?.rep)) ? Number(before.rep) : null;
  const afterReputation = Number.isFinite(Number(after?.rep)) ? Number(after.rep) : null;
  const waitDelta = afterWait - beforeWait;
  const abandonedDelta = afterAbandoned - beforeAbandoned;
  const stressDelta = afterStress - beforeStress;
  const reputationDelta = beforeReputation == null || afterReputation == null ? 0 : afterReputation - beforeReputation;
  const improved = abandonedDelta < 0 || waitDelta <= -0.1 || stressDelta <= -0.05 || reputationDelta >= 0.5;
  const worsened = abandonedDelta > 0 || waitDelta >= 0.1 || stressDelta >= 0.05 || reputationDelta <= -0.5;
  const key = improved && !worsened ? 'improved' : worsened && !improved ? 'worse' : 'unchanged';
  return {
    key,
    label: key === 'improved' ? 'tenant experience improved' : key === 'worse' ? 'tenant experience worsened' : 'tenant experience unchanged',
    beforeWait: +beforeWait.toFixed(2),
    afterWait: +afterWait.toFixed(2),
    beforeAbandoned,
    afterAbandoned,
    beforeStress: +beforeStress.toFixed(2),
    afterStress: +afterStress.toFixed(2),
    beforeReputation,
    afterReputation,
    waitDelta: +waitDelta.toFixed(2),
    abandonedDelta,
    stressDelta: +stressDelta.toFixed(2),
    reputationDelta: +reputationDelta.toFixed(1),
  };
}

/** Keep a short, newest-first-useful history of completed route interventions. */
export function rememberLocalOverflowInterventionHistory(history, entry, limit = 4) {
  const max = Math.max(1, Math.floor(Number(limit) || 4));
  const prior = Array.isArray(history) ? history : [];
  return entry ? [...prior, entry].slice(-max) : prior.slice(-max);
}

/** Summarize whether the retained route tests are helping tenant experience. */
export function localOverflowInterventionHistorySummary(history) {
  const entries = Array.isArray(history) ? history : [];
  const counts = { improved: 0, worse: 0, unchanged: 0 };
  for (const entry of entries) {
    const key = entry?.tenantResult?.key;
    if (key === 'improved' || key === 'worse' || key === 'unchanged') counts[key]++;
  }
  const key = counts.improved > counts.worse ? 'helping'
    : counts.worse > counts.improved ? 'hurting' : 'mixed';
  const total = counts.improved + counts.worse + counts.unchanged;
  const recent = entries.slice(-2)
    .map((entry) => entry?.tenantResult?.key)
    .filter((entryKey) => entryKey === 'improved' || entryKey === 'worse' || entryKey === 'unchanged');
  const stable = recent.length === 2 && recent[0] === recent[1];
  const stabilityKey = stable
    ? recent[1] === 'improved' ? 'stable-helping' : recent[1] === 'worse' ? 'stable-hurting' : 'stable-unchanged'
    : recent.length < 2 ? 'one-day' : 'mixed-recent';
  const stabilityLabel = stabilityKey === 'stable-helping' ? 'stable improvement across 2 tests'
    : stabilityKey === 'stable-hurting' ? 'stable worsening across 2 tests'
      : stabilityKey === 'stable-unchanged' ? 'stable unchanged result across 2 tests'
        : stabilityKey === 'one-day' ? 'one-day result — run another test' : 'mixed recent results — keep testing';
  return {
    key,
    label: key === 'helping' ? 'tenant outcomes mostly improved'
      : key === 'hurting' ? 'tenant outcomes mostly worsened'
        : 'tenant outcomes are mixed',
    total,
    improved: counts.improved,
    worse: counts.worse,
    unchanged: counts.unchanged,
    improvementRate: total ? +(counts.improved / total * 100).toFixed(1) : null,
    stabilityKey,
    stabilityLabel,
    recentCount: recent.length,
  };
}

/** Turn stable route evidence into a small access-confidence demand signal. */
export function tenantTransportForecastSignal(state, config) {
  const history = tenantTransportForecastHistory(state);
  const accessHistory = history.map((entry) => ({ tenantResult: { key: entry.key } }));
  const summary = localOverflowInterventionHistorySummary(accessHistory);
  const stableHelping = summary.stabilityKey === 'stable-helping';
  const stableHurting = summary.stabilityKey === 'stable-hurting';
  const key = stableHelping ? 'helping' : stableHurting ? 'hurting' : history.length ? 'uncertain' : 'none';
  const weight = Math.max(0, Number(config?.occupancy?.transportAccessDemandWeight) || 0);
  const bonus = stableHelping ? weight : stableHurting ? -weight : 0;
  const label = key === 'helping' ? 'stable access evidence'
    : key === 'hurting' ? 'stable access warning'
      : key === 'uncertain' ? 'access evidence still uncertain' : 'no route evidence yet';
  const detail = key === 'helping'
    ? 'repeated route tests improved wait/stress outcomes; +' + bonus + ' access-confidence demand points, separate from reputation'
    : key === 'hurting'
      ? 'repeated route tests worsened wait/stress outcomes; ' + bonus + ' access-confidence demand points, separate from reputation'
      : key === 'uncertain'
        ? 'recent route outcomes are not stable enough to change tenant demand; reputation remains separate'
        : 'complete route tests before adding an access-confidence demand signal; reputation remains separate';
  return {
    key,
    bonus,
    label,
    detail,
    stabilityKey: summary.stabilityKey,
    tests: history.length,
    history,
    trend: tenantTransportForecastTrend(history),
  };
}

/** Keep the latest route-test access outcomes for the tenant-demand forecast. */
export function tenantTransportForecastHistory(state, maxEntries = 4) {
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 4));
  return (Array.isArray(state?.log) ? state.log : [])
    .flatMap((entry) => {
      const tenantResult = entry?.routeIntervention?.tenantResult;
      if (!tenantResult) return [];
      const waitDelta = Number(tenantResult.waitDelta) || 0;
      const abandonedDelta = Number(tenantResult.abandonedDelta) || 0;
      const stressDelta = Number(tenantResult.stressDelta) || 0;
      const improved = abandonedDelta < 0 || waitDelta <= -0.1 || stressDelta <= -0.05;
      const worsened = abandonedDelta > 0 || waitDelta >= 0.1 || stressDelta >= 0.05;
      return [{
        day: entry.day,
        key: improved && !worsened ? 'improved' : worsened && !improved ? 'worse' : 'unchanged',
        waitDelta: +waitDelta.toFixed(2),
        stressDelta: +stressDelta.toFixed(2),
        abandonedDelta,
      }];
    })
    .slice(-limit);
}

/** Compress the short transport-access history into a readable trend cue. */
export function tenantTransportForecastTrend(history) {
  const entries = Array.isArray(history) ? history.filter((entry) =>
    entry?.key === 'improved' || entry?.key === 'worse' || entry?.key === 'unchanged') : [];
  if (!entries.length) return { key: 'unknown', label: 'trend —', bars: '', entries: [] };
  const summary = localOverflowInterventionHistorySummary(entries.map((entry) => ({ tenantResult: { key: entry.key } })));
  const key = summary.stabilityKey;
  const bars = entries.map((entry) => entry.key === 'improved' ? '↑' : entry.key === 'worse' ? '↓' : '→').join('');
  return { key, label: summary.stabilityLabel, bars, entries };
}

/** Label the current queue forecast with simulation speed and rush phase. */
export function shaftQueueForecastContext(day, tod, speed, config) {
  const time = Number(tod);
  const windows = [
    ['MORNING RUSH', config?.time?.morningRush],
    ['LUNCH', config?.time?.lunch],
    ['EVENING RUSH', config?.time?.eveningRush],
  ];
  const phase = windows.find(([, phaseWindow]) => Array.isArray(phaseWindow) && time >= phaseWindow[0] && time <= phaseWindow[1])?.[0] ?? 'OFF-PEAK';
  const speedValue = Number(speed);
  const speedLabel = speedValue === 0 ? 'paused' : (Number.isFinite(speedValue) ? speedValue + '×' : 'live');
  const sampleIntervalMinutes = Math.max(1, Number(config?.time?.queueTrendSampleMinutes) || 30);
  return {
    day: Number.isFinite(Number(day)) ? Number(day) : null,
    tod: Number.isFinite(time) ? time : null,
    speed: speedValue,
    speedLabel,
    phase,
    sampleIntervalMinutes,
    label: speedLabel + ' · ' + phase,
  };
}

/** Connect a completed day's transport reading to the local queue signals. */
export function queueDailyServiceSummary(dayReading, config) {
  if (!dayReading) {
    return {
      key: 'warn',
      label: 'awaiting first day',
      detail: 'Queue trends are live; the first day close will add delivery, wait, and reputation context.',
    };
  }
  const deliveryRate = Number.isFinite(Number(dayReading.deliveryRate)) ? Number(dayReading.deliveryRate) : null;
  const avgWait = Number.isFinite(Number(dayReading.avgWait)) ? Number(dayReading.avgWait) : null;
  const abandoned = Number.isFinite(Number(dayReading.abandoned)) ? Math.max(0, Number(dayReading.abandoned)) : 0;
  const localAvgWait = Number.isFinite(Number(dayReading.localAvgWait)) ? Number(dayReading.localAvgWait) : null;
  const localAbandoned = Number.isFinite(Number(dayReading.localAbandoned)) ? Math.max(0, Number(dayReading.localAbandoned)) : 0;
  const elevatorAvgWait = Number.isFinite(Number(dayReading.elevatorAvgWait)) ? Number(dayReading.elevatorAvgWait) : null;
  const elevatorAbandoned = Number.isFinite(Number(dayReading.elevatorAbandoned)) ? Math.max(0, Number(dayReading.elevatorAbandoned)) : 0;
  const reputation = Number.isFinite(Number(dayReading.rep)) ? Number(dayReading.rep) : null;
  const localOverflowPeak = Number.isFinite(Number(dayReading.localOverflowPeak)) ? Math.max(0, Number(dayReading.localOverflowPeak)) : 0;
  const localOverflowPenalty = Number.isFinite(Number(dayReading.localOverflowPenalty)) ? Math.max(0, Number(dayReading.localOverflowPenalty)) : 0;
  const threshold = Number(config?.occupancy?.relistMinDeliveryRate) || 0;
  const key = abandoned > 0 || deliveryRate != null && deliveryRate < threshold ? 'bad'
    : deliveryRate != null && deliveryRate < 80 || localOverflowPeak > 0 ? 'warn' : 'good';
  const label = 'delivery ' + (deliveryRate == null ? '—' : deliveryRate + '%') +
    ' · wait ' + (avgWait == null ? '—' : avgWait + 's') +
    ' · rep ' + (reputation == null ? '—' : reputation + '%');
  const detail = abandoned > 0
    ? abandoned + ' rider' + (abandoned === 1 ? '' : 's') + ' gave up; abandonment and delivery feed reputation. Compare elevator and local-route readings to find the pressure.'
    : 'Daily delivery and wait feed reputation. Compare elevator and local-route readings to see whether pressure was temporary or sustained.';
  const split = (elevatorAvgWait != null || localAvgWait != null)
    ? ' Elevator: ' + (elevatorAvgWait == null ? '—' : elevatorAvgWait + 's wait') + ' / ' + elevatorAbandoned + ' gave up; local routes: ' +
      (localAvgWait == null ? '—' : localAvgWait + 's wait') + ' / ' + localAbandoned + ' gave up.'
    : '';
  const overflow = localOverflowPeak > 0
    ? ' Local routes exceeded immediate capacity by up to ' + localOverflowPeak + ' rider' + (localOverflowPeak === 1 ? '' : 's') +
      (localOverflowPenalty > 0 ? ', costing ' + localOverflowPenalty + ' reputation.' : '.')
    : '';
  return { key, label, detail: detail + split + overflow, deliveryRate, avgWait, abandoned, reputation, localAvgWait, localAbandoned, elevatorAvgWait, elevatorAbandoned, localOverflowPeak, localOverflowPenalty };
}

/** Preview the concrete effect of a selected-floor next-action handoff. */
export function floorHandoffPreview(summary, handoff, state, config) {
  if (!summary || !handoff || Number(handoff.floor) !== Number(summary.floor)) return null;
  if (handoff.kind === 'vacancy') {
    const unit = (state?.units ?? []).find((candidate) => candidate.id === handoff.unitId && !candidate.occupied);
    if (!unit) return null;
    const load = tenantLoadStatus(unit, config);
    return {
      key: 'occupancy',
      label: 'expected occupancy effect',
      detail: 'If eligible, re-renting this room changes the floor from ' + summary.tenants + '/' + summary.capacity +
        ' to ' + (summary.tenants + load.capacity) + '/' + summary.capacity + ' tenants (+' + load.capacity + ').',
    };
  }
  if (handoff.kind === 'car') {
    const capacity = Math.max(0, Math.floor(Number(config?.elevator?.capacity ?? 0)));
    return {
      key: 'transport',
      label: 'expected queue effect',
      detail: 'One more elevator car adds up to ' + capacity + ' riders per dispatch; it adds ' + transportCoverageText('car') + '. Queue relief starts after it is placed in a shaft.',
    };
  }
  if (handoff.kind === 'shaft') {
    return {
      key: 'transport',
      label: 'expected queue effect',
      detail: 'A new shaft adds ' + transportCoverageText('shaft') + '; this floor can benefit after a car is added to the new shaft.',
    };
  }
  if (handoff.kind === 'stairs' || handoff.kind === 'escalator') {
    const routeLabel = handoff.kind === 'escalator' ? 'An escalator' : 'Stairs';
    return {
      key: 'transport',
      label: 'expected local-route effect',
      detail: routeLabel + ' can serve this floor without using an elevator car, removing this floor’s trips from the elevator queue once it is built.',
    };
  }
  return null;
}

/** Compare two local floor readings so an intervention has a visible outcome. */
export function floorDiagnosisChange(before, after) {
  if (!before || !after || Number(before.floor) !== Number(after.floor)) return null;
  const waitingBefore = Math.max(0, Math.round(Number(before.waiting) || 0));
  const waitingAfter = Math.max(0, Math.round(Number(after.waiting) || 0));
  const tenantsBefore = Math.max(0, Math.round(Number(before.tenants) || 0));
  const tenantsAfter = Math.max(0, Math.round(Number(after.tenants) || 0));
  const queueImproved = waitingAfter < waitingBefore;
  const queueWorsened = waitingAfter > waitingBefore;
  const occupancyImproved = tenantsAfter > tenantsBefore;
  const occupancyWorsened = tenantsAfter < tenantsBefore;
  const improved = queueImproved || occupancyImproved;
  const worsened = queueWorsened || occupancyWorsened;
  const key = improved && worsened ? 'mixed' : improved ? 'improved' : worsened ? 'worsened' : 'steady';
  return {
    key,
    waitingBefore,
    waitingAfter,
    waitingDelta: waitingAfter - waitingBefore,
    tenantsBefore,
    tenantsAfter,
    tenantDelta: tenantsAfter - tenantsBefore,
    beforeCapacity: Math.max(0, Math.round(Number(before.capacity) || 0)),
    afterCapacity: Math.max(0, Math.round(Number(after.capacity) || 0)),
    label: 'waiting ' + waitingBefore + ' → ' + waitingAfter + ' · tenants ' + tenantsBefore + '/' + Math.max(0, Math.round(Number(before.capacity) || 0)) +
      ' → ' + tenantsAfter + '/' + Math.max(0, Math.round(Number(after.capacity) || 0)),
  };
}

/** Turn a floor result into a different, plain-language next response. */
export function floorDiagnosisNextAction(summary, result) {
  if (!summary || !result) return null;
  if (result.key === 'improved') {
    return {
      key: 'monitor',
      label: 'monitor this floor',
      kind: null,
      detail: 'The last handoff improved this floor; watch one more day before spending again.',
    };
  }
  if (summary.waiting > 0 && result.source === 'car') {
    return {
      key: 'alternate_transport',
      label: 'try a shaft',
      kind: 'shaft',
      reason: 'the last car test did not clear the queue; the alternative is ' + transportCoverageText('shaft'),
      detail: 'The last car handoff did not clear the local queue; test a separate shaft route.',
    };
  }
  if (summary.waiting > 0 && result.source === 'shaft') {
    return {
      key: 'alternate_transport',
      label: 'try another car',
      kind: 'car',
      reason: 'the last shaft test did not clear the queue; the alternative is ' + transportCoverageText('car'),
      detail: 'The last shaft handoff did not clear the local queue; test more car capacity on an existing route.',
    };
  }
  if (result.source === 'vacancy' && summary.vacantRooms > 0) {
    return {
      key: 'experience',
      label: 'inspect room quality',
      kind: 'vacancy',
      detail: 'Re-renting did not improve this floor; inspect room evaluation before repeating leasing.',
    };
  }
  return {
    key: 'observe',
    label: 'watch this floor',
    kind: null,
    detail: 'The last change did not produce a clear improvement; collect another local reading before spending again.',
  };
}

/** Keep an improved floor visibly marked only during the day it was confirmed. */
export function floorDiagnosisWorkingState(result, currentDay) {
  if (!result || result.key !== 'improved') return null;
  const afterDay = Number(result.afterDay);
  const day = Number(currentDay);
  if (!Number.isFinite(afterDay) || !Number.isFinite(day) || afterDay !== day) return null;
  return {
    key: 'working',
    label: 'working',
    detail: 'The last local intervention improved this floor; monitor it before spending again.',
  };
}

/** Give a recent improvement a compact age cue before it fades from the list. */
export function floorDiagnosisAgeCue(result, currentDay) {
  if (!result || result.key !== 'improved') return null;
  const afterDay = Number(result.afterDay);
  const day = Number(currentDay);
  if (!Number.isFinite(afterDay) || !Number.isFinite(day)) return null;
  const ageDays = Math.floor(day - afterDay);
  if (ageDays < 0 || ageDays > 2) return null;
  return ageDays === 0
    ? { key: 'working', label: 'working today', detail: 'This floor improved today; monitor it before spending again.', ageDays }
    : { key: ageDays === 1 ? 'recent' : 'aged', label: ageDays + 'd old', detail: 'This floor improved ' + ageDays + ' day' + (ageDays === 1 ? '' : 's') + ' ago; take a fresh reading before acting.', ageDays };
}

/** Flag a response that has failed repeatedly on the same floor. */
export function floorDiagnosisRepeatedFailure(history, floor, source, minFailures = 2) {
  if (!source || !Array.isArray(history)) return null;
  const limit = Math.max(1, Math.floor(Number(minFailures) || 1));
  const attempts = history.filter((entry) =>
    Number(entry?.floor) === Number(floor) && entry?.source === source
  ).slice(-limit);
  if (attempts.length < limit || attempts.some((entry) => entry.key === 'improved')) return null;
  const label = source === 'vacancy' ? 'leasing' : source;
  return {
    key: 'repeat_failure',
    source,
    count: attempts.length,
    latest: attempts.at(-1),
    label: attempts.length + ' failed ' + label + ' tests',
    detail: 'This floor has not improved after ' + attempts.length + ' ' + label + ' tests; choose a different response before repeating it.',
  };
}

/** Keep only a small history of completed, player-started floor interventions. */
export function rememberFloorDiagnosisResult(history, result, maxEntries = 6) {
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 1));
  const existing = Array.isArray(history) ? history : [];
  if (!result?.source) return existing.slice(-limit);
  return [...existing, result].slice(-limit);
}

/** Classify a live queue with the same thresholds used by the renderer. */
export function waitingPressureSummary(count) {
  const raw = Number(count);
  const n = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const band = n === 0 ? 'clear' : n <= 4 ? 'watch' : n <= 11 ? 'busy' : 'critical';
  return {
    count: n,
    ratio: Math.min(1, n / 12),
    band,
    colorKey: indicatorColorKey(band),
  };
}

/** Explain the exact traffic-light meaning of a waiting-pressure band. */
export function waitingPressureColorMeaning(band) {
  if (band === 'clear') return 'green means clear (0 waiting)';
  if (band === 'watch' || band === 'busy') return 'amber means watch or busy (1–11 waiting)';
  return 'red means critical (12+ waiting)';
}

/** Map occupancy and waiting bands onto the shared UI traffic-light language. */
export function indicatorColorKey(key) {
  const value = String(key ?? '').toLowerCase();
  return value === 'full' || value === 'clear' || value === 'improved' ? 'good'
    : value === 'light' || value === 'critical' || value === 'worsened' ? 'bad'
      : 'warn';
}

/** Use one phrase for what each transport investment changes. */
export function transportCoverageText(kind = null) {
  if (kind === 'shaft') return 'a separate vertical route';
  if (kind === 'car') return 'capacity on the existing route';
  return 'each shaft serves its floor span as a separate vertical route; cars add capacity within that route';
}

function routeOption(state, config, kind) {
  if (!state.lobby) {
    const lobbyPlacement = Array.from({ length: config.building.slotsPerFloor }, (_, slot) => slot)
      .some((slot) => !slotsUsed(state, 0).has(slot));
    return lobbyPlacement
      ? { kind: 'lobby', cost: config.costs.lobby, available: true }
      : { kind: 'lobby', available: false, reason: 'no clear ground-floor slot' };
  }
  if (!unlocked(state, config, kind)) return { kind, available: false, reason: kind + ' is locked' };
  const tune = config[kind];
  const bottom = config.building.lobbyFloor ?? 0;
  const top = Math.min(state.floors - 1, bottom + tune.maxSpan - 1);
  const slot = top > bottom
    ? Array.from({ length: config.building.slotsPerFloor }, (_, candidateSlot) => candidateSlot)
      .find((candidateSlot) => Array.from({ length: top - bottom + 1 }, (_, index) => bottom + index)
        .every((floor) => !slotsUsed(state, floor).has(candidateSlot)))
    : null;
  if (slot == null) {
    return { kind, available: false, reason: 'no clear column' };
  }
  return {
    kind,
    cost: config.costs[kind] + config.costs[kind + 'PerFloor'] * (top - bottom),
    available: true,
    bottom,
    top,
    slot,
  };
}

function routeRecommendation(state, config) {
  const options = state.lobby
    ? [routeOption(state, config, 'stairs'), routeOption(state, config, 'escalator')]
    : [routeOption(state, config, 'lobby')];
  const available = options.filter((option) => option.available);
  if (!available.length) {
    return {
      key: 'placement',
      label: 'free a route column',
      detail: 'No eligible local route has a clear placement column. Free a column or add floors before rebuilding coverage.',
    };
  }
  const cheapest = available.sort((a, b) => a.cost - b.cost)[0];
  if (state.money < cheapest.cost) {
    return {
      key: 'budget',
      label: 'save for ' + cheapest.kind,
      detail: 'The next viable route costs ' + formatCost(cheapest.cost) + '; you have ' + formatCost(state.money) + '. Keep the tower stable while it earns the difference.',
      control: cheapest.kind,
    };
  }
  if (cheapest.kind === 'lobby') {
    return {
      key: 'lobby',
      label: 'build a lobby',
      detail: 'Local routes need an entrance first. Select LOBBY and place it on an open ground-floor slot.',
      control: 'lobby',
    };
  }
  return {
    key: 'route',
    label: 'add ' + cheapest.kind,
    detail: 'Every shaft is at its car limit. Select ' + cheapest.kind.toUpperCase() + ' and place it on a clear column from the lobby.',
    control: cheapest.kind,
  };
}

/** Turn the latest reputation pressure into one concrete, availability-aware next move. */
export function reputationRecommendation(state, config) {
  const latest = state.log.at(-1);
  if (!latest) {
    return {
      key: 'observe',
      label: 'run a day first',
      detail: 'Let one day run so delivery, wait, and abandonment data can identify the bottleneck.',
    };
  }

  const longWait = (latest.avgWait ?? 0) >= Math.max(config.units.office.patience, config.demand.abandonAfter * 0.2);
  const abandoned = (latest.abandoned ?? 0) > 0;
  const lowDelivery = (latest.trips ?? 0) > 0 && (latest.deliveryRate ?? 100) < 90;
  if (longWait || abandoned) {
    if (!state.shafts.length) {
      if (!unlocked(state, config, 'shaft')) {
        return { key: 'locked', label: 'unlock a shaft', detail: 'A shaft is not available at this milestone; keep the building stable until it unlocks.', control: 'shaft' };
      }
      const top = Math.min(state.floors - 1, config.elevator.maxSpan - 1);
      const shaftCost = top > 0 ? config.costs.shaft + config.costs.shaftPerFloor * (top + 1) : Infinity;
      const shaftPlacement = top > 0 && clearRouteColumn(state, 0, top, config);
      if (!shaftPlacement) {
        return { key: 'placement', label: 'free a shaft column', detail: 'People need elevator service, but every possible shaft column is blocked. Free a column before building one.' };
      }
      if (state.money < shaftCost) {
        return { key: 'budget', label: 'save for a shaft', detail: 'A viable shaft costs ' + formatCost(shaftCost) + '; you have ' + formatCost(state.money) + '.', control: 'shaft' };
      }
      return {
        key: 'shaft',
        label: 'build a shaft',
        detail: 'People are waiting or giving up. Select SHAFT and cover the busiest occupied floors (about ' + formatCost(shaftCost) + ').',
        control: 'shaft',
      };
    }
    if (state.shafts.some((shaft) => shaft.cars.length < config.elevator.maxCarsPerShaft)) {
      if (!unlocked(state, config, 'car')) {
        return { key: 'locked', label: 'unlock another car', detail: 'More elevator cars are not available at this milestone; use a local route if one is unlocked.', control: 'car' };
      }
      if (state.money < config.costs.car) {
        return { key: 'budget', label: 'save for an elevator car', detail: 'The next car costs ' + formatCost(config.costs.car) + '; you have ' + formatCost(state.money) + '.', control: 'car' };
      }
      return {
        key: 'car',
        label: 'add an elevator car',
        detail: 'Long waits are the pressure. Select CAR, then click the shaft with the longest queue (' + formatCost(config.costs.car) + ').',
        control: 'car',
      };
    }
    return routeRecommendation(state, config);
  }
  if (lowDelivery) {
    const extension = state.shafts.at(-1);
    const canExtend = extension && (() => {
      const top = state.floors - 1;
      if (!Number.isFinite(extension.bottom) || !Number.isFinite(extension.top)) return false;
      if (extension.top >= top || top - extension.bottom + 1 > config.elevator.maxSpan) return false;
      for (let floor = extension.top + 1; floor <= top; floor++) {
        if (slotsUsed(state, floor).has(extension.slot)) return false;
      }
      return true;
    })();
    if (canExtend) {
      const cost = config.costs.shaftPerFloor * (state.floors - 1 - extension.top);
      if (state.money < cost) {
        return { key: 'budget', label: 'save to extend coverage', detail: 'Some trips miss their floors. Extending a shaft costs about ' + formatCost(cost) + '; you have ' + formatCost(state.money) + '.', control: 'extend' };
      }
      return { key: 'extend', label: 'extend shaft coverage', detail: 'Some trips miss their floors. Extend a shaft to reach them (about ' + formatCost(cost) + ').', control: 'extend' };
    }
    return routeRecommendation(state, config);
  }
  return {
    key: 'steady',
    label: 'transport is steady',
    detail: 'No immediate transport change is indicated; watch the next day before spending on capacity.',
  };
}

/** Return recent reputation readings with the transport outcomes behind them. */
export function reputationHistory(state, config) {
  const windowSize = Math.max(1, Math.floor(config.occupancy.reputationWindow ?? 1));
  return state.log.slice(-windowSize)
    .filter((day) => Number.isFinite(day.rep) || Number.isFinite(day.deliveryRate))
    .map((day) => ({
      day: day.day,
      reputation: Number.isFinite(day.rep) ? day.rep : null,
      deliveryRate: Number.isFinite(day.deliveryRate) ? day.deliveryRate : null,
      avgWait: Number.isFinite(day.avgWait) ? day.avgWait : null,
      abandoned: Number.isFinite(day.abandoned) ? day.abandoned : 0,
      localAvgWait: Number.isFinite(day.localAvgWait) ? day.localAvgWait : null,
      localAbandoned: Number.isFinite(day.localAbandoned) ? day.localAbandoned : 0,
      localOverflowPeak: Number.isFinite(day.localOverflowPeak) ? Math.max(0, day.localOverflowPeak) : 0,
      localOverflowPenalty: Number.isFinite(day.localOverflowPenalty) ? Math.max(0, day.localOverflowPenalty) : 0,
      elevatorAvgWait: Number.isFinite(day.elevatorAvgWait) ? day.elevatorAvgWait : null,
      elevatorAbandoned: Number.isFinite(day.elevatorAbandoned) ? day.elevatorAbandoned : 0,
      trips: Number.isFinite(day.trips) ? day.trips : 0,
    }));
}

export function clearRouteColumn(state, bottom, top, config) {
  for (let slot = 0; slot < config.building.slotsPerFloor; slot++) {
    if (Array.from({ length: top - bottom + 1 }, (_, index) => bottom + index)
      .every((floor) => !slotsUsed(state, floor).has(slot))) return true;
  }
  return false;
}

export function formatCost(cost) {
  return '$' + Math.ceil(cost).toLocaleString();
}
