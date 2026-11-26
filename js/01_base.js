/* SCANLY – 01_base.js : Configuration, utilitaires, stockage IndexedDB, IA Gemini, images, reconnaissance, enrichissement.
   Les fichiers js/ sont chargés dans l'ordre par index.html et partagent les mêmes variables globales. */
'use strict';
/* =====================================================================
   SCANLY – Bibliothèque virtuelle 3D (PC, Mac, iPhone, iPad) – version : voir VERSION ci-dessous
   Stockage local IndexedDB • IA Google Gemini (clé perso)
   Métadonnées Google Books + Open Library
   ===================================================================== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const VERSION = '2.32';
const TYPES = ['Roman','BD','Manga','Comics','Essai','Jeunesse','Beau livre','Pratique','Revue','Autre'];
function loadTypes20() { try { const saved = JSON.parse(localStorage.getItem('scanly_types') || 'null'); if (Array.isArray(saved) && saved.length) TYPES.splice(0, TYPES.length, ...[...new Set(saved.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()))]); } catch (e) {} if (!TYPES.includes('Autre')) TYPES.push('Autre'); }
loadTypes20(); // V2.20 : types renommés / ajoutés par l'utilisateur
const STATUS = ['À lire','En cours','Lu','Prêté'];
const NONE = '__none__', ALL = '__all__';
/* V2.28: translate a label at render time where the page translator cannot reach (3D spines). */
const T28 = s => (window.SCANLY_I18N ? SCANLY_I18N.t(s) : s);
const MODELS = ['gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-2.5-flash','gemini-2.5-flash-lite'];

/* ---------- Icônes au trait (charte : bleu nuit / or / crème) ---------- */
const PATHS = {
  salon: '<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M6 17v2M18 17v2"/>',
  futur: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="12" r="3"/>',
  magie: '<path d="M6 21V10a6 6 0 0 1 12 0v11z"/><path d="M12 4.2V21M6 13h12"/>',
  bnf: '<path d="M3 3h6v2H5v4H3zM15 3h6v6h-2V5h-4zM3 15h2v4h4v2H3zM19 15h2v6h-6v-2h4z"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>',
  pin: '<path d="M9 4h6l-1 5 3 3H7l3-3z"/><path d="M12 12v8"/>',
  cam: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="m21 15-5-5L5 21"/>',
  plus: '<rect x="4" y="3" width="13" height="18" rx="2"/><path d="M8 7h5M8 11h5M19 14v6M16 17h6"/>',
  isbn: '<path d="M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 9v6M11 9v6M14 9v6M17 9v6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  shelfI: '<path d="M3 4h18M3 12h18M3 20h18"/><path d="M5 4v16M19 4v16"/><path d="M8 7v5M11 6v6M14 8v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.3 4.4 4.4 0 0 0 7 18z"/><path d="M9.5 13.5l2 2 3.5-4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'
};
const I = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[n] || ''}</svg>`;
$$('[data-i]').forEach(e => e.innerHTML = I(e.dataset.i));
const THEMES = {
  salon: {name: 'Salon contemporain', short: 'Salon', img: 'assets/piece_salon.jpg', unit: {x: 355, y: 70, w: 830, h: 690}},
  futur: {name: 'Nexus futuriste', short: 'Nexus', img: 'assets/piece_futur.jpg', unit: {x: 330, y: 95, w: 880, h: 590}},
  magie: {name: 'Cabinet des Mystères', short: 'Magique', img: 'assets/piece_magie.jpg', unit: {x: 320, y: 70, w: 900, h: 680}},
  bnf: {name: 'Bibliothèque Prestige', short: 'Grande Biblio.', tip: 'Univers inspiré de la Bibliothèque nationale François-Mitterrand', img: 'assets/piece_bnf.jpg', unit: {x: 320, y: 85, w: 905, h: 660}},
 canopee:{name:'Canopée',img:'assets/piece_canopee.jpg',unit:{x:355,y:85,w:830,h:660}},
 loft:{name:'Atelier Loft',short:'Loft',img:'assets/piece_loft.jpg',unit:{x:340,y:90,w:850,h:655}}
};

/* ---------- Utilitaires ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const isHex = c => /^#[0-9a-f]{6}$/i.test(c || '');
const eur = (p, src) => p == null || p === '' || isNaN(p) ? '' : (src === 'Estimation IA' ? '≈ ' : '') + Number(p).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'});
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const fmtD = d => d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR') : '';
const isLoaned = b => !b.wish && (!!b.loanTo || b.status === 'Prêté');
const isLate = b => isLoaned(b) && b.loanDue && b.loanDue < today();
const dispTitle = b => b.title || 'Livre à identifier';
function toast(m, ms = 2800) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms); }
function txtCol(hex) { if (!isHex(hex)) return '#F8F6F0'; const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150 ? '#1a1410' : '#F8F6F0'; }
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => clamp(Math.round(v * f), 0, 255).toString(16).padStart(2, '0')).join(''); }
function fbColor(b) { const p = ['#7d2a33','#1d3a73','#2c5d4a','#8a6a35','#4f3769','#1f5f6b','#9a4e2a','#3b3e46','#a5823f','#5e2430','#2d4f86','#6b7b3a','#c9c2b0','#e8e2d4']; return p[hash((b.title || b.id) + (b.author || '')) % p.length]; }
const colOf = b => isHex(b.color) ? b.color : fbColor(b);
function hueOf(hex) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < .1) return 400 + (1 - mx) * 100; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; }
function sim(a, b) { const A = new Set(norm(a).split(' ').filter(w => w.length > 1)), B = new Set(norm(b).split(' ').filter(w => w.length > 1)); if (!A.size || !B.size) return 0; let i = 0; A.forEach(w => B.has(w) && i++); return i / Math.min(A.size, B.size); }
const keyOf = b => norm(b.title) + '|' + norm((b.author || '').split(/[,&]/)[0]) + '|' + (b.volume || '');
const lastName = b => (b.author || '').split(',')[0].trim().split(' ').pop();
/* image de tranche : data URL -> URL objet (plus léger à afficher) */
const SPURL = new Map();
function spineURL(b) {
  if (!b.spineImg) return '';
  const k = b.id + ':' + b.spineImg.length; if (SPURL.has(k)) return SPURL.get(k);
  try { const [h, d] = b.spineImg.split(','), bin = atob(d), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u], {type: (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg'})); SPURL.set(k, url); return url; } catch (e) { return ''; }
}

/* ---------- IndexedDB ----------
   V2.26 : les images (tranches, couvertures, dos, photos d'origine) ne sont plus rangées DANS les fiches.
   Chaque image est stockée une seule fois dans le magasin « imgs » (en Blob, plus compact que le texte base64),
   repérée par son empreinte SHA-1 ; la fiche enregistrée ne garde qu'une référence « §img:<empreinte> ».
   En mémoire, rien ne change : DB.all() remet les images à leur place, le reste de l'application est inchangé.
   Les anciennes fiches (images incluses) restent lisibles et sont converties une fois au démarrage.
   Les points de restauration partagent les mêmes images au lieu de les recopier. */
const IMG_TAG = '§img:', IMG_STORES = ['books', 'cases', 'imports', 'trash'];
const isDataImg = v => typeof v === 'string' && v.startsWith('data:image') && v.length > 600;
const IMGCACHE = new Map(); // empreinte -> data URL déjà relue
const HASHOF = new Map(); // data URL -> empreinte (évite de recalculer à chaque enregistrement)
async function imgHash(s) { let h = HASHOF.get(s); if (!h) { h = await sha1Hex(s); HASHOF.set(s, h); } return h; }
async function sha1Hex(s) { const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function dataURLToBlob(u) { const i = u.indexOf(','), head = u.slice(0, i); if (!/;base64$/.test(head)) return null;
  const bin = atob(u.slice(i + 1)), a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
  return {head, blob: new Blob([a], {type: (head.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg'})}; }
function blobToDataURL(rec) { if (typeof rec.data === 'string') return Promise.resolve(rec.data);
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const u = r.result; res(rec.head + u.slice(u.indexOf(','))); }; r.onerror = () => rej(r.error); r.readAsDataURL(rec.blob); }); }
/* remplace les images d'un objet par leur référence ; out reçoit {h, rec} à écrire */
async function externImgs(o, out) {
  if (Array.isArray(o)) { const r = []; for (const v of o) r.push(await externImgs(v, out)); return r; }
  if (isDataImg(o)) { const h = await imgHash(o); if (!out.has(h)) { const b = dataURLToBlob(o); out.set(h, b ? {h, head: b.head, blob: b.blob} : {h, data: o}); } IMGCACHE.set(h, o); return IMG_TAG + h; }
  if (o && typeof o === 'object' && !(o instanceof Blob)) { const r = {}; for (const k of Object.keys(o)) r[k] = await externImgs(o[k], out); return r; }
  return o;
}
function collectRefs(o, set) {
  if (typeof o === 'string') { if (o.startsWith(IMG_TAG)) set.add(o.slice(IMG_TAG.length)); }
  else if (Array.isArray(o)) o.forEach(v => collectRefs(v, set));
  else if (o && typeof o === 'object') for (const k in o) collectRefs(o[k], set);
  return set;
}
function internImgs(o, map) {
  if (typeof o === 'string') return o.startsWith(IMG_TAG) ? (map.get(o.slice(IMG_TAG.length)) ?? null) : o;
  if (Array.isArray(o)) return o.map(v => internImgs(v, map));
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = internImgs(o[k], map); return r; }
  return o;
}
const DB = {
  db: null,
  open() { return new Promise((res, rej) => { const r = indexedDB.open('scanly', 4);
    r.onupgradeneeded = () => { const d = r.result; IMG_STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, {keyPath: 'id'}); });
      if (!d.objectStoreNames.contains('imgs')) d.createObjectStore('imgs', {keyPath: 'h'}); };
    r.onsuccess = () => { this.db = r.result; res(); }; r.onerror = () => rej(r.error); }); },
  tx(stores, mode, fn) { return new Promise((res, rej) => { const t = this.db.transaction(stores, mode); let out; try { out = fn(t); } catch (e) { try { t.abort(); } catch (x) {} return rej(e); }
    t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Enregistrement annulé')); }); },
  run(st, mode, fn) { return this.tx(st, mode, t => fn(t.objectStore(st))); },
  /* lit les images manquantes du cache, en une transaction */
  async loadImgs(hs) { const need = [...hs].filter(h => !IMGCACHE.has(h)); if (!need.length) return IMGCACHE;
    const recs = []; await this.tx('imgs', 'readonly', t => { const s = t.objectStore('imgs'); need.forEach(h => { const q = s.get(h); q.onsuccess = () => q.result && recs.push(q.result); }); });
    for (const r of recs) { try { IMGCACHE.set(r.h, await blobToDataURL(r)); } catch (e) { console.warn('SCANLY image illisible', r.h, e); } }
    need.filter(h => !IMGCACHE.has(h)).forEach(h => console.warn('SCANLY : image introuvable', h)); return IMGCACHE; },
  async resolve(list) { const hs = collectRefs(list, new Set()); if (!hs.size) return list; const map = await this.loadImgs(hs); return internImgs(list, map); },
  allRaw(st) { return this.run(st, 'readonly', s => s.getAll()); },
  async all(st) { const L = await this.allRaw(st); return IMG_STORES.includes(st) ? this.resolve(L) : L; },
  /* prépare les fiches (empreintes calculées AVANT d'ouvrir la transaction, sinon IndexedDB la ferme) */
  async prep(st, a) { const imgs = new Map(); if (!IMG_STORES.includes(st)) return {rows: a, imgs}; const rows = []; for (const o of a) rows.push(await externImgs(o, imgs)); return {rows, imgs}; },
  writeImgs(t, imgs) { if (!imgs.size) return; const s = t.objectStore('imgs'); imgs.forEach(r => s.put(r)); },
  async putMany(st, a) { if (!a.length) return; const {rows, imgs} = await this.prep(st, a);
    return this.tx(imgs.size ? [st, 'imgs'] : st, 'readwrite', t => { this.writeImgs(t, imgs); const s = t.objectStore(st); rows.forEach(o => s.put(o)); }); },
  put(st, o) { return this.putMany(st, [o]); },
  del(st, id) { return this.run(st, 'readwrite', s => s.delete(id)); },
  delMany(st, ids) { return this.run(st, 'readwrite', s => { ids.forEach(id => s.delete(id)); }); },
  clear(st) { return this.run(st, 'readwrite', s => s.clear()); },
  /* remplace TOUTE la bibliothèque en une seule transaction : en cas de coupure, rien n'est à moitié écrit */
  async replaceAll(data) { const prepared = {}, imgs = new Map();
    for (const st of IMG_STORES) { const p = await this.prep(st, data[st] || []); prepared[st] = p.rows; p.imgs.forEach((v, k) => imgs.set(k, v)); }
    return this.tx([...IMG_STORES, 'imgs'], 'readwrite', t => { this.writeImgs(t, imgs); for (const st of IMG_STORES) { const s = t.objectStore(st); s.clear(); prepared[st].forEach(o => s.put(o)); } }); },
  /* conversion unique des fiches enregistrées avant la V2.26 (images incluses dans la fiche) */
  async migrateImgs() { let n = 0;
    for (const st of IMG_STORES) { const raw = await this.allRaw(st), old = raw.filter(o => JSON.stringify(o).includes('"data:image'));
      for (let i = 0; i < old.length; i += 40) { const part = old.slice(i, i + 40), {rows, imgs} = await this.prep(st, part);
        await this.tx([st, 'imgs'], 'readwrite', t => { this.writeImgs(t, imgs); const s = t.objectStore(st); rows.forEach(o => s.put(o)); }); n += part.length; } }
    return n; },
  /* efface les images que plus aucune fiche, ni aucun point de restauration, n'utilise */
  async gcImgs(extraRefs) { // une seule transaction : aucune écriture ne peut se glisser entre la lecture et l'effacement
    let dead = []; await this.tx([...IMG_STORES, 'imgs'], 'readwrite', t => { const used = new Set(extraRefs || []); let left = IMG_STORES.length, keys = null;
      const done = () => { if (left || !keys) return; dead = keys.filter(h => !used.has(h)); const s = t.objectStore('imgs'); dead.forEach(h => s.delete(h)); };
      t.objectStore('imgs').getAllKeys().onsuccess = e => { keys = e.target.result; done(); };
      IMG_STORES.forEach(st => { t.objectStore(st).getAll().onsuccess = e => { collectRefs(e.target.result, used); left--; done(); }; }); });
    dead.forEach(h => { HASHOF.delete(IMGCACHE.get(h)); IMGCACHE.delete(h); }); return dead.length; }
};

/* ---------- État ---------- */
let books = [], cases = [], imports = [], curCase = localStorage.getItem('scanly_case') || '';
let theme = THEMES[localStorage.getItem('scanly_theme')] ? localStorage.getItem('scanly_theme') : 'salon';
let rt = theme, aiHits = null, drag = null, justDragged = false, dupAIhtml = '';
const SEL = new Set();
let SMETA = {}; try { SMETA = JSON.parse(localStorage.getItem('scanly_series') || '{}'); } catch (e) {}
const F = {q: '', type: '', status: '', author: '', genre: '', sort: 'shelf'};
const CAM = {view: localStorage.getItem('scanly_cam') || 'front', move: localStorage.getItem('scanly_move') === '1', dusk: localStorage.getItem('scanly_dusk') === '1',
  ghost: localStorage.getItem('scanly_ghost') !== '0', photo: localStorage.getItem('scanly_photo') !== '0', sel: false, mx: 0, my: 0};
const cfg = { get key() { return localStorage.getItem('scanly_key') || ''; }, get model() { return localStorage.getItem('scanly_model') || MODELS[0]; } };
async function load() {
  books = await DB.all('books'); cases = (await DB.all('cases')).sort((a, b) => a.createdAt - b.createdAt); imports = await DB.all('imports');
  books.forEach(b => { if (b.loan && !b.loanTo) { b.loanTo = b.loan; delete b.loan; } });
  await migrateImports();
}
/* Imports réalisés avant la V1.5 : regroupés par meuble et heure d'ajout */
async function migrateImports() {
  const legacy = books.filter(b => !b.importId && !b.wish && b.addedAt).sort((a, b) => (a.caseId || '').localeCompare(b.caseId || '') || a.addedAt - b.addedAt);
  const groups = []; let g = null;
  legacy.forEach(b => { if (!g || g.caseId !== b.caseId || b.addedAt - g.last > 120000) { g = {caseId: b.caseId, last: b.addedAt, items: []}; groups.push(g); } g.items.push(b); g.last = b.addedAt; });
  const ch = [];
  for (const gr of groups.filter(x => x.items.length >= 3)) {
    const imp = {id: 'imp_' + uid(), date: new Date(gr.items[0].addedAt).toISOString(), caseId: gr.caseId, count: gr.items.length, photos: [], legacy: true};
    imports.push(imp); await DB.put('imports', imp);
    gr.items.sort((a, b) => (a.row || 1) - (b.row || 1) || (a.position || 0) - (b.position || 0)).forEach((b, i) => {
      b.importId = imp.id; b.importOrder = i; if (!b.orig) b.orig = {caseId: b.caseId || null, row: b.row || 1, position: b.position || i + 1}; ch.push(b); });
  }
  if (ch.length) await DB.putMany('books', ch);
}
async function saveBook(b) { b.updatedAt = Date.now(); await DB.put('books', b); const i = books.findIndex(x => x.id === b.id); i >= 0 ? books[i] = b : books.push(b); }
function nextPos(caseId, row, excl) { return Math.max(0, ...books.filter(b => b.caseId === caseId && (b.row || 1) === (row || 1) && !(excl && excl.has(b.id))).map(b => b.position || 0)) + 1; }
function renumber(caseId, row) { const L = books.filter(b => b.caseId === caseId && (b.row || 1) === row).sort((a, b) => (a.position ?? 999) - (b.position ?? 999)); L.forEach((b, i) => b.position = i + 1); return L; }
function newBook(o) { return Object.assign({id: uid(), title: '', author: '', type: 'Roman', status: 'À lire', row: 1, addedAt: Date.now()}, o); }
const locOf = b => { const c = cases.find(x => x.id === b.caseId); return c ? `${c.name} · ét.${b.row || 1} pos.${b.position || '?'}` : 'non rangé'; };
async function newCase(name, rows = 3) { const c = {id: uid(), name: name.trim() || 'Meuble ' + (cases.length + 1), photos: [], rows: Math.max(3, rows), createdAt: Date.now()}; await DB.put('cases', c); cases.push(c); return c; }

/* ---------- Historique des déplacements (Annuler / Rétablir) ---------- */
const UNDO = {stack: [], redo: []};
try { UNDO.stack = JSON.parse(localStorage.getItem('scanly_undo') || '[]'); } catch (e) {}
const snapPos = () => books.map(b => [b.id, b.caseId ?? null, b.row || 1, b.position ?? null]);
function persistUndo() { try { localStorage.setItem('scanly_undo', JSON.stringify(UNDO.stack.slice(-25))); } catch (e) { UNDO.stack = UNDO.stack.slice(-8); } updUndoBtns(); }
function pushUndo(label) { UNDO.stack.push({label, at: Date.now(), s: snapPos()}); if (UNDO.stack.length > 25) UNDO.stack.shift(); UNDO.redo = []; persistUndo(); }
async function applySnap(s) {
  const m = new Map(s.map(x => [x[0], x])), ch = [];
  books.forEach(b => { const x = m.get(b.id); if (x && (b.caseId !== x[1] || (b.row || 1) !== x[2] || b.position !== x[3])) { b.caseId = x[1]; b.row = x[2]; b.position = x[3]; ch.push(b); } });
  await DB.putMany('books', ch); return ch.length;
}
async function undo() { const u = UNDO.stack.pop(); if (!u) return toast('Rien à annuler'); UNDO.redo.push({label: u.label, s: snapPos()}); await applySnap(u.s); persistUndo(); animateRender(renderAll); toast('↶ Annulé : ' + u.label); }
async function redo() { const r = UNDO.redo.pop(); if (!r) return toast('Rien à rétablir'); UNDO.stack.push({label: r.label, at: Date.now(), s: snapPos()}); await applySnap(r.s); persistUndo(); animateRender(renderAll); toast('↷ Rétabli : ' + r.label); }
function updUndoBtns() { const u = $('#bUndo'), r = $('#bRedo'); if (!u) return; const l = UNDO.stack[UNDO.stack.length - 1];
  u.disabled = !l; u.title = l ? `Annuler : ${l.label} (Ctrl+Z)` : 'Rien à annuler'; r.disabled = !UNDO.redo.length; r.title = UNDO.redo.length ? 'Rétablir : ' + UNDO.redo[UNDO.redo.length - 1].label + ' (Ctrl+Y)' : 'Rien à rétablir'; }

/* ---------- Performance ---------- */
const PERF = {aiCalls: 0, aiMs: 0, waitMs: 0, reset() { this.aiCalls = 0; this.aiMs = 0; this.waitMs = 0; }};
const fmtDur = ms => ms < 60000 ? Math.max(1, Math.round(ms / 1000)) + ' s' : Math.floor(ms / 60000) + ' min ' + String(Math.round(ms % 60000 / 1000)).padStart(2, '0');
async function fetchT(url, opts = {}, ms = 8000) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms); try { return await fetch(url, {...opts, signal: ac.signal}); } finally { clearTimeout(t); } }
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({length: Math.min(n, items.length)}, async () => { while (i < items.length) { const k = i++; try { await fn(items[k], k); } catch (e) { console.warn(e); } } })); }

/* ---------- Gemini ---------- */
const noThink = new Set();
function thinkCfg(model, think) {
  if (noThink.has(model)) return null;
  if (/^gemini-2/.test(model)) return /pro/.test(model) ? {thinkingBudget: 128} : (think === 'off' ? {thinkingBudget: 0} : {thinkingBudget: 1024});
  return {thinkingLevel: think === 'off' ? 'minimal' : 'low'};
}
async function gemini(parts, {json = false, system = null, history = null, think = 'off', timeout = 150000} = {}) {
  if (!cfg.key) throw new Error('Clé API Gemini manquante (⚙ Paramètres)');
  let lastErr = '';
  for (const model of [cfg.model, ...MODELS.filter(m => m !== cfg.model)]) {
    for (let a = 0; a < 4; a++) {
      const body = {contents: [...(history || []), {role: 'user', parts}], generationConfig: {temperature: json ? 0.2 : 0.7}};
      if (json) body.generationConfig.responseMimeType = 'application/json';
      const tc = thinkCfg(model, think); if (tc) body.generationConfig.thinkingConfig = tc;
      const uiLang = window.SCANLY_I18N?.get() || 'fr';
      const narrativeLang = {fr:'French',en:'English',es:'Spanish',ko:'Korean',de:'German'}[uiLang];
      const languageRule = uiLang === 'fr' ? '' : (json
        ? `Language rule: preserve all JSON keys, enum values, book titles, authors, series, publisher names and ISBNs exactly as required by the task or printed on the book. Do not translate identification metadata. Only free-form summaries, descriptions and explanatory prose should be written in ${narrativeLang}.`
        : `Respond in ${narrativeLang}. Keep book titles, author names, series and user-defined furniture names in their original language.`);
      if (system || languageRule) body.systemInstruction = {parts: [{text: [system, languageRule].filter(Boolean).join('\n')}]};
      const t0 = performance.now(); let r;
      try { r = await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': cfg.key}, body: JSON.stringify(body)}, timeout); }
      catch (e) { lastErr = e.name === 'AbortError' ? 'L\'IA met trop de temps à répondre' : 'Connexion à l\'IA impossible'; PERF.aiMs += performance.now() - t0; continue; }
      const d = await r.json().catch(() => ({})); PERF.aiCalls++; PERF.aiMs += performance.now() - t0;
      const msg = d.error?.message || '';
      if (r.status === 429 || r.status >= 500) {
        if (r.status === 429 && /per ?day|PerDay|daily/i.test(msg)) { lastErr = 'Quota gratuit journalier atteint pour ' + model; break; }
        const ri = (d.error?.details || []).find(x => String(x['@type'] || '').includes('RetryInfo'));
        const wait = Math.min(60000, ri ? parseFloat(ri.retryDelay) * 1000 + 500 : 3000 * (a + 1));
        lastErr = r.status === 429 ? 'Quota gratuit atteint, réessaie dans une minute.' : 'Service IA momentanément indisponible.';
        if (wait > 4000) toast(`Limite de l'offre gratuite Gemini : pause de ${Math.round(wait / 1000)} s…`, Math.min(wait, 8000));
        PERF.waitMs += wait; await sleep(wait); continue;
      }
      if (r.status === 400 && /thinking/i.test(msg) && tc) { noThink.add(model); a--; continue; }
      if (r.status === 404 || (r.status === 400 && /model/i.test(msg) && !/API key/i.test(msg))) { lastErr = msg; break; }
      if (!r.ok) throw new Error(msg || ('Erreur IA ' + r.status));
      if (model !== cfg.model) { const was = cfg.model; localStorage.setItem('scanly_model', model); toast(`Modèle IA « ${was} » indisponible : SCANLY utilise désormais « ${model} » (modifiable dans Paramètres).`, 7000); } // V2.26 : plus de changement silencieux
      const txt = (d.candidates?.[0]?.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join('');
      if (!txt) throw new Error('Réponse IA vide');
      return json ? parseJSON(txt) : txt;
    }
  }
  throw new Error(lastErr || 'IA indisponible');
}
function parseJSON(t) {
  t = t.replace(/```json|```/g, '').trim();
  try { return JSON.parse(t); } catch (e) { const i = Math.min(...['[', '{'].map(c => t.indexOf(c)).filter(x => x >= 0)), j = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}')); return JSON.parse(t.slice(i, j + 1)); }
}

/* ---------- Images ---------- */
async function srcToImg(src) { const img = new Image(); img.src = src; await img.decode(); return img; }
function resize(img, max, q) {
  const w = img.naturalWidth || img.videoWidth || img.width, h = img.naturalHeight || img.videoHeight || img.height, s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q);
}
/* Découpe la tranche dans la photo + couleur dominante réelle (et non estimée) */
function spineData(img, box) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const x0 = box[1] / 1000 * W, x1 = box[3] / 1000 * W, y0 = box[0] / 1000 * H, y1 = box[2] / 1000 * H;
  const w = Math.max(2, x1 - x0), h = Math.max(2, y1 - y0), k = Math.min(1.5, 280 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(4, Math.round(w * k)); c.height = Math.max(4, Math.round(h * k));
  const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(img, x0, y0, w, h, 0, 0, c.width, c.height);
  const sx = Math.floor(c.width * .12), sy = Math.floor(c.height * .06), sw = Math.max(1, Math.floor(c.width * .76)), sh = Math.max(1, Math.floor(c.height * .88));
  const d = x.getImageData(sx, sy, sw, sh).data, bins = new Map();
  for (let i = 0; i < d.length; i += 8) { const key = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4); const e = bins.get(key) || [0, 0, 0, 0]; e[0]++; e[1] += d[i]; e[2] += d[i + 1]; e[3] += d[i + 2]; bins.set(key, e); }
  let best = [1, 128, 128, 128]; bins.forEach(e => { if (e[0] > best[0]) best = e; });
  const color = '#' + [1, 2, 3].map(j => Math.round(best[j] / best[0]).toString(16).padStart(2, '0')).join('');
  return {crop: c.toDataURL('image/jpeg', .8), color, wpx: w, hpx: h};
}

/* ---------- Reconnaissance des tranches ---------- */
const SCAN_PROMPT = `Tu es un expert bibliothécaire (livres, bandes dessinées, mangas, comics – édition française en priorité).
Analyse la ou les photos : tranches de livres sur une étagère, couverture(s) ou code-barres.
Repère CHAQUE ouvrage visible, sans en oublier aucun. Lis attentivement les textes des tranches (souvent verticaux, parfois à l'envers), les logos d'éditeurs (Gallimard, Folio, Le Livre de Poche, Pocket, J'ai lu, Dargaud, Dupuis, Casterman, Glénat, Delcourt, Soleil, Lombard, Kana, Pika, Ki-oon, Urban Comics, Panini…) et les numéros de tome.
Corrige l'orthographe et complète l'auteur grâce à tes connaissances lorsque le titre est sans ambiguïté.
Réponds UNIQUEMENT en JSON :
{"livres":[{"titre":"… ou null","illisible":false,"auteur":"Prénom Nom ou null","serie":"… ou null","tome":nombre ou null,"editeur":"… ou null","type":"un parmi ${TYPES.join(', ')}","rangee":1,"position":1,"epaisseur":"fine|moyenne|epaisse","hauteur":"petite|normale|grande","isbn":"si lisible sinon null","confiance":0.0,"image":0,"boite":[ymin,xmin,ymax,xmax],"coins":[[x,y],[x,y],[x,y],[x,y]],"alternatives":[{"titre":"…","auteur":"…"}]}]}
Règles :
- rangee = numéro d'étagère depuis le HAUT de la photo (1). position = ordre de GAUCHE à DROITE dans la rangée.
- image = index de la photo (0 = première) ; boite = cadre PRÉCIS de la tranche entière (du haut au bas du livre) sur cette photo, coordonnées normalisées de 0 à 1000.
- coins = les 4 coins RÉELS de la tranche, au format [x,y] normalisé de 0 à 1000, dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche. Suis les bords exacts du livre, même s'il penche ou si la photo est en perspective ; n'englobe ni le fond ni les livres voisins.
- confiance de 0 à 1. Si confiance < 0.75, donne dans "alternatives" jusqu'à 2 autres identifications plausibles, sinon [].
- Une tranche que tu ne peux pas lire DOIT quand même figurer dans la liste avec "titre": null et "illisible": true (avec sa boite, rangee et position). N'invente jamais de titre.
- Ignore les objets qui ne sont pas des livres.`;
const MERGE_TXT = n => `\nIMPORTANT : les ${n} photos sont des vues successives, de GAUCHE à DROITE, d'un MÊME meuble, avec des chevauchements. Un livre visible sur deux photos ne doit apparaître qu'UNE seule fois. Les positions sont numérotées sur l'ensemble du meuble. "image" = photo où le livre est le plus lisible.`;
async function recognize(urls) {
  const parts = [{text: SCAN_PROMPT + (urls.length > 1 ? MERGE_TXT(urls.length) : '')}, ...urls.map(u => ({inlineData: {mimeType: 'image/jpeg', data: u.split(',')[1]}}))];
  const out = await gemini(parts, {json: true, think: 'low', timeout: 240000});
  const list = Array.isArray(out) ? out : (out.livres || []);
  return {list: list.filter(x => x && (x.titre || x.illisible || Array.isArray(x.boite)))};
}

/* ---------- Enrichissement ---------- */
async function gBooks(q, max = 5, options = {}) { const C=window.CV21;if(C&&C.force)options={...options,force:true}; try { const d=await SCANLY_SOURCES.request(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${max}&printType=books`,'json',options);if(C)C.ok++;const items=d.items||[];if(/^isbn:/i.test(q)){const id=q.slice(5).replace(/[^0-9X]/gi,'');return items.filter(it=>(it.volumeInfo?.industryIdentifiers||[]).some(x=>SCANLY_SOURCES.validISBN(x.identifier)&&SCANLY_SOURCES.isbn13(x.identifier)===SCANLY_SOURCES.isbn13(id)));}return items;}catch(e){if(C){C.err++;C.msgs.add('Google Books : '+e.message);}options.onError?.('Google Books : '+e.message);return [];} }

function applyGB(b, it, force) {
  const v = it.volumeInfo || {}, s = it.saleInfo || {};
  const set = (k, val) => { if (val != null && val !== '' && (force || b[k] == null || b[k] === '')) b[k] = val; };
  set('author', (v.authors || []).join(', ')); set('publisher', v.publisher); set('year', v.publishedDate ? parseInt(v.publishedDate) : null);
  const ids = v.industryIdentifiers || []; set('isbn', (ids.find(x => x.type === 'ISBN_13') || ids[0])?.identifier);
  set('pages', v.pageCount); set('description', v.description); set('genre', (v.categories || [])[0]);
  const img = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail; if (img && !b.coverManual) set('cover', img.replace('http://', 'https://').replace('&edge=curl', ''));
  const p = s.listPrice || s.retailPrice;
  if (p && p.currencyCode === 'EUR' && (force || b.price == null || b.priceSource === 'Estimation IA')) { b.price = p.amount; b.priceSource = 'Google Books'; }
}
async function openLib(b) {
  try { const p = new URLSearchParams({title: b.title, limit: '3', fields: 'title,author_name,first_publish_year,publisher,isbn,number_of_pages_median,cover_i'}); if (b.author) p.set('author', b.author.split(',')[0]);
    const d = await SCANLY_SOURCES.request('https://openlibrary.org/search.json?' + p);
    const doc = (d.docs || []).find(x => sim(x.title, b.title) >= .5); if (!doc) return;
    if (!b.author && doc.author_name) b.author = doc.author_name.join(', ');
    if (!b.year && doc.first_publish_year) b.year = doc.first_publish_year;
    if (!b.publisher && doc.publisher) b.publisher = doc.publisher[0];
    if (!b.isbn && doc.isbn) b.isbn = doc.isbn.find(i => i.length === 13) || doc.isbn[0];
    if (!b.pages && doc.number_of_pages_median) b.pages = doc.number_of_pages_median;
    if (!b.cover && !b.coverManual && doc.cover_i && titleMatch21(b, doc.title, '', (doc.author_name || []).join(' ')) && volMatch(doc.title, b.volume)) b.cover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
  } catch (e) {}
}
/* V1.9.8 : couverture propre à chaque tome */
const volRe = v => new RegExp('(^|[^0-9])(t(ome)?\\.?\\s*|vol(ume)?\\.?\\s*|n[°o]\\s*|#\\s*)?0*' + v + '(?![0-9])', 'i');
const volMatch = (txt, v) => !v || volRe(v).test(String(txt || ''));
const gbCover = it => { const l = it?.volumeInfo?.imageLinks; const u = l && (l.thumbnail || l.smallThumbnail); return u ? u.replace('http://', 'https://').replace('&edge=curl', '') : null; };
/* V2.0 : une couverture est « en double » seulement si elle sert à plusieurs tomes DIFFÉRENTS d'une même série */
function sharedCovers() {
  const m = new Map(); books.forEach(b => { if (!b.cover || !b.series || !b.volume) return; const k = b.cover.replace(/&zoom=\d/, ''); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(norm(b.series) + '#' + b.volume); });
  const bad = new Set(); m.forEach((v, k) => { if (v.size > 1) bad.add(k); }); return bad;
}
const ckey = u => String(u || '').replace(/&zoom=\d/, '');
async function olIsbnCover(isbn) { // Open Library : couverture directe par ISBN (vérifiée)
  const c = String(isbn).replace(/[^0-9X]/gi, ''); if (c.length < 10) return null;
  try { const rr = await SCANLY_SOURCES.request(`https://openlibrary.org/api/books?bibkeys=ISBN:${c}&format=json&jscmd=data`);
    const d = rr['ISBN:' + c]; return d && d.cover ? (d.cover.medium || d.cover.large || d.cover.small) : null; } catch (e) { return null; }
}
/* V2.21 : une couverture n'est retenue que si la notice correspond VRAIMENT au livre (titre, sinon série + tome ; auteur si connu). */
function titleMatch21(b, title, subtitle, authors) {
  const full = (title || '') + ' ' + (subtitle || ''), ts = Math.max(sim(b.title, full), sim(b.title, title)), nb = norm(b.title), nt = norm(title);
  const short = nb.split(' ').filter(w => w.length > 1).length <= 2;
  let ok = short ? (nt === nb || nt.startsWith(nb + ' ') || nb.startsWith(nt + ' ') && nt.length > 3 || ts >= 1 && norm(full).includes(nb)) : ts >= .7;
  if (!ok && b.series && b.volume) ok = sim(b.series, full) >= .7 && volMatch(full, b.volume);
  if (ok && b.author && authors && String(authors).trim()) { const last = norm(b.author.split(',')[0]).split(' ').pop(); if (last && last.length > 2 && !norm(authors).includes(last) && sim(b.author, authors) < .5) ok = false; }
  return ok;
}
const gbMatch21 = (b, it) => { const v = it?.volumeInfo || {}; return titleMatch21(b, v.title, v.subtitle, (v.authors || []).join(' ')); };
async function olIsbnRecord21(isbn) { const c = String(isbn).replace(/[^0-9X]/gi, ''); if (c.length < 10) return null;
  const C = window.CV21; try { const rr = await SCANLY_SOURCES.request(`https://openlibrary.org/api/books?bibkeys=ISBN:${c}&format=json&jscmd=data`, 'json', C && C.force ? {force: true} : {}); if (C) C.ok++; return rr['ISBN:' + c] || null; } catch (e) { if (C) { C.err++; C.msgs.add('Open Library : ' + e.message); } return null; } }
async function coverFor(b, avoid) { b._coverSrc21 = null; const u = await coverFor21(b, avoid); return u; }
async function coverFor21(b, avoid) {
  const v = b.volume, ser = b.series || '', au = b.author ? b.author.split(',')[0].trim().split(' ').pop() : '';
  const used = u => !u || (avoid && avoid.has(ckey(u)));
  const tryIsbn = async (isbn, verify = true) => { const c = String(isbn || '').replace(/[^0-9X]/gi, ''); if (c.length < 10) return null;
    const it = (await gBooks('isbn:' + c, 3))[0], u = gbCover(it); if (it && verify && !gbMatch21(b, it) && window.CV21 && c === String(b.isbn || '').replace(/[^0-9X]/gi, '')) window.CV21.wrongIsbn = it.volumeInfo?.title || '?'; if (u && !used(u) && (!verify || gbMatch21(b, it))) return u;
    const rec = await olIsbnRecord21(c), o = rec?.cover && (rec.cover.medium || rec.cover.large || rec.cover.small); if (rec?.title && verify && window.CV21 && c === String(b.isbn || '').replace(/[^0-9X]/gi, '') && !titleMatch21(b, rec.title, rec.subtitle, (rec.authors || []).map(a => a.name).join(' '))) window.CV21.wrongIsbn = rec.title;
    return o && !used(o) && (!verify || titleMatch21(b, rec.title, rec.subtitle, (rec.authors || []).map(a => a.name).join(' '))) ? o : null; };
  // 1. ISBN connu
  if (b.isbn) { const u = await tryIsbn(b.isbn); if (u) return u; }
  // 2. série + tome / titre dans Google Books
  const vtxt = vi => (vi.title || '') + ' ' + (vi.subtitle || '') + ' ' + (vi.seriesInfo?.bookDisplayNumber || '') + ' ' + (vi.seriesInfo?.volumeSeries?.[0]?.orderNumber || '');
  const qs = [];
  if (ser && v) { qs.push(`${ser} tome ${v}` + (au ? ' inauthor:' + au : '')); qs.push(`intitle:"${ser}" ${v}`); }
  qs.push('intitle:' + b.title + (au ? ' inauthor:' + au : ''));
  for (const q of qs) for (const it of await gBooks(q, 10)) { const vi = it.volumeInfo || {}, t = vtxt(vi), u = gbCover(it);
    if (used(u) || !gbMatch21(b, it)) continue;
    const okVol = !v || volMatch(t, v) || volMatch(b.title, v) && sim(b.title, t) >= .8;
    if (okVol) return u; }
  // 3. Open Library (recherche)
  try { const p = new URLSearchParams({q: (ser && v ? ser + ' ' + v : b.title) + (au ? ' ' + au : ''), limit: '10', fields: 'title,subtitle,author_name,cover_i'});
    const C = window.CV21, rr = await SCANLY_SOURCES.request('https://openlibrary.org/search.json?' + p, 'json', C && C.force ? {force: true} : {}); if (C) C.ok++;
    for (const d of (rr.docs || [])) { const u = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null; if (!used(u) && titleMatch21(b, d.title, d.subtitle, (d.author_name || []).join(' ')) && (!v || volMatch(d.title + ' ' + (d.subtitle || ''), v))) return u; }
  } catch (e) { const C = window.CV21; if (C) { C.err++; C.msgs.add('Open Library : ' + e.message); } }
  // 4. l'IA retrouve l'ISBN de l'édition française de ce tome
  if (cfg.key && (ser || b.title)) { try {
    const o = await gemini([{text: `Donne l'ISBN-13 de l'édition française de : « ${b.title} »${ser ? `, série « ${ser} »` : ''}${v ? `, tome ${v}` : ''}${b.author ? `, ${b.author}` : ''}${b.publisher ? `, éditeur ${b.publisher}` : ''}. Si tu n'es pas sûr, null. JSON : {"isbn":"…"}`}], {json: true, timeout: 60000});
    const u = await tryIsbn(o.isbn); if (u) { if (!b.isbn || window.CV21?.wrongIsbn) b.isbn = String(o.isbn).replace(/[^0-9X]/gi, ''); return u; } } catch (e) {} }
  return null;
}
/* V2.21 : revérification stricte des couvertures automatiques */
/* V2.22 : « réseau » seulement si AUCUNE base n'a répondu (Google Books est souvent limité en quota
   sans clé : une erreur Google seule ne bloque plus la vérification). Un ISBN qui désigne un autre
   livre suffit à prouver que la couverture issue de cet ISBN est fausse. */
async function recheckCover21(b, avoid, force = false) {
  const C = window.CV21 = {ok: 0, err: 0, msgs: new Set(), force, wrongIsbn: null}; let u = null;
  try { u = await coverFor21(b, avoid); } finally { window.CV21 = null; }
  b._cv21 = {wrongIsbn: C.wrongIsbn, msgs: [...C.msgs]};
  if (u) { if (ckey(u) === ckey(b.cover)) return 'kept'; b.cover = u; return 'changed'; }
  if (!C.ok && C.err && !C.wrongIsbn) return 'unchecked';
  b.cover = null; return 'removed';
}
async function auditCovers21(btn) {
  const todo = books.filter(b => b.cover && !b.coverManual && b.title && !b.unknown);
  if (!todo.length) return toast('Aucune couverture automatique à revérifier');
  if (!confirm(`Revérifier ${todo.length} couverture(s) trouvée(s) automatiquement ?\nUne couverture dont la notice ne correspond pas au titre (ou à la série + tome) est remplacée par la bonne, sinon retirée (la tranche/la carte s'affiche à la place).\nLes couvertures personnelles ne sont pas modifiées. Durée : plusieurs minutes pour une grande bibliothèque.`)) return;
  if (!await safetyPoint18('Avant revérification des couvertures')) return;
  const lbl = btn ? btn.innerHTML : '', R = {kept: 0, changed: 0, removed: 0, unchecked: 0}; let k = 0;
  await pool(todo, 3, async b => { const avoid = new Set(books.filter(x => x !== b && x.cover && x.series && norm(x.series) === norm(b.series || '') && x.volume !== b.volume).map(x => ckey(x.cover)));
    const r = await recheckCover21(b, avoid); delete b._cv21; R[r]++; if (r === 'changed' || r === 'removed') await DB.put('books', b);
    k++; if (btn) btn.innerHTML = `<span class="spin"></span> ${k}/${todo.length}`; });
  if (btn) btn.innerHTML = lbl; renderAll();
  toast(`Couvertures : ${R.kept} confirmée(s), ${R.changed} remplacée(s), ${R.removed} retirée(s)${R.unchecked ? `, ${R.unchecked} non vérifiée(s) (réseau)` : ''}.`, 9000);
}
async function fixCovers(btn) {
  if(!await safetyPoint18('Avant correction groupée des couvertures'))return;
  const bad = sharedCovers(), todo = books.filter(b => !b.wish && !b.coverManual && b.title && (!b.cover || bad.has(ckey(b.cover))));
  if (!todo.length) return toast('Toutes les couvertures sont déjà en place');
  let n = 0, k = 0; const lbl = btn ? btn.innerHTML : '';
  todo.sort((a, b) => (a.series || a.title).localeCompare(b.series || b.title) || (a.volume || 0) - (b.volume || 0));
  // la 1re occurrence d'une couverture partagée la garde (souvent le tome 1), les autres en cherchent une propre
  const keep = new Set(); todo.forEach(b => { if (b.cover && bad.has(ckey(b.cover)) && !keep.has(ckey(b.cover))) { keep.add(ckey(b.cover)); b._keep = true; } });
  await pool(todo.filter(b => !b._keep), 3, async b => { const avoid = new Set([...bad, ...books.filter(x => x !== b && x.cover && x.series && norm(x.series) === norm(b.series || '') && x.volume !== b.volume).map(x => ckey(x.cover))]);
    const u = await coverFor(b, avoid); if (u) { b.cover = u; n++; } else if (b.cover && bad.has(ckey(b.cover))) b.cover = null;
    await DB.put('books', b); k++; if (btn) btn.innerHTML = `<span class="spin"></span> ${k}/${todo.length}`; });
  todo.forEach(b => delete b._keep);
  if (btn) btn.innerHTML = lbl; renderAll(); toast(`${n} couverture(s) trouvée(s) sur ${todo.length} vérifiée(s).`, 7000);
}
async function enrich(b, force = false) {
  if (!b.title) return b;
  let items = [];
  if (b.isbn) items = await gBooks('isbn:' + String(b.isbn).replace(/[^0-9X]/gi, ''));
  if (!items.length) items = await gBooks('intitle:' + b.title + (b.author ? ' inauthor:' + b.author.split(',')[0].trim().split(' ').pop() : ''));
  if (!items.length && b.series) items = await gBooks(b.series + ' ' + (b.volume || '') + ' ' + (b.author || ''));
  let best = null, bs = 0;
  for (const it of items) { const v = it.volumeInfo || {}, full = (v.title || '') + ' ' + (v.subtitle || '');
    let sc = Math.max(sim(b.title, full), sim(v.title, b.title));
    if (b.author && v.authors) sc += .4 * sim(b.author, v.authors.join(' '));
    if (b.volume && new RegExp('\\b' + b.volume + '\\b').test(full)) sc += .2;
    if (v.language === 'fr') sc += .1; if (v.imageLinks) sc += .05;
    if (sc > bs) { bs = sc; best = it; } }
  const prevCover = b.cover;
  if (best && !gbMatch21(b, best)) best = null; // V2.21 : notice d'un autre livre -> ni infos ni couverture
  if (best && bs >= .6) applyGB(b, best, force);
  if (b.volume && b.series && b.cover && b.cover !== prevCover && books.some(x => x !== b && x.series && norm(x.series) === norm(b.series) && x.volume !== b.volume && ckey(x.cover) === ckey(b.cover))) b.cover = prevCover || null;   // V2.0 : pas la couverture d'un autre tome de la série
  if (!best || bs < .6 || !b.cover) await openLib(b);
  await SCANLY_SOURCES.supplement(b);
  if (!b.cover) { const u = await coverFor(b, sharedCovers()); if (u) b.cover = u; }
  return b;
}
async function aiComplete(list, onP) {
  const need = b => b.title && (!b.author || !b.type || b.type === 'Autre' || !b.genre || !b.year || !b.publisher || b.price == null || b.price === '' || !b.description);
  const todo = list.filter(need); let done = list.length - todo.length; onP && onP(done);
  const chunks = []; for (let i = 0; i < todo.length; i += 25) chunks.push(todo.slice(i, i + 25));
  await pool(chunks, 3, async ch => {
    const input = ch.map((b, k) => { const o = {i: k, titre: b.title}; ['author', 'series', 'volume', 'publisher', 'year'].forEach((f, j) => { if (b[f]) o[['auteur', 'serie', 'tome', 'editeur', 'annee'][j]] = b[f]; });
      o.manque = [!b.author && 'auteur', (!b.type || b.type === 'Autre') && 'type', !b.genre && 'genre', !b.year && 'annee', !b.publisher && 'editeur', (b.price == null || b.price === '') && 'prix_eur', !b.description && 'resume'].filter(Boolean); return o; });
    const prompt = `Marché français. Pour chaque ouvrage, donne UNIQUEMENT les champs listés dans "manque" (null si tu n'es pas sûr).
Formats : type = un parmi ${TYPES.join(', ')} ; genre = genre court (Policier, Science-fiction, Fantasy, Aventure, Humour, Historique, Biographie, Classique, Thriller, Romance, Jeunesse, Poésie, Théâtre…) ; annee = année de 1re publication ; prix_eur = prix indicatif neuf (nombre) ; resume = UNE phrase de 25 mots maximum, sans spoiler.
JSON : [{"i":0, ...champs demandés}]
Ouvrages : ${JSON.stringify(input)}`;
    try { const out = await gemini([{text: prompt}], {json: true, think: 'off', timeout: 90000});
      for (const o of (Array.isArray(out) ? out : out.livres || [])) { const b = ch[o.i]; if (!b) continue;
        if (!b.author && o.auteur) b.author = o.auteur;
        if ((!b.type || b.type === 'Autre') && TYPES.includes(o.type)) b.type = o.type;
        if (!b.genre && o.genre) b.genre = o.genre;
        if (!b.year && o.annee) b.year = parseInt(o.annee) || null;
        if (!b.publisher && o.editeur) b.publisher = o.editeur;
        if ((b.price == null || b.price === '') && o.prix_eur) { b.price = Number(o.prix_eur); b.priceSource = 'Estimation IA'; }
        if (!b.description && o.resume) b.description = o.resume; }
    } catch (e) { toast('Complément IA : ' + e.message, 4000); }
    done += ch.length; if (onP) await onP(done, ch);
  });
}

/* ---------- Filtres ---------- */
function matchQ(b, q) { if (!q) return true; return norm([b.title, b.author, b.series, b.publisher, b.genre, b.isbn, b.notes, b.loanTo].join(' ')).includes(norm(q)); }
function passF(b) { return (!F.type || b.type === F.type) && (!F.status || (F.status === '__wish' ? b.wish : F.status === '__unk' ? b.unknown : !b.wish && (b.status || 'À lire') === F.status)) && (!F.author || (b.author || '').split(',').map(a => a.trim()).includes(F.author)) && (!F.genre || b.genre === F.genre); }
const caseOf = b => b && b.caseId && cases.some(c => c.id === b.caseId) ? b.caseId : NONE;


/* V2.30 : mise à jour fiable sur iPhone. Le service worker est revérifié à chaque retour dans l'app,
   sans passer par le cache HTTP, et la page se recharge d'elle-même quand une nouvelle version prend la main. */
function registerSW30() {
  const sw = navigator.serviceWorker; const hadCtrl = !!sw.controller; let reloaded = false;
  sw.register('sw.js', {updateViaCache: 'none'}).then(reg => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => {});
  sw.addEventListener('controllerchange', () => { if (!hadCtrl || reloaded) return; reloaded = true;
    const busy = document.querySelector('#modal.on, #drawer.on') || document.activeElement?.matches?.('input,textarea,select');
    if (busy) { toast('Nouvelle version de SCANLY prête : ferme et rouvre l\'app pour l\'utiliser', 8000); return; }
    location.reload(); });
}
