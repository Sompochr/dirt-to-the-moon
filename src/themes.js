// Look and feel of each world: colors, background layers, ground, decorations and music.

export const THEMES = {
  meadow: {
    sky: ['#3584dc', '#41a6f6', '#58c3f7', '#73e4f7'],
    sun: 'day',
    clouds: true,
    far: { type: 'mountains', color: '#7d9fca', shade: '#6787b8', cap: '#e8f1f8' },
    mid: { type: 'hills', color: '#2f8f6a', decor: 'trees' },
    ground: { top: '#a7f070', mid: '#38b764', dark: '#257179', tile: 'meadow' },
    dust: ['#a9714b', '#8b5a3c', '#c99a6e'],
    props: [
      ['tuft', 45],
      ['flower', 25],
      ['rock', 15],
      ['bush', 15],
    ],
    music: 'meadow',
  },
  mine: {
    sky: ['#2b2340', '#5d2f55', '#a2485a', '#e07a5a', '#f4b26a'],
    sun: 'sunset',
    clouds: true,
    far: { type: 'mesas', color: '#8a4b52', shade: '#743c48', cap: '#a9605a' },
    mid: { type: 'terraces', color: '#9a5a3a', decor: 'headframes' },
    ground: { top: '#f0c38a', mid: '#d4884f', dark: '#9c5a33', tile: 'mine' },
    dust: ['#d4884f', '#b8733f', '#f0c38a'],
    props: [
      ['rock', 40],
      ['barrel', 20],
      ['crate', 20],
      ['cone', 20],
    ],
    music: 'mine',
  },
  // Underground at night-time brightness: dim blue-purple, lit by lamps, nothing hidden.
  cave: {
    sky: ['#161430', '#1d1a3c', '#25224a', '#2e2a58'],
    ceiling: true,
    lamps: 22,
    far: { type: 'cavewall', color: '#2f2a4c', shade: '#272241' },
    mid: { type: 'stalagmites', color: '#3d3660' },
    ground: { top: '#b2acc8', mid: '#8a83a6', dark: '#5f5980', tile: 'cave' },
    dust: ['#8a83a6', '#b2acc8', '#5f5980'],
    props: [
      ['rock', 50],
      ['crystal', 30],
      ['barrel', 20],
    ],
    music: 'cave',
  },
  moon: {
    sky: ['#05060f', '#080a18', '#0c0f22', '#11152e'],
    stars: true,
    earth: true,
    far: { type: 'mountains', color: '#4a4f66', shade: '#3c4056', cap: null },
    mid: { type: 'hills', color: '#5d6378', decor: 'domes' },
    ground: { top: '#e6e9ee', mid: '#b8bec9', dark: '#8a91a1', tile: 'moon' },
    dust: ['#b8bec9', '#e6e9ee', '#8a91a1'],
    props: [
      ['rock', 55],
      ['moonrock', 35],
      ['mast', 10],
    ],
    music: 'moon',
  },
};
