import React, { useState } from 'react';
import { Box, HStack, Text, Pressable, VStack, Modal, ModalBackdrop, ModalContent, ModalHeader, ModalCloseButton, ModalBody, Icon, CloseIcon } from '@gluestack-ui/themed';
import { Eye, Copy } from 'lucide-react-native';

interface GameCodeBadgeProps {
  gameCode: string;
  spectatorCount: number;
}

export default function GameCodeBadge({ gameCode, spectatorCount }: GameCodeBadgeProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    // Implement copy to clipboard
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Diskret badge i övre högra hörnet */}
      <Pressable
        onPress={() => setShowModal(true)}
        position="absolute"
        top="$4"
        right="$4"
        zIndex={10}
        hitSlop={8}
      >
        <HStack
          bg="rgba(0, 0, 0, 0.6)"
          rounded="$full"
          px="$3"
          py="$2"
          space="sm"
          alignItems="center"
        >
          <Eye size={14} color="white" />
          <Text fontSize="$xs" fontWeight="bold" color="white">
            {spectatorCount}
          </Text>
          <Text fontSize="$xs" color="rgba(255,255,255,0.7)">
            {gameCode}
          </Text>
        </HStack>
      </Pressable>

      {/* Modal med större vy */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="md">
        <ModalBackdrop />
        <ModalContent bg="$backgroundDark900" borderColor="$backgroundDark800">
          <ModalHeader borderBottomColor="$backgroundDark800">
            <Text color="white" fontSize="$lg" fontWeight="bold">
              Game Code
            </Text>
            <ModalCloseButton onPress={() => setShowModal(false)}>
              <Icon as={CloseIcon} size="lg" />
            </ModalCloseButton>
          </ModalHeader>

          <ModalBody py="$6">
            <VStack space="lg" alignItems="center">
              {/* Code Display */}
              <Box
                bg="rgba(99, 102, 241, 0.1)"
                p="$6"
                rounded="$2xl"
                borderWidth={2}
                borderColor="rgba(99, 102, 241, 0.3)"
                w="100%"
                alignItems="center"
              >
                <Text fontSize="$xs" color="rgba(255,255,255,0.6)" mb="$2">
                  SHARE THIS CODE
                </Text>
                <Text
                  fontSize="$4xl"
                  fontWeight="black"
                  color="#6366f1"
                  letterSpacing={3}
                  fontFamily="monospace"
                >
                  {gameCode}
                </Text>
              </Box>

              {/* Copy Button */}
              <Pressable
                onPress={handleCopyCode}
                bg={copied ? '$success600' : '$success700'}
                px="$6"
                py="$3"
                rounded="$lg"
                w="100%"
                alignItems="center"
              >
                <HStack space="sm" alignItems="center">
                  <Copy size={16} color="white" />
                  <Text fontWeight="bold" color="white">
                    {copied ? 'Copied!' : 'Copy Code'}
                  </Text>
                </HStack>
              </Pressable>

              {/* Spectator Count */}
              <Box
                bg="$backgroundDark800"
                px="$4"
                py="$3"
                rounded="$lg"
                w="100%"
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color="$textDark300" fontSize="$sm">
                    Spectators Connected
                  </Text>
                  <Text
                    fontSize="$2xl"
                    fontWeight="black"
                    color="#10b981"
                  >
                    {spectatorCount}
                  </Text>
                </HStack>
              </Box>

              {/* Info Text */}
              <Text
                fontSize="$xs"
                color="$textDark400"
                textAlign="center"
              >
                Share this code with friends to let them spectate your game live!
              </Text>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
