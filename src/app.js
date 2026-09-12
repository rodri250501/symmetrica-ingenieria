// ============================================================
// app.js — Punto de entrada
// ============================================================
import { useAuth } from './composables/useAuth.js';
import { usePrograms } from './composables/usePrograms.js';
import { useRequests } from './composables/useRequests.js';
import { useAdminUsers } from './composables/useAdminUsers.js';
import { useContact } from './composables/useContact.js';
import { useSubscriptions } from './composables/useSubscriptions.js';
import { scrollToPrograms, observeCards } from './core/ui-helpers.js';

const { createApp, watch, onMounted } = Vue;

const App = {
    setup() {
        const authApi = useAuth();
        const subsApi = useSubscriptions(authApi.user, authApi.showLogin);
        const programsApi = usePrograms(authApi.user, subsApi.isSubscribed);
        const requestsApi = useRequests(
            authApi.user, programsApi.programs, authApi.showLogin,
            subsApi.buildSubscriptionPayload
        );
        const usersApi = useAdminUsers();
        const contactApi = useContact();

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

        // 🔧 FIX: Refetch programas cuando se cambia de ruta a 'home'
        // Esto asegura que cuando vuelves de Planes a Programas, los datos se actualizan
        watch(() => programsApi.currentRoute.value, (newRoute) => {
            if (newRoute === 'home') {
                programsApi.refetchPrograms();
            }
        });

        onMounted(() => {
            programsApi.loadPrograms();
            subsApi.loadPricing();
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
            scrollToPrograms
        };
    }
};

createApp(App).mount('#app');
