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

        // El botón "Desbloquear ahora" que aparece DENTRO del iframe en modo
        // demo (ver demo-lock.js) no puede llamar directamente a requestAccess
        // porque vive en otro documento — manda un postMessage y acá lo
        // escuchamos para disparar el mismo flujo de "solicitar acceso" que
        // usa el catálogo normal.
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
            scrollToPrograms
        };
    }
};

createApp(App).mount('#app');
