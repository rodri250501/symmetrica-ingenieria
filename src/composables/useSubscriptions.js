// ============================================================
// useSubscriptions — Precios y solicitudes de suscripción
// ============================================================
// Mismo patrón que usePrograms/useRequests: recibe userRef y
// showLoginRef como parámetros, no importa otros composables.
//
// Los precios (annualPrice / lifetimePrice) viven en un único
// documento config/pricing en Firestore. Cualquiera puede LEERLO
// (para mostrar el precio en la web), pero solo el admin puede
// escribirlo — eso lo hacen cumplir las Firestore Rules, no este
// archivo. updatePricing() simplemente intenta el write; si quien
// llama no es admin, Firestore lo rechaza igual.
// ============================================================

import { db } from '../core/firebase-config.js';
import {
    doc, setDoc, onSnapshot, addDoc, collection, serverTimestamp
} from "firebase/firestore";

const { ref, computed } = Vue;

const WHATSAPP_NUMBER = '59169737901';
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

export function useSubscriptions(userRef, showLoginRef) {
    const pricing = ref({ annualPrice: 0, lifetimePrice: 0 });
    // Copia editable para el formulario de admin: se inicializa con el
    // primer valor que llegue de Firestore, pero después NO se vuelve a
    // pisar sola con cada snapshot — así el admin puede escribir sin que
    // el input le salte el valor mientras tipea. Se resincroniza a mano
    // solo si el admin todavía no cargó (sigue en 0/0).
    const pricingForm = ref({ annualPrice: 0, lifetimePrice: 0 });
    const showSubModal = ref(false); // modal de "elegí tu plan"
    const showSubPaymentModal = ref(false); // modal de instrucciones de pago
    const subPaymentInfo = ref(null); // { type, price }

    const loadPricing = () => {
        onSnapshot(doc(db, "config", "pricing"), (snap) => {
            if (snap.exists()) {
                pricing.value = snap.data();
                if (pricingForm.value.annualPrice === 0 && pricingForm.value.lifetimePrice === 0) {
                    pricingForm.value = { ...pricing.value };
                }
            }
        });
    };

    // Solo funciona si quien llama es admin (lo exige la regla de
    // Firestore); para cualquier otro usuario esto va a fallar con
    // permission-denied, que ya atrapamos con el try/catch.
    const updatePricing = async (annualPrice, lifetimePrice) => {
        try {
            await setDoc(doc(db, "config", "pricing"), {
                annualPrice: Number(annualPrice),
                lifetimePrice: Number(lifetimePrice)
            }, { merge: true });
            alert('✅ Precios actualizados.');
        } catch (e) {
            alert('❌ Error al actualizar precios: ' + e.message);
        }
    };

    // true si el usuario tiene una suscripción activa vigente
    // (anual no vencida, o perpetua).
    const isSubscribed = computed(() => {
        const u = userRef.value;
        if (!u || !u.userData || !u.userData.subscription) return false;
        const sub = u.userData.subscription;
        if (sub.status !== 'active') return false;
        if (sub.type === 'lifetime') return true;
        if (sub.type === 'annual' && sub.expiresAt) {
            const expiresMs = sub.expiresAt.toMillis ? sub.expiresAt.toMillis() : new Date(sub.expiresAt).getTime();
            return expiresMs > Date.now();
        }
        return false;
    });

    const whatsappSubLink = computed(() => {
        const info = subPaymentInfo.value;
        const label = info?.type === 'annual' ? 'suscripción anual' : 'suscripción perpetua';
        const text = info
            ? `Hola, quiero pagar la ${label} (${info.price} Bs) en Symmetrica.`
            : 'Hola, quiero más información sobre las suscripciones de Symmetrica.';
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    });

    const closeSubPaymentModal = () => {
        showSubPaymentModal.value = false;
        subPaymentInfo.value = null;
    };

    // type: 'annual' | 'lifetime'
    const requestSubscription = async (type) => {
        if (!userRef.value) {
            showLoginRef.value = true;
            return;
        }
        const price = type === 'annual' ? pricing.value.annualPrice : pricing.value.lifetimePrice;
        try {
            await addDoc(collection(db, "requests"), {
                userId: userRef.value.uid,
                userEmail: userRef.value.email,
                userName: userRef.value.displayName || userRef.value.email,
                type: type === 'annual' ? 'subscription_annual' : 'subscription_lifetime',
                status: 'pending',
                requestedAt: serverTimestamp(),
                phone: '+591 69737901'
            });
            showSubModal.value = false;
            subPaymentInfo.value = { type, price };
            showSubPaymentModal.value = true;
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    // Llamado por useRequests.approveRequest cuando el request es de
    // suscripción — calcula el subscription object que hay que guardar
    // en users/{userId}.
    const buildSubscriptionPayload = (subType) => {
        if (subType === 'subscription_lifetime') {
            return { type: 'lifetime', status: 'active', expiresAt: null };
        }
        return {
            type: 'annual',
            status: 'active',
            expiresAt: new Date(Date.now() + MS_PER_YEAR)
        };
    };

    return {
        pricing, pricingForm, loadPricing, updatePricing, isSubscribed,
        showSubModal, showSubPaymentModal, subPaymentInfo,
        whatsappSubLink, closeSubPaymentModal, requestSubscription,
        buildSubscriptionPayload
    };
}
