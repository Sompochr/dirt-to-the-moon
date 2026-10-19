// Draws the game world onto a small canvas that the browser scales up without blur.

import { VIEW } from './config.js';
import { C, FRAME_ORIGIN, RIDER_PIVOT, RIDER_HIP, generate } from './sprites.js';
import { drawText } from './font.js';

const PPM = VIEW.ppm;

export const THEMES = {
  meadow: {
    sky: ['#3584dc', '#41a6f6', '#58c3f7', '#73e4f7'],
    far: '#7d9fca',
    farShade: '#6787b8',
    farSnow: '#e8f1f8',
    mid: '#2f8f6a',
    grassTop: C.lime,
    grass: C.green,
    grassDark: C.teal,
    dirt: 'meadow',
    dust: ['#a9714b', '#8b5a3c', '#c99a6e'],
  },
};

function hash(i, seed) {
  let x = Math.imul((i | 0) ^ Math.imul(seed, 0x9e3779b1), 0x27d4eb2d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

function noise(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - s) + hash(i + 1, seed) * s;
}

const mod = (a, n) => ((a % n) + n) % n;

export class Renderer {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.patterns = {};
    this.setSize(480, 270);
  }

  setSize(W, H) {
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx.imageSmoothingEnabled = false;
    this.tops = new Int16Array(W + 2);
    this.skyCache = {};
  }

  // Camera: cam.x / cam.y are the world coordinates (meters) of the screen's top-left corner.
  setCamera(cam) {
    this.cx = Math.round(cam.x * PPM);
    this.cy = Math.round(cam.y * PPM);
    this.refY = cam.refY !== undefined ? Math.round(cam.refY * PPM) : this.cy;
  }
  sx(wx) {
    return wx * PPM - this.cx;
  }
  sy(wy) {
    return this.cy - wy * PPM;
  }

  sky(theme) {
    const key = theme.sky.join();
    if (this.skyCache[key]) return this.skyCache[key];
    const bands = theme.sky;
    const n = bands.length;
    const horizon = this.H * 0.68;
    const bayer = [
      [0, 2],
      [3, 1],
    ];
    const img = generate(this.W, this.H, (x, y) => {
      const t = Math.min(1, y / horizon) * (n - 1);
      let i = Math.floor(t);
      const f = (t - i - 0.7) / 0.3; // dither only near the end of each band
      if (f > 0 && f * 4 > bayer[y & 1][x & 1] + 0.5) i++;
      return bands[Math.min(n - 1, i)];
    });
    this.skyCache[key] = img;
    return img;
  }

  drawBackground(theme, t) {
    const { ctx, W, H, sprites } = this;
    ctx.drawImage(this.sky(theme), 0, 0);
    ctx.drawImage(sprites.sun, Math.round(W * 0.78), 22);

    const span = W + 160;
    for (let i = 0; i < 5; i++) {
      const cl = sprites.clouds[i % 3];
      const x = mod(i * (span / 5) - this.cx * 0.04 - t * 2, span) - 80;
      ctx.drawImage(cl, Math.round(x), Math.round(14 + hash(i, 5) * 46));
    }

    const lift = Math.max(-30, Math.min(30, (this.cy - this.refY) * 0.08));

    // Far mountains
    const farBase = H * 0.62 + lift;
    const fx = this.cx * 0.1;
    const farH = (x) => noise(x / 70, 11) * 52 + noise(x / 23, 12) * 14 + 4;
    for (let x = 0; x < W; x += 2) {
      const h = farH(fx + x);
      const top = Math.round(farBase - h);
      ctx.fillStyle = farH(fx + x + 3) < h ? theme.farShade : theme.far;
      ctx.fillRect(x, top, 2, H - top);
      if (h > 50) {
        ctx.fillStyle = theme.farSnow;
        ctx.fillRect(x, top, 2, Math.min(4, Math.round(h - 49)));
      }
    }

    // Mid hills with trees
    const midBase = H * 0.76 + lift * 1.6;
    const mx = this.cx * 0.3;
    const midH = (x) => noise(x / 46, 21) * 28 + noise(x / 13, 22) * 6;
    ctx.fillStyle = theme.mid;
    for (let x = 0; x < W; x += 2) {
      const top = Math.round(midBase - midH(mx + x));
      ctx.fillRect(x, top, 2, H - top);
    }
    const slot = 22;
    for (let k = Math.floor(mx / slot) - 1; k * slot - mx < W + slot; k++) {
      if (hash(k, 33) > 0.5) continue;
      const tree = sprites.trees[Math.floor(hash(k, 34) * sprites.trees.length)];
      const x = Math.round(k * slot + hash(k, 35) * 12 - mx);
      const top = Math.round(midBase - midH(mx + x));
      ctx.drawImage(tree, x - (tree.width >> 1), top - tree.height + 3);
    }
  }

  dirtPattern(theme) {
    if (!this.patterns[theme.dirt]) {
      this.patterns[theme.dirt] = this.ctx.createPattern(this.sprites.dirt[theme.dirt], 'repeat');
    }
    return this.patterns[theme.dirt];
  }

  drawTerrain(terrain, theme) {
    const { ctx, W, H, tops } = this;
    for (let x = 0; x <= W; x++) {
      tops[x] = Math.round(this.cy - terrain.groundAt((this.cx + x + 0.5) / PPM) * PPM);
    }
    ctx.beginPath();
    ctx.moveTo(0, H + 1);
    for (let x = 0; x <= W; x++) {
      ctx.lineTo(x, tops[x]);
      ctx.lineTo(x + 1, tops[x]);
    }
    ctx.lineTo(W + 1, H + 1);
    ctx.closePath();
    ctx.save();
    ctx.translate(-mod(this.cx, 32), mod(this.cy, 32));
    ctx.fillStyle = this.dirtPattern(theme);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = theme.grassDark;
    for (let x = 0; x <= W; x++) ctx.fillRect(x, tops[x] + 3, 1, 2 + Math.floor(hash(this.cx + x, 7) * 3));
    ctx.fillStyle = theme.grass;
    for (let x = 0; x <= W; x++) ctx.fillRect(x, tops[x] + 1, 1, 3);
    ctx.fillStyle = theme.grassTop;
    for (let x = 0; x <= W; x++) ctx.fillRect(x, tops[x], 1, 1);
  }

  drawRamps(terrain) {
    const { ctx, W, tops } = this;
    for (const r of terrain.ramps) {
      const ax = Math.round(this.sx(r.x0));
      const bx = Math.round(this.sx(r.x1));
      if (bx < 0 || ax > W) continue;
      const ay = this.sy(r.y0);
      const by = this.sy(r.y1);
      for (let x = Math.max(0, ax); x <= Math.min(W, bx); x++) {
        const y = Math.round(ay + ((by - ay) * (x - ax)) / (bx - ax));
        const bottom = tops[x] + 2;
        ctx.fillStyle = (x - ax) % 12 < 2 || x >= bx - 2 ? '#5c3520' : '#8f5a36';
        ctx.fillRect(x, y, 1, bottom - y);
        ctx.fillStyle = '#d79b63';
        ctx.fillRect(x, y, 1, 2);
        ctx.fillStyle = '#5c3520';
        ctx.fillRect(x, y + 2, 1, 1);
      }
    }
  }

  drawProps(terrain) {
    const { ctx, W, tops, sprites } = this;
    const x0 = this.cx / PPM - 1;
    const x1 = (this.cx + W) / PPM + 1;
    for (const p of terrain.props) {
      if (p.x < x0 || p.x > x1) continue;
      let img = sprites.props[p.kind];
      if (Array.isArray(img)) img = img[Math.floor(p.v * img.length)];
      const x = Math.round(this.sx(p.x));
      if (x < 0 || x > W) continue;
      ctx.drawImage(img, x - (img.width >> 1), tops[x] - img.height + 1);
    }
  }

  drawItems(terrain, t) {
    const { ctx, W, sprites } = this;
    const x0 = this.cx / PPM - 1;
    const x1 = (this.cx + W) / PPM + 1;
    const seq = [0, 1, 2, 3, 2, 1];
    for (const c of terrain.coins) {
      if (c.taken || c.x < x0 || c.x > x1) continue;
      const f = sprites.coin[seq[Math.floor(t * 10 + c.x * 0.7) % seq.length]];
      ctx.drawImage(f, Math.round(this.sx(c.x)) - 4, Math.round(this.sy(c.y)) - 4);
    }
    for (const f of terrain.fuels) {
      if (f.taken || f.x < x0 || f.x > x1) continue;
      const img = sprites.fuelCan;
      const bob = Math.round(Math.sin(t * 3 + f.x) * 1.5);
      ctx.drawImage(img, Math.round(this.sx(f.x)) - 5, Math.round(this.sy(f.y)) - 6 + bob);
    }
  }

  drawFinish(terrain) {
    const { ctx, W } = this;
    const fx = terrain.finishX;
    const cxp = Math.round(this.sx(fx));
    if (cxp < -80 || cxp > W + 80) return;
    const gy = Math.round(this.sy(terrain.groundAt(fx)));
    const half = 46;
    const poleH = 84;
    // Checkered line on the ground
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? C.black : C.white;
      ctx.fillRect(cxp - 2, gy + i * 2, 4, 2);
    }
    // Poles
    for (const px of [cxp - half, cxp + half]) {
      const g = Math.round(this.sy(terrain.groundAt((this.cx + px) / PPM)));
      ctx.fillStyle = C.dark;
      ctx.fillRect(px - 1, g - poleH, 3, poleH + 2);
      ctx.fillStyle = C.silver;
      ctx.fillRect(px - 1, g - poleH, 1, poleH + 2);
    }
    // Banner
    const by = gy - poleH;
    ctx.fillStyle = C.black;
    ctx.fillRect(cxp - half - 1, by - 1, half * 2 + 3, 19);
    for (let x = 0; x < half * 2 + 1; x += 2) {
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = (x / 2 + y) % 2 ? C.black : C.white;
        ctx.fillRect(cxp - half + x, by + y * 2, 2, 2);
        ctx.fillRect(cxp - half + x, by + 13 + y * 2, 2, 2);
      }
    }
    ctx.fillStyle = '#d8434e';
    ctx.fillRect(cxp - half, by + 4, half * 2 + 1, 9);
    drawText(ctx, 'FINISH', cxp, by + 5, { color: C.white, align: 'center', shadow: C.purple });
  }

  drawBike(bike, lean) {
    const { ctx, sprites } = this;
    const place = (body) => {
      const p = body.getPosition();
      ctx.translate(Math.round(this.sx(p.x)), Math.round(this.sy(p.y)));
      ctx.rotate(-body.getAngle());
    };
    for (const w of [bike.rear, bike.front]) {
      ctx.save();
      place(w);
      ctx.drawImage(sprites.wheel, -8.5, -8.5);
      ctx.restore();
    }
    ctx.save();
    place(bike.chassis);
    ctx.drawImage(sprites.frame, -FRAME_ORIGIN.x, -FRAME_ORIGIN.y);
    ctx.translate(RIDER_HIP.x, RIDER_HIP.y);
    ctx.rotate(lean);
    ctx.drawImage(sprites.rider, -RIDER_PIVOT.x, -RIDER_PIVOT.y);
    ctx.restore();
  }

  drawParticles(particles) {
    const { ctx } = this;
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(this.sx(p.x)), Math.round(this.sy(p.y)), p.size, p.size);
    }
  }

  // Everything except the bike.
  drawScene(terrain, theme, t) {
    this.drawBackground(theme, t);
    this.drawTerrain(terrain, theme);
    this.drawRamps(terrain);
    this.drawProps(terrain);
    this.drawFinish(terrain);
    this.drawItems(terrain, t);
  }
}
