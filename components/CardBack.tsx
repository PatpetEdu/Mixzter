import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Box, Text, VStack } from '@gluestack-ui/themed';
import { Music } from 'lucide-react-native';

interface Props {
  artist: string;
  title: string;
  year: string;
  onFlip: () => void;
}

export default function CardBack({ artist, title, year, onFlip }: Props) {
  return (
    <TouchableOpacity onPress={onFlip} activeOpacity={1} style={{ width: '100%' }}>
      <Box
        bg="rgba(255, 255, 255, 0.85)"
        borderRadius="$3xl"
        borderWidth={8}
        borderColor="rgba(16, 185, 129, 0.1)"
        h={320}
        px="$4"
        py="$4"
        w="$full"
        justifyContent="center"
        alignItems="center"
        position="relative"
      >
        {/* Centered Content */}
        <VStack
          alignItems="center"
          justifyContent="space-between"
          space="md"
          w="$full"
          flex={1}
        >
          {/* Music Icon */}
          <Box
            w={56}
            h={56}
            bg="$secondary800"
            borderRadius="$2xl"
            justifyContent="center"
            alignItems="center"
            sx={{
              transform: [{ rotate: '3deg' }],
              shadowColor: 'rgba(16, 185, 129, 0.3)',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.6,
              shadowRadius: 12,
            }}
          >
            <Music size={32} color="#10B981" strokeWidth={1.3} />
          </Box>

          {/* Year */}
          <Text
            fontSize="$6xl"
            fontWeight="900"
            italic
            color="$secondary900"
            textAlign="center"
            w="$full"
          >
            {year}
          </Text>
          
          {/* Green Bar */}
          <Box
            h={2}
            w={40}
            bg="$emerald500"
            borderRadius="$full"
          />

          {/* Artist & Title */}
          <VStack
            alignItems="center"
            space="xs"
            w="$full"
          >
            <Text
              fontSize="$2xs"
              fontWeight="900"
              color="$secondary400"
              letterSpacing={2}
              textTransform="uppercase"
              mb="$2"
            >
              Artist & Låt
            </Text>
            <Text
              fontSize="$xl"
              fontWeight="900"
              color="$secondary900"
              textAlign="center"
              numberOfLines={2}
              px="$4"
            >
              {artist}
            </Text>
            <Text
              fontSize="$sm"
              fontWeight="600"
              color="$secondary500"
              italic
              textAlign="center"
              numberOfLines={2}
              px="$4"
            >
              "{title}"
            </Text>
          </VStack>
        </VStack>
      </Box>
    </TouchableOpacity>
  );
}