// hooks/usePreviewSongs.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseAuth from 'firebase/auth';
import { fetchPreviewCard, markPreviewSeen } from '../utils/previewProvider';

export type PreviewCard = {
  title: string;
  artist: string;
  year: number;
  previewUrl: string;
  externalUrl?: string;
  artworkUrl?: string;
  source?: 'itunes' | 'deezer';
};

const SINGLE_SEEN_KEY = 'singleSeenSongsHistory';
const MAX_SEEN = 200;
const MAX_TRIES = 5;

export function usePreviewSongs() {
  const auth = firebaseAuth.getAuth();
  const [card, setCard] = useState<PreviewCard | null>(null);
  const [nextCard, setNextCard] = useState<PreviewCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isHydrating, setIsHydrating] = useState(true);

  const [seen, setSeen] = useState<Set<string>>(new Set());
  const seenRef = useRef(seen);
  useEffect(() => { seenRef.current = seen; }, [seen]);

  // Ladda lokalt “seen”
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SINGLE_SEEN_KEY);
        const arr = raw ? (JSON.parse(raw) as string[]) : [];
        setSeen(new Set(arr.slice(-MAX_SEEN)));
      } catch {}
      setIsHydrating(false);
    })();
  }, []);

  const addSeen = useCallback(async (id: string) => {
    setSeen((prev) => {
      const arr = [...prev, id];
      const trimmed = arr.slice(-MAX_SEEN);
      const s = new Set(trimmed);
      AsyncStorage.setItem(SINGLE_SEEN_KEY, JSON.stringify(Array.from(s))).catch(() => {});
      return s;
    });
  }, []);

  const doFetch = useCallback(async (): Promise<PreviewCard | null> => {
    const token = await auth.currentUser?.getIdToken?.();
    let tries = 0;
    while (tries < MAX_TRIES) {
      tries++;
      const res = await fetchPreviewCard(Array.from(seenRef.current), token || undefined);
      if (!res) continue;
      const id = `${res.artist} - ${res.title}`.toLowerCase();
      if (!seenRef.current.has(id)) {
        // markera sedd (server) “best effort”
        markPreviewSeen(res, token || undefined).catch(() => {});
        await addSeen(id);
        return res;
      }
    }
    return null;
  }, [auth, addSeen]);

  // Preloada nextCard
  const preloadNext = useCallback(async () => {
    if (nextCard || isLoading) return;
    const got = await doFetch();
    if (got) setNextCard(got);
  }, [doFetch, nextCard, isLoading]);

  // Public: generera/leverera card (tar från nextCard om finns)
  const generateCard = useCallback(async (after?: () => void) => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      if (nextCard) {
        setCard(nextCard);
        setNextCard(null);
        after?.();
        // kicka igång preload av nästa direkt
        preloadNext();
        return;
      }
      const got = await doFetch();
      if (!got) {
        setErrorMessage('Kunde inte hämta en unik låt just nu. Försök igen.');
        setCard(null);
        return;
      }
      setCard(got);
      after?.();
      // preloada nästa
      preloadNext();
    } finally {
      setIsLoading(false);
    }
  }, [nextCard, doFetch, preloadNext]);

  // Om vi redan har ett card men saknar nextCard -> preloada
  useEffect(() => {
    if (card && !nextCard) {
      preloadNext();
    }
  }, [card, nextCard, preloadNext]);

  return {
    card,
    isLoading,
    errorMessage,
    isHydrating,
    generateCard,
    // expose för UI som vill nollställa card
    setCard,
  };
}
