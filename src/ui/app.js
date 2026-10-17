import { generatePuzzle, dailySeed } from '../core/generator.js';
import { buildCtx, countSolutions } from '../core/solver.js';
import { clueHolds, clueObject } from '../core/clues.js';
import { ROOM_COLORS, ROOM_COLORS_DARK, VICTIM_EMOJI, DIFFICULTIES } from '../core/data.js';

const $ = (s) => document.querySelector(s);
const els = {
  board: $('#board'), palette: $('#palette'), clues: $('#clues'), legend: $('#legend'),
  status: $('#status'), title: $('#caseTitle'), meta: $('#caseMeta'), timer: $('#timer'),
  difficulty: $('#difficulty'), size: $('#size'), seed: $('#seed'), controls: $('#controls'),
};
const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const row = (c, N) => Math.floor(c / N), col = (c, N) => c % N;

let puzzle, ctx, placed, selected, timerId, startedAt, finished;

// ---------- estado en la URL ----------
// Formato de ancla simple: #c-<dificultad>-<tamaño>-<semilla> (solo letras, dígitos, . _ ~ -)
const cleanSeed = (s) => String(s).replace(/[^A-Za-z0-9._~-]/g, '').slice(0, 40);
function readHash() {
  const m = /^#?c-([a-z]+)-([a-z0-9]+)-(.*)$/.exec(location.hash);
  if (!m) return { d: 'media', n: 'auto', s: '' };
  return { d: m[1], n: m[2], s: cleanSeed(m[3]) };
}
function writeHash(d, n, s) {
  try { history.replaceState(null, '', `#c-${d}-${n}-${cleanSeed(s)}`); } catch { /* sin historial */ }
}
const randomSeed = () => Math.random().toString(36).slice(2, 8);

// ---------- carga de un caso ----------
function load({ d, n, s }) {
  s = cleanSeed(s) || randomSeed();
  els.difficulty.value = DIFFICULTIES[d] ? d : 'media';
  els.size.value = n;
  els.seed.value = s;
  writeHash(els.difficulty.value, n, s);
  puzzle = generatePuzzle({ seed: s, difficulty: els.difficulty.value, size: n });
  ctx = buildCtx(puzzle);
  placed = {}; selected = null; finished = false;
  startedAt = Date.now();
  clearInterval(timerId);
  timerId = setInterval(tick, 1000);
  tick();
  const dLabel = DIFFICULTIES[puzzle.grade.band]?.label || puzzle.grade.band;
  els.title.textContent = `${puzzle.theme.title} · caso ${s}`;
  els.meta.textContent = `${puzzle.N}×${puzzle.N} · ${dLabel}${puzzle.meta.fallback ? ' (aprox.)' : ''} · ${puzzle.clues.length} declaraciones`;
  setStatus('');
  renderBoard(); renderPalette(); renderClues(); renderLegend();
}
function tick() {
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  els.timer.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function setStatus(msg, kind = '') { els.status.textContent = msg; els.status.className = `status ${kind}`; }

// ---------- render ----------
function roomColor(r) { return (isDark() ? ROOM_COLORS_DARK : ROOM_COLORS)[r % ROOM_COLORS.length]; }

function renderBoard() {
  const { N, roomOf, itemAt } = puzzle;
  const b = els.board;
  b.innerHTML = '';
  b.style.gridTemplateColumns = `22px repeat(${N}, var(--cell))`;
  b.appendChild(el('div', 'corner'));
  for (let k = 0; k < N; k++) b.appendChild(el('div', 'coord', String.fromCharCode(65 + k)));
  const firstOfRoom = {};
  roomOf.forEach((r, c) => { if (!(r in firstOfRoom)) firstOfRoom[r] = c; });
  for (let r = 0; r < N; r++) {
    b.appendChild(el('div', 'coord r', String(r + 1)));
    for (let k = 0; k < N; k++) {
      const c = r * N + k, rm = roomOf[c];
      const d = el('div', 'cell');
      d.dataset.cell = c;
      d.style.background = roomColor(rm);
      if (r === 0 || roomOf[c - N] !== rm) d.classList.add('bt');
      if (r === N - 1 || roomOf[c + N] !== rm) d.classList.add('bb');
      if (k === 0 || roomOf[c - 1] !== rm) d.classList.add('bl');
      if (k === N - 1 || roomOf[c + 1] !== rm) d.classList.add('br');
      if (firstOfRoom[rm] === c) d.appendChild(el('span', 'room-label', puzzle.rooms[rm].name));
      if (itemAt[c]) {
        d.classList.add('item');
        d.appendChild(el('span', 'who', ctx.itemsById[itemAt[c]].emoji));
        d.title = ctx.itemsById[itemAt[c]].name;
      } else if (c === puzzle.victimCell) {
        d.classList.add('victim');
        d.appendChild(el('span', 'who', VICTIM_EMOJI));
        d.appendChild(el('span', 'nm', ctx.charById[puzzle.victimId].name));
        d.title = `Víctima: ${ctx.charById[puzzle.victimId].name}`;
      } else {
        d.addEventListener('click', () => onCell(c));
      }
      b.appendChild(d);
    }
  }
  paintPlacements();
}
function paintPlacements() {
  for (const d of els.board.querySelectorAll('.cell:not(.item):not(.victim)')) {
    const c = Number(d.dataset.cell);
    d.classList.remove('conflict', 'good');
    d.querySelectorAll('.who, .nm').forEach((x) => x.remove());
    const who = Object.keys(placed).find((id) => placed[id] === c);
    if (who) {
      d.appendChild(el('span', 'who', ctx.charById[who].emoji));
      d.appendChild(el('span', 'nm', ctx.charById[who].name));
    }
  }
  renderPalette();
}
function renderPalette() {
  els.palette.innerHTML = '';
  for (const ch of puzzle.chars) {
    const chip = el('button', 'chip');
    chip.type = 'button';
    chip.innerHTML = `<span class="e">${ch.id === puzzle.victimId ? VICTIM_EMOJI : ch.emoji}</span><span>${ch.name}</span>`;
    if (ch.id === puzzle.victimId) { chip.classList.add('victimchip'); chip.title = 'Víctima'; }
    else {
      if (placed[ch.id] !== undefined) chip.classList.add('placed');
      if (selected === ch.id) chip.classList.add('sel');
      chip.addEventListener('click', () => { selected = ch.id; renderPalette(); });
    }
    els.palette.appendChild(chip);
  }
}
function renderClues() {
  els.clues.innerHTML = '';
  for (const ch of puzzle.chars) {
    if (ch.id === puzzle.victimId) continue;
    const li = el('li');
    li.appendChild(el('span', 'e', ch.emoji));
    const box = el('div');
    box.appendChild(el('span', 'name', ch.name));
    const mine = puzzle.clues.filter((c) => c.subject === ch.id);
    mine.forEach((c) => {
      const s = el('span', 'stmt', `· ${c.text}.`);
      s.dataset.idx = puzzle.clues.indexOf(c);
      s.addEventListener('click', () => s.classList.toggle('done'));
      box.appendChild(s);
    });
    li.appendChild(box);
    els.clues.appendChild(li);
  }
}
function renderLegend() {
  els.legend.innerHTML = '';
  puzzle.rooms.forEach((r, i) => {
    const li = el('li');
    const sw = el('span', 'sw'); sw.style.background = roomColor(i);
    li.appendChild(sw); li.appendChild(document.createTextNode(r.name));
    els.legend.appendChild(li);
  });
}
function el(tag, cls, text) { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; }

// ---------- interacción ----------
function onCell(c) {
  if (finished) return;
  const here = Object.keys(placed).find((id) => placed[id] === c);
  if (here) { delete placed[here]; if (!selected) selected = here; }
  else if (selected) {
    placed[selected] = c;
    // avanzar automáticamente al siguiente sin colocar
    selected = ctx.suspects.find((s) => placed[s] === undefined) || null;
  } else { setStatus('Elige primero un sospechoso de la lista.', 'warn'); return; }
  setStatus('');
  paintPlacements();
  if (ctx.suspects.every((s) => placed[s] !== undefined)) check(true);
}

// Evalúa la colocación actual: devuelve celdas en conflicto y pistas violadas.
function evaluate() {
  const { N } = puzzle;
  const conflicts = new Set(), viol = new Set();
  const pos = { ...placed, [puzzle.victimId]: puzzle.victimCell };
  const ids = Object.keys(pos);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = pos[ids[i]], b = pos[ids[j]];
    if (row(a, N) === row(b, N) || col(a, N) === col(b, N)) { conflicts.add(a); conflicts.add(b); }
  }
  puzzle.clues.forEach((cl, idx) => {
    const o = clueObject(cl);
    if (pos[cl.subject] === undefined || (o !== null && pos[o] === undefined)) return;
    if (!clueHolds(ctx, cl, pos[cl.subject], o === null ? undefined : pos[o])) { viol.add(idx); conflicts.add(pos[cl.subject]); if (o !== null) conflicts.add(pos[o]); }
  });
  const inV = ctx.suspects.filter((s) => placed[s] !== undefined && puzzle.roomOf[placed[s]] === ctx.victimRoom);
  return { conflicts, viol, inV, complete: ctx.suspects.every((s) => placed[s] !== undefined) };
}
function check(auto = false) {
  const { conflicts, viol, inV, complete } = evaluate();
  els.board.querySelectorAll('.cell').forEach((d) => d.classList.remove('conflict', 'good'));
  els.clues.querySelectorAll('.stmt').forEach((s) => s.classList.toggle('viol', viol.has(Number(s.dataset.idx))));
  for (const c of conflicts) els.board.querySelector(`[data-cell="${c}"]`)?.classList.add('conflict');
  if (conflicts.size) { setStatus(`Hay ${conflicts.size} casilla(s) en conflicto con las reglas o las declaraciones.`, 'bad'); return false; }
  if (!complete) { if (!auto) setStatus('De momento todo encaja. Sigue colocando sospechosos.', 'ok'); return false; }
  if (inV.length !== 1) { setStatus(`Todo encaja salvo la regla del asesino: debe haber exactamente un sospechoso con la víctima (hay ${inV.length}).`, 'bad'); return false; }
  const correct = ctx.suspects.every((s) => placed[s] === puzzle.solution[s]);
  if (correct) { setStatus('Colocación completa y coherente. ¡Acusa al asesino!', 'ok'); return true; }
  setStatus('Cumple todas las declaraciones… pero no es la colocación única. Revisa.', 'warn');
  return false;
}
function hint() {
  if (finished) return;
  // primero corrige un error; si no hay, revela el sospechoso con menos candidatos
  const wrong = ctx.suspects.filter((s) => placed[s] !== undefined && placed[s] !== puzzle.solution[s]);
  const missing = ctx.suspects.filter((s) => placed[s] === undefined);
  const pick = wrong[0] || missing[0];
  if (!pick) { setStatus('Ya está todo colocado. Pulsa «Acusar».', 'ok'); return; }
  placed[pick] = puzzle.solution[pick];
  paintPlacements();
  const d = els.board.querySelector(`[data-cell="${puzzle.solution[pick]}"]`);
  d.classList.add('good', 'hinted');
  setStatus(`${wrong[0] ? 'Corregido' : 'Revelado'}: ${ctx.charById[pick].name} estaba en la fila ${row(puzzle.solution[pick], puzzle.N) + 1}, columna ${String.fromCharCode(65 + col(puzzle.solution[pick], puzzle.N))}.`, 'warn');
  if (ctx.suspects.every((s) => placed[s] !== undefined)) check(true);
}
function solve() {
  placed = { ...puzzle.solution }; delete placed[puzzle.victimId];
  paintPlacements(); check(true);
}
function accuse() {
  if (finished) return;
  const m = el('div', 'modal');
  const box = el('div', 'box');
  box.appendChild(el('h3', '', '¿Quién es el asesino?'));
  box.appendChild(el('p', '', `El asesino es el único sospechoso que estaba en la misma estancia que ${ctx.charById[puzzle.victimId].name}.`));
  const opts = el('div', 'opts');
  for (const s of ctx.suspects) {
    const b = el('button', 'chip'); b.type = 'button';
    b.innerHTML = `<span class="e">${ctx.charById[s].emoji}</span><span>${ctx.charById[s].name}</span>`;
    b.addEventListener('click', () => {
      m.remove();
      if (s === puzzle.killer) {
        finished = true; clearInterval(timerId);
        const allRight = ctx.suspects.every((x) => placed[x] === puzzle.solution[x]);
        if (!allRight) { placed = { ...puzzle.solution }; delete placed[puzzle.victimId]; paintPlacements(); }
        setStatus(`¡Caso resuelto en ${els.timer.textContent}! ${ctx.charById[s].name} estaba a solas con la víctima en ${puzzle.rooms[ctx.victimRoom].art} ${puzzle.rooms[ctx.victimRoom].name}.${allRight ? '' : ' (La colocación completa no era exacta, pero acertaste al culpable.)'}`, 'ok');
      } else {
        setStatus(`${ctx.charById[s].name} tiene coartada. Sigue investigando.`, 'bad');
      }
    });
    opts.appendChild(b);
  }
  box.appendChild(opts);
  const cancel = el('button', 'ghost', 'Cancelar'); cancel.type = 'button'; cancel.addEventListener('click', () => m.remove());
  box.appendChild(cancel);
  m.appendChild(box);
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
}
async function share() {
  const url = location.href;
  try { await navigator.clipboard.writeText(url); setStatus('Enlace copiado. Quien lo abra jugará exactamente este caso.', 'ok'); }
  catch { setStatus(url, ''); }
}

// ---------- eventos ----------
els.controls.addEventListener('submit', (e) => { e.preventDefault(); load({ d: els.difficulty.value, n: els.size.value, s: els.seed.value.trim() || randomSeed() }); });
$('#daily').addEventListener('click', () => load({ d: els.difficulty.value, n: 'auto', s: dailySeed() }));
$('#check').addEventListener('click', () => check(false));
$('#hint').addEventListener('click', hint);
$('#solve').addEventListener('click', solve);
$('#accuse').addEventListener('click', accuse);
$('#share').addEventListener('click', share);
window.addEventListener('hashchange', () => { const h = readHash(); if (h.s && (h.s !== els.seed.value || h.d !== els.difficulty.value || h.n !== els.size.value)) load(h); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderBoard(); renderLegend(); });
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = Number(e.key);
  if (k >= 1 && k <= ctx.suspects.length) { selected = ctx.suspects[k - 1]; renderPalette(); }
  if (e.key === 'Escape') { selected = null; renderPalette(); }
});

load(readHash());
// Exponer para depuración/consola
window.__caso = () => ({ puzzle, ctx, unique: countSolutions(ctx, puzzle.clues, 2).count === 1 });
