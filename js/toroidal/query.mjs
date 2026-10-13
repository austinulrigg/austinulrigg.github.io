export const fields = {n:'Vertices',m:'Edges',kappa:'Vertex connectivity',lambda:'Edge connectivity',mindeg:'Minimum degree',maxdeg:'Maximum degree',components:'Connected components',bipartite:'Bipartite',regular:'Regular',minor:'Minor-order obstruction'};
export const operations = {lt:'less than',le:'at most',eq:'equals',ge:'at least',gt:'greater than',between:'between',unknown:'unknown'};
export const defaults = () => ({query:'',filters:[],mode:'all',sorts:[{field:'n',direction:'asc'},{field:'m',direction:'asc'}],page:0});
export const graphID = n => `TO-${String(n).padStart(6,'0')}`;
export function normalize(raw={}) {
  const d=defaults();
  d.query=String(raw.query||'').trim().slice(0,1600);
  d.mode=raw.mode==='any'?'any':'all';
  d.page=Number.isInteger(+raw.page)&&+raw.page>=0?Math.min(+raw.page,100000):0;
  if(Array.isArray(raw.filters))d.filters=raw.filters.slice(0,12).filter(r=>r&&Object.hasOwn(fields,r.field)&&Object.hasOwn(operations,r.op)).map(r=>({field:r.field,op:r.op,value:String(r.value??''),upper:String(r.upper??'')}));
  if(Array.isArray(raw.sorts)){const used=new Set();d.sorts=raw.sorts.slice(0,9).filter(r=>r&&Object.hasOwn(fields,r.field)&&!used.has(r.field)&&used.add(r.field)).map(r=>({field:r.field,direction:r.direction==='desc'?'desc':'asc'}));}
  return d;
}
export function issues(state) {
  const errors=[];
  for(const [i,r] of state.filters.entries()) {
    if(r.op==='unknown')continue;
    if(['bipartite','regular','minor'].includes(r.field)) {if(!['true','false'].includes(r.value))errors.push(`Filter ${i+1} needs ${r.field==='minor'?'Yes or Not recorded':'Yes or No'}.`);continue;}
    if(r.value===''||!Number.isInteger(+r.value)||+r.value<0)errors.push(`Filter ${i+1} needs a nonnegative whole number.`);
    else if(r.op==='between'&&(r.upper===''||!Number.isInteger(+r.upper)||+r.upper<+r.value))errors.push(`Filter ${i+1} needs an upper bound at least as large as its lower bound.`);
  }
  return errors;
}
export function searchIndex(index, manifest, raw, exactIDs=null) {
  const state=normalize(raw), errors=issues(state);
  if(errors.length)return {ids:new Uint32Array(),errors};
  const columns=Object.fromEntries(manifest.fields.map((f,i)=>[f,i])),stride=manifest.stride,unknown=manifest.unknownValue??255;
  const rules=state.filters.map(r=>({...r,column:columns[r.field],a:['bipartite','regular','minor'].includes(r.field)?Number(r.value==='true'):+r.value,b:+r.upper}));
  const sort=state.sorts.map(r=>({column:columns[r.field],sign:r.direction==='desc'?-1:1}));
  let candidates=exactIDs??Array.from({length:manifest.count},(_,i)=>i+1);
  const q=state.query.toUpperCase();
  if(q&&exactIDs===null){const match=/^(?:TO-)?(\d{1,6})$/.exec(q);candidates=match?[+match[1]]:[];}
  const check=(r,start)=>{const x=index[start+r.column];if(r.op==='unknown')return x===unknown;if(x===unknown)return false;switch(r.op){case'lt':return x<r.a;case'le':return x<=r.a;case'eq':return x===r.a;case'ge':return x>=r.a;case'gt':return x>r.a;case'between':return x>=r.a&&x<=r.b;default:return false;}};
  const matches=[];
  for(const id of candidates){if(!Number.isInteger(id)||id<1||id>manifest.count)continue;const start=(id-1)*stride;if(!rules.length||(state.mode==='any'?rules.some(r=>check(r,start)):rules.every(r=>check(r,start))))matches.push(id);}
  matches.sort((a,b)=>{for(const r of sort){const x=index[(a-1)*stride+r.column],y=index[(b-1)*stride+r.column];if(x===y)continue;if(x===unknown)return 1;if(y===unknown)return -1;return (x-y)*r.sign;}return a-b;});
  return {ids:Uint32Array.from(matches),errors:[]};
}
export function parameters(index,manifest,id) {
  return Object.fromEntries(manifest.fields.map((field,i)=>{const x=index[(id-1)*manifest.stride+i];return [field,x===(manifest.unknownValue??255)?null:x];}));
}
export function fromURL(url) {
  const p=new URL(url).searchParams;
  return normalize({query:p.get('q')||'',mode:p.get('match'),page:p.get('page')||0,
    filters:p.has('f')?p.get('f').split(';').filter(Boolean).map(s=>{const [field,op,value,upper]=s.split(':');return {field,op,value,upper};}):[],
    sorts:p.has('sort')?p.get('sort').split(',').filter(Boolean).map(s=>{const [field,direction]=s.split(':');return {field,direction};}):defaults().sorts});
}
export function toURL(state,release,graph=null) {
  const p=new URLSearchParams({v:release});
  if(state.query)p.set('q',state.query);
  if(state.filters.length)p.set('f',state.filters.map(r=>[r.field,r.op,r.value,r.upper].join(':')).join(';'));
  if(state.mode==='any')p.set('match','any');
  p.set('sort',state.sorts.map(r=>`${r.field}:${r.direction}`).join(','));
  if(state.page)p.set('page',String(state.page));
  if(graph)p.set('graph',graphID(graph));
  return `?${p}`;
}
