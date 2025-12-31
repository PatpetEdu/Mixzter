import React, { useState } from 'react';
import { Box, HStack, Text, Pressable, VStack } from '@gluestack-ui/themed';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserProfile from './UserProfile';

type Props = {
  gameMode?: string;
};

const GAME_MODE_LABELS: Record<string, string> = {
  default: 'Blandat 1950-2025',
  svenska: 'Svenska Hits 1960-2025',
  eurovision: 'Eurovision 1956-2025',
  rock: 'Rock/Metal 1960-2025',
  onehitwonder: 'One Hit Wonders 1970-2015',
  filmmusik: 'Film & TV Musik 1950-2025',
  disney: 'Disney Klassiker 1937-2025',
};

export default function GameHeader({ gameMode }: Props) {
  const { colorMode, toggleColorMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Splitta genre-namn och år
  const splitGameModeName = (fullName: string): { name: string; years: string } => {
    const match = fullName.match(/^(.*?)\s+(\d{4}(?:-\d{4})?)$/);
    if (match) {
      return { name: match[1], years: match[2] };
    }
    return { name: fullName, years: '' };
  };

  return (
    <>
      <Box
        pt={insets.top}
        bg="$backgroundLight100"
        px="$6"
        py="$4"
        borderBottomWidth={1}
        borderBottomColor="$backgroundLight200"
        sx={{
          _dark: {
            bg: '$backgroundDark900',
            borderBottomColor: '$backgroundDark800'
          }
        }}
      >
        <HStack justifyContent="space-between" alignItems="center">
          <HStack alignItems="center" gap="$3">
            <Box
              w={40}
              h={40}
              bg="#059669"
              rounded="$2xl"
              justifyContent="center"
              alignItems="center"
              sx={{ _dark: { bg: '#047857' } }}
            >
              <Text fontSize="$2xl" bold color="$textLight950">M</Text>
            </Box>
            {gameMode ? (
              <VStack space="xs">
                <Text 
                  fontSize="$lg" 
                  fontWeight="black" 
                  sx={{ _dark: { color: '$textDark50' } }}
                  numberOfLines={1}
                >
                  {splitGameModeName(GAME_MODE_LABELS[gameMode] || gameMode).name}
                </Text>
                <Text 
                  fontSize="$xs" 
                  fontWeight="500"
                  color="$textLight500"
                  sx={{ _dark: { color: '$textDark400' } }}
                >
                  {splitGameModeName(GAME_MODE_LABELS[gameMode] || gameMode).years}
                </Text>
              </VStack>
            ) : (
              <Text 
                fontSize="$2xl" 
                fontWeight="black" 
                sx={{ _dark: { color: '$textDark50' } }}
              >
                MIXZTER
              </Text>
            )}
          </HStack>

          <HStack gap="$3" alignItems="center">
            <Pressable 
              onPress={toggleColorMode}
              bg="$backgroundLight200"
              p="$2.5"
              rounded="$xl"
              sx={{ _dark: { bg: '$backgroundDark800' } }}
            >
              {colorMode === 'dark' ? (
                <Sun size={18} color="#fbbf24" />
              ) : (
                <Moon size={18} color="#6b7280" />
              )}
            </Pressable>
            <Pressable 
              onPress={() => setShowUserProfile(true)}
              bg="$backgroundLight200"
              p="$2.5"
              rounded="$xl"
              sx={{ _dark: { bg: '$backgroundDark800' } }}
            >
              <User size={18} color="#9ca3af" />
            </Pressable>
          </HStack>
        </HStack>
      </Box>
      {showUserProfile && (
        <UserProfile onClose={() => setShowUserProfile(false)} />
      )}
    </>
  );
}
