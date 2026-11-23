import type { CatMouth } from './cat-mouth';

export type StationCharacter = 'marta' | 'tik';
export function stationFrame(
  character: StationCharacter,
  milliseconds: number,
  animated: boolean,
  mouth: CatMouth = 'rest',
): number {
  if (!animated) return 0;
  if (mouth === 'open') return 3;
  if (mouth === 'closed') return 0;
  const time =
    Math.max(0, milliseconds) % (character === 'marta' ? 7200 : 6100);
  if (time >= 1800 && time < 1950) return 1;
  if (time >= 4800 && time < 5500) return 2;
  return 0;
}
