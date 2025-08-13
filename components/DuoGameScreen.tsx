// components/DuoGameScreen.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, View } from 'react-native';
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
} from '@gluestack-ui/themed';
import CardFront from './CardFront';
import CardBack from './CardBack';
import { useGenerateSongs } from './useGenerateSongs';

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
};

const currentYear = new Date().getFullYear();
const WINNING_SCORE = 10;
const MAX_STARS = 5;

function getRandomYear() {
  return Math.floor(Math.random() * (2025 - 1970 + 1)) + 1970;
}

export default function DuoGameScreen({
  player1,
  player2,
  onBackToMenu,
  initialPreloadedCard,
  onPreloadComplete,
}: Props) {
  const { card, setCard, isLoadingCard, errorMessage, generateCard } = useGenerateSongs(
    initialPreloadedCard,
    onPreloadComplete
  );

  const [players, setPlayers] = useState<{ [key: string]: Player }>({
    [player1]: { name: player1, startYear: getRandomYear(), timeline: [], cards: [], stars: 1 },
    [player2]: { name: player2, startYear: getRandomYear(), timeline: [], cards: [], stars: 1 },
  });
  const [activePlayer, setActivePlayer] = useState(player1);
  const [guess, setGuess] = useState('');
  const [guessConfirmed, setGuessConfirmed] = useState(false);
  const [isGuessValid, setIsGuessValid] = useState(true);
  const [roundCards, setRoundCards] = useState<Card[]>([]);
  const [showBack, setShowBack] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);
  const [starAwardedThisTurn, setStarAwardedThisTurn] = useState(false);
  const [isSongInfoVisible, setIsSongInfoVisible] = useState(false);

  const resetInputs = () => {
    setGuess('');
    setGuessConfirmed(false);
    setIsGuessValid(true);
    setShowBack(false);
    setWasCorrect(false);
    setStarAwardedThisTurn(false);
    setIsSongInfoVisible(false);
  };

  useEffect(() => {
    if (!card && !initialPreloadedCard && !gameOverMessage) {
      generateCard(resetInputs);
    }
  }, []);

  useEffect(() => {
    const p1Score = players[player1].timeline.length;
    const p2Score = players[player2].timeline.length;
    if (activePlayer === player1 && (p1Score >= WINNING_SCORE || p2Score >= WINNING_SCORE)) {
      if (p1Score === p2Score) setGameOverMessage('Oavgjort! Båda spelarna har 10 kort.');
      else if (p1Score > p2Score) setGameOverMessage(`${player1} vinner!`);
      else setGameOverMessage(`${player2} vinner!`);
    }
  }, [players, activePlayer, player1, player2]);

  const handleAwardStar = () => {
    setPlayers((prev) => {
      const current = prev[activePlayer];
      if (current.stars < MAX_STARS) {
        return { ...prev, [activePlayer]: { ...current, stars: current.stars + 1 } };
      }
      return prev;
    });
    setStarAwardedThisTurn(true);
  };

  const handleSkipSong = () => {
    const current = players[activePlayer];
    if (current.stars > 0) {
      setPlayers((prev) => ({ ...prev, [activePlayer]: { ...current, stars: current.stars - 1 } }));
      generateCard(resetInputs);
    }
  };

  const handleToggleSongInfo = () => setIsSongInfoVisible((prev) => !prev);

  const handleConfirmGuess = () => {
    const year = parseInt(guess, 10);
    const valid = /^\d{4}$/.test(guess) && year >= 1900 && year <= currentYear;
    setIsGuessValid(valid);
    if (!valid || !card) return;

    const p = players[activePlayer];
    const fullTimeline = [p.startYear, ...p.timeline, ...roundCards.map((c) => c.year)].sort(
      (a, b) => a - b
    );
    const guessedYear = parseInt(guess, 10);

    let lowerBound = -Infinity,
      upperBound = Infinity;
    const upperIndex = fullTimeline.findIndex((y) => y > guessedYear);

    if (upperIndex === -1) {
      lowerBound = fullTimeline[fullTimeline.length - 1];
    } else if (upperIndex === 0) {
      upperBound = fullTimeline[0];
    } else {
      lowerBound = fullTimeline[upperIndex - 1];
      upperBound = fullTimeline[upperIndex];
    }

    const isCorrect = card.year > lowerBound && card.year <= upperBound;

    setGuessConfirmed(true);
    setShowBack(true);
    setWasCorrect(isCorrect);

    if (isCorrect) {
      setRoundCards((prev) => [...prev, card]);
    } else {
      setTimeout(() => {
        setCard(null);
        setRoundCards([]);
        setActivePlayer((prevPlayer) => (prevPlayer === player1 ? player2 : player1));
        resetInputs();
        generateCard(resetInputs);
      }, 3000);
    }
  };

  const handleSave = () => {
    const p = players[activePlayer];
    const updatedPlayer: Player = {
      ...p,
      timeline: [...p.timeline, ...roundCards.map((c) => c.year)].sort((a, b) => a - b),
      cards: [...p.cards, ...roundCards],
    };
    setPlayers((prev) => ({ ...prev, [activePlayer]: updatedPlayer }));
    setRoundCards([]);
    resetInputs();
    setActivePlayer((prev) => (prev === player1 ? player2 : player1));
    generateCard(resetInputs);
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
        // 🔵 Aktiv highlight-stil
      <Box
        borderWidth={1}
        borderRadius="$lg"
        p="$3"
        my="$2"
        w="$full"
        bg={isCurrentPlayer ? "$primary100" : "$backgroundLight100"}
        borderColor={isCurrentPlayer ? "$primary300" : "$borderLight300"}
        sx={{
            _dark: {
                bg: isCurrentPlayer ? "$primary900" : "$backgroundDark800",
                borderColor: isCurrentPlayer ? "$primary700" : "$borderDark700"
            }
        }}
      >
        <HStack justifyContent="space-between" alignItems="center">
          <Text bold fontSize="$lg" color="$textLight900" sx={{_dark: {color: "$textDark100"}}}>
            {player.name}s tidslinje ({finalTimeline.length - 1} kort)
          </Text>
          <Text bold fontSize="$lg" color="$textLight900" sx={{_dark: {color: "$textDark100"}}}>⭐ {player.stars}</Text>
        </HStack>

        <HStack flexWrap="wrap" mt="$2">
          {yearsToDisplay.map((year, idx) => {
            const isPrelim =
              isCurrentPlayer && roundCards.some((c) => c.year === year) && !finalTimeline.includes(year);
            return (
              <Box
                key={`${year}-${idx}`}
                px="$2"
                py="$1"
                mr="$2"
                mb="$2"
                borderRadius="$md"
                bg={isPrelim ? "$primary200" : "$backgroundLight200"}
                sx={{
                    _dark: {
                        bg: isPrelim ? "$primary800" : "$backgroundDark700"
                    }
                }}
              >
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
      <VStack flex={1} px="$5" py="$6" alignItems="center" space="md">
        <Heading size="xl">🎉 Spelet är över! 🎉</Heading>
        <Text fontSize="$lg" color="$primary600" sx={{_dark: {color: "$primary400"}}}>{gameOverMessage}</Text>
        <VStack space="xs" alignItems="center" my="$3">
          <Text>
            {player1}: {players[player1].timeline.length} kort
          </Text>
          <Text>
            {player2}: {players[player2].timeline.length} kort
          </Text>
        </VStack>
        <Button onPress={onBackToMenu}>
          <ButtonText>Tillbaka till menyn</ButtonText>
        </Button>
      </VStack>
    );
  }

  const current = players[activePlayer];
  const canAffordSkip = current.stars > 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
       <Box alignItems="center" mb="$2">
 <Image
  source={MIXZTER_LOGO}
  alt="MIXZTER"
  style={{ width: 96, height: 96, resizeMode: 'contain' }}
/>
</Box>
      <Text fontSize="$lg" mb="$2">Nu spelar: {activePlayer}</Text>

      {renderTimeline(current, true)}
      {renderTimeline(players[player1 === activePlayer ? player2 : player1], false)}

      {isLoadingCard ? (
        <VStack alignItems="center" mt="$4">
          <ActivityIndicator size="large" />
          <Text mt="$2">Genererar kort...</Text>
        </VStack>
      ) : errorMessage ? (
        <Text color="$error600">{errorMessage}</Text>
      ) : !card ? (
        <Button onPress={() => generateCard(resetInputs)}>
          <ButtonText>Starta spelet</ButtonText>
        </Button>
      ) : null}

      {card && !guessConfirmed && !isLoadingCard && (
        <VStack space="md" w="$full">
          <CardFront spotifyUrl={card.spotifyUrl} onFlip={() => {}} showFlipButton={false} />

          {isSongInfoVisible && (
            <Box
              bg="$info100"
              borderColor="$info300"
              sx={{_dark: {bg: "$info900", borderColor: "$info700"}}}
              borderWidth={1}
              borderRadius="$lg"
              p="$3"
            >
              <Text textAlign="center">Artist: {card.artist}</Text>
              <Text textAlign="center">Låt: {card.title}</Text>
              <Text textAlign="center">År: {card.year}</Text>
            </Box>
          )}

          <HStack justifyContent="space-around" w="$full" my="$2">
            <Button onPress={handleSkipSong} isDisabled={!canAffordSkip}>
              <ButtonText>Hoppa över (-1 ⭐)</ButtonText>
            </Button>
            <Button variant="outline" onPress={handleToggleSongInfo}>
              <ButtonText>{isSongInfoVisible ? 'Dölj låtinfo' : 'Visa låtinfo'}</ButtonText>
            </Button>
          </HStack>

          <Input
            w="$full"
            maxWidth={220}
            alignSelf="center"
            variant="outline"
            size="md"
            isInvalid={!isGuessValid}
          >
            <InputField
              placeholder="Ex: 2012"
              keyboardType="numeric"
              value={guess}
              onChangeText={setGuess}
              returnKeyType="done"
              onSubmitEditing={handleConfirmGuess}
            />
          </Input>

          {!isGuessValid && (
            <Text color="$error600" textAlign="center">Årtalet måste vara mellan 1900 och {currentYear}</Text>
          )}
          <Button onPress={handleConfirmGuess}>
            <ButtonText>Bekräfta gissning</ButtonText>
          </Button>
        </VStack>
      )}

      {showBack && card && (
        <VStack space="md" alignItems="center" w="$full">
          <CardBack artist={card.artist} title={card.title} year={String(card.year)} onFlip={() => {}} />
          {wasCorrect ? (
            <VStack alignItems="center" w="$full" mt="$2" space="sm">
              <Text color="$success600" bold>✅ Rätt gissat!</Text>
              <Button onPress={handleAwardStar} isDisabled={starAwardedThisTurn || current.stars >= MAX_STARS}>
                <ButtonText>Ge stjärna (+1)</ButtonText>
              </Button>
              <Button onPress={handleContinue}>
                <ButtonText>Fortsätt</ButtonText>
              </Button>
              <Button onPress={handleSave} variant="outline">
                <ButtonText>Spara & avsluta runda</ButtonText>
              </Button>
            </VStack>
          ) : (
            <Text color="$error600" bold>❌ Fel svar! Nästa spelares tur...</Text>
          )}
        </VStack>
      )}

      <TouchableOpacity onPress={onBackToMenu} style={{ marginTop: 16 }}>
        <Text underline color="$textLight500" sx={{_dark: {color: "$textDark500"}}}>Avsluta till meny</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center', flexGrow: 1, justifyContent: 'flex-start' },
});
