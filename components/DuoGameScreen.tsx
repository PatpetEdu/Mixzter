import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import CardFront from './CardFront';
import CardBack from './CardBack';
import { useGenerateSongs } from './useGenerateSongs';

// Typer
type Card = {
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

export default function DuoGameScreen({ player1, player2, onBackToMenu, initialPreloadedCard, onPreloadComplete }: Props) {
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
      if (p1Score === p2Score) setGameOverMessage("Oavgjort! Båda spelarna har 10 kort.");
      else if (p1Score > p2Score) setGameOverMessage(`${player1} vinner!`);
      else setGameOverMessage(`${player2} vinner!`);
    }
  }, [players, activePlayer, player1, player2]);

  function getRandomYear() {
    return Math.floor(Math.random() * (2025 - 1970 + 1)) + 1970;
  }

  const handleAwardStar = () => {
    setPlayers(prevPlayers => {
      const currentPlayer = prevPlayers[activePlayer];
      if (currentPlayer.stars < MAX_STARS) {
        return { ...prevPlayers, [activePlayer]: { ...currentPlayer, stars: currentPlayer.stars + 1 } };
      }
      return prevPlayers;
    });
    setStarAwardedThisTurn(true);
  };

  const handleSkipSong = () => {
    const currentPlayer = players[activePlayer];
    if (currentPlayer.stars > 0) {
      setPlayers(prevPlayers => ({ ...prevPlayers, [activePlayer]: { ...currentPlayer, stars: currentPlayer.stars - 1 } }));
      generateCard(resetInputs);
    }
  };

  const handleToggleSongInfo = () => {
    setIsSongInfoVisible(prev => !prev);
  };

  const handleConfirmGuess = () => {
    const year = parseInt(guess, 10);
    const valid = /^\d{4}$/.test(guess) && year >= 1900 && year <= currentYear;
    setIsGuessValid(valid);
    if (!valid || !card) return;

    const p = players[activePlayer];
    const fullTimeline = [p.startYear, ...p.timeline, ...roundCards.map(c => c.year)].sort((a, b) => a - b);
    const guessedYear = parseInt(guess, 10);

    // --- NY, FÖRENKLAD OCH KORRIGERAD GISSNINGSLOGIK ---
    let lowerBound = -Infinity, upperBound = Infinity;
    
    // Hitta den första platsen på tidslinjen där ett år är STÖRRE än det gissade året.
    const upperIndex = fullTimeline.findIndex(y => y > guessedYear);

    if (upperIndex === -1) {
      // Gissningen är högre än alla år på tidslinjen.
      lowerBound = fullTimeline[fullTimeline.length - 1];
    } else if (upperIndex === 0) {
      // Gissningen är lägre än alla år på tidslinjen.
      upperBound = fullTimeline[0];
    } else {
      // Gissningen är mellan två år.
      lowerBound = fullTimeline[upperIndex - 1];
      upperBound = fullTimeline[upperIndex];
    }
    
    // Gissningen är korrekt om det faktiska året faller inom den lucka som gissningen skapade.
    // Vi inkluderar den övre gränsen (<=) för att hantera fall där kortets år är exakt samma som ett befintligt år.
    const isCorrect = (card.year > lowerBound && card.year <= upperBound);
    // --- SLUT PÅ NY LOGIK ---
    
    setGuessConfirmed(true);
    setShowBack(true);
    setWasCorrect(isCorrect);

    if (isCorrect) {
      setRoundCards(prev => [...prev, card]);
    } else {
      setTimeout(() => {
        setCard(null);
        setRoundCards([]);
        setActivePlayer(prevPlayer => prevPlayer === player1 ? player2 : player1);
        resetInputs();
        generateCard(resetInputs);
      }, 3000);
    }
  };

  const handleSave = () => {
    const p = players[activePlayer];
    const updatedPlayer: Player = {
      ...p,
      timeline: [...p.timeline, ...roundCards.map(c => c.year)].sort((a, b) => a - b),
      cards: [...p.cards, ...roundCards],
    };
    setPlayers(prevPlayers => ({ ...prevPlayers, [activePlayer]: updatedPlayer }));
    setRoundCards([]);
    resetInputs();
    setActivePlayer(prevPlayer => prevPlayer === player1 ? player2 : player1);
    generateCard(resetInputs);
  };

  const handleContinue = () => {
    resetInputs();
    generateCard(resetInputs);
  };

  const renderTimeline = (player: Player, isCurrentPlayer: boolean) => {
    const finalTimeline = [player.startYear, ...player.timeline];
    const roundTimeline = isCurrentPlayer ? roundCards.map(c => c.year) : [];
    const yearsToDisplay = [...finalTimeline, ...roundTimeline].sort((a, b) => a - b);
    
    return (
      <View style={[styles.timelineBox, isCurrentPlayer && styles.activeTimeline]}>
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle}>{player.name}s tidslinje ({finalTimeline.length -1} kort)</Text>
          <Text style={styles.starCount}>⭐ {player.stars}</Text>
        </View>
        <View style={styles.timelineRow}>
          {yearsToDisplay.map((year, idx) => {
            const isPrelim = isCurrentPlayer && roundCards.some(c => c.year === year) && !finalTimeline.includes(year);
            return <Text key={`${year}-${idx}`} style={[styles.yearItem, isPrelim && styles.prelimYear]}>{String(year)}</Text>;
          })}
        </View>
      </View>
    );
  };

  if (gameOverMessage) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🎉 Spelet är över! 🎉</Text>
        <Text style={styles.gameOverMessage}>{gameOverMessage}</Text>
        <View style={styles.finalScores}>
            <Text style={styles.finalScoreText}>{player1}: {players[player1].timeline.length} kort</Text>
            <Text style={styles.finalScoreText}>{player2}: {players[player2].timeline.length} kort</Text>
        </View>
        <Button title="Tillbaka till menyn" onPress={onBackToMenu} />
      </View>
    );
  }

  const current = players[activePlayer];
  const canAffordSkip = current.stars > 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🎯 Duo-läge</Text>
      <Text style={styles.subtitle}>Nu spelar: {activePlayer}</Text>
      {renderTimeline(current, true)}
      {renderTimeline(players[player1 === activePlayer ? player2 : player1], false)}
      {isLoadingCard ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#007AFF" /><Text style={styles.loadingText}>Genererar kort...</Text></View>
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : !card && (
        <Button title="Starta spelet" onPress={() => generateCard(resetInputs)} />
      )}
      {card && !guessConfirmed && !isLoadingCard && (
        <View>
          <CardFront spotifyUrl={card.spotifyUrl} onFlip={() => {}} showFlipButton={false} />
          
          {isSongInfoVisible && (
            <View style={styles.songInfoReveal}>
                <Text style={styles.songInfoText}>Artist: {card.artist}</Text>
                <Text style={styles.songInfoText}>Låt: {card.title}</Text>
            </View>
          )}

          <View style={styles.preGuessActions}>
            <TouchableOpacity onPress={handleSkipSong} disabled={!canAffordSkip} style={[styles.actionButton, !canAffordSkip && styles.disabledButton]}>
              <Text style={styles.actionButtonText}>Hoppa över (-1 ⭐)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToggleSongInfo} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>
                {isSongInfoVisible ? 'Dölj låtinfo' : 'Visa låtinfo'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <TextInput style={[styles.input, !isGuessValid && styles.inputError]} placeholder="Ex: 2012" keyboardType="numeric" value={guess} onChangeText={setGuess} />
          {!isGuessValid && <Text style={styles.errorText}>Årtalet måste vara mellan 1900 och {currentYear}</Text>}
          <Button title="Bekräfta gissning" onPress={handleConfirmGuess} />
        </View>
      )}
      {showBack && card && (
        <>
          <CardBack artist={card.artist} title={card.title} year={String(card.year)} onFlip={() => {}} />
          {wasCorrect ? (
            <View style={styles.postGuessActions}>
              <Text style={styles.correctText}>✅ Rätt gissat!</Text>
              <Button 
                title="Ge stjärna (+1)" 
                onPress={handleAwardStar} 
                disabled={starAwardedThisTurn || current.stars >= MAX_STARS}
              />
              <View style={{ height: 10 }} />
              <Button title="Fortsätt" onPress={handleContinue} />
              <View style={{ height: 10 }} />
              <Button title="Spara & avsluta runda" onPress={handleSave} />
            </View>
          ) : (
            <Text style={styles.incorrectText}>❌ Fel svar! Nästa spelares tur...</Text>
          )}
        </>
      )}
      <TouchableOpacity onPress={onBackToMenu} style={styles.menuButton}><Text style={styles.menuText}>Avsluta till meny</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', alignItems: 'center', flexGrow: 1, justifyContent: 'flex-start' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 20, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12, width: 200, textAlign: 'center', alignSelf: 'center', marginVertical: 8, fontSize: 18 },
  inputError: { borderColor: 'red' },
  errorText: { color: 'red', marginBottom: 8, textAlign: 'center' },
  timelineBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginVertical: 10, width: '100%', backgroundColor: '#f9f9f9' },
  activeTimeline: { borderColor: '#007AFF', backgroundColor: '#e6f2ff' },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineTitle: { fontWeight: 'bold', fontSize: 18, color: '#333' },
  starCount: { fontWeight: 'bold', fontSize: 18, color: '#FFD700' },
  timelineRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  yearItem: { fontSize: 16, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#e0e0e0', borderRadius: 5, color: '#444', marginRight: 8, marginBottom: 8 },
  prelimYear: { backgroundColor: '#ffebcd', color: '#8b4513', fontWeight: 'bold' },
  menuButton: { marginTop: 'auto', paddingTop: 20 },
  menuText: { color: '#555', fontSize: 14, textDecorationLine: 'underline' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 20, minHeight: 150 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  correctText: { color: 'green', fontSize: 18, fontWeight: 'bold', marginVertical: 10, textAlign: 'center' },
  incorrectText: { color: 'red', fontSize: 18, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },
  gameOverMessage: { fontSize: 22, fontWeight: 'bold', color: '#007AFF', textAlign: 'center', marginVertical: 20 },
  finalScores: { marginVertical: 20, alignItems: 'center' },
  finalScoreText: { fontSize: 18, marginVertical: 4 },
  postGuessActions: { alignItems: 'center', width: '100%', marginTop: 10 },
  preGuessActions: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 8 },
  actionButton: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 },
  actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  disabledButton: { backgroundColor: '#ccc' },
  songInfoReveal: { backgroundColor: '#eef', borderColor: '#ccd', borderWidth: 1, borderRadius: 8, padding: 10, marginVertical: 10 },
  songInfoText: { fontSize: 16, textAlign: 'center' },
});
