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

  function getRandomYear() {
    return Math.floor(Math.random() * (2025 - 1970 + 1)) + 1970;
  }

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

    // 🔵 Aktiv highlight-stil
    const baseStyle = {
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 10,
      padding: 12,
      marginVertical: 8,
      width: '100%',
      backgroundColor: '#fff',
    } as const;

    const activeStyle = isCurrentPlayer
      ? { borderColor: '#3b82f6', backgroundColor: '#eff6ff' } // blå border + ljusblå bakgrund
      : null;

    return (
      <Box style={{ ...baseStyle, ...(activeStyle || {}) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#111827' }}>
            {player.name}s tidslinje ({finalTimeline.length - 1} kort)
          </Text>
          <Text style={{ fontWeight: 'bold', fontSize: 18 }}>⭐ {player.stars}</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {yearsToDisplay.map((year, idx) => {
            const isPrelim =
              isCurrentPlayer && roundCards.some((c) => c.year === year) && !finalTimeline.includes(year);
            return (
              <View
                key={`${year}-${idx}`}
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  marginRight: 8,
                  marginBottom: 8,
                  borderRadius: 6,
                  backgroundColor: isPrelim ? '#eef2ff' : '#e5e7eb',
                }}
              >
                <Text style={{ color: '#374151' }}>{String(year)}</Text>
              </View>
            );
          })}
        </View>
      </Box>
    );
  };

  if (gameOverMessage) {
    return (
      <VStack style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center' }} space="md">
        <Heading size="xl">🎉 Spelet är över! 🎉</Heading>
        <Text style={{ fontSize: 18, color: '#2563eb' }}>{gameOverMessage}</Text>
        <VStack space="xs" style={{ alignItems: 'center', marginVertical: 12 }}>
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
      <Text style={{ fontSize: 16, marginBottom: 8 }}>Nu spelar: {activePlayer}</Text>

      {renderTimeline(current, true)}
      {renderTimeline(players[player1 === activePlayer ? player2 : player1], false)}

      {isLoadingCard ? (
        <VStack style={{ alignItems: 'center', marginTop: 16 }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>Genererar kort...</Text>
        </VStack>
      ) : errorMessage ? (
        <Text style={{ color: '#dc2626' }}>{errorMessage}</Text>
      ) : !card ? (
        <Button onPress={() => generateCard(resetInputs)}>
          <ButtonText>Starta spelet</ButtonText>
        </Button>
      ) : null}

      {card && !guessConfirmed && !isLoadingCard && (
        <VStack space="md" style={{ width: '100%' }}>
          <CardFront spotifyUrl={card.spotifyUrl} onFlip={() => {}} showFlipButton={false} />

          {isSongInfoVisible && (
            <Box
              style={{
                backgroundColor: '#eef2ff',
                borderColor: '#c7d2fe',
                borderWidth: 1,
                borderRadius: 8,
                padding: 10,
              }}
            >
              <Text style={{ textAlign: 'center' }}>Artist: {card.artist}</Text>
              <Text style={{ textAlign: 'center' }}>Låt: {card.title}</Text>
              <Text style={{ textAlign: 'center' }}>Låt: {card.year}</Text>
            </Box>
          )}

          <HStack style={{ justifyContent: 'space-around', width: '100%', marginVertical: 8 }}>
            <Button onPress={handleSkipSong} isDisabled={!canAffordSkip}>
              <ButtonText>Hoppa över (-1 ⭐)</ButtonText>
            </Button>
            <Button variant="outline" onPress={handleToggleSongInfo}>
              <ButtonText>{isSongInfoVisible ? 'Dölj låtinfo' : 'Visa låtinfo'}</ButtonText>
            </Button>
          </HStack>

          {/* 🆕 Gluestack Input i stället för RN TextInput */}
          <Input
            w="$full"
            maxWidth={220}
            alignSelf="center" 
            variant="outline"
            size="md"
            // röd kant när ogiltigt
            style={isGuessValid ? undefined : { borderColor: '#dc2626' }}
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
            <Text style={{ color: '#dc2626' }}>Årtalet måste vara mellan 1900 och {currentYear}</Text>
          )}
          <Button onPress={handleConfirmGuess}>
            <ButtonText>Bekräfta gissning</ButtonText>
          </Button>
        </VStack>
      )}

      {showBack && card && (
        <VStack space="md" style={{ alignItems: 'center', width: '100%' }}>
          <CardBack artist={card.artist} title={card.title} year={String(card.year)} onFlip={() => {}} />
          {wasCorrect ? (
            <VStack style={{ alignItems: 'center', width: '100%', marginTop: 8 }} space="sm">
              <Text style={{ color: 'green', fontWeight: 'bold' }}>✅ Rätt gissat!</Text>
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
            <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>❌ Fel svar! Nästa spelares tur...</Text>
          )}
        </VStack>
      )}

      <TouchableOpacity onPress={onBackToMenu} style={{ marginTop: 16 }}>
        <Text style={{ textDecorationLine: 'underline', color: '#6b7280' }}>Avsluta till meny</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center', flexGrow: 1, justifyContent: 'flex-start' },
});
