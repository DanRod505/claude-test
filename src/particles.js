// Sistema de partículas voxel (cubinhos instanciados).
import * as THREE from 'three';

export class Particles {
  constructor(scene, max = 2500) {
    this.max = max;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.additive = new THREE.InstancedMesh(geo, mat, max);
    this.additive.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.additive.frustumCulled = false;
    const mat2 = new THREE.MeshLambertMaterial();
    this.solid = new THREE.InstancedMesh(geo, mat2, 800);
    this.solid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.solid.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) this.additive.setColorAt(i, white);
    for (let i = 0; i < 800; i++) this.solid.setColorAt(i, white);
    scene.add(this.additive, this.solid);
    this.list = [];
    this.debris = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
  }

  // Partícula brilhante
  emit(pos, { color = 0xffffff, count = 10, speed = 3, life = 0.8, size = 0.12, gravity = 0, spread = 1, dir = null, drag = 1.5 } = {}) {
    const col = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7) * spread);
      if (dir) v.addScaledVector(dir, speed);
      this.list.push({
        p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2)),
        v, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), gravity, drag,
        color: col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.2),
      });
    }
  }

  // Fragmentos de bloco (sólidos, com gravidade)
  debrisBurst(pos, color, count = 8) {
    const col = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.debris.length >= 800) this.debris.shift();
      this.debris.push({
        p: pos.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)),
        v: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 7 + 2, (Math.random() - 0.5) * 8),
        life: 0.8 + Math.random() * 0.8, size: 0.15 + Math.random() * 0.15,
        rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0),
        color: col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.15),
      });
    }
  }

  update(dt) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.v.y -= p.gravity * dt;
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.p.addScaledVector(p.v, dt);
    }
    for (const p of this.list) {
      const k = Math.max(0, p.life / p.max);
      const s = p.size * (0.3 + 0.7 * k);
      this.s.set(s, s, s);
      this.m.compose(p.p, this.q.identity(), this.s);
      this.additive.setMatrixAt(n, this.m);
      this.c.copy(p.color).multiplyScalar(Math.min(1, k * 1.5));
      this.additive.setColorAt(n, this.c);
      n++;
    }
    this.additive.count = n;
    this.additive.instanceMatrix.needsUpdate = true;
    if (this.additive.instanceColor) this.additive.instanceColor.needsUpdate = true;

    let d = 0;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      p.life -= dt;
      if (p.life <= 0) { this.debris.splice(i, 1); continue; }
      p.v.y -= 22 * dt;
      p.p.addScaledVector(p.v, dt);
      p.rot.x += dt * 5; p.rot.y += dt * 4;
    }
    for (const p of this.debris) {
      const s = p.size * Math.min(1, p.life * 2);
      this.s.set(s, s, s);
      this.q.setFromEuler(p.rot);
      this.m.compose(p.p, this.q, this.s);
      this.solid.setMatrixAt(d, this.m);
      this.solid.setColorAt(d, p.color);
      d++;
    }
    this.solid.count = d;
    this.solid.instanceMatrix.needsUpdate = true;
    if (this.solid.instanceColor) this.solid.instanceColor.needsUpdate = true;
  }
}
