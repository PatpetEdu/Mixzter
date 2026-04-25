// hooks/useScoreBattleLogic.ts
//
// Spellogik för Score Battle – Alt C: blind simultaneous guessing.
// P1 gissar → täck skärm → ge till P2 → P2 gissar → avslöja båda → nästa låt.
// Bägge gissar på SAMMA låt. Ingen ser den andres gissning.
// Poäng: +5/+3/+2/+1 nära, -3/-5/-10 långt ifrån.

import { useState, useRef, useCallback } from 'react';

// ─── Typer ───────────────────────────────────────────────────────────────────

export type BattlePhase =
  | 'p1_guessing'   // P1 skriver in sitt år
  | 'pass_to_p2'    // Täck skärm – ge telefonen till P2
  | 'p2_guessing'   // P2 skriver in sitt år
  | 'song_summary'  // Avslöja båda gissningar + rätt år
  | 'game_over';

export interface RoundResult {
  guessYear: number;
  points: number;
  skipped: boolean;
}

// ─── Poängsystem ─────────────────────────────────────────────────────────────

export function calcPoints(guessYear: number, actualYear: number): number {
  const diff = Math.abs(guessYear - actualYear);
  if (diff === 0)  return  5;   // 🎯 Exakt
  if (diff <= 3)   return  3;   // 🔥 Mycket nära
  if (diff <= 7)   return  2;   // 👍 Nära
  if (diff <= 10)  return  0;   // 😬 Okej men inga poäng
  if (diff < 15)   return -3;   // 📉 Långt ifrån
  if (diff < 20)   return -5;   // 💀 Riktigt fel
  return -10;                    // ☠️ Katastrofalt
}

export function pointsLabel(points: number, skipped = false): string {
  if (skipped) return '⏭ Skippad';
  switch (points) {
    case  5:  return '🎯 Exakt!';
    case  3:  return '🔥 Mycket nära!';
    case  2:  return '👍 Nära!';
    case  0:  return '😬 Okej – 0p';
    case -3:  return '📉 Långt ifrån';
    case -5:  return '💀 Riktigt fel';
    case -10: return '☠️ Katastrofalt';
    default:  return `${points > 0 ? '+' : ''}${points}p`;
  }
}

export function pointsColor(points: number, skipped = false): string {
  if (skipped)    return '#6b7280';
  if (points >= 3) return '#10b981';
  if (points >= 1) return '#60a5fa';
  if (points === 0) return '#6b7280';
  return '#ef4444';
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useScoreBattleLogic(
  playerNames: string[],
  targetScore: number,
  maxRounds: number | null = null,
) {
  const soloMode = playerNames.length === 1;
  const [scores, setScores]                 = useState<[number, number]>([0, 0]);
  const [stars, setStars]                   = useState<[number, number]>([1, 1]);
  const [phase, setPhase]                   = useState<BattlePhase>('p1_guessing');
  const [firstPlayerIdx, setFirstPlayerIdx] = useState<0 | 1>(0);
  const [roundResults, setRoundResults]     = useState<[RoundResult | null, RoundResult | null]>([null, null]);
  const [songCount, setSongCount]           = useState(0);
  const [winnerIdx, setWinnerIdx]           = useState<number | null>(null);

  const scoresRef    = useRef<[number, number]>([0, 0]);
  const p1ResultRef  = useRef<RoundResult | null>(null);
  const songCountRef = useRef(0);

  // I solo-läge är p1Idx alltid 0 och p2 existerar ej
  const p1Idx: 0 | 1 = soloMode ? 0 : firstPlayerIdx;
  const p2Idx: 0 | 1 = soloMode ? 0 : (firstPlayerIdx === 0 ? 1 : 0);

  // ─── Intern ───────────────────────────────────────────────────────────────

  const commitRound = useCallback(
    (p2Result: RoundResult) => {
      const p1Result = p1ResultRef.current!;

      const newScores: [number, number] = [
        scoresRef.current[0] + (p1Idx === 0 ? p1Result.points : p2Result.points),
        scoresRef.current[1] + (p1Idx === 1 ? p1Result.points : p2Result.points),
      ];
      scoresRef.current = newScores;
      setScores(newScores);
      setRoundResults([p1Result, p2Result]);

      setStars(prev => {
        const next = [...prev] as [number, number];
        if (p1Result.points === 5) next[p1Idx] += 1;
        if (p2Result.points === 5) next[p2Idx] += 1;
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
    [p1Idx, p2Idx, targetScore, maxRounds]
  );

  // ─── API ─────────────────────────────────────────────────────────────────

  const confirmP1 = useCallback(
    (guessYear: number, actualYear: number): number => {
      const points = calcPoints(guessYear, actualYear);
      const result: RoundResult = { guessYear, points, skipped: false };
      p1ResultRef.current = result;
      if (soloMode) {
        // Solo: gå direkt till song_summary med bara P1
        commitRound({ guessYear: 0, points: 0, skipped: true });
      } else {
        setPhase('pass_to_p2');
      }
      return points;
    },
    [soloMode, commitRound]
  );

  const skipP1 = useCallback((): boolean => {
    if (stars[p1Idx] <= 0) return false;
    setStars(prev => { const n = [...prev] as [number,number]; n[p1Idx] -= 1; return n; });
    p1ResultRef.current = { guessYear: 0, points: 0, skipped: true };
    if (soloMode) {
      commitRound({ guessYear: 0, points: 0, skipped: true });
    } else {
      setPhase('pass_to_p2');
    }
    return true;
  }, [p1Idx, stars, soloMode, commitRound]);

  const proceedToP2 = useCallback(() => setPhase('p2_guessing'), []);

  const confirmP2 = useCallback(
    (guessYear: number, actualYear: number): number => {
      const points = calcPoints(guessYear, actualYear);
      commitRound({ guessYear, points, skipped: false });
      return points;
    },
    [commitRound]
  );

  const skipP2 = useCallback((): boolean => {
    if (stars[p2Idx] <= 0) return false;
    setStars(prev => { const n = [...prev] as [number,number]; n[p2Idx] -= 1; return n; });
    commitRound({ guessYear: 0, points: 0, skipped: true });
    return true;
  }, [p2Idx, stars, commitRound]);

  const nextSong = useCallback(() => {
    setFirstPlayerIdx(prev => (prev === 0 ? 1 : 0) as 0 | 1);
    p1ResultRef.current = null;
    setRoundResults([null, null]);
    songCountRef.current += 1;
    setSongCount(songCountRef.current);
    setPhase('p1_guessing');
  }, []);

  const resetGame = useCallback(() => {
    scoresRef.current = [0, 0];
    songCountRef.current = 0;
    setScores([0, 0]);
    setStars([1, 1]);
    setFirstPlayerIdx(0);
    p1ResultRef.current = null;
    setRoundResults([null, null]);
    setSongCount(0);
    setWinnerIdx(null);
    setPhase('p1_guessing');
  }, []);

  /** Återställ från persisted snapshot (scores/stars/songCount/firstPlayerIdx) */
  const _restore = useCallback((snap: {
    scores: [number, number];
    stars: [number, number];
    songCount: number;
    firstPlayerIdx: 0 | 1;
  }) => {
    scoresRef.current = snap.scores;
    songCountRef.current = snap.songCount;
    setScores(snap.scores);
    setStars(snap.stars);
    setSongCount(snap.songCount);
    setFirstPlayerIdx(snap.firstPlayerIdx);
    p1ResultRef.current = null;
    setRoundResults([null, null]);
    setWinnerIdx(null);
    setPhase('p1_guessing');
  }, []);

  return {
    scores, stars, phase,
    p1Idx, p2Idx,
    soloMode,
    roundResults, songCount, winnerIdx,
    playerNames,
    confirmP1, skipP1, proceedToP2,
    confirmP2, skipP2,
    nextSong, resetGame,
    _restore,
  };
}
