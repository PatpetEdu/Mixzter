import React, { useState, useRef } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, ScrollView } from 'react-native';
import { VStack, Heading, Input, InputField, Button, ButtonText, Center, Text } from '@gluestack-ui/themed';

type Props = {
  onStart: (player1: string, player2: string) => void;
};

export default function PlayerSetupScreen({ onStart }: Props) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [error, setError] = useState('');
  const player2InputRef = useRef<TextInput>(null);

  const handleStart = () => {
    if (!player1.trim() || !player2.trim()) {
      setError('Ange namn för båda spelarna.');
      return;
    }
    setError('');
    onStart(player1.trim(), player2.trim());
  };

  const isFormValid = player1.trim() !== '' && player2.trim() !== '';

  return (
    // Använd en ScrollView för att säkerställa att tangentbordet inte täcker input-fälten
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Center px="$6">
          <VStack w="$full" maxWidth={420} space="lg">
            <Heading size="xl" textAlign="center">👥 Duo-läge – Lag/Namn</Heading>

            <Input>
              <InputField
                placeholder="Spelare 1"
                value={player1}
                onChangeText={setPlayer1}
                returnKeyType="next"
                onSubmitEditing={() => player2InputRef.current?.focus()}
                blurOnSubmit={false}
                autoFocus
                accessibilityLabel="Spelare 1"
              />
            </Input>

            <Input>
              <InputField
                ref={player2InputRef as any}
                placeholder="Spelare 2"
                value={player2}
                onChangeText={setPlayer2}
                returnKeyType="done"
                onSubmitEditing={handleStart}
                accessibilityLabel="Spelare 2"
              />
            </Input>

            {error ? <Text color="$error700" textAlign="center">{error}</Text> : null}

            <Button onPress={handleStart} isDisabled={!isFormValid}>
              <ButtonText>Starta spel</ButtonText>
            </Button>
          </VStack>
        </Center>
      </KeyboardAvoidingView>
    </ScrollView>
  );
}