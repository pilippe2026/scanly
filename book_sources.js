/* SCANLY V2.16: cached bibliographic requests and conservative BnF supplement. */
(function(){
'use strict';
const KEY='scanly_biblio_cache_v1',TTL=30*86400000,NEG=86400000,MAX=150;
let cache={};try{cache=JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){}
const pending=new Map(),failures=new Map();let olQueue=Promise.resolve(),lastOL=0;
function store(k,value){cache[k]={at:Date.now(),value};const entries=Object.entries(cache).sort((a,b)=>b[1].at-a[1].at).slice(0,MAX);cache=Object.fromEntries(entries);try{localStorage.setItem(KEY,JSON.stringify(cache));}catch(e){cache=Object.fromEntries(entries.slice(0,30));try{localStorage.setItem(KEY,JSON.stringify(cache));}catch(e){}}}
async function request(url,kind='json',options={}){
 const key=kind+':'+url,old=cache[key];if(!options.force&&old&&Date.now()-old.at<((old.value==null||old.value?.totalItems===0||Array.isArray(old.value?.docs)&&!old.value.docs.length||typeof old.value==='object'&&!Object.keys(old.value||{}).length)?NEG:TTL))return old.value;
 if(!options.force&&failures.has(key)&&Date.now()-failures.get(key)<300000)throw new Error('Service temporairement inaccessible ; réessayer dans quelques minutes');
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{const run=async()=>{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);try{const r=await fetch(url,{signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);const value=kind==='json'?await r.json():await r.text();store(key,value);return value;}finally{clearTimeout(timer);}};
 if(url.startsWith('https://openlibrary.org/')){const q=olQueue.then(async()=>{const wait=Math.max(0,1100-(Date.now()-lastOL));if(wait)await new Promise(r=>setTimeout(r,wait));lastOL=Date.now();return run();});olQueue=q.catch(()=>{});return q;}return run();})();
 pending.set(key,task);try{return await task;}catch(e){failures.set(key,Date.now());throw e;}finally{pending.delete(key);}
}
const clean=s=>String(s||'').replace(/[^0-9X]/gi,'').toUpperCase();
function validISBN(s){s=clean(s);if(s.length===13){let n=0;for(let i=0;i<13;i++)n+=Number(s[i])*(i%2?3:1);return /^\d{13}$/.test(s)&&n%10===0;}if(s.length===10){let n=0;for(let i=0;i<10;i++)n+=(s[i]==='X'?10:Number(s[i]))*(10-i);return /^\d{9}[\dX]$/.test(s)&&n%11===0;}return false;}
function isbn13(s){s=clean(s);if(s.length===10&&validISBN(s)){const a='978'+s.slice(0,9);let n=0;for(let i=0;i<12;i++)n+=Number(a[i])*(i%2?3:1);return a+((10-n%10)%10);}return s;}
const children=(el,name)=>Array.from(el.getElementsByTagNameNS('*',name));
function parseXML(text){const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.getElementsByTagName('parsererror').length)throw new Error('Réponse XML BnF invalide');if(children(xml,'diagnostic').length)throw new Error('Requête BnF refusée');
 const records=children(xml,'record').filter(r=>r.hasAttribute('format')||children(r,'datafield').length>0&&!children(r,'recordData').length);
 return records.map(r=>{const fields=children(r,'datafield'),get=(tag,code)=>fields.filter(f=>f.getAttribute('tag')===tag).flatMap(f=>children(f,'subfield').filter(s=>s.getAttribute('code')===code).map(s=>s.textContent.trim()));
 const title=[...get('200','a'),...get('200','h'),...get('200','i')].join(' ').trim(),subtitle=get('200','e').join(' ');
 const names=['700','701'].flatMap(t=>fields.filter(f=>f.getAttribute('tag')===t).map(f=>{const g=c=>children(f,'subfield').filter(s=>s.getAttribute('code')===c).map(s=>s.textContent.trim()).join(' ');return [g('b'),g('a')].filter(Boolean).join(' ');}));
 const ids=get('010','a').map(clean).filter(validISBN),dates=get('210','d').concat(get('214','d')),year=dates.join(' ').match(/\b(1[5-9]\d{2}|20\d{2})\b/),pages=get('215','a').join(' ').match(/(\d+)\s*p\b/i);
 const identifier=r.getAttribute('id')||children(r,'controlfield').filter(f=>f.getAttribute('tag')==='003').map(f=>f.textContent).join('');let url='';const m=identifier.match(/ark:\/12148\/cb[\w]+/);if(m)url='https://catalogue.bnf.fr/'+m[0];
 return {title,subtitle,author:names.join(', '),publisher:get('210','c').concat(get('214','c'))[0]||'',year:year?+year[0]:null,pages:pages?+pages[1]:null,isbn:ids.find(s=>s.length===13)||ids[0]||'',isbns:ids,url,source:'BnF'};}).filter(r=>r.title);
}
function queryURL(b){const q=s=>String(s||'').replace(/["\\]/g,' ').replace(/\s+/g,' ').trim().slice(0,180);const isbn=clean(b.isbn);let query;if(validISBN(isbn))query='bib.isbn all "'+isbn+'"';else{query='bib.title all "'+q(b.title)+'"';if(b.author)query+=' and bib.author all "'+q(b.author.split(',')[0])+'"';}return 'https://catalogue.bnf.fr/api/SRU?'+new URLSearchParams({version:'1.2',operation:'searchRetrieve',query,recordSchema:'unimarcXchange',maximumRecords:'5'});}
async function lookup(b,options={}){if(!validISBN(b.isbn)&&!String(b.title||'').trim())return [];return parseXML(await request(queryURL(b),'text',options));}
function exact(b,r){return validISBN(b.isbn)&&r.isbns.some(i=>isbn13(i)===isbn13(b.isbn));}
function fill(b,r){const changed=[];for(const k of ['title','author','publisher','year','pages','isbn'])if((b[k]==null||b[k]==='')&&r[k]){b[k]=r[k];changed.push(k);}if(changed.length){b.bnfRef={url:r.url,checkedAt:new Date().toISOString(),isbn:r.isbn,fields:changed};if(b.title)b.unknown=false;}return changed;}
async function supplement(b){if(localStorage.getItem('scanly_bnf_auto')==='0'||!validISBN(b.isbn)||b.author&&b.publisher&&b.year&&b.pages)return [];
 try{const rows=await lookup(b),r=rows.find(r=>exact(b,r));return r?fill(b,r):[];}catch(e){console.warn('SCANLY BnF:',e.message);return [];}}
window.SCANLY_SOURCES={request,lookup,exact,fill,supplement,parseXML,queryURL,validISBN,isbn13,clear:()=>{cache={};failures.clear();localStorage.removeItem(KEY);}};
})();
