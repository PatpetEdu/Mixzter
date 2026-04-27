import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Box,
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
    Alert.alert(
      'Logga ut',
      'Är du säker på att du vill logga ut?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Logga ut',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.card, { top: insets.top + 64 }]}>
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
        >
          <HStack alignItems="center" gap="$4" mb="$6">
            <Box
              w={48}
              h={48}
              bg="$backgroundLight200"
              rounded="$2xl"
              justifyContent="center"
              alignItems="center"
              sx={{ _dark: { bg: '$backgroundDark800' } }}
            >
              <User size={24} color="#059669" />
            </Box>
            <VStack flex={1} space="xs">
              <Text
                fontSize="$sm"
                fontWeight="bold"
                sx={{ _dark: { color: '$textDark100' } }}
                numberOfLines={1}
              >
                {user?.email || 'Gäst'}
              </Text>
              <Text
                fontSize="$xs"
                sx={{ _dark: { color: '$textDark500' } }}
              >
                {user ? 'Inloggad' : 'Spelar som gäst'}
              </Text>
            </VStack>
          </HStack>

          <Divider my="$4" />

          {user && (
            <TouchableOpacity
              onPress={handleSignOut}
              style={styles.logoutBtn}
              activeOpacity={0.7}
            >
              <LogOut size={16} color="#dc2626" />
              <Text
                fontSize="$sm"
                fontWeight="bold"
                color="$error600"
                sx={{ _dark: { color: '$error500' } }}
              >
                Logga ut
              </Text>
            </TouchableOpacity>
          )}

          <Button
            w="$full"
            bg="$backgroundLight200"
            rounded="$2xl"
            py="$3"
            px="$4"
            onPress={onClose}
            sx={{
              _dark: { bg: '$backgroundDark800' },
            }}
          >
            <ButtonText
              fontSize="$sm"
              fontWeight="bold"
              sx={{ _dark: { color: '$textDark300' } }}
            >
              STÄNG
            </ButtonText>
          </Button>
        </Box>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dc2626',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
});
