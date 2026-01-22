import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Animated as RNAnimated, Pressable as RNPressable, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { Box, Center, Heading, VStack, HStack, Text, Pressable } from '@gluestack-ui/themed';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSpectatorListener, GameData } from '../hooks/useSpectatorListener';
import { useSpectatorCounter } from '../hooks/useSpectatorCounter';
import { useAuth } from '../hooks/useAuth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

interface SpectatorScreenProps {
  gameId: string;
  onLeave: () => void;
  headerHeight?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export default function SpectatorScreen({ gameId, onLeave, headerHeight = 80, onScroll }: SpectatorScreenProps) {
  const { gameData, loading, error } = useSpectatorListener({ gameId });
  const { user } = useAuth();
  const [lastPlayedSong, setLastPlayedSong] = useState<any>(null);

  // Modal state
  const [selectedYearCard, setSelectedYearCard] = useState<any>(null);
  const [showYearModal, setShowYearModal] = useState(false);
  const [carouselCards, setCarouselCards] = useState<any[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const modalAnimScale = useRef(new RNAnimated.Value(0.3)).current;
  const modalAnimOpacity = useRef(new RNAnimated.Value(0)).current;
  const modalAnimTranslate = useRef(new RNAnimated.Value(1)).current;

  // Rensa spektator-entry när man lämnar
  useEffect(() => {
    return () => {
      if (user && gameId) {
        deleteDoc(doc(db, 'games', gameId, 'spectators', user.uid)).catch(() => {});
      }
    };
  }, [gameId, user]);

  // Funktion för att öppna år-modal
  const handleYearPress = (playerName: string, year: number) => {
    const playerData = gameData?.players?.[playerName];
    const allCards = [
      ...(gameData?.roundCards?.filter(c => c.year === year) || []),
      ...(playerData?.cards?.filter(c => c.year === year) || []),
    ];

    if (allCards.length > 0) {
      setCarouselCards(allCards);
      setCarouselIndex(0);
      setSelectedYearCard(allCards[0]);
      setShowYearModal(true);

      // Animera modal
      modalAnimScale.setValue(0.3);
      modalAnimOpacity.setValue(0);
      modalAnimTranslate.setValue(0);

      RNAnimated.parallel([
        RNAnimated.timing(modalAnimScale, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        RNAnimated.timing(modalAnimOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        RNAnimated.timing(modalAnimTranslate, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // Spåra när en ny låt har spelats (backCardUnlocked ändras)
  useEffect(() => {
    if (gameData?.gameState?.backCardUnlocked && gameData?.currentCard) {
      setLastPlayedSong({
        title: gameData.currentCard.title,
        artist: gameData.currentCard.artist,
      });
    }
  }, [gameData?.gameState?.backCardUnlocked, gameData?.currentCard]);

  const playerStats = useMemo(() => {
    if (!gameData || !gameData.players) return [];
    
    return Object.entries(gameData.players).map(([name, data]) => ({
      name,
      timeline: data.timeline,
      score: 1 + data.timeline.length, // startYear räknas som 1 poäng + alla intjänade år
      stars: data.stars,
    }));
  }, [gameData]);

  const currentCard = gameData?.currentCard;
  const backCardUnlocked = gameData?.gameState?.backCardUnlocked ?? false;
  const activePlayerName = gameData?.gameState?.activePlayer;

  // Render år-modal
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
          onPress={() => setShowYearModal(false)}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}
        >
          <RNAnimated.View
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
              onPress={(e) => e.stopPropagation()}
            >
              <Box
                bg="$backgroundLight0"
                rounded="$2xl"
                p="$4"
                sx={{ _dark: { bg: '$backgroundDark900' } }}
              >
                <VStack space="md" alignItems="center">
                  <Text
                    fontSize="$3xl"
                    fontWeight="bold"
                    sx={{ _dark: { color: '$textDark100' } }}
                  >
                    {selectedYearCard.year}
                  </Text>

                  <VStack space="xs" alignItems="center" w="$full">
                    <Text
                      fontSize="$md"
                      fontWeight="bold"
                      sx={{ _dark: { color: '$textDark100' } }}
                      numberOfLines={2}
                      textAlign="center"
                    >
                      {selectedYearCard.title}
                    </Text>
                    <Text
                      fontSize="$xs"
                      sx={{ _dark: { color: '$textDark400' } }}
                      numberOfLines={1}
                    >
                      {selectedYearCard.artist}
                    </Text>
                  </VStack>

                  {carouselCards.length > 1 && (
                    <HStack space="md" mt="$2">
                      <Pressable onPress={handlePrevCard} p="$2">
                        <ChevronLeft size={20} color="#059669" />
                      </Pressable>
                      <Text fontSize="$xs" color="$secondary600">
                        {carouselIndex + 1} / {carouselCards.length}
                      </Text>
                      <Pressable onPress={handleNextCard} p="$2">
                        <ChevronRight size={20} color="#059669" />
                      </Pressable>
                    </HStack>
                  )}
                </VStack>
              </Box>
            </RNPressable>
          </RNAnimated.View>
        </RNPressable>
      </View>
    );
  };

  if (error) {
    return (
      <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <Center flex={1}>
          <VStack space="md" alignItems="center" px="$8">
            <Heading sx={{ _dark: { color: '$textDark100' } }}>
              Game Not Found
            </Heading>
            <Text fontSize="$sm" sx={{ _dark: { color: '$textDark400' } }}>
              The game code you entered is no longer available.
            </Text>
            <Pressable
              mt="$4"
              bg="$error700"
              px="$6"
              py="$3"
              rounded="$lg"
              onPress={onLeave}
            >
              <Text color="white" fontWeight="bold">
                Go Back
              </Text>
            </Pressable>
          </VStack>
        </Center>
      </Box>
    );
  }

  if (loading) {
    return (
      <Center flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
        <Text sx={{ _dark: { color: '$textDark400' } }}>Connecting to game...</Text>
      </Center>
    );
  }

  return (
    <Box
      flex={1}
      bg="$backgroundLight0"
      sx={{ _dark: { bg: '$backgroundDark950' } }}
    >
      <AnimatedScrollView contentContainerStyle={{ paddingTop: headerHeight + 5, paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1 }} onScroll={onScroll} scrollEventThrottle={16}>
        <VStack space="xl">
          {/* Timeline Section - PRIMARY FOCUS */}
          {playerStats.length > 0 && (
            <VStack space="md">
              <Text
                fontSize="$xs"
                fontWeight="bold"
                sx={{ _dark: { color: '$textDark400' } }}
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                TIMELINE
              </Text>

              {playerStats.map((player, idx) => {
                const playerData = gameData?.players?.[player.name];
                const startYear = playerData?.startYear;
                const roundCardsForPlayer = activePlayerName === player.name ? (gameData?.roundCards || []) : [];
                
                const baseYears = startYear ? [startYear] : [];
                const allYearsSet = new Set([...baseYears, ...player.timeline, ...roundCardsForPlayer.map(c => c.year)]);
                const allYears = Array.from(allYearsSet).sort((a, b) => a - b);
                
                const firstPlayerName = gameData?.players ? Object.keys(gameData.players)[0] : null;
                const isFirstPlayer = player.name === firstPlayerName;
                const isActive = activePlayerName === player.name;

                return (
                  <Box
                    key={idx}
                    bg="$backgroundLight100"
                    p="$4"
                    rounded="$2xl"
                    borderWidth={1}
                    borderColor={isActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 100, 110, 0.2)'}
                    sx={{
                      _dark: {
                        bg: isActive ? 'rgba(20, 20, 22, 0.8)' : 'rgba(40, 40, 45, 0.6)',
                        borderColor: isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(80, 80, 90, 0.4)',
                      },
                    }}
                  >
                    <HStack justifyContent="space-between" alignItems="center" mb="$3">
                      <HStack alignItems="center" space="md" flex={1}>
                        <Box 
                          w={4} 
                          h={4} 
                          borderRadius="$full" 
                          bg={isActive ? '$emerald500' : 'transparent'}
                        />
                        <VStack space="xs" flex={1}>
                          <Text
                            fontSize="$sm"
                            fontWeight="bold"
                            sx={{ _dark: { color: '$textDark100' } }}
                          >
                            {isFirstPlayer && '♔ '}{player.name}
                          </Text>
                          <Text
                            fontSize="$xs"
                            sx={{ _dark: { color: '$textDark400' } }}
                          >
                            {player.score} song{player.score !== 1 ? 's' : ''} • ⭐ {player.stars}
                          </Text>
                        </VStack>
                      </HStack>
                    </HStack>

                    {allYears.length > 0 && (
                      <HStack flexWrap="wrap" space="xs">
                        {allYears.map((year, i) => {
                          const isStartYear = year === startYear;
                          const earnedCards = startYear && year === startYear ? [startYear] : [];
                          const earnedCardsFromTimeline = player.timeline.filter(y => y === year);
                          const earnedCount = earnedCards.length + earnedCardsFromTimeline.length;
                          const prelimCount = roundCardsForPlayer.filter(c => c.year === year).length;
                          const isEarned = earnedCount > 0;
                          const isPrelim = prelimCount > 0;
                          
                          return (
                            <HStack key={i} space="xs">
                              {/* Tjänade år eller startår */}
                              {(isStartYear || isEarned) && (
                                <RNPressable
                                  onPress={() => handleYearPress(player.name, year)}
                                >
                                  <Box
                                    bg={isStartYear || isEarned ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 100, 110, 0.08)'}
                                    px="$2"
                                    py="$1"
                                    rounded="$lg"
                                    borderWidth={1}
                                    borderColor={isStartYear || isEarned ? 'rgba(16, 185, 129, 0.6)' : 'rgba(100, 100, 110, 0.3)'}
                                  >
                                    <Text
                                      fontSize="$xs"
                                      fontWeight="bold"
                                      color={isStartYear || isEarned ? '#059669' : '#78716c'}
                                    >
                                      {isStartYear && '📍 '}
                                      {String(year)}
                                      {isEarned && earnedCount > 1 && ` (${earnedCount}x)`}
                                    </Text>
                                  </Box>
                                </RNPressable>
                              )}
                              
                              {/* Preliminära år */}
                              {isPrelim && (
                                <RNPressable
                                  onPress={() => handleYearPress(player.name, year)}
                                >
                                  <Box
                                    bg="rgba(251, 146, 60, 0.15)"
                                    px="$2"
                                    py="$1"
                                    rounded="$lg"
                                    borderWidth={1}
                                    borderColor="rgba(251, 146, 60, 0.7)"
                                  >
                                    <Text
                                      fontSize="$xs"
                                      fontWeight="bold"
                                      color="#ea580c"
                                    >
                                      {String(year)}
                                      {prelimCount > 1 && ` (${prelimCount}x)`}
                                    </Text>
                                  </Box>
                                </RNPressable>
                              )}
                            </HStack>
                          );
                        })}
                      </HStack>
                    )}
                  </Box>
                );
              })}
            </VStack>
          )}

          {/* Scores Section - SECONDARY */}
          {playerStats.length > 0 && (
            <VStack space="md">
              <Text
                fontSize="$xs"
                fontWeight="bold"
                sx={{ _dark: { color: '$textDark400' } }}
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                SCORES
              </Text>

              <HStack space="md">
                {playerStats.map((player, idx) => (
                  <Box
                    key={idx}
                    flex={1}
                    bg="$backgroundLight100"
                    p="$3"
                    rounded="$xl"
                    borderWidth={activePlayerName === player.name ? 2 : 1}
                    borderColor={
                      activePlayerName === player.name
                        ? '#059669'
                        : '$backgroundLight200'
                    }
                    sx={{
                      _dark: {
                        bg: '$backgroundDark900',
                        borderColor:
                          activePlayerName === player.name
                            ? '#10b981'
                            : '$backgroundDark800',
                      },
                    }}
                  >
                    <VStack space="xs" alignItems="center">
                      <Text
                        fontSize="$xs"
                        fontWeight="bold"
                        sx={{ _dark: { color: '$textDark400' } }}
                        numberOfLines={1}
                      >
                        {player.name}
                      </Text>
                      <Text
                        fontSize="$2xl"
                        fontWeight="black"
                        color={
                          activePlayerName === player.name
                            ? '#059669'
                            : '#6b7280'
                        }
                        sx={{
                          _dark: {
                            color:
                              activePlayerName === player.name
                                ? '#10b981'
                                : '$textDark400',
                          },
                        }}
                      >
                        {player.score}
                      </Text>
                    </VStack>
                  </Box>
                ))}
              </HStack>
            </VStack>
          )}

          {/* Latest Song Played - BOTTOM */}
          {lastPlayedSong && (
            <VStack space="sm">
              <Text
                fontSize="$xs"
                fontWeight="bold"
                sx={{ _dark: { color: '$textDark400' } }}
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                LATEST SONG PLAYED
              </Text>

              <Box
                bg="rgba(168, 85, 247, 0.1)"
                p="$4"
                rounded="$2xl"
                borderWidth={1}
                borderColor="rgba(168, 85, 247, 0.3)"
              >
                <VStack space="xs">
                  <Text
                    fontSize="$lg"
                    fontWeight="bold"
                    sx={{ _dark: { color: '$textDark100' } }}
                    numberOfLines={2}
                  >
                    {lastPlayedSong.title}
                  </Text>
                  <Text
                    fontSize="$sm"
                    sx={{ _dark: { color: '$textDark400' } }}
                  >
                    {lastPlayedSong.artist}
                  </Text>
                </VStack>
              </Box>
            </VStack>
          )}
        </VStack>
      </AnimatedScrollView>
      {renderYearModal()}
    </Box>
  );
}
