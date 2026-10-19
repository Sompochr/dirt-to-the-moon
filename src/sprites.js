// All pixel art, either drawn as text grids or generated from simple shapes.
// Palette based on "Sweetie 16" by GrafxKid.

import { mulberry32, noise } from './util.js';

export const C = {
  black: '#1a1c2c',
  purple: '#5d275d',
  red: '#b13e53',
  orange: '#ef7d57',
  yellow: '#ffcd75',
  lime: '#a7f070',
  green: '#38b764',
  teal: '#257179',
  navy: '#29366f',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  cyan: '#73eff7',
  white: '#f4f4f4',
  silver: '#94b0c2',
  gray: '#566c86',
  dark: '#333c57',
};

const BIKE_PAL = {
  k: C.black,
  w: C.white,
  r: '#d8434e',
  R: '#8c2f45',
  m: C.silver,
  G: C.gray,
  d: C.dark,
  b: C.blue,
  B: C.navy,
  y: C.yellow,
  c: C.cyan,
  C: C.sky,
  K: C.dark,
  g: C.silver,
  e: C.dark,
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function fromRows(rows, pal = BIKE_PAL) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = canvas(w, h);
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  return c;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// fn(x, y) returns a '#rrggbb' color or null for transparent.
export function generate(w, h, fn) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const cache = {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = fn(x, y);
      if (!col) continue;
      const rgb = cache[col] || (cache[col] = hexToRgb(col));
      const i = (y * w + x) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------- Bike frame (44x18). Chassis origin is pixel (22, 10). ----------
const FRAME = [
  '..........................kkkk..............',
  '..........................kmmk..............',
  '...........................mm.kkkkk.........',
  '.....................kkkkkkkm.kwwwk.........',
  '.........kkkkkkkkkkkkrrrrwwrkmkwrwk.........',
  '.........kddddddddddkrrrwwrrkmkwrwk.........',
  'kkkkkkkkkrrrrwwwwrrrrrrrrrrrkmkwwwk.kkkkkkkk',
  'krrrrrrrrrrrwwwwwrrrrrrrrrrrkkkkkkk.rrrrrrrk',
  '.kkkkkkkkkRRRRRRRRRRRRRRRRRk....mm..kkkkkkkk',
  '...gggggggggggggkkkkkkkkkk.......mm.........',
  '..kGGGGGGGGGGGG.kmmGGmmGGk.......mm.........',
  '..............GGkGmmGGmmGk........mm........',
  '............GG..kGGGGGGGGk........mm........',
  '..........GG....kkkkkkkkkk.........mm.......',
  '.........GG.......GGG..............mm.......',
  '........GG..........................mm......',
  '.......GG...........................m.......',
];
export const FRAME_ORIGIN = { x: 22, y: 10 };

// ---------- Rider (20x28). Hip pivot is pixel (7, 18). ----------
const RIDER = [
  '........kkkkk.......',
  '.......kwwwwwk......',
  '......kwwrrrwwk.....',
  '......kwrrrrkcck....',
  '......kwwwwkcCCk....',
  '......kwwwwwkkkk....',
  '.......kwwwwrrk.....',
  '........kkkkkk......',
  '.......kbbbbk.......',
  '......kbbbbbbk......',
  '......kbbybbbbk.....',
  '.....kbbbybkbbbk....',
  '.....kbbbbykkbbbk...',
  '.....kBbbbbk.kbbbk..',
  '....kBBbbbbk..kbbgk.',
  '....kBBbbbbk...kggk.',
  '....kBBBbbbk....kk..',
  '....kBBBBbbbkk......',
  '....kBBBBBbbbbkk....',
  '.....kkBBBBbbbbbk...',
  '.......kkkkBBbbbk...',
  '...........kBbbk....',
  '..........kBbbk.....',
  '..........kBbbk.....',
  '.........kBbbk......',
  '.........kKKKk......',
  '.........kKKKKk.....',
  '.........kkkkkk.....',
];
export const RIDER_PIVOT = { x: 7, y: 18 };
// Where the rider's hip sits, in frame-sprite pixels relative to the chassis origin.
export const RIDER_HIP = { x: -6, y: -6 };

const FUEL_CAN = [
  '...kkkk...',
  '...kyyk...',
  '.kkkkkkkk.',
  'krrrrrrrrk',
  'krwrrrrRrk',
  'krrwrrRrrk',
  'krrrwRrrrk',
  'krrrRwrrrk',
  'krrRrrwrrk',
  'krRrrrrwrk',
  'krrrrrrrrk',
  '.kkkkkkkk.',
];

const STAR = [
  '.....k.....',
  '....kyk....',
  '....kyk....',
  'kkkkyyykkkk',
  'kyyyyyyyyyk',
  '.kyyyyyyyk.',
  '..kyyyyyk..',
  '..kyykyyk..',
  '.kyyk.kyyk.',
  '.kkk...kkk.',
];

const CLOCK = ['.kkkkk.', 'kwwkwwk', 'kwwkwwk', 'kwwkkwk', 'kwwwwwk', 'kwwwwwk', '.kkkkk.'];
const FUEL_ICON = ['.kkk...', '.kyk...', 'kkkkkkk', 'krrrrrk', 'krwrwrk', 'krrwrrk', 'krwrwrk', 'kkkkkkk'];

const ENGINE_ICON = [
  '...kkkkkkk...',
  '...kmmmmmk...',
  '.kkkkkkkkkkk.',
  'kkGmGmGmGmGkk',
  'kGGGGGGGGGGGk',
  'kGmmmmmmmmmGk',
  'kGGGGGGGGGGGk',
  'kGmmmmmmmmmGk',
  'kGGGGGGGGGGGk',
  '.kkkkkkkkkkk.',
  '..kk.....kk..',
];
const LOCK_ICON = [
  '..kkkkk..',
  '.kk...kk.',
  '.k.....k.',
  '.k.....k.',
  'kkkkkkkkk',
  'kyyyyyyyk',
  'kyyykyyyk',
  'kyyykyyyk',
  'kyyyyyyyk',
  'kkkkkkkkk',
];
const SPEAKER_ICON = [
  '....k....',
  '...kk....',
  'kkkwk.w..',
  'kwwwk..w.',
  'kwwwk..w.',
  'kwwwk..w.',
  'kkkwk.w..',
  '...kk....',
  '....k....',
];
const FULLSCREEN_ICON = ['www...www', 'w.......w', 'w.......w', '.........', '.........', '.........', 'w.......w', 'w.......w', 'www...www'];
const EXIT_FULLSCREEN_ICON = ['..w...w..', '..w...w..', 'www...www', '.........', '.........', '.........', 'www...www', '..w...w..', '..w...w..'];
const NOTE_ICON = [
  '..kkkkkkk',
  '..kwwwwwk',
  '..kwkkkwk',
  '..kwk.kwk',
  '..kwk.kwk',
  'kkkwkkkwk',
  'kwwwkwwwk',
  'kwwwkwwwk',
  'kkkkkkkkk',
];

// ---------- Generated sprites ----------
function makeWheel(r) {
  const size = Math.ceil(r * 2);
  const c = size / 2;
  return generate(size, size, (x, y) => {
    const dx = x + 0.5 - c;
    const dy = y + 0.5 - c;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    if (d > c) return null;
    if (d > c - 1.4) {
      const knob = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 18) % 2;
      return knob ? null : C.black;
    }
    if (d > c - 3) return d > c - 2.2 ? C.black : C.dark;
    if (d > c - 3.9) return C.silver;
    if (d < 1.6) return d < 0.9 ? C.white : C.gray;
    return Math.abs(Math.sin(a * 3)) * d < 0.7 ? C.silver : null;
  });
}

function makeCoinFrames() {
  return [4, 3, 2, 1].map((rx) =>
    generate(8, 8, (x, y) => {
      const dx = (x + 0.5 - 4) / rx;
      const dy = (y + 0.5 - 4) / 4;
      const d = dx * dx + dy * dy;
      if (d > 1) return null;
      if (d > 0.55) return C.orange;
      if (rx > 1 && x + 0.5 - 4 < 0 && y < 4 && d > 0.15) return C.white;
      return C.yellow;
    }),
  );
}

function makeCircle(r, fn) {
  const size = Math.ceil(r * 2);
  return generate(size, size, (x, y) => {
    const dx = x + 0.5 - r;
    const dy = y + 0.5 - r;
    const d = Math.hypot(dx, dy);
    return d <= r ? fn(dx, dy, d) : null;
  });
}

function makeCloud(seed) {
  const rnd = mulberry32(seed);
  const w = 44 + Math.floor(rnd() * 20);
  const h = 18;
  const blobs = [];
  for (let i = 0; i < 5; i++) {
    blobs.push({ x: 8 + rnd() * (w - 16), y: 9 + rnd() * 4, r: 5 + rnd() * 5 });
  }
  return generate(w, h, (x, y) => {
    if (y > 15) return null;
    let inside = false;
    let top = false;
    for (const b of blobs) {
      const d = Math.hypot(x + 0.5 - b.x, (y + 0.5 - b.y) * 1.2);
      if (d <= b.r) inside = true;
      if (d <= b.r && y < b.y - 1) top = true;
    }
    if (!inside) return null;
    return y >= 13 ? '#c4def0' : top ? C.white : '#e6f2fa';
  });
}

function makeTree(kind, seed) {
  const rnd = mulberry32(seed);
  if (kind === 'pine') {
    const h = 18 + Math.floor(rnd() * 8);
    const w = 11;
    return generate(w, h, (x, y) => {
      if (y >= h - 3) return x === 5 ? '#4a2a3a' : null;
      const half = ((y + 2) / (h - 3)) * 5.5;
      const dx = Math.abs(x + 0.5 - 5.5);
      if (dx > half) return null;
      return dx > half - 1.2 || (y % 4 === 3 && dx > 1) ? '#1c4f4f' : C.teal;
    });
  }
  const r = 5 + Math.floor(rnd() * 3);
  const w = r * 2 + 1;
  const h = r * 2 + 5;
  return generate(w, h, (x, y) => {
    if (y >= r * 2 - 1) return x === r || x === r - 1 ? '#4a2a3a' : null;
    const dx = x + 0.5 - (r + 0.5);
    const dy = y + 0.5 - r;
    const d = Math.hypot(dx, dy);
    if (d > r) return null;
    return dx + dy > r * 0.4 ? '#1c4f4f' : C.teal;
  });
}

function makeDirtTile(seed, base, darkC, lightC) {
  const rnd = mulberry32(seed);
  const spots = [];
  for (let i = 0; i < 26; i++) spots.push({ x: rnd() * 32, y: rnd() * 32, r: 0.6 + rnd() * 1.4, t: rnd() });
  return generate(32, 32, (x, y) => {
    for (const s of spots) {
      let dx = Math.abs(x + 0.5 - s.x);
      let dy = Math.abs(y + 0.5 - s.y);
      dx = Math.min(dx, 32 - dx);
      dy = Math.min(dy, 32 - dy);
      if (dx * dx + dy * dy <= s.r * s.r) return s.t < 0.65 ? darkC : lightC;
    }
    return base;
  });
}

const PROP_PAL = {
  a: C.lime,
  g: C.teal,
  y: C.yellow,
  w: C.white,
  p: '#f08bb0',
  k: C.dark,
  K: C.black,
  m: C.silver,
  G: C.gray,
  l: C.green,
  n: '#a0663f',
  N: '#5c3520',
  o: C.orange,
  c: C.cyan,
  C: C.sky,
  v: '#b05cc8',
  r: '#ff5050',
};

function makeProps() {
  return {
    tuft: fromRows(['.a...a.', '..a.a..', 'a.aaa.a', '.aaaaa.'], PROP_PAL),
    flower: [
      fromRows(['.w.', 'wyw', '.w.', '.g.', '.g.'], PROP_PAL),
      fromRows(['.p.', 'pyp', '.p.', '.g.', '.g.'], PROP_PAL),
      fromRows(['.y.', 'ywy', '.y.', '.g.', '.g.'], PROP_PAL),
    ],
    rock: fromRows(['..kkk.', '.kmmmk', 'kmmGGk', 'kGGGGk'], PROP_PAL),
    bush: fromRows(['...llll...', '.llaallll.', 'llaallllgl', 'llllllgggl', '.lllggggl.'], PROP_PAL),
    barrel: fromRows(['.KKKKK.', 'KyyyyyK', 'KKKKKKK', 'KyyyyyK', 'KyyKyyK', 'KyyyyyK', 'KKKKKKK', 'KyyyyyK', '.KKKKK.'], PROP_PAL),
    crate: fromRows(['KKKKKKKK', 'KNnnnnNK', 'KnNnnNnK', 'KnnNNnnK', 'KnnNNnnK', 'KnNnnNnK', 'KNnnnnNK', 'KKKKKKKK'], PROP_PAL),
    cone: fromRows(['...K...', '..KoK..', '..KwK..', '.KoooK.', '.KwwwK.', 'KoooooK', 'KKKKKKK'], PROP_PAL),
    crystal: [
      fromRows(['..KK..', '.KccK.', '.KcCK.', 'KccCCK', 'KcccCK', 'KcccCK', '.KccCK', 'KKKKKK'], PROP_PAL),
      fromRows(['..KK..', '.KppK.', '.KpvK.', 'KppvvK', 'KpppvK', 'KpppvK', '.KppvK', 'KKKKKK'], PROP_PAL),
    ],
    moonrock: fromRows(['..kkkk..', '.kmmmmk.', 'kmmGmmGk', 'kmGGmGGk', 'kkkkkkkk'], PROP_PAL),
    mast: fromRows(['...r...', '...k...', '.kkkkk.', '...k...', '..kkk..', '...k...', '.kkkkk.', '..k.k..', '.k...k.', 'k.....k'], PROP_PAL),
  };
}

// Mine headframe (the tower over a mine shaft), drawn as a dark silhouette.
function makeHeadframe(color) {
  const w = 23;
  const h = 34;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = color;
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  };
  line(1, h - 1, 9, 8);
  line(2, h - 1, 10, 8);
  line(21, h - 1, 13, 8);
  line(20, h - 1, 12, 8);
  for (const y of [16, 24]) line(4, y, 19, y);
  line(4, 24, 17, 16);
  line(6, 16, 18, 24);
  g.fillRect(8, 7, 7, 2);
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    g.fillRect(Math.round(11.5 + Math.cos(t) * 4), Math.round(4 + Math.sin(t) * 3.5), 1, 1);
  }
  g.fillRect(11, 1, 1, 7);
  g.fillRect(0, h - 2, w, 2);
  return c;
}

function makeDome() {
  return generate(34, 20, (x, y) => {
    const dx = x + 0.5 - 17;
    const dy = y + 0.5 - 18;
    const d = Math.hypot(dx, dy * 1.15);
    if (y >= 17) return y === 17 ? '#3c4056' : '#2b2f40';
    if (d > 16) return x === 30 && y < 17 && y > 4 ? '#8a91a1' : x === 30 && y === 4 ? '#ff5050' : null;
    if (d > 15) return '#2b2f40';
    if (y === 10 && Math.abs(dx) < 12) return Math.floor(x / 3) % 2 ? '#ffcd75' : '#3c4056';
    return dx + dy < -6 ? '#c9d0db' : '#9aa1b0';
  });
}

function makeEarth(r) {
  return makeCircle(r, (dx, dy, d) => {
    const land = noise((dx + 20) / 4, 3) + noise((dy + 20) / 3.5, 4) > 1.05;
    const cloud = noise((dx + dy + 40) / 2.5, 9) > 0.78;
    let col = cloud ? C.white : land ? C.green : C.blue;
    if (dx + dy > r * 0.55) col = cloud ? C.silver : land ? C.teal : C.navy;
    return d > r - 1 ? '#8fb8ff' : col;
  });
}

export function buildSprites() {
  const bikePal = BIKE_PAL;
  return {
    frame: fromRows(FRAME, bikePal),
    rider: fromRows(RIDER, bikePal),
    wheel: makeWheel(8.5),
    coin: makeCoinFrames(),
    fuelCan: fromRows(FUEL_CAN, bikePal),
    star: fromRows(STAR, bikePal),
    starEmpty: fromRows(STAR.map((r) => r.replace(/y/g, 'e')), bikePal),
    clock: fromRows(CLOCK, bikePal),
    fuelIcon: fromRows(FUEL_ICON, bikePal),
    clouds: [makeCloud(3), makeCloud(11), makeCloud(29)],
    sun: makeCircle(11, (dx, dy, d) => (d > 9.5 ? C.orange : d > 7 ? C.yellow : '#fff3c4')),
    moon: makeCircle(18, (dx, dy, d) => {
      const craters = [
        [-6, -5, 4],
        [5, 3, 5],
        [-3, 8, 3],
        [8, -8, 2.5],
      ];
      for (const [cx, cy, r] of craters) {
        const q = Math.hypot(dx - cx, dy - cy);
        if (q < r) return q > r - 1.2 && dx - cx < 0 ? C.gray : C.silver;
      }
      return d > 16.5 ? C.silver : dx + dy > 10 ? '#c9d6de' : C.white;
    }),
    trees: [makeTree('round', 1), makeTree('pine', 2), makeTree('round', 5), makeTree('pine', 9)],
    headframe: makeHeadframe('#6e3b2e'),
    dome: makeDome(),
    earth: makeEarth(11),
    props: makeProps(),
    dirt: {
      meadow: makeDirtTile(42, '#8b5a3c', '#6b3f2a', '#a9714b'),
      mine: makeDirtTile(17, '#b06a3b', '#8a4e2b', '#d4884f'),
      cave: makeDirtTile(23, '#4f4870', '#3d3759', '#6d6696'),
      moon: makeDirtTile(61, '#9aa1b0', '#7d8494', '#c4c9d3'),
    },
    icons: {
      engine: fromRows(ENGINE_ICON, bikePal),
      lock: fromRows(LOCK_ICON, bikePal),
      speaker: fromRows(SPEAKER_ICON, bikePal),
      note: fromRows(NOTE_ICON, bikePal),
      fullscreen: fromRows(FULLSCREEN_ICON, bikePal),
      exitFullscreen: fromRows(EXIT_FULLSCREEN_ICON, bikePal),
    },
  };
}
