// ============================================================
// usePricing — Gestión de planes (pack, licencia) y precios
// ============================================================
// Maneja la configuración de precios editables por el admin:
// - packPrice: precio del pack (todos los programas actuales)
// - licensePrice: precio de licencia perpetua (pago único)
// - Suscripción anual sigue viviendo en useSubscriptions
//
// También gestiona solicitudes de compra de pack y licencia,
// que combinadas con programas individuales y suscripción anual
// dan 4 tipos de request.type:
//   'program'                -> compra individual
//   'pack'                   -> todos los programas actuales (pago único)
//   'subscription_annual'    -> suscripción 1 año
//   'subscription_lifetime'  -> licencia perpetua (pago único)
// ============================================================

import { db } from '../core/firebase-config.js';
import {
    doc, setDoc, onSnapshot, addDoc, collection, serverTimestamp
} from "firebase/firestore";

const { ref, computed } = Vue;

const WHATSAPP_NUMBER = '59169737901';

export function usePricing(userRef, showLoginRef, programsRef) {
    const pricing = ref({ packPrice: 0, licensePrice: 300 });
    const pricingForm = ref({ packPrice: 0, licensePrice: 300 });

    // Precios sacados de los programas en vivo
    const totalIndividualPrice = computed(() => {
        if (!programsRef || !programsRef.value) return 0;
        return programsRef.value.reduce((sum, p) => sum + (p.price || 0), 0);
    });

    const packDiscount = computed(() => {
        if (totalIndividualPrice.value === 0) return 0;
        return totalIndividualPrice.value - pricing.value.packPrice;
    });

    const packDiscountPercent = computed(() => {
        if (totalIndividualPrice.value === 0) return 0;
        return Math.round((packDiscount.value / totalIndividualPrice.value) * 100);
    });

    const loadPricing = () => {
        onSnapshot(doc(db, "config", "pricing"), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                pricing.value = {
                    packPrice: data.packPrice || 0,
                    licensePrice: data.licensePrice || 300
                };
                if (pricingForm.value.packPrice === 0 && pricingForm.value.licensePrice === 300) {
                    pricingForm.value = { ...pricing.value };
                }
            }
        });
    };

    const updatePricing = async (packPrice, licensePrice) => {
        try {
            await setDoc(doc(db, "config", "pricing"), {
                packPrice: Number(packPrice),
                licensePrice: Number(licensePrice)
            }, { merge: true });
            alert('✅ Precios actualizados.');
        } catch (e) {
            alert('❌ Error al actualizar precios: ' + e.message);
        }
    };

    const whatsappPackLink = computed(() => {
        const text = `Hola, quiero comprar el pack completo de todos los programas de Symmetrica (${pricing.value.packPrice} Bs).`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    });

    const whatsappLicenseLink = computed(() => {
        const text = `Hola, quiero comprar la licencia perpetua de Symmetrica (${pricing.value.licensePrice} Bs).`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    });

    // Solicitar pack (todos los programas actuales, pago único)
    const requestPack = async () => {
        if (!userRef.value) {
            showLoginRef.value = true;
            return;
        }
        try {
            await addDoc(collection(db, "requests"), {
                userId: userRef.value.uid,
                userEmail: userRef.value.email,
                userName: userRef.value.displayName || userRef.value.email,
                type: 'pack',
                status: 'pending',
                requestedAt: serverTimestamp(),
                phone: '+591 69737901'
            });
            return { type: 'pack', price: pricing.value.packPrice };
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    // Solicitar licencia perpetua
    const requestLicense = async () => {
        if (!userRef.value) {
            showLoginRef.value = true;
            return;
        }
        try {
            await addDoc(collection(db, "requests"), {
                userId: userRef.value.uid,
                userEmail: userRef.value.email,
                userName: userRef.value.displayName || userRef.value.email,
                type: 'subscription_lifetime',
                status: 'pending',
                requestedAt: serverTimestamp(),
                phone: '+591 69737901'
            });
            return { type: 'subscription_lifetime', price: pricing.value.licensePrice };
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    return {
        pricing, pricingForm, loadPricing, updatePricing,
        totalIndividualPrice, packDiscount, packDiscountPercent,
        whatsappPackLink, whatsappLicenseLink,
        requestPack, requestLicense
    };
}
