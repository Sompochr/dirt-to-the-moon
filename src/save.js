// Progress is kept in this browser's localStorage (no account needed).
// Clearing the browser's site data resets it.

import { UPGRADES } from './config.js';

const KEY = 'dirt-to-the-moon-save-v1';

function empty() {
  return {
    coins: 0,
    levels: {},
    upgrades: { engine: 0, fuel: 0, tires: 0 },
    settings: { sfx: true, music: true },
  };
}

export function loadSave() {
  const base = empty();
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      return {
        ...base,
        ...s,
        levels: { ...(s.levels || {}) },
        upgrades: { ...base.upgrades, ...(s.upgrades || {}) },
        settings: { ...base.settings, ...(s.settings || {}) },
      };
    }
  } catch {
    // storage blocked or corrupt: start fresh
  }
  return base;
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage blocked (private mode): progress just won't persist
  }
}

// Adds a finished or failed run to the save. Returns { newBest, best }.
export function recordRun(save, run) {
  save.coins += run.coins;
  const id = run.level.id;
  const prev = save.levels[id] || { stars: 0, best: null };
  let newBest = false;
  if (run.state === 'finished') {
    newBest = prev.best === null || run.elapsed < prev.best;
    save.levels[id] = {
      stars: Math.max(prev.stars, run.stars),
      best: newBest ? run.elapsed : prev.best,
    };
  }
  writeSave(save);
  return { newBest, best: (save.levels[id] || prev).best };
}

// Buys the next level of an upgrade. Returns false if maxed out or too expensive.
export function buyUpgrade(save, kind) {
  const lvl = save.upgrades[kind] || 0;
  if (lvl >= UPGRADES.cost.length) return false;
  const cost = UPGRADES.cost[lvl];
  if (save.coins < cost) return false;
  save.coins -= cost;
  save.upgrades[kind] = lvl + 1;
  writeSave(save);
  return true;
}
