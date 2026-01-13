import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ActivityIndicator, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Animated, KeyboardAvoidingView, Platform, Vibration, Pressable as RNPressable, View } from 'react-native';
import {
  Box, Text, Button, ButtonText, VStack, HStack, Input, InputField, Center, Icon, Pressable,
} from '@gluestack-ui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import AnimatedCard from './AnimatedCard';
import CardSkeleton from './CardSkeleton';
import ScoreScreen from './ScoreScreen';
import { useGenerateSongs } from './useGenerateSongs';
import { useDuoGameLogic, MAX_STARS } from '../hooks/useDuoGameLogic';
import { useAuth } from '../hooks/useAuth';
import { deleteActiveGame, loadActiveGame, saveActiveGame, SavedDuoGameState } from '../storage/gameStorage';
import { Music, Info, ChevronDown, ChevronUp } from 'lucide-react-native';

// Typer
export type Card = {
  title: string;
  artist: string;
  year: number;
  spotifyUrl: string;
  source?: string;
  previewData?: {
    previewUrl: string;
    artworkUrl?: string;
    externalUrl: string;
    previewProvider: 'itunes' | 'deezer';
  };
};
type Player = { name: string; timeline: number[]; cards: Card[]; startYear: number; stars: number };

type Props = {
  playerNames: string[]; // ⬅️ Changed to array supporting 2-5 players
  gameMode: string;    // ⬅️ NYTT: Tar emot spelläget
  onBackToMenu: () => void;
  initialPreloadedCard: Card | null;
  onPreloadComplete: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  headerHeight: number;
    // ID för aktivt spel (för sparning/återupptag)
  gameId: string | null;
};

const currentYear = new Date().getFullYear();
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Lokal konstant för delad historiknyckel
const SEEN_SONGS_KEY = 'duoSeenSongsHistory';

export default function DuoGameScreen({
  playerNames, // ⬅️ Changed to array supporting 2-5 players
  gameMode,    // ⬅️ NYTT
  initialPreloadedCard,
  onPreloadComplete,
  onScroll,
  headerHeight,
  gameId,
}: Props) {
  const { user, isAnonymous } = useAuth();

    // Persist per spel (och användare) för nextCard
  const persistKey = user && gameId ? `nextCard:${user.uid}:${gameId}` : undefined;

 const { card, setCard, isLoadingCard, errorMessage, generateCard, isHydrating } = useGenerateSongs(
    initialPreloadedCard,
    onPreloadComplete,
    gameMode, 
    persistKey
  );

  const [guess, setGuess] = useState('');
  const [guessConfirmed, setGuessConfirmed] = useState(false);
  const [isGuessValid, setIsGuessValid] = useState(true);
  const [showBack, setShowBack] = useState(false);
  const [isSongInfoVisible, setIsSongInfoVisible] = useState(false);
  const [opponentExpanded, setOpponentExpanded] = useState(false);
  const [activePlayerExpanded, setActivePlayerExpanded] = useState(true);
  const [isSkipping, setIsSkipping] = useState(false);
  const [wasSkipped, setWasSkipped] = useState(false);

    // Ny state för "Före/Efter"-logiken
  const [showPlacementChoice, setShowPlacementChoice] = useState(false);
  const [placement, setPlacement] = useState<'before' | 'after' | null>(null);

    // 🔄 separat flagga för återställning av spelsessionen (players/roundCards/UI)
  const [isRestoring, setIsRestoring] = useState(true);

  // 🔸 Litet override så att vi kan rendera korrekt “Rätt gissat!” från storage direkt
  const [wasCorrectOverride, setWasCorrectOverride] = useState<boolean | null>(null);

  // 🎵 Audio preview playback
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewPlayerRef = useRef<ReturnType<typeof useAudioPlayer> | null>(null);

  // Dynamic player based on current preview URL
  const previewPlayer = useAudioPlayer(currentPreviewUrl || '');

  useEffect(() => {
    previewPlayerRef.current = previewPlayer;
  }, [previewPlayer]);

  // 🎵 State för modal över år i tidslinjen
  const [selectedYearCard, setSelectedYearCard] = useState<Card | null>(null);
  const [showYearModal, setShowYearModal] = useState(false);
  const [yearPosition, setYearPosition] = useState({ x: 0, y: 0 });
  const [carouselCards, setCarouselCards] = useState<Card[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const modalAnimScale = React.useRef(new Animated.Value(0.3)).current;
  const modalAnimOpacity = React.useRef(new Animated.Value(0)).current;
  const modalAnimTranslate = React.useRef(new Animated.Value(1)).current;

  // Funktion för att hitta kort baserat på år från en spelare
  const findCardByYear = (player: Player, year: number): Card | null => {
    return player.cards.find(c => c.year === year) || null;
  };

  // Funktion för att öppna modal med kort
  const handleYearPress = (player: Player, year: number, event?: any) => {
    // Samla alla kort för detta år (både preliminära och sparade)
    const cardsForYear = [
      ...roundCards.filter(c => c.year === year),
      ...player.cards.filter(c => c.year === year && !roundCards.some(rc => rc.year === year && rc.artist === c.artist && rc.title === c.title))
    ];
    
    // Visa modal endast om vi hittar kortet(en)
    if (cardsForYear.length > 0) {
      // Spara position från event om tillgänglig
      if (event?.nativeEvent?.pageX && event?.nativeEvent?.pageY) {
        setYearPosition({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
      }
      
      setCarouselCards(cardsForYear);
      setCarouselIndex(0);
      setSelectedYearCard(cardsForYear[0]);
      setShowYearModal(true);
      
      // Starta animationen
      modalAnimScale.setValue(0.3);
      modalAnimOpacity.setValue(0);
      modalAnimTranslate.setValue(0);
      
      Animated.parallel([
        Animated.timing(modalAnimScale, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(modalAnimOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(modalAnimTranslate, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const {
    players,
    activePlayer,
    roundCards,
    wasCorrect,
    gameOverMessage,
    starAwardedThisTurn,
    awardStar,
    skipSong,
    confirmGuess,
    saveAndEndTurn,
    resetTurnState,
    switchPlayerTurn,
    loadSavedGame,
  } = useDuoGameLogic({
    playerNames: playerNames,
    gameMode: gameMode,
    onNewCardNeeded: () => {
      setCard(null);
      resetInputs();
      generateCard(resetInputs);
    },
  });

  const resetInputs = useCallback(() => {
    setGuess('');
    setGuessConfirmed(false);
    setIsGuessValid(true);
    setShowBack(false);
    setIsSongInfoVisible(false);
    setShowPlacementChoice(false);
    setPlacement(null);
    setWasCorrectOverride(null);
    setWasSkipped(false);
    setIsPlayingPreview(false);
    // Stop preview if playing
    if (isPlayingPreview && previewPlayerRef.current) {
      previewPlayerRef.current.pause();
      setCurrentPreviewUrl(null);
    }
    resetTurnState();
  }, [resetTurnState, isPlayingPreview]);

  // 🎵 Handle preview playback
  const handlePlayPreview = useCallback((previewUrl: string) => {
    try {
      if (isPlayingPreview && currentPreviewUrl === previewUrl && previewPlayerRef.current) {
        // Stop if same preview is playing
        previewPlayerRef.current.pause();
        setIsPlayingPreview(false);
        setCurrentPreviewUrl(null);
        return;
      }

      // Start new preview
      setCurrentPreviewUrl(previewUrl);
      setIsPlayingPreview(true);
    } catch (error) {
      console.error('Error playing preview:', error);
      setIsPlayingPreview(false);
    }
  }, [isPlayingPreview, currentPreviewUrl]);

  // Auto-reset play icon when preview finishes (previews are ~30 seconds)
  useEffect(() => {
    if (!isPlayingPreview) return;

    // Set a timeout to reset play state after preview duration
    // Most previews are 30 seconds, we use 35 to be safe
    const previewTimeout = setTimeout(() => {
      setIsPlayingPreview(false);
    }, 35000);

    return () => clearTimeout(previewTimeout);
  }, [isPlayingPreview]);

  // Auto-play when URL changes
  useEffect(() => {
    if (currentPreviewUrl && previewPlayerRef.current && isPlayingPreview) {
      previewPlayerRef.current.play();
    }
  }, [currentPreviewUrl, isPlayingPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewPlayerRef.current && isPlayingPreview) {
        previewPlayerRef.current.pause();
      }
    };
  }, []);

  // Vänta in hydrering OCH återställning innan första autogenerate
  useEffect(() => {
    if (!isHydrating && !isRestoring && !card && !initialPreloadedCard && !gameOverMessage) {
      generateCard(resetInputs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrating, isRestoring]);

  // 🧩 Återställning från storage – använd currentCard + uiSnapshot + postGuess om de finns
  useEffect(() => {
    if (!gameId || !user || isAnonymous) {
      setIsRestoring(false);
      return;
    }
    (async () => {
      const saved = await loadActiveGame(user.uid, gameId);
      if (saved) {
        // Hydrera players mm i hooken först
        loadSavedGame({ players: saved.players as any, activePlayer: saved.activePlayer, roundCards: saved.roundCards });

        // 1) Om det finns explicit UI-snapshot + currentCard (rekommenderad väg)
        if (saved.currentCard && saved.uiSnapshot) {
          setCard(saved.currentCard);
          setShowBack(!!saved.uiSnapshot.showBack);
          setGuess(saved.uiSnapshot.guess ?? '');
          setShowPlacementChoice(!!saved.uiSnapshot.showPlacementChoice);
          setPlacement(saved.uiSnapshot.placement ?? null);
          setIsSongInfoVisible(!!saved.uiSnapshot.isSongInfoVisible);
          setGuessConfirmed(!!saved.uiSnapshot.guessConfirmed);
          if (saved.postGuess && typeof saved.postGuess.wasCorrect === 'boolean') {
            setWasCorrectOverride(saved.postGuess.wasCorrect);
          }
          setIsRestoring(false);
          return;
        }

        // 2) Bakåtkomp: om postGuess finns, använd det för att rendera back-sida korrekt
        const postGuess = (saved as any)?.postGuess as { card?: Card | null; wasCorrect?: boolean } | undefined;
        if (postGuess?.card) {
          setCard(postGuess.card);
          setShowBack(true);
          setGuessConfirmed(true);
          setShowPlacementChoice(false);
          setPlacement(null);
          setIsSongInfoVisible(false);
          if (typeof postGuess.wasCorrect === 'boolean') setWasCorrectOverride(postGuess.wasCorrect);
          setIsRestoring(false);
          return;
        }

        // 3) Fallback: om rundan hade preliminära kort => visa back med sista kortet
        if (saved.roundCards && saved.roundCards.length > 0) {
          const last = saved.roundCards[saved.roundCards.length - 1];
          setCard(last);
          setShowBack(true);
          setGuessConfirmed(true);
          setShowPlacementChoice(false);
          setPlacement(null);
          setIsSongInfoVisible(false);
        }
      }
      setIsRestoring(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user?.uid, isAnonymous]);

  // 💾 Spara spelet löpande (debounce ~500ms) – nu med currentCard + uiSnapshot + formell postGuess
  useEffect(() => {
    if (!user || isAnonymous || !gameId) return;
    const id = setTimeout(() => {
      const payload: SavedDuoGameState = {
        id: gameId,
        playerNames: playerNames, // ⬅️ Updated to array
        gameMode: gameMode, // 🔸 NYTT: Spara game mode
        players: players as any,
        activePlayer,
        roundCards,
        createdAt: Date.now(),
        updatedAt: Date.now(),

        // 🔸 NYTT: spara “vilket kort visas just nu”
        currentCard: card ?? null,

        // 🔸 NYTT: spara exakt UI-läge (så vi kan återgå till front/back + inputs)
        uiSnapshot: {
          showBack,
          guess,
          showPlacementChoice,
          placement,
          isSongInfoVisible,
          guessConfirmed,
        },

        // 🔸 NYTT (formellt): spara back-lägets facit
        postGuess: showBack ? { card: card ?? null, wasCorrect: !!wasCorrect } : undefined,
      };
      // cast räcker – AsyncStorage sparar ändå extra fält

      saveActiveGame(user.uid, payload).catch((e) => console.warn('Kunde inte spara aktivt spel', e));
    }, 500);
    return () => clearTimeout(id);
  }, [
    players, activePlayer, roundCards,
    showBack, wasCorrect, card,
    user, isAnonymous, gameId, playerNames,
    guess, showPlacementChoice, placement, isSongInfoVisible, guessConfirmed
  ]);

  // 🧹 Ta bort sparat spel + städa ev. pending nextCard vid game over
  useEffect(() => {
    if (gameOverMessage && user && !isAnonymous && gameId) {
      (async () => {
        try {
          const persist = `nextCard:${user.uid}:${gameId}_${gameMode}`;
          const rawNext = await AsyncStorage.getItem(persist);
          if (rawNext) {
            try {
              const pending: Card = JSON.parse(rawNext);
              const songIdentifier = `${pending.artist} - ${pending.title}`.toLowerCase();
              const rawSeen = await AsyncStorage.getItem(SEEN_SONGS_KEY);
              const arr = rawSeen ? (JSON.parse(rawSeen) as string[]) : [];
              const filtered = arr.filter((s) => s !== songIdentifier);
              await AsyncStorage.setItem(SEEN_SONGS_KEY, JSON.stringify(filtered));
            } catch {}
            await AsyncStorage.removeItem(persist);
          } else {
            await AsyncStorage.removeItem(persist);
          }
        } catch (e) {
          console.warn('Kunde inte städa pending nextCard/seenSongs vid game over', e);
        }
        await deleteActiveGame(user.uid, gameId).catch(() => {});
      })();
    }
  }, [gameOverMessage, user, isAnonymous, gameId, gameMode]);

  const handleAwardStar = () => awardStar();
  const handleSkipSong = () => {
    setIsSkipping(true);
    setWasSkipped(true);
    // Visa BackCard så spelaren kan se vilken låt det var
    setShowBack(true);
    setGuessConfirmed(true);
    // VÄNTA MED skipSong tills användaren klickar "Next Song"
    setIsSkipping(false);
  };
  
  const handleNextSongAfterSkip = () => {
    // skipSong() anropar onNewCardNeeded som anropar generateCard(resetInputs)
    // Så vi behöver bara anropa skipSong()
    skipSong();
  };
  const handleToggleSongInfo = () => setIsSongInfoVisible((prev) => !prev);
  const handleSave = () => saveAndEndTurn();

  const handleConfirmGuess = () => {
    const year = parseInt(guess, 10);
    const valid = /^[0-9]{4}$/.test(guess) && year >= 1900 && year <= currentYear;
    setIsGuessValid(valid);
    if (!valid || !card) return;

    const p = players[activePlayer];
    const fullTimeline = [p.startYear, ...p.timeline, ...roundCards.map((c) => c.year)];

    if (fullTimeline.includes(year)) {
      setShowPlacementChoice(true); // Visa Före/Efter-valen
    } else {
      setGuessConfirmed(true);
      setShowBack(true);
      confirmGuess(guess, card);
    }
  };

  const handlePlacementConfirm = () => {
    if (!placement || !card) return;
    setGuessConfirmed(true);
    setShowBack(true);
    setShowPlacementChoice(false);
    confirmGuess(guess, card, placement);
  };

  const handleContinue = () => {
    resetInputs();
    generateCard(resetInputs);
  };

  const renderTimeline = (player: Player, isCurrentPlayer: boolean) => {
    const finalTimeline = [player.startYear, ...player.timeline];
    const roundTimeline = isCurrentPlayer ? roundCards.map((c) => c.year) : [];
    const allYears = Array.from(new Set([...finalTimeline, ...roundTimeline])).sort((a, b) => a - b);
    const isFirstPlayer = player.name === playerNames[0]; // Check if this is the starting player
    
    return (
      <>
        <Box
          w="$full"
          mb="$4"
          p="$5"
          borderRadius="$3xl"
          borderWidth={1}
          borderColor={isCurrentPlayer ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 100, 110, 0.3)'}
          bg={isCurrentPlayer ? 'rgba(255, 255, 255, 0.95)' : 'rgba(100, 100, 110, 0.05)'}
          sx={{ 
            _dark: { 
              bg: isCurrentPlayer ? 'rgba(20, 20, 22, 0.8)' : 'rgba(40, 40, 45, 0.6)',
              borderColor: isCurrentPlayer ? 'rgba(16, 185, 129, 0.3)' : 'rgba(80, 80, 90, 0.4)'
            } 
          }}
        >
          <Pressable
            onPress={() => !isCurrentPlayer ? setOpponentExpanded(!opponentExpanded) : setActivePlayerExpanded(!activePlayerExpanded)}
            sx={{
              _pressed: {
                opacity: 0.7,
                transform: [{ scale: 0.98 }],
              },
            }}
          >
            <HStack justifyContent="space-between" alignItems="center" mb={isCurrentPlayer || (isCurrentPlayer ? activePlayerExpanded : opponentExpanded) ? "$3" : 0}>
              <HStack alignItems="center" space="md">
                <Box 
                  w={4.5} 
                  h={4.5} 
                  borderRadius="$full" 
                  bg={isCurrentPlayer ? '$emerald500' : 'transparent'}
                  sx={{
                    _dark: {
                      bg: isCurrentPlayer ? '$emerald500' : 'transparent'
                    }
                  }}
                />
                <HStack alignItems="center" space="xs">
                  <Text fontSize="$sm" fontWeight="900" color={isCurrentPlayer ? '$secondary900' : '$secondary600'} sx={{ _dark: { color: isCurrentPlayer ? '$secondary100' : '$secondary400' } }} textTransform="uppercase" letterSpacing={0.5}>
                    {isFirstPlayer && '♔ '}{player.name} ({1 + player.timeline.length + (isCurrentPlayer ? roundCards.length : 0)})
                  </Text>
                  {!isCurrentPlayer && !opponentExpanded && (
                    <Text fontSize="$xs" fontWeight="700" color="$amber600" sx={{ _dark: { color: '$amber400' } }} opacity={0.6}>
                      ({player.startYear})
                    </Text>
                  )}
                </HStack>
              </HStack>
              <HStack alignItems="center" space="md">
                <HStack alignItems="center" space="xs">
                  {[...Array(5)].map((_, i) => (
                    <Text key={i} fontSize="$lg" color={i < player.stars ? '$amber400' : '$secondary400'}>
                      {i < player.stars ? '⭐' : '☆'}
                    </Text>
                  ))}
                </HStack>
                {!isCurrentPlayer && (
                  <Icon 
                    as={opponentExpanded ? ChevronUp : ChevronDown} 
                    size="sm" 
                    color="$secondary600" 
                    sx={{ _dark: { color: '$secondary400' } }}
                  />
                )}
                {isCurrentPlayer && (
                  <Icon 
                    as={activePlayerExpanded ? ChevronUp : ChevronDown} 
                    size="sm" 
                    color="$emerald500"
                  />
                )}
              </HStack>
            </HStack>
          </Pressable>
          
          {(isCurrentPlayer ? activePlayerExpanded : opponentExpanded) && (
            <HStack flexWrap="wrap" space="xs">
              {allYears.map((year, idx) => {
            const finalCount = [player.startYear, ...player.timeline].filter((y) => y === year).length;
            const roundCount = isCurrentPlayer ? roundCards.filter((c) => c.year === year).length : 0;
            const totalCount = finalCount + roundCount;
            
            const isStartYear = year === player.startYear;
            const isPrelim = isCurrentPlayer && roundCount > 0; // Preliminärt om det finns roundCards för detta år
            const isEarned = finalCount > 0; // Intjänat om det finns i player.timeline
            
            // Bestäm om kortet har data och kan vara klickbart
            const hasCardData = roundCards.some(c => c.year === year) || findCardByYear(player, year);
            
            // Bestäm färg baserat på status - förbättrad kontrast
            let borderColor = 'rgba(100, 100, 110, 0.3)';
            let bgColor = 'rgba(100, 100, 110, 0.08)';
            let textColor = '$secondary700';
            let textColorDark = '$secondary300';
            
            if (isPrelim && !isEarned) {
              // Preliminärt kort (orange - visar "ej sparad än")
              borderColor = 'rgba(251, 146, 60, 0.7)';
              bgColor = 'rgba(251, 146, 60, 0.15)';
              textColor = '$orange700';
              textColorDark = '$orange300';
            } else if (isEarned) {
              // Intjänat kort (grönt - sparad och säker)
              borderColor = 'rgba(16, 185, 129, 0.6)';
              bgColor = 'rgba(16, 185, 129, 0.15)';
              textColor = '$emerald700';
              textColorDark = '$emerald300';
            }
            
            return (
              <RNPressable
                key={`${year}-${idx}`}
                disabled={!hasCardData}
                onPress={(event) => {
                  handleYearPress(player, year, event);
                }}
                style={({ pressed }) => ({
                  opacity: pressed && hasCardData ? 0.7 : 1,
                })}
              >
                <Box
                  px="$2"
                  py="$1"
                  borderRadius="$lg"
                  borderWidth={1}
                  borderColor={borderColor}
                  bg={bgColor}
                >
                  <Text 
                    fontSize="$xs" 
                    fontWeight="900"
                    color={textColor}
                    sx={{
                      _dark: {
                        color: textColorDark
                      }
                    }}
                  >
                    {isStartYear && '📍 '}
                    {String(year)}
                    {totalCount > 1 && (
                      <Text 
                        color={isPrelim ? '$orange700' : textColor}
                        sx={{
                          _dark: {
                            color: isPrelim ? '$orange300' : textColorDark
                          }
                        }}
                        fontSize="$xs"
                        fontWeight="900"
                      >
                        {` (${totalCount}x)`}
                      </Text>
                    )}
                  </Text>
                </Box>
              </RNPressable>
            );
          })}
            </HStack>
          )}

        </Box>
      </>
    );
  };

  // 🎵 Render Year Card Modal
  const renderYearModal = () => {
    if (!showYearModal || !selectedYearCard) return null;

    const handlePrevCard = () => {
      const newIndex = carouselIndex === 0 ? carouselCards.length - 1 : carouselIndex - 1;
      setCarouselIndex(newIndex);
      setSelectedYearCard(carouselCards[newIndex]);
    };

    const handleNextCard = () => {
      const newIndex = carouselIndex === carouselCards.length - 1 ? 0 : carouselIndex + 1;
      setCarouselIndex(newIndex);
      setSelectedYearCard(carouselCards[newIndex]);
    };

    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}
      >
        <RNPressable
          onPress={() => {
            setShowYearModal(false);
          }}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}
        >
          <Animated.View
            style={{
              transform: [
                { scale: modalAnimScale },
                { translateY: modalAnimTranslate.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0],
                }) }
              ],
              opacity: modalAnimOpacity,
              width: 220,
            } as any}
          >
            <RNPressable 
              onPress={(e) => {
                e.stopPropagation();
              }}
            >
              <Box
                bg="rgba(255, 255, 255, 0.95)"
                borderRadius="$3xl"
                borderWidth={6}
                borderColor="rgba(16, 185, 129, 0.1)"
                h={240}
                px="$2"
                py="$2"
                w={220}
                justifyContent="center"
                alignItems="center"
                sx={{
                  _dark: {
                  bg: 'rgba(20, 20, 22, 0.95)',
                }
              }}
            >
              <VStack
                alignItems="center"
                justifyContent="space-between"
                space="xs"
                w="$full"
                flex={1}
              >
                {/* Music Icon */}
                <Box
                  w={40}
                  h={40}
                  bg="$secondary800"
                  borderRadius="$xl"
                  justifyContent="center"
                  alignItems="center"
                  sx={{
                    transform: [{ rotate: '3deg' }],
                    shadowColor: 'rgba(16, 185, 129, 0.3)',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.6,
                    shadowRadius: 10,
                  }}
                >
                  <Music size={22} color="#10B981" strokeWidth={1.3} />
                </Box>

                {/* Year */}
                <Text
                  fontSize="$4xl"
                  fontWeight="900"
                  italic
                  color="$secondary900"
                  textAlign="center"
                  w="$full"
                  sx={{
                    _dark: {
                      color: '$secondary100',
                    }
                  }}
                >
                  {selectedYearCard.year}
                </Text>

                {/* Artist & Title */}
                <VStack
                  alignItems="center"
                  space="xs"
                  w="$full"
                >
                  <Text
                    fontSize="$xs"
                    fontWeight="600"
                    color="$secondary500"
                    italic
                    textAlign="center"
                    numberOfLines={2}
                    px="$1"
                    sx={{
                      _dark: {
                        color: '$secondary400',
                      }
                    }}
                  >
                    {selectedYearCard.artist}
                  </Text>
                  <Text
                    fontSize="$2xs"
                    fontWeight="500"
                    color="$secondary400"
                    textAlign="center"
                    numberOfLines={2}
                    px="$1"
                    sx={{
                      _dark: {
                        color: '$secondary500',
                      }
                    }}
                  >
                    "{selectedYearCard.title}"
                  </Text>
                </VStack>

                {/* Carousel Navigation */}
                {carouselCards.length > 1 && (
                  <VStack space="sm" w="$full" alignItems="center">
                    {/* Indicator */}
                    <Text fontSize="$2xs" color="$secondary500" sx={{ _dark: { color: '$secondary400' } }} fontWeight="600">
                      {carouselIndex + 1} / {carouselCards.length}
                    </Text>
                    {/* Navigation Buttons */}
                    <HStack space="md" w="$full" justifyContent="center">
                      <Pressable
                        onPress={handlePrevCard}
                        bg="$secondary800"
                        borderRadius="$lg"
                        px="$3"
                        py="$2"
                        sx={{
                          _pressed: {
                            bg: 'rgba(60, 60, 70, 1)',
                            transform: [{ scale: 0.9 }],
                          }
                        }}
                      >
                        <Text fontSize="$sm" fontWeight="900" color="$white">←</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleNextCard}
                        bg="$secondary800"
                        borderRadius="$lg"
                        px="$3"
                        py="$2"
                        sx={{
                          _pressed: {
                            bg: 'rgba(60, 60, 70, 1)',
                            transform: [{ scale: 0.9 }],
                          }
                        }}
                      >
                        <Text fontSize="$sm" fontWeight="900" color="$white">→</Text>
                      </Pressable>
                    </HStack>
                  </VStack>
                )}
              </VStack>
            </Box>
            </RNPressable>
          </Animated.View>
        </RNPressable>
      </View>
    );
  };

  if (gameOverMessage) {
    return (
      <ScoreScreen 
        gameOverMessage={gameOverMessage}
        players={players}
        playerNames={playerNames}
      />
    );
  }

  const current = players[activePlayer];
  const canAffordSkip = current.stars > 0;

  // 🔸 Rendera med override om den finns, annars hookens wasCorrect
  const effectiveWasCorrect = (wasCorrectOverride !== null ? wasCorrectOverride : wasCorrect);

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <AnimatedScrollView contentContainerStyle={[styles.container, { paddingTop: headerHeight + 5 }]} onScroll={onScroll} scrollEventThrottle={16}>
        {/* Opponent timeline - överst, kan kollapsa */}
       <Box mt="$3">
          {playerNames.filter(name => name !== activePlayer).map((opponentName) => (
            <Box key={opponentName}>
              {renderTimeline(players[opponentName], false)}
            </Box>
          ))}
        </Box>
        
        {/* Aktiv spelare timeline - näst överst, kan kollapsa */}
        {renderTimeline(current, true)}
        
        {isLoadingCard ? (
          <CardSkeleton />
        ) : errorMessage ? (
          <Text color="$error600">{errorMessage}</Text>
        ) : !card ? (
          <Button onPress={() => generateCard(resetInputs)}><ButtonText>Starta spelet</ButtonText></Button>
        ) : null}

        {card && !guessConfirmed && !isLoadingCard && (
          <VStack space="md" w="$full">
             {/* Kortet */}
            <AnimatedCard 
              showBack={false}
              card={card}
              onFlip={() => {}}
              showFlipButton={false}
              onPlayPreview={handlePlayPreview}
              isPlayingPreview={isPlayingPreview}
            />
           
             {/* Guess section */}
            {showPlacementChoice ? (
              <VStack space="lg" alignItems="center" w="$full">
                <Box
                  bg="rgba(255, 255, 255, 0.95)"
                  sx={{ _dark: { bg: 'rgba(20, 20, 22, 0.8)' } }}
                  borderRadius="$3xl"
                  p="$6"
                  borderWidth={1}
                  borderColor="rgba(16, 185, 129, 0.2)"
                  w="$full"
                >
                  <VStack space="md" alignItems="center">
                    <Box w={12} h={12} bg="rgba(16, 185, 129, 0.1)" borderRadius="$2xl" justifyContent="center" alignItems="center">
                      <Icon as={Music} size="lg" color="$emerald500" />
                    </Box>
                    <Text fontSize="$2xl" fontWeight="900" color="$secondary900" sx={{ _dark: { color: '$secondary100' } }} textTransform="uppercase" letterSpacing={1} textAlign="center">
                      Timeline Duel
                    </Text>
                    <Text fontSize="$sm" color="$secondary600" sx={{ _dark: { color: '$secondary400' } }} textAlign="center">
                      År {guess} finns redan. Vart hör denna låt hemma?
                    </Text>
                  </VStack>
                </Box>
                
                <HStack space="md" w="$full">
                  <Pressable
                    flex={1}
                    bg={placement === 'before' ? '$emerald500' : 'rgba(100, 100, 110, 0.1)'}
                    onPress={() => setPlacement('before')}
                    borderRadius="$2xl"
                    py="$5"
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                      _pressed: {
                        bg: '$emerald600',
                        transform: [{ scale: 0.95 }],
                      },
                    }}
                  >
                    <Text
                      fontSize="$lg"
                      fontWeight="900"
                      color={placement === 'before' ? '$white' : '$secondary600'}
                      sx={{ _dark: { color: placement === 'before' ? '$white' : '$secondary400' } }}
                      textTransform="uppercase"
                      letterSpacing={1}
                    >
                      FÖRE
                    </Text>
                  </Pressable>
                  <Pressable
                    flex={1}
                    bg={placement === 'after' ? '$emerald500' : 'rgba(100, 100, 110, 0.1)'}
                    onPress={() => setPlacement('after')}
                    borderRadius="$2xl"
                    py="$5"
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                      _pressed: {
                        bg: '$emerald600',
                        transform: [{ scale: 0.95 }],
                      },
                    }}
                  >
                    <Text
                      fontSize="$lg"
                      fontWeight="900"
                      color={placement === 'after' ? '$white' : '$secondary600'}
                      sx={{ _dark: { color: placement === 'after' ? '$white' : '$secondary400' } }}
                      textTransform="uppercase"
                      letterSpacing={1}
                    >
                      EFTER
                    </Text>
                  </Pressable>
                </HStack>

                <Button
                  onPress={handlePlacementConfirm}
                  isDisabled={!placement}
                  w="$full"
                  bg="$emerald700"
                  borderRadius="$3xl"
                  sx={{
                    ":pressed": {
                      bg: '$emerald800',
                      transform: [{ scale: 0.95 }],
                    },
                    ":disabled": {
                      opacity: 0.5,
                    }
                  }}
                >
                  <ButtonText fontSize="$lg" fontWeight="900" color="$white" textTransform="uppercase" letterSpacing={1}>
                    Bekräfta
                  </ButtonText>
                </Button>
              </VStack>
            ) : (
              <VStack space="lg" alignItems="center" w="$full">
                {/* Guess Year Section */}
                <VStack space="md" w="$full" alignItems="center">
                  {/* Title */}
                  <Text 
                    fontSize="$xs" 
                    fontWeight="900" 
                    color="$emerald600"
                    sx={{ _dark: { color: '$emerald500' } }}
                    textTransform="uppercase" 
                    letterSpacing={1.5}
                  >
                    Guess Year
                  </Text>

                  {/* Input Container */}
                  <Box 
                    w="$full" 
                    maxWidth={300}
                    borderWidth={1}
                    borderColor="rgba(80, 80, 90, 0.6)"
                    borderRadius="$3xl"
                    bg="rgba(20, 20, 22, 0.6)"
                    sx={{
                      _dark: {
                        bg: 'rgba(15, 15, 18, 0.8)',
                        borderColor: 'rgba(60, 60, 70, 0.6)',
                      }
                    }}
                    px="$6"
                    py="$6"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Input
                      flex={1}
                      w="$full"
                      borderWidth={0}
                      bg="transparent"
                      sx={{
                        _focus: {
                          outline: 'none',
                        },
                      }}
                    >
                      <InputField
                        placeholder="----"
                        keyboardType="numeric"
                        value={guess}
                        onChangeText={(value) => {
                          setGuess(value);
                          setIsGuessValid(true); // Återställ validering när användaren redigerar
                        }}
                        returnKeyType="done"
                        onSubmitEditing={handleConfirmGuess}
                        maxLength={4}
                        fontSize="$4xl"
                        fontWeight="900"
                        textAlign="center"
                        color="$secondary300"
                        placeholderTextColor="$secondary600"
                        sx={{ _dark: { color: '$secondary300' } }}
                      />
                    </Input>
                  </Box>

                  {/* Error Message */}
                  {!isGuessValid && guess.length > 0 && (
                    <Text 
                      color="$error600" 
                      fontSize="$xs" 
                      fontWeight="700" 
                      textTransform="uppercase"
                      letterSpacing={0.3}
                    >
                      Invalid year (1900-{currentYear})
                    </Text>
                  )}
                </VStack>

                {/* Lock In Answer knapp */}
                <Button
                  onPress={() => {
                    Vibration.vibrate(50);
                    handleConfirmGuess();
                  }}
                  isDisabled={!isGuessValid || guess.length !== 4}
                  w="$full"
                  bg="$emerald500"
                  borderRadius="$3xl"
                  sx={{
                    ":pressed": {
                      bg: '$emerald600',
                      transform: [{ scale: 0.95 }],
                    },
                    ":disabled": {
                      opacity: 0.5,
                    }
                  }}
                >
                  <ButtonText
                    fontSize="$lg"
                    fontWeight="900"
                    color="$white"
                    textTransform="uppercase"
                    letterSpacing={1.5}
                  >
                    Lock In Answer
                  </ButtonText>
                </Button>

                {/* Hint & Skip */}
                <HStack space="md" w="$full" justifyContent="space-between">
                  <Pressable
                    flex={1}
                    borderWidth={1}
                    borderColor="rgba(100, 100, 110, 0.3)"
                    borderRadius="$xl"
                    py="$3"
                    px="$2"
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                      _pressed: {
                        bg: 'rgba(100, 100, 110, 0.1)',
                        transform: [{ scale: 0.95 }],
                      },
                    }}
                    onPress={() => {
                      Vibration.vibrate(30);
                      handleToggleSongInfo();
                    }}
                  >
                    <VStack alignItems="center" space="xs">
                      <Icon as={Info} size="sm" color={isSongInfoVisible ? '$emerald500' : '$secondary600'} sx={{ _dark: { color: isSongInfoVisible ? '$emerald400' : '$secondary400' } }} />
                      <Text fontSize="$xs" fontWeight="900" color={isSongInfoVisible ? '$emerald600' : '$secondary600'} sx={{ _dark: { color: isSongInfoVisible ? '$emerald400' : '$secondary400' } }} textTransform="uppercase" letterSpacing={0.5}>Get Hint</Text>
                    </VStack>
                  </Pressable>
                  <Pressable
                    flex={1}
                    borderWidth={1}
                    borderColor={canAffordSkip ? 'rgba(239, 68, 68, 0.3)' : 'rgba(100, 100, 110, 0.2)'}
                    borderRadius="$xl"
                    py="$3"
                    px="$2"
                    justifyContent="center"
                    alignItems="center"
                    disabled={!canAffordSkip || isSkipping}
                    sx={{
                      _pressed: {
                        bg: 'rgba(239, 68, 68, 0.1)',
                        transform: [{ scale: 0.95 }],
                      },
                      ":disabled": {
                        opacity: 0.4,
                      }
                    }}
                    onPress={() => {
                      if (canAffordSkip && !isSkipping) {
                        Vibration.vibrate(30);
                        handleSkipSong();
                      }
                    }}
                  >
                    {isSkipping ? (
                      <HStack space="xs" alignItems="center">
                        <ActivityIndicator size="small" color={canAffordSkip ? '$error600' : '$secondary600'} />
                      </HStack>
                    ) : (
                      <VStack alignItems="center" space="xs">
                        <Icon as={Music} size="sm" color={canAffordSkip ? '$error600' : '$secondary600'} sx={{ _dark: { color: canAffordSkip ? '$error500' : '$secondary400' } }} />
                        <Text fontSize="$xs" fontWeight="900" color={canAffordSkip ? '$error600' : '$secondary600'} sx={{ _dark: { color: canAffordSkip ? '$error500' : '$secondary400' } }} textTransform="uppercase" letterSpacing={0.5}>Skip</Text>
                      </VStack>
                    )}
                  </Pressable>
                </HStack>

                {/* Song info box */}
                {isSongInfoVisible && (
                  <Box
                    w="$full"
                    bg="rgba(16, 185, 129, 0.05)"
                    borderRadius="$2xl"
                    borderWidth={1}
                    borderColor="rgba(16, 185, 129, 0.2)"
                    p="$3"
                    sx={{
                      _dark: {
                        bg: 'rgba(16, 185, 129, 0.08)',
                        borderColor: 'rgba(16, 185, 129, 0.3)',
                      }
                    }}
                  >
                    <VStack space="xs">
                      <HStack space="sm">
                        <Text fontSize="$xs" fontWeight="900" color="$emerald600" sx={{ _dark: { color: '$emerald400' } }}>Artist:</Text>
                        <Text fontSize="$xs" color="$secondary700" sx={{ _dark: { color: '$secondary300' } }} flex={1}>{card.artist}</Text>
                      </HStack>
                      <HStack space="sm">
                        <Text fontSize="$xs" fontWeight="900" color="$emerald600" sx={{ _dark: { color: '$emerald400' } }}>Låt:</Text>
                        <Text fontSize="$xs" color="$secondary700" sx={{ _dark: { color: '$secondary300' } }} flex={1}>"{card.title}"</Text>
                      </HStack>
                      <HStack space="sm">
                        <Text fontSize="$xs" fontWeight="900" color="$emerald600" sx={{ _dark: { color: '$emerald400' } }}>År:</Text>
                        <Text fontSize="$xs" color="$secondary700" sx={{ _dark: { color: '$secondary300' } }}>{card.year}</Text>
                      </HStack>
                    </VStack>
                  </Box>
                )}
              </VStack>
            )}
          </VStack>
        )}

        {!showBack && card && !guessConfirmed && !isLoadingCard && (
          <VStack space="md" w="$full" mt="$6">
          </VStack>
        )}

        {showBack && card && (
          <VStack space="lg" alignItems="center" w="$full">
            <AnimatedCard 
              showBack={true}
              card={card}
              onFlip={() => {}}
              showFlipButton={false}
              onPlayPreview={handlePlayPreview}
              isPlayingPreview={isPlayingPreview}
            />
            
            {wasSkipped ? (
              <Box
                w="$full"
                bg="rgba(168, 85, 247, 0.1)"
                borderRadius={40}
                borderWidth={2.5}
                borderColor="rgba(168, 85, 247, 0.5)"
                p="$5"
                sx={{
                  _dark: {
                    bg: 'rgba(168, 85, 247, 0.1)',
                    borderColor: 'rgba(168, 85, 247, 0.5)',
                  }
                }}
              >
                <VStack space="md" alignItems="center" w="$full">
                  {/* Icon */}
                  <Box
                    w={24}
                    h={24}
                    bg="rgba(168, 85, 247, 0.9)"
                    borderRadius="$2xl"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Text fontSize="$lg" fontWeight="900" color="$white">⊘</Text>
                  </Box>

                  {/* Title */}
                  <Text 
                    fontSize="$3xl" 
                    fontWeight="900" 
                    color="rgba(168, 85, 247, 0.9)"
                    textTransform="uppercase" 
                    letterSpacing={1}
                    italic
                    textAlign="center"
                    w="$full"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Skipped
                  </Text>

                  {/* Next Song Button */}
                  <Button
                    onPress={() => {
                      Vibration.vibrate(50);
                      handleNextSongAfterSkip();
                    }}
                    w="$full"
                    bg="rgba(168, 85, 247, 0.9)"
                    borderRadius={24}
                    mt="$3"
                    sx={{
                      _pressed: {
                        bg: 'rgba(168, 85, 247, 0.7)',
                        transform: [{ scale: 0.95 }],
                      }
                    }}
                  >
                    <ButtonText fontSize="$lg" fontWeight="900" color="$white" textTransform="uppercase" letterSpacing={1.5}>
                      Next Song →
                    </ButtonText>
                  </Button>
                </VStack>
              </Box>
            ) : effectiveWasCorrect ? (
              <Box
                w="$full"
                bg="rgba(16, 185, 129, 0.1)"
                borderRadius={40}
                borderWidth={2.5}
                borderColor="rgba(16, 185, 129, 0.5)"
                p="$5"
                sx={{
                  _dark: {
                    bg: 'rgba(16, 185, 129, 0.1)',
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                  }
                }}
              >
                <VStack space="md" alignItems="center" w="$full">
                  {/* Checkmark Icon */}
                  <Box
                    w={24}
                    h={24}
                    bg="$emerald500"
                    borderRadius="$lg"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Text fontSize="$lg" fontWeight="900" color="$white">✓</Text>
                  </Box>

                  {/* Title */}
                  <Text 
                    fontSize="$3xl" 
                    fontWeight="900" 
                    color="$emerald500"
                    textTransform="uppercase" 
                    letterSpacing={1}
                    italic
                    textAlign="center"
                    w="$full"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Genius!
                  </Text>

                  {/* Award Star Button */}
                  <Pressable
                    onPress={handleAwardStar}
                    disabled={starAwardedThisTurn}
                    sx={{
                      _pressed: {
                        opacity: 0.7,
                        transform: [{ scale: 0.9 }],
                      },
                      ":disabled": {
                        opacity: 0.5,
                      }
                    }}
                  >
                    <HStack alignItems="center" space="sm">
                      <Text fontSize="$xs" fontWeight="900" color={starAwardedThisTurn ? '$secondary500' : '$emerald600'} sx={{ _dark: { color: starAwardedThisTurn ? '$secondary600' : '$emerald400' } }} textTransform="uppercase" letterSpacing={0.5}>
                        Award
                      </Text>
                      <Text fontSize="$2xl">{starAwardedThisTurn ? '⭐' : '⭐'}</Text>
                    </HStack>
                  </Pressable>

                  {/* Action buttons - olika beroende på om låten skippades */}
                  {!wasSkipped ? (
                    <VStack space="sm" w="$full" mt="$3">
                      <Button
                        onPress={() => {
                          Vibration.vibrate(50);
                          handleContinue();
                        }}
                        w="$full"
                        bg="$white"
                        borderRadius={24}
                        sx={{
                          _pressed: {
                            bg: 'rgba(255, 255, 255, 0.8)',
                            transform: [{ scale: 0.95 }],
                          }
                        }}
                      >
                        <ButtonText fontSize="$lg" fontWeight="900" color="$secondary900" textTransform="uppercase" letterSpacing={1.5}>
                          Continue 🔥
                        </ButtonText>
                      </Button>

                      <Button
                        onPress={() => {
                          Vibration.vibrate(50);
                          handleSave();
                        }}
                        w="$full"
                        bg="$emerald500"
                        borderRadius={24}
                        sx={{
                          ":pressed": {
                            bg: '$emerald600',
                            transform: [{ scale: 0.95 }],
                          }
                        }}
                      >
                        <ButtonText fontSize="$lg" fontWeight="900" color="$white" textTransform="uppercase" letterSpacing={1.5}>
                          Save & Pass Turn
                        </ButtonText>
                      </Button>
                    </VStack>
                  ) : (
                    <Button
                      onPress={() => {
                        Vibration.vibrate(50);
                        handleNextSongAfterSkip();
                      }}
                      w="$full"
                      bg="rgba(168, 85, 247, 0.9)"
                      borderRadius={24}
                      mt="$3"
                      sx={{
                        _pressed: {
                          bg: 'rgba(168, 85, 247, 0.7)',
                          transform: [{ scale: 0.95 }],
                        }
                      }}
                    >
                      <ButtonText fontSize="$lg" fontWeight="900" color="$white" textTransform="uppercase" letterSpacing={1.5}>
                        Next Song →
                      </ButtonText>
                    </Button>
                  )}
                </VStack>
              </Box>
            ) : (
              <Box
                w="$full"
                bg="rgba(239, 68, 68, 0.1)"
                borderRadius={40}
                borderWidth={2.5}
                borderColor="rgba(239, 68, 68, 0.5)"
                p="$5"
                sx={{
                  _dark: {
                    bg: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                  }
                }}
              >
                <VStack space="md" alignItems="center" w="$full">
                  {/* Icon */}
                  <Box
                    w={24}
                    h={24}
                    bg="rgba(239, 68, 68, 0.9)"
                    borderRadius="$2xl"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Text fontSize="$lg" fontWeight="900" color="$white">✕</Text>
                  </Box>

                  {/* Title */}
                  <Text 
                    fontSize="$3xl" 
                    fontWeight="900" 
                    color="rgba(239, 68, 68, 0.9)"
                    textTransform="uppercase" 
                    letterSpacing={1}
                    italic
                    textAlign="center"
                    w="$full"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Not Quite
                  </Text>

                  {/* Action button */}
                  <Button
                    onPress={() => {
                      Vibration.vibrate(50);
                      switchPlayerTurn();
                    }}
                    w="$full"
                    bg="$secondary800"
                    borderRadius={24}
                    mt="$2"
                    sx={{
                      ":pressed": {
                        bg: 'rgba(60, 60, 70, 1)',
                        transform: [{ scale: 0.95 }],
                      }
                    }}
                  >
                    <ButtonText fontSize="$lg" fontWeight="900" color="$white" textTransform="uppercase" letterSpacing={1.5}>
                      Next Player
                    </ButtonText>
                  </Button>
                </VStack>
              </Box>
            )}
          </VStack>
        )}
      </AnimatedScrollView>
      {renderYearModal()}
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center', flexGrow: 1 },
});
