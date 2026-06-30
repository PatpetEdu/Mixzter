// hooks/useScoreBattleSync.ts
//
// Synkar ScoreBattle-spelstate till Firestore (scoreBattleRooms/{gameId})
// och lyssnar på gissningar som skickats in via webbläsaren.

import { useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { BattlePhase, RoundResult } from './useScoreBattleLogic';

// ─── Typer ───────────────────────────────────────────────────────────────────

type SyncCard = {
  title: string;
  artist: string;
  year: number;
  previewData?: {
    previewUrl?: string;
    artworkUrl?: string;
  };
};

export interface SongHistoryEntry {
  artist: string;
  title: string;
  year: number;
  results: (RoundResult | null)[];
}

export interface WebGuess {
  year: number;
  locked: boolean;
}

interface UseScoreBattleSyncProps {
  gameId: string | null;
  hostUid: string | null;
  gameMode: string;
  phase: BattlePhase;
  playerNames: string[];
  scores: number[];
  stars: number[];
  songCount: number;
  targetScore: number;
  card: SyncCard | null;
  roundResults: (RoundResult | null)[];
  /** Spelarnas aktuella gissningar (appen som master) */
  guesses: string[];
  /** Spelarnas låsstatus (appen som master) */
  locked: boolean[];
  /** Spelhistorik – en post per avslutad omgång */
  songHistory: SongHistoryEntry[];
  /** Anropas när en webbspelare uppdaterar sin gissning */
  onWebGuess: (playerIndex: number, year: number, locked: boolean) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useScoreBattleSync({
  gameId,
  hostUid,
  gameMode,
  phase,
  playerNames,
  scores,
  stars,
  songCount,
  targetScore,
  card,
  roundResults,
  guesses,
  locked,
  songHistory,
  onWebGuess,
}: UseScoreBattleSyncProps) {
  const initDoneRef       = useRef(false);
  const syncTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWebGuessesRef = useRef<Record<string, WebGuess>>({});
  // Håll onWebGuess aktuell utan att omregistrera snapshot-lyssnaren
  const onWebGuessRef = useRef(onWebGuess);
  useEffect(() => { onWebGuessRef.current = onWebGuess; }, [onWebGuess]);

  // ── Initialisera rummet första gången ────────────────────────────────────
  useEffect(() => {
    if (!gameId || !hostUid || initDoneRef.current) return;
    initDoneRef.current = true;

    setDoc(doc(db, 'scoreBattleRooms', gameId), {
      hostUid,
      gameMode,
      phase: 'guessing',
      playerNames,
      scores,
      stars,
      songCount,
      targetScore,
      card: null,
      roundResults: null,
      webGuesses: {},
      updatedAt: Date.now(),
    }, { merge: false }).catch(console.error);
  }, [gameId, hostUid, gameMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Synka spelstate (debounced 600 ms) ───────────────────────────────────
  useEffect(() => {
    if (!gameId || !hostUid || !initDoneRef.current) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const cardData = card
          ? {
              artist: card.artist,
              title: card.title,
              year: card.year,
              ...(card.previewData?.artworkUrl && { artworkUrl: card.previewData.artworkUrl }),
              ...(card.previewData?.previewUrl  && { previewUrl: card.previewData.previewUrl }),
            }
          : null;

        await updateDoc(doc(db, 'scoreBattleRooms', gameId), {
          gameMode,
          phase,
          scores,
          stars,
          songCount,
          targetScore,
          card: cardData,
          roundResults: phase === 'song_summary' ? roundResults : null,
          ...(phase === 'game_over' && { songHistory }),
          updatedAt: Date.now(),
        });
      } catch {
        // Ignorera – rummet kanske inte initierats ännu
      }
    }, 600);

    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [gameId, hostUid, gameMode, phase, scores, stars, songCount, card, roundResults]);

  // ── Skriv tillbaka appens guesses/locked till webGuesses (App→Webb) ──────
  // Körs när appen ändrar locked/guesses lokalt (t.ex. host-toggle).
  // Loop-skydd: lastWebGuessesRef uppdateras direkt – om ändringen kom FRÅN
  // webben har ref redan rätt värde → inget updateDoc skickas → ingen loop.
  useEffect(() => {
    if (!gameId || !hostUid || !initDoneRef.current) return;
    if (phase !== 'guessing') return;

    const updates: Record<string, { year: number; locked: boolean }> = {};

    guesses.forEach((g, i) => {
      const yearNum = parseInt(g, 10);
      if (isNaN(yearNum)) return;
      const newLocked = locked[i] ?? false;
      const prev = lastWebGuessesRef.current[String(i)];
      if (!prev || prev.year !== yearNum || prev.locked !== newLocked) {
        updates[`webGuesses.${i}`] = { year: yearNum, locked: newLocked };
        lastWebGuessesRef.current[String(i)] = { year: yearNum, locked: newLocked };
      }
    });

    if (Object.keys(updates).length === 0) return;
    updateDoc(doc(db, 'scoreBattleRooms', gameId), updates).catch(console.error);
  }, [gameId, hostUid, phase, guesses, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lyssna på webbgissningar ─────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'scoreBattleRooms', gameId),
      (snap) => {
        if (!snap.exists()) return;
        const webGuesses: Record<string, WebGuess> = snap.data().webGuesses ?? {};

        Object.entries(webGuesses).forEach(([idxStr, g]) => {
          const idx = parseInt(idxStr, 10);
          if (isNaN(idx) || typeof g?.year !== 'number') return;

          const prev = lastWebGuessesRef.current[idxStr];
          if (!prev || prev.year !== g.year || prev.locked !== g.locked) {
            lastWebGuessesRef.current[idxStr] = { year: g.year, locked: g.locked };
            onWebGuessRef.current(idx, g.year, g.locked === true);
          }
        });
      },
      (err) => console.error('ScoreBattleSync listener error:', err),
    );

    return unsubscribe;
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rensa webbgissningar inför ny runda ──────────────────────────────────
  const clearWebGuesses = useCallback(async () => {
    if (!gameId) return;
    lastWebGuessesRef.current = {};
    try {
      await updateDoc(doc(db, 'scoreBattleRooms', gameId), { webGuesses: {} });
    } catch {}
  }, [gameId]);

  // ── Radera rummet explicit (anropas när värden lämnar spelet) ─────────────
  const deleteRoom = useCallback(async () => {
    if (!gameId) return;
    try {
      await deleteDoc(doc(db, 'scoreBattleRooms', gameId));
    } catch {}
  }, [gameId]);

  const webUrl = gameId
    ? `https://musikquiz-app.web.app/?mode=scorebattle&gameId=${gameId}`
    : null;

  return { webUrl, clearWebGuesses, deleteRoom };
}
