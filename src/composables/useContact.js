// ============================================================
// useContact — Formulario de contacto de la landing
// ============================================================
// Hoy solo muestra un alert (no se guarda en ningún lado). Si más
// adelante se conecta a Firestore o a un servicio de email, este
// es el único archivo que hay que tocar.
// ============================================================

const { ref } = Vue;

export function useContact() {
    const contactName = ref('');
    const contactEmail = ref('');
    const contactMessage = ref('');

    const sendContactMessage = () => {
        if (!contactName.value || !contactEmail.value || !contactMessage.value) {
            alert('Por favor, completa todos los campos.');
            return;
        }
        alert(`✅ Mensaje enviado.\n\nNombre: ${contactName.value}\nCorreo: ${contactEmail.value}\nMensaje: ${contactMessage.value}\n\nNos pondremos en contacto contigo pronto.`);
        contactName.value = '';
        contactEmail.value = '';
        contactMessage.value = '';
    };

    return { contactName, contactEmail, contactMessage, sendContactMessage };
}
