import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { Linking, Image as RNImage } from 'react-native';
import { Box, Button, ButtonText, HStack, Icon, Text, VStack } from '@gluestack-ui/themed';
import { Play, Pause, ExternalLink } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

type Props = {
  title: string;
  artist: string;
  year?: number;                   // Visas i meta-blocket efter reveal
  artworkUrl?: string;
  previewUrl: string;
  externalUrl?: string;
  hideMeta?: boolean;              // Dölj artist/titel/år före reveal
  blurArtwork?: boolean;           // Blurrar artwork före reveal (eller vid fel)
  allowExternalWhenHidden?: boolean; // “Öppna” är klickbar även när meta är gömd
};

export type PreviewCardFrontHandle = { stop: () => Promise<void> };

const PreviewCardFront = forwardRef<PreviewCardFrontHandle, Props>(
  (
    {
      title,
      artist,
      year,
      artworkUrl,
      previewUrl,
      externalUrl,
      hideMeta = false,
      blurArtwork = false,
      allowExternalWhenHidden = false,
    },
    ref
  ) => {
    const player = useAudioPlayer();
    const status = useAudioPlayerStatus(player);

    // Ladda/byt ljudkälla
    useEffect(() => {
      player.replace({ uri: previewUrl });
      return () => {
        try { player.remove(); } catch {}
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewUrl]);

    // Exponera stop() till förälder
    useImperativeHandle(ref, () => ({
      stop: async () => {
        try {
          player.pause();
          player.seekTo(0);
        } catch {}
      },
    }));

    const onPlayPause = () => {
      if (status.playing) {
        player.pause();
      } else {
        player.seekTo(0);
        player.play();
      }
    };

    const openExternal = () => {
      if (externalUrl) Linking.openURL(externalUrl).catch(() => {});
    };

    const showExternalBtn = !!externalUrl && (!hideMeta || allowExternalWhenHidden);

    return (
      <Box
        p="$5"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$borderLight300"
        bg="$backgroundLight50"
        sx={{ _dark: { borderColor: '$borderDark700', bg: '$backgroundDark900' } }}
      >
        <VStack space="md" alignItems="center">
          {/* Artwork (blurbar) */}
          {artworkUrl ? (
            <RNImage
              source={{ uri: artworkUrl }}
              style={{ width: 180, height: 180, borderRadius: 12 }}
              // RN stödjer blurRadius på iOS/Android
              {...(blurArtwork ? { blurRadius: 14 } as any : {})}
            />
          ) : (
            <Box
              w={180}
              h={180}
              borderRadius={12}
              bg="$backgroundLight200"
              sx={{ _dark: { bg: '$backgroundDark700' } }}
              alignItems="center"
              justifyContent="center"
            >
              <Text>{hideMeta ? '🎧 Förhandslyssning' : 'Ingen bild'}</Text>
            </Box>
          )}

          {/* Meta: visas ENDAST efter reveal */}
          {!hideMeta && (
            <VStack alignItems="center" space="xs">
              <Text bold size="lg">{artist}</Text>
              <Text>{title}</Text>
              {typeof year === 'number' && (
                <Text bold size="xl">{year}</Text>
              )}
            </VStack>
          )}

          {/* Kontroller */}
          <HStack space="md">
            <Button onPress={onPlayPause}>
              <Icon as={status.playing ? Pause : Play} mr="$2" color="$white" />
              <ButtonText>{status.playing ? 'Pausa' : 'Spela 30s'}</ButtonText>
            </Button>

            {showExternalBtn && (
              <Button variant="outline" onPress={openExternal}>
                <Icon as={ExternalLink} mr="$2" />
                <ButtonText>{hideMeta ? 'Öppna låt' : 'Öppna'}</ButtonText>
              </Button>
            )}
          </HStack>
        </VStack>
      </Box>
    );
  }
);

export default PreviewCardFront;
