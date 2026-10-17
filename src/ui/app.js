import { generatePuzzle, dailySeed } from '../core/generator.js';
import { buildCtx, countSolutions, hintDomains } from '../core/solver.js';
import { clueHolds, clueObject } from '../core/clues.js';
import { ROOM_COLORS, ROOM_COLORS_DARK, VICTIM_EMOJI, DIFFICULTIES } from '../core/data.js';

const $ = (s) => document.querySelector(s);
const els = {
  board: $('#board'), palette: $('#palette'), clues: $('#clues'), legend: $('#legend'),
  status: $('#status'), title: $('#caseTitle'), meta: $('#caseMeta'), timer: $('#timer'),
  difficulty: $('#difficulty'), size: $('#size'), seed: $('#seed'), controls: $('#controls'),
  tools: $('#tools'), undo: $('#undo'), redo: $('#redo'),
};
const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const row = (c, N) => Math.floor(c / N), col = (c, N) => c % N;
const colLetter = (k) => String.fromCharCode(65 + k);
const LONG_PRESS_MS = 420, DOUBLE_TAP_MS = 320;

let puzzle, ctx, caseKey;
let st;                 // estado del tablero: { placed: {id: cell}, notes: {cell: [ids]}, xs: [cells] }
let undoStack = [], redoStack = [];
let selected = null, tool = 'auto';
let timerId, startedAt, elapsedBefore = 0, finished = false;
let hint = null;        // { id, cells } cuando la pista está en su primer paso

// ---------- estado en la URL ----------
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

// ---------- persistencia por caso (solo en este navegador) ----------
function saveProgress() {
  try {
    localStorage.setItem(caseKey, JSON.stringify({ st, elapsed: elapsedNow(), finished, v: 1 }));
  } catch { /* almacenamiento no disponible */ }
}
function loadProgress() {
  try {
    const raw = localStorage.getItem(caseKey);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.st && d.st.placed ? d : null;
  } catch { return null; }
}

// ---------- carga de un caso ----------
function emptyState() { return { placed: {}, notes: {}, xs: [] }; }
function load({ d, n, s }) {
  s = cleanSeed(s) || randomSeed();
  els.difficulty.value = DIFFICULTIES[d] ? d : 'media';
  els.size.value = n;
  els.seed.value = s;
  writeHash(els.difficulty.value, n, s);
  puzzle = generatePuzzle({ seed: s, difficulty: els.difficulty.value, size: n });
  ctx = buildCtx(puzzle);
  caseKey = `coartada:v1:${els.difficulty.value}-${n}-${s}`;
  const saved = loadProgress();
  st = saved ? saved.st : emptyState();
  elapsedBefore = saved ? saved.elapsed : 0;
  finished = saved ? !!saved.finished : false;
  undoStack = []; redoStack = []; selected = null; hint = null;
  startedAt = Date.now();
  clearInterval(timerId);
  if (!finished) timerId = setInterval(tick, 1000);
  tick();
  const dLabel = DIFFICULTIES[puzzle.grade.band]?.label || puzzle.grade.band;
  els.title.textContent = `${puzzle.theme.title} · caso ${s}`;
  els.meta.textContent = `${puzzle.N}×${puzzle.N} · ${dLabel}${puzzle.meta.fallback ? ' (aprox.)' : ''} · ${puzzle.clues.length} declaraciones`;
  setStatus(saved ? (finished ? 'Caso ya resuelto. Puedes repasarlo o empezar otro.' : 'Progreso recuperado.') : '', saved ? 'ok' : '');
  renderBoard(); renderPalette(); renderClues(); renderLegend(); updateUndoButtons();
}
const elapsedNow = () => elapsedBefore + (finished ? 0 : Math.floor((Date.now() - startedAt) / 1000));
function tick() {
  const sec = elapsedNow();
  els.timer.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function setStatus(msg, kind = '') { els.status.textContent = msg; els.status.className = `status ${kind}`; }

// ---------- derivados del estado ----------
// Casillas excluidas automáticamente: filas y columnas de todo el que ya está colocado (víctima incluida).
function autoExcluded() {
  const { N } = puzzle;
  const out = new Set();
  const cells = [puzzle.victimCell, ...Object.values(st.placed)];
  for (const c of cells) for (let i = 0; i < N; i++) { out.add(row(c, N) * N + i); out.add(i * N + col(c, N)); }
  for (const c of cells) out.delete(c);
  return out;
}
const whoAt = (c) => Object.keys(st.placed).find((id) => st.placed[id] === c);

// ---------- render ----------
function roomColor(r) { return (isDark() ? ROOM_COLORS_DARK : ROOM_COLORS)[r % ROOM_COLORS.length]; }
function el(tag, cls, text) { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; }

function renderBoard() {
  const { N, roomOf, itemAt } = puzzle;
  const b = els.board;
  b.innerHTML = '';
  b.style.gridTemplateColumns = `22px repeat(${N}, var(--cell))`;
  b.appendChild(el('div', 'corner'));
  for (let k = 0; k < N; k++) b.appendChild(el('div', 'coord', colLetter(k)));
  const firstOfRoom = {};
  roomOf.forEach((r, c) => { if (!(r in firstOfRoom)) firstOfRoom[r] = c; });
  const wallsByCell = {};
  for (const w of puzzle.walls || []) {
    (wallsByCell[w.cell] = wallsByCell[w.cell] || []).push({ id: w.id, side: w.side });
    if (w.other !== undefined) (wallsByCell[w.other] = wallsByCell[w.other] || []).push({ id: w.id, side: (w.side + 2) % 4 });
  }
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
      for (const w of wallsByCell[c] || []) { const s = el('span', `wall ${w.id} s${w.side}`); s.title = ctx.wallsById[w.id].name; d.appendChild(s); }
      const item = itemAt[c] ? ctx.itemsById[itemAt[c]] : null;
      if (item && item.blocks) {
        d.classList.add('item');
        d.appendChild(el('span', 'who', item.emoji));
        d.title = item.name;
      } else if (c === puzzle.victimCell) {
        d.classList.add('victim');
        if (item) d.appendChild(el('span', 'seat-e', item.emoji)), d.classList.add('seat', 'occupied');
        d.appendChild(el('span', 'who', VICTIM_EMOJI));
        d.appendChild(el('span', 'nm', ctx.charById[puzzle.victimId].name));
        d.title = `Víctima: ${ctx.charById[puzzle.victimId].name}`;
      } else {
        if (item) { d.classList.add('seat'); d.appendChild(el('span', 'seat-e', item.emoji)); d.title = `${item.name} (se puede estar encima)`; }
        attachGestures(d, c);
      }
      b.appendChild(d);
    }
  }
  paintState();
}

// Pinta colocaciones, notas, X y exclusiones sin reconstruir la cuadrícula.
function paintState() {
  const excluded = autoExcluded();
  for (const d of els.board.querySelectorAll('.cell:not(.item):not(.victim)')) {
    const c = Number(d.dataset.cell);
    d.classList.remove('conflict', 'good', 'xmark', 'autox', 'ring', 'has-sel-note', 'occupied');
    d.querySelectorAll('.who, .nm, .notes').forEach((x) => x.remove());
    const who = whoAt(c);
    if (who) {
      d.classList.add('occupied');
      d.appendChild(el('span', 'who', ctx.charById[who].emoji));
      d.appendChild(el('span', 'nm', ctx.charById[who].name));
      continue;
    }
    if (st.xs.includes(c)) d.classList.add('xmark');
    else if (excluded.has(c)) d.classList.add('autox');
    const ids = st.notes[c] || [];
    if (ids.length) {
      const box = el('span', 'notes');
      for (const id of ids) {
        const n = el('span', 'n', ctx.charById[id].emoji);
        if (id === selected) { n.classList.add('sel'); d.classList.add('has-sel-note'); }
        box.appendChild(n);
      }
      d.appendChild(box);
    }
    if (hint && hint.cells.includes(c)) d.classList.add('ring');
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
      if (st.placed[ch.id] !== undefined) chip.classList.add('placed');
      if (selected === ch.id) chip.classList.add('sel');
      chip.addEventListener('click', () => { selected = selected === ch.id ? null : ch.id; paintState(); });
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
    puzzle.clues.filter((c) => c.subject === ch.id).forEach((c) => {
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

// ---------- acciones sobre el estado (todas pasan por commit para deshacer) ----------
function snapshot() { return JSON.stringify(st); }
function commit(mutate) {
  if (finished) return;
  const before = snapshot();
  mutate();
  const after = snapshot();
  if (after === before) return;
  undoStack.push(before); if (undoStack.length > 300) undoStack.shift();
  redoStack = [];
  hint = null;
  afterChange();
}
function afterChange() {
  paintState(); updateUndoButtons(); saveProgress();
  clearMarks();
  if (ctx.suspects.every((s) => st.placed[s] !== undefined)) check(true);
}
function undo() { if (!undoStack.length || finished) return; redoStack.push(snapshot()); st = JSON.parse(undoStack.pop()); hint = null; afterChange(); }
function redo() { if (!redoStack.length || finished) return; undoStack.push(snapshot()); st = JSON.parse(redoStack.pop()); hint = null; afterChange(); }
function updateUndoButtons() { els.undo.disabled = !undoStack.length; els.redo.disabled = !redoStack.length; }

function toggleNote(c, id) {
  commit(() => {
    if (whoAt(c)) return;
    const ids = st.notes[c] || [];
    st.notes[c] = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    if (!st.notes[c].length) delete st.notes[c];
  });
}
function placeAt(c, id) {
  commit(() => {
    if (st.placed[id] === c) { delete st.placed[id]; return; }  // volver a tocar: quitar
    const other = whoAt(c);
    if (other) delete st.placed[other];
    st.placed[id] = c;
    delete st.notes[c];
    st.xs = st.xs.filter((x) => x !== c);
    // las notas de este sospechoso en otras casillas quedan obsoletas
    for (const k of Object.keys(st.notes)) {
      st.notes[k] = st.notes[k].filter((x) => x !== id);
      if (!st.notes[k].length) delete st.notes[k];
    }
  });
  try { navigator.vibrate?.(12); } catch { /* sin vibración */ }
}
function toggleX(c) {
  commit(() => {
    if (whoAt(c)) return;
    st.xs = st.xs.includes(c) ? st.xs.filter((x) => x !== c) : [...st.xs, c];
  });
}
function eraseCell(c) {
  commit(() => {
    const who = whoAt(c); if (who) delete st.placed[who];
    delete st.notes[c];
    st.xs = st.xs.filter((x) => x !== c);
  });
}
function clearBoard() { commit(() => { st = emptyState(); }); setStatus('Tablero vacío. Puedes deshacer si te has arrepentido.', 'warn'); }

// ---------- gestos ----------
// Auto: toque = nota del sospechoso elegido · pulsación larga o doble toque = colocar ·
//       sin sospechoso elegido, toque = X · clic derecho = X.
function attachGestures(d, c) {
  let pressTimer = null, longFired = false, startX = 0, startY = 0, lastTap = 0;
  const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
  d.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    longFired = false; startX = e.clientX; startY = e.clientY;
    if (tool === 'auto' && selected) {
      pressTimer = setTimeout(() => { longFired = true; pressTimer = null; placeAt(c, selected); }, LONG_PRESS_MS);
    }
  });
  d.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancelPress(); });
  d.addEventListener('pointercancel', cancelPress);
  d.addEventListener('pointerleave', cancelPress);
  d.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    const hadTimer = !!pressTimer; cancelPress();
    if (longFired || (!hadTimer && tool === 'auto' && selected)) return; // la pulsación larga ya actuó
    const now = Date.now();
    const isDouble = now - lastTap < DOUBLE_TAP_MS; lastTap = now;
    onTap(c, isDouble);
  });
  d.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!finished) toggleX(c); });
  d.setAttribute('tabindex', '0');
  d.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selected) placeAt(c, selected); else toggleX(c); }
    if (e.key.toLowerCase() === 'x') toggleX(c);
    if (e.key === 'Backspace' || e.key === 'Delete') eraseCell(c);
  });
}
function onTap(c, isDouble) {
  if (finished) return;
  switch (tool) {
    case 'note': if (selected) toggleNote(c, selected); else setStatus('Elige un sospechoso para anotar.', 'warn'); return;
    case 'place': if (selected) placeAt(c, selected); else setStatus('Elige un sospechoso para colocar.', 'warn'); return;
    case 'x': toggleX(c); return;
    case 'erase': eraseCell(c); return;
    default: {
      if (!selected) { toggleX(c); return; }
      if (isDouble && lastNoteTap && lastNoteTap.cell === c && lastNoteTap.committed) {
        undo(); redoStack = []; lastNoteTap = null;   // deshace la nota del primer toque y coloca
        placeAt(c, selected); return;
      }
      if (isDouble) { placeAt(c, selected); lastNoteTap = null; return; }
      const before = undoStack.length;
      toggleNote(c, selected);
      lastNoteTap = { cell: c, committed: undoStack.length > before };
    }
  }
}
let lastNoteTap = null;
function setTool(t) {
  tool = t;
  els.tools.querySelectorAll('.tool').forEach((b) => b.classList.toggle('sel', b.dataset.tool === t));
}

// ---------- comprobación, pista, acusación ----------
function clearMarks() {
  els.board.querySelectorAll('.cell').forEach((d) => d.classList.remove('conflict', 'good'));
  els.clues.querySelectorAll('.stmt').forEach((s) => s.classList.remove('viol'));
}
function evaluate() {
  const { N } = puzzle;
  const conflicts = new Set(), viol = new Set();
  const pos = { ...st.placed, [puzzle.victimId]: puzzle.victimCell };
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
  const inV = ctx.suspects.filter((s) => st.placed[s] !== undefined && puzzle.roomOf[st.placed[s]] === ctx.victimRoom);
  return { conflicts, viol, inV, complete: ctx.suspects.every((s) => st.placed[s] !== undefined) };
}
function check(auto = false) {
  const { conflicts, viol, inV, complete } = evaluate();
  clearMarks();
  els.clues.querySelectorAll('.stmt').forEach((s) => s.classList.toggle('viol', viol.has(Number(s.dataset.idx))));
  for (const c of conflicts) els.board.querySelector(`[data-cell="${c}"]`)?.classList.add('conflict');
  if (conflicts.size) { setStatus(`Hay ${conflicts.size} casilla(s) en conflicto con las reglas o las declaraciones.`, 'bad'); return false; }
  if (!complete) { if (!auto) setStatus('De momento todo encaja. Sigue colocando sospechosos.', 'ok'); return false; }
  if (inV.length !== 1) { setStatus(`Todo encaja salvo la regla del asesino: debe haber exactamente un sospechoso con la víctima (hay ${inV.length}).`, 'bad'); return false; }
  const correct = ctx.suspects.every((s) => st.placed[s] === puzzle.solution[s]);
  if (correct) { setStatus('Colocación completa y coherente. ¡Acusa al asesino!', 'ok'); return true; }
  setStatus('Cumple todas las declaraciones… pero no es la colocación única. Revisa.', 'warn');
  return false;
}
// Pista en dos pasos: primero rodea dónde puede estar un sospechoso; el segundo toque lo coloca.
function doHint() {
  if (finished) return;
  if (hint) {
    const id = hint.id, cell = puzzle.solution[id];
    hint = null;
    commit(() => { const other = whoAt(cell); if (other) delete st.placed[other]; st.placed[id] = cell; delete st.notes[cell]; st.xs = st.xs.filter((x) => x !== cell); });
    const d = els.board.querySelector(`[data-cell="${cell}"]`);
    d.classList.add('good', 'hinted');
    setStatus(`${ctx.charById[id].name} está en la fila ${row(cell, puzzle.N) + 1}, columna ${colLetter(col(cell, puzzle.N))}.`, 'warn');
    return;
  }
  const wrong = ctx.suspects.filter((s) => st.placed[s] !== undefined && st.placed[s] !== puzzle.solution[s]);
  const missing = ctx.suspects.filter((s) => st.placed[s] === undefined);
  if (!wrong.length && !missing.length) { setStatus('Ya está todo colocado. Pulsa «Acusar».', 'ok'); return; }
  const dom = hintDomains(ctx, puzzle.clues, 2);
  const id = wrong[0] || missing.sort((a, b) => dom[a].size - dom[b].size)[0];
  const excluded = autoExcluded();
  const cells = [...dom[id]].filter((c) => !excluded.has(c) || c === puzzle.solution[id]);
  hint = { id, cells };
  selected = id;
  paintState();
  setStatus(`${wrong[0] ? `${ctx.charById[id].name} no está bien colocado. ` : ''}Rodeado: dónde puede estar ${ctx.charById[id].name} según sus declaraciones. Pulsa «Pista» otra vez para colocarlo.`, 'warn');
}
function solve() {
  commit(() => { st.placed = { ...puzzle.solution }; delete st.placed[puzzle.victimId]; st.notes = {}; st.xs = []; });
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
        const allRight = ctx.suspects.every((x) => st.placed[x] === puzzle.solution[x]);
        if (!allRight) { st.placed = { ...puzzle.solution }; delete st.placed[puzzle.victimId]; }
        elapsedBefore = elapsedNow(); finished = true; clearInterval(timerId); tick();
        paintState(); saveProgress();
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
$('#hint').addEventListener('click', doHint);
$('#solve').addEventListener('click', solve);
$('#accuse').addEventListener('click', accuse);
$('#share').addEventListener('click', share);
$('#clear').addEventListener('click', clearBoard);
els.undo.addEventListener('click', undo);
els.redo.addEventListener('click', redo);
els.tools.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
window.addEventListener('hashchange', () => { const h = readHash(); if (h.s && (h.s !== els.seed.value || h.d !== els.difficulty.value || h.n !== els.size.value)) load(h); });
window.addEventListener('pagehide', saveProgress);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderBoard(); renderLegend(); });
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  const k = Number(e.key);
  if (k >= 1 && k <= ctx.suspects.length) { selected = ctx.suspects[k - 1]; paintState(); return; }
  const map = { a: 'auto', n: 'note', c: 'place', x: 'x', g: 'erase' };
  if (map[e.key.toLowerCase()] && e.target.classList?.contains('cell') === false) setTool(map[e.key.toLowerCase()]);
  if (e.key === 'Escape') { selected = null; hint = null; paintState(); }
});

load(readHash());
// Exponer para depuración/consola
window.__caso = () => ({ puzzle, ctx, st, unique: countSolutions(ctx, puzzle.clues, 2).count === 1 });
