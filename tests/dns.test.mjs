import assert from 'node:assert/strict';
import { test } from 'node:test';
import dns from 'node:dns/promises';
import { configureDns } from '../backend/src/config/dns.ts';

test('DNS override is optional, validates IPs and affects only the current process resolver', () => {
  const original = dns.getServers();
  try {
    configureDns(undefined);
    assert.deepEqual(dns.getServers(), original);
    assert.throws(() => configureDns('https://dns.example.com'));
    assert.throws(() => configureDns('1.1.1.1,'));
    assert.deepEqual(dns.getServers(), original);
    configureDns('1.1.1.1, 8.8.8.8');
    assert.deepEqual(dns.getServers(), ['1.1.1.1', '8.8.8.8']);
  } finally { dns.setServers(original); }
});
