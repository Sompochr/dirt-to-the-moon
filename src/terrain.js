// Builds a level's ground shape, ramps, coins, fuel cans and decorations
// from the plain numbers in levels.js, and creates the matching physics bodies.

const pl = window.planck;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export class Terrain {
  constructor(level) {
    this.level = level;
    const H = level.hills;
    const rng = mulberry32(level.seed);

    this.dx = 0.5;
    this.startX = 0;
    this.finishX = level.length;
    this.x0 = -30;
    this.x1 = this.finishX + 90;
    this.ramps = level.ramps || [];

    // 1) Hill control points: alternate peaks and valleys around a slowly rising base.
    const flatStart = 16;
    const flatEnd = this.finishX - 14;
    const finishH = flatEnd * H.rise;
    const ctrl = [{ x: this.x0, h: 0 }, { x: flatStart, h: 0 }];
    let cx = flatStart;
    let up = true;
    for (;;) {
      cx += lerp(H.spacing[0], H.spacing[1], rng());
      if (cx > flatEnd - H.spacing[0]) break;
      const amp = lerp(H.height[0], H.height[1], cx / this.finishX);
      if (rng() < 0.2) up = !up; // occasionally two climbs (or dips) in a row
      ctrl.push({ x: cx, h: cx * H.rise + (up ? 1 : -1) * amp * (0.55 + 0.45 * rng()) });
      up = !up;
    }
    ctrl.push({ x: flatEnd, h: finishH }, { x: this.x1, h: finishH });

    // 2) Sample a smooth curve through the control points, plus small bumps.
    const n = Math.ceil((this.x1 - this.x0) / this.dx) + 1;
    const h = new Float32Array(n);
    const p1 = rng() * 6.28;
    const p2 = rng() * 6.28;
    let j = 0;
    for (let i = 0; i < n; i++) {
      const x = this.x0 + i * this.dx;
      while (j < ctrl.length - 2 && ctrl[j + 1].x < x) j++;
      const a = ctrl[j];
      const b = ctrl[j + 1];
      const t = clamp((x - a.x) / (b.x - a.x), 0, 1);
      let y = lerp(a.h, b.h, (1 - Math.cos(t * Math.PI)) / 2);
      const fade = smoothstep(flatStart, flatStart + 20, x) * (1 - smoothstep(flatEnd - 20, flatEnd, x));
      y += fade * H.bumps * (0.6 * Math.sin(x * 1.7 + p1) + 0.4 * Math.sin(x * 0.93 + p2));
      h[i] = y;
    }
    this.h = h;
    this.limitSlope(H.maxSlope);

    // 3) Flatten the ground under each ramp so the ramp sits cleanly.
    for (const r of this.ramps) {
      const i0 = this.index(r.x - 6);
      const i1 = this.index(r.x + r.length + 8);
      const ha = h[i0];
      const hb = h[i1];
      for (let i = i0; i <= i1; i++) h[i] = lerp(ha, hb, (i - i0) / (i1 - i0));
    }
    this.limitSlope(H.maxSlope);

    for (const r of this.ramps) {
      r.x0 = r.x;
      r.x1 = r.x + r.length;
      r.y0 = this.groundAt(r.x0) - 0.05;
      r.y1 = this.groundAt(r.x1) + r.height;
    }

    this.placeItems(rng);
  }

  index(x) {
    return clamp(Math.round((x - this.x0) / this.dx), 0, this.h.length - 1);
  }

  limitSlope(maxSlope) {
    const h = this.h;
    const m = maxSlope * this.dx;
    for (let i = 1; i < h.length; i++) h[i] = clamp(h[i], h[i - 1] - m, h[i - 1] + m);
    for (let i = h.length - 2; i >= 0; i--) h[i] = clamp(h[i], h[i + 1] - m, h[i + 1] + m);
  }

  // Height of the natural ground (no ramps).
  groundAt(x) {
    const f = (x - this.x0) / this.dx;
    if (f <= 0) return this.h[0];
    const last = this.h.length - 1;
    if (f >= last) return this.h[last];
    const i = f | 0;
    return lerp(this.h[i], this.h[i + 1], f - i);
  }

  // Height of whatever the bike can stand on (ground or ramp).
  surfaceAt(x) {
    let y = this.groundAt(x);
    for (const r of this.ramps) {
      if (x >= r.x0 && x <= r.x1) y = Math.max(y, lerp(r.y0, r.y1, (x - r.x0) / (r.x1 - r.x0)));
    }
    return y;
  }

  slopeAngleAt(x) {
    return Math.atan2(this.surfaceAt(x + 0.7) - this.surfaceAt(x - 0.7), 1.4);
  }

  insideRamp(x, margin = 0) {
    return this.ramps.some((r) => x > r.x0 - margin && x < r.x1 + margin);
  }

  placeItems(rng) {
    const L = this.level;
    // Fuel cans
    this.fuels = [];
    for (let fx = L.fuelEvery; fx < this.finishX - 25; fx += L.fuelEvery) {
      let x = fx;
      while (this.insideRamp(x, 10)) x += 6;
      this.fuels.push({ x, y: this.surfaceAt(x) + 0.8, taken: false });
    }

    // Coins: rows that follow the ground, plus an arc after every ramp.
    this.coins = [];
    const nearFuel = (x) => this.fuels.some((f) => Math.abs(f.x - x) < 9);
    for (let gx = 36; gx < this.finishX - 20; gx += L.coinEvery * (0.8 + 0.4 * rng())) {
      if (this.insideRamp(gx, 14) || nearFuel(gx)) continue;
      const count = 4 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const x = gx + k * 1.1;
        this.coins.push({ x, y: this.surfaceAt(x) + 0.9, taken: false });
      }
    }
    for (const r of this.ramps) {
      const v = 9; // rough take-off speed used to shape the arc
      for (let k = 0; k < 6; k++) {
        const t = 0.18 + k * 0.13;
        const x = r.x1 + v * t;
        const y = r.y1 + 0.9 + v * 0.55 * t - 5 * t * t;
        this.coins.push({ x, y: Math.max(y, this.surfaceAt(x) + 0.9), taken: false });
      }
    }
    this.coins.sort((a, b) => a.x - b.x);

    // Ground decorations (visual only)
    this.props = [];
    for (let x = 6; x < this.x1 - 10; x += 3 + rng() * 7) {
      if (this.insideRamp(x, 1)) continue;
      const r = rng();
      const kind = r < 0.45 ? 'tuft' : r < 0.7 ? 'flower' : r < 0.85 ? 'rock' : 'bush';
      this.props.push({ x, kind, v: rng() });
    }
  }

  // Create static physics bodies for the ground and ramps.
  createBodies(world) {
    const ground = world.createBody({ type: 'static' });
    const verts = [];
    for (let i = 0; i < this.h.length; i++) verts.push({ x: this.x0 + i * this.dx, y: this.h[i] });
    ground.createFixture({ shape: new pl.Chain(verts, false), friction: 0.9, userData: 'ground' });
    // Walls at both ends so the bike cannot leave the level.
    const wl = this.x0 + 4;
    const wr = this.x1 - 4;
    ground.createFixture({ shape: new pl.Edge({ x: wl, y: this.groundAt(wl) - 1 }, { x: wl, y: this.groundAt(wl) + 40 }), userData: 'ground' });
    ground.createFixture({ shape: new pl.Edge({ x: wr, y: this.groundAt(wr) - 1 }, { x: wr, y: this.groundAt(wr) + 40 }), userData: 'ground' });

    for (const r of this.ramps) {
      const gA = this.groundAt(r.x0);
      const gB = this.groundAt(r.x1);
      ground.createFixture({
        shape: new pl.Polygon([
          { x: r.x0, y: gA - 0.6 },
          { x: r.x1, y: gB - 0.6 },
          { x: r.x1, y: r.y1 },
          { x: r.x0, y: r.y0 },
        ]),
        friction: 0.9,
        userData: 'ground',
      });
    }
    return ground;
  }
}
