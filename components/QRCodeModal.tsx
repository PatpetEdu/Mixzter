import React, { useState } from 'react';
import { Pressable as RNPressable, Clipboard } from 'react-native';
import { Box, Center, VStack, HStack, Text, Pressable, Icon, useColorMode } from '@gluestack-ui/themed';
import { X, Copy, Check } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

interface QRCodeModalProps {
  gameId: string;
  publicToken?: string;
  /** Om angiven används denna URL direkt (t.ex. för Score Battle) */
  url?: string;
  onClose: () => void;
  webDomain?: string; // Default: 'https://musikquiz-app.web.app'
}

export default function QRCodeModal({
  gameId,
  publicToken,
  url,
  onClose,
  webDomain = 'https://musikquiz-app.web.app',
}: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const colorMode = useColorMode();

  // Konstruera QR-länken: använd url om den anges, annars spectator-länk
  const spectatorUrl = url ?? `${webDomain}/?gameId=${gameId}&token=${publicToken}`;

  const handleCopyLink = async () => {
    try {
      await Clipboard.setString(spectatorUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Box
      position="absolute"
      inset={0}
      bg="rgba(0, 0, 0, 0.7)"
      justifyContent="center"
      alignItems="center"
      zIndex={100}
    >
      <RNPressable onPress={onClose} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <RNPressable onPress={(e) => e.stopPropagation()}>
          <Box
            bg="$backgroundLight0"
            rounded="$3xl"
            p="$8"
            maxWidth={320}
            borderWidth={1}
            borderColor="rgba(100, 100, 110, 0.2)"
            sx={{
              _dark: {
                bg: '$backgroundDark900',
                borderColor: 'rgba(80, 80, 90, 0.4)',
              },
            }}
          >
            {/* Close Button */}
            <Pressable
              position="absolute"
              top={16}
              right={16}
              onPress={onClose}
              p="$2"
              zIndex={10}
            >
              <Icon as={X} size="lg" color="$secondary600" />
            </Pressable>

            {/* Content */}
            <VStack space="lg" alignItems="center">
              {/* Title */}
              <VStack space="sm" alignItems="center">
                <Text
                  fontSize="$lg"
                  fontWeight="bold"
                  sx={{ _dark: { color: '$textDark100' } }}
                  textAlign="center"
                >
                  Share with Spectators
                </Text>
                <Text
                  fontSize="$xs"
                  sx={{ _dark: { color: '$textDark400' } }}
                  color="$secondary600"
                  textAlign="center"
                >
                  Scan QR or share link
                </Text>
              </VStack>

              {/* QR Code */}
              <Box
                bg="white"
                p="$6"
                rounded="$2xl"
                borderWidth={2}
                borderColor="rgba(16, 185, 129, 0.2)"
              >
                <QRCode
                  value={spectatorUrl}
                  size={160}
                  backgroundColor="white"
                  color="#059669"
                />
              </Box>

              {/* Link Display & Copy */}
              <VStack space="sm" w="$full" alignItems="stretch">
                <Text
                  fontSize="$xs"
                  fontWeight="bold"
                  sx={{ _dark: { color: '$textDark400' } }}
                  color="$secondary600"
                  textTransform="uppercase"
                  letterSpacing={0.5}
                >
                  Spectator Link
                </Text>
                
                <Pressable
                  onPress={handleCopyLink}
                  bg={copied ? '$success600' : '$secondary800'}
                  px="$4"
                  py="$3"
                  rounded="$lg"
                  borderWidth={1}
                  borderColor={copied ? '$success700' : '$secondary700'}
                  sx={{
                    _pressed: {
                      opacity: 0.8,
                      transform: [{ scale: 0.98 }],
                    },
                  }}
                >
                  <HStack space="sm" alignItems="center" justifyContent="center">
                    <Icon
                      as={copied ? Check : Copy}
                      size="sm"
                      color="$white"
                    />
                    <Text
                      color="$white"
                      fontSize="$xs"
                      fontWeight="bold"
                      flex={1}
                      numberOfLines={1}
                    >
                      {copied ? 'Copied!' : 'Copy Link'}
                    </Text>
                  </HStack>
                </Pressable>

                {/* Truncated URL Display */}
                <Box
                  bg="$secondary900"
                  px="$3"
                  py="$2"
                  rounded="$lg"
                  borderWidth={1}
                  borderColor="$secondary800"
                >
                  <Text
                    fontSize="$2xs"
                    sx={{ _dark: { color: '$textDark400' } }}
                    color="$secondary300"
                    numberOfLines={2}
                    fontFamily="monospace"
                  >
                    {spectatorUrl.substring(0, 45)}...
                  </Text>
                </Box>
              </VStack>

              {/* Info Text */}
              <Box
                bg="rgba(16, 185, 129, 0.1)"
                px="$3"
                py="$2"
                rounded="$lg"
                borderWidth={1}
                borderColor="rgba(16, 185, 129, 0.3)"
                w="$full"
              >
                <Text
                  fontSize="$2xs"
                  sx={{ _dark: { color: '$textDark400' } }}
                  color="$secondary600"
                  textAlign="center"
                  lineHeight="$sm"
                >
                  🔐 Link is secure and game-specific. Token expires when game ends.
                </Text>
              </Box>

              {/* Close Button */}
              <Pressable
                onPress={onClose}
                w="$full"
                bg="$secondary700"
                py="$3"
                rounded="$lg"
                sx={{
                  _pressed: {
                    bg: '$secondary800',
                    transform: [{ scale: 0.98 }],
                  },
                }}
              >
                <Text
                  color="$white"
                  fontSize="$sm"
                  fontWeight="bold"
                  textAlign="center"
                  textTransform="uppercase"
                  letterSpacing={1}
                >
                  Done
                </Text>
              </Pressable>
            </VStack>
          </Box>
        </RNPressable>
      </RNPressable>
    </Box>
  );
}
