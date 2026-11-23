import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createSession } from './game/session';
import './app/styles.css';
import './app/panels.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing app root');
const session = createSession();
createRoot(root).render(
  <StrictMode>
    <App session={session} />
  </StrictMode>,
);
