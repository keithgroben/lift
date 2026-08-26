import { lerp, mix } from './juice.js';

/**
 * Draws a cross-section of the tower.
 *
 * The single most important thing on this screen is the queue of waiting people.
 * If the player cannot SEE the line growing, the bottleneck is invisible and the
 * failure is unreadable — the headless sweep already proved a tower can fail 97%
 * of its trips while every number on the HUD looks calm. Everything else here is
 * secondary to making that queue legible.
 */
export function makeRenderer(canvas, config) {
  const ctx = canvas.getContext('2d');
  const [BG, PANEL, GOOD, WARN, BAD, INFO] = config.feel.palette;
  const KIND = { office: INFO, condo: GOOD, shop: WARN };

  /** Smoothed car positions, so a 30Hz sim reads as continuous motion. */
  const smooth = new Map();
  let W = 0, H = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function layout(state) {
    const pad = 24;
    // Keep a little sky above the roof so there is somewhere to build, but do
    // not let a four-floor opening render as a smudge at the bottom of the view.
    const rows = Math.max(state.floors + 2, 10);
    const fh = Math.min(44, (H - pad * 2) / rows);
    const cols = config.building.slotsPerFloor;
    const cw = Math.min(fh * 1.6, (W - pad * 2) / cols);
    const x0 = (W - cw * cols) / 2;
    const y0 = H - pad;
    return { fh, cw, x0, y0, cols, floorY: (f) => y0 - (f + 1) * fh };
  }

  function draw(state, juice, dtMs) {
    const dpr = window.devicePixelRatio || 1;
    const L = layout(state);
    const [sx, sy] = juice.offset();

    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    paintSky(state);

    ctx.strokeStyle = PANEL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, L.y0 + 1);
    ctx.lineTo(W, L.y0 + 1);
    ctx.stroke();

    for (let f = 0; f < state.floors; f++) {
      const y = L.floorY(f);
      ctx.fillStyle = f === 0 ? '#141c26' : 'rgba(27,36,48,0.55)';
      roundRect(ctx, L.x0 - 6, y, L.cw * L.cols + 12, L.fh - 2, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(142,202,230,0.35)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(f === 0 ? 'L' : String(f), L.x0 - 12, y + L.fh * 0.68);
    }

    for (const u of state.units) drawUnit(u, L);
    for (const sh of state.shafts) drawShaft(sh, L, dtMs);
    drawQueues(state, L);

    juice.draw(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Sky shifts through the day. Cheap, and it makes a rush hour feel like one. */
  function paintSky(state) {
    const night = [14, 17, 22], day = [24, 36, 50];
    const k = Math.sin(Math.PI * Math.min(1, Math.max(0, (state.tod - 0.05) / 0.9)));
    const c = night.map((n, i) => Math.round(lerp(n, day[i], k)));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + c.join(',') + ')');
    g.addColorStop(1, BG);
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, W + 120, H + 120);
  }

  function drawUnit(u, L) {
    const x = L.x0 + u.slot * L.cw, y = L.floorY(u.floor);
    const tune = config.units[u.kind];

    if (!u.occupied) {
      ctx.fillStyle = 'rgba(120,130,145,0.16)';
      roundRect(ctx, x + 2, y + 3, L.cw - 4, L.fh - 8, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,130,145,0.4)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const stress = Math.min(1, u.stress / tune.vacateAt);
    ctx.fillStyle = stress > 0.05 ? mix(KIND[u.kind], BAD, stress) : KIND[u.kind];
    ctx.globalAlpha = 0.86;
    roundRect(ctx, x + 2, y + 3, L.cw - 4, L.fh - 8, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Tenant patience, made visible along the bottom edge.
    if (stress > 0.02) {
      ctx.fillStyle = stress > 0.66 ? BAD : WARN;
      ctx.fillRect(x + 2, y + L.fh - 7, (L.cw - 4) * stress, 2);
    }
  }

  function drawShaft(sh, L, dtMs) {
    const x = L.x0 + sh.slot * L.cw;
    const top = L.floorY(sh.top), bot = L.floorY(sh.bottom) + L.fh;

    ctx.fillStyle = 'rgba(8,11,15,0.9)';
    roundRect(ctx, x + 3, top + 1, L.cw - 6, bot - top - 2, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(142,202,230,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const car of sh.cars) {
      const want = L.floorY(car.y) + 3;
      const cur = smooth.has(car.id) ? smooth.get(car.id) : want;
      const next = lerp(cur, want, Math.min(1, dtMs / config.feel.tweenMs));
      smooth.set(car.id, next);

      const full = car.riders.length / config.elevator.capacity;
      ctx.fillStyle = car.state === 'doors' ? GOOD : mix(INFO, WARN, full);
      roundRect(ctx, x + 5, next, L.cw - 10, L.fh - 8, 3);
      ctx.fill();

      if (car.riders.length) {
        ctx.fillStyle = '#0e1116';
        ctx.textAlign = 'center';
        ctx.font = '700 10px ui-monospace, monospace';
        ctx.fillText(String(car.riders.length), x + L.cw / 2, next + L.fh * 0.52);
      }
    }
  }

  /** The queue: a line of dots on the landing, reddening and jittering as the
   *  wait grows. This is the readout the whole design depends on. */
  function drawQueues(state, L) {
    const byFloor = new Map();
    for (const p of state.people) {
      if (p.state !== 'waiting') continue;
      if (!byFloor.has(p.from)) byFloor.set(p.from, []);
      byFloor.get(p.from).push(p);
    }

    for (const [floor, queue] of byFloor) {
      const y = L.floorY(floor) + L.fh - 9;
      queue.sort((a, b) => b.waitT - a.waitT);

      // Crowd bar FIRST. A per-person dot row caps out and then stops growing,
      // so a 276-deep queue rendered as the same thin line as a 22-deep one and
      // the tower looked healthy at a glance. Depth has to be visible as mass.
      const depth = Math.min(1, queue.length / 60);
      if (queue.length > 4) {
        ctx.globalAlpha = 0.22 + depth * 0.5;
        ctx.fillStyle = mix(WARN, BAD, depth);
        const barW = (L.cw * L.cols - 8) * Math.min(1, queue.length / 90);
        roundRect(ctx, L.x0 + 2, y - 5, Math.max(6, barW), 10, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const shown = Math.min(queue.length, 26);
      for (let i = 0; i < shown; i++) {
        const p = queue[i];
        const heat = Math.min(1, p.waitT / config.demand.abandonAfter);
        ctx.fillStyle = mix(GOOD, BAD, heat);
        const bob = Math.sin((p.waitT + i) * 3) * (heat * 1.8);
        ctx.beginPath();
        ctx.arc(L.x0 + 6 + i * 5.5, y + bob, 2.4 + heat * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (queue.length > shown) {
        // Dark on the crowd bar: the count was drawn in the same red as the bar
        // it sits on, which made the loudest number on screen unreadable.
        ctx.fillStyle = queue.length > 4 ? '#12161c' : BAD;
        ctx.textAlign = 'left';
        ctx.font = '700 13px ui-monospace, monospace';
        ctx.fillText('+' + (queue.length - shown) + ' waiting', L.x0 + 12 + shown * 5.5, y + 5);
      }
    }
  }

  /** Screen position of a unit, so the UI can throw a floater at it. */
  function unitPos(state, u) {
    const L = layout(state);
    return [L.x0 + u.slot * L.cw + L.cw / 2, L.floorY(u.floor)];
  }

  /** Which floor a click landed on, for build placement. */
  function floorAt(state, px, py) {
    const L = layout(state);
    const f = Math.floor((L.y0 - py) / L.fh);
    return f >= 0 && f < state.floors ? f : -1;
  }

  return { draw, resize, layout, unitPos, floorAt, get size() { return [W, H]; } };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
