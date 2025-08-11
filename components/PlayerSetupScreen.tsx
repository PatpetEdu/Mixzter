import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>👥 Duo-läge – Lag/Namn</Text>

      <TextInput
        style={styles.input}
        placeholder="Spelare 1"
        value={player1}
        onChangeText={setPlayer1}
        returnKeyType="next"
        onSubmitEditing={() => player2InputRef.current?.focus()}
        blurOnSubmit={false}
        autoFocus
        accessibilityLabel="Spelare 1"
      />

      <TextInput
        ref={player2InputRef}
        style={styles.input}
        placeholder="Spelare 2"
        value={player2}
        onChangeText={setPlayer2}
        returnKeyType="done"
        onSubmitEditing={handleStart}
        accessibilityLabel="Spelare 2"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Starta spel" onPress={handleStart} disabled={!isFormValid} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  error: {
    color: 'red',
    marginBottom: 12,
    textAlign: 'center',
  },
});
