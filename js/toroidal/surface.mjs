// On-demand display only. An embedding from this service is not an obstruction certificate.
const endpoint='wss://genus.fly.dev/stream_calc_genus';
const models=new Map();
let libraries;
function script(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('The surface viewer could not load. Please retry.'));};document.head.append(s);});}
async function loadLibraries(){if(!libraries)libraries=(async()=>{if(!window.THREE)await script('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');if(!window.THREE.OrbitControls)await script('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');return window.THREE;})().catch(e=>{libraries=null;throw e;});return libraries;}
export function requestModel(adj,signal,onStatus=()=>{},timeout=120000){return new Promise((resolve,reject)=>{
 let socket,done=false;
 function finish(error,model){if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(socket)socket.close();error?reject(error):resolve(model);}
 const abort=()=>finish(new DOMException('Cancelled','AbortError'));
 const timer=setTimeout(()=>finish(Error('The solver is taking longer than expected. It may be waking up. Please retry.')),timeout);
 if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
 try{socket=new WebSocket(endpoint);}catch(e){finish(e);return;}
 socket.onopen=()=>{onStatus('Finding an embedding…');socket.send(JSON.stringify({alg:'page',outputFormat:'3d',adj}));};
 socket.onmessage=({data})=>{if(done||typeof data!=='string')return;const split=data.indexOf(':'),type=data.slice(0,split),body=data.slice(split+1);
  if(type==='MODEL'){try{const model=JSON.parse(body);if(!model.obj||!Number.isInteger(model.genus)||model.genus<0)throw Error('The solver returned an incomplete surface.');finish(null,model);}catch(e){finish(e);}}
  else if(type==='JSON'){try{const result=JSON.parse(body);if(result.error)finish(Error('The solver could not draw this graph. Please retry or try another graph.'));}catch{finish(Error('The solver returned an unreadable response.'));}}
 };
 socket.onerror=()=>finish(Error('The solver could not be reached. Please retry.'));
 socket.onclose=()=>finish(Error('The connection ended before a surface arrived. Please retry.'));
});}
export function parseModel(obj,graph){
 if(typeof obj!=='string'||obj.length>30000000)throw Error('The surface is too large to display.');
 const points=[null],faces=[],lines=[],vertices=[],labelMap=new Map();let edge=null;
 const index=t=>{const i=Number(t.split('/')[0]);if(!Number.isSafeInteger(i)||i<1||i>=points.length)throw Error('Invalid surface geometry.');return i;};
 for(const raw of obj.split(/\r?\n/)){
  const parts=raw.trim().split(/\s+/),tag=parts[0];
  if(tag==='v'){const p=parts.slice(1,4).map(Number);if(p.length!==3||!p.every(Number.isFinite))throw Error('Invalid surface coordinates.');points.push(p);}
  else if(tag==='f'){const p=parts.slice(1).map(index);for(let i=1;i<p.length-1;i++)faces.push(p[0],p[i],p[i+1]);}
  else if(tag==='l'){const p=parts.slice(1).map(index);if(p.length<2||!edge)throw Error('Missing graph edge data.');lines.push({edge,points:p});edge=null;}
  else if(tag==='p'){for(const t of parts.slice(1)){const i=index(t);if(labelMap.has(i))vertices.push({index:i,label:labelMap.get(i)});}}
  else if(tag==='#'&&parts[1]==='graph_edge')edge=[Number(parts[2])-1,Number(parts[3])-1];
  else if(tag==='#'&&parts[1]==='graph_vertex_label')labelMap.set(Number(parts[2]),Number(parts[3])-1);
 }
 const key=([a,b])=>[a,b].sort((a,b)=>a-b).join(','),expected=new Set(graph.edges.map(key)),actual=new Set(lines.map(l=>key(l.edge)));
 if(!faces.length||expected.size!==actual.size||[...expected].some(k=>!actual.has(k))||new Set(vertices.map(v=>v.label)).size!==graph.n||vertices.some(v=>!Number.isInteger(v.label)||v.label<0||v.label>=graph.n))throw Error('The surface does not contain the complete graph.');
 return {points,faces,lines,vertices};
}
function viewer(THREE,container,model,graph){
 const parsed=parseModel(model.obj,graph),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,100);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputEncoding=THREE.sRGBEncoding;
 const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Genus ${model.genus} surface with ${graph.n} vertices and ${graph.m} edges. Drag to rotate; scroll to zoom.`);canvas.tabIndex=0;container.replaceChildren(canvas);
 const controls=new THREE.OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=2.2;controls.maxDistance=15;
 camera.up.set(0,0,1);camera.position.set(0,-5.7,3.4);controls.update();
 scene.add(new THREE.HemisphereLight(0xffffff,0x5d6472,1.25));const light=new THREE.DirectionalLight(0xffffff,.75);light.position.set(-3,-4,7);scene.add(light);
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(parsed.points.slice(1).flat(),3));geom.setIndex(parsed.faces.map(i=>i-1));geom.computeBoundingBox();const center=new THREE.Vector3();geom.boundingBox.getCenter(center);geom.translate(-center.x,-center.y,-center.z);geom.computeBoundingSphere();const scale=1.8/Math.max(geom.boundingSphere.radius,.001);geom.scale(scale,scale,scale);geom.computeVertexNormals();
 scene.add(new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0xb3b0bc,roughness:.9,side:THREE.DoubleSide})));
 const point=i=>new THREE.Vector3(...parsed.points[i]).sub(center).multiplyScalar(scale);
 const edgeMat=new THREE.MeshBasicMaterial({color:0x5802a8}),nodeMat=new THREE.MeshBasicMaterial({color:0x301044}),nodeGeo=new THREE.SphereGeometry(.029,12,8);
 for(const line of parsed.lines){const pts=line.points.map(point),curve=new THREE.Curve();curve.getPoint=(t,target=new THREE.Vector3())=>{const k=Math.min(pts.length-2,Math.floor(t*(pts.length-1))),a=t*(pts.length-1)-k;return target.copy(pts[k]).lerp(pts[k+1],a);};scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve,pts.length-1,.012,6,false),edgeMat));}
 for(const v of parsed.vertices){const dot=new THREE.Mesh(nodeGeo,nodeMat);dot.position.copy(point(v.index));scene.add(dot);}
 const render=()=>renderer.render(scene,camera),resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
 controls.addEventListener('change',render);const observer=new ResizeObserver(resize);observer.observe(container);resize();
 const keydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;if(e.key==='ArrowUp')s.phi-=.12;if(e.key==='ArrowDown')s.phi+=.12;if(e.key==='+')s.radius*=.9;if(e.key==='-')s.radius*=1.1;s.makeSafe();camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();render();};canvas.addEventListener('keydown',keydown);
 return ()=>{observer.disconnect();controls.dispose();canvas.removeEventListener('keydown',keydown);const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();};
}
export function mountSurface({host,flat,flatControls,button,graph}){
 let dispose=()=>{},controller,closed=false;
 const reset=()=>{controller?.abort();dispose();dispose=()=>{};host.hidden=true;host.replaceChildren();flat.hidden=false;flatControls.hidden=false;};
 const show=async()=>{
  controller?.abort();controller=new AbortController();const signal=controller.signal;flat.hidden=true;flatControls.hidden=true;host.hidden=false;
  host.innerHTML='<div class="td-surface-view"><div class="td-surface-status" role="status"><p>Connecting to the solver…</p><button class="td-control">Cancel</button></div></div>';
  host.querySelector('button').onclick=reset;const tell=text=>{const p=host.querySelector('[role="status"] p');if(p)p.textContent=text;};
  try{const THREE=await loadLibraries();if(signal.aborted||closed)return;let model=models.get(graph.g6);if(!model){model=await requestModel(graph.adj,signal,tell);parseModel(model.obj,graph);models.set(graph.g6,model);if(models.size>3)models.delete(models.keys().next().value);}if(signal.aborted||closed)return;
   dispose=viewer(THREE,host.querySelector('.td-surface-view'),model,graph);
   const footer=document.createElement('div');footer.className='td-surface-footer';footer.innerHTML=`<div class="td-surface-caption"><strong>Genus ${model.genus}</strong><a href="https://github.com/SanderGi/Genus">Alexander Metzger’s solver</a></div><button class="td-control">2D graph</button>`;footer.querySelector('button').onclick=reset;host.append(footer);
  }catch(e){if(signal.aborted||closed)return;dispose();host.innerHTML='<div class="td-surface-view"><div class="td-surface-status" role="status"><p></p><div><button class="td-control" data-retry>Retry</button> <button class="td-control" data-back>2D graph</button></div></div></div>';host.querySelector('p').textContent=e.message;host.querySelector('[data-retry]').onclick=show;host.querySelector('[data-back]').onclick=reset;}
 };
 button.addEventListener('click',show);
 return ()=>{closed=true;controller?.abort();dispose();button.removeEventListener('click',show);};
}
