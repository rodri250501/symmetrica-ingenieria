// ============================================================
// CONFIG CENTRAL DE FIREBASE
// ============================================================
// Todo el resto del código importa `auth`, `db` y `provider`
// desde aquí. NUNCA debe haber una segunda llamada a
// initializeApp() en ningún otro archivo del proyecto.
// ============================================================

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCt_Nas76jJSMjqhsNj1V9MXKxwcIDB2lQ",
    authDomain: "symmetrica-ingenieria.firebaseapp.com",
    projectId: "symmetrica-ingenieria",
    storageBucket: "symmetrica-ingenieria.firebasestorage.app",
    messagingSenderId: "761818327436",
    appId: "1:761818327436:web:d907fb1a8012706a250ea9",
    measurementId: "G-VJMSWR95CC"
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const provider = new GoogleAuthProvider();
