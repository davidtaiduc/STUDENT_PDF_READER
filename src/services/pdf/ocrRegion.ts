export interface NormalizedRegion {x:number;y:number;width:number;height:number}
export function regionFromPoints(start:{x:number;y:number},end:{x:number;y:number},bounds:{left:number;top:number;width:number;height:number}):NormalizedRegion{
 const clamp=(v:number)=>Math.max(0,Math.min(1,v));
 const x1=clamp((start.x-bounds.left)/bounds.width),x2=clamp((end.x-bounds.left)/bounds.width),y1=clamp((start.y-bounds.top)/bounds.height),y2=clamp((end.y-bounds.top)/bounds.height);
 return {x:Math.min(x1,x2),y:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)};
}
export function regionViewport(width:number,height:number,region:NormalizedRegion){
 if(![width,height,region.x,region.y,region.width,region.height].every(Number.isFinite)||width<=0||height<=0||region.x<0||region.y<0||region.width<=0||region.height<=0||region.x+region.width>1.000001||region.y+region.height>1.000001)throw new Error('Vùng chọn không hợp lệ. Hãy khoanh vùng lại.');
 const scale=Math.min(3,Math.sqrt(4_000_000/(width*region.width*height*region.height)),8192/(width*region.width),8192/(height*region.height));
 return {scale,left:width*scale*region.x,top:height*scale*region.y,width:Math.max(1,Math.min(8192,Math.ceil(width*scale*region.width))),height:Math.max(1,Math.min(8192,Math.ceil(height*scale*region.height)))};
}
