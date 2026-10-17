// Solver: (1) cuenta soluciones por backtracking (unicidad); (2) resolutor lógico por
// propagación de candidatos para graduar la dificultad.
import { clueHolds, clueObject } from './clues.js';

const row = (c, N) => Math.floor(c / N);
const col = (c, N) => c % N;

import { WALL_FEATURES } from './data.js';

export function buildCtx(puzzle) {
  const { N, roomOf, itemAt, rooms, chars, victimId, victimCell, theme } = puzzle;
  const walls = puzzle.walls || [];
  const charById = {};
  chars.forEach((c) => (charById[c.id] = c));
  const itemsById = {};
  theme.items.forEach((it) => (itemsById[it.id] = it));
  const itemIds = [...new Set(itemAt.filter(Boolean))];
  const blocked = new Set();
  itemAt.forEach((it, c) => { if (it && itemsById[it].blocks) blocked.add(c); });
  const wallAt = {};
  const addWall = (c, id) => { (wallAt[c] = wallAt[c] || new Set()).add(id); };
  for (const w of walls) { addWall(w.cell, w.id); if (w.other !== undefined) addWall(w.other, w.id); }
  const wallsById = Object.fromEntries(WALL_FEATURES.map((w) => [w.id, w]));
  return {
    N, roomOf, itemAt, rooms, chars, charById, victimId, victimCell,
    victimRoom: roomOf[victimCell], itemsById, itemIds, blocked,
    hasSittable: itemIds.some((i) => !itemsById[i].blocks),
    walls, wallAt, wallsById, wallIds: [...new Set(walls.map((w) => w.id))],
    roomWord: theme.roomWord, sameRoomPhrase: theme.sameRoomPhrase,
    suspects: chars.filter((c) => c.id !== victimId).map((c) => c.id),
  };
}

function initialDomains(ctx, clues) {
  const { N, blocked, victimCell, victimId } = ctx;
  const free = [];
  for (let c = 0; c < N * N; c++) {
    if (blocked.has(c)) continue;
    if (c === victimCell) continue;
    if (row(c, N) === row(victimCell, N) || col(c, N) === col(victimCell, N)) continue;
    free.push(c);
  }
  const dom = {};
  dom[victimId] = new Set([victimCell]);
  for (const s of ctx.suspects) dom[s] = new Set(free);
  // filtrado unario inicial
  for (const cl of clues) {
    if (clueObject(cl) !== null) continue;
    for (const c of [...dom[cl.subject]]) if (!clueHolds(ctx, cl, c)) dom[cl.subject].delete(c);
  }
  return dom;
}

// ---------- (1) Conteo de soluciones ----------
export function countSolutions(ctx, clues, limit = 2) {
  const { N, roomOf, victimRoom } = ctx;
  const dom = initialDomains(ctx, clues);
  const order = ctx.suspects.slice().sort((a, b) => dom[a].size - dom[b].size);
  const pos = {};
  const assigned = {};
  pos[ctx.victimId] = ctx.victimCell;
  assigned[ctx.victimId] = true;
  const byChar = {};
  for (const s of ctx.suspects) byChar[s] = [];
  for (const cl of clues) {
    const o = clueObject(cl);
    if (o === null) continue; // unarias ya filtradas
    byChar[cl.subject].push(cl);
    if (o !== ctx.victimId) byChar[o].push(cl);
  }
  const rowUsed = new Array(N).fill(false), colUsed = new Array(N).fill(false);
  rowUsed[row(ctx.victimCell, N)] = true; colUsed[col(ctx.victimCell, N)] = true;
  let inV = 0, count = 0, nodes = 0;

  const ok = (s, c) => {
    for (const cl of byChar[s]) {
      const o = clueObject(cl);
      const other = cl.subject === s ? o : cl.subject;
      if (!assigned[other]) continue;
      const cS = cl.subject === s ? c : pos[cl.subject];
      const cO = cl.subject === s ? pos[o] : c;
      if (!clueHolds(ctx, cl, cS, cO)) return false;
    }
    return true;
  };
  const rec = (i) => {
    if (count >= limit) return;
    if (i === order.length) { if (inV === 1) count++; return; }
    const s = order[i];
    for (const c of dom[s]) {
      nodes++;
      const r = row(c, N), k = col(c, N);
      if (rowUsed[r] || colUsed[k]) continue;
      const v = roomOf[c] === victimRoom;
      if (v && inV >= 1) continue;
      if (!ok(s, c)) continue;
      rowUsed[r] = colUsed[k] = true; pos[s] = c; assigned[s] = true; if (v) inV++;
      rec(i + 1);
      rowUsed[r] = colUsed[k] = false; assigned[s] = false; if (v) inV--;
      if (count >= limit) return;
    }
  };
  rec(0);
  return { count, nodes };
}

// ---------- (2) Resolutor lógico ----------
function cloneDom(dom) {
  const out = {};
  for (const k in dom) out[k] = new Set(dom[k]);
  return out;
}

// Una pasada de propagación. Devuelve {changed, contradiction}.
function propagateOnce(ctx, clues, dom) {
  const { N, roomOf, victimRoom, suspects } = ctx;
  let changed = false;
  const shrink = (id, keep) => {
    for (const c of [...dom[id]]) if (!keep(c)) { dom[id].delete(c); changed = true; }
  };
  // a) pistas (arco-consistencia)
  for (const cl of clues) {
    const S = cl.subject, O = clueObject(cl);
    if (O === null) { shrink(S, (c) => clueHolds(ctx, cl, c)); continue; }
    const compat = (a, b) => a !== b && row(a, N) !== row(b, N) && col(a, N) !== col(b, N);
    shrink(S, (cS) => { for (const cO of dom[O]) if (compat(cS, cO) && clueHolds(ctx, cl, cS, cO)) return true; return false; });
    if (O !== ctx.victimId) shrink(O, (cO) => { for (const cS of dom[S]) if (compat(cS, cO) && clueHolds(ctx, cl, cS, cO)) return true; return false; });
  }
  // b) singletons: eliminar fila/columna/casilla en los demás
  for (const s of suspects) {
    if (dom[s].size !== 1) continue;
    const c = [...dom[s]][0];
    for (const t of suspects) if (t !== s) shrink(t, (d) => d !== c && row(d, N) !== row(c, N) && col(d, N) !== col(c, N));
  }
  // c) "pointing": si todo el dominio de s está en una fila/columna, nadie más puede estar ahí
  for (const s of suspects) {
    const rows = new Set([...dom[s]].map((c) => row(c, N)));
    const cols = new Set([...dom[s]].map((c) => col(c, N)));
    if (rows.size === 1) { const r = [...rows][0]; for (const t of suspects) if (t !== s) shrink(t, (d) => row(d, N) !== r); }
    if (cols.size === 1) { const k = [...cols][0]; for (const t of suspects) if (t !== s) shrink(t, (d) => col(d, N) !== k); }
  }
  // d) hidden singles por fila y columna
  for (let r = 0; r < N; r++) {
    if (r === row(ctx.victimCell, N)) continue;
    const who = suspects.filter((s) => [...dom[s]].some((c) => row(c, N) === r));
    if (who.length === 0) return { changed, contradiction: true };
    if (who.length === 1) shrink(who[0], (c) => row(c, N) === r);
  }
  for (let k = 0; k < N; k++) {
    if (k === col(ctx.victimCell, N)) continue;
    const who = suspects.filter((s) => [...dom[s]].some((c) => col(c, N) === k));
    if (who.length === 0) return { changed, contradiction: true };
    if (who.length === 1) shrink(who[0], (c) => col(c, N) === k);
  }
  // e) regla del asesino: exactamente un sospechoso en la estancia de la víctima
  const canV = suspects.filter((s) => [...dom[s]].some((c) => roomOf[c] === victimRoom));
  const mustV = suspects.filter((s) => dom[s].size > 0 && [...dom[s]].every((c) => roomOf[c] === victimRoom));
  if (canV.length === 0 || mustV.length > 1) return { changed, contradiction: true };
  if (canV.length === 1) shrink(canV[0], (c) => roomOf[c] === victimRoom);
  if (mustV.length === 1) for (const t of suspects) if (t !== mustV[0]) shrink(t, (c) => roomOf[c] !== victimRoom);
  for (const s of suspects) if (dom[s].size === 0) return { changed, contradiction: true };
  return { changed, contradiction: false };
}

function propagate(ctx, clues, dom) {
  let rounds = 0;
  for (;;) {
    const { changed, contradiction } = propagateOnce(ctx, clues, dom);
    if (contradiction) return { rounds, contradiction: true };
    if (!changed) return { rounds, contradiction: false };
    rounds++;
  }
}

const solved = (ctx, dom) => ctx.suspects.every((s) => dom[s].size === 1);

// Devuelve {logical: bool, rounds, guessDepth, guesses}. guessDepth = profundidad máxima de
// hipótesis necesaria (0 = se resuelve solo con propagación).
export function grade(ctx, clues, maxDepth = 3) {
  const dom = initialDomains(ctx, clues);
  let totalRounds = 0, guesses = 0;
  const solve = (d, depth) => {
    const p = propagate(ctx, clues, d);
    totalRounds += p.rounds;
    if (p.contradiction) return { ok: false, depth };
    if (solved(ctx, d)) return { ok: true, depth, dom: d };
    if (depth >= maxDepth) return { ok: false, depth, exhausted: true };
    // bifurcar sobre el sospechoso con menos candidatos
    const s = ctx.suspects.filter((x) => d[x].size > 1).sort((a, b) => d[a].size - d[b].size)[0];
    let best = null;
    for (const c of d[s]) {
      guesses++;
      const d2 = cloneDom(d);
      d2[s] = new Set([c]);
      const r = solve(d2, depth + 1);
      if (r.ok) { best = r; break; }
      if (r.exhausted) return { ok: false, depth, exhausted: true };
    }
    return best || { ok: false, depth };
  };
  const r = solve(dom, 0);
  return { logical: r.ok, rounds: totalRounds, guessDepth: r.ok ? r.depth : maxDepth + 1, guesses };
}

// Dominios tras un número limitado de rondas de propagación, para la pista en dos pasos.
export function hintDomains(ctx, clues, rounds = 1) {
  const dom = initialDomains(ctx, clues);
  for (let i = 0; i < rounds; i++) {
    const { changed, contradiction } = propagateOnce(ctx, clues, dom);
    if (!changed || contradiction) break;
  }
  return dom;
}
