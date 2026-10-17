import { generatePuzzle, difficultyScore } from '../src/core/generator.js';
import { buildCtx, countSolutions, grade } from '../src/core/solver.js';

const n = Number(process.argv[2] || 15);
const diffs = ['facil', 'media', 'dificil', 'experto'];
for (const d of diffs) {
  const rows = [];
  const t0 = performance.now();
  let fallbacks = 0, nonUnique = 0;
  for (let i = 0; i < n; i++) {
    const p = generatePuzzle({ seed: `bench-${i}`, difficulty: d });
    if (!p) { console.log(d, i, 'SIN PUZLE'); continue; }
    const ctx = buildCtx(p);
    const c = countSolutions(ctx, p.clues, 2).count;
    if (c !== 1) nonUnique++;
    if (p.meta.fallback) fallbacks++;
    rows.push({ N: p.N, clues: p.clues.length, rounds: p.grade.rounds, depth: p.grade.guessDepth, score: +p.grade.score.toFixed(1), band: p.grade.band, att: p.meta.attempt });
  }
  const ms = ((performance.now() - t0) / n).toFixed(0);
  const avg = (k) => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(1);
  console.log(`\n== ${d} == n=${rows.length} ms/puzle=${ms} fallbacks=${fallbacks} noUnicos=${nonUnique}`);
  console.log(`  avg N=${avg('N')} pistas=${avg('clues')} rondas=${avg('rounds')} prof=${avg('depth')} score=${avg('score')} intentos=${avg('att')}`);
  const bands = {};
  rows.forEach((r) => (bands[r.band] = (bands[r.band] || 0) + 1));
  console.log('  bandas:', bands);
  if (process.argv.includes('-v')) console.table(rows);
}
