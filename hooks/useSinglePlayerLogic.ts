// hooks/useSinglePlayerLogic.ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SingleCard = {
  title: string;
  artist: string;
  year: number;
  previewUrl: string;
  externalUrl?: string;
  artworkUrl?: string;
  source?: 'itunes' | 'deezer';
};

type Player = {
  name: string;
  startYear: number;
  timeline: number[];
  cards: SingleCard[];
  stars: number;
};

const WINNING_SCORE = 10;
const MAX_STARS = 5;
const HS_KEY = 'singleHighscore';

function randomStartYear() {
  return Math.floor(Math.random() * (2025 - 1970 + 1)) + 1970;
}

export function useSinglePlayerLogic(onNewCardNeeded: () => void) {
  const [player, setPlayer] = useState<Player>({
    name: 'Du',
    startYear: randomStartYear(),
    timeline: [],
    cards: [],
    stars: 1,
  });

  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [exactHit, setExactHit] = useState(false);
  const [highscore, setHighscore] = useState(0);
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);

  // ladda highscore en gång
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HS_KEY);
        if (raw) setHighscore(Math.max(0, parseInt(raw, 10) || 0));
      } catch {}
    })();
  }, []);

  // vinst-koll
  useEffect(() => {
    if (player.timeline.length >= WINNING_SCORE) {
      setGameOverMessage('🎉 Du klarade 10 kort! Grymt jobbat!');
    }
  }, [player.timeline.length]);

  const updateHighscoreIfNeeded = (newStreak: number) => {
    if (newStreak > highscore) {
      setHighscore(newStreak);
      AsyncStorage.setItem(HS_KEY, String(newStreak)).catch(() => {});
    }
  };

  const resetGame = () => {
    setPlayer({
      name: 'Du',
      startYear: randomStartYear(),
      timeline: [],
      cards: [],
      stars: 1,
    });
    setWasCorrect(null);
    setExactHit(false);
    setGameOverMessage(null);
  };

  const skipSong = () => {
    if (player.stars <= 0) return;
    setPlayer((prev) => ({ ...prev, stars: prev.stars - 1 }));
    setWasCorrect(null);
    setExactHit(false);
    onNewCardNeeded();
  };

  // huvudlogik: gissning + placering
  const confirmGuess = (guess: string, card: SingleCard, placement?: 'before' | 'after') => {
    const guessedYear = parseInt(guess, 10);
    const baseTimeline = [player.startYear, ...player.timeline].sort((a, b) => a - b);

    // exakt årtal => alltid rätt + auto-stjärna
    if (card.year === guessedYear) {
      setWasCorrect(true);
      setExactHit(true);
      setPlayer((prev) => {
        const timeline = [...prev.timeline, card.year].sort((a, b) => a - b);
        const stars = Math.min(prev.stars + 1, MAX_STARS);
        const cards = [...prev.cards, card];
        updateHighscoreIfNeeded(timeline.length);
        return { ...prev, timeline, cards, stars };
      });
      return;
    }

    let lower = -Infinity;
    let upper = Infinity;
    let correct = false;

    if (placement) {
      const idx = baseTimeline.indexOf(guessedYear);
      if (placement === 'before') {
        upper = guessedYear;
        if (idx > 0) lower = baseTimeline[idx - 1];
        // kortår måste hamna strikt mellan lower och upper
        correct = card.year > lower && card.year < upper;
      } else {
        lower = guessedYear;
        if (idx < baseTimeline.length - 1) upper = baseTimeline[idx + 1];
        correct = card.year > lower && card.year < upper;
      }
    } else {
      // normal gissning
      const upperIdx = baseTimeline.findIndex((y) => y > guessedYear);
      if (upperIdx === -1) {
        lower = baseTimeline[baseTimeline.length - 1];
      } else if (upperIdx === 0) {
        upper = baseTimeline[0];
      } else {
        lower = baseTimeline[upperIdx - 1];
        upper = baseTimeline[upperIdx];
      }
      // tillåtet intervall: (lower, upper] – som i din duologistik
      correct = card.year > lower && card.year <= upper;
    }

    setWasCorrect(correct);
    setExactHit(false);

    if (correct) {
      setPlayer((prev) => {
        const timeline = [...prev.timeline, card.year].sort((a, b) => a - b);
        const cards = [...prev.cards, card];
        updateHighscoreIfNeeded(timeline.length);
        return { ...prev, timeline, cards };
      });
    } else {
      // FEL: rensa tidslinjen (behåll startYear & stars)
      setPlayer((prev) => ({
        ...prev,
        timeline: [],
        cards: [],
      }));
    }
  };

  return {
    player,
    wasCorrect,
    exactHit,
    highscore,
    gameOverMessage,
    skipSong,
    confirmGuess,
    resetGame,
  };
}
