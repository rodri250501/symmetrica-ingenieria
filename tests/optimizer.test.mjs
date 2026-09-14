import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped inline script rather than a second implementation.
const html = readFileSync(new URL('../programs/optimizador-vigas.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)];
assert.equal(inlineScripts.length, 1, 'the optimizer must have one application script');
const source = inlineScripts[0][1];
const areas = { 8: 0.503, 10: 0.785, 12: 1.131, 14: 1.539, 16: 2.011, 18: 2.545, 20: 3.142, 22: 3.801 };
const allDiameters = Object.keys(areas).map(Number);

function element(value = '') {
    let markup = '';
    return {
        value, style: { display: 'none' },
        get innerHTML() { return markup; },
        set innerHTML(value) { markup = String(value); },
        get textContent() { return markup.replace(/<[^>]*>/g, ''); },
        set textContent(value) { markup = String(value); },
        getContext() { return {}; }
    };
}

function harness() {
    const elements = {};
    for (const [, tag] of html.matchAll(/<(input\b[^>]*)>/g)) {
        const id = tag.match(/\bid="([^"]+)"/)?.[1];
        if (id) elements[id] = element(tag.match(/\bvalue="([^"]*)"/)?.[1] || '');
    }
    for (const [, id, options] of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
        const choices = [...options.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)];
        const selected = choices.find(match => /\bselected\b/.test(match[1])) || choices[0];
        elements[id] = element(selected[1].match(/\bvalue="([^"]*)"/)[1]);
    }
    for (const id of ['resultadosContainer', 'chartsSection', 'statusText', 'costChart', 'costPieChart']) {
        elements[id] = element();
    }
    const state = { diameters: [12, 16], charts: [] };
    const sandbox = {
        document: {
            getElementById(id) { assert.ok(elements[id], `unexpected element: ${id}`); return elements[id]; },
            querySelectorAll(selector) {
                if (selector === '.checkbox-item input[type="checkbox"]:checked') {
                    return state.diameters.map(value => ({ value: String(value) }));
                }
                if (selector === '.btn-seleccionar') return [];
                throw new Error(`Unexpected selector: ${selector}`);
            },
            querySelector(selector) {
                assert.equal(selector, '.btn-seleccionar');
                return null;
            }
        },
        window: { addEventListener() {} },
        setTimeout(callback) { callback(); return 1; },
        Chart: class {
            constructor(context, config) { state.charts.push(config); }
            destroy() {}
        }
    };
    const context = vm.createContext(sandbox);
    vm.runInContext(source, context, { timeout: 1000 });
    return {
        elements, state,
        call(name, ...args) {
            context.testArguments = args;
            return vm.runInContext(`${name}(...testArguments)`, context, { timeout: 1000 });
        }
    };
}

function near(actual, expected, tolerance = 1e-10) {
    assert.ok(Number.isFinite(actual), `expected finite number, got ${actual}`);
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

function assertCombinations(combinations, required, diameters, limit = 10) {
    assert.ok(combinations.length <= limit);
    let previousArea = 0;
    for (const combination of combinations) {
        assert.ok(combination.areaTotal >= required, `deficient steel: ${combination.areaTotal} < ${required}`);
        assert.ok(combination.areaTotal >= previousArea, 'returned alternatives must be sorted by area');
        previousArea = combination.areaTotal;
        assert.ok(Number.isInteger(combination.totalBarras) && combination.totalBarras > 0);
        assert.ok(Number.isFinite(combination.excesoPorc) && combination.excesoPorc >= 0);
        near(combination.excesoPorc, (combination.areaTotal - required) / required * 100, 1e-8);
        let count = 0;
        let area = 0;
        const seen = new Set();
        for (const item of combination.combinacion) {
            assert.ok(diameters.includes(item.diametro));
            assert.ok(!seen.has(item.diametro), 'a diameter must appear only once');
            seen.add(item.diametro);
            assert.ok(Number.isInteger(item.cantidad) && item.cantidad > 0);
            near(item.area, item.cantidad * areas[item.diametro], 1e-8);
            count += item.cantidad;
            area += item.area;
        }
        assert.equal(combination.totalBarras, count);
        near(combination.areaTotal, area, 1e-8);
    }
}

test('displayed MPa materials agree with the numeric values sent to the calculation', () => {
    for (const [id, expected] of [['fck', [21, 28, 35, 42]], ['fy', [280, 420, 500]]]) {
        const options = html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))[1];
        const choices = [...options.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g)];
        assert.deepEqual(choices.map(match => Number(match[1])), expected);
        assert.deepEqual(choices.map(match => Number(match[2].trim())), expected);
    }
});

test('default section and continuous calculation remain unchanged by the UI corrections', () => {
    const app = harness();
    const result = app.call('optimizar');
    assert.equal(result.error, undefined);
    assert.equal(result.mejor.b, 20);
    assert.equal(result.mejor.h, 30);
    assert.equal(result.mejor.d, 25);
    near(result.mejor.As, 5.906694159778789);
    near(result.mejor.costo, 130.91284718809294);
    const steel = app.call('calcularAcero', 50, 20, 30, 28, 420, 5);
    near(steel.As, result.mejor.As);
    assert.equal(steel.valida, true);
});

test('the reported 5.91 cm² case excludes 5φ12 and includes 3φ16', () => {
    const combinations = harness().call('generarCombinaciones', 5.91, [12, 16], 10);
    assertCombinations(combinations, 5.91, [12, 16]);
    assert.ok(combinations.some(combination => combination.areaTotal === 6.033 && combination.totalBarras === 3));
    assert.ok(!combinations.some(combination => combination.areaTotal === 5.655));
});

test('admission uses unrounded demand even when displayed values are equal', () => {
    const app = harness();
    const exact = app.call('generarCombinaciones', 2.262, [12]);
    assert.equal(exact[0].totalBarras, 2);
    assert.equal(exact[0].areaTotal, 2.262);
    const slightlyHigher = app.call('generarCombinaciones', 2.262001, [12]);
    assert.ok(slightlyHigher.length > 0);
    assertCombinations(slightlyHigher, 2.262001, [12]);
    assert.ok(slightlyHigher.every(combination => combination.totalBarras >= 3));
});

test('all supported diameters and varied demands preserve area and bar-count consistency', () => {
    const app = harness();
    const selections = [...allDiameters.map(diameter => [diameter]), [12, 16], [8, 10, 22], allDiameters];
    for (const diameters of selections) {
        for (const required of [0.001, 0.503, 0.503001, 1, 2.262, 2.262001, 5.91, 12.5, 50, 123.456]) {
            const combinations = app.call('generarCombinaciones', required, diameters);
            assert.ok(combinations.length > 0, `no alternative for ${required} with ${diameters}`);
            assertCombinations(combinations, required, diameters);
        }
    }
});

test('repeated and reordered diameter selections do not duplicate bars or alter alternatives', () => {
    const app = harness();
    const normal = app.call('generarCombinaciones', 5.91, [12, 16]);
    const duplicate = app.call('generarCombinaciones', 5.91, [16, 12, 16, '12']);
    assert.equal(JSON.stringify(duplicate), JSON.stringify(normal));
    assertCombinations(duplicate, 5.91, [12, 16]);
});

test('result limits apply and very large searches return within a bounded execution budget', () => {
    const app = harness();
    for (const limit of [1, 3, 10]) {
        assertCombinations(app.call('generarCombinaciones', 12, allDiameters, limit), 12, allDiameters, limit);
    }
    // The VM timeout catches an accidentally unbounded loop without sleeping.
    assertCombinations(app.call('generarCombinaciones', 1e8, allDiameters), 1e8, allDiameters);
});

test('invalid bar-search requests return no selectable alternative', () => {
    const app = harness();
    const cases = [
        [0, [12]], [-1, [12]], [NaN, [12]], [Infinity, [12]], [Number.MAX_VALUE, [12]],
        [5.91, []], [5.91, null], [5.91, [13]], [5.91, [12], 0],
        [5.91, [12], -1], [5.91, [12], 1.5], [5.91, [12], Infinity]
    ];
    for (const args of cases) assert.equal(app.call('generarCombinaciones', ...args).length, 0);
});

test('existing invalid-depth and insufficient-section diagnostics remain available', () => {
    const app = harness();
    const depth = app.call('calcularAcero', 50, 20, 5, 28, 420, 5);
    assert.equal(depth.valida, false);
    assert.equal(depth.mensaje, 'd<=0');
    const capacity = app.call('calcularAcero', 10000, 20, 30, 28, 420, 5);
    assert.equal(capacity.valida, false);
    assert.equal(capacity.mensaje, 'disc<0');
});

test('invalid inputs are rejected before optimization produces candidates', () => {
    const app = harness();
    const positiveFields = ['Mu', 'L', 'fck', 'fy', 'rec', 'bMin', 'bMax', 'hMin', 'hMax'];
    for (const id of positiveFields) {
        const original = app.elements[id].value;
        for (const value of ['', 'NaN', 'Infinity', '-1', '0']) {
            app.elements[id].value = value;
            const result = app.call('optimizar');
            assert.ok(result.error, `${id}=${value} must be rejected`);
            assert.equal(result.mejor, null);
            assert.equal(result.puntosValidos.length, 0);
        }
        app.elements[id].value = original;
    }
    for (const id of ['costH', 'costA']) {
        const original = app.elements[id].value;
        for (const value of ['', 'NaN', 'Infinity', '-1']) {
            app.elements[id].value = value;
            assert.ok(app.call('optimizar').error, `${id}=${value} must be rejected`);
        }
        app.elements[id].value = original;
    }
});

test('inverted ranges, inadequate depth and excessive search size are rejected', () => {
    for (const values of [
        { bMin: '51', bMax: '50' }, { hMin: '102', hMax: '100' },
        { rec: '30', hMin: '30' }, { bMax: '1000', hMax: '1000' },
        { bMin: '1e20', bMax: '1e20' }, { hMin: '1e20', hMax: '1e20' }
    ]) {
        const app = harness();
        for (const [id, value] of Object.entries(values)) app.elements[id].value = value;
        assert.ok(app.call('optimizar').error);
    }
});

test('a successful render has numeric bar counts and clears stale results on invalid input', () => {
    const app = harness();
    app.call('calcular');
    assert.equal(app.elements.statusText.textContent, 'Optimización completada');
    assert.match(app.elements.resultadosContainer.innerHTML, /tabla-comparativa/);
    assert.doesNotMatch(app.elements.resultadosContainer.innerHTML, /\[object Object\]|NaN|Infinity/);
    assert.equal(app.elements.chartsSection.style.display, 'grid');
    app.elements.Mu.value = '';
    app.call('calcular');
    assert.equal(app.elements.statusText.textContent, 'Revisa los parámetros');
    assert.doesNotMatch(app.elements.resultadosContainer.innerHTML, /tabla-comparativa/);
    assert.equal(app.elements.chartsSection.style.display, 'none');
});

test('removing all diameters after a calculation removes the previous selectable result', () => {
    const app = harness();
    app.call('calcular');
    app.state.diameters = [];
    app.call('calcular');
    assert.match(app.elements.resultadosContainer.textContent, /al menos un diámetro/);
    assert.doesNotMatch(app.elements.resultadosContainer.innerHTML, /tabla-comparativa/);
    assert.equal(app.elements.chartsSection.style.display, 'none');
    assert.equal(app.elements.statusText.textContent, 'Revisa los parámetros');
});

test('an unsuccessful calculation keeps its diagnostic instead of reporting completion', () => {
    const app = harness();
    app.call('calcular');
    app.elements.Mu.value = '10000';
    app.elements.bMax.value = '20';
    app.elements.hMax.value = '30';
    app.call('calcular');
    assert.match(app.elements.statusText.textContent, /Sin combinaciones válidas/);
    assert.doesNotMatch(app.elements.resultadosContainer.innerHTML, /tabla-comparativa/);
    assert.equal(app.elements.chartsSection.style.display, 'none');
});

test('all three criteria can recalculate and show finite results', () => {
    const app = harness();
    app.call('calcular');
    for (const criterion of ['optimal', 'economic', 'robust']) {
        app.call('cambiarCriterio', criterion);
        assert.equal(app.elements.statusText.textContent, 'Optimización completada');
        assert.doesNotMatch(app.elements.resultadosContainer.innerHTML, /\[object Object\]|NaN|Infinity/);
    }
});

test('zero material prices, explicitly accepted by the input guard, render without NaN', () => {
    const app = harness();
    app.elements.costH.value = '0';
    app.elements.costA.value = '0';
    assert.equal(app.call('optimizar').error, undefined);
    app.call('calcular');
    assert.equal(/NaN|Infinity/.test(app.elements.resultadosContainer.innerHTML), false,
        'zero reference cost must not render NaN or Infinity percentages');
    const chart = app.state.charts.findLast(chart => chart.type === 'doughnut');
    const tooltip = chart.options.plugins.tooltip.callbacks.label({
        dataset: chart.data.datasets[0], parsed: 0, label: 'Hormigón'
    });
    assert.doesNotMatch(tooltip, /NaN|Infinity/);
});
