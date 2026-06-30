import React, { useState, useRef, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, NativeSyntheticEvent, NativeScrollEvent, Animated, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VStack, Input, InputField, Button, ButtonText, Center, Text, HStack, Box } from '@gluestack-ui/themed';
import { UserPlus, PlayCircle, Music2, Globe, Disc, Star, Film, Sparkles, ChevronDown, ChevronUp, Sun, Trophy, Gift, Music } from 'lucide-react-native';

type Props = {
  onStart: (playerNames: string[], gameMode: string) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  headerHeight: number;
  minPlayers?: number; // default 2
};

const CURRENT_YEAR = new Date().getFullYear();

// Kategorier med ikoner
const GAME_MODES = [
  { id: 'default', label: `Blandat 1950-${CURRENT_YEAR}`, icon: Music2 },
  { id: 'svenska', label: `Svenska Hits 1960-${CURRENT_YEAR}`, icon: Globe },
  { id: 'eurovision', label: `Eurovision 1956-${CURRENT_YEAR}`, icon: Star },
  { id: 'rock', label: `Rock/Metal 1960-${CURRENT_YEAR}`, icon: Disc },
  { id: 'onehitwonder', label: 'One Hit Wonders 1970-2015', icon: PlayCircle },
  { id: 'filmmusik', label: `Film & TV Musik 1950-${CURRENT_YEAR}`, icon: Film },
  { id: 'disney', label: `Disney & Animerat 1937-${CURRENT_YEAR}`, icon: Sparkles },
  { id: 'melodifestivalen', label: `Melodifestivalen 1958-${CURRENT_YEAR}`, icon: Star },
  { id: 'kpop', label: `K-POP 2000-${CURRENT_YEAR}`, icon: Music2 },
  { id: 'eightiesnineties', label: '80s & 90s Hits 1980-1999', icon: Disc },
  { id: 'modernahits',      label: `Moderna Hits 2005-${CURRENT_YEAR}`,      icon: Sparkles },
  { id: 'sommarhits',      label: `Sommarhits 1960-${CURRENT_YEAR}`,         icon: Sun      },
  { id: 'dance',           label: `Dance & EDM 1970-${CURRENT_YEAR}`,        icon: Music2   },
  { id: 'julmusik',        label: `Julmusik 1940-${CURRENT_YEAR}`,           icon: Gift     },
  { id: 'country',         label: `Country 1950-${CURRENT_YEAR}`,            icon: Music    },
  { id: 'partylatar',      label: `Partylåtar 1960-${CURRENT_YEAR}`,         icon: Sparkles },
  { id: 'sportlatar',      label: `Sportlåtar 1970-${CURRENT_YEAR}`,         icon: Trophy   },
  { id: 'nordisk',         label: `Nordiska Hits 1960-${CURRENT_YEAR}`,      icon: Globe    },
];

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const MAX_PLAYERS = 5;

export default function PlayerSetupScreen({ onStart, onScroll, headerHeight, minPlayers = 2 }: Props) {
  const [playerNames, setPlayerNames] = useState<string[]>(() => Array(minPlayers).fill(''));
  const [selectedMode, setSelectedMode] = useState('default');
  const [error, setError] = useState('');
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (error) {
      setError('');
    }
  }, [playerNames]);

  const handleScrollCategories = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 10;
    setIsScrolledToBottom(isBottom);
  };

  const handleStart = () => {
    const trimmed = playerNames.map(n => n.trim());
    
    if (trimmed.some(n => n === '')) {
      setError('Alla players must have a name.');
      return;
    }
    
    const uniqueNames = new Set(trimmed.map(n => n.toLowerCase()));
    if (uniqueNames.size !== trimmed.length) {
      setError('Players cannot have the same name.');
      return;
    }
    
    setError('');
    onStart(trimmed, selectedMode);
  };

  const handleAddPlayer = () => {
    if (playerNames.length < MAX_PLAYERS) {
      setPlayerNames([...playerNames, '']);
    }
  };

  const handleRemovePlayer = (index: number) => {
    if (playerNames.length > minPlayers) {
      setPlayerNames(playerNames.filter((_, i) => i !== index));
    }
  };

  const handlePlayerNameChange = (index: number, value: string) => {
    const updated = [...playerNames];
    updated[index] = value;
    setPlayerNames(updated);
  };

  const isFormValid = playerNames.every(name => name.trim() !== '');
  const canAddPlayer = playerNames.length < MAX_PLAYERS;
  const canRemovePlayer = playerNames.length > minPlayers;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AnimatedScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: headerHeight + 15,
            paddingHorizontal: 24,
            paddingVertical: 40,
        }}
      >
        <Center>
          <VStack w="$full" maxWidth={420} space="2xl">
            {/* Header Section */}
            <VStack space="md" alignItems="center">
              <Box
                bg="$emerald500"
                w={64}
                h={64}
                rounded="$2xl"
                justifyContent="center"
                alignItems="center"
                sx={{
                  _dark: {
                    bg: '$emerald500',
                  }
                }}
              >
                <UserPlus size={28} color="white" />
              </Box>
              <Text
                fontSize="$3xl"
                fontWeight="black"
                textAlign="center"
                sx={{
                  _dark: { color: '$textDark50' }
                }}
              >
                BATTLE SETUP
              </Text>
              <Text
                fontSize="$sm"
                color="$textLight400"
                textAlign="center"
                fontWeight="500"
                sx={{
                  _dark: { color: '$textDark500' }
                }}
              >
                Challenge a friend to a duel
              </Text>
            </VStack>

            {/* Player Inputs */}
            <VStack space="lg">
              {playerNames.map((name, index) => (
                <HStack key={index} space="md" w="$full" alignItems="flex-start">
                  <VStack space="sm" flex={1}>
                    <Text fontSize="$xs" fontWeight="black" color="$textLight400" sx={{ _dark: { color: '$textDark500' } }}>
                      PLAYER {index + 1}
                    </Text>
                    <Input
                      rounded="$2xl"
                      borderWidth={2}
                      borderColor="$backgroundLight100"
                      bg="$backgroundLight50"
                      sx={{
                        _dark: { borderColor: '$backgroundDark800', bg: '$backgroundDark950' },
                        _focus: { borderColor: '$emerald500' },
                      }}
                    >
                      <InputField
                        placeholder={`Player ${index + 1}`}
                        value={name}
                        onChangeText={(value) => handlePlayerNameChange(index, value)}
                        fontWeight="bold"
                        sx={{ _dark: { color: '$textDark50' } }}
                      />
                    </Input>
                  </VStack>

                  {canRemovePlayer && (
                    <Box justifyContent="flex-end" mt="$6">
                      <Pressable onPress={() => handleRemovePlayer(index)} hitSlop={12}>
                        <Box w="$10" h="$10" rounded="$full" bg="$error500" justifyContent="center" alignItems="center" sx={{ _dark: { bg: '$error600' } }}>
                          <Text color="$white" fontSize="$lg" fontWeight="bold">−</Text>
                        </Box>
                      </Pressable>
                    </Box>
                  )}
                </HStack>
              ))}

              {canAddPlayer && (
                <Pressable onPress={handleAddPlayer}>
                  <Box w="$full" h="$12" rounded="$2xl" borderWidth={2} borderColor="$emerald500" borderStyle="dashed" justifyContent="center" alignItems="center" bg="rgba(16, 185, 129, 0.05)" sx={{ _dark: { bg: 'rgba(16, 185, 129, 0.08)' } }}>
                    <HStack space="sm" alignItems="center">
                      <Text fontSize="$md" fontWeight="bold" color="$emerald500">+ Add Player</Text>
                      <Text fontSize="$xs" color="$textLight400" sx={{ _dark: { color: '$textDark500' } }}>({playerNames.length}/{MAX_PLAYERS})</Text>
                    </HStack>
                  </Box>
                </Pressable>
              )}
            </VStack>

            {/* Category Selection - Scrollable */}
            <VStack space="md">
              <Text
                fontSize="$xs"
                fontWeight="black"
                color="$textLight400"
                sx={{
                  _dark: { color: '$textDark500' }
                }}
              >
                SELECT CATEGORY
              </Text>
              <Box position="relative">
                <ScrollView 
                  ref={scrollViewRef}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                  onScroll={handleScrollCategories}
                  style={{ maxHeight: 280 }}
                >
                  <VStack space="sm">
                    {GAME_MODES.map((mode) => {
                      const IconComponent = mode.icon;
                      const isSelected = selectedMode === mode.id;
                      
                      return (
                        <Pressable
                          key={mode.id}
                          onPress={() => setSelectedMode(mode.id)}
                        >
                          <Box
                            flexDirection="row"
                            alignItems="center"
                            p="$4"
                            rounded="$2xl"
                            borderWidth={2}
                            borderColor={isSelected ? '$emerald500' : '$backgroundLight100'}
                            bg="$backgroundLight50"
                            sx={{
                              _dark: {
                                borderColor: isSelected ? '$emerald500' : '$backgroundDark800',
                                bg: '$backgroundDark950',
                              },
                            }}
                          >
                            <Box
                              w="$6"
                              h="$6"
                              rounded="$md"
                              justifyContent="center"
                              alignItems="center"
                              bg="$backgroundLight200"
                              sx={{
                                _dark: {
                                  bg: '$backgroundDark800',
                                },
                              }}
                            >
                              <IconComponent size={20} color="#059669" />
                            </Box>
                            <VStack space="xs" ml="$4" flex={1}>
                              <Text
                                fontWeight="bold"
                                fontSize="$sm"
                                sx={{
                                  _dark: {
                                    color: '$textDark100',
                                  }
                                }}
                              >
                                {mode.label}
                              </Text>
                            </VStack>
                            {isSelected && (
                              <Box
                                w="$2"
                                h="$2"
                                rounded="$full"
                                bg="$emerald500"
                              />
                            )}
                          </Box>
                        </Pressable>
                      );
                    })}
                  </VStack>
                </ScrollView>
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 50,
                    pointerEvents: 'none',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {isScrolledToBottom ? (
                    <ChevronUp size={20} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
                  ) : (
                    <ChevronDown size={20} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
                  )}
                </LinearGradient>
              </Box>
            </VStack>

            {/* Error Message */}
            {error ? (
              <Box
                p="$4"
                rounded="$2xl"
                bg="$error500"
                borderLeftWidth={4}
                borderLeftColor="$error500"
              >
                <Text
                  color="$white"
                  fontWeight="bold"
                  textAlign="center"
                  sx={{
                    _dark: { color: '$white' }
                  }}
                >
                  {error}
                </Text>
              </Box>
            ) : null}

            {/* Action Buttons */}
            <VStack space="sm" pt="$4">
              <Button
                onPress={handleStart}
                isDisabled={!isFormValid}
                bg="$emerald500"
                borderWidth={0}
                rounded="$2xl"
                h="$16"
                sx={{
                  _dark: { bg: '$emerald500' },
                  _disabled: { opacity: 0.5 },
                }}
              >
                <HStack space="md" alignItems="center">
                  <PlayCircle size={24} color="white" />
                  <ButtonText
                    color="white"
                    fontSize="$lg"
                    fontWeight="black"
                  >
                    START MATCH
                  </ButtonText>
                </HStack>
              </Button>
            </VStack>
          </VStack>
        </Center>
      </AnimatedScrollView>
    </KeyboardAvoidingView>
  );
}
