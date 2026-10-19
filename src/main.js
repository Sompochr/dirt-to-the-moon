// Entry point: screen size, game loop, camera, sound and switching between screens.

import { VIEW, PHYSICS } from './config.js';
import { LEVELS } from './levels.js';
import { THEMES } from './themes.js';
import { buildSprites } from './sprites.js';
import { Renderer } from './render.js';
import { Terrain } from './terrain.js';
import { Run } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { loadSave, writeSave, recordRun, buyUpgrade } from './save.js';

const PPM = VIEW.ppm;
const canvas = document.getElementById('game');
const sprites = buildSprites();
const renderer = new Renderer(canvas, sprites);
const ui = new UI(sprites);
const input = new Input(canvas, ui);
const debug = new URLSearchParams(location.search).has('debug');
const save = loadSave();
const sound = new Sound(save.settings);

const app = {
  screen: 'title', // title | levels | garage | game | result
  paused: false,
  portrait: false,
  level: LEVELS[0],
  save,
  run: null,
  result: null,
  cam: { x: 0, y: 0, refY: 0 },
  title: { terrain: new Terrain(LEVELS[0]), x: 0, y: null },
  safe: { l: 0, r: 0 },
  t: 0,
  dt: 0,
  timeScale: 1,
  autopilot: false,
};

// ---------- Screen size ----------
function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  app.portrait = vh > vw * 1.05;
  let W;
  let H;
  if (app.portrait) {
    W = 200;
    H = Math.round((W * vh) / vw);
  } else {
    H = VIEW.height;
    W = Math.round((H * vw) / vh);
  }
  renderer.setSize(W, H);
  input.size = { W, H };
  const scale = vw / W;
  const cs = getComputedStyle(document.getElementById('safe'));
  app.safe = {
    l: Math.ceil((parseFloat(cs.paddingLeft) || 0) / scale),
    r: Math.ceil((parseFloat(cs.paddingRight) || 0) / scale),
  };
  if (app.portrait) actions.pause();
}

// ---------- Actions (buttons and keys) ----------
const click = (fn) => (...args) => {
  sound.play('click');
  fn(...args);
};

const actions = {
  play: click(() => go('levels')),
  garage: click(() => go('garage')),
  back: click(() => go('title')),
  levels: click(() => {
    app.run = null;
    app.paused = false;
    go('levels');
  }),
  startLevel: click((id) => startRun(LEVELS.find((l) => l.id === id))),
  next: click(() => {
    if (app.result && app.result.nextId) startRun(LEVELS.find((l) => l.id === app.result.nextId));
  }),
  retry: click(() => startRun(app.level)),
  buy(kind) {
    if (buyUpgrade(save, kind)) {
      sound.play('buy');
      ui.toast('UPGRADED!');
    } else {
      sound.play('deny');
      ui.toast('NOT ENOUGH COINS');
    }
  },
  toggleSfx: click(() => {
    sound.setSfx(!save.settings.sfx);
    writeSave(save);
  }),
  toggleMusic: click(() => {
    sound.setMusic(!save.settings.music);
    writeSave(save);
  }),
  pause() {
    if (app.screen === 'game' && !app.paused) {
      app.paused = true;
      input.playMode = false;
      input.reset();
    }
  },
  resume: click(() => {
    if (app.portrait) return;
    app.paused = false;
    input.playMode = true;
  }),
  flip() {
    if (app.run) app.run.flip();
  },
};

function go(screen) {
  app.screen = screen;
  input.playMode = false;
  if (screen !== 'game' && screen !== 'result') sound.music('meadow');
}

function startRun(level) {
  app.level = level;
  app.run = new Run(level, save.upgrades);
  app.screen = 'game';
  app.paused = false;
  app.result = null;
  input.reset();
  input.playMode = true;
  updateCamera(0, true);
  sound.music(THEMES[level.theme].music);
}

function showResult() {
  const r = recordRun(save, app.run);
  const idx = LEVELS.indexOf(app.level);
  const next = app.run.state === 'finished' && LEVELS[idx + 1];
  app.result = { ...r, total: save.coins, shownAt: app.t, nextId: next ? next.id : null };
  app.screen = 'result';
  input.playMode = false;
}

input.onKey = (code) => {
  if (code === 'Escape' || code === 'KeyP') {
    if (app.paused) actions.resume();
    else actions.pause();
  } else if (code === 'Space' || code === 'KeyF') {
    actions.flip();
  } else if (code === 'Enter') {
    if (app.screen === 'title') actions.play();
    else if (app.screen === 'result') (app.result.nextId ? actions.next : actions.retry)();
    else if (app.paused) actions.resume();
  }
};

// Go fullscreen on phones after the first tap (Android). iPhone Safari ignores this.
input.onFirstTouch = () => {
  const el = document.documentElement;
  if (debug || !window.matchMedia('(pointer: coarse)').matches || document.fullscreenElement || !el.requestFullscreen) return;
  try {
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => {});
  } catch {
    // fullscreen not allowed here (e.g. inside a frame): play in the normal window
  }
};

// Sound may only start after a touch, click or key press.
for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, () => sound.unlock(), { passive: true });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    actions.pause();
    sound.suspend();
  }
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- Camera ----------
function updateCamera(dt, snap = false) {
  const b = app.run.bike;
  const vw = renderer.W / PPM;
  const vh = renderer.H / PPM;
  const v = b.chassis.getLinearVelocity();
  const lead = Math.max(-2, Math.min(4, v.x * 0.25));
  const tx = b.x - vw * VIEW.cameraLead + lead;
  const ty = b.y + vh * VIEW.cameraHeight;
  const cam = app.cam;
  if (snap) {
    cam.x = tx;
    cam.y = ty;
    cam.refY = ty;
    return;
  }
  cam.x += (tx - cam.x) * (1 - Math.exp(-dt * 5));
  cam.y += (ty - cam.y) * (1 - Math.exp(-dt * 3.5));
}

// ---------- Test helper (only with ?debug in the URL) ----------
function autopilot(run) {
  if (run.canFlip) run.flip();
  const b = run.bike;
  const a = Math.atan2(Math.sin(b.angle), Math.cos(b.angle));
  const slope = run.terrain.slopeAngleAt(b.x);
  if (!b.rearOnGround && !b.frontOnGround) return { gas: a < slope - 0.1, brake: a > slope + 0.35 };
  const rel = a - slope;
  return { gas: rel < 0.5, brake: rel > 0.9 };
}

// ---------- Loop ----------
let last = performance.now();
let acc = 0;

function update(dt) {
  if (app.portrait) {
    sound.engine(false);
    return;
  }
  const run = app.run;
  const inRun = (app.screen === 'game' || app.screen === 'result') && run;
  if (!inRun) {
    app.title.x += dt * 5;
    sound.engine(false);
    return;
  }
  if (!app.paused) {
    const h = 1 / PHYSICS.hz;
    acc += dt * app.timeScale;
    let n = 0;
    while (acc >= h && n < 60) {
      run.step(h, app.autopilot && run.running ? autopilot(run) : input);
      acc -= h;
      n++;
    }
    if (acc > h) acc = 0;
    updateCamera(dt * app.timeScale);
    for (const e of run.events) sound.play(e);
    run.events.length = 0;
    if (app.screen === 'game' && (run.state === 'finished' || run.state === 'failed') && run.endTimer > 1.2) showResult();
  }
  const engineOn = app.screen === 'game' && !app.paused && (run.running || run.state === 'countdown');
  sound.engine(engineOn, run.gas, run.bike.rear.getAngularVelocity());
}

function draw() {
  const ctx = renderer.ctx;
  const view = { W: renderer.W, H: renderer.H, l: app.safe.l, r: app.safe.r };
  ui.begin();
  if (app.portrait) {
    ui.rotate(ctx, view, app.t);
    return;
  }
  const run = app.run;
  if (!run || (app.screen !== 'game' && app.screen !== 'result')) {
    const tt = app.title;
    const span = tt.terrain.finishX - 40;
    const x = (tt.x % span) - 10;
    const ty = tt.terrain.groundAt(x + view.W / PPM / 2) + (view.H / PPM) * 0.72;
    tt.y = tt.y === null || Math.abs(ty - tt.y) > 20 ? ty : tt.y + (ty - tt.y) * 0.03;
    renderer.setCamera({ x, y: tt.y, refY: tt.y });
    renderer.drawScene(tt.terrain, THEMES.meadow, app.t);
    if (app.screen === 'levels') ui.levels(ctx, view, save, actions);
    else if (app.screen === 'garage') ui.garage(ctx, view, save, actions);
    else ui.title(ctx, view, save, actions, app.t);
  } else {
    renderer.setCamera(app.cam);
    renderer.drawScene(run.terrain, run.theme, app.t);
    renderer.drawBike(run.bike, run.lean);
    renderer.drawParticles(run.particles);
    renderer.drawDarkness(run.theme, run.terrain, run.bike);
    ui.floaters(ctx, run, renderer, view);
    if (app.screen === 'game') {
      ui.hud(ctx, run, view, actions, app.t, !app.paused);
      if (app.paused) ui.pause(ctx, view, actions, save.settings);
    } else {
      ui.result(ctx, run, app.result, view, actions, app.t);
    }
  }
  ui.drawToast(ctx, view, app.dt);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  app.t += dt;
  app.dt = dt;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

resize();
sound.music('meadow');
requestAnimationFrame(frame);

// Offline play and "Add to Home Screen" support (not on the local test server).
if ('serviceWorker' in navigator && location.protocol === 'https:' && !debug) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (debug) {
  window.__dttm = { app, input, actions, startRun, renderer, sound, LEVELS };
}
