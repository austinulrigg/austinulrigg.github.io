import {fields,operations,defaults,normalize,issues,graphID,fromURL,toURL} from './query.mjs';
import {decodeGraph6,layout,upper,exportFormats,encoding,exportGraph} from './graph.mjs';
import {mountSurface} from './surface.mjs';
import {catalogueRelease} from './config.mjs?v=2026-10-12-r2';
const root=document.getElementById('torus-db'),$=s=>root.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const release=new URL(location.href).searchParams.get('v')||catalogueRelease;
const base=new URL(`data/toroidal/${release}/`,location.href),pageSize=20;
const numericKeys=Object.keys(fields).filter(f=>!['bipartite','regular'].includes(f));
const option=(keys,value,names)=>keys.map(k=>`<option value="${k}"${value===k?' selected':''}>${esc(names[k])}</option>`).join('');
let state=fromURL(location.href),worker,manifest,serial=0,generation=0,total=0,currentRows=[],selected=null,tab='overview',drawing='spring',labels=true,dataFormat='g6',filterOpen=false,sortOpen=false,requestTimer,downloadController;
const pending=new Map(),chunkCache=new Map(),drawCache=new Map();
function request(type,extra={}){return new Promise((resolve,reject)=>{const request=++serial;pending.set(request,{resolve,reject});worker.postMessage({request,type,state:structuredClone(state),...extra});});}
function fail(error){$('#td-load-error').hidden=false;$('#td-load-error p').textContent=error.message||String(error);$('#td-result-count').textContent='Unable to load graphs';$('#td-table-body').innerHTML='';}
function persist(push=false){const url=toURL(state,release,selected);history[push?'pushState':'replaceState']({},'',url);}
function status(text){$('#td-message').textContent=text;}
function sourceList(g){if(g.attribution)return `<li>${esc(g.attribution.source)}</li>`;return g.sources.map(s=>`<li><a href="${manifest.sourceFiles[s[0]].url}">${esc(manifest.sourceFiles[s[0]].file.replace(/\.gz$/,''))}</a>, line ${s[1]}</li>`).join('');}
async function chunk(num){if(!chunkCache.has(num)){const p=fetch(new URL(`graphs-${String(num).padStart(3,'0')}.json`,base)).then(async r=>{if(!r.ok)throw Error('Graph data could not be loaded. Please retry.');return r.json();}).catch(e=>{chunkCache.delete(num);throw e;});chunkCache.set(num,p);if(chunkCache.size>12)chunkCache.delete(chunkCache.keys().next().value);}return chunkCache.get(num);}
async function graph(id,params){if(!Number.isInteger(id)||id<1||id>manifest.count)throw Error('Graph ID not found.');const row=(await chunk(Math.floor((id-1)/manifest.chunkSize)))[(id-1)%manifest.chunkSize];return {id,...decodeGraph6(row[0]),...params,sources:row[1],attribution:row[2]||null};}
function svg(g,small=false){let pos=drawCache.get(g.id);if(!pos){pos=layout(g);drawCache.set(g.id,pos);if(drawCache.size>100)drawCache.delete(drawCache.keys().next().value);}if(!small&&drawing==='circle')pos=layout(g,true);return `<svg class="${small?'td-thumbnail':'td-graph'}" viewBox="0 0 360 310" role="img" aria-label="${graphID(g.id)}, ${g.n} vertices, ${g.m} edges">${g.edges.map(([u,v])=>`<line class="td-graph-line" x1="${pos[u][0]}" y1="${pos[u][1]}" x2="${pos[v][0]}" y2="${pos[v][1]}"${small?' style="stroke-width:4"':''}/>`).join('')}${pos.map(([x,y],i)=>`<circle class="td-graph-node" cx="${x}" cy="${y}" r="${small?9:4.5}"/>${!small&&labels?`<text class="td-graph-label" x="${x+8}" y="${y-8}">${i}</text>`:''}`).join('')}</svg>`;}
function renderFilters(){
 $('#td-filter-rows').innerHTML=state.filters.map((r,i)=>{const bool=['bipartite','regular'].includes(r.field),unknown=r.op==='unknown';return `<div class="td-rule"><label class="td-field-label">Parameter<select data-filter="${i}" data-part="field" aria-label="Filter ${i+1} parameter">${option(Object.keys(fields),r.field,fields)}</select></label><label>Condition<select data-filter="${i}" data-part="op" aria-label="Filter ${i+1} comparison">${option(bool?['eq','unknown']:Object.keys(operations),r.op,bool?{eq:'is',unknown:'unknown'}:operations)}</select></label><label>Value<div class="td-rule-values">${unknown?'<span>Unknown</span>':bool?`<select data-filter="${i}" data-part="value" aria-label="Filter ${i+1} value">${option(['true','false'],r.value,{true:'Yes',false:'No'})}</select>`:`<input type="number" min="0" step="1" data-filter="${i}" data-part="value" aria-label="Filter ${i+1} value" value="${esc(r.value)}">${r.op==='between'?`<span>to</span><input type="number" min="0" step="1" data-filter="${i}" data-part="upper" aria-label="Filter ${i+1} upper bound" value="${esc(r.upper)}">`:''}`}</div></label><button class="td-remove" data-action="remove-filter" data-index="${i}" aria-label="Remove filter ${i+1}">×</button></div>`;}).join('');
 $('#td-filter-mode').value=state.mode;$('#td-filter-panel').hidden=!filterOpen;$('#td-filter-button').setAttribute('aria-expanded',String(filterOpen));$('#td-filter-count').textContent=state.filters.length;$('#td-filter-count').hidden=!state.filters.length;
 $('[data-action="add-filter"]').disabled=state.filters.length>=12;
}
function renderSorts(){
 $('#td-sort-rows').innerHTML=state.sorts.map((r,i)=>`<div class="td-sort-rule"><span class="td-rank">${i+1}</span><label>${i?'Then by':'Sort by'}<select data-sort="${i}" data-part="field" aria-label="Sort ${i+1} parameter">${option(numericKeys,r.field,fields)}</select></label><label>Order<select data-sort="${i}" data-part="direction" aria-label="Sort ${i+1} direction">${option(['asc','desc'],r.direction,{asc:'Lowest to highest',desc:'Highest to lowest'})}</select></label><button class="td-remove" data-action="raise-sort" data-index="${i}" aria-label="Move sort ${i+1} up"${!i?' disabled':''}>↑</button><button class="td-remove" data-action="remove-sort" data-index="${i}" aria-label="Remove sort ${i+1}">×</button></div>`).join('');
 $('#td-sort-panel').hidden=!sortOpen;$('#td-sort-button').setAttribute('aria-expanded',String(sortOpen));$('[data-action="add-sort"]').disabled=state.sorts.length>=numericKeys.length;
}
function renderChips(){const symbols={lt:'<',le:'≤',eq:'=',ge:'≥',gt:'>'};$('#td-chips').innerHTML=state.filters.map((r,i)=>{const text=r.op==='unknown'?`${fields[r.field]} unknown`:['bipartite','regular'].includes(r.field)?`${fields[r.field]} ${r.value==='true'?'yes':'no'}`:r.op==='between'?`${r.value} ≤ ${fields[r.field].toLowerCase()} ≤ ${r.upper}`:`${fields[r.field]} ${symbols[r.op]} ${r.value}`;return `<span class="td-chip">${esc(text)}<button data-action="remove-filter" data-index="${i}" aria-label="Remove ${esc(text)}">×</button></span>`;}).join('')+(state.filters.length>1&&state.mode==='any'?'<span class="td-helper">Match any</span>':'');}
function tableHead(){ $('#td-table-head').innerHTML=[['id','Graph'],['n','Vertices'],['m','Edges'],['kappa','Vertex connectivity κ'],['lambda','Edge connectivity λ']].map(([key,name])=>{const r=state.sorts.find(s=>s.field===key),primary=state.sorts[0]?.field===key;return `<th scope="col"${primary?` aria-sort="${r.direction==='asc'?'ascending':'descending'}"`:''}>${key==='id'?name:`<button data-sort-column="${key}" aria-label="Sort by ${fields[key]}">${name}${r?' '+(r.direction==='asc'?'↑':'↓'):''}</button>`}</th>`;}).join('');}
async function results(){
 const gen=++generation;renderChips();tableHead();persist();
 const errors=issues(state);$('#td-filter-error').hidden=!errors.length;$('#td-filter-error').textContent=errors.join(' ');
 $('#td-sort-description').textContent=state.sorts.map(r=>`${fields[r.field]} ${r.direction==='asc'?'↑':'↓'}`).join(' · ')||'Graph ID ↑';
 $('#td-table-body').setAttribute('aria-busy','true');
 try{const response=await request('search');if(gen!==generation)return;
  if(response.errors.length)throw Error(response.errors.join(' '));
  total=response.count;state.page=response.page;currentRows=response.rows;persist();
  $('#td-result-count').textContent=`${total.toLocaleString()} ${total===1?'graph':'graphs'}`;
  $('#td-export-summary').textContent=`${total.toLocaleString()} matching graphs`;
  const graphs=await Promise.all(currentRows.map(r=>graph(r.id,r)));if(gen!==generation)return;
  $('#td-table-body').innerHTML=graphs.map(g=>`<tr><td><a class="td-record" href="${esc(toURL(state,release,g.id))}" data-graph="${g.id}"><span>${graphID(g.id)}</span></a></td><td>${g.n}</td><td>${g.m}</td><td>${g.kappa??'Unknown'}</td><td>${g.lambda??'Unknown'}</td></tr>`).join('');
  $('#td-empty').hidden=!!total;$('#td-page-summary').textContent=total?`${(state.page*pageSize+1).toLocaleString()}–${Math.min((state.page+1)*pageSize,total).toLocaleString()} of ${total.toLocaleString()}`:'';
  $('#td-prev').disabled=state.page===0;$('#td-next').disabled=(state.page+1)*pageSize>=total;
  $('#td-load-error').hidden=true;
 }catch(e){if(gen!==generation)return;if(errors.length){total=0;$('#td-table-body').innerHTML='';$('#td-result-count').textContent='Invalid filter';$('#td-empty').hidden=true;$('#td-page-summary').textContent='';$('#td-next').disabled=true;$('#td-prev').disabled=true;}else fail(e);}
 finally{if(gen===generation)$('#td-table-body').setAttribute('aria-busy','false');}
}
function update(rerender=true){state.page=0;if(rerender){renderFilters();renderSorts();}clearTimeout(requestTimer);requestTimer=setTimeout(results,120);}
const propRows=g=>[['Vertices',g.n],['Edges',g.m],['Vertex connectivity κ',g.kappa],['Edge connectivity λ',g.lambda],['Minimum / maximum degree',`${g.mindeg} / ${g.maxdeg}`],['Connected components',g.components],['Bipartite',g.bipartite?'Yes':'No'],['Regular',g.regular?`Yes, ${g.mindeg}-regular`:'No']].map(([k,v])=>`<div><dt>${k}</dt><dd>${v??'Unknown'}</dd></div>`).join('');
let detailGraph,disposeSurface=()=>{};
const initialReference='Myrvold, Wendy, and Jennifer Woodcock. A large set of torus obstructions and how they were discovered. The Electronic Journal of Combinatorics 25(1), P1.16 (2018). https://doi.org/10.37236/3797';
function detailHTML(){disposeSurface();const g=detailGraph,id=graphID(g.id),sources=sourceList(g);
 const origin=g.attribution?`${g.attribution.credit}\n${g.attribution.source}`:initialReference;
 const citation=`${origin}\n\n${id}. Toroidal obstructions, release ${release}. https://austinulrigg.com/toroidal.html?v=${release}&graph=${id}`+(g.sources.length?`\nSource records: ${g.sources.map(s=>`${manifest.sourceFiles[s[0]].file.replace(/\.gz$/,'')}, line ${s[1]}`).join('; ')}.`:'');
 const sourceHTML=g.attribution?`<p><strong>Discovery credit</strong> ${esc(g.attribution.credit)}</p><p>${esc(g.attribution.source)}</p>${g.attribution.contributedBy?`<p>Contributed by ${esc(g.attribution.contributedBy)}.</p>`:''}`:`<p>Wendy Myrvold’s collection, described with Jennifer Woodcock in <a href="https://doi.org/10.37236/3797">A large set of torus obstructions and how they were discovered</a> (2018).</p><ul>${sources}</ul>`;
 const evidenceHTML=g.attribution?`<p>Non-toroidality was checked by a completed PAGE computation. Every edge deletion has a genus-at-most-one rotation checked independently from the solver.</p><p>${g.attribution.minorObstruction===true?'The same embedding checks were completed for every edge contraction.':g.attribution.minorObstruction===false?'This graph is not minimal in the minor order.':'Minor minimality has not been established.'}</p><p><a href="${esc(new URL(g.attribution.evidence,base).href)}">Computation and embedding records</a></p>`:`<p>Reported by the original source. Non-toroidality and minimality have not been independently reverified for this release.</p><p>${g.minor?'This graph is included in the source’s minor-order obstruction file.':'No minor-order claim has been recorded for this graph.'}</p>`;
 $('#td-detail').innerHTML=`<a class="td-back" href="${esc(toURL(state,release))}" data-action="back">← Back to results</a><div class="td-detail-heading"><h1 tabindex="-1">${id}</h1><div class="td-graph-download"><select id="td-graph-format" aria-label="Graph download format">${option(Object.keys(exportFormats),dataFormat,exportFormats)}</select><button class="td-control" data-action="download-graph">Download</button></div></div><div class="td-detail-tabs" role="tablist" aria-label="Graph information">${['overview','evidence','data'].map(t=>`<button role="tab" id="td-tab-${t}" data-detail-tab="${t}" aria-controls="td-panel-${t}" aria-selected="${tab===t}" tabindex="${tab===t?0:-1}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>
 <div role="tabpanel" id="td-panel-overview" aria-labelledby="td-tab-overview"${tab!=='overview'?' hidden':''}><div class="td-overview"><div class="td-drawing"><figure id="td-flat">${svg(g)}</figure><div id="td-surface" hidden></div><div id="td-flat-controls" class="td-draw-controls"><label>Layout <select id="td-layout" aria-label="Graph drawing layout">${option(['spring','circle'],drawing,{spring:'Spring',circle:'Circular'})}</select></label><label><input id="td-labels" type="checkbox"${labels?' checked':''}>Vertex labels</label><button id="td-show-surface" class="td-control">Show surface</button></div></div><div><h2>Parameters</h2><dl class="td-props">${propRows(g)}</dl></div></div><section class="td-detail-section"><h2>Source and attribution</h2>${sourceHTML}</section></div>
 <div role="tabpanel" id="td-panel-evidence" aria-labelledby="td-tab-evidence"${tab!=='evidence'?' hidden':''}><section class="td-detail-section"><h2>Obstruction evidence</h2>${evidenceHTML}<h2>Parameters</h2><p>Computed from the graph data with igraph 1.0.0. Isomorphism matching uses Bliss canonical labeling. Drawings show the abstract graph and do not certify an embedding.</p><ul>${sources}</ul></section></div>
 <div role="tabpanel" id="td-panel-data" aria-labelledby="td-tab-data"${tab!=='data'?' hidden':''}>
 <div class="td-data-block"><div class="td-data-title"><select id="td-data-format" aria-label="Graph data format">${option(Object.keys(exportFormats),dataFormat,exportFormats)}</select><button data-copy="td-encoding">Copy</button></div><textarea id="td-encoding" readonly rows="${['adjlist','matrix'].includes(dataFormat)?Math.min(g.n,16):3}" aria-label="Graph encoding">${esc(encoding(g,dataFormat))}</textarea></div>
 <div class="td-data-block"><h2>Degree sequence</h2><p>${g.degrees.join(', ')}</p></div>
 <div class="td-data-block"><div class="td-data-title"><h2>Citation</h2><button data-copy="td-citation">Copy</button></div><textarea id="td-citation" rows="7" readonly aria-label="Graph citation">${esc(citation)}</textarea></div></div>`;
 document.title=`${id} · Toroidal obstructions | Austin Ulrigg`;
 if(tab==='overview')disposeSurface=mountSurface({host:$('#td-surface'),flat:$('#td-flat'),flatControls:$('#td-flat-controls'),button:$('#td-show-surface'),graph:g});
}
async function detail(id,push=true){disposeSurface();selected=id;tab='overview';persist(push);$('#td-catalogue').hidden=true;$('#td-detail').hidden=false;$('#td-detail').innerHTML='<p class="td-notice">Loading graph…</p>';try{const row=currentRows.find(r=>r.id===id)||(await request('search',{state:{...defaults(),query:graphID(id)}})).rows[0];if(!row)throw Error('Graph ID not found.');detailGraph=await graph(id,row);if(selected!==id)return;detailHTML();$('#td-detail h1').focus();}catch(e){$('#td-detail').innerHTML=`<a class="td-back" href="toroidal.html" data-action="back">← Back to results</a><p role="alert">${esc(e.message)}</p>`;}}
async function back(push=true){disposeSurface();selected=null;persist(push);$('#td-catalogue').hidden=false;$('#td-detail').hidden=true;document.title='Toroidal obstructions | Austin Ulrigg';await results();$('#td-search').focus();}
async function copy(text,textarea){try{await navigator.clipboard.writeText(text);status('Copied.');}catch{if(textarea){textarea.focus();textarea.select();status('Text selected. Use your copy shortcut.');}else{const t=document.createElement('textarea');t.value=text;t.setAttribute('aria-label','Link to copy');$('#td-message').replaceChildren(t);t.select();}}}
function save(content,name,mime){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function exportData(format){
 const errors=issues(state);if(errors.length){status(errors.join(' '));return;}
 const query=structuredClone(state);downloadController?.abort();const controller=new AbortController();downloadController=controller;$('#td-cancel-download').hidden=false;
 const tell=s=>$('#td-download-status').textContent=s;
 try{tell('Preparing download…');
  if(format==='query'){const payload={release,url:new URL(toURL(query,release),location.href).href,query,citation:`Toroidal obstructions, release ${release}. Cite each graph’s original sources and discovery credit.`,manifest:new URL('manifest.json',base).href};save(JSON.stringify(payload,null,2)+'\n',`toroidal-${release}-query.json`,'application/json');}
  else if(format==='csv'){const r=await request('csv',{state:query});if(r.errors.length)throw Error(r.errors.join(' '));if(controller.signal.aborted)throw Error('Download cancelled.');save(r.text,`toroidal-${release}.csv`,'text/csv');}
  else{
   const r=await request('ids',{state:query});if(r.errors.length)throw Error(r.errors.join(' '));
   const chunks=new Map(),numbers=[...new Set(Array.from(r.ids,id=>Math.floor((id-1)/manifest.chunkSize)))];let done=0;
   async function load(){while(numbers.length){if(controller.signal.aborted)throw Error('Download cancelled.');const num=numbers.shift(),response=await fetch(new URL(`graphs-${String(num).padStart(3,'0')}.json`,base),{signal:controller.signal});if(!response.ok)throw Error('A graph file could not be loaded. Retry the download.');chunks.set(num,await response.json());tell(`Preparing ${r.ids.length.toLocaleString()} graphs · ${++done} files loaded`);}}
   await Promise.all(Array.from({length:Math.min(4,numbers.length)},load));if(controller.signal.aborted)throw Error('Download cancelled.');
   const parts=[],separator=['adjlist','matrix'].includes(format)?'\n\n':'\n';
   for(let start=0;start<r.ids.length;start+=1000){if(controller.signal.aborted)throw Error('Download cancelled.');const lines=Array.from(r.ids.slice(start,start+1000),id=>exportGraph(decodeGraph6(chunks.get(Math.floor((id-1)/manifest.chunkSize))[(id-1)%manifest.chunkSize][0]),format,graphID(id)));parts.push(new Blob([lines.join(separator)+(start+1000<r.ids.length?separator:'\n')]));tell(`Formatting ${Math.min(start+1000,r.ids.length).toLocaleString()} of ${r.ids.length.toLocaleString()} graphs…`);await new Promise(resolve=>setTimeout(resolve,0));}
   if(controller.signal.aborted)throw Error('Download cancelled.');save(new Blob(parts),`toroidal-${release}-${format}.${format==='g6'?'g6':'txt'}`,'text/plain');
  }
  tell('Download ready.');
 }catch(e){controller.abort();tell(e.name==='AbortError'?'Download cancelled.':e.message);}finally{if(downloadController===controller){downloadController=null;$('#td-cancel-download').hidden=true;}}
}
root.addEventListener('click',async e=>{const b=e.target.closest('button,a');if(!b)return;
 if(b.dataset.graph){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();detail(+b.dataset.graph);return;}
 if(b.dataset.copy){const t=$('#'+b.dataset.copy);copy(t.value,t);return;}
 if(b.dataset.detailTab){tab=b.dataset.detailTab;detailHTML();$(`#td-tab-${tab}`).focus();return;}
 if(b.dataset.sortColumn){const f=b.dataset.sortColumn,old=state.sorts.find(r=>r.field===f);state.sorts=[{field:f,direction:old?.direction==='asc'?'desc':'asc'},...state.sorts.filter(r=>r.field!==f)];update();return;}
 const a=b.dataset.action,i=+b.dataset.index;if(!a)return;
 if(a==='back'){e.preventDefault();back();return;}
 if(a==='retry'){location.reload();return;}
 if(a==='share'){persist();copy(location.href);return;}
 if(a==='toggle-filters'){filterOpen=!filterOpen;if(filterOpen){sortOpen=false;$('#td-export-panel').hidden=true;$('#td-export-button').setAttribute('aria-expanded','false');}renderFilters();renderSorts();return;}
 if(a==='toggle-sorts'){sortOpen=!sortOpen;if(sortOpen){filterOpen=false;$('#td-export-panel').hidden=true;$('#td-export-button').setAttribute('aria-expanded','false');}renderSorts();renderFilters();return;}
 if(a==='export'){const open=$('#td-export-panel').hidden;$('#td-export-panel').hidden=!open;$('#td-export-button').setAttribute('aria-expanded',String(open));if(open){filterOpen=false;sortOpen=false;renderFilters();renderSorts();}return;}
 if(a.startsWith('download-')){if(a==='download-graph'){const format=$('#td-graph-format').value;save(exportGraph(detailGraph,format,graphID(selected))+'\n',graphID(selected)+'-'+format+(format==='g6'?'.g6':'.txt'),'text/plain');}else if(a==='download-results')exportData($('#td-export-format').value);else exportData(a.slice(9));return;}
 if(a==='cancel-download'){downloadController?.abort();return;}
 if(a==='prev'||a==='next'){state.page+=a==='next'?1:-1;results();return;}
 if(a==='add-filter'&&state.filters.length<12){state.filters.push(state.filters.length?{field:'kappa',op:'ge',value:'3',upper:'6'}:{field:'n',op:'lt',value:'15',upper:'20'});filterOpen=true;}
 if(a==='remove-filter')state.filters.splice(i,1);
 if(a==='clear-filters')state.filters=[];
 if(a==='clear-query'){state.filters=[];state.query='';$('#td-search').value='';}
 if(a==='add-sort'){const f=numericKeys.find(k=>!state.sorts.some(r=>r.field===k));if(f)state.sorts.push({field:f,direction:'asc'});}
 if(a==='remove-sort')state.sorts.splice(i,1);
 if(a==='raise-sort'&&i>0)[state.sorts[i-1],state.sorts[i]]=[state.sorts[i],state.sorts[i-1]];
 if(a==='reset-sorts')state.sorts=defaults().sorts;
 update();
});
root.addEventListener('input',e=>{const el=e.target;if(el.id==='td-search'){state.query=el.value.trim();update(false);}if(el.tagName==='INPUT'&&el.dataset.filter!==undefined){state.filters[+el.dataset.filter][el.dataset.part]=el.value;update(false);}});
root.addEventListener('change',e=>{const el=e.target;if(el.id==='td-data-format'){dataFormat=el.value;detailHTML();$('#td-data-format').focus();return;}if(el.id==='td-graph-format'){dataFormat=el.value;return;}if(el.dataset.filter!==undefined&&el.tagName==='SELECT'){const r=state.filters[+el.dataset.filter];r[el.dataset.part]=el.value;if(el.dataset.part==='field'){if(['bipartite','regular'].includes(r.field)){r.op='eq';r.value='true';}else if(['true','false'].includes(r.value)){r.op='ge';r.value='3';}}update();}
 if(el.dataset.sort!==undefined){const i=+el.dataset.sort;state.sorts[i][el.dataset.part]=el.value;if(el.dataset.part==='field')state.sorts=state.sorts.filter((r,j)=>j===i||r.field!==el.value);update();}
 if(el.id==='td-filter-mode'){state.mode=el.value;update();}
 if(el.id==='td-layout'){drawing=el.value;detailHTML();$('#td-layout').focus();}
 if(el.id==='td-labels'){labels=el.checked;detailHTML();$('#td-labels').focus();}
});
root.addEventListener('keydown',e=>{if(e.target.getAttribute('role')!=='tab')return;const tabs=['overview','evidence','data'];let i=tabs.indexOf(tab);if(e.key==='ArrowRight')i=(i+1)%3;else if(e.key==='ArrowLeft')i=(i+2)%3;else if(e.key==='Home')i=0;else if(e.key==='End')i=2;else return;e.preventDefault();tab=tabs[i];detailHTML();$(`#td-tab-${tab}`).focus();});
window.addEventListener('popstate',()=>{const url=new URL(location.href);if((url.searchParams.get('v')||catalogueRelease)!==release){location.reload();return;}state=fromURL(location.href);$('#td-search').value=state.query;renderFilters();renderSorts();const id=/^TO-(\d{6})$/.exec(url.searchParams.get('graph')||'');if(id)detail(+id[1],false);else back(false);});
async function init(){try{worker=new Worker(new URL(`./search-worker.mjs?v=${catalogueRelease}`,import.meta.url),{type:'module'});worker.onmessage=({data})=>{const p=pending.get(data.request);if(!p)return;pending.delete(data.request);data.error?p.reject(Error(data.error)):p.resolve(data);};worker.onerror=()=>{for(const p of pending.values())p.reject(Error('The search could not start. Reload this page.'));pending.clear();fail(Error('The search could not start. Reload this page.'));};manifest=(await request('init',{release})).manifest;
 $('#td-search').value=state.query;renderFilters();renderSorts();const target=/^TO-(\d{6})$/.exec(new URL(location.href).searchParams.get('graph')||'');await results();if(target)await detail(+target[1],false);
 }catch(e){fail(e);}}
init();
