import { createRoot } from 'react-dom/client';
import { App } from '../../src/app/App';
import { createSession } from '../../src/game/session';
import { completeWorkshop } from '../helpers/complete-workshop';
import '../../src/app/styles.css';
import '../../src/app/panels.css';
const session = createSession();
completeWorkshop(session);
createRoot(document.getElementById('root')!).render(<App session={session} />);
