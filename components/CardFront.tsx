import React from 'react';
import { Platform, Alert, Linking } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Box, Button, ButtonText, VStack } from '@gluestack-ui/themed';

type Props = {
  spotifyUrl: string;
  onFlip: () => void;
  showFlipButton?: boolean;
};

export default function CardFront({ spotifyUrl, onFlip, showFlipButton = true }: Props) {
  const handleOpenSpotify = () => openSpotify(spotifyUrl);

  return (
    <Box alignItems="center" p="$6" bg="$backgroundLight100" sx={{_dark: {bg: "$backgroundDark800"}}} borderRadius="$xl">
      <QRCode value={spotifyUrl} size={180} />
      <VStack space="md" mt="$5" w="$full" alignItems="center">
        <Button onPress={handleOpenSpotify}>
          <ButtonText>🎧 Öppna i Spotify</ButtonText>
        </Button>
        {showFlipButton && (
          <Button variant="outline" onPress={onFlip}>
            <ButtonText>Vänd kortet</ButtonText>
          </Button>
        )}
      </VStack>
    </Box>
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
      Alert.alert('Ogiltig länk', 'Kunde inte läsa ut låt-ID från länken.');
      return;
    }

    const appUrl = `spotify:track:${trackId}`;
    const supported = await Linking.canOpenURL(appUrl);

    if (supported) await Linking.openURL(appUrl);
    else await Linking.openURL(spotifyUrl);
  } catch (error) {
    Alert.alert('Fel vid öppning', String(error));
  }
}