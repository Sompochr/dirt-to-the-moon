// The dirt bike: a chassis (frame + rider) and two wheels on sprung wheel joints.

import { BIKE, PHYSICS } from './config.js';

const pl = window.planck;

// Positions in meters relative to the chassis origin.
// They line up with the frame/rider sprite layout in sprites.js.
export const BIKE_GEOM = {
  rearWheel: { x: -0.72, y: -0.3 },
  frontWheel: { x: 0.75, y: -0.3 },
  riderHip: { x: -0.3, y: 0.3 },
  head: { x: -0.15, y: 1.05 },
};

export function baseStats() {
  return {
    engineTorque: BIKE.engineTorque,
    topSpeed: BIKE.topSpeed,
    tireFriction: BIKE.tireFriction,
  };
}

export class Bike {
  constructor(world, x, y, stats) {
    this.stats = stats;
    const group = -1; // bike parts never collide with each other
    const G = BIKE_GEOM;

    const c = world.createBody({ type: 'dynamic', position: { x, y }, angularDamping: BIKE.angularDamping });
    // Frame
    c.createFixture({
      shape: new pl.Polygon([
        { x: -1.05, y: 0.12 },
        { x: -0.3, y: -0.18 },
        { x: 0.45, y: -0.1 },
        { x: 0.62, y: 0.42 },
        { x: -0.4, y: 0.32 },
      ]),
      density: 1.6,
      friction: 0.4,
      filterGroupIndex: group,
      userData: 'body',
    });
    // Rider torso and head
    c.createFixture({
      shape: new pl.Box(0.15, 0.27, { x: -0.24, y: 0.58 }, -0.35),
      density: 0.6,
      friction: 0.4,
      filterGroupIndex: group,
      userData: 'body',
    });
    c.createFixture({
      shape: new pl.Circle(G.head, 0.21),
      density: 0.4,
      friction: 0.4,
      filterGroupIndex: group,
      userData: 'body',
    });
    this.chassis = c;

    const makeWheel = (p) => {
      const w = world.createBody({ type: 'dynamic', position: { x: x + p.x, y: y + p.y } });
      w.createFixture({
        shape: new pl.Circle(BIKE.wheelRadius),
        density: 0.9,
        friction: stats.tireFriction,
        filterGroupIndex: group,
        userData: 'wheel',
      });
      return w;
    };
    this.rear = makeWheel(G.rearWheel);
    this.front = makeWheel(G.frontWheel);

    const jd = {
      enableMotor: false,
      maxMotorTorque: 0,
      motorSpeed: 0,
      frequencyHz: BIKE.suspensionHz,
      dampingRatio: BIKE.suspensionDamping,
    };
    this.rearJoint = world.createJoint(new pl.WheelJoint(jd, c, this.rear, this.rear.getPosition(), { x: 0, y: 1 }));
    // The front fork leans back like a real dirt bike.
    const fl = Math.hypot(0.52, 0.85);
    this.frontJoint = world.createJoint(
      new pl.WheelJoint(jd, c, this.front, this.front.getPosition(), { x: -0.52 / fl, y: 0.85 / fl }),
    );

    // Rotational inertia of the whole bike, so air control feels the same after upgrades.
    const cm = c.getWorldCenter();
    let inertia = c.getInertia();
    for (const w of [this.rear, this.front]) {
      const p = w.getWorldCenter();
      inertia += w.getInertia() + w.getMass() * ((p.x - cm.x) ** 2 + (p.y - cm.y) ** 2);
    }
    this.inertia = inertia;
  }

  get x() {
    return this.chassis.getPosition().x;
  }
  get y() {
    return this.chassis.getPosition().y;
  }
  get angle() {
    return this.chassis.getAngle();
  }
  get speed() {
    const v = this.chassis.getLinearVelocity();
    return Math.hypot(v.x, v.y);
  }
  get forwardSpeed() {
    const v = this.chassis.getLinearVelocity();
    const a = this.angle;
    return v.x * Math.cos(a) + v.y * Math.sin(a);
  }

  static touching(body) {
    for (let ce = body.getContactList(); ce; ce = ce.next) {
      if (ce.contact.isTouching()) return true;
    }
    return false;
  }
  get rearOnGround() {
    return Bike.touching(this.rear);
  }
  get frontOnGround() {
    return Bike.touching(this.front);
  }
  get bodyOnGround() {
    return Bike.touching(this.chassis);
  }

  worldPoint(local) {
    return this.chassis.getWorldPoint(local);
  }

  // gas / brake: what the player is pressing. engineOn: false when out of fuel.
  // airTime: seconds since all wheels left the ground (0 when touching).
  control(gas, brake, engineOn, airTime) {
    const airborne = airTime > 0;
    const s = this.stats;
    const rj = this.rearJoint;
    const fj = this.frontJoint;
    if (gas && engineOn) {
      rj.enableMotor(true);
      rj.setMotorSpeed(-s.topSpeed);
      rj.setMaxMotorTorque(s.engineTorque);
      fj.enableMotor(false);
    } else if (brake && (this.forwardSpeed > 0.6 || !engineOn)) {
      rj.enableMotor(true);
      rj.setMotorSpeed(0);
      rj.setMaxMotorTorque(BIKE.brakeTorque);
      fj.enableMotor(true);
      fj.setMotorSpeed(0);
      fj.setMaxMotorTorque(BIKE.brakeTorque * 0.6);
    } else if (brake) {
      rj.enableMotor(true);
      rj.setMotorSpeed(BIKE.reverseSpeed);
      rj.setMaxMotorTorque(s.engineTorque * 0.7);
      fj.enableMotor(false);
    } else {
      rj.enableMotor(true);
      rj.setMotorSpeed(0);
      rj.setMaxMotorTorque(BIKE.idleDrag);
      fj.enableMotor(false);
    }

    // The engine's push tips the bike back. Cancel part of that on the ground so
    // holding the gas does not flip the bike over by itself.
    if (gas && engineOn && !airborne) {
      this.chassis.applyTorque(BIKE.antiWheelie * rj.getMotorTorque(PHYSICS.hz), true);
    }

    // In the air the rider leans: gas = lean back, brake = lean forward.
    // It fades in so small hops do not spin the bike.
    const lean = Math.min(1, Math.max(0, (airTime - 0.1) / 0.25));
    if (lean > 0 && gas !== brake) {
      const dir = gas ? 1 : -1;
      if (dir * this.chassis.getAngularVelocity() < BIKE.airSpinMax) {
        this.chassis.applyTorque(dir * lean * BIKE.airSpinAccel * this.inertia, true);
      }
    }
  }

  // Put the bike back on its wheels at ground position x.
  resetAt(x, terrain) {
    const ang = terrain.slopeAngleAt(x);
    const gy = terrain.surfaceAt(x);
    const lift = 0.73; // wheels just touching the ground
    const pos = { x: x - Math.sin(ang) * lift, y: gy + Math.cos(ang) * lift };
    const c = this.chassis;
    c.setTransform(pos, ang);
    c.setLinearVelocity({ x: 0, y: 0 });
    c.setAngularVelocity(0);
    for (const [w, p] of [
      [this.rear, BIKE_GEOM.rearWheel],
      [this.front, BIKE_GEOM.frontWheel],
    ]) {
      w.setTransform(c.getWorldPoint(p), ang);
      w.setLinearVelocity({ x: 0, y: 0 });
      w.setAngularVelocity(0);
    }
  }
}
