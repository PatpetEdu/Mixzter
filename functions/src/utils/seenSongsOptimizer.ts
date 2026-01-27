// functions/src/utils/seenSongsOptimizer.ts
/**
 * Optimizes seen songs list to reduce prompt size
 * Uses intelligent sampling to maintain variety while reducing token count
 */

export function optimizeSeenSongsList(
  seenSongs: Set<string>, 
  maxSamples: number = 100
): string {
  const allSongs = Array.from(seenSongs);
  
  // If list is small enough, return all
  if (allSongs.length <= maxSamples) {
    return allSongs.join(', ');
  }

  // Sample recent songs (last 60%) and random older songs (40%)
  const recentCount = Math.floor(maxSamples * 0.6);
  const randomCount = maxSamples - recentCount;
  
  // Get most recent songs (assume they're at the end of the set)
  const recentSongs = allSongs.slice(-recentCount);
  
  // Get random sample from older songs
  const olderSongs = allSongs.slice(0, -recentCount);
  const randomSongs: string[] = [];
  
  for (let i = 0; i < randomCount && i < olderSongs.length; i++) {
    const randomIndex = Math.floor(Math.random() * olderSongs.length);
    randomSongs.push(olderSongs[randomIndex]);
    olderSongs.splice(randomIndex, 1);
  }
  
  const sampledSongs = [...randomSongs, ...recentSongs];
  return sampledSongs.join(', ');
}

/**
 * Creates a compact summary for very large seen song lists
 */
export function createSeenSongsSummary(seenSongs: Set<string>): string {
  const count = seenSongs.size;
  if (count <= 100) {
    return Array.from(seenSongs).join(', ');
  }
  
  // For very large lists, provide a sample with a note
  const sample = optimizeSeenSongsList(seenSongs, 50);
  return `${sample} ... (och ${count - 50} fler låtar)`;
}
