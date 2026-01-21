import * as Crypto from 'expo-crypto';

/**
 * Generera en kryptografiskt säker token för spektator-åtkomst
 * Använder expo-crypto för secure random generation (kompatibel med React Native/Expo)
 */
export async function generatePublicToken(): Promise<string> {
  // Generera 32 random bytes
  const buffer = await Crypto.getRandomBytesAsync(32);
  
  // Konvertera till hex-sträng
  const token = Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return token;
}
