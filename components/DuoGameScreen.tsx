import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Animated, KeyboardAvoidingView, Platform  } from 'react-native';
import {
  Box, Text, Heading, Button, ButtonText, VStack, HStack, Input, InputField, Center, Icon, Pressable,
} from '@gluestack-ui/themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CardFront from './CardFront';
import CardBack from './CardBack';
import { useGenerateSongs } from './useGenerateSongs';
import { useDuoGameLogic } from '../hooks/useDuoGameLogic';
import { useAuth } from '../hooks/useAuth';
import { deleteActiveGame, loadActiveGame, saveActiveGame, SavedDuoGameState } from '../storage/gameStorage';
import { Music, Info, ChevronDown, ChevronUp } from 'lucide-react-native';

// Typer
export type Card = { title: string; artist: string; year: number; spotifyUrl: string };
type Player = { name: string; timeline: number[]; cards: Card[]; startYear: number; stars: number };

type Props = {
  player1Name: string; // ⬅️ Ändrat från player1
  player2Name: string; // ⬅️ Ändrat från player2
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
const MAX_STARS = 5;
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Lokal konstant för delad historiknyckel
const SEEN_SONGS_KEY = 'duoSeenSongsHistory';

export default function DuoGameScreen({
  player1Name, // ⬅️ Uppdaterat namn
  player2Name, // ⬅️ Uppdaterat namn
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

    // Ny state för "Före/Efter"-logiken
  const [showPlacementChoice, setShowPlacementChoice] = useState(false);
  const [placement, setPlacement] = useState<'before' | 'after' | null>(null);

    // 🔄 separat flagga för återställning av spelsessionen (players/roundCards/UI)
  const [isRestoring, setIsRestoring] = useState(true);

  // 🔸 Litet override så att vi kan rendera korrekt “Rätt gissat!” från storage direkt
  const [wasCorrectOverride, setWasCorrectOverride] = useState<boolean | null>(null);

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
    player1Name: player1Name,
    player2Name: player2Name,
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
    resetTurnState();
  }, [resetTurnState]);

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
        player1Name: player1Name, // ⬅️ Uppdaterat
        player2Name: player2Name, // ⬅️ Uppdaterat
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
    user, isAnonymous, gameId, player1Name, player2Name,
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
    setTimeout(() => {
      skipSong();
      resetInputs();
      setIsSkipping(false);
    }, 800);
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
                    {player.name} ({player.timeline.length})
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
            const isPrelim = isCurrentPlayer && roundCards.some((c) => c.year === year) && !finalTimeline.includes(year);
            const isStartYear = year === player.startYear;
            
            return (
              <Box
                key={`${year}-${idx}`}
                px="$2"
                py="$1"
                borderRadius="$lg"
                borderWidth={1}
                borderColor={
                  isStartYear ? 'rgba(251, 191, 36, 0.5)' :
                  isPrelim ? 'rgba(16, 185, 129, 0.3)' :
                  'rgba(100, 100, 110, 0.2)'
                }
                bg={
                  isStartYear ? 'rgba(251, 191, 36, 0.1)' :
                  isPrelim ? 'rgba(16, 185, 129, 0.1)' :
                  'rgba(100, 100, 110, 0.05)'
                }
              >
                <Text 
                  fontSize="$xs" 
                  fontWeight="900"
                  color={
                    isStartYear ? '$amber600' :
                    isPrelim ? '$emerald600' :
                    '$secondary600'
                  }
                  sx={{
                    _dark: {
                      color:
                        isStartYear ? '$amber400' :
                        isPrelim ? '$emerald400' :
                        '$secondary400'
                    }
                  }}
                  opacity={isStartYear && !isCurrentPlayer ? 0.5 : 1}
                >
                  {isStartYear && '📍 '}
                  {String(year)}
                </Text>
              </Box>
            );
          })}
            </HStack>
          )}

        </Box>
      </>
    );
  };

  if (gameOverMessage) {
    return (
      <Center flex={1} px="$4">
        <VStack alignItems="center" space="md">
          <Heading size="xl">🎉 Spelet är över! 🎉</Heading>
          <Text fontSize="$lg" color="$primary600" sx={{ _dark: { color: '$primary400' } }}>{gameOverMessage}</Text>
          <VStack space="xs" alignItems="center" my="$3">
            <Text>{player1Name}: {players[player1Name].timeline.length} kort</Text>
            <Text>{player2Name}: {players[player2Name].timeline.length} kort</Text>
          </VStack>
        </VStack>
      </Center>
    );
  }

  const current = players[activePlayer];
  const canAffordSkip = current.stars > 0;

  // 🔸 Rendera med override om den finns, annars hookens wasCorrect
  const effectiveWasCorrect = (wasCorrectOverride !== null ? wasCorrectOverride : wasCorrect);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AnimatedScrollView contentContainerStyle={[styles.container, { paddingTop: headerHeight }]} onScroll={onScroll} scrollEventThrottle={16}>
        {/* Opponent timeline - överst, kan kollapsa */}
        <Box mt="$2">
          {renderTimeline(players[player1Name === activePlayer ? player2Name : player1Name], false)}
        </Box>
        
        {/* Aktiv spelare timeline - näst överst, kan kollapsa */}
        {renderTimeline(current, true)}
        
        {isLoadingCard ? (
          <VStack alignItems="center" mt="$4"><ActivityIndicator size="large" /><Text mt="$2">Genererar låt...</Text></VStack>
        ) : errorMessage ? (
          <Text color="$error600">{errorMessage}</Text>
        ) : !card ? (
          <Button onPress={() => generateCard(resetInputs)}><ButtonText>Starta spelet</ButtonText></Button>
        ) : null}

        {card && !guessConfirmed && !isLoadingCard && (
          <VStack space="md" w="$full">
             {/* Kortet */}
            <CardFront spotifyUrl={card.spotifyUrl} onFlip={() => {}} showFlipButton={false} />
           
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
                      ÄLDRE
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
                      NYARE
                    </Text>
                  </Pressable>
                </HStack>

                <Button
                  action="primary"
                  onPress={handlePlacementConfirm}
                  isDisabled={!placement}
                  w="$full"
                  sx={{
                    ":disabled": {
                      opacity: 0.5,
                    }
                  }}
                >
                  <ButtonText fontSize="$lg" fontWeight="900" textTransform="uppercase" letterSpacing={1}>
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
                  onPress={handleConfirmGuess}
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
                    onPress={handleToggleSongInfo}
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
                    onPress={handleSkipSong}
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
            <CardBack artist={card.artist} title={card.title} year={String(card.year)} onFlip={() => {}} />
            
            {effectiveWasCorrect ? (
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

                  {/* Action buttons */}
                  <VStack space="sm" w="$full" mt="$3">
                    <Button
                      onPress={handleContinue}
                      w="$full"
                      bg="$white"
                      borderRadius={24}
                      sx={{
                        ":pressed": {
                          bg: 'rgba(255, 255, 255, 0.9)',
                          transform: [{ scale: 0.95 }],
                        }
                      }}
                    >
                      <ButtonText fontSize="$lg" fontWeight="900" color="$secondary900" textTransform="uppercase" letterSpacing={1.5}>
                        Continue 🔥
                      </ButtonText>
                    </Button>

                    <Button
                      onPress={handleSave}
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
                  {/* X Icon */}
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
                    onPress={switchPlayerTurn}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center', flexGrow: 1 },
});
