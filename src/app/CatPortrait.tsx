import { useEffect, useRef } from 'react';
import { art } from './Prologue';
import type { CatMouth } from '../game/cat-mouth';

export function CatPortrait({
  playing,
  animate,
  getMouth,
}: {
  playing: boolean;
  animate: boolean;
  getMouth: () => CatMouth;
}) {
  const portrait = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = portrait.current;
    if (!element) return;
    element.dataset.mouth = 'rest';
    if (!playing || !animate) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = -Infinity;
    function tick(time: number) {
      if (element && time - last >= 80) {
        last = time;
        const mouth = getMouth();
        if (element.dataset.mouth !== mouth) element.dataset.mouth = mouth;
      }
      frame = requestAnimationFrame(tick);
    }
    function updatePreference() {
      cancelAnimationFrame(frame);
      if (element) element.dataset.mouth = 'rest';
      last = -Infinity;
      if (!preference.matches) frame = requestAnimationFrame(tick);
    }
    preference.addEventListener('change', updatePreference);
    updatePreference();
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', updatePreference);
      element.dataset.mouth = 'rest';
    };
  }, [playing, animate, getMouth]);
  return (
    <div className="cat-portrait" aria-hidden="true">
      <span
        ref={portrait}
        className="cat-portrait-motion"
        data-mouth="rest"
        style={{ backgroundImage: `url(${art}lumi/cat-emotes-v1.webp)` }}
      />
    </div>
  );
}
