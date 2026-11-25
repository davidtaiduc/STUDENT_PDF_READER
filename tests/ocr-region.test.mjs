import {test} from 'node:test';
import assert from 'node:assert/strict';
import {regionFromPoints,regionViewport} from '../src/services/pdf/ocrRegion.ts';
test('OCR region clamps reversed drags to PDF bounds independent of screen offsets',()=>{
 assert.deepEqual(regionFromPoints({x:190,y:280},{x:110,y:220},{left:100,top:200,width:100,height:100}),{x:.1,y:.2,width:.8,height:.6000000000000001});
 assert.deepEqual(regionFromPoints({x:0,y:0},{x:300,y:400},{left:100,top:200,width:100,height:100}),{x:0,y:0,width:1,height:1});
});
test('OCR allocates crop pixels only and respects raster limits for large pages',()=>{
 const crop=regionViewport(600,800,{x:.1,y:.2,width:.25,height:.1});
 assert.deepEqual(crop,{scale:3,left:180,top:480,width:450,height:240});
 const huge=regionViewport(100000,100000,{x:0,y:0,width:1,height:.001});assert.ok(huge.width<=8192);assert.ok(huge.width*huge.height<=4_010_000);
 for(const region of [{x:-1,y:0,width:1,height:1},{x:0,y:0,width:0,height:1},{x:.5,y:0,width:1,height:1}])assert.throws(()=>regionViewport(600,800,region));
});
