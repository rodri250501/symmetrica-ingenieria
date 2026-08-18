// ============================================================
// useAuth — Autenticación y estado del usuario
// ============================================================
// Todo lo relacionado a login/registro/logout vive acá. isAdmin
// se deriva del campo "role" guardado en Firestore
// (users/{uid}.role === 'admin'); las Firestore Security Rules
// son las que de verdad hacen cumplir ese rol del lado del
// servidor — este composable solo refleja ese dato en la UI.
//
// Este archivo NO sabe nada de rutas ni de programas. Si algo
// necesita reaccionar a un logout (como volver al home), eso se
// resuelve en app.js con un watch() sobre `user`, no aquí.
// ============================================================

import { auth, db, provider } from '../core/firebase-config.js';
import {
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const { ref, computed } = Vue;

export function useAuth() {
    const user = ref(null);
    const showLogin = ref(false);
    const showRegister = ref(false);
    const loginEmail = ref('');
    const loginPassword = ref('');
    const registerEmail = ref('');
    const registerPassword = ref('');

    const isAdmin = computed(() => {
        return !!(user.value && user.value.userData && user.value.userData.role === 'admin');
    });

    const loginWithEmail = async () => {
        try {
            await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
            showLogin.value = false;
            loginEmail.value = '';
            loginPassword.value = '';
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    // Usa popup (no redirect) — ver nota en el commit "fix: google login"
    // sobre por qué signInWithRedirect fallaba con authDomain distinto
    // al dominio de hosting (vercel.app vs firebaseapp.com).
    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, provider);
            showLogin.value = false;
        } catch (e) {
            if (e.code === 'auth/popup-blocked') {
                alert('Tu navegador bloqueó la ventana emergente de Google. Habilita los pop-ups para este sitio e inténtalo de nuevo.');
            } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
                // El usuario cerró la ventana, no hace falta mostrar error.
            } else {
                alert('Error al iniciar con Google: ' + e.message);
            }
        }
    };

    const registerWithEmail = async () => {
        try {
            const cred = await createUserWithEmailAndPassword(auth, registerEmail.value, registerPassword.value);
            await setDoc(doc(db, "users", cred.user.uid), {
                email: registerEmail.value,
                purchasedTools: [],
                role: 'user',
                createdAt: serverTimestamp()
            });
            showRegister.value = false;
            registerEmail.value = '';
            registerPassword.value = '';
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const logout = async () => {
        await signOut(auth);
    };

    const switchToRegister = () => {
        showLogin.value = false;
        showRegister.value = true;
    };

    const switchToLogin = () => {
        showRegister.value = false;
        showLogin.value = true;
    };

    onAuthStateChanged(auth, async (authUser) => {
        if (authUser) {
            const userDoc = await getDoc(doc(db, "users", authUser.uid));
            let userData = {};
            if (!userDoc.exists()) {
                await setDoc(doc(db, "users", authUser.uid), {
                    email: authUser.email,
                    purchasedTools: [],
                    role: 'user',
                    createdAt: serverTimestamp()
                });
                userData = { purchasedTools: [], role: 'user' };
            } else {
                userData = userDoc.data();
            }
            user.value = { ...authUser, userData };
        } else {
            user.value = null;
        }
    });

    return {
        user, isAdmin,
        showLogin, showRegister,
        loginEmail, loginPassword, registerEmail, registerPassword,
        loginWithEmail, loginWithGoogle, registerWithEmail, logout,
        switchToRegister, switchToLogin
    };
}
