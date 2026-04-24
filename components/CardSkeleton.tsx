import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Box, VStack, HStack, Text } from '@gluestack-ui/themed';
import { Music2 } from 'lucide-react-native';

export default function CardSkeleton() {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0.5)).current;

  // Tre punkter som pulsar i stagger
  useEffect(() => {
    const makeLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    const l1 = makeLoop(pulse1, 0);
    const l2 = makeLoop(pulse2, 160);
    const l3 = makeLoop(pulse3, 320);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, [pulse1, pulse2, pulse3]);

  // Ikon slow-fade
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconOpacity, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(iconOpacity, { toValue: 0.4, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [iconOpacity]);

  // Shimmer för skeleton-block
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const SkeletonBlock = ({ w, h, rounded = 12 }: { w: string | number; h: number; rounded?: number }) => (
    <Animated.View style={{ opacity: shimmer, width: w as any, height: h, borderRadius: rounded, backgroundColor: undefined }}>
      <Box
        w="$full" h="$full"
        bg="$backgroundLight200"
        sx={{ _dark: { bg: '$backgroundDark800' } }}
        style={{ borderRadius: rounded }}
      />
    </Animated.View>
  );

  return (
    <VStack w="$full" space="lg" mt="$2">

      {/* ── Kortsilhuett ─────────────────────────────────────────────── */}
      <Box
        h={300}
        w="$full"
        bg="$backgroundLight100"
        borderRadius="$3xl"
        borderWidth={1}
        borderColor="$backgroundLight200"
        p="$6"
        sx={{ _dark: { bg: '$backgroundDark900', borderColor: '$backgroundDark800' } }}
        justifyContent="space-between"
        overflow="hidden"
      >
        <VStack alignItems="center" justifyContent="center" flex={1} space="md">
          {/* Albumart-cirkel */}
          <SkeletonBlock w={88} h={88} rounded={44} />
          {/* Textplatshållare */}
          <VStack w="$full" space="sm" alignItems="center">
            <SkeletonBlock w="65%" h={14} />
            <SkeletonBlock w="45%" h={11} />
            <SkeletonBlock w="28%" h={11} />
          </VStack>
        </VStack>
        {/* Knapplatshållare */}
        <HStack space="sm" w="$full">
          <Animated.View style={{ opacity: shimmer, flex: 1 }}>
            <Box h={44} rounded="$xl" bg="$backgroundLight200" sx={{ _dark: { bg: '$backgroundDark800' } }} />
          </Animated.View>
          <Animated.View style={{ opacity: shimmer, width: 44 }}>
            <Box h={44} rounded="$xl" bg="$backgroundLight200" sx={{ _dark: { bg: '$backgroundDark800' } }} />
          </Animated.View>
        </HStack>
      </Box>

      {/* ── Ikon + text + punkter ─────────────────────────────────────── */}
      <VStack alignItems="center" space="sm" py="$2">
        <Animated.View style={{ opacity: iconOpacity }}>
          <Music2 size={22} color="#6B7280" />
        </Animated.View>
        <HStack alignItems="center" space="sm">
          <Text
            fontSize="$sm"
            color="$textLight400"
            sx={{ _dark: { color: '$textDark500' } }}
            letterSpacing={0.5}
          >
            Loading songs
          </Text>
          <HStack space="xs" alignItems="center">
            {[pulse1, pulse2, pulse3].map((anim, i) => (
              <Animated.View
                key={i}
                style={{
                  opacity: anim,
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#6B7280',
                }}
              />
            ))}
          </HStack>
        </HStack>
      </VStack>

      {/* ── Input-platshållare ────────────────────────────────────────── */}
      <SkeletonBlock w="100%" h={52} rounded={16} />
      <SkeletonBlock w="100%" h={52} rounded={16} />

    </VStack>
  );
}
