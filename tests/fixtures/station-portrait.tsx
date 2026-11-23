// Test-only existing recording: verifies timing, NOT Marta/Tik voice casting.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { StationPortrait } from '../../src/app/StationPortrait';
import { createGameAudio } from '../../src/game/audio';
import manifest from '../../src/game/cat-voice-manifest.json';
import '../../src/app/styles.css';
import '../../src/app/panels.css';
import '../../src/app/station.css';

const audio = createGameAudio();
function Fixture() {
  const state = useSyncExternalStore(audio.subscribe, audio.getSnapshot);
  const [character, setCharacter] = useState<'marta' | 'tik'>('marta');
  const [paused, setPaused] = useState(false);
  useEffect(() => audio.mount(), []);
  return (
    <main style={{ padding: 24 }}>
      <p>
        Техническая проверка: тестовая запись кота, не голос Марты или Тика.
      </p>
      <StationPortrait
        character={character}
        playing={Boolean(state.catPlaying)}
        animate={!paused}
        getMouth={audio.getCatMouth}
      />
      <button onClick={() => audio.playCat(manifest.clips[0]!)}>
        Тестовая запись
      </button>
      <button
        onClick={() => {
          audio.stop();
          setPaused((value) => !value);
        }}
      >
        Пауза
      </button>
      <button onClick={() => audio.setCatEnabled(!state.catEnabled)}>
        Выключить речь
      </button>
      <button
        onClick={() => {
          audio.stop();
          setCharacter((value) => (value === 'marta' ? 'tik' : 'marta'));
        }}
      >
        Другой персонаж
      </button>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
