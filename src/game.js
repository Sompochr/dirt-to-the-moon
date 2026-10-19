// One attempt at a level: physics world, rules (time, fuel, flip), pickups and tricks.

import { RULES, PHYSICS, BIKE } from './config.js';
import { Terrain } from './terrain.js';
import { Bike, BIKE_GEOM, baseStats } from './bike.js';
import { C } from './sprites.js';
import { THEMES } from './render.js';

const pl = window.planck;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Run {
  constructor(level, stats = baseStats(), fuelMax = RULES.fuelMax) {
    this.level = level;
    this.theme = THEMES[level.theme];
    this.world = new pl.World({ gravity: { x: 0, y: -level.gravity } });
    this.terrain = new Terrain(level);
    this.terrain.createBodies(this.world);
    const sx = 3;
    this.bike = new Bike(this.world, sx, this.terrain.surfaceAt(sx) + 0.95, stats);

    this.fuelMax = fuelMax;
    this.fuel = fuelMax;
    this.elapsed = 0;
    this.coins = 0;
    this.stars = 0;
    this.state = 'countdown'; // countdown | running | finished | failed
    this.countdown = RULES.countdown;
    this.failReason = '';
    this.endTimer = 0;
    this.flipTimer = 0;
    this.canFlip = false;
    this.noFuelTimer = 0;
    this.noFuelBestX = 0;
    this.air = { time: 0, startAngle: 0 };
    this.lean = 0;
    this.dustAcc = 0;
    this.particles = [];
    this.floaters = [];
    this.events = [];
    this.t = 0;
    this.gas = false;
    this.brake = false;
  }

  get timeLeft() {
    return Math.max(0, this.level.timeLimit - this.elapsed);
  }
  get progress() {
    return clamp(this.bike.x / this.terrain.finishX, 0, 1);
  }
  get running() {
    return this.state === 'running';
  }

  step(dt, input) {
    this.t += dt;
    const bike = this.bike;
    let gas = false;
    let brake = false;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.state = 'running';
        this.float('GO!', 'big');
        this.events.push('go');
      }
    } else if (this.running) {
      brake = input.brake;
      gas = input.gas && !brake;
    } else {
      this.endTimer += dt;
      brake = this.state === 'finished';
    }
    this.gas = gas;
    this.brake = brake;

    const rearG = bike.rearOnGround;
    const frontG = bike.frontOnGround;
    const bodyG = bike.bodyOnGround;
    const airborne = !rearG && !frontG && !bodyG;
    bike.control(gas, brake, this.fuel > 0, airborne && this.running ? this.air.time + dt : 0);

    // Rider leans with the controls (visual only)
    const targetLean = gas ? -0.12 : brake ? 0.16 : 0;
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 10);

    if (this.running) {
      this.elapsed += dt;
      if (this.fuel > 0) {
        this.fuel -= dt * (gas ? RULES.fuelBurnGas : RULES.fuelBurnIdle);
        if (this.fuel <= 0) {
          this.fuel = 0;
          this.noFuelBestX = bike.x;
          this.float('OUT OF FUEL', 'bad');
          this.events.push('nofuel');
        }
      } else {
        // Out of fuel: the run ends once the bike stops making forward progress.
        if (bike.x > this.noFuelBestX + 0.3) {
          this.noFuelBestX = bike.x;
          this.noFuelTimer = 0;
        } else {
          this.noFuelTimer += dt;
        }
        if (this.noFuelTimer > RULES.outOfFuelWait) this.fail('OUT OF FUEL!');
      }
      if (bike.x >= this.terrain.finishX) this.finish();
      else if (this.elapsed >= this.level.timeLimit) {
        this.elapsed = this.level.timeLimit;
        this.fail('TIME UP!');
      }
      this.updateFlip(dt, bodyG);
      this.collect();
      this.updateTricks(dt, airborne, bodyG);
      this.emitDust(dt, gas, rearG);
    }

    this.world.step(dt, PHYSICS.velocityIterations, PHYSICS.positionIterations);
    this.updateParticles(dt);
  }

  finish() {
    this.state = 'finished';
    const [two, three] = this.level.starTimes;
    this.stars = this.elapsed <= three ? 3 : this.elapsed <= two ? 2 : 1;
    this.canFlip = false;
    this.float('FINISH!', 'big');
    this.events.push('finish');
  }

  fail(reason) {
    this.state = 'failed';
    this.failReason = reason;
    this.stars = 0;
    this.canFlip = false;
    this.events.push('fail');
  }

  updateFlip(dt, bodyG) {
    const b = this.bike;
    const tilted = Math.cos(b.angle) < 0.2;
    const stuck = (tilted && (bodyG || b.speed < 1.5)) || (bodyG && b.speed < 0.6);
    this.flipTimer = stuck ? this.flipTimer + dt : Math.max(0, this.flipTimer - dt * 2);
    this.canFlip = this.flipTimer > RULES.flipDelay;
  }

  flip() {
    if (!this.canFlip || !this.running) return;
    this.bike.resetAt(this.bike.x, this.terrain);
    this.elapsed += RULES.flipPenalty;
    this.flipTimer = 0;
    this.canFlip = false;
    this.air.time = 0;
    this.float(`-${RULES.flipPenalty}S`, 'bad');
    this.events.push('flip');
  }

  collect() {
    const b = this.bike;
    const pts = [b.chassis.getPosition(), b.rear.getPosition(), b.front.getPosition(), b.worldPoint(BIKE_GEOM.head)];
    const near = (o, r) => pts.some((p) => (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < r * r);
    for (const c of this.terrain.coins) {
      if (c.taken || Math.abs(c.x - b.x) > 3) continue;
      if (near(c, 0.8)) {
        c.taken = true;
        this.coins += RULES.coinValue;
        this.burst(c.x, c.y, [C.yellow, C.white, C.orange], 6);
        this.events.push('coin');
      }
    }
    for (const f of this.terrain.fuels) {
      if (f.taken || Math.abs(f.x - b.x) > 3) continue;
      if (near(f, 1.0)) {
        f.taken = true;
        this.fuel = this.fuelMax;
        this.float('FUEL FULL!', 'good', f.x, f.y + 0.8);
        this.burst(f.x, f.y, [C.red, C.white, C.yellow], 10);
        this.events.push('fuel');
      }
    }
  }

  updateTricks(dt, airborne, bodyG) {
    const a = this.air;
    const b = this.bike;
    if (airborne) {
      if (a.time === 0) a.startAngle = b.angle;
      a.time += dt;
      return;
    }
    if (a.time > 0.4) {
      const rot = b.angle - a.startAngle;
      const n = Math.floor((Math.abs(rot) + 0.9) / (Math.PI * 2));
      if (n >= 1 && Math.cos(b.angle) > 0.3 && !bodyG) {
        const bonus = n * RULES.trickBonus;
        this.coins += bonus;
        const name = rot > 0 ? 'BACKFLIP' : 'FRONTFLIP';
        const prefix = n === 2 ? 'DOUBLE ' : n > 2 ? `${n}X ` : '';
        this.float(`${prefix}${name}! +${bonus}`, 'good', b.x, b.y + 2);
        this.events.push('trick');
      }
    }
    a.time = 0;
  }

  emitDust(dt, gas, rearG) {
    if (!gas || !rearG || this.fuel <= 0) return;
    this.dustAcc += dt * (10 + this.bike.speed * 2);
    const w = this.bike.rear.getPosition();
    const ang = this.bike.angle;
    while (this.dustAcc > 1) {
      this.dustAcc -= 1;
      const s = 1 + Math.random() * 2.5;
      this.particles.push({
        x: w.x - 0.2,
        y: w.y - BIKE.wheelRadius + 0.1,
        vx: -Math.cos(ang) * s,
        vy: 0.8 + Math.random() * 2,
        life: 0.35 + Math.random() * 0.35,
        color: this.theme.dust[Math.floor(Math.random() * this.theme.dust.length)],
        size: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  burst(x, y, colors, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 2.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + 1,
        life: 0.3 + Math.random() * 0.3,
        color: colors[i % colors.length],
        size: 1,
      });
    }
  }

  updateParticles(dt) {
    const g = this.level.gravity * 0.6;
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.vy -= g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.life > 0;
    });
    this.floaters = this.floaters.filter((f) => (f.age += dt) < f.life);
  }

  // A short message. With wx/wy it floats up from that world position, otherwise it shows mid-screen.
  float(text, kind, wx, wy) {
    this.floaters.push({ text, kind, wx, wy, age: 0, life: kind === 'big' ? 1.1 : 1.4 });
  }
}
