import { useState } from 'react';
import { SingleView } from './app/SingleView';
import { DiffView } from './app/DiffView';
import { GitDiffView } from './app/GitDiffView';
import './App.css';

type Mode = 'single' | 'diff' | 'git';

function initialMode(): Mode {
  const mode = new URLSearchParams(window.location.search).get('mode');
  return mode === 'diff' || mode === 'git' ? mode : 'single';
}

function App() {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Axon Ivy Process Viewer</h1>
        <nav className="app-tabs">
          <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>
            Single view
          </button>
          <button className={mode === 'diff' ? 'active' : ''} onClick={() => setMode('diff')}>
            Diff view
          </button>
          <button className={mode === 'git' ? 'active' : ''} onClick={() => setMode('git')}>
            Git diff view
          </button>
        </nav>
      </header>
      <main className="app-content">
        {mode === 'single' && <SingleView />}
        {mode === 'diff' && <DiffView />}
        {mode === 'git' && <GitDiffView />}
      </main>
    </div>
  );
}

export default App;

