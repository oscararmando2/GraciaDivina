// Firebase configuration for Gracia Divina POS
// Project: gracia-divina-c70c6
//
// Este proyecto usa Firebase Realtime Database (NO Firestore) para sincronización
// URL de la base de datos: https://gracia-divina-c70c6-default-rtdb.firebaseio.com

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBagLJ4kGy9LepoGqUJ7mirAhC2uflaoAs",
  authDomain: "gracia-divina-c70c6.firebaseapp.com",
  databaseURL: "https://gracia-divina-c70c6-default-rtdb.firebaseio.com",
  projectId: "gracia-divina-c70c6",
  storageBucket: "gracia-divina-c70c6.firebasestorage.app",
  messagingSenderId: "395608568512",
  appId: "1:395608568512:web:d8ec5e698d0905082a7325",
  measurementId: "G-GDGLYHRKPJ"
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
