// Firebase configuration for Gracia Divina POS
// Project: gracia-divina-c70c6
//
// IMPORTANTE: Reemplaza los valores de apiKey, messagingSenderId y appId
// con las credenciales reales de tu proyecto Firebase.
// Puedes encontrarlas en: Firebase Console > Configuración del proyecto > General

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "gracia-divina-c70c6.firebaseapp.com",
  projectId: "gracia-divina-c70c6",
  storageBucket: "gracia-divina-c70c6.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxxxx",
  databaseURL: "https://gracia-divina-c70c6-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore - base de datos principal para productos, ventas, apartados, dueñas y config
export const db = getFirestore(app);

// Firebase Authentication
export const auth = getAuth(app);

// Realtime Database - para contadores y stats en tiempo real
export const rtdb = getDatabase(app);

export default app;
