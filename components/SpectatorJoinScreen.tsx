import React, { useState } from 'react';
import { View, ActivityIndicator, Keyboard } from 'react-native';
import { Box, Button, ButtonText, Center, Heading, VStack, HStack, Input, InputField, InputSlot, Text, Pressable } from '@gluestack-ui/themed';
import { Eye, ArrowLeft } from 'lucide-react-native';
import { useGameCode } from '../hooks/useGameCode';
import { useAuth } from '../hooks/useAuth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface SpectatorJoinScreenProps {
  onJoinGame: (gameId: string) => void;
  onBack: () => void;
}

export default function SpectatorJoinScreen({ onJoinGame, onBack }: SpectatorJoinScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { validateCode } = useGameCode();
  const { user } = useAuth();

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('Please enter a game code');
      return;
    }

    if (!user) {
      setError('You must be logged in to watch');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const gameId = await validateCode(code);
      if (gameId) {
        // Skriv till spectators subcollection
        await setDoc(
          doc(db, 'games', gameId, 'spectators', user.uid),
          {
            userId: user.uid,
            joinedAt: serverTimestamp(),
          }
        );
        onJoinGame(gameId);
      } else {
        setError('Invalid or inactive game code');
      }
    } catch (err) {
      setError('Error joining game. Please try again.');
      console.error('SpectatorJoinScreen error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }} px="$6" py="$8">
      {/* Header */}
      <HStack space="md" alignItems="center" mb="$8">
        <Pressable onPress={onBack} hitSlop={8}>
          <ArrowLeft size={24} color="#6b7280" />
        </Pressable>
        <Heading size="xl" sx={{ _dark: { color: '$textDark100' } }}>
          Watch Live
        </Heading>
      </HStack>

      <VStack space="xl" flex={1} justifyContent="flex-start">
        {/* Info Section */}
        <VStack space="md">
          <Box
            bg="rgba(99, 102, 241, 0.1)"
            p="$4"
            rounded="$2xl"
            borderWidth={1}
            borderColor="rgba(99, 102, 241, 0.3)"
          >
            <VStack space="sm">
              <HStack space="md">
                <Eye size={20} color="#6366f1" />
                <Text
                  fontSize="$sm"
                  sx={{
                    _dark: { color: '$textDark200' },
                  }}
                  flex={1}
                >
                  Ask your friend for their game code to spectate their Music Battle in real-time.
                </Text>
              </HStack>
            </VStack>
          </Box>
        </VStack>

        {/* Input Section */}
        <VStack space="md">
          <Text
            fontSize="$sm"
            fontWeight="bold"
            sx={{
              _dark: { color: '$textDark200' },
            }}
          >
            Enter Game Code
          </Text>
          <Input
            variant="outline"
            size="lg"
            isDisabled={loading}
            sx={{
              _dark: {
                bg: '$backgroundDark900',
                borderColor: '$backgroundDark800',
              },
            }}
          >
            <InputField
              placeholder="e.g. 123456"
              value={code}
              onChangeText={(text) => {
                // Bara acceptera siffror
                const numericText = text.replace(/[^0-9]/g, '');
                setCode(numericText);
                setError(null);
              }}
              maxLength={6}
              editable={!loading}
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              autoComplete="off"
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              style={{ textAlign: 'center', fontSize: 18, fontWeight: '600', letterSpacing: 2 }}
            />
          </Input>

          {error && (
            <Text
              fontSize="$sm"
              color="#ef4444"
              sx={{
                _dark: { color: '#fca5a5' },
              }}
            >
              {error}
            </Text>
          )}
        </VStack>

        {/* Join Button */}
        <Button
          size="lg"
          action="positive"
          isDisabled={loading || !code.trim()}
          onPress={handleJoin}
          bg="$success700"
          sx={{
            _dark: { bg: '$success600' },
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <ButtonText fontWeight="bold" fontSize="$md">
              Join Game
            </ButtonText>
          )}
        </Button>

        {/* Divider */}
        <HStack alignItems="center" space="md" my="$4">
          <Box flex={1} h={1} bg="$backgroundLight200" sx={{ _dark: { bg: '$backgroundDark800' } }} />
          <Text
            fontSize="$xs"
            sx={{
              _dark: { color: '$textDark400' },
            }}
          >
            OR
          </Text>
          <Box flex={1} h={1} bg="$backgroundLight200" sx={{ _dark: { bg: '$backgroundDark800' } }} />
        </HStack>

        {/* QR Scanner Placeholder */}
        <Button
          variant="outline"
          size="lg"
          onPress={() => {
            // QR scanning akan implementeras senare
          }}
          sx={{
            borderColor: '$backgroundLight200',
            _dark: { borderColor: '$backgroundDark800' },
          }}
        >
          <ButtonText
            sx={{
              _dark: { color: '$textDark200' },
            }}
          >
            Scan QR Code
          </ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}
