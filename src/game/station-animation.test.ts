import { expect, it } from 'vitest';
import { stationFrame } from './station-animation';

it('opens the mouth only on voiced samples; pause and reduced motion win over audio', () => {
  for (const character of ['marta', 'tik'] as const) {
    expect(stationFrame(character, 1850, true)).toBe(1);
    expect(stationFrame(character, 5000, true)).toBe(2);
    expect(stationFrame(character, 5000, true, 'open')).toBe(3);
    expect(stationFrame(character, 1850, true, 'closed')).toBe(0);
    expect(stationFrame(character, 5000, false, 'open')).toBe(0);
  }
});
