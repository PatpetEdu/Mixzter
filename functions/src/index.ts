// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import axios from "axios";

// 🔒 Admin SDK – init bara EN gång
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Request } from "firebase-functions/v2/https";

// AI Provider imports
import { AIProvider } from "./aiProvider";
import { GeminiProvider } from "./providers/geminiProvider";
import { OpenAIProvider } from "./providers/openaiProvider";
import { optimizeSeenSongsList } from "./utils/seenSongsOptimizer";

// 👇 re-exportera dina Apple/Preview-funktioner
export * from "./appleIndex";

// ✅ Guard: init endast om ingen app finns
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const adminAuth = getAuth();

// Definiera hemligheter - Gemini är nu primär, OpenAI är fallback
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const openaiApiKey = defineSecret("OPENAI_API_KEY");
const spotifyClientId = defineSecret("SPOTIFY_CLIENT_ID");
const spotifyClientSecret = defineSecret("SPOTIFY_CLIENT_SECRET");

let accessToken: string | null = null;
let tokenExpiresAt = 0;

type Card = {
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

const CURRENT_YEAR = new Date().getFullYear();
const MAX_USER_SEEN_SONGS_HISTORY = 500;
// Reduced from 5 to 3 - providers are more reliable now
const MAX_AI_GENERATION_TRIES = 3;
const MAX_SPOTIFY_SEARCH_ATTEMPTS = 3;
// Optimize seen songs list to reduce prompt size and costs
const MAX_SEEN_SONGS_IN_PROMPT = 100;

// ====================
// Apple/Deezer Search Types & Helpers
// ====================
type SearchMatch = {
  previewUrl: string;
  externalUrl: string;
  artworkUrl?: string;
  matchedArtist: string;
  matchedTitle: string;
  source: 'itunes' | 'deezer';
  yearGuess?: number;
};

function normalize(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeTitleForMatch(title: string): string {
  const t = normalize(title)
    .replace(/\b(remix|remastered|radio edit|karaoke|tribute|cover|version|edit|extended|club mix|live)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((w) => w.length > 1));
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  return inter / Math.max(a.size, b.size);
}

function artistMatches(found: string, want: string): boolean {
  const f = tokens(found);
  const w = tokens(want);
  const overlap = tokenOverlap(f, w);
  if (overlap >= 0.5) return true;
  const fn = normalize(found), wn = normalize(want);
  return fn.includes(wn) || wn.includes(fn);
}

function titleMatches(found: string, want: string): boolean {
  const fn = normalizeTitleForMatch(found);
  const wn = normalizeTitleForMatch(want);
  if (fn === wn) return true;
  const f = tokens(fn), w = tokens(wn);
  return tokenOverlap(f, w) >= 0.6;
}

async function searchApple(artist: string, title: string, wantYear?: number): Promise<SearchMatch | null> {
  try {
    const { data } = await axios.get('https://itunes.apple.com/search', {
      params: { term: `${artist} ${title}`.trim(), media: 'music', entity: 'song', limit: 10 },
      timeout: 10000,
    });
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    
    // Filter out clear non-original versions (but allow remasters and edits as they're often originals)
    const excludePatterns = /remix|cover|live|acoustic|version|alternate|karaoke/i;
    
    const candidates: SearchMatch[] = results
      .filter((r) => r?.previewUrl && !excludePatterns.test(r.trackName || ''))
      .map((r) => ({
        previewUrl: String(r.previewUrl),
        externalUrl: String(r.trackViewUrl || r.collectionViewUrl || ''),
        artworkUrl: String(r.artworkUrl600 || r.artworkUrl250 || r.artworkUrl170 || r.artworkUrl100 || r.artworkUrl60 || ''),
        matchedArtist: String(r.artistName || ''),
        matchedTitle: String(r.trackName || ''),
        source: 'itunes' as const,
        yearGuess: r?.releaseDate ? Number(String(r.releaseDate).slice(0, 4)) : undefined,
      }));
    if (candidates.length === 0) return null;
    
    // Take first exact match instead of scoring all
    for (const c of candidates) {
      if (artistMatches(c.matchedArtist, artist) && titleMatches(c.matchedTitle, title)) {
        return c;
      }
    }
    return null;
  } catch (e) {
    logger.warn('searchApple error', e);
    return null;
  }
}

async function searchDeezer(artist: string, title: string, wantYear?: number): Promise<SearchMatch | null> {
  try {
    const { data } = await axios.get('https://api.deezer.com/search', {
      params: { q: `${artist} ${title}`.trim(), limit: 10 },
      timeout: 10000,
    });
    const arr: any[] = Array.isArray(data?.data) ? data.data : [];
    
    // Filter out clear non-original versions (but allow remasters and edits as they're often originals)
    const excludePatterns = /remix|cover|live|acoustic|version|alternate|karaoke/i;
    
    const candidates: SearchMatch[] = arr
      .filter((d) => d?.preview && !excludePatterns.test(d.title || ''))
      .map((d) => ({
        previewUrl: String(d.preview),
        externalUrl: String(d.link || (d.id ? `https://www.deezer.com/track/${d.id}` : '')),
        artworkUrl: String(d.album?.cover_medium || d.album?.cover || ''),
        matchedArtist: String(d.artist?.name || ''),
        matchedTitle: String(d.title || d.title_short || ''),
        source: 'deezer' as const,
        yearGuess: d?.release_date ? Number(String(d.release_date).slice(0, 4)) : undefined,
      }));
    if (candidates.length === 0) return null;
    
    // Take first exact match instead of scoring all
    for (const c of candidates) {
      if (artistMatches(c.matchedArtist, artist) && titleMatches(c.matchedTitle, title)) {
        return c;
      }
    }
    return null;
  } catch (e) {
    logger.warn('searchDeezer error', e);
    return null;
  }
}

const getUidFromRequest = async (req: Request): Promise<string | null> => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer ")) {
    logger.info("No Firebase ID token provided. Proceeding as anonymous user.");
    return null;
  }
  const idToken = req.headers.authorization.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    logger.error("Error while verifying Firebase ID token:", error);
    return null;
  }
};
const PROMPTS: Record<string, string> = {
  default: `Välj en **enbart en enda låt** som är slumpmässig, populär eller kulturellt betydelsefull från perioden **1950 till ${CURRENT_YEAR}**.
    Föredra låtar på engelska, men andra språk är också acceptabla om de är kända globalt.`,
  
  svenska: `Välj en **svensk låt** (sjungs på svenska eller av en mycket känd svensk artist) som är en klassiker, hit eller allsångsfavorit från **1960 till ${CURRENT_YEAR}**.`,
  
  eurovision: `Välj en låt som har tävlat i **Eurovision Song Contest** (oavsett land och placering) mellan **1956 och ${CURRENT_YEAR}**. Det ska vara en låt som många känner igen.`,
  
  rock: `Välj en låt inom genrerna **Rock, Hårdrock, Metal eller Punk** från perioden **1960 till ${CURRENT_YEAR}**. Det ska vara en känd låt inom genren.`,
  
  onehitwonder: `Välj en klassisk **One Hit Wonder** (artisten är främst känd för just denna låt) från **1970 till 2015**.`,
  
  filmmusik: `Välj en låt från en **film, TV-serie eller musikal** från **1950 till ${CURRENT_YEAR}**. Det kan vara en låt från soundtracken eller en känd tema-låt. Det ska vara en välkänd låt.`,
  
  disney: `Välj en populär animerad filmmusik från **Disney, Pixar eller DreamWorks Animation** från **1937 till ${CURRENT_YEAR}**. Det ska vara en välkänd låt från en klassisk eller modern animerad film.`,

  melodifestivalen: `Välj en låt som har tävlat i **Melodifestivalen** (Sverige) mellan **1958 och ${CURRENT_YEAR}**. Det ska vara en känd låt från tävlingen, gärna en vinnare eller finalist.`,

  kpop: `Välj en **K-POP låt** (skapad av en sydkoreansk artist) från **2000 till ${CURRENT_YEAR}**. Det ska vara en välkänd K-POP-låt som många känner till globalt.`,

  eightiesnineties: `Välj en populär och välkänd låt från genrer som Pop, Rock, Hip-Hop eller Dance från **1980 till 1999**. Det ska vara en klassiker från åttionde eller nittioende årtiondet.`,

  modernahits: `Välj en populär och välkänd låt från **2005 till ${CURRENT_YEAR}**. Det kan vara från genrer som Pop, Rock, Hip-Hop, R&B eller Dance. Det ska vara en hits som många känner igen från denna period.`,
};

export const generateCard = onRequest(
  { timeoutSeconds: 120, secrets: [geminiApiKey, openaiApiKey, spotifyClientId, spotifyClientSecret] },
  async (req, res) => {
    // Initialize AI providers (Gemini primary, OpenAI fallback)
    const providers: AIProvider[] = [];
    
    // Add Gemini as primary provider if API key is available
    if (geminiApiKey.value()) {
      providers.push(new GeminiProvider(geminiApiKey.value()));
      logger.info('Using Gemini as primary AI provider');
    }
    
    // Add OpenAI as fallback provider if API key is available
    if (openaiApiKey.value()) {
      providers.push(new OpenAIProvider(openaiApiKey.value()));
      logger.info(`Using OpenAI as ${providers.length === 1 ? 'primary' : 'fallback'} provider`);
    }
    
    if (providers.length === 0) {
      res.status(500).send("No AI provider configured. Please set GEMINI_API_KEY or OPENAI_API_KEY.");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed. Use POST.");
      return;
    }

    const uid = await getUidFromRequest(req);
    // 👇 Hämta gameMode från request body (defaultar till 'default' om det saknas)
    const { clientSeenSongs = [], gameMode = 'default' } = req.body; 
    const clientSeenSongsSet = new Set<string>(clientSeenSongs);

    // Välj rätt prompt-text. Fallback till default om gameMode är ogiltigt.
    const selectedModeDescription = PROMPTS[gameMode] || PROMPTS['default'];

    try {
      // ... (Koden för att hämta historik är oförändrad) ...
      // (Bara för referens: const collectionPath = uid ? ... )
      const collectionPath = uid ? `users/${uid}/seenSongs` : "globalSeenSongs";
      const seenSongsRef = db.collection(collectionPath);
      const snapshot = await seenSongsRef.orderBy("timestamp", "desc").limit(MAX_USER_SEEN_SONGS_HISTORY).get();
      const firestoreHistory = new Set<string>();
      snapshot.forEach((doc) => { firestoreHistory.add(doc.data().songIdentifier); });

      const allSeenSongs = new Set([...firestoreHistory, ...clientSeenSongsSet]);
      // ✨ NEW: Optimize seen songs list to reduce prompt size and costs
      const seenSongsPromptPart = optimizeSeenSongsList(allSeenSongs, MAX_SEEN_SONGS_IN_PROMPT);

      let finalSong: Card | null = null;
      let spotifyItem: any = null;
      let aiGenerationTries = 0;

      while (!finalSong && aiGenerationTries < MAX_AI_GENERATION_TRIES) {
        // 👇 HÄR BYGGER VI DEN DYNAMISKA PROMPTEN
        const isSourceMode = gameMode === 'filmmusik' || gameMode === 'disney';
        const jsonFormatExample = isSourceMode 
          ? `{
  "artist": "Artistens namn",
  "title": "Låtens titel",
  "year": 2009,
  "source": "Filmens eller seriens namn"
}` 
          : `{
  "artist": "Artistens namn",
  "title": "Låtens titel",
  "year": 2009
}`;
        
        const prompt = `${selectedModeDescription}

**Extremt viktigt:** Undvik **ALLA** låtar i följande lista: "${seenSongsPromptPart}".

Säkerställ **maximal variation** från tidigare svar.
Använd detta unika slumptal för att förstärka variationen: ${Math.random()}.

Svara **ENDAST** med ett JSON-objekt på följande exakta format:
${jsonFormatExample}`;

        // ✨ NEW: Try each AI provider in order (Gemini first, then OpenAI if available)
        let parsedAISong: any = null;
        let usedProvider: string = '';
        
        for (const provider of providers) {
          try {
            logger.info(`Attempting song generation with ${provider.name}`);
            parsedAISong = await provider.generateSong(prompt);
            
            if (parsedAISong) {
              usedProvider = provider.name;
              logger.info(`Successfully generated song with ${provider.name}`);
              break;
            }
          } catch (providerError) {
            logger.warn(`Provider ${provider.name} failed:`, providerError);
            // Continue to next provider
          }
        }

        if (!parsedAISong) {
          logger.warn("generateCard: All AI providers failed to generate a valid song");
          aiGenerationTries++;
          continue;
        }

        const currentSongIdentifier = `${parsedAISong.artist} - ${parsedAISong.title}`.toLowerCase().trim();

      // Behåll denna kontroll som en extra säkerhetsåtgärd ifall AI ignorerar instruktionen
        if (allSeenSongs.has(currentSongIdentifier)) {
          logger.info(
            `generateCard: AI provider (${usedProvider}) ignorerade instruktionen och föreslog en sedd låt: ${currentSongIdentifier}.`
          );
          aiGenerationTries++;
          continue;
        }

        if (!accessToken || Date.now() >= tokenExpiresAt) {
          try {
            const tokenRes = await axios.post(
              "https://accounts.spotify.com/api/token",
              new URLSearchParams({ grant_type: "client_credentials" }).toString(),
              {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Authorization:
                    "Basic " + Buffer.from(`${spotifyClientId.value()}:${spotifyClientSecret.value()}`).toString("base64"),
                },
              }
            );
            accessToken = tokenRes.data.access_token;
            tokenExpiresAt = Date.now() + tokenRes.data.expires_in * 1000;
          } catch (tokenErr) {
            logger.error("generateCard: Fel vid hämtning av Spotify token:", tokenErr);
            aiGenerationTries++;
            continue;
          }
        }

        let spotifySearchAttempts = 0;
        
        while (!spotifyItem && spotifySearchAttempts < MAX_SPOTIFY_SEARCH_ATTEMPTS) {
          try {
            const query = encodeURIComponent(`${parsedAISong.artist} ${parsedAISong.title}`);
            const searchRes = await axios.get(
              `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            spotifyItem = searchRes.data.tracks.items[0];

            if (!spotifyItem) {
              logger.warn("generateCard: Spotify returnerade inga resultat för \"" + parsedAISong.artist + " - " + parsedAISong.title + "\"");
              spotifySearchAttempts++;
              continue;
            }

            // 🎵 Parallell Apple/Deezer-sökning medan vi har Spotify
            // Denna är optional - om den misslyckas returnerar vi bara Spotify
            let previewMatch: SearchMatch | null = null;
            try {
              const [appleResult, deezerResult] = await Promise.allSettled([
                searchApple(parsedAISong.artist, parsedAISong.title, parsedAISong.year),
                searchDeezer(parsedAISong.artist, parsedAISong.title, parsedAISong.year),
              ]);
              
              // Föredra Apple, fallback till Deezer
              if (appleResult.status === 'fulfilled' && appleResult.value) {
                previewMatch = appleResult.value;
              } else if (deezerResult.status === 'fulfilled' && deezerResult.value) {
                previewMatch = deezerResult.value;
              }
            } catch (previewErr) {
              // Preview search failed - log but continue with Spotify-only response
              logger.warn("generateCard: Preview-sökning misslyckades:", previewErr);
            }
            
            finalSong = {
              artist: parsedAISong.artist,
              title: parsedAISong.title,
              year: parsedAISong.year,
              spotifyUrl: spotifyItem.external_urls.spotify,
              ...(parsedAISong.source && {
                source: parsedAISong.source,
              }),
              ...(previewMatch && {
                previewData: {
                  previewUrl: previewMatch.previewUrl,
                  artworkUrl: previewMatch.artworkUrl,
                  externalUrl: previewMatch.externalUrl,
                  source: previewMatch.source,
                },
              }),
            };
          } catch (searchErr) {
            logger.error("generateCard: Fel vid sökning på Spotify (försök " + (spotifySearchAttempts + 1) + "):", searchErr);
            spotifySearchAttempts++;
          }
        }
        aiGenerationTries++;
      }

      if (!finalSong) {
        res.status(500).send("Kunde inte generera en unik låt. Försök igen.");
        return;
      }

      res.json(finalSong);
    } catch (err) {
      logger.error(`Oväntat fel för ${uid || "anonym användare"}:`, err);
      res.status(500).send("Något oväntat gick fel på servern.");
    }
  }
);

export const markSongAsSeen = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed. Use POST.");
    return;
  }

  const uid = await getUidFromRequest(req);
  const { songIdentifier, artist, title, year, source } = req.body;
  if (!songIdentifier) {
    res.status(400).send("Song identifier is required.");
    return;
  }

  try {
    const collectionPath = uid ? `users/${uid}/seenSongs` : "globalSeenSongs";
    const seenSongsRef = db.collection(collectionPath);

    await seenSongsRef.add({
      songIdentifier,
      timestamp: new Date(),
      artist: artist || "unknown",
      title: title || "unknown",
      year: year || 0,
      ...(source && { source }),
    });
    logger.info(`markSongAsSeen: Lade till "${songIdentifier}" i historiken för ${uid || "global"}.`);

    const currentCountSnapshot = await seenSongsRef.count().get();
    if (currentCountSnapshot.data().count > MAX_USER_SEEN_SONGS_HISTORY) {
      const oldestSongsSnapshot = await seenSongsRef
        .orderBy("timestamp", "asc")
        .limit(currentCountSnapshot.data().count - MAX_USER_SEEN_SONGS_HISTORY)
        .get();

      const batch = db.batch();
      oldestSongsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      logger.info(
        `markSongAsSeen: Rensade ${oldestSongsSnapshot.size} gamla låtar för ${uid || "global"}.`
      );
    }

    res.status(200).send("Song marked as seen.");
  } catch (err) {
    logger.error(`Fel i markSongAsSeen för ${uid || "anonym användare"}:`, err);
    res.status(500).send("Kunde inte markera låt som sedd.");
  }
});
