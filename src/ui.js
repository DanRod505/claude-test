// Interface: HUD, barra de feitiços, diálogos, missões, mensagens e telas.
import { SPELLS } from './spells.js';

export const HOUSES = {
  grifinoria: { name: 'Grifinória', color: '#ae0001', accent: '#d3a625', crest: '🦁' },
  sonserina: { name: 'Sonserina', color: '#1a472a', accent: '#aaaaaa', crest: '🐍' },
  corvinal: { name: 'Corvinal', color: '#222f5b', accent: '#946b2d', crest: '🦅' },
  lufalufa: { name: 'Lufa-Lufa', color: '#ecb939', accent: '#372e29', crest: '🦡' },
};

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.hotbar = $('hotbar');
    this.slots = SPELLS.map((s, i) => {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = `<span class="key">${i + 1}</span><span class="icon">${s.icon}</span><span class="cd"></span>`;
      el.title = `${s.name} — ${s.desc}`;
      el.style.setProperty('--c', '#' + s.color.toString(16).padStart(6, '0'));
      this.hotbar.appendChild(el);
      return el;
    });
    this.spellName = $('spell-name');
    this.incant = $('incantation');
    this.toastEl = $('toast');
    this.prompt = $('prompt');
    this.dialog = $('dialog');
    this.questEl = $('quest');
    this.pointsEl = $('points');
    this.compass = $('compass');
    this.incantTimer = null;
    this.toastTimer = null;
  }

  setSpell(i) {
    this.slots.forEach((el, k) => el.classList.toggle('active', k === i));
    const s = SPELLS[i];
    this.spellName.textContent = `${s.name} — ${s.desc}`;
  }

  updateCooldowns(cds) {
    cds.forEach((c, i) => {
      const max = SPELLS[i].cooldown;
      this.slots[i].querySelector('.cd').style.height = `${Math.min(1, c / max) * 100}%`;
    });
  }

  incantation(text, color) {
    const el = this.incant;
    el.textContent = text + '!';
    el.style.color = '#' + color.toString(16).padStart(6, '0');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  toast(text, ms = 3000) {
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.textContent = text;
    this.toastEl.appendChild(el);
    setTimeout(() => el.classList.add('fade'), ms);
    setTimeout(() => el.remove(), ms + 600);
    while (this.toastEl.children.length > 4) this.toastEl.firstChild.remove();
  }

  showPrompt(text) {
    if (text) { this.prompt.innerHTML = text; this.prompt.style.display = 'block'; }
    else this.prompt.style.display = 'none';
  }

  // Pontuação das casas
  renderPoints(points, house) {
    const max = Math.max(...Object.values(points), 1);
    this.pointsEl.innerHTML = Object.entries(HOUSES).map(([k, h]) => `
      <div class="house-row ${k === house ? 'mine' : ''}">
        <span class="crest">${h.crest}</span>
        <div class="bar"><div style="width:${Math.max(4, (points[k] / max) * 100)}%;background:${h.color};border-color:${h.accent}"></div></div>
        <span class="pts">${points[k]}</span>
      </div>`).join('');
  }

  renderQuest(title, text, extra) {
    this.questEl.innerHTML = `<div class="q-title">${title}</div><div class="q-text">${text}</div>${extra ? `<div class="q-extra">${extra}</div>` : ''}`;
  }

  renderCompass(angle, dist, label) {
    if (angle === null) { this.compass.style.display = 'none'; return; }
    this.compass.style.display = 'flex';
    this.compass.innerHTML = `<span class="arrow" style="transform:rotate(${angle}rad)">➤</span><span>${label} · ${Math.round(dist)} m</span>`;
  }

  // ---------- diálogo ----------
  openDialog(speaker, text, options, onPick, onType) {
    this.dialog.style.display = 'block';
    this.dialog.innerHTML = `<div class="d-speaker">${speaker}</div><div class="d-text"></div><div class="d-options"></div>`;
    const textEl = this.dialog.querySelector('.d-text');
    const optEl = this.dialog.querySelector('.d-options');
    let i = 0;
    clearInterval(this.typer);
    const finish = () => {
      clearInterval(this.typer);
      textEl.textContent = text;
      optEl.innerHTML = '';
      options.forEach((o, k) => {
        const b = document.createElement('button');
        b.innerHTML = `<span class="k">${k + 1}</span> ${o.text}`;
        b.onclick = (ev) => { ev.stopPropagation(); onPick(k); };
        optEl.appendChild(b);
      });
      this.dialogReady = true;
    };
    this.dialogReady = false;
    this.finishTyping = finish;
    this.typer = setInterval(() => {
      i += 2;
      textEl.textContent = text.slice(0, i);
      if (onType && i % 6 === 0 && /\S/.test(text[i] || '')) onType();
      if (i >= text.length) finish();
    }, 16);
  }

  closeDialog() {
    clearInterval(this.typer);
    this.dialog.style.display = 'none';
  }
}
