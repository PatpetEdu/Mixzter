import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Box, HStack, useColorMode } from '@gluestack-ui/themed';

const AnimatedBox = Animated.createAnimatedComponent(Box);

const Bar = ({ index }: { index: number }) => {
  const colorMode = useColorMode();
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slumpmässiga värden för att göra animationen mer organisk
    const randomDuration1 = 300 + Math.random() * 200;
    const randomDuration2 = 400 + Math.random() * 200;
    const delay = index * 60;

    const barAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: randomDuration1,
          easing: Easing.bezier(0.42, 0, 0.58, 1), // Mjukare rörelse
          useNativeDriver: false,
          delay,
        }),
        Animated.timing(animation, {
          toValue: 0.1, // Går aldrig ner till noll
          duration: randomDuration2,
          easing: Easing.bezier(0.42, 0, 0.58, 1),
          useNativeDriver: false,
        }),
      ])
    );
    barAnimation.start();
    return () => barAnimation.stop();
  }, [animation, index]);

  const height = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['10%', '100%'],
  });

  // Ändra färg till vit/svart baserat på tema
  const barColor = colorMode === 'dark' ? '$textLight50' : '$textLight900';

  return <AnimatedBox w={6} bg={barColor} borderRadius="$full" style={{ height }} />;
};

export default function AudioVisualizer() {
  // Skapa en array för att enkelt rendera flera staplar
  const bars = Array.from({ length: 15 }); // Fler staplar för att göra den bredare

  return (
    // Lägre höjd och mindre mellanrum
    <HStack h={60} w="$full" space="xs" alignItems="center" justifyContent="center">
      {bars.map((_, index) => (
        <Bar key={index} index={index} />
      ))}
    </HStack>
  );
}
