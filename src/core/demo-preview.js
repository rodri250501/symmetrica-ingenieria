// Vista pública segura: no contiene el HTML ni la lógica de la calculadora.
// El programa completo vive en programContents/{id} y solo se carga después
// de comprobar el acceso del usuario.

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
}

export function buildSafeDemoHtml(program = {}) {
    const name = escapeHtml(program.name || 'Herramienta de Symmetrica');
    const description = escapeHtml(program.description || 'Vista previa de la herramienta.');
    const price = escapeHtml(program.price == null ? '' : `${program.price} Bs`);
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vista previa · ${name}</title>
<style>
body{margin:0;padding:24px;background:#f4f7f9;color:#1c303b;font:15px system-ui,sans-serif}
.card{max-width:720px;margin:auto;background:#fff;border:1px solid #dce5ea;border-radius:16px;padding:24px;box-shadow:0 8px 24px #1c303b12}
.badge{display:inline-block;padding:5px 10px;border-radius:999px;background:#eaf1f5;color:#365567;font-size:12px;font-weight:700}
h1{margin:18px 0 8px;font-size:clamp(24px,4vw,36px)}p{line-height:1.6;color:#60727d}
.preview{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}.metric{padding:14px;background:#f7fafb;border-radius:10px}.metric b{display:block;margin-top:5px;color:#1c303b}
button{border:0;border-radius:8px;padding:11px 16px;background:#183342;color:#fff;font-weight:700;cursor:pointer}
@media(max-width:520px){body{padding:14px}.preview{grid-template-columns:1fr}}
</style></head><body><main class="card">
<span class="badge">Vista previa segura · Sin acceso al motor</span>
<h1>${name}</h1><p>${description}</p>
<div class="preview"><div class="metric">Estado<b>Ejemplo disponible</b></div><div class="metric">Acceso<b>Tras aprobación</b></div><div class="metric">Precio<b>${price || 'Consultar'}</b></div></div>
<p>Esta vista muestra la experiencia general. El cálculo completo se carga únicamente para usuarios autorizados.</p>
<button id="symmetrica-unlock-btn" type="button">Solicitar acceso</button>
</main><script>
document.getElementById('symmetrica-unlock-btn').addEventListener('click',function(){window.parent.postMessage({type:'symmetrica-unlock-request'},'*')});
</script></body></html>`;
}
