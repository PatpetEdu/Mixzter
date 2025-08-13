import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Box,
  Center,
  VStack,
  HStack,
  Heading,
  Text,
  Link,
  Divider,
  Button,
  ButtonText,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  Input,
  InputField,
  InputSlot,
  InputIcon,
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
  Icon,
} from '@gluestack-ui/themed';
import { EyeIcon, EyeOffIcon, GlobeIcon, CheckIcon } from '@gluestack-ui/themed';
import { Chrome } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import type { GoogleAuthRequestConfig } from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';

WebBrowser.maybeCompleteAuthSession();
// Props to allow hosting component (App.tsx) to navigate to Signup
export type LoginScreenProps = { onGoToSignup: () => void; };

export default function LoginScreen({ onGoToSignup }: LoginScreenProps) {
  const { continueAnonymously } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
   // 🚦 Expo Go/Dev Client vs riktig APK/AAB
  const isExpoGo = Constants.appOwnership === 'expo';
   // 🔑 Google WEB client (används både i dev och prod med HTTPS redirect)
  const WEB_CLIENT_ID = '614824946458-t1i0kmeou1s9nrfngo5k0f7mm8t1ll7v.apps.googleusercontent.com';
     // 🌐 HTTPS App Link host (Firebase Hosting)
  const APP_LINK_HOST = 'musikquiz-app.web.app';
  const HTTPS_REDIRECT_URI = `https://${APP_LINK_HOST}/oauth2redirect/google`;
  
    // Remember Me: spara e-post lokalt när aktiverat
  const REMEMBER_KEY = 'auth.remember';
  const REMEMBER_EMAIL_KEY = 'auth.email';

  useEffect(() => {
    (async () => {
      try {
        const remember = await AsyncStorage.getItem(REMEMBER_KEY);
        const savedEmail = await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
        if (remember === '1') {
          setRememberMe(true);
          if (savedEmail) setEmail(savedEmail);
        } else {
          setRememberMe(false);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (rememberMe) {
          await AsyncStorage.setItem(REMEMBER_KEY, '1');
          await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email);
        } else {
          await AsyncStorage.removeItem(REMEMBER_KEY);
          await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {}
    })();
  }, [rememberMe, email]);

  const baseConfig: Partial<GoogleAuthRequestConfig> = useMemo(
    () => ({ responseType: 'id_token', scopes: ['openid', 'profile', 'email'] as string[] }),
    []
  );
 // ✅ I Expo Go använder vi appens egna scheme; i riktig app använder vi HTTPS App Link
  const googleConfig: Partial<GoogleAuthRequestConfig> = isExpoGo
    ? { ...baseConfig, clientId: WEB_CLIENT_ID, redirectUri: makeRedirectUri({ scheme: 'musikquiz' }) }
    : { ...baseConfig, clientId: WEB_CLIENT_ID, redirectUri: HTTPS_REDIRECT_URI };

  const [request, response, promptAsync] = useAuthRequest(googleConfig);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params as { id_token?: string };
      if (id_token) {
        const credential = GoogleAuthProvider.credential(id_token);
        const wasAnon = !!auth.currentUser?.isAnonymous;
        signInWithCredential(auth, credential)
          .then(async () => {
            if (wasAnon) {
              try { await AsyncStorage.removeItem('duoSeenSongsHistory'); } catch {}
            }
          })
          .catch((e) => setError('Fel: ' + ((e as any)?.code ?? 'unknown')));
      } else {
        setError('Saknar id_token i Google-svaret.');
      }
    } else if (response?.type === 'error') {
      setError('Google-inloggning misslyckades. Försök igen.');
    }
  }, [response]);

  const doEmailSignIn = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
       // RN uses persistent auth by default. The checkbox is UI-only for now.
    } catch (e: any) {
      setError('Fel: ' + e.code);
    } finally {
      setLoading(false);
    }
  };

  const doResetPassword = async () => {
    try {
      setError('');
      setInfo('');
      const em = email.trim();
      if (!em) {
        setError('Fyll i din e-post för återställning.');
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
        setError('Ogiltig e-postadress.');
        return;
      }
      await sendPasswordResetEmail(auth, em, {
        url: 'https://musikquiz-app.web.app',
        handleCodeInApp: false,
      });
      setInfo('Återställningslänk skickad till din e-post.');
      Alert.alert('Skickat', 'Vi har skickat en återställningslänk till din e-post.');
    } catch (e: any) {
      console.error('sendPasswordResetEmail error:', e);
      const msg = e?.code ? `${e.code}: ${e.message ?? ''}` : String(e);
      setError('Kunde inte skicka återställningslänk: ' + msg);
      Alert.alert('Fel', `Kunde inte skicka återställningslänk.\n${msg}`);
    }
  };

  return (
    <Center flex={1} px="$4" bg="#0b0b0c">
      <Box
        w="$full"
        maxWidth={480}
        px="$6"
        py="$8"
        bg="#111216"
        borderRadius={16}
        borderWidth={1}
        borderColor="#ffffff"
      >
        <VStack space="lg" w="$full">
          <Heading size="xl" color="#fff">Login to your account</Heading>
          <HStack alignItems="center" space="xs">
            <Text color="#9ca3af">Don’t have an account?</Text>
            <Link onPress={onGoToSignup}><Text color="#fff">Sign up</Text></Link>
          </HStack>

           {/* Email */}
          <FormControl isRequired>
            <FormControlLabel>
              <FormControlLabelText color="#e5e7eb">Email</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField placeholder="abc@gmail.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} color="#fff" placeholderTextColor="#9ca3af" />
            </Input>
          </FormControl>

             {/* Password */}
          <FormControl isRequired>
            <FormControlLabel>
              <FormControlLabelText color="#e5e7eb">Password</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField placeholder="Enter password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} color="#fff" placeholderTextColor="#9ca3af" />
              <InputSlot pr="$3" onPress={() => setShowPassword((s) => !s)}>
                <InputIcon as={showPassword ? EyeOffIcon : EyeIcon} color="#9ca3af"/>
              </InputSlot>
            </Input>
          </FormControl>

            {/* Remember + Forgot */}
          <HStack alignItems="center">
            <Checkbox value="remember" isChecked={rememberMe} onChange={() => setRememberMe((v) => !v)} aria-label="Remember me">
              <CheckboxIndicator mr="$2">
                <CheckboxIcon as={CheckIcon} />
              </CheckboxIndicator>
              <CheckboxLabel color="#e5e7eb">Remember me</CheckboxLabel>
            </Checkbox>
            <Button variant="link" onPress={doResetPassword} ml="auto" pl="$2">
              <ButtonText color="#fff">Forgot Password?</ButtonText>
            </Button>
          </HStack>

           {/* Errors & info */}
          {error ? <Text color="#f87171">{error}</Text> : null}
          {info ? <Text color="#34d399">{info}</Text> : null}

             {/* Primary action */}
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Button onPress={doEmailSignIn} bg="#1f2937" borderColor="#ffffff" borderWidth={1}>
              <ButtonText color="#fff">Login</ButtonText>
            </Button>
          )}

            {/* Divider */}
          <HStack alignItems="center" space="sm">
            <Divider bg="#1f2937" flex={1} />
            <Text color="#9ca3af">OR CONTINUE WITH</Text>
            <Divider bg="#1f2937" flex={1} />
          </HStack>

          <HStack space="md" justifyContent="center">
            <Button isDisabled={!request} onPress={() => promptAsync()} variant="outline" borderColor="#ffffff">
              <HStack space="sm" alignItems="center">
                <Icon as={Chrome} color="#fff" />
                <ButtonText color="#fff">Google</ButtonText>
              </HStack>
            </Button>
          </HStack>

          <Button onPress={continueAnonymously} variant="link" mt="$2">
            <ButtonText color="#9ca3af">Fortsätt utan att logga in (Test)</ButtonText>
          </Button>
        </VStack>
      </Box>
    </Center>
  );
}