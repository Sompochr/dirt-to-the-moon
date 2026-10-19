// HUD, menus and on-screen buttons, all drawn in pixel art on the game canvas.
// Most text uses scale 2 (14px tall) so it stays readable on a phone.

import { drawText, textWidth } from './font.js';
import { C } from './sprites.js';
import { RULES, UPGRADES } from './config.js';
import { LEVELS } from './levels.js';
import { THEMES } from './themes.js';

const STYLES = {
  primary: { face: C.yellow, base: C.orange, light: '#fff3c4', text: C.black, shadow: null },
  blue: { face: C.sky, base: C.blue, light: C.cyan, text: C.white, shadow: C.navy },
  green: { face: '#5ad06a', base: C.teal, light: C.lime, text: C.white, shadow: C.teal },
  flip: { face: '#ff9d3c', base: C.red, light: C.yellow, text: C.white, shadow: C.purple },
  dark: { face: C.dark, base: C.black, light: C.gray, text: C.white, shadow: C.black },
  off: { face: '#3a4258', base: C.black, light: C.gray, text: C.gray, shadow: null },
};

const UPGRADE_INFO = {
  engine: { name: 'ENGINE', label: 'POWER', value: (l) => `+${Math.round(UPGRADES.engine.torque * 100 * l)}%` },
  fuel: { name: 'FUEL TANK', label: 'TANK', value: (l) => String(RULES.fuelMax + UPGRADES.fuel.tank * l) },
  tires: { name: 'TIRES', label: 'GRIP', value: (l) => `+${Math.round(UPGRADES.tires.grip * 100 * l)}%` },
};

export function fmtTime(sec, tenths = false) {
  const s = tenths ? Math.floor(Math.max(0, sec) * 10) / 10 : Math.ceil(Math.max(0, sec));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  const ss = tenths ? r.toFixed(1).padStart(4, '0') : String(Math.round(r)).padStart(2, '0');
  return `${m}:${ss}`;
}

// Largest scale (up to `max`) at which the text fits in maxW pixels.
function fit(text, maxW, max = 2) {
  for (let s = max; s > 1; s--) if (textWidth(text, s) <= maxW) return s;
  return 1;
}

function panel(ctx, x, y, w, h, fill, border = C.black, light = null) {
  ctx.fillStyle = border;
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (light) {
    ctx.fillStyle = light;
    ctx.fillRect(x + 2, y + 1, w - 4, 1);
  }
}

export class UI {
  constructor(sprites) {
    this.sprites = sprites;
    this.buttons = [];
    this.pressed = new Set();
    this.toastMsg = null;
  }

  begin() {
    this.buttons = [];
  }

  hit(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.h + 3) return b;
    }
    return null;
  }

  // Register a tappable area. Returns true while it is held down.
  area(id, x, y, w, h, onTap, opts = {}) {
    if (opts.interactive !== false) this.buttons.push({ id, x, y, w, h, onTap, instant: !!opts.instant });
    return this.pressed.has(id);
  }

  button(ctx, id, x, y, w, h, label, onTap, opts = {}) {
    x = Math.round(x);
    y = Math.round(y);
    const down = this.area(id, x, y, w, h, onTap, opts);
    const st = STYLES[opts.style || 'primary'];
    const off = down ? 2 : 0;
    panel(ctx, x, y + 2, w, h - 2, st.base);
    panel(ctx, x, y + off, w, h - 2, opts.face || st.face, C.black, st.light);
    const cy = y + off + (h - 2) / 2;
    if (opts.icon) {
      this.icon(ctx, opts.icon, x + w / 2, cy, opts.iconOff);
      return;
    }
    const scale = opts.scale || fit(label, w - 8, 2);
    let tx = x + w / 2;
    if (opts.coin) {
      const tw = textWidth(label, scale) + 18;
      tx = x + w / 2 + 9;
      ctx.drawImage(this.sprites.coin[0], Math.round(x + w / 2 - tw / 2), Math.round(cy - 8), 16, 16);
    }
    drawText(ctx, label, tx, cy - 3.5 * scale, { scale, color: st.text, align: 'center', shadow: st.shadow });
  }

  icon(ctx, name, cx, cy, crossed) {
    const ic = this.sprites.icons;
    if (name === 'pause') {
      ctx.fillStyle = C.white;
      ctx.fillRect(Math.round(cx - 5), Math.round(cy - 7), 4, 14);
      ctx.fillRect(Math.round(cx + 1), Math.round(cy - 7), 4, 14);
      return;
    }
    const img = ic[name];
    const w = img.width * 2;
    const h = img.height * 2;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
    if (crossed) {
      ctx.fillStyle = '#ff5050';
      for (let i = -8; i <= 8; i++) ctx.fillRect(Math.round(cx + i), Math.round(cy + i), 2, 2);
    }
  }

  coins(ctx, x, y, n) {
    ctx.drawImage(this.sprites.coin[0], x, y, 16, 16);
    drawText(ctx, String(n), x + 20, y + 1, { scale: 2, color: C.yellow });
  }

  toast(text) {
    this.toastMsg = { text, age: 0 };
  }

  drawToast(ctx, view, dt) {
    const m = this.toastMsg;
    if (!m) return;
    m.age += dt;
    if (m.age > 1.6) {
      this.toastMsg = null;
      return;
    }
    const s = fit(m.text, view.W - 40, 2);
    const w = textWidth(m.text, s) + 24;
    const x = Math.round(view.W / 2 - w / 2);
    const y = Math.round(view.H * 0.42);
    panel(ctx, x, y, w, 7 * s + 14, C.black, C.white);
    drawText(ctx, m.text, view.W / 2, y + 7, { scale: s, align: 'center', color: C.yellow });
  }

  // Small icon buttons: sound effects, music and, where the browser allows it, fullscreen.
  // fs: 'enter' / 'exit' for the fullscreen button, or null to leave it out.
  // align: where x is, relative to the row ('left', 'center' or 'right').
  iconRow(ctx, x, y, settings, actions, fs, align) {
    const items = [
      ['sfx', 'speaker', !settings.sfx, actions.toggleSfx],
      ['music', 'note', !settings.music, actions.toggleMusic],
    ];
    if (fs) items.push(['fullscreen', fs === 'exit' ? 'exitFullscreen' : 'fullscreen', false, actions.toggleFullscreen]);
    const w = items.length * 34 - 4;
    let bx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    for (const [id, icon, off, onTap] of items) {
      this.button(ctx, id, bx, y, 30, 26, '', onTap, { style: 'dark', icon, iconOff: off });
      bx += 34;
    }
  }

  // ---------- Title ----------
  title(ctx, view, save, actions, t, fs) {
    const { W, H } = view;
    const L = 8 + view.l;
    const R = 8 + view.r;
    ctx.drawImage(this.sprites.moon, Math.round(L + W * 0.06), 40);
    const bob = Math.round(Math.sin(t * 2) * 2);
    drawText(ctx, 'DIRT TO', W / 2, 16 + bob, { scale: 4, align: 'center', color: C.yellow });
    drawText(ctx, 'THE MOON', W / 2, 50 + bob, { scale: 4, align: 'center', color: C.white });

    this.button(ctx, 'play', W / 2 - 75, 94, 150, 36, 'PLAY', actions.play, { scale: 3 });
    this.button(ctx, 'garage', W / 2 - 75, 138, 150, 30, 'GARAGE', actions.garage, { style: 'blue' });

    this.coins(ctx, L, 8, save.coins);
    this.iconRow(ctx, W - R, 6, save.settings, actions, fs, 'right');

    const hint = 'LEFT = BRAKE    RIGHT = GAS';
    drawText(ctx, hint, W / 2, H - 40, { scale: fit(hint, W - 20), align: 'center', color: C.white });
    drawText(ctx, 'V1.0', W - R, H - 12, { align: 'right', color: C.silver });
  }

  // ---------- Level select ----------
  levels(ctx, view, save, actions) {
    const { W, H } = view;
    const L = 8 + view.l;
    const R = 8 + view.r;
    this.dim(ctx, view, 0.45);
    drawText(ctx, 'SELECT LEVEL', W / 2, 8, { scale: 2, align: 'center', color: C.yellow });
    this.coins(ctx, L, 7, save.coins);

    const rw = Math.min(W - L - R, 460);
    const rx = Math.round((W - rw) / 2);
    LEVELS.forEach((lv, i) => {
      const y = 30 + i * 38;
      const unlocked = i === 0 || (save.levels[LEVELS[i - 1].id] || {}).stars > 0;
      const rec = save.levels[lv.id] || { stars: 0, best: null };
      const down = unlocked && this.area(`lvl${lv.id}`, rx, y, rw, 34, () => actions.startLevel(lv.id));
      const off = down ? 2 : 0;
      panel(ctx, rx, y + 2, rw, 32, C.black);
      panel(ctx, rx, y + off, rw, 32, unlocked ? C.navy : '#202538', C.black, unlocked ? C.blue : null);
      // Theme swatch
      const th = THEMES[lv.theme];
      ctx.fillStyle = th.sky[1];
      ctx.fillRect(rx + 4, y + off + 4, 24, 14);
      ctx.fillStyle = th.ground.mid;
      ctx.fillRect(rx + 4, y + off + 18, 24, 6);
      ctx.fillStyle = th.ground.top;
      ctx.fillRect(rx + 4, y + off + 18, 24, 1);
      if (!unlocked) {
        ctx.drawImage(this.sprites.icons.lock, rx + 7, y + off + 6);
      }
      const name = `${lv.id} ${lv.name}`;
      const right = unlocked ? (rec.best !== null ? fmtTime(rec.best, true) : 'NEW') : 'LOCKED';
      const rs = fit(right, 80, 2);
      const nameS = fit(name, rw - 40 - 46 - textWidth(right, rs) - 16, 2);
      drawText(ctx, name, rx + 36, y + off + 16 - 3.5 * nameS, { scale: nameS, color: unlocked ? C.white : C.gray });
      drawText(ctx, right, rx + rw - 8, y + off + 16 - 3.5 * rs, { scale: rs, align: 'right', color: unlocked ? C.silver : C.gray });
      if (unlocked) {
        const sx = rx + rw - 12 - textWidth(right, rs) - 40;
        for (let s = 0; s < 3; s++) ctx.drawImage(s < rec.stars ? this.sprites.star : this.sprites.starEmpty, sx + s * 13, y + off + 11);
      }
    });

    this.button(ctx, 'back', L, H - 36, 110, 30, 'BACK', actions.back, { style: 'blue' });
    this.button(ctx, 'garage', W - R - 110, H - 36, 110, 30, 'GARAGE', actions.garage, { style: 'blue' });
  }

  // ---------- Garage ----------
  // playLabel: the right-hand button, e.g. 'LEVELS', or 'NEXT LEVEL' / 'RETRY' when opened after a run.
  garage(ctx, view, save, actions, playLabel = 'LEVELS') {
    const { W, H } = view;
    const L = 8 + view.l;
    const R = 8 + view.r;
    const sp = this.sprites;
    this.dim(ctx, view, 0.45);
    drawText(ctx, 'GARAGE', W / 2, 8, { scale: 2, align: 'center', color: C.yellow });
    this.coins(ctx, L, 7, save.coins);

    const gap = 8;
    const cw = Math.min(160, Math.floor((W - L - R - gap * 2) / 3));
    const total = cw * 3 + gap * 2;
    const x0 = Math.round((W - total) / 2);
    const y = 30;
    const ch = 186;
    const kinds = ['engine', 'fuel', 'tires'];
    // One text size per row across all three cards, so the cards look alike.
    const rowScale = (textOf) => Math.min(...kinds.map((k) => fit(textOf(k, UPGRADE_INFO[k], save.upgrades[k] || 0), cw - 8, 2)));
    const ns = rowScale((k, info) => info.name);
    const es = rowScale((k, info, l) => `${info.label} ${info.value(l)}`);
    const nx = rowScale((k, info, l) => `NEXT ${info.value(Math.min(5, l + 1))}`);
    kinds.forEach((kind, i) => {
      const x = x0 + i * (cw + gap);
      const lvl = save.upgrades[kind] || 0;
      const info = UPGRADE_INFO[kind];
      panel(ctx, x, y, cw, ch, C.navy, C.black, C.blue);
      const cx = x + cw / 2;
      // Icon
      if (kind === 'engine') ctx.drawImage(sp.icons.engine, Math.round(cx - 13), y + 12, 26, 22);
      else if (kind === 'fuel') ctx.drawImage(sp.fuelCan, Math.round(cx - 10), y + 10, 20, 24);
      else ctx.drawImage(sp.wheel, Math.round(cx - 17), y + 6, 34, 34);
      drawText(ctx, info.name, cx, y + 48, { scale: ns, align: 'center', color: C.white });
      // Level pips
      const pw = 14;
      const px0 = Math.round(cx - (pw * 5 + 3 * 4) / 2);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = C.black;
        ctx.fillRect(px0 + k * (pw + 3), y + 70, pw, 9);
        ctx.fillStyle = k < lvl ? C.lime : C.dark;
        ctx.fillRect(px0 + k * (pw + 3) + 1, y + 71, pw - 2, 7);
      }
      const eff = `${info.label} ${info.value(lvl)}`;
      drawText(ctx, eff, cx, y + 88, { scale: es, align: 'center', color: lvl ? C.lime : C.silver });
      if (lvl < 5) {
        const next = `NEXT ${info.value(lvl + 1)}`;
        drawText(ctx, next, cx, y + 108, { scale: nx, align: 'center', color: C.silver });
        const cost = UPGRADES.cost[lvl];
        const afford = save.coins >= cost;
        this.button(ctx, `buy-${kind}`, x + 8, y + ch - 44, cw - 16, 34, String(cost), () => actions.buy(kind), {
          style: afford ? 'green' : 'off',
          coin: true,
          scale: 2,
        });
      } else {
        drawText(ctx, 'MAX LEVEL', cx, y + ch - 32, { scale: fit('MAX LEVEL', cw - 8), align: 'center', color: C.yellow });
      }
    });

    this.button(ctx, 'back', L, H - 36, 110, 30, 'BACK', actions.garageBack, { style: 'blue' });
    const pw = Math.max(110, textWidth(playLabel, 2) + 20);
    this.button(ctx, 'garage-play', W - R - pw, H - 36, pw, 30, playLabel, actions.garagePlay, {
      style: playLabel === 'LEVELS' ? 'blue' : 'green',
    });
  }

  // ---------- In-game HUD ----------
  pedal(ctx, x, y, label, down, color) {
    const w = 84;
    const h = 58;
    const off = down ? 2 : 0;
    ctx.globalAlpha = down ? 0.95 : 0.6;
    panel(ctx, x, y + 2, w, h - 2, C.black);
    panel(ctx, x, y + off, w, h - 2, down ? color : C.dark, C.black, down ? C.white : C.gray);
    ctx.fillStyle = down ? C.white : C.gray;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 9, y + off + 7 + i * 5, w - 18, 2);
    drawText(ctx, label, x + w / 2, y + off + h - 22, { scale: 2, color: C.white, align: 'center' });
    ctx.globalAlpha = 1;
  }

  hud(ctx, run, view, actions, t, interactive) {
    const { W, H } = view;
    const L = 6 + view.l;
    const R = 6 + view.r;
    const sp = this.sprites;
    const blink = Math.floor(t * 4) % 2 === 0;

    // Fuel
    const ff = run.fuel / run.fuelMax;
    ctx.drawImage(sp.fuelIcon, L, 5, 14, 16);
    const bw = Math.min(96, Math.round(W * 0.18));
    panel(ctx, L + 18, 6, bw + 2, 14, C.black);
    ctx.fillStyle = C.dark;
    ctx.fillRect(L + 19, 7, bw, 12);
    ctx.fillStyle = ff < 0.2 ? (blink ? '#ff5050' : C.red) : ff < 0.45 ? C.yellow : C.lime;
    ctx.fillRect(L + 19, 7, Math.round(bw * ff), 12);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(L + 19, 7, Math.round(bw * ff), 3);

    // Coins
    this.coins(ctx, L, 26, run.coins);
    if (ff < 0.2 && blink && run.running) drawText(ctx, 'LOW FUEL', L, 47, { scale: 2, color: '#ff6b6b' });

    // Time left
    const tl = fmtTime(run.timeLeft);
    const low = run.timeLeft <= 10 && run.running;
    const tw = textWidth(tl, 3);
    ctx.drawImage(sp.clock, Math.round(W / 2 - tw / 2 - 20), 8, 14, 14);
    drawText(ctx, tl, W / 2, 4, { scale: 3, color: low && blink ? '#ff6b6b' : C.white, align: 'center' });

    // Progress to the finish
    const pw = Math.min(150, Math.round(W * 0.28));
    const bx = Math.round(W / 2 - pw / 2);
    const by = 30;
    ctx.fillStyle = C.black;
    ctx.fillRect(bx - 1, by - 1, pw + 2, 6);
    ctx.fillStyle = C.dark;
    ctx.fillRect(bx, by, pw, 4);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(bx, by, Math.round(pw * run.progress), 4);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? C.black : C.white;
      ctx.fillRect(bx + pw + 2, by - 3 + i * 3, 3, 3);
      ctx.fillStyle = i % 2 ? C.white : C.black;
      ctx.fillRect(bx + pw + 5, by - 3 + i * 3, 3, 3);
    }
    const mx = bx + Math.round(pw * run.progress);
    ctx.fillStyle = C.black;
    ctx.fillRect(mx - 2, by - 4, 5, 11);
    ctx.fillStyle = '#d8434e';
    ctx.fillRect(mx - 1, by - 3, 3, 9);

    // Pause
    this.button(ctx, 'pause', W - R - 32, 4, 32, 28, '', actions.pause, { style: 'dark', icon: 'pause', instant: true, interactive });

    // Pedals
    this.pedal(ctx, L, H - 62, 'BRAKE', run.brake, '#d8434e');
    this.pedal(ctx, W - R - 84, H - 62, 'GAS', run.gas, C.green);

    // Flip button
    if (run.canFlip) {
      this.button(ctx, 'flip', W / 2 - 70, H * 0.46, 140, 44, 'FLIP', actions.flip, {
        style: 'flip',
        scale: 3,
        instant: true,
        interactive,
        face: blink ? '#ff9d3c' : C.yellow,
      });
      drawText(ctx, `-${RULES.flipPenalty} SEC`, W / 2, H * 0.46 + 48, { scale: 2, align: 'center', color: C.white });
    }

    // Countdown and first-time hints
    if (interactive && run.state === 'countdown') {
      const title = `LEVEL ${run.level.id}: ${run.level.name}`;
      drawText(ctx, title, W / 2, 78, { scale: fit(title, W - 40), align: 'center', color: C.white });
      drawText(ctx, String(Math.ceil(run.countdown)), W / 2, 98, { scale: 5, align: 'center', color: C.yellow });
    }
    if (interactive && (run.state === 'countdown' || (run.running && run.elapsed < 3))) {
      const a = 'IN THE AIR: GAS = LEAN BACK';
      const b = 'BRAKE = LEAN FORWARD';
      drawText(ctx, a, W / 2, 42, { scale: fit(a, W - 40), align: 'center', color: C.cyan });
      drawText(ctx, b, W / 2, 58, { scale: fit(b, W - 40), align: 'center', color: C.cyan });
      drawText(ctx, 'HOLD LEFT', L, H - 98, { scale: 2, color: C.white });
      drawText(ctx, 'TO BRAKE', L, H - 81, { scale: 2, color: C.white });
      drawText(ctx, 'HOLD RIGHT', W - R, H - 98, { scale: 2, color: C.white, align: 'right' });
      drawText(ctx, 'TO GAS', W - R, H - 81, { scale: 2, color: C.white, align: 'right' });
    }
  }

  floaters(ctx, run, renderer, view) {
    const { W, H } = view;
    for (const f of run.floaters) {
      const k = f.age / f.life;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      const color = f.kind === 'bad' ? '#ff6b6b' : f.kind === 'good' ? C.lime : C.yellow;
      if (f.kind === 'big') {
        drawText(ctx, f.text, W / 2, H * 0.3 - f.age * 12, { scale: 5, align: 'center', color });
      } else if (f.wx !== undefined) {
        drawText(ctx, f.text, renderer.sx(f.wx), renderer.sy(f.wy) - f.age * 22, { scale: 2, align: 'center', color });
      } else {
        drawText(ctx, f.text, W / 2, H * 0.36 - f.age * 14, { scale: 3, align: 'center', color });
      }
    }
    ctx.globalAlpha = 1;
  }

  dim(ctx, view, a = 0.6) {
    ctx.fillStyle = `rgba(26,28,44,${a})`;
    ctx.fillRect(0, 0, view.W, view.H);
  }

  pause(ctx, view, actions, settings, fs) {
    const { W, H } = view;
    this.dim(ctx, view);
    const pw = 200;
    const ph = 176;
    const px = Math.round((W - pw) / 2);
    const py = Math.round((H - ph) / 2);
    panel(ctx, px, py, pw, ph, C.navy, C.black, C.blue);
    drawText(ctx, 'PAUSED', W / 2, py + 10, { scale: 3, align: 'center', color: C.yellow });
    this.button(ctx, 'resume', px + 20, py + 40, pw - 40, 30, 'RESUME', actions.resume);
    this.button(ctx, 'restart', px + 20, py + 74, pw - 40, 30, 'RESTART', actions.retry, { style: 'blue' });
    this.button(ctx, 'menu', px + 20, py + 108, pw - 40, 30, 'LEVELS', actions.levels, { style: 'blue' });
    this.iconRow(ctx, W / 2, py + 142, settings, actions, fs, 'center');
  }

  result(ctx, run, info, view, actions, t, save) {
    const { W, H } = view;
    const sp = this.sprites;
    this.dim(ctx, view);
    const pw = Math.min(W - 16, 310);
    const ph = 232;
    const px = Math.round((W - pw) / 2);
    const py = Math.round((H - ph) / 2);
    panel(ctx, px, py, pw, ph, C.navy, C.black, C.blue);
    const won = run.state === 'finished';
    const head = won ? 'FINISH!' : run.failReason;
    drawText(ctx, head, W / 2, py + 10, { scale: fit(head, pw - 16, 3), align: 'center', color: won ? C.yellow : '#ff6b6b' });

    let y = py + 38;
    if (won) {
      const age = t - info.shownAt;
      for (let i = 0; i < 3; i++) {
        const lit = i < run.stars && age > 0.3 + i * 0.3;
        ctx.drawImage(lit ? sp.star : sp.starEmpty, Math.round(W / 2 - 40 + i * 28), y, 22, 20);
      }
    } else {
      const tip = run.failReason.startsWith('OUT') ? 'GRAB THE RED FUEL CANS' : 'KEEP THE GAS DOWN';
      drawText(ctx, tip, W / 2, y + 3, { scale: fit(tip, pw - 16), align: 'center', color: C.cyan });
    }
    y += 28;

    const row = (label, value, color = C.white) => {
      drawText(ctx, label, px + 16, y, { scale: 2, color: C.silver });
      drawText(ctx, value, px + pw - 16, y, { scale: 2, color, align: 'right' });
      y += 18;
    };
    row('TIME', fmtTime(run.elapsed, true), won ? C.white : C.gray);
    const best = info.best === null || info.best === undefined ? '-' : fmtTime(info.best, true);
    row(info.newBest && Math.floor(t * 3) % 2 === 0 ? 'NEW BEST!' : 'BEST', best, info.newBest ? C.lime : C.white);
    row('COINS', `+${run.coins}`, C.yellow);
    row('TOTAL', String(info.total), C.yellow);
    const [two, three] = run.level.starTimes;
    const goal = `** ${fmtTime(two)}   *** ${fmtTime(three)}`;
    drawText(ctx, goal, W / 2, y + 2, { scale: fit(goal, pw - 16), align: 'center', color: C.gray, shadow: null });

    // Buttons in a 2x2 grid: main action and UPGRADE on top, the rest below.
    const bw = Math.floor((pw - 24) / 2);
    const c1 = px + 8;
    const c2 = c1 + bw + 8;
    const r1 = py + 160;
    const r2 = py + 194;
    const retry = won ? 'AGAIN' : 'RETRY';
    if (won && info.nextId) {
      this.button(ctx, 'next', c1, r1, bw, 30, 'NEXT', actions.next, { style: 'green' });
      this.button(ctx, 'retry', c1, r2, bw, 30, retry, actions.retry, { style: 'blue' });
      this.button(ctx, 'menu', c2, r2, bw, 30, 'LEVELS', actions.levels, { style: 'blue' });
    } else {
      this.button(ctx, 'retry', c1, r1, bw, 30, retry, actions.retry);
      this.button(ctx, 'menu', c1, r2, pw - 16, 30, 'LEVELS', actions.levels, { style: 'blue' });
    }
    this.button(ctx, 'upgrade', c2, r1, bw, 30, 'UPGRADE', actions.garage, { style: 'flip' });
    // A blinking "!" when the player has enough coins for an upgrade
    const affordable = ['engine', 'fuel', 'tires'].some((k) => {
      const l = save.upgrades[k] || 0;
      return l < UPGRADES.cost.length && save.coins >= UPGRADES.cost[l];
    });
    if (affordable && Math.floor(t * 3) % 2 === 0) {
      const bx = c2 + bw - 6;
      const by = r1 - 6;
      panel(ctx, bx - 1, by - 1, 14, 14, C.yellow, C.black);
      drawText(ctx, '!', bx + 6, by + 2, { align: 'center', color: C.black, shadow: null });
    }
  }

  rotate(ctx, view, t) {
    const { W, H } = view;
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, H);
    const a = (Math.min(1, (t % 2.4) / 1.2) * Math.PI) / 2;
    ctx.save();
    ctx.translate(Math.round(W / 2), Math.round(H * 0.4));
    ctx.rotate(-a);
    panel(ctx, -14, -24, 28, 48, C.gray, C.white);
    ctx.fillStyle = C.sky;
    ctx.fillRect(-11, -19, 22, 36);
    ctx.restore();
    drawText(ctx, 'ROTATE YOUR', W / 2, H * 0.62, { scale: 2, align: 'center', color: C.yellow });
    drawText(ctx, 'PHONE', W / 2, H * 0.62 + 20, { scale: 2, align: 'center', color: C.yellow });
    drawText(ctx, 'THIS GAME PLAYS', W / 2, H * 0.62 + 46, { align: 'center', color: C.silver });
    drawText(ctx, 'IN LANDSCAPE', W / 2, H * 0.62 + 56, { align: 'center', color: C.silver });
  }
}
