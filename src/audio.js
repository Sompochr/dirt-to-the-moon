// All sound is generated with the Web Audio API: no sound files.
// Browsers only allow sound after the player touches the screen, so unlock() runs on every tap.

import { SOUND } from './config.js';

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function noteFreq(name) {
  const m = /^([A-G][#b]?)(\d)$/.exec(name);
  const midi = NOTE[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

// Each track is a loop of eighth notes: a note name, '.' for silence, '-' to hold the previous note.
// Drums: k = kick, s = snare, h = hi-hat.
const SONGS = {
  meadow: {
    bpm: 150,
    leadWave: 'square',
    lead: 'C5 - E5 G5 - E5 G5 A5 | G5 - E5 C5 - D5 E5 - | F5 - A5 C6 - A5 G5 F5 | E5 - G5 E5 D5 - C5 -',
    bass: 'C3 - G2 - C3 - G2 - | A2 - E2 - A2 - E2 - | F2 - C3 - F2 - C3 - | G2 - D3 - G2 - B2 -',
    drums: 'k . h . s . h . k . h k s . h .',
  },
  mine: {
    bpm: 160,
    leadWave: 'square',
    lead: 'A4 - C5 A4 E5 - D5 C5 | B4 - G4 B4 D5 - C5 B4 | A4 - C5 E5 A5 - G5 E5 | F5 E5 D5 C5 B4 - G#4 -',
    bass: 'A2 A2 . A2 A2 . A2 . | G2 G2 . G2 G2 . G2 . | F2 F2 . F2 F2 . F2 . | E2 E2 . E2 E2 . E2 .',
    drums: 'k h s h k k s h',
  },
  cave: {
    bpm: 120,
    leadWave: 'triangle',
    lead: 'D5 - - F5 E5 - D5 - | C5 - - E5 D5 - A4 - | Bb4 - - D5 C5 - Bb4 - | A4 - C#5 - E5 - - -',
    bass: 'D2 - D3 - D2 - D3 - | C2 - C3 - C2 - C3 - | Bb1 - Bb2 - Bb1 - Bb2 - | A1 - A2 - A1 - A2 -',
    drums: 'k . . h s . . h',
  },
  moon: {
    bpm: 110,
    leadWave: 'triangle',
    lead: 'D5 F5 A5 D6 A5 F5 D5 F5 | C5 E5 G5 C6 G5 E5 C5 E5 | Bb4 D5 F5 Bb5 F5 D5 Bb4 D5 | A4 C#5 E5 A5 E5 C#5 A4 E5',
    bass: 'D3 - - - - - - - | C3 - - - - - - - | Bb2 - - - - - - - | A2 - - - - - - -',
    drums: 'h . . . h . . .',
  },
};

const tokens = (s) => s.split(/\s+/).filter((x) => x && x !== '|');

export class Sound {
  constructor(settings) {
    this.settings = settings; // { sfx, music } from the save
    this.ctx = null;
    this.eng = null;
    this.song = null; // name of the song that should be playing
    this.timer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = SOUND.master;
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = SOUND.sfx;
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = SOUND.music;
      this.musicBus.connect(this.master);
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.song && !this.timer) this.music(this.song);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  // ---------- Building blocks ----------
  tone(f, dur, { type = 'square', vol = 0.25, to = null, at = 0, bus = this.sfxBus, when = null } = {}) {
    const ctx = this.ctx;
    const t = when !== null ? when : ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, hp = 1000, at = 0, bus = this.sfxBus, when = null } = {}) {
    const ctx = this.ctx;
    const t = when !== null ? when : ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---------- Sound effects ----------
  play(name) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.settings.sfx) return;
    const arp = (notes, step, opts = {}) => notes.forEach((f, i) => this.tone(f, step * 1.2, { vol: 0.2, at: i * step, ...opts }));
    switch (name) {
      case 'coin':
        this.tone(988, 0.06, { vol: 0.16 });
        this.tone(1319, 0.1, { vol: 0.16, at: 0.06 });
        break;
      case 'fuel':
        arp([523, 659, 784, 1047], 0.06);
        break;
      case 'boost':
        this.tone(180, 0.35, { type: 'sawtooth', to: 900, vol: 0.18 });
        this.noise(0.3, { vol: 0.12, hp: 800 });
        break;
      case 'flip':
        this.tone(660, 0.18, { to: 220, vol: 0.2 });
        break;
      case 'trick':
        arp([784, 988, 1175, 1568], 0.05, { vol: 0.18 });
        break;
      case 'finish':
        arp([523, 659, 784], 0.12, { vol: 0.22 });
        this.tone(1047, 0.45, { vol: 0.22, at: 0.36 });
        break;
      case 'fail':
        arp([392, 330, 262], 0.18, { type: 'triangle', vol: 0.3 });
        break;
      case 'tick':
        this.tone(440, 0.1, { vol: 0.2 });
        break;
      case 'go':
        this.tone(880, 0.3, { vol: 0.22 });
        break;
      case 'nofuel':
        this.tone(160, 0.4, { type: 'sawtooth', to: 80, vol: 0.16 });
        break;
      case 'click':
        this.tone(1200, 0.03, { vol: 0.1 });
        break;
      case 'buy':
        arp([659, 880, 1319], 0.07);
        break;
      case 'deny':
        this.tone(200, 0.15, { vol: 0.15 });
        break;
      default:
    }
  }

  // ---------- Engine ----------
  // on: whether the engine should be heard, throttle: gas held, wheelSpeed: rear wheel rad/s
  engine(on, throttle, wheelSpeed) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (!on || !this.settings.sfx || ctx.state !== 'running') {
      if (this.eng) this.eng.gain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }
    if (!this.eng) {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const am = ctx.createGain();
      const lfoDepth = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      o1.type = 'sawtooth';
      o2.type = 'square';
      lfo.type = 'square';
      filter.type = 'lowpass';
      am.gain.value = 0.6;
      lfoDepth.gain.value = 0.4;
      gain.gain.value = 0;
      lfo.connect(lfoDepth);
      lfoDepth.connect(am.gain);
      o1.connect(filter);
      o2.connect(filter);
      filter.connect(am);
      am.connect(gain);
      gain.connect(this.sfxBus);
      o1.start();
      o2.start();
      lfo.start();
      this.eng = { o1, o2, lfo, filter, gain };
    }
    const e = this.eng;
    const f = 38 + Math.min(1, Math.abs(wheelSpeed) / 45) * 120 + (throttle ? 12 : 0);
    e.o1.frequency.setTargetAtTime(f, now, 0.05);
    e.o2.frequency.setTargetAtTime(f * 0.5, now, 0.05);
    e.lfo.frequency.setTargetAtTime(f / 3, now, 0.05);
    e.filter.frequency.setTargetAtTime(throttle ? 1400 : 650, now, 0.08);
    e.gain.gain.setTargetAtTime((throttle ? 0.16 : 0.08) * SOUND.engine, now, 0.08);
  }

  // ---------- Music ----------
  music(name) {
    if (this.song === name && this.timer) return;
    this.stopMusic();
    this.song = name;
    if (!this.ctx || !this.settings.music || !SONGS[name]) return;
    const s = SONGS[name];
    this.track = { lead: tokens(s.lead), bass: tokens(s.bass), drums: tokens(s.drums), s };
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') {
      this.nextTime = ctx.currentTime + 0.1;
      return;
    }
    const { lead, bass, drums, s } = this.track;
    const stepDur = 60 / s.bpm / 2;
    const play = (line, i, wave, vol) => {
      const tok = line[i % line.length];
      if (tok === '.' || tok === '-') return;
      let holds = 1;
      while (line[(i + holds) % line.length] === '-' && holds < line.length) holds++;
      this.tone(noteFreq(tok), holds * stepDur * 0.92, { type: wave, vol, bus: this.musicBus, when: this.nextTime });
    };
    while (this.nextTime < ctx.currentTime + 0.15) {
      const i = this.step;
      play(lead, i, s.leadWave, 0.16);
      play(bass, i, 'triangle', 0.3);
      const d = drums[i % drums.length];
      if (d === 'k') this.tone(150, 0.12, { type: 'sine', to: 45, vol: 0.5, bus: this.musicBus, when: this.nextTime });
      else if (d === 's') this.noise(0.12, { vol: 0.18, hp: 1200, bus: this.musicBus, when: this.nextTime });
      else if (d === 'h') this.noise(0.04, { vol: 0.08, hp: 6000, bus: this.musicBus, when: this.nextTime });
      this.nextTime += stepDur;
      this.step++;
    }
  }

  setMusic(on) {
    this.settings.music = on;
    if (on) this.music(this.song);
    else this.stopMusic();
  }

  setSfx(on) {
    this.settings.sfx = on;
    if (!on) this.engine(false);
  }
}
