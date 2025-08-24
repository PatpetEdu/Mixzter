// functions/src/appleIndex.ts
import { onRequest, Request } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import axios from 'axios';
import OpenAI from 'openai';

// Admin SDK (säker init om index.ts redan initierat)
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) initializeApp();
const db = getFirestore();
const adminAuth = getAuth();

// Hemlighet (OpenAI)
const openaiApiKey = defineSecret('OPENAI_API_KEY');

// =====================
// Typer
// =====================
type PreviewCard = {
  artist: string;
  title: string;
  year: number;
  previewUrl: string;   // 30s mp3/stream
  externalUrl: string;  // länk till tjänsten (Apple/Deezer)
  artworkUrl?: string;  // omslag
  source?: 'itunes' | 'deezer';
};

// Gemensam typ för en sökträff från Apple/Deezer
type SearchMatch = {
  previewUrl: string;
  externalUrl: string;
  artworkUrl: string;
  matchedArtist: string;
  matchedTitle: string;
  source: 'itunes' | 'deezer';
  yearGuess?: number; // ev. år från tjänsten om tillgängligt
};

// =====================
// Hjälpfunktioner
// =====================

const MAX_SEEN = 200;
const MAX_TRIES = 5;

// Normalisera sträng: ta bort accenter, parenteser, extra whitespace, gör lower-case
function normalize(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // diakritik
    .replace(/\([^)]*\)/g, ' ')                      // (feat ...), (Remastered) etc
    .replace(/\[[^\]]*\]/g, ' ')                     // [Live] etc
    .replace(/[-_:]/g, ' ')                          // separatorer
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Ta bort suffix som "remix", "remastered", "radio edit" m.m. från titlar för jämförelse
function normalizeTitleForMatch(title: string): string {
  const t = normalize(title)
    .replace(/\b(remix|remastered|radio edit|karaoke|tribute|cover|version|edit|extended|club mix|live)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

// Gör token-mängd
function tokens(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(' ')
      .filter((w) => w.length > 1)
  );
}

// Enkel token-overlap (0..1)
function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  return inter / Math.max(a.size, b.size);
}

// Artist-match: kräver hygglig överlappning eller att ena innehåller den andra
function artistMatches(found: string, want: string): boolean {
  const f = tokens(found);
  const w = tokens(want);
  const overlap = tokenOverlap(f, w);
  if (overlap >= 0.5) return true;
  const fn = normalize(found), wn = normalize(want);
  return fn.includes(wn) || wn.includes(fn);
}

// Titel-match: jämför normaliserad titel utan remix-suffix
function titleMatches(found: string, want: string): boolean {
  const fn = normalizeTitleForMatch(found);
  const wn = normalizeTitleForMatch(want);
  if (fn === wn) return true;
  // tillåt viss token-overlap för “feat.”-skillnader
  const f = tokens(fn), w = tokens(wn);
  return tokenOverlap(f, w) >= 0.6;
}

// Poängsätt en träff så vi kan välja “bästa” bland top N
function scoreMatch(m: SearchMatch, wantArtist: string, wantTitle: string, wantYear?: number): number {
  let score = 0;

  // Artist/titel
  if (artistMatches(m.matchedArtist, wantArtist)) score += 10;
  if (titleMatches(m.matchedTitle, wantTitle)) score += 10;

  // Straffa uppenbara covers/tributes: om artistmatch FAIL och titeln råkar matcha exakt
  if (!artistMatches(m.matchedArtist, wantArtist) && titleMatches(m.matchedTitle, wantTitle)) {
    score -= 5;
  }

  // Års-närhet (om känt)
  if (wantYear && m.yearGuess) {
    const diff = Math.abs(m.yearGuess - wantYear);
    if (diff <= 1) score += 4;
    else if (diff <= 3) score += 2;
    else if (diff <= 6) score += 1;
  }

  return score;
}

// Läs ev. Firebase ID token från request (frivilligt)
const getUidFromRequest = async (req: Request): Promise<string | null> => {
  const authz = (req.headers.authorization || '').trim();
  if (!authz.startsWith('Bearer ')) return null;
  const idToken = authz.substring('Bearer '.length);
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid || null;
  } catch (e) {
    logger.warn('appleIndex.getUidFromRequest: invalid token', e);
    return null;
  }
};

// =====================
// Apple iTunes Search
// =====================
async function searchApple(artist: string, title: string, wantYear?: number): Promise<SearchMatch | null> {
  const url = 'https://itunes.apple.com/search';
  const term = `${artist} ${title}`.trim();

  const { data } = await axios.get(url, {
    params: {
      term,
      media: 'music',
      entity: 'song',
      limit: 10, // hämta fler och ranka
    },
    timeout: 10000,
  });

  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const candidates: SearchMatch[] = results
    .filter((r) => r?.previewUrl) // vi kräver preview
    .map((r) => {
      const yearGuess = r?.releaseDate ? Number(String(r.releaseDate).slice(0, 4)) : undefined;
      return {
        previewUrl: String(r.previewUrl),
        externalUrl: String(r.trackViewUrl || r.collectionViewUrl || ''),
        artworkUrl: String(r.artworkUrl100 || r.artworkUrl60 || ''),
        matchedArtist: String(r.artistName || ''),
        matchedTitle: String(r.trackName || ''),
        source: 'itunes' as const,
        yearGuess,
      };
    });

  if (candidates.length === 0) return null;

  // Välj bästa träffen enligt våra regler
  const ranked = candidates
    .map((c) => ({ c, s: scoreMatch(c, artist, title, wantYear) }))
    .sort((a, b) => b.s - a.s);

  const best = ranked[0];
  // Grundkrav: artist OCH titel måste “matcha” – annars returnera null
  if (!artistMatches(best.c.matchedArtist, artist) || !titleMatches(best.c.matchedTitle, title)) {
    return null;
  }
  return best.c;
}

// =====================
// Deezer Search (fallback)
// =====================
async function searchDeezer(artist: string, title: string, wantYear?: number): Promise<SearchMatch | null> {
  const q = `${artist} ${title}`.trim();
  const { data } = await axios.get('https://api.deezer.com/search', {
    params: { q, limit: 10 },
    timeout: 10000,
  });

  const arr: any[] = Array.isArray(data?.data) ? data.data : [];
  const candidates: SearchMatch[] = arr
    .filter((d) => d?.preview) // kräver preview (30s MP3)
    .map((d) => {
      const yearGuess = d?.release_date ? Number(String(d.release_date).slice(0, 4)) : undefined;
      return {
        previewUrl: String(d.preview),
        externalUrl: String(d.link || (d.id ? `https://www.deezer.com/track/${d.id}` : '')),
        artworkUrl: String(d.album?.cover_medium || d.album?.cover || ''),
        matchedArtist: String(d.artist?.name || ''),
        matchedTitle: String(d.title || d.title_short || ''),
        source: 'deezer' as const,
        yearGuess,
      };
    });

  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((c) => ({ c, s: scoreMatch(c, artist, title, wantYear) }))
    .sort((a, b) => b.s - a.s);

  const best = ranked[0];
  if (!artistMatches(best.c.matchedArtist, artist) || !titleMatches(best.c.matchedTitle, title)) {
    return null;
  }
  return best.c;
}

// =====================
// OpenAI: välj låt att fråga efter
// =====================
async function pickSongWithOpenAI(openai: OpenAI, allSeen: Set<string>) {
  const seenCsv = Array.from(allSeen).join(', ');
  const prompt = `Välj exakt EN låt som är populär/bekant, mellan 1970–2025.
Undvik ALLA följande (artist - titel): "${seenCsv}".
Variera genre/decennium/ursprung.
Svara ENDAST som JSON:
{"artist":"...", "title":"...", "year":1999}`;

  const completion = await openai.chat.completions.create({
    model: 'o4-mini-2025-04-16',
    messages: [{ role: 'user', content: prompt }],
    temperature: 1.0,
  });

  const raw = completion.choices?.[0]?.message?.content ?? '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (obj?.artist && obj?.title && obj?.year) {
      return {
        artist: String(obj.artist),
        title: String(obj.title),
        year: Number(obj.year),
      };
    }
  } catch {}
  return null;
}

// =====================
// HTTP-funktion: generera preview-kort
// =====================
export const generatePreviewCard = onRequest(
  { timeoutSeconds: 90, secrets: [openaiApiKey] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Use POST.');
        return;
      }

      const uid = await getUidFromRequest(req);
      const clientSeen: string[] = Array.isArray(req.body?.clientSeenSongs) ? req.body.clientSeenSongs : [];
      const allSeenSet = new Set(clientSeen.map((s) => s.toLowerCase()));

      // Hämta server-historik för den här användaren (separat collection för singleplayer-previews)
      if (uid) {
        const snap = await db
          .collection(`users/${uid}/previewSeenSongs`)
          .orderBy('timestamp', 'desc')
          .limit(MAX_SEEN)
          .get();
        snap.forEach((doc) => {
          const id = String(doc.data()?.songIdentifier || '').toLowerCase();
          if (id) allSeenSet.add(id);
        });
      }

      const openai = new OpenAI({ apiKey: openaiApiKey.value() });

      let finalCard: PreviewCard | null = null;
      let tries = 0;

      while (!finalCard && tries < MAX_TRIES) {
        tries++;

        // 1) Välj låt via OpenAI
        const pick = await pickSongWithOpenAI(openai, allSeenSet);
        if (!pick) continue;

        const identifier = `${pick.artist} - ${pick.title}`.toLowerCase();
        if (allSeenSet.has(identifier)) continue; // extra skydd

        // 2) Hämta preview från Apple först, annars Deezer
        let stream: SearchMatch | null = await searchApple(pick.artist, pick.title, pick.year);
        if (!stream) stream = await searchDeezer(pick.artist, pick.title, pick.year);

        // Dubbelkolla matchkraven (artist+titel måste matcha)
        if (!stream || !artistMatches(stream.matchedArtist, pick.artist) || !titleMatches(stream.matchedTitle, pick.title)) {
          continue;
        }

        finalCard = {
          artist: pick.artist,
          title: pick.title,
          year: pick.year,
          previewUrl: stream.previewUrl,
          externalUrl: stream.externalUrl,
          artworkUrl: stream.artworkUrl,
          source: stream.source,
        };
      }

      if (!finalCard) {
        res.status(500).send('Kunde inte hitta en låt med preview.');
        return;
      }

      res.json(finalCard);
    } catch (e) {
      logger.error('generatePreviewCard error', e);
      res.status(500).send('Internal error');
    }
  }
);

// =====================
// HTTP-funktion: markera preview-låt som sedd
// =====================
async function _markPreviewSeenHandler(req: Request, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Use POST.');
      return;
    }

    const uid = await getUidFromRequest(req);
    const { songIdentifier, artist, title, year } = (req as any).body || {};
    if (!songIdentifier) {
      res.status(400).send('songIdentifier is required');
      return;
    }

    // Spara under användarens preview-collection om inloggad, annars global
    const path = uid ? `users/${uid}/previewSeenSongs` : 'globalPreviewSeenSongs';
    await db.collection(path).add({
      songIdentifier,
      artist: artist || 'unknown',
      title: title || 'unknown',
      year: Number(year) || 0,
      timestamp: new Date(),
    });

    res.status(200).send('ok');
  } catch (e) {
    logger.error('markPreviewSeen error', e);
    res.status(500).send('Internal error');
  }
}

// Primärt namn
export const markPreviewSeen = onRequest(_markPreviewSeenHandler as any);

// Alias för bakåtkompatibilitet (om din klient råkar kalla denna)
export const markSongAsSeenPreview = onRequest(_markPreviewSeenHandler as any);
