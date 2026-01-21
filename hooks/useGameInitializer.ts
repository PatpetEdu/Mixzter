import { useEffect, useRef } from 'react';
import { doc, setDoc, serverTimestamp, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useGameCode } from './useGameCode';
import { generatePublicToken } from '../utils/generateToken';

interface UseGameInitializerProps {
  gameId: string | null;
  hostUid: string | null;
  gameMode: string;
  playerNames: string[];
  onGameCodeReady: (code: string, token: string) => void;
}

export function useGameInitializer({
  gameId,
  hostUid,
  gameMode,
  playerNames,
  onGameCodeReady,
}: UseGameInitializerProps) {
  const initializeRef = useRef(false);
  const { generateCode } = useGameCode();

  useEffect(() => {
    if (!gameId || !hostUid || initializeRef.current) return;

    initializeRef.current = true;

    const initializeGame = async () => {
      try {
        const gameCode = generateCode();
        const publicToken = await generatePublicToken();

        // Skapa game-dokumentet
        await setDoc(doc(db, 'games', gameId), {
          hostUid,
          gameCode,
          publicToken,
          gameMode,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          spectatorCount: 0,
          players: {},
          currentCard: null,
          gameState: {
            activePlayer: playerNames[0] || '',
            backCardUnlocked: false,
            wasCorrect: false,
          },
        });

        onGameCodeReady(gameCode, publicToken);

        // Lyssna på spectator-räknaren
        const spectatorsRef = collection(db, 'games', gameId, 'spectators');
        const unsubscribe = onSnapshot(
          spectatorsRef,
          (snapshot) => {
            // Update spectator count automatically
          },
          (err: any) => {
            // Silently ignore errors - spectators may be deleted
            // Just continue without spectator count
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error('Error initializing game:', error);
      }
    };

    initializeGame();
  }, [gameId, hostUid, gameMode, playerNames, onGameCodeReady, generateCode]);
}
