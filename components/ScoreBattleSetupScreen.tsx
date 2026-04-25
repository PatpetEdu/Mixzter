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
  Music2,
  Globe,
  Disc,
  Star,
  PlayCircle,
  Film,
  Sparkles,
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
];

const TARGET_SCORES = [10, 15, 25, 30, 50];

const MAX_ROUNDS_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: '∞ Obegränsat', value: null },
  { label: '10',            value: 10  },
  { label: '15',            value: 15  },
  { label: '20',            value: 20  },
  { label: '25',            value: 25  },
];

export default function ScoreBattleSetupScreen({ onStart, onScroll, headerHeight }: Props) {
  const [playerNames, setPlayerNames] = useState<[string, string]>(['', '']);
  const [selectedMode, setSelectedMode] = useState('default');
  const [targetScore, setTargetScore] = useState<number>(30);
  const [maxRounds, setMaxRounds] = useState<number | null>(null);
  const [error, setError] = useState('');

  const handleStart = () => {
    const trimmed = playerNames.map(n => n.trim()).filter(n => n !== '');
    if (trimmed.length === 0) {
      setError('Ange minst ett spelarnamn.');
      return;
    }
    if (trimmed.length === 2 && trimmed[0].toLowerCase() === trimmed[1].toLowerCase()) {
      setError('Spelarna kan inte ha samma namn.');
      return;
    }
    setError('');
    onStart(trimmed, selectedMode, targetScore, maxRounds);
  };

  const isFormValid = playerNames.some(n => n.trim() !== '');

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

              {([0, 1] as const).map(i => (
                <VStack key={i} space="xs">
                  <Text fontSize="$xs" fontWeight="bold" color="$textLight300" sx={{ _dark: { color: '$textDark600' } }}>
                    SPELARE {i + 1}{i === 1 ? '  ·  valfri för solo' : ''}
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
                      value={playerNames[i]}
                      onChangeText={v => {
                        const updated: [string, string] = [...playerNames] as [string, string];
                        updated[i] = v;
                        setPlayerNames(updated);
                        setError('');
                      }}
                      fontWeight="bold"
                      sx={{ _dark: { color: '$textDark50' } }}
                    />
                  </Input>
                </VStack>
              ))}

              {error ? (
                <Text color="$error500" fontSize="$sm">{error}</Text>
              ) : null}
            </VStack>

            {/* ── Poänggräns ── */}
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
                        px="$4"
                        py="$2.5"
                        rounded="$2xl"
                        borderWidth={2}
                        borderColor={active ? '#4f46e5' : '$backgroundLight200'}
                        bg={active ? 'rgba(79,70,229,0.1)' : '$backgroundLight50'}
                        sx={{
                          _dark: {
                            borderColor: active ? '#4f46e5' : '$backgroundDark800',
                            bg: active ? 'rgba(79,70,229,0.18)' : '$backgroundDark950',
                          },
                        }}
                      >
                        <HStack space="xs" alignItems="center">
                          <Text
                            fontWeight="black"
                            fontSize="$md"
                            color={active ? '#818cf8' : '$textLight400'}
                            sx={{ _dark: { color: active ? '#818cf8' : '$textDark500' } }}
                          >
                            {score}p
                          </Text>
                          {score === 30 && (
                            <Text fontSize="$xs" color={active ? '#818cf8' : '$textLight300'} sx={{ _dark: { color: active ? '#818cf8' : '$textDark600' } }}>
                              ★
                            </Text>
                          )}
                        </HStack>
                      </Box>
                    </Pressable>
                  );
                })}
              </HStack>
            </VStack>

            {/* ── Antal omgångar ── */}
            <VStack space="md">
              <VStack space="xs">
                <Text fontSize="$xs" fontWeight="black" color="$textLight400" letterSpacing={1} sx={{ _dark: { color: '$textDark500' } }}>
                  ANTAL OMGÅNGAR
                </Text>
                <Text fontSize="$xs" color="$textLight300" sx={{ _dark: { color: '$textDark600' } }}>
                  {maxRounds === null
                    ? 'Styrs av poängen – ingen gräns på omgångar'
                    : `Spelet slutar efter ${maxRounds} omgångar – spelaren med mest poäng vinner`}
                </Text>
              </VStack>
              <HStack space="sm" flexWrap="wrap">
                {MAX_ROUNDS_OPTIONS.map(opt => {
                  const active = maxRounds === opt.value;
                  return (
                    <Pressable key={String(opt.value)} onPress={() => setMaxRounds(opt.value)} style={{ marginBottom: 8 }}>
                      <Box
                        px="$4"
                        py="$2.5"
                        rounded="$2xl"
                        borderWidth={2}
                        borderColor={active ? '#4f46e5' : '$backgroundLight200'}
                        bg={active ? 'rgba(79,70,229,0.1)' : '$backgroundLight50'}
                        sx={{
                          _dark: {
                            borderColor: active ? '#4f46e5' : '$backgroundDark800',
                            bg: active ? 'rgba(79,70,229,0.18)' : '$backgroundDark950',
                          },
                        }}
                      >
                        <HStack space="xs" alignItems="center">
                          <Text
                            fontWeight="black"
                            fontSize="$md"
                            color={active ? '#818cf8' : '$textLight400'}
                            sx={{ _dark: { color: active ? '#818cf8' : '$textDark500' } }}
                          >
                            {opt.label}
                          </Text>
                          {opt.value === null && (
                            <Text fontSize="$xs" color={active ? '#818cf8' : '$textLight300'} sx={{ _dark: { color: active ? '#818cf8' : '$textDark600' } }}>
                              ★
                            </Text>
                          )}
                        </HStack>
                      </Box>
                    </Pressable>
                  );
                })}
              </HStack>
            </VStack>

            {/* ── Musikgenre ── */}
            <VStack space="md">
              <Text fontSize="$xs" fontWeight="black" color="$textLight400" letterSpacing={1} sx={{ _dark: { color: '$textDark500' } }}>
                MUSIKGENRE
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                <HStack space="sm" px="$1">
                  {GAME_MODES.map(mode => {
                    const Icon = mode.icon;
                    const active = selectedMode === mode.id;
                    return (
                      <Pressable key={mode.id} onPress={() => setSelectedMode(mode.id)}>
                        <Box
                          px="$3"
                          py="$2"
                          rounded="$xl"
                          borderWidth={1.5}
                          borderColor={active ? '#4f46e5' : '$backgroundLight200'}
                          bg={active ? 'rgba(79,70,229,0.08)' : '$backgroundLight50'}
                          sx={{
                            _dark: {
                              borderColor: active ? '#4f46e5' : '$backgroundDark800',
                              bg: active ? 'rgba(79,70,229,0.18)' : '$backgroundDark950',
                            },
                          }}
                        >
                          <HStack space="xs" alignItems="center">
                            <Icon size={13} color={active ? '#818cf8' : '#6b7280'} />
                            <Text
                              fontSize="$xs"
                              fontWeight="bold"
                              color={active ? '#818cf8' : '$textLight400'}
                              numberOfLines={1}
                              sx={{ _dark: { color: active ? '#818cf8' : '$textDark500' } }}
                            >
                              {mode.label}
                            </Text>
                          </HStack>
                        </Box>
                      </Pressable>
                    );
                  })}
                </HStack>
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
