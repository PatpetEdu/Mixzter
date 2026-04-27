import { useEffect, useState } from 'react';
import { SpectatorView } from './SpectatorView';
import { ScoreBattleView } from './ScoreBattleView';
import './App.css';

function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<'spectator' | 'scorebattle' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('gameId');
    const m  = p.get('mode');
    const t  = p.get('token');

    if (!id) {
      setError('Fel: gameId saknas i URL');
      return;
    }
    setGameId(id);

    if (m === 'scorebattle') {
      setMode('scorebattle');
    } else if (t) {
      setToken(t);
      setMode('spectator');
    } else {
      setError('Fel: mode eller token saknas i URL');
    }
  }, []);

  if (error) {
    return (
      <div className="error-screen">
        <h1>⚠️ Fel</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!gameId || !mode) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Laddar…</p>
      </div>
    );
  }

  if (mode === 'scorebattle') {
    return <ScoreBattleView gameId={gameId} />;
  }

  return (
    <div className="app-container">
      <SpectatorView gameId={gameId} token={token!} />
    </div>
  );
}

export default App;
