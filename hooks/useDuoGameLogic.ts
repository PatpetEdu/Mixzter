import { useState, useEffect } from 'react';

// Typerna definieras här för att hooken ska vara fristående
export type Card = {
  title: string;
  artist: string;
  year: number;
  spotifyUrl: string;
  source?: string;
  previewData?: {
    previewUrl: string;
    artworkUrl?: string;
    externalUrl: string;
    previewProvider: 'itunes' | 'deezer';
  };
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
const CURRENT_YEAR = new Date().getFullYear();

// Mappning av game modes till deras årintervall
const GAME_MODE_YEARS: Record<string, { start: number; end: number }> = {
  default: { start: 1950, end: CURRENT_YEAR },
  svenska: { start: 1960, end: CURRENT_YEAR },
  eurovision: { start: 1956, end: CURRENT_YEAR },
  rock: { start: 1960, end: CURRENT_YEAR },
  onehitwonder: { start: 1970, end: 2015 },
  filmmusik: { start: 1950, end: CURRENT_YEAR },
  disney: { start: 1937, end: CURRENT_YEAR },
  melodifestivalen: { start: 1958, end: CURRENT_YEAR },
  kpop: { start: 2000, end: CURRENT_YEAR },
  eightiesnineties: { start: 1980, end: 1999 },
};

// Funktion för att skapa ett startår baserat på game mode
function getRandomYear(gameMode: string = 'default') {
  const years = GAME_MODE_YEARS[gameMode] || GAME_MODE_YEARS['default'];
  return Math.floor(Math.random() * (years.end - years.start + 1)) + years.start;
}

// Props för vår hook
type UseDuoGameLogicProps = {
  player1Name: string;
  player2Name: string;
  gameMode?: string;
  onNewCardNeeded: () => void; // Anropas när ett nytt kort behövs
};

export function useDuoGameLogic({ player1Name, player2Name, gameMode = 'default', onNewCardNeeded }: UseDuoGameLogicProps) {
  const [players, setPlayers] = useState<{ [key: string]: Player }>({
    [player1Name]: { name: player1Name, startYear: getRandomYear(gameMode), timeline: [], cards: [], stars: 1 },
    [player2Name]: { name: player2Name, startYear: getRandomYear(gameMode), timeline: [], cards: [], stars: 1 },
  });
  const [activePlayer, setActivePlayer] = useState(player1Name);
  const [roundCards, setRoundCards] = useState<Card[]>([]);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);
  const [starAwardedThisTurn, setStarAwardedThisTurn] = useState(false);

  // useEffect för att kontrollera om spelet är över
  useEffect(() => {
    const p1Score = players[player1Name].timeline.length + 1; // +1 för startkortet
    const p2Score = players[player2Name].timeline.length + 1; // +1 för startkortet
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

  // NYTT: Möjliggör laddning av sparat spel (hydrering) utifrån DuoGameScreen
 const loadSavedGame = (payload: {
  players: { [key: string]: Player };
  activePlayer: string;
  roundCards?: Card[];
}) => {
  setPlayers(payload.players);
  setActivePlayer(payload.activePlayer);

  const rc = payload.roundCards ?? [];
  setRoundCards(rc);

  // Härled post-guess-läge: om rundan redan har preliminära kort
  // ska "Rätt gissat!"-vyn och knapparna visas igen.
  setWasCorrect(rc.length > 0);

  // Vi nollar bara "stjärna delad denna tur"-flaggan.
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
    
    // 1. Skapa en UNIK tidslinje för beräkningen (tar bort dubbletter)
    // Detta löser problemet om indexering hoppar fel bland dubbletter
    const uniqueTimeline = Array.from(new Set([p.startYear, ...p.timeline, ...roundCards.map((c) => c.year)]))
      .sort((a, b) => a - b);
      
    const guessedYear = parseInt(guess, 10);

    // Om låtens år är en exakt matchning med gissningen är det alltid rätt.
    if (card.year === guessedYear) {
      setWasCorrect(true);
      setRoundCards((prev) => [...prev, card]);
      return;
    }

    let lowerBound = -Infinity;
    let upperBound = Infinity;
    let isCorrect = false;

    // Fall 1: Spelaren gissade ett existerande år och valde en placering (Placement)
    if (placement) {
      const existingYearIndex = uniqueTimeline.indexOf(guessedYear);

      if (placement === 'before') {
        upperBound = guessedYear;
        // Om det finns ett år innan, sätt det som nedre gräns
        if (existingYearIndex > 0) {
          lowerBound = uniqueTimeline[existingYearIndex - 1];
        }
        
      } else {
        // placement === 'after'
        lowerBound = guessedYear;
        // Om det finns ett år efter, sätt det som övre gräns
        if (existingYearIndex < uniqueTimeline.length - 1) {
          upperBound = uniqueTimeline[existingYearIndex + 1];
        }
      }

    } else {
      // Fall 2: Normal gissning (året finns inte på tidslinjen)
      // Vi letar upp vilken lucka gissningen pekar på.
      
      const upperIndex = uniqueTimeline.findIndex((y) => y > guessedYear);
      
      if (upperIndex === -1) {
        // Gissningen är högre än alla existerande år (Sista luckan)
        lowerBound = uniqueTimeline[uniqueTimeline.length - 1];
        // upperBound är redan Infinity
      } else if (upperIndex === 0) {
        // Gissningen är lägre än alla existerande år (Första luckan)
        // lowerBound är redan -Infinity
        upperBound = uniqueTimeline[0];
      } else {
        // Gissningen är mellan två år
        lowerBound = uniqueTimeline[upperIndex - 1];
        upperBound = uniqueTimeline[upperIndex];
      }
    }

    // --- DEN VIKTIGA FIXEN ---
    // Vi använder >= och <= för att tillåta att kortet är samma år som gränserna.
    // Exempel: Luckan är 1972-1978. Kortet är 1972.
    // 1972 >= 1972 (Sant) OCH 1972 <= 1978 (Sant) -> RÄTT!
    isCorrect = card.year >= lowerBound && card.year <= upperBound;

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
    // NYTT
    loadSavedGame,
  };
}