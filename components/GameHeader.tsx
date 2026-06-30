import React, { useState } from 'react';
import {
  Box,
  HStack,
  Text,
  Pressable,
  VStack,
  Icon,
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicatorWrapper,
  ActionsheetDragIndicator,
  ActionsheetItem,
  ActionsheetItemText,
} from '@gluestack-ui/themed';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, User, MoreVertical, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserProfile from './UserProfile';

type Props = {
  gameMode?: string;
  onBackToMenu?: () => void;
};

const CURRENT_YEAR = new Date().getFullYear();

const GAME_MODE_LABELS: Record<string, string> = {
  default: `Blandat 1950-${CURRENT_YEAR}`,
  svenska: `Svenska Hits 1960-${CURRENT_YEAR}`,
  eurovision: `Eurovision 1956-${CURRENT_YEAR}`,
  rock: `Rock/Metal 1960-${CURRENT_YEAR}`,
  onehitwonder: 'One Hit Wonders 1970-2015',
  filmmusik: `Film & TV Musik 1950-${CURRENT_YEAR}`,
  disney: `Disney & Animerat 1937-${CURRENT_YEAR}`,
  melodifestivalen: `Melodifestivalen 1958-${CURRENT_YEAR}`,
  kpop: `K-POP 2000-${CURRENT_YEAR}`,
  eightiesnineties: '80s & 90s Hits 1980-1999',
  modernahits: `Moderna Hits 2005-${CURRENT_YEAR}`,
  sommarhits: `Sommarhits 1960-${CURRENT_YEAR}`,
  dance: `Dance & EDM 1970-${CURRENT_YEAR}`,
  julmusik: `Julmusik 1940-${CURRENT_YEAR}`,
  country: `Country 1950-${CURRENT_YEAR}`,
  partylatar: `Partylatar 1960-${CURRENT_YEAR}`,
  sportlatar: `Sportlatar 1970-${CURRENT_YEAR}`,
  nordisk: `Nordiska Hits 1960-${CURRENT_YEAR}`,
};

export default function GameHeader({ gameMode, onBackToMenu }: Props) {
  const { colorMode, toggleColorMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showActionsheet, setShowActionsheet] = useState(false);

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
            {onBackToMenu ? (
              <Pressable
                onPress={() => setShowActionsheet(true)}
                bg="$backgroundLight200"
                p="$2.5"
                rounded="$xl"
                sx={{ _dark: { bg: '$backgroundDark800' } }}
              >
                <MoreVertical size={18} color="#9ca3af" />
              </Pressable>
            ) : (
              <>
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
              </>
            )}
          </HStack>
        </HStack>
      </Box>
      {showUserProfile && (
        <UserProfile onClose={() => setShowUserProfile(false)} />
      )}
      {onBackToMenu && (
        <Actionsheet isOpen={showActionsheet} onClose={() => setShowActionsheet(false)} zIndex={999}>
          <ActionsheetBackdrop />
          <ActionsheetContent pb={insets.bottom}>
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator />
            </ActionsheetDragIndicatorWrapper>
            <ActionsheetItem
              onPress={() => {
                setShowActionsheet(false);
                toggleColorMode();
              }}
            >
              <Icon as={colorMode === 'dark' ? Sun : Moon} size="md" mr="$2" />
              <ActionsheetItemText>
                {colorMode === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
              </ActionsheetItemText>
            </ActionsheetItem>
            <ActionsheetItem
              onPress={() => {
                setShowActionsheet(false);
                onBackToMenu();
              }}
            >
              <Icon as={LogOut} size="md" mr="$2" />
              <ActionsheetItemText>Tillbaka till menyn</ActionsheetItemText>
            </ActionsheetItem>
          </ActionsheetContent>
        </Actionsheet>
      )}
    </>
  );
}
