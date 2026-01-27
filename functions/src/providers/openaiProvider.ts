// functions/src/providers/openaiProvider.ts
import OpenAI from 'openai';
import * as logger from 'firebase-functions/logger';
import { AIProvider, SongSuggestion } from '../aiProvider';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;
  private temperature: number;

  constructor(apiKey: string, temperature: number = 1.0) {
    this.client = new OpenAI({ apiKey });
    this.temperature = temperature;
  }

  async generateSong(prompt: string): Promise<SongSuggestion | null> {
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: this.temperature,
      });

      const rawContent = completion.choices[0].message?.content ?? "";
      
      if (!rawContent) {
        logger.warn('OpenAIProvider: Empty response from API');
        return null;
      }

      // Parse JSON response
      let parsedSong: any = null;
      try {
        const match = rawContent.match(/\{[\s\S]*\}/);
        if (match) {
          parsedSong = JSON.parse(match[0]);
        } else {
          logger.warn('OpenAIProvider: Could not find JSON in response:', rawContent);
          return null;
        }
      } catch (jsonErr) {
        logger.warn('OpenAIProvider: Could not parse JSON:', rawContent, jsonErr);
        return null;
      }

      // Validate required fields
      if (!parsedSong?.artist || !parsedSong?.title || !parsedSong?.year) {
        logger.warn('OpenAIProvider: Invalid JSON format:', parsedSong);
        return null;
      }

      return {
        artist: String(parsedSong.artist),
        title: String(parsedSong.title),
        year: Number(parsedSong.year),
        ...(parsedSong.source && { source: String(parsedSong.source) }),
      };
    } catch (error) {
      logger.error('OpenAIProvider: Error generating song:', error);
      return null;
    }
  }
}
