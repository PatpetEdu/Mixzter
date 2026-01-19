import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useSpectatorCounter(gameId: string | null) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'games', gameId, 'spectators'),
      (snap) => {
        setCount(snap.size);
        setLoading(false);
      },
      (err) => {
        setError((err as Error).message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gameId]);

  return { count, loading, error };
}
