export type PreviewCard = {
  artist: string;
  title: string;
  year: number;
  previewUrl: string;
  externalUrl: string;
  artworkUrl?: string;
  source?: 'itunes' | 'deezer';
};

const CFN_URL = 'https://us-central1-musikquiz-app.cloudfunctions.net/generatePreviewCard';
// ✅ RÄTT NAMN:
const CFN_SEEN_URL = 'https://us-central1-musikquiz-app.cloudfunctions.net/markPreviewSeen';

export async function fetchPreviewCard(clientSeen: string[] = [], idToken?: string): Promise<PreviewCard | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(CFN_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ clientSeenSongs: clientSeen }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function markPreviewSeen(card: PreviewCard, idToken?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    await fetch(CFN_SEEN_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        songIdentifier: `${card.artist} - ${card.title}`.toLowerCase(),
        artist: card.artist,
        title: card.title,
        year: card.year,
      }),
    });
  } catch {}
}