// HTTP endpoint tests for /user/*
// Run:   node --test src/modules/user/user.test.js
// Requires: server must be running and routes mounted at /user
// Env:   TEST_API_URL (default http://localhost:6000)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_API_URL || 'http://localhost:4000';

const post = async (path, body) => {
    const r = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
};

const get = async (path) => {
    const r = await fetch(`${BASE}${path}`);
    return { status: r.status, body: await r.json().catch(() => null) };
};

const email = `test-${Date.now()}@example.com`;
const password = 'pass1234';
let userId;

test('POST /user/register — creates new user', async () => {
    const res = await post('/user/register', { email, password });
    assert.equal(res.status, 201);
    userId = res.body?.user?.id;
    assert.ok(userId, 'response should include user.id');
});

test('POST /user/register — rejects duplicate email', async () => {
    const res = await post('/user/register', { email, password });
    assert.notEqual(res.status, 201);
});

test('POST /user/register — rejects missing fields', async () => {
    const res = await post('/user/register', { email });
    assert.notEqual(res.status, 201);
});

test('POST /user/login — succeeds with correct credentials', async () => {
    const res = await post('/user/login', { email, password });
    assert.equal(res.status, 200);
});

test('POST /user/login — rejects wrong password', async () => {
    const res = await post('/user/login', { email, password: 'wrong' });
    assert.equal(res.status, 401);
});

test('POST /user/login — rejects unknown email', async () => {
    const res = await post('/user/login', { email: 'nobody@example.com', password });
    assert.equal(res.status, 401);
});

test('GET /user/me/:id — returns user (no password)', async () => {
    const res = await get(`/user/me/${userId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body?.email, email);
    assert.equal(res.body?.password, undefined);
});

test('GET /user/me/:id — 404 for unknown id', async () => {
    const res = await get('/user/me/does-not-exist');
    assert.equal(res.status, 404);
});
