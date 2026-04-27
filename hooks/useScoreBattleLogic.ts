// hooks/useScoreBattleLogic.ts
//
// Spellogik för Score Battle – simultaneous guessing.
// Alla spelare gissar på SAMMA låt på en gång.
// Poäng: nytt system med 10p exakt ner till -15p för >20 år ifrån.

import { useState, useRef, useCallback } from 'react';

// ─── Typer ───────────────────────────────────────────────────────────────────

export type BattlePhase =
  | 'guessing'      // Alla spelare skriver in sin gissning
  | 'song_summary'  // Avslöja alla gissningar + rätt år
  | 'game_over';

export interface RoundResult {
  guessYear: number;
  points: number;
  skipped: boolean;
}

// ─── Poängsystem ─────────────────────────────────────────────────────────────

export function calcPoints(guessYear: number, actualYear: number): number {
  const diff = Math.abs(guessYear - actualYear);
  if (diff === 0)  return  10;
  if (diff === 1)  return   6;
  if (diff === 2)  return   5;
  if (diff === 3)  return   4;
  if (diff === 4)  return   3;
  if (diff === 5)  return   2;
  if (diff <= 9)   return   1;
  if (diff === 10) return   0;
  if (diff === 11) return  -1;
  if (diff === 12) return  -2;
  if (diff === 13) return  -3;
  if (diff === 14) return  -4;
  if (diff === 15) return  -5;
  if (diff <= 20)  return -10;
  return -15;
}

export function pointsLabel(points: number, skipped = false): string {
  if (skipped) return '⏭ Skippad';
  if (points === 10) return '🎯 Exakt!';
  if (points === 6)  return '🔥 1 år fel';
  if (points === 5)  return '🔥 2 år fel';
  if (points === 4)  return '👍 3 år fel';
  if (points === 3)  return '👍 4 år fel';
  if (points === 2)  return '👍 5 år fel';
  if (points === 1)  return '🎵 Nästan';
  if (points === 0)  return '😬 10 år fel';
  if (points === -1) return '📉 11 år fel';
  if (points === -2) return '📉 12 år fel';
  if (points === -3) return '📉 13 år fel';
  if (points === -4) return '📉 14 år fel';
  if (points === -5) return '💀 15 år fel';
  if (points === -10) return '💀 Långt ifrån';
  if (points === -15) return '☠️ Katastrofalt';
  return `${points > 0 ? '+' : ''}${points}p`;
}

export function pointsColor(points: number, skipped = false): string {
  if (skipped)      return '#6b7280';
  if (points >= 6)  return '#10b981';
  if (points >= 2)  return '#60a5fa';
  if (points >= 0)  return '#6b7280';
  return '#ef4444';
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useScoreBattleLogic(
  playerNames: string[],
  targetScore: number,
  maxRounds: number | null = null,
) {
  const soloMode = playerNames.length === 1;
  const numPlayers = soloMode ? 1 : 2;

  const [scores, setScores]         = useState<[number, number]>([0, 0]);
  const [stars, setStars]           = useState<[number, number]>([1, 1]);
  const [phase, setPhase]           = useState<BattlePhase>('guessing');
  const [roundResults, setRoundResults] = useState<[RoundResult | null, RoundResult | null]>([null, null]);
  const [songCount, setSongCount]   = useState(0);
  const [winnerIdx, setWinnerIdx]   = useState<number | null>(null);

  const scoresRef    = useRef<[number, number]>([0, 0]);
  const songCountRef = useRef(0);

  // ─── Intern ───────────────────────────────────────────────────────────────

  const commitRound = useCallback(
    (results: [RoundResult, RoundResult]) => {
      const newScores: [number, number] = [
        scoresRef.current[0] + results[0].points,
        scoresRef.current[1] + results[1].points,
      ];
      scoresRef.current = newScores;
      setScores(newScores);
      setRoundResults(results);

      setStars(prev => {
        const next = [...prev] as [number, number];
        if (results[0].points === 10) next[0] += 1;
        if (results[1].points === 10) next[1] += 1;
        return next;
      });

      const [s0, s1] = newScores;
      const roundsPlayed = songCountRef.current + 1;
      const reachedScoreTarget = s0 >= targetScore || s1 >= targetScore;
      const reachedRoundLimit  = maxRounds !== null && roundsPlayed >= maxRounds;

      if (reachedScoreTarget || reachedRoundLimit) {
        setWinnerIdx(s0 >= s1 ? 0 : 1);
        setPhase('game_over');
      } else {
        setPhase('song_summary');
      }
    },
    [targetScore, maxRounds]
  );

  // ─── API ─────────────────────────────────────────────────────────────────

  /** Bekräfta alla spelares gissningar på en gång */
  const confirmGuesses = useCallback(
    (guesses: Array<{ guessYear: number; skipped: boolean }>, actualYear: number) => {
      const r0: RoundResult = guesses[0].skipped
        ? { guessYear: 0, points: 0, skipped: true }
        : { guessYear: guesses[0].guessYear, points: calcPoints(guesses[0].guessYear, actualYear), skipped: false };
      const r1: RoundResult = soloMode
        ? { guessYear: 0, points: 0, skipped: true }
        : guesses[1]?.skipped
          ? { guessYear: 0, points: 0, skipped: true }
          : { guessYear: guesses[1].guessYear, points: calcPoints(guesses[1].guessYear, actualYear), skipped: false };
      commitRound([r0, r1]);
    },
    [soloMode, commitRound]
  );

  const nextSong = useCallback(() => {
    setRoundResults([null, null]);
    songCountRef.current += 1;
    setSongCount(songCountRef.current);
    setPhase('guessing');
  }, []);

  const resetGame = useCallback(() => {
    scoresRef.current = [0, 0];
    songCountRef.current = 0;
    setScores([0, 0]);
    setStars([1, 1]);
    setRoundResults([null, null]);
    setSongCount(0);
    setWinnerIdx(null);
    setPhase('guessing');
  }, []);

  /** Återställ från persisted snapshot */
  const _restore = useCallback((snap: {
    scores: [number, number];
    stars: [number, number];
    songCount: number;
    phase?: BattlePhase;
    roundResults?: [RoundResult | null, RoundResult | null];
  }) => {
    scoresRef.current = snap.scores;
    songCountRef.current = snap.songCount;
    setScores(snap.scores);
    setStars(snap.stars);
    setSongCount(snap.songCount);
    setRoundResults(snap.roundResults ?? [null, null]);
    setWinnerIdx(null);
    setPhase(snap.phase ?? 'guessing');
  }, []);

  return {
    scores, stars, phase,
    soloMode, numPlayers,
    roundResults, songCount, winnerIdx,
    playerNames,
    confirmGuesses,
    nextSong, resetGame,
    _restore,
  };
}
