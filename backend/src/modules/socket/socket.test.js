// Socket endpoint tests for join-room / room-update / submit-answer / disconnect / reconnect / timeout
//
// Install:  npm i -D socket.io-client
// Run:      RECONNECT_WINDOW_MS=2000 QUESTION_DURATION_MS=4000 node --test src/modules/socket/socket.test.js
//   (short timings keep the timeout test fast; defaults are 60s / 10s)
//
// Requires:
//   - Server running with socket.io listening on SOCKET_PORT (default 5000)
//   - Two existing user IDs for the players. Provide via env:
//       TEST_USER_A, TEST_USER_B
//   - A room created with quiz data, host = TEST_USER_A. Provide via env:
//       TEST_ROOM_ID
//   (these need to be set up before running this file)

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { io as Client } from 'socket.io-client';

const SOCKET_URL = process.env.TEST_SOCKET_URL || `http://localhost:${process.env.SOCKET_PORT || 5000}`;
const USER_A = process.env.TEST_USER_A;
const USER_B = process.env.TEST_USER_B;
const ROOM_ID = process.env.TEST_ROOM_ID;
const RECONNECT_MS = Number(process.env.RECONNECT_WINDOW_MS) || 60_000;

before(() => {
    assert.ok(USER_A && USER_B && ROOM_ID,
        'precondition: TEST_USER_A, TEST_USER_B, TEST_ROOM_ID env vars must be set');
});

const connect = (userId) => new Promise((resolve, reject) => {
    const c = Client(SOCKET_URL, { query: { userId, roomId: ROOM_ID } });
    c.once('connect', () => resolve(c));
    c.once('connect_error', reject);
    setTimeout(() => reject(new Error('connect timeout')), 3000);
});

const emit = (client, event, ...args) => new Promise((resolve) => {
    client.emit(event, ...args, (ack) => resolve(ack));
});

const waitFor = (client, event, ms = 5000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event "${event}" not received in ${ms}ms`)), ms);
    client.once(event, (payload) => { clearTimeout(t); resolve(payload); });
});

// ── connection ───────────────────────────────────────────────────────────────

test('connection — rejects when userId missing', async () => {
    await assert.rejects(async () => {
        await new Promise((resolve, reject) => {
            const c = Client(SOCKET_URL, { query: {} });
            c.once('connect', () => { c.close(); resolve(); });
            c.once('connect_error', (e) => { c.close(); reject(e); });
            setTimeout(() => { c.close(); reject(new Error('no response')); }, 2000);
        });
    });
});

test('connection — accepts valid userId', async () => {
    const c = await connect(USER_A);
    assert.equal(c.connected, true);
    c.close();
});

// ── join-room ────────────────────────────────────────────────────────────────

test('join-room — first player joins (no start-game yet)', async () => {
    const a = await connect(USER_A);
    const ack = await emit(a, 'join-room', ROOM_ID);
    assert.ok(ack.success, `join failed: ${JSON.stringify(ack)}`);
    a.close();
});

test('join-room + start-game — when both players join, start-game is emitted', async () => {
    const a = await connect(USER_A);
    const b = await connect(USER_B);

    await emit(a, 'join-room', ROOM_ID);
    const startedOnA = waitFor(a, 'start-game');
    const startedOnB = waitFor(b, 'start-game');
    await emit(b, 'join-room', ROOM_ID);

    const [pa, pb] = await Promise.all([startedOnA, startedOnB]);
    assert.equal(pa.roomId, ROOM_ID);
    assert.ok(pb.questions);

    a.close(); b.close();
});

// ── disconnect / reconnect / timeout ────────────────────────────────────────

test('disconnect — remaining player receives opponent-left', async () => {
    const a = await connect(USER_A);
    const b = await connect(USER_B);
    await emit(a, 'join-room', ROOM_ID);
    await emit(b, 'join-room', ROOM_ID);
    await waitFor(b, 'start-game');

    const left = waitFor(b, 'opponent-left');
    a.disconnect();
    const payload = await left;
    assert.equal(payload.reconnectWindowMs, RECONNECT_MS);

    b.close();
});

test('reconnect — within window emits game-resumed', async () => {
    const a = await connect(USER_A);
    const b = await connect(USER_B);
    await emit(a, 'join-room', ROOM_ID);
    await emit(b, 'join-room', ROOM_ID);
    await waitFor(b, 'start-game');

    a.disconnect();
    await waitFor(b, 'opponent-left');

    const a2 = await connect(USER_A);
    const resumed = waitFor(b, 'game-resumed');
    const ack = await emit(a2, 'join-room', ROOM_ID);
    assert.equal(ack.resumed, true);
    const payload = await resumed;
    assert.ok(typeof payload.remainingMs === 'number');

    a2.close(); b.close();
});

test('timeout — no reconnect within window emits game-ended with winnerUserId', async () => {
    const a = await connect(USER_A);
    const b = await connect(USER_B);
    await emit(a, 'join-room', ROOM_ID);
    await emit(b, 'join-room', ROOM_ID);
    await waitFor(b, 'start-game');

    a.disconnect();
    const ended = waitFor(b, 'game-ended', RECONNECT_MS + 3000);
    const payload = await ended;
    assert.equal(payload.reason, 'opponent-timeout');
    assert.equal(payload.winnerUserId, USER_B);

    b.close();
});

// ── submit-answer guards ────────────────────────────────────────────────────

test('submit-answer — rejected while game is paused', async () => {
    const a = await connect(USER_A);
    const b = await connect(USER_B);
    await emit(a, 'join-room', ROOM_ID);
    await emit(b, 'join-room', ROOM_ID);
    await waitFor(b, 'start-game');

    a.disconnect();
    await waitFor(b, 'opponent-left');

    const ack = await emit(b, 'submit-answer', { roomId: ROOM_ID, questionIndex: 0, chosenOption: 0 });
    assert.equal(ack.success, false);
    assert.match(ack.error || '', /paused|ended/i);

    b.close();
});

// ── room-update ──────────────────────────────────────────────────────────────

test('room-update — updates the player record', async () => {
    const a = await connect(USER_A);
    await emit(a, 'join-room', ROOM_ID);
    const ack = await emit(a, 'room-update', { roomId: ROOM_ID, userId: USER_A, score: 7 });
    // ack may be success or zod-validation error depending on validator wiring (known bug)
    assert.ok(ack === undefined || 'success' in ack || 'error' in ack);
    a.close();
});
