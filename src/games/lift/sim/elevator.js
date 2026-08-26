/**
 * The bottleneck. Everything else in this game is scenery around what happens
 * in this file. Cars run a plain SCAN: commit to a direction, serve every stop
 * that way, reverse at the end of the run.
 */
export function stepShafts(state, dt, config) {
  for (const sh of state.shafts) {
    for (const car of sh.cars) stepCar(state, sh, car, dt, config);
  }
}

function stepCar(state, sh, car, dt, config) {
  if (car.state === 'doors') {
    car.doorT -= dt;
    if (car.doorT > 0) return;
    car.state = 'idle';
  }

  const here = Math.round(car.y);
  const atFloor = Math.abs(car.y - here) < 1e-6;

  if (atFloor && shouldStop(state, sh, car, here, config)) {
    serviceFloor(state, sh, car, here, config);
    return;
  }

  const stop = nextStop(state, sh, car, config);
  if (stop == null) { car.dir = 0; car.state = 'idle'; return; }

  car.state = 'moving';
  car.dir = Math.sign(stop - car.y);
  const travel = config.elevator.speed * dt;
  if (Math.abs(stop - car.y) <= travel) car.y = stop;
  else car.y += car.dir * travel;
}

/** Riders to drop here, or riders to pick up here going our way. */
function shouldStop(state, sh, car, floor, config) {
  for (const p of car.riders) if (p.to === floor) return true;
  if (car.riders.length >= config.elevator.capacity) return false;
  for (const p of state.people) {
    if (p.state !== 'waiting' || p.shaft !== sh.id || p.from !== floor) continue;
    if (car.dir === 0) return true;
    if (Math.sign(p.to - p.from) === car.dir) return true;
  }
  return false;
}

function serviceFloor(state, sh, car, floor, config) {
  let moved = 0;

  for (let i = car.riders.length - 1; i >= 0; i--) {
    const p = car.riders[i];
    if (p.to !== floor) continue;
    car.riders.splice(i, 1);
    p.state = 'arrived';
    moved++;
  }

  // Establish a direction before boarding if we're idle, so we don't load
  // riders going both ways and then thrash.
  if (car.dir === 0) {
    const anyUp = state.people.some(
      (p) => p.state === 'waiting' && p.shaft === sh.id && p.from === floor && p.to > floor);
    car.dir = anyUp ? 1 : -1;
  }

  for (const p of state.people) {
    if (car.riders.length >= config.elevator.capacity) break;
    if (p.state !== 'waiting' || p.shaft !== sh.id || p.from !== floor) continue;
    if (Math.sign(p.to - p.from) !== car.dir) continue;
    p.state = 'riding';
    p.carId = car.id;
    car.riders.push(p);
    moved++;
  }

  car.state = 'doors';
  car.doorT = config.elevator.doorTime + config.elevator.boardTime * moved;
}

/** Nearest stop in the committed direction; reverse if that side is empty. */
function nextStop(state, sh, car, config) {
  const forward = collectStops(state, sh, car, car.dir || 1, config);
  if (forward != null) return forward;
  const back = collectStops(state, sh, car, -(car.dir || 1), config);
  if (back != null) return back;
  // Nothing to do. Hold position rather than returning to lobby — parking policy
  // is a real design lever and belongs in config once we test it.
  return null;
}

function collectStops(state, sh, car, dir, config) {
  let best = null;
  const consider = (f) => {
    if (f < sh.bottom || f > sh.top) return;
    if (dir > 0 ? f <= car.y : f >= car.y) return;
    if (best == null || Math.abs(f - car.y) < Math.abs(best - car.y)) best = f;
  };
  for (const p of car.riders) consider(p.to);
  if (car.riders.length < config.elevator.capacity) {
    for (const p of state.people) {
      if (p.state === 'waiting' && p.shaft === sh.id) consider(p.from);
    }
  }
  return best;
}
