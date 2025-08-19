import React, { useState, useRef } from 'react';
import { Linking, Platform, Animated, Easing } from 'react-native';
import { Box, Button, ButtonText, VStack, Icon, Pressable, useColorMode, Image } from '@gluestack-ui/themed';
import { Music, QrCodeIcon } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

const MIXZTER_LOGO = require('../assets/mixzter-icon-1024.png');
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

// Props (behåller signaturen för kompatibilitet även om onFlip/showFlipButton inte används här)
export type CardFrontProps = {
  spotifyUrl: string;
  onFlip: () => void;
  showFlipButton: boolean;
};

export default function CardFront({ spotifyUrl }: CardFrontProps) {
  const [showQrCode, setShowQrCode] = useState(false);
  // Använd useColorMode för att bestämma QR-färg baserat på temat
  const colorMode = useColorMode();
  const qrColor = (colorMode as any) === 'dark' ? 'white' : 'black';

  // Storlekar: liten ruta för ikon, stor ruta när QR visas
  const SMALL_SIZE = 56; // kompakt ikonruta
  const LARGE_SIZE = 128; // som tidigare QR-storlek

  // Animera storleken
  const sizeAnim = useRef(new Animated.Value(SMALL_SIZE)).current;

  const toggleQr = () => {
    setShowQrCode((prev) => {
      const next = !prev;
      Animated.timing(sizeAnim, {
        toValue: next ? LARGE_SIZE : SMALL_SIZE,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // width/height kan inte använda native driver
      }).start();
      return next;
    });
  };

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
        onPress={toggleQr}
        position="absolute"
        top={10}
        right={10}
        p="$2"
        zIndex={1}
      >
        <Icon as={QrCodeIcon} size="xl" color="$textLight400" sx={{ _dark: { color: '$textDark500' } }} />
      </Pressable>

      <VStack space="lg" alignItems="center">
        <Animated.View style={{ height: sizeAnim, width: sizeAnim }}>
          <Box style={{ height: '100%', width: '100%' }} justifyContent="center" alignItems="center">
            {showQrCode ? (
              <QRCode
                value={spotifyUrl}
                size={LARGE_SIZE}
                backgroundColor="transparent"
                color={qrColor}
              />
            ) : (
              <Image source={MIXZTER_LOGO} alt="MIXZTER" style={{ width: 96, height: 96, resizeMode: 'contain' }} />
            )}
          </Box>
        </Animated.View>

        {/* Viktigt: behåll knappen för att öppna Spotify */}
        <Button onPress={handleOpenSpotify} w="$full">
          <Icon as={Music} mr="$2" color="$white" />
          <ButtonText>Öppna i Spotify</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}