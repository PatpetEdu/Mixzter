// web/src/ScoreBattleView.tsx
//
// Webbvy för Score Battle – spelarna scannar QR och gissar via sin telefon.
// Skriver webGuesses till Firestore; appen läser och låser spelarens kort.

import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
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

interface ScoreBattleRoom {
  hostUid: string;
  phase: 'guessing' | 'song_summary' | 'game_over';
  playerNames: string[];
  scores: number[];
  stars: number[];
  songCount: number;
  card: RoomCard | null;
  roundResults: (RoundResult | null)[] | null;
  webGuesses: Record<string, { year: number; locked: boolean }>;
}

// ─── Hjälpfunktioner ─────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

function isValidYear(s: string): boolean {
  if (!/^[0-9]{4}$/.test(s)) return false;
  const y = parseInt(s, 10);
  return y >= 1900 && y <= currentYear;
}

function pointsLabel(pts: number, skipped = false): string {
  if (skipped)     return '⏭ Skippad';
  if (pts === 10)  return '🎯 Exakt!';
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

// ─── ScoreCard ────────────────────────────────────────────────────────────────

function ScoreCard({
  name, score, targetScore, stars, isLocked, playerIndex,
}: {
  name: string;
  score: number;
  targetScore: number;
  stars: number;
  isLocked: boolean;
  playerIndex: number;
}) {
  const c = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
  const pct = Math.max(0, Math.min(score / targetScore, 1));
  const isNeg = score < 0;

  return (
    <div
      className="sb-score-card"
      style={{
        borderColor: isLocked ? c.locked : c.border,
        backgroundColor: isLocked ? '#0d0d1a' : '#0f0f17',
      }}
    >
      {isLocked && (
        <div className="sb-score-card-locked-line" style={{ backgroundColor: c.locked }} />
      )}
      <div className="sb-score-card-header">
        <span
          className="sb-score-card-name"
          style={isLocked ? { color: c.nameLocked } : undefined}
        >
          {name}
        </span>
        <span className="sb-stars">
          {Array.from({ length: Math.max(0, stars) }).map((_, i) => (
            <span key={i} className="sb-star">⭐</span>
          ))}
        </span>
      </div>
      <div className="sb-track">
        <div
          className="sb-fill"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: isLocked ? c.fill : c.fillDim,
          }}
        />
      </div>
      <span className={`sb-score-num${isNeg ? ' sb-score-neg' : ''}`}
        style={isLocked ? { color: c.nameLocked } : undefined}>
        {score}
        <span className="sb-score-target">/{targetScore}</span>
      </span>
      {isLocked && (
        <span
          className="sb-locked-badge"
          style={{ backgroundColor: c.badgeBg, color: c.badgeText }}
        >
          KLAR ✓
        </span>
      )}
    </div>
  );
}

// ─── Huvudkomponent ───────────────────────────────────────────────────────────

export function ScoreBattleView({ gameId }: { gameId: string }) {
  const [room, setRoom] = useState<ScoreBattleRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vilken spelare är jag?
  const [myPlayerIndex, setMyPlayerIndex] = useState<number | null>(null);

  // Min gissning (lokal)
  const [myGuess, setMyGuess] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  // Spåra rundbyte för att återställa gissning
  const lastSongCountRef = useRef<number>(-1);
  // Spåra vad vi senast skickade till Firestore → loop-skydd
  const lastSubmittedRef = useRef<{ year: number; locked: boolean } | null>(null);

  // ── Lyssna på rummet ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'scoreBattleRooms', gameId),
      (snap) => {
        if (!snap.exists()) {
          // Spelet raderades (avslutat av värden eller game_over)
          if (room !== null) {
            // Vi hade ett aktivt spel → värden avslutade det manuellt
            setError('Spelet avslutades av värden.');
          } else {
            setError('Spelet hittades inte. Be värden starta om spelet.');
          }
          setLoading(false);
          return;
        }
        setRoom(snap.data() as ScoreBattleRoom);
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
  const myName    = room.playerNames[myPlayerIndex];
  const isGuessing = room.phase === 'guessing';
  const isSummary  = room.phase === 'song_summary';
  const isGameOver = room.phase === 'game_over';

  // Beräkna vinnare vid game_over
  const winnerIdx = isGameOver
    ? room.scores.indexOf(Math.max(...room.scores))
    : null;

  // targetScore: räkna ut från roomets score-array storlek vs namn
  // Vi vet inte targetScore från rummet – men det är bara visuellt i progress bar.
  // Eftersom vi inte sparar targetScore i rummet, använd max(scores, 50) som guide.
  const maxScore = Math.max(...room.scores, 50);

  const myWebGuess = room.webGuesses[String(myPlayerIndex)];
  const inputValid = isValidYear(myGuess);

  const c = PLAYER_COLORS[myPlayerIndex % PLAYER_COLORS.length];

  return (
    <div className="sb-root">
      {/* ── Header ── */}
      <div className="sb-header">
        <span className="sb-title">Score Battle</span>
        <span className="sb-round-badge">
          Omgång {room.songCount + 1}
        </span>
      </div>

      <div className="sb-content">

        {/* ── Alla spelarpoäng ── */}
        <div className="sb-score-grid">
          {room.playerNames.map((name, i) => {
            const webG = room.webGuesses[String(i)];
            // Använd lokal isLocked för min egen spelare (omedelbar feedback)
            const cardLocked = isGuessing
              ? (i === myPlayerIndex ? isLocked : webG?.locked === true)
              : false;
            return (
              <ScoreCard
                key={i}
                name={name}
                score={room.scores[i] ?? 0}
                targetScore={maxScore}
                stars={room.stars[i] ?? 1}
                isLocked={cardLocked}
                playerIndex={i}
              />
            );
          })}
        </div>

        {/* ── Gissningsfas: min inmatning ── */}
        {isGuessing && (
          <div className="sb-guess-section">
            <span className="sb-guess-label">Din gissning, {myName}</span>
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
                  {isLocked ? '🔒' : '🔓'}
                </button>
              )}
            </div>
            {isLocked && (
              <p style={{ color: c.badgeText, fontSize: 13, textAlign: 'center', fontWeight: 600, margin: 0 }}>
                ✓ Gissning låst — väntar på de andra…
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
          <div className="sb-phase-banner">
            Skickar gissning…
          </div>
        )}

        {/* ── Song summary ── */}
        {isSummary && room.card && (
          <>
            <div className="sb-summary-card">
              <span className="sb-summary-label">RÄTT ÅR</span>
              <span className="sb-summary-year">{room.card.year}</span>
              <span className="sb-summary-artist">{room.card.artist}</span>
              <span className="sb-summary-title">{room.card.title}</span>
            </div>

            {room.roundResults && (
              <div className="sb-result-list">
                {room.playerNames.map((name, i) => {
                  const r = room.roundResults?.[i];
                  if (!r) return null;
                  const diff = r.skipped ? null : Math.abs(r.guessYear - (room.card?.year ?? 0));
                  const col  = pointsColor(r.points, r.skipped);
                  return (
                    <div key={i} className="sb-result-row">
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

            <div className="sb-phase-banner summary">
              ⏳ Väntar på nästa låt…
            </div>
          </>
        )}

        {/* ── Game over ── */}
        {isGameOver && (
          <div className="sb-gameover">
            <div className="sb-trophy">🏆</div>
            <p className="sb-winner-sub">Vinnaren är</p>
            <p className="sb-winner-name">
              🏆 {winnerIdx !== null ? room.playerNames[winnerIdx] : '?'}
            </p>
            <div className="sb-final-scores">
              {room.playerNames.map((name, i) => (
                <div key={i} className="sb-final-row">
                  <span className={`sb-final-name${i === winnerIdx ? ' winner' : ''}`}>
                    {i === winnerIdx ? '🏆 ' : ''}{name}
                  </span>
                  <span className={`sb-final-pts${i === winnerIdx ? ' winner' : ''}`}>
                    {room.scores[i]}p
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
