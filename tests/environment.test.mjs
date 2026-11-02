import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readProjectEnvironment } from '../backend/src/config/environment.ts';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'student-pdf-env-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}
test('runtime reads .env and ignores sample, local and mode files', t => {
  const directory = fixture(t);
  writeFileSync(join(directory, '.env'), 'AI_ACCESS_TOKEN=actual-file\nPORT=3001\n');
  for (const name of ['.env.example', '.env.local', '.env.production']) {
    writeFileSync(join(directory, name), 'AI_ACCESS_TOKEN=wrong-file\nPORT=9999\n');
  }
  const values = readProjectEnvironment(directory, {});
  assert.equal(values.AI_ACCESS_TOKEN, 'actual-file'); assert.equal(values.PORT, '3001');
});
test('process/hosting environment takes precedence', t => {
  const directory = fixture(t);
  writeFileSync(join(directory, '.env'), 'PORT=3001\n');
  assert.equal(readProjectEnvironment(directory, { PORT: '4000' }).PORT, '4000');
});
test('missing .env never falls back to sample', t => {
  const directory = fixture(t);
  writeFileSync(join(directory, '.env.example'), 'AI_ACCESS_TOKEN=sample-only\n');
  assert.equal(readProjectEnvironment(directory, {}).AI_ACCESS_TOKEN, undefined);
});
