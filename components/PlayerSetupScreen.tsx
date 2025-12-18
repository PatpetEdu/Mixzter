import React, { useState, useRef } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, NativeSyntheticEvent, NativeScrollEvent, Animated, ScrollView } from 'react-native';
import { VStack, Heading, Input, InputField, Button, ButtonText, Center, Text, HStack } from '@gluestack-ui/themed';

type Props = {
 onStart: (player1: string, player2: string, gameMode: string) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  headerHeight: number;
};

// En lista över tillgängliga modes för att generera knappar
const GAME_MODES = [
  { id: 'default', label: 'Blandat 1950-2025' },
  { id: 'svenska', label: 'Svenska Hits 1960-2025' },
  { id: 'eurovision', label: 'Eurovision 1956-2025' },
  { id: 'rock', label: 'Rock/Metal 1960-2025' },
  { id: 'onehitwonder', label: 'One Hit Wonders 1970-2015' },
];

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function PlayerSetupScreen({ onStart, onScroll, headerHeight }: Props) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [selectedMode, setSelectedMode] = useState('default'); // ⬅️ State för vald mode
  const [error, setError] = useState('');
  const player2InputRef = useRef<TextInput>(null);

  const handleStart = () => {
    if (!player1.trim() || !player2.trim()) {
      setError('Ange namn för båda spelarna.');
      return;
    }
    setError('');
    // 👇 Skicka med selectedMode
    onStart(player1.trim(), player2.trim(), selectedMode);
  };

  const isFormValid = player1.trim() !== '' && player2.trim() !== '';

 return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AnimatedScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: headerHeight
        }}
      >
        <Center px="$6">
          <VStack w="$full" maxWidth={420} space="lg">
            <Heading size="xl" textAlign="center">👥 Nytt Spel</Heading>
            
            {/* --- VAL AV SPELARE --- */}
            <VStack space="md">
                <Text size="sm" bold>Spelare</Text>
                <Input>
                <InputField
                    placeholder="Spelare 1"
                    value={player1}
                    onChangeText={setPlayer1}
                    // ... (samma props som förut)
                />
                </Input>
                <Input>
                <InputField
                    // ... (samma props som förut)
                    value={player2}
                    onChangeText={setPlayer2}
                />
                </Input>
            </VStack>

            {/* --- VAL AV KATEGORI --- */}
            <VStack space="md">
                <Text size="sm" bold>Välj kategori</Text>
                <HStack space="sm" flexWrap="wrap">
                    {GAME_MODES.map((mode) => (
                        <Button
                            key={mode.id}
                            size="sm"
                            variant={selectedMode === mode.id ? 'solid' : 'outline'}
                            action={selectedMode === mode.id ? 'primary' : 'secondary'}
                            onPress={() => setSelectedMode(mode.id)}
                            mb="$2"
                        >
                            <ButtonText>{mode.label}</ButtonText>
                        </Button>
                    ))}
                </HStack>
            </VStack>

            {error ? <Text color="$error700" textAlign="center">{error}</Text> : null}
            
            <Button onPress={handleStart} isDisabled={!isFormValid} size="lg" mt="$4">
              <ButtonText>Starta spel</ButtonText>
            </Button>
          </VStack>
        </Center>
      </AnimatedScrollView>
    </KeyboardAvoidingView>
  );
}
