// Firebase configuration for Gracia Divina POS
// Project: gracia-divina-c70c6
//
// IMPORTANTE: Reemplaza los valores de apiKey, messagingSenderId y appId
// con las credenciales reales de tu proyecto Firebase.
// Puedes encontrarlas en: Firebase Console > Configuración del proyecto > General
//
// Este proyecto usa Firebase Realtime Database (NO Firestore) para sincronización
// URL de la base de datos: https://gracia-divina-c70c6-default-rtdb.firebaseio.com

import { initializeApp } from 'firebase/app';
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
  databaseURL: "https://gracia-divina-c70c6-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication - requerido para las reglas de seguridad
export const auth = getAuth(app);

// Firebase Realtime Database - base de datos principal para:
// - productos
// - ventas
// - apartados
// - duenas
// - config
export const rtdb = getDatabase(app);

export default app;
