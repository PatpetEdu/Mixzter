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
  player1Name: string;
  player2Name: string;
  onPlayAgain?: () => void;
}

export default function ScoreScreen({ gameOverMessage, players, player1Name, player2Name }: Props) {
  const p1 = players[player1Name];
  const p2 = players[player2Name];

  const p1Score = p1.timeline.length + 1; // +1 för startår
  const p2Score = p2.timeline.length + 1; // +1 för startår
  
  const winner = p1Score > p2Score ? player1Name : p2Score > p1Score ? player2Name : null;
  const margin = Math.abs(p1Score - p2Score);

  const isP1Winner = winner === player1Name;
  const isP2Winner = winner === player2Name;
  const isDraw = winner === null;

  return (
    <ScrollView 
      contentContainerStyle={{ flexGrow: 1 }}
      style={{ backgroundColor: 'black' }}
    >
      <Center flex={1} px="$4" bg="$black">
        <VStack space="xl" alignItems="center" w="$full" maxWidth={400} py="$6">
        {/* Header */}
        <VStack space="sm" alignItems="center" w="$full" mt="$8">
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
          {/* Player 1 */}
          <Box
            bg={isP1Winner ? 'rgba(16, 185, 129, 0.15)' : isDraw ? 'rgba(100, 100, 110, 0.1)' : 'rgba(100, 100, 110, 0.05)'}
            borderRadius="$2xl"
            borderWidth={2}
            borderColor={isP1Winner ? 'rgba(16, 185, 129, 0.5)' : isDraw ? 'rgba(100, 100, 110, 0.3)' : 'rgba(100, 100, 110, 0.2)'}
            p="$6"
            w="$full"
          >
            <VStack space="md">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack space="xs" flex={1}>
                  <Text fontSize="$xl" fontWeight="900" color="$secondary100">
                    {player1Name}
                  </Text>
                  <Text fontSize="$sm" color="$secondary500">
                    {p1.cards.length} gissade låtar
                  </Text>
                </VStack>
                <Box 
                  bg={isP1Winner ? '$emerald600' : 'rgba(100, 100, 110, 0.3)'}
                  borderRadius="$xl"
                  px="$4"
                  py="$2"
                  minWidth={60}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Text fontSize="$3xl" fontWeight="900" color={isP1Winner ? '$white' : '$secondary300'}>
                    {p1Score}
                  </Text>
                </Box>
              </HStack>

              {/* Breakdown */}
              <VStack space="md" w="$full">
                <HStack space="lg" justifyContent="space-around">
                  <Box flex={1}>
                    <Text fontSize="$xs" color="$secondary600" mb="$1">Startår</Text>
                    <Text fontSize="$lg" fontWeight="900" color="$secondary300">{p1.startYear}</Text>
                  </Box>
                  <Box flex={1}>
                    <Text fontSize="$xs" color="$secondary600" mb="$1">Stjärnor</Text>
                    <HStack space="xs">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={18}
                          color={i < p1.stars ? '#EAB308' : 'rgba(100, 100, 110, 0.3)'}
                          fill={i < p1.stars ? '#EAB308' : 'none'}
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
                    {[p1.startYear, ...p1.timeline].sort((a, b) => a - b).join(', ')}
                  </Text>
                </Box>
              </VStack>
            </VStack>
          </Box>

          {/* Player 2 */}
          <Box
            bg={isP2Winner ? 'rgba(16, 185, 129, 0.15)' : isDraw ? 'rgba(100, 100, 110, 0.1)' : 'rgba(100, 100, 110, 0.05)'}
            borderRadius="$2xl"
            borderWidth={2}
            borderColor={isP2Winner ? 'rgba(16, 185, 129, 0.5)' : isDraw ? 'rgba(100, 100, 110, 0.3)' : 'rgba(100, 100, 110, 0.2)'}
            p="$6"
            w="$full"
          >
            <VStack space="md">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack space="xs" flex={1}>
                  <Text fontSize="$xl" fontWeight="900" color="$secondary100">
                    {player2Name}
                  </Text>
                  <Text fontSize="$sm" color="$secondary500">
                    {p2.cards.length} gissade låtar
                  </Text>
                </VStack>
                <Box 
                  bg={isP2Winner ? '$emerald600' : 'rgba(100, 100, 110, 0.3)'}
                  borderRadius="$xl"
                  px="$4"
                  py="$2"
                  minWidth={60}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Text fontSize="$3xl" fontWeight="900" color={isP2Winner ? '$white' : '$secondary300'}>
                    {p2Score}
                  </Text>
                </Box>
              </HStack>

              {/* Breakdown */}
              <VStack space="md" w="$full">
                <HStack space="lg" justifyContent="space-around">
                  <Box flex={1}>
                    <Text fontSize="$xs" color="$secondary600" mb="$1">Startår</Text>
                    <Text fontSize="$lg" fontWeight="900" color="$secondary300">{p2.startYear}</Text>
                  </Box>
                  <Box flex={1}>
                    <Text fontSize="$xs" color="$secondary600" mb="$1">Stjärnor</Text>
                    <HStack space="xs">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={18}
                          color={i < p2.stars ? '#EAB308' : 'rgba(100, 100, 110, 0.3)'}
                          fill={i < p2.stars ? '#EAB308' : 'none'}
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
                    {[p2.startYear, ...p2.timeline].sort((a, b) => a - b).join(', ')}
                  </Text>
                </Box>
              </VStack>
            </VStack>
          </Box>
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
    </ScrollView>  );
}