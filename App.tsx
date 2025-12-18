// =============================
// File: App.tsx (Uppdaterad med global preload vid appstart)
// =============================
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, StatusBar, Animated, NativeSyntheticEvent, NativeScrollEvent, AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// UI & Theme
import { GluestackUIProvider, Text, Box, Button, ButtonText, Heading, VStack, Center, HStack, Image } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';

// Egen kod
import PlayerSetupScreen from './components/PlayerSetupScreen';
import DuoGameScreen from './components/DuoGameScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import SinglePlayerScreen from './components/SinglePlayerScreen'; // ⬅️ NYTT: importera single player
import GameHeader from './components/GameHeader';
import GameFooter from './components/GameFooter';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { auth } from './firebase';
import { ActiveGameMeta, generateGameId, getActiveGames, deleteActiveGame as removeActiveGame } from './storage/gameStorage';

export type CardData = { artist: string; title: string; year: number; spotifyUrl: string };
// ⬇️ NYTT: lägg till 'single'
export type GameMode = 'menu' | 'duo-setup' | 'duo' | 'single';

// NYTT: delad nyckel för lokal historik
const SEEN_SONGS_KEY = 'duoSeenSongsHistory';
// NYTT: global persist-nyckel för förladdat Duo-kort (per användare)
const GLOBAL_DUO_PRELOAD_KEY = (uid: string) => `globalPreload:duo:${uid}`;

const HEADER_HEIGHT = 100; // Ungefärlig höjd på din header, kan behöva justeras
const MIXZTER_LOGO = require('./assets/mixzter-icon-1024.png');

// Hämtar ett kort för global preload (konsumeras EJ här)
const fetchFirstCardForPreload = async (): Promise<CardData | null> => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  try {
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
    if (!res.ok) {
      const errorText = await res.text();
      console.error('App.tsx Preload: Fel från servern:', res.status, errorText);
      return null;
    }
    return (await res.json()) as CardData;
  } catch (err) {
    console.error('App.tsx Preload: Kritiskt fel i nätverksanrop:', err);
    return null;
  }
};

function AppContent() {
  const { user, loadingAuth, isAnonymous, signOut } = useAuth();
  const [mode, setMode] = useState<GameMode>('menu');
  const [gameMode, setGameMode] = useState<string>('default');
  const [players, setPlayers] = useState<{ player1Name: string; player2Name: string } | null>(null);
  const [preloadedDuoCard, setPreloadedDuoCard] = useState<CardData | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');
  const { colorMode } = useTheme();

  const [isPreloading, setIsPreloading] = useState(false);
  const appState = useRef(AppState.currentState);

    // NYTT: menylista över aktiva spel + nuvarande gameId för DuoGameScreen
  const [activeGames, setActiveGames] = useState<ActiveGameMeta[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // Animation logic
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false, listener: (_e: NativeSyntheticEvent<NativeScrollEvent>) => {} }
  );

   // ⬇️ NYTT: Global preload vid appstart/inloggning (även foreground)
  const ensureGlobalDuoPreload = useCallback(async () => {
    if (!user || isAnonymous) return; // Kräver inloggad användare
    if (isPreloading || preloadedDuoCard) return; // Undvik dubbla anrop

    try {
      // 1) Försök hämta från lokal persist först
      const key = GLOBAL_DUO_PRELOAD_KEY(user.uid);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        try {
          const cached = JSON.parse(raw) as CardData;
          setPreloadedDuoCard(cached);
          return; // Inget behov av att hämta nytt
        } catch {}
      }
      
        // 2) Annars – hämta från servern
      setIsPreloading(true);
      const card = await fetchFirstCardForPreload();
      if (card) {
        setPreloadedDuoCard(card);
        try { await AsyncStorage.setItem(key, JSON.stringify(card)); } catch {}
      }
    } finally {
      setIsPreloading(false);
    }
  }, [user, isAnonymous, isPreloading, preloadedDuoCard]);

    // ⬇️ NYTT: När preload-kortet förbrukas i DuoGame – nolla och värm upp nästa
  const handlePreloadConsumed = useCallback(async () => {
    const uid = user?.uid;
    if (uid) {
      try { await AsyncStorage.removeItem(GLOBAL_DUO_PRELOAD_KEY(uid)); } catch {}
    }
    setPreloadedDuoCard(null);
      // Starta ny preload i bakgrunden för nästa nya spelomgång
    ensureGlobalDuoPreload();
  }, [user?.uid, ensureGlobalDuoPreload]);

  // ⬇️ Uppstart/inloggning: säkra att preload finns
  useEffect(() => {
    if (user && !isAnonymous) {
      ensureGlobalDuoPreload();
    } else {
      // Utloggad eller anonym – rensa ev. preload i minnet (persist ligger kvar per användare)
      setPreloadedDuoCard(null);
    }
  }, [user, isAnonymous, ensureGlobalDuoPreload]);

  // Hämta/uppdatera listan när appen blir aktiv + se till att preload finns
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('Appen blev aktiv, kontrollerar global preload & aktiva spel...');
        ensureGlobalDuoPreload();
        refreshActiveGames();
      }
      appState.current = nextAppState;
    });
    return () => { subscription.remove(); };
  }, [ensureGlobalDuoPreload]);

  // NYTT: Hämta aktiva spel för nuvarande användare
  const refreshActiveGames = useCallback(async () => {
    if (!user || isAnonymous) {
      setActiveGames([]);
      return;
    }
    try {
      const list = await getActiveGames(user.uid);
      setActiveGames(list);
    } catch (e) {
      console.warn('Kunde inte läsa aktiva spel', e);
    }
  }, [user, isAnonymous]);

  useEffect(() => { refreshActiveGames(); }, [refreshActiveGames]);

const startDuoGame = (player1Name: string, player2Name: string, selectedMode: string) => {
    if (!user || isAnonymous) {
      Alert.alert('Inloggning krävs', 'Du måste vara inloggad för att spara pågående spel.');
    }
    if (user && activeGames.length >= 2) {
      Alert.alert('Max 2 aktiva spel. Avsluta ett spel i menyn för att starta nytt.');
      return;
    }
    const newId = generateGameId();
    setActiveGameId(newId);
    setPlayers({ player1Name, player2Name });
    setGameMode(selectedMode); // ⬅️ Spara spelläget
    setMode('duo');
  };

    // Återuppta ett sparat spel
const resumeGame = (meta: ActiveGameMeta) => {
    setActiveGameId(meta.id);
    setPlayers({ player1Name: meta.player1, player2Name: meta.player2 });
    // Här skulle man kunna spara gameMode i activeGames-metadatan i framtiden
    // För nu antar vi default eller hanterar det senare
    setGameMode('default'); 
    setMode('duo');
  };

   // Ta bort från meny + 🧹 städning av ev. pending nextCard + lokala seenSongs
  const deleteActiveGameFromMenu = (id: string) => {
    if (!user) return;

    Alert.alert(
      'Avsluta spel',
      'Vill du verkligen avsluta den här spelomgången?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Avsluta',
          style: 'destructive',
          onPress: async () => {
            try {
              const persistKey = `nextCard:${user!.uid}:${id}`;
              const rawNext = await AsyncStorage.getItem(persistKey);

              if (rawNext) {
                try {
                  const pending: CardData = JSON.parse(rawNext);
                  const songIdentifier = `${pending.artist} - ${pending.title}`.toLowerCase();
                  const rawSeen = await AsyncStorage.getItem(SEEN_SONGS_KEY);
                  const arr = rawSeen ? (JSON.parse(rawSeen) as string[]) : [];
                  const filtered = arr.filter((s) => s !== songIdentifier);
                  await AsyncStorage.setItem(SEEN_SONGS_KEY, JSON.stringify(filtered));
                } catch (e) {
                  console.warn('Kunde inte parsa pending nextCard', e);
                }
              }

              await AsyncStorage.removeItem(persistKey);
              await removeActiveGame(user!.uid, id);
              await refreshActiveGames(); // vänta in listuppdatering
            } catch (e) {
              console.warn('Kunde inte städa/avsluta spel', e);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const returnToMenu = () => {
    setPlayers(null);
     // ❗Behåll globalt preload-kort i minnet; det ska EJ nollas här
    setActiveGameId(null);
    setGameMode('default'); // ⬅️ Återställ till default
    setMode('menu');
    refreshActiveGames();
  };

  useEffect(() => { if (!user && !isAnonymous) setAuthScreen('login'); }, [user, isAnonymous]);

  if (loadingAuth) {
    return (
      <Center flex={1}>
        <ActivityIndicator size="large" />
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

    // Huvudmenyn har nu en header men ingen footer
  if (mode === 'menu') {
    return (
      <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <GameHeader />
        <Center flex={1}>
          <VStack space="lg" alignItems="center">
            <Image source={MIXZTER_LOGO} alt="MIXZTER" style={{ width: 120, height: 120, resizeMode: 'contain' }} />
            <Text size="md" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
              {user ? `Inloggad som: ${user.email}` : 'Spelar som gäst'}
            </Text>

            {/* Starta nytt Duo-spel – huvudspelet, överst i menyn */}
            <Button onPress={() => setMode('duo-setup')} isDisabled={!!user && activeGames.length >= 2}>
              <ButtonText>Start New Game</ButtonText>
            </Button>
            {user && activeGames.length >= 2 && (
              <Text size="sm" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
                Max 2 aktiva spel nått. Ta bort/avsluta ett spel för att starta nytt.
              </Text>
            )}

            {/* Start Single Player – under utveckling: outline + grå */}
            <Button variant="outline" action="secondary" onPress={() => setMode('single')}>
              <ButtonText>Single Player Mode</ButtonText>
            </Button>

            {/* Lista över pågående spel */}
            {user && (
              <VStack w="$full" px="$6" space="sm" mt="$4">
                <Heading size="lg">Pågående spel</Heading>
                {activeGames.length === 0 ? (
                  <Text color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>Inga pågående spel.</Text>
                ) : (
                  activeGames.map((g) => (
                    <HStack
                      key={g.id}
                      alignItems="center"
                      justifyContent="space-between"
                      borderWidth={1}
                      borderRadius="$lg"
                      p="$3"
                      bg="$backgroundLight100"
                      sx={{ _dark: { bg: '$backgroundDark800' } }}
                    >
                      <VStack>
                        <Text bold>
                          {g.player1} vs {g.player2}
                        </Text>
                        <Text size="sm">Ställning: {g.p1Score}–{g.p2Score}</Text>
                      </VStack>
                      <HStack space="sm">
                        <Button size="sm" onPress={() => resumeGame(g)}>
                          <ButtonText>Återuppta</ButtonText>
                        </Button>
                        <Button size="sm" variant="outline" action="negative" onPress={() => deleteActiveGameFromMenu(g.id)}>
                          <ButtonText>Avsluta</ButtonText>
                        </Button>
                      </HStack>
                    </HStack>
                  ))
                )}
              </VStack>
            )}

            <Button onPress={signOut} variant="link">
              <ButtonText>{user ? 'Logga ut' : 'Logga in'}</ButtonText>
            </Button>
          </VStack>
        </Center>
      </Box>
    );
  }

  // Single Player – med samma “collapsible header”-setup som Duo
  if (mode === 'single') {
    return (
      <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            transform: [{ translateY: headerTranslateY }],
          }}
        >
          <GameHeader />
        </Animated.View>

        <Box flex={1}>
          <SinglePlayerScreen
            onBackToMenu={returnToMenu}
            headerHeight={HEADER_HEIGHT}
            onScroll={handleScroll}   // ⬅️ viktigt
          />
        </Box>

        <GameFooter onBackToMenu={returnToMenu} />
      </Box>
    );
  }

    // Både PlayerSetup och DuoGame använder nu samma layoutstruktur
  if (mode === 'duo-setup' || (mode === 'duo' && players)) {
    return (
      <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            transform: [{ translateY: headerTranslateY }],
          }}
        >
          <GameHeader />
        </Animated.View>

        <Box flex={1}>
          {mode === 'duo-setup' && (
            // 👇 PlayerSetupScreen skickar nu tillbaka 'selectedMode'
            <PlayerSetupScreen onStart={startDuoGame} onScroll={handleScroll} headerHeight={HEADER_HEIGHT} />
          )}
          {mode === 'duo' && players && (
            <DuoGameScreen
              player1Name={players.player1Name} // OBS: Bytte namn på prop till player1Name för att matcha tidigare steg
              player2Name={players.player2Name}
              gameMode={gameMode} // ⬅️ NYTT: Skickar med spelläget
              onBackToMenu={returnToMenu} // Ändrade onQuit till onBackToMenu om det var namnet i DuoGameScreen
              
              // 👇 LOGIK FÖR PRELOAD:
              // Om vi kör "default" kan vi använda kortet vi laddade vid app-start.
              // Om vi kör "Eurovision" (eller annat) sätter vi null här, så att hooken hämtar ett nytt kort direkt
              // som matchar den valda genren.
              initialPreloadedCard={gameMode === 'default' ? preloadedDuoCard : null}
              
              onPreloadComplete={handlePreloadConsumed}
              onScroll={handleScroll}
              headerHeight={HEADER_HEIGHT}
              gameId={activeGameId}
            />
          )}
        </Box>
        <GameFooter onBackToMenu={returnToMenu} />
      </Box>
    );
  }

  return null; // Fallback
}

export default function App() {
  return (
    <SafeAreaProvider>
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
      <StatusBar barStyle={colorMode === 'dark' ? 'light-content' : 'dark-content'} />
      <GluestackUIProvider config={config} colorMode={colorMode}>
        <AppContent />
      </GluestackUIProvider>
    </>
  );
}
