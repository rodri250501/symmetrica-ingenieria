// ============================================================
// app.js — Punto de entrada
// ============================================================
import { useAuth } from './composables/useAuth.js';
import { usePrograms } from './composables/usePrograms.js';
import { useRequests } from './composables/useRequests.js';
import { useAdminUsers } from './composables/useAdminUsers.js';
import { useContact } from './composables/useContact.js';
import { useSubscriptions } from './composables/useSubscriptions.js';
import { usePricing } from './composables/usePricing.js';
import { scrollToPrograms, observeCards } from './core/ui-helpers.js';

const { createApp, watch, onMounted, ref, computed } = Vue;

const App = {
    setup() {
        const authApi = useAuth();
        const subsApi = useSubscriptions(authApi.user, authApi.showLogin);
        const programsApi = usePrograms(authApi.user, subsApi.isSubscribed);
        const pricingApi = usePricing(authApi.user, authApi.showLogin, programsApi.programs);
        const requestsApi = useRequests(
            authApi.user, programsApi.programs, authApi.showLogin,
            subsApi.buildSubscriptionPayload
        );
        const usersApi = useAdminUsers();
        const contactApi = useContact();

        // Modales de pago para pack y licencia
        const showPackPaymentModal = ref(false);
        const showLicensePaymentModal = ref(false);

        const requestPackFlow = async () => {
            const result = await pricingApi.requestPack();
            if (result) showPackPaymentModal.value = true;
        };

        const requestLicenseFlow = async () => {
            const result = await pricingApi.requestLicense();
            if (result) showLicensePaymentModal.value = true;
        };

        const closePackPaymentModal = () => {
            showPackPaymentModal.value = false;
        };

        const closeLicensePaymentModal = () => {
            showLicensePaymentModal.value = false;
        };

        // Funciones para actualizar precios individuales (preservan los otros)
        const updateSubscriptionPricing = (price) => {
            subsApi.updatePricing(price, pricingApi.pricing.value.lifetimePrice);
        };

        const updatePackPricing = (price) => {
            pricingApi.updatePricing(price, pricingApi.pricing.value.licensePrice);
        };

        const updateLicensePricing = (price) => {
            pricingApi.updatePricing(pricingApi.pricing.value.packPrice, price);
        };

        // Computed que combina todos los precios en un objeto unificado
        const allPricing = computed(() => ({
            annualPrice: subsApi.pricing.value?.annualPrice || 0,
            lifetimePrice: subsApi.pricing.value?.lifetimePrice || 0,
            packPrice: pricingApi.pricing.value?.packPrice || 0,
            licensePrice: pricingApi.pricing.value?.licensePrice || 0
        }));

        let adminDataLoaded = false;
        const syncAdminData = () => {
            if (authApi.isAdmin.value && !adminDataLoaded) {
                usersApi.loadUsers();
                requestsApi.loadRequests();
                adminDataLoaded = true;
            } else if (!authApi.isAdmin.value && adminDataLoaded) {
                usersApi.allUsers.value = [];
                requestsApi.pendingRequests.value = [];
                adminDataLoaded = false;
            }
        };

        watch(authApi.user, (newUser) => {
            const protectedRoute = programsApi.currentRoute.value === 'admin' ||
                                    programsApi.currentRoute.value === 'account' ||
                                    programsApi.currentRoute.value === 'program';
            if (!newUser && protectedRoute) {
                programsApi.goHome();
            }
            requestsApi.loadMyRequests();
            syncAdminData();
        });

        onMounted(() => {
            programsApi.loadPrograms();
            subsApi.loadPricing();
            pricingApi.loadPricing();
            syncAdminData();
            setTimeout(() => observeCards(), 300);
        });

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'symmetrica-unlock-request') {
                const programId = programsApi.currentProgramId.value;
                if (programId) requestsApi.requestAccess(programId);
            }
        });

        return {
            ...authApi,
            ...programsApi,
            ...requestsApi,
            ...usersApi,
            ...contactApi,
            ...subsApi,
            ...pricingApi,
            scrollToPrograms,
            showPackPaymentModal, showLicensePaymentModal,
            requestPackFlow, requestLicenseFlow,
            closePackPaymentModal, closeLicensePaymentModal,
            updateSubscriptionPricing, updatePackPricing, updateLicensePricing,
            allPricing
        };
    }
};

createApp(App).mount('#app');
