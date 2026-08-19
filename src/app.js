// ============================================================
// app.js — Punto de entrada
// ============================================================
// Compone todos los composables y monta la app de Vue. Este
// archivo es el único que conoce a TODOS los demás — cada
// composable individual solo conoce lo que recibe como parámetro,
// nunca importa a otro composable directamente. Eso es lo que
// permite tocar, por ejemplo, useRequests.js sin arriesgar romper
// useAuth.js o usePrograms.js.
// ============================================================

import { useAuth } from './composables/useAuth.js';
import { usePrograms } from './composables/usePrograms.js';
import { useRequests } from './composables/useRequests.js';
import { useAdminUsers } from './composables/useAdminUsers.js';
import { useContact } from './composables/useContact.js';
import { scrollToPrograms, observeCards } from './core/ui-helpers.js';

const { createApp, watch, onMounted } = Vue;

const App = {
    setup() {
        const authApi = useAuth();
        const programsApi = usePrograms(authApi.user);
        const requestsApi = useRequests(authApi.user, programsApi.programs, authApi.showLogin);
        const usersApi = useAdminUsers();
        const contactApi = useContact();

        // Si el usuario cierra sesión mientras está en una ruta protegida
        // (admin, cuenta, o un programa abierto), lo mandamos de vuelta al
        // home. También recargamos "mis solicitudes" cada vez que cambia
        // el usuario (login/logout), porque esa consulta depende del uid.
        watch(authApi.user, (newUser) => {
            const protectedRoute = programsApi.currentRoute.value === 'admin' ||
                                    programsApi.currentRoute.value === 'account' ||
                                    programsApi.currentRoute.value === 'program';
            if (!newUser && protectedRoute) {
                programsApi.goHome();
            }
            requestsApi.loadMyRequests();
        });

        onMounted(() => {
            programsApi.loadPrograms();
            usersApi.loadUsers();
            requestsApi.loadRequests();
            setTimeout(() => observeCards(), 300);
        });

        return {
            ...authApi,
            ...programsApi,
            ...requestsApi,
            ...usersApi,
            ...contactApi,
            scrollToPrograms
        };
    }
};

createApp(App).mount('#app');
