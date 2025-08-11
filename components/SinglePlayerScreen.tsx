// components/SinglePlayerScreen.tsx
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import CardFront from './CardFront';
import CardBack from './CardBack';

type CardData = {
  artist: string;
  title: string;
  year: string;
  spotifyUrl: string;
};

type Props = {
  onBackToMenu: () => void;
};

export default function SinglePlayerScreen({ onBackToMenu }: Props) {
  const [card, setCard] = useState<CardData | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResult, setNoResult] = useState(false);
  const [seenSongs, setSeenSongs] = useState<Set<string>>(new Set()); // Använder Set för effektiv sökning

const generateCard = async () => {
    setLoading(true);
    setFlipped(false);
    setNoResult(false);

    let newCard: CardData | null = null;
    let attempts = 0;
    const MAX_CLIENT_ATTEMPTS = 5; // Max antal försök att hitta en unik låt från servern

    while (!newCard && attempts < MAX_CLIENT_ATTEMPTS) {
      try {
        const res = await fetch("https://us-central1-musikquiz-app.cloudfunctions.net/generateCard");
        // Kontrollera om svaret inte är OK (t.ex. 404 från Spotify, eller 500 från OpenAI)
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Fel från servern vid generering av kort:", res.status, errorText);
          // Vi sätter noResult till true och bryter för att visa felmeddelande till användaren
          setNoResult(true);
          break;
        }

        const data = await res.json();

        // Skapa en unik identifierare för låten (artist + titel, gemener för jämförelse)
        const songIdentifier = `${data.artist} - ${data.title}`.toLowerCase();

        // Kontrollera om låten redan visats i denna session
        if (!seenSongs.has(songIdentifier)) {
          newCard = data;
          // Lägg till låten i Set:et av visade låtar
          setSeenSongs(prev => new Set(prev).add(songIdentifier));
        } else {
          console.log(`Låten "${songIdentifier}" har redan visats i denna session. Försöker generera en ny.`);
        }
      } catch (error) {
        console.error("Kritiskt fel vid hämtning av kort:", error);
        setNoResult(true); // Visa meddelande om fel
        break; // Avbryt loopen vid ett kritiskt fel (t.ex. nätverksproblem)
      }
      attempts++;
    }

    if (newCard) {
      setCard(newCard);
      setNoResult(false); // Om vi har ett kort, nollställ felmeddelandet
    } else {
      // Om vi inte hittade en unik låt efter X försök ELLER om det var ett fel
      setCard(null);
      setNoResult(true); // Visa meddelande om ingen träff eller fel
      console.warn("Kunde inte generera en unik låt efter flera försök eller stötte på ett problem.");
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎵 Single Player</Text>
      <Button
        title={card ? "Generera nytt kort" : "Generera kort"}
        onPress={generateCard}
      />

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      {noResult && !loading && (
        <Text style={{ marginTop: 20, color: 'red' }}>Ingen träff – försök igen!</Text>
      )}

      {!loading && card && (
        <View style={{ marginTop: 20 }}>
          {flipped ? (
            <CardBack
              artist={card.artist}
              title={card.title}
              year={card.year}
              onFlip={() => setFlipped(false)}
            />
          ) : (
         <CardFront spotifyUrl={card.spotifyUrl} onFlip={() => setFlipped(true)} showFlipButton />
          )}
        </View>
      )}

      <View style={{ marginTop: 40 }}>
        <Button title="Gå tillbaka till meny" onPress={onBackToMenu} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
});
