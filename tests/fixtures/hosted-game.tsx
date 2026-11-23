import { createRoot } from 'react-dom/client';
import { App } from '../../src/app/App';
import { createSession } from '../../src/game/session';
import '../../src/app/styles.css';
import '../../src/app/panels.css';
// Test-only entry, not part of the production Vite entry or trust configuration.
createRoot(document.getElementById('root')!).render(
  <App
    session={createSession()}
    settings={{
      status: 'SDK fixture',
      options: {
        hostOrigin: location.origin,
        gameId: 'integration-test',
        releaseId: '1.0.0',
      },
    }}
  />,
);
