// ============================================================
// usePrograms — Catálogo, navegación y CRUD admin de programas
// ============================================================
// Recibe `userRef` (el ref de useAuth) y `isSubscribedRef` (computed
// de useSubscriptions) para resolver si el usuario actual tiene
// acceso a un programa: o lo compró suelto, o tiene una suscripción
// activa (anual vigente o perpetua) — en cuyo caso tiene acceso a
// TODOS los programas, incluidos los que se agreguen después, sin
// que este archivo necesite saber nada más sobre cómo funcionan las
// suscripciones.
// ============================================================

import { db } from '../core/firebase-config.js';
import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    serverTimestamp, query, orderBy, onSnapshot
} from "firebase/firestore";
import { observeCards } from '../core/ui-helpers.js';
import { buildDemoHtml } from '../core/demo-lock.js';

const { ref, computed, nextTick } = Vue;

export function usePrograms(userRef, isSubscribedRef) {
    const programs = ref([]);
    const currentRoute = ref('home');
    const currentProgramId = ref(null);
    const isDemoView = ref(false);
    const adminTab = ref('programs');
    const showProgramForm = ref(false);
    const editingProgram = ref({ id: '', name: '', description: '', price: 20, icon: '📐', html: '', demo: false });

    const currentProgram = computed(() => {
        return programs.value.find(p => p.id === currentProgramId.value);
    });

    const programIframeSrcdoc = computed(() => {
        const prog = currentProgram.value;
        if (!prog) return '';
        if (isDemoView.value && !isUnlocked(prog.id)) {
            return buildDemoHtml(prog.html || '');
        }
        return prog.html || '';
    });

    // Acceso si: (a) el programa está en purchasedTools, o (b) el
    // usuario tiene una suscripción activa (anual vigente o perpetua),
    // que da acceso a todo el catálogo automáticamente.
    const isUnlocked = (programId) => {
        if (isSubscribedRef && isSubscribedRef.value) return true;
        if (!userRef.value) return false;
        const userData = userRef.value.userData;
        return userData && userData.purchasedTools && userData.purchasedTools.includes(programId);
    };

    const goHome = () => {
        currentRoute.value = 'home';
        currentProgramId.value = null;
        isDemoView.value = false;
        nextTick(() => observeCards());
    };

    const openProgram = (programId) => {
        if (isUnlocked(programId)) {
            currentProgramId.value = programId;
            currentRoute.value = 'program';
            isDemoView.value = false;
        } else {
            alert('No tienes acceso a este programa. Solicita acceso o suscríbete.');
        }
    };

    const openProgramDemo = (programId) => {
        currentProgramId.value = programId;
        currentRoute.value = 'program';
        isDemoView.value = true;
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
                    html: p.html,
                    demo: !!p.demo
                });
                alert('✅ Programa actualizado correctamente.');
            } else {
                await addDoc(collection(db, "programs"), {
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    icon: p.icon,
                    html: p.html,
                    demo: !!p.demo,
                    createdAt: serverTimestamp()
                });
                alert('✅ Programa creado exitosamente.');
            }
            showProgramForm.value = false;
            editingProgram.value = { id: '', name: '', description: '', price: 20, icon: '📐', html: '', demo: false };
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
        isDemoView, programIframeSrcdoc,
        adminTab, showProgramForm, editingProgram,
        isUnlocked, goHome, openProgram, openProgramDemo,
        loadPrograms, saveProgram, editProgram, deleteProgram
    };
}
