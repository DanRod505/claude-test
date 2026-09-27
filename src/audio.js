// Áudio procedural (Web Audio API): efeitos sonoros, ambiente e música — sem arquivos externos.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // número MIDI -> Hz
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.last = {}; // limite de repetição por som
    this.loops = {};
  }

  // Precisa ser chamado a partir de um gesto do usuário (clique/tecla)
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = this.bus(0.9);
    this.amb = this.bus(0.5);
    this.music = this.bus(this.musicOn ? 0.22 : 0);
    // reverb curto (convolução com ruído decrescente) para dar ar de castelo
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.25;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.sfx.connect(this.reverbSend);
    this.music.connect(this.reverbSend);
    // ruído branco reutilizável
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.startAmbience();
    this.startMusic();
  }

  bus(vol) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    g.connect(this.master);
    return g;
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.music) this.music.gain.setTargetAtTime(this.musicOn ? 0.22 : 0, this.ctx.currentTime, 0.3);
    return this.musicOn;
  }

  setListener(pos, yaw) {
    this.listener.x = pos.x; this.listener.y = pos.y; this.listener.z = pos.z; this.listener.yaw = yaw;
  }

  // Volume e pan estéreo a partir da posição no mundo
  spatial(pos, maxDist = 40) {
    if (!pos) return { vol: 1, pan: 0 };
    const L = this.listener;
    const dx = pos.x - L.x, dy = pos.y - L.y, dz = pos.z - L.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxDist) return null;
    const vol = Math.pow(1 - d / maxDist, 2);
    const right = dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw);
    const pan = d > 0.5 ? clamp(right / d, -1, 1) * 0.8 : 0;
    return { vol, pan };
  }

  // ---------- primitivas ----------
  out(pan, dest) {
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan || 0;
    p.connect(dest || this.sfx);
    return p;
  }

  tone({ type = 'sine', f = 440, f2 = null, dur = 0.2, vol = 0.3, attack = 0.005, delay = 0, pan = 0, dest = null, lp = null, vib = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    if (vib) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 6; lg.gain.value = vib;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; node = node.connect(fl); }
    node.connect(this.out(pan, dest));
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.3, vol = 0.3, type = 'bandpass', f = 1000, f2 = null, q = 1, attack = 0.005, delay = 0, pan = 0, dest = null }) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter();
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.out(pan, dest));
    s.start(t, Math.random() * Math.max(0, 1.9 - dur)); s.stop(t + dur + 0.05);
  }

  bell(f, { vol = 0.2, dur = 1.2, delay = 0, pan = 0, dest = null } = {}) {
    this.tone({ f, dur, vol, delay, pan, dest });
    this.tone({ f: f * 2.01, dur: dur * 0.6, vol: vol * 0.35, delay, pan, dest });
    this.tone({ f: f * 3.99, dur: dur * 0.3, vol: vol * 0.15, delay, pan, dest });
  }

  // ---------- catálogo de efeitos ----------
  // opts: { pos, vol, surface, pitch, ... }
  play(name, opts = {}) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const minGap = { step: 0.05, crackle: 0.07, tick: 0.02, blip: 0.045, giggle: 0.8, croak: 1.5, place: 0.05 }[name] ?? 0.02;
    if (this.last[name] && now - this.last[name] < minGap) return;
    this.last[name] = now;
    const sp = this.spatial(opts.pos, opts.range ?? 45);
    if (!sp) return;
    const v = sp.vol * (opts.vol ?? 1), pan = sp.pan;
    const fn = SOUNDS[name];
    if (fn) fn(this, v, pan, opts);
  }

  // Sons contínuos (ex.: Wingardium Leviosa enquanto segura)
  startLoop(name) {
    if (!this.ready || this.loops[name]) return;
    const c = this.ctx, t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.3);
    g.connect(this.sfx);
    const oscs = [];
    for (const [f, type] of [[NOTE(84), 'sine'], [NOTE(91), 'sine'], [NOTE(96), 'triangle']]) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = f;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 4 + Math.random() * 3; lg.gain.value = f * 0.012;
      lfo.connect(lg).connect(o.frequency);
      o.connect(g); o.start(); lfo.start();
      oscs.push(o, lfo);
    }
    this.loops[name] = { g, oscs };
  }

  stopLoop(name) {
    const l = this.loops[name];
    if (!l) return;
    delete this.loops[name];
    const t = this.ctx.currentTime;
    l.g.gain.cancelScheduledValues(t);
    l.g.gain.setTargetAtTime(0.0001, t, 0.08);
    l.oscs.forEach((o) => o.stop(t + 0.5));
  }

  // ---------- ambiente ----------
  startAmbience() {
    const c = this.ctx;
    // vento: ruído filtrado com volume ondulante
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = 380; fl.Q.value = 0.7;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 0.09; lg.gain.value = 160;
    lfo.connect(lg).connect(fl.frequency);
    s.connect(fl).connect(this.windGain).connect(this.amb);
    s.start(); lfo.start();
    this.cricketT = 0;
  }

  // Chamado a cada quadro: ajusta vento (ao ar livre) e grilos (à noite)
  updateAmbience(dt, { outdoors, night, underwater }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const wind = underwater ? 0 : outdoors ? 0.55 : 0.08;
    this.windGain.gain.setTargetAtTime(wind, t, 0.8);
    if (outdoors && night && !underwater) {
      this.cricketT -= dt;
      if (this.cricketT <= 0) {
        this.cricketT = 0.4 + Math.random() * 1.6;
        const f = 3800 + Math.random() * 900, pan = Math.random() * 1.6 - 0.8;
        const n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.tone({ f, dur: 0.035, vol: 0.025, delay: i * 0.06, pan, dest: this.amb });
      }
    }
    // abafa tudo debaixo d'água
    this.sfx.gain.setTargetAtTime(underwater ? 0.35 : 0.9, t, 0.1);
  }

  // ---------- música (tema original, estilo caixinha de música) ----------
  startMusic() {
    // lá menor, 3/4: acordes Am – F – C – E, arpejos de celesta com melodia simples
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 56, 59], [57, 60, 64], [50, 53, 57], [52, 56, 59], [52, 56, 59]];
    const melody = [76, null, 72, 74, null, 72, 71, null, 67, 68, null, 71, 76, null, 79, 77, null, 74, 76, null, 72, 71, null, null];
    this.beat = 0;
    const spb = 0.42; // segundos por colcheia
    let next = this.ctx.currentTime + 0.5;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 1.2) {
        const bar = Math.floor(this.beat / 6) % chords.length;
        const step = this.beat % 6;
        const ch = chords[bar];
        const delay = next - this.ctx.currentTime;
        // arpejo
        const arp = [0, 1, 2, 1, 2, 1][step];
        this.bell(NOTE(ch[arp] + 12), { vol: 0.08, dur: 1.4, delay, pan: (arp - 1) * 0.3, dest: this.music });
        if (step === 0) this.tone({ f: NOTE(ch[0] - 12), dur: 2.4, vol: 0.07, delay, dest: this.music, attack: 0.05 });
        // melodia a cada duas voltas
        const round = Math.floor(this.beat / (6 * chords.length)) % 2;
        if (round === 1 && step % 2 === 0) {
          const m = melody[(Math.floor((this.beat % (6 * chords.length)) / 2)) % melody.length];
          if (m) this.bell(NOTE(m), { vol: 0.1, dur: 1.8, delay, dest: this.music });
        }
        this.beat++;
        next += spb;
      }
      this.musicTimer = setTimeout(schedule, 300);
    };
    schedule();
  }
}

// Cada som recebe (audio, volume, pan, opts)
const SOUNDS = {
  // --- feitiços ---
  lumos: (a, v, pan) => {
    a.bell(NOTE(88), { vol: 0.18 * v, dur: 1.0, pan });
    a.bell(NOTE(95), { vol: 0.12 * v, dur: 1.2, delay: 0.07, pan });
    a.noise({ dur: 0.4, vol: 0.05 * v, type: 'highpass', f: 6000, pan });
  },
  nox: (a, v, pan) => {
    a.tone({ f: NOTE(83), f2: NOTE(71), dur: 0.35, vol: 0.12 * v, pan });
    a.noise({ dur: 0.2, vol: 0.05 * v, type: 'lowpass', f: 2000, f2: 300, pan });
  },
  stupefy: (a, v, pan) => {
    a.tone({ type: 'sawtooth', f: 1500, f2: 180, dur: 0.22, vol: 0.12 * v, pan, lp: 3500 });
    a.tone({ type: 'square', f: 900, f2: 300, dur: 0.12, vol: 0.05 * v, pan });
    a.noise({ dur: 0.12, vol: 0.15 * v, type: 'highpass', f: 3000, pan });
  },
  incendio: (a, v, pan) => {
    a.noise({ dur: 0.55, vol: 0.35 * v, type: 'bandpass', f: 300, f2: 2500, q: 0.8, attack: 0.05, pan });
    a.noise({ dur: 0.6, vol: 0.2 * v, type: 'lowpass', f: 400, f2: 120, pan });
  },
  leviosa: (a, v, pan) => {
    [72, 76, 79, 84, 88].forEach((n, i) => a.bell(NOTE(n), { vol: 0.08 * v, dur: 0.6, delay: i * 0.05, pan }));
  },
  accio: (a, v, pan) => {
    a.noise({ dur: 0.4, vol: 0.25 * v, type: 'bandpass', f: 2500, f2: 300, q: 2, pan });
    a.tone({ f: 900, f2: 400, dur: 0.35, vol: 0.08 * v, pan });
  },
  bombarda: (a, v, pan) => {
    a.tone({ type: 'triangle', f: 1400, f2: 500, dur: 0.3, vol: 0.12 * v, pan });
    a.noise({ dur: 0.25, vol: 0.12 * v, type: 'bandpass', f: 1500, f2: 600, pan });
  },
  reparo: (a, v, pan) => {
    [72, 76, 79, 84].forEach((n, i) => a.bell(NOTE(n), { vol: 0.13 * v, dur: 0.9, delay: i * 0.09, pan }));
  },
  patronum: (a, v, pan) => {
    for (const [n, d] of [[69, 0], [73, 0.05], [76, 0.1], [81, 0.15], [85, 0.2]]) {
      a.tone({ f: NOTE(n), dur: 3, vol: 0.07 * v, attack: 0.4, delay: d, pan, vib: 3 });
      a.tone({ f: NOTE(n) * 1.004, dur: 3, vol: 0.05 * v, attack: 0.5, delay: d, pan: -pan });
    }
    a.noise({ dur: 2, vol: 0.06 * v, type: 'highpass', f: 5000, attack: 0.3, pan });
  },
  fizzle: (a, v, pan) => {
    a.tone({ type: 'square', f: 300, f2: 120, dur: 0.15, vol: 0.05 * v, pan, lp: 1200 });
  },
  // --- impactos ---
  zap: (a, v, pan) => {
    a.noise({ dur: 0.18, vol: 0.3 * v, type: 'highpass', f: 2000, pan });
    a.tone({ type: 'square', f: 600, f2: 100, dur: 0.15, vol: 0.06 * v, pan, lp: 2000 });
  },
  ignite: (a, v, pan) => {
    a.noise({ dur: 0.9, vol: 0.4 * v, type: 'lowpass', f: 3000, f2: 200, attack: 0.02, pan });
    a.tone({ f: 90, f2: 50, dur: 0.5, vol: 0.2 * v, pan });
  },
  crackle: (a, v, pan) => {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) a.noise({ dur: 0.03, vol: (0.1 + Math.random() * 0.15) * v, type: 'highpass', f: 1500 + Math.random() * 3000, delay: Math.random() * 0.08, pan });
  },
  explosion: (a, v, pan) => {
    a.noise({ dur: 1.6, vol: 0.9 * v, type: 'lowpass', f: 2500, f2: 60, attack: 0.005, pan });
    a.tone({ f: 70, f2: 28, dur: 1.2, vol: 0.6 * v, pan });
    a.tone({ type: 'triangle', f: 140, f2: 40, dur: 0.5, vol: 0.3 * v, pan });
    for (let i = 0; i < 8; i++) a.noise({ dur: 0.05, vol: 0.12 * v, type: 'bandpass', f: 800 + Math.random() * 2000, q: 3, delay: 0.25 + Math.random() * 0.8, pan: pan + (Math.random() - 0.5) * 0.6 });
  },
  tick: (a, v, pan) => {
    a.bell(NOTE(84 + Math.floor(Math.random() * 12)), { vol: 0.05 * v, dur: 0.25, pan });
  },
  place: (a, v, pan) => {
    a.tone({ f: 180, f2: 70, dur: 0.14, vol: 0.3 * v, pan });
    a.noise({ dur: 0.1, vol: 0.2 * v, type: 'lowpass', f: 1200, pan });
  },
  // --- jogador ---
  step: (a, v, pan, o) => {
    const s = o.surface || 'stone';
    const p = 0.85 + Math.random() * 0.3;
    if (s === 'grass') a.noise({ dur: 0.09, vol: 0.13 * v, type: 'lowpass', f: 900 * p, q: 0.5, pan });
    else if (s === 'sand') a.noise({ dur: 0.12, vol: 0.12 * v, type: 'bandpass', f: 1600 * p, q: 0.6, pan });
    else if (s === 'wood') { a.noise({ dur: 0.06, vol: 0.15 * v, type: 'bandpass', f: 700 * p, q: 2, pan }); a.tone({ f: 140 * p, dur: 0.08, vol: 0.08 * v, pan }); }
    else if (s === 'water') a.noise({ dur: 0.25, vol: 0.12 * v, type: 'bandpass', f: 1100 * p, f2: 500, q: 1, pan });
    else a.noise({ dur: 0.05, vol: 0.16 * v, type: 'bandpass', f: 2200 * p, q: 1.5, pan });
  },
  jump: (a, v, pan) => a.noise({ dur: 0.15, vol: 0.06 * v, type: 'bandpass', f: 600, f2: 1400, pan }),
  land: (a, v, pan) => {
    a.noise({ dur: 0.15, vol: 0.25 * v, type: 'lowpass', f: 700, pan });
    a.tone({ f: 110, f2: 55, dur: 0.15, vol: 0.2 * v, pan });
  },
  splash: (a, v, pan) => {
    a.noise({ dur: 0.7, vol: 0.4 * v, type: 'bandpass', f: 1800, f2: 300, q: 0.7, pan });
    for (let i = 0; i < 5; i++) a.tone({ f: 600 + Math.random() * 900, f2: 1500, dur: 0.06, vol: 0.04 * v, delay: 0.1 + Math.random() * 0.4, pan });
  },
  // --- criaturas e NPCs ---
  giggle: (a, v, pan) => {
    const base = 1700 + Math.random() * 500;
    for (let i = 0; i < 5; i++) a.tone({ type: 'triangle', f: base * (1 + (i % 2) * 0.2), f2: base * 1.3, dur: 0.07, vol: 0.06 * v, delay: i * 0.08, pan });
  },
  pixieStun: (a, v, pan) => {
    a.tone({ type: 'triangle', f: 2200, f2: 300, dur: 0.4, vol: 0.12 * v, pan });
    a.tone({ f: 330, f2: 660, dur: 0.25, vol: 0.08 * v, delay: 0.1, pan, vib: 30 });
  },
  croak: (a, v, pan) => {
    a.tone({ type: 'sawtooth', f: 120, f2: 90, dur: 0.18, vol: 0.12 * v, pan, lp: 700 });
    a.tone({ type: 'sawtooth', f: 110, f2: 80, dur: 0.2, vol: 0.12 * v, delay: 0.25, pan, lp: 700 });
  },
  ouch: (a, v, pan, o) => {
    const p = o.pitch || 200;
    a.tone({ type: 'square', f: p * 1.6, f2: p * 0.8, dur: 0.22, vol: 0.08 * v, pan, lp: 1500 });
  },
  // "fala" estilo bip — cada personagem tem seu tom
  blip: (a, v, pan, o) => {
    const p = (o.pitch || 220) * (0.9 + Math.random() * 0.25);
    a.tone({ type: o.wave || 'square', f: p, f2: p * (0.9 + Math.random() * 0.2), dur: 0.05, vol: 0.035 * v, pan, lp: 1800, vib: o.vib || 0 });
  },
  // --- interface ---
  select: (a, v, pan, o) => a.tone({ type: 'triangle', f: NOTE(72 + (o.index || 0) * 2), dur: 0.08, vol: 0.06 * v }),
  dialogOpen: (a, v) => {
    a.noise({ dur: 0.18, vol: 0.08 * v, type: 'bandpass', f: 3000, f2: 1200, q: 0.8 });
    a.bell(NOTE(79), { vol: 0.05 * v, dur: 0.4 });
  },
  choose: (a, v) => a.tone({ type: 'triangle', f: NOTE(81), f2: NOTE(86), dur: 0.1, vol: 0.07 * v }),
  questStart: (a, v) => {
    a.bell(NOTE(67), { vol: 0.14 * v, dur: 0.8 });
    a.bell(NOTE(74), { vol: 0.14 * v, dur: 1.0, delay: 0.14 });
  },
  questDone: (a, v) => {
    [60, 64, 67, 72].forEach((n, i) => {
      a.tone({ type: 'triangle', f: NOTE(n), dur: 0.5, vol: 0.12 * v, delay: i * 0.11 });
      a.bell(NOTE(n + 12), { vol: 0.06 * v, dur: 0.7, delay: i * 0.11 });
    });
    [60, 64, 67].forEach((n) => a.tone({ type: 'triangle', f: NOTE(n + 12), dur: 1.3, vol: 0.07 * v, delay: 0.5, attack: 0.02 }));
  },
  pointsUp: (a, v) => {
    a.bell(NOTE(88), { vol: 0.1 * v, dur: 0.5 });
    a.bell(NOTE(93), { vol: 0.1 * v, dur: 0.7, delay: 0.08 });
  },
  pointsDown: (a, v) => {
    a.tone({ type: 'square', f: NOTE(62), dur: 0.18, vol: 0.06 * v, lp: 1200 });
    a.tone({ type: 'square', f: NOTE(55), dur: 0.35, vol: 0.06 * v, delay: 0.18, lp: 1200 });
  },
  collect: (a, v, pan) => {
    a.tone({ f: 500, f2: 1200, dur: 0.12, vol: 0.12 * v, pan });
    a.bell(NOTE(84), { vol: 0.1 * v, dur: 0.6, delay: 0.08, pan });
  },
  card: (a, v, pan) => {
    [79, 83, 86, 91, 95, 98].forEach((n, i) => a.bell(NOTE(n), { vol: 0.07 * v, dur: 0.5, delay: i * 0.045, pan }));
  },
  cup: (a, v) => {
    const seq = [[60, 0], [64, 0.2], [67, 0.4], [72, 0.6], [67, 0.9], [72, 1.1]];
    seq.forEach(([n, d]) => {
      a.tone({ type: 'sawtooth', f: NOTE(n), dur: 0.5, vol: 0.06 * v, delay: d, lp: 1800, attack: 0.02 });
      a.tone({ type: 'triangle', f: NOTE(n + 12), dur: 0.5, vol: 0.07 * v, delay: d });
    });
    [60, 64, 67, 72, 76].forEach((n) => {
      a.tone({ type: 'sawtooth', f: NOTE(n), dur: 2.5, vol: 0.05 * v, delay: 1.4, lp: 2200, attack: 0.05, vib: 2 });
      a.bell(NOTE(n + 12), { vol: 0.06 * v, dur: 2.5, delay: 1.4 });
    });
    a.noise({ dur: 2.5, vol: 0.05 * v, type: 'highpass', f: 6000, delay: 1.4, attack: 0.2 });
  },
};

export const audio = new Audio();
