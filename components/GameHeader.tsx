import React from 'react';
import { Box, HStack, Text, Pressable, Icon } from '@gluestack-ui/themed';
import { useTheme } from '../context/ThemeContext';
import { MoonIcon, SunIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GameHeader() {
  const { colorMode, toggleColorMode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Box
      pt={insets.top} // Safe area padding
      bg="$backgroundLight0"
      sx={{
        borderBottomWidth: 1,
        borderBottomColor: '$borderLight300',
        _dark: { 
          bg: '$backgroundDark950',
          borderBottomColor: '$borderDark700'
        },
      }}
    >
      <HStack px="$4" py="$3" justifyContent="space-between" alignItems="center">
        <Text bold fontSize="$lg">
          MIXZTER
        </Text>
        <Pressable onPress={toggleColorMode} p="$2">
          <Icon
            as={colorMode === 'dark' ? SunIcon : MoonIcon}
            size="xl"
            color="$textLight800"
            sx={{ _dark: { color: '$textDark200' } }}
          />
        </Pressable>
      </HStack>
    </Box>
  );
}
