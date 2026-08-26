import { lerp, mix } from './juice.js';

/**
 * Bloom Rush — the greenhouse.
 *
 * Two readouts carry this whole screen, and everything else is decoration:
 *
 *  1. THE HANDS. One pair, doing one thing. If the player cannot see at a glance
 *     that they are mid-trip and therefore cannot pour, the bottleneck is
 *     invisible and the game reads as unresponsive rather than constrained.
 *
 *  2. THE DAYLIGHT BUDGET. Where the day actually went — hauling vs pouring vs
 *     idle. The headless sweep says a good run spends ~67% of daylight on the
 *     hill; a player who cannot see that number cannot learn the game.
 */
export function makeRenderer(canvas, config) {
  const ctx = canvas.getContext('2d');
  const [BG, PANEL, GREEN, GOLD, RED, WATER] = config.feel.palette;

  let W = 0, H = 0;
  const smooth = new Map();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function layout(state) {
    const riverW = Math.min(150, W * 0.19);
    const padX = 26;
    const fieldX = riverW + padX;
    const fieldW = W - fieldX - padX;
    const n = Math.max(state.pots.length, 4);
    const potW = Math.min(104, fieldW / n);
    const potH = Math.min(180, H * 0.36);
    const baseY = H * 0.72;
    return { riverW, fieldX, fieldW, potW, potH, baseY, n,
             potX: (i) => fieldX + i * potW + (fieldW - potW * n) / 2 };
  }

  function draw(state, juice, dtMs, config2 = config) {
    const dpr = window.devicePixelRatio || 1;
    const [sx, sy] = juice.offset();
    const L = layout(state);

    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    sky(state);
    river(state, L);
    ground(L);

    state.pots.forEach((p, i) => drawPot(state, p, i, L, dtMs));

    hands(state, L, dtMs);
    reservoir(state, L);
    daylightBudget(state, L);

    juice.draw(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sky(state) {
    const dawn = [18, 22, 15], noon = [46, 62, 38];
    const k = Math.sin(Math.PI * Math.min(1, Math.max(0, state.tod)));
    const c = dawn.map((v, i) => Math.round(lerp(v, noon[i], k)));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + c.join(',') + ')');
    g.addColorStop(1, BG);
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, W + 120, H + 120);
  }

  /** The hill and the river. The trip down here is the entire cost model. */
  function river(state, L) {
    ctx.fillStyle = 'rgba(10,14,9,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, L.baseY - 120);
    ctx.lineTo(L.riverW, L.baseY + 26);
    ctx.lineTo(0, L.baseY + 26);
    ctx.closePath();
    ctx.fill();

    const y = L.baseY + 26;
    const g = ctx.createLinearGradient(0, y, 0, H);
    g.addColorStop(0, WATER);
    g.addColorStop(1, 'rgba(79,179,217,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, L.riverW, H - y);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RIVER', L.riverW / 2, y + 26);
    ctx.fillText(config.haul.tripSeconds + 's round trip', L.riverW / 2, y + 42);
  }

  function ground(L) {
    ctx.fillStyle = PANEL;
    ctx.fillRect(L.fieldX - 20, L.baseY + 20, W - L.fieldX + 20, 5);
  }

  function drawPot(state, p, i, L, dtMs) {
    const x = L.potX(i), cx = x + L.potW / 2, base = L.baseY;
    const pw = L.potW * 0.52;

    // the pot
    ctx.fillStyle = '#3a2c22';
    ctx.beginPath();
    ctx.moveTo(cx - pw / 2, base - 26);
    ctx.lineTo(cx + pw / 2, base - 26);
    ctx.lineTo(cx + pw / 2 - 6, base + 18);
    ctx.lineTo(cx - pw / 2 + 6, base + 18);
    ctx.closePath();
    ctx.fill();

    if (!p) {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - pw / 2, base - 26, pw, 44);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(state.seeds >= 1 ? 'plant' : 'no seed', cx, base + 40);
      return;
    }

    if (!p.alive) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 8, base - 40); ctx.lineTo(cx + 8, base - 26);
      ctx.moveTo(cx + 8, base - 40); ctx.lineTo(cx - 8, base - 26);
      ctx.stroke();
      ctx.fillStyle = RED;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('dead', cx, base + 40);
      return;
    }

    // stem grows with `growth`, smoothed so the daily jump eases in
    const key = 'p' + i;
    const want = p.growth;
    const cur = smooth.has(key) ? smooth.get(key) : want;
    const g = lerp(cur, want, Math.min(1, dtMs / config.feel.tweenMs));
    smooth.set(key, g);

    const need = config.plant.waterNeed * (config.layers.weather ? state.weather[1] : 1);
    const hyd = Math.min(1, p.hydration / need);
    const thirst = 1 - hyd;
    const stemH = 14 + g * (L.potH - 60);
    const stemColor = mix(GREEN, GOLD, Math.min(1, p.stress / config.plant.stressDeath));

    ctx.strokeStyle = stemColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, base - 26);
    ctx.quadraticCurveTo(cx + Math.sin(g * 4) * 6, base - 26 - stemH * 0.6, cx, base - 26 - stemH);
    ctx.stroke();

    // leaves appear as it grows
    const leaves = Math.floor(g * 5);
    for (let l = 0; l < leaves; l++) {
      const ly = base - 30 - (stemH / (leaves + 1)) * (l + 1);
      const dir = l % 2 ? 1 : -1;
      ctx.fillStyle = stemColor;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(cx + dir * 9, ly, 9, 4, dir * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (p.growth >= 1 - 1e-9) {
      const decay = Math.max(config.plant.decayFloor, 1 - p.over * config.plant.decayPerDay);
      ctx.fillStyle = mix(GOLD, RED, 1 - decay);
      for (let f = 0; f < 3; f++) {
        const a = -Math.PI / 2 + (f - 1) * 0.7;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 13, base - 26 - stemH + Math.sin(a) * 9 + 4, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = GOLD;
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.over ? 'RIPE -' + Math.round((1 - decay) * 100) + '%' : 'RIPE', cx, base + 52);
    }

    // today's water: the bar empties as the day's need goes unmet
    const bw = pw, bx = cx - bw / 2, by = base + 26;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, by, bw, 5);
    ctx.fillStyle = thirst > 0.6 ? RED : WATER;
    ctx.fillRect(bx, by, bw * hyd, 5);

    if (p.stress > 0) {
      ctx.fillStyle = RED;
      for (let s = 0; s < p.stress; s++) {
        ctx.beginPath();
        ctx.arc(bx + 4 + s * 8, by + 14, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** What the one pair of hands is doing, and how much longer. */
  function hands(state, L, dtMs) {
    const y = 34, w = Math.min(300, W * 0.34), x = (W - w) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, y, w, 22);

    if (!state.busy) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('hands free', x + w / 2, y + 15);
      return;
    }

    const total = state.busy.kind === 'haul' ? config.haul.tripSeconds
      : state.busy.kind === 'pour' ? config.pour.seconds
      : state.busy.kind === 'plant' ? config.plantSeconds
      : state.busy.kind === 'expand' ? config.field.potSeconds
      : config.harvestSeconds;
    const done = 1 - state.busy.remaining / total;

    ctx.fillStyle = state.busy.kind === 'haul' ? WATER : GREEN;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, done)), 22);
    ctx.fillStyle = '#0b0e08';
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.busy.kind.toUpperCase() + '  ' + state.busy.remaining.toFixed(1) + 's',
      x + w / 2, y + 15);
  }

  function reservoir(state, L) {
    const w = 34, h = 96, x = L.riverW + 14, y = L.baseY - 150;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y, w, h);
    const frac = state.water / config.haul.reservoirMax;
    ctx.fillStyle = WATER;
    ctx.fillRect(x, y + h * (1 - frac), w, h * frac);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // one tick per pour still available — reads faster than a number
    const pours = Math.floor(state.water / config.pour.amount);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pours + ' pour' + (pours === 1 ? '' : 's'), x + w / 2, y + h + 14);
  }

  /**
   * Where the day went. The single most diagnostic thing on screen — the sweep
   * says a good run is ~67% hill, ~14% pouring, ~19% idle.
   */
  function daylightBudget(state, L) {
    const w = W - L.fieldX - 26, x = L.fieldX, y = H - 34, h = 12;
    const d = config.time.daySeconds;
    const t = state.today;

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, w, h);

    const segs = [
      [t.haulSeconds, WATER, 'hill'],
      [t.pourSeconds, GREEN, 'pour'],
      [t.otherSeconds, GOLD, 'tend'],
    ];
    let cx = x;
    for (const [secs, color] of segs) {
      const sw = (secs / d) * w;
      ctx.fillStyle = color;
      ctx.fillRect(cx, y, sw, h);
      cx += sw;
    }
    ctx.fillStyle = 'rgba(239,71,111,0.5)';
    ctx.fillRect(cx, y, ((t.idleSeconds) / d) * w, h);

    // the day marker
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * state.tod - 1, y - 4, 2, h + 8);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DAYLIGHT  hill ' + Math.round((t.haulSeconds / d) * 100)
      + '%   pour ' + Math.round((t.pourSeconds / d) * 100)
      + '%   tend ' + Math.round((t.otherSeconds / d) * 100)
      + '%   idle ' + Math.round((t.idleSeconds / d) * 100) + '%', x, y - 8);
  }

  /** Which pot a click landed on, or -1 for the river (haul). */
  function hit(state, px, py) {
    const L = layout(state);
    if (px < L.riverW) return 'river';
    for (let i = 0; i < state.pots.length; i++) {
      const x = L.potX(i);
      if (px >= x && px < x + L.potW && py > L.baseY - L.potH && py < L.baseY + 60) return i;
    }
    return null;
  }

  function potPos(state, i) {
    const L = layout(state);
    return [L.potX(i) + L.potW / 2, L.baseY - 40];
  }

  return { draw, resize, hit, potPos, layout, get size() { return [W, H]; } };
}
