import { useState } from 'react';
import { SingleView } from './app/SingleView';
import { DiffView } from './app/DiffView';
import './App.css';

type Mode = 'single' | 'diff';

function App() {
  const [mode, setMode] = useState<Mode>('single');

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
        </nav>
      </header>
      <main className="app-content">{mode === 'single' ? <SingleView /> : <DiffView />}</main>
    </div>
  );
}

export default App;

