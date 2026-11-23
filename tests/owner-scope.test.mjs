import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolvedOwnerScope} from '../src/services/ownerScope.ts';
test('account identity remains blocked while auth is unavailable/checking and separates account switches',()=>{
 const a={id:'a'.repeat(24)},b={id:'b'.repeat(24)};
 assert.equal(resolvedOwnerScope('checking',a),null);assert.equal(resolvedOwnerScope('unavailable',a),null);assert.equal(resolvedOwnerScope('ready',null),'guest');assert.notEqual(resolvedOwnerScope('ready',a),resolvedOwnerScope('ready',b));
});
