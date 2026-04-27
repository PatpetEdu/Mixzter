// =============================
// File: storage/gameStorage.ts (uppdaterad)
// =============================

import AsyncStorage from '@react-native-async-storage/async-storage';

// Återanvänd befintliga typer från appen
export type Card = {
  title: string;
  artist: string;
  year: number;
  spotifyUrl: string;
  source?: string;
  previewData?: {
    previewUrl: string;
    artworkUrl?: string;
    externalUrl: string;
    previewProvider: 'itunes' | 'deezer';
  };
};
export type Player = { name: string; timeline: number[]; cards: Card[]; startYear: number; stars: number };

// 🔸 NYTT: UI-snapshot-typ för att kunna återställa exakt läge (front/back, input m.m.)
export type DuoUiSnapshot = {
  showBack: boolean;
  guess: string;
  showPlacementChoice: boolean;
  placement: 'before' | 'after' | null;
  isSongInfoVisible: boolean;
  guessConfirmed: boolean;
};

// 🔸 UPPDATERAD: SavedDuoGameState innehåller nu även aktuell låt + UI + postGuess
export type SavedDuoGameState = {
  id: string;
  playerNames: string[];  // Array of player names (2-5 players)
  gameMode: string;  // 🔸 NYTT: Spara det aktuella game mode
  players: { [key: string]: Player };
  activePlayer: string;
  roundCards: Card[];
  createdAt: number;
  updatedAt: number;
  isCompleted?: boolean;

  // NYTT: den låt som just nu visas i spelet (front eller back)
  currentCard?: Card | null;

  // NYTT: snapshot av UI-läget så vi kan återgå exakt (t.ex. “Rätt gissat!”-skärmen)
  uiSnapshot?: DuoUiSnapshot;

  // NYTT: om vi är i post-guess-läge, spara facitindikator
  postGuess?: { card: Card | null; wasCorrect: boolean };
};

export type ActiveGameMeta = {
  id: string;
  playerNames: string[];
  scores: { [playerName: string]: number };
  gameMode: string;
  gameType: 'duo' | 'score';  // distinktion mellan spellägen
  updatedAt: number;
  targetScore?: number;       // Score Battle: poängmål
  maxRounds?: number | null;  // Score Battle: max omgångar (null = obegränsat)
};

const ACTIVE_GAMES_INDEX = (uid: string) => `activeGames:${uid}`;
const ACTIVE_GAME_KEY = (uid: string, id: string) => `activeGame:${uid}:${id}`;

function safeParse<T>(raw: string | null, fallback: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

function computeScores(players: { [key: string]: Player }, playerNames: string[]) {
  const scores: { [playerName: string]: number } = {};
  for (const playerName of playerNames) {
    scores[playerName] = players[playerName]?.timeline?.length ?? 0;
  }
  return scores;
}

export async function getActiveGames(uid: string): Promise<ActiveGameMeta[]> {
  const raw = await AsyncStorage.getItem(ACTIVE_GAMES_INDEX(uid));
  const list = safeParse<ActiveGameMeta[]>(raw, []);
    // Sortera senaste överst
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadActiveGame(uid: string, gameId: string): Promise<SavedDuoGameState | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_GAME_KEY(uid, gameId));
  return safeParse<SavedDuoGameState | null>(raw, null);
}

export async function saveActiveGame(uid: string, state: SavedDuoGameState): Promise<void> {
    // 1) Spara fullständigt state
  await AsyncStorage.setItem(ACTIVE_GAME_KEY(uid, state.id), JSON.stringify(state));

    // 2) Uppdatera index-listan (metadata för meny)
  const rawList = await AsyncStorage.getItem(ACTIVE_GAMES_INDEX(uid));
  const list = safeParse<ActiveGameMeta[]>(rawList, []);

  const scores = computeScores(state.players, state.playerNames);
  const meta: ActiveGameMeta = {
    id: state.id,
    playerNames: state.playerNames,
    scores,
    gameMode: state.gameMode,
    gameType: 'duo',
    updatedAt: state.updatedAt,
  };

  const idx = list.findIndex((m) => m.id === state.id);
  if (idx >= 0) list[idx] = meta; else list.push(meta);

  await AsyncStorage.setItem(ACTIVE_GAMES_INDEX(uid), JSON.stringify(list));
}

/** Registrera ett Score Battle-spel i index utan att spara fullt state (state sparas i ScoreBattleScreen) */
export async function saveScoreBattleMeta(
  uid: string,
  id: string,
  playerNames: string[],
  scores: number[],
  gameMode: string,
  targetScore?: number,
  maxRounds?: number | null,
): Promise<void> {
  const rawList = await AsyncStorage.getItem(ACTIVE_GAMES_INDEX(uid));
  const list = safeParse<ActiveGameMeta[]>(rawList, []);
  const scoresMap: { [playerName: string]: number } = {};
  playerNames.forEach((name, i) => { scoresMap[name] = scores[i] ?? 0; });
  const meta: ActiveGameMeta = {
    id,
    playerNames,
    scores: scoresMap,
    gameMode,
    gameType: 'score',
    updatedAt: Date.now(),
    targetScore,
    maxRounds,
  };
  const idx = list.findIndex(m => m.id === id);
  if (idx >= 0) list[idx] = meta; else list.push(meta);
  await AsyncStorage.setItem(ACTIVE_GAMES_INDEX(uid), JSON.stringify(list));
}

export async function deleteActiveGame(uid: string, gameId: string): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_GAME_KEY(uid, gameId));
  const rawList = await AsyncStorage.getItem(ACTIVE_GAMES_INDEX(uid));
  const list = safeParse<ActiveGameMeta[]>(rawList, []);
  const filtered = list.filter((m) => m.id !== gameId);
  await AsyncStorage.setItem(ACTIVE_GAMES_INDEX(uid), JSON.stringify(filtered));
}

export function generateGameId(): string {
   // Enkel kollisionstolerant ID (räcker för lokal användning)
  return `duo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
