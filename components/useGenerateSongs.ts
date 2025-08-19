import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native'; // Importera AppState
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseAuth from 'firebase/auth';

// Typer och konstanter
type Card = {
  title: string;
  artist: string;
  year: number;
  spotifyUrl: string;
};

const SEEN_SONGS_KEY = 'duoSeenSongsHistory';
const MAX_SEEN_SONGS_HISTORY = 200;
const MAX_DIRECT_FETCH_ATTEMPTS = 5;

// NYTT: persistKey (valfri) för att spara nästa kort per spel + expose isHydrating
export const useGenerateSongs = (
  initialPreloadedCard: Card | null,
  onPreloadComplete: () => void,
  persistKey?: string
) => {
  const auth = firebaseAuth.getAuth();
  const [seenSongs, setSeenSongs] = useState<Set<string>>(new Set());
  const seenSongsRef = useRef(seenSongs);
  const [card, setCard] = useState<Card | null>(null);
  const [nextCard, setNextCard] = useState<Card | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingCard, setIsLoadingCard] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true); // ⬅️ NYTT
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    seenSongsRef.current = seenSongs;
  }, [seenSongs]);

  const fetchCardFromServer = useCallback(async () => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;

    try {
      const clientSeenSongsArray = Array.from(seenSongsRef.current);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('https://us-central1-musikquiz-app.cloudfunctions.net/generateCard', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ clientSeenSongs: clientSeenSongsArray }),
      });

      // *** FIX: Robust felhantering för att fånga upp "dolda" fel i APK ***
      if (!res.ok) {
        const errorText = await res.text();
        console.error('useGenerateSongs: Fel från servern:', res.status, errorText);
        return null;
      }

      try {
        // Försök att parsa svaret som JSON
        return (await res.json()) as Card;
      } catch (jsonError) {
        // Om JSON-parsningen misslyckas, logga felet och den råa texten
        const responseClone = res.clone();
        const rawText = await responseClone.text();
        console.error('useGenerateSongs: Kunde inte parsa JSON från servern.', jsonError);
        console.error('useGenerateSongs: Råtext från servern:', rawText);
        return null;
      }
    } catch (err) {
      console.error('API-anrop: Kritiskt fel:', err);
      return null;
    }
  }, [auth]);

  const markSongAsSeenOnServer = useCallback(async (songData: Card) => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('https://us-central1-musikquiz-app.cloudfunctions.net/markSongAsSeen', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          songIdentifier: `${songData.artist} - ${songData.title}`.toLowerCase(),
          artist: songData.artist,
          title: songData.title,
          year: songData.year,
        }),
      });
    } catch (err) {
      console.error('Markera som sedd: Kritiskt fel:', err);
    }
  }, [auth]);

  const preloadNextCard = useCallback(async () => {
    if (nextCard || isLoadingCard) {
      return;
    }

    let preloadedCard: Card | null = null;
    let attempts = 0;
    while (!preloadedCard && attempts < MAX_DIRECT_FETCH_ATTEMPTS) {
      const fetchedCard = await fetchCardFromServer();
      if (fetchedCard) {
        const songIdentifier = `${fetchedCard.artist} - ${fetchedCard.title}`.toLowerCase();
        if (!seenSongsRef.current.has(songIdentifier)) {
          preloadedCard = fetchedCard;
          setNextCard(preloadedCard);

          // ✅ Persist nextCard per spel (om persistKey finns)
          if (persistKey) {
            try {
              await AsyncStorage.setItem(persistKey, JSON.stringify(preloadedCard));
            } catch {}
          }

          setSeenSongs((prev) => {
            const updatedArray = [...Array.from(prev), songIdentifier];
            if (updatedArray.length > MAX_SEEN_SONGS_HISTORY) updatedArray.shift();
            const newSet = new Set(updatedArray);
            AsyncStorage.setItem(SEEN_SONGS_KEY, JSON.stringify(Array.from(newSet)));
            return newSet;
          });
          break;
        }
      }
      attempts++;
    }
    if (!preloadedCard) console.error('Preload: Kunde inte för-ladda ett unikt kort.');
  }, [fetchCardFromServer, nextCard, isLoadingCard, persistKey]);

  const generateCard = useCallback(async (resetInputs?: () => void) => {
    setErrorMessage('');
    setCard(null);

    if (nextCard) {
      setCard(nextCard);
      setNextCard(null);

      // 🧹 Rensa persisterad nextCard när den förbrukas
      if (persistKey) {
        try {
          await AsyncStorage.removeItem(persistKey);
        } catch {}
      }

      if (resetInputs) resetInputs();
      markSongAsSeenOnServer(nextCard);
      return;
    }

    setIsLoadingCard(true);
    let fetchedCard: Card | null = null;
    let attempts = 0;
    while (!fetchedCard && attempts < MAX_DIRECT_FETCH_ATTEMPTS) {
      const currentFetchedCard = await fetchCardFromServer();
      if (currentFetchedCard) {
        const songIdentifier = `${currentFetchedCard.artist} - ${currentFetchedCard.title}`.toLowerCase();
        if (!seenSongsRef.current.has(songIdentifier)) {
          fetchedCard = currentFetchedCard;
          setSeenSongs((prev) => {
            const updatedArray = [...Array.from(prev), songIdentifier];
            if (updatedArray.length > MAX_SEEN_SONGS_HISTORY) updatedArray.shift();
            const newSet = new Set(updatedArray);
            AsyncStorage.setItem(SEEN_SONGS_KEY, JSON.stringify(Array.from(newSet)));
            return newSet;
          });
          break;
        }
      }
      attempts++;
    }

    setIsLoadingCard(false);
    if (fetchedCard) {
      setCard(fetchedCard);
      if (resetInputs) resetInputs();
      markSongAsSeenOnServer(fetchedCard);
    } else {
      setErrorMessage('Kunde inte generera ett unikt kort efter flera försök. Försök igen.');
    }
  }, [nextCard, markSongAsSeenOnServer, fetchCardFromServer, persistKey]);

  // Ny useEffect för att hantera appens tillstånd
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // Om appen kommer tillbaka från bakgrunden och blir aktiv...
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // ...och om vi är i ett laddningsläge men inte har något kort (troligtvis ett avbrutet anrop)
        if (isLoadingCard && !card) {
          console.log('Appen blev aktiv, försöker hämta kort igen...');
          generateCard(); // Försök hämta ett nytt kort
        }
      }
      appState.current = nextAppState;
    });

    // Städa upp lyssnaren när komponenten försvinner
    return () => {
      subscription.remove();
    };
  }, [isLoadingCard, card, generateCard]); // Beroenden för att alltid ha senaste state

  // Om vi har ett aktuellt kort, trigga preload av nästa
  useEffect(() => {
    if (card && !nextCard) {
      preloadNextCard();
    }
  }, [card, nextCard, preloadNextCard]);

  // Initial hydrering: seenSongs + ev. persisterad nextCard + ev. server-preload
  useEffect(() => {
    const loadInitialState = async () => {
      const storedSongs = await AsyncStorage.getItem(SEEN_SONGS_KEY);
      const loadedSeenSongs = storedSongs
        ? new Set((JSON.parse(storedSongs) as string[]).slice(-MAX_SEEN_SONGS_HISTORY))
        : new Set<string>();
      setSeenSongs(loadedSeenSongs);

      // 1) Försök ladda persisterad nextCard först (per spel)
      let persistedNext: Card | null = null;
      if (persistKey) {
        try {
          const raw = await AsyncStorage.getItem(persistKey);
          persistedNext = raw ? (JSON.parse(raw) as Card) : null;
        } catch {}
      }
      if (persistedNext) {
        setNextCard(persistedNext);
        setIsHydrating(false);
        return;
      }

      // 2) Om vi fått initialPreloadedCard (server-preload)
      if (initialPreloadedCard) {
        setCard(initialPreloadedCard);

        const songIdentifier = `${initialPreloadedCard.artist} - ${initialPreloadedCard.title}`.toLowerCase();
        const updatedSeenSongs = new Set<string>([...Array.from(loadedSeenSongs), songIdentifier]);
        setSeenSongs(updatedSeenSongs);
        AsyncStorage.setItem(SEEN_SONGS_KEY, JSON.stringify(Array.from(updatedSeenSongs)));

        markSongAsSeenOnServer(initialPreloadedCard);
        onPreloadComplete();
      }

      setIsHydrating(false);
    };
    loadInitialState();
  }, [initialPreloadedCard, onPreloadComplete, markSongAsSeenOnServer, persistKey]);

  return { card, setCard, isLoadingCard, errorMessage, generateCard, isHydrating };
};
