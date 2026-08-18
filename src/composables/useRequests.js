// ============================================================
// useRequests — Solicitudes de acceso a programas
// ============================================================
// Recibe userRef y showLoginRef (de useAuth) y programsRef (de
// usePrograms) como dependencias externas — el mismo patrón que
// usePrograms.js, así ningún composable necesita importar a otro.
// ============================================================

import { db } from '../core/firebase-config.js';
import {
    collection, doc, addDoc, updateDoc, arrayUnion,
    serverTimestamp, query, where, onSnapshot
} from "firebase/firestore";

const { ref } = Vue;

export function useRequests(userRef, programsRef, showLoginRef) {
    const pendingRequests = ref([]);

    const loadRequests = () => {
        const q = query(collection(db, "requests"), where("status", "==", "pending"));
        onSnapshot(q, (snapshot) => {
            pendingRequests.value = [];
            snapshot.forEach(d => pendingRequests.value.push({ id: d.id, ...d.data() }));
        });
    };

    const requestAccess = async (programId) => {
        if (!userRef.value) {
            showLoginRef.value = true;
            return;
        }
        const prog = programsRef.value.find(p => p.id === programId);
        if (!prog) return;
        try {
            await addDoc(collection(db, "requests"), {
                userId: userRef.value.uid,
                userEmail: userRef.value.email,
                userName: userRef.value.displayName || userRef.value.email,
                toolId: programId,
                toolName: prog.name,
                status: 'pending',
                requestedAt: serverTimestamp(),
                phone: '+591 69737901'
            });
            alert('✅ Solicitud enviada. Te contactaremos para confirmar el acceso.');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const approveRequest = async (requestId, userId, toolId) => {
        if (!confirm('¿Confirmas que recibiste el pago y quieres desbloquear este programa?')) return;
        try {
            await updateDoc(doc(db, "requests", requestId), {
                status: 'approved',
                approvedAt: serverTimestamp()
            });
            await updateDoc(doc(db, "users", userId), {
                purchasedTools: arrayUnion(toolId)
            });
            alert('✅ Acceso concedido.');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    return { pendingRequests, loadRequests, requestAccess, approveRequest };
}
