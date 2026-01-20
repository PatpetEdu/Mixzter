import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export function useGameCode() {
  // Generera en unik 6-siffrig game code
  const generateCode = (): string => {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Validera och hämta gameId från en game code
  const validateCode = async (code: string): Promise<string | null> => {
    try {
      const q = query(
        collection(db, 'games'),
        where('gameCode', '==', code.toUpperCase()),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      return snapshot.docs[0].id;
    } catch (error) {
      console.error('Error validating game code:', error);
      return null;
    }
  };

  return { generateCode, validateCode };
}
