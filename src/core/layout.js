// Generación del escenario: estancias (regiones conexas), solución, objetos bloqueantes.
import { neighbors } from './clues.js';

export function generateRooms(rng, N, roomCount, maxTries = 50) {
  for (let t = 0; t < maxTries; t++) {
    const roomOf = new Array(N * N).fill(-1);
    const seeds = rng.shuffle([...Array(N * N).keys()]).slice(0, roomCount);
    seeds.forEach((c, i) => (roomOf[c] = i));
    let remaining = N * N - roomCount;
    let stuck = 0;
    while (remaining > 0 && stuck < 500) {
      const r = rng.int(roomCount);
      // candidatos: casillas libres adyacentes a la estancia r
      const cands = [];
      for (let c = 0; c < N * N; c++) {
        if (roomOf[c] !== r) continue;
        for (const d of neighbors(c, N)) if (roomOf[d] === -1) cands.push(d);
      }
      if (cands.length === 0) { stuck++; continue; }
      roomOf[rng.pick(cands)] = r;
      remaining--;
    }
    if (remaining > 0) continue;
    const sizes = new Array(roomCount).fill(0);
    roomOf.forEach((r) => sizes[r]++);
    if (sizes.every((s) => s >= 2)) return roomOf;
  }
  return null;
}

// Devuelve { solution: {charId: cell}, victimCell } con exactamente un sospechoso en la estancia de la víctima.
export function generateSolution(rng, N, roomOf, charIds, victimId, maxTries = 200) {
  for (let t = 0; t < maxTries; t++) {
    const perm = rng.shuffle([...Array(N).keys()]);
    const cells = perm.map((k, r) => r * N + k);
    const order = rng.shuffle(charIds);
    const solution = {};
    order.forEach((id, i) => (solution[id] = cells[i]));
    const vroom = roomOf[solution[victimId]];
    const inV = charIds.filter((id) => id !== victimId && roomOf[solution[id]] === vroom);
    if (inV.length === 1) return { solution, killer: inV[0] };
  }
  return null;
}

// Coloca objetos en casillas libres (no ocupadas por la solución), dejando al menos una casilla
// libre por estancia y sin bloquear por completo ninguna fila/columna.
export function placeItems(rng, N, roomOf, solution, items, count) {
  const occupied = new Set(Object.values(solution));
  const free = rng.shuffle([...Array(N * N).keys()].filter((c) => !occupied.has(c)));
  const itemAt = new Array(N * N).fill(null);
  const roomFree = {};
  roomOf.forEach((r, c) => { if (!occupied.has(c)) roomFree[r] = (roomFree[r] || 0) + 1; });
  let placed = 0;
  for (const c of free) {
    if (placed >= count) break;
    const r = roomOf[c];
    if ((roomFree[r] || 0) <= 1) continue;
    itemAt[c] = rng.pick(items).id;
    roomFree[r]--;
    placed++;
  }
  return itemAt;
}
