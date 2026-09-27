// Definições de blocos e geração procedural do atlas de texturas (16x16 px por tile).
import * as THREE from 'three';

export const TILE = 16;
export const ATLAS_TILES = 8; // 8x8 tiles => 128x128 px

// Cada bloco: nome, tiles (top/side/bottom), flags de renderização/física.
// render: 'solid' | 'glow' | 'trans' (transparente) | 'water'
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, BRICK: 4, DARK_BRICK: 5, FLOOR: 6, PLANK: 7,
  DARK_WOOD: 8, BOOKSHELF: 9, GLASS: 10, SLATE: 11, RED_ROOF: 12, BLUE_ROOF: 13,
  LEAVES: 14, LOG: 15, WATER: 16, SAND: 17, GOLD: 18, RED: 19, YELLOW: 20, GREEN: 21,
  BLUE: 22, CANDLE: 23, NIGHT_SKY: 24, PUMPKIN: 25, CAULDRON: 26, POTION: 27,
  BEDROCK: 28, MARBLE: 29, THATCH: 30, DARK_LEAVES: 31, TORCH: 32, STAINED: 33,
  PATH: 34, CARPET: 35,
};

// Tiles no atlas (índice = linha*8 + coluna)
const T = {
  grass_top: 0, grass_side: 1, dirt: 2, stone: 3, brick: 4, dark_brick: 5, floor: 6, plank: 7,
  dark_wood: 8, bookshelf: 9, glass: 10, slate: 11, red_roof: 12, blue_roof: 13, leaves: 14, log_side: 15,
  log_top: 16, water: 17, sand: 18, gold: 19, red: 20, yellow: 21, green: 22, blue: 23,
  candle: 24, night_sky: 25, pumpkin_side: 26, pumpkin_top: 27, cauldron: 28, potion: 29, bedrock: 30, marble: 31,
  thatch: 32, dark_leaves: 33, torch: 34, stained: 35, path: 36, carpet: 37,
};

function def(name, tiles, opts = {}) {
  const t = typeof tiles === 'number' ? [tiles, tiles, tiles] : tiles;
  return {
    name, top: t[0], side: t[1], bottom: t[2],
    render: opts.render || 'solid',
    solid: opts.solid !== false,
    breakable: opts.breakable !== false,
    burnable: !!opts.burnable,
  };
}

export const BLOCKS = [];
BLOCKS[B.AIR] = { name: 'ar', solid: false, render: 'none', breakable: false };
BLOCKS[B.GRASS] = def('grama', [T.grass_top, T.grass_side, T.dirt]);
BLOCKS[B.DIRT] = def('terra', T.dirt);
BLOCKS[B.STONE] = def('pedra', T.stone);
BLOCKS[B.BRICK] = def('pedra do castelo', T.brick);
BLOCKS[B.DARK_BRICK] = def('pedra escura', T.dark_brick);
BLOCKS[B.FLOOR] = def('piso', T.floor);
BLOCKS[B.PLANK] = def('madeira', T.plank, { burnable: true });
BLOCKS[B.DARK_WOOD] = def('madeira escura', T.dark_wood, { burnable: true });
BLOCKS[B.BOOKSHELF] = def('estante', [T.plank, T.bookshelf, T.plank], { burnable: true });
BLOCKS[B.GLASS] = def('vidro', T.glass, { render: 'trans' });
BLOCKS[B.SLATE] = def('telhado', T.slate);
BLOCKS[B.RED_ROOF] = def('telhado vermelho', T.red_roof);
BLOCKS[B.BLUE_ROOF] = def('telhado azul', T.blue_roof);
BLOCKS[B.LEAVES] = def('folhas', T.leaves, { render: 'trans', burnable: true });
BLOCKS[B.LOG] = def('tronco', [T.log_top, T.log_side, T.log_top], { burnable: true });
BLOCKS[B.WATER] = def('água', T.water, { render: 'water', solid: false, breakable: false });
BLOCKS[B.SAND] = def('areia', T.sand);
BLOCKS[B.GOLD] = def('ouro', T.gold);
BLOCKS[B.RED] = def('tapeçaria vermelha', T.red, { burnable: true });
BLOCKS[B.YELLOW] = def('tapeçaria amarela', T.yellow, { burnable: true });
BLOCKS[B.GREEN] = def('tapeçaria verde', T.green, { burnable: true });
BLOCKS[B.BLUE] = def('tapeçaria azul', T.blue, { burnable: true });
BLOCKS[B.CANDLE] = def('vela', T.candle, { render: 'glow' });
BLOCKS[B.NIGHT_SKY] = def('teto encantado', T.night_sky, { render: 'glow', breakable: false });
BLOCKS[B.PUMPKIN] = def('abóbora', [T.pumpkin_top, T.pumpkin_side, T.pumpkin_top], { burnable: true });
BLOCKS[B.CAULDRON] = def('caldeirão', T.cauldron);
BLOCKS[B.POTION] = def('poção', T.potion, { render: 'glow' });
BLOCKS[B.BEDROCK] = def('rocha-mãe', T.bedrock, { breakable: false });
BLOCKS[B.MARBLE] = def('mármore', T.marble);
BLOCKS[B.THATCH] = def('palha', T.thatch, { burnable: true });
BLOCKS[B.DARK_LEAVES] = def('folhas escuras', T.dark_leaves, { render: 'trans', burnable: true });
BLOCKS[B.TORCH] = def('tocha', T.torch, { render: 'glow' });
BLOCKS[B.STAINED] = def('vitral', T.stained, { render: 'glow' });
BLOCKS[B.PATH] = def('caminho', T.path);
BLOCKS[B.CARPET] = def('tapete', T.carpet, { burnable: true });

// ---------- Atlas procedural ----------

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade([r, g, b], f) {
  return [Math.max(0, Math.min(255, r * f)), Math.max(0, Math.min(255, g * f)), Math.max(0, Math.min(255, b * f))];
}

const tileAvg = [];
export function blockColor(id) {
  const b = BLOCKS[id];
  return b && b.side !== undefined ? tileAvg[b.side] ?? 0xffffff : 0xffffff;
}

export function buildAtlas() {
  const size = TILE * ATLAS_TILES;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  const painters = {};
  const put = (tile, fn, seed = tile + 1) => { painters[tile] = { fn, seed }; };

  const noisy = (base, amt) => (x, y, r) => shade(base, 1 - amt / 2 + r() * amt);
  const bricks = (base, mortar, bw = 8, bh = 4, amt = 0.18) => (x, y, r) => {
    const row = Math.floor(y / bh);
    const off = (row % 2) * (bw / 2);
    if (y % bh === 0 || (x + off) % bw === 0) return shade(mortar, 0.9 + r() * 0.2);
    return shade(base, 1 - amt / 2 + r() * amt);
  };

  put(T.grass_top, noisy([86, 150, 60], 0.35));
  put(T.grass_side, (x, y, r) => (y < 3 + (r() < 0.4 ? 1 : 0) ? shade([86, 150, 60], 0.85 + r() * 0.3) : shade([121, 85, 58], 0.8 + r() * 0.35)));
  put(T.dirt, noisy([121, 85, 58], 0.4));
  put(T.stone, noisy([125, 125, 128], 0.35));
  put(T.brick, bricks([168, 160, 142], [110, 104, 94]));
  put(T.dark_brick, bricks([82, 80, 88], [50, 48, 54]));
  put(T.floor, (x, y, r) => (((x >> 3) + (y >> 3)) % 2 ? shade([60, 58, 62], 0.9 + r() * 0.15) : shade([196, 190, 176], 0.9 + r() * 0.15)));
  put(T.plank, (x, y, r) => (y % 4 === 0 ? shade([110, 78, 44], 0.8) : shade([158, 116, 70], 0.88 + r() * 0.2 - (x % 7 === 0 ? 0.1 : 0))));
  put(T.dark_wood, (x, y, r) => (y % 4 === 0 ? shade([50, 32, 20], 0.8) : shade([84, 56, 34], 0.85 + r() * 0.2)));
  const bookColors = [[140, 30, 30], [30, 60, 120], [40, 100, 50], [120, 90, 30], [90, 40, 100], [150, 120, 70]];
  put(T.bookshelf, (x, y, r) => {
    if (y === 0 || y === 7 || y === 8 || y === 15 || x === 0 || x === 15) return shade([110, 78, 44], 0.9 + r() * 0.1);
    const shelfRow = y < 8 ? 0 : 1;
    const book = Math.floor((x + shelfRow * 3) / 2);
    const c = bookColors[(book * 7 + shelfRow * 3) % bookColors.length];
    const top = y === 1 || y === 9;
    return shade(c, (top && book % 3 === 0 ? 0.5 : 1) * (0.85 + r() * 0.2));
  });
  put(T.glass, (x, y, r) => (x === 0 || y === 0 || x === 15 || y === 15 ? [70, 70, 80, 255] : [170, 200, 230, 90]));
  put(T.slate, bricks([62, 70, 84], [40, 44, 54], 4, 3, 0.25));
  put(T.red_roof, bricks([150, 36, 34], [90, 20, 20], 4, 3, 0.25));
  put(T.blue_roof, bricks([40, 62, 140], [22, 34, 80], 4, 3, 0.25));
  put(T.leaves, (x, y, r) => (r() < 0.12 ? [0, 0, 0, 0] : shade([58, 120, 44], 0.7 + r() * 0.5)));
  put(T.log_side, (x, y, r) => shade([96, 70, 44], (x % 4 === 0 ? 0.7 : 0.9) + r() * 0.2));
  put(T.log_top, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    return shade(d > 6.5 ? [96, 70, 44] : [170, 136, 90], (Math.floor(d) % 2 ? 0.85 : 1) + r() * 0.1);
  });
  put(T.water, (x, y, r) => { const c = shade([40, 90, 150], 0.85 + r() * 0.3); return [c[0], c[1], c[2], 190]; });
  put(T.sand, noisy([214, 200, 150], 0.2));
  put(T.gold, (x, y, r) => shade([235, 190, 60], (x + y) % 6 === 0 ? 1.2 : 0.85 + r() * 0.2));
  put(T.red, noisy([150, 26, 30], 0.2));
  put(T.yellow, noisy([220, 180, 40], 0.2));
  put(T.green, noisy([30, 100, 50], 0.2));
  put(T.blue, noisy([36, 60, 140], 0.2));
  put(T.candle, (x, y, r) => (y < 6 ? shade([255, 220, 120], 0.9 + r() * 0.2) : shade([250, 240, 215], 0.9 + r() * 0.1)));
  put(T.night_sky, (x, y, r) => (r() < 0.035 ? [255, 255, 230] : shade([18, 24, 62], 0.8 + r() * 0.4)));
  put(T.pumpkin_side, (x, y, r) => shade([224, 120, 30], (x % 5 === 0 ? 0.75 : 1) * (0.9 + r() * 0.15)));
  put(T.pumpkin_top, (x, y, r) => (Math.abs(x - 7.5) < 2 && Math.abs(y - 7.5) < 2 ? [70, 110, 40] : shade([224, 120, 30], 0.85 + r() * 0.15)));
  put(T.cauldron, noisy([38, 38, 42], 0.3));
  put(T.potion, (x, y, r) => shade([80, 220, 90], 0.75 + r() * 0.4));
  put(T.bedrock, noisy([40, 40, 44], 0.6));
  put(T.marble, (x, y, r) => shade([228, 226, 220], ((x * 3 + y * 5) % 11 === 0 ? 0.85 : 1) * (0.95 + r() * 0.08)));
  put(T.thatch, (x, y, r) => shade([190, 160, 90], (x % 3 === 0 ? 0.8 : 1) * (0.85 + r() * 0.25)));
  put(T.dark_leaves, (x, y, r) => (r() < 0.1 ? [0, 0, 0, 0] : shade([28, 66, 34], 0.7 + r() * 0.5)));
  put(T.torch, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    return d < 5 ? shade([255, 200, 90], 1.05 - d * 0.05 + r() * 0.1) : shade([220, 120, 40], 0.8 + r() * 0.3);
  });
  put(T.stained, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15 || x === 8 || y === 8) return [40, 36, 30];
    const q = (x < 8 ? 0 : 1) + (y < 8 ? 0 : 2);
    return shade([[200, 50, 50], [60, 90, 200], [230, 190, 60], [60, 160, 80]][q], 0.8 + r() * 0.3);
  });
  put(T.path, noisy([150, 138, 112], 0.35));
  put(T.carpet, (x, y, r) => (x < 2 || x > 13 ? shade([220, 180, 60], 0.9 + r() * 0.1) : shade([130, 20, 28], 0.9 + r() * 0.15)));

  for (const key of Object.keys(painters)) {
    const tile = +key;
    const { fn, seed } = painters[tile];
    const r = rng(seed * 9973);
    const tx = (tile % ATLAS_TILES) * TILE;
    const ty = Math.floor(tile / ATLAS_TILES) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const c = fn(x, y, r);
        const i = ((ty + y) * size + tx + x) * 4;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2];
        img.data[i + 3] = c.length > 3 ? c[3] : 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // cor média de cada tile (para partículas de fragmentos)
  for (const key of Object.keys(painters)) {
    const tile = +key;
    const tx = (tile % ATLAS_TILES) * TILE, ty = Math.floor(tile / ATLAS_TILES) * TILE;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const i = ((ty + y) * size + tx + x) * 4;
      if (img.data[i + 3] < 50) continue;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
    tileAvg[tile] = n ? ((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n)) : 0xffffff;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Coordenadas UV de um tile (com pequena margem para evitar bleeding)
export function tileUV(tile) {
  const eps = 0.02 / ATLAS_TILES;
  const u0 = (tile % ATLAS_TILES) / ATLAS_TILES + eps;
  const v1 = 1 - Math.floor(tile / ATLAS_TILES) / ATLAS_TILES - eps;
  const u1 = u0 + 1 / ATLAS_TILES - 2 * eps;
  const v0 = v1 - 1 / ATLAS_TILES + 2 * eps;
  return [u0, v0, u1, v1];
}
