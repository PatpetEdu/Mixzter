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
  const [expandCurrentSong, setExpandCurrentSong] = useState(false);

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

  const activePlayerName = game?.gameState?.activePlayer;

  const playerStats: PlayerStats[] = Object.entries(players).map(([name, data]) => {
    const cardCount = data.cards?.length || 0;
    const roundCardCount = activePlayerName === name ? (game?.roundCards?.length || 0) : 0;
    return {
      name,
      timeline: data.timeline || [],
      startYear: data.startYear,
      score: 1 + cardCount + roundCardCount,
      stars: data.stars || 0,
      cards: data.cards,
    };
  });

  console.log('playerStats:', playerStats);
  console.log('players object:', players);
  console.log('Object.entries(players):', Object.entries(players));

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
      {/* Header - visas endast om GO TO SONG inte är aktivt */}
      {!(game?.gameState?.shareSpotifyUrl && game?.currentCard?.spotifyUrl) && (
        <div className="spectator-header">
          <div className="header-logo">🎵</div>
          <p className="game-code">Spel: {game.gameCode}</p>
        </div>
      )}

      {/* GO TO SONG Button - ersätter header när aktivt */}
      {game?.gameState?.shareSpotifyUrl && game?.currentCard?.spotifyUrl && (
        <a 
          href={game.currentCard.spotifyUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="spotify-btn"
          style={{
            display: 'block',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.12) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '12px',
            padding: '16px 24px',
            margin: '16px',
            textAlign: 'center',
            color: '#34d399',
            textDecoration: 'none',
            fontWeight: '650',
            fontSize: '0.96rem',
            letterSpacing: '0.9px',
            textTransform: 'uppercase',
            boxShadow: '0 5px 16px rgba(16, 185, 129, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.32) 0%, rgba(16, 185, 129, 0.18) 100%)';
            e.currentTarget.style.boxShadow = '0 7px 20px rgba(16, 185, 129, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.12) 100%)';
            e.currentTarget.style.boxShadow = '0 5px 16px rgba(16, 185, 129, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          ▶ GO TO SONG
        </a>
      )}

      <div className="spectator-content">
        {/* Current Song with Spotify Link - Collapsible, högst upp */}
        {game?.gameState?.shareSpotifyUrl && game?.currentCard?.spotifyUrl && (
          <div className="current-song-section" style={{ marginBottom: '20px' }}>
            <div 
              className="current-song-header"
              onClick={() => setExpandCurrentSong(!expandCurrentSong)}
              style={{
                backgroundColor: 'rgba(100, 100, 110, 0.1)',
                border: '1px solid rgba(100, 100, 110, 0.3)',
                borderRadius: '0.75rem',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>CURRENT SONG</h2>
              <span style={{ 
                color: '#34d399', 
                fontSize: '1.2rem',
                transition: 'transform 0.3s ease',
                transform: expandCurrentSong ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'inline-block'
              }}>
                ⌃
              </span>
            </div>
            
            {expandCurrentSong && (
              <div style={{ marginTop: '12px' }}>
                <div className="latest-song-card">
                  <div className="song-title">{game.currentCard.title}</div>
                  <div className="song-artist">{game.currentCard.artist}</div>
                </div>
              </div>
            )}
          </div>
        )}

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
                        const earnedCards = [player.startYear, ...player.timeline].filter(y => y === year);
                        const earnedCount = earnedCards.length;
                        const prelimCount = roundCardsForPlayer.filter(c => c.year === year).length;
                        const isEarned = earnedCount > 0;
                        const isPrelim = prelimCount > 0;
                        
                        return (
                          <div key={i} className="year-badge-group">
                            {/* Tjänade år eller startår */}
                            {(isStartYear || isEarned) && (
                              <button
                                className={`year-badge ${isStartYear ? 'start' : 'earned'}`}
                                onClick={() => handleYearPress(player.name, year)}
                              >
                                {isStartYear && '📍 '}
                                {year}
                                {isEarned && earnedCount > 1 && ` (${earnedCount}x)`}
                              </button>
                            )}
                            
                            {/* Preliminära år */}
                            {isPrelim && (
                              <button
                                className="year-badge preliminary"
                                onClick={() => handleYearPress(player.name, year)}
                              >
                                {year}
                                {prelimCount > 1 && ` (${prelimCount}x)`}
                              </button>
                            )}
                          </div>
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
