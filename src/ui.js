// HUD, menus and on-screen buttons, all drawn in pixel art on the game canvas.

import { drawText, textWidth } from './font.js';
import { C } from './sprites.js';
import { RULES } from './config.js';

const STYLES = {
  primary: { face: C.yellow, base: C.orange, light: '#fff3c4', text: C.black, shadow: null },
  blue: { face: C.sky, base: C.blue, light: C.cyan, text: C.white, shadow: C.navy },
  flip: { face: '#ff9d3c', base: C.red, light: C.yellow, text: C.white, shadow: C.purple },
  dark: { face: C.dark, base: C.black, light: C.gray, text: C.white, shadow: C.black },
};

export function fmtTime(sec, tenths = false) {
  const s = tenths ? Math.floor(Math.max(0, sec) * 10) / 10 : Math.ceil(Math.max(0, sec));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  const ss = tenths ? r.toFixed(1).padStart(4, '0') : String(Math.round(r)).padStart(2, '0');
  return `${m}:${ss}`;
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

  button(ctx, id, x, y, w, h, label, onTap, opts = {}) {
    x = Math.round(x);
    y = Math.round(y);
    if (opts.interactive !== false) this.buttons.push({ id, x, y, w, h, onTap, instant: !!opts.instant });
    const st = STYLES[opts.style || 'primary'];
    const down = this.pressed.has(id);
    const off = down ? 2 : 0;
    panel(ctx, x, y + 2, w, h - 2, st.base);
    panel(ctx, x, y + off, w, h - 2, opts.face || st.face, C.black, st.light);
    const scale = opts.scale || 1;
    if (opts.icon === 'pause') {
      ctx.fillStyle = C.white;
      ctx.fillRect(x + w / 2 - 4, y + off + 4, 3, h - 10);
      ctx.fillRect(x + w / 2 + 1, y + off + 4, 3, h - 10);
    } else {
      drawText(ctx, label, x + w / 2, y + off + (h - 2) / 2 - 3.5 * scale, {
        scale,
        color: st.text,
        align: 'center',
        shadow: st.shadow,
      });
    }
  }

  pedal(ctx, x, y, label, down, color, arrow) {
    const w = 58;
    const h = 42;
    const off = down ? 2 : 0;
    ctx.globalAlpha = down ? 0.95 : 0.6;
    panel(ctx, x, y + 2, w, h - 2, C.black);
    panel(ctx, x, y + off, w, h - 2, down ? color : C.dark, C.black, down ? C.white : C.gray);
    ctx.fillStyle = down ? C.white : C.gray;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 7, y + off + 6 + i * 5, w - 14, 2);
    drawText(ctx, arrow === 'left' ? `< ${label}` : `${label} >`, x + w / 2, y + off + h - 14, {
      color: C.white,
      align: 'center',
    });
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
    ctx.drawImage(sp.fuelIcon, L, 5);
    panel(ctx, L + 10, 5, 66, 9, C.black);
    ctx.fillStyle = C.dark;
    ctx.fillRect(L + 11, 6, 64, 7);
    ctx.fillStyle = ff < 0.2 ? (blink ? '#ff5050' : C.red) : ff < 0.45 ? C.yellow : C.lime;
    ctx.fillRect(L + 11, 6, Math.round(64 * ff), 7);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(L + 11, 6, Math.round(64 * ff), 2);
    if (ff < 0.2 && blink && run.running) drawText(ctx, 'LOW FUEL', L + 80, 6, { color: '#ff6b6b' });

    // Coins
    ctx.drawImage(sp.coin[0], L, 18);
    drawText(ctx, String(run.coins), L + 11, 18, { color: C.yellow });

    // Time left
    const tl = run.timeLeft;
    const low = tl <= 10 && run.running;
    ctx.drawImage(sp.clock, Math.round(W / 2 - textWidth(fmtTime(tl), 2) / 2 - 11), 7);
    drawText(ctx, fmtTime(tl), W / 2, 4, { scale: 2, color: low && blink ? '#ff6b6b' : C.white, align: 'center' });

    // Progress to the finish
    const bw = Math.min(150, Math.round(W * 0.28));
    const bx = Math.round(W / 2 - bw / 2);
    const by = 22;
    ctx.fillStyle = C.black;
    ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = C.dark;
    ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(bx, by, Math.round(bw * run.progress), 3);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? C.black : C.white;
      ctx.fillRect(bx + bw + 2, by - 3 + i * 3, 3, 3);
      ctx.fillStyle = i % 2 ? C.white : C.black;
      ctx.fillRect(bx + bw + 5, by - 3 + i * 3, 3, 3);
    }
    const mx = bx + Math.round(bw * run.progress);
    ctx.fillStyle = C.black;
    ctx.fillRect(mx - 2, by - 4, 5, 9);
    ctx.fillStyle = '#d8434e';
    ctx.fillRect(mx - 1, by - 3, 3, 7);

    // Pause
    this.button(ctx, 'pause', W - R - 22, 4, 22, 20, '', actions.pause, {
      style: 'dark',
      icon: 'pause',
      instant: true,
      interactive,
    });

    // Pedals
    this.pedal(ctx, L, H - 48, 'BRAKE', run.brake, '#d8434e', 'left');
    this.pedal(ctx, W - R - 58, H - 48, 'GAS', run.gas, C.green, 'right');

    // Flip button
    if (run.canFlip) {
      this.button(ctx, 'flip', W / 2 - 50, H * 0.52, 100, 32, 'FLIP', actions.flip, {
        style: 'flip',
        scale: 2,
        instant: true,
        interactive,
        face: blink ? '#ff9d3c' : C.yellow,
      });
      drawText(ctx, `-${RULES.flipPenalty} SEC`, W / 2, H * 0.52 + 35, { align: 'center', color: C.white });
    }

    // Countdown and first-time hints
    if (run.state === 'countdown') {
      const n = Math.ceil(run.countdown);
      drawText(ctx, 'GET READY', W / 2, H * 0.24, { align: 'center', color: C.white });
      drawText(ctx, String(n), W / 2, H * 0.24 + 14, { scale: 5, align: 'center', color: C.yellow });
    }
    if (run.state === 'countdown' || (run.running && run.elapsed < 3)) {
      drawText(ctx, 'HOLD LEFT SIDE', L + 2, H - 70, { color: C.white });
      drawText(ctx, 'TO BRAKE', L + 2, H - 60, { color: C.white });
      drawText(ctx, 'HOLD RIGHT SIDE', W - R, H - 70, { color: C.white, align: 'right' });
      drawText(ctx, 'TO GAS', W - R, H - 60, { color: C.white, align: 'right' });
      drawText(ctx, 'IN THE AIR: GAS = LEAN BACK, BRAKE = LEAN FORWARD', W / 2, 36, {
        align: 'center',
        color: C.cyan,
      });
    }
  }

  floaters(ctx, run, renderer, view) {
    const { W, H } = view;
    for (const f of run.floaters) {
      const k = f.age / f.life;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      const color = f.kind === 'bad' ? '#ff6b6b' : f.kind === 'good' ? C.lime : C.yellow;
      if (f.kind === 'big') {
        drawText(ctx, f.text, W / 2, H * 0.3 - f.age * 12, { scale: 4, align: 'center', color });
      } else if (f.wx !== undefined) {
        drawText(ctx, f.text, renderer.sx(f.wx), renderer.sy(f.wy) - f.age * 22, { align: 'center', color });
      } else {
        drawText(ctx, f.text, W / 2, H * 0.4 - f.age * 14, { scale: 2, align: 'center', color });
      }
    }
    ctx.globalAlpha = 1;
  }

  dim(ctx, view) {
    ctx.fillStyle = 'rgba(26,28,44,0.6)';
    ctx.fillRect(0, 0, view.W, view.H);
  }

  pause(ctx, view, actions) {
    const { W, H } = view;
    this.dim(ctx, view);
    const pw = 160;
    const ph = 124;
    const px = Math.round((W - pw) / 2);
    const py = Math.round((H - ph) / 2);
    panel(ctx, px, py, pw, ph, C.navy, C.black, C.blue);
    drawText(ctx, 'PAUSED', W / 2, py + 10, { scale: 2, align: 'center', color: C.yellow });
    this.button(ctx, 'resume', px + 20, py + 34, pw - 40, 24, 'RESUME', actions.resume);
    this.button(ctx, 'restart', px + 20, py + 64, pw - 40, 24, 'RESTART', actions.retry, { style: 'blue' });
    this.button(ctx, 'menu', px + 20, py + 94, pw - 40, 24, 'MENU', actions.menu, { style: 'blue' });
  }

  result(ctx, run, info, view, actions, t) {
    const { W, H } = view;
    const sp = this.sprites;
    this.dim(ctx, view);
    const pw = 244;
    const ph = 178;
    const px = Math.round((W - pw) / 2);
    const py = Math.round((H - ph) / 2);
    panel(ctx, px, py, pw, ph, C.navy, C.black, C.blue);
    const won = run.state === 'finished';
    drawText(ctx, won ? 'FINISH!' : run.failReason, W / 2, py + 10, {
      scale: 2,
      align: 'center',
      color: won ? C.yellow : '#ff6b6b',
    });

    let y = py + 32;
    if (won) {
      const age = t - info.shownAt;
      for (let i = 0; i < 3; i++) {
        const lit = i < run.stars && age > 0.3 + i * 0.3;
        const img = lit ? sp.star : sp.starEmpty;
        ctx.drawImage(img, Math.round(W / 2 - 40 + i * 28), y, 22, 20);
      }
      y += 28;
    } else {
      const tip = run.failReason.startsWith('OUT') ? 'TIP: GRAB THE RED FUEL CANS' : 'TIP: KEEP THE GAS DOWN ON FLAT GROUND';
      drawText(ctx, tip, W / 2, y + 4, { align: 'center', color: C.cyan });
      y += 24;
    }

    const row = (label, value, color = C.white) => {
      drawText(ctx, label, px + 24, y, { color: C.silver });
      drawText(ctx, value, px + pw - 24, y, { color, align: 'right' });
      y += 12;
    };
    row('TIME', fmtTime(run.elapsed, true), won ? C.white : C.gray);
    row('BEST', info.best === null || info.best === undefined ? '-' : fmtTime(info.best, true), info.newBest ? C.lime : C.white);
    if (info.newBest && Math.floor(t * 3) % 2 === 0) drawText(ctx, 'NEW BEST!', W / 2, y - 12, { align: 'center', color: C.lime });
    row('COINS', `+${run.coins}`, C.yellow);
    row('TOTAL COINS', String(info.total), C.yellow);
    const [two, three] = run.level.starTimes;
    drawText(ctx, `** UNDER ${fmtTime(two)}   *** UNDER ${fmtTime(three)}`, W / 2, y + 2, {
      align: 'center',
      color: C.gray,
      shadow: null,
    });

    const by = py + ph - 32;
    this.button(ctx, 'retry', px + 18, by, 98, 24, won ? 'AGAIN' : 'RETRY', actions.retry);
    this.button(ctx, 'menu', px + pw - 18 - 98, by, 98, 24, 'MENU', actions.menu, { style: 'blue' });
  }

  title(ctx, view, save, level, actions, t) {
    const { W, H } = view;
    const sp = this.sprites;
    const L = 6 + view.l;
    ctx.drawImage(sp.moon, W - view.r - 64, 12);
    const bob = Math.round(Math.sin(t * 2) * 2);
    drawText(ctx, 'DIRT TO', W / 2, 22 + bob, { scale: 4, align: 'center', color: C.yellow });
    drawText(ctx, 'THE MOON', W / 2, 58 + bob, { scale: 4, align: 'center', color: C.white });

    this.button(ctx, 'play', W / 2 - 62, 104, 124, 32, 'PLAY', actions.play, { scale: 2 });

    const best = save.levels[level.id];
    panel(ctx, Math.round(W / 2 - 110), 146, 220, 34, 'rgba(26,28,44,0.75)', C.black);
    drawText(ctx, `LEVEL ${level.id}: ${level.name}`, W / 2, 151, { align: 'center', color: C.white });
    const stars = best ? best.stars : 0;
    for (let i = 0; i < 3; i++) {
      ctx.drawImage(i < stars ? sp.star : sp.starEmpty, Math.round(W / 2 - 104 + 4 + i * 14), 163);
    }
    drawText(ctx, best && best.best !== null ? `BEST ${fmtTime(best.best, true)}` : 'NOT CLEARED YET', W / 2 + 100, 165, {
      align: 'right',
      color: C.silver,
    });

    ctx.drawImage(sp.coin[0], L, 6);
    drawText(ctx, String(save.coins), L + 11, 6, { color: C.yellow });

    drawText(ctx, 'LEFT SIDE = BRAKE     RIGHT SIDE = GAS', W / 2, H - 26, { align: 'center', color: C.white });
    drawText(ctx, 'PHASE 1 PREVIEW', W / 2, H - 13, { align: 'center', color: C.silver });
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
