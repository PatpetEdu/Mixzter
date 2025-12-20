import React, { useState, useEffect, useRef } from 'react';
import { Linking, Platform, Animated, View } from 'react-native';
import { Box, Text, VStack, HStack, Icon, Pressable, useColorMode } from '@gluestack-ui/themed';
import { Music, QrCode, Play, X } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

export type CardFrontProps = {
  spotifyUrl: string;
  onFlip: () => void;
  showFlipButton: boolean;
};

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

export default function CardFront({ spotifyUrl }: CardFrontProps) {
  const [showQR, setShowQR] = useState(false);
  const colorMode = useColorMode();

  // Animation refs for pulsing rings
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ring 1 - 3 second cycle
    const ring1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring1Anim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(ring1Anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    // Ring 2 - 2 second cycle
    const ring2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring2Anim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(ring2Anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    // Ring 3 - 2.5 second cycle
    const ring3Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring3Anim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: false,
        }),
        Animated.timing(ring3Anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    ring1Loop.start();
    ring2Loop.start();
    ring3Loop.start();

    return () => {
      ring1Loop.stop();
      ring2Loop.stop();
      ring3Loop.stop();
    };
  }, [ring1Anim, ring2Anim, ring3Anim]);

  // Interpolate animations
  const ring1Opacity = ring1Anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.5, 0],
  });

  const ring1Scale = ring1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  const ring2Opacity = ring2Anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.5, 0],
  });

  const ring2Scale = ring2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  const ring3Opacity = ring3Anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.5, 0],
  });

  const ring3Scale = ring3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  const toggleQR = () => {
    setShowQR(!showQR);
  };

  return (
    <Box
      bg="$secondary100"
      sx={{ _dark: { bg: '$secondary100' } }}
      borderRadius="$3xl"
      borderWidth={1}
      borderColor="$secondary400"
      p="$6"
      h={320}
      position="relative"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
    >
      {/* Background Ambient Effects */}
      <Box
        position="absolute"
        inset={0}
        opacity={0.2}
        pointerEvents="none"
      >
        <Box
          position="absolute"
          w="120%"
          h="120%"
          top="-10%"
          left="-10%"
          borderRadius="$full"
          bg="rgba(16, 185, 129, 0.2)"
        />
      </Box>

      {/* Central Pulsing Audio Visualizer */}
      <VStack space="lg" alignItems="center" zIndex={10} flex={1} justifyContent="center">
        <Box position="relative" alignItems="center" justifyContent="center">
          {/* Pulsing Rings with Animations */}
          <Animated.View
            style={{
              position: 'absolute',
              width: 208,
              height: 208,
              borderRadius: 9999,
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              opacity: ring1Opacity,
              transform: [{ scale: ring1Scale }],
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              width: 160,
              height: 160,
              borderRadius: 9999,
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              opacity: ring2Opacity,
              transform: [{ scale: ring2Scale }],
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              width: 112,
              height: 112,
              borderRadius: 9999,
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              opacity: ring3Opacity,
              transform: [{ scale: ring3Scale }],
            }}
          />

          {/* Center Circle with Music Icon */}
          <Box
            w={96}
            h={96}
            bg="$secondary200"
            borderWidth={1}
            borderColor="$secondary400"
            borderRadius="$full"
            justifyContent="center"
            alignItems="center"
            zIndex={20}
            sx={{
              shadowColor: 'rgba(0, 0, 0, 0.5)',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            <Icon as={Music} size="xl" color="$emerald500" />
          </Box>
        </Box>

        <VStack alignItems="center" space="xs">
          <Box h={1} w="$6" bg="rgba(16, 185, 129, 0.4)" borderRadius="$full" mb="$3" />
          <Text
            fontSize="$xs"
            fontWeight="900"
            color="$secondary200"
            letterSpacing={1.5}
            textTransform="uppercase"
          >
            AWAITING REVEAL
          </Text>
        </VStack>
      </VStack>

      {/* Interaction Tray - Buttons at bottom */}
      <HStack space="md" w="$full" mt="auto" zIndex={20}>
        <Pressable
          flex={1}
          bg="$white"
          onPress={() => openSpotify(spotifyUrl)}
          borderRadius="$2xl"
          py="$4"
          justifyContent="center"
          alignItems="center"
          flexDirection="row"
          sx={{
            _pressed: {
              bg: '$emerald500',
              transform: [{ scale: 0.95 }],
            },
            _hover: {
              bg: '$emerald500',
            },
          }}
        >
          <Icon as={Play} size="sm" mr="$2" color="$secondary900" fill="$secondary900" sx={{ _pressed: { color: '$white' } }} />
          <Text
            fontSize="$xs"
            fontWeight="900"
            color="$secondary900"
            letterSpacing={0.5}
            textTransform="uppercase"
            sx={{ _pressed: { color: '$white' } }}
          >
            GO TO SONG
          </Text>
        </Pressable>

        <Pressable
          w={64}
          bg="$secondary200"
          borderWidth={1}
          borderColor="$secondary400"
          borderRadius="$2xl"
          justifyContent="center"
          alignItems="center"
          onPress={toggleQR}
          sx={{
            _pressed: {
              bg: '$secondary300',
              transform: [{ scale: 0.95 }],
            },
          }}
        >
          <Icon as={QrCode} size="lg" color="$emerald500" />
        </Pressable>
      </HStack>

      {/* QR Overlay */}
      {showQR && (
        <Box
          position="absolute"
          inset={16}
          bg="rgba(9, 9, 11, 0.98)"
          borderRadius="$3xl"
          borderWidth={1}
          borderColor="$secondary400"
          justifyContent="center"
          alignItems="center"
          p="$8"
          zIndex={30}
        >
          <Pressable
            position="absolute"
            top={24}
            right={24}
            onPress={toggleQR}
            p="$2"
          >
            <Icon as={X} size="lg" color="$secondary400" />
          </Pressable>

          <VStack space="lg" alignItems="center">
            <QRCode
              value={spotifyUrl}
              size={160}
              backgroundColor="transparent"
              color="white"
            />
            <Text
              fontSize="$xs"
              color="$secondary200"
              textAlign="center"
              fontWeight="900"
              letterSpacing={1}
              textTransform="uppercase"
            >
              SCAN ON SPOTIFY
            </Text>
          </VStack>
        </Box>
      )}
    </Box>
  );
}