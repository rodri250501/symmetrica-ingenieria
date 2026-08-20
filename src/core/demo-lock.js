// ============================================================
// DEMO LOCK — envuelve el HTML de un programa en "modo prueba"
// ============================================================
// No necesita saber nada de cada calculadora en particular. En vez
// de pedirle al admin que configure "datos de ejemplo" por cada
// programa, aprovecha que las calculadoras YA cargan con valores
// de ejemplo en sus propios `value="..."` — el modo demo solo
// bloquea esos campos para que no se puedan cambiar, y deja el
// botón "Calcular" funcionando para que se vea el resultado real.
//
// Un MutationObserver bloquea también los campos que la propia
// calculadora genere dinámicamente después de cargar (por ejemplo,
// filas nuevas al cambiar "número de tramos"), sin que este archivo
// necesite conocer la estructura interna de cada herramienta.
//
// Al hacer click en "Desbloquear ahora", el iframe le manda un
// postMessage a la ventana principal (window.parent) — quien
// escucha ese mensaje es app.js.
// ============================================================

export function buildDemoHtml(originalHtml) {
    const wrapperScript = `
<script>
(function () {
    function lockField(el) {
        if (el.tagName === 'BUTTON') return; // no bloquear botones (Calcular, etc.)
        el.setAttribute('disabled', 'disabled');
        el.style.opacity = '0.75';
        el.style.cursor = 'not-allowed';
    }
    function lockAllFieldsIn(root) {
        if (root.querySelectorAll) {
            root.querySelectorAll('input, select, textarea').forEach(lockField);
        }
    }
    function showBanner() {
        if (document.getElementById('symmetrica-demo-banner')) return;
        var banner = document.createElement('div');
        banner.id = 'symmetrica-demo-banner';
        banner.style.cssText = 'position:sticky;top:0;z-index:99999;background:#1e3a8a;color:#fff;' +
            'padding:10px 16px;font-family:system-ui,sans-serif;font-size:13px;display:flex;' +
            'align-items:center;justify-content:space-between;gap:12px;box-shadow:0 2px 6px rgba(0,0,0,.15);';
        banner.innerHTML = '<span>🔒 Estás viendo una DEMO con datos de ejemplo — los campos están bloqueados.</span>' +
            '<button id="symmetrica-unlock-btn" style="background:#fff;color:#1e3a8a;border:none;' +
            'padding:6px 14px;border-radius:999px;font-weight:600;cursor:pointer;white-space:nowrap;">Desbloquear ahora</button>';
        document.body.insertBefore(banner, document.body.firstChild);
        document.getElementById('symmetrica-unlock-btn').addEventListener('click', function () {
            window.parent.postMessage({ type: 'symmetrica-unlock-request' }, '*');
        });
    }
    function init() {
        lockAllFieldsIn(document);
        showBanner();
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (node.matches && node.matches('input, select, textarea')) lockField(node);
                    lockAllFieldsIn(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
<\/script>`;

    if (originalHtml.includes('</body>')) {
        return originalHtml.replace('</body>', wrapperScript + '</body>');
    }
    return originalHtml + wrapperScript;
}
