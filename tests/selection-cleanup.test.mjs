import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePdfSelection as clean } from '../src/utils/normalizePdfSelection.ts';
import { extractSelectionContext as context } from '../src/utils/extractSelectionContext.ts';

test('joins broken words and sentence lines', () => {
  assert.equal(clean('Machine learn-\ning is a sub-\nfield of artificial\nintelligence.'),
    'Machine learning is a subfield of artificial intelligence.');
});
test('preserves inline compound hyphens and paragraph boundaries', () => {
  assert.equal(clean(' state-of-the-art  tools\nwork.\n\nNext paragraph. '),
    'state-of-the-art tools work.\n\nNext paragraph.');
});
test('normalizes Vietnamese, spaces, CRLF and extraction controls', () => {
  assert.equal(clean('Tiếng\t Việt\r\nrất\u00a0  hay.\u0000\u200b'), 'Tiếng Việt rất hay.');
  assert.equal(clean('learn\u00ad\ning'), 'learning');
});
const f = (text, left = 0, right = 250) => ({text, left, right});
test('context uses nearest prefix and suffix within hard limits', () => {
  const result = context([f('a'.repeat(900) + 'END')], [f('START' + 'b'.repeat(900))], {left:0,right:250});
  assert.equal(result.before.length, 650);
  assert.equal(result.after.length, 650);
  assert.ok(result.before.endsWith('END'));
  assert.ok(result.after.startsWith('START'));
  assert.equal(context([f('x'.repeat(1000))], [], {left:0,right:250}, 9999).before.length, 800);
});
test('adjacent column is excluded, same column retained', () => {
  assert.deepEqual(context([f('Left'), f('Wrong', 350, 600)], [f('Right',350,600),f('Next')], {left:0,right:250}),
    {before:'Left',after:'Next'});
});
test('empty context and zero limit are safe', () => {
  assert.deepEqual(context([], [], {left:0,right:250}), {before:'',after:''});
  assert.deepEqual(context([f('before')], [f('after')], {left:0,right:250}, 0), {before:'',after:''});
});
