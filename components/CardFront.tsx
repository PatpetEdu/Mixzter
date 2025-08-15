import React, { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Box, Button, ButtonText, VStack, Icon, Pressable, useColorMode } from '@gluestack-ui/themed';
import { Music, QrCodeIcon } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import AudioVisualizer from './AudioVisualizer';

// Återställd och mer robust funktion för att öppna Spotify
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
      console.error('Ogiltig länk', 'Kunde inte läsa ut låt-ID från länken.');
      return;
    }

    const appUrl = `spotify:track:${trackId}`;
    const supported = await Linking.canOpenURL(appUrl);

    if (supported) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(spotifyUrl);
    }
  } catch (error) {
    console.error('Fel vid öppning', String(error));
  }
}

type Props = {
  spotifyUrl: string;
  onFlip: () => void;
  showFlipButton: boolean;
};

export default function CardFront({ spotifyUrl }: Props) {
  const [showQrCode, setShowQrCode] = useState(false);
  // Använd useColorMode för att bestämma färgen baserat på temat
  const colorMode = useColorMode();
  const qrColor = colorMode === 'dark' ? 'white' : 'black';

  const handleOpenSpotify = () => {
    openSpotify(spotifyUrl);
  };

  return (
    <Box
      p="$5"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$borderLight300"
      bg="$backgroundLight50"
      sx={{
        _dark: {
          borderColor: '$borderDark700',
          bg: '$backgroundDark900',
        },
      }}
    >
      <Pressable
        onPress={() => setShowQrCode(!showQrCode)}
        position="absolute"
        top={10}
        right={10}
        p="$2"
        zIndex={1}
      >
        <Icon as={QrCodeIcon} size="xl" color="$textLight400" sx={{ _dark: { color: '$textDark500' } }} />
      </Pressable>

      <VStack space="lg" alignItems="center">
        <Box h={128} w={128} justifyContent="center" alignItems="center">
          {showQrCode ? (
            <QRCode
              value={spotifyUrl}
              size={128}
              backgroundColor="transparent"
              color={qrColor} // Använder nu en färg som garanterat fungerar
            />
          ) : (
            <AudioVisualizer />
          )}
        </Box>

        <Button onPress={handleOpenSpotify} w="$full">
          <Icon as={Music} mr="$2" color="$white" />
          <ButtonText>Öppna i Spotify</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}
