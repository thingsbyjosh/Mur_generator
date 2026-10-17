// Tipos de pista. Cada tipo define:
//  - level: 1 directa, 2 relacional, 3 negativa/inferencial (para sesgar dificultad)
//  - unary: true si solo depende del sujeto; si no, depende de sujeto y objeto (otro personaje)
//  - test(ctx, params, cS, cO): ¿la pista se cumple con el sujeto en cS (y el objeto en cO)?
//  - text(ctx, params): texto en español (sin el nombre del sujeto delante)
//  - enumerate(ctx, S, solution): genera todas las pistas verdaderas de este tipo para S

const row = (c, N) => Math.floor(c / N);
const col = (c, N) => c % N;
// Contiguo en horizontal o vertical Y dentro de la misma estancia (una pared separa).
const adjacent = (ctx, a, b) => {
  const N = ctx.N;
  const ra = row(a, N), ca = col(a, N), rb = row(b, N), cb = col(b, N);
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1 && ctx.roomOf[a] === ctx.roomOf[b];
};
const onEdge = (c, N) => row(c, N) === 0 || row(c, N) === N - 1 || col(c, N) === 0 || col(c, N) === N - 1;
const inCorner = (c, N) => (row(c, N) === 0 || row(c, N) === N - 1) && (col(c, N) === 0 || col(c, N) === N - 1);
const nextToItem = (ctx, c, itemId) => {
  for (const d of neighbors(c, ctx.N)) if (ctx.itemAt[d] === itemId && adjacent(ctx, c, d)) return true;
  return false;
};
// Ventanas y puertas van en los lados de las casillas: ctx.wallAt[c] = Set de ids de elemento de pared.
const nextToWall = (ctx, c, wallId) => ctx.wallAt[c]?.has(wallId) || false;
const sittable = (ctx, c) => !!ctx.itemAt[c] && !ctx.itemsById[ctx.itemAt[c]].blocks;
export function neighbors(c, N) {
  const r = row(c, N), k = col(c, N), out = [];
  if (r > 0) out.push(c - N);
  if (r < N - 1) out.push(c + N);
  if (k > 0) out.push(c - 1);
  if (k < N - 1) out.push(c + 1);
  return out;
}
const colLetter = (k) => String.fromCharCode(65 + k);
const nameOf = (ctx, id) => ctx.charById[id].name;
const roomText = (ctx, roomId) => {
  const r = ctx.rooms[roomId];
  return `${r.art} ${r.name}`;
};
const itemText = (ctx, itemId) => {
  const it = ctx.itemsById[itemId];
  return `${it.art} ${it.name}`;
};

function otherSuspects(ctx, S) {
  return ctx.chars.filter((c) => c.id !== S).map((c) => c.id);
}

export const CLUE_TYPES = {
  inRoom: {
    level: 1, unary: true,
    test: (ctx, p, cS) => ctx.roomOf[cS] === p.room,
    text: (ctx, p) => `está en ${roomText(ctx, p.room)}`,
    enumerate: (ctx, S, sol) => {
      const r = ctx.roomOf[sol[S]];
      if (r === ctx.victimRoom) return []; // delataría al asesino
      return [{ room: r }];
    },
  },
  notInRoom: {
    level: 3, unary: true,
    test: (ctx, p, cS) => ctx.roomOf[cS] !== p.room,
    text: (ctx, p) => `no está en ${roomText(ctx, p.room)}`,
    enumerate: (ctx, S, sol) => {
      const r = ctx.roomOf[sol[S]];
      return ctx.rooms.map((_, i) => i).filter((i) => i !== r).map((room) => ({ room }));
    },
  },
  rowIs: {
    level: 1, unary: true,
    test: (ctx, p, cS) => row(cS, ctx.N) === p.row,
    text: (ctx, p) => `está en la fila ${p.row + 1}`,
    enumerate: (ctx, S, sol) => [{ row: row(sol[S], ctx.N) }],
  },
  colIs: {
    level: 1, unary: true,
    test: (ctx, p, cS) => col(cS, ctx.N) === p.col,
    text: (ctx, p) => `está en la columna ${colLetter(p.col)}`,
    enumerate: (ctx, S, sol) => [{ col: col(sol[S], ctx.N) }],
  },
  onEdge: {
    level: 2, unary: true,
    test: (ctx, p, cS) => onEdge(cS, ctx.N),
    text: () => `está en una casilla del borde`,
    enumerate: (ctx, S, sol) => (onEdge(sol[S], ctx.N) && !inCorner(sol[S], ctx.N) ? [{}] : []),
  },
  inCorner: {
    level: 1, unary: true,
    test: (ctx, p, cS) => inCorner(cS, ctx.N),
    text: () => `está en una esquina`,
    enumerate: (ctx, S, sol) => (inCorner(sol[S], ctx.N) ? [{}] : []),
  },
  interior: {
    level: 2, unary: true,
    test: (ctx, p, cS) => !onEdge(cS, ctx.N),
    text: () => `no está en el borde`,
    enumerate: (ctx, S, sol) => (!onEdge(sol[S], ctx.N) ? [{}] : []),
  },
  nextToItem: {
    level: 2, unary: true,
    test: (ctx, p, cS) => nextToItem(ctx, cS, p.item),
    text: (ctx, p) => `está junto a ${itemText(ctx, p.item)}`,
    enumerate: (ctx, S, sol) => {
      const seen = new Set();
      for (const d of neighbors(sol[S], ctx.N)) if (ctx.itemAt[d] && adjacent(ctx, sol[S], d)) seen.add(ctx.itemAt[d]);
      return [...seen].map((item) => ({ item }));
    },
  },
  notNextToItem: {
    level: 3, unary: true,
    test: (ctx, p, cS) => !nextToItem(ctx, cS, p.item),
    text: (ctx, p) => `no está junto a ${itemText(ctx, p.item)}`,
    enumerate: (ctx, S, sol) => {
      const near = new Set();
      for (const d of neighbors(sol[S], ctx.N)) if (ctx.itemAt[d] && adjacent(ctx, sol[S], d)) near.add(ctx.itemAt[d]);
      return ctx.itemIds.filter((i) => !near.has(i)).map((item) => ({ item }));
    },
  },
  onItem: {
    level: 1, unary: true,
    test: (ctx, p, cS) => ctx.itemAt[cS] === p.item,
    text: (ctx, p) => `está sobre ${itemText(ctx, p.item)}`,
    enumerate: (ctx, S, sol) => (sittable(ctx, sol[S]) ? [{ item: ctx.itemAt[sol[S]] }] : []),
  },
  standing: {
    level: 3, unary: true,
    test: (ctx, p, cS) => !sittable(ctx, cS),
    text: () => `está de pie, no sobre ningún mueble`,
    enumerate: (ctx, S, sol) => (!sittable(ctx, sol[S]) && ctx.hasSittable ? [{}] : []),
  },
  nextToWall: {
    level: 2, unary: true,
    test: (ctx, p, cS) => nextToWall(ctx, cS, p.wall),
    text: (ctx, p) => `está junto a ${ctx.wallsById[p.wall].art} ${ctx.wallsById[p.wall].name}`,
    enumerate: (ctx, S, sol) => [...(ctx.wallAt[sol[S]] || [])].map((wall) => ({ wall })),
  },
  notNextToWall: {
    level: 3, unary: true,
    test: (ctx, p, cS) => !nextToWall(ctx, cS, p.wall),
    text: (ctx, p) => `no está junto a ninguna ${ctx.wallsById[p.wall].name}`,
    enumerate: (ctx, S, sol) => ctx.wallIds.filter((w) => !nextToWall(ctx, sol[S], w)).map((wall) => ({ wall })),
  },
  adjacentTo: {
    level: 2, unary: false,
    test: (ctx, p, cS, cO) => adjacent(ctx, cS, cO),
    text: (ctx, p) => `está junto a ${nameOf(ctx, p.other)}`,
    enumerate: (ctx, S, sol) =>
      otherSuspects(ctx, S).filter((O) => adjacent(ctx, sol[S], sol[O])).map((other) => ({ other })),
  },
  notAdjacentTo: {
    level: 3, unary: false,
    test: (ctx, p, cS, cO) => !adjacent(ctx, cS, cO),
    text: (ctx, p) => `no está junto a ${nameOf(ctx, p.other)}`,
    enumerate: (ctx, S, sol) =>
      otherSuspects(ctx, S).filter((O) => !adjacent(ctx, sol[S], sol[O])).map((other) => ({ other })),
  },
  leftOf: {
    level: 2, unary: false,
    test: (ctx, p, cS, cO) => col(cS, ctx.N) < col(cO, ctx.N),
    text: (ctx, p) => `está a la izquierda de ${nameOf(ctx, p.other)}`,
    enumerate: (ctx, S, sol) =>
      otherSuspects(ctx, S).filter((O) => col(sol[S], ctx.N) < col(sol[O], ctx.N)).map((other) => ({ other })),
  },
  rightOf: {
    level: 2, unary: false,
    test: (ctx, p, cS, cO) => col(cS, ctx.N) > col(cO, ctx.N),
    text: (ctx, p) => `está a la derecha de ${nameOf(ctx, p.other)}`,
    enumerate: (ctx, S, sol) =>
      otherSuspects(ctx, S).filter((O) => col(sol[S], ctx.N) > col(sol[O], ctx.N)).map((other) => ({ other })),
  },
  above: {
    level: 2, unary: false,
    test: (ctx, p, cS, cO) => row(cS, ctx.N) < row(cO, ctx.N),
    text: (ctx, p) => `está más arriba que ${nameOf(ctx, p.other)}`,
    enumerate: (ctx, S, sol) =>
      otherSuspects(ctx, S).filter((O) => row(sol[S], ctx.N) < row(sol[O], ctx.N)).map((other) => ({ other })),
  },
  below: {
    level: 2, unary: false,
    test: (ctx, p, cS, cO) => row(cS, ctx.N) > row(cO, ctx.N),
    text: (ctx, p) => `está más abajo que ${nameOf(ctx, p.other)}`,
    enumerate: (ctx, S, sol) =>
      otherSuspects(ctx, S).filter((O) => row(sol[S], ctx.N) > row(sol[O], ctx.N)).map((other) => ({ other })),
  },
  sameRoom: {
    level: 2, unary: false,
    test: (ctx, p, cS, cO) => ctx.roomOf[cS] === ctx.roomOf[cO],
    text: (ctx, p) => `está en ${ctx.sameRoomPhrase} ${nameOf(ctx, p.other)}`,
    enumerate: (ctx, S, sol) =>
      otherSuspects(ctx, S)
        .filter((O) => O !== ctx.victimId && ctx.roomOf[sol[S]] === ctx.roomOf[sol[O]])
        .map((other) => ({ other })),
  },
  differentRoom: {
    level: 3, unary: false,
    test: (ctx, p, cS, cO) => ctx.roomOf[cS] !== ctx.roomOf[cO],
    text: (ctx, p) => `no está en ${ctx.sameRoomPhrase} ${nameOf(ctx, p.other)}`,
    enumerate: (ctx, S, sol) =>
      otherSuspects(ctx, S).filter((O) => ctx.roomOf[sol[S]] !== ctx.roomOf[sol[O]]).map((other) => ({ other })),
  },
};

// Genera todas las pistas verdaderas para un puzle dado su solución.
export function enumerateClues(ctx, solution, allowedTypes) {
  const out = [];
  for (const ch of ctx.chars) {
    if (ch.id === ctx.victimId) continue;
    for (const type of allowedTypes) {
      const def = CLUE_TYPES[type];
      for (const params of def.enumerate(ctx, ch.id, solution)) {
        out.push({ type, subject: ch.id, params, level: def.level });
      }
    }
  }
  return out;
}

export function clueText(ctx, clue) {
  return CLUE_TYPES[clue.type].text(ctx, clue.params);
}

export function clueObject(clue) {
  return CLUE_TYPES[clue.type].unary ? null : clue.params.other;
}

export function clueHolds(ctx, clue, cS, cO) {
  return CLUE_TYPES[clue.type].test(ctx, clue.params, cS, cO);
}
