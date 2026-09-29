// Ponto de entrada: cena, loop principal, estado do jogo e ligação entre sistemas.
import * as THREE from 'three';
import { buildAtlas } from './blocks.js';
import { World } from './world.js';
import { generateHogwarts, SX, SY, SZ } from './hogwarts.js';
import { Player } from './player.js';
import { Particles } from './particles.js';
import { NPC } from './npc.js';
import { Entities } from './entities.js';
import { Spells, SPELLS } from './spells.js';
import { buildWand, buildHand, buildBroom } from './models.js';
import { UI, HOUSES } from './ui.js';
import { DIALOGUES, QUESTS, QUEST_ORDER } from './dialogues.js';
import { audio } from './audio.js';
import { BLOCKS, B } from './blocks.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ---------- renderizador e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('test') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
scene.add(camera);
scene.fog = new THREE.Fog(0x9cc4e8, 60, 190);

const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x4a4030, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd, 1.6);
scene.add(sun, sun.target);
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);

// céu: sol, lua e estrelas
const skyGroup = new THREE.Group();
scene.add(skyGroup);
const sunMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 1), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
const moonMesh = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 1), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false }));
skyGroup.add(sunMesh, moonMesh);
const starGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(300);
    pts.push(v.x, v.y, v.z);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, fog: false }));
skyGroup.add(stars);

// nuvens voxel
const clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), 60);
{
  const m = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    m.compose(new THREE.Vector3(Math.random() * 400 - 110, 58 + Math.random() * 6, Math.random() * 400 - 110), new THREE.Quaternion(), new THREE.Vector3(8 + Math.random() * 18, 2 + Math.random() * 1.5, 6 + Math.random() * 12));
    clouds.setMatrixAt(i, m);
  }
}
scene.add(clouds);

// ---------- mundo ----------
const atlas = buildAtlas();
const world = new World(SX, SY, SZ);
world.initMaterials(atlas);
scene.add(world.group);

const ui = new UI();
const particles = new Particles(scene);
const player = new Player(world, camera);

// varinha e mão em primeira pessoa
const handRig = new THREE.Group();
const wand = buildWand();
handRig.add(wand);
// vassoura (visível sob o jogador quando está voando)
const broom = buildBroom();
broom.visible = false;
scene.add(broom);

const hand = buildHand(0x1b1b22);
hand.position.set(0, -0.02, 0.04);
handRig.add(hand);
handRig.scale.setScalar(0.8);
camera.add(handRig);

// ---------- estado do jogo ----------
const game = {
  name: 'Aluno',
  house: 'grifinoria',
  points: { grifinoria: 0, sonserina: 0, corvinal: 0, lufalufa: 0 },
  quests: {},
  flags: { braziersLit: 0, pixiesStunned: 0, featherLifted: false, cards: 0 },
  inv: new Set(),
  cardsTotal: 0,
  ui,
  sfx: audio,
  shakeT: 0,
  dialog: null,
  time: 0.32, // hora do dia (0..1)
  questState(id) { return this.quests[id] || 'none'; },
  doneCount() { return QUEST_ORDER.filter((q) => this.quests[q] === 'done').length; },
  startQuest(id, silent) {
    if (this.quests[id]) return;
    this.quests[id] = 'active';
    if (!silent) { ui.toast(`Nova missão: ${QUESTS[id].title}`); audio.play('questStart'); }
    this.trackQuest = id;
  },
  completeQuest(id, pts) {
    this.quests[id] = 'done';
    if (pts) this.addPoints(pts, QUESTS[id].title);
    if (id !== 'intro' && id !== 'cup') { ui.toast(`Missão concluída: ${QUESTS[id].title}`); audio.play('questDone'); }
    if (this.trackQuest === id) this.trackQuest = null;
  },
  addPoints(n, reason) {
    this.points[this.house] += n;
    const h = HOUSES[this.house].name;
    ui.toast(n >= 0 ? `+${n} pontos para a ${h}! (${reason})` : `${n} pontos para a ${h}. (${reason})`);
    ui.renderPoints(this.points, this.house);
    audio.play(n >= 0 ? 'pointsUp' : 'pointsDown');
  },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  toast(t) { ui.toast(t); },
  shake(s) { this.shakeT = Math.max(this.shakeT, s); },
  collect(e) {
    audio.play(e.type === 'card' ? 'card' : 'collect');
    if (e.type === 'trevor') audio.play('croak', { vol: 0.8 });
    if (e.type === 'book') { this.inv.add('book'); ui.toast('Você pegou o livro da Hermione!'); if (!this.quests.book) this.startQuest('book'); }
    if (e.type === 'trevor') { this.inv.add('trevor'); ui.toast('Você pegou o Trevo! Croac.'); if (!this.quests.trevor) this.startQuest('trevor'); }
    if (e.type === 'card') {
      this.flags.cards++;
      const names = ['Alvo Dumbledore', 'Merlin', 'Circe', 'Morgana', 'Newt Scamander', 'Godrico Gryffindor'];
      ui.toast(`Figurinha de Sapo de Chocolate: ${names[(this.flags.cards - 1) % names.length]}! (${this.flags.cards}/${this.cardsTotal})`);
      this.addPoints(10, 'Figurinha encontrada');
    }
  },
  onFeatherLifted() {
    this.flags.featherLifted = true;
    ui.toast(this.quests.feather === 'active' ? 'A pena está voando! Conte ao Rony.' : 'Wingardium Leviosa! A pena flutua.');
  },
  onBrazierLit() {
    this.flags.braziersLit++;
    audio.play('questStart', { vol: 0.5 });
    ui.toast(`Braseiro aceso! (${this.flags.braziersLit}/3)`);
  },
  onSnitch() {
    this.flags.snitches = (this.flags.snitches || 0) + 1;
    audio.play('card');
    audio.play('questDone');
    ui.toast(this.flags.snitches === 1 ? 'Você pegou o Pomo de Ouro! Digno de um apanhador!' : 'Pomo de Ouro capturado de novo!');
    this.addPoints(this.flags.snitches === 1 ? 150 : 20, 'Pomo de Ouro');
  },
  onPixieStunned() {
    this.flags.pixiesStunned++;
    if (this.quests.pixies === 'active') ui.toast(`Diabrete atordoado! (${Math.min(5, this.flags.pixiesStunned)}/5)`);
  },
  onNpcHit(npc, spell) {
    const now = performance.now();
    if (npc.lastHit && now - npc.lastHit < 1500) return;
    npc.lastHit = now;
    const lines = {
      snape: 'DETENÇÃO! E dez pontos a menos!',
      mcgonagall: 'Francamente! Dez pontos a menos!',
      dumbledore: 'Ah... um pouco de entusiasmo demais, talvez? Dez pontos a menos.',
      hagrid: 'Ei! Isso faz cócegas! Mas não faz de novo, tá?',
      hermione: 'Ai! Isso é totalmente contra as regras!',
      ron: 'Ô! Tá maluco?!',
      neville: 'Aaai! Por que sempre eu?',
      nick: 'Atravessou direto, meu caro. Vantagens de ser fantasma.',
    };
    ui.toast(`${npc.name}: "${lines[npc.id]}"`);
    audio.play('ouch', { pos: npc.pos, pitch: npc.def.voice?.pitch });
    if (['snape', 'mcgonagall', 'dumbledore'].includes(npc.id)) {
      this.points[this.house] -= 10;
      ui.renderPoints(this.points, this.house);
      audio.play('pointsDown');
    }
    if (npc.id === 'nick' || npc.id === 'hagrid') npc.stun = 0;
  },
  showCup() {
    const pts = Object.entries(this.points).sort((a, b) => b[1] - a[1]);
    const winner = pts[0][0];
    const h = HOUSES[winner];
    $('cup-title').textContent = winner === this.house ? `A ${h.name} vence a Taça das Casas!` : `A ${h.name} vence a Taça... por pouco!`;
    $('cup-list').innerHTML = pts.map(([k, p]) => `<li style="border-color:${HOUSES[k].color}">${HOUSES[k].crest} ${HOUSES[k].name}: <b>${p}</b></li>`).join('');
    $('cup').style.display = 'flex';
    audio.play('cup');
    document.exitPointerLock();
    this.cupOpen = true;
  },
};
window.game = game;

// ---------- NPCs e entidades ----------
let npcs = [];
let entities, spells, spots;

function buildWorld() {
  spots = generateHogwarts(world);
  world.buildAll();
  npcs = Object.entries(spots.npcs).map(([id, p]) => {
    const n = new NPC(id, p, world);
    scene.add(n.group);
    return n;
  });
  buildProps(spots.props);
  entities = new Entities(scene, world, particles, world.materials.solid);
  entities.spawnAll(spots.entities);
  game.cardsTotal = spots.entities.cards.length;
  spells = new Spells({ scene, world, player, particles, entities, npcs, game, wand, camera });
  player.pos.set(spots.spawn.x, spots.spawn.y, spots.spawn.z);
  player.yaw = spots.spawn.yaw;
  player.update(0);
}

// Objetos decorativos instanciados (velas flutuantes, cálices, pratos)
const floating = [];
let candleMesh, flameMesh;
function buildProps(props) {
  const kinds = {
    candle: { geo: [0.12, 0.42, 0.12], mat: new THREE.MeshLambertMaterial({ color: 0xf4ecd8, emissive: 0x3a3020 }), dy: 0.21 },
    goblet: { geo: [0.14, 0.22, 0.14], mat: new THREE.MeshLambertMaterial({ color: 0xd8a830, emissive: 0x201400 }), dy: 0.11 },
    juice: { geo: [0.16, 0.26, 0.16], mat: new THREE.MeshLambertMaterial({ color: 0xe07a20 }), dy: 0.13 },
    plate: { geo: [0.34, 0.03, 0.34], mat: new THREE.MeshLambertMaterial({ color: 0xe6e6ea }), dy: 0.015 },
  };
  const m = new THREE.Matrix4();
  for (const [type, k] of Object.entries(kinds)) {
    const list = props.filter((p) => p.type === type);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(...k.geo), k.mat, list.length);
    list.forEach((p, i) => { m.makeTranslation(p.x, p.y + k.dy, p.z); mesh.setMatrixAt(i, m); });
    scene.add(mesh);
    if (type === 'candle') {
      candleMesh = mesh;
      flameMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.13, 0.07), new THREE.MeshBasicMaterial({ color: 0xffd060 }), list.length);
      list.forEach((p, i) => { m.makeTranslation(p.x, p.y + 0.5, p.z); flameMesh.setMatrixAt(i, m); floating.push({ ...p, i, ph: Math.random() * 6 }); });
      scene.add(flameMesh);
    }
  }
}
function updateProps(t) {
  if (!candleMesh) return;
  const m = new THREE.Matrix4();
  for (const c of floating) {
    const y = c.y + (c.float ? Math.sin(t * 0.8 + c.ph) * 0.12 : 0);
    m.makeTranslation(c.x, y + 0.21, c.z); candleMesh.setMatrixAt(c.i, m);
    const fl = 1 + Math.sin(t * 12 + c.ph * 3) * 0.2;
    m.makeScale(1, fl, 1).setPosition(c.x, y + 0.5, c.z); flameMesh.setMatrixAt(c.i, m);
  }
  candleMesh.instanceMatrix.needsUpdate = true;
  flameMesh.instanceMatrix.needsUpdate = true;
}

// ---------- entrada ----------
const canvas = renderer.domElement;
let mouseDown = false;

function inDialog() { return !!game.dialog; }

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  player.enabled = locked;
  if (!locked) {
    player.keys = {};
    if (spells) spells.castUp();
    mouseDown = false;
    if (!inDialog() && !game.cupOpen && game.started) $('pause').style.display = 'flex';
  } else {
    $('pause').style.display = 'none';
  }
});

// Modo de reserva: quando a página não pode travar o mouse (ex.: dentro de um iframe
// sem permissão), olha-se arrastando o mouse com o botão direito pressionado.
let dragLook = false;
const embedded = window.self !== window.top;
function enableDragLook() {
  if (dragLook || !embedded) return;
  dragLook = true;
  ui.toast('Segure o botão direito do mouse e arraste para olhar ao redor. Fale com E.', 6000);
  lock();
}
document.addEventListener('pointerlockerror', enableDragLook);

function lock() {
  if (dragLook) {
    if (!inDialog() && !game.cupOpen) { player.enabled = true; $('pause').style.display = 'none'; }
    return;
  }
  if (!canvas.requestPointerLock) { enableDragLook(); return; }
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(enableDragLook);
  } catch (e) { enableDragLook(); }
}

canvas.addEventListener('mousedown', (e) => {
  if (!game.started || inDialog()) return;
  if (document.pointerLockElement !== canvas && !dragLook) { audio.init(); lock(); return; }
  if (dragLook && !player.enabled) { audio.init(); lock(); return; }
  if (e.button === 0) { mouseDown = true; spells.castDown(); }
  if (e.button === 2 && !dragLook) tryInteract();
});
window.addEventListener('mouseup', (e) => { if (e.button === 0 && mouseDown) { mouseDown = false; spells.castUp(); } });
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas || (dragLook && (e.buttons & 2))) player.onMouseMove(e);
});
window.addEventListener('wheel', (e) => {
  if (!player.enabled) return;
  if (spells.held) spells.adjustHold(-Math.sign(e.deltaY) * 0.6);
  else spells.select(spells.current + Math.sign(e.deltaY));
});

window.addEventListener('keydown', (e) => {
  if (!game.started) return;
  if (inDialog()) {
    const n = parseInt(e.key, 10);
    if (!ui.dialogReady && (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter')) { ui.finishTyping(); return; }
    if (ui.dialogReady && n >= 1 && n <= 9) chooseOption(n - 1);
    if (e.code === 'Escape') endDialog();
    return;
  }
  player.keys[e.code] = true;
  if (!player.enabled) return;
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= SPELLS.length) spells.select(n - 1);
  }
  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'KeyQ') cycleQuest();
  if (e.code === 'KeyF') toggleBroom();
  if (e.code === 'KeyM') ui.toast(audio.toggleMute() ? 'Som desligado (M)' : 'Som ligado (M)');
  if (e.code === 'KeyN') ui.toast(audio.toggleMusic() ? 'Música ligada (N)' : 'Música desligada (N)');
});
window.addEventListener('keyup', (e) => { player.keys[e.code] = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- diálogos ----------
function nearestNpc() {
  let best = null, bestD = 3.6;
  const fwd = player.forward().setY(0).normalize();
  for (const n of npcs) {
    const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
    if (d > bestD || Math.abs(n.pos.y - player.pos.y) > 3) continue;
    const to = new THREE.Vector3(n.pos.x - player.pos.x, 0, n.pos.z - player.pos.z).normalize();
    if (to.dot(fwd) < 0.3 && d > 1.5) continue;
    best = n; bestD = d;
  }
  return best;
}

function tryInteract() {
  const n = nearestNpc();
  if (n && n.stun <= 0) startDialog(n);
}

function fmt(text) {
  const t = typeof text === 'function' ? text(game) : text;
  return t.replaceAll('{name}', game.name).replaceAll('{house}', HOUSES[game.house].name);
}

function startDialog(npc) {
  const tree = DIALOGUES[npc.id];
  game.dialog = { npc, tree, node: tree.start(game) };
  npc.state = 'talk';
  player.keys = {};
  spells.castUp();
  if (dragLook) player.enabled = false;
  document.exitPointerLock();
  audio.play('dialogOpen');
  showNode();
}

function showNode() {
  const d = game.dialog;
  const node = d.tree.nodes[d.node];
  d.options = node.options;
  const voice = d.npc.def.voice || {};
  ui.openDialog(d.npc.name, fmt(node.text), node.options.map((o) => ({ text: fmt(o.text) })), chooseOption,
    () => audio.play('blip', voice));
}

function chooseOption(i) {
  const d = game.dialog;
  if (!d || !d.options[i]) return;
  const o = d.options[i];
  audio.play('choose');
  if (o.do) o.do(game);
  if (o.end || !o.next) endDialog(true);
  else { d.node = o.next; showNode(); }
}

function endDialog(relock) {
  const d = game.dialog;
  if (d) d.npc.state = 'idle';
  game.dialog = null;
  ui.closeDialog();
  if (relock && !game.cupOpen) lock();
  else if (!game.cupOpen) $('pause').style.display = 'flex';
}

$('cup-close').onclick = () => { $('cup').style.display = 'none'; game.cupOpen = false; lock(); };

// ---------- missões ----------
function cycleQuest() {
  const active = Object.keys(game.quests).filter((q) => game.quests[q] === 'active');
  if (!active.length) return;
  const i = active.indexOf(game.trackQuest);
  game.trackQuest = active[(i + 1) % active.length];
}

function questTarget(obj) {
  if (obj.npc) {
    const n = npcs.find((x) => x.id === obj.npc);
    return n ? { pos: n.pos, label: n.def.short } : null;
  }
  if (obj.entity) {
    const list = entities.byType(obj.entity).filter((e) => !(obj.entity === 'brazier' && e.lit) && !(e.stunned > 0));
    let best = null, bd = Infinity;
    for (const e of list) { const d = e.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = e; } }
    const labels = { book: 'Livro', trevor: 'Trevo', feather: 'Pena', brazier: 'Braseiro', pixie: 'Diabretes' };
    return best ? { pos: best.pos, label: labels[obj.entity] } : null;
  }
  return null;
}

function updateQuestHud() {
  const active = Object.keys(game.quests).filter((q) => game.quests[q] === 'active' && (q !== 'cup' || game.doneCount() >= QUEST_ORDER.length));
  let id = game.trackQuest;
  if (!id || game.quests[id] !== 'active' || !active.includes(id)) id = game.trackQuest = active.find((q) => q !== 'cup') || active[0] || null;
  if (!id) {
    if (game.quests.intro !== 'done') {
      game.quests.intro = 'active';
      id = 'intro';
    } else {
      const freeText = game.quests.cup === 'done'
        ? 'Explore Hogwarts à vontade!'
        : 'Converse com os moradores do castelo para encontrar novas missões.';
      ui.renderQuest('Hogwarts', freeText, `Missões: ${game.doneCount()}/${QUEST_ORDER.length} · Figurinhas: ${game.flags.cards}/${game.cardsTotal}`);
      ui.renderCompass(null);
      return;
    }
  }
  const q = QUESTS[id];
  const obj = q.objective(game);
  const others = active.length > 1 ? ` · Q: trocar missão (${active.length})` : '';
  ui.renderQuest(q.title, obj.text, `Missões: ${game.doneCount()}/${QUEST_ORDER.length} · Figurinhas: ${game.flags.cards}/${game.cardsTotal}${others}`);
  const t = questTarget(obj);
  if (!t) { ui.renderCompass(null); return; }
  const dx = t.pos.x - player.pos.x, dz = t.pos.z - player.pos.z;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const rel = Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy); // 0 = em frente, + = à direita
  ui.renderCompass(rel - Math.PI / 2, Math.hypot(dx, dz), t.label);
}

// ---------- ciclo dia/noite ----------
const DAY_LEN = 600; // segundos por dia
const skyDay = new THREE.Color(0x9cc4e8), skyDusk = new THREE.Color(0xe89a6a), skyNight = new THREE.Color(0x0b1026);
const tmpC = new THREE.Color();
function updateSky(dt) {
  game.time = (game.time + dt / DAY_LEN * (player.keys.KeyT ? 40 : 1)) % 1;
  const a = game.time * Math.PI * 2 - Math.PI / 2;
  const sunDir = new THREE.Vector3(Math.cos(a) * 0.8, Math.sin(a), 0.35).normalize();
  const dayAmt = THREE.MathUtils.smoothstep(sunDir.y, -0.15, 0.25);
  const dusk = Math.max(0, 1 - Math.abs(sunDir.y) * 4) * 0.8;
  tmpC.copy(skyNight).lerp(skyDay, dayAmt).lerp(skyDusk, dusk * dayAmt * 0.8 + dusk * 0.2);
  scene.background = tmpC.clone();
  scene.fog.color.copy(tmpC);
  sun.intensity = 1.7 * dayAmt;
  sun.position.copy(player.pos).addScaledVector(sunDir, 100);
  sun.target.position.copy(player.pos);
  hemi.intensity = 0.25 + 0.75 * dayAmt;
  ambient.intensity = 0.12 + 0.18 * dayAmt;
  skyGroup.position.copy(camera.position);
  sunMesh.position.copy(sunDir).multiplyScalar(280); sunMesh.lookAt(camera.position);
  moonMesh.position.copy(sunDir).multiplyScalar(-280); moonMesh.lookAt(camera.position);
  game.dayAmt = dayAmt;
  stars.material.opacity = 1 - dayAmt;
  stars.visible = dayAmt < 0.95;
  clouds.material.color.setScalar(0.35 + 0.65 * dayAmt);
  clouds.position.x = (clouds.position.x + dt * 0.8) % 200;
  const hours = Math.floor(game.time * 24), mins = Math.floor((game.time * 24 * 60) % 60);
  $('clock').textContent = `${dayAmt > 0.5 ? '☀' : '☾'} ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// ---------- vassoura ----------
let broomHintShown = false;
function toggleBroom() {
  player.setFlying(!player.flying);
  audio.play(player.flying ? 'broomUp' : 'broomDown');
  if (player.flying && !broomHintShown) {
    broomHintShown = true;
    ui.toast('Nimbus 2000! W voa para onde você olha · Espaço sobe · C desce · Shift turbo · F desmonta', 7000);
    ui.toast('Dizem que o Pomo de Ouro está solto no campo de Quadribol...', 7000);
  }
}

const broomTmp = new THREE.Vector3();
function updateBroom(dt) {
  broom.visible = player.flying;
  if (!player.flying) return;
  broom.position.set(player.pos.x, player.pos.y + 0.72 + Math.sin(player.bob * 2.2) * 0.08, player.pos.z);
  broom.rotation.set(player.pitch * 0.35, player.yaw, player.roll * 0.8, 'YXZ');
  // rastro de faíscas no turbo
  if (player.boosting) {
    broomTmp.set(0, 0, 1.4).applyEuler(broom.rotation).add(broom.position);
    particles.emit(broomTmp, { color: 0xffe9a0, count: 2, speed: 1, life: 0.5, size: 0.08 });
  }
  const alt = Math.round(player.pos.y - world.surfaceY(player.pos.x, player.pos.z, player.pos.y));
  $('flight').textContent = `🧹 ${Math.round(player.speed)} m/s · altura ${Math.max(0, alt)} m${player.boosting ? ' · TURBO' : ''}`;
}

// ---------- áudio ----------
const SURFACE = {
  [B.GRASS]: 'grass', [B.DIRT]: 'grass', [B.LEAVES]: 'grass', [B.DARK_LEAVES]: 'grass', [B.THATCH]: 'grass',
  [B.RED]: 'grass', [B.GREEN]: 'grass', [B.BLUE]: 'grass', [B.YELLOW]: 'grass', [B.CARPET]: 'grass',
  [B.SAND]: 'sand', [B.PATH]: 'sand',
  [B.PLANK]: 'wood', [B.DARK_WOOD]: 'wood', [B.BOOKSHELF]: 'wood', [B.LOG]: 'wood', [B.PUMPKIN]: 'wood',
};
player.onEvent = (name, data) => {
  if (name === 'step') {
    const id = world.get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z));
    audio.play('step', { surface: player.inWater ? 'water' : SURFACE[id] || 'stone', vol: data?.sprint ? 1 : 0.75 });
  } else if (name === 'land') audio.play('land', { vol: Math.min(1, data.speed / 18) });
  else audio.play(name);
};

let audioCheckT = 0, outdoors = true;
function updateAudio(dt) {
  audio.setListener(camera.position, player.yaw);
  audioCheckT -= dt;
  if (audioCheckT <= 0) {
    audioCheckT = 0.5;
    // ao ar livre = nada sólido acima da cabeça
    outdoors = true;
    const x = Math.floor(player.pos.x), z = Math.floor(player.pos.z);
    for (let y = Math.floor(player.pos.y + 2); y < world.sy; y++) if (BLOCKS[world.get(x, y, z)].solid) { outdoors = false; break; }
  }
  const underwater = world.isWater(camera.position.x, camera.position.y, camera.position.z);
  audio.updateAmbience(dt, { outdoors, night: (game.dayAmt ?? 1) < 0.3, underwater });
}

// ---------- loop ----------
const clock = new THREE.Clock();
let elapsed = 0, hudT = 0;
function frame() {
  tick(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function tick(dt) {
  elapsed += dt;
  if (game.started) {
    player.update(dt, npcs.filter((n) => !n.def.float).map((n) => ({ x: n.pos.x, z: n.pos.z, y: n.pos.y, r: n.radius })));
    for (const n of npcs) n.update(dt, player, elapsed);
    entities.update(dt, { game, player, time: elapsed });
    spells.update(dt, elapsed);
    world.update(4);
    updateSky(dt);
    updateAudio(dt);
    updateBroom(dt);
    audio.updateFlight(player.flying ? player.speed : 0);
    $('flight').hidden = !player.flying;
    updateProps(elapsed);
    if (game.shakeT > 0) {
      game.shakeT -= dt;
      camera.position.x += (Math.random() - 0.5) * game.shakeT * 0.4;
      camera.position.y += (Math.random() - 0.5) * game.shakeT * 0.4;
    }
    hudT -= dt;
    if (hudT <= 0) {
      hudT = 0.1;
      ui.updateCooldowns(spells.cooldowns);
      updateQuestHud();
      const n = !inDialog() && player.enabled ? nearestNpc() : null;
      ui.showPrompt(n ? `<b>E</b> ou <b>botão direito</b>: falar com ${n.name}` : '');
    }
    $('underwater').style.opacity = world.isWater(camera.position.x, camera.position.y, camera.position.z) ? 1 : 0;
  }
  particles.update(dt);
}

// ---------- tela inicial ----------
let chosenHouse = null;
document.querySelectorAll('.house-btn').forEach((b) => {
  b.onclick = () => {
    chosenHouse = b.dataset.house;
    document.querySelectorAll('.house-btn').forEach((x) => x.classList.toggle('chosen', x === b));
    $('hat-line').textContent = pickHatLine(chosenHouse);
    $('start-btn').disabled = false;
  };
});
function pickHatLine(h) {
  return {
    grifinoria: '"Hmm... coragem de sobra. Melhor que seja... GRIFINÓRIA!"',
    sonserina: '"Ambição, astúcia... Você poderia ser grande, sabe? SONSERINA!"',
    corvinal: '"Uma mente afiada, sede de saber... CORVINAL!"',
    lufalufa: '"Leal, justo e trabalhador... LUFA-LUFA!"',
  }[h];
}

function startGame() {
  game.name = ($('name-input').value || '').trim() || 'Aluno';
  game.house = chosenHouse || 'grifinoria';
  const others = { grifinoria: 0, sonserina: 0, corvinal: 0, lufalufa: 0 };
  // as outras casas começam na frente — é preciso se esforçar!
  const base = [240, 215, 190];
  Object.keys(others).filter((k) => k !== game.house).forEach((k, i) => { others[k] = base[i]; });
  game.points = others;
  document.documentElement.style.setProperty('--house', HOUSES[game.house].color);
  document.documentElement.style.setProperty('--house-accent', HOUSES[game.house].accent);
  $('start').style.display = 'none';
  $('hud').style.display = 'block';
  ui.renderPoints(game.points, game.house);
  ui.setSpell(0);
  game.started = true;
  audio.init();
  ui.toast(`Bem-vindo(a), ${game.name}! Vá ao Salão Principal falar com Dumbledore.`, 6000);
  lock();
}
$('start-btn').onclick = startGame;
$('pause').onclick = () => { audio.init(); lock(); };

// Carrega o mundo depois do primeiro paint da tela de carregamento
requestAnimationFrame(() => setTimeout(() => {
  const t0 = performance.now();
  buildWorld();
  console.log(`Mundo gerado em ${Math.round(performance.now() - t0)} ms`);
  $('loading').style.display = 'none';
  $('start-panel').style.display = 'block';
  if (params.has('test')) {
    // modo de teste automatizado: pula a tela inicial
    chosenHouse = params.get('house') || 'grifinoria';
    startGame();
    player.enabled = true;
  }
  frame();
}, 30));

window.__debug = { step: (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); }, player, world, npcs: () => npcs, entities: () => entities, spells: () => spells, game, camera, THREE, startDialog, chooseOption, spots: () => spots };
