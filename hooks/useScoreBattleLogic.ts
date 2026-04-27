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
  const numPlayers = playerNames.length;

  const [scores, setScores]         = useState<number[]>(() => Array(numPlayers).fill(0));
  const [stars, setStars]           = useState<number[]>(() => Array(numPlayers).fill(1));
  const [phase, setPhase]           = useState<BattlePhase>('guessing');
  const [roundResults, setRoundResults] = useState<(RoundResult | null)[]>(() => Array(numPlayers).fill(null));
  const [songCount, setSongCount]   = useState(0);
  const [winnerIdx, setWinnerIdx]   = useState<number | null>(null);
  const [pendingGameOver, setPendingGameOver] = useState(false);

  const scoresRef    = useRef<number[]>(Array(numPlayers).fill(0));
  const songCountRef = useRef(0);

  // ─── Intern ───────────────────────────────────────────────────────────────

  const commitRound = useCallback(
    (results: RoundResult[]) => {
      // Floor each score at 0 — no negative totals
      const newScores = scoresRef.current.map(
        (s, i) => Math.max(0, s + (results[i]?.points ?? 0))
      );
      scoresRef.current = newScores;
      setScores(newScores);
      setRoundResults(results);

      setStars(prev => prev.map((s, i) => results[i]?.points === 10 ? s + 1 : s));

      const roundsPlayed = songCountRef.current + 1;
      const reachedScoreTarget = newScores.some(s => s >= targetScore);
      const reachedRoundLimit  = maxRounds !== null && roundsPlayed >= maxRounds;

      if (reachedScoreTarget || reachedRoundLimit) {
        const maxScore = Math.max(...newScores);
        setWinnerIdx(newScores.indexOf(maxScore));
        // Show summary of the final round before going to game_over
        setPendingGameOver(true);
        setPhase('song_summary');
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
      const results: RoundResult[] = Array.from({ length: numPlayers }, (_, i) => {
        const g = guesses[i];
        if (!g || g.skipped) return { guessYear: 0, points: 0, skipped: true };
        return { guessYear: g.guessYear, points: calcPoints(g.guessYear, actualYear), skipped: false };
      });
      commitRound(results);
    },
    [numPlayers, commitRound]
  );

  const nextSong = useCallback(() => {
    if (pendingGameOver) {
      setPendingGameOver(false);
      setPhase('game_over');
      return;
    }
    setRoundResults(Array(numPlayers).fill(null));
    songCountRef.current += 1;
    setSongCount(songCountRef.current);
    setPhase('guessing');
  }, [numPlayers, pendingGameOver]);

  const resetGame = useCallback(() => {
    scoresRef.current = Array(numPlayers).fill(0);
    songCountRef.current = 0;
    setScores(Array(numPlayers).fill(0));
    setStars(Array(numPlayers).fill(1));
    setRoundResults(Array(numPlayers).fill(null));
    setSongCount(0);
    setWinnerIdx(null);
    setPendingGameOver(false);
    setPhase('guessing');
  }, [numPlayers]);

  /** Återställ från persisted snapshot */
  const _restore = useCallback((snap: {
    scores: number[];
    stars: number[];
    songCount: number;
    phase?: BattlePhase;
    roundResults?: (RoundResult | null)[];
  }) => {
    scoresRef.current = snap.scores;
    songCountRef.current = snap.songCount;
    setScores(snap.scores);
    setStars(snap.stars);
    setSongCount(snap.songCount);
    setRoundResults(snap.roundResults ?? Array(snap.scores.length).fill(null));
    setWinnerIdx(null);
    setPendingGameOver(false);
    setPhase(snap.phase ?? 'guessing');
  }, []);

  return {
    scores, stars, phase,
    soloMode, numPlayers,
    roundResults, songCount, winnerIdx,
    pendingGameOver,
    playerNames,
    confirmGuesses,
    nextSong, resetGame,
    _restore,
  };
}
