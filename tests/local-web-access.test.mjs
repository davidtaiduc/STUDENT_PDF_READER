import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localWebAuthorization } from '../backend/src/auth/localWebAccess.ts';

test('local web server adds the private credential without a user code', () => {
  assert.equal(localWebAuthorization('server-only', '127.0.0.1', '127.0.0.1:5173', 'http://127.0.0.1:5173'), 'Bearer server-only');
  assert.equal(localWebAuthorization('server-only', '::1', 'localhost:5173', undefined), 'Bearer server-only');
});

test('external connections, hosts and cross-origin pages never receive backend credentials', () => {
  assert.equal(localWebAuthorization('server-only', '192.168.1.2', '127.0.0.1:5173', undefined), undefined);
  assert.equal(localWebAuthorization('server-only', '127.0.0.1', 'evil.test', undefined), undefined);
  assert.equal(localWebAuthorization('server-only', '127.0.0.1', '127.0.0.1:5173', 'https://evil.test'), undefined);
  assert.equal(localWebAuthorization(undefined, '127.0.0.1', '127.0.0.1:5173', undefined), undefined);
});
