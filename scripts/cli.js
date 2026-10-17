// Uso: node scripts/cli.js [dificultad] [semilla] [tamaño]
import { generatePuzzle } from '../src/core/generator.js';

const [,, difficulty = 'media', seed = 'demo', size = 'auto'] = process.argv;
const p = generatePuzzle({ seed, difficulty, size });
const { N } = p;
const byId = Object.fromEntries(p.chars.map((c) => [c.id, c]));
console.log(`${p.theme.title} · ${N}x${N} · dificultad ${p.grade.band} (score ${p.grade.score.toFixed(1)}, rondas ${p.grade.rounds}, hipótesis ${p.grade.guessDepth})${p.meta.fallback ? ' [fallback]' : ''}`);
console.log('Estancias:', p.rooms.map((r, i) => `${i}=${r.name}`).join(', '));
const line = [];
for (let r = 0; r < N; r++) {
  let s = '';
  for (let c = 0; c < N; c++) {
    const i = r * N + c;
    const item = p.itemAt[i];
    const who = Object.entries(p.solution).find(([, cell]) => cell === i);
    const mark = item ? '#' : who ? (who[0] === p.victimId ? 'V' : byId[who[0]].name[0]) : '.';
    s += `${p.roomOf[i]}${mark} `;
  }
  line.push(s);
}
console.log(line.join('\n'));
console.log(`Víctima: ${byId[p.victimId].name} (fila ${Math.floor(p.victimCell / N) + 1}, col ${String.fromCharCode(65 + p.victimCell % N)})`);
console.log('Pistas:');
for (const c of p.chars) {
  if (c.id === p.victimId) continue;
  const cl = p.clues.filter((x) => x.subject === c.id).map((x) => x.text);
  console.log(`  ${c.name}: ${cl.join('; ') || '(sin pista)'}`);
}
console.log(`Asesino: ${byId[p.killer].name}`);
