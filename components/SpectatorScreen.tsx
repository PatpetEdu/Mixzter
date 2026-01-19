import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Animated as RNAnimated, Pressable as RNPressable } from 'react-native';
import { Box, Center, Heading, VStack, HStack, Text, Pressable } from '@gluestack-ui/themed';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSpectatorListener, GameData } from '../hooks/useSpectatorListener';
import { useSpectatorCounter } from '../hooks/useSpectatorCounter';
import { useAuth } from '../hooks/useAuth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface SpectatorScreenProps {
  gameId: string;
  onLeave: () => void;
}

export default function SpectatorScreen({ gameId, onLeave }: SpectatorScreenProps) {
  const { gameData, loading, error } = useSpectatorListener({ gameId });
  const { count: spectatorCount } = useSpectatorCounter(gameId);
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
      score: data.timeline.length,
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
      {/* Header med Leave-knapp och spektator-count */}
      <HStack
        px="$6"
        py="$4"
        borderBottomWidth={1}
        borderBottomColor="$backgroundLight200"
        sx={{
          _dark: { borderBottomColor: '$backgroundDark800' },
        }}
        justifyContent="space-between"
        alignItems="center"
      >
        <VStack space="xs" flex={1}>
          <Text
            fontSize="$xs"
            fontWeight="bold"
            sx={{ _dark: { color: '$textDark400' } }}
          >
            WATCHING LIVE • 👥 {spectatorCount} {spectatorCount === 1 ? 'spectator' : 'spectators'}
          </Text>
          <Text
            fontSize="$lg"
            fontWeight="black"
            sx={{ _dark: { color: '$textDark100' } }}
          >
            Music Battle
          </Text>
        </VStack>

        <Pressable
          onPress={onLeave}
          hitSlop={8}
          bg="rgba(239, 68, 68, 0.1)"
          p="$2"
          rounded="$lg"
          sx={{
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.35)',
            _dark: { borderColor: 'rgba(239,68,68,0.45)' },
          }}
        >
          <X size={20} color="#dc2626" />
        </Pressable>
      </HStack>

      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
        <VStack space="xl">
          {/* Player Stats Section */}
          {playerStats.length > 0 && (
            <VStack space="md">
              <Text
                fontSize="$sm"
                fontWeight="bold"
                sx={{ _dark: { color: '$textDark400' } }}
              >
                SCORES
              </Text>

              {playerStats.map((player, idx) => (
                <Box
                  key={idx}
                  bg="$backgroundLight100"
                  p="$4"
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
                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack space="xs" flex={1}>
                      <Text
                        fontSize="$md"
                        fontWeight="bold"
                        sx={{ _dark: { color: '$textDark100' } }}
                      >
                        {player.name}
                      </Text>
                      <Text
                        fontSize="$xs"
                        sx={{ _dark: { color: '$textDark400' } }}
                      >
                        ⭐ {player.stars} stars
                      </Text>
                    </VStack>
                    <Box
                      bg={
                        activePlayerName === player.name
                          ? 'rgba(16, 185, 129, 0.1)'
                          : '$backgroundLight200'
                      }
                      px="$4"
                      py="$2"
                      rounded="$lg"
                      sx={{
                        _dark: {
                          bg:
                            activePlayerName === player.name
                              ? 'rgba(16, 185, 129, 0.15)'
                              : '$backgroundDark800',
                        },
                      }}
                    >
                      <Text
                        fontSize="$xl"
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
                    </Box>
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}

          {/* Timeline Section - Prominent */}
          {playerStats.length > 0 && (
            <VStack space="md">
              <Text
                fontSize="$sm"
                fontWeight="bold"
                sx={{ _dark: { color: '$textDark400' } }}
              >
                TIMELINE
              </Text>

              {playerStats.map((player, idx) => {
                // Show timeline years (guessed years + correct placements)
                const playerData = gameData?.players?.[player.name];
                const startYear = playerData?.startYear;
                const roundCardsForPlayer = activePlayerName === player.name ? (gameData?.roundCards || []) : [];
                
                // Grön: sparade år (timeline), Orange: preliminära (roundCards för activePlayer bara)
                const baseYears = startYear ? [startYear] : [];
                const allYearsSet = new Set([...baseYears, ...player.timeline, ...roundCardsForPlayer.map(c => c.year)]);
                const allYears = Array.from(allYearsSet).sort((a, b) => a - b);
                
                // Check if this is the first player (by checking first key in gameData.players)
                const firstPlayerName = gameData?.players ? Object.keys(gameData.players)[0] : null;
                const isFirstPlayer = player.name === firstPlayerName;

                return (
                  <Box
                    key={idx}
                    bg="$backgroundLight100"
                    p="$4"
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
                    <Text
                      fontSize="$md"
                      fontWeight="bold"
                      mb="$3"
                      sx={{ _dark: { color: '$textDark100' } }}
                    >
                      {isFirstPlayer && '♔ '}{player.name}
                    </Text>
                    <HStack flexWrap="wrap" space="sm">
                      {allYears.map((year, i) => {
                        const isStartYear = year === startYear;
                        const isPrelim = roundCardsForPlayer.some(c => c.year === year);
                        const isEarned = player.timeline.includes(year);
                        
                        let bgColor = 'rgba(16, 185, 129, 0.15)';
                        let borderColor = 'rgba(16, 185, 129, 0.6)';
                        let textColor = '#059669';
                        
                        if (isPrelim && !isEarned) {
                          // Orange: preliminärt
                          bgColor = 'rgba(251, 146, 60, 0.15)';
                          borderColor = 'rgba(251, 146, 60, 0.7)';
                          textColor = '#ea580c';
                        }
                        // Annars grön (både startYear och intjänade år)

                        return (
                          <RNPressable
                            key={i}
                            onPress={() => handleYearPress(player.name, year)}
                          >
                            <Box
                              bg={bgColor}
                              px="$2.5"
                              py="$1"
                              rounded="$md"
                              borderWidth={1}
                              borderColor={borderColor}
                            >
                              <Text
                                fontSize="$xs"
                                fontWeight="bold"
                                color={textColor}
                                sx={{
                                  _dark: { color: textColor },
                                }}
                              >
                                {isStartYear && '📍 '}
                                {String(year)}
                              </Text>
                            </Box>
                          </RNPressable>
                        );
                      })}
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          )}

          {/* Latest Song Played */}
          {lastPlayedSong && (
            <VStack space="md">
              <Text
                fontSize="$sm"
                fontWeight="bold"
                sx={{ _dark: { color: '$textDark400' } }}
              >
                LATEST SONG PLAYED
              </Text>

              <Box
                bg="rgba(168, 85, 247, 0.1)"
                p="$4"
                rounded="$xl"
                borderWidth={1}
                borderColor="rgba(168, 85, 247, 0.3)"
              >
                <VStack space="sm">
                  <Text
                    fontSize="$sm"
                    fontWeight="bold"
                    sx={{ _dark: { color: '$textDark100' } }}
                  >
                    {lastPlayedSong.title}
                  </Text>
                  <Text
                    fontSize="$xs"
                    sx={{ _dark: { color: '$textDark400' } }}
                  >
                    {lastPlayedSong.artist}
                  </Text>
                </VStack>
              </Box>
            </VStack>
          )}
        </VStack>
      </ScrollView>
      {renderYearModal()}
    </Box>
  );
}
