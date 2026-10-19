// Builds a level's ground shape, ramps, bridges, boost pads, coins, fuel cans and decorations
// from the plain numbers in levels.js, and creates the matching physics bodies.

import { mulberry32, lerp, clamp, smoothstep, pick } from './util.js';
import { THEMES } from './themes.js';

const pl = window.planck;

export class Terrain {
  constructor(level) {
    this.level = level;
    this.theme = THEMES[level.theme];
    const H = level.hills;
    const rng = mulberry32(level.seed);

    this.dx = 0.5;
    this.startX = 0;
    this.finishX = level.length;
    this.x0 = -30;
    this.x1 = this.finishX + 90;
    this.ramps = (level.ramps || []).map((r) => ({ ...r }));
    this.bridges = (level.bridges || []).map((b) => ({ ...b }));
    this.boosts = (level.boosts || []).map((b) => ({ ...b, x0: b.x, x1: b.x + b.length }));

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
      if (H.steps) y = Math.round(y / H.steps) * H.steps; // terraces
      const fade = smoothstep(flatStart, flatStart + 20, x) * (1 - smoothstep(flatEnd - 20, flatEnd, x));
      y += fade * H.bumps * (0.6 * Math.sin(x * 1.7 + p1) + 0.4 * Math.sin(x * 0.93 + p2));
      h[i] = y;
    }
    this.h = h;

    // 3) Moon craters: a bowl with a small raised rim.
    const C = level.craters;
    if (C) {
      for (let c = 40 + rng() * 10; c < flatEnd - 30; c += lerp(C.every[0], C.every[1], rng())) {
        const w = lerp(C.width[0], C.width[1], rng()) / 2;
        const d = lerp(C.depth[0], C.depth[1], rng());
        for (let i = this.index(c - w * 1.6); i <= this.index(c + w * 1.6); i++) {
          const t = Math.abs(this.x0 + i * this.dx - c) / w;
          const bowl = t < 1 ? -d * (1 - t * t) : 0;
          const rim = d * 0.35 * Math.exp(-(((t - 1) / 0.28) ** 2));
          h[i] += bowl + rim;
        }
      }
    }
    this.limitSlope(H.maxSlope);

    // 4) Flatten the ground under ramps and around bridges.
    const flatten = (xa, xb) => {
      const i0 = this.index(xa);
      const i1 = this.index(xb);
      const ha = h[i0];
      const hb = h[i1];
      for (let i = i0; i <= i1; i++) h[i] = lerp(ha, hb, (i - i0) / (i1 - i0));
    };
    for (const r of this.ramps) flatten(r.x - 6, r.x + r.length + 8);
    for (const b of this.bridges) flatten(b.x - 8, b.x + b.length + 8);

    // 5) Dig a ravine under each bridge. The bridge deck runs rim to rim.
    for (const b of this.bridges) {
      b.x0 = b.x;
      b.x1 = b.x + b.length;
      b.y0 = this.groundAt(b.x0);
      b.y1 = this.groundAt(b.x1);
      for (let i = this.index(b.x0) + 1; i < this.index(b.x1); i++) {
        const t = (this.x0 + i * this.dx - b.x0) / b.length;
        h[i] = lerp(b.y0, b.y1, t) - b.depth * Math.pow(Math.sin(Math.PI * t), 0.6);
      }
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

  // Height of the natural ground (no ramps or bridges).
  groundAt(x) {
    const f = (x - this.x0) / this.dx;
    if (f <= 0) return this.h[0];
    const last = this.h.length - 1;
    if (f >= last) return this.h[last];
    const i = f | 0;
    return lerp(this.h[i], this.h[i + 1], f - i);
  }

  // Height of whatever the bike can stand on (ground, ramp or bridge deck).
  surfaceAt(x) {
    let y = this.groundAt(x);
    for (const r of this.ramps) {
      if (x >= r.x0 && x <= r.x1) y = Math.max(y, lerp(r.y0, r.y1, (x - r.x0) / (r.x1 - r.x0)));
    }
    for (const b of this.bridges) {
      if (x >= b.x0 && x <= b.x1) y = Math.max(y, lerp(b.y0, b.y1, (x - b.x0) / (b.x1 - b.x0)));
    }
    return y;
  }

  slopeAngleAt(x) {
    return Math.atan2(this.surfaceAt(x + 0.7) - this.surfaceAt(x - 0.7), 1.4);
  }

  // Is x on (or within margin of) a ramp, bridge or boost pad?
  onFeature(x, margin = 0) {
    const inside = (f) => x > f.x0 - margin && x < f.x1 + margin;
    return this.ramps.some(inside) || this.bridges.some(inside) || this.boosts.some(inside);
  }

  placeItems(rng) {
    const L = this.level;
    // Fuel cans
    this.fuels = [];
    for (let fx = L.fuelEvery; fx < this.finishX - 25; fx += L.fuelEvery) {
      let x = fx;
      while (this.onFeature(x, 10)) x += 6;
      this.fuels.push({ x, y: this.surfaceAt(x) + 0.8, taken: false });
    }

    // Coins: rows that follow the ground, an arc after every ramp and a row along every bridge.
    this.coins = [];
    const nearFuel = (x) => this.fuels.some((f) => Math.abs(f.x - x) < 9);
    for (let gx = 36; gx < this.finishX - 20; gx += L.coinEvery * (0.8 + 0.4 * rng())) {
      if (this.onFeature(gx, 14) || nearFuel(gx)) continue;
      const count = 4 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const x = gx + k * 1.1;
        this.coins.push({ x, y: this.surfaceAt(x) + 0.9, taken: false });
      }
    }
    const g = L.gravity;
    for (const r of this.ramps) {
      const v = 9;
      for (let k = 0; k < 6; k++) {
        const t = 0.18 + k * 0.13 * Math.sqrt(10 / g);
        const x = r.x1 + v * t;
        const y = r.y1 + 0.9 + v * 0.55 * t - 0.5 * g * t * t;
        this.coins.push({ x, y: Math.max(y, this.surfaceAt(x) + 0.9), taken: false });
      }
    }
    for (const b of this.bridges) {
      for (let x = b.x0 + 2; x < b.x1 - 1; x += 1.4) this.coins.push({ x, y: this.surfaceAt(x) + 0.9, taken: false });
    }
    this.coins.sort((a, b) => a.x - b.x);

    // Ground decorations (visual only)
    this.props = [];
    for (let x = 6; x < this.x1 - 10; x += 3 + rng() * 7) {
      if (this.onFeature(x, 1)) continue;
      this.props.push({ x, kind: pick(this.theme.props, rng()), v: rng() });
    }
    // Cave lamps stand at a steady spacing so the tunnel stays readable.
    this.lamps = [];
    if (this.theme.lamps) {
      for (let x = 10; x < this.x1 - 10; x += this.theme.lamps) {
        if (!this.onFeature(x, 2)) this.lamps.push({ x });
      }
    }
  }

  // Create physics bodies for the ground, ramps and bridges.
  createBodies(world) {
    const ground = world.createBody({ type: 'static' });
    const verts = [];
    for (let i = 0; i < this.h.length; i++) verts.push({ x: this.x0 + i * this.dx, y: this.h[i] });
    ground.createFixture({ shape: new pl.Chain(verts, false), friction: 0.9, userData: 'ground' });
    // Walls at both ends so the bike cannot leave the level.
    const wl = this.x0 + 4;
    const wr = this.x1 - 4;
    ground.createFixture({ shape: new pl.Edge({ x: wl, y: this.groundAt(wl) - 1 }, { x: wl, y: this.groundAt(wl) + 40 }) });
    ground.createFixture({ shape: new pl.Edge({ x: wr, y: this.groundAt(wr) - 1 }, { x: wr, y: this.groundAt(wr) + 40 }) });

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
      });
    }

    for (const b of this.bridges) {
      if (b.type === 'rail') {
        // A rigid mine-cart track on wooden trestles.
        ground.createFixture({ shape: new pl.Edge({ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y1 }), friction: 0.9 });
        continue;
      }
      // A rope bridge: wooden planks joined end to end, so it sags under the bike.
      const count = Math.max(4, Math.round(b.length / 1.0));
      const step = b.length / count;
      const ang = Math.atan2(b.y1 - b.y0, b.length);
      const plankLen = Math.hypot(step, ((b.y1 - b.y0) / b.length) * step);
      b.planks = [];
      let prev = ground;
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count;
        const plank = world.createBody({
          type: 'dynamic',
          position: { x: lerp(b.x0, b.x1, t), y: lerp(b.y0, b.y1, t) - 0.09 },
          angle: ang,
          linearDamping: 0.2,
          angularDamping: 0.5,
        });
        plank.createFixture({ shape: new pl.Box(plankLen / 2, 0.09), density: 1.2, friction: 0.95 });
        const ax = b.x0 + k * step;
        world.createJoint(new pl.RevoluteJoint({}, prev, plank, { x: ax, y: lerp(b.y0, b.y1, k / count) - 0.09 }));
        b.planks.push(plank);
        prev = plank;
      }
      world.createJoint(new pl.RevoluteJoint({}, prev, ground, { x: b.x1, y: b.y1 - 0.09 }));
      b.plankLen = plankLen;
    }
    return ground;
  }
}
