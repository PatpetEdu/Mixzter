import React, { useState } from 'react';
import {
  Box,
  Pressable,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Divider,
} from '@gluestack-ui/themed';
import { User, LogOut } from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onClose: () => void;
};

export default function UserProfile({ onClose }: Props) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={100}
      justifyContent="flex-start"
      pt={insets.top + 60}
      px="$4"
    >
      {/* Backdrop */}
      <Pressable
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="rgba(0,0,0,0.3)"
        onPress={onClose}
        zIndex={-1}
      />

      {/* Profile Card */}
      <Box
        bg="$backgroundLight0"
        borderWidth={1}
        borderColor="$backgroundLight200"
        rounded="$3xl"
        p="$6"
        sx={{
          _dark: {
            bg: '$backgroundDark900',
            borderColor: '$backgroundDark800',
          },
        }}
        w="$full"
        maxWidth={320}
      >
        <HStack alignItems="center" gap="$4" mb="$6">
          <Box
            w={48}
            h={48}
            bg="$backgroundLight200"
            rounded="$2xl"
            justifyContent="center"
            alignItems="center"
            sx={{
              _dark: { bg: '$backgroundDark800' },
            }}
          >
            <User size={24} color="#059669" />
          </Box>
          <VStack flex={1} space="xs">
            <Text
              fontSize="$sm"
              fontWeight="bold"
              sx={{
                _dark: { color: '$textDark100' },
              }}
            >
              {user?.email || 'Gäst'}
            </Text>
            <Text
              fontSize="$xs"
              sx={{
                _dark: { color: '$textDark500' },
              }}
            >
              {user ? 'Inloggad' : 'Spelar som gäst'}
            </Text>
          </VStack>
        </HStack>

        <Divider my="$4" />

        {user && (
          <Button
            bg="$backgroundLight100"
            rounded="$2xl"
            py="$3"
            px="$4"
            mb="$2"
            onPress={handleSignOut}
            sx={{
              borderWidth: 1,
              borderColor: '$error600',
              _dark: {
                bg: '$backgroundDark800',
                borderColor: '$error500',
              },
            }}
          >
            <HStack gap="$2" alignItems="center">
              <LogOut size={16} color="#dc2626" />
              <ButtonText
                color="$error600"
                fontSize="$sm"
                fontWeight="bold"
                sx={{
                  _dark: { color: '$error500' },
                }}
              >
                Logga ut
              </ButtonText>
            </HStack>
          </Button>
        )}

        <Button
          bg="$backgroundLight200"
          rounded="$2xl"
          py="$3"
          px="$4"
          onPress={onClose}
          sx={{
            _dark: { bg: '$backgroundDark800' },
            _pressed: { bg: '$backgroundLight300' },
            _dark_pressed: { bg: '$backgroundDark700' },
          }}
        >
          <ButtonText
            fontSize="$sm"
            fontWeight="bold"
            sx={{
              _dark: { color: '$textDark300' },
            }}
          >
            STÄNG
          </ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
