// Geração procedural de Hogwarts e seus arredores em voxels.
import { B } from './blocks.js';

export const SX = 176, SY = 72, SZ = 176;
export const G = 13; // bloco de superfície do terreno plano
export const F = 14; // nível do chão (onde os pés ficam)
const WATER_LEVEL = 12;

// ---------- ruído ----------
function hash2(x, z, seed = 1337) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const tx = smooth(x - xi), tz = smooth(z - zi);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}
function fbm(x, z) {
  return valueNoise(x, z, 1) * 0.65 + valueNoise(x * 2.1, z * 2.1, 2) * 0.35;
}
let rs = 424242;
function rand() {
  rs = (rs + 0x6d2b79f5) >>> 0;
  let t = rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Zonas planas (retângulos e discos) — o terreno é suavizado para G nelas
const FLAT_RECTS = [
  [30, 10, 146, 98],   // castelo
  [64, 122, 120, 158], // campo de quadribol
  [92, 96, 114, 114],  // estufas
];
const FLAT_DISCS = [
  [132, 124, 11], // cabana do Hagrid
  [66, 112, 5],   // Neville
];
const LAKE = { cx: 40, cz: 132, rx: 30, rz: 22 };
const ISLAND = { x: 30, z: 135, r: 3 };
const PITCH = { cx: 92, cz: 140, rx: 24, rz: 12 };

function lakeE(x, z) {
  return ((x - LAKE.cx) / LAKE.rx) ** 2 + ((z - LAKE.cz) / LAKE.rz) ** 2;
}

function terrainHeight(x, z) {
  let h = 12 + fbm(x / 26, z / 26) * 6;
  // distância até zona plana mais próxima
  let dmin = Infinity;
  for (const [x0, z0, x1, z1] of FLAT_RECTS) {
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
    dmin = Math.min(dmin, Math.hypot(dx, dz));
  }
  for (const [cx, cz, r] of FLAT_DISCS) dmin = Math.min(dmin, Math.max(0, Math.hypot(x - cx, z - cz) - r));
  h = lerp(G, h, clamp(dmin / 10, 0, 1));
  // lago
  const e = lakeE(x, z);
  if (e < 1.5) {
    const shore = lerp(G, h, clamp((e - 1) / 0.5, 0, 1));
    h = e < 1 ? Math.min(shore, WATER_LEVEL - (1 - e) * 8) : Math.min(h, shore);
    if (e < 1) h = Math.min(h, WATER_LEVEL - 0.5);
  }
  const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  if (di < ISLAND.r + 2) h = Math.max(h, lerp(G, WATER_LEVEL - 2, clamp((di - ISLAND.r) / 2, 0, 1)));
  // montanhas na borda
  const edge = Math.min(x, z, SX - 1 - x, SZ - 1 - z);
  if (edge < 16) h += Math.pow((16 - edge) / 16, 1.6) * (26 + fbm(x / 9, z / 9) * 14);
  return Math.round(clamp(h, 2, SY - 4));
}

export function generateHogwarts(world) {
  const S = (x, y, z, id) => world.setRaw(x, y, z, id);
  const Gt = (x, y, z) => world.get(x, y, z);
  const fill = (x0, y0, z0, x1, y1, z1, id) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) S(x, y, z, id);
  };
  const heights = new Int16Array(SX * SZ);
  const props = []; // objetos decorativos pequenos (velas, cálices, pratos)

  // ---------- terreno ----------
  for (let z = 0; z < SZ; z++) {
    for (let x = 0; x < SX; x++) {
      const h = terrainHeight(x, z);
      heights[z * SX + x] = h;
      const e = lakeE(x, z);
      const beach = e < 1.25 && h <= G;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = B.BEDROCK;
        else if (y < h - 3) id = B.STONE;
        else if (y < h) id = beach ? B.SAND : B.DIRT;
        else id = beach ? B.SAND : h > 30 ? (h > 38 ? B.MARBLE : B.STONE) : B.GRASS;
        S(x, y, z, id);
      }
      for (let y = h + 1; y <= WATER_LEVEL; y++) S(x, y, z, B.WATER);
    }
  }
  const hAt = (x, z) => heights[clamp(z, 0, SZ - 1) * SX + clamp(x, 0, SX - 1)];

  // ---------- helpers de construção ----------
  // Sala: interior de (x0+1..x1-1, z0+1..z1-1), ar de F..F+h-1, teto em F+h
  const room = (x0, z0, x1, z1, h, { wall = B.BRICK, floor = B.FLOOR, ceil = B.BRICK } = {}) => {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        for (let y = F - 3; y <= F + h; y++) {
          if (y < F - 1) { S(x, y, z, B.STONE); continue; }
          if (edge) S(x, y, z, wall);
          else if (y === F - 1) S(x, y, z, floor);
          else if (y === F + h) S(x, y, z, ceil);
          else S(x, y, z, B.AIR);
        }
      }
    }
  };
  const crenel = (x0, z0, x1, z1, y, id = B.BRICK) => {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        if (edge && (x + z) % 2 === 0) S(x, y, z, id);
      }
    }
  };
  const gableRoofZ = (x0, z0, x1, z1, y0, id = B.SLATE, gable = B.BRICK) => {
    // telhado com cumeeira ao longo de z
    for (let i = 0; x0 - 1 + i <= x1 + 1 - i; i++) {
      const y = y0 + i;
      const a = x0 - 1 + i, b = x1 + 1 - i;
      for (let z = z0 - 1; z <= z1 + 1; z++) { S(a, y, z, id); S(b, y, z, id); }
      for (let x = a + 1; x <= b - 1; x++) { S(x, y, z0, gable); S(x, y, z1, gable); }
    }
  };
  const gableRoofX = (x0, z0, x1, z1, y0, id = B.SLATE, gable = B.BRICK) => {
    for (let i = 0; z0 - 1 + i <= z1 + 1 - i; i++) {
      const y = y0 + i;
      const a = z0 - 1 + i, b = z1 + 1 - i;
      for (let x = x0 - 1; x <= x1 + 1; x++) { S(x, y, a, id); S(x, y, b, id); }
      for (let z = a + 1; z <= b - 1; z++) { S(x0, y, z, gable); S(x1, y, z, gable); }
    }
  };
  const carve = (x0, y0, z0, x1, y1, z1) => fill(x0, y0, z0, x1, y1, z1, B.AIR);
  const cone = (cx, cz, r, y0, id) => {
    for (let k = 0; ; k++) {
      const rr = r - k * 0.55;
      if (rr < 0.3) { S(Math.floor(cx), y0 + k, Math.floor(cz), id); break; }
      for (let z = Math.floor(cz - rr - 1); z <= Math.ceil(cz + rr + 1); z++)
        for (let x = Math.floor(cx - rr - 1); x <= Math.ceil(cx + rr + 1); x++) {
          const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
          if (d <= rr && d > rr - 1.6) S(x, y0 + k, z, id);
        }
    }
  };
  // Torre redonda com escada em espiral. Retorna y do piso superior.
  const tower = (cx, cz, r, levels, { wall = B.BRICK, roof = B.SLATE, topFloor = null, open = false, doorAngle = 0 } = {}) => {
    const top = F + levels; // bloco do piso superior
    const wallTop = open ? top + 2 : top + 6;
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d > r) continue;
        for (let y = F - 3; y <= wallTop; y++) {
          if (y < F - 1) S(x, y, z, B.STONE);
          else if (d > r - 1.2) S(x, y, z, wall);
          else if (y === F - 1) S(x, y, z, B.FLOOR);
          else if (d < 1.6 && y < top) S(x, y, z, B.DARK_BRICK);
          else if (y === top) S(x, y, z, topFloor || B.PLANK);
          else if (!open && y === wallTop) S(x, y, z, wall);
          else S(x, y, z, B.AIR);
        }
      }
    }
    // escada espiral
    const theta = Math.PI / 6;
    for (let k = 0; k < levels; k++) {
      const a0 = doorAngle + 0.35 + k * theta;
      const y = F + k;
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
          if (d < 1.6 || d > r - 1.2) continue;
          let a = Math.atan2(z + 0.5 - cz, x + 0.5 - cx) - a0;
          a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          if (a < theta) S(x, y, z, B.PLANK);
          // abre o piso superior acima dos últimos degraus
          if (k >= levels - 5 && a < theta) { S(x, top, z, B.AIR); S(x, top + 1, z, B.AIR); }
        }
      }
    }
    // porta
    const dx = Math.round(cx + Math.cos(doorAngle) * (r - 0.5) - 0.5), dz = Math.round(cz + Math.sin(doorAngle) * (r - 0.5) - 0.5);
    for (let o = -1; o <= 1; o++) {
      const px = Math.abs(Math.cos(doorAngle)) > 0.5 ? dx : dx + o;
      const pz = Math.abs(Math.cos(doorAngle)) > 0.5 ? dz + o : dz;
      for (let t = -1; t <= 1; t++) {
        const qx = Math.abs(Math.cos(doorAngle)) > 0.5 ? px + t : px;
        const qz = Math.abs(Math.cos(doorAngle)) > 0.5 ? pz : pz + t;
        carve(qx, F, qz, qx, F + 2, qz);
      }
    }
    // janelas em todos os andares
    for (let y = F + 4; y < wallTop - 1; y += 6) {
      for (let a = 0; a < 8; a++) {
        const ang = a * Math.PI / 4 + 0.2;
        const wx = Math.floor(cx + Math.cos(ang) * (r - 0.4)), wz = Math.floor(cz + Math.sin(ang) * (r - 0.4));
        if (Gt(wx, y, wz) === wall) { S(wx, y, wz, B.GLASS); S(wx, y + 1, wz, B.GLASS); }
      }
    }
    if (open) {
      for (let a = 0; a < 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        const wx = Math.floor(cx + Math.cos(ang) * (r - 0.5)), wz = Math.floor(cz + Math.sin(ang) * (r - 0.5));
        S(wx, wallTop + 1, wz, a % 2 ? wall : B.AIR);
      }
    } else {
      cone(cx, cz, r + 1.2, wallTop + 1, roof);
    }
    return top;
  };

  const tree = (x, z, { dark = false, tall = 0 } = {}) => {
    const y0 = hAt(x, z) + 1;
    if (y0 <= WATER_LEVEL + 1) return;
    const h = 4 + Math.floor(rand() * 3) + tall;
    for (let y = y0; y < y0 + h; y++) S(x, y, z, B.LOG);
    const r = dark ? 2.8 + rand() : 2.2 + rand() * 0.8;
    const cy = y0 + h - 1;
    for (let dy = -2; dy <= 3; dy++)
      for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++) {
          const d = Math.hypot(dx, dy * 1.2, dz);
          if (d < r && Gt(x + dx, cy + dy, z + dz) === B.AIR && rand() > 0.08)
            S(x + dx, cy + dy, z + dz, dark ? B.DARK_LEAVES : B.LEAVES);
        }
  };

  // ---------- CASTELO ----------
  // Salão Principal
  room(68, 18, 96, 60, 14, { ceil: B.NIGHT_SKY });
  gableRoofZ(68, 18, 96, 60, F + 15);
  // estrado da mesa dos professores
  fill(69, F, 19, 95, F, 25, B.PLANK);
  fill(74, F + 1, 23, 90, F + 1, 23, B.DARK_WOOD);
  S(82, F + 1, 20, B.GOLD); S(82, F + 2, 19, B.GOLD); S(82, F + 3, 19, B.GOLD);
  for (const x of [76, 79, 85, 88]) { S(x, F + 1, 20, B.DARK_WOOD); S(x, F + 2, 19, B.DARK_WOOD); }
  // vitral grande
  fill(78, F + 4, 18, 86, F + 12, 18, B.STAINED);
  // mesas das casas
  for (const tx of [72, 78, 85, 91]) {
    fill(tx, F, 29, tx + 1, F, 56, B.DARK_WOOD);
    fill(tx - 1, F, 29, tx - 1, F, 56, B.PLANK);
    fill(tx + 2, F, 29, tx + 2, F, 56, B.PLANK);
    for (let z = 29; z <= 56; z++) {
      for (const side of [0, 1]) {
        const px = tx + side + (side ? 0.3 : 0.7);
        if (z % 2 === 0) props.push({ type: 'plate', x: px, y: F + 1, z: z + 0.5 });
        else if (rand() < 0.6) props.push({ type: rand() < 0.7 ? 'goblet' : 'juice', x: px, y: F + 1, z: z + 0.5 });
      }
    }
  }
  // velas flutuantes
  for (let x = 71; x <= 94; x += 3)
    for (let z = 28; z <= 57; z += 4)
      props.push({ type: 'candle', float: true, x: x + rand(), y: F + 8 + rand() * 3, z: z + (x % 2) + rand() });
  // janelas laterais e estandartes das casas
  for (const z of [24, 36, 48]) {
    fill(68, F + 3, z, 68, F + 10, z + 1, B.GLASS);
    fill(96, F + 3, z, 96, F + 10, z + 1, B.GLASS);
  }
  const banner = (x, z, id) => { fill(x, F + 3, z, x, F + 11, z + 2, id); fill(x, F + 12, z, x, F + 12, z + 2, B.GOLD); };
  banner(69, 29, B.RED); banner(69, 41, B.GREEN); banner(95, 29, B.YELLOW); banner(95, 41, B.BLUE);
  // tochas
  for (let z = 27; z <= 57; z += 6) { S(68, F + 3, z, B.TORCH); S(96, F + 3, z, B.TORCH); }

  // Saguão de Entrada
  room(66, 60, 98, 82, 12);
  gableRoofX(66, 60, 98, 82, F + 13);
  crenel(66, 60, 98, 82, F + 13);
  carve(80, F, 60, 84, F + 6, 60); // porta p/ Salão Principal
  carve(79, F, 82, 85, F + 7, 82); // portões principais
  fill(81, F - 1, 61, 83, F - 1, 81, B.CARPET);
  carve(66, F, 68, 66, F + 3, 71); // porta p/ pátio
  carve(98, F, 69, 98, F + 3, 71); // porta p/ sala de aula
  // ampulhetas das casas
  const hg = [[70, B.RED], [74, B.GREEN], [90, B.YELLOW], [94, B.BLUE]];
  for (const [x, id] of hg) {
    S(x, F, 62, B.GOLD); S(x, F + 1, 62, id); S(x, F + 2, 62, id);
    S(x, F + 3, 62, B.GLASS); S(x, F + 4, 62, B.GLASS); S(x, F + 5, 62, B.GOLD);
  }
  for (const x of [69, 74, 90, 95]) { S(x, F + 4, 60, B.TORCH); S(x, F + 4, 82, B.TORCH); }
  // escadaria (decorativa) até um balcão
  for (let i = 0; i < 6; i++) fill(88 + i, F + i, 76, 88 + i, F + i, 80, B.MARBLE);
  fill(94, F + 5, 63, 97, F + 5, 81, B.MARBLE);
  for (let z = 63; z <= 81; z++) if (z % 2) S(93, F + 6, z, B.MARBLE);

  // Pátio (céu aberto)
  for (let z = 56; z <= 92; z++) {
    for (let x = 36; x <= 66; x++) {
      const edge = x === 36 || x === 66 || z === 56 || z === 92;
      for (let y = F - 3; y <= F + 6; y++) {
        if (y < F - 1) S(x, y, z, B.STONE);
        else if (y === F - 1) S(x, y, z, edge ? B.BRICK : (x === 51 || z === 74 ? B.PATH : B.GRASS));
        else if (edge && x !== 66) {
          const arch = (x + z) % 4 !== 0 && y >= F && y <= F + 2 && (z === 92 || x === 36);
          S(x, y, z, y === F + 6 ? ((x + z) % 2 ? B.BRICK : B.AIR) : arch ? B.AIR : B.BRICK);
        } else if (!edge) S(x, y, z, B.AIR);
      }
    }
  }
  carve(48, F, 92, 54, F + 4, 92); // saída para os jardins
  // fonte
  for (let z = 70; z <= 78; z++)
    for (let x = 47; x <= 55; x++) {
      const d = Math.hypot(x - 51, z - 74);
      if (d <= 4) {
        S(x, F - 2, z, B.MARBLE);
        if (d > 3) { S(x, F - 1, z, B.MARBLE); S(x, F, z, B.MARBLE); } else S(x, F - 1, z, B.WATER);
      }
    }
  fill(51, F - 1, 74, 51, F + 2, 74, B.MARBLE);
  S(51, F + 3, 74, B.WATER);
  S(44, F, 64, B.MARBLE); // pedestal da pena
  tree(40, 88); tree(62, 60);

  // Sala de Poções (masmorra)
  room(36, 30, 66, 56, 7, { wall: B.DARK_BRICK, floor: B.DARK_BRICK, ceil: B.DARK_BRICK });
  gableRoofX(36, 30, 66, 56, F + 8);
  carve(49, F, 56, 51, F + 3, 56);
  fill(46, F, 33, 54, F, 33, B.DARK_WOOD);
  for (const z of [38, 44, 50])
    for (const x of [41, 47, 54, 60]) {
      fill(x - 1, F, z + 1, x + 1, F, z + 1, B.DARK_WOOD);
      S(x, F, z, B.CAULDRON); S(x, F + 1, z, B.POTION);
    }
  for (let z = 32; z <= 54; z++) {
    const id = z % 3 === 0 ? B.POTION : B.BOOKSHELF;
    fill(37, F, z, 37, F + 3, z, B.BOOKSHELF);
    if (z % 3 === 0) { S(37, F + 1, z, id); S(37, F + 3, z, B.POTION); }
  }
  for (let x = 40; x <= 64; x += 6) { S(x, F + 3, 30, B.TORCH); S(x, F + 3, 56, B.TORCH); }

  // Torre da Grifinória
  const gTop = tower(48, 20, 7, 24, { roof: B.RED_ROOF, doorAngle: 0 });
  // dormitório: camas de dossel
  for (const [bx, bz] of [[43, 15], [52, 15], [43, 23]]) {
    fill(bx, gTop + 1, bz, bx + 1, gTop + 1, bz + 2, B.RED);
    for (const [px, pz] of [[bx - 1, bz - 1], [bx + 2, bz - 1], [bx - 1, bz + 3], [bx + 2, bz + 3]]) {
      if (Math.hypot(px + 0.5 - 48, pz + 0.5 - 20) < 5.8) fill(px, gTop + 1, pz, px, gTop + 3, pz, B.DARK_WOOD);
    }
    fill(bx - 1, gTop + 4, bz - 1, bx + 2, gTop + 4, bz + 3, B.RED);
  }
  fill(47, F, 18, 49, F + 1, 18, B.TORCH); // lareira no pilar central
  for (let z = 17; z <= 23; z++) for (let x = 45; x <= 51; x++) if (Gt(x, F - 1, z) === B.FLOOR) S(x, F - 1, z, B.RED);

  // Biblioteca
  room(98, 18, 130, 58, 10, { floor: B.PLANK });
  gableRoofX(98, 18, 130, 58, F + 11);
  crenel(98, 18, 130, 58, F + 11);
  // passagem do Salão Principal
  fill(96, F - 1, 52, 98, F + 4, 56, B.BRICK);
  carve(96, F, 53, 98, F + 3, 55);
  fill(97, F - 1, 53, 97, F - 1, 55, B.FLOOR);
  // estantes
  for (const z of [20, 24, 31, 35, 39, 43]) {
    fill(101, F, z, 112, F + 5, z + 1, B.BOOKSHELF);
    fill(116, F, z, 127, F + 5, z + 1, B.BOOKSHELF);
  }
  for (let x = 99; x <= 129; x += 2) if (x < 113 || x > 115) fill(x, F, 28, x, F + 1, 28, B.DARK_WOOD); // Seção Restrita
  fill(99, F - 1, 19, 129, F - 1, 27, B.DARK_BRICK);
  for (const [x, z] of [[104, 50], [112, 50], [120, 50], [104, 54], [112, 54], [120, 54]]) {
    fill(x, F, z, x + 3, F, z + 1, B.DARK_WOOD);
    props.push({ type: 'candle', x: x + 1.5, y: F + 1, z: z + 0.5 });
  }
  for (const z of [32, 40, 48]) fill(130, F + 2, z, 130, F + 7, z + 1, B.GLASS);
  for (let z = 22; z <= 56; z += 6) { S(98, F + 4, z, B.TORCH); S(130, F + 4, z, B.TORCH); }

  // Sala de aula (Defesa Contra as Artes das Trevas)
  room(98, 60, 124, 82, 8, { floor: B.PLANK });
  gableRoofX(98, 60, 124, 82, F + 9);
  carve(98, F, 69, 98, F + 3, 71);
  // passagem para a biblioteca
  fill(107, F - 1, 58, 111, F + 4, 60, B.BRICK);
  carve(108, F, 58, 110, F + 3, 60);
  fill(108, F - 1, 59, 110, F - 1, 59, B.PLANK);
  fill(124, F + 2, 65, 124, F + 4, 73, B.SLATE); // quadro-negro
  fill(107, F, 63, 113, F, 63, B.DARK_WOOD);
  for (const z of [67, 71, 75, 79]) { fill(102, F, z, 107, F, z, B.DARK_WOOD); fill(113, F, z, 118, F, z, B.DARK_WOOD); }
  for (const x of [104, 110, 116]) fill(x, F + 2, 82, x + 1, F + 5, 82, B.GLASS);
  fill(120, F, 62, 122, F + 2, 64, B.GOLD); carve(121, F, 63, 121, F + 1, 63); carve(121, F, 62, 121, F + 1, 62); // gaiola aberta
  for (const z of [64, 77]) S(98, F + 3, z, B.TORCH);
  for (const x of [101, 105, 114, 120]) S(x, F + 3, 60, B.TORCH);

  // torres de canto do Salão Principal
  tower(68, 18, 3.5, 22, { roof: B.SLATE, doorAngle: Math.PI });
  tower(96, 18, 3.5, 22, { roof: B.SLATE, doorAngle: 0 });

  // torres do portão principal e Torre da Corvinal
  tower(66, 83, 3.5, 18, { roof: B.SLATE, doorAngle: Math.PI / 2 });
  tower(98, 83, 3.5, 18, { roof: B.SLATE, doorAngle: Math.PI / 2 });
  tower(36, 56, 4.5, 28, { roof: B.BLUE_ROOF, doorAngle: Math.PI / 2 });
  // fachada: janelas e rosácea sobre o portão
  for (const x of [71, 92]) fill(x, F + 5, 82, x + 1, F + 9, 82, B.GLASS);
  for (let y = F + 8; y <= F + 12; y++) for (let x = 80; x <= 84; x++) {
    if (Math.hypot(x - 82, y - (F + 10)) <= 2.2) S(x, y, 82, B.STAINED);
  }

  // Torre de Astronomia
  const aTop = tower(136, 70, 6, 38, { open: true, doorAngle: Math.PI });
  S(136, aTop + 1, 70, B.GOLD); S(137, aTop + 2, 70, B.GOLD); S(138, aTop + 3, 70, B.GOLD);

  // ---------- JARDINS ----------
  const pathAt = (x, z) => {
    const h = hAt(x, z);
    if (Gt(x, h, z) === B.GRASS || Gt(x, h, z) === B.DIRT) S(x, h, z, B.PATH);
  };
  const pathLine = (x0, z0, x1, z1, w = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(lerp(x0, x1, i / n)), z = Math.round(lerp(z0, z1, i / n));
      for (let dz = -w; dz <= w; dz++) for (let dx = -w; dx <= w; dx++) pathAt(x + dx, z + dz);
    }
  };
  pathLine(82, 83, 82, 118, 2);
  pathLine(82, 118, 131, 118);
  pathLine(131, 118, 132, 130);
  pathLine(82, 112, 66, 112);
  pathLine(82, 118, 82, 128);
  pathLine(51, 93, 51, 100);
  pathLine(51, 100, 82, 100);
  pathLine(82, 100, 92, 104);

  // Cabana do Hagrid
  {
    const cx = 132, cz = 124, r = 5;
    for (let z = cz - r - 1; z <= cz + r + 1; z++)
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d > r) continue;
        for (let y = F - 1; y <= F + 4; y++) {
          if (y === F - 1) S(x, y, z, B.PLANK);
          else if (d > r - 1.2) S(x, y, z, B.STONE);
          else S(x, y, z, B.AIR);
        }
      }
    cone(cx, cz, r + 1.5, F + 5, B.THATCH);
    carve(131, F, 128, 132, F + 2, 129);
    fill(134, F, 120, 134, F + 11, 120, B.STONE); S(134, F, 121, B.TORCH);
    fill(128, F, 122, 129, F, 125, B.RED); // cama
    fill(133, F, 125, 134, F, 126, B.DARK_WOOD);
    // abóboras gigantes
    for (const [px, pz, s] of [[139, 130, 2], [142, 134, 2], [138, 135, 1], [145, 131, 1], [143, 128, 1]]) {
      fill(px, F, pz, px + s - 1, F + s - 1, pz + s - 1, B.PUMPKIN);
    }
  }

  // Estufas
  {
    const x0 = 94, z0 = 100, x1 = 110, z1 = 110;
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        S(x, F - 1, z, edge ? B.BRICK : B.DIRT);
        for (let y = F; y <= F + 4; y++) S(x, y, z, edge ? B.GLASS : B.AIR);
        S(x, F + 5, z, B.GLASS);
      }
    fill(x0 + 1, F + 6, z0, x1 - 1, F + 6, z1, B.GLASS);
    carve(x0, F, 104, x0, F + 2, 106);
    for (const z of [102, 108]) for (let x = 97; x <= 108; x++) {
      S(x, F, z, B.DIRT);
      if (x % 2) S(x, F + 1, z, rand() < 0.5 ? B.LEAVES : B.DARK_LEAVES);
    }
  }

  // Salgueiro Lutador
  {
    const x = 58, z = 104, y0 = hAt(x, z) + 1;
    fill(x, y0, z, x + 1, y0 + 7, z + 1, B.LOG);
    const branches = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
    for (const [bx, bz] of branches) {
      for (let i = 1; i <= 4; i++) S(x + bx * i + (bx > 0 ? 1 : 0), y0 + 6 + Math.floor(i / 2), z + bz * i + (bz > 0 ? 1 : 0), B.LOG);
      for (let dy = 0; dy < 3; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
        if (rand() < 0.7) {
          const lx = x + bx * 5 + dx + (bx > 0 ? 1 : 0), ly = y0 + 8 + dy, lz = z + bz * 5 + dz + (bz > 0 ? 1 : 0);
          if (Gt(lx, ly, lz) === B.AIR) S(lx, ly, lz, B.LEAVES);
        }
    }
  }

  // Campo de Quadribol
  {
    for (let z = PITCH.cz - PITCH.rz - 1; z <= PITCH.cz + PITCH.rz + 1; z++)
      for (let x = PITCH.cx - PITCH.rx - 1; x <= PITCH.cx + PITCH.rx + 1; x++) {
        const e = ((x - PITCH.cx) / PITCH.rx) ** 2 + ((z - PITCH.cz) / PITCH.rz) ** 2;
        if (e < 1.08 && e > 0.9) S(x, hAt(x, z), z, B.SAND);
      }
    fill(PITCH.cx, G, PITCH.cz - PITCH.rz + 1, PITCH.cx, G, PITCH.cz + PITCH.rz - 1, B.SAND);
    const hoop = (x, z, hgt) => {
      fill(x, F, z, x, F + hgt, z, B.GOLD);
      const cy = F + hgt + 2;
      for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 3; dy++) {
        const d = Math.hypot(dz, dy);
        if (d > 1.6 && d < 2.6) S(x, cy + dy, z + dz, B.GOLD);
      }
    };
    for (const x of [PITCH.cx - PITCH.rx + 2, PITCH.cx + PITCH.rx - 2]) {
      hoop(x, PITCH.cz - 5, 8); hoop(x, PITCH.cz, 12); hoop(x, PITCH.cz + 5, 8);
    }
    // arquibancadas
    const stands = [[PITCH.cx - 14, PITCH.cz - PITCH.rz - 5, B.RED], [PITCH.cx + 6, PITCH.cz - PITCH.rz - 5, B.GREEN],
      [PITCH.cx - 14, PITCH.cz + PITCH.rz + 2, B.YELLOW], [PITCH.cx + 6, PITCH.cz + PITCH.rz + 2, B.BLUE]];
    for (const [sx, sz, id] of stands) {
      fill(sx, F, sz, sx + 7, F + 6, sz + 2, B.PLANK);
      fill(sx, F + 7, sz, sx + 7, F + 9, sz + 2, id);
      carve(sx + 1, F + 7, sz + 1, sx + 6, F + 8, sz + 1);
    }
  }

  // Árvores e Floresta Proibida
  const blocked = (x, z) => {
    if (x > 28 && x < 148 && z > 8 && z < 98) return true; // castelo
    if (lakeE(x, z) < 1.4) return true;
    if (x > 64 && x < 120 && z > 122 && z < 158) return true; // campo
    if (Math.hypot(x - 132, z - 124) < 16) return true;
    if (x > 90 && x < 114 && z > 96 && z < 114) return true;
    if (Math.hypot(x - 58, z - 104) < 8) return true;
    if (Math.abs(x - 82) < 5 && z > 80 && z < 130) return true;
    if (Math.abs(z - 118) < 4 && x > 78 && x < 134) return true;
    if (Math.abs(z - 112) < 4 && x > 62 && x < 86) return true;
    return false;
  };
  for (let z = 4; z < SZ - 4; z += 3) {
    for (let x = 4; x < SX - 4; x += 3) {
      const jx = x + Math.floor(rand() * 3), jz = z + Math.floor(rand() * 3);
      if (blocked(jx, jz)) continue;
      const h = hAt(jx, jz);
      if (h > 28) continue;
      const forest = jx > 146 || (jz > 156 && jx > 100) || (jx < 26 && jz < 96);
      if (forest ? rand() < 0.55 : rand() < 0.035) tree(jx, jz, { dark: forest, tall: forest ? 3 : 0 });
    }
  }
  // Lula gigante (tentáculos)
  for (const [tx, tz] of [[46, 128], [48, 131], [44, 133]]) {
    for (let i = 0; i < 3; i++) S(tx + (i === 2 ? 1 : 0), WATER_LEVEL - 1 + i, tz, B.BLUE);
  }

  const surface = (x, z) => world.surfaceY(x, z);

  return {
    props,
    spawn: { x: 82.5, y: F, z: 92.5, yaw: 0 },
    npcs: {
      dumbledore: { x: 82.5, y: F + 1, z: 21.5 },
      hermione: { x: 108.5, y: F, z: 47.5 },
      ron: { x: 45.5, y: F, z: 69.5 },
      mcgonagall: { x: 110.5, y: F, z: 65.5 },
      snape: { x: 50.5, y: F, z: 35.5 },
      hagrid: { x: 131.5, y: F, z: 133.5 },
      neville: { x: 67.5, y: surface(67, 112), z: 112.5 },
      nick: { x: 82.5, y: F + 0.5, z: 45.5 },
    },
    entities: {
      book: { x: 122, y: F + 6.3, z: 21 },
      trevor: { x: ISLAND.x + 0.5, y: surface(ISLAND.x, ISLAND.z), z: ISLAND.z + 0.5 },
      feather: { x: 44.5, y: F + 1.3, z: 64.5 },
      braziers: [[124.5, 117.5], [140.5, 118.5], [124.5, 131.5]].map(([x, z]) => ({ x, y: surface(x, z), z })),
      pixieArea: { x0: 100, x1: 122, y0: F + 1, y1: F + 6, z0: 62, z1: 80 },
      snitchArea: { cx: PITCH.cx, cz: PITCH.cz, rx: PITCH.rx - 2, rz: PITCH.rz + 4, y0: F + 3, y1: F + 22 },
      cards: [
        { x: 136.5, y: aTop + 1.4, z: 67.5 },
        { x: 48.5, y: gTop + 1.4, z: 24.5 },
        { x: 86.5, y: F + 1.4, z: 21.5 },
        { x: 162.5, y: surface(162, 100) + 0.4, z: 100.5 },
        { x: PITCH.cx - PITCH.rx + 2.5, y: F + 12 + 5.4, z: PITCH.cz + 0.5 },
        { x: 102.5, y: F + 0.4, z: 105.5 },
      ],
    },
  };
}
