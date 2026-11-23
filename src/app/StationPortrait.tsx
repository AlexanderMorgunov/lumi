import { useEffect, useRef } from 'react';
import { stationFrame, type StationCharacter } from '../game/station-animation';
import type { CatMouth } from '../game/cat-mouth';

export function StationPortrait({
  character,
  playing,
  animate,
  getMouth,
}: {
  character: StationCharacter;
  playing: boolean;
  animate: boolean;
  getMouth: () => CatMouth;
}) {
  const sheet = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let request = 0;
    let started = 0;
    let last = -Infinity;
    const reset = () => {
      cancelAnimationFrame(request);
      element.dataset.frame = '0';
      element.dataset.mouth = 'rest';
    };
    function tick(time: number) {
      if (!started) started = time;
      if (time - last >= 80) {
        last = time;
        const mouth = playing ? getMouth() : 'rest';
        element!.dataset.mouth = mouth;
        // The portrait keeps the same pose; the gesture belongs to the scene.
        const frame = stationFrame(character, time - started, true, mouth);
        element!.dataset.frame = String(frame === 2 ? 0 : frame);
      }
      request = requestAnimationFrame(tick);
    }
    function updatePreference() {
      reset();
      started = 0;
      last = -Infinity;
      if (animate && !preference.matches) request = requestAnimationFrame(tick);
    }
    preference.addEventListener('change', updatePreference);
    updatePreference();
    return () => {
      reset();
      preference.removeEventListener('change', updatePreference);
    };
  }, [character, playing, animate, getMouth]);
  return (
    <span
      className={`station-portrait station-portrait-${character}`}
      role="img"
      aria-label={
        character === 'marta'
          ? 'Марта, мастер фонарей'
          : 'Тик, почтовый помощник'
      }
    >
      <span
        ref={sheet}
        className="station-portrait-sheet"
        data-frame="0"
        data-mouth="rest"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}art/station/${character}-emotes-v1.png)`,
        }}
      />
    </span>
  );
}
