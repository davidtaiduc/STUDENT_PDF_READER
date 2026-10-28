import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderSelectionText } from '../src/utils/orderSelectionText.ts';
const f = (text, left, top, width=600) => ({text,left,right:left+width,top,bottom:top+15});
test('late wide subtitle moves below title and above body',()=>{
 assert.equal(orderSelectionText([f('Title',0,0), f('Body',0,100),f('Subtitle',0,30)],'Title\nBody\nSubtitle'),'Title\nSubtitle\nBody');
});
test('single word and partial selection retain exact text',()=>{
 assert.equal(orderSelectionText([f('word ',0,0)],'word '),'word ');
});
test('normal multiline text retains native line breaks',()=>{
 assert.equal(orderSelectionText([f('Line 1',0,0),f('Line 2',0,30)],'Line 1\nLine 2'),'Line 1\nLine 2');
});
test('two columns retain column order',()=>{
 const parts=[f('L1',0,0,250),f('L2',0,30,250),f('R1',350,0,250),f('R2',350,30,250)];
 assert.equal(orderSelectionText(parts,'L1\nL2\nR1\nR2'),'L1\nL2\nR1\nR2');
});
test('table cells keep existing row order',()=>{
 const parts=[f('A1',0,0,100),f('B1',300,0,100),f('A2',0,30,100),f('B2',300,30,100)];
 assert.equal(orderSelectionText(parts,'A1 B1\nA2 B2'),'A1 B1\nA2 B2');
});
