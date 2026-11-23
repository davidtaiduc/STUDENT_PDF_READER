// A small, deterministic expression evaluator for pipeline unit tests. NOT a MongoDB integration substitute.
const field=(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object);
function evaluate(value,doc,variables={}) {
 if(typeof value==='string') {if(value.startsWith('$$')){const [name,...path]=value.slice(2).split('.');return path.length?field(variables[name],path.join('.')):variables[name];}if(value.startsWith('$'))return field(doc,value.slice(1));return value;}
 if(Array.isArray(value))return value.map(v=>evaluate(v,doc,variables));
 if(!value||typeof value!=='object'||value instanceof Date)return value;
 const op=Object.keys(value)[0], arg=value[op];
 if(op==='$cond'){return evaluate(arg[evaluate(arg[0],doc,variables)?1:2],doc,variables);}
 if(op==='$filter'){const list=evaluate(arg.input,doc,variables);return list.filter(item=>evaluate(arg.cond,doc,{...variables,[arg.as]:item}));}
 const args=Array.isArray(arg)?arg.map(v=>evaluate(v,doc,variables)):null;
 if(op==='$ifNull')return args[0]??args[1];if(op==='$and')return args.every(Boolean);
 if(op==='$eq')return args[0]===args[1];if(op==='$lt')return args[0]<args[1];if(op==='$gt')return args[0]>args[1];
 if(op==='$add')return args.reduce((a,b)=>a+b,0);if(op==='$size')return evaluate(arg,doc,variables).length;
 if(op==='$concatArrays')return args.flat();
 if(op.startsWith('$'))throw new Error('Unsupported test expression '+op);
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,evaluate(item,doc,variables)]));
}
export function pipelineDatabase(){
 const collections=new Map();
 return {collection(name){if(!collections.has(name))collections.set(name,new Map());const records=collections.get(name);
 return {records,findOne:async filter=>structuredClone(records.get(filter._id)??null),
 findOneAndUpdate:async(filter,pipeline,options)=>{if(!records.has(filter._id)&&!options?.upsert)return null;let doc=records.get(filter._id)??{_id:filter._id};for(const stage of pipeline){doc={...doc,...evaluate(stage.$set,doc)};}records.set(filter._id,doc);return structuredClone(doc);},
 updateOne:async(filter,update)=>{const doc=records.get(filter._id);if(doc&&update.$pull?.leases)doc.leases=doc.leases.filter(lease=>lease.id!==update.$pull.leases.id);return {modifiedCount:doc?1:0};},
 createIndex:async()=>{} };
 }};
}
