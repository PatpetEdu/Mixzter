import React, { useState, useRef, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, NativeSyntheticEvent, NativeScrollEvent, Animated, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VStack, Input, InputField, Button, ButtonText, Center, Text, HStack, Box } from '@gluestack-ui/themed';
import { UserPlus, PlayCircle, Music2, Globe, Disc, Star, Film, Sparkles, ChevronDown, ChevronUp } from 'lucide-react-native';

type Props = {
 onStart: (player1: string, player2: string, gameMode: string) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  headerHeight: number;
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
  { id: 'modernahits', label: `Moderna Hits 2005-${CURRENT_YEAR}`, icon: Sparkles },
];

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function PlayerSetupScreen({ onStart, onScroll, headerHeight }: Props) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [selectedMode, setSelectedMode] = useState('default');
  const [error, setError] = useState('');
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Rensa felmeddelande när användaren ändrar något
  useEffect(() => {
    if (error) {
      setError('');
    }
  }, [player1, player2]);

  const handleScrollCategories = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 10;
    setIsScrolledToBottom(isBottom);
  };

  const handleStart = () => {
    if (!player1.trim() || !player2.trim()) {
      setError('Please enter names for both players.');
      return;
    }
    if (player1.trim().toLowerCase() === player2.trim().toLowerCase()) {
      setError('Players cannot have the same name.');
      return;
    }
    setError('');
    onStart(player1.trim(), player2.trim(), selectedMode);
  };

  const isFormValid = player1.trim() !== '' && player2.trim() !== '';

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
              <HStack space="md" w="$full">
                {/* Player 1 */}
                <VStack space="sm" flex={1}>
                  <Text
                    fontSize="$xs"
                    fontWeight="black"
                    color="$textLight400"
                    sx={{
                      _dark: { color: '$textDark500' }
                    }}
                  >
                    PLAYER 1
                  </Text>
                  <Input
                    rounded="$2xl"
                    borderWidth={2}
                    borderColor="$backgroundLight100"
                    bg="$backgroundLight50"
                    sx={{
                      _dark: {
                        borderColor: '$backgroundDark800',
                        bg: '$backgroundDark950',
                      },
                      _focus: {
                        borderColor: '$emerald500',
                      },
                    }}
                  >
                    <InputField
                      placeholder="Player 1"
                      value={player1}
                      onChangeText={setPlayer1}
                      fontWeight="bold"
                      sx={{
                        _dark: { color: '$textDark50' }
                      }}
                    />
                  </Input>
                </VStack>

                {/* Player 2 */}
                <VStack space="sm" flex={1}>
                  <Text
                    fontSize="$xs"
                    fontWeight="black"
                    color="$textLight400"
                    sx={{
                      _dark: { color: '$textDark500' }
                    }}
                  >
                    PLAYER 2
                  </Text>
                  <Input
                    rounded="$2xl"
                    borderWidth={2}
                    borderColor="$backgroundLight100"
                    bg="$backgroundLight50"
                    sx={{
                      _dark: {
                        borderColor: '$backgroundDark800',
                        bg: '$backgroundDark950',
                      },
                      _focus: {
                        borderColor: '$emerald500',
                      },
                    }}
                  >
                    <InputField
                      placeholder="Player 2"
                      value={player2}
                      onChangeText={setPlayer2}
                      fontWeight="bold"
                      sx={{
                        _dark: { color: '$textDark50' }
                      }}
                    />
                  </Input>
                </VStack>
              </HStack>
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
