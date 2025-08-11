// =============================
// File: firebase/firebase.ts (projektets rot/firebase)
// =============================
import { initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBeklt5CHuwSdQDuUhemOihy2mkciy6bSk',
  authDomain: 'musikquiz-app.firebaseapp.com',
  projectId: 'musikquiz-app',
  storageBucket: 'musikquiz-app.firebasestorage.app',
  messagingSenderId: '614824946458',
  appId: '1:614824946458:web:2e5d97b8b3cbab1e81daa3',
  measurementId: 'G-98J92XW6HL',
};

// Init Firebase App
export const app = initializeApp(firebaseConfig);

// special-lösning för RN-persistens
export const auth = firebaseAuth.initializeAuth(app, {
  persistence: (firebaseAuth as any).getReactNativePersistence(AsyncStorage),
});

//re-exportera auth-API för bekväma imports
export { firebaseAuth };
