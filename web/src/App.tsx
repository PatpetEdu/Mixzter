import { useEffect, useState } from 'react';
import { SpectatorView } from './SpectatorView';
import './App.css';

function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Läs gameId och token från URL-parametrar
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get('gameId');
    const t = searchParams.get('token');

    if (!id || !t) {
      setError('Fel: gameId eller token saknas i URL');
      return;
    }

    setGameId(id);
    setToken(t);
  }, []);

  if (error) {
    return (
      <div className="error-screen">
        <h1>⚠️ Fel</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!gameId || !token) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Laddar spektator-vy...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <SpectatorView gameId={gameId} token={token} />
    </div>
  );
}

export default App;
