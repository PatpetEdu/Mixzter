// components/useGenerateSongs.ts
//
// Queue-baserad hook för låtgenerering.
// Frågar servern om BATCH_SIZE låtar åt gången och håller en intern kö.
// Ny batch hämtas i bakgrunden när kön sjunker till ≤ REFILL_THRESHOLD.
// Låtar markeras som sedda på servern ENBART när de konsumeras ur kön.
//
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Typer
export type Card = {
  title: string;
  artist: string;
  year: number;
  spotifyUrl: string;
  source?: string;
  previewData?: {
    previewUrl: string;
    artworkUrl?: string;
    externalUrl: string;
    previewProvider: 'itunes' | 'deezer';
  };
};

// Konfiguration
const BATCH_SIZE = 15;        // Antal låtar per API-anrop
const REFILL_THRESHOLD = 5;   // Fyll på kön när denna många låtar återstår (~40s marginal)
const PERSIST_QUEUE_SIZE = 8; // Antal kort som sparas lokalt – extra buffer mot Firestore-filtrering vid resume

const GENERATE_URL = 'https://us-central1-musikquiz-app.cloudfunctions.net/generateCard';
const REST_URL    = 'https://us-central1-musikquiz-app.cloudfunctions.net/generateCardRest';
const MARK_SEEN_URL = 'https://us-central1-musikquiz-app.cloudfunctions.net/markSongAsSeen';

/**
 * useGenerateSongs – queue-baserad hook
 *
 * Parametrar:
 *   gameMode – vilket spelläge (default: 'default')
 *
 * Returnerar:
 *   card, setCard, isLoadingCard, errorMessage, isHydrating, generateCard
 */
export const useGenerateSongs = (gameMode: string = 'default', persistKey?: string) => {
  const auth = firebaseAuth.getAuth();

  // Synlig state (triggar re-render)
  const [queue, setQueue] = useState<Card[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isHydrating, setIsHydrating] = useState(true);

  // Refs – stabil access utan stale-closure-problem
  const queueRef = useRef<Card[]>([]);
  const seenSongsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef(false);
  const waitingForCardRef = useRef(false);
  const pendingResetRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRetryCountRef = useRef(0); // Antal konsekutiva misslyckade fetchBatch-anrop

  // Håll ref synkad med state
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Avbryt pågående fetch vid avmontering (förhindrar stale-request-fel efter game-over)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  // ─── Persistens ─────────────────────────────────────────────────────────────

  // Spara de första PERSIST_QUEUE_SIZE korten ur kön – möjliggör seamless resume utan omedelbar batch
  const persistNextCard = useCallback((nextQueue: Card[]) => {
    if (!persistKey) {
      console.log('[useGenerateSongs] persistNextCard: ingen persistKey, sparar ej');
      return;
    }
    if (nextQueue.length > 0) {
      const toSave = nextQueue.slice(0, PERSIST_QUEUE_SIZE);
      console.log(`[useGenerateSongs] persistNextCard: sparar ${toSave.length} kort till ${persistKey}`);
      AsyncStorage.setItem(persistKey, JSON.stringify(toSave)).catch(() => {});
    } else {
      console.log('[useGenerateSongs] persistNextCard: kön tom, tar bort AsyncStorage');
      AsyncStorage.removeItem(persistKey).catch(() => {});
    }
  }, [persistKey]);

  // Rensa persisterad nextCard (anropas vid game over)
  const clearPersistedQueue = useCallback(() => {
    if (persistKey) AsyncStorage.removeItem(persistKey).catch(() => {});
  }, [persistKey]);

  // ─── Ladda seenSongs vid mount ───────────────────────────────────────────────

  useEffect(() => {
    if (!persistKey) {
      console.log('[useGenerateSongs] persistKey saknas – hydrering direkt');
      setIsHydrating(false);
      return;
    }
    console.log(`[useGenerateSongs] Laddar kö från AsyncStorage, persistKey=${persistKey}`);
    setIsHydrating(true);
    (async () => {
      if (persistKey) {
        try {
          const raw = await AsyncStorage.getItem(persistKey);
          console.log(`[useGenerateSongs] AsyncStorage raw=${raw ? `${raw.length} tecken` : 'null'}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            let cards: Card[] = Array.isArray(parsed) ? parsed : [parsed];
            console.log(`[useGenerateSongs] Parsade ${cards.length} kort från AsyncStorage`);

            const user = auth.currentUser;
            if (user && cards.length > 0) {
              try {
                const db = getFirestore();
                const snap = await getDocs(collection(db, `users/${user.uid}/seenSongs`));
                const firestoreSeen = new Set<string>();
                snap.forEach(doc => {
                  const id = doc.data().songIdentifier as string;
                  if (id) firestoreSeen.add(id);
                });
                const before = cards.length;
                if (firestoreSeen.size > 0) {
                  cards = cards.filter(c =>
                    !firestoreSeen.has(`${c.artist} - ${c.title}`.toLowerCase())
                  );
                }
                console.log(`[useGenerateSongs] Firestore-filter: ${before} → ${cards.length} kort`);
              } catch (e) {
                console.warn('[useGenerateSongs] Firestore-filter misslyckades:', e);
              }
            }

            if (cards.length > 0) {
              setQueue(cards);
              queueRef.current = cards;
              console.log(`[useGenerateSongs] Kön satt med ${cards.length} kort`);
            } else {
              console.log('[useGenerateSongs] Inga kort kvar efter filter');
            }
          }
        } catch (e) {
          console.warn('[useGenerateSongs] AsyncStorage-fel:', e);
        }
      }
      setIsHydrating(false);
    })();
  }, [persistKey]); // Kör om när persistKey blir tillgänglig

  // ─── Servermarkering (konsumerad låt) ───────────────────────────────────────

  const markSeenOnServer = useCallback(async (songData: Card) => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(MARK_SEEN_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          songIdentifier: `${songData.artist} - ${songData.title}`.toLowerCase(),
          artist: songData.artist,
          title: songData.title,
          year: songData.year,
          ...(songData.source && { source: songData.source }),
        }),
      });
    } catch (err) {
      console.error('useGenerateSongs: markSeenOnServer fel:', err);
    }
  }, [auth]);

  // ─── Konsumera kort (anropas ENBART när kortet levereras till spelaren) ────────
  // Lägger till i seenSongs och markerar på servern
  // Lägg till i session-lokal seenSongs och markera på servern (Firestore)
  // seenSongsRef används inom sessionen för att undvika dubletter innan
  // Firestore-skrivningen hunnit propagera till nästa batch-anrop.
  const consumeCard = useCallback((songData: Card) => {
    const id = `${songData.artist} - ${songData.title}`.toLowerCase();
    // Håll max 1 entry — skyddar enbart mot pending Firestore-skrivning (~500ms fönster)
    seenSongsRef.current.clear();
    seenSongsRef.current.add(id);
    markSeenOnServer(songData).catch(() => {});
  }, [markSeenOnServer]);

  // ─── Hämta batch ─────────────────────────────────────────────────────────────
  // Frågar alltid om BATCH_SIZE låtar (1 OpenAI-anrop per batch).

  const fetchBatch = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    console.log(`[useGenerateSongs] fetchBatch startad – queueRef.length=${queueRef.current.length}`);

    // Avbryt ev. föregående in-flight fetch och skapa ny controller
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Avoid-lista = redan sedda låtar PLUS låtar som redan är i kön
      const queueIdentifiers = queueRef.current.map(
        c => `${c.artist} - ${c.title}`.toLowerCase()
      );
      const avoidList = Array.from(seenSongsRef.current).concat(queueIdentifiers);

      // ─── Fas 1: OpenAI (1 anrop) + 1 låt → snabb leverans (~5–7s) ────────
      const res1 = await fetch(GENERATE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientSeenSongs: avoidList, gameMode, count: BATCH_SIZE }),
        signal: controller.signal,
      });

      if (!res1.ok) {
        const errText = await res1.text();
        throw new Error(`HTTP ${res1.status}: ${errText}`);
      }

      const phase1: { firstCard: Card | null; batchId: string } = await res1.json();

      // Leverera första kortet omedelbart – spelaren ser låten direkt
      if (phase1.firstCard) {
        setQueue(prev => [...prev, phase1.firstCard!]);
      }

      // ─── Fas 2: Resterande 14 låtar i bakgrunden ──────────────────────────
      let phase2AddedCards = false;
      try {
        const res2 = await fetch(REST_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ batchId: phase1.batchId }),
          signal: controller.signal,
        });
        if (res2.ok) {
          const restCards: Card[] = await res2.json();
          if (Array.isArray(restCards) && restCards.length > 0) {
            setQueue(prev => {
              const updated = [...prev, ...restCards];
              // Spara kön till AsyncStorage nu när den är fullt ifylld
              persistNextCard(updated);
              return updated;
            });
            phase2AddedCards = true;
          }
        } else {
          console.warn('useGenerateSongs: fas 2 HTTP-fel:', res2.status);
        }
      } catch (restErr) {
        if (restErr instanceof Error && restErr.name === 'AbortError') {
          isFetchingRef.current = false;
          return;
        }
        // Fas 2 misslyckades – spara det vi har (fas 1-kortet om det finns i kön)
        console.warn('useGenerateSongs: fas 2 misslyckades (bakgrund):', restErr);
        persistNextCard(queueRef.current);
      }

      // Fel endast om varken fas 1 eller fas 2 gav några kort alls
      if (!phase1.firstCard && !phase2AddedCards) {
        throw new Error('Tomt eller ogiltigt batch-svar från servern');
      }

      // Lyckades – nollställ felräknare
      fetchRetryCountRef.current = 0;

    } catch (err) {
      // Ignorera abort-fel – beror på att komponenten avmonterades (game over/delete)
      if (err instanceof Error && err.name === 'AbortError') {
        isFetchingRef.current = false;
        return;
      }
      fetchRetryCountRef.current += 1;
      console.error(`useGenerateSongs: fetchBatch misslyckades (försök ${fetchRetryCountRef.current}):`, err);

      if (fetchRetryCountRef.current >= 3) {
        // Ge upp efter 3 försök – visa felmeddelande
        fetchRetryCountRef.current = 0;
        waitingForCardRef.current = false;
        pendingResetRef.current = null;
        setIsLoadingCard(false);
        setErrorMessage('Kunde inte hämta låtar. Kontrollera nätverket och försök igen.');
      } else {
        // Försök igen automatiskt – kortare väntan om spelaren väntar aktivt
        const retryDelay = waitingForCardRef.current ? 3000 : 8000;
        retryTimeoutRef.current = setTimeout(() => {
          isFetchingRef.current = false;
          fetchBatch();
        }, retryDelay);
        return; // skippa finally så isFetchingRef inte nollställs för tidigt
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [auth, gameMode]);

  // ─── Leverera kort när kön fylls och UI väntar ───────────────────────────────

  useEffect(() => {
    if (!waitingForCardRef.current || queue.length === 0) return;

    waitingForCardRef.current = false;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCard(next);
    setIsLoadingCard(false);

    // Kör ev. väntande reset-callback
    const reset = pendingResetRef.current;
    pendingResetRef.current = null;
    if (reset) reset();

    // Nu konsumerat – lägg till i seenSongs och markera på servern
    consumeCard(next);
    // Spara nya kö-toppen som nextCard för seamless resume
    persistNextCard(rest);

    if (rest.length <= REFILL_THRESHOLD && !isFetchingRef.current) {
      fetchBatch();
    }
  }, [queue, fetchBatch, consumeCard, persistNextCard]);

  // ─── Starta första batch efter hydrering (bara om kön är för liten) ──────────
  // queueRef.current sätts synkront i mount-effekten (innan setIsHydrating(false))
  // så dess värde är korrekt när denna effekt körs.
  useEffect(() => {
    if (!isHydrating) {
      console.log(`[useGenerateSongs] Hydrering klar – queueRef.current.length=${queueRef.current.length}, threshold=${REFILL_THRESHOLD}`);
      // Använd lägre tröskel vid hydrering för att undvika onödig batch när
      // Firestore-filtrering reducerat kön något men det fortfarande finns gott om kort.
      if (queueRef.current.length < REFILL_THRESHOLD - 2) {
        console.log('[useGenerateSongs] Triggar fetchBatch efter hydrering');
        fetchBatch();
      }
    }
  }, [isHydrating]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Public: hämta nästa kort ────────────────────────────────────────────────

  /**
   * generateCard
   * Tar nästa kort ur kön. Om kön är tom visas laddningsindikator tills
   * batchen returnerar. Triggar automatisk påfyllning när kön är låg.
   */
  const generateCard = useCallback((resetInputs?: () => void) => {
    // Ignorera om vi redan väntar (förhindrar dubbel-anrop)
    if (waitingForCardRef.current) return;

    setErrorMessage('');
    setCard(null);

    const currentQueue = queueRef.current;

    if (currentQueue.length > 0) {
      // ✅ Omedelbar leverans från kön
      const [next, ...rest] = currentQueue;
      setQueue(rest);
      setCard(next);
      if (resetInputs) resetInputs();

      // Nu konsumerat – lägg till i seenSongs och markera på servern
      consumeCard(next);
      // Spara nya kö-toppen som nextCard för seamless resume
      persistNextCard(rest);

      if (rest.length <= REFILL_THRESHOLD && !isFetchingRef.current) {
        fetchBatch();
      }
      return;
    }

    // ⏳ Kön tom – visa laddning och vänta på batch
    setIsLoadingCard(true);
    waitingForCardRef.current = true;
    pendingResetRef.current = resetInputs ?? null;

    if (!isFetchingRef.current) {
      fetchBatch();
    }
  }, [fetchBatch, consumeCard, persistNextCard]);

  return {
    card,
    setCard,
    isLoadingCard,
    errorMessage,
    isHydrating,
    generateCard,
    clearPersistedQueue,
  };
};

