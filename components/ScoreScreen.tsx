import React from 'react';
import { Box, Text, VStack, HStack, Center, Heading } from '@gluestack-ui/themed';
import { Trophy, Star, Handshake } from 'lucide-react-native';
import { ScrollView } from 'react-native';

interface Player {
  name: string;
  timeline: number[];
  cards: any[];
  startYear: number;
  stars: number;
}

interface Props {
  gameOverMessage: string;
  players: { [key: string]: Player };
  playerNames: string[]; // Array of player names
  onPlayAgain?: () => void;
}

export default function ScoreScreen({ gameOverMessage, players, playerNames }: Props) {
  // Calculate scores for all players
  const scores = playerNames.map(name => ({
    name,
    score: (players[name]?.timeline.length ?? 0) + 1 // +1 för startår
  }));
  
  // Find winner(s)
  const maxScore = Math.max(...scores.map(s => s.score));
  const winners = scores.filter(s => s.score === maxScore);
  const isDraw = winners.length > 1;
  // Vinstmarginal = skillnad mellan vinnare och näst bäst
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  const margin = sortedScores[0].score - (sortedScores[1]?.score ?? 0);

  return (
    <ScrollView 
      contentContainerStyle={{ paddingVertical: 20 }}
      style={{ backgroundColor: 'black' }}
    >
      <Center px="$4" bg="$black">
        <VStack space="xl" alignItems="center" w="$full" maxWidth={400} py="$6">
        {/* Header */}
        <VStack space="sm" alignItems="center" w="$full" mt="$12">
          <Box
            w={64}
            h={64}
            bg="rgba(16, 185, 129, 0.1)"
            borderRadius="$3xl"
            justifyContent="center"
            alignItems="center"
            mb="$2"
          >
            <Trophy size={48} color="#10B981" strokeWidth={1.5} />
          </Box>
          <Heading size="2xl" color="$emerald500">Spelet är över!</Heading>
          <Text fontSize="$lg" fontWeight="600" color="$secondary300">
            {gameOverMessage}
          </Text>
        </VStack>

        {/* Score Cards */}
        <VStack space="md" w="$full">
          {scores.map((playerScore) => {
            const player = players[playerScore.name];
            const isWinner = winners.some(w => w.name === playerScore.name);
            const isHighlighted = isWinner || isDraw;
            const isFirstPlayer = playerScore.name === playerNames[0]; // Check if starting player
            
            return (
              <Box
                key={playerScore.name}
                bg={isHighlighted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 100, 110, 0.05)'}
                borderRadius="$2xl"
                borderWidth={2}
                borderColor={isHighlighted ? 'rgba(16, 185, 129, 0.5)' : 'rgba(100, 100, 110, 0.2)'}
                p="$6"
                w="$full"
              >
                <VStack space="md">
                  <HStack justifyContent="space-between" alignItems="center">
                    <VStack space="xs" flex={1}>
                      <Text fontSize="$xl" fontWeight="900" color="$secondary100">
                        {isFirstPlayer && '♔ '}{playerScore.name}
                      </Text>
                      <Text fontSize="$sm" color="$secondary500">
                        {player.cards.length} gissade låtar
                      </Text>
                    </VStack>
                    <Box 
                      bg={isHighlighted ? '$emerald600' : 'rgba(100, 100, 110, 0.3)'}
                      borderRadius="$xl"
                      px="$4"
                      py="$2"
                      minWidth={60}
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Text fontSize="$3xl" fontWeight="900" color={isHighlighted ? '$white' : '$secondary300'}>
                        {playerScore.score}
                      </Text>
                    </Box>
                  </HStack>

                  {/* Breakdown */}
                  <VStack space="md" w="$full">
                    <HStack space="lg" justifyContent="space-around">
                      <Box flex={1}>
                        <Text fontSize="$xs" color="$secondary600" mb="$1">Startår</Text>
                        <Text fontSize="$lg" fontWeight="900" color="$secondary300">{player.startYear}</Text>
                      </Box>
                      <Box flex={1}>
                        <Text fontSize="$xs" color="$secondary600" mb="$1">Stjärnor</Text>
                        <HStack space="xs">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={18}
                              color={i < player.stars ? '#EAB308' : 'rgba(100, 100, 110, 0.3)'}
                              fill={i < player.stars ? '#EAB308' : 'none'}
                              strokeWidth={1.5}
                            />
                          ))}
                        </HStack>
                      </Box>
                    </HStack>
                    {/* Timeline */}
                    <Box bg="rgba(100, 100, 110, 0.1)" borderRadius="$lg" p="$3" w="$full">
                      <Text fontSize="$xs" color="$secondary600" mb="$2">Tidslinjen</Text>
                      <Text fontSize="$sm" color="$secondary300" lineHeight={20}>
                        {[player.startYear, ...player.timeline].sort((a, b) => a - b).join(', ')}
                      </Text>
                    </Box>
                  </VStack>
                </VStack>
              </Box>
            );
          })}
        </VStack>

        {/* Match Stats */}
        {!isDraw && (
          <Box
            bg="rgba(16, 185, 129, 0.05)"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="rgba(16, 185, 129, 0.2)"
            p="$4"
            w="$full"
            mt="$2"
          >
            <VStack space="sm" alignItems="center">
              <Text fontSize="$sm" color="$secondary500" textTransform="uppercase" letterSpacing={1}>
                Vinnarmarginal
              </Text>
              <HStack space="sm" alignItems="center">
                <Text fontSize="$2xl" fontWeight="900" color="$emerald500">
                  {margin}
                </Text>
                <Text fontSize="$sm" color="$secondary500">
                  {margin === 1 ? 'kort' : 'kort'}
                </Text>
              </HStack>
            </VStack>
          </Box>
        )}

        {isDraw && (
          <Box
            bg="rgba(168, 85, 247, 0.05)"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="rgba(168, 85, 247, 0.2)"
            p="$4"
            w="$full"
            mt="$2"
          >
            <VStack space="sm" alignItems="center">
              <Handshake size={32} color="rgba(168, 85, 247, 0.8)" strokeWidth={1.5} />
              <Text fontSize="$sm" color="$secondary500" textAlign="center" textTransform="uppercase" letterSpacing={1}>
                En helt jämn match!
              </Text>
            </VStack>
          </Box>
        )}
      </VStack>
      </Center>
    </ScrollView>
  );
}