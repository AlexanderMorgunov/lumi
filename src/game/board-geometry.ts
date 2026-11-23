import type { LevelDefinition, Position } from '../domain/levels';

// Logical dimensions never depend on the viewport or device orientation.
// This room's authored floor stays fixed; future rooms can supply other bounds.
export function boardGeometry(
  level: Pick<LevelDefinition, 'columns' | 'rows'>,
) {
  const width = 1000 / level.columns;
  const height = 420 / level.rows;
  return {
    left: 100,
    top: 350,
    width,
    height,
    scale: Math.min(width / 200, height / 140),
  };
}
export function cellCenter(
  field: ReturnType<typeof boardGeometry>,
  p: Position,
) {
  return {
    x: field.left + (p.x + 0.5) * field.width,
    y: field.top + (p.y + 0.5) * field.height,
  };
}
