import { useState, useEffect } from 'react';

// Typerna definieras här för att hooken ska vara fristående
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

// Konstanter för spelets regler
const WINNING_SCORE = 10;
const MAX_STARS = 5;

// Funktion för att skapa ett startår
function getRandomYear() {
  return Math.floor(Math.random() * (2025 - 1970 + 1)) + 1970;
}

// Props för vår hook
type UseDuoGameLogicProps = {
  player1Name: string;
  player2Name: string;
  onNewCardNeeded: () => void; // Anropas när ett nytt kort behövs
};

export function useDuoGameLogic({ player1Name, player2Name, onNewCardNeeded }: UseDuoGameLogicProps) {
  const [players, setPlayers] = useState<{ [key: string]: Player }>({
    [player1Name]: { name: player1Name, startYear: getRandomYear(), timeline: [], cards: [], stars: 1 },
    [player2Name]: { name: player2Name, startYear: getRandomYear(), timeline: [], cards: [], stars: 1 },
  });
  const [activePlayer, setActivePlayer] = useState(player1Name);
  const [roundCards, setRoundCards] = useState<Card[]>([]);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);
  const [starAwardedThisTurn, setStarAwardedThisTurn] = useState(false);

    // useEffect för att kontrollera om spelet är över
  useEffect(() => {
    const p1Score = players[player1Name].timeline.length;
    const p2Score = players[player2Name].timeline.length;
    if (activePlayer === player1Name && (p1Score >= WINNING_SCORE || p2Score >= WINNING_SCORE)) {
      if (p1Score === p2Score) setGameOverMessage('Oavgjort! Båda spelarna har 10 kort.');
      else if (p1Score > p2Score) setGameOverMessage(`${player1Name} vinner!`);
      else setGameOverMessage(`${player2Name} vinner!`);
    }
  }, [players, activePlayer, player1Name, player2Name]);
  
    // Funktion för att återställa state som är specifik för en runda

  const resetTurnState = () => {
      setWasCorrect(false);
      setStarAwardedThisTurn(false);
  };

    // Logik för att ge en stjärna

  const awardStar = () => {
    setPlayers((prev) => {
      const current = prev[activePlayer];
      if (current.stars < MAX_STARS) {
        return { ...prev, [activePlayer]: { ...current, stars: current.stars + 1 } };
      }
      return prev;
    });
    setStarAwardedThisTurn(true);
  };

    // Logik för att hoppa över en låt
  const skipSong = () => {
    const current = players[activePlayer];
    if (current.stars > 0) {
      setPlayers((prev) => ({ ...prev, [activePlayer]: { ...current, stars: current.stars - 1 } }));
      onNewCardNeeded();
    }
  };

    // Logik för att bekräfta en gissning
  const confirmGuess = (guess: string, card: Card, placement?: 'before' | 'after') => {
    const p = players[activePlayer];
    const fullTimeline = [p.startYear, ...p.timeline, ...roundCards.map((c) => c.year)].sort((a, b) => a - b);
    const guessedYear = parseInt(guess, 10);

    // Om låtens år är en exakt matchning är det alltid rätt.
    if (card.year === guessedYear) {
        setWasCorrect(true);
        setRoundCards((prev) => [...prev, card]);
        return;
    }

    let lowerBound = -Infinity;
    let upperBound = Infinity;
    let isCorrect = false;

    // Fall 1: Spelaren gissade ett existerande år och valde en placering
    if (placement) {
        const existingYearIndex = fullTimeline.indexOf(guessedYear);

        if (placement === 'before') {
            upperBound = guessedYear;
            if (existingYearIndex > 0) {
                lowerBound = fullTimeline[existingYearIndex - 1];
            }
            // Kortet måste passa i luckan FÖRE det gissade året
            isCorrect = card.year > lowerBound && card.year < upperBound;

        } else { // placement === 'after'
            lowerBound = guessedYear;
            if (existingYearIndex < fullTimeline.length - 1) {
                upperBound = fullTimeline[existingYearIndex + 1];
            }
            // Kortet måste passa i luckan EFTER det gissade året
            isCorrect = card.year > lowerBound && card.year < upperBound;
        }
    } else { // Fall 2: Normal gissning (året finns inte på tidslinjen)
        const upperIndex = fullTimeline.findIndex((y) => y > guessedYear);
        if (upperIndex === -1) { // Gissningen är högst
            lowerBound = fullTimeline[fullTimeline.length - 1];
        } else if (upperIndex === 0) { // Gissningen är lägst
            upperBound = fullTimeline[0];
        } else {
            lowerBound = fullTimeline[upperIndex - 1];
            upperBound = fullTimeline[upperIndex];
        }
        // Kortet måste vara efter föregående år, upp till och med nästa år
        isCorrect = card.year > lowerBound && card.year <= upperBound;
    }

    setWasCorrect(isCorrect);

    if (isCorrect) {
        setRoundCards((prev) => [...prev, card]);
    }
    // Ingen automatisk timer här längre. Komponenten styr när turen ska bytas.

  };

    // Ny funktion för att byta spelare, som komponenten kan anropa

  const switchPlayerTurn = () => {
    setRoundCards([]);
    setActivePlayer((prevPlayer) => (prevPlayer === player1Name ? player2Name : player1Name));
    onNewCardNeeded();
  };

    // Logik för att spara och byta tur

  const saveAndEndTurn = () => {
    const p = players[activePlayer];
    const updatedPlayer: Player = {
      ...p,
      timeline: [...p.timeline, ...roundCards.map((c) => c.year)].sort((a, b) => a - b),
      cards: [...p.cards, ...roundCards],
    };
    setPlayers((prev) => ({ ...prev, [activePlayer]: updatedPlayer }));
        // Anropar den nya switch-funktionen för att hålla logiken samlad

    switchPlayerTurn();
  };

    // Exponerar state och funktioner som komponenten behöver

  return {
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
  };
}
