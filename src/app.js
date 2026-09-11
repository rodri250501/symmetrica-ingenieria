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

        // Las colecciones "users" (completa) y "requests" (pendientes, sin
        // filtrar por uid) solo pueden leerse si el usuario es admin —así
        // lo exigen las Firestore Security Rules. Por eso NO se cargan
        // incondicionalmente: se activan/desactivan cada vez que cambia
        // isAdmin, para no disparar queries que Firestore va a rechazar
        // con permission-denied para cualquier usuario no-admin.
        let adminDataLoaded = false;
        const syncAdminData = () => {
            if (authApi.isAdmin.value && !adminDataLoaded) {
                usersApi.loadUsers();
                requestsApi.loadRequests();
                adminDataLoaded = true;
            } else if (!authApi.isAdmin.value && adminDataLoaded) {
                // El usuario dejó de ser admin (logout u otro cambio de
                // sesión): reseteamos para que, si vuelve a loguearse
                // como admin más adelante, se vuelva a suscribir.
                usersApi.allUsers.value = [];
                requestsApi.pendingRequests.value = [];
                adminDataLoaded = false;
            }
        };

        // Si el usuario cierra sesión mientras está en una ruta protegida
        // (admin, cuenta, o un programa abierto), lo mandamos de vuelta al
        // home. También recargamos "mis solicitudes" cada vez que cambia
        // el usuario (login/logout), porque esa consulta depende del uid,
        // y re-evaluamos si corresponde cargar datos de admin.
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
            syncAdminData();
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

