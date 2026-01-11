import React from 'react';
import { TouchableOpacity, ImageBackground } from 'react-native';
import { Box, Text, VStack } from '@gluestack-ui/themed';

interface Props {
  artist: string;
  title: string;
  year: string;
  onFlip: () => void;
  artworkUrl?: string;
  source?: string;
}

export default function CardBack({ artist, title, year, onFlip, artworkUrl, source }: Props) {
  return (
    <TouchableOpacity onPress={onFlip} activeOpacity={1} style={{ width: '100%' }}>
      {artworkUrl ? (
        <ImageBackground
          source={{ uri: artworkUrl, cache: 'reload' }}
          style={{ width: '100%' }}
          imageStyle={{
            borderRadius: 24,
            resizeMode: 'cover',
          }}
          resizeMode="cover"
        >
          {/* Dark overlay for readability */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="rgba(0, 0, 0, 0.5)"
            borderRadius="$3xl"
            zIndex={1}
          />
          
          {/* Content on top of overlay */}
          <Box
            h={320}
            px="$4"
            py="$4"
            w="$full"
            justifyContent="center"
            alignItems="center"
            position="relative"
            zIndex={2}
          >
            <VStack
              alignItems="center"
              justifyContent="space-between"
              space="md"
              w="$full"
              flex={1}
            >
              {/* Year */}
              <Text
                fontSize="$6xl"
                fontWeight="900"
                italic
                color="$white"
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
                  color="$secondary200"
                  letterSpacing={2}
                  textTransform="uppercase"
                  mb="$2"
                >
                  Artist & Låt
                </Text>
                <Text
                  fontSize="$xl"
                  fontWeight="900"
                  color="$white"
                  textAlign="center"
                  numberOfLines={2}
                  px="$4"
                >
                  {artist}
                </Text>
                <Text
                  fontSize="$sm"
                  fontWeight="600"
                  color="$secondary100"
                  italic
                  textAlign="center"
                  numberOfLines={2}
                  px="$4"
                >
                  "{title}"
                </Text>
                {source && (
                  <Text
                    fontSize="$xs"
                    fontWeight="600"
                    color="$secondary200"
                    italic
                    textAlign="center"
                    numberOfLines={1}
                    px="$4"
                    mt="$2"
                  >
                    — {source}
                  </Text>
                )}
              </VStack>
            </VStack>
          </Box>
        </ImageBackground>
      ) : (
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
              {source && (
                <Text
                  fontSize="$xs"
                  fontWeight="600"
                  color="$secondary400"
                  italic
                  textAlign="center"
                  numberOfLines={1}
                  px="$4"
                  mt="$2"
                >
                  — {source}
                </Text>
              )}
            </VStack>
          </VStack>
        </Box>
      )}
    </TouchableOpacity>
  );
}