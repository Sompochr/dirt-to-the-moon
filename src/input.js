// Touch (multi-finger), mouse and keyboard input.
// In play mode: left half of the screen = BRAKE, right half = GAS.
// On-screen buttons (pause, flip, menus) take priority over the pedals.

export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.pointers = new Map();
    this.keys = new Set();
    this.playMode = false;
    this.size = { W: 1, H: 1 };
    this.onFirstTouch = null;
    this.onKey = null;

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    canvas.addEventListener('pointermove', (e) => this.move(e), opts);
    canvas.addEventListener('pointerup', (e) => this.up(e, true), opts);
    canvas.addEventListener('pointercancel', (e) => this.up(e, false), opts);
    // Stop the page from scrolling, zooming or showing menus while playing.
    for (const type of ['touchstart', 'touchmove', 'touchend']) {
      canvas.addEventListener(type, (e) => e.preventDefault(), opts);
    }
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.reset());
  }

  toInternal(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.size.W,
      y: ((e.clientY - r.top) / r.height) * this.size.H,
    };
  }

  zoneAt(p) {
    return p.x < this.size.W / 2 ? 'brake' : 'gas';
  }

  down(e) {
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // not supported: fine
    }
    const p = this.toInternal(e);
    const btn = this.ui.hit(p.x, p.y);
    if (btn) {
      this.pointers.set(e.pointerId, { zone: 'ui', btn });
      if (btn.instant) btn.onTap();
      else this.ui.pressed.add(btn.id);
      return;
    }
    if (this.playMode) this.pointers.set(e.pointerId, { zone: this.zoneAt(p) });
  }

  move(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (ptr && ptr.zone !== 'ui') ptr.zone = this.zoneAt(this.toInternal(e));
  }

  up(e, fire) {
    // Browsers only allow fullscreen from a "release" gesture, so this hook runs here.
    if (fire && this.onFirstTouch) {
      this.onFirstTouch();
      this.onFirstTouch = null;
    }
    const ptr = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!ptr || ptr.zone !== 'ui') return;
    const b = ptr.btn;
    this.ui.pressed.delete(b.id);
    if (!fire || b.instant) return;
    const p = this.toInternal(e);
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y - 4 && p.y <= b.y + b.h + 4) b.onTap();
  }

  key(e, isDown) {
    const map = { ArrowRight: 'gas', KeyD: 'gas', ArrowLeft: 'brake', KeyA: 'brake' };
    const k = map[e.code];
    if (k) {
      if (isDown) this.keys.add(k);
      else this.keys.delete(k);
      e.preventDefault();
    } else if (isDown && !e.repeat && this.onKey) {
      this.onKey(e.code);
    }
  }

  reset() {
    this.pointers.clear();
    this.keys.clear();
    this.ui.pressed.clear();
  }

  has(zone) {
    if (this.keys.has(zone)) return true;
    for (const p of this.pointers.values()) if (p.zone === zone) return true;
    return false;
  }
  get gas() {
    return this.playMode && this.has('gas');
  }
  get brake() {
    return this.playMode && this.has('brake');
  }
}
