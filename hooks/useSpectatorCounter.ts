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
      (err: any) => {
        // Silently ignore errors - we don't actually use this listener for anything important
        // Just set count to 0 if there's any error
        setCount(0);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gameId]);

  return { count, loading, error };
}
