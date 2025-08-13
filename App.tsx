// =============================
// File: App.tsx (ligger i projektets rot)
// =============================
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// UI & Theme
import { GluestackUIProvider, Text, Box, Button, ButtonText, Heading, VStack, Center } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';

// Egen kod
import PlayerSetupScreen from './components/PlayerSetupScreen';
import DuoGameScreen from './components/DuoGameScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { auth } from './firebase';

export type CardData = { artist: string; title: string; year: number; spotifyUrl: string };
export type GameMode = 'menu' | 'duo-setup' | 'duo';

const fetchFirstCardForPreload = async (): Promise<CardData | null> => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  try {
    const SEEN_SONGS_KEY = 'duoSeenSongsHistory';
    const storedSongs = await AsyncStorage.getItem(SEEN_SONGS_KEY);

    // Säker parse av lokal cache – behåller namnen storedSongs & clientSeenSongsArray
    const clientSeenSongsArray: string[] = (() => {
      try {
        return storedSongs ? JSON.parse(storedSongs) : [];
      } catch {
        return [];
      }
    })();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('https://us-central1-musikquiz-app.cloudfunctions.net/generateCard', {
      method: 'POST',
      headers,
      body: JSON.stringify({ clientSeenSongs: clientSeenSongsArray }),
    });

    // Läs body en gång
    const text = await res.text();

    if (!res.ok) {
      console.error('App.tsx Preload: Fel från servern:', res.status, text);
      return null;
    }

    try {
      return JSON.parse(text) as CardData;
    } catch (jsonError) {
      console.error('App.tsx Preload: Kunde inte parsa JSON från servern.', jsonError);
      console.error('App.tsx Preload: Råtext från servern:', text);
      return null;
    }
  } catch (err) {
    console.error('App.tsx Preload: Kritiskt fel i nätverksanrop:', err);
    return null;
  }
};

function AppContent() {
  const { user, loadingAuth, isAnonymous, signOut } = useAuth();
  const [mode, setMode] = useState<GameMode>('menu');
  const [players, setPlayers] = useState<{ player1: string; player2: string } | null>(null);
  const [preloadedDuoCard, setPreloadedDuoCard] = useState<CardData | null>(null);

  // NEW: control which auth screen to show when unauthenticated
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    const triggerDuoPreload = async () => {
      if (mode === 'duo-setup' && !preloadedDuoCard) {
            console.log('App.tsx: Startar pre-loading av första kortet...');
        const card = await fetchFirstCardForPreload();
        setPreloadedDuoCard(card);
          if (card) console.log('App.tsx: Pre-loading klar!');
        else console.error('App.tsx: Pre-loading misslyckades.');
      }
    };
    if (user || isAnonymous) triggerDuoPreload();
  }, [mode, preloadedDuoCard, user, isAnonymous]);

  const startDuoGame = (player1: string, player2: string) => {
    setPlayers({ player1, player2 });
    setMode('duo');
  };

  const returnToMenu = () => {
    setPlayers(null);
    setPreloadedDuoCard(null);
    setMode('menu');
  };

  // Reset to login view on sign out
  useEffect(() => {
    if (!user && !isAnonymous) setAuthScreen('login');
  }, [user, isAnonymous]);

  if (loadingAuth) {
    return (
      <Center flex={1}>
        <ActivityIndicator size="large" />
      </Center>
    );
  }

  if (!user && !isAnonymous) {
    return authScreen === 'login' ? (
      <LoginScreen onGoToSignup={() => setAuthScreen('signup')} />
    ) : (
      <SignupScreen onGoToLogin={() => setAuthScreen('login')} />
    );
  }

  return (
    <Box flex={1} justifyContent="center" alignItems="center" w="$full">
      {mode === 'menu' && (
        <VStack space="lg" alignItems="center">
          <Heading size="2xl">🎵 Musikquiz</Heading>
          <Text size="md" color="$textLight500">{user ? `Inloggad som: ${user.email}` : 'Spelar som gäst'}</Text>
          <Button onPress={() => setMode('duo-setup')}><ButtonText>Start Duo</ButtonText></Button>
          <Button onPress={signOut} variant="link"><ButtonText>{user ? 'Logga ut' : 'Logga in'}</ButtonText></Button>
        </VStack>
      )}

      {mode === 'duo-setup' && <PlayerSetupScreen onStart={startDuoGame} />}

      {mode === 'duo' && players && (
        <DuoGameScreen
          player1={players.player1}
          player2={players.player2}
          onBackToMenu={returnToMenu}
          initialPreloadedCard={preloadedDuoCard}
          onPreloadComplete={() => setPreloadedDuoCard(null)}
        />
      )}
    </Box>
  );
}

export default function App() {
  return (
    <GluestackUIProvider config={config}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GluestackUIProvider>
  );
}