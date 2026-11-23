import {
  offsets,
  reducePuzzle,
  samePosition,
  type Direction,
  type PuzzleState,
  type Position,
} from '../../src/domain/puzzle';

// Search real pushes, treating the other tiles as obstacles. No state injection.
// Try target orders so a solved tile never needs to be moved out of the frame.
export function solveStation(
  initial: PuzzleState,
  words: readonly string[],
  slotOffset = 0,
): Direction[] {
  const tasks = words.map((word, i) => {
    const piece = initial.pieces.find(
      (p) => p.kind === 'word' && p.word === word,
    );
    if (!piece) throw new Error(`Missing tile ${word}`);
    const target = initial.definition.slots[i + slotOffset];
    if (!target) throw new Error('Phrase exceeds reading frame');
    return { id: piece.id, target };
  });
  const key = (p: Position) => `${p.x},${p.y}`;
  function single(
    state: PuzzleState,
    id: string,
    target: Position,
  ): Direction[] | null {
    const tile = state.pieces.find((p) => p.id === id)!;
    const obstacles = new Set(
      [
        ...state.definition.walls,
        ...state.pieces.filter((p) => p.id !== id),
      ].map(key),
    );
    const blocked = (p: Position) =>
      p.x < 0 ||
      p.y < 0 ||
      p.x >= state.definition.columns ||
      p.y >= state.definition.rows ||
      obstacles.has(key(p));
    const queue = [
      {
        player: { x: state.x, y: state.y },
        box: { x: tile.x, y: tile.y },
        path: [] as Direction[],
      },
    ];
    const seen = new Set<string>();
    for (let index = 0; index < queue.length; index++) {
      const item = queue[index]!;
      if (samePosition(item.box, target)) return item.path;
      for (const direction of Object.keys(offsets) as Direction[]) {
        const offset = offsets[direction];
        const player = {
          x: item.player.x + offset.x,
          y: item.player.y + offset.y,
        };
        if (blocked(player)) continue;
        const box = samePosition(player, item.box)
          ? { x: item.box.x + offset.x, y: item.box.y + offset.y }
          : item.box;
        if (blocked(box)) continue;
        const signature = `${key(player)};${key(box)}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        queue.push({ player, box, path: [...item.path, direction] });
      }
    }
    return null;
  }
  function search(
    state: PuzzleState,
    pending: typeof tasks,
  ): Direction[] | null {
    if (!pending.length) return [];
    for (const task of pending) {
      const path = single(state, task.id, task.target);
      if (!path) continue;
      const next = path.reduce(
        (s, direction) => reducePuzzle(s, { type: 'move', direction }),
        state,
      );
      const rest = search(
        next,
        pending.filter((p) => p !== task),
      );
      if (rest) return [...path, ...rest];
    }
    return null;
  }
  let result = search(initial, tasks);
  // A distractor can block access to an otherwise usable word. Park one away
  // from the frame with real pushes, then try assembling again.
  if (!result) {
    const parking = [
      { x: 0, y: 0 },
      { x: initial.definition.columns - 1, y: 0 },
      { x: 0, y: initial.definition.rows - 1 },
      { x: initial.definition.columns - 1, y: initial.definition.rows - 1 },
    ];
    for (const piece of initial.pieces.filter(
      (p) => !tasks.some((t) => t.id === p.id),
    )) {
      for (const target of parking) {
        const path = single(initial, piece.id, target);
        if (!path) continue;
        const parked = path.reduce(
          (s, direction) => reducePuzzle(s, { type: 'move', direction }),
          initial,
        );
        const rest = search(parked, tasks);
        if (rest) {
          result = [...path, ...rest];
          break;
        }
      }
      if (result) break;
    }
  }
  if (!result)
    throw new Error(`No route: ${initial.definition.id}, ${words.join(' ')}`);
  return result;
}
