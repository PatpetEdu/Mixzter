// SinglePlayerScreen.tsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {
  VStack,
  Heading,
  Button,
  ButtonText,
  Input,
  InputField,
  Text,
  Box,
  HStack,
} from '@gluestack-ui/themed';
import * as firebaseAuth from 'firebase/auth';

import PreviewCardFront, { PreviewCardFrontHandle } from './PreviewCardFront';
import {
  fetchPreviewCard,
  markPreviewSeen,
  PreviewCard as PreviewData,
} from '../utils/previewProvider';
import { useSinglePlayerLogic } from '../hooks/useSinglePlayerLogic';

type Props = {
  onBackToMenu: () => void;
  headerHeight: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Session-minne för att undvika dubbletter i samma session
const SEEN_SESSION = new Set<string>();

export default function SinglePlayerScreen({ onBackToMenu, headerHeight, onScroll }: Props) {
  const auth = firebaseAuth.getAuth();

  // nuvarande & nästa kort (preload)
  const [card, setCard] = useState<PreviewData | null>(null);
  const [nextCard, setNextCard] = useState<PreviewData | null>(null);

  const [loading, setLoading] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [error, setError] = useState('');

  // gissning + UI
  const [guess, setGuess] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [showPlacementChoice, setShowPlacementChoice] = useState(false);
  const [placement, setPlacement] = useState<'before' | 'after' | null>(null);

  // ljud
  const previewRef = useRef<PreviewCardFrontHandle>(null);

  const {
    player,
    wasCorrect,        // null | true | false
    exactHit,          // exakt år => auto ⭐
    highscore,
    gameOverMessage,
    skipSong,
    confirmGuess,
    resetGame,
  } = useSinglePlayerLogic(() => {
    advanceToNext();
  });

  const isGuessValid = useMemo(() => /^[0-9]{4}$/.test(guess), [guess]);

  const stopAudio = useCallback(async () => {
    try { await previewRef.current?.stop?.(); } catch {}
  }, []);

  useEffect(() => () => { stopAudio(); }, [stopAudio]);

  // --- Datadel: hämta & preload ---
  const actuallyFetchCard = useCallback(async (): Promise<PreviewData | null> => {
    const idToken = await auth.currentUser?.getIdToken?.();
    const c = await fetchPreviewCard(Array.from(SEEN_SESSION), idToken || undefined);
    if (!c) return null;
    const id = `${c.artist} - ${c.title}`.toLowerCase();
    if (SEEN_SESSION.has(id)) return null;
    SEEN_SESSION.add(id);
    markPreviewSeen(c, idToken || undefined).catch(() => {});
    return c;
  }, [auth]);

  const preloadNext = useCallback(async () => {
    if (preloading || nextCard) return;
    setPreloading(true);
    const c = await actuallyFetchCard();
    if (c) setNextCard(c);
    setPreloading(false);
  }, [preloading, nextCard, actuallyFetchCard]);

  const startFirst = useCallback(async () => {
    setError('');
    setLoading(true);
    setRevealed(false);
    setGuess('');
    await stopAudio();

    if (nextCard) {
      setCard(nextCard);
      setNextCard(null);
      setLoading(false);
      preloadNext();
      return;
    }

    const c = await actuallyFetchCard();
    setLoading(false);
    if (!c) { setError('Kunde inte hämta preview just nu. Försök igen.'); return; }
    setCard(c);
    preloadNext();
  }, [nextCard, preloadNext, actuallyFetchCard, stopAudio]);

  const advanceToNext = useCallback(async () => {
    setRevealed(false);
    setShowPlacementChoice(false);
    setPlacement(null);
    setGuess('');
    await stopAudio();

    if (nextCard) {
      setCard(nextCard);
      setNextCard(null);
      preloadNext();
    } else {
      setLoading(true);
      const c = await actuallyFetchCard();
      setLoading(false);
      if (c) setCard(c);
      preloadNext();
    }
  }, [nextCard, preloadNext, actuallyFetchCard, stopAudio]);

  // Auto-preload av första kortet när skärmen öppnas
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      startFirst();
    }
  }, [startFirst]);

  // --- UI-handlers ---
  const onConfirmPress = () => {
    if (!card) return;
    const y = parseInt(guess, 10);
    if (!isGuessValid || Number.isNaN(y)) return;

    const full = [player.startYear, ...player.timeline];
    if (full.includes(y)) {
      setShowPlacementChoice(true);
      return;
    }

    confirmGuess(guess, {
      title: card.title,
      artist: card.artist,
      year: card.year,
      previewUrl: card.previewUrl,
      externalUrl: card.externalUrl,
      artworkUrl: card.artworkUrl,
      source: card.source,
    });
    setRevealed(true);
  };

  const onConfirmPlacement = () => {
    if (!card || !placement) return;
    confirmGuess(guess, {
      title: card.title,
      artist: card.artist,
      year: card.year,
      previewUrl: card.previewUrl,
      externalUrl: card.externalUrl,
      artworkUrl: card.artworkUrl,
      source: card.source,
    }, placement);
    setRevealed(true);
    setShowPlacementChoice(false);
  };

  const onSkip = () => {
    if (!revealed) skipSong();
  };

  const onContinue = () => {
    advanceToNext();
  };

  // --- render helpers ---
  const renderTimeline = () => {
    const years = [player.startYear, ...player.timeline].sort((a, b) => a - b);
    return (
      <Box
        borderWidth={1}
        borderRadius="$lg"
        p="$3"
        my="$2"
        w="$full"
        bg="$primary100"
        borderColor="$primary300"
        sx={{ _dark: { bg: '$primary900', borderColor: '$primary700' } }}
      >
        <HStack justifyContent="space-between" alignItems="center" mb="$1">
          <Text bold fontSize="$lg">Din tidslinje ({player.timeline.length} kort)</Text>
          <Text bold fontSize="$lg">⭐ {player.stars}</Text>
        </HStack>
        <HStack flexWrap="wrap" mt="$1">
          {years.map((y, idx) => (
            <Box
              key={`${y}-${idx}`}
              px="$2"
              py="$1"
              mr="$2"
              mb="$2"
              borderRadius="$md"
              bg="$backgroundLight200"
              sx={{ _dark: { bg: '$backgroundDark700' } }}
            >
              <Text>{String(y)}</Text>
            </Box>
          ))}
        </HStack>
      </Box>
    );
  };

  // --- Game over ---
  if (gameOverMessage) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <AnimatedScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.container, { paddingTop: headerHeight }]}
          scrollEventThrottle={16}
          onScroll={onScroll}
        >
          <VStack space="md" alignItems="center" w="$full" maxWidth={520}>
            <Heading size="xl">🎉 Spelet är över!</Heading>
            <Text>{gameOverMessage}</Text>
            <Text bold>Highscore: {highscore}</Text>
            <HStack space="md" mt="$2">
              <Button onPress={() => { resetGame(); startFirst(); }}>
                <ButtonText>Börja om</ButtonText>
              </Button>
            </HStack>
          </VStack>
        </AnimatedScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AnimatedScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.container, { paddingTop: headerHeight }]}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        <VStack w="$full" maxWidth={520} alignSelf="center" space="lg">
          <Heading size="xl" textAlign="center">🎵 Single Player</Heading>

          {/* Stats högst upp – syns alltid */}
          <HStack space="md" alignItems="center" justifyContent="center">
            <Text>Streak: {player.timeline.length}</Text>
            <Text>• Highscore: {highscore}</Text>
          </HStack>

          {renderTimeline()}

          {loading && <ActivityIndicator />}
          {error ? <Text color="$error600">{error}</Text> : null}

          {/* FEEDBACK ovanför kortet */}
          {revealed && (
            <Box alignItems="center">
              {wasCorrect ? (
                <Text bold color="$success700" sx={{ _dark: { color: '$success300' } }}>
                  ✅ Rätt gissat{exactHit ? ' (+1 ⭐ för exakt år)' : ''}!
                </Text>
              ) : (
                <Text bold color="$error700" sx={{ _dark: { color: '$error300' } }}>
                  ❌ Fel!
                </Text>
              )}
            </Box>
          )}

          {/* Kortet */}
          {card && (
            <VStack space="md" w="$full" alignItems="center">
              <PreviewCardFront
                ref={previewRef}
                title={card.title}
                artist={card.artist}
                year={revealed ? card.year : undefined}
                artworkUrl={card.artworkUrl}
                previewUrl={card.previewUrl}
                externalUrl={card.externalUrl}
                hideMeta={!revealed}
                blurArtwork={!revealed}
                allowExternalWhenHidden
              />

              {/* Före reveal: gissning/placering */}
              {!revealed && (
                <>
                  <Input w="$full" maxWidth={240} alignSelf="center" isInvalid={guess.length > 0 && !isGuessValid}>
                    <InputField
                      placeholder="Ex: 2012"
                      keyboardType="numeric"
                      value={guess}
                      onChangeText={setGuess}
                      returnKeyType="done"
                      onSubmitEditing={onConfirmPress}
                    />
                  </Input>

                  {showPlacementChoice ? (
                    <VStack space="md" alignItems="center">
                      <Text bold>Året finns redan. Placera före eller efter?</Text>
                      <HStack space="md">
                        <Button variant={placement === 'before' ? 'solid' : 'outline'} onPress={() => setPlacement('before')}>
                          <ButtonText>Före {guess}</ButtonText>
                        </Button>
                        <Button variant={placement === 'after' ? 'solid' : 'outline'} onPress={() => setPlacement('after')}>
                          <ButtonText>Efter {guess}</ButtonText>
                        </Button>
                      </HStack>
                      <Button onPress={onConfirmPlacement} isDisabled={!placement}>
                        <ButtonText>Bekräfta placering</ButtonText>
                      </Button>
                    </VStack>
                  ) : (
                    <>
               {!isGuessValid && guess.length > 0 && (
  <Text color="$error600" textAlign="center">Ogiltigt årtal</Text>
)}
          <HStack
            w="$full"
            space="md"
            justifyContent="center"
            flexWrap="wrap"
            >
           <Button
            onPress={onConfirmPress}
            isDisabled={!isGuessValid}
            style={{ flex: 1, minWidth: '48%' }}   // ⬅ halva bredden, men får wrap:a
            px="$4"
            >
            <ButtonText textAlign="center">Bekräfta gissning</ButtonText>
          </Button>
          <Button
            variant="outline"
            onPress={onSkip}
            isDisabled={player.stars <= 0}
            style={{ flex: 1, minWidth: '48%' }}
            px="$4"
            >
             <ButtonText textAlign="center">Hoppa över (-1 ⭐)</ButtonText>
            </Button>
            </HStack>
                    </>
                  )}
                </>
              )}

              {/* Efter reveal */}
              {revealed && (
                <VStack space="md" alignItems="center">
                  <Button onPress={onContinue}>
                    <ButtonText>Fortsätt</ButtonText>
                  </Button>
                </VStack>
              )}

              {preloading && (
                <Text size="xs" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
                  Förladdar nästa låt…
                </Text>
              )}
            </VStack>
          )}
        </VStack>
      </AnimatedScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    flexGrow: 1,
  },
});
