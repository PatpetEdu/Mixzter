// components/ScoreBattleScreen.tsx
//
// Score Battle – simultaneous guessing.
// Alla spelare gissar på SAMMA låt på en gång i sina egna rutor.
// Persist: köen + spelstate sparas i AsyncStorage.
//
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated as RNAnimated,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Eye, EyeOff, QrCode, Info } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import AnimatedCard from './AnimatedCard';
import CardSkeleton from './CardSkeleton';
import QRCodeModal from './QRCodeModal';
import { useGenerateSongs, Card } from './useGenerateSongs';
import { useAuth } from '../hooks/useAuth';
import { saveScoreBattleMeta, deleteActiveGame } from '../storage/gameStorage';
import {
  useScoreBattleLogic,
  RoundResult,
  calcPoints,
  pointsLabel,
  pointsColor,
} from '../hooks/useScoreBattleLogic';
import { useScoreBattleSync } from '../hooks/useScoreBattleSync';

// ─── Typer ───────────────────────────────────────────────────────────────────

type Props = {
  playerNames: string[];
  gameMode: string;
  hostPlayerIndex: number;
  onChangeHostPlayerIndex: (index: number) => void;
  targetScore: number;
  maxRounds: number | null;
  gameId: string | null;
  onBackToMenu: () => void;
  headerHeight: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const AnimatedScrollView = RNAnimated.createAnimatedComponent(ScrollView);

interface SongHistoryEntry {
  artist: string;
  title: string;
  year: number;
  results: (RoundResult | null)[];
}

const PERSIST_STATE_KEY = (uid: string, gid: string) => `scoreBattle:${uid}:${gid}`;
const PERSIST_QUEUE_KEY = (uid: string, gid: string) => `nextCard:${uid}:${gid}`;
const currentYear = new Date().getFullYear();
const isValidYear = (s: string) => /^[0-9]{4}$/.test(s) && parseInt(s, 10) >= 1900 && parseInt(s, 10) <= currentYear;

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
  if (match) return { name: match[1], years: match[2] };
  return { name: fullName, years: '' };
}

// ─── ScoreCard – poängkort med inbyggd gissningsruta ─────────────────────────

// Per-player accent palette – 5 distinct hues that work on dark backgrounds
const PLAYER_COLORS = [
  { border: '#3730a3', fill: '#4f46e5', fillDim: '#312e81', locked: '#6366f1', nameLocked: '#a5b4fc', scoreLocked: '#a5b4fc', badgeBg: 'rgba(99,102,241,0.15)', badgeText: '#818cf8', inputBorder: '#4f46e5', inputColor: '#818cf8', inputBg: 'rgba(79,70,229,0.08)', btnBg: 'rgba(79,70,229,0.1)', btnBorder: 'rgba(79,70,229,0.25)' },
  { border: '#065f46', fill: '#10b981', fillDim: '#064e3b', locked: '#34d399', nameLocked: '#6ee7b7', scoreLocked: '#6ee7b7', badgeBg: 'rgba(16,185,129,0.15)', badgeText: '#34d399', inputBorder: '#10b981', inputColor: '#34d399', inputBg: 'rgba(16,185,129,0.08)', btnBg: 'rgba(16,185,129,0.1)', btnBorder: 'rgba(16,185,129,0.25)' },
  { border: '#92400e', fill: '#f59e0b', fillDim: '#78350f', locked: '#fbbf24', nameLocked: '#fcd34d', scoreLocked: '#fcd34d', badgeBg: 'rgba(245,158,11,0.15)', badgeText: '#fbbf24', inputBorder: '#f59e0b', inputColor: '#fbbf24', inputBg: 'rgba(245,158,11,0.08)', btnBg: 'rgba(245,158,11,0.1)', btnBorder: 'rgba(245,158,11,0.25)' },
  { border: '#9f1239', fill: '#f43f5e', fillDim: '#881337', locked: '#fb7185', nameLocked: '#fda4af', scoreLocked: '#fda4af', badgeBg: 'rgba(244,63,94,0.15)', badgeText: '#fb7185', inputBorder: '#f43f5e', inputColor: '#fb7185', inputBg: 'rgba(244,63,94,0.08)', btnBg: 'rgba(244,63,94,0.1)', btnBorder: 'rgba(244,63,94,0.25)' },
  { border: '#164e63', fill: '#06b6d4', fillDim: '#0e7490', locked: '#22d3ee', nameLocked: '#67e8f9', scoreLocked: '#67e8f9', badgeBg: 'rgba(6,182,212,0.15)', badgeText: '#22d3ee', inputBorder: '#06b6d4', inputColor: '#22d3ee', inputBg: 'rgba(6,182,212,0.08)', btnBg: 'rgba(6,182,212,0.1)', btnBorder: 'rgba(6,182,212,0.25)' },
] as const;

const scStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0f0f17',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    overflow: 'hidden',
    gap: 8,
  },
  lockedLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: '#6366f1',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  name: { color: '#64748b', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 4 },
  starsRow: { flexDirection: 'row', minHeight: 16, justifyContent: 'center' },
  starsText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  track: { height: 3, backgroundColor: '#1a1a2e', borderRadius: 99, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 99, backgroundColor: '#312e81' },
  score: { color: '#e2e8f0', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  scoreNeg: { color: '#ef4444' },
  target: { color: '#334155', fontSize: 13, fontWeight: '400' },
  guessRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  guessInputWrap: { flex: 1 },
  guessInput: {
    backgroundColor: '#0a0a14',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  guessInputError: { borderColor: '#7f1d1d' },
  lockBtn: {
    width: 38, height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: -4,
  },
  lockedBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  hostBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: 'rgba(148,163,184,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.5)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  hostBadgeText: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
});

function ScoreCard({
  name,
  score,
  targetScore,
  stars,
  guess,
  onChangeGuess,
  isGuessLocked,
  onToggleLock,
  isGuessingPhase,
  playerIndex,
  isHostPlayer,
}: {
  name: string;
  score: number;
  targetScore: number;
  stars: number;
  guess: string;
  onChangeGuess: (v: string) => void;
  isGuessLocked: boolean;
  onToggleLock: () => void;
  isGuessingPhase: boolean;
  playerIndex: number;
  isHostPlayer: boolean;
}) {
  const pct = Math.max(0, Math.min(score / targetScore, 1));
  const isNeg = score < 0;
  const isValid = isValidYear(guess);
  const c = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
  const starIndicator = stars <= 0 ? null : (stars === 1 ? '✦' : `✦ ${stars}`);

  return (
    <View style={[
      scStyles.wrap,
      { borderColor: isGuessLocked ? c.locked : c.border },
      isGuessLocked && { backgroundColor: '#0d0d1a' },
      isHostPlayer && { borderColor: '#e2e8f0', borderWidth: 2 },
    ]}>
      {isHostPlayer && (
        <View style={scStyles.hostBadge}>
          <RNText style={scStyles.hostBadgeText}>DU</RNText>
        </View>
      )}
      {isGuessLocked && (
        <View style={[scStyles.lockedLine, { backgroundColor: c.locked }]} />
      )}

      <View style={scStyles.header}>
        <RNText
          style={[scStyles.name, isGuessLocked && { color: c.nameLocked }]}
          numberOfLines={1}
        >
          {name}
        </RNText>
        <View style={[scStyles.starsRow, isHostPlayer && { marginRight: 34 }]}> 
          {starIndicator ? <RNText style={scStyles.starsText}>{starIndicator}</RNText> : null}
        </View>
      </View>

      {/* Progress bar */}
      <View style={scStyles.track}>
        <View style={[scStyles.fill, { width: `${pct * 100}%`, backgroundColor: isGuessLocked ? c.fill : c.fillDim }]} />
      </View>

      <RNText style={[
        scStyles.score,
        isNeg && scStyles.scoreNeg,
        isGuessLocked && { color: c.scoreLocked },
      ]}>
        {score}
        <RNText style={scStyles.target}>/{targetScore}</RNText>
      </RNText>

      {/* Gissningsfält – visas bara under gissningsfasen */}
      {isGuessingPhase && (
        <View style={scStyles.guessRow}>
          <View style={scStyles.guessInputWrap}>
            <TextInput
              style={[
                scStyles.guessInput,
                isGuessLocked && { borderColor: c.inputBorder, color: c.inputColor, backgroundColor: c.inputBg },
                guess.length === 4 && !isValid && scStyles.guessInputError,
              ]}
              placeholder="År?"
              placeholderTextColor="#2d3748"
              keyboardType="number-pad"
              value={isGuessLocked ? '••••' : guess}
              onChangeText={v => {
                if (!isGuessLocked) onChangeGuess(v.replace(/\D/g, '').slice(0, 4));
              }}
              editable={!isGuessLocked}
              maxLength={4}
            />
          </View>
          {guess.length === 4 && isValid && (
            <TouchableOpacity
              onPress={onToggleLock}
              style={[scStyles.lockBtn, { backgroundColor: c.btnBg, borderColor: c.btnBorder }]}
              activeOpacity={0.7}
            >
              {isGuessLocked
                ? <EyeOff size={18} color={c.inputColor} />
                : <Eye size={18} color="#475569" />}
            </TouchableOpacity>
          )}
        </View>
      )}

      {isGuessLocked && isGuessingPhase && (
        <View style={[scStyles.lockedBadge, { backgroundColor: c.badgeBg }]}>
          <RNText style={[scStyles.lockedBadgeText, { color: c.badgeText }]}>KLAR ✓</RNText>
        </View>
      )}
    </View>
  );
}

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
          {result.skipped ? '–' : `${pts > 0 ? '+' : ''}${pts}`}
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
  hostPlayerIndex,
  onChangeHostPlayerIndex,
  targetScore,
  maxRounds,
  gameId,
  onBackToMenu,
  headerHeight,
  onScroll,
}: Props) {
  const { user } = useAuth();

  const persistKey = user && gameId ? PERSIST_QUEUE_KEY(user.uid, gameId) : undefined;
  const stateKey   = user && gameId ? PERSIST_STATE_KEY(user.uid, gameId) : undefined;

  const logic = useScoreBattleLogic(playerNames, targetScore, maxRounds);
  const {
    scores, stars, phase,
    soloMode,
    roundResults, songCount, winnerIdxs,
    pendingGameOver,
    confirmGuesses, nextSong, resetGame,
    _restore,
  } = logic;

  const { card, setCard, isLoadingCard, generateCard } = useGenerateSongs(gameMode, persistKey);

  // ─── Persist: ladda spelstate vid mount ────────────────────────────────────

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

  useEffect(() => {
    if (!isRestoreLoaded) return;
    if (restoredCardRef.current) {
      setCard(restoredCardRef.current);
    } else {
      generateCard();
    }
  }, [isRestoreLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Persist: spara spelstate ─────────────────────────────────────────────

  useEffect(() => {
    if (!user || !gameId) return;
    if (phase === 'game_over') {
      deleteActiveGame(user.uid, gameId).catch(() => {});
      return;
    }
    saveScoreBattleMeta(
      user.uid, gameId,
      playerNames,
      scores, gameMode, targetScore, maxRounds
    ).catch(() => {});
  }, [user, gameId, scores, phase, playerNames, gameMode, targetScore, maxRounds]);

  useEffect(() => {
    if (!stateKey) return;
    if (phase === 'game_over') {
      AsyncStorage.removeItem(stateKey).catch(() => {});
      return;
    }
    AsyncStorage.setItem(stateKey, JSON.stringify({
      scores, stars, songCount, currentCard: card, phase, roundResults,
    })).catch(() => {});
  }, [stateKey, scores, stars, songCount, phase, card, roundResults]);

  // ─── Ljud (samma mönster som DuoGameScreen: ref + URL-state + useEffect) ───

  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewPlayer = useAudioPlayer(currentPreviewUrl ?? '');
  const playerRef = useRef(previewPlayer);
  const playerStatus = useAudioPlayerStatus(previewPlayer);

  useEffect(() => { playerRef.current = previewPlayer; }, [previewPlayer]);

  // Auto-play när URL sätts och isPlaying är true
  useEffect(() => {
    if (currentPreviewUrl && isPlaying) {
      playerRef.current?.play();
    }
  }, [currentPreviewUrl, isPlaying]);

  // Detektera när låten tar slut
  useEffect(() => {
    if (isPlaying && playerStatus.didJustFinish) {
      setIsPlaying(false);
      setCurrentPreviewUrl(null);
    }
  }, [isPlaying, playerStatus.didJustFinish]);

  const stopAudio = useCallback(() => {
    try { playerRef.current?.pause(); } catch {}
    setIsPlaying(false);
    setCurrentPreviewUrl(null);
  }, []);

  const togglePreview = useCallback((previewUrl: string) => {
    if (!previewUrl) return;
    if (isPlaying && currentPreviewUrl === previewUrl) {
      playerRef.current?.pause();
      setIsPlaying(false);
      setCurrentPreviewUrl(null);
    } else {
      setCurrentPreviewUrl(previewUrl);
      setIsPlaying(true);
    }
  }, [isPlaying, currentPreviewUrl]);

  useEffect(() => {
    if (phase === 'song_summary' || phase === 'game_over') stopAudio();
  }, [phase, stopAudio]);

  useEffect(() => () => { stopAudio(); }, [stopAudio]);

  // ─── Gissningsstate – ett per spelare ────────────────────────────────────

  const numPlayers = playerNames.length;
  const [guesses, setGuesses] = useState<string[]>(() => Array(numPlayers).fill(''));
  const [locked, setLocked]   = useState<boolean[]>(() => Array(numPlayers).fill(false));
  const [showQR, setShowQR]   = useState(false);
  const [isSongInfoVisible, setIsSongInfoVisible] = useState(false);
  const [hostSelectorExpanded, setHostSelectorExpanded] = useState(false);
  const songInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressDidFireRef = useRef(false);
  const [songHistory, setSongHistory] = useState<SongHistoryEntry[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const playAgainScaleAnim = useRef(new RNAnimated.Value(1)).current;
  const backMenuScaleAnim  = useRef(new RNAnimated.Value(1)).current;
  const nextSongScaleAnim  = useRef(new RNAnimated.Value(1)).current;

  // ─── Webb-gissningar från Firestore ──────────────────────────────────────

  const handleWebGuess = useCallback((playerIndex: number, year: number, isLocked: boolean) => {
    setGuesses(prev => {
      const n = [...prev];
      n[playerIndex] = String(year);
      return n;
    });
    // Always sync locked state — including unlock (isLocked=false)
    setLocked(prev => {
      const n = [...prev];
      n[playerIndex] = isLocked;
      return n;
    });
  }, []);

  const { webUrl, clearWebGuesses, deleteRoom } = useScoreBattleSync({
    gameId,
    hostUid: user?.uid ?? null,
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
    onWebGuess: handleWebGuess,
  });

  // ─── Gissningsstate – ett per spelare ────────────────────────────────────

  // Nollställ gissningar inför ny runda
  const resetRound = useCallback(async () => {
    await stopAudio();
    setGuesses(Array(numPlayers).fill(''));
    setLocked(Array(numPlayers).fill(false));
    setIsSongInfoVisible(false);
    if (songInfoTimerRef.current) clearTimeout(songInfoTimerRef.current);
    clearWebGuesses();
  }, [stopAudio, numPlayers, clearWebGuesses]);

  const handleChangeGuess = useCallback((idx: number, v: string) => {
    setGuesses(prev => { const n = [...prev]; n[idx] = v; return n; });
  }, []);

  const handleToggleLock = useCallback((idx: number) => {
    setLocked(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; });
  }, []);

  // Alla spelare måste ha fyllt i ett giltigt år OCH låst sin gissning
  const allReady = useMemo(() => {
    return guesses.every((g, i) => isValidYear(g) && locked[i]);
  }, [guesses, locked]);

  // ─── Bekräfta alla gissningar ────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (!card || !allReady) return;
    const guessList = guesses.map(g => ({ guessYear: parseInt(g, 10), skipped: false }));
    setSongHistory(prev => [...prev, {
      artist: card.artist,
      title: card.title,
      year: card.year,
      results: guessList.map(g => ({
        guessYear: g.guessYear,
        points: calcPoints(g.guessYear, card.year),
        skipped: false,
      })),
    }]);
    confirmGuesses(guessList, card.year);
  }, [card, allReady, guesses, confirmGuesses]);

  // ─── Nästa / reset låt ───────────────────────────────────────────────────

  const handleNextSong = useCallback(async () => {
    await resetRound();
    nextSong();
    generateCard();
  }, [nextSong, generateCard, resetRound]);

  const handlePlayAgain = useCallback(async () => {
    await resetRound();
    if (stateKey) AsyncStorage.removeItem(stateKey).catch(() => {});
    setSongHistory([]);
    resetGame();
    generateCard();
  }, [resetGame, generateCard, resetRound, stateKey]);

  const handleSkipSong = useCallback(async () => {
    setIsSongInfoVisible(false);
    await resetRound();
    generateCard();
  }, [resetRound, generateCard]);

  const isGuessingPhase = phase === 'guessing';
  const modeLabel = GAME_MODE_LABELS[gameMode] ?? GAME_MODE_LABELS.default;
  const modeParts = splitGameModeName(modeLabel);
  const modeInlineLabel = modeParts.years ? `${modeParts.name} ${modeParts.years}` : modeParts.name;
  const safeHostPlayerIndex = Math.min(Math.max(hostPlayerIndex, 0), Math.max(playerNames.length - 1, 0));

  // ─── Game Over ─────────────────────────────────────────────────────────────

  if (phase === 'game_over') {
    const hasCoWinners = winnerIdxs.length > 1;
    const winnerSet = new Set(winnerIdxs);
    const winner = winnerIdxs.length > 0
      ? winnerIdxs.map(i => playerNames[i] ?? `Spelare ${i + 1}`).join(' & ')
      : '?';
    const HISTORY_PREVIEW = 3;
    const sortedByInterest = songHistory
      .map((entry, origIdx) => ({ entry, origIdx }))
      .sort((a, b) => {
        const score = (e: SongHistoryEntry) =>
          Math.max(0, ...e.results.filter((r): r is RoundResult => r !== null).map(r => Math.abs(r.points)));
        return score(b.entry) - score(a.entry);
      });
    const displayedHistory = historyExpanded
      ? songHistory.map((entry, origIdx) => ({ entry, origIdx }))
      : sortedByInterest.slice(0, HISTORY_PREVIEW);
    const hasMoreHistory = songHistory.length > HISTORY_PREVIEW;
    return (
      <View style={{ flex: 1, backgroundColor: '#07070d' }}>
        <ScrollView contentContainerStyle={s.gameOverScroll}>
          <View style={s.gameOverInner}>
            <View style={s.trophyCircle}>
              <Trophy size={52} color="#f59e0b" />
            </View>
            <RNText style={s.winnerSub}>{hasCoWinners ? 'Vinnarna är' : 'Vinnaren är'}</RNText>
            <RNText style={s.winnerName}>🏆 {winner}</RNText>

            <View style={s.finalScores}>
              {playerNames.map((name, i) => (
                <View key={name} style={[s.finalRow, i < playerNames.length - 1 && s.finalRowBorder]}>
                  <RNText style={[s.finalName, winnerSet.has(i) && s.finalNameWinner]}>
                    {winnerSet.has(i) ? '🏆 ' : ''}{name}
                  </RNText>
                  <RNText style={[s.finalPts, winnerSet.has(i) && s.finalPtsWinner]}>
                    {scores[i]}p
                  </RNText>
                </View>
              ))}
            </View>

            <RNText style={s.songCount}>{songCount + 1} omgångar spelades</RNText>

            {/* ── Spelhistorik ── */}
            {songHistory.length > 0 && (
              <View style={s.historySection}>
                <RNText style={s.historyHeader}>SPELHISTORIK</RNText>
                {displayedHistory.map(({ entry, origIdx }) => (
                  <View key={origIdx} style={s.historyCard}>
                    <View style={s.historyCardHead}>
                      <View style={s.historyNumBadge}>
                        <RNText style={s.historyNumText}>{'#' + (origIdx + 1)}</RNText>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <RNText style={s.historyArtist} numberOfLines={1}>{entry.artist}</RNText>
                        <RNText style={s.historyTitleYear} numberOfLines={1}>
                          {entry.title + ' · '}<RNText style={s.historyYearBold}>{String(entry.year)}</RNText>
                        </RNText>
                      </View>
                    </View>
                    <View style={s.historyResults}>
                      {entry.results.map((result, pi) => {
                        if (!result) return null;
                        const c = PLAYER_COLORS[pi % PLAYER_COLORS.length];
                        const pts = result.points;
                        const col = pointsColor(pts, result.skipped);
                        return (
                          <View key={pi} style={s.historyPlayerRow}>
                            <View style={[s.historyDot, { backgroundColor: c.fill }]} />
                            <RNText style={s.historyPlayerName} numberOfLines={1}>{playerNames[pi]}</RNText>
                            <RNText style={s.historyGuessText}>
                              {result.skipped ? '–' : String(result.guessYear)}
                            </RNText>
                            <View style={[s.historyPtsBadge, { backgroundColor: col + '25' }]}>
                              <RNText style={[s.historyPtsText, { color: col }]}>
                                {result.skipped ? '–' : (pts >= 0 ? '+' : '') + pts + 'p'}
                              </RNText>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
                {hasMoreHistory && (
                  <TouchableOpacity
                    onPress={() => setHistoryExpanded(v => !v)}
                    style={s.historyToggle}
                    activeOpacity={0.7}
                  >
                    <RNText style={s.historyToggleText}>
                      {historyExpanded
                        ? 'Dölj'
                        : `Visa alla ${songHistory.length} omgångar`}
                    </RNText>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Knappar ── */}
            <RNAnimated.View style={{ width: '100%', transform: [{ scale: playAgainScaleAnim }] }}>
              <TouchableOpacity
                onPress={handlePlayAgain}
                onPressIn={() => {
                  RNAnimated.spring(playAgainScaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
                }}
                onPressOut={() => {
                  RNAnimated.spring(playAgainScaleAnim, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 8 }).start();
                }}
                activeOpacity={1}
                style={{ width: '100%' }}
              >
                <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bigBtn}>
                  <RNText style={s.bigBtnText}>Spela igen</RNText>
                </LinearGradient>
              </TouchableOpacity>
            </RNAnimated.View>

            <RNAnimated.View style={{ width: '100%', transform: [{ scale: backMenuScaleAnim }] }}>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Avsluta spelet?',
                    'Spelet kommer att raderas för alla och ni måste starta om från början nästa gång. Är du säker?',
                    [
                      { text: 'Avbryt', style: 'cancel' },
                      {
                        text: 'Avsluta',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteRoom();
                          onBackToMenu();
                        },
                      },
                    ]
                  );
                }}
                onPressIn={() => {
                  RNAnimated.spring(backMenuScaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
                }}
                onPressOut={() => {
                  RNAnimated.spring(backMenuScaleAnim, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 8 }).start();
                }}
                activeOpacity={1}
                style={s.destructiveBtn}
              >
                <RNText style={s.destructiveBtnText}>Avsluta spelet</RNText>
              </TouchableOpacity>
            </RNAnimated.View>
          </View>
        </ScrollView>
      </View>
    );
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
        {/* ── Omgångsindikator + QR-knapp ── */}
        <View style={s.roundBadgeRow}>
          <View style={s.modeInlinePill}>
            <RNText style={s.modeInlineText} numberOfLines={1} ellipsizeMode="tail">
              {modeInlineLabel}
            </RNText>
          </View>

          <View style={s.roundBadge}>
            <RNText style={s.roundBadgeText}>
              {maxRounds !== null
                ? `Omgång ${songCount + 1} / ${maxRounds}`
                : `Omgång ${songCount + 1}`}
            </RNText>
          </View>
          {webUrl && (
            <TouchableOpacity onPress={() => setShowQR(true)} style={s.qrBtn} activeOpacity={0.7}>
              <QrCode size={18} color="#4f46e5" />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.hostSelectorWrap}>
          <TouchableOpacity
            onPress={() => setHostSelectorExpanded(v => !v)}
            activeOpacity={0.8}
            style={s.hostSelectorToggle}
          >
            <RNText style={s.hostSelectorToggleText} numberOfLines={1}>
              {`Jag: ${playerNames[safeHostPlayerIndex] ?? `Spelare ${safeHostPlayerIndex + 1}`}`}
            </RNText>
            <RNText style={s.hostSelectorToggleChevron}>{hostSelectorExpanded ? '▴' : '▾'}</RNText>
          </TouchableOpacity>

          {hostSelectorExpanded && (
            <View style={s.hostSelectorRow}>
              {playerNames.map((name, i) => {
                const active = safeHostPlayerIndex === i;
                return (
                  <TouchableOpacity
                    key={`host-${name}-${i}`}
                    onPress={() => {
                      onChangeHostPlayerIndex(i);
                      setHostSelectorExpanded(false);
                    }}
                    activeOpacity={0.8}
                    style={[s.hostSelectorPill, active && s.hostSelectorPillActive]}
                  >
                    <RNText style={[s.hostSelectorText, active && s.hostSelectorTextActive]} numberOfLines={1}>
                      {name}
                    </RNText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── QR Modal ── */}
        {showQR && webUrl && gameId && (
          <QRCodeModal
            gameId={gameId}
            url={webUrl}
            onClose={() => setShowQR(false)}
          />
        )}

        {/* ── Score-kort med inbyggda gissningar ── */}
        <View style={s.scoreGrid}>
          {playerNames.map((name, i) => (
            <View
              key={name + i}
              style={playerNames.length === 1 ? s.scoreGridFull : s.scoreGridItem}
            >
              <ScoreCard
                name={name}
                score={scores[i] ?? 0}
                targetScore={targetScore}
                stars={stars[i] ?? 0}
                guess={guesses[i] ?? ''}
                onChangeGuess={v => handleChangeGuess(i, v)}
                isGuessLocked={locked[i] ?? false}
                onToggleLock={() => handleToggleLock(i)}
                isGuessingPhase={isGuessingPhase}
                playerIndex={i}
                isHostPlayer={safeHostPlayerIndex === i}
              />
            </View>
          ))}
        </View>

        {/* ── Laddning ── */}
        {isLoadingCard && <CardSkeleton />}

        {/* ── Bekräfta-knapp + Kortvisning ── */}
        {isGuessingPhase && card && (
          <View style={s.guessSection}>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!allReady}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={allReady ? ['#4f46e5', '#7c3aed'] : ['#0f0f17', '#0f0f17']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.confirmBtn, !allReady && s.confirmDisabled]}
              >
                <RNText style={[s.confirmText, !allReady && { color: '#334155' }]}>
                  {allReady ? 'Avslöja svar' : 'Alla måste låsa sin gissning'}
                </RNText>
              </LinearGradient>
            </TouchableOpacity>

            <AnimatedCard
              showBack={false}
              card={card}
              onFlip={() => {}}
              showFlipButton={false}
              onPlayPreview={togglePreview}
              isPlayingPreview={isPlaying}
            />

            {/* ── Diskret låtinfo (felsökning) ── */}
            <Pressable
              onPressIn={() => {
                longPressDidFireRef.current = false;
                songInfoTimerRef.current = setTimeout(() => {
                  longPressDidFireRef.current = true;
                  setIsSongInfoVisible(true);
                }, 1200);
              }}
              onPressOut={() => {
                if (songInfoTimerRef.current) {
                  clearTimeout(songInfoTimerRef.current);
                  songInfoTimerRef.current = null;
                }
              }}
              onPress={() => {
                // Vanligt tryck: stäng om öppen (men inte om longpress precis triggade)
                if (!longPressDidFireRef.current && isSongInfoVisible) {
                  setIsSongInfoVisible(false);
                }
                longPressDidFireRef.current = false;
              }}
              style={({ pressed }) => [
                s.songInfoToggle,
                pressed && { backgroundColor: 'rgba(79,70,229,0.18)', opacity: 1 },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              {({ pressed }) => (
                <>
                  <Info size={11} color={(pressed || isSongInfoVisible) ? '#4f46e5' : '#2a3550'} />
                  <RNText style={[s.songInfoToggleText, (pressed || isSongInfoVisible) && { color: '#4f46e5' }]}>
                    info
                  </RNText>
                </>
              )}
            </Pressable>

            {isSongInfoVisible && (
              <View style={s.songInfoBox}>
                <View style={[s.songInfoRow, { flexDirection: 'row' }]}>
                  <RNText style={s.songInfoKey}>Artist  </RNText>
                  <RNText style={[s.songInfoVal, { flex: 1 }]}>{card.artist}</RNText>
                </View>
                <View style={[s.songInfoRow, { flexDirection: 'row' }]}>
                  <RNText style={s.songInfoKey}>Låt  </RNText>
                  <RNText style={[s.songInfoVal, { flex: 1 }]}>{card.title}</RNText>
                </View>
                <View style={[s.songInfoRow, { flexDirection: 'row' }]}>
                  <RNText style={s.songInfoKey}>År  </RNText>
                  <RNText style={s.songInfoVal}>{card.year}</RNText>
                </View>
                <TouchableOpacity
                  onPress={handleSkipSong}
                  style={s.skipSongBtn}
                  activeOpacity={0.7}
                >
                  <RNText style={s.skipSongBtnText}>{'⏭ SKIP LÅT'}</RNText>
                </TouchableOpacity>
              </View>
            )}
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
              {playerNames.map((name, i) => (
                <ResultRow key={name} name={name} result={roundResults[i] ?? null} actualYear={card.year} />
              ))}
            </View>

            <RNAnimated.View style={{ width: '100%', transform: [{ scale: nextSongScaleAnim }] }}>
              <TouchableOpacity
                onPress={handleNextSong}
                onPressIn={() => {
                  RNAnimated.spring(nextSongScaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
                }}
                onPressOut={() => {
                  RNAnimated.spring(nextSongScaleAnim, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 8 }).start();
                }}
                activeOpacity={1}
              >
                <LinearGradient
                  colors={pendingGameOver ? ['#b45309', '#92400e'] : ['#4f46e5', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.bigBtn}
                >
                  <RNText style={s.bigBtnText}>
                    {pendingGameOver
                      ? 'Se slutresultat  🏆'
                      : maxRounds !== null
                        ? `Nästa låt  ·  ${songCount + 1} / ${maxRounds}  ▶`
                        : 'Nästa låt  ▶'}
                  </RNText>
                </LinearGradient>
              </TouchableOpacity>
            </RNAnimated.View>
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
    paddingVertical: 32,
  },

  // Round badge
  roundBadgeRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  modeInlinePill: {
    maxWidth: '52%',
    backgroundColor: '#0f0f17',
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeInlineText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
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
  qrBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(79,70,229,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostSelectorWrap: {
    gap: 7,
    marginTop: -4,
  },
  hostSelectorToggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    backgroundColor: '#0f0f17',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hostSelectorToggleText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  hostSelectorToggleChevron: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  hostSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hostSelectorPill: {
    borderWidth: 1,
    borderColor: '#1a1a2e',
    backgroundColor: '#0f0f17',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '48%',
  },
  hostSelectorPillActive: {
    borderColor: '#4f46e5',
    backgroundColor: 'rgba(79,70,229,0.16)',
  },
  hostSelectorText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  hostSelectorTextActive: {
    color: '#c7d2fe',
  },

  // Score row
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  scoreGridItem: { width: '48.5%' },
  scoreGridFull: { width: '100%' },

  // Loading
  // Guessing
  guessSection: { gap: 12 },
  confirmBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  confirmDisabled: { opacity: 0.6 },
  confirmText: { color: '#fff', fontSize: 17, fontWeight: '700' },

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

  bigBtn: { paddingVertical: 17, borderRadius: 14, alignItems: 'center' },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  outlineBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
    width: '100%',
  },
  outlineBtnText: { color: '#334155', fontSize: 15, fontWeight: '600' },

  destructiveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.07)',
    width: '100%',
  },
  destructiveBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },

  gameOverScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },

  // Song history
  historySection: { width: '100%', gap: 8 },
  historyHeader: {
    color: '#1e293b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  historyCard: {
    backgroundColor: '#0d0d1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    overflow: 'hidden',
  },
  historyCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  historyNumBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  historyNumText: { color: '#818cf8', fontSize: 11, fontWeight: '800' },
  historyArtist: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  historyTitleYear: { color: '#475569', fontSize: 11 },
  historyYearBold: { color: '#64748b', fontWeight: '700' },
  historyResults: { paddingHorizontal: 12, paddingVertical: 8, gap: 5 },
  historyPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDot: { width: 6, height: 6, borderRadius: 3 },
  historyPlayerName: { color: '#475569', fontSize: 11, fontWeight: '600', flex: 1 },
  historyGuessText: { color: '#334155', fontSize: 11, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  historyPtsBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  historyPtsText: { fontSize: 11, fontWeight: '800' },

  historyToggle: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 99,
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
  },
  historyToggleText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Song info (debug)
  songInfoToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    opacity: 0.65,
  },
  songInfoToggleText: {
    color: '#2a3550',
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  songInfoBox: {
    backgroundColor: '#080810',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    padding: 12,
    gap: 5,
  },
  songInfoRow: { marginBottom: 2 },
  songInfoKey: { color: '#1e2535', fontSize: 11, fontWeight: '700' as const },
  songInfoVal: { color: '#334155', fontSize: 11 },
  skipSongBtn: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
    paddingTop: 8,
    alignItems: 'center' as const,
  },
  skipSongBtnText: {
    color: '#7f1d1d',
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1,
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
  finalRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  finalName: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  finalNameWinner: { color: '#f59e0b' },
  finalPts: { color: '#334155', fontSize: 24, fontWeight: '900' },
  finalPtsWinner: { color: '#f59e0b' },
  songCount: { color: '#1e293b', fontSize: 13, marginTop: 4, marginBottom: 8 },
});
