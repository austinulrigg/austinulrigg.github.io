import {submissionAPI} from './config.mjs';
import {parseGraphs,validateSubmission} from './submission.mjs';
const $=id=>document.getElementById(id),form=$('submission-form'),availability=$('submission-availability'),result=$('submission-result');
let token='',widget,receipt='',sending=false;
function say(text){result.textContent=text;}
function payload(){const f=new FormData(form);return validateSubmission(Object.fromEntries([...f.entries()].filter(([k])=>k!=='consent').concat([['consent',f.get('consent')==='on']])));}
form.addEventListener('input',()=>{if(!sending)receipt='';});
function newReceipt(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');}
async function api(path,body){const response=await fetch(submissionAPI.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error||'The submission could not be saved.');return data;}
function receiptView(id,secret,status){const link=new URL('toroidal-submit.html',location.href);link.hash=`receipt=${id}&key=${secret}`;result.replaceChildren(document.createTextNode(`Submission ${id} · ${status}. Save this private status link: `));const a=document.createElement('a');a.href=link.href;a.textContent='Submission status';result.append(a);}
$('submission-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>200000){say('The file is larger than 200 KB.');e.target.value='';return;}$('submission-graphs').value=await file.text();receipt='';say('File loaded. Check the input before submitting.');});
$('submission-preview').addEventListener('click',()=>{try{const graphs=parseGraphs(form.elements.graphs.value,form.elements.format.value);say(`${graphs.length} ${graphs.length===1?'graph':'graphs'} parsed.\n`+graphs.slice(0,10).map((g,i)=>`${i+1}. ${g.n} vertices, ${g.m} edges`).join('\n')+(graphs.length>10?'\n…':''));}catch(e){say(e.message);}});
form.addEventListener('submit',async e=>{e.preventDefault();if(sending)return;try{if(!form.reportValidity())return;const p=payload();if(!token)throw Error('Complete the submission check and try again.');receipt ||=newReceipt();sending=true;$('submission-send').disabled=true;say('Saving submission…');const data=await api('/submissions',{...p,graphs:p.original,website:form.elements.website.value,receipt,challenge:token});receiptView(data.id,receipt,data.status);form.reset();receipt='';}catch(e){say(e.message);}finally{sending=false;$('submission-send').disabled=false;if(widget!==undefined)window.turnstile.reset(widget);token='';}});
async function init(){
 if(!submissionAPI){availability.textContent='Submissions are not open yet.';return;}
 try{
  const endpoint=new URL(submissionAPI);if(endpoint.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(endpoint.hostname))throw Error('Submission service unavailable.');
  const fragment=new URLSearchParams(location.hash.slice(1));if(fragment.has('receipt')){availability.textContent='Submission status';const id=fragment.get('receipt'),key=fragment.get('key');const data=await api('/status',{id,receipt:key});receiptView(id,key,data.status);return;}
  const response=await fetch(submissionAPI.replace(/\/$/,'')+'/config');if(!response.ok)throw Error('Submission service unavailable.');const settings=await response.json();if(!settings.enabled){availability.textContent='Submissions are not open yet.';return;}
  availability.textContent='Submissions are reviewed before they are added. Your email stays private.';form.hidden=false;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=resolve;s.onerror=reject;document.head.append(s);});
  widget=window.turnstile.render('#submission-challenge',{sitekey:settings.sitekey,action:'submit-graph',callback:t=>{token=t;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';say('The submission check could not load. Please retry.');}});
 }catch(e){availability.textContent=e.message||'The submission check could not load. Please retry later.';}
}
init();
