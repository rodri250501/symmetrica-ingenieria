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
    collection, doc, getDoc, writeBatch, deleteField,
    serverTimestamp, query, orderBy, onSnapshot
} from "firebase/firestore";
import { observeCards } from '../core/ui-helpers.js';
import { buildSafeDemoHtml } from '../core/demo-preview.js';
import { canAccessProgram, isFreeProgram } from '../core/program-access.mjs';

const { ref, computed, nextTick } = Vue;

export function usePrograms(userRef, isSubscribedRef) {
    const programs = ref([]);
    const currentRoute = ref('home');
    const currentProgramId = ref(null);
    const isDemoView = ref(false);
    const adminTab = ref('programs');
    const showProgramForm = ref(false);
    const editingProgram = ref({ id: '', name: '', description: '', price: 20, icon: '📐', html: '', demoHtml: '', demo: false });
    const programContentHtml = ref('');
    const programContentState = ref('idle');

    const currentProgram = computed(() => {
        return programs.value.find(p => p.id === currentProgramId.value);
    });

    const programIframeSrcdoc = computed(() => {
        const prog = currentProgram.value;
        if (!prog) return '';
        if (isDemoView.value) return prog.demoHtml || buildSafeDemoHtml(prog);
        if (programContentState.value === 'loading') return '<p style="font:16px system-ui;padding:24px">Cargando herramienta…</p>';
        if (programContentState.value !== 'ready') return '<p style="font:16px system-ui;padding:24px">No se pudo cargar la herramienta autorizada.</p>';
        return programContentHtml.value;
    });

    // Acceso público si el precio es cero; en los demás casos,
    // acceso si: (a) el programa está en purchasedTools, o (b) el
    // usuario tiene una suscripción activa (anual vigente o perpetua),
    // que da acceso a todo el catálogo automáticamente.
    const isUnlocked = (programId) => {
        return canAccessProgram(
            programs.value.find(p => p.id === programId),
            userRef.value,
            isSubscribedRef?.value
        );
    };

    const goHome = () => {
        currentRoute.value = 'home';
        currentProgramId.value = null;
        isDemoView.value = false;
        programContentHtml.value = '';
        programContentState.value = 'idle';
        nextTick(() => observeCards());
    };

    const openProgram = async (programId) => {
        if (!isUnlocked(programId)) {
            alert('No tienes acceso a este programa. Solicita acceso o suscríbete.');
            return;
        }
        currentProgramId.value = programId;
        currentRoute.value = 'program';
        isDemoView.value = false;
        programContentHtml.value = '';
        programContentState.value = 'loading';
        try {
            const content = await getDoc(doc(db, 'programContents', programId));
            const html = content.exists() ? content.data().html : '';
            if (typeof html !== 'string' || !html.trim()) throw new Error('Contenido protegido no disponible.');
            programContentHtml.value = html;
            programContentState.value = 'ready';
        } catch (error) {
            programContentState.value = 'error';
            alert('No se pudo cargar la herramienta autorizada. Revisa la migración de contenido privado.');
            console.error(error);
        }
    };

    const openProgramDemo = (programId) => {
        currentProgramId.value = programId;
        currentRoute.value = 'program';
        isDemoView.value = true;
        programContentHtml.value = '';
        programContentState.value = 'idle';
    };

    const loadPrograms = () => {
        const q = query(collection(db, "programs"), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            programs.value = [];
            snapshot.forEach(d => {
                const { html: _legacyHtml, ...publicProgram } = d.data();
                programs.value.push({ id: d.id, ...publicProgram });
            });
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
            const metadata = {
                name: p.name,
                description: p.description,
                price: p.price,
                icon: p.icon,
                demo: !!p.demo,
                demoHtml: p.demo ? (p.demoHtml || buildSafeDemoHtml(p)) : ''
            };
            if (p.id) {
                const batch = writeBatch(db);
                // Elimina también el campo legado `html` del documento público.
                // El contenido completo vive únicamente en `programContents/{id}`.
                batch.set(doc(db, "programs", p.id), { ...metadata, html: deleteField() }, { merge: true });
                batch.set(doc(db, "programContents", p.id), { html: p.html, updatedAt: serverTimestamp() }, { merge: true });
                await batch.commit();
                alert('✅ Programa actualizado correctamente.');
            } else {
                const programRef = doc(collection(db, "programs"));
                const batch = writeBatch(db);
                batch.set(programRef, { ...metadata, createdAt: serverTimestamp() });
                batch.set(doc(db, "programContents", programRef.id), { html: p.html, updatedAt: serverTimestamp() });
                await batch.commit();
                alert('✅ Programa creado exitosamente.');
            }
            showProgramForm.value = false;
            editingProgram.value = { id: '', name: '', description: '', price: 20, icon: '📐', html: '', demoHtml: '', demo: false };
        } catch (e) {
            alert('❌ Error al guardar: ' + e.message);
        }
    };

    const editProgram = async (program) => {
        try {
            const content = await getDoc(doc(db, 'programContents', program.id));
            editingProgram.value = { ...program, html: content.exists() ? (content.data().html || '') : '', demoHtml: program.demoHtml || '' };
            showProgramForm.value = true;
        } catch (error) {
            alert('❌ No se pudo cargar el contenido privado para editarlo.');
            console.error(error);
        }
    };

    const deleteProgram = async (id) => {
        if (!confirm('¿Eliminar este programa permanentemente?')) return;
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, "programs", id));
            batch.delete(doc(db, "programContents", id));
            await batch.commit();
            alert('✅ Programa eliminado.');
        } catch (e) {
            alert('❌ Error al eliminar: ' + e.message);
        }
    };

    return {
        programs, currentRoute, currentProgramId, currentProgram,
        isDemoView, programIframeSrcdoc, programContentState,
        adminTab, showProgramForm, editingProgram,
        isUnlocked, isFreeProgram, goHome, openProgram, openProgramDemo,
        loadPrograms, saveProgram, editProgram, deleteProgram
    };
}
