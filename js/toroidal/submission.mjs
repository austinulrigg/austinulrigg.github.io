import {decodeGraph6,decodeUpper} from './graph.mjs';
export const limits={bytes:200000,graphs:100,vertices:128};
export function parseGraphs(text,format){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>limits.bytes)throw Error('Graph data exceeds 200 KB.');
 if(!['graph6','upper'].includes(format))throw Error('Choose graph6 or upper-triangular adjacency.');
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).filter(s=>s!=='>>graph6<<');
 if(!lines.length||lines.length>limits.graphs)throw Error('Submit between 1 and 100 graphs.');
 return lines.map((line,i)=>{try{return (format==='upper'?decodeUpper:decodeGraph6)(line,limits.vertices);}catch(e){throw Error(`Graph ${i+1}: ${e.message}`);}});
}
export function validateSubmission(input){
 const out={};
 for(const [key,max] of Object.entries({name:160,email:254,source:4000,credit:500,notes:10000,graphId:20})){
   if(typeof input[key]!=='string'||input[key].length>max)throw Error(`Invalid ${key} field.`);out[key]=input[key].trim();
 }
 if(!out.name||!out.source||!out.credit||!/^\S+@\S+\.\S+$/.test(out.email))throw Error('Include your name, email, source, and discovery credit.');
 if(!['addition','correction'].includes(input.kind))throw Error('Choose a submission type.');
 if(input.kind==='correction'&&!/^TO-\d{6}$/.test(out.graphId))throw Error('Include the graph ID for a correction.');
 if(out.graphId&&!/^TO-\d{6}$/.test(out.graphId))throw Error('Use a graph ID such as TO-000001.');
 if(input.consent!==true)throw Error('Confirm that the graph data and attribution may be published.');
 const parsed=parseGraphs(input.graphs,input.format);
 return {...out,kind:input.kind,format:input.format,original:input.graphs,graphs:parsed.map(g=>g.g6),consent:true};
}
