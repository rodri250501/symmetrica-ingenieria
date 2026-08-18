// ============================================================
// usePrograms — Catálogo, navegación y CRUD admin de programas
// ============================================================
// Recibe `userRef` (el ref de useAuth) para poder resolver si el
// usuario actual tiene acceso a un programa. Así este archivo no
// necesita saber CÓMO funciona el login, solo lee el mismo ref
// reactivo que ya existe — no crea su propia copia del usuario.
//
// Los "programas" siguen viviendo como documentos en Firestore
// (colección `programs`, campo `html` con el código completo de
// la herramienta). Añadir el programa #20 sigue sin tocar este
// archivo: se hace desde el panel admin en producción.
// ============================================================

import { db } from '../core/firebase-config.js';
import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    serverTimestamp, query, orderBy, onSnapshot
} from "firebase/firestore";
import { observeCards } from '../core/ui-helpers.js';

const { ref, computed, nextTick } = Vue;

export function usePrograms(userRef) {
    const programs = ref([]);
    const currentRoute = ref('home');
    const currentProgramId = ref(null);
    const adminTab = ref('programs');
    const showProgramForm = ref(false);
    const editingProgram = ref({ id: '', name: '', description: '', price: 20, icon: '📐', html: '' });

    const currentProgram = computed(() => {
        return programs.value.find(p => p.id === currentProgramId.value);
    });

    const isUnlocked = (programId) => {
        if (!userRef.value) return false;
        const userData = userRef.value.userData;
        return userData && userData.purchasedTools && userData.purchasedTools.includes(programId);
    };

    const goHome = () => {
        currentRoute.value = 'home';
        currentProgramId.value = null;
        nextTick(() => observeCards());
    };

    const openProgram = (programId) => {
        if (isUnlocked(programId)) {
            currentProgramId.value = programId;
            currentRoute.value = 'program';
        } else {
            alert('No tienes acceso a este programa. Solicita acceso primero.');
        }
    };

    const loadPrograms = () => {
        const q = query(collection(db, "programs"), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            programs.value = [];
            snapshot.forEach(d => programs.value.push({ id: d.id, ...d.data() }));
            nextTick(() => observeCards());
        });
    };

    const saveProgram = async () => {
        const p = editingProgram.value;
        if (!p.name || !p.html) {
            alert('❌ El nombre y el HTML son obligatorios.');
            return;
        }
        try {
            if (p.id) {
                await updateDoc(doc(db, "programs", p.id), {
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    icon: p.icon,
                    html: p.html
                });
                alert('✅ Programa actualizado correctamente.');
            } else {
                await addDoc(collection(db, "programs"), {
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    icon: p.icon,
                    html: p.html,
                    createdAt: serverTimestamp()
                });
                alert('✅ Programa creado exitosamente.');
            }
            showProgramForm.value = false;
            editingProgram.value = { id: '', name: '', description: '', price: 20, icon: '📐', html: '' };
        } catch (e) {
            alert('❌ Error al guardar: ' + e.message);
        }
    };

    const editProgram = (program) => {
        editingProgram.value = { ...program };
        showProgramForm.value = true;
    };

    const deleteProgram = async (id) => {
        if (!confirm('¿Eliminar este programa permanentemente?')) return;
        try {
            await deleteDoc(doc(db, "programs", id));
            alert('✅ Programa eliminado.');
        } catch (e) {
            alert('❌ Error al eliminar: ' + e.message);
        }
    };

    return {
        programs, currentRoute, currentProgramId, currentProgram,
        adminTab, showProgramForm, editingProgram,
        isUnlocked, goHome, openProgram,
        loadPrograms, saveProgram, editProgram, deleteProgram
    };
}
