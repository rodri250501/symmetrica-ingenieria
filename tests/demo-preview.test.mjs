import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSafeDemoHtml } from '../src/core/demo-preview.js';

test('safe public preview contains presentation data but no private calculator HTML', () => {
    const privateHtml = '<script>window.secretFormula = "do-not-publish"</script><input id="fck">';
    const preview = buildSafeDemoHtml({
        name: '<Calculadora>',
        description: 'Descripción & demo',
        price: 40,
        html: privateHtml
    });

    assert.match(preview, /&lt;Calculadora&gt;/);
    assert.match(preview, /Descripción &amp; demo/);
    assert.match(preview, /40 Bs/);
    assert.match(preview, /Vista previa segura/);
    assert.doesNotMatch(preview, /secretFormula|do-not-publish|id="fck"/);
    assert.doesNotMatch(preview, /<script src=/i);
    assert.match(preview, /postMessage\(\{type:'symmetrica-unlock-request'\},'\*'\)/);
});
