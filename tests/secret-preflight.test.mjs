import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleSecretNames } from '../scripts/check-secrets.mjs';

test('environment preflight flags secret values and accepts nonsecret configuration', () => {
  assert.deepEqual(sampleSecretNames('GEMINI_API_KEY=dummy-test-key\nMONGODB_URI="mongodb://test:dummy@localhost/"\nAI_ACCESS_TOKEN=\nGEMINI_MODEL=example-model\n'), ['GEMINI_API_KEY', 'MONGODB_URI']);
  assert.deepEqual(sampleSecretNames('GEMINI_API_KEY=\nMONGODB_URI=\nAI_ACCESS_TOKEN=\nGEMINI_MODEL=model\n'), []);
});
