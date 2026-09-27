// Mundo voxel: armazenamento, malhas por chunk (com oclusão ambiente), raycast e rastreio de mudanças.
import * as THREE from 'three';
import { BLOCKS, B, tileUV } from './blocks.js';

export const CHUNK = 16;

// Tabela de faces: direção + 4 cantos (pos, uv). Índices: 0,1,2  2,1,3
const FACES = [
  { dir: [-1, 0, 0], kind: 'side', corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], kind: 'side', corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], kind: 'bottom', corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], kind: 'top', corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], kind: 'side', corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], kind: 'side', corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO_CURVE = [0.42, 0.62, 0.8, 1.0];

function isOpaque(id) {
  const r = BLOCKS[id].render;
  return r === 'solid' || r === 'glow';
}

export class World {
  constructor(sx, sy, sz) {
    this.sx = sx; this.sy = sy; this.sz = sz;
    this.data = new Uint8Array(sx * sy * sz);
    this.cx = Math.ceil(sx / CHUNK); this.cy = Math.ceil(sy / CHUNK); this.cz = Math.ceil(sz / CHUNK);
    this.chunks = new Map(); // key -> {meshes:[]}
    this.dirty = new Set();
    this.original = new Map(); // índice -> bloco original (para Reparo)
    this.group = new THREE.Group();
    this.materials = null;
  }

  idx(x, y, z) { return (y * this.sz + z) * this.sx + x; }
  inBounds(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz; }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return y < 0 ? B.BEDROCK : B.AIR;
    return this.data[this.idx(x, y, z)];
  }

  // Escrita bruta usada pela geração do mapa
  setRaw(x, y, z, id) {
    if (this.inBounds(x, y, z)) this.data[this.idx(x, y, z)] = id;
  }

  // Escrita em jogo: rastreia o original e marca chunks para reconstrução
  set(x, y, z, id, track = true) {
    if (!this.inBounds(x, y, z)) return false;
    const i = this.idx(x, y, z);
    const old = this.data[i];
    if (old === id) return false;
    if (track && !this.original.has(i)) this.original.set(i, old);
    this.data[i] = id;
    if (track && this.original.get(i) === id) this.original.delete(i);
    this.markDirty(x, y, z);
    return true;
  }

  markDirty(x, y, z) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK), cz = Math.floor(z / CHUNK);
    this.dirty.add(this.key(cx, cy, cz));
    const lx = x - cx * CHUNK, ly = y - cy * CHUNK, lz = z - cz * CHUNK;
    if (lx === 0) this.dirty.add(this.key(cx - 1, cy, cz));
    if (lx === CHUNK - 1) this.dirty.add(this.key(cx + 1, cy, cz));
    if (ly === 0) this.dirty.add(this.key(cx, cy - 1, cz));
    if (ly === CHUNK - 1) this.dirty.add(this.key(cx, cy + 1, cz));
    if (lz === 0) this.dirty.add(this.key(cx, cy, cz - 1));
    if (lz === CHUNK - 1) this.dirty.add(this.key(cx, cy, cz + 1));
  }

  key(cx, cy, cz) { return `${cx},${cy},${cz}`; }

  isSolid(x, y, z) {
    return BLOCKS[this.get(Math.floor(x), Math.floor(y), Math.floor(z))].solid;
  }

  isWater(x, y, z) {
    return this.get(Math.floor(x), Math.floor(y), Math.floor(z)) === B.WATER;
  }

  // Maior y sólido na coluna (x,z) abaixo de fromY
  surfaceY(x, z, fromY = this.sy - 1) {
    x = Math.floor(x); z = Math.floor(z);
    for (let y = Math.floor(fromY); y >= 0; y--) {
      if (BLOCKS[this.get(x, y, z)].solid) return y + 1;
    }
    return 0;
  }

  // ---------- Malhas ----------
  initMaterials(atlas) {
    this.materials = {
      solid: new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true }),
      glow: new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true }),
      trans: new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }),
      water: new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }),
    };
  }

  buildAll() {
    for (let cy = 0; cy < this.cy; cy++)
      for (let cz = 0; cz < this.cz; cz++)
        for (let cx = 0; cx < this.cx; cx++) this.buildChunk(cx, cy, cz);
  }

  update(maxPerFrame = 6) {
    let n = 0;
    for (const k of this.dirty) {
      this.dirty.delete(k);
      const [cx, cy, cz] = k.split(',').map(Number);
      if (cx < 0 || cy < 0 || cz < 0 || cx >= this.cx || cy >= this.cy || cz >= this.cz) continue;
      this.buildChunk(cx, cy, cz);
      if (++n >= maxPerFrame) break;
    }
  }

  buildChunk(cx, cy, cz) {
    const k = this.key(cx, cy, cz);
    const old = this.chunks.get(k);
    if (old) {
      for (const m of old) { this.group.remove(m); m.geometry.dispose(); }
    }
    const buffers = {
      solid: { pos: [], nor: [], uv: [], col: [], idx: [] },
      glow: { pos: [], nor: [], uv: [], col: [], idx: [] },
      trans: { pos: [], nor: [], uv: [], col: [], idx: [] },
      water: { pos: [], nor: [], uv: [], col: [], idx: [] },
    };
    const x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK;
    const x1 = Math.min(x0 + CHUNK, this.sx), y1 = Math.min(y0 + CHUNK, this.sy), z1 = Math.min(z0 + CHUNK, this.sz);
    const sx = this.sx, sz = this.sz, data = this.data;

    for (let y = y0; y < y1; y++) {
      for (let z = z0; z < z1; z++) {
        let i = (y * sz + z) * sx + x0;
        for (let x = x0; x < x1; x++, i++) {
          const id = data[i];
          if (id === 0) continue;
          const blk = BLOCKS[id];
          const buf = buffers[blk.render];
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const d = face.dir;
            const nid = this.get(x + d[0], y + d[1], z + d[2]);
            if (!this.faceVisible(id, blk, nid)) continue;
            this.emitFace(buf, x, y, z, face, blk, id);
          }
        }
      }
    }

    const meshes = [];
    for (const kind of Object.keys(buffers)) {
      const b = buffers[kind];
      if (b.idx.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.setIndex(b.idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.materials[kind]);
      if (kind === 'water') mesh.renderOrder = 2;
      if (kind === 'trans') mesh.renderOrder = 1;
      this.group.add(mesh);
      meshes.push(mesh);
    }
    this.chunks.set(k, meshes);
  }

  faceVisible(id, blk, nid) {
    if (nid === 0) return true;
    if (nid === id) return false;
    const nr = BLOCKS[nid].render;
    if (blk.render === 'water') return nr !== 'solid' && nr !== 'glow';
    return nr === 'trans' || nr === 'water';
  }

  emitFace(buf, x, y, z, face, blk, id) {
    const d = face.dir;
    const tile = face.kind === 'top' ? blk.top : face.kind === 'bottom' ? blk.bottom : blk.side;
    const [u0, v0, u1, v1] = tileUV(tile);
    const base = buf.pos.length / 3;
    const ao = [0, 0, 0, 0];
    const waterTop = id === B.WATER && this.get(x, y + 1, z) !== B.WATER;
    // eixos tangentes
    const axis = d[0] !== 0 ? 0 : d[1] !== 0 ? 1 : 2;
    const ta = (axis + 1) % 3, tb = (axis + 2) % 3;
    for (let c = 0; c < 4; c++) {
      const [px, py, pz, uu, vv] = face.corners[c];
      let vy = y + py;
      if (waterTop && py === 1) vy -= 0.12;
      buf.pos.push(x + px, vy, z + pz);
      buf.nor.push(d[0], d[1], d[2]);
      buf.uv.push(uu ? u1 : u0, vv ? v1 : v0);
      let light = 1;
      if (blk.render === 'solid' || blk.render === 'trans') {
        const p = [px, py, pz];
        const o = [x + d[0], y + d[1], z + d[2]];
        const sa = [0, 0, 0], sb = [0, 0, 0];
        sa[ta] = p[ta] ? 1 : -1;
        sb[tb] = p[tb] ? 1 : -1;
        const s1 = isOpaque(this.get(o[0] + sa[0], o[1] + sa[1], o[2] + sa[2])) ? 1 : 0;
        const s2 = isOpaque(this.get(o[0] + sb[0], o[1] + sb[1], o[2] + sb[2])) ? 1 : 0;
        const cc = isOpaque(this.get(o[0] + sa[0] + sb[0], o[1] + sa[1] + sb[1], o[2] + sa[2] + sb[2])) ? 1 : 0;
        const a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
        ao[c] = a;
        light = AO_CURVE[a];
      } else {
        ao[c] = 3;
      }
      buf.col.push(light, light, light);
    }
    if (ao[0] + ao[3] > ao[1] + ao[2]) {
      buf.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
    } else {
      buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }

  // ---------- Raycast (DDA) ----------
  raycast(origin, dir, maxDist = 60, { hitWater = false } = {}) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / dir.x), tDeltaY = Math.abs(1 / dir.y), tDeltaZ = Math.abs(1 / dir.z);
    let tMaxX = dir.x > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
    let tMaxY = dir.y > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
    let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;
    let t = 0;
    const normal = [0, 0, 0];
    while (t <= maxDist) {
      const id = this.get(x, y, z);
      if (id !== 0 && (BLOCKS[id].solid || (hitWater && id === B.WATER))) {
        return { x, y, z, id, t, normal: normal.slice(), point: origin.clone().addScaledVector(dir, t) };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; normal[0] = -stepX; normal[1] = 0; normal[2] = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; normal[0] = 0; normal[1] = -stepY; normal[2] = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal[0] = 0; normal[1] = 0; normal[2] = -stepZ;
      }
    }
    return null;
  }

  // Blocos modificados dentro de um raio (para Reparo)
  changedNear(cx, cy, cz, r, alsoIf = null) {
    const out = [];
    const r2 = r * r;
    for (const [i, orig] of this.original) {
      const x = i % this.sx;
      const z = Math.floor(i / this.sx) % this.sz;
      const y = Math.floor(i / (this.sx * this.sz));
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= r2 || (alsoIf && alsoIf(x, y, z))) out.push({ x, y, z, id: orig, d: Math.sqrt(d2) });
    }
    return out.sort((a, b) => a.d - b.d);
  }
}

// Geometria de um único bloco (para blocos levitando)
export function makeBlockGeometry(id) {
  const blk = BLOCKS[id];
  const pos = [], nor = [], uv = [], col = [], idx = [];
  for (const face of FACES) {
    const tile = face.kind === 'top' ? blk.top : face.kind === 'bottom' ? blk.bottom : blk.side;
    const [u0, v0, u1, v1] = tileUV(tile);
    const base = pos.length / 3;
    for (const [px, py, pz, uu, vv] of face.corners) {
      pos.push(px - 0.5, py - 0.5, pz - 0.5);
      nor.push(...face.dir);
      uv.push(uu ? u1 : u0, vv ? v1 : v0);
      col.push(1, 1, 1);
    }
    idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
