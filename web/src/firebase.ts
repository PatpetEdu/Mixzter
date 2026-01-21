import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBeklt5CHuwSdQDuUhemOihy2mkciy6bSk',
  authDomain: 'musikquiz-app.firebaseapp.com',
  projectId: 'musikquiz-app',
  storageBucket: 'musikquiz-app.firebasestorage.app',
  messagingSenderId: '614824946458',
  appId: '1:614824946458:web:2e5d97b8b3cbab1e81daa3',
  measurementId: 'G-98J92XW6HL',
};

// Initiera Firebase
export const app = initializeApp(firebaseConfig);

// Firestore - samma som i main-appen
export const db = getFirestore(app);
