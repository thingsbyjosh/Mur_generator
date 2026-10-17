// Generador: construye escenario + solución, enumera pistas verdaderas, las reduce hasta
// un conjunto mínimo con solución única y gradúa la dificultad. Rechaza y reintenta hasta
// dar con la dificultad pedida.
import { makeRng, hashSeed } from './rng.js';
import { THEMES, PEOPLE, DIFFICULTIES } from './data.js';
import { generateRooms, generateSolution, placeItems, placeWalls } from './layout.js';
import { enumerateClues, clueText, CLUE_TYPES } from './clues.js';
import { buildCtx, countSolutions, grade } from './solver.js';

const ALL_TYPES = Object.keys(CLUE_TYPES);
const TYPES_BY_DIFF = {
  muyfacil: ALL_TYPES,
  facil: ALL_TYPES,
  media: ALL_TYPES.filter((t) => t !== 'rowIs' && t !== 'colIs'),
  dificil: ALL_TYPES.filter((t) => t !== 'rowIs' && t !== 'colIs' && t !== 'inCorner'),
  experto: ALL_TYPES.filter((t) => t !== 'rowIs' && t !== 'colIs' && t !== 'inCorner'),
};

// Puntuación de dificultad a partir del graduador. Calibrada con scripts/bench.js.
export function difficultyScore(N, g, clues) {
  const rel = clues.filter((c) => c.level >= 2).length;
  const neg = clues.filter((c) => c.level === 3).length;
  return (N - 4) * 3 + g.rounds * 1.2 + rel * 0.6 + neg * 0.8 + g.guessDepth * 9;
}
export const SCORE_BANDS = {
  muyfacil: [0, 5.5],
  facil: [5.5, 10],
  media: [10, 16],
  dificil: [16, 26],
  experto: [26, Infinity],
};
export function bandOf(score) {
  for (const [k, [lo, hi]] of Object.entries(SCORE_BANDS)) if (score >= lo && score < hi) return k;
  return 'experto';
}

function buildCandidate(rng, N, difficulty) {
  const theme = rng.pick(THEMES);
  const roomCount = Math.min(theme.rooms.length, Math.max(3, N - 1 + rng.int(2)));
  const roomOf = generateRooms(rng, N, roomCount);
  if (!roomOf) return null;
  const roomDefs = rng.shuffle(theme.rooms).slice(0, roomCount);
  const people = rng.shuffle(PEOPLE).slice(0, N);
  const chars = people.map((p, i) => ({ id: `c${i}`, name: p.name, emoji: p.emoji }));
  const victimId = rng.pick(chars).id;
  const ids = chars.map((c) => c.id);
  const sol = generateSolution(rng, N, roomOf, ids, victimId);
  if (!sol) return null;
  const itemCount = Math.max(1, N - 2 + rng.int(2));
  const sittableCount = rng.int(3); // 0-2 muebles sobre los que se puede estar
  const itemAt = placeItems(rng, N, roomOf, sol.solution, theme.items, itemCount, sittableCount);
  const walls = placeWalls(rng, N, roomOf, 1 + rng.int(Math.max(1, N - 3)), rng.int(3));
  const puzzle = {
    N, theme, rooms: roomDefs, roomOf, itemAt, walls, chars, victimId,
    victimCell: sol.solution[victimId], solution: sol.solution, killer: sol.killer,
  };
  const ctx = buildCtx(puzzle);
  const pool = enumerateClues(ctx, sol.solution, TYPES_BY_DIFF[difficulty]);
  if (pool.length === 0) return null;

  // Orden de inserción: para fácil preferimos pistas directas; para difícil, relacionales.
  const bias = difficulty === 'muyfacil' ? -1.5 : difficulty === 'facil' ? -1 : difficulty === 'media' ? 0 : 1;
  const weighted = pool.map((c) => ({ c, w: rng.next() + bias * 0.25 * (c.level - 2) }));
  weighted.sort((a, b) => a.w - b.w);
  const ordered = weighted.map((x) => x.c);

  // 1) añadir hasta unicidad, procurando que cada sospechoso tenga al menos una pista
  const chosen = [];
  const covered = new Set();
  for (const cl of ordered) {
    if (!covered.has(cl.subject)) { chosen.push(cl); covered.add(cl.subject); }
    if (covered.size === ctx.suspects.length) break;
  }
  let res = countSolutions(ctx, chosen, 2);
  if (res.count !== 1) {
    for (const cl of ordered) {
      if (chosen.includes(cl)) continue;
      chosen.push(cl);
      res = countSolutions(ctx, chosen, 2);
      if (res.count === 1) break;
    }
  }
  if (res.count !== 1) return null;

  // 2) eliminar pistas redundantes. En fácil quitamos primero las difíciles (quedan las directas);
  //    en difícil quitamos primero las directas (quedan las relacionales).
  const removal = chosen.map((c) => ({ c, w: rng.next() + bias * 0.4 * (2 - c.level) })).sort((a, b) => a.w - b.w).map((x) => x.c);
  let current = chosen.slice();
  for (const cl of removal) {
    const trial = current.filter((x) => x !== cl);
    if (countSolutions(ctx, trial, 2).count === 1) current = trial;
  }
  // 3) garantizar al menos una pista por sospechoso (sabor del juego)
  for (const s of ctx.suspects) {
    if (current.some((c) => c.subject === s)) continue;
    const extra = ordered.find((c) => c.subject === s && c.level <= 2) || ordered.find((c) => c.subject === s);
    if (extra) current.push(extra);
  }
  const g = grade(ctx, current);
  if (!g.logical) return null; // no debería pasar con solución única, pero por seguridad
  const score = difficultyScore(N, g, current);
  puzzle.clues = current.map((c) => ({ ...c, text: clueText(ctx, c) }));
  puzzle.grade = { ...g, score, band: bandOf(score) };
  return puzzle;
}

export function generatePuzzle({ seed = 'caso', difficulty = 'media', size = 'auto', maxAttempts = 60 } = {}) {
  if (!DIFFICULTIES[difficulty]) difficulty = 'media';
  const base = hashSeed(`${seed}|${difficulty}|${size}`);
  let fallback = null, fallbackDist = Infinity;
  const [lo, hi] = SCORE_BANDS[difficulty];
  const target = hi === Infinity ? lo + 6 : (lo + hi) / 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = makeRng((base + attempt * 7919) >>> 0);
    const N = size === 'auto' ? rng.pick(DIFFICULTIES[difficulty].sizes) : Number(size);
    const p = buildCandidate(rng, N, difficulty);
    if (!p) continue;
    p.meta = { seed, difficulty, size, attempt };
    if (p.grade.band === difficulty) return p;
    const dist = Math.abs(p.grade.score - target);
    if (dist < fallbackDist) { fallback = p; fallbackDist = dist; }
  }
  if (fallback) fallback.meta.fallback = true;
  return fallback;
}

export function dailySeed(date = new Date()) {
  const y = date.getUTCFullYear(), m = String(date.getUTCMonth() + 1).padStart(2, '0'), d = String(date.getUTCDate()).padStart(2, '0');
  return `dia-${y}-${m}-${d}`;
}
