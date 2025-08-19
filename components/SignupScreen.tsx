// components/SignupScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import {
  Box,
  Center,
  VStack,
  HStack,
  Heading,
  Text,
  Link,
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
  Image,
} from '@gluestack-ui/themed';
import { EyeIcon, EyeOffIcon, CheckIcon } from '@gluestack-ui/themed';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';

export type SignupScreenProps = { onGoToLogin: () => void };

export default function SignupScreen({ onGoToLogin }: SignupScreenProps) {
  const { continueAnonymously } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const MIXZTER_LOGO = require('../assets/mixzter-icon-1024.png');

  // Responsiv ram endast på ≥ 380dp
  const [isWide, setIsWide] = useState(Dimensions.get('window').width >= 380);
  useEffect(() => {
    const handler = ({ window }: { window: { width: number } }) => setIsWide(window.width >= 380);
    const sub = Dimensions.addEventListener('change', handler);
    return () => {
      // RN compat cleanup
      // @ts-ignore
      if (typeof sub?.remove === 'function') sub.remove();
      else {
        // @ts-ignore
        Dimensions.removeEventListener('change', handler);
      }
    };
  }, []);

  const validate = () => {
    if (!email.trim() || !password) return 'Fyll i e-post och lösenord';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'Ogiltig e-postadress';
    if (password.length < 6) return 'Lösenord måste vara minst 6 tecken';
    if (password !== confirm) return 'Lösenorden matchar inte';
    if (!acceptTerms) return 'Du måste godkänna villkoren';
    return '';
  };

  const doSignup = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
    } catch (e: any) {
      setError('Fel: ' + e.code);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    loading || !acceptTerms || !email.trim() || !password || !confirm ||
    password !== confirm || password.length < 6;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Center flex={1} px="$4" bg="#0b0b0c">
          <Box
            w="$full"
            maxWidth={520}
            px="$6"
            py="$8"
            bg="#111216"
            borderRadius={isWide ? 16 : 0}
            borderWidth={isWide ? 1 : 0}
            borderColor="#ffffff"
          >
            <VStack space="lg" pb="$10">
              <Center>
                <Image source={MIXZTER_LOGO} alt="MIXZTER" style={{ width: 96, height: 96, resizeMode: 'contain' }} />
              </Center>

              <Heading size="xl" color="#fff">
                Create an account
              </Heading>
              <HStack alignItems="center" space="xs">
                <Text color="#9ca3af">Already have an account?</Text>
                <Link onPress={onGoToLogin}>
                  <Text color="#fff">Sign in</Text>
                </Link>
              </HStack>

              {/* Display name (optional) */}
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText color="#e5e7eb">
                    Namn (visas i spelet)
                  </FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="Ex: Batman"
                    value={displayName}
                    onChangeText={setDisplayName}
                    color="#fff"
                    placeholderTextColor="#9ca3af"
                  />
                </Input>
              </FormControl>

              {/* Email */}
              <FormControl isRequired>
                <FormControlLabel>
                  <FormControlLabelText color="#e5e7eb">Email</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="abc@gmail.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    color="#fff"
                    placeholderTextColor="#9ca3af"
                  />
                </Input>
              </FormControl>

              {/* Password */}
              <FormControl isRequired>
                <FormControlLabel>
                  <FormControlLabelText color="#e5e7eb">Password</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="Minst 6 tecken"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    color="#fff"
                    placeholderTextColor="#9ca3af"
                  />
                  <InputSlot pr="$3" onPress={() => setShowPassword((s) => !s)}>
                    <InputIcon as={showPassword ? EyeOffIcon : EyeIcon} color="#9ca3af" />
                  </InputSlot>
                </Input>
              </FormControl>

              {/* Confirm password */}
              <FormControl isRequired>
                <FormControlLabel>
                  <FormControlLabelText color="#e5e7eb">Confirm password</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    secureTextEntry={!showPassword}
                    value={confirm}
                    onChangeText={setConfirm}
                    color="#fff"
                    placeholderTextColor="#9ca3af"
                  />
                </Input>
                {confirm && password && password !== confirm ? (
                  <Text color="#f87171" size="sm" mt="$1">Password doesn't match</Text>
                ) : null}
              </FormControl>

              {/* Terms checkbox (required) */}
              <Checkbox
                value="terms"
                isChecked={acceptTerms}
                onChange={() => setAcceptTerms((v) => !v)}
                aria-label="Accept terms"
              >
                <CheckboxIndicator mr="$2">
                  <CheckboxIcon as={CheckIcon} />
                </CheckboxIndicator>
                <CheckboxLabel color="#e5e7eb">
                  Jag godkänner användarvillkor & integritetspolicy
                </CheckboxLabel>
              </Checkbox>

              {/* Errors */}
              {error ? <Text color="#f87171">{error}</Text> : null}

              {/* Submit */}
              <Button
                onPress={doSignup}
                isDisabled={isSubmitDisabled}
                bg="#1f2937"
                borderColor="#ffffff"
                borderWidth={isWide ? 1 : 0}
              >
                <ButtonText color="#fff">
                  {loading ? 'Skapar konto…' : 'Skapa konto'}
                </ButtonText>
              </Button>

              {/* Anonym continue (tills vidare) */}
              <Button onPress={continueAnonymously} variant="link" mt="$2">
                <ButtonText color="#9ca3af">Fortsätt utan att logga in (Test)</ButtonText>
              </Button>
            </VStack>
          </Box>
        </Center>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
