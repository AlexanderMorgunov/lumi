import { createRoot } from 'react-dom/client';
import { App } from '../../src/app/App';
import { createSession } from '../../src/game/session';
import { episodes, type EpisodeId } from '../../src/domain/episodes';
import '../../src/app/styles.css';
import '../../src/app/panels.css';

// Synthetic visited catalogue for layout/search checks; not a player save.
const session = createSession();
for (const id of Object.keys(episodes) as EpisodeId[])
  session.enterEpisode(id, { developmentPreview: true });
session.enterEpisode('cat', { developmentPreview: true });
createRoot(document.getElementById('root')!).render(<App session={session} />);
