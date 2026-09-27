// Entidades do mundo: itens de missão, criaturas, blocos levitando e patrono.
import * as THREE from 'three';
import { buildBook, buildToad, buildFeather, buildBrazier, buildPixie, buildCard, buildPatronus } from './models.js';
import { makeBlockGeometry } from './world.js';

let nextId = 1;

export class Entity {
  constructor(type, obj, pos, opts = {}) {
    this.id = nextId++;
    this.type = type;
    this.obj = obj;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.radius = opts.radius ?? 0.4;
    this.accio = !!opts.accio;
    this.levitate = !!opts.levitate;
    this.state = 'idle';
    this.t = Math.random() * 10;
    this.dead = false;
    Object.assign(this, opts.extra || {});
  }
}

export class Entities {
  constructor(scene, world, particles, blockMaterial) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.blockMaterial = blockMaterial;
    this.list = [];
  }

  add(e) {
    this.list.push(e);
    e.obj.position.copy(e.pos);
    this.scene.add(e.obj);
    return e;
  }

  remove(e) {
    e.dead = true;
    this.scene.remove(e.obj);
  }

  byType(type) { return this.list.filter((e) => e.type === type && !e.dead); }

  spawnAll(spots) {
    const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
    this.add(new Entity('book', buildBook(), V(spots.book), { accio: true, levitate: true, radius: 0.45, extra: { home: V(spots.book) } }));
    this.add(new Entity('trevor', buildToad(), V(spots.trevor), { accio: true, levitate: true, radius: 0.4, extra: { home: V(spots.trevor) } }));
    this.add(new Entity('feather', buildFeather(), V(spots.feather), { levitate: true, radius: 0.45, extra: { home: V(spots.feather) } }));
    for (const b of spots.braziers) {
      this.add(new Entity('brazier', buildBrazier(), V(b), { radius: 0.9, extra: { lit: false } }));
    }
    for (const c of spots.cards) {
      this.add(new Entity('card', buildCard(), V(c), { accio: true, radius: 0.5, extra: { home: V(c) } }));
    }
    this.pixieArea = spots.pixieArea;
    for (let i = 0; i < 7; i++) this.spawnPixie();
  }

  spawnPixie() {
    const a = this.pixieArea;
    const p = new THREE.Vector3(a.x0 + Math.random() * (a.x1 - a.x0), a.y0 + Math.random() * (a.y1 - a.y0), a.z0 + Math.random() * (a.z1 - a.z0));
    const e = this.add(new Entity('pixie', buildPixie(), p, { levitate: true, radius: 0.45, extra: { stunned: 0, goal: p.clone() } }));
    this.particles.emit(p, { color: 0x88bbff, count: 12, speed: 2 });
    return e;
  }

  spawnFloatingBlock(id, pos) {
    const mesh = new THREE.Mesh(makeBlockGeometry(id), this.blockMaterial);
    mesh.scale.setScalar(0.98);
    return this.add(new Entity('block', mesh, pos, { levitate: true, radius: 0.6, extra: { blockId: id } }));
  }

  spawnPatronus(pos, dir) {
    const g = buildPatronus();
    g.traverse((o) => { if (o.material) o.material = o.material.clone(); });
    const e = this.add(new Entity('patronus', g, pos, { extra: { dir: dir.clone().setY(0).normalize(), life: 5 } }));
    e.obj.rotation.y = Math.atan2(e.dir.x, e.dir.z);
    return e;
  }

  // Encontra a entidade mais próxima ao longo de um raio
  pick(origin, dir, maxDist, filter) {
    let best = null, bestT = Infinity;
    const tmp = new THREE.Vector3();
    for (const e of this.list) {
      if (e.dead || !filter(e)) continue;
      tmp.copy(e.pos).sub(origin);
      const t = tmp.dot(dir);
      if (t < 0 || t > maxDist) continue;
      const perp = tmp.addScaledVector(dir, -t).length();
      if (perp < e.radius + 0.35 + t * 0.02 && t < bestT) { best = e; bestT = t; }
    }
    return best ? { entity: best, t: bestT } : null;
  }

  update(dt, ctx) {
    const { game, player, time } = ctx;
    const w = this.world;
    for (const e of this.list) {
      if (e.dead) continue;
      e.t += dt;

      // Entidade sendo convocada por Accio
      if (e.state === 'accio') {
        const target = player.eyePos().add(player.forward().multiplyScalar(0.8)).add(new THREE.Vector3(0, -0.3, 0));
        const d = target.clone().sub(e.pos);
        const dist = d.length();
        e.pos.addScaledVector(d.normalize(), Math.min(dist, (6 + 30 * Math.min(1, e.t * 0.8)) * dt));
        e.obj.rotation.y += dt * 10;
        this.particles.emit(e.pos, { color: 0xffe9a0, count: 1, speed: 0.5, life: 0.5 });
        if (dist < 0.9) { game.collect(e); this.remove(e); continue; }
        e.obj.position.copy(e.pos);
        continue;
      }
      if (e.state === 'held') {
        e.obj.position.copy(e.pos);
        e.obj.rotation.y += dt * 1.5;
        if (e.type === 'pixie') this.flapWings(e, time);
        if (e.type === 'feather' && e.pos.y > e.home.y + 2.2 && !game.flags.featherLifted) game.onFeatherLifted();
        continue;
      }

      switch (e.type) {
        case 'book':
        case 'card': {
          if (e.state === 'falling') { this.fall(e, dt, 9); break; }
          e.obj.rotation.y += dt * (e.type === 'card' ? 1.6 : 0.4);
          e.obj.position.set(e.pos.x, e.pos.y + Math.sin(e.t * 2) * 0.08, e.pos.z);
          if (e.type === 'book') this.particles.emit(e.pos, { color: 0xffd27a, count: Math.random() < 0.2 ? 1 : 0, speed: 0.6, life: 0.8 });
          if (e.type === 'card' && Math.random() < 0.1) this.particles.emit(e.pos, { color: 0xffe066, count: 1, speed: 0.8, life: 0.6 });
          if (e.pos.distanceTo(player.eyePos().setY(player.pos.y + 0.9)) < 1.3) { game.collect(e); this.remove(e); }
          break;
        }
        case 'trevor': {
          if (e.state === 'falling') { this.fall(e, dt, 9); break; }
          e.hop = (e.hop ?? 2) - dt;
          if (e.hop < 0) { e.hop = 2 + Math.random() * 3; e.jump = 0.35; e.obj.rotation.y = Math.random() * 6.28; }
          e.jump = Math.max(0, (e.jump ?? 0) - dt);
          e.obj.position.set(e.pos.x, e.pos.y + Math.sin((e.jump / 0.35) * Math.PI) * 0.25, e.pos.z);
          if (e.pos.distanceTo(player.pos) < 1.2) { game.collect(e); this.remove(e); }
          break;
        }
        case 'feather': {
          if (e.state === 'falling') {
            e.vel.y = Math.max(e.vel.y - 2 * dt, -1.2);
            e.vel.x *= 0.98; e.vel.z *= 0.98;
            const nx = e.pos.clone().addScaledVector(e.vel, dt);
            nx.x += Math.sin(e.t * 3) * 0.6 * dt;
            if (w.isSolid(nx.x, nx.y - 0.05, nx.z)) { e.state = 'idle'; e.vel.set(0, 0, 0); }
            else e.pos.copy(nx);
            e.obj.rotation.z = Math.sin(e.t * 3) * 0.4;
          }
          e.obj.position.copy(e.pos);
          break;
        }
        case 'brazier': {
          e.obj.position.copy(e.pos);
          if (e.lit) {
            const top = e.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
            this.particles.emit(top, { color: Math.random() < 0.5 ? 0xff8a1a : 0xffd040, count: 2, speed: 1.2, life: 0.7, gravity: -3, size: 0.16 });
          }
          break;
        }
        case 'pixie': this.updatePixie(e, dt, time, player); break;
        case 'block': {
          if (e.state === 'falling') {
            e.vel.y -= 22 * dt;
            const next = e.pos.clone().addScaledVector(e.vel, dt);
            if (w.isSolid(next.x, e.pos.y, next.z)) { e.vel.x = 0; e.vel.z = 0; next.x = e.pos.x; next.z = e.pos.z; }
            if (w.isSolid(next.x, next.y - 0.5, next.z) || next.y < 1) {
              // pousa e vira bloco de novo
              let cx = Math.floor(next.x), cy = Math.floor(next.y - 0.5) + 1, cz = Math.floor(next.z);
              while (w.get(cx, cy, cz) !== 0 && cy < w.sy - 1) cy++;
              w.set(cx, cy, cz, e.blockId);
              this.particles.emit(new THREE.Vector3(cx + 0.5, cy + 0.2, cz + 0.5), { color: 0xcccccc, count: 8, speed: 2 });
              this.remove(e);
              break;
            }
            e.pos.copy(next);
          }
          e.obj.position.copy(e.pos);
          break;
        }
        case 'patronus': {
          e.life -= dt;
          const next = e.pos.clone().addScaledVector(e.dir, 9 * dt);
          const ground = w.surfaceY(next.x, next.z, next.y + 2);
          next.y += (ground - next.y) * Math.min(1, dt * 6);
          e.pos.copy(next);
          e.obj.position.copy(e.pos);
          const run = Math.sin(e.t * 12);
          e.obj.userData.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? run : -run) * 0.7; });
          const alpha = Math.min(1, e.life) * 0.75;
          e.obj.traverse((o) => { if (o.material) o.material.opacity = alpha; });
          this.particles.emit(e.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), { color: 0xcfe8ff, count: 3, speed: 1.5, life: 1 });
          if (e.life <= 0) this.remove(e);
          break;
        }
      }
    }
    this.list = this.list.filter((e) => !e.dead);
  }

  fall(e, dt, g) {
    e.vel.y -= g * dt;
    const next = e.pos.clone().addScaledVector(e.vel, dt);
    if (this.world.isSolid(next.x, next.y - 0.15, next.z)) {
      e.vel.set(0, 0, 0);
      e.pos.y = Math.floor(next.y - 0.15) + 1.15;
      e.state = 'idle';
    } else e.pos.copy(next);
    e.obj.position.copy(e.pos);
  }

  flapWings(e, time) {
    const wings = e.obj.userData.wings;
    const f = Math.sin(time * 40 + e.id) * 0.8;
    wings[0].rotation.y = f; wings[1].rotation.y = -f;
  }

  updatePixie(e, dt, time, player) {
    const w = this.world;
    if (e.stunned > 0) {
      e.stunned -= dt;
      // cai até o chão
      if (!w.isSolid(e.pos.x, e.pos.y - 0.2, e.pos.z)) e.pos.y -= 6 * dt;
      e.obj.rotation.z = Math.PI / 2;
      e.obj.position.copy(e.pos);
      if (Math.random() < 0.15) this.particles.emit(e.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), { color: 0xffff66, count: 1, speed: 1, life: 0.5 });
      if (e.stunned <= 0) {
        this.particles.emit(e.pos, { color: 0x88bbff, count: 20, speed: 3 });
        this.remove(e);
        setTimeout(() => this.spawnPixie(), 15000);
      }
      return;
    }
    if (e.state === 'falling') e.state = 'idle';
    const a = this.pixieArea;
    if (e.pos.distanceTo(e.goal) < 0.5 || Math.random() < dt * 0.5) {
      // às vezes voa em direção ao jogador para provocar
      if (Math.random() < 0.25 && player.pos.distanceTo(e.pos) < 10) e.goal.copy(player.eyePos()).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2));
      else e.goal.set(a.x0 + Math.random() * (a.x1 - a.x0), a.y0 + Math.random() * (a.y1 - a.y0), a.z0 + Math.random() * (a.z1 - a.z0));
    }
    const d = e.goal.clone().sub(e.pos);
    e.vel.lerp(d.normalize().multiplyScalar(4.5), Math.min(1, dt * 3));
    e.vel.y += Math.sin(time * 6 + e.id) * 0.2;
    const next = e.pos.clone().addScaledVector(e.vel, dt);
    if (!w.isSolid(next.x, next.y, next.z)) e.pos.copy(next);
    else e.goal.set(a.x0 + Math.random() * (a.x1 - a.x0), a.y0 + Math.random() * (a.y1 - a.y0), a.z0 + Math.random() * (a.z1 - a.z0));
    e.obj.position.copy(e.pos);
    e.obj.rotation.z = 0;
    e.obj.rotation.y = Math.atan2(e.vel.x, e.vel.z);
    this.flapWings(e, time);
  }
}
