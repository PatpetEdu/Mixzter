import React, { useEffect } from 'react';
import { Animated, View } from 'react-native';
import CardFront from './CardFront';
import CardBack from './CardBack';

interface Props {
  showBack: boolean;
  card?: {
    artist: string;
    title: string;
    year: number;
    spotifyUrl?: string;
  } | null;
  onFlip?: () => void;
  showFlipButton?: boolean;
}

export default function AnimatedCard({ showBack, card, onFlip, showFlipButton = true }: Props) {
  const flipAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: showBack ? 1 : 0,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [showBack, flipAnim]);

  // Interpolate the rotation for Y axis (3D flip effect)
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  // For determining visibility - flip at halfway point
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  if (!card) return null;

  return (
    <View style={{ width: '100%' }}>
      {/* Front Card */}
      <Animated.View
        style={{
          opacity: frontOpacity,
          transform: [
            {
              rotateY: frontRotateY,
            },
          ],
        } as any}
      >
        <CardFront spotifyUrl={card.spotifyUrl || ''} onFlip={onFlip || (() => {})} showFlipButton={showFlipButton} />
      </Animated.View>

      {/* Back Card */}
      <Animated.View
        style={{
          opacity: backOpacity,
          transform: [
            {
              rotateY: backRotateY,
            },
          ],
          position: 'absolute',
          width: '100%',
          top: 0,
          left: 0,
        } as any}
        pointerEvents={showBack ? 'auto' : 'none'}
      >
        <CardBack artist={card.artist} title={card.title} year={String(card.year)} onFlip={onFlip || (() => {})} />
      </Animated.View>
    </View>
  );
}
