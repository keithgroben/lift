/** Return the closest facility of `kind` when it covers the unit's floor. */
function nearestFacility(state, unit, config, kind) {
  const coverageFloors = config.services?.[kind]?.coverageFloors ?? 0;
  let best = null;
  for (const facility of state.facilities ?? []) {
    if (facility.kind !== kind) continue;
    const floors = Math.abs(facility.floor - unit.floor);
    if (floors > coverageFloors) continue;
    if (!best || floors < best.floors || (floors === best.floors && facility.slot < best.facility.slot)) {
      best = { facility, floors };
    }
  }
  return best;
}

/** Return the closest cafeteria when it covers the unit's floor. */
export function foodCoverage(state, unit, config) {
  return nearestFacility(state, unit, config, 'food');
}

/** Return the closest parking facility when it covers the unit's floor. */
export function parkingCoverage(state, unit, config) {
  return nearestFacility(state, unit, config, 'parking');
}

/** Return the closest clinic when it covers the unit's floor. */
export function medicalCoverage(state, unit, config) {
  return nearestFacility(state, unit, config, 'medical');
}

/** Return the closest security desk when it covers the unit's floor. */
export function securityCoverage(state, unit, config) {
  return nearestFacility(state, unit, config, 'security');
}

/** Return the closest recycling facility when it covers the unit's floor. */
export function recyclingCoverage(state, unit, config) {
  return nearestFacility(state, unit, config, 'recycling');
}

/** The visible food-service demand signal: occupied rooms covered versus waiting. */
export function foodDemand(state, config) {
  const occupied = state.units.filter((u) => u.occupied);
  const covered = occupied.filter((u) => foodCoverage(state, u, config));
  const heads = occupied.reduce((sum, u) => sum + u.heads, 0);
  const coveredHeads = covered.reduce((sum, u) => sum + u.heads, 0);
  return {
    rooms: occupied.length,
    coveredRooms: covered.length,
    uncoveredRooms: occupied.length - covered.length,
    heads,
    coveredHeads,
    coverageRate: occupied.length ? Math.round((covered.length / occupied.length) * 100) : 100,
  };
}

/** The visible parking demand signal: occupied rooms covered versus waiting. */
export function parkingDemand(state, config) {
  const occupied = state.units.filter((u) => u.occupied);
  const covered = occupied.filter((u) => parkingCoverage(state, u, config));
  const heads = occupied.reduce((sum, u) => sum + u.heads, 0);
  const coveredHeads = covered.reduce((sum, u) => sum + u.heads, 0);
  return {
    rooms: occupied.length,
    coveredRooms: covered.length,
    uncoveredRooms: occupied.length - covered.length,
    heads,
    coveredHeads,
    coverageRate: occupied.length ? Math.round((covered.length / occupied.length) * 100) : 100,
  };
}

/** Medical demand includes only occupied unit types that require healthcare. */
export function medicalDemand(state, config) {
  const required = state.units.filter((u) => u.occupied && (config.units[u.kind]?.medicalNeed ?? 0) > 0);
  const covered = required.filter((u) => medicalCoverage(state, u, config));
  const heads = required.reduce((sum, u) => sum + u.heads, 0);
  const coveredHeads = covered.reduce((sum, u) => sum + u.heads, 0);
  return {
    rooms: required.length,
    coveredRooms: covered.length,
    uncoveredRooms: required.length - covered.length,
    heads,
    coveredHeads,
    coverageRate: required.length ? Math.round((covered.length / required.length) * 100) : 100,
  };
}

/** Security demand includes every occupied unit type with a security need. */
export function securityDemand(state, config) {
  const required = state.units.filter((u) => u.occupied && (config.units[u.kind]?.securityNeed ?? 0) > 0);
  const covered = required.filter((u) => securityCoverage(state, u, config));
  const heads = required.reduce((sum, u) => sum + u.heads, 0);
  const coveredHeads = covered.reduce((sum, u) => sum + u.heads, 0);
  return {
    rooms: required.length,
    coveredRooms: covered.length,
    uncoveredRooms: required.length - covered.length,
    heads,
    coveredHeads,
    coverageRate: required.length ? Math.round((covered.length / required.length) * 100) : 100,
  };
}

/** Recycling demand is expressed as the waste produced by occupied rooms. */
export function recyclingDemand(state, config) {
  const required = state.units.filter((u) => u.occupied && (config.units[u.kind]?.recyclingNeed ?? 0) > 0);
  const covered = required.filter((u) => recyclingCoverage(state, u, config));
  const waste = required.reduce((sum, u) => sum + u.heads * (config.units[u.kind]?.wastePerHead ?? 0), 0);
  const coveredWaste = covered.reduce((sum, u) => sum + u.heads * (config.units[u.kind]?.wastePerHead ?? 0), 0);
  return {
    rooms: required.length,
    coveredRooms: covered.length,
    uncoveredRooms: required.length - covered.length,
    heads: required.reduce((sum, u) => sum + u.heads, 0),
    coveredHeads: covered.reduce((sum, u) => sum + u.heads, 0),
    waste: +waste.toFixed(1),
    coveredWaste: +coveredWaste.toFixed(1),
    coverageRate: required.length ? Math.round((covered.length / required.length) * 100) : 100,
  };
}
