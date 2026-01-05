import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Box, VStack, HStack, Text } from '@gluestack-ui/themed';

export default function CardSkeleton() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const dotsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  useEffect(() => {
    const dotsLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotsAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
        Animated.delay(300),
        Animated.timing(dotsAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.delay(300),
        Animated.timing(dotsAnim, {
          toValue: 2,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.delay(300),
      ])
    );
    dotsLoop.start();
    return () => dotsLoop.stop();
  }, [dotsAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 0.8, 0.5],
  });

  const dot1Opacity = dotsAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.3, 1, 0.3],
  });

  const dot2Opacity = dotsAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.3, 0.3, 1],
  });

  return (
    <VStack w="$full" space="md" mt="$4">
      {/* Main card skeleton with details */}
      <Animated.View
        style={{
          opacity: shimmerOpacity,
        }}
      >
        <Box
          h={320}
          w="$full"
          bg="$backgroundLight200"
          borderRadius="$3xl"
          borderWidth={1}
          borderColor="$backgroundLight300"
          p="$6"
          sx={{
            _dark: {
              bg: '$backgroundDark800',
              borderColor: '$backgroundDark700',
            },
          }}
          justifyContent="space-between"
        >
          {/* Top section - empty space for pulsing rings */}
          <VStack alignItems="center" justifyContent="center" flex={1} space="md">
            {/* Circle placeholder for album art */}
            <Box
              w={100}
              h={100}
              rounded="$full"
              bg="$backgroundLight300"
              sx={{
                _dark: {
                  bg: '$backgroundDark700',
                },
              }}
            />

            {/* Text placeholders */}
            <VStack w="$full" space="sm" alignItems="center">
              {/* Title placeholder */}
              <Box
                h="$4"
                w="80%"
                rounded="$md"
                bg="$backgroundLight300"
                sx={{
                  _dark: {
                    bg: '$backgroundDark700',
                  },
                }}
              />

              {/* Artist placeholder */}
              <Box
                h="$3"
                w="60%"
                rounded="$md"
                bg="$backgroundLight300"
                sx={{
                  _dark: {
                    bg: '$backgroundDark700',
                  },
                }}
              />

              {/* Year placeholder */}
              <Box
                h="$3"
                w="40%"
                rounded="$md"
                bg="$backgroundLight300"
                sx={{
                  _dark: {
                    bg: '$backgroundDark700',
                  },
                }}
              />
            </VStack>
          </VStack>

          {/* Bottom buttons placeholders */}
          <HStack space="md" w="$full">
            <Box
              flex={1}
              h={12}
              rounded="$xl"
              bg="$backgroundLight300"
              sx={{
                _dark: {
                  bg: '$backgroundDark700',
                },
              }}
            />
            <Box
              w={16}
              h={12}
              rounded="$xl"
              bg="$backgroundLight300"
              sx={{
                _dark: {
                  bg: '$backgroundDark700',
                },
              }}
            />
          </HStack>
        </Box>
      </Animated.View>

      {/* Loading text with animated dots */}
      <HStack alignItems="center" justifyContent="center" space="xs">
        <Text
          fontSize="$sm"
          color="$textLight500"
          sx={{
            _dark: { color: '$textDark400' },
          }}
          fontWeight="500"
        >
          Loading next song
        </Text>
        <Animated.View style={{ opacity: dot1Opacity }}>
          <Text fontSize="$sm" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
            •
          </Text>
        </Animated.View>
        <Animated.View style={{ opacity: dot2Opacity }}>
          <Text fontSize="$sm" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
            •
          </Text>
        </Animated.View>
      </HStack>

      {/* Input field placeholder */}
      <Animated.View
        style={{
          opacity: shimmerOpacity,
        }}
      >
        <Box
          h={12}
          w="$full"
          bg="$backgroundLight200"
          borderRadius="$2xl"
          borderWidth={1}
          borderColor="$backgroundLight300"
          sx={{
            _dark: {
              bg: '$backgroundDark800',
              borderColor: '$backgroundDark700',
            },
          }}
        />
      </Animated.View>

      {/* Button placeholder */}
      <Animated.View
        style={{
          opacity: shimmerOpacity,
        }}
      >
        <Box
          h={12}
          w="$full"
          bg="$backgroundLight200"
          borderRadius="$2xl"
          sx={{
            _dark: {
              bg: '$backgroundDark800',
            },
          }}
        />
      </Animated.View>
    </VStack>
  );
}
