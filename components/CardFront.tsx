import React from 'react';
import { View, StyleSheet, Button, Platform, Alert, Linking } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  spotifyUrl: string;
  onFlip: () => void;
  showFlipButton?: boolean; // valfri prop
};

export default function CardFront({ spotifyUrl, onFlip, showFlipButton = true }: Props) {
  const handleOpenSpotify = () => openSpotify(spotifyUrl);

  return (
    <View style={styles.container}>
      <QRCode value={spotifyUrl} size={180} />
      <View style={{ marginTop: 20 }}>
        <Button title="🎧 Öppna i Spotify" onPress={handleOpenSpotify} />
       </View>
      {showFlipButton && (
        <View style={{ marginTop: 20 }}>
          <Button title="Vänd kortet" onPress={onFlip} />
        </View>
      )}
    </View>
  );
}

async function openSpotify(spotifyUrl: string) {
  try {
    if (Platform.OS === 'web') {
      // @ts-ignore
      window.open(spotifyUrl, '_blank');
      return;
    }

    const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
    const trackId = match?.[1];

    if (!trackId) {
      Alert.alert("Ogiltig länk", "Kunde inte läsa ut låt-ID från länken.");
      return;
    }

    const appUrl = `spotify:track:${trackId}`;
    const supported = await Linking.canOpenURL(appUrl);

    if (supported) {
      await Linking.openURL(appUrl); // Försök öppna i Spotify-appen
    } else {
      await Linking.openURL(spotifyUrl); // Fallback: öppna i webbläsare
    }
  } catch (error) {
    Alert.alert("Fel vid öppning", String(error));
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
  },
});
