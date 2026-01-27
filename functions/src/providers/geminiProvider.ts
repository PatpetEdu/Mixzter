// functions/src/providers/geminiProvider.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as logger from 'firebase-functions/logger';
import { AIProvider, SongSuggestion } from '../aiProvider';

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private client: GoogleGenerativeAI;
  private model: any;
  private temperature: number;

  constructor(apiKey: string, temperature: number = 1.0) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.temperature = temperature;
    // Use Gemini Flash 2.0 - fast and cost-effective
    this.model = this.client.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: this.temperature,
        responseMimeType: 'application/json',
      }
    });
  }

  async generateSong(prompt: string): Promise<SongSuggestion | null> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      if (!text) {
        logger.warn('GeminiProvider: Empty response from API');
        return null;
      }

      // Parse JSON response
      let parsedSong: any = null;
      try {
        // Try direct parse first (since we set responseMimeType to JSON)
        parsedSong = JSON.parse(text);
      } catch (jsonErr) {
        // Fallback: extract JSON from markdown code blocks or other text
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          parsedSong = JSON.parse(match[0]);
        } else {
          logger.warn('GeminiProvider: Could not parse JSON:', text);
          return null;
        }
      }

      // Validate required fields
      if (!parsedSong?.artist || !parsedSong?.title || !parsedSong?.year) {
        logger.warn('GeminiProvider: Invalid JSON format:', parsedSong);
        return null;
      }

      return {
        artist: String(parsedSong.artist),
        title: String(parsedSong.title),
        year: Number(parsedSong.year),
        ...(parsedSong.source && { source: String(parsedSong.source) }),
      };
    } catch (error) {
      logger.error('GeminiProvider: Error generating song:', error);
      return null;
    }
  }
}
