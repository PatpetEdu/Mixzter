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
      <Box style={{ padding: 24, borderRadius: 16, backgroundColor: '#f2f2f2', alignItems: 'center' }}>
        <VStack space="xs" style={{ alignItems: 'center' }}>
          <Text size="xl" style={{ fontWeight: 'bold' }}>{artist}</Text>
          <Text size="md">{title}</Text>
          <Text size="3xl" style={{ color: '#6b7280' }}>{year}</Text>
        </VStack>
      </Box>
    </TouchableOpacity>
  );
}
