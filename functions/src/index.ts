// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import OpenAI from "openai";

// 🔒 Admin SDK – init bara EN gång
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Request } from "firebase-functions/v2/https";

// 👇 re-exportera dina Apple/Preview-funktioner
export * from "./appleIndex";

// ✅ Guard: init endast om ingen app finns
if (getApps().length === 0) {
  initializeApp();
}

// ─── DEBUG-LOGGNING ──────────────────────────────────────────────────────────
// Sätt DEBUG = false (eller ta bort alla dbg()-anrop) för att stänga av.
const DEBUG = true;
function dbg(label: string, data?: any) {
  if (!DEBUG) return;
  if (data !== undefined) {
    logger.info(`[DBG] ${label}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    logger.info(`[DBG] ${label}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const db = getFirestore();
const adminAuth = getAuth();

// Definiera hemligheter
const openaiApiKey = defineSecret("OPENAI_API_KEY");
const spotifyClientId = defineSecret("SPOTIFY_CLIENT_ID");
const spotifyClientSecret = defineSecret("SPOTIFY_CLIENT_SECRET");

let openai: OpenAI;
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
function getPrompts(n: number): Record<string, string> {
  return {
    default: `Välj **${n} populära, välkända eller kulturellt betydelsefulla låtar** från perioden **1950 till ${CURRENT_YEAR}**.
    Föredra låtar på engelska, men andra språk är också acceptabla om de är kända globalt.`,

    svenska: `Välj **${n} svenska låtar** (sjungs på svenska eller av en mycket känd svensk artist) som är klassiker, hits eller allsångsfavoriter från **1960 till ${CURRENT_YEAR}**.`,

    eurovision: `Välj **${n} låtar** som har tävlat i **Eurovision Song Contest** (oavsett land och placering) mellan **1956 och ${CURRENT_YEAR}**. Det ska vara låtar som många känner igen.`,

    rock: `Välj **${n} låtar** inom genrerna **Rock, Hårdrock, Metal eller Punk** från perioden **1960 till ${CURRENT_YEAR}**. Det ska vara kända låtar inom genren.`,

    onehitwonder: `Välj **${n} klassiska One Hit Wonders** (artisten är främst känd för just denna låt) från **1970 till 2015**.`,

    filmmusik: `Välj **${n} låtar** från **filmer eller TV-serier** från **1950 till ${CURRENT_YEAR}**. Låtarna måste vara starkt förknippade med de specifika filmerna eller serierna.`,

    disney: `Välj **${n} populära låtar** från animerade filmer av **Disney, Pixar eller DreamWorks Animation** från **1937 till ${CURRENT_YEAR}**. Det ska vara välkända låtar från klassiska eller moderna animerade filmer.`,

    melodifestivalen: `Välj **${n} låtar** som har tävlat i **Melodifestivalen** (Sverige) mellan **1958 och ${CURRENT_YEAR}**. Det ska vara kända låtar från tävlingen, gärna vinnare eller finalister.`,

    kpop: `Välj **${n} K-POP låtar** (skapade av sydkoreanska artister) från **2000 till ${CURRENT_YEAR}**. Det ska vara välkända K-POP-låtar som många känner till globalt.`,

    eightiesnineties: `Välj **${n} populära och välkända låtar** från genrer som Pop, Rock, Hip-Hop eller Dance från **1980 till 1999**. Det ska vara klassiker från åttio- eller nittiotalet.`,

    modernahits: `Välj **${n} populära och välkända låtar** från **2005 till ${CURRENT_YEAR}**. Det kan vara från genrer som Pop, Rock, Hip-Hop, R&B eller Dance. Det ska vara hits som många känner igen.`,
  };
}

// *** BATCH-KONSTANTER ***
const BATCH_SIZE_DEFAULT = 15;
const SEARCH_CHUNK_SIZE = 5; // Max parallella Spotify+Apple+Deezer-anrop åt gången

// Kör processor i sekventiella chunks för att inte tömma socketpoolen
async function processInChunks<T>(
  items: any[],
  chunkSize: number,
  processor: (item: any) => Promise<T>
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(chunk.map(processor));
    results.push(...chunkResults);
  }
  return results;
}

// *** HELPER: söker Spotify + Apple/Deezer för en enskild låt ***
async function searchSingleSong(song: any): Promise<Card | null> {
  try {
    const query = encodeURIComponent(`${song.artist} ${song.title}`);
    let searchRes: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        searchRes = await axios.get(
          `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000 }
        );
        break;
      } catch (axiosErr: any) {
        if (axiosErr?.response?.status === 429 && attempt < 2) {
          const retryAfter = parseInt(axiosErr.response.headers?.['retry-after'] ?? '1', 10);
          const waitMs = Math.max(retryAfter * 1000, 500) * (attempt + 1);
          dbg(`Spotify 429 – väntar ${waitMs}ms innan retry (försök ${attempt + 1})`, { artist: song.artist, title: song.title });
          await new Promise(r => setTimeout(r, waitMs));
        } else {
          throw axiosErr;
        }
      }
    }
    const spotifyItem = searchRes.data.tracks.items[0];
    if (!spotifyItem) {
      dbg(`Spotify ← ingen träff`, { artist: song.artist, title: song.title });
      return null;
    }
    dbg(`Spotify ← träff`, { artist: song.artist, title: song.title, spotifyUrl: spotifyItem.external_urls?.spotify });

    const [appleResult, deezerResult] = await Promise.allSettled([
      searchApple(song.artist, song.title, song.year),
      searchDeezer(song.artist, song.title, song.year),
    ]);

    let previewMatch: SearchMatch | null = null;
    if (appleResult.status === 'fulfilled' && appleResult.value) {
      previewMatch = appleResult.value;
      dbg(`Preview ← Apple hittad`, { artist: song.artist, title: song.title });
    } else if (deezerResult.status === 'fulfilled' && deezerResult.value) {
      previewMatch = deezerResult.value;
      dbg(`Preview ← Deezer hittad`, { artist: song.artist, title: song.title });
    } else {
      dbg(`Preview ← ingen träff (Apple + Deezer)`, { artist: song.artist, title: song.title });
    }

    return {
      artist: song.artist,
      title: song.title,
      year: song.year,
      spotifyUrl: spotifyItem.external_urls.spotify,
      ...(song.source && { source: song.source }),
      ...(previewMatch && {
        previewData: {
          previewUrl: previewMatch.previewUrl,
          artworkUrl: previewMatch.artworkUrl,
          externalUrl: previewMatch.externalUrl,
          source: previewMatch.source,
        },
      }),
    } as Card;
  } catch (err) {
    logger.warn(`searchSingleSong misslyckades för "${song.artist} - ${song.title}":`, err);
    return null;
  }
}

export const generateCard = onRequest(
  { timeoutSeconds: 120, secrets: [openaiApiKey, spotifyClientId, spotifyClientSecret] },
  async (req, res) => {
    openai = new OpenAI({ apiKey: openaiApiKey.value() });

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed. Use POST.");
      return;
    }

    const uid = await getUidFromRequest(req);
    const { clientSeenSongs = [], gameMode = 'default', count = BATCH_SIZE_DEFAULT } = req.body;
    // Clamp count between 1 and 20
    const batchCount = Math.min(Math.max(1, parseInt(String(count), 10) || BATCH_SIZE_DEFAULT), 20);
    dbg('generateCard → inkommande anrop', { uid: uid ?? 'anonym', gameMode, batchCount, clientSeenSongsCount: clientSeenSongs.length });
    const clientSeenSongsSet = new Set<string>(clientSeenSongs);

    try {
      // Hämta sedd-historik från Firestore
      const collectionPath = uid ? `users/${uid}/seenSongs` : "globalSeenSongs";
      const seenSongsRef = db.collection(collectionPath);
      const snapshot = await seenSongsRef.orderBy("timestamp", "desc").limit(MAX_USER_SEEN_SONGS_HISTORY).get();
      const firestoreHistory = new Set<string>();
      snapshot.forEach((doc) => { firestoreHistory.add(doc.data().songIdentifier); });

      const allSeenSongs = new Set([...firestoreHistory, ...clientSeenSongsSet]);
      // Skicka hela listan till OpenAI så att den kan undvika alla sedda låtar.
      // Firestore-filtret efter OpenAI-svaret fångar eventuella missar ändå.
      // Formatera som numrerad lista – lättare för LLM att läsa än komma-separerad sträng.
      const seenSongsPromptPart = Array.from(allSeenSongs)
        .map((s, i) => `${i + 1}. ${s}`)
        .join('\n');
      // clientSeenSongs = session-lokalt minne (låtar konsumerade sedan appen startades,
      // ännu ej garanterat skrivna till Firestore). Firestore = persistent historik.
      dbg('seenSongs', { firestoreCount: firestoreHistory.size, sessionMemoryCount: clientSeenSongsSet.size, totalUnique: allSeenSongs.size });

      // *** BYGG BATCH-PROMPT ***
      const isSourceMode = gameMode === 'filmmusik' || gameMode === 'disney';
      const jsonArrayExample = isSourceMode
        ? `[\n  { "artist": "Artistens namn", "title": "Låtens titel", "year": 2009, "source": "Filmens namn" },\n  ...\n]`
        : `[\n  { "artist": "Artistens namn", "title": "Låtens titel", "year": 2009 },\n  ...\n]`;

      const selectedModeDescription = getPrompts(batchCount)[gameMode] || getPrompts(batchCount)['default'];

      // När många låtar är sedda – ersätt "populära/välkända" med uppmaning om bredare urval
      const depthInstruction = allSeenSongs.size > 200
        ? `Välj **exakt ${batchCount} låtar** som inte nödvändigtvis är de allra mest välkända hitsen – gå på djupet i katalogen. Välj mindre kända singlar eller artister som mindre sällan hamnar på topplistor. Kvalitet framför kännedom.`
        : `Välj **exakt ${batchCount} låtar** som är populära, välkända eller kulturellt betydelsefulla.`;

      // Be om exakt batchCount låtar – undvika-listan och numrerat format hjälper modellen
      const prompt = `VIKTIGT – Du måste undvika ALLA låtar i listan nedan. Läs igenom hela listan noggrant innan du väljer. Ingen av låtarna i ditt svar får matcha något i listan.

Låtar att undvika (${Array.from(allSeenSongs).length} st):
${seenSongsPromptPart}

---

${selectedModeDescription}

${depthInstruction}
Säkerställ **maximal variation** – olika artister, decennier och genrer.
Ingen av låtarna får finnas i undvika-listan ovan.

Slumptal för variation: ${Math.random()}.

Svara **ENDAST** med ett JSON-array i exakt detta format (${batchCount} objekt):
${jsonArrayExample}`;

      dbg('OpenAI → prompt som skickas', prompt);

      // *** OPENAI-ANROP – ackumulera låtar över max 3 försök tills vi når batchCount ***
      const accumulatedSongs: any[] = [];
      const accumulatedIds = new Set<string>(); // Undvik dubletter mellan försöken
      const MIN_VALID_SONGS = Math.ceil(batchCount * 0.6); // Nöj oss med 60% av önskad batch
      let openAITries = 0;
      while (accumulatedSongs.length < MIN_VALID_SONGS && openAITries < 5) {
        openAITries++;
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-5.4-nano",
            messages: [{ role: "user", content: prompt }],
            temperature: openAITries === 1 ? 1.0 : 1.0, // Lägre temp = bättre instruktionsföljning
          });
          const rawContent = completion.choices[0].message?.content ?? "";
          dbg(`OpenAI ← råsvar (försök ${openAITries})`, rawContent);
          const match = rawContent.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            dbg(`OpenAI ← tolkade låtar (${parsed.length} st)`, parsed);
            const filtered = parsed.filter((s: any) => {
              if (!s?.artist || !s?.title || !s?.year) return false;
              const id = `${s.artist} - ${s.title}`.toLowerCase().trim();
              if (allSeenSongs.has(id)) return false;
              if (accumulatedIds.has(id)) return false; // Dubblett från tidigare försök
              return true;
            });
            dbg(`Filtrerade låtar (${filtered.length}/${parsed.length} passerade filter, har ${accumulatedSongs.length} sedan tidigare)`);
            // Lägg till nya unika låtar i ackumulatorn
            for (const s of filtered) {
              if (accumulatedSongs.length >= batchCount) break;
              const id = `${s.artist} - ${s.title}`.toLowerCase().trim();
              accumulatedSongs.push(s);
              accumulatedIds.add(id);
            }
            logger.info(`generateCard: Försök ${openAITries} – lade till ${filtered.length} låtar, totalt ${accumulatedSongs.length}/${batchCount}`);
            if (accumulatedSongs.length < MIN_VALID_SONGS && openAITries < 5) {
              logger.warn(`generateCard: Behöver fler låtar (har ${accumulatedSongs.length}/${batchCount}) – försöker igen (försök ${openAITries})`);
            }
          } else {
            dbg(`OpenAI ← kunde inte hitta JSON-array i svaret`);
          }
        } catch (openAIErr) {
          logger.warn(`generateCard: OpenAI-anrop #${openAITries} misslyckades:`, openAIErr);
        }
      }
      const validSongs = accumulatedSongs;

      if (validSongs.length < MIN_VALID_SONGS) {
        res.status(500).send(`Kunde inte hitta tillräckligt med nya låtar efter 5 försök (fick ${validSongs.length}/${batchCount}). Försök igen.`);
        return;
      }

      // *** HÄMTA SPOTIFY-TOKEN EN GÅNG ***
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
          res.status(500).send("Kunde inte autentisera mot Spotify.");
          return;
        }
      }

      // *** FAS 1: Välj 1 slumpad låt – sök och returnera snabbt (~5–7s) ***
      // Resterande låtar sparas i Firestore (batchPending) och hämtas av generateCardRest.
      const shuffled = [...validSongs].sort(() => Math.random() - 0.5);
      const firstSong = shuffled[0];
      const restSongs = shuffled.slice(1);

      const firstCard = await searchSingleSong(firstSong);
      dbg('Fas 1 → firstCard', firstCard ? { artist: firstCard.artist, title: firstCard.title } : 'null (ingen Spotify-träff)');

      // Spara resterande låtnamn temporärt i Firestore (konsumeras av generateCardRest)
      const batchRef = db.collection('batchPending').doc();
      const batchId = batchRef.id;
      await batchRef.set({
        songs: restSongs,
        createdAt: new Date(),
        uid: uid ?? null,
      });
      dbg(`batchPending → sparad som ${batchId} (${restSongs.length} låtar)`);

      logger.info(`generateCard: Fas 1 klar – firstCard=${firstCard ? firstCard.title : 'null'}, batchId=${batchId}`);
      res.json({ firstCard, batchId });
    } catch (err) {
      logger.error(`Oväntat fel för ${uid || "anonym användare"}:`, err);
      res.status(500).send("Något oväntat gick fel på servern.");
    }
  }
);

// *** FAS 2: Hämta resterande låtar från batchPending ***
export const generateCardRest = onRequest(
  { timeoutSeconds: 120, secrets: [spotifyClientId, spotifyClientSecret] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed. Use POST.');
      return;
    }

    const { batchId } = req.body;
    if (!batchId) {
      res.status(400).send('batchId saknas.');
      return;
    }

    const fas2Start = Date.now();
    logger.info(`generateCardRest: Fas 2 startad för batchId=${batchId}`);
    const docRef = db.collection('batchPending').doc(batchId);
    let songs: any[];
    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        res.status(404).send('Batch hittades inte eller är redan konsumerad.');
        return;
      }
      const data = doc.data()!;
      // Säkerhet: neka batch äldre än 5 minuter
      const ageMs = Date.now() - (data.createdAt?.toDate?.()?.getTime?.() ?? 0);
      if (ageMs > 5 * 60 * 1000) {
        await docRef.delete();
        res.status(410).send('Batch har gått ut.');
        return;
      }
      songs = Array.isArray(data.songs) ? data.songs : [];
      logger.info(`generateCardRest: Läste ${songs.length} låtar från batchPending, startar Spotify-sökning`);
      // Konsumera direkt – förhindrar dubbel-anrop
      await docRef.delete();
    } catch (err) {
      logger.error('generateCardRest: Fel vid läsning av batchPending:', err);
      res.status(500).send('Serverfel vid hämtning av batch.');
      return;
    }

    if (songs.length === 0) {
      res.json([]);
      return;
    }

    // Säkerställ Spotify-token (separat Cloud Run-instans kan sakna token)
    if (!accessToken || Date.now() >= tokenExpiresAt) {
      try {
        const tokenRes = await axios.post(
          'https://accounts.spotify.com/api/token',
          new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: 'Basic ' + Buffer.from(`${spotifyClientId.value()}:${spotifyClientSecret.value()}`).toString('base64'),
            },
          }
        );
        accessToken = tokenRes.data.access_token;
        tokenExpiresAt = Date.now() + tokenRes.data.expires_in * 1000;
      } catch (tokenErr) {
        logger.error('generateCardRest: Fel vid hämtning av Spotify token:', tokenErr);
        res.status(500).send('Kunde inte autentisera mot Spotify.');
        return;
      }
    }

    const searchResults = await processInChunks<Card | null>(songs, SEARCH_CHUNK_SIZE, searchSingleSong);
    const finalSongs: Card[] = searchResults
      .filter((r): r is PromiseFulfilledResult<Card> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    const fas2Elapsed = ((Date.now() - fas2Start) / 1000).toFixed(1);
    dbg(`generateCardRest → returnerar ${finalSongs.length}/${songs.length} låtar`);
    logger.info(`generateCardRest: Fas 2 KLAR på ${fas2Elapsed}s – returnerar ${finalSongs.length}/${songs.length} resterande låtar (${songs.length - finalSongs.length} misslyckades på Spotify).`);
    res.json(finalSongs);
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
