import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newSessionToken, sessionHash, readSessionCookie, sessionCookie } from '../backend/src/auth/session.ts';

test('session IDs are opaque random values and only their digest belongs in storage', () => {
  const first = newSessionToken(), second = newSessionToken();
  assert.equal(first.length,43);assert.notEqual(first,second);
  assert.match(sessionHash(first),/^[a-f0-9]{64}$/);assert.notEqual(sessionHash(first),first);
});
test('session cookie parsing rejects malformed or ambiguous cookies', () => {
  const token=newSessionToken();
  assert.equal(readSessionCookie(`other=value; studypdf_session=${token}`),token);
  for(const cookie of [undefined,'studypdf_session=bad',`studypdf_session=${token}; studypdf_session=${token}`]) assert.equal(readSessionCookie(cookie),undefined);
});
test('browser session is HttpOnly SameSite, scoped to application, secure in production and revocable', () => {
  const cookie=sessionCookie(newSessionToken(),true);
  for(const flag of ['HttpOnly','SameSite=Lax','Path=/','Secure','Max-Age=604800']) assert.ok(cookie.includes(flag));
  assert.doesNotMatch(sessionCookie(newSessionToken(),false),/Secure/);
  assert.match(sessionCookie('',true),/Max-Age=0/);
});
