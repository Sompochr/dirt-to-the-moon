// Draws the game world onto a small canvas that the browser scales up without blur.

import { VIEW } from './config.js';
import { C, FRAME_ORIGIN, RIDER_PIVOT, RIDER_HIP, generate } from './sprites.js';
import { drawText } from './font.js';
import { hash, noise, mod, lerp } from './util.js';

const PPM = VIEW.ppm;
const WOOD = { light: '#d79b63', mid: '#a0663f', dark: '#6b4a2e', deep: '#3f2a1a' };

export class Renderer {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.patterns = {};
    this.shade = document.createElement('canvas');
    this.setSize(480, 270);
  }

  setSize(W, H) {
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx.imageSmoothingEnabled = false;
    this.shade.width = W;
    this.shade.height = H;
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

  // A 1px line drawn pixel by pixel so it stays crisp.
  pixelLine(x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      this.ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
    }
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

  // ---------- Background ----------
  drawBackground(theme, t) {
    const { ctx, W, H, sprites } = this;
    ctx.drawImage(this.sky(theme), 0, 0);
    const lift = Math.max(-30, Math.min(30, (this.cy - this.refY) * 0.08));

    if (theme.stars) this.drawStars(t);
    if (theme.earth) ctx.drawImage(sprites.earth, Math.round(W * 0.76), 20);
    if (theme.sun === 'day') ctx.drawImage(sprites.sun, Math.round(W * 0.78), 22);
    if (theme.sun === 'sunset') {
      ctx.drawImage(sprites.sun, Math.round(W * 0.7), Math.round(H * 0.36 + lift * 0.5), 34, 34);
    }
    if (theme.clouds) {
      const span = W + 160;
      for (let i = 0; i < 5; i++) {
        const cl = sprites.clouds[i % 3];
        const x = mod(i * (span / 5) - this.cx * 0.04 - t * 2, span) - 80;
        ctx.globalAlpha = theme.sun === 'sunset' ? 0.55 : 1;
        ctx.drawImage(cl, Math.round(x), Math.round(14 + hash(i, 5) * 46));
      }
      ctx.globalAlpha = 1;
    }

    this.drawFar(theme.far, H * 0.62 + lift);
    this.drawMid(theme.mid, H * 0.76 + lift * 1.6, t);
    if (theme.ceiling) this.drawCeiling();
  }

  drawStars(t) {
    const { ctx, W, H } = this;
    for (let i = 0; i < 90; i++) {
      const x = Math.round(mod(hash(i, 1) * (W + 40) - this.cx * 0.02, W + 40) - 20);
      const y = Math.round(hash(i, 2) * H * 0.6);
      const twinkle = hash(i, Math.floor(t * 2) + 100) > 0.92;
      ctx.fillStyle = twinkle ? C.gray : hash(i, 3) > 0.8 ? C.yellow : C.white;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  drawFar(far, base) {
    const { ctx, W, H } = this;
    const fx = this.cx * 0.1;
    if (far.type === 'cavewall') {
      ctx.fillStyle = far.color;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = far.shade;
      for (let x = 0; x < W; x += 2) {
        for (let k = 0; k < 12; k++) {
          const y = Math.round(k * 24 + noise((fx + x) / 30, 40 + k) * 10 - 20);
          ctx.fillRect(x, y, 2, 2 + Math.round(hash(Math.floor((fx + x) / 6), k) * 3));
        }
      }
      return;
    }
    const step = far.type === 'mesas' ? 9 : 0;
    const height = (x) => {
      const h = noise(x / 70, 11) * 52 + noise(x / 23, 12) * 14 + 4;
      return step ? Math.round(h / step) * step : h;
    };
    for (let x = 0; x < W; x += 2) {
      const h = height(fx + x);
      const top = Math.round(base - h);
      ctx.fillStyle = height(fx + x + 3) < h ? far.shade : far.color;
      ctx.fillRect(x, top, 2, H - top);
      if (far.cap && (step ? height(fx + x - 2) === h : h > 50)) {
        ctx.fillStyle = far.cap;
        ctx.fillRect(x, top, 2, step ? 2 : Math.min(4, Math.round(h - 49)));
      }
    }
  }

  drawMid(mid, base, t) {
    const { ctx, W, H, sprites } = this;
    const mx = this.cx * 0.3;
    let height;
    if (mid.type === 'terraces') height = (x) => Math.round((noise(x / 46, 21) * 30 + 4) / 7) * 7;
    else if (mid.type === 'stalagmites') {
      height = (x) => {
        const cell = Math.floor(x / 14);
        const local = (x / 14) % 1;
        return 8 + noise(x / 30, 23) * 12 + hash(cell, 24) * 34 * Math.max(0, 1 - Math.abs(local - 0.5) * 2.2);
      };
    } else height = (x) => noise(x / 46, 21) * 28 + noise(x / 13, 22) * 6;

    ctx.fillStyle = mid.color;
    for (let x = 0; x < W; x += 2) {
      const top = Math.round(base - height(mx + x));
      ctx.fillRect(x, top, 2, H - top);
    }

    const decor = mid.decor;
    if (!decor) return;
    const slot = decor === 'trees' ? 22 : 80;
    const chance = decor === 'trees' ? 0.5 : 0.4;
    for (let k = Math.floor(mx / slot) - 1; k * slot - mx < W + slot; k++) {
      if (hash(k, 33) > chance) continue;
      let img;
      if (decor === 'trees') img = sprites.trees[Math.floor(hash(k, 34) * sprites.trees.length)];
      else if (decor === 'headframes') img = sprites.headframe;
      else img = sprites.dome;
      const x = Math.round(k * slot + hash(k, 35) * 12 - mx);
      const top = Math.round(base - height(mx + x));
      ctx.drawImage(img, x - (img.width >> 1), top - img.height + 3);
      if (decor === 'domes' && Math.floor(t * 2 + k) % 2) {
        ctx.fillStyle = '#ff5050';
        ctx.fillRect(x - (img.width >> 1) + 30, top - img.height + 7, 1, 1);
      }
    }
  }

  drawCeiling() {
    const { ctx, W } = this;
    const cxp = this.cx * 0.85;
    for (let x = 0; x < W; x += 2) {
      const wx = cxp + x;
      const cell = Math.floor(wx / 16);
      const local = (wx / 16) % 1;
      const spike = hash(cell, 77) > 0.45 ? Math.max(0, 1 - Math.abs(local - 0.5) * 2.4) * hash(cell, 78) * 26 : 0;
      const d = Math.round(12 + noise(wx / 40, 76) * 16 + spike);
      ctx.fillStyle = '#0a0910';
      ctx.fillRect(x, 0, 2, d);
      ctx.fillStyle = '#2d2642';
      ctx.fillRect(x, d, 2, 1);
    }
  }

  // ---------- Ground ----------
  dirtPattern(tile) {
    if (!this.patterns[tile]) this.patterns[tile] = this.ctx.createPattern(this.sprites.dirt[tile], 'repeat');
    return this.patterns[tile];
  }

  drawTerrain(terrain, theme) {
    const { ctx, W, H, tops } = this;
    const G = theme.ground;
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
    ctx.fillStyle = this.dirtPattern(G.tile);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = G.dark;
    for (let x = 0; x <= W; x++) ctx.fillRect(x, tops[x] + 3, 1, 2 + Math.floor(hash(this.cx + x, 7) * 3));
    ctx.fillStyle = G.mid;
    for (let x = 0; x <= W; x++) ctx.fillRect(x, tops[x] + 1, 1, 3);
    ctx.fillStyle = G.top;
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
        ctx.fillStyle = (x - ax) % 12 < 2 || x >= bx - 2 ? WOOD.deep : '#8f5a36';
        ctx.fillRect(x, y, 1, tops[x] + 2 - y);
        ctx.fillStyle = WOOD.light;
        ctx.fillRect(x, y, 1, 2);
        ctx.fillStyle = WOOD.deep;
        ctx.fillRect(x, y + 2, 1, 1);
      }
    }
  }

  drawBridges(terrain) {
    const { ctx, W, tops } = this;
    for (const b of terrain.bridges) {
      const ax = Math.round(this.sx(b.x0));
      const bx = Math.round(this.sx(b.x1));
      if (bx < -10 || ax > W + 10) continue;
      const ay = this.sy(b.y0);
      const by = this.sy(b.y1);
      const deckY = (x) => Math.round(ay + ((by - ay) * (x - ax)) / (bx - ax));

      if (b.type === 'rail') {
        // Trestle legs with cross braces, then the deck, ties and rails.
        let prev = null;
        for (let x = ax; x <= bx; x += 24) {
          const px = Math.min(x, bx - 2);
          if (px >= -4 && px <= W + 4) {
            const top = deckY(px) + 3;
            const g = tops[Math.max(0, Math.min(W, px))];
            ctx.fillStyle = WOOD.dark;
            ctx.fillRect(px, top, 2, g - top + 2);
            if (prev) {
              ctx.fillStyle = WOOD.deep;
              const low = Math.min(g, prev.g) - 2;
              this.pixelLine(prev.x + 1, prev.top, px, low);
              this.pixelLine(prev.x + 1, low, px, top);
            }
            prev = { x: px, top, g };
          }
        }
        for (let x = Math.max(0, ax); x <= Math.min(W, bx); x++) {
          const y = deckY(x);
          ctx.fillStyle = WOOD.dark;
          ctx.fillRect(x, y + 2, 1, 2);
          if ((x - ax) % 5 < 3) {
            ctx.fillStyle = WOOD.deep;
            ctx.fillRect(x, y + 1, 1, 2);
          }
          ctx.fillStyle = C.silver;
          ctx.fillRect(x, y, 1, 1);
        }
        continue;
      }

      // Wooden rope bridge: posts at both ends and planks that follow the physics.
      for (const [px, py] of [
        [ax, ay],
        [bx, by],
      ]) {
        ctx.fillStyle = WOOD.deep;
        ctx.fillRect(px - 2, Math.round(py) - 18, 3, 22);
        ctx.fillStyle = WOOD.light;
        ctx.fillRect(px - 2, Math.round(py) - 18, 1, 22);
      }
      const count = b.planks ? b.planks.length : Math.max(4, Math.round(b.length));
      const len = b.plankLen || b.length / count;
      for (let k = 0; k < count; k++) {
        let x;
        let y;
        let a;
        if (b.planks) {
          const p = b.planks[k].getPosition();
          x = p.x;
          y = p.y;
          a = b.planks[k].getAngle();
        } else {
          const t = (k + 0.5) / count;
          x = lerp(b.x0, b.x1, t);
          y = lerp(b.y0, b.y1, t) - 0.09;
          a = Math.atan2(b.y1 - b.y0, b.length);
        }
        ctx.save();
        ctx.translate(Math.round(this.sx(x)), Math.round(this.sy(y)));
        ctx.rotate(-a);
        const w = Math.round(len * PPM);
        ctx.fillStyle = WOOD.deep;
        ctx.fillRect(-w / 2, -2, w, 4);
        ctx.fillStyle = WOOD.mid;
        ctx.fillRect(-w / 2 + 1, -2, w - 2, 3);
        ctx.fillStyle = WOOD.light;
        ctx.fillRect(-w / 2 + 1, -2, w - 2, 1);
        ctx.restore();
      }
      // Ropes from post tops down to the middle of the deck
      ctx.fillStyle = '#c99a6e';
      const mid = b.planks ? b.planks[Math.floor(count / 2)].getPosition() : { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
      const mx = Math.round(this.sx(mid.x));
      const my = Math.round(this.sy(mid.y)) - 8;
      this.pixelLine(ax - 1, Math.round(ay) - 17, mx, my);
      this.pixelLine(mx, my, bx - 1, Math.round(by) - 17);
    }
  }

  drawBoosts(terrain, t) {
    const { ctx, W, tops } = this;
    for (const p of terrain.boosts) {
      const ax = Math.round(this.sx(p.x0));
      const bx = Math.round(this.sx(p.x1));
      if (bx < 0 || ax > W) continue;
      for (let x = Math.max(0, ax); x <= Math.min(W, bx); x++) {
        ctx.fillStyle = C.black;
        ctx.fillRect(x, tops[x] - 2, 1, 5);
      }
      const lit = Math.floor(t * 12) % 4;
      for (let c = 0, x = ax + 3; x < bx - 3; c++, x += 8) {
        ctx.fillStyle = c % 4 === lit ? C.white : c % 2 ? C.orange : C.yellow;
        for (let i = 0; i < 3; i++) {
          const xx = x + i;
          if (xx < 0 || xx > W) continue;
          ctx.fillRect(xx, tops[xx] - 2 + i, 1, 1);
          ctx.fillRect(xx, tops[xx] + 2 - i, 1, 1);
        }
      }
    }
  }

  // Cave timber frames with a hanging lamp.
  drawLamps(terrain) {
    const { ctx, W, tops } = this;
    for (const l of terrain.lamps) {
      const x = Math.round(this.sx(l.x));
      if (x < -30 || x > W + 30) continue;
      const lp = Math.max(0, Math.min(W, x - 20));
      const rp = Math.max(0, Math.min(W, x + 20));
      const beam = Math.min(tops[lp], tops[rp]) - 70;
      ctx.fillStyle = WOOD.deep;
      ctx.fillRect(x - 21, beam, 3, tops[lp] - beam + 2);
      ctx.fillRect(x + 19, beam, 3, tops[rp] - beam + 2);
      ctx.fillRect(x - 24, beam - 3, 49, 4);
      ctx.fillStyle = WOOD.dark;
      ctx.fillRect(x - 21, beam, 1, tops[lp] - beam + 2);
      ctx.fillRect(x + 19, beam, 1, tops[rp] - beam + 2);
      ctx.fillRect(x - 24, beam - 3, 49, 1);
      ctx.fillStyle = C.dark;
      ctx.fillRect(x, beam + 1, 1, 6);
      ctx.fillStyle = C.black;
      ctx.fillRect(x - 2, beam + 7, 5, 6);
      ctx.fillStyle = C.yellow;
      ctx.fillRect(x - 1, beam + 8, 3, 4);
      l.sy = beam + 10;
    }
  }

  drawProps(terrain) {
    const { ctx, W, tops, sprites } = this;
    const x0 = this.cx / PPM - 1;
    const x1 = (this.cx + W) / PPM + 1;
    for (const p of terrain.props) {
      if (p.x < x0 || p.x > x1) continue;
      let img = sprites.props[p.kind];
      if (!img) continue;
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
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? C.black : C.white;
      ctx.fillRect(cxp - 2, gy + i * 2, 4, 2);
    }
    for (const px of [cxp - half, cxp + half]) {
      const g = Math.round(this.sy(terrain.groundAt((this.cx + px) / PPM)));
      ctx.fillStyle = C.dark;
      ctx.fillRect(px - 1, g - poleH, 3, poleH + 2);
      ctx.fillStyle = C.silver;
      ctx.fillRect(px - 1, g - poleH, 1, poleH + 2);
    }
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

  // Cave darkness with light around the bike, its headlight and the lamps.
  drawDarkness(theme, terrain, bike) {
    if (!theme.darkness) return;
    const { W, H } = this;
    const g = this.shade.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    g.fillStyle = `rgba(4,3,10,${theme.darkness})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    const light = (x, y, r) => {
      for (const [k, a] of [
        [1, 0.35],
        [0.72, 0.65],
        [0.45, 1],
      ]) {
        g.globalAlpha = a;
        g.beginPath();
        g.arc(x, y, r * k, 0, Math.PI * 2);
        g.fill();
      }
    };
    if (bike) {
      const p = bike.chassis.getPosition();
      light(this.sx(p.x), this.sy(p.y) - 8, 46);
      const head = bike.worldPoint({ x: 3.2, y: 0.2 });
      light(this.sx(head.x), this.sy(head.y), 58);
    }
    for (const l of terrain.lamps) {
      const x = this.sx(l.x);
      if (x > -60 && x < W + 60 && l.sy !== undefined) light(x, l.sy, 56);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.shade, 0, 0);
  }

  // Everything except the bike.
  drawScene(terrain, theme, t) {
    this.drawBackground(theme, t);
    this.drawTerrain(terrain, theme);
    this.drawLamps(terrain);
    this.drawBridges(terrain);
    this.drawRamps(terrain);
    this.drawBoosts(terrain, t);
    this.drawProps(terrain);
    this.drawFinish(terrain);
    this.drawItems(terrain, t);
  }
}
