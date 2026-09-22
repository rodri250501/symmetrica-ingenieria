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
import { requiresSignedInUser } from './core/program-access.mjs';

const { createApp, watch, onMounted, nextTick, ref, computed } = Vue;

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
            const protectedRoute = requiresSignedInUser(
                programsApi.currentRoute.value,
                programsApi.currentProgram.value,
                programsApi.isDemoView.value
            );
            if (!newUser && protectedRoute) {
                programsApi.goHome();
            }
            requestsApi.loadMyRequests();
            syncAdminData();
        });

        // Las tarjetas de programas (.tool-card) empiezan con opacity:0 y solo
        // se hacen visibles cuando el IntersectionObserver de observeCards()
        // las detecta. Ese observer se pierde cada vez que Vue destruye y
        // vuelve a crear el DOM de la grilla (al cambiar de ruta con v-if),
        // así que hay que volver a llamarlo CADA VEZ que se entra a 'home' —
        // sin importar desde qué ruta se venga (Planes, Admin, Cuenta, etc.),
        // no solo desde goHome(). Esto es lo que corrige el bug de "programas
        // en blanco" al navegar desde la página de Planes.
        watch(programsApi.currentRoute, (newRoute) => {
            if (newRoute === 'home') {
                nextTick(() => observeCards());
            }
        });

        // Navegación centralizada hacia la grilla de programas: usar esto en
        // vez de tocar currentRoute directamente, para que el scroll ocurra
        // recién después de que la sección exista en el DOM.
        const goToPrograms = () => {
            programsApi.currentRoute.value = 'home';
            nextTick(() => scrollToPrograms());
        };

        onMounted(() => {
            programsApi.loadPrograms();
            subsApi.loadPricing();
            pricingApi.loadPricing();
            syncAdminData();
            setTimeout(() => observeCards(), 300);
        });

        window.addEventListener('message', (event) => {
            const iframe = document.querySelector('.program-iframe');
            const trustedFrame = iframe && event.source === iframe.contentWindow;
            const trustedOrigin = event.origin === window.location.origin || event.origin === 'null';
            if (trustedFrame && trustedOrigin && event.data?.type === 'symmetrica-unlock-request') {
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
            allPricing, goToPrograms
        };
    }
};

createApp(App).mount('#app');
