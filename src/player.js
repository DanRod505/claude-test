// Jogador em primeira pessoa: controles, física e colisão AABB com voxels.
import * as THREE from 'three';

const HALF_W = 0.3;
const HEIGHT = 1.75;
const EYE = 1.6;
const GRAVITY = 28;

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.keys = {};
    this.eyeOffset = 0; // suaviza subidas de degrau
    this.bob = 0;
    this.enabled = false;
    this.knock = new THREE.Vector3();
    this.onEvent = null; // callback de sons: (nome, dados)
    this.stepDist = 0;
  }

  onMouseMove(e) {
    if (!this.enabled) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch -= e.movementY * 0.0022;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
  }

  eyePos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  collides(x, y, z) {
    const w = this.world;
    const x0 = Math.floor(x - HALF_W), x1 = Math.floor(x + HALF_W);
    const y0 = Math.floor(y), y1 = Math.floor(y + HEIGHT);
    const z0 = Math.floor(z - HALF_W), z1 = Math.floor(z + HALF_W);
    for (let yy = y0; yy <= y1; yy++)
      for (let zz = z0; zz <= z1; zz++)
        for (let xx = x0; xx <= x1; xx++)
          if (w.isSolid(xx, yy, zz)) return true;
    return false;
  }

  update(dt, obstacles = []) {
    const emit = (n, d) => this.onEvent && this.onEvent(n, d);
    const wasWater = this.inWater, wasGround = this.onGround, fallSpeed = -this.vel.y;
    const k = this.keys;
    const moving = this.enabled;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (moving) {
      if (k.KeyW || k.ArrowUp) wish.add(fwd);
      if (k.KeyS || k.ArrowDown) wish.sub(fwd);
      if (k.KeyD || k.ArrowRight) wish.add(right);
      if (k.KeyA || k.ArrowLeft) wish.sub(right);
    }
    if (wish.lengthSq() > 0) wish.normalize();

    this.inWater = this.world.isWater(this.pos.x, this.pos.y + 0.5, this.pos.z);
    if (this.inWater && !wasWater && fallSpeed > 2) emit('splash');
    const sprint = moving && (k.ShiftLeft || k.ShiftRight);
    let speed = sprint ? 8.2 : 5.0;
    if (this.inWater) speed *= 0.55;

    const accel = this.onGround ? 14 : 4;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);
    this.vel.x += this.knock.x; this.vel.z += this.knock.z; this.vel.y += this.knock.y;
    this.knock.set(0, 0, 0);

    if (this.inWater) {
      this.vel.y -= GRAVITY * 0.25 * dt;
      this.vel.y *= 1 - Math.min(1, 2.5 * dt);
      if (moving && k.Space) this.vel.y = Math.min(this.vel.y + 30 * dt, 4.2);
    } else {
      this.vel.y -= GRAVITY * dt;
      if (moving && k.Space && this.onGround) { this.vel.y = 9.2; this.onGround = false; emit('jump'); }
    }
    this.vel.y = Math.max(this.vel.y, -40);

    // movimento eixo a eixo
    const p = this.pos;
    const stepUp = (nx, nz) => {
      if (!this.onGround && !this.inWater) return false;
      if (!this.collides(nx, p.y + 1.01, nz) && !this.collides(p.x, p.y + 1.01, p.z)) {
        p.y = Math.floor(p.y + 1.01);
        this.eyeOffset -= 1;
        return true;
      }
      return false;
    };
    let nx = p.x + this.vel.x * dt;
    if (!this.collides(nx, p.y, p.z)) p.x = nx;
    else if (stepUp(nx, p.z)) p.x = nx;
    else this.vel.x = 0;

    let nz = p.z + this.vel.z * dt;
    if (!this.collides(p.x, p.y, nz)) p.z = nz;
    else if (stepUp(p.x, nz)) p.z = nz;
    else this.vel.z = 0;

    const ny = p.y + this.vel.y * dt;
    this.onGround = false;
    if (!this.collides(p.x, ny, p.z)) p.y = ny;
    else {
      if (this.vel.y < 0) {
        p.y = Math.floor(ny) + 1; this.onGround = true;
        if (!wasGround && fallSpeed > 7) emit('land', { speed: fallSpeed });
      }
      else p.y = Math.floor(ny + HEIGHT) - HEIGHT - 0.001;
      this.vel.y = 0;
    }

    // empurrão de NPCs (círculos)
    for (const o of obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + HALF_W;
      if (d < min && d > 0.001 && Math.abs(p.y - o.y) < 2) {
        const push = (min - d);
        const tx = p.x + (dx / d) * push, tz = p.z + (dz / d) * push;
        if (!this.collides(tx, p.y, tz)) { p.x = tx; p.z = tz; }
      }
    }

    // limites do mundo
    p.x = Math.max(2, Math.min(this.world.sx - 2, p.x));
    p.z = Math.max(2, Math.min(this.world.sz - 2, p.z));
    if (p.y < -10) p.y = 40;

    // câmera
    this.eyeOffset += (0 - this.eyeOffset) * Math.min(1, 12 * dt);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if ((this.onGround || this.inWater) && hs > 1) {
      this.stepDist += hs * dt;
      const stride = this.inWater ? 2.6 : sprint ? 2.4 : 1.9;
      if (this.stepDist > stride) { this.stepDist = 0; emit('step', { sprint }); }
    }
    if (this.onGround && hs > 0.5) this.bob += dt * hs * 1.6;
    const bobY = Math.sin(this.bob * 2) * 0.05 * Math.min(1, hs / 5);
    this.camera.position.set(p.x, p.y + EYE + this.eyeOffset + bobY, p.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.speed = hs;
  }
}
