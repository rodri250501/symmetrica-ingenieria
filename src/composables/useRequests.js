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

const { ref, computed } = Vue;

// Formato wa.me: solo dígitos, sin "+" ni espacios. Bolivia (591) + número.
const WHATSAPP_NUMBER = '59169737901';

export function useRequests(userRef, programsRef, showLoginRef) {
    const pendingRequests = ref([]);
    const myRequests = ref([]);
    const showPaymentModal = ref(false);
    const paymentModalProgram = ref(null); // { name, price }
    let unsubscribeMyRequests = null;

    // Link listo para abrir WhatsApp con un mensaje pre-armado, para que
    // el cliente no tenga que escribir nada — solo tocar "enviar".
    const whatsappLink = computed(() => {
        const prog = paymentModalProgram.value;
        const text = prog
            ? `Hola, quiero pagar el programa "${prog.name}" (${prog.price} Bs) en Symmetrica.`
            : 'Hola, quiero más información sobre los programas de Symmetrica.';
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    });

    const closePaymentModal = () => {
        showPaymentModal.value = false;
        paymentModalProgram.value = null;
    };

    const loadRequests = () => {
        const q = query(collection(db, "requests"), where("status", "==", "pending"));
        onSnapshot(q, (snapshot) => {
            pendingRequests.value = [];
            snapshot.forEach(d => pendingRequests.value.push({ id: d.id, ...d.data() }));
        });
    };

    // Solicitudes del usuario actual (cualquier estado), para que pueda ver
    // en "Mi cuenta" si ya pidió un programa y sigue pendiente de aprobación,
    // en vez de que el botón "Solicitar acceso" aparezca de nuevo sin más.
    // Se vuelve a suscribir cada vez que cambia el usuario (login/logout).
    const loadMyRequests = () => {
        if (unsubscribeMyRequests) {
            unsubscribeMyRequests();
            unsubscribeMyRequests = null;
        }
        if (!userRef.value) {
            myRequests.value = [];
            return;
        }
        const q = query(collection(db, "requests"), where("userId", "==", userRef.value.uid));
        unsubscribeMyRequests = onSnapshot(q, (snapshot) => {
            myRequests.value = [];
            snapshot.forEach(d => myRequests.value.push({ id: d.id, ...d.data() }));
        });
    };

    const isRequestPending = (programId) => {
        return myRequests.value.some(r => r.toolId === programId && r.status === 'pending');
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
            // En vez del alert de antes, mostramos el modal con las
            // instrucciones de pago y el botón directo a WhatsApp.
            paymentModalProgram.value = { name: prog.name, price: prog.price };
            showPaymentModal.value = true;
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

    const rejectRequest = async (requestId) => {
        const reason = prompt('Motivo del rechazo (opcional, el usuario lo verá en su historial):', '');
        if (reason === null) return; // canceló el prompt
        try {
            await updateDoc(doc(db, "requests", requestId), {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                rejectionReason: reason || ''
            });
            alert('Solicitud rechazada.');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    return {
        pendingRequests, loadRequests, requestAccess, approveRequest, rejectRequest,
        myRequests, loadMyRequests, isRequestPending,
        showPaymentModal, paymentModalProgram, whatsappLink, closePaymentModal
    };
}
