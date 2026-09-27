// NPCs: aparência, movimentação (vagar pela área) e estados (conversando, atordoado).
import * as THREE from 'three';
import { buildCharacter, makeLabel } from './models.js';

export const NPC_DEFS = {
  dumbledore: {
    name: 'Alvo Dumbledore', short: 'Dumbledore', voice: { pitch: 150, wave: 'triangle' }, robe: 0x5b2a86, trim: 0xd4af37, hair: 0xe8e8e8, hairStyle: 'long',
    beard: 0xeeeeee, beardLength: 0.75, hat: 0x5b2a86, glasses: 0xc0a040, eyes: 0x3d6fb0, wand: true, wander: 3,
  },
  hermione: { name: 'Hermione Granger', short: 'Hermione', voice: { pitch: 340 }, robe: 0x1b1b22, trim: 0xae0001, hair: 0x7a4a26, hairStyle: 'bushy', eyes: 0x5a3a20, wander: 4, scale: 0.92 },
  ron: { name: 'Rony Weasley', short: 'Rony', voice: { pitch: 270 }, robe: 0x1b1b22, trim: 0xae0001, hair: 0xd2561c, eyes: 0x3d6fb0, wander: 4, scale: 0.97 },
  mcgonagall: { name: 'Minerva McGonagall', short: 'McGonagall', voice: { pitch: 290, wave: 'triangle' }, robe: 0x1d5b3a, trim: 0x0f3a24, hair: 0x4a4a4a, hairStyle: 'bun', hat: 0x1d5b3a, glasses: 0x333333, wand: true, wander: 3 },
  snape: { name: 'Severo Snape', short: 'Snape', voice: { pitch: 120, wave: 'sawtooth' }, robe: 0x0e0e12, pants: 0x0e0e12, hair: 0x101010, hairStyle: 'long', skin: 0xe6d6c0, eyes: 0x111111, wand: true, wander: 3 },
  hagrid: { name: 'Rúbeo Hagrid', short: 'Hagrid', voice: { pitch: 95, wave: 'sawtooth' }, robe: 0x5a3b22, pants: 0x3a2a1a, hair: 0x2a1a10, hairStyle: 'bushy', beard: 0x2a1a10, beardLength: 0.5, eyes: 0x111111, scale: 1.55, wander: 4 },
  neville: { name: 'Neville Longbottom', short: 'Neville', voice: { pitch: 310 }, robe: 0x1b1b22, trim: 0xae0001, hair: 0x5a3a20, eyes: 0x5a3a20, wander: 3, scale: 0.95 },
  nick: { name: 'Nick Quase Sem Cabeça', short: 'Nick', voice: { pitch: 420, wave: 'sine', vib: 25 }, robe: 0xb8c8d8, pants: 0xb8c8d8, skin: 0xd8e4f0, hair: 0xc8d4e0, ruff: true, ghost: true, headTilt: 0.7, wander: 10, float: true },
};

export class NPC {
  constructor(id, home, world) {
    this.id = id;
    this.def = NPC_DEFS[id];
    this.name = this.def.name;
    this.world = world;
    this.home = new THREE.Vector3(home.x, home.y, home.z);
    this.pos = this.home.clone();
    this.model = buildCharacter(this.def);
    this.group = new THREE.Group();
    this.group.add(this.model.root);
    this.label = makeLabel(this.name, this.def.ghost ? '#cfe8ff' : '#ffe9a8');
    this.label.position.y = 2.25 * (this.def.scale ?? 1) + (this.def.hat ? 0.45 : 0.1);
    this.group.add(this.label);
    this.group.position.copy(this.pos);
    this.yaw = Math.random() * Math.PI * 2;
    this.state = 'idle';
    this.timer = 1 + Math.random() * 3;
    this.target = null;
    this.walkPhase = 0;
    this.stun = 0;
    this.radius = 0.35 * (this.def.scale ?? 1);
    this.height = 1.9 * (this.def.scale ?? 1);
  }

  canStand(x, y, z) {
    const w = this.world;
    if (this.def.float) return !w.isSolid(x, y, z) && !w.isSolid(x, y + 1, z);
    return !w.isSolid(x, y + 0.1, z) && !w.isSolid(x, y + 1.1, z) && w.isSolid(x, y - 0.5, z);
  }

  update(dt, player, time) {
    const m = this.model;
    // atordoado
    if (this.stun > 0) {
      this.stun -= dt;
      m.root.rotation.x += (-Math.PI / 2 - m.root.rotation.x) * Math.min(1, dt * 8);
      m.root.position.y = 0.25;
      if (this.stun <= 0) { m.root.rotation.x = 0; m.root.position.y = 0; }
      this.group.rotation.y = this.yaw;
      return;
    }

    const toPlayer = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dPlayer = toPlayer.length();

    if (this.state === 'talk' || (dPlayer < 3.2 && this.state !== 'walk')) {
      const want = Math.atan2(toPlayer.x, toPlayer.z);
      this.yaw = lerpAngle(this.yaw, want, Math.min(1, dt * 6));
      this.walkPhase *= 0.9;
    } else if (this.state === 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) this.pickTarget();
    } else if (this.state === 'walk') {
      const d = new THREE.Vector3(this.target.x - this.pos.x, 0, this.target.z - this.pos.z);
      const dist = d.length();
      if (dist < 0.3 || dPlayer < 2.2) { this.state = 'idle'; this.timer = 2 + Math.random() * 4; }
      else {
        d.normalize();
        const speed = this.def.float ? 0.9 : 1.3;
        const nx = this.pos.x + d.x * speed * dt, nz = this.pos.z + d.z * speed * dt;
        let ny = this.pos.y;
        if (this.canStand(nx, ny, nz)) {
          this.pos.x = nx; this.pos.z = nz;
        } else if (!this.def.float && this.canStand(nx, ny + 1, nz)) {
          this.pos.x = nx; this.pos.z = nz; this.pos.y += 1;
        } else if (!this.def.float && this.canStand(nx, ny - 1, nz)) {
          this.pos.x = nx; this.pos.z = nz; this.pos.y -= 1;
        } else { this.state = 'idle'; this.timer = 0.5 + Math.random(); }
        this.yaw = lerpAngle(this.yaw, Math.atan2(d.x, d.z), Math.min(1, dt * 8));
        this.walkPhase += dt * 7;
      }
    }

    // animação
    const swing = this.state === 'walk' ? Math.sin(this.walkPhase) * 0.6 : 0;
    m.legs[0].rotation.x = swing; m.legs[1].rotation.x = -swing;
    m.arms[0].rotation.x = -swing * 0.8; m.arms[1].rotation.x = swing * 0.8;
    if (this.state === 'talk') m.arms[1].rotation.x = -0.4 + Math.sin(time * 3) * 0.25;
    m.head.rotation.x = Math.sin(time * 0.7 + this.home.x) * 0.05;
    const bobY = this.def.float ? Math.sin(time * 1.5 + this.home.z) * 0.15 : Math.abs(Math.sin(this.walkPhase)) * 0.04;
    this.group.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
    this.group.rotation.y = this.yaw;
    this.label.visible = dPlayer < 14 && dPlayer > 2.2 && this.state !== 'talk';
  }

  pickTarget() {
    const r = this.def.wander ?? 3;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      const tx = this.home.x + Math.cos(a) * d, tz = this.home.z + Math.sin(a) * d;
      if (this.canStand(tx, this.pos.y, tz) || this.canStand(tx, this.home.y, tz)) {
        this.target = new THREE.Vector3(tx, 0, tz);
        this.state = 'walk';
        return;
      }
    }
    this.timer = 1;
  }

  // Esfera de colisão aproximada para feitiços
  hitTest(p, extra = 0.25) {
    const cy = this.pos.y + this.height / 2;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, dy = p.y - cy;
    return Math.hypot(dx, dz) < this.radius + extra && Math.abs(dy) < this.height / 2 + extra;
  }
}

export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}
