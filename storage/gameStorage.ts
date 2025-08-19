// =============================
// File: storage/gameStorage.ts (NY FIL)
// =============================

// Ansvar: All hantering av "pågående spel" i AsyncStorage
// - Max 2 aktiva spel per användare (hanteras i App.tsx vid start)
// - Per-användare nycklar via Firebase UID
// - Säkra JSON-parsers, defensiv felhantering

import AsyncStorage from '@react-native-async-storage/async-storage';

// Återanvänd befintliga typer från appen
export type Card = { title: string; artist: string; year: number; spotifyUrl: string };
export type Player = { name: string; timeline: number[]; cards: Card[]; startYear: number; stars: number };

export type SavedDuoGameState = {
  id: string;
  player1Name: string;
  player2Name: string;
  players: { [key: string]: Player };
  activePlayer: string;
  roundCards: Card[];
  createdAt: number;
  updatedAt: number;
  isCompleted?: boolean;
};

export type ActiveGameMeta = {
  id: string;
  player1: string;
  player2: string;
  p1Score: number;
  p2Score: number;
  updatedAt: number;
};

const ACTIVE_GAMES_INDEX = (uid: string) => `activeGames:${uid}`;
const ACTIVE_GAME_KEY = (uid: string, id: string) => `activeGame:${uid}:${id}`;

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function computeScores(players: { [key: string]: Player }, p1: string, p2: string) {
  const p1Score = players[p1]?.timeline?.length ?? 0;
  const p2Score = players[p2]?.timeline?.length ?? 0;
  return { p1Score, p2Score };
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

  const { p1Score, p2Score } = computeScores(state.players, state.player1Name, state.player2Name);
  const meta: ActiveGameMeta = {
    id: state.id,
    player1: state.player1Name,
    player2: state.player2Name,
    p1Score,
    p2Score,
    updatedAt: state.updatedAt,
  };

  const idx = list.findIndex((m) => m.id === state.id);
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