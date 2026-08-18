// ============================================================
// useAdminUsers — Lista de usuarios registrados (pestaña admin)
// ============================================================

import { db } from '../core/firebase-config.js';
import { collection, onSnapshot } from "firebase/firestore";

const { ref } = Vue;

export function useAdminUsers() {
    const allUsers = ref([]);

    const loadUsers = () => {
        onSnapshot(collection(db, "users"), (snapshot) => {
            allUsers.value = [];
            snapshot.forEach(d => allUsers.value.push({ id: d.id, ...d.data() }));
        });
    };

    return { allUsers, loadUsers };
}
