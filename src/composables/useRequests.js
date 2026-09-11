// ============================================================
// useRequests — Solicitudes de acceso a programas
// ============================================================
// Recibe userRef, showLoginRef (de useAuth), programsRef (de
// usePrograms) y buildSubscriptionPayload (de useSubscriptions)
// como dependencias externas — mismo patrón de siempre: ningún
// composable importa a otro directamente.
//
// pendingRequests ahora mezcla dos tipos de solicitud:
//   - type === 'program'               -> requiere toolId/toolName
//   - type === 'subscription_annual'   -> suscripción de 1 año
//   - type === 'subscription_lifetime' -> suscripción perpetua
// approveRequest() revisa `type` para saber qué actualizar en
// users/{userId}: purchasedTools (programa) o subscription
// (suscripción, usando buildSubscriptionPayload).
// ============================================================

import { db } from '../core/firebase-config.js';
import {
    collection, doc, addDoc, updateDoc, arrayUnion,
    serverTimestamp, query, where, onSnapshot
} from "firebase/firestore";

const { ref, computed } = Vue;

const WHATSAPP_NUMBER = '59169737901';

export function useRequests(userRef, programsRef, showLoginRef, buildSubscriptionPayload) {
    const pendingRequests = ref([]);
    const myRequests = ref([]);
    const showPaymentModal = ref(false);
    const paymentModalProgram = ref(null);
    let unsubscribeMyRequests = null;

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
        return myRequests.value.some(r => r.type === 'program' && r.toolId === programId && r.status === 'pending');
    };

    // true si hay una solicitud de suscripción (del tipo dado) pendiente
    const isSubRequestPending = (subType) => {
        const wanted = subType === 'annual' ? 'subscription_annual' : 'subscription_lifetime';
        return myRequests.value.some(r => r.type === wanted && r.status === 'pending');
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
                type: 'program',
                toolId: programId,
                toolName: prog.name,
                status: 'pending',
                requestedAt: serverTimestamp(),
                phone: '+591 69737901'
            });
            paymentModalProgram.value = { name: prog.name, price: prog.price };
            showPaymentModal.value = true;
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    // req: el documento completo de la solicitud (incluye `type`)
    const approveRequest = async (req) => {
        if (!confirm('¿Confirmas que recibiste el pago y quieres aprobar esta solicitud?')) return;
        try {
            await updateDoc(doc(db, "requests", req.id), {
                status: 'approved',
                approvedAt: serverTimestamp()
            });

            if (req.type === 'program') {
                // Programa individual: agregar a purchasedTools
                await updateDoc(doc(db, "users", req.userId), {
                    purchasedTools: arrayUnion(req.toolId)
                });
            } else if (req.type === 'pack') {
                // Pack: agregar TODOS los programas actuales a purchasedTools
                // programsRef viene del parámetro, necesita estar en scope
                const allProgramIds = programsRef.value.map(p => p.id);
                await updateDoc(doc(db, "users", req.userId), {
                    purchasedTools: arrayUnion(...allProgramIds)
                });
            } else {
                // subscription_annual | subscription_lifetime
                const subscription = buildSubscriptionPayload(req.type);
                await updateDoc(doc(db, "users", req.userId), { subscription });
            }
            alert('✅ Acceso concedido.');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const rejectRequest = async (requestId) => {
        const reason = prompt('Motivo del rechazo (opcional, el usuario lo verá en su historial):', '');
        if (reason === null) return;
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
        myRequests, loadMyRequests, isRequestPending, isSubRequestPending,
        showPaymentModal, paymentModalProgram, whatsappLink, closePaymentModal
    };
}
