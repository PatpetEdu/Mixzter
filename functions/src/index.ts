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
};

const CURRENT_YEAR = new Date().getFullYear();
const MAX_USER_SEEN_SONGS_HISTORY = 500;
// *** FIX: Sänkt till 5 eftersom prompten nu är mycket mer effektiv ***
const MAX_OPENAI_TRIES = 5;
const MAX_SPOTIFY_SEARCH_ATTEMPTS = 3;

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
  
  disney: `Välj en **Disney-låt** från någon av Disneys animerade eller livefilmer från **1937 till ${CURRENT_YEAR}**. Det ska vara en populär låt från en Disney-klassiker eller nyare Disney-film.`,

  melodifestivalen: `Välj en låt som har tävlat i **Melodifestivalen** (Sverige) mellan **1958 och ${CURRENT_YEAR}**. Det ska vara en känd låt från tävlingen, gärna en vinnare eller finalist.`,

  kpop: `Välj en **K-POP låt** (skapad av en sydkoreansk artist) från **2000 till ${CURRENT_YEAR}**. Det ska vara en välkänd K-POP-låt som många känner till globalt.`,

  eightiesnineties: `Välj en populär och välkänd låt från genrer som Pop, Rock, Hip-Hop eller Dance från **1980 till 1999**. Det ska vara en klassiker från åttionde eller nittioende årtiondet.`,
};

export const generateCard = onRequest(
  { timeoutSeconds: 120, secrets: [openaiApiKey, spotifyClientId, spotifyClientSecret] },
  async (req, res) => {
    openai = new OpenAI({ apiKey: openaiApiKey.value() });

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
      const seenSongsPromptPart = Array.from(allSeenSongs).join(", ");

      let finalSong: Card | null = null;
      let spotifyItem: any = null;
      let openAITries = 0;

      while (!finalSong && openAITries < MAX_OPENAI_TRIES) {
        // 👇 HÄR BYGGER VI DEN DYNAMISKA PROMPTEN
        const prompt = `${selectedModeDescription}

**Extremt viktigt:** Undvik **ALLA** låtar i följande lista: "${seenSongsPromptPart}".

Säkerställ **maximal variation** från tidigare svar.
Använd detta unika slumptal för att förstärka variationen: ${Math.random()}.

Svara **ENDAST** med ett JSON-objekt på följande exakta format:
{
  "artist": "Artistens namn",
  "title": "Låtens titel",
  "year": 2009
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 1.0,
        });

        const rawContent = completion.choices[0].message?.content ?? "";
        let parsedOpenAISong: any = null;

        try {
          const match = rawContent.match(/\{[\s\S]*\}/);
          if (match) parsedOpenAISong = JSON.parse(match[0]);
        } catch (jsonErr) {
          logger.warn("generateCard: Kunde inte parsa JSON:", rawContent, jsonErr);
        }

        if (!parsedOpenAISong?.artist || !parsedOpenAISong?.title || !parsedOpenAISong?.year) {
          logger.warn("generateCard: Ogiltigt JSON-format:", rawContent);
          openAITries++;
          continue;
        }

        const currentSongIdentifier = `${parsedOpenAISong.artist} - ${parsedOpenAISong.title}`.toLowerCase().trim();

      // Behåll denna kontroll som en extra säkerhetsåtgärd ifall OpenAI ignorerar instruktionen
        if (allSeenSongs.has(currentSongIdentifier)) {
          logger.info(
            `generateCard: OpenAI ignorerade instruktionen och föreslog en sedd låt: ${currentSongIdentifier}.`
          );
          openAITries++;
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
            openAITries++;
            continue;
          }
        }

        let spotifySearchAttempts = 0;
        while (!spotifyItem && spotifySearchAttempts < MAX_SPOTIFY_SEARCH_ATTEMPTS) {
          try {
            const query = encodeURIComponent(`${parsedOpenAISong.artist} ${parsedOpenAISong.title}`);
            const searchRes = await axios.get(
              `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            spotifyItem = searchRes.data.tracks.items[0];
            if (spotifyItem) {
              finalSong = {
                artist: parsedOpenAISong.artist,
                title: parsedOpenAISong.title,
                year: parsedOpenAISong.year,
                spotifyUrl: spotifyItem.external_urls.spotify,
              };
            } else {
              spotifySearchAttempts++;
              break;
            }
          } catch (searchErr) {
            logger.error("generateCard: Fel vid sökning på Spotify:", searchErr);
            spotifySearchAttempts++;
            break;
          }
        }
        openAITries++;
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
  const { songIdentifier, artist, title, year } = req.body;
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
