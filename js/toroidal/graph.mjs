export function decodeGraph6(value,maxOrder=128) {
  const text=value.trim().replace(/^>>graph6<</,'');
  const codes=Array.from(text,c=>c.charCodeAt(0)-63);
  if(!codes.length||codes.some(c=>c<0||c>63))throw Error('Invalid graph6 characters.');
  let n=codes[0],start=1;
  if(n===63){if(codes.length<4||codes[1]===63)throw Error('Unsupported graph6 order.');n=(codes[1]<<12)|(codes[2]<<6)|codes[3];start=4;if(n<63)throw Error('Nonstandard graph6 header.');}
  if(n<1||n>maxOrder)throw Error(`Use graphs with 1 to ${maxOrder} vertices.`);
  const bitLength=n*(n-1)/2;
  if(codes.length!==start+Math.ceil(bitLength/6))throw Error('The graph6 length does not match its vertex count.');
  if(bitLength%6 && (codes.at(-1)&((1<<(6-bitLength%6))-1)))throw Error('Invalid graph6 padding.');
  const edges=[],adj=Array.from({length:n},()=>[]);let k=0;
  for(let v=1;v<n;v++)for(let u=0;u<v;u++,k++)if((codes[start+Math.floor(k/6)]>>(5-k%6))&1){edges.push([u,v]);adj[u].push(v);adj[v].push(u);}
  return {g6:text,n,m:edges.length,edges,adj,degrees:adj.map(a=>a.length).sort((a,b)=>a-b)};
}
export function encodeGraph6(n,edges) {
  const set=new Set(edges.map(([u,v])=>`${Math.min(u,v)},${Math.max(u,v)}`)),codes=n<63?[n]:[63,(n>>12)&63,(n>>6)&63,n&63];let acc=0,k=0;
  for(let v=1;v<n;v++)for(let u=0;u<v;u++){acc=(acc<<1)|Number(set.has(`${u},${v}`));if(++k===6){codes.push(acc);acc=0;k=0;}}
  if(k)codes.push(acc<<(6-k));return codes.map(c=>String.fromCharCode(c+63)).join('');
}
export function decodeUpper(value,maxOrder=128) {
  const match=/^\s*(\d+)\s+([01\s]*)$/.exec(value);if(!match)throw Error('Use a vertex count, a space, then the upper-triangular 0/1 entries.');
  const n=+match[1],bits=match[2].replace(/\s/g,'');
  if(n<1||n>maxOrder||bits.length!==n*(n-1)/2)throw Error('The adjacency length does not match its vertex count.');
  const edges=[];let k=0;for(let u=0;u<n;u++)for(let v=u+1;v<n;v++,k++)if(bits[k]==='1')edges.push([u,v]);
  return decodeGraph6(encodeGraph6(n,edges),maxOrder);
}
export function upper(g) {return `${g.n} `+g.adj.map((row,u)=>Array.from({length:g.n-u-1},(_,j)=>Number(row.includes(u+j+1))).join('')).join('');}
export function layout(g,circular=false) {
  const p=Array.from({length:g.n},(_,i)=>[Math.cos(i*2*Math.PI/g.n),Math.sin(i*2*Math.PI/g.n)]);
  if(!circular){const ideal=Math.sqrt(4/g.n);for(let step=0;step<160;step++){
    const d=p.map(()=>[0,0]);
    for(let u=0;u<g.n;u++)for(let v=u+1;v<g.n;v++){const dx=p[u][0]-p[v][0],dy=p[u][1]-p[v][1],r=Math.max(.01,Math.hypot(dx,dy)),f=ideal*ideal/r;d[u][0]+=dx/r*f;d[u][1]+=dy/r*f;d[v][0]-=dx/r*f;d[v][1]-=dy/r*f;}
    for(const [u,v] of g.edges){const dx=p[u][0]-p[v][0],dy=p[u][1]-p[v][1],r=Math.max(.01,Math.hypot(dx,dy)),f=r*r/ideal;d[u][0]-=dx/r*f;d[u][1]-=dy/r*f;d[v][0]+=dx/r*f;d[v][1]+=dy/r*f;}
    const temp=.12*(1-step/160);p.forEach((a,i)=>{const mag=Math.max(.001,Math.hypot(...d[i]));a[0]+=d[i][0]/mag*Math.min(temp,mag)-a[0]*.002;a[1]+=d[i][1]/mag*Math.min(temp,mag)-a[1]*.002;});
  }}
  const xs=p.map(a=>a[0]),ys=p.map(a=>a[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,span=Math.max(.01,Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  return p.map(([x,y])=>[+(180+(x-cx)*260/span).toFixed(2),+(155+(y-cy)*260/span).toFixed(2)]);
}
export const exportFormats={g6:'graph6',upper:'Upper triangular form',adjlist:'Adjacency list',matrix:'Adjacency matrix'};
export function encoding(g,format){
 if(format==='g6')return g.g6;
 if(format==='upper')return upper(g);
 if(format==='adjlist')return g.adj.map((row,i)=>`${i}: ${row.join(' ')}`).join('\n');
 if(format==='matrix')return g.adj.map(row=>Array.from({length:g.n},(_,j)=>row.includes(j)?1:0).join(' ')).join('\n');
 throw Error('Unknown graph format.');
}
export function exportGraph(g,format,id){const value=encoding(g,format);return ['adjlist','matrix'].includes(format)?`# ${id}; vertices 0 to ${g.n-1}\n${value}`:value;}
