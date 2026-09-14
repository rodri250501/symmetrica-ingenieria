import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isFreeProgram, canAccessProgram, requiresSignedInUser
} from '../src/core/program-access.mjs';

const paidProgram = { id: 'beam', price: 20 };
const purchaser = { userData: { purchasedTools: ['beam'] } };
const subscriber = { userData: { purchasedTools: [] } };

test('a visitor can open programs explicitly priced at zero without an account', () => {
    for (const price of [0, '0']) {
        const program = { id: 'free', price };
        assert.equal(isFreeProgram(program), true);
        assert.equal(canAccessProgram(program, null), true);
    }
});

test('missing or malformed prices never accidentally grant free access', () => {
    const nonFreePrograms = [
        undefined, null, {},
        ...[undefined, null, '', ' ', false, [], {}, -1, '-1', NaN, 20, '20']
            .map(price => ({ id: 'unknown', price }))
    ];
    for (const program of nonFreePrograms) {
        assert.equal(isFreeProgram(program), false);
        assert.equal(canAccessProgram(program, null), false);
    }
});

test('paid access still requires a purchase or an active subscription', () => {
    assert.equal(canAccessProgram(paidProgram, null), false);
    assert.equal(canAccessProgram(paidProgram, subscriber), false);
    assert.equal(canAccessProgram(paidProgram, purchaser), true);
    assert.equal(canAccessProgram(paidProgram, subscriber, true), true);
    assert.equal(canAccessProgram({ id: 'other', price: 20 }, purchaser), false);
    assert.equal(canAccessProgram(undefined, subscriber, true), false);
});

test('logout revokes paid access even before subscription state catches up', () => {
    assert.equal(canAccessProgram(paidProgram, subscriber, true), true);
    assert.equal(canAccessProgram(paidProgram, null, true), false);
    assert.equal(requiresSignedInUser('program', paidProgram, false), true);
});

test('anonymous auth initialization and logout preserve demo and free views', () => {
    assert.equal(requiresSignedInUser('program', paidProgram, true), false);
    for (const price of [0, '0']) {
        assert.equal(requiresSignedInUser('program', { id: 'free', price }), false);
    }
    assert.equal(requiresSignedInUser('program', paidProgram), true);
    assert.equal(requiresSignedInUser('program', undefined), true);
    for (const route of ['admin', 'account']) {
        assert.equal(requiresSignedInUser(route, { price: 0 }, true), true);
    }
    for (const route of ['home', 'plans']) {
        assert.equal(requiresSignedInUser(route, undefined), false);
    }
});

test('a malformed purchase list cannot masquerade as ownership', () => {
    for (const user of [{}, { userData: {} }, { userData: { purchasedTools: 'beam' } }]) {
        assert.equal(canAccessProgram(paidProgram, user), false);
    }
});
