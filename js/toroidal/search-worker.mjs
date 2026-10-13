import {searchIndex,parameters,graphID} from './query.mjs?v=2026-10-12-minor';
let manifest,index,hashes,base,ready;
async function bytes(name) {
  const response=await fetch(new URL(name,base));if(!response.ok)throw Error('The catalogue data could not be loaded. Please retry.');
  return new Uint8Array(await response.arrayBuffer());
}
async function initialize(release) {
  if(!/^\d{4}-\d{2}-\d{2}(?:-r[1-9]\d*)?$/.test(release))throw Error('Unknown release.');
  base=new URL(`../../data/toroidal/${release}/`,import.meta.url);
  const r=await fetch(new URL('manifest.json',base));if(!r.ok)throw Error('This release is not available.');manifest=await r.json();
  if(typeof DecompressionStream==='function'){
    const r=await fetch(new URL('index.bin.gz',base));if(!r.ok)throw Error('Search index unavailable.');
    const packed=new Uint8Array(await r.arrayBuffer());
    index=packed[0]===31&&packed[1]===139?new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()):packed;
  }else index=await bytes('index.bin');
  if(index.length!==manifest.count*manifest.stride*(manifest.elementBytes||1))throw Error('Incomplete search index.');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',index)),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==manifest.indexSha256)throw Error('The search index failed its integrity check.');
  if(manifest.elementBytes===2){const view=new DataView(index.buffer,index.byteOffset,index.byteLength);index=Uint16Array.from({length:index.length/2},(_,i)=>view.getUint16(i*2,true));}
  return manifest;
}
async function exactGraph6(query) {
  if(!query || /^(?:TO-)?\d{1,6}$/i.test(query))return null;
  hashes ||= await bytes('graph6-hashes.bin');
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(query.replace(/^>>graph6<</,'')))).slice(0,8),ids=[];
  for(let i=0;i<manifest.count;i++){let same=true;for(let j=0;j<8;j++)if(hashes[i*8+j]!==hash[j]){same=false;break;}if(same)ids.push(i+1);}
  return ids;
}
self.onmessage=async ({data})=>{
  const {request,type,state,release}=data;
  try {
    if(type==='init'){ready=initialize(release);self.postMessage({request,manifest:await ready});return;}
    await ready;
    const started=performance.now(),result=searchIndex(index,manifest,state,await exactGraph6(state.query));
    if(type==='ids'){self.postMessage({request,ids:result.ids,errors:result.errors},[result.ids.buffer]);return;}
    if(type==='csv'){
      const keys=['n','m','kappa','lambda','mindeg','maxdeg','components','bipartite','regular'];
      const lines=['id,vertices,edges,vertex_connectivity,edge_connectivity,minimum_degree,maximum_degree,components,bipartite,regular'];
      for(const id of result.ids){const p=parameters(index,manifest,id);lines.push([graphID(id),...keys.map(k=>p[k]??'')].join(','));}
      self.postMessage({request,text:lines.join('\n')+'\n',errors:result.errors});return;
    }
    const pageSize=20,page=Math.min(state.page,Math.max(0,Math.ceil(result.ids.length/pageSize)-1));
    const rows=Array.from(result.ids.slice(page*pageSize,(page+1)*pageSize),id=>({id,...parameters(index,manifest,id)}));
    self.postMessage({request,count:result.ids.length,page,rows,errors:result.errors,milliseconds:performance.now()-started});
  }catch(e){self.postMessage({request,error:e.message});}
};
