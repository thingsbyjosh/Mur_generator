// Pruebas rápidas: unicidad, consistencia de pistas con la solución, regla del asesino, determinismo.
import { generatePuzzle } from '../src/core/generator.js';
import { buildCtx, countSolutions } from '../src/core/solver.js';
import { clueHolds, clueObject } from '../src/core/clues.js';

let fails = 0;
const assert = (cond, msg) => { if (!cond) { fails++; console.error('FALLO:', msg); } };

for (const difficulty of ['facil', 'media', 'dificil', 'experto']) {
  for (let i = 0; i < 12; i++) {
    const seed = `t-${difficulty}-${i}`;
    const p = generatePuzzle({ seed, difficulty });
    assert(p, `${seed}: sin puzle`);
    if (!p) continue;
    const ctx = buildCtx(p);
    assert(countSolutions(ctx, p.clues, 2).count === 1, `${seed}: solución no única`);
    for (const cl of p.clues) {
      const o = clueObject(cl);
      assert(clueHolds(ctx, cl, p.solution[cl.subject], o === null ? undefined : p.solution[o]), `${seed}: pista falsa ${cl.type}`);
    }
    const N = p.N, cells = Object.values(p.solution);
    assert(new Set(cells.map((c) => Math.floor(c / N))).size === N, `${seed}: filas repetidas`);
    assert(new Set(cells.map((c) => c % N)).size === N, `${seed}: columnas repetidas`);
    assert(cells.every((c) => !p.itemAt[c]), `${seed}: personaje sobre objeto`);
    const inV = ctx.suspects.filter((s) => p.roomOf[p.solution[s]] === ctx.victimRoom);
    assert(inV.length === 1 && inV[0] === p.killer, `${seed}: regla del asesino`);
    assert(ctx.suspects.every((s) => p.clues.some((c) => c.subject === s)), `${seed}: sospechoso sin pista`);
    const p2 = generatePuzzle({ seed, difficulty });
    assert(JSON.stringify(p2.solution) === JSON.stringify(p.solution) && p2.clues.length === p.clues.length, `${seed}: no determinista`);
  }
}
console.log(fails === 0 ? 'OK: todas las pruebas pasan' : `${fails} fallos`);
process.exit(fails ? 1 : 0);
