// =============================
// File: App.tsx (Redesignad med modern web-design)
// =============================
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, StatusBar, Animated, NativeSyntheticEvent, NativeScrollEvent, AppState, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Sun, Moon, User, Users, Trophy, ChevronRight, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

// UI & Theme
import { GluestackUIProvider, Text, Box, Button, ButtonText, Heading, VStack, Center, HStack, Image, Pressable } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';

// Egen kod
import PlayerSetupScreen from './components/PlayerSetupScreen';
import DuoGameScreen from './components/DuoGameScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import SinglePlayerScreen from './components/SinglePlayerScreen';
import GameHeader from './components/GameHeader';
import GameFooter from './components/GameFooter';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { auth } from './firebase';
import { ActiveGameMeta, generateGameId, getActiveGames, deleteActiveGame as removeActiveGame } from './storage/gameStorage';

export type CardData = { artist: string; title: string; year: number; spotifyUrl: string };
export type GameMode = 'menu' | 'duo-setup' | 'duo' | 'single';

const SEEN_SONGS_KEY = 'duoSeenSongsHistory';
const GLOBAL_DUO_PRELOAD_KEY = (uid: string) => `globalPreload:duo:${uid}`;
const HEADER_HEIGHT = 80;

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
  const { colorMode, toggleColorMode } = useTheme();
  
  const [mode, setMode] = useState<GameMode>('menu');
  const [gameMode, setGameMode] = useState<string>('default');
  const [players, setPlayers] = useState<{ player1Name: string; player2Name: string } | null>(null);
  const [preloadedDuoCard, setPreloadedDuoCard] = useState<CardData | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');

  const [isPreloading, setIsPreloading] = useState(false);
  const [isSoloPressed, setIsSoloPressed] = useState(false);
  const appState = useRef(AppState.currentState);
  const [activeGames, setActiveGames] = useState<ActiveGameMeta[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // Animation logic
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  // Press feedback animations
  const duoScaleAnim = useRef(new Animated.Value(1)).current;
  const duoOpacityAnim = useRef(new Animated.Value(1)).current;
  const soloScaleAnim = useRef(new Animated.Value(1)).current;
  const soloOpacityAnim = useRef(new Animated.Value(1)).current;
  const cardScaleAnims = useRef<Animated.Value[]>([]);
  const cardOpacityAnims = useRef<Animated.Value[]>([]);

  // Menu entrance animation
  const menuAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (mode === 'menu') {
      menuAnim.setValue(0);
      Animated.timing(menuAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    }
  }, [mode, menuAnim]);

  // Staggered animations for active games
  const activeAnimValues = useRef<Animated.Value[]>([]);
  useEffect(() => {
    // ensure anim values match activeGames length
    activeAnimValues.current = activeGames.map((_, i) => activeAnimValues.current[i] || new Animated.Value(0));
    // run staggered entrance
    const anims = activeAnimValues.current.map((v, i) => (
      Animated.timing(v, { toValue: 1, duration: 360, delay: i * 90, useNativeDriver: true })
    ));
    Animated.stagger(90, anims).start();
  }, [activeGames]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false, listener: (_e: NativeSyntheticEvent<NativeScrollEvent>) => {} }
  );

  // Press feedback for DUO BATTLE
  const handleDuoPressIn = () => {
    try {
      // Try to use haptics if available, silent fail if not
      const { VibrationPattern } = require('react-native').Vibration;
      const Vibration = require('react-native').Vibration;
      Vibration.vibrate(50);
    } catch {}
    Animated.parallel([
      Animated.timing(duoScaleAnim, { toValue: 0.96, duration: 100, useNativeDriver: true }),
      Animated.timing(duoOpacityAnim, { toValue: 0.8, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleDuoPressOut = () => {
    Animated.parallel([
      Animated.timing(duoScaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(duoOpacityAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  // Press feedback for SOLO JOURNEY
  const handleSoloPressIn = () => {
    setIsSoloPressed(true);
    try {
      const Vibration = require('react-native').Vibration;
      Vibration.vibrate(50);
    } catch {}
    Animated.parallel([
      Animated.timing(soloScaleAnim, { toValue: 0.96, duration: 100, useNativeDriver: true }),
      Animated.timing(soloOpacityAnim, { toValue: 0.8, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleSoloPressOut = () => {
    setIsSoloPressed(false);
    Animated.parallel([
      Animated.timing(soloScaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(soloOpacityAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  // Press feedback for ACTIVE CARDS
  const handleCardPressIn = (index: number) => {
    try {
      const Vibration = require('react-native').Vibration;
      Vibration.vibrate(30);
    } catch {}
    if (!cardScaleAnims.current[index]) {
      cardScaleAnims.current[index] = new Animated.Value(1);
      cardOpacityAnims.current[index] = new Animated.Value(1);
    }
    Animated.parallel([
      Animated.timing(cardScaleAnims.current[index], { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(cardOpacityAnims.current[index], { toValue: 0.85, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleCardPressOut = (index: number) => {
    if (!cardScaleAnims.current[index]) {
      cardScaleAnims.current[index] = new Animated.Value(1);
      cardOpacityAnims.current[index] = new Animated.Value(1);
    }
    Animated.parallel([
      Animated.timing(cardScaleAnims.current[index], { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(cardOpacityAnims.current[index], { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

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

  // Huvudmenyn med ny design
  if (mode === 'menu') {
    return (
      <Box 
        flex={1} 
        bg="$backgroundLight0" 
        sx={{ _dark: { bg: '$backgroundDark950' } }}
      >
        {/* Header */}
        <GameHeader />

        {/* Main Content */}
        <Box flex={1}>
          <Animated.View
            style={{
              opacity: menuAnim,
              transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
              flex: 1,
            }}
          >
            <ScrollView 
              contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 24, flexGrow: 1 }}
              scrollEventThrottle={16}
            >
              <VStack space="xl">

              {/* Quick Start - Hero Buttons */}
              <VStack space="md">
                {/* DUO BATTLE Button - Emerald/Success gradient */}
                {(!user || activeGames.length < 2) ? (
                  <Animated.View 
                    style={{ 
                      transform: [{ scale: duoScaleAnim }],
                      opacity: duoOpacityAnim,
                    }}
                  >
                    <LinearGradient
                      colors={["#059669", "#0f766e"]}
                      start={[0, 0]}
                      end={[1, 1]}
                      style={{ borderRadius: 32, padding: 32 }}
                    >
                    <Pressable 
                      onPress={() => setMode('duo-setup')} 
                      onPressIn={handleDuoPressIn}
                      onPressOut={handleDuoPressOut}
                      style={{ backgroundColor: 'transparent' }}
                      hitSlop={8}
                    >
                      <VStack space="md">
                        <Box
                          bg="rgba(255,255,255,0.15)"
                          w={48}
                          h={48}
                          rounded="$2xl"
                          justifyContent="center"
                          alignItems="center"
                        >
                          <Users size={24} color="white" />
                        </Box>
                        <VStack space="xs">
                          <Text 
                            fontSize="$2xl" 
                            fontWeight="black" 
                            color="white"
                          >
                            DUO BATTLE
                          </Text>
                          <Text 
                            fontSize="$sm" 
                            color="rgba(255,255,255,0.8)"
                            fontWeight="500"
                          >
                            Head-to-head on one device
                          </Text>
                        </VStack>
                      </VStack>
                    </Pressable>
                    </LinearGradient>
                  </Animated.View>
                ) : (
                  <LinearGradient
                    colors={["#059669", "#0f766e"]}
                    start={[0, 0]}
                    end={[1, 1]}
                    style={{ borderRadius: 32, padding: 32, opacity: 0.5 }}
                  >
                    <VStack space="md">
                      <Box
                        bg="rgba(255,255,255,0.15)"
                        w={48}
                        h={48}
                        rounded="$2xl"
                        justifyContent="center"
                        alignItems="center"
                      >
                        <Users size={24} color="white" />
                      </Box>
                      <VStack space="xs">
                        <Text 
                          fontSize="$2xl" 
                          fontWeight="black" 
                          color="white"
                        >
                          DUO BATTLE
                        </Text>
                        <Text 
                          fontSize="$sm" 
                          color="rgba(255,255,255,0.8)"
                          fontWeight="500"
                        >
                          Head-to-head on one device
                        </Text>
                      </VStack>
                    </VStack>
                  </LinearGradient>
                )}

                {/* SOLO JOURNEY Button */}
                <Animated.View
                  style={{ 
                    transform: [{ scale: soloScaleAnim }],
                    opacity: soloOpacityAnim,
                  }}
                >
                  <Pressable
                    onPress={() => setMode('single')}
                    onPressIn={handleSoloPressIn}
                    onPressOut={handleSoloPressOut}
                    hitSlop={16}
                  >
                    <Box
                      bg={isSoloPressed ? "$backgroundLight100" : "$backgroundLight50"}
                      rounded="$3xl"
                      p="$10"
                      borderWidth={2}
                      borderColor={isSoloPressed ? "$backgroundLight300" : "$backgroundLight200"}
                      sx={{
                        _dark: { 
                          bg: isSoloPressed ? '$backgroundDark800' : '$backgroundDark900',
                          borderColor: isSoloPressed ? '$backgroundDark700' : '$backgroundDark800'
                        }
                      }}
                    >
                      <VStack space="md">
                        <Box
                          bg="$backgroundLight200"
                          w={56}
                          h={56}
                          rounded="$2xl"
                          justifyContent="center"
                          alignItems="center"
                          sx={{
                            _dark: { bg: '$backgroundDark800' }
                          }}
                        >
                          <Trophy size={28} color="#f59e0b" />
                        </Box>
                        <VStack space="xs">
                          <Text 
                            fontSize="$2xl" 
                            fontWeight="black" 
                            sx={{
                              _dark: { color: '$textDark100' }
                            }}
                          >
                            SOLO JOURNEY
                          </Text>
                          <Text 
                            fontSize="$sm" 
                            sx={{
                              _dark: { color: '$textDark400' }
                            }}
                            fontWeight="500"
                          >
                            Master the music history
                          </Text>
                        </VStack>
                      </VStack>
                    </Box>
                  </Pressable>
                </Animated.View>

                {user && activeGames.length >= 2 && (
                  <Text 
                    size="sm" 
                    textAlign="center"
                    sx={{ 
                      _dark: { color: '$textDark400' } 
                    }}
                  >
                    Max 2 aktiva spel nått. Avsluta ett spel för att starta nytt.
                  </Text>
                )}
              </VStack>

              {/* Active Games Section */}
              {user && (
                <VStack space="md" mt="$8">
                  <VStack space="md" pb="$4" borderBottomWidth={1} borderBottomColor="$backgroundLight200" sx={{ _dark: { borderBottomColor: '$backgroundDark800' } }}>
                    <HStack justifyContent="space-between" alignItems="center" px="$1">
                      <HStack alignItems="center" gap="$2.5">
                        <Box
                          w={3}
                          h={28}
                          rounded="$full"
                          bg="#059669"
                          sx={{
                            _dark: { bg: '#10b981' }
                          }}
                        />
                        <Text 
                          fontSize="$xl" 
                          fontWeight="black"
                          sx={{
                            _dark: { color: '$textDark100' }
                          }}
                        >
                          RESUME BATTLE
                        </Text>
                      </HStack>
                      <Box
                        px="$3"
                        py="$1.5"
                        bg="rgba(16, 185, 129, 0.08)"
                        rounded="$lg"
                      >
                        <Text 
                          fontSize="$xs" 
                          fontWeight="black"
                          color="#059669"
                          sx={{
                            _dark: { color: '#10b981' }
                          }}
                        >
                          {activeGames.length} Active
                        </Text>
                      </Box>
                    </HStack>
                  </VStack>

                  {activeGames.length === 0 ? (
                    <Box
                      bg="$backgroundLight100"
                      borderWidth={2}
                      borderStyle="dashed"
                      borderColor="$backgroundLight200"
                      rounded="$2xl"
                      p="$8"
                      alignItems="center"
                      justifyContent="center"
                      sx={{
                        _dark: {
                          bg: '$backgroundDark900',
                          borderColor: '$backgroundDark800'
                        }
                      }}
                    >
                      <Text 
                        fontWeight="bold"
                        fontSize="$sm"
                        sx={{
                          _dark: { color: '$textDark500' }
                        }}
                      >
                        No active matches. Ready for a new duel?
                      </Text>
                    </Box>
                  ) : (
                    <VStack space="sm">
                      {activeGames.map((game, index) => (
                        <Animated.View
                          key={game.id}
                          style={{
                            opacity: activeAnimValues.current[index] ? activeAnimValues.current[index] : 1,
                            transform: [
                              {
                                translateY: activeAnimValues.current[index]
                                  ? activeAnimValues.current[index].interpolate({ inputRange: [0, 1], outputRange: [12, 0] })
                                  : 0,
                              },
                            ],
                          }}
                        >
                          <Animated.View
                            style={{
                              transform: [{ scale: cardScaleAnims.current[index] || new Animated.Value(1) }],
                              opacity: cardOpacityAnims.current[index] || new Animated.Value(1),
                              width: '100%',
                            }}
                          >
                          <HStack
                            bg="$backgroundLight100"
                            borderWidth={1}
                            borderColor="$backgroundLight200"
                            rounded="$2xl"
                            p="$4"
                            space="md"
                            sx={{
                              _dark: {
                                bg: '$backgroundDark900',
                                borderColor: '$backgroundDark800'
                              }
                            }}
                          >
                          <Pressable
                            flex={1}
                            flexDirection="row"
                            justifyContent="space-between"
                            alignItems="center"
                            onPressIn={() => handleCardPressIn(index)}
                            onPressOut={() => handleCardPressOut(index)}
                            onPress={() => resumeGame(game)}
                            hitSlop={8}
                          >
                          <HStack space="md" alignItems="center" flex={1}>
                            <Box
                              w={48}
                              h={48}
                              bg="$backgroundLight200"
                              rounded="$xl"
                              justifyContent="center"
                              alignItems="center"
                              sx={{
                                _dark: { bg: '$backgroundDark800' }
                              }}
                            >
                              <Text 
                                fontSize="$lg" 
                                fontWeight="black"
                                sx={{
                                  _dark: { color: '$textDark700' }
                                }}
                              >
                                {`${game.player1.charAt(0).toUpperCase()}·${game.player2.charAt(0).toUpperCase()}`}
                              </Text>
                            </Box>

                            <VStack flex={1} space="xs">
                              <Text 
                                fontSize="$sm"
                                fontWeight="bold"
                                sx={{
                                  _dark: { color: '$textDark100' }
                                }}
                              >
                                {game.player1} vs {game.player2}
                              </Text>
                              <Box
                                px="$3"
                                py="$1"
                                rounded="$md"
                                bg="rgba(16, 185, 129, 0.1)"
                                alignSelf="flex-start"
                              >
                                <Text 
                                  fontSize="$xs" 
                                  fontWeight="black"
                                  color="#059669"
                                  sx={{
                                    _dark: { color: '#10b981' }
                                  }}
                                >
                                  {game.p1Score} - {game.p2Score}
                                </Text>
                              </Box>
                            </VStack>
                          </HStack>

                          <ChevronRight size={18} color="#d1d5db" />
                          </Pressable>

                          <Pressable
                            onPress={() => deleteActiveGameFromMenu(game.id)}
                            hitSlop={8}
                            bg="rgba(239, 68, 68, 0.1)"
                            p="$2"
                            rounded="$xl"
                            justifyContent="center"
                            alignItems="center"
                            w={32}
                            h={32}
                            sx={{ borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', _dark: { borderColor: 'rgba(239,68,68,0.45)' } }}
                          >
                            <X size={12} color="#dc2626" strokeWidth={3} />
                          </Pressable>
                          </HStack>
                          </Animated.View>

                          </Animated.View>
                      ))}
                    </VStack>
                  )}
                </VStack>
              )}

              {/* Sign Out Button - REMOVED: Now in UserProfile component */}
            </VStack>
          </ScrollView>
            </Animated.View>
        </Box>
      </Box>
    );
  }

  // Single Player – med samma "collapsible header"-setup som Duo
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

        <Box flex={1} position="relative">
          <SinglePlayerScreen
            onBackToMenu={returnToMenu}
            headerHeight={HEADER_HEIGHT}
            onScroll={handleScroll}
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

        <Box flex={1} position="relative">
          {mode === 'duo-setup' && (
            <PlayerSetupScreen onStart={startDuoGame} onScroll={handleScroll} headerHeight={HEADER_HEIGHT} />
          )}
          {mode === 'duo' && players && (
            <DuoGameScreen
              player1Name={players.player1Name}
              player2Name={players.player2Name}
              gameMode={gameMode}
              onBackToMenu={returnToMenu}
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
