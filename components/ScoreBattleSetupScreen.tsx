// components/ScoreBattleSetupScreen.tsx
//
// Setup-skärm för Score Battle. Spelaren väljer namn, genre, poänggräns och antal omgångar.
//
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  ScrollView,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  VStack,
  Input,
  InputField,
  Text,
  HStack,
  Box,
  Center,
} from '@gluestack-ui/themed';
import {
  Trophy,
  RotateCw,
  Music2,
  Globe,
  Disc,
  Star,
  PlayCircle,
  Film,
  Sparkles,
  UserPlus,
  Sun,
  Gift,
  Music,
} from 'lucide-react-native';

type Props = {
  onStart: (
    playerNames: string[],
    gameMode: string,
    targetScore: number,
    maxRounds: number | null,
  ) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  headerHeight: number;
};

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const CURRENT_YEAR = new Date().getFullYear();

const GAME_MODES = [
  { id: 'default',          label: `Blandat 1950–${CURRENT_YEAR}`,        icon: Music2     },
  { id: 'svenska',          label: `Svenska Hits 1960–${CURRENT_YEAR}`,   icon: Globe      },
  { id: 'eurovision',       label: `Eurovision 1956–${CURRENT_YEAR}`,     icon: Star       },
  { id: 'rock',             label: `Rock/Metal 1960–${CURRENT_YEAR}`,     icon: Disc       },
  { id: 'onehitwonder',     label: 'One Hit Wonders 1970–2015',           icon: PlayCircle },
  { id: 'filmmusik',        label: `Film & TV Musik 1950–${CURRENT_YEAR}`, icon: Film      },
  { id: 'disney',           label: `Disney & Animerat 1937–${CURRENT_YEAR}`, icon: Sparkles },
  { id: 'melodifestivalen', label: `Melodifestivalen 1958–${CURRENT_YEAR}`, icon: Star     },
  { id: 'kpop',             label: `K-POP 2000–${CURRENT_YEAR}`,          icon: Music2     },
  { id: 'eightiesnineties', label: '80s & 90s Hits 1980–1999',            icon: Disc       },
  { id: 'modernahits',      label: `Moderna Hits 2005–${CURRENT_YEAR}`,   icon: Sparkles   },
  { id: 'sommarhits',       label: `Sommarhits 1960–${CURRENT_YEAR}`,     icon: Sun        },
  { id: 'dance',            label: `Dance & EDM 1970–${CURRENT_YEAR}`,   icon: Music2     },
  { id: 'julmusik',         label: `Julmusik 1940–${CURRENT_YEAR}`,       icon: Gift       },
  { id: 'country',          label: `Country 1950–${CURRENT_YEAR}`,        icon: Music      },
  { id: 'partylatar',       label: `Partylåtar 1960–${CURRENT_YEAR}`,     icon: Sparkles   },
  { id: 'sportlatar',       label: `Sportlåtar 1970–${CURRENT_YEAR}`,     icon: Trophy     },
  { id: 'nordisk',          label: `Nordiska Hits 1960–${CURRENT_YEAR}`,  icon: Globe      },
];

const TARGET_SCORES = [10, 15, 25, 30, 50];

const MAX_ROUNDS_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: '∞ Obegränsat', value: null },
  { label: '10',            value: 10  },
  { label: '15',            value: 15  },
  { label: '20',            value: 20  },
  { label: '25',            value: 25  },
];

const MAX_PLAYERS = 5;
const MIN_PLAYERS = 1;

export default function ScoreBattleSetupScreen({ onStart, onScroll, headerHeight }: Props) {
  const [playerNames, setPlayerNames] = useState<string[]>(['', '']);
  const [selectedMode, setSelectedMode] = useState('default');
  const [gameType, setGameType] = useState<'score' | 'rounds'>('score');
  const [targetScore, setTargetScore] = useState<number>(30);
  const [maxRounds, setMaxRounds] = useState<number>(10);
  const [error, setError] = useState('');

  const handleChangeName = (i: number, v: string) => {
    const updated = [...playerNames];
    updated[i] = v;
    setPlayerNames(updated);
    setError('');
  };

  const handleAddPlayer = () => {
    if (playerNames.length < MAX_PLAYERS) setPlayerNames([...playerNames, '']);
  };

  const handleRemovePlayer = (i: number) => {
    if (playerNames.length > MIN_PLAYERS) setPlayerNames(playerNames.filter((_, idx) => idx !== i));
  };

  const handleStart = () => {
    const trimmed = playerNames.map(n => n.trim());
    if (trimmed.some(n => n === '')) {
      setError('Alla spelare måste ha ett namn.');
      return;
    }
    const unique = new Set(trimmed.map(n => n.toLowerCase()));
    if (unique.size !== trimmed.length) {
      setError('Spelarna kan inte ha samma namn.');
      return;
    }
    setError('');
    // Skicka bara det aktiva villkoret – det andra sätts till null/oändligt
    if (gameType === 'score') {
      onStart(trimmed, selectedMode, targetScore, null);
    } else {
      onStart(trimmed, selectedMode, Infinity, maxRounds);
    }
  };

  const isFormValid = playerNames.every(n => n.trim() !== '');
  const canAdd = playerNames.length < MAX_PLAYERS;
  const canRemove = playerNames.length > MIN_PLAYERS;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AnimatedScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: headerHeight + 15,
          paddingHorizontal: 24,
          paddingBottom: 48,
        }}
      >
        <Center>
          <VStack w="$full" maxWidth={420} space="2xl">

            {/* ── Header ── */}
            <VStack space="md" alignItems="center" mt="$4">
              <LinearGradient
                colors={['#1d4ed8', '#4f46e5']}
                start={[0, 0]}
                end={[1, 1]}
                style={s.headerIcon}
              >
                <Trophy size={28} color="white" />
              </LinearGradient>
              <Text fontSize="$3xl" fontWeight="black" textAlign="center" sx={{ _dark: { color: '$textDark50' } }}>
                SCORE BATTLE
              </Text>
              <Text fontSize="$sm" color="$textLight400" textAlign="center" fontWeight="500" sx={{ _dark: { color: '$textDark500' } }}>
                Ställ in matchen
              </Text>
            </VStack>

            {/* ── Spelarnamn ── */}
            <VStack space="md">
              <Text fontSize="$xs" fontWeight="black" color="$textLight400" letterSpacing={1} sx={{ _dark: { color: '$textDark500' } }}>
                SPELARE
              </Text>

              {playerNames.map((name, i) => (
                <HStack key={i} space="md" w="$full" alignItems="flex-start">
                  <VStack space="xs" flex={1}>
                    <Text fontSize="$xs" fontWeight="bold" color="$textLight300" sx={{ _dark: { color: '$textDark600' } }}>
                      SPELARE {i + 1}
                    </Text>
                    <Input
                      rounded="$2xl"
                      borderWidth={2}
                      borderColor="$backgroundLight100"
                      bg="$backgroundLight50"
                      sx={{
                        _dark: { borderColor: '$backgroundDark800', bg: '$backgroundDark950' },
                        _focus: { borderColor: '#4f46e5' },
                      }}
                    >
                      <InputField
                        placeholder={`Spelare ${i + 1}`}
                        value={name}
                        onChangeText={v => handleChangeName(i, v)}
                        fontWeight="bold"
                        sx={{ _dark: { color: '$textDark50' } }}
                      />
                    </Input>
                  </VStack>
                  {canRemove && (
                    <Box justifyContent="flex-end" mt="$6">
                      <Pressable onPress={() => handleRemovePlayer(i)} hitSlop={12}>
                        <Box w="$10" h="$10" rounded="$full" bg="$error500" justifyContent="center" alignItems="center" sx={{ _dark: { bg: '$error600' } }}>
                          <Text color="$white" fontSize="$lg" fontWeight="bold">−</Text>
                        </Box>
                      </Pressable>
                    </Box>
                  )}
                </HStack>
              ))}

              {canAdd && (
                <Pressable onPress={handleAddPlayer}>
                  <Box w="$full" h="$12" rounded="$2xl" borderWidth={2} borderColor="#4f46e5" borderStyle="dashed" justifyContent="center" alignItems="center" bg="rgba(79,70,229,0.05)" sx={{ _dark: { bg: 'rgba(79,70,229,0.1)' } }}>
                    <HStack space="sm" alignItems="center">
                      <UserPlus size={16} color="#818cf8" />
                      <Text fontSize="$sm" fontWeight="bold" color="#818cf8">+ Lägg till spelare</Text>
                      <Text fontSize="$xs" color="$textLight400" sx={{ _dark: { color: '$textDark500' } }}>({playerNames.length}/{MAX_PLAYERS})</Text>
                    </HStack>
                  </Box>
                </Pressable>
              )}

              {error ? (
                <Text color="$error500" fontSize="$sm">{error}</Text>
              ) : null}
            </VStack>

            {/* ── Spelläge ── */}
            <VStack space="md">
              <Text fontSize="$xs" fontWeight="black" color="$textLight400" letterSpacing={1} sx={{ _dark: { color: '$textDark500' } }}>
                SPELLÄGE
              </Text>
              <HStack space="sm">
                <Pressable style={{ flex: 1 }} onPress={() => setGameType('score')}>
                  <Box
                    py="$3" px="$3" minHeight={118} rounded="$2xl" borderWidth={2}
                    borderColor={gameType === 'score' ? '#4f46e5' : '$backgroundLight200'}
                    bg={gameType === 'score' ? 'rgba(79,70,229,0.10)' : '$backgroundLight50'}
                    sx={{ _dark: { borderColor: gameType === 'score' ? '#4f46e5' : '$backgroundDark800', bg: gameType === 'score' ? 'rgba(79,70,229,0.18)' : '$backgroundDark950' } }}
                  >
                    <VStack flex={1} space="xs" alignItems="center" justifyContent="center">
                      <Trophy size={20} color={gameType === 'score' ? '#818cf8' : '#6b7280'} />
                      <Text fontWeight="black" fontSize="$sm" color={gameType === 'score' ? '#818cf8' : '$textLight400'} textAlign="center" sx={{ _dark: { color: gameType === 'score' ? '#818cf8' : '$textDark500' } }}>
                        Poäng
                      </Text>
                      <Text fontSize="$2xs" color="$textLight300" textAlign="center" sx={{ _dark: { color: '$textDark600' } }}>
                        Först till X poäng vinner
                      </Text>
                    </VStack>
                  </Box>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => setGameType('rounds')}>
                  <Box
                    py="$3" px="$3" minHeight={118} rounded="$2xl" borderWidth={2}
                    borderColor={gameType === 'rounds' ? '#4f46e5' : '$backgroundLight200'}
                    bg={gameType === 'rounds' ? 'rgba(79,70,229,0.10)' : '$backgroundLight50'}
                    sx={{ _dark: { borderColor: gameType === 'rounds' ? '#4f46e5' : '$backgroundDark800', bg: gameType === 'rounds' ? 'rgba(79,70,229,0.18)' : '$backgroundDark950' } }}
                  >
                    <VStack flex={1} space="xs" alignItems="center" justifyContent="center">
                      <RotateCw size={20} color={gameType === 'rounds' ? '#818cf8' : '#6b7280'} />
                      <Text fontWeight="black" fontSize="$sm" color={gameType === 'rounds' ? '#818cf8' : '$textLight400'} textAlign="center" sx={{ _dark: { color: gameType === 'rounds' ? '#818cf8' : '$textDark500' } }}>
                        Omgångar
                      </Text>
                      <Text fontSize="$2xs" color="$textLight300" textAlign="center" sx={{ _dark: { color: '$textDark600' } }}>
                        Flest poäng efter X omgångar
                      </Text>
                    </VStack>
                  </Box>
                </Pressable>
              </HStack>
            </VStack>

            {/* ── Poänggräns (bara vid poängjakt) ── */}
            {gameType === 'score' && (
              <VStack space="md">
                <VStack space="xs">
                  <Text fontSize="$xs" fontWeight="black" color="$textLight400" letterSpacing={1} sx={{ _dark: { color: '$textDark500' } }}>
                    VINNARMÅL – POÄNG
                  </Text>
                  <Text fontSize="$xs" color="$textLight300" sx={{ _dark: { color: '$textDark600' } }}>
                    Spelet slutar när en spelare når detta antal poäng
                  </Text>
                </VStack>
                <HStack space="sm" flexWrap="wrap">
                  {TARGET_SCORES.map(score => {
                    const active = targetScore === score;
                    return (
                      <Pressable key={score} onPress={() => setTargetScore(score)} style={{ marginBottom: 8 }}>
                        <Box
                          px="$4" py="$2.5" rounded="$2xl" borderWidth={2}
                          borderColor={active ? '#4f46e5' : '$backgroundLight200'}
                          bg={active ? 'rgba(79,70,229,0.1)' : '$backgroundLight50'}
                          sx={{ _dark: { borderColor: active ? '#4f46e5' : '$backgroundDark800', bg: active ? 'rgba(79,70,229,0.18)' : '$backgroundDark950' } }}
                        >
                          <HStack space="xs" alignItems="center">
                            <Text fontWeight="black" fontSize="$md" color={active ? '#818cf8' : '$textLight400'} sx={{ _dark: { color: active ? '#818cf8' : '$textDark500' } }}>
                              {score}p
                            </Text>
                            {score === 30 && (
                              <Text fontSize="$xs" color={active ? '#818cf8' : '$textLight300'} sx={{ _dark: { color: active ? '#818cf8' : '$textDark600' } }}>★</Text>
                            )}
                          </HStack>
                        </Box>
                      </Pressable>
                    );
                  })}
                </HStack>
              </VStack>
            )}

            {/* ── Antal omgångar (bara vid omgångsläge) ── */}
            {gameType === 'rounds' && (
              <VStack space="md">
                <VStack space="xs">
                  <Text fontSize="$xs" fontWeight="black" color="$textLight400" letterSpacing={1} sx={{ _dark: { color: '$textDark500' } }}>
                    ANTAL OMGÅNGAR
                  </Text>
                  <Text fontSize="$xs" color="$textLight300" sx={{ _dark: { color: '$textDark600' } }}>
                    Spelet slutar efter {maxRounds} omgångar – spelaren med mest poäng vinner
                  </Text>
                </VStack>
                <HStack space="sm" flexWrap="wrap">
                  {MAX_ROUNDS_OPTIONS.filter(o => o.value !== null).map(opt => {
                    const active = maxRounds === opt.value;
                    return (
                      <Pressable key={String(opt.value)} onPress={() => setMaxRounds(opt.value!)} style={{ marginBottom: 8 }}>
                        <Box
                          px="$4" py="$2.5" rounded="$2xl" borderWidth={2}
                          borderColor={active ? '#4f46e5' : '$backgroundLight200'}
                          bg={active ? 'rgba(79,70,229,0.1)' : '$backgroundLight50'}
                          sx={{ _dark: { borderColor: active ? '#4f46e5' : '$backgroundDark800', bg: active ? 'rgba(79,70,229,0.18)' : '$backgroundDark950' } }}
                        >
                          <Text fontWeight="black" fontSize="$md" color={active ? '#818cf8' : '$textLight400'} sx={{ _dark: { color: active ? '#818cf8' : '$textDark500' } }}>
                            {opt.label}
                          </Text>
                        </Box>
                      </Pressable>
                    );
                  })}
                </HStack>
              </VStack>
            )}
            {/* ── Musikgenre ── */}
            <VStack space="md">
              <Text fontSize="$xs" fontWeight="black" color="$textLight400" letterSpacing={1} sx={{ _dark: { color: '$textDark500' } }}>
                MUSIKGENRE
              </Text>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 300 }}
                contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
              >
                {GAME_MODES.map(mode => {
                  const Icon = mode.icon;
                  const active = selectedMode === mode.id;
                  return (
                    <Pressable key={mode.id} onPress={() => setSelectedMode(mode.id)} style={{ width: '48%' }}>
                      <Box
                        px="$3"
                        py="$3"
                        rounded="$2xl"
                        borderWidth={2}
                        borderColor={active ? '#4f46e5' : '$backgroundLight200'}
                        bg={active ? 'rgba(79,70,229,0.10)' : '$backgroundLight50'}
                        sx={{
                          _dark: {
                            borderColor: active ? '#4f46e5' : '$backgroundDark800',
                            bg: active ? 'rgba(79,70,229,0.18)' : '$backgroundDark950',
                          },
                        }}
                      >
                        <HStack space="sm" alignItems="center">
                          <Icon size={16} color={active ? '#818cf8' : '#6b7280'} />
                          <Text
                            fontSize="$xs"
                            fontWeight="bold"
                            color={active ? '#818cf8' : '$textLight400'}
                            numberOfLines={2}
                            flex={1}
                            sx={{ _dark: { color: active ? '#818cf8' : '$textDark500' } }}
                          >
                            {mode.label}
                          </Text>
                        </HStack>
                      </Box>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </VStack>

            {/* ── Start-knapp ── */}
            <TouchableOpacity onPress={handleStart} disabled={!isFormValid} activeOpacity={0.85} style={{ marginBottom: 16 }}>
              <LinearGradient
                colors={isFormValid ? ['#1d4ed8', '#4f46e5'] : ['#1a1a2e', '#1a1a2e']}
                start={[0, 0]}
                end={[1, 0]}
                style={s.startBtn}
              >
                <Text fontWeight="black" fontSize="$lg" color={isFormValid ? 'white' : '#334155'}>
                  Starta Score Battle  ▶
                </Text>
              </LinearGradient>
            </TouchableOpacity>

          </VStack>
        </Center>
      </AnimatedScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
});
