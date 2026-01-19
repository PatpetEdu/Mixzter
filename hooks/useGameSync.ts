import { useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

type Player = { name: string; timeline: number[]; cards: Card[]; startYear: number; stars: number };

interface UseGameSyncProps {
  gameId: string | null;
  players: { [key: string]: Player };
  activePlayer: string;
  roundCards: Card[];
  currentCard: Card | null;
  backCardUnlocked: boolean;
  wasCorrect: boolean;
  playerNames: string[];
}

export function useGameSync({
  gameId,
  players,
  activePlayer,
  roundCards,
  currentCard,
  backCardUnlocked,
  wasCorrect,
  playerNames,
}: UseGameSyncProps) {
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!gameId) return;

    // Debounce synk till 1 sekund
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        // Mappa spelar-data för Firestore (bara vad spectators behöver)
        const playersForSync: { [key: string]: { timeline: number[]; stars: number; startYear: number; cards: Array<{ year: number; title: string; artist: string }> } } = {};
        
        for (const playerName of playerNames) {
          const player = players[playerName];
          if (player) {
            playersForSync[playerName] = {
              timeline: player.timeline,
              stars: player.stars,
              startYear: player.startYear,
              cards: player.cards.map(c => ({ year: c.year, title: c.title, artist: c.artist })),
            };
          }
        }

        // Synka till Firestore - filtrera undefined values
        const cleanCurrentCard = currentCard
          ? {
              artist: currentCard.artist,
              title: currentCard.title,
              year: currentCard.year,
              ...(currentCard.source !== undefined && { source: currentCard.source }),
            }
          : null;

        await updateDoc(doc(db, 'games', gameId), {
          players: playersForSync,
          currentCard: cleanCurrentCard,
          roundCards: roundCards.map(c => ({ year: c.year, title: c.title, artist: c.artist })),
          gameState: {
            activePlayer,
            backCardUnlocked,
            wasCorrect,
          },
          updatedAt: serverTimestamp(),
        });

        lastSyncRef.current = Date.now();
      } catch (error) {
        console.error('Error syncing game state:', error);
      }
    }, 1000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [gameId, players, activePlayer, currentCard, backCardUnlocked, wasCorrect, playerNames]);
}
