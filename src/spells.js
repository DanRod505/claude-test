// Sistema de feitiços: seleção, lançamento, projéteis e efeitos.
import * as THREE from 'three';
import { BLOCKS, B, blockColor } from './blocks.js';

export const SPELLS = [
  { id: 'lumos', name: 'Lumos', color: 0xfff2c0, icon: '✦', desc: 'Acende (ou apaga) a ponta da varinha', cooldown: 0.3 },
  { id: 'stupefy', name: 'Estupefaça', color: 0xff3030, icon: '⚡', desc: 'Atordoa criaturas', cooldown: 0.45 },
  { id: 'incendio', name: 'Incêndio', color: 0xff8a1a, icon: '🔥', desc: 'Lança fogo: acende braseiros, queima madeira e folhas', cooldown: 0.55 },
  { id: 'leviosa', name: 'Wingardium Leviosa', color: 0xa0e0ff, icon: '🪶', desc: 'Segure o botão para levitar objetos e blocos', cooldown: 0.2 },
  { id: 'accio', name: 'Accio', color: 0xffd86a, icon: '🧲', desc: 'Convoca objetos até você', cooldown: 0.6 },
  { id: 'bombarda', name: 'Bombarda', color: 0xff5ad0, icon: '💥', desc: 'Explode blocos', cooldown: 1.0 },
  { id: 'reparo', name: 'Reparo', color: 0x7dffb0, icon: '🔧', desc: 'Conserta o que foi destruído', cooldown: 0.8 },
  { id: 'patronum', name: 'Expecto Patronum', color: 0xcfe8ff, icon: '🦌', desc: 'Conjura seu patrono', cooldown: 5 },
];

export class Spells {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, world, player, particles, entities, npcs, game, wand, camera
    this.current = 0;
    this.cooldowns = SPELLS.map(() => 0);
    this.bolts = [];
    this.burning = [];
    this.repairs = [];
    this.held = null;
    this.holdDist = 4;
    this.flick = 0;
    this.lumos = new THREE.PointLight(0xfff0c8, 0, 22, 1.4);
    this.scene.add(this.lumos);
    this.lumosOn = false;
    this.flash = new THREE.PointLight(0xffaa55, 0, 16, 1.6);
    this.scene.add(this.flash);
    this.flashT = 0;
    this.boltGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  }

  select(i) {
    if (i < 0) i = SPELLS.length - 1;
    if (i >= SPELLS.length) i = 0;
    if (this.held) this.release();
    this.current = i;
    this.game.ui.setSpell(i);
  }

  tipPos() {
    this.camera.updateMatrixWorld(true);
    return this.wand.userData.tip.getWorldPosition(new THREE.Vector3());
  }

  castDown() {
    const s = SPELLS[this.current];
    if (this.cooldowns[this.current] > 0) return;
    this.cooldowns[this.current] = s.cooldown;
    this.flick = 1;
    const eye = this.player.eyePos();
    const dir = this.player.forward();
    this.game.ui.incantation(s.name, s.color);
    switch (s.id) {
      case 'lumos':
        this.lumosOn = !this.lumosOn;
        if (!this.lumosOn) this.game.ui.incantation('Nox', 0x9999bb);
        this.particles.emit(this.tipPos(), { color: s.color, count: 14, speed: 2 });
        break;
      case 'stupefy':
      case 'incendio':
      case 'bombarda':
        this.fireBolt(s, eye, dir);
        break;
      case 'accio': this.accio(eye, dir); break;
      case 'reparo': this.reparo(eye, dir); break;
      case 'leviosa': this.leviosa(eye, dir); break;
      case 'patronum': this.patronum(eye, dir); break;
    }
  }

  castUp() {
    if (this.held) this.release();
  }

  // ---------- projéteis ----------
  fireBolt(s, eye, dir) {
    const mesh = new THREE.Mesh(this.boltGeo, new THREE.MeshBasicMaterial({ color: s.color }));
    const start = this.tipPos();
    // mira: do olho até o ponto alvo, partindo da ponta da varinha
    const hit = this.world.raycast(eye, dir, 80);
    const aim = hit ? hit.point : eye.clone().addScaledVector(dir, 80);
    const v = aim.clone().sub(start).normalize().multiplyScalar(42);
    mesh.position.copy(start);
    this.scene.add(mesh);
    this.bolts.push({ spell: s, mesh, pos: start, vel: v, life: 2.2 });
  }

  updateBolts(dt) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      let done = b.life <= 0;
      const steps = 6;
      for (let k = 0; k < steps && !done; k++) {
        const prev = b.pos.clone();
        b.pos.addScaledVector(b.vel, dt / steps);
        // NPCs
        for (const n of this.npcs) {
          if (n.hitTest(b.pos)) { this.hitNpc(b.spell, n); done = true; break; }
        }
        if (done) break;
        // entidades
        for (const e of this.entities.list) {
          if (e.dead || e.type === 'patronus' || e.type === 'block') continue;
          const r = e.type === 'brazier' ? 1.1 : e.radius + 0.2;
          const c = e.type === 'brazier' ? e.pos.clone().add(new THREE.Vector3(0, 0.9, 0)) : e.pos;
          if (c.distanceTo(b.pos) < r) {
            if (this.hitEntity(b.spell, e, b.pos)) { done = true; break; }
          }
        }
        if (done) break;
        const id = this.world.get(Math.floor(b.pos.x), Math.floor(b.pos.y), Math.floor(b.pos.z));
        if (id !== 0 && BLOCKS[id].solid) {
          this.hitBlock(b.spell, b.pos, prev);
          done = true;
        } else if (id === B.WATER && b.spell.id === 'incendio') {
          this.particles.emit(b.pos, { color: 0xdddddd, count: 12, speed: 2, gravity: -2 });
          done = true;
        }
      }
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.x += dt * 12; b.mesh.rotation.y += dt * 9;
      this.particles.emit(b.pos, { color: b.spell.color, count: 2, speed: 0.6, life: 0.35, size: 0.1 });
      if (done) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.bolts.splice(i, 1);
      }
    }
  }

  lightFlash(pos, color, strength = 6) {
    this.flash.position.copy(pos);
    this.flash.color.setHex(color);
    this.flash.intensity = strength;
    this.flashT = 0.35;
  }

  hitNpc(s, n) {
    this.particles.emit(n.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), { color: s.color, count: 25, speed: 4 });
    if (s.id === 'stupefy') n.stun = 3.5;
    this.game.onNpcHit(n, s.id);
    if (s.id === 'bombarda') this.explode(n.pos.clone().add(new THREE.Vector3(0, 1, 0)), 1.2);
  }

  hitEntity(s, e, pos) {
    if (e.type === 'brazier') {
      if (s.id === 'incendio' && !e.lit) {
        e.lit = true;
        this.lightFlash(e.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xff8a1a);
        this.particles.emit(e.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), { color: 0xffa030, count: 40, speed: 4, gravity: -4 });
        this.game.onBrazierLit();
        return true;
      }
      return s.id !== 'incendio';
    }
    if (e.type === 'pixie') {
      if (e.stunned > 0) return false;
      if (s.id === 'stupefy' || s.id === 'incendio' || s.id === 'bombarda') {
        e.stunned = 3;
        e.state = 'idle';
        this.particles.emit(e.pos, { color: s.color, count: 25, speed: 4 });
        this.game.onPixieStunned();
        if (s.id === 'bombarda') this.explode(pos, 1.5);
        return true;
      }
    }
    return false;
  }

  hitBlock(s, pos, prev) {
    if (s.id === 'stupefy') {
      this.particles.emit(prev, { color: s.color, count: 18, speed: 4 });
      this.lightFlash(prev, s.color, 3);
    } else if (s.id === 'incendio') {
      this.particles.emit(prev, { color: 0xff8a1a, count: 20, speed: 3, gravity: -3 });
      this.lightFlash(prev, 0xff8a1a, 5);
      this.ignite(pos);
    } else if (s.id === 'bombarda') {
      this.explode(prev, 2.6);
    }
  }

  ignite(pos) {
    const cx = Math.floor(pos.x), cy = Math.floor(pos.y), cz = Math.floor(pos.z);
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const d = Math.hypot(dx, dy, dz);
      if (d > 2.2) continue;
      const x = cx + dx, y = cy + dy, z = cz + dz;
      const id = this.world.get(x, y, z);
      if (id && BLOCKS[id].burnable && !this.burning.some((b) => b.x === x && b.y === y && b.z === z)) {
        this.burning.push({ x, y, z, t: 0.4 + d * 0.5 + Math.random() * 0.6, total: 0 });
        n++;
      }
    }
    return n;
  }

  explode(pos, radius) {
    this.lightFlash(pos, 0xff66cc, 9);
    this.particles.emit(pos, { color: 0xffc0f0, count: 50, speed: 9, life: 0.6, size: 0.2 });
    this.particles.emit(pos, { color: 0x888888, count: 30, speed: 4, life: 1.4, size: 0.35, gravity: -1 });
    const r = Math.ceil(radius);
    const cx = Math.floor(pos.x), cy = Math.floor(pos.y), cz = Math.floor(pos.z);
    let removed = 0;
    for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy, dz);
      if (d > radius + (Math.random() - 0.5) * 0.6) continue;
      const x = cx + dx, y = cy + dy, z = cz + dz;
      const id = this.world.get(x, y, z);
      if (!id || !BLOCKS[id].breakable) continue;
      this.world.set(x, y, z, B.AIR);
      if (removed++ < 30 || Math.random() < 0.3) this.particles.debrisBurst(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), blockColor(id), 3);
    }
    // empurra o jogador
    const pp = this.player.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    const d = pp.distanceTo(pos);
    if (d < radius + 3) {
      const push = pp.sub(pos).normalize().multiplyScalar((radius + 3 - d) * 3);
      push.y = Math.max(push.y, 3);
      this.player.knock.add(push);
      this.game.shake(0.4);
    }
    for (const e of this.entities.byType('pixie')) {
      if (e.pos.distanceTo(pos) < radius + 1.5 && !(e.stunned > 0)) { e.stunned = 3; this.game.onPixieStunned(); }
    }
    for (const n of this.npcs) {
      if (n.pos.distanceTo(pos) < radius + 1.5) this.game.onNpcHit(n, 'bombarda');
    }
  }

  updateBurning(dt) {
    for (let i = this.burning.length - 1; i >= 0; i--) {
      const b = this.burning[i];
      b.t -= dt; b.total += dt;
      const c = new THREE.Vector3(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      if (Math.random() < 0.6) this.particles.emit(c, { color: Math.random() < 0.5 ? 0xff7a10 : 0xffcc33, count: 1, speed: 1.5, gravity: -5, life: 0.6, size: 0.2 });
      if (b.t <= 0) {
        const id = this.world.get(b.x, b.y, b.z);
        if (id && BLOCKS[id].burnable) {
          this.world.set(b.x, b.y, b.z, B.AIR);
          this.particles.emit(c, { color: 0x444444, count: 6, speed: 1, gravity: -2, life: 1.2, size: 0.3 });
        }
        this.burning.splice(i, 1);
      }
    }
  }

  // ---------- feitiços instantâneos ----------
  accio(eye, dir) {
    const hit = this.world.raycast(eye, dir, 50);
    const wallT = hit ? hit.t : Infinity;
    const p = this.entities.pick(eye, dir, 50, (e) => e.accio && e.state !== 'accio');
    this.particles.emit(this.tipPos(), { color: 0xffd86a, count: 15, speed: 3 });
    // o feitiço contorna obstáculos finos (como a borda de uma estante)
    if (p && p.t < wallT + 3) {
      p.entity.state = 'accio';
      p.entity.t = 0;
      this.particles.emit(p.entity.pos, { color: 0xffd86a, count: 30, speed: 3 });
    } else {
      this.game.toast('Nada para convocar aí.');
    }
  }

  reparo(eye, dir) {
    const hit = this.world.raycast(eye, dir, 50);
    const len = hit ? hit.t : 30;
    const center = eye.clone().addScaledVector(dir, len);
    // blocos alterados perto do ponto mirado OU perto da linha de mira (ex.: um buraco na parede)
    const list = this.world.changedNear(center.x, center.y, center.z, 9, (x, y, z) => {
      const p = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5).sub(eye);
      const t = Math.max(0, Math.min(len, p.dot(dir)));
      return p.addScaledVector(dir, -t).length() < 4;
    });
    this.particles.emit(center, { color: 0x7dffb0, count: 30, speed: 4 });
    if (!list.length) { this.game.toast('Não há nada quebrado por aqui.'); return; }
    list.forEach((c, i) => this.repairs.push({ ...c, t: i * 0.012 + c.d * 0.05 }));
    this.game.toast(`Reparo! ${list.length} blocos restaurados.`);
  }

  updateRepairs(dt) {
    for (let i = this.repairs.length - 1; i >= 0; i--) {
      const r = this.repairs[i];
      r.t -= dt;
      if (r.t > 0) continue;
      // não prende o jogador dentro de um bloco
      const p = this.player.pos;
      const inside = Math.abs(p.x - (r.x + 0.5)) < 0.8 && Math.abs(p.z - (r.z + 0.5)) < 0.8 && r.y >= Math.floor(p.y) - 0 && r.y <= p.y + 1.75;
      if (inside && BLOCKS[r.id].solid) { r.t = 0.3; continue; }
      this.world.set(r.x, r.y, r.z, r.id);
      this.particles.emit(new THREE.Vector3(r.x + 0.5, r.y + 0.5, r.z + 0.5), { color: 0x7dffb0, count: 3, speed: 1.5, life: 0.5 });
      this.repairs.splice(i, 1);
    }
  }

  leviosa(eye, dir) {
    const hit = this.world.raycast(eye, dir, 14);
    const wallT = hit ? hit.t : Infinity;
    const p = this.entities.pick(eye, dir, 14, (e) => e.levitate && e.state !== 'accio');
    if (p && p.t < wallT + 0.8) {
      this.held = p.entity;
      this.held.state = 'held';
      this.holdDist = Math.max(2.5, Math.min(8, p.t));
    } else if (hit && BLOCKS[hit.id].breakable && hit.t < 12) {
      const id = hit.id;
      this.world.set(hit.x, hit.y, hit.z, B.AIR);
      const e = this.entities.spawnFloatingBlock(id, new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5));
      e.state = 'held';
      this.held = e;
      this.holdDist = Math.max(2.5, Math.min(8, hit.t));
    } else {
      this.game.toast('Mire em um objeto ou bloco próximo.');
      return;
    }
    this.lastHeldPos = this.held.pos.clone();
  }

  updateHeld(dt) {
    const e = this.held;
    if (!e) return;
    if (e.dead) { this.held = null; return; }
    const target = this.player.eyePos().addScaledVector(this.player.forward(), this.holdDist);
    // evita atravessar paredes
    const next = e.pos.clone().lerp(target, Math.min(1, dt * 8));
    if (!this.world.isSolid(next.x, next.y, next.z)) e.pos.copy(next);
    e.vel.copy(e.pos).sub(this.lastHeldPos).divideScalar(Math.max(dt, 1e-3));
    this.lastHeldPos.copy(e.pos);
    const tip = this.tipPos();
    if (Math.random() < 0.8) {
      const t = Math.random();
      this.particles.emit(tip.clone().lerp(e.pos, t), { color: 0xa0e0ff, count: 1, speed: 0.3, life: 0.4, size: 0.08 });
    }
    this.particles.emit(e.pos, { color: 0xa0e0ff, count: 1, speed: 1, life: 0.5 });
  }

  adjustHold(delta) {
    this.holdDist = Math.max(2, Math.min(10, this.holdDist + delta));
  }

  release() {
    const e = this.held;
    this.held = null;
    if (!e || e.dead) return;
    e.state = 'falling';
    e.vel.clampLength(0, 14);
  }

  patronum(eye, dir) {
    const start = this.player.pos.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 1.5);
    this.entities.spawnPatronus(start, dir);
    this.particles.emit(this.tipPos(), { color: 0xcfe8ff, count: 60, speed: 6, life: 1.2 });
    this.lightFlash(this.tipPos(), 0xcfe8ff, 8);
  }

  update(dt, time) {
    for (let i = 0; i < this.cooldowns.length; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    this.updateBolts(dt);
    this.updateBurning(dt);
    this.updateRepairs(dt);
    this.updateHeld(dt);

    // luz do Lumos
    const tip = this.tipPos();
    this.lumos.position.copy(tip);
    const want = this.lumosOn ? 7 : 0;
    this.lumos.intensity += (want - this.lumos.intensity) * Math.min(1, dt * 10);
    this.wand.userData.tip.scale.setScalar(this.lumosOn ? 2.4 + Math.sin(time * 8) * 0.3 : 1);
    if (this.lumosOn && Math.random() < 0.3) this.particles.emit(tip, { color: 0xfff2c0, count: 1, speed: 0.3, life: 0.4, size: 0.05 });
    if (this.held) {
      const s = SPELLS[this.current];
      if (Math.random() < 0.5) this.particles.emit(tip, { color: s.color, count: 1, speed: 0.5, life: 0.3, size: 0.06 });
    }

    // clarão
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity *= Math.max(0, 1 - dt * 6);
      if (this.flashT <= 0) this.flash.intensity = 0;
    }

    // animação da varinha
    this.flick = Math.max(0, this.flick - dt * 4);
    const f = Math.sin(this.flick * Math.PI);
    const sway = Math.sin(time * 1.5) * 0.01 + Math.sin(this.player.bob * 2) * 0.012 * Math.min(1, (this.player.speed || 0) / 5);
    this.wand.parent.position.set(0.32 + sway, -0.3 + f * 0.05 + (this.held ? 0.04 : 0), -0.55 - f * 0.08);
    this.wand.parent.rotation.set(0.12 + f * 0.6 + (this.held ? 0.25 : 0), 0.12, 0);
  }
}
