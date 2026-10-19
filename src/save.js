// Progress is kept in this browser's localStorage (no account needed).
// Clearing the browser's site data resets it.

const KEY = 'dirt-to-the-moon-save-v1';

function empty() {
  return { coins: 0, levels: {} };
}

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return { ...empty(), ...s, levels: { ...(s.levels || {}) } };
  } catch {
    // storage blocked or corrupt: start fresh
  }
  return empty();
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
