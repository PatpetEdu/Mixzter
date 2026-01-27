// functions/src/aiProvider.ts
/**
 * AI Provider abstraction layer for song generation
 * Supports multiple AI providers with fallback mechanism
 */

export type SongSuggestion = {
  artist: string;
  title: string;
  year: number;
  source?: string;
};

export interface AIProvider {
  name: string;
  generateSong(prompt: string): Promise<SongSuggestion | null>;
}

export type AIProviderConfig = {
  primaryProvider: 'openai' | 'gemini';
  fallbackProvider?: 'openai' | 'gemini';
  temperature?: number;
};
