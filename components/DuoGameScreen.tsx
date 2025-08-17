import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Animated, KeyboardAvoidingView, Platform  } from 'react-native';
import {
  Box,
  Text,
  Heading,
  Button,
  ButtonText,
  VStack,
  HStack,
  Input,
  InputField,
  Image,
  Center,
} from '@gluestack-ui/themed';
import CardFront from './CardFront';
import CardBack from './CardBack';
import { useGenerateSongs } from './useGenerateSongs';
import { useDuoGameLogic } from '../hooks/useDuoGameLogic';
import InGameMenu from './InGameMenu'; // Importera den nya komponenten


const MIXZTER_LOGO = require('../assets/mixzter-icon-1024.png');
// Typer
export type Card = {
  title: string;
  artist: string;
  year: number;
  spotifyUrl: string;
};

type Player = {
  name: string;
  timeline: number[];
  cards: Card[];
  startYear: number;
  stars: number;
};

type Props = {
  player1: string;
  player2: string;
  onBackToMenu: () => void;
  initialPreloadedCard: Card | null;
  onPreloadComplete: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  headerHeight: number;
};

const currentYear = new Date().getFullYear();
const MAX_STARS = 5;
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function DuoGameScreen({
  player1,
  player2,
  initialPreloadedCard,
  onPreloadComplete,
  onScroll,
  headerHeight,
}: Props) {
  const { card, setCard, isLoadingCard, errorMessage, generateCard } = useGenerateSongs(
    initialPreloadedCard,
    onPreloadComplete
  );
  const [guess, setGuess] = useState('');
  const [guessConfirmed, setGuessConfirmed] = useState(false);
  const [isGuessValid, setIsGuessValid] = useState(true);
  const [showBack, setShowBack] = useState(false);
  const [isSongInfoVisible, setIsSongInfoVisible] = useState(false);
  
  // Ny state för "Före/Efter"-logiken
  const [showPlacementChoice, setShowPlacementChoice] = useState(false);
  const [placement, setPlacement] = useState<'before' | 'after' | null>(null);

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
  } = useDuoGameLogic({
    player1Name: player1,
    player2Name: player2,
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
    setShowPlacementChoice(false); // Återställ nya staten
    setPlacement(null);
    resetTurnState();
  }, [resetTurnState]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!card && !initialPreloadedCard && !gameOverMessage) {
      generateCard(resetInputs);
    }
  }, []);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (showBack && !wasCorrect) {
      timerId = setTimeout(() => {
        switchPlayerTurn();
      }, 60000);
    }
    return () => {
      clearTimeout(timerId);
    };
  }, [showBack, wasCorrect, switchPlayerTurn]);

  const handleAwardStar = () => awardStar();
  const handleSkipSong = () => skipSong();
  const handleToggleSongInfo = () => setIsSongInfoVisible((prev) => !prev);
  const handleSave = () => saveAndEndTurn();
  
  const handleConfirmGuess = () => {
    const year = parseInt(guess, 10);
    const valid = /^\d{4}$/.test(guess) && year >= 1900 && year <= currentYear;
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
    const yearsToDisplay = [...finalTimeline, ...roundTimeline].sort((a, b) => a - b);
    return (
      <Box borderWidth={1} borderRadius="$lg" p="$3" my="$2" w="$full" bg={isCurrentPlayer ? "$primary100" : "$backgroundLight100"} borderColor={isCurrentPlayer ? "$primary300" : "$borderLight300"} sx={{ _dark: { bg: isCurrentPlayer ? "$primary900" : "$backgroundDark800", borderColor: isCurrentPlayer ? "$primary700" : "$borderDark700" } }}>
        <HStack justifyContent="space-between" alignItems="center">
          <Text bold fontSize="$lg" color="$textLight900" sx={{_dark: {color: "$textDark100"}}}>{player.name}s tidslinje ({finalTimeline.length - 1} kort)</Text>
          <Text bold fontSize="$lg" color="$textLight900" sx={{_dark: {color: "$textDark100"}}}>⭐ {player.stars}</Text>
        </HStack>
        <HStack flexWrap="wrap" mt="$2">
          {yearsToDisplay.map((year, idx) => {
            const isPrelim = isCurrentPlayer && roundCards.some((c) => c.year === year) && !finalTimeline.includes(year);
            return (
              <Box key={`${year}-${idx}`} px="$2" py="$1" mr="$2" mb="$2" borderRadius="$md" bg={isPrelim ? "$primary200" : "$backgroundLight200"} sx={{ _dark: { bg: isPrelim ? "$primary800" : "$backgroundDark700" } }}>
                <Text color="$textLight700" sx={{_dark: {color: "$textDark300"}}}>{String(year)}</Text>
              </Box>
            );
          })}
        </HStack>
      </Box>
    );
  };

  if (gameOverMessage) {
    return (
      <Center flex={1} px="$4">
        <VStack alignItems="center" space="md">
            <Heading size="xl">🎉 Spelet är över! 🎉</Heading>
            <Text fontSize="$lg" color="$primary600" sx={{_dark: {color: "$primary400"}}}>{gameOverMessage}</Text>
            <VStack space="xs" alignItems="center" my="$3">
              <Text>{player1}: {players[player1].timeline.length} kort</Text>
              <Text>{player2}: {players[player2].timeline.length} kort</Text>
            </VStack>
        </VStack>
      </Center>
    );
  }

  const current = players[activePlayer];
  const canAffordSkip = current.stars > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AnimatedScrollView
        contentContainerStyle={[styles.container, { paddingTop: headerHeight }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Box alignItems="center" mb="$2"><Image source={MIXZTER_LOGO} alt="MIXZTER" style={{ width: 96, height: 96, resizeMode: 'contain' }} /></Box>
        <Text fontSize="$lg" mb="$2">Nu spelar: {activePlayer}</Text>
        {renderTimeline(current, true)}
        {renderTimeline(players[player1 === activePlayer ? player2 : player1], false)}
        {isLoadingCard ? (<VStack alignItems="center" mt="$4"><ActivityIndicator size="large" /><Text mt="$2">Genererar kort...</Text></VStack>) : errorMessage ? (<Text color="$error600">{errorMessage}</Text>) : !card ? (<Button onPress={() => generateCard(resetInputs)}><ButtonText>Starta spelet</ButtonText></Button>) : null}
        
        {card && !guessConfirmed && !isLoadingCard && (
          <VStack space="md" w="$full">
            <CardFront spotifyUrl={card.spotifyUrl} onFlip={() => {}} showFlipButton={false} />
            {isSongInfoVisible && (
              <Box bg="$info100" borderColor="$info300" sx={{_dark: {bg: "$info900", borderColor: "$info700"}}} borderWidth={1} borderRadius="$lg" p="$3">
                <Text textAlign="center">Artist: {card.artist}</Text>
                <Text textAlign="center">Låt: {card.title}</Text>
                <Text textAlign="center">År: {card.year}</Text>
              </Box>
            )}
            <HStack justifyContent="space-around" w="$full" my="$2">
              <Button onPress={handleSkipSong} isDisabled={!canAffordSkip}><ButtonText>Hoppa över (-1 ⭐)</ButtonText></Button>
              <Button variant="outline" onPress={handleToggleSongInfo}><ButtonText>{isSongInfoVisible ? 'Dölj låtinfo' : 'Visa låtinfo'}</ButtonText></Button>
            </HStack>
            
            {showPlacementChoice ? (
              <VStack space="md" alignItems="center">
                <Text bold>Året finns redan. Placera kortet före eller efter?</Text>
                <HStack space="md">
                  <Button variant={placement === 'before' ? 'solid' : 'outline'} onPress={() => setPlacement('before')}><ButtonText>Före {guess}</ButtonText></Button>
                  <Button variant={placement === 'after' ? 'solid' : 'outline'} onPress={() => setPlacement('after')}><ButtonText>Efter {guess}</ButtonText></Button>
                </HStack>
                <Button onPress={handlePlacementConfirm} isDisabled={!placement}><ButtonText>Bekräfta placering</ButtonText></Button>
              </VStack>
            ) : (
              <>
                <Input w="$full" maxWidth={220} alignSelf="center" isInvalid={!isGuessValid}>
                  <InputField placeholder="Ex: 2012" keyboardType="numeric" value={guess} onChangeText={setGuess} returnKeyType="done" onSubmitEditing={handleConfirmGuess} />
                </Input>
                {!isGuessValid && (<Text color="$error600" textAlign="center">Ogiltigt årtal</Text>)}
                <Button onPress={handleConfirmGuess}><ButtonText>Bekräfta gissning</ButtonText></Button>
              </>
            )}
          </VStack>
        )}
        
        {showBack && card && (
          <VStack space="md" alignItems="center" w="$full">
            <CardBack artist={card.artist} title={card.title} year={String(card.year)} onFlip={() => {}} />
            {wasCorrect ? (
              <VStack alignItems="center" w="$full" mt="$2" space="sm">
                <Text color="$success600" bold>✅ Rätt gissat!</Text>
                <Button onPress={handleAwardStar} isDisabled={starAwardedThisTurn || current.stars >= MAX_STARS}><ButtonText>Ge stjärna (+1)</ButtonText></Button>
                <Button onPress={handleContinue}><ButtonText>Fortsätt</ButtonText></Button>
                <Button variant="outline" onPress={handleSave}><ButtonText>Spara & avsluta runda</ButtonText></Button>
              </VStack>
            ) : (
              <VStack alignItems="center" w="$full" mt="$2" space="sm">
                <Text color="$error600" bold>❌ Fel svar! Nästa spelares tur...</Text>
                <Button action="negative" onPress={switchPlayerTurn}><ButtonText>Klar</ButtonText></Button>
              </VStack>
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
