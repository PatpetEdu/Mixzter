import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export type GameData = {
  host: string;
  gameCode: string;
  gameMode: string;
  status: 'active' | 'ended';
  createdAt: any;
  updatedAt: any;
  spectatorCount: number;
  players: {
    [playerName: string]: {
      timeline: number[];
      stars: number;
      startYear: number;
      cards: Array<{ year: number; title: string; artist: string }>;
    };
  };
  roundCards: Array<{ year: number; title: string; artist: string }>;
  currentCard: {
    artist: string;
    title: string;
    year: number;
    source?: string;
  } | null;
  gameState: {
    activePlayer: string;
    backCardUnlocked: boolean;
    wasCorrect?: boolean;
  };
};

interface UseSpectatorListenerProps {
  gameId: string | null;
}

interface UseSpectatorListenerReturn {
  gameData: GameData | null;
  loading: boolean;
  error: Error | null;
}

export function useSpectatorListener({ gameId }: UseSpectatorListenerProps): UseSpectatorListenerReturn {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      setGameData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = onSnapshot(
        doc(db, 'games', gameId),
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            setGameData(docSnapshot.data() as GameData);
            setLoading(false);
          } else {
            setError(new Error('Game not found'));
            setLoading(false);
          }
        },
        (err) => {
          console.error('Error listening to game:', err);
          setError(err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setLoading(false);
    }
  }, [gameId]);

  return { gameData, loading, error };
}
