// web/src/ScoreBattleView.tsx
//
// Webbvy för Score Battle – spelarna scannar QR och gissar via sin telefon.
// Skriver webGuesses till Firestore; appen läser och låser spelarens kort.

import { useCallback, useEffect, useState, useRef } from 'react';
import { doc, getDoc, getDocFromServer, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import './ScoreBattleView.css';

// ─── Typer ───────────────────────────────────────────────────────────────────

interface RoomCard {
  artist: string;
  title: string;
  year: number;
  artworkUrl?: string;
  previewUrl?: string;
}

interface RoundResult {
  guessYear: number;
  points: number;
  skipped: boolean;
}

interface SongHistoryEntry {
  artist: string;
  title: string;
  year: number;
  results: (RoundResult | null)[];
}

interface ScoreBattleRoom {
  hostUid: string;
  gameMode?: string;
  phase: 'guessing' | 'song_summary' | 'game_over';
  playerNames: string[];
  scores: number[];
  stars: number[];
  songCount: number;
  targetScore: number;
  card: RoomCard | null;
  roundResults: (RoundResult | null)[] | null;
  webGuesses: Record<string, { year: number; locked: boolean }>;
  songHistory?: SongHistoryEntry[];
}

// ─── Hjälpfunktioner ─────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

const GAME_MODE_LABELS: Record<string, string> = {
  default: `Blandat 1950-${currentYear}`,
  svenska: `Svenska Hits 1960-${currentYear}`,
  eurovision: `Eurovision 1956-${currentYear}`,
  rock: `Rock/Metal 1960-${currentYear}`,
  onehitwonder: 'One Hit Wonders 1970-2015',
  filmmusik: `Film & TV Musik 1950-${currentYear}`,
  disney: `Disney & Animerat 1937-${currentYear}`,
  melodifestivalen: `Melodifestivalen 1958-${currentYear}`,
  kpop: `K-POP 2000-${currentYear}`,
  eightiesnineties: '80s & 90s Hits 1980-1999',
  modernahits: `Moderna Hits 2005-${currentYear}`,
  sommarhits: `Sommarhits 1960-${currentYear}`,
  dance: `Dance & EDM 1970-${currentYear}`,
  julmusik: `Julmusik 1940-${currentYear}`,
  country: `Country 1950-${currentYear}`,
  partylatar: `Partylatar 1960-${currentYear}`,
  sportlatar: `Sportlatar 1970-${currentYear}`,
  nordisk: `Skandinaviska Hits 1960-${currentYear}`,
};

function splitGameModeName(fullName: string): { name: string; years: string } {
  const match = fullName.match(/^(.*?)\s+(\d{4}(?:-\d{4})?)$/);
  if (match) {
    return { name: match[1], years: match[2] };
  }
  return { name: fullName, years: '' };
}

function isValidYear(s: string): boolean {
  if (!/^[0-9]{4}$/.test(s)) return false;
  const y = parseInt(s, 10);
  return y >= 1900 && y <= currentYear;
}

function pointsLabel(pts: number, skipped = false): string {
  if (skipped)     return '⏭ Skippad';
  if (pts === 8)   return '🎯 Exakt!';
  if (pts === 6)   return '🔥 1 år fel';
  if (pts === 5)   return '🔥 2 år fel';
  if (pts === 4)   return '👍 3 år fel';
  if (pts === 3)   return '👍 4 år fel';
  if (pts === 2)   return '👍 5 år fel';
  if (pts === 1)   return '🎵 Nästan';
  if (pts === 0)   return '😬 10 år fel';
  if (pts < 0)     return '📉 Långt ifrån';
  return `${pts > 0 ? '+' : ''}${pts}p`;
}

function pointsColor(pts: number, skipped = false): string {
  if (skipped) return '#475569';
  if (pts >= 6)  return '#10b981';
  if (pts >= 3)  return '#f59e0b';
  if (pts >= 1)  return '#818cf8';
  if (pts === 0) return '#f59e0b';
  return '#ef4444';
}

function resolveWinningPlayerIndices(scores: number[], stars: number[]): number[] {
  if (scores.length === 0) return [];
  const maxScore = Math.max(...scores);
  const scoreLeaders = scores
    .map((score, idx) => ({ score, idx }))
    .filter(entry => entry.score === maxScore)
    .map(entry => entry.idx);

  if (scoreLeaders.length <= 1) return scoreLeaders;

  const maxStars = Math.max(...scoreLeaders.map(idx => stars[idx] ?? 0));
  return scoreLeaders.filter(idx => (stars[idx] ?? 0) === maxStars);
}

// ─── Spelarpaletten (identisk med appen) ─────────────────────────────────────

const PLAYER_COLORS = [
  { border: '#3730a3', fill: '#4f46e5', fillDim: '#312e81', locked: '#6366f1',
    nameLocked: '#a5b4fc', badgeBg: 'rgba(99,102,241,0.15)', badgeText: '#818cf8',
    inputBorder: '#4f46e5', inputColor: '#818cf8', inputBg: 'rgba(79,70,229,0.08)',
    btnBg: 'rgba(79,70,229,0.1)', btnBorder: 'rgba(79,70,229,0.4)' },
  { border: '#065f46', fill: '#10b981', fillDim: '#064e3b', locked: '#34d399',
    nameLocked: '#6ee7b7', badgeBg: 'rgba(16,185,129,0.15)', badgeText: '#34d399',
    inputBorder: '#10b981', inputColor: '#34d399', inputBg: 'rgba(16,185,129,0.08)',
    btnBg: 'rgba(16,185,129,0.1)', btnBorder: 'rgba(16,185,129,0.4)' },
  { border: '#92400e', fill: '#f59e0b', fillDim: '#78350f', locked: '#fbbf24',
    nameLocked: '#fcd34d', badgeBg: 'rgba(245,158,11,0.15)', badgeText: '#fbbf24',
    inputBorder: '#f59e0b', inputColor: '#fbbf24', inputBg: 'rgba(245,158,11,0.08)',
    btnBg: 'rgba(245,158,11,0.1)', btnBorder: 'rgba(245,158,11,0.4)' },
  { border: '#9f1239', fill: '#f43f5e', fillDim: '#881337', locked: '#fb7185',
    nameLocked: '#fda4af', badgeBg: 'rgba(244,63,94,0.15)', badgeText: '#fb7185',
    inputBorder: '#f43f5e', inputColor: '#fb7185', inputBg: 'rgba(244,63,94,0.08)',
    btnBg: 'rgba(244,63,94,0.1)', btnBorder: 'rgba(244,63,94,0.4)' },
  { border: '#164e63', fill: '#06b6d4', fillDim: '#0e7490', locked: '#22d3ee',
    nameLocked: '#67e8f9', badgeBg: 'rgba(6,182,212,0.15)', badgeText: '#22d3ee',
    inputBorder: '#06b6d4', inputColor: '#22d3ee', inputBg: 'rgba(6,182,212,0.08)',
    btnBg: 'rgba(6,182,212,0.1)', btnBorder: 'rgba(6,182,212,0.4)' },
] as const;

// ─── ScoreBanner ──────────────────────────────────────────────────────────────

function ScoreBanner({
  name,
  rank,
  score,
  targetScore,
  stars,
  roundDeltaPoints,
  isLocked,
  isGuessingPhase,
  isSummaryPhase,
  playerIndex,
  isMe,
  animationDelayMs,
}: {
  name: string;
  rank: number;
  score: number;
  targetScore: number;
  stars: number;
  roundDeltaPoints: number | null;
  isLocked: boolean;
  isGuessingPhase: boolean;
  isSummaryPhase: boolean;
  playerIndex: number;
  isMe: boolean;
  animationDelayMs?: number;
}) {
  const c = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
  const pct = Math.max(0, Math.min(score / targetScore, 1));
  const lockLabel = isLocked ? 'KLAR' : 'GISSAR';
  const starIndicator = stars <= 0 ? null : (stars === 1 ? '✦' : `✦ ${stars}`);
  const [scoreBump, setScoreBump] = useState(false);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (prevScoreRef.current !== score) {
      setScoreBump(true);
      prevScoreRef.current = score;
      const t = window.setTimeout(() => setScoreBump(false), 460);
      return () => window.clearTimeout(t);
    }
    return;
  }, [score]);

  return (
    <div
      className={`sb-banner-item sb-banner-animate${isMe ? ' sb-banner-me' : ''}${scoreBump ? ' sb-banner-scored' : ''}`}
      style={{
        borderColor: isLocked ? c.locked : c.border,
        backgroundColor: isLocked ? '#0d0d1a' : '#0f0f17',
        animationDelay: `${animationDelayMs ?? 0}ms`,
      }}
    >
      <span className="sb-banner-rank">#{rank}</span>
      <span className="sb-banner-dot" style={{ backgroundColor: c.fill }} />
      {isLocked && (
        <div className="sb-banner-locked-line" style={{ backgroundColor: c.locked }} />
      )}
      <div className="sb-banner-main">
        <div className="sb-banner-header">
          <span
            className="sb-banner-name"
            style={isLocked ? { color: c.nameLocked } : undefined}
          >
            {name}
          </span>
          {isMe ? <span className="sb-host-badge">DU</span> : null}
        </div>
        <span className="sb-banner-stars">
          {starIndicator ? <span className="sb-star-count">{starIndicator}</span> : null}
        </span>
      </div>

      <div className="sb-banner-right">
        <span className={`sb-banner-score${scoreBump ? ' sb-banner-score-pop' : ''}`}>
          {score}
          <span className="sb-score-target">/{targetScore}</span>
        </span>
        {isGuessingPhase && (
          <span className="sb-banner-lock" style={isLocked ? { color: c.badgeText } : undefined}>
            {lockLabel}
          </span>
        )}
        {isSummaryPhase && roundDeltaPoints !== null && (
          <span
            className={`sb-round-delta${roundDeltaPoints > 0 ? ' pos' : roundDeltaPoints < 0 ? ' neg' : ''}`}
          >
            {`${roundDeltaPoints > 0 ? '+' : ''}${roundDeltaPoints}`}
          </span>
        )}
      </div>

      <div className={`sb-track sb-banner-track${scoreBump ? ' sb-track-pop' : ''}`}>
        <div
          className={`sb-fill${scoreBump ? ' sb-fill-pop' : ''}`}
          style={{
            width: `${pct * 100}%`,
            backgroundColor: isLocked ? c.fill : c.fillDim,
          }}
        />
      </div>
    </div>
  );
}

// ─── Huvudkomponent ───────────────────────────────────────────────────────────

export function ScoreBattleView({ gameId }: { gameId: string }) {
  const [room, setRoom] = useState<ScoreBattleRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const frozenRoomRef = useRef<ScoreBattleRoom | null>(null);
  const refreshInFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  // Vilken spelare är jag?
  const [myPlayerIndex, setMyPlayerIndex] = useState<number | null>(null);

  // Min gissning (lokal)
  const [myGuess, setMyGuess] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Spåra rundbyte för att återställa gissning
  const lastSongCountRef = useRef<number>(-1);
  // Spåra vad vi senast skickade till Firestore → loop-skydd
  const lastSubmittedRef = useRef<{ year: number; locked: boolean } | null>(null);

  // Minimal fallback-refresh för enheter där realtime ibland tappar synk (främst iOS)
  const refreshRoomOnce = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < 1200) return;
    if (refreshInFlightRef.current) return;
    if (document.visibilityState !== 'visible') return;

    refreshInFlightRef.current = true;
    lastRefreshAtRef.current = now;
    try {
      let snap;
      try {
        snap = await getDocFromServer(doc(db, 'scoreBattleRooms', gameId));
      } catch {
        // Fallback om server-read misslyckas tillfälligt
        snap = await getDoc(doc(db, 'scoreBattleRooms', gameId));
      }
      if (!snap.exists()) {
        if (frozenRoomRef.current?.phase === 'game_over') return;
        if (frozenRoomRef.current !== null) {
          setError('Spelet avslutades av värden.');
        } else {
          setError('Spelet hittades inte. Be värden starta om spelet.');
        }
        setLoading(false);
        return;
      }
      const data = snap.data() as ScoreBattleRoom;
      frozenRoomRef.current = data;
      setRoom(data);
      setLoading(false);
      setError(null);
    } catch {
      // Behåll senaste state; onSnapshot eller nästa poll tar igen.
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [gameId]);

  // ── Lyssna på rummet ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'scoreBattleRooms', gameId),
      (snap) => {
        if (!snap.exists()) {
          // Om vi redan sett game_over – behåll sista kända state (rummet raderas efter 3 min)
          if (frozenRoomRef.current?.phase === 'game_over') return;
          if (frozenRoomRef.current !== null) {
            setError('Spelet avslutades av värden.');
          } else {
            setError('Spelet hittades inte. Be värden starta om spelet.');
          }
          setLoading(false);
          return;
        }
        const data = snap.data() as ScoreBattleRoom;
        frozenRoomRef.current = data;
        setRoom(data);
        setLoading(false);
        setError(null);
      },
      () => {
        setError('Kunde inte ansluta till spelet. Försök igen.');
        setLoading(false);
      },
    );
    return unsub;
  }, [gameId]);

  // Fallback: låg-frekvent polling + reconnect vid focus/online/pageshow/visibility
  useEffect(() => {
    const pollMs = room?.phase === 'guessing' || room?.phase === 'song_summary' ? 1400 : 2200;
    const interval = setInterval(() => {
      if (room?.phase === 'game_over') return;
      void refreshRoomOnce();
    }, pollMs);

    const onFocus = () => { void refreshRoomOnce(true); };
    const onPageShow = () => { void refreshRoomOnce(true); };
    const onOnline = () => { void refreshRoomOnce(true); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshRoomOnce(true);
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshRoomOnce, room?.phase]);

  // ── Återställ gissning vid ny runda ──────────────────────────────────────
  useEffect(() => {
    if (!room) return;
    if (room.songCount !== lastSongCountRef.current) {
      lastSongCountRef.current = room.songCount;
      setMyGuess('');
      setIsLocked(false);
      lastSubmittedRef.current = null;
    }
  }, [room?.songCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Synka extern ändring (App→Webb) för min spelare ──────────────────────
  // Om appen ändrar min gissning/låsstatus syns det i room.webGuesses[myPlayerIndex].
  // Ignorera ändringar vi själva skickade (lastSubmittedRef).
  useEffect(() => {
    if (myPlayerIndex === null || !room) return;
    const webG = room.webGuesses[String(myPlayerIndex)];
    if (!webG) return;
    const last = lastSubmittedRef.current;
    // Är detta vårt eget echo? → ignorera
    if (last && last.year === webG.year && last.locked === webG.locked) return;
    // Extern ändring från appen → uppdatera lokal state
    setMyGuess(String(webG.year));
    setIsLocked(webG.locked);
    lastSubmittedRef.current = { year: webG.year, locked: webG.locked };
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    room?.webGuesses?.[String(myPlayerIndex)]?.year,
    room?.webGuesses?.[String(myPlayerIndex)]?.locked,
    myPlayerIndex,
  ]);

  // ── Skicka gissning till Firestore ───────────────────────────────────────
  const submitGuess = async (year: string, locked: boolean) => {
    if (myPlayerIndex === null) return;
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum)) return;
    // Markera som "eget" direkt så echo-skyddet fungerar
    lastSubmittedRef.current = { year: yearNum, locked };
    try {
      await updateDoc(doc(db, 'scoreBattleRooms', gameId), {
        [`webGuesses.${myPlayerIndex}`]: { year: yearNum, locked },
      });
    } catch (e) {
      console.error('Kunde inte skicka gissning:', e);
    }
  };

  const handleGuessChange = async (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 4);
    setMyGuess(clean);
    // Om spelaren skriver ny siffra efter låsning → lås upp
    if (isLocked) {
      setIsLocked(false);
      if (clean.length === 4 && isValidYear(clean)) {
        await submitGuess(clean, false);
      }
    }
  };

  const handleToggleLock = async () => {
    if (!isValidYear(myGuess)) return;
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    await submitGuess(myGuess, newLocked);
  };

  // ── Väntar på data ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="sb-root">
        <div className="sb-center">
          <div className="sb-spinner" />
          <p>Ansluter till spelet…</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="sb-root">
        <div className="sb-center">
          <span className="sb-error-icon">⚠️</span>
          <p className="sb-error-text">{error ?? 'Okänt fel'}</p>
        </div>
      </div>
    );
  }

  // ── Välj spelare ─────────────────────────────────────────────────────────
  if (myPlayerIndex === null) {
    return (
      <div className="sb-root">
        <div className="sb-content">
          <div style={{ height: 24 }} />
          <p className="sb-select-title">🎵 Vem är du?</p>
          <p className="sb-select-sub">Välj ditt namn för att börja gissa</p>
          <div className="sb-player-list">
            {room.playerNames.map((name, i) => {
              const c = PLAYER_COLORS[i % PLAYER_COLORS.length];
              return (
                <button
                  key={i}
                  className="sb-player-btn"
                  style={{ borderColor: c.border }}
                  onClick={() => setMyPlayerIndex(i)}
                >
                  <div className="sb-player-dot" style={{ backgroundColor: c.fill }} />
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Spelvy ───────────────────────────────────────────────────────────────
  const isGuessing = room.phase === 'guessing';
  const isSummary  = room.phase === 'song_summary';
  const isGameOver = room.phase === 'game_over';

  // Beräkna vinnare vid game_over
  const winnerIdxs = isGameOver ? resolveWinningPlayerIndices(room.scores, room.stars) : [];
  const winnerSet = new Set(winnerIdxs);
  const hasCoWinners = winnerIdxs.length > 1;

  // targetScore: hämtas från rummet, fallback 50 om gamla spel saknar fältet
  const targetScore = room.targetScore ?? 50;
  const inputOrder = room.playerNames.map((_, idx) => idx);
  const rankingOrder = [...inputOrder].sort((a, b) => {
    const scoreDiff = (room.scores[b] ?? 0) - (room.scores[a] ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const starDiff = (room.stars[b] ?? 0) - (room.stars[a] ?? 0);
    if (starDiff !== 0) return starDiff;
    return a - b;
  });
  const summaryOrder = [...inputOrder].sort((a, b) => {
    const pointsDiff = (room.roundResults?.[b]?.points ?? -999) - (room.roundResults?.[a]?.points ?? -999);
    if (pointsDiff !== 0) return pointsDiff;
    const scoreDiff = (room.scores[b] ?? 0) - (room.scores[a] ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const starDiff = (room.stars[b] ?? 0) - (room.stars[a] ?? 0);
    if (starDiff !== 0) return starDiff;
    return a - b;
  });
  const playerRenderOrder = rankingOrder;
  const rankByIndex: Record<number, number> = {};
  playerRenderOrder.forEach((playerIndex, rank) => {
    rankByIndex[playerIndex] = rank + 1;
  });

  const myWebGuess = room.webGuesses[String(myPlayerIndex)];
  const allPlayersLocked = room.playerNames.every((_, i) => {
    if (i === myPlayerIndex) return isLocked;
    return room.webGuesses[String(i)]?.locked === true;
  });
  const inputValid = isValidYear(myGuess);
  const modeLabel = GAME_MODE_LABELS[room.gameMode ?? 'default'] ?? GAME_MODE_LABELS.default;
  const modeParts = splitGameModeName(modeLabel);

  const c = PLAYER_COLORS[myPlayerIndex % PLAYER_COLORS.length];

  return (
    <div className="sb-root">
      {/* ── Header ── */}
      <div className="sb-header sb-animate-in">
        <div className="sb-header-card">
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="sb-title">Score Battle - {modeParts.name}</span>
            {modeParts.years ? (
              <span className="sb-title-years">{modeParts.years}</span>
            ) : null}
          </div>
          <span className="sb-round-badge">
            Omgång {room.songCount + 1}
          </span>
        </div>
      </div>

      <div className="sb-content">
        {/* ── Alla spelarpoäng ── */}
        <div className="sb-banner-list">
          {playerRenderOrder.map((playerIndex, rowIndex) => {
            const webG = room.webGuesses[String(playerIndex)];
            // Använd lokal isLocked för min egen spelare (omedelbar feedback)
            const cardLocked = isGuessing
              ? (playerIndex === myPlayerIndex ? isLocked : webG?.locked === true)
              : false;
            const name = room.playerNames[playerIndex] ?? `Spelare ${playerIndex + 1}`;
            return (
              <ScoreBanner
                key={`player-${playerIndex}`}
                name={name}
                rank={rankByIndex[playerIndex] ?? playerIndex + 1}
                score={room.scores[playerIndex] ?? 0}
                targetScore={targetScore}
                stars={room.stars[playerIndex] ?? 0}
                roundDeltaPoints={isSummary ? (room.roundResults?.[playerIndex]?.points ?? null) : null}
                isLocked={cardLocked}
                isGuessingPhase={isGuessing}
                isSummaryPhase={isSummary}
                playerIndex={playerIndex}
                isMe={playerIndex === myPlayerIndex}
                animationDelayMs={rowIndex * 35}
              />
            );
          })}
        </div>

        {/* ── Gissningsfas: min inmatning ── */}
        {isGuessing && (
          <div className="sb-guess-section sb-animate-in">
            <div className="sb-guess-row">
              <input
                className={[
                  'sb-guess-input',
                  isLocked ? 'locked' : '',
                  myGuess.length === 4 && !inputValid ? 'error' : '',
                ].join(' ')}
                style={isLocked ? {
                  borderColor: c.inputBorder,
                  color: c.inputColor,
                  backgroundColor: c.inputBg,
                } : undefined}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="År?"
                value={isLocked ? '••••' : myGuess}
                readOnly={isLocked}
                onChange={e => !isLocked && handleGuessChange(e.target.value)}
              />
              {myGuess.length === 4 && inputValid && (
                <button
                  className="sb-lock-btn"
                  style={{
                    backgroundColor: c.btnBg,
                    borderColor: c.btnBorder,
                    color: isLocked ? c.inputColor : '#475569',
                  }}
                  onClick={handleToggleLock}
                  title={isLocked ? 'Ändra gissning' : 'Lås gissning'}
                >
                  <span className={`sb-lock-icon-wrap${isLocked ? ' locked' : ''}`}>
                    {isLocked ? (
                      <svg className="sb-lock-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2.2" stroke="currentColor" strokeWidth="2" />
                        <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg className="sb-lock-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2.2" stroke="currentColor" strokeWidth="2" />
                        <path d="M16 11V8a4 4 0 1 0-8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                </button>
              )}
            </div>
            {isLocked && (
              <p style={{ color: c.badgeText, fontSize: 13, textAlign: 'center', fontWeight: 600, margin: 0 }}>
                {allPlayersLocked
                  ? '✓ Alla klara - väntar på svar...'
                  : '✓ Gissning låst - väntar på de andra...'}
              </p>
            )}
            {!isLocked && myGuess.length === 4 && !inputValid && (
              <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', margin: 0 }}>
                Ogiltigt år (1900–{currentYear})
              </p>
            )}
          </div>
        )}

        {/* ── Väntar på svar (gissningsfas, men ej aktiv input) ── */}
        {isGuessing && isLocked && !myWebGuess?.locked && (
          <div className="sb-phase-banner waiting">
            Skickar gissning…
          </div>
        )}

        {/* ── Song summary ── */}
        {isSummary && room.card && (
          <>
            <div className="sb-summary-card sb-animate-in">
              {room.card.artworkUrl && (
                <div className="sb-artwork-wrap">
                  <img
                    src={room.card.artworkUrl}
                    alt="Album artwork"
                    className="sb-artwork-img"
                  />
                </div>
              )}
              <span className="sb-summary-label">RÄTT ÅR</span>
              <span className="sb-summary-year">{room.card.year}</span>
              <span className="sb-summary-artist">{room.card.artist}</span>
              <span className="sb-summary-title">{room.card.title}</span>
            </div>

            {room.roundResults && (
              <div className="sb-result-list sb-animate-in">
                {summaryOrder.map((playerIndex) => {
                  const r = room.roundResults?.[playerIndex];
                  if (!r) return null;
                  const diff = r.skipped ? null : Math.abs(r.guessYear - (room.card?.year ?? 0));
                  const col  = pointsColor(r.points, r.skipped);
                  const name = room.playerNames[playerIndex] ?? `Spelare ${playerIndex + 1}`;
                  return (
                    <div key={`result-${playerIndex}`} className="sb-result-row">
                      <div className="sb-result-left">
                        <div className="sb-result-name">{name}</div>
                        <div className="sb-result-detail">
                          {r.skipped
                            ? 'Hoppade över'
                            : `Gissade ${r.guessYear} · ${diff === 0 ? '🎯 Exakt!' : `${diff} år fel`}`}
                        </div>
                      </div>
                      <div className="sb-result-right">
                        <div className="sb-result-pts" style={{ color: col }}>
                          {r.skipped ? '–' : `${r.points > 0 ? '+' : ''}${r.points}`}
                        </div>
                        <div className="sb-result-label">{pointsLabel(r.points, r.skipped)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sb-phase-banner summary waiting">▶ Väntar på nästa låt…</div>
          </>
        )}

        {/* ── Game over ── */}
        {isGameOver && (
          <div className="sb-gameover sb-animate-in">
            <div className="sb-trophy">🏆</div>
            <p className="sb-winner-sub">{hasCoWinners ? 'Vinnarna är' : 'Vinnaren är'}</p>
            <p className="sb-winner-name">
              🏆 {winnerIdxs.length > 0
                ? winnerIdxs.map(i => room.playerNames[i] ?? `Spelare ${i + 1}`).join(' & ')
                : '?'}
            </p>
            <div className="sb-final-scores">
              {rankingOrder.map((playerIndex) => {
                const name = room.playerNames[playerIndex] ?? `Spelare ${playerIndex + 1}`;
                return (
                <div key={`final-${playerIndex}`} className="sb-final-row">
                  <span className={`sb-final-name${winnerSet.has(playerIndex) ? ' winner' : ''}`}>
                    {winnerSet.has(playerIndex) ? '🏆 ' : ''}{name}
                  </span>
                  <span className={`sb-final-pts${winnerSet.has(playerIndex) ? ' winner' : ''}`}>
                    {room.scores[playerIndex]}p
                  </span>
                </div>
              )})}
            </div>

            {/* ── Spelhistorik ── */}
            {room.songHistory && room.songHistory.length > 0 && (() => {
              const PREVIEW = 3;
              const sorted = room.songHistory!
                .map((entry, origIdx) => ({ entry, origIdx }))
                .sort((a, b) => {
                  const score = (e: SongHistoryEntry) =>
                    Math.max(0, ...e.results.filter((r): r is RoundResult => r !== null).map(r => Math.abs(r.points)));
                  return score(b.entry) - score(a.entry);
                });
              const displayed = historyExpanded
                ? room.songHistory!.map((entry, origIdx) => ({ entry, origIdx }))
                : sorted.slice(0, PREVIEW);
              const hasMore = room.songHistory!.length > PREVIEW;
              return (
                <div className="sb-history">
                  <div className="sb-history-header">SPELHISTORIK</div>
                  {displayed.map(({ entry, origIdx }) => (
                    <div key={origIdx} className="sb-history-card">
                      <div className="sb-history-card-head">
                        <span className="sb-history-num">#{origIdx + 1}</span>
                        <div className="sb-history-meta">
                          <span className="sb-history-artist">{entry.artist}</span>
                          <span className="sb-history-title-year">
                            {entry.title} &middot; <strong>{entry.year}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="sb-history-results">
                        {entry.results.map((result, pi) => {
                          if (!result) return null;
                          const c = PLAYER_COLORS[pi % PLAYER_COLORS.length];
                          const pts = result.points;
                          const col = pointsColor(pts, result.skipped);
                          return (
                            <div key={pi} className="sb-history-player-row">
                              <span className="sb-history-dot" style={{ backgroundColor: c.fill }} />
                              <span className="sb-history-player-name">{room.playerNames[pi]}</span>
                              <span className="sb-history-guess">
                                {result.skipped ? '–' : result.guessYear}
                              </span>
                              <span
                                className="sb-history-pts-badge"
                                style={{ backgroundColor: col + '25', color: col }}
                              >
                                {result.skipped ? '–' : (pts >= 0 ? '+' : '') + pts + 'p'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <button
                      className="sb-history-toggle"
                      onClick={() => setHistoryExpanded(v => !v)}
                    >
                      {historyExpanded ? 'Dölj' : `Visa alla ${room.songHistory!.length} omgångar`}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
