// ============================================================
// UI HELPERS
// ============================================================
// Funciones puras de DOM. No tienen estado reactivo, así que no
// son composables de Vue — son funciones normales que cualquier
// composable o componente puede importar directamente.
// ============================================================

export function scrollToPrograms() {
    const el = document.getElementById('programs-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function observeCards() {
    const cards = document.querySelectorAll('.tool-card');
    if (!cards.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -20px 0px' });
    cards.forEach(card => observer.observe(card));
}
