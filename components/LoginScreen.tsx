// File: components/LoginScreen.tsx
// =============================
import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';

// Gluestack UI
import { Text, Button, ButtonText, Heading, Input, InputField, VStack, Center } from '@gluestack-ui/themed';

import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import type { GoogleAuthRequestConfig } from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { continueAnonymously } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 🚦 Expo Go/Dev Client vs riktig APK/AAB
  const isExpoGo = Constants.appOwnership === 'expo';

  // 🔑 Google WEB client (används både i dev och prod med HTTPS redirect)
  const WEB_CLIENT_ID = '614824946458-t1i0kmeou1s9nrfngo5k0f7mm8t1ll7v.apps.googleusercontent.com';

  // 🌐 HTTPS App Link host (Firebase Hosting)
  const APP_LINK_HOST = 'musikquiz-app.web.app';
  const HTTPS_REDIRECT_URI = `https://${APP_LINK_HOST}/oauth2redirect/google`;

  // Debug
  console.log('[Auth] appOwnership =', Constants.appOwnership);
  console.log('[Auth] using WEB_CLIENT_ID =', WEB_CLIENT_ID);
  console.log('[Auth] HTTPS redirect =', HTTPS_REDIRECT_URI);

  const baseConfig: Partial<GoogleAuthRequestConfig> = {
    responseType: 'id_token',
    scopes: ['openid', 'profile', 'email'] as string[],
  };

  // ✅ I Expo Go använder vi appens egna scheme; i riktig app använder vi HTTPS App Link
  const googleConfig: Partial<GoogleAuthRequestConfig> = isExpoGo
    ? {
        ...baseConfig,
        clientId: WEB_CLIENT_ID,
        redirectUri: makeRedirectUri({ scheme: 'musikquiz' }),
      }
    : {
        ...baseConfig,
        clientId: WEB_CLIENT_ID,
        redirectUri: HTTPS_REDIRECT_URI,
      };

  const [request, response, promptAsync] = useAuthRequest(googleConfig);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params as { id_token?: string };
      if (id_token) {
        const credential = GoogleAuthProvider.credential(id_token);
        signInWithCredential(auth, credential).catch((e) =>
          setError('Fel: ' + ((e as any)?.code ?? 'unknown'))
        );
      } else {
        setError('Saknar id_token i Google-svaret.');
      }
    } else if (response?.type === 'error') {
      console.log('[Auth] Google response error:', response);
      setError('Google-inloggning misslyckades. Försök igen.');
    }
  }, [response]);

  // 🔎 Debug: logga vilken redirectUri providern faktiskt använder
  useEffect(() => {
    if (request?.redirectUri) {
      console.log('[Auth] resolved redirectUri =', request.redirectUri);
    }
  }, [request]);

  const handleAuthAction = async (action: 'signIn' | 'signUp') => {
    setLoading(true);
    setError('');
    try {
      if (action === 'signIn') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError('Fel: ' + e.code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center flex={1} px="$4">
      <VStack space="lg" alignItems="center" w="$full" maxWidth={400}>
        <Heading size="2xl">🎵 Musikquiz</Heading>

        <Input variant="outline" size="lg" w="$full">
          <InputField placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </Input>
        <Input variant="outline" size="lg" w="$full">
          <InputField placeholder="Lösenord" value={password} onChangeText={setPassword} secureTextEntry />
        </Input>

        {error ? <Text color="$red700" mt="$2">{error}</Text> : null}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          <VStack space="md" w="$full" mt="$4">
            <Button onPress={() => handleAuthAction('signIn')}><ButtonText>Logga in</ButtonText></Button>
            <Button onPress={() => handleAuthAction('signUp')} variant="outline"><ButtonText>Registrera konto</ButtonText></Button>
            <Button isDisabled={!request} onPress={() => promptAsync()} variant="solid" action="secondary">
              <ButtonText>Logga in med Google</ButtonText>
            </Button>
            <Button onPress={continueAnonymously} variant="link" mt="$8">
              <ButtonText color="$textLight500">Fortsätt utan att logga in (Test)</ButtonText>
            </Button>
          </VStack>
        )}
      </VStack>
    </Center>
  );
}