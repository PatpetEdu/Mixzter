// components/ScoreBattleScreen.tsx
//
// Score Battle – Alt C: blind simultaneous guessing.
// Bägge gissar på SAMMA låt men ser inte varandras gissning.
// Persist: köen + spelstate sparas i AsyncStorage.
//
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated as RNAnimated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Star } from 'lucide-react-native';
import { useAudioPlayer } from 'expo-audio';

import AnimatedCard from './AnimatedCard';
import { useGenerateSongs, Card } from './useGenerateSongs';
import { useAuth } from '../hooks/useAuth';
import { saveScoreBattleMeta, deleteActiveGame } from '../storage/gameStorage';
import {
  useScoreBattleLogic,
  pointsLabel,
  pointsColor,
} from '../hooks/useScoreBattleLogic';

// ─── Typer ───────────────────────────────────────────────────────────────────

type Props = {
  playerNames: string[];
  gameMode: string;
  targetScore: number;
  maxRounds: number | null;
  gameId: string | null;
  onBackToMenu: () => void;
  headerHeight: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const AnimatedScrollView = RNAnimated.createAnimatedComponent(ScrollView);

const PERSIST_STATE_KEY = (uid: string, gid: string) => `scoreBattle:${uid}:${gid}`;
const PERSIST_QUEUE_KEY = (uid: string, gid: string) => `nextCard:${uid}:${gid}`;

// ─── ScoreCard – poängkort med aktiv-indikator ───────────────────────────────

function ScoreCard({
  name,
  score,
  targetScore,
  stars,
  isActive,
}: {
  name: string;
  score: number;
  targetScore: number;
  stars: number;
  isActive: boolean;
}) {
  const pct = Math.max(0, Math.min(score / targetScore, 1));
  const isNeg = score < 0;

  return (
    <View style={[scStyles.wrap, isActive && scStyles.wrapActive]}>
      {/* Aktiv-indikator: färgad linje längst upp */}
      {isActive && <View style={scStyles.activeLine} />}

      <View style={scStyles.header}>
        <RNText style={[scStyles.name, isActive && scStyles.nameActive]} numberOfLines={1}>
          {name}
        </RNText>
        <View style={scStyles.starsRow}>
          {Array.from({ length: Math.max(0, stars) }).map((_, i) => (
            <Star key={i} size={11} color="#f59e0b" fill="#f59e0b" />
          ))}
        </View>
      </View>

      {/* Progress */}
      <View style={scStyles.track}>
        <View
          style={[
            scStyles.fill,
            { width: `${pct * 100}%` },
            isActive && scStyles.fillActive,
          ]}
        />
      </View>

      <RNText style={[scStyles.score, isNeg && scStyles.scoreNeg, isActive && scStyles.scoreActive]}>
        {score}
        <RNText style={scStyles.target}>/{targetScore}</RNText>
      </RNText>

      {/* "DIN TUR"-badge */}
      {isActive && (
        <View style={scStyles.turnBadge}>
          <RNText style={scStyles.turnText}>DIN TUR</RNText>
        </View>
      )}
    </View>
  );
}

const scStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0f0f17',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    overflow: 'hidden',
  },
  wrapActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#0d0d1f',
  },
  activeLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#6366f1',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  name: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
  nameActive: {
    color: '#a5b4fc',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  track: {
    height: 3,
    backgroundColor: '#1a1a2e',
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fill: {
    height: 3,
    borderRadius: 99,
    backgroundColor: '#312e81',
  },
  fillActive: {
    backgroundColor: '#6366f1',
  },
  score: {
    color: '#e2e8f0',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  scoreNeg: {
    color: '#ef4444',
  },
  scoreActive: {
    color: '#a5b4fc',
  },
  target: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0,
  },
  turnBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(99,102,241,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  turnText: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});

// ─── PassOverlay – tryck var som helst ───────────────────────────────────────

function PassOverlay({ to, onReady }: { to: string; onReady: () => void }) {
  return (
    <TouchableOpacity
      onPress={onReady}
      activeOpacity={1}
      style={poStyles.root}
    >
      <View style={poStyles.pill}>
        <RNText style={poStyles.pillText}>nästa spelare</RNText>
      </View>
      <RNText style={poStyles.name}>{to}</RNText>
      <RNText style={poStyles.hint}>tryck var som helst för att fortsätta</RNText>
    </TouchableOpacity>
  );
}

const poStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07070d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  pill: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
  },
  pillText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  name: {
    color: '#f8fafc',
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
  },
  hint: {
    color: '#334155',
    fontSize: 13,
    marginTop: 8,
  },
});

// ─── ResultRow ────────────────────────────────────────────────────────────────

function ResultRow({
  name,
  result,
  actualYear,
}: {
  name: string;
  result: { guessYear: number; points: number; skipped: boolean } | null;
  actualYear: number;
}) {
  if (!result) return null;
  const pts = result.points;
  const col = pointsColor(pts, result.skipped);
  const diff = result.skipped ? null : Math.abs(result.guessYear - actualYear);

  return (
    <View style={rrStyles.row}>
      <View style={rrStyles.left}>
        <RNText style={rrStyles.name}>{name}</RNText>
        <RNText style={rrStyles.guess}>
          {result.skipped
            ? 'Hoppade över'
            : `Gissade ${result.guessYear}  ·  ${diff === 0 ? '🎯 Exakt!' : `${diff} år fel`}`}
        </RNText>
      </View>
      <View style={rrStyles.right}>
        <RNText style={[rrStyles.pts, { color: col }]}>
          {result.skipped ? '—' : `${pts > 0 ? '+' : ''}${pts}`}
        </RNText>
        <RNText style={rrStyles.label}>{pointsLabel(pts, result.skipped)}</RNText>
      </View>
    </View>
  );
}

const rrStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f17',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  left: { flex: 1, marginRight: 12 },
  right: { alignItems: 'flex-end' },
  name: { color: '#f8fafc', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  guess: { color: '#475569', fontSize: 13 },
  pts: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  label: { color: '#475569', fontSize: 11, marginTop: 2 },
});

// ─── Huvudkomponent ───────────────────────────────────────────────────────────

export default function ScoreBattleScreen({
  playerNames,
  gameMode,
  targetScore,
  maxRounds,
  gameId,
  onBackToMenu,
  headerHeight,
  onScroll,
}: Props) {
  const { user } = useAuth();

  // persistKeys
  const persistKey = user && gameId ? PERSIST_QUEUE_KEY(user.uid, gameId) : undefined;
  const stateKey   = user && gameId ? PERSIST_STATE_KEY(user.uid, gameId) : undefined;

  const logic = useScoreBattleLogic(playerNames, targetScore, maxRounds);
  const {
    scores, stars, phase,
    p1Idx, p2Idx,
    soloMode,
    roundResults, songCount, winnerIdx,
    confirmP1, skipP1, proceedToP2,
    confirmP2, skipP2, nextSong, resetGame,
    _restore,
  } = logic;

  const { card, setCard, isLoadingCard, generateCard } = useGenerateSongs(gameMode, persistKey);

  // ─── Persist: ladda spelstate vid mount ────────────────────────────────────

  // Återställ state + aktuellt kort från AsyncStorage, sedan generera nytt om inget kort finns
  const [isRestoreLoaded, setIsRestoreLoaded] = useState(false);
  const restoredCardRef = useRef<Card | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (stateKey) {
        try {
          const raw = await AsyncStorage.getItem(stateKey);
          if (!cancelled && raw) {
            const s = JSON.parse(raw);
            logic._restore(s);
            restoredCardRef.current = s.currentCard ?? null;
          }
        } catch {}
      }
      if (!cancelled) setIsRestoreLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // När restore är klar: sätt återställt kort direkt ELLER hämta nytt
  useEffect(() => {
    if (!isRestoreLoaded) return;
    if (restoredCardRef.current) {
      setCard(restoredCardRef.current);
    } else {
      generateCard();
    }
  }, [isRestoreLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Registrera / uppdatera i menyns active games index
  useEffect(() => {
    if (!user || !gameId) return;
    if (phase === 'game_over') {
      deleteActiveGame(user.uid, gameId).catch(() => {});
      return;
    }
    saveScoreBattleMeta(
      user.uid, gameId,
      [playerNames[0], playerNames[1] ?? playerNames[0]] as [string, string],
      scores, gameMode, targetScore, maxRounds
    ).catch(() => {});
  }, [user, gameId, scores, phase, playerNames, gameMode, targetScore, maxRounds]);

  useEffect(() => {
    if (!stateKey) return;
    if (phase === 'game_over') {
      AsyncStorage.removeItem(stateKey).catch(() => {});
      return;
    }
    const snap = {
      scores,
      stars,
      songCount,
      firstPlayerIdx: p1Idx,
      currentCard: card,
    };
    AsyncStorage.setItem(stateKey, JSON.stringify(snap)).catch(() => {});
  }, [stateKey, scores, stars, songCount, p1Idx, phase, card]);

  // ─── Ljud ──────────────────────────────────────────────────────────────────

  const player = useAudioPlayer(card?.previewData?.previewUrl ?? null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stopAudio = useCallback(async () => {
    try { player.pause(); } catch {}
    setIsPlaying(false);
  }, [player]);

  const togglePreview = useCallback(() => {
    if (!card?.previewData?.previewUrl) return;
    if (isPlaying) { player.pause(); setIsPlaying(false); }
    else           { player.play();  setIsPlaying(true);  }
  }, [isPlaying, player, card]);

  useEffect(() => {
    if (phase === 'song_summary' || phase === 'game_over') stopAudio();
  }, [phase, stopAudio]);

  useEffect(() => () => { stopAudio(); }, [stopAudio]);

  // ─── Input ────────────────────────────────────────────────────────────────

  const [guess, setGuess] = useState('');
  const isGuessValid = useMemo(() => /^(1[89]\d{2}|20[0-2]\d|2025|2026)$/.test(guess), [guess]);

  // ─── Nästa / reset låt ───────────────────────────────────────────────────

  const resetRound = useCallback(async () => {
    await stopAudio();
    setGuess('');
  }, [stopAudio]);

  const handleNextSong = useCallback(async () => {
    await resetRound();
    nextSong();
    generateCard();
  }, [nextSong, generateCard, resetRound]);

  const handlePlayAgain = useCallback(async () => {
    await resetRound();
    if (stateKey) AsyncStorage.removeItem(stateKey).catch(() => {});
    resetGame();
    generateCard();
  }, [resetGame, generateCard, resetRound, stateKey]);


  const handleConfirmP1 = useCallback(() => {
    if (!card || !isGuessValid) return;
    confirmP1(parseInt(guess, 10), card.year);
    setGuess('');
  }, [card, isGuessValid, guess, confirmP1]);

  const handleSkipP1 = useCallback(() => {
    if (skipP1()) setGuess('');
  }, [skipP1]);

  const handleConfirmP2 = useCallback(() => {
    if (!card || !isGuessValid) return;
    confirmP2(parseInt(guess, 10), card.year);
    setGuess('');
  }, [card, isGuessValid, guess, confirmP2]);

  const handleSkipP2 = useCallback(() => {
    if (skipP2()) setGuess('');
  }, [skipP2]);

  const p1Name = playerNames[p1Idx];
  const p2Name = playerNames[p2Idx];
  const isP1Turn = phase === 'p1_guessing';
  const isP2Turn = phase === 'p2_guessing';
  const currentPlayerIdx = isP1Turn ? p1Idx : p2Idx;

  // ─── Game Over ─────────────────────────────────────────────────────────────

  if (phase === 'game_over') {
    const winner = winnerIdx !== null ? playerNames[winnerIdx] : '?';
    return (
      <View style={{ flex: 1, backgroundColor: '#07070d' }}>
        <ScrollView contentContainerStyle={s.center}>
          <View style={s.gameOverInner}>
            <View style={s.trophyCircle}>
              <Trophy size={52} color="#f59e0b" />
            </View>
            <RNText style={s.winnerSub}>Vinnaren är</RNText>
            <RNText style={s.winnerName}>🏆 {winner}</RNText>

            <View style={s.finalScores}>
              {playerNames.map((name, i) => (
                <View key={name} style={[s.finalRow, i === 0 && s.finalRowBorder]}>
                  <RNText style={[s.finalName, i === winnerIdx && s.finalNameWinner]}>
                    {i === winnerIdx ? '🏆 ' : ''}{name}
                  </RNText>
                  <RNText style={[s.finalPts, i === winnerIdx && s.finalPtsWinner]}>
                    {scores[i]}p
                  </RNText>
                </View>
              ))}
            </View>

            <RNText style={s.songCount}>{songCount + 1} omgångar spelades</RNText>

            <TouchableOpacity onPress={handlePlayAgain} activeOpacity={0.85} style={{ width: '100%' }}>
              <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bigBtn}>
                <RNText style={s.bigBtnText}>Spela igen 🎵</RNText>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onBackToMenu} style={s.outlineBtn}>
              <RNText style={s.outlineBtnText}>Tillbaka till meny</RNText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Pass overlay ──────────────────────────────────────────────────────────

  if (phase === 'pass_to_p2') {
    return <PassOverlay to={p2Name} onReady={proceedToP2} />;
  }

  // ─── Huvud spelvy ──────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AnimatedScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.container, { paddingTop: headerHeight + 12 }]}
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={{ flex: 1, backgroundColor: '#07070d' }}
      >
        {/* ── Omgångsindikator ── */}
        <View style={s.roundBadgeRow}>
          <View style={s.roundBadge}>
            <RNText style={s.roundBadgeText}>
              {maxRounds !== null
                ? `Omgång ${songCount + 1} / ${maxRounds}`
                : `Omgång ${songCount + 1}`}
            </RNText>
          </View>
        </View>

        {/* ── Score-rad ── */}
        <View style={s.scoreRow}>
          <ScoreCard
            name={playerNames[0]}
            score={scores[0]}
            targetScore={targetScore}
            stars={stars[0]}
            isActive={
              (phase === 'p1_guessing' && p1Idx === 0) ||
              (phase === 'p2_guessing' && p2Idx === 0)
            }
          />
          {!soloMode && (
            <>
              <View style={s.scoreDiv} />
              <ScoreCard
                name={playerNames[1]}
                score={scores[1]}
                targetScore={targetScore}
                stars={stars[1]}
                isActive={
                  (phase === 'p1_guessing' && p1Idx === 1) ||
                  (phase === 'p2_guessing' && p2Idx === 1)
                }
              />
            </>
          )}
        </View>

        {/* ── Laddning ── */}
        {isLoadingCard && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color="#6366f1" size="large" />
            <RNText style={s.loadingText}>Hämtar nästa låt…</RNText>
          </View>
        )}

        {/* ── Gissningsfas ── */}
        {(isP1Turn || isP2Turn) && card && (
          <View style={s.guessSection}>
            <AnimatedCard
              showBack={false}
              card={card}
              onFlip={() => {}}
              showFlipButton={false}
              onPlayPreview={togglePreview}
              isPlayingPreview={isPlaying}
            />

            {/* Årinput */}
            <TextInput
              style={[s.yearInput, guess.length === 4 && !isGuessValid && s.yearInputError]}
              placeholder="Ange år · t.ex. 1995"
              placeholderTextColor="#2d3748"
              keyboardType="number-pad"
              value={guess}
              onChangeText={t => setGuess(t.replace(/\D/g, '').slice(0, 4))}
              returnKeyType="done"
              maxLength={4}
              onSubmitEditing={isP1Turn ? handleConfirmP1 : handleConfirmP2}
            />

            {guess.length === 4 && !isGuessValid && (
              <RNText style={s.inputError}>Ogiltigt år</RNText>
            )}

            {/* Bekräfta */}
            <TouchableOpacity
              onPress={isP1Turn ? handleConfirmP1 : handleConfirmP2}
              disabled={!isGuessValid}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={isGuessValid ? ['#4f46e5', '#7c3aed'] : ['#0f0f17', '#0f0f17']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.confirmBtn, !isGuessValid && s.confirmDisabled]}
              >
                <RNText style={[s.confirmText, !isGuessValid && { color: '#334155' }]}>
                  Bekräfta gissning
                </RNText>
              </LinearGradient>
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity
              onPress={isP1Turn ? handleSkipP1 : handleSkipP2}
              disabled={stars[currentPlayerIdx] <= 0}
              activeOpacity={0.6}
              style={[s.skipBtn, stars[currentPlayerIdx] <= 0 && { opacity: 0.3 }]}
            >
              <View style={s.skipInner}>
                <RNText style={s.skipText}>⭐ Skippa</RNText>
                <View style={s.skipPill}>
                  <RNText style={s.skipPillText}>{stars[currentPlayerIdx]} kvar</RNText>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Song Summary ── */}
        {phase === 'song_summary' && card && (
          <View style={s.summarySection}>
            <LinearGradient colors={['#0a0a1a', '#111130']} style={s.correctYearCard}>
              <RNText style={s.correctYearLabel}>RÄTT ÅR</RNText>
              <RNText style={s.correctYear}>{card.year}</RNText>
              <RNText style={s.correctArtist}>{card.artist}</RNText>
              <RNText style={s.correctTitle}>{card.title}</RNText>
            </LinearGradient>

            <View style={s.resultList}>
              <ResultRow name={p1Name} result={roundResults[0]} actualYear={card.year} />
              {!soloMode && (
                <ResultRow name={p2Name} result={roundResults[1]} actualYear={card.year} />
              )}
            </View>

            <TouchableOpacity onPress={handleNextSong} activeOpacity={0.85}>
              <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.bigBtn}
              >
                <RNText style={s.bigBtnText}>
                  {maxRounds !== null
                    ? `Nästa låt  ·  ${songCount + 1} / ${maxRounds}  ▶`
                    : 'Nästa låt  ▶'}
                </RNText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </AnimatedScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    flexGrow: 1,
    gap: 16,
  },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Round badge
  roundBadgeRow: {
    alignItems: 'center',
  },
  roundBadge: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  roundBadgeText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Score
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  scoreDiv: { width: 8 },

  // Loading
  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  loadingText: { color: '#334155', marginTop: 12, fontSize: 14 },

  // Guess
  guessSection: { gap: 12 },

  yearInput: {
    backgroundColor: '#0f0f17',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  yearInputError: {
    borderColor: '#7f1d1d',
  },
  inputError: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: -6,
  },

  confirmBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  skipBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  skipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0a0a14',
  },
  skipText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  skipPill: {
    backgroundColor: '#1e293b',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  skipPillText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },

  // Summary
  summarySection: { gap: 12 },
  correctYearCard: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e1b4b',
  },
  correctYearLabel: {
    color: '#4338ca',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },
  correctYear: {
    color: '#f8fafc',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 62,
  },
  correctArtist: {
    color: '#818cf8',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  correctTitle: {
    color: '#334155',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  resultList: { gap: 8 },

  bigBtn: {
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
  },
  bigBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  outlineBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
  },
  outlineBtnText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },

  // Game over
  gameOverInner: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    maxWidth: 380,
    gap: 12,
  },
  trophyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(245,158,11,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  winnerSub: { color: '#475569', fontSize: 16 },
  winnerName: {
    color: '#f59e0b',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  finalScores: {
    width: '100%',
    backgroundColor: '#0f0f17',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    overflow: 'hidden',
    marginTop: 4,
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  finalRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  finalName: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  finalNameWinner: { color: '#f59e0b' },
  finalPts: { color: '#334155', fontSize: 24, fontWeight: '900' },
  finalPtsWinner: { color: '#f59e0b' },
  songCount: { color: '#1e293b', fontSize: 13, marginTop: 4, marginBottom: 8 },
});
