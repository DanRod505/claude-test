// Modelos voxel de personagens, criaturas e objetos, montados com caixas.
import * as THREE from 'three';

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, opts.basic
      ? new THREE.MeshBasicMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1 })
      : new THREE.MeshLambertMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, emissive: opts.emissive ?? 0 }));
  }
  return matCache.get(key);
}

function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  return m;
}

// Personagem humanoide. O modelo olha para +z.
export function buildCharacter(a) {
  const o = a.ghost ? { opacity: 0.55 } : undefined;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = a.skin ?? 0xf1c9a5;
  const robe = a.robe ?? 0x1b1b22;
  const pants = a.pants ?? 0x2a2a30;

  // pernas (pivô no quadril)
  const legs = [];
  for (const sx of [-0.13, 0.13]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.78, 0);
    pivot.add(box(0.24, 0.78, 0.26, pants, 0, -0.39, 0, o));
    pivot.add(box(0.26, 0.12, 0.34, 0x151515, 0, -0.74, 0.04, o));
    body.add(pivot);
    legs.push(pivot);
  }
  // túnica
  body.add(box(0.64, 0.5, 0.4, robe, 0, 0.62, 0, o));
  body.add(box(0.62, 0.62, 0.36, robe, 0, 1.08, 0, o));
  if (a.trim) {
    body.add(box(0.12, 0.5, 0.02, a.trim, 0, 1.1, 0.19, o));
    body.add(box(0.3, 0.06, 0.02, a.trim, 0, 1.36, 0.19, o));
  }
  if (a.ruff) body.add(box(0.62, 0.1, 0.5, 0xeeeeee, 0, 1.42, 0, o));

  // braços (pivô no ombro)
  const arms = [];
  for (const sx of [-0.41, 0.41]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.36, 0);
    pivot.add(box(0.22, 0.6, 0.26, robe, 0, -0.28, 0, o));
    pivot.add(box(0.17, 0.15, 0.17, skin, 0, -0.64, 0, o));
    body.add(pivot);
    arms.push(pivot);
  }
  if (a.wand) {
    const w = box(0.04, 0.04, 0.4, 0x3b2616, 0, -0.68, 0.18);
    arms[1].add(w);
  }

  // cabeça
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0);
  body.add(head);
  head.add(box(0.46, 0.46, 0.46, skin, 0, 0.23, 0, o));
  // olhos
  for (const sx of [-0.1, 0.1]) {
    head.add(box(0.08, 0.06, 0.02, 0xffffff, sx, 0.26, 0.235, o));
    head.add(box(0.045, 0.06, 0.025, a.eyes ?? 0x2b3a55, sx, 0.26, 0.24, o));
  }
  head.add(box(0.06, 0.08, 0.04, shadeHex(skin, 0.9), 0, 0.18, 0.24, o)); // nariz
  if (a.hair) {
    const hc = a.hair;
    head.add(box(0.5, 0.12, 0.5, hc, 0, 0.5, 0, o));
    head.add(box(0.5, 0.36, 0.1, hc, 0, 0.32, -0.22, o));
    head.add(box(0.06, 0.24, 0.48, hc, -0.24, 0.36, 0, o));
    head.add(box(0.06, 0.24, 0.48, hc, 0.24, 0.36, 0, o));
    if (a.hairStyle === 'long' || a.hairStyle === 'bushy') {
      const w = a.hairStyle === 'bushy' ? 0.62 : 0.52;
      head.add(box(w, 0.6, 0.18, hc, 0, 0.12, -0.2, o));
      head.add(box(0.1, 0.5, 0.36, hc, -w / 2 + 0.03, 0.15, -0.02, o));
      head.add(box(0.1, 0.5, 0.36, hc, w / 2 - 0.03, 0.15, -0.02, o));
      if (a.hairStyle === 'bushy') head.add(box(0.6, 0.16, 0.58, hc, 0, 0.52, -0.02, o));
    }
    if (a.hairStyle === 'bun') head.add(box(0.22, 0.22, 0.18, hc, 0, 0.42, -0.3, o));
  }
  if (a.beard) {
    head.add(box(0.46, 0.2, 0.08, a.beard, 0, 0.06, 0.24, o));
    const len = a.beardLength ?? 0.3;
    head.add(box(0.34, len, 0.1, a.beard, 0, -len / 2, 0.22, o));
  }
  if (a.glasses) {
    for (const sx of [-0.1, 0.1]) head.add(box(0.14, 0.1, 0.02, a.glasses, sx, 0.26, 0.25));
  }
  if (a.hat) {
    const hat = new THREE.Group();
    hat.position.set(0, 0.5, 0);
    hat.add(box(0.76, 0.05, 0.76, a.hat, 0, 0, 0, o));
    const layers = [0.44, 0.36, 0.28, 0.2, 0.13];
    layers.forEach((s, i) => hat.add(box(s, 0.14, s, a.hat, (i > 2 ? (i - 2) * 0.05 : 0), 0.08 + i * 0.13, (i > 2 ? -(i - 2) * 0.05 : 0), o)));
    head.add(hat);
  }
  if (a.headTilt) head.rotation.z = a.headTilt;

  root.scale.setScalar(a.scale ?? 1);
  return { root, body, legs, arms, head };
}

function shadeHex(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}

// Rótulo de nome flutuante
export function makeLabel(text, color = '#ffe9a8') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 44px Georgia, serif';
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  canvas.width = w; canvas.height = 72;
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillStyle = 'rgba(15,10,25,0.6)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 72, 18);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  sprite.scale.set(w / 72 * 0.32, 0.32, 1);
  return sprite;
}

// ---------- criaturas e objetos ----------
export function buildPixie() {
  const g = new THREE.Group();
  g.add(box(0.28, 0.3, 0.22, 0x3a7bd5));
  g.add(box(0.26, 0.24, 0.24, 0x4d8fe8, 0, 0.26, 0));
  for (const sx of [-0.07, 0.07]) g.add(box(0.05, 0.05, 0.02, 0xffffff, sx, 0.28, 0.13));
  g.add(box(0.12, 0.08, 0.04, 0x4d8fe8, -0.16, 0.38, 0));
  g.add(box(0.12, 0.08, 0.04, 0x4d8fe8, 0.16, 0.38, 0));
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = box(0.3, 0.2, 0.02, 0xd6f0ff, sx * 0.2, 0.12, -0.12, { opacity: 0.6 });
    g.add(w); wings.push(w);
  }
  g.userData.wings = wings;
  return g;
}

export function buildBook() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.12, 0.38, 0x5a1c1c));
  g.add(box(0.46, 0.1, 0.36, 0xf3e6c8, 0.03, 0, 0));
  g.add(box(0.06, 0.13, 0.39, 0x3a1010, -0.23, 0, 0));
  g.add(box(0.12, 0.02, 0.12, 0xe0b040, 0, 0.07, 0));
  return g;
}

export function buildToad() {
  const g = new THREE.Group();
  g.add(box(0.36, 0.2, 0.42, 0x5b6b2e, 0, 0.1, 0));
  g.add(box(0.3, 0.14, 0.2, 0x6f8036, 0, 0.2, 0.14));
  for (const sx of [-0.1, 0.1]) {
    g.add(box(0.08, 0.08, 0.08, 0xd8c040, sx, 0.3, 0.2));
    g.add(box(0.04, 0.05, 0.02, 0x111111, sx, 0.3, 0.245));
  }
  for (const sx of [-0.2, 0.2]) g.add(box(0.1, 0.08, 0.26, 0x4c5a26, sx, 0.04, -0.04));
  return g;
}

export function buildFeather() {
  const g = new THREE.Group();
  g.add(box(0.03, 0.03, 0.6, 0xeeeeee));
  for (let i = 0; i < 6; i++) {
    const w = 0.16 - Math.abs(i - 2.5) * 0.03;
    g.add(box(w, 0.015, 0.08, 0xfdfdf5, 0, 0, -0.2 + i * 0.08));
  }
  return g;
}

export function buildBrazier() {
  const g = new THREE.Group();
  g.add(box(0.14, 0.9, 0.14, 0x3a3a40, 0, 0.45, 0));
  g.add(box(0.5, 0.08, 0.5, 0x3a3a40, 0, 0.04, 0));
  g.add(box(0.7, 0.2, 0.7, 0x2c2c32, 0, 1.0, 0));
  const coal = box(0.54, 0.06, 0.54, 0x241a14, 0, 1.12, 0);
  g.add(coal);
  g.userData.coal = coal;
  return g;
}

export function buildCard() {
  const g = new THREE.Group();
  g.add(box(0.36, 0.5, 0.03, 0xc79a3a, 0, 0, 0, { emissive: 0x3a2a00 }));
  g.add(box(0.28, 0.32, 0.035, 0x7a4a2a, 0, 0.04, 0));
  g.add(box(0.14, 0.14, 0.04, 0xf1c9a5, 0, 0.08, 0));
  g.add(box(0.2, 0.08, 0.04, 0xdddddd, 0, -0.04, 0));
  return g;
}

export function buildWand() {
  const g = new THREE.Group();
  g.add(box(0.035, 0.035, 0.5, 0x4a2e1a, 0, 0, -0.25));
  g.add(box(0.055, 0.055, 0.16, 0x2a1a10, 0, 0, 0.02));
  g.add(box(0.06, 0.06, 0.03, 0x6a4a2a, 0, 0, -0.08));
  const tip = box(0.03, 0.03, 0.03, 0xfff4d0, 0, 0, -0.51, { basic: true });
  g.add(tip);
  g.userData.tip = tip;
  return g;
}

export function buildHand(sleeveColor) {
  const g = new THREE.Group();
  g.add(box(0.13, 0.12, 0.16, 0xf1c9a5, 0, 0, 0.05));
  g.add(box(0.17, 0.17, 0.26, sleeveColor, 0, -0.02, 0.24));
  return g;
}

// Patrono (cervo prateado)
export function buildPatronus() {
  const o = { basic: true, opacity: 0.75 };
  const c = 0xcfe8ff;
  const g = new THREE.Group();
  g.add(box(0.5, 0.5, 1.2, c, 0, 1.0, 0, o));
  g.add(box(0.26, 0.5, 0.26, c, 0, 1.4, 0.55, o));
  g.add(box(0.3, 0.3, 0.46, c, 0, 1.7, 0.72, o));
  for (const sx of [-1, 1]) {
    g.add(box(0.05, 0.4, 0.05, c, sx * 0.1, 2.05, 0.62, o));
    g.add(box(0.25, 0.05, 0.05, c, sx * 0.22, 2.2, 0.62, o));
    g.add(box(0.05, 0.25, 0.05, c, sx * 0.32, 2.35, 0.62, o));
  }
  const legs = [];
  for (const [lx, lz] of [[-0.16, 0.45], [0.16, 0.45], [-0.16, -0.45], [0.16, -0.45]]) {
    const p = new THREE.Group();
    p.position.set(lx, 0.8, lz);
    p.add(box(0.12, 0.8, 0.12, c, 0, -0.4, 0, o));
    g.add(p); legs.push(p);
  }
  g.userData.legs = legs;
  return g;
}
