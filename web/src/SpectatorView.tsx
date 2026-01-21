import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import './SpectatorView.css';
import type { Game, Card, Player } from './types';

interface SpectatorViewProps {
  gameId: string;
  token: string;
}

interface PlayerStats {
  name: string;
  timeline: number[];
  startYear?: number;
  score: number;
  stars: number;
  cards?: Card[];
}

export function SpectatorView({ gameId, token }: SpectatorViewProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<{ [key: string]: Player }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [carouselCards, setCarouselCards] = useState<Card[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [lastPlayedSong, setLastPlayedSong] = useState<Card | null>(null);

  useEffect(() => {
    // Lyssnare på game-dokumentet
    const unsubscribeGame = onSnapshot(
      doc(db, 'games', gameId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Game;
          setGame(data);
          // Hämta spelarna från game.players objektet
          if (data.players) {
            setPlayers(data.players);
            console.log('Players loaded from game.players:', data.players);
          }
          setError(null);
        } else {
          setError('Spelet hittades inte');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching game:', err);
        setError('Kunde inte ansluta till spelet');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeGame();
    };
  }, [gameId, token]);

  // Spåra när en ny låt har spelats
  useEffect(() => {
    if (game?.gameState?.backCardUnlocked && game?.currentCard) {
      setLastPlayedSong(game.currentCard);
    }
  }, [game?.gameState?.backCardUnlocked, game?.currentCard]);

  const handleYearPress = (playerName: string, year: number) => {
    const allCards = [
      ...(game?.roundCards?.filter(c => c.year === year) || []),
      ...(players[playerName]?.cards?.filter(c => c.year === year) || []),
    ];

    if (allCards.length > 0) {
      setCarouselCards(allCards);
      setCarouselIndex(0);
      setSelectedCard(allCards[0]);
      setShowCardModal(true);
    }
  };

  const handlePrevCard = () => {
    const newIndex = carouselIndex === 0 ? carouselCards.length - 1 : carouselIndex - 1;
    setCarouselIndex(newIndex);
    setSelectedCard(carouselCards[newIndex]);
  };

  const handleNextCard = () => {
    const newIndex = carouselIndex === carouselCards.length - 1 ? 0 : carouselIndex + 1;
    setCarouselIndex(newIndex);
    setSelectedCard(carouselCards[newIndex]);
  };

  const playerStats: PlayerStats[] = Object.entries(players).map(([name, data]) => ({
    name,
    timeline: data.timeline || [],
    startYear: data.startYear,
    score: 1 + (data.timeline?.length || 0),
    stars: data.stars || 0,
    cards: data.cards,
  }));

  console.log('playerStats:', playerStats);
  console.log('players object:', players);
  console.log('Object.entries(players):', Object.entries(players));

  const activePlayerName = game?.gameState?.activePlayer;
  const firstPlayerName = playerStats.length > 0 ? playerStats[0].name : null;

  if (loading) {
    return (
      <div className="spectator-container loading">
        <div className="spinner"></div>
        <p>Ansluter till spelet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="spectator-container error">
        <h1>⚠️ Fel</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="spectator-container">
        <p>Spelet kunde inte laddas</p>
      </div>
    );
  }

  return (
    <div className="spectator-container">
      {/* Header */}
      <div className="spectator-header">
        <div className="header-logo">🎵</div>
        <p className="game-code">Spel: {game.gameCode}</p>
      </div>

      <div className="spectator-content">
        {/* Timeline Section */}
        {playerStats.length > 0 && (
          <div className="timeline-section">
            <h2 className="section-title">TIMELINE</h2>
            {playerStats.map((player, idx) => {
              const roundCardsForPlayer = activePlayerName === player.name ? (game?.roundCards || []) : [];
              
              const baseYears = player.startYear ? [player.startYear] : [];
              const allYearsSet = new Set([...baseYears, ...player.timeline, ...roundCardsForPlayer.map(c => c.year)]);
              const allYears = Array.from(allYearsSet).sort((a, b) => a - b);
              
              const isFirstPlayer = player.name === firstPlayerName;
              const isActive = activePlayerName === player.name;

              return (
                <div
                  key={idx}
                  className={`player-timeline ${isActive ? 'active' : ''}`}
                >
                  <div className="player-header">
                    {isActive && <div className="active-indicator"></div>}
                    <div className="player-info">
                      <div className="player-name">
                        {isFirstPlayer && '♔ '}{player.name}
                      </div>
                      <div className="player-meta">
                        {player.score} song{player.score !== 1 ? 's' : ''} • ⭐ {player.stars}
                      </div>
                    </div>
                  </div>

                  {allYears.length > 0 && (
                    <div className="years-container">
                      {allYears.map((year, i) => {
                        const isStartYear = year === player.startYear;
                        const isPrelim = roundCardsForPlayer.some(c => c.year === year);
                        const isEarned = player.timeline.includes(year);
                        
                        return (
                          <button
                            key={i}
                            className={`year-badge ${isPrelim && !isEarned ? 'preliminary' : isStartYear ? 'start' : 'earned'}`}
                            onClick={() => handleYearPress(player.name, year)}
                          >
                            {isStartYear && '📍 '}
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Scores Section */}
        {playerStats.length > 0 && (
          <div className="scores-section">
            <h2 className="section-title">SCORES</h2>
            <div className="scores-grid">
              {playerStats.map((player, idx) => (
                <div
                  key={idx}
                  className={`score-card ${activePlayerName === player.name ? 'active' : ''}`}
                >
                  <div className="score-player-name">{player.name}</div>
                  <div className="score-value">{player.score}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Song */}
        {lastPlayedSong && (
          <div className="latest-song-section">
            <h2 className="section-title">LATEST SONG PLAYED</h2>
            <div className="latest-song-card">
              <div className="song-title">{lastPlayedSong.title}</div>
              <div className="song-artist">{lastPlayedSong.artist}</div>
            </div>
          </div>
        )}
      </div>

      {/* Card Modal */}
      {showCardModal && selectedCard && (
        <div className="modal-overlay" onClick={() => setShowCardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-year">{selectedCard.year}</div>
            <div className="modal-song-info">
              <div className="modal-title">{selectedCard.title}</div>
              <div className="modal-artist">{selectedCard.artist}</div>
            </div>

            {carouselCards.length > 1 && (
              <div className="modal-carousel">
                <button className="carousel-btn" onClick={handlePrevCard}>
                  ← Prev
                </button>
                <span className="carousel-counter">
                  {carouselIndex + 1} / {carouselCards.length}
                </span>
                <button className="carousel-btn" onClick={handleNextCard}>
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="spectator-footer">
        <p>Direktsänd spektator-vy</p>
      </div>
    </div>
  );
}
