import type { ReferenceObject } from '../domain/levels';

export const stationArt = [
  'nora',
  'younger',
  'cargo-crate',
  'cargo-crate-open',
  'storybook',
  'travel-bag-open',
] as const;
export type Illustration = {
  texture: string;
  frame?: string;
  height: number;
  child?: 'nora' | 'younger';
};
const portrait = (texture: string, height = 114): Illustration => ({
  texture,
  frame: '0',
  height,
});
const child = (name: 'nora' | 'younger'): Illustration => ({
  ...portrait(name, name === 'nora' ? 116 : 100),
  child: name,
});

/** A record depicts its subject; it does not place that subject in the station. */
export function stationIllustrations(
  object: ReferenceObject,
  baggage?: { ready: boolean; unknown: boolean },
): Illustration[] {
  const subject = object.illustration ?? object.noun;
  if (subject === 'nora') return [child('nora')];
  if (subject === 'younger') return [child('younger')];
  if (subject === 'child' || subject === 'children')
    return object.count === 2
      ? [child('nora'), child('younger')]
      : [child('nora')];
  if (subject === 'person' || subject === 'people')
    return object.count === 2
      ? [portrait('marta-emotes', 134), { ...child('nora'), height: 100 }]
      : [portrait('marta-emotes', 134)];
  if (subject === 'lumi') return [portrait('lumi-emotes', 110)];
  if (subject === 'tik') return [portrait('tik-emotes')];
  if (subject === 'marta') return [portrait('marta-emotes', 134)];
  if (subject === 'robots')
    return [
      { texture: 'robot', height: 100 },
      { texture: 'robot', height: 100 },
    ];
  if (subject === 'travellers')
    return [portrait('lumi-emotes', 110), portrait('tik-emotes')];
  const texture =
    subject === 'bag'
      ? baggage?.ready || baggage?.unknown || !baggage
        ? 'travel-bag'
        : 'travel-bag-open'
      : subject === 'crate'
        ? baggage?.ready || baggage?.unknown || !baggage
          ? 'cargo-crate'
          : 'cargo-crate-open'
        : (
            {
              box: 'cargo-crate',
              boxes: 'cargo-crate',
              story: 'storybook',
              stories: 'storybook',
              parcel: 'cargo-crate',
              key: 'brass-key',
              umbrella: 'umbrella',
            } as Record<string, string>
          )[subject];
  if (!texture)
    throw new Error(`Missing station illustration: ${object.id} (${subject})`);
  const item = {
    texture,
    height: subject === 'story' || subject === 'stories' ? 86 : 106,
  };
  return object.count === 2 ? [item, item] : [item];
}

export function childFrame(
  name: 'nora' | 'younger',
  time: number,
  animated: boolean,
): number {
  if (!animated) return 0;
  const phase = (time + (name === 'younger' ? 1700 : 0)) % 7200;
  if (phase >= 1800 && phase < 1950) return 1;
  if (phase >= 4400 && phase < 4900) return 2;
  if (phase >= 4900 && phase < 5600) return 3;
  return 0;
}
