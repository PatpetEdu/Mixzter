// =============================
// File: App.tsx (Redesignad med modern web-design)
// =============================
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, StatusBar, Animated, NativeSyntheticEvent, NativeScrollEvent, AppState, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Sun, Moon, User, Users, Trophy, ChevronRight, X, Eye } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

// UI & Theme
import { GluestackUIProvider, Text, Box, Button, ButtonText, Heading, VStack, Center, HStack, Image, Pressable } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';

// Egen kod
import PlayerSetupScreen from './components/PlayerSetupScreen';
import DuoGameScreen from './components/DuoGameScreen';
import ScoreBattleScreen from './components/ScoreBattleScreen';
import ScoreBattleSetupScreen from './components/ScoreBattleSetupScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import SinglePlayerScreen from './components/SinglePlayerScreen';
import SpectatorJoinScreen from './components/SpectatorJoinScreen';
import SpectatorScreen from './components/SpectatorScreen';
import GameHeader from './components/GameHeader';
import GameFooter from './components/GameFooter';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { auth } from './firebase';
import { db } from './firebase';
import { deleteDoc, doc, collection, getDocs } from 'firebase/firestore';
import { ActiveGameMeta, generateGameId, getActiveGames, deleteActiveGame as removeActiveGame, saveScoreBattleMeta } from './storage/gameStorage';

export type GameMode = 'menu' | 'duo-setup' | 'duo' | 'single' | 'spectator-join' | 'spectator' | 'score-setup' | 'score';

const HEADER_HEIGHT = 80;

function AppContent() {
  const { user, loadingAuth, isAnonymous, signOut } = useAuth();
  const { colorMode, toggleColorMode } = useTheme();
  
  const [mode, setMode] = useState<GameMode>('menu');
  const [gameMode, setGameMode] = useState<string>('default');
  const [playerNames, setPlayerNames] = useState<string[] | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');

  const [isSoloPressed, setIsSoloPressed] = useState(false);
  const appState = useRef(AppState.currentState);
  const [activeGames, setActiveGames] = useState<ActiveGameMeta[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [spectatorGameId, setSpectatorGameId] = useState<string | null>(null);
  const [scoreBattlePlayers, setScoreBattlePlayers] = useState<string[] | null>(null);
  const [scoreBattleMode, setScoreBattleMode] = useState<string>('default');
  const [scoreBattleTarget, setScoreBattleTarget] = useState<number>(30);
  const [scoreBattleMaxRounds, setScoreBattleMaxRounds] = useState<number | null>(null);
  const [scoreBattleGameId, setScoreBattleGameId] = useState<string | null>(null);
  const [scoreBattleHostPlayerIndex, setScoreBattleHostPlayerIndex] = useState<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    { 
      useNativeDriver: false, 
      listener: (_e: NativeSyntheticEvent<NativeScrollEvent>) => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 300);
      }
    }
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

  // Hämta/uppdatera listan när appen blir aktiv
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        refreshActiveGamesRef.current();
      }
      appState.current = nextAppState;
    });
    return () => { subscription.remove(); };
  }, []);

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

  // Ref som alltid pekar på senaste refreshActiveGames – används av AppState-lyssnaren
  const refreshActiveGamesRef = useRef(refreshActiveGames);
  useEffect(() => { refreshActiveGamesRef.current = refreshActiveGames; }, [refreshActiveGames]);

  useEffect(() => { refreshActiveGames(); }, [refreshActiveGames]);

  // Ladda om aktiva spel varje gång menyn visas
  useEffect(() => {
    if (mode === 'menu') refreshActiveGamesRef.current();
  }, [mode]);

// Helper function to normalize game data (handles both old and new formats)
const getGameDisplayData = (game: any) => {
  // New format: playerNames and scores
  if (game.playerNames && Array.isArray(game.playerNames)) {
    return {
      initials: game.playerNames.map((name: string) => name.charAt(0).toUpperCase()).join('·'),
      names: game.playerNames.join(' vs '),
      scoreDisplay: game.playerNames.map((name: string) => game.scores?.[name] ?? 0).join(' - '),
    };
  }
  // Old format: player1, player2, p1Score, p2Score
  if (game.player1 && game.player2) {
    return {
      initials: `${game.player1.charAt(0).toUpperCase()}·${game.player2.charAt(0).toUpperCase()}`,
      names: `${game.player1} vs ${game.player2}`,
      scoreDisplay: `${game.p1Score ?? 0} - ${game.p2Score ?? 0}`,
    };
  }
  // Fallback
  return {
    initials: '?',
    names: 'Unknown',
    scoreDisplay: '0 - 0',
  };
};

const startDuoGame = (playerNamesArray: string[], selectedMode: string) => {
    if (!user || isAnonymous) {
      Alert.alert('Inloggning krävs', 'Du måste vara inloggad för att spara pågående spel.');
    }
    if (user && activeGames.length >= 5) {
      Alert.alert('Max 5 aktiva spel. Avsluta ett spel i menyn för att starta nytt.');
      return;
    }
    const newId = generateGameId();
    setActiveGameId(newId);
    setPlayerNames(playerNamesArray);
    setGameMode(selectedMode);
    setMode('duo');
  };

    // Återuppta ett sparat spel
const resumeGame = (meta: ActiveGameMeta) => {
    if (meta.gameType === 'score') {
      setScoreBattlePlayers(meta.playerNames);
      setScoreBattleMode(meta.gameMode);
      setScoreBattleTarget(meta.targetScore ?? 30);
      setScoreBattleMaxRounds(meta.maxRounds ?? null);
      setScoreBattleGameId(meta.id);
      setScoreBattleHostPlayerIndex(0);
      setMode('score');
    } else {
      setActiveGameId(meta.id);
      setPlayerNames(meta.playerNames);
      setGameMode(meta.gameMode);
      setMode('duo');
    }
  };

   // Ta bort från meny + 🧹 städning av ev. pending nextCard + lokala seenSongs
  const deleteActiveGameFromMenu = (id: string) => {
    if (!user) return;
    const gameMeta = activeGames.find(g => g.id === id);

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
              // Rensa persisterad nextCard och score battle state för detta spel
              await AsyncStorage.removeItem(`nextCard:${user!.uid}:${id}`).catch(() => {});
              await AsyncStorage.removeItem(`scoreBattle:${user!.uid}:${id}`).catch(() => {});

              // Ta bort ur active games-indexet (oavsett speltyp)
              await removeActiveGame(user!.uid, id).catch(() => {});

              // Firestore-städning – DUO-spel (spectators + games) och Score Battle (scoreBattleRooms)
              if (!gameMeta || gameMeta.gameType !== 'score') {
                try {
                  const spectatorsRef = collection(db, 'games', id, 'spectators');
                  const spectatorsSnap = await getDocs(spectatorsRef);
                  const deletePromises = spectatorsSnap.docs.map(doc => deleteDoc(doc.ref));
                  await Promise.all(deletePromises);
                } catch (e) {
                  // Ignorera - spectators kan redan vara raderade
                }

                try {
                  await deleteDoc(doc(db, 'games', id));
                } catch (e) {
                  console.warn('Kunde inte radera Firestore game-dokument', e);
                }
              } else {
                // Score Battle – radera Firestore-rummet så webbspelarna ser att spelet är slut
                try {
                  await deleteDoc(doc(db, 'scoreBattleRooms', id));
                } catch (e) {
                  // Ignorera – kanske aldrig skapades (t.ex. ej påbörjat)
                }
              }

              await refreshActiveGames();
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
    setPlayerNames(null);
    setActiveGameId(null);
    setGameMode('default');
    setScoreBattlePlayers(null);
    setScoreBattleMode('default');
    setScoreBattleTarget(30);
    setScoreBattleMaxRounds(null);
    setScoreBattleGameId(null);
    setScoreBattleHostPlayerIndex(0);
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
        {/* Header – absolut så innehåll scrollar under den */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
          }}
          pointerEvents="box-none"
        >
          <GameHeader />
        </Animated.View>

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
              contentContainerStyle={{ paddingTop: HEADER_HEIGHT + 24, paddingBottom: 24, paddingHorizontal: 24, flexGrow: 1 }}
              scrollEventThrottle={16}
            >
              <VStack space="xl">

              {/* Quick Start - Hero Buttons */}
              <VStack space="md">
                {/* DUO BATTLE Button - Emerald/Success gradient */}
                {(!user || activeGames.length < 5) ? (
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
                      disabled={isScrolling}
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
                            MUSIC BATTLE
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
                          MUSIC BATTLE
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
                {/* SOLO JOURNEY – temporärt dold, ej färdig för produktion
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
                    disabled={isScrolling}
                    hitSlop={8}
                  >
                    <Box
                      bg={isSoloPressed ? "$backgroundLight100" : "$backgroundLight100"}
                      rounded="$3xl"
                      p="$10"
                      sx={{
                        _dark: { 
                          bg: isSoloPressed ? '$backgroundDark800' : '$backgroundDark900'
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
                */ /* end SOLO JOURNEY */}

                {/* SCORE BATTLE */}
                {(!user || activeGames.length < 5) ? (
                  <Animated.View
                    style={{
                      transform: [{ scale: duoScaleAnim }],
                      opacity: duoOpacityAnim,
                    }}
                  >
                    <LinearGradient
                      colors={['#3730a3', '#4f46e5']}
                      start={[0, 0]}
                      end={[1, 1]}
                      style={{ borderRadius: 32, padding: 32 }}
                    >
                      <Pressable
                        onPress={() => setMode('score-setup')}
                        onPressIn={handleDuoPressIn}
                        onPressOut={handleDuoPressOut}
                        disabled={isScrolling}
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
                            <Trophy size={24} color="white" />
                          </Box>
                          <VStack space="xs">
                            <Text fontSize="$2xl" fontWeight="black" color="white">
                              SCORE BATTLE
                            </Text>
                            <Text fontSize="$sm" color="rgba(255,255,255,0.8)" fontWeight="500">
                              Gissa år – samla poäng – vinn!
                            </Text>
                          </VStack>
                        </VStack>
                      </Pressable>
                    </LinearGradient>
                  </Animated.View>
                ) : null}

                {user && activeGames.length >= 5 && (
                  <Text 
                    size="sm" 
                    textAlign="center"
                    sx={{ 
                      _dark: { color: '$textDark400' } 
                    }}
                  >
                    Max 5 aktiva spel nått. Avsluta ett spel för att starta nytt.
                  </Text>
                )}

                {/* SPECTATOR MODE - Small Button */}
                <Pressable
                  onPress={() => setMode('spectator-join')}
                  disabled={isScrolling}
                  hitSlop={8}
                  alignSelf="flex-start"
                  mt="$2"
                >
                  <HStack 
                    bg="$backgroundLight100"
                    rounded="$2xl"
                    px="$5"
                    py="$3"
                    space="md"
                    alignItems="center"
                    sx={{
                      _dark: { bg: '$backgroundDark900' }
                    }}
                  >
                    <Box 
                      w={32}
                      h={32}
                      bg="$backgroundLight200"
                      rounded="$lg"
                      justifyContent="center"
                      alignItems="center"
                      sx={{
                        _dark: { bg: '$backgroundDark800' }
                      }}
                    >
                      <Eye size={16} color="#6366f1" />
                    </Box>
                    <VStack space="xs">
                      <Text 
                        fontSize="$sm" 
                        fontWeight="bold"
                        sx={{
                          _dark: { color: '$textDark100' }
                        }}
                      >
                        Watch Live
                      </Text>
                      <Text 
                        fontSize="$xs" 
                        sx={{
                          _dark: { color: '$textDark400' }
                        }}
                      >
                        Follow a friend's game
                      </Text>
                    </VStack>
                  </HStack>
                </Pressable>
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
                                {getGameDisplayData(game).initials}
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
                                {getGameDisplayData(game).names}
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
                                  {getGameDisplayData(game).scoreDisplay}
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
          <GameHeader gameMode={scoreBattleMode} onBackToMenu={returnToMenu} />
        </Animated.View>

        <Box flex={1} position="relative">
          <SinglePlayerScreen
            onBackToMenu={returnToMenu}
            headerHeight={HEADER_HEIGHT}
            onScroll={handleScroll}
          />
        </Box>
      </Box>
    );
  }

  // Både PlayerSetup och DuoGame använder nu samma layoutstruktur
  if (mode === 'duo-setup' || (mode === 'duo' && playerNames)) {
    return (
      <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            height: HEADER_HEIGHT,
            transform: [{ translateY: headerTranslateY }],
          }}
          pointerEvents="box-none"
        >
          <GameHeader gameMode={mode === 'duo' ? gameMode : undefined} onBackToMenu={returnToMenu} />
        </Animated.View>

        <Box flex={1} position="relative">
          {mode === 'duo-setup' && (
            <PlayerSetupScreen onStart={startDuoGame} onScroll={handleScroll} headerHeight={HEADER_HEIGHT} />
          )}
          {mode === 'duo' && playerNames && (
            <DuoGameScreen
              playerNames={playerNames}
              gameMode={gameMode}
              onBackToMenu={returnToMenu}
              onScroll={handleScroll}
              headerHeight={HEADER_HEIGHT}
              gameId={activeGameId}
            />
          )}
        </Box>
      </Box>
    );
  }

  // Score Battle Setup
  if (mode === 'score-setup') {
    return (
      <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            height: HEADER_HEIGHT,
            transform: [{ translateY: headerTranslateY }],
          }}
          pointerEvents="box-none"
        >
          <GameHeader gameMode={scoreBattleMode} onBackToMenu={returnToMenu} />
        </Animated.View>
        <Box flex={1} position="relative">
          <ScoreBattleSetupScreen
            onStart={(names, selectedMode, target, rounds, hostPlayerIndex) => {
              setScoreBattlePlayers(names);
              setScoreBattleMode(selectedMode);
              setScoreBattleTarget(target);
              setScoreBattleMaxRounds(rounds);
              setScoreBattleGameId(generateGameId());
              setScoreBattleHostPlayerIndex(hostPlayerIndex);
              setMode('score');
            }}
            onScroll={handleScroll}
            headerHeight={HEADER_HEIGHT}
          />
        </Box>
      </Box>
    );
  }

  // Score Battle – spelskärm
  if (mode === 'score' && scoreBattlePlayers) {
    return (
      <Box flex={1} bg="#0b0b0c">
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            height: HEADER_HEIGHT,
            transform: [{ translateY: headerTranslateY }],
          }}
          pointerEvents="box-none"
        >
          <GameHeader gameMode={scoreBattleMode} onBackToMenu={returnToMenu} />
        </Animated.View>
        <Box flex={1} position="relative">
          <ScoreBattleScreen
            playerNames={scoreBattlePlayers}
            gameMode={scoreBattleMode}
            hostPlayerIndex={scoreBattleHostPlayerIndex}
            onChangeHostPlayerIndex={setScoreBattleHostPlayerIndex}
            targetScore={scoreBattleTarget}
            maxRounds={scoreBattleMaxRounds}
            gameId={scoreBattleGameId}
            onBackToMenu={returnToMenu}
            headerHeight={HEADER_HEIGHT}
            onScroll={handleScroll}
          />
        </Box>
      </Box>
    );
  }

  // Spectator Mode
  if (mode === 'spectator-join') {
    return (
      <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <SpectatorJoinScreen 
          onJoinGame={(gameId) => {
            setSpectatorGameId(gameId);
            setMode('spectator');
          }}
          onBack={() => setMode('menu')}
        />
      </Box>
    );
  }

  if (mode === 'spectator' && spectatorGameId) {
    return (
      <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            height: HEADER_HEIGHT,
            transform: [{ translateY: headerTranslateY }],
          }}
          pointerEvents="box-none"
        >
          <GameHeader onBackToMenu={() => { setSpectatorGameId(null); setMode('menu'); }} />
        </Animated.View>

        <Box flex={1} position="relative">
          <SpectatorScreen 
            gameId={spectatorGameId}
            headerHeight={HEADER_HEIGHT}
            onLeave={() => {
              setSpectatorGameId(null);
              setMode('menu');
            }}
            onScroll={handleScroll}
          />
        </Box>
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
