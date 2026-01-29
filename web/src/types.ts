export interface Player {
  name: string;
  startYear?: number;
  timeline: number[];
  stars: number;
  score: number;
  cards?: Card[];
  userId: string;
}

export interface Card {
  year: number;
  title: string;
  artist: string;
  spotifyId: string;
  imageUrl: string;
  spotifyUrl?: string;
  source?: string;
  artworkUrl?: string;
}

export interface Game {
  gameCode: string;
  publicToken: string;
  hostUid: string;
  players: { [key: string]: Player };
  currentCard?: Card;
  currentSong?: Card;
  roundCards?: Card[];
  status: 'waiting' | 'playing' | 'finished';
  gameState?: {
    activePlayer?: string;
    backCardUnlocked?: boolean;
    wasCorrect?: boolean | null;
    shareSpotifyUrl?: boolean;
  };
  createdAt: number;
}
