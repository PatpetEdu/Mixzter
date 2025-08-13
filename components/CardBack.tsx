import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Box, Text, VStack } from '@gluestack-ui/themed';

interface Props {
  artist: string;
  title: string;
  year: string;
  onFlip: () => void;
}

export default function CardBack({ artist, title, year, onFlip }: Props) {
  return (
    <TouchableOpacity onPress={onFlip}>
      <Box p="$6" borderRadius="$xl" bg="$backgroundLight100" sx={{_dark: {bg: "$backgroundDark800"}}} alignItems="center">
        <VStack space="xs" alignItems="center">
          <Text size="xl" bold>{artist}</Text>
          <Text size="md">{title}</Text>
          <Text size="3xl" color="$textLight500" sx={{_dark: {color: "$textDark400"}}}>{year}</Text>
        </VStack>
      </Box>
    </TouchableOpacity>
  );
}