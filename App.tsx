// =============================
// File: App.tsx (Uppdaterad)
// =============================
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context'; 

// UI & Theme
import { GluestackUIProvider, Text, Box, Button, ButtonText, Heading, VStack, Center, Icon, Pressable } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';
import { MoonIcon, SunIcon } from 'lucide-react-native';


// Egen kod
import PlayerSetupScreen from './components/PlayerSetupScreen';
import DuoGameScreen from './components/DuoGameScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext'; // Importera ThemeProvider och useTheme
import { useAuth } from './hooks/useAuth';
import { auth } from './firebase';

export type CardData = { artist: string; title: string; year: number; spotifyUrl: string };
export type GameMode = 'menu' | 'duo-setup' | 'duo';

// Din fetchFirstCardForPreload funktion (inga ändringar här)
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


function AppHeader() {
    const { colorMode, toggleColorMode } = useTheme();
    return (
        <Box position="absolute" top={40} right={20} zIndex={1}>
            <Pressable onPress={toggleColorMode} p="$2">
                <Icon as={colorMode === 'dark' ? SunIcon : MoonIcon} size="xl" color="$textLight800" sx={{ _dark: { color: '$textDark200'}}} />
            </Pressable>
        </Box>
    );
}


function AppContent() {
  const { user, loadingAuth, isAnonymous, signOut } = useAuth();
  const [mode, setMode] = useState<GameMode>('menu');
  const [players, setPlayers] = useState<{ player1: string; player2: string } | null>(null);
  const [preloadedDuoCard, setPreloadedDuoCard] = useState<CardData | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');
  const { colorMode } = useTheme();

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

  useEffect(() => {
    if (!user && !isAnonymous) setAuthScreen('login');
  }, [user, isAnonymous]);

  if (loadingAuth) {
    return (
      <Center flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <ActivityIndicator size="large" color={colorMode === 'dark' ? 'white' : 'black'}/>
      </Center>
    );
  }

  if (!user && !isAnonymous) {
    // När användaren är utloggad, visas alltid mörkt tema för login/signup
    // och vi sätter statusfältet manuellt.
    return (
        <>
            <StatusBar barStyle="light-content" />
            <GluestackUIProvider config={config} colorMode={'dark'}>
                {authScreen === 'login' ? (
                    <LoginScreen onGoToSignup={() => setAuthScreen('signup')} />
                ) : (
                    <SignupScreen onGoToLogin={() => setAuthScreen('login')} />
                )}
            </GluestackUIProvider>
        </>
    );
  }

  return (
    <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
      {/* Skärminnehållet renderas här. ScrollView i DuoGameScreen kommer att scrolla oberoende. */}
      {mode === 'menu' && (
        <Center flex={1}>
          <VStack space="lg" alignItems="center">
            <Heading size="2xl" color="$textLight900" sx={{ _dark: { color: '$textDark50' }}}>🎵 Musikquiz</Heading>
            <Text size="md" color="$textLight500" sx={{ _dark: { color: '$textDark400' }}}>{user ? `Inloggad som: ${user.email}` : 'Spelar som gäst'}</Text>
            <Button onPress={() => setMode('duo-setup')}><ButtonText>Start Duo</ButtonText></Button>
            <Button onPress={signOut} variant="link"><ButtonText>{user ? 'Logga ut' : 'Logga in'}</ButtonText></Button>
          </VStack>
        </Center>
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
      
      {/* AppHeader ligger utanför skärmlogiken och kommer inte att scrolla */}
      <AppHeader />
    </Box>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Linda in hela appen */}
      <AuthProvider>
          <ThemeProvider>
              <ThemedApp />
          </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// En hjälpkomponent för att kunna använda useTheme() inuti GluestackUIProvider
function ThemedApp() {
    const { colorMode } = useTheme();
    return (
        <>
            {/* Sätter stilen på statusfältet baserat på temat */}
            <StatusBar barStyle={colorMode === 'dark' ? 'light-content' : 'dark-content'} />
            <GluestackUIProvider config={config} colorMode={colorMode}>
                <AppContent />
            </GluestackUIProvider>
        </>
    );
}
