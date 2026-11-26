/* SCANLY – 06_demarrage.js : Boutons, raccourcis, démarrage, code-barres, corbeille, détourage, étagères, reconnaissance V1.9.5.
   Les fichiers js/ sont chargés dans l'ordre par index.html et partagent les mêmes variables globales. */
'use strict';
/* =====================================================================
   BOUTONS, RACCOURCIS & DÉMARRAGE
   ===================================================================== */
$('#hScan').onclick = () => openScan();
$('#fabCam').onclick = () => { if (IS_TOUCH) { openScan(); return $('#camIn').click(); } openScan(null, 'cam'); };
$('#camIn').onchange = e => { if (!$('#thumbs')) openScan(); addFiles(e.target.files); e.target.value = ''; };
$('#fabMenu').onclick = e => { e.stopPropagation(); $('#fab').classList.toggle('open'); };
document.addEventListener('click', e => { if (!e.target.closest('#fab')) $('#fab').classList.remove('open'); });
$('#fabImp').onclick = () => openScan(null, 'imp');
$('#fabAdd').onclick = addManual;
$('#hAI').onclick = openAI;
$('#hSave').onclick = backupNow;
$('#hSync').onclick = () => syncNow();
$('#hSet').onclick = openSettings;
$('#tbToggle').onclick = e => { e.stopPropagation(); document.body.classList.toggle('tbopen'); $('#tbToggle').textContent = document.body.classList.contains('tbopen') ? '▴' : '▾'; };
document.addEventListener('click', e => { if (document.body.classList.contains('tbopen') && !e.target.closest('.toolbar,#tbToggle,select')) { document.body.classList.remove('tbopen'); $('#tbToggle').textContent = '▾'; } });
$('#viewSeg').addEventListener('click', () => setTimeout(() => { document.body.classList.remove('tbopen'); $('#tbToggle').textContent = '▾'; }, 50));
matchMedia('(orientation:landscape)').addEventListener('change', () => setTimeout(() => applyView(), 300));
$('#dBack').onclick = () => closeDrawer();
document.addEventListener('click', e => { const b = e.target.closest('[data-hm]'); if (!b) return; $$('.ddw.open').forEach(w => w.classList.remove('open'));
  ({scan: () => $('#hScan').click(), ai: () => $('#hAI').click(), save: () => $('#hSave').click(), set: () => openSettings(),review:()=>setView('review'),wish:()=>setView('wish')})[b.dataset.hm](); });
$('#undo').onclick = e => { if (e.target.id !== 'undoBtn') $('#undo').classList.remove('on'); };
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName), libOn = $('#v-lib').classList.contains('on') && !$('#modal').classList.contains('on') && !$('#drawer').classList.contains('on');
  if (e.code === 'Space' && stream && $('#vid') && $('#modal').classList.contains('on') && !typing) { e.preventDefault(); return snap(); }
  if ((e.ctrlKey || e.metaKey) && k === 'f') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); backupNow(); }
  if ((e.ctrlKey || e.metaKey) && k === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && k === 'y' && !typing) { e.preventDefault(); redo(); }
  if (libOn && !typing && !e.ctrlKey) { const st = 80;
    if (k === 'arrowleft') { VIEW.px += st; applyView(); } if (k === 'arrowright') { VIEW.px -= st; applyView(); }
    if (k === 'arrowup') { VIEW.py += st; applyView(); } if (k === 'arrowdown') { VIEW.py -= st; applyView(); }
    if (k === '+' || k === '=') zoomAt(1.2); if (k === '-') zoomAt(1 / 1.2); }
  if ((e.key === 'Delete') && SEL.size && !typing && !$('#modal').classList.contains('on')) { e.preventDefault(); return deleteBooks([...SEL], 'Suppression de la sélection'); }
  if ($('#drawer').classList.contains('on') && !typing && !$('#modal').classList.contains('on') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && NAV.cur) { e.preventDefault(); return goNav(e.key === 'ArrowRight' ? 1 : -1); }
  if (e.key === 'Escape' && libOn && VIEW.z > 1.05 && !CAM.sel && !SEL.size) { applyView('reset'); return; }
  if (e.key === 'Escape') { if (CAM.sel && libOn) { CAM.sel = false; SEL.clear(); return renderRoom(); } if ($('#editor').classList.contains('on')) return $('#editor').classList.remove('on'); if (SEL.size && libOn) { SEL.clear(); return renderRoom(); } closeDrawer(); closeModal(); }
});
window.addEventListener('beforeunload', e => { if (BG.running) { e.preventDefault(); e.returnValue = ''; } });
(async () => {
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, {once: true})); // V2.26 : tous les fichiers js/ sont chargés
  await DB.open(); await migrateImgs26(); await load(); purgeTrash(); setTimeout(gcImgs26, 15000); rt = activeTheme(); applyTheme(); renderAll(); renderRoom(true); if (window.syncBoot) setTimeout(syncBoot, 600);
  const persisted = await askPersist25(); // V2.25 : demande ET vérifie le stockage protégé
  const late = books.filter(isLate), last = localStorage.getItem('scanly_lastsave');
  if (!cfg.key) setTimeout(() => toast('Bienvenue dans SCANLY ! Commence par saisir ta clé Gemini (Paramètres).', 5000), 700);
  else if (late.length) setTimeout(() => toast(`${late.length} prêt(s) en retard : ${late.slice(0, 3).map(b => `« ${b.title} » (${b.loanTo || '?'})`).join(', ')} – voir le Tableau de bord`, 8000), 900);
  else if (books.length && (!last || Date.now() - new Date(last) > (persisted ? 14 : 7) * 864e5)) setTimeout(() => toast(persisted ? 'Pense à enregistrer une sauvegarde de ta bibliothèque (Ctrl+S)' : 'Stockage non protégé par le navigateur : enregistre une sauvegarde de ta bibliothèque (Paramètres › Sauvegarde et exports)', persisted ? 5000 : 8000), 900);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) registerSW30();
})();

/* =====================================================================
   V1.6 – CODE-BARRES / ISBN : lecture + mise à jour automatique de la fiche
   ===================================================================== */
const cleanIsbn = s => String(s || '').toUpperCase().replace(/[^0-9X]/g, '');
function isbnValid(s) {
  const d = cleanIsbn(s);
  if (/^\d{13}$/.test(d)) return [...d].reduce((t, c, i) => t + (+c) * (i % 2 ? 3 : 1), 0) % 10 === 0;
  if (/^\d{9}[\dX]$/.test(d)) return [...d].reduce((t, c, i) => t + (c === 'X' ? 10 : +c) * (10 - i), 0) % 11 === 0;
  return false;
}
async function olByIsbn(isbn, options = {}) {
  try { const key='ISBN:'+isbn,key13='ISBN:'+SCANLY_SOURCES.isbn13(isbn),d=await SCANLY_SOURCES.request('https://openlibrary.org/api/books?'+new URLSearchParams({bibkeys:key===key13?key:key+','+key13,format:'json',jscmd:'data'}),'json',options),e=d[key]||d[key13];if(!e)return null;
    const year=String(e.publish_date||'').match(/\b(1[5-9]\d{2}|20\d{2})\b/);
    return {title:e.title,subtitle:e.subtitle,author_name:(e.authors||[]).map(a=>a.name),publisher:(e.publishers||[]).map(a=>a.name),publish_year:year?[+year[0]]:[],number_of_pages_median:e.number_of_pages,description:(e.excerpts||[]).map(x=>x.text||'').filter(Boolean).join(' '),coverUrl:e.cover?.medium||e.cover?.large||e.cover?.small};
  } catch(e){options.onError?.('Open Library : '+e.message);return null;}
}

/* Recherche complète à partir d'un ISBN : Google Books + Open Library + IA */
async function isbnLookup(isbn, onStep, options = {}) {
  isbn = cleanIsbn(isbn);const errors=[];options={...options,onError:e=>errors.push(e)};
  onStep && onStep('Google Books…');
  const [gb, ol] = await Promise.all([gBooks('isbn:' + isbn, 5,options), olByIsbn(isbn,options)]);
  const it = gb[0], v = it?.volumeInfo || {}, s = it?.saleInfo || {};
  const r = {isbn, sources: []};
  if (it) { r.sources.push('Google Books');
    Object.assign(r, {title: v.title, subtitle: v.subtitle, author: (v.authors || []).join(', '), publisher: v.publisher, year: v.publishedDate ? parseInt(v.publishedDate) : null,
      pages: v.pageCount, description: v.description, genre: (v.categories || [])[0],
      cover: (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '').replace('http://', 'https://').replace('&edge=curl', '') || null});
    const p = s.listPrice || s.retailPrice; if (p && p.currencyCode === 'EUR') { r.price = p.amount; r.priceSource = 'Google Books'; } }
  if (ol) { r.sources.push('Open Library');
    r.title = r.title || ol.title; r.author = r.author || (ol.author_name || []).join(', '); r.publisher = r.publisher || (ol.publisher || [])[0];
    r.year = r.year || ol.first_publish_year || (ol.publish_year || [])[0]; r.pages = r.pages || ol.number_of_pages_median;r.description=r.description||ol.description;
    if (!r.cover && ol.coverUrl) r.cover = ol.coverUrl; }
  onStep && onStep('BnF…');
  if((localStorage.getItem('scanly_bnf_auto')!=='0'||options.force)&&(!r.title||!r.author||!r.publisher||!r.year)){try{const notices=await SCANLY_SOURCES.lookup({isbn:SCANLY_SOURCES.isbn13(isbn)},options),notice=notices.find(n=>SCANLY_SOURCES.exact({isbn},n));if(notice){if(SCANLY_SOURCES.fill(r,notice).length)r.sources.push('BnF');}}catch(e){r.bnfError=e.message;errors.push('BnF : '+e.message);}}
  if (cfg.key && options.useAI===true) {
    onStep && onStep('Analyse IA…');
    const hint = r.title ? `Données trouvées : ${JSON.stringify({titre: r.title, sous_titre: r.subtitle, auteur: r.author, editeur: r.publisher, annee: r.year, pages: r.pages})}` : 'Aucune donnée trouvée dans les bases en ligne.';
    try {
      const o = await gemini([{text: `Identifie l'ouvrage correspondant à l'ISBN ${isbn} (marché français en priorité). ${hint}
Complète et corrige. Pour une BD, un manga ou un roman en plusieurs tomes, indique la série et le numéro de tome. Mets null si tu n'es pas sûr ; n'invente rien.
JSON : {"titre":"…","auteur":"Prénom Nom","serie":"… ou null","tome":nombre ou null,"editeur":"…","annee":nombre,"pages":nombre,"type":"un parmi ${TYPES.join(', ')}","genre":"genre court","prix_eur":prix indicatif neuf,"resume":"1 à 2 phrases sans spoiler","confiance":0.0}`}], {json: true, think: 'low', timeout: 90000});
      r.sources.push('IA'); r.aiConf = Number(o.confiance) || 0;
      const trustAI = !r.title || r.aiConf >= .6;
      if (!r.title && o.titre && trustAI) r.title = o.titre;
      if (!r.author && o.auteur && trustAI) r.author = o.auteur;
      if (!r.publisher && o.editeur) r.publisher = o.editeur;
      if (!r.year && o.annee) r.year = parseInt(o.annee) || null;
      if (!r.pages && o.pages) r.pages = parseInt(o.pages) || null;
      if (o.serie && trustAI) { r.series = o.serie; r.volume = parseInt(o.tome) || null; }
      if (TYPES.includes(o.type)) r.type = o.type;
      if (o.genre) r.genre = o.genre;
      if (r.price == null && o.prix_eur) { r.price = Number(o.prix_eur); r.priceSource = 'Estimation IA'; }
      if (!r.description && o.resume) r.description = o.resume;
    } catch (e) { toast('IA : ' + e.message, 4000); }
  }
  r.errors=errors;r.found = !!r.title;
  return r;
}
const META_FIELDS = {title: 'titre', author: 'auteur', series: 'série', volume: 'tome', publisher: 'éditeur', year: 'année', pages: 'pages', isbn: 'ISBN', type: 'type', genre: 'genre', price: 'prix', cover: 'couverture', description: 'résumé'};
/* Les informations bibliographiques sont remplacées ; emplacement, statut, note, prêt, notes et photo de tranche sont conservés */
function applyIsbn(b, r) {
  const changed = [];
  for (const k of Object.keys(META_FIELDS)) { if(k==='cover'&&b.coverManual)continue; const v = r[k]; if (v == null || v === '') continue; if (String(b[k] ?? '') !== String(v)) { b[k] = v; changed.push(META_FIELDS[k]); } }
  if (r.price != null) b.priceSource = r.priceSource;
  if(r.bnfRef)b.bnfRef=r.bnfRef;
  if (b.title) b.unknown = false;
  return changed;
}

/* Fenêtre de lecture du code-barres : webcam (détection auto ou lecture IA), photo, ou saisie */
function openBarcode(onCode, title = 'Scanner le code-barres ISBN') {
  openModal(`<div class="dhead"><h3>${esc(title)}</h3><button class="x" data-close>×</button></div><div class="mbody">
    <div class="camwrap" style="aspect-ratio:16/9"><video id="bcVid" autoplay playsinline muted></video><div class="camframe" style="inset:22% 14%"><i></i><i></i><i></i><i></i></div>
      <div class="camoff" id="bcOff">${I('isbn')}<div>Activation de la caméra…</div></div></div>
    <div class="btns"><button class="btn p" id="bcRead">Lire le code (IA)</button><label class="btn s" style="cursor:pointer">${I('img')} Photo du code-barres<input type="file" id="bcFile" accept="image/*" hidden></label><span class="hint" id="bcMsg" style="align-self:center">Présente le code-barres (au dos du livre) dans le cadre…</span></div>
    <label class="l" style="margin-top:14px">Ou saisis l'ISBN</label>
    <div style="display:flex;gap:8px"><input class="fld" id="bcIn" placeholder="978…"><button class="btn g" id="bcOk">Valider</button></div></div>`, 'sm');
  let done = false;
  const found = code => { const c = cleanIsbn(code); if (done) return; if (c.length !== 10 && c.length !== 13) { $('#bcMsg').textContent = 'Code incomplet : réessaie.'; return; }
    if (!isbnValid(c) && !confirm(`Le code ${c} semble incorrect (clé de contrôle). Continuer quand même ?`)) return;
    done = true; closeModal(); onCode(c); };
  const readImg = async src => { $('#bcMsg').innerHTML = '<span class="spin"></span> Lecture du code…';
    try { const o = await gemini([{text: 'Lis le code-barres EAN-13 / ISBN visible sur cette image (chiffres imprimés sous le code-barres, ou mention ISBN). Réponds en JSON {"isbn":"chiffres uniquement, ou null"}.'}, {inlineData: {mimeType: 'image/jpeg', data: src.split(',')[1]}}], {json: true});
      const n = cleanIsbn(o.isbn); if (n.length >= 10) found(n); else $('#bcMsg').textContent = 'Code non lu : rapproche le livre, évite les reflets et réessaie.';
    } catch (e) { $('#bcMsg').textContent = e.message; } };
  $('#bcOk').onclick = () => found($('#bcIn').value); $('#bcIn').onkeydown = e => e.key === 'Enter' && found($('#bcIn').value);
  $('#bcRead').onclick = () => { const v = $('#bcVid'); if (!v || !v.videoWidth) return toast('Caméra non disponible : utilise une photo ou la saisie'); readImg(resize(v, 1280, .92)); };
  $('#bcFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; const u = URL.createObjectURL(f), img = await srcToImg(u); URL.revokeObjectURL(u);
    if ('BarcodeDetector' in window) { try { const r = await new window.BarcodeDetector({formats: ['ean_13', 'ean_8', 'upc_a']}).detect(img); if (r[0]) return found(r[0].rawValue); } catch (er) {} }
    readImg(resize(img, 1600, .92)); };
  (async () => {
    try { stopCam(); stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false}); if (!$('#bcVid')) return stopCam(); $('#bcVid').srcObject = stream; $('#bcOff').style.display = 'none'; }
    catch (e) { $('#bcOff').innerHTML = `${I('isbn')}<div>Caméra indisponible (${e.name === 'NotAllowedError' ? 'autorisation refusée' : 'aucune webcam'}).<br>Utilise une photo du code-barres ou la saisie.</div>`; return; }
    let det = null;
    if ('BarcodeDetector' in window) { try { const fm = await window.BarcodeDetector.getSupportedFormats(); if (fm.includes('ean_13')) det = new window.BarcodeDetector({formats: ['ean_13', 'ean_8', 'upc_a']}); } catch (e) {} }
    $('#bcMsg').textContent = det ? 'Détection automatique en cours… (ou « Lire le code »)' : 'Clique sur « Lire le code » quand le code-barres est net.';
    if (det) { const loop = async () => { if (done || !stream || !$('#bcVid')) return; try { const r = await det.detect($('#bcVid')); const c = r.find(x => /^97[89]\d{10}$/.test(x.rawValue)) || r[0]; if (c) return found(c.rawValue); } catch (e) {} setTimeout(loop, 300); }; loop(); }
  })();
}
/* Création d'un livre à partir d'un ISBN (bouton Ajouter un livre) */
async function newFromIsbn(isbn) {
  const dup = books.find(x => x.isbn && cleanIsbn(x.isbn) === cleanIsbn(isbn) && !x.wish); if (dup) toast(`Tu possèdes déjà ce livre (${locOf(dup)})`, 5000);
  toast('Recherche de l\'ISBN ' + isbn + '…', 6000);
  const r = await isbnLookup(isbn, s => toast('Recherche de l\'ISBN ' + isbn + ' : ' + s, 6000));
  const b = newBook({caseId: defaultCase()}); applyIsbn(b, r); b.isbn = isbn; if (!r.found) toast('ISBN introuvable : complète la fiche à la main', 5000);
  closeModal(); openBook(b, true);
}

/* =====================================================================
   V1.6 – SUPPRESSION GROUPÉE + CORBEILLE (restaurable)
   ===================================================================== */
async function deleteBooks(ids, label, ask = true) {
  const set = new Set(ids), L = books.filter(b => set.has(b.id)); if (!L.length) return false;
  if (ask && !confirm(L.length === 1 ? `Supprimer « ${dispTitle(L[0])} » ?\nIl ira dans la corbeille (restaurable).` : `Supprimer ${L.length} livres ?\nIls iront dans la corbeille (restaurables depuis Paramètres › Corbeille).`)) return false;
  if(!await safetyPoint18('Avant suppression de livres'))return false;
  const batch = 'del_' + uid(), now = Date.now();
  await DB.putMany('trash', L.map(b => ({...b, trashBatch: batch, deletedAt: now, trashLabel: label || `${L.length} livre(s)`})));
  await DB.delMany('books', [...set]); books = books.filter(b => !set.has(b.id)); L.forEach(b => SEL.delete(b.id));
  renderAll(); showUndo(`${L.length} livre${L.length > 1 ? 's' : ''} supprimé${L.length > 1 ? 's' : ''}`, () => restoreTrash(batch));
  return true;
}
async function restoreTrash(batch) {
  const T = (await DB.all('trash')).filter(t => !batch || t.trashBatch === batch); if (!T.length) return toast('Rien à restaurer');
  const back = T.map(t => { const b = {...t}; ['trashBatch', 'deletedAt', 'trashLabel'].forEach(k => delete b[k]); if (b.caseId && !cases.some(c => c.id === b.caseId)) b.caseId = null; return b; });
  await DB.putMany('books', back); await DB.delMany('trash', T.map(t => t.id));
  books = books.filter(b => !back.some(x => x.id === b.id)).concat(back); renderAll(); toast(`${back.length} livre(s) restauré(s)`);
}
async function purgeTrash() { const old = (await DB.all('trash')).filter(t => Date.now() - t.deletedAt > 30 * 864e5); if (old.length) await DB.delMany('trash', old.map(t => t.id)); }
async function trashHTML() {
  const T = await DB.all('trash'), g = new Map(); T.forEach(t => { if (!g.has(t.trashBatch)) g.set(t.trashBatch, []); g.get(t.trashBatch).push(t); });
  if (!T.length) return '<p class="hint">La corbeille est vide. Les livres supprimés y restent 30 jours.</p>';
  return `<table class="mini">${[...g.entries()].sort((a, b) => b[1][0].deletedAt - a[1][0].deletedAt).map(([k, L]) => `<tr><td>${new Date(L[0].deletedAt).toLocaleString('fr-FR', {dateStyle: 'short', timeStyle: 'short'})}</td><td><b>${L.length}</b> livre(s)</td><td class="hint">${esc(L.slice(0, 3).map(dispTitle).join(', '))}${L.length > 3 ? '…' : ''}</td><td style="text-align:right"><button class="btn s sm" data-rest="${k}">Restaurer</button></td></tr>`).join('')}</table>
    <div class="btns"><button class="btn s sm" data-rest="__all">Tout restaurer (${T.length})</button><button class="btn k sm" id="trEmpty">Vider la corbeille</button></div><p class="hint">Les livres supprimés restent 30 jours dans la corbeille.</p>`;
}

/* Sélection : barre du bas de la Liste */
function renderListBar() {
  const bar = $('#listBar'); if (!bar) return; const vis = visible(), nv = vis.filter(b => SEL.has(b.id)).length;
  bar.innerHTML = `<div class="lbar"><label class="hint" style="display:flex;gap:6px;align-items:center;color:var(--navy)"><input type="checkbox" id="lbAll" ${vis.length && nv === vis.length ? 'checked' : ''}> Tout cocher (${vis.length} affiché${vis.length > 1 ? 's' : ''})</label>
    <span class="hint">Astuce : filtre d'abord (type, statut, recherche…) puis coche tout.</span><span class="tsp"></span>
    ${SEL.size ? `<b>${SEL.size} coché${SEL.size > 1 ? 's' : ''}</b><span class="hint">Déplacer vers</span><select id="lbCase" class="tsel">${caseOptions(cases.some(c => c.id === curCase) ? curCase : '')}</select><span class="hint">étagère</span><input id="lbRow" type="number" min="1" max="15" value="1" class="tsel" style="width:60px">
    <button class="btn g sm" id="lbMove">Déplacer</button><button class="btn k sm" id="lbDel">Supprimer (${SEL.size})</button><button class="btn s sm" id="lbClr">Décocher</button>` : ''}</div>`;
  $('#lbAll').onchange = e => { vis.forEach(b => e.target.checked ? SEL.add(b.id) : SEL.delete(b.id)); renderList(); renderSelBar(); };
  if ($('#lbDel')) { $('#lbDel').onclick = () => deleteBooks([...SEL], `Suppression depuis la liste`);
    $('#lbMove').onclick = async () => { if (await moveBooks([...SEL], $('#lbCase').value, Math.max(1, parseInt($('#lbRow').value) || 1), `Déplacement de ${SEL.size} livre(s)`)) { SEL.clear(); renderAll(); } };
    $('#lbClr').onclick = () => { SEL.clear(); renderAll(); }; }
}

/* =====================================================================
   V1.7 – DÉTOURAGE PRÉCIS ET REDRESSEMENT DES TRANCHES
   1. l'IA donne un cadre approximatif (et si possible les 4 coins) ;
   2. SCANLY mesure l'inclinaison réelle du livre (bords verticaux) ;
   3. il cherche les vrais bords gauche/droite/haut/bas (contours) ;
   4. il redresse la tranche (correction de perspective) : image verticale.
   ===================================================================== */
const DEG = Math.PI / 180;
function solveH(src, dst) { // homographie src -> dst (4 points)
  const A = [], B = [];
  for (let i = 0; i < 4; i++) { const [u, v] = src[i], [x, y] = dst[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); B.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); B.push(y); }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    const d = A[c][c] || 1e-12;
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / d; if (!f) continue; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
  }
  const h = B.map((b, i) => b / (A[i][i] || 1e-12)); h.push(1); return h;
}
function grayOf(cv) {
  const d = cv.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, cv.width, cv.height).data, g = new Float32Array(cv.width * cv.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; return g;
}
function sobel(g, w, h) {
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x;
    gx[i] = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - 1] + g[i + w - 1]);
    gy[i] = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - w] + g[i - w + 1]); }
  return {gx, gy};
}
/* Inclinaison dominante (degrés) des bords verticaux : >0 = le bas du livre part vers la droite */
function estimateTilt(gx, gy, w, h, x0, x1, y0, y1, hint) {
  const lo = hint == null ? -25 : Math.max(-25, hint - 8), hi = hint == null ? 25 : Math.min(25, hint + 8), N = Math.round((hi - lo) / .5) + 1, H = new Float64Array(N);
  let tot = 0;
  for (let y = Math.max(1, y0 | 0); y < Math.min(h - 1, y1); y += 1) for (let x = Math.max(1, x0 | 0); x < Math.min(w - 1, x1); x += 1) {
    const i = y * w + x, ax = Math.abs(gx[i]), ay = Math.abs(gy[i]); if (ax < 60 || ax < 2 * ay) continue;
    const t = Math.atan(-gy[i] / gx[i]) / DEG; if (t < lo || t > hi) continue; const k = Math.round((t - lo) / .5); H[k] += ax; tot += ax; }
  if (tot < 2000) return hint ?? 0;
  let best = 0, bv = -1;
  for (let k = 0; k < N; k++) { const v = (H[k - 2] || 0) + 2 * (H[k - 1] || 0) + 3 * H[k] + 2 * (H[k + 1] || 0) + (H[k + 2] || 0); if (v > bv) { bv = v; best = k; } }
  return lo + best * .5;
}
function domColor(d, w, h) {
  const bins = new Map(), x0 = Math.floor(w * .15), x1 = Math.ceil(w * .85), y0 = Math.floor(h * .06), y1 = Math.ceil(h * .94);
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * w + x) * 4, key = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4);
    const e = bins.get(key) || [0, 0, 0, 0]; e[0]++; e[1] += d[i]; e[2] += d[i + 1]; e[3] += d[i + 2]; bins.set(key, e); }
  let best = [1, 128, 128, 128]; bins.forEach(e => { if (e[0] > best[0]) best = e; });
  return '#' + [1, 2, 3].map(j => Math.round(best[j] / best[0]).toString(16).padStart(2, '0')).join('');
}
const imgW = img => img.naturalWidth || img.videoWidth || img.width, imgH = img => img.naturalHeight || img.videoHeight || img.height;
/* Cherche le quadrilatère exact de la tranche autour d'un cadre approximatif B {x0,y0,x1,y1} (pixels) */
function autoQuad(img, B, tHint = null) { try { return autoQuad20(img, B, tHint); } catch (e) { console.warn('SCANLY V2.20 détourage', e); return autoQuadV1(img, B, tHint); } }
function autoQuadV1(img, B, tHint = null) {
  const IW = imgW(img), IH = imgH(img), bw = Math.max(2, B.x1 - B.x0), bh = Math.max(4, B.y1 - B.y0);
  const mx = .35 * bw + .06 * bh, my = .08 * bh;
  const rx0 = clamp(B.x0 - mx, 0, IW), rx1 = clamp(B.x1 + mx, 0, IW), ry0 = clamp(B.y0 - my, 0, IH), ry1 = clamp(B.y1 + my, 0, IH);
  const k = Math.min(2.5, 380 / Math.max(1, ry1 - ry0)), w = Math.max(8, Math.round((rx1 - rx0) * k)), h = Math.max(8, Math.round((ry1 - ry0) * k));
  const C0 = document.createElement('canvas'); C0.width = w; C0.height = h; C0.getContext('2d').drawImage(img, rx0, ry0, rx1 - rx0, ry1 - ry0, 0, 0, w, h);
  const bx0 = (B.x0 - rx0) * k, bx1 = (B.x1 - rx0) * k, by0 = (B.y0 - ry0) * k, by1 = (B.y1 - ry0) * k, bwk = bx1 - bx0, bhk = by1 - by0;
  const S0 = sobel(grayOf(C0), w, h);
  const t = estimateTilt(S0.gx, S0.gy, w, h, bx0 - .3 * bwk, bx1 + .3 * bwk, by0 + .1 * bhk, by1 - .1 * bhk, tHint);
  const tr = t * DEG, cs = Math.cos(tr), sn = Math.sin(tr), cx = w / 2, cy = h / 2;
  const rot = (p, s) => [cs * (p[0] - cx) - s * sn * (p[1] - cy) + cx, s * sn * (p[0] - cx) + cs * (p[1] - cy) + cy]; // s=+1 : C0->C1 ; s=-1 : C1->C0
  const C1 = document.createElement('canvas'); C1.width = w; C1.height = h; const c1 = C1.getContext('2d'); c1.translate(cx, cy); c1.rotate(tr); c1.drawImage(C0, -cx, -cy);
  const {gx, gy} = sobel(grayOf(C1), w, h);
  const bc = rot([(bx0 + bx1) / 2, (by0 + by1) / 2], 1), as = Math.abs(sn);
  const wT = Math.max(.35 * bwk, (bwk - bhk * as) / Math.max(.5, cs)), hT = Math.max(.6 * bhk, (bhk - wT * as) / Math.max(.5, cs));
  // bords gauche / droit : profil des contours verticaux
  const ya = clamp(Math.round(bc[1] - .38 * hT), 1, h - 2), yb = clamp(Math.round(bc[1] + .38 * hT), 2, h - 1), P = new Float64Array(w);
  for (let y = ya; y < yb; y++) for (let x = 1; x < w - 1; x++) P[x] += Math.abs(gx[y * w + x]);
  const pick = (A, e, lo, hi, win) => { let best = e, bv = -1; for (let x = Math.max(1, Math.round(lo)); x <= Math.min(A.length - 2, Math.round(hi)); x++) {
    const v = (A[x - 1] + 2 * A[x] + A[x + 1]) * (1 - .45 * Math.abs(x - e) / win); if (v > bv) { bv = v; best = x; } } return best; };
  const eL = bc[0] - wT / 2, eR = bc[0] + wT / 2, win = Math.max(4, .35 * wT);
  let L = pick(P, eL, eL - win, Math.min(eL + win, bc[0] - .2 * wT), win), R = pick(P, eR, Math.max(eR - win, bc[0] + .2 * wT), eR + win, win);
  if (R - L < .45 * wT || R - L > 1.7 * wT) { L = eL; R = eR; }
  // bords haut / bas : profil des contours horizontaux dans la tranche
  const xa = clamp(Math.round(L + .15 * (R - L)), 1, w - 2), xb = clamp(Math.round(R - .15 * (R - L)), xa + 1, w - 1), Q = new Float64Array(h);
  for (let y = 1; y < h - 1; y++) for (let x = xa; x < xb; x++) Q[y] += Math.abs(gy[y * w + x]);
  const eT = bc[1] - hT / 2, eB = bc[1] + hT / 2, wy = Math.max(4, .16 * hT);
  let T = pick(Q, eT, eT - wy, eT + wy, wy), Bt = pick(Q, eB, eB - wy, eB + .5 * wy, wy);
  if (Bt - T < .7 * hT || Bt - T > 1.3 * hT) { T = eT; Bt = eB; }
  const dx = .025 * (R - L) + .5, dy = .004 * (Bt - T);
  const quad = [[L + dx, T + dy], [R - dx, T + dy], [R - dx, Bt - dy], [L + dx, Bt - dy]].map(p => { const q = rot(p, -1); return [rx0 + q[0] / k, ry0 + q[1] / k]; });
  return {quad, tilt: t};
}
/* Redresse le quadrilatère (pixels) en une tranche verticale */
function extractQuad(img, Q, maxH = 340) {
  const IW = imgW(img), IH = imgH(img), dd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const hpx = (dd(Q[0], Q[3]) + dd(Q[1], Q[2])) / 2, wpx = (dd(Q[0], Q[1]) + dd(Q[3], Q[2])) / 2;
  const oh = Math.round(clamp(hpx, 40, maxH)), ow = Math.max(3, Math.round(wpx * oh / Math.max(1, hpx)));
  const xs = Q.map(p => p[0]), ys = Q.map(p => p[1]);
  const sx0 = clamp(Math.floor(Math.min(...xs)) - 2, 0, IW - 1), sy0 = clamp(Math.floor(Math.min(...ys)) - 2, 0, IH - 1);
  const sx1 = clamp(Math.ceil(Math.max(...xs)) + 2, sx0 + 1, IW), sy1 = clamp(Math.ceil(Math.max(...ys)) + 2, sy0 + 1, IH);
  const f = Math.min(1, 1.6 * oh / Math.max(1, hpx)), sw = Math.max(1, Math.round((sx1 - sx0) * f)), sh = Math.max(1, Math.round((sy1 - sy0) * f));
  const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh; const sx = sc.getContext('2d', {willReadFrequently: true}); sx.imageSmoothingQuality = 'high';
  sx.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, 0, 0, sw, sh); const sd = sx.getImageData(0, 0, sw, sh).data;
  const Hm = solveH([[0, 0], [ow, 0], [ow, oh], [0, oh]], Q.map(p => [(p[0] - sx0) * f, (p[1] - sy0) * f]));
  const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh; const ox = oc.getContext('2d'), od = ox.createImageData(ow, oh), o = od.data;
  for (let v = 0; v < oh; v++) for (let u = 0; u < ow; u++) {
    const uu = u + .5, vv = v + .5, z = Hm[6] * uu + Hm[7] * vv + 1, X = (Hm[0] * uu + Hm[1] * vv + Hm[2]) / z - .5, Y = (Hm[3] * uu + Hm[4] * vv + Hm[5]) / z - .5;
    const x0 = clamp(Math.floor(X), 0, sw - 1), y0 = clamp(Math.floor(Y), 0, sh - 1), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), ax = clamp(X - x0, 0, 1), ay = clamp(Y - y0, 0, 1);
    const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4, j = (v * ow + u) * 4;
    for (let c = 0; c < 3; c++) o[j + c] = (sd[i00 + c] * (1 - ax) + sd[i10 + c] * ax) * (1 - ay) + (sd[i01 + c] * (1 - ax) + sd[i11 + c] * ax) * ay;
    o[j + 3] = 255; }
  ox.putImageData(od, 0, 0);
  return {crop: oc.toDataURL('image/jpeg', .86), color: domColor(o, ow, oh), wpx, hpx};
}
const quadNorm = (Q, img) => Q.map(p => [+(p[0] / imgW(img)).toFixed(5), +(p[1] / imgH(img)).toFixed(5)]);
const quadPx = (q, img) => q.map(p => [p[0] * imgW(img), p[1] * imgH(img)]);
const quadBox = Q => ({x0: Math.min(...Q.map(p => p[0])), y0: Math.min(...Q.map(p => p[1])), x1: Math.max(...Q.map(p => p[0])), y1: Math.max(...Q.map(p => p[1]))});
/* Détection d'un livre pendant le scan : cadre IA (+ coins IA) -> détourage précis + redressement */
function spineFromDetection(img, box, coins) {
  const IW = imgW(img), IH = imgH(img);
  let B = {x0: box[1] / 1000 * IW, y0: box[0] / 1000 * IH, x1: box[3] / 1000 * IW, y1: box[2] / 1000 * IH}, tHint = null;
  if (Array.isArray(coins) && coins.length === 4 && coins.every(c => Array.isArray(c) && c.length === 2 && c.every(isFinite))) {
    const P = coins.map(c => [clamp(+c[0], 0, 1000) / 1000 * IW, clamp(+c[1], 0, 1000) / 1000 * IH]), qb = quadBox(P);
    const ov = Math.max(0, Math.min(qb.x1, B.x1) - Math.max(qb.x0, B.x0)) * Math.max(0, Math.min(qb.y1, B.y1) - Math.max(qb.y0, B.y0));
    if (ov > .5 * (B.x1 - B.x0) * (B.y1 - B.y0)) { // coins cohérents avec le cadre
      const dy = ((P[3][1] - P[0][1]) + (P[2][1] - P[1][1])) / 2, dx = ((P[3][0] - P[0][0]) + (P[2][0] - P[1][0])) / 2;
      if (dy > 0) tHint = clamp(Math.atan(dx / dy) / DEG, -25, 25); }
  }
  const q = autoQuad(img, B, tHint), sp = extractQuad(img, q.quad);
  return {...sp, quad: quadNorm(q.quad, img), tilt: q.tilt};
}
/* Redressement d'une tranche déjà enregistrée (anciens imports : on repart de la découpe d'origine) */
async function restraighten(b) {
  if (!b.spineImg) return false;
  const imp = b.srcRef?.imp ? imports.find(i => i.id === b.srcRef.imp) : null, hd = imp?.hd?.[b.srcRef.pi];
  let img, B;
  if (hd && b.quad) { img = await srcToImg(hd); B = quadBox(quadPx(b.quad, img)); }
  else { if (!b.spineOrig) b.spineOrig = b.spineImg; img = await srcToImg(b.spineOrig); B = {x0: 0, y0: 0, x1: imgW(img), y1: imgH(img)}; b.srcRef = {orig: true}; }
  const q = autoQuad(img, B), sp = extractQuad(img, q.quad);
  applySpine(b, sp, quadNorm(q.quad, img)); return true;
}
/* V2.24 : taille après un recadrage.
   Avant : hauteur et largeur recalculées en comparant la nouvelle découpe à l'échelle de la photo
   du scan (pxMed). Or un recadrage se fait souvent sur la tranche déjà découpée ou sur la photo HD,
   dont l'échelle est différente : le tome devenait plus petit (ou énorme).
   Désormais : la HAUTEUR est conservée (ou prise sur les autres tomes de la série) et seule
   l'ÉPAISSEUR est déduite des proportions de la nouvelle découpe, avec des limites réalistes. */
function seriesPeers24(b) { const k = norm(b.series || ''); return k ? books.filter(o => o !== b && o.id !== b.id && !o.wish && norm(o.series || '') === k) : []; }
const median24 = a => { const v = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
function seriesSize24(b) { const P = seriesPeers24(b), d = P.map(o => bookDims(o)); if (!P.length) return null; return {h: median24(d.map(x => x.h)), w: median24(d.map(x => x.w)), n: P.length}; }
function maxThick24(h, b) { return Math.round(h * (['BD', 'Comics', 'Beau livre'].includes(b.type) || b.height === 'grande' ? .22 : .34)); }
function applySpine(b, sp, qn) {
  if(!b.previousSpine18||b.previousSpine18.spineImg!==b.spineImg)preserveSpine18(b);
  const before = bookDims(b), ser = seriesSize24(b);
  b.quad = qn; b.spineImg = sp.crop; b.color = sp.color;
  const h = Math.round(clamp(ser ? ser.h : before.h, 90, 300)), ratio = sp.wpx / Math.max(1, sp.hpx);
  b.hU = h; b.wU = Math.round(clamp(h * ratio, 6, Math.max(8, maxThick24(h, b))));
}
async function restraightenMany(list, btn) {
  if(!await safetyPoint18('Avant redressement groupé'))return;
  const L = list.filter(b => b.spineImg); if (!L.length) return toast('Aucune tranche photographiée à redresser');
  let n = 0; const lbl = btn ? btn.innerHTML : '';
  for (const b of L) { try { if (await restraighten(b)) { await DB.put('books', b); n++; } } catch (e) { console.warn(e); }
    if (btn) btn.innerHTML = `<span class="spin"></span> ${n}/${L.length}`; if (n % 8 === 0) await sleep(0); }
  if (btn) btn.innerHTML = lbl; renderAll(); toast(`${n} tranche(s) redressée(s) et re-détourée(s). Ajuste un livre à la main depuis sa fiche si besoin.`, 6000);
}

/* ----- Éditeur de détourage V2.20 : zoom, loupe, réglage au pixel près + aperçu redressé ----- */
async function openQuadEditor({src, quad, title = 'Ajuster le détourage', onSave, toolBook = null}) {
  const img = await srcToImg(src), IW = imgW(img), IH = imgH(img);
  let Q = quad ? quadPx(quad, img) : [[0, 0], [IW, 0], [IW, IH], [0, IH]];
  const originalQ = JSON.stringify(Q);
  const bb = quadBox(Q), bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
  const R = {x0: clamp(bb.x0 - Math.max(.8 * bw, .12 * bh), 0, IW), y0: clamp(bb.y0 - .1 * bh, 0, IH), x1: clamp(bb.x1 + Math.max(.8 * bw, .12 * bh), 0, IW), y1: clamp(bb.y1 + .1 * bh, 0, IH)};
  openModal(`<div class="dhead"><h3>${esc(title)}</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint" style="margin-top:0">Fais glisser les 4 coins dorés sur les bords réels de la tranche (y compris si le livre penche). Les carrés au milieu des côtés déplacent un bord entier ; glisser à l'intérieur déplace tout le cadre. Pour un réglage fin : zoome (＋, pincer ou molette), une loupe apparaît pendant le déplacement ; touche un coin puis utilise les flèches pour l'ajuster au pixel près. L'aperçu montre la tranche redressée, telle qu'elle apparaîtra sur l'étagère.</p>
    <div class="fe20-wrap"><div class="fe20-area" id="qeArea"></div><div class="fe20-side"><div class="hint">Aperçu redressé</div><img id="qePrev" alt=""></div></div>
    ${fineToolbar20()}
    <div class="btns"><button class="btn s" id="qeAuto">Détection automatique</button><button class="btn s" id="qeStraight">Rectangle droit</button><span class="tsp"></span><button class="btn s" data-close>Annuler</button><button class="btn g" id="qeOk">Appliquer</button></div></div>`);
  let pt = 0;
  const preview = () => { clearTimeout(pt); pt = setTimeout(() => { try { if ($('#qePrev')) $('#qePrev').src = extractQuad(img, Q).crop; } catch (e) {} }, 70); };
  const ed = fineEditor20({area: $('#qeArea'), source: img, Q, onChange: q => { Q = q; preview(); }});
  bindFineToolbar20($('#mbox'), ed, () => R);
  ed.fit(R); preview();
  $('#qeAuto').onclick = () => { const b = quadBox(Q), dy = ((Q[3][1] - Q[0][1]) + (Q[2][1] - Q[1][1])) / 2, dx = ((Q[3][0] - Q[0][0]) + (Q[2][0] - Q[1][0])) / 2; Q = autoQuad(img, b, dy > 0 ? clamp(Math.atan(dx / dy) / DEG, -25, 25) : null).quad; ed.setQ(Q); preview(); };
  $('#qeStraight').onclick = () => { const b = quadBox(Q); Q = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]; ed.setQ(Q); preview(); };
  const guard = () => JSON.stringify(Q) === originalQ || confirm('Le détourage non enregistré sera abandonné. Continuer ?'); modalLeaveGuard = guard;
  const prevCleanup = modalExtraCleanup; modalExtraCleanup = () => { prevCleanup?.(); ed.destroy(); clearTimeout(pt); };
  if (toolBook) toolNav(toolBook, 'quad', guard);
  $('#qeOk').onclick = async () => { if (toolBook && !await safetyPoint18('Avant détourage')) return; const sp = extractQuad(img, Q); modalLeaveGuard = null; closeModal(); await onSave(quadNorm(Q, img), sp); };
  if (toolBook) attachToolEnhance18(toolBook, 'quad'); else enhanceModal18();
}

/* =====================================================================
   V1.9 – DÉPLACER UNE ÉTAGÈRE PAR SIMPLE GLISSER (poignée ⇕ à gauche)
   + RETOUR À L'ÉTAT D'ORIGINE DES PHOTOS
   ===================================================================== */
let sdrag = null;
$('#unit').addEventListener('mousedown', e => {
  const g = e.target.closest('.shgrip'); if (!g || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  const i = g.dataset.grip.lastIndexOf('|'), cid = g.dataset.grip.slice(0, i), r = +g.dataset.grip.slice(i + 1);
  const grps = $$('#unit .rowgrp');
  document.body.classList.add('dnd');
  sdrag = {cid, r, n: grps.length, y0: e.clientY, rowH: +$('#unit').dataset.rowh || 200, target: r, toCase: null, moved: false, grps};
  grps.forEach(x => x.classList.add('anim')); grps[r - 1].classList.remove('anim'); grps[r - 1].classList.add('lift');
  document.body.style.cursor = 'grabbing'; $('#tip').style.display = 'none';
});
window.addEventListener('mousemove', e => {
  if (!sdrag) return; const S = sdrag, dy = (e.clientY - S.y0) / (VIEW.k * VIEW.z);
  if (Math.abs(dy) > 4) S.moved = true;
  S.target = clamp(S.r + Math.round(dy / S.rowH), 1, S.n);
  S.grps[S.r - 1].style.transform = `translateY(${dy}px) translateZ(30px)`;
  S.grps.forEach((g, k) => { const row = k + 1; if (row === S.r) return; let sh = 0;
    if (S.r < S.target && row > S.r && row <= S.target) sh = -S.rowH; if (S.r > S.target && row >= S.target && row < S.r) sh = S.rowH;
    g.style.transform = sh ? `translateY(${sh}px)` : ''; });
  $$('#caseBar .dropok').forEach(x => x.classList.remove('dropok'));
  const cb = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.matches && el.matches('#caseBar button[data-case]') && ![ALL, '__add', '__clearai', NONE, S.cid].includes(el.dataset.case));
  S.toCase = cb ? cb.dataset.case : null; if (cb) cb.classList.add('dropok');
});
window.addEventListener('mouseup', async () => {
  if (!sdrag) return; const S = sdrag; sdrag = null; document.body.style.cursor = ''; document.body.classList.remove('dnd');
  $$('#caseBar .dropok').forEach(x => x.classList.remove('dropok'));
  S.grps.forEach(g => { g.style.transform = ''; g.classList.remove('lift', 'anim'); });
  if (!S.moved && !S.toCase) return; // V2.20 : un simple clic ouvre le menu de l'étagère
  justDragged = true; setTimeout(() => justDragged = false, 80);
  const inRow = books.filter(b => caseOf(b) === S.cid && (b.row || 1) === S.r);
  if (S.toCase) {
    const c = cases.find(x => x.id === S.toCase); if (!c) return;
    const row = Math.max(0, ...books.filter(b => b.caseId === c.id).map(b => b.row || 1)) + 1;
    pushUndo(`Étagère ${S.r} déplacée vers « ${c.name} »`);
    inRow.forEach(b => { b.caseId = c.id; b.row = row; }); if ((c.rows || 3) < row) { c.rows = row; await DB.put('cases', c); }
    await DB.putMany('books', inRow); renderAll(); return showUndo(`Étagère déplacée vers « ${c.name} » (étagère ${row})`);
  }
  if (S.target === S.r) return;
  const order = Array.from({length: S.n}, (_, k) => k + 1); order.splice(S.r - 1, 1); order.splice(S.target - 1, 0, S.r);
  const map = {}; order.forEach((old, k) => map[old] = k + 1);
  pushUndo(`Étagère ${S.r} déplacée en position ${S.target}`);
  const ch = books.filter(b => caseOf(b) === S.cid); ch.forEach(b => b.row = map[b.row || 1] || b.row);
  await DB.putMany('books', ch); renderAll(); showUndo(`Étagère ${S.r} → position ${S.target}`);
});

async function restoreOrigin() {
  const ids = curCase === ALL ? cases.map(c => c.id) : [curCase];
  const L = books.filter(b => b.orig && (ids.includes(b.orig.caseId) || ids.includes(b.caseId)));
  if (!L.length) return toast('Aucun livre importé par photo ici : rien à remettre');
  const n = L.filter(b => b.orig.caseId !== (b.caseId || null) || b.orig.row !== (b.row || 1) || b.orig.position !== b.position).length;
  if (!n) return toast('Tout est déjà rangé comme sur les photos d\'origine');
  if (!confirm(`Remettre ${n} livre(s) et leurs étagères exactement comme sur les photos d'origine ?\n(Tu pourras annuler avec ↶)`)) return;
  await reorderByOrig(L, 'Retour à l\'état des photos'); showUndo(`${n} livre(s) remis comme sur les photos`);
}

/* =====================================================================
   SCANLY V1.9.5 – RECONNAISSANCE « DÉCOUPER PUIS LIRE »
   L'IA est bonne pour LIRE une tranche, mauvaise pour la DÉLIMITER.
   1. Lecture d'ensemble (IA) : titres probables + position des étagères.
   2. Découpage par l'application, sans IA : sur chaque étagère, détection
      des séparations entre tranches (bords verticaux qui traversent toute
      la hauteur des livres), en suivant l'inclinaison locale des livres.
   3. Chaque tranche est redressée, agrandie, puis LUE par l'IA par lots
      de 12, avec le titre probable et le voisin comme indices.
   4. Morceaux d'un même livre recollés ; non-livres retirés ; tranches
      contenant plusieurs poches partagées.
   ===================================================================== */
(function () {
  const VER = '1.9.5';
  const CL = (v, a, b) => Math.max(a, Math.min(b, v));
  const med = a => { const s = a.filter(v => isFinite(v)).sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const pct = (a, p) => { const s = Float64Array.from(a).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
  const setMsg = h => { const m = document.querySelector('#sMsg'); if (m) m.innerHTML = '<span class="spin"></span> ' + h; const T = window.SCAN_T; if (T) { const k = h.replace(/^Photo \d+\/\d+ : /, '').replace(/\s*\d+\/\d+.*$|…$/, '').trim(), now = performance.now(), L = T.steps[T.steps.length - 1]; if (!L || L.k !== k) { if (L) L.ms = now - L.t; T.steps.push({k, t: now}); } } };
  const asList = o => Array.isArray(o) ? o : (o && (o.livres || o.tranches)) || [];
  const NOBOOK = 'Ignore STRICTEMENT tout ce qui n\'est pas un livre : objets décoratifs, sabre, vase, cadre, boîte, montant ou planche du meuble.';

  /* réponse JSON tronquée : on garde les objets complets */
  const oldParse = parseJSON;
  parseJSON = function (t) {
    try { return oldParse(t); } catch (e) {
      const s = String(t), i = s.indexOf('['); if (i < 0) throw e;
      const out = []; let depth = 0, start = -1, inStr = false, esc = false;
      for (let k = i + 1; k < s.length; k++) { const ch = s[k];
        if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true; else if (ch === '{') { if (!depth) start = k; depth++; }
        else if (ch === '}') { depth--; if (!depth && start >= 0) { try { out.push(JSON.parse(s.slice(start, k + 1))); } catch (er) {} start = -1; } }
        else if (ch === ']' && !depth) break; }
      if (!out.length) throw e; return {livres: out};
    }
  };

  /* ---------- outils image ---------- */
  function sobelOf(cv) {
    const w = cv.width, h = cv.height, d = cv.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
    const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x;
      gx[i] = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - 1] + g[i + w - 1]);
      gy[i] = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - w] + g[i - w + 1]); }
    return {g, gx, gy, w, h};
  }
  function solveHom(src, dst) {
    const A = [], B = [];
    for (let i = 0; i < 4; i++) { const [u, v] = src[i], [x, y] = dst[i]; A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); B.push(x); A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); B.push(y); }
    for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]]; const d = A[c][c] || 1e-12;
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / d; if (!f) continue; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; } }
    const h = B.map((b, i) => b / (A[i][i] || 1e-12)); h.push(1); return h;
  }
  /* redresse un quadrilatère (pixels image) -> tranche verticale */
  function warp(img, Q, outH) {
    const IW = img.naturalWidth, IH = img.naturalHeight, dd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const hpx = (dd(Q[0], Q[3]) + dd(Q[1], Q[2])) / 2, wpx = (dd(Q[0], Q[1]) + dd(Q[3], Q[2])) / 2;
    const oh = Math.round(CL(outH || hpx, 40, 900)), ow = Math.max(3, Math.round(wpx * oh / Math.max(1, hpx)));
    const xs = Q.map(p => p[0]), ys = Q.map(p => p[1]);
    const sx0 = CL(Math.floor(Math.min(...xs)) - 2, 0, IW - 1), sy0 = CL(Math.floor(Math.min(...ys)) - 2, 0, IH - 1);
    const sx1 = CL(Math.ceil(Math.max(...xs)) + 2, sx0 + 1, IW), sy1 = CL(Math.ceil(Math.max(...ys)) + 2, sy0 + 1, IH);
    const f = Math.min(2, 1.4 * oh / Math.max(1, hpx)), sw = Math.max(1, Math.round((sx1 - sx0) * f)), sh = Math.max(1, Math.round((sy1 - sy0) * f));
    const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh; const sx = sc.getContext('2d', {willReadFrequently: true}); sx.imageSmoothingQuality = 'high';
    sx.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, 0, 0, sw, sh); const sd = sx.getImageData(0, 0, sw, sh).data;
    const Hm = solveHom([[0, 0], [ow, 0], [ow, oh], [0, oh]], Q.map(p => [(p[0] - sx0) * f, (p[1] - sy0) * f]));
    const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh; const ox = oc.getContext('2d'), od = ox.createImageData(ow, oh), o = od.data;
    for (let v = 0; v < oh; v++) for (let u = 0; u < ow; u++) {
      const uu = u + .5, vv = v + .5, z = Hm[6] * uu + Hm[7] * vv + 1, X = (Hm[0] * uu + Hm[1] * vv + Hm[2]) / z - .5, Y = (Hm[3] * uu + Hm[4] * vv + Hm[5]) / z - .5;
      const x0 = CL(Math.floor(X), 0, sw - 1), y0 = CL(Math.floor(Y), 0, sh - 1), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), ax = CL(X - x0, 0, 1), ay = CL(Y - y0, 0, 1);
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4, j = (v * ow + u) * 4;
      for (let c = 0; c < 3; c++) o[j + c] = (sd[i00 + c] * (1 - ax) + sd[i10 + c] * ax) * (1 - ay) + (sd[i01 + c] * (1 - ax) + sd[i11 + c] * ax) * ay;
      o[j + 3] = 255; }
    ox.putImageData(od, 0, 0);
    const bins = new Map(); for (let y = Math.floor(oh * .06); y < oh * .94; y += 2) for (let x = Math.floor(ow * .15); x < ow * .85; x += 2) { const i = (y * ow + x) * 4, key = (o[i] >> 4) << 8 | (o[i + 1] >> 4) << 4 | (o[i + 2] >> 4);
      const e = bins.get(key) || [0, 0, 0, 0]; e[0]++; e[1] += o[i]; e[2] += o[i + 1]; e[3] += o[i + 2]; bins.set(key, e); }
    let best = [1, 128, 128, 128]; bins.forEach(e => { if (e[0] > best[0]) best = e; });
    return {crop: oc.toDataURL('image/jpeg', .86), color: '#' + [1, 2, 3].map(j => Math.round(best[j] / best[0]).toString(16).padStart(2, '0')).join(''), wpx, hpx};
  }

  /* ---------- 2. découpage d'une étagère (bande) ---------- */
  function segmentBand(img, B) {
    const hb = B.y1 - B.y0, k = 260 / hb, wk = Math.max(8, Math.round((B.x1 - B.x0) * k)), hk = 260;
    const cv = document.createElement('canvas'); cv.width = wk; cv.height = hk; const cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, B.x0, B.y0, B.x1 - B.x0, hb, 0, 0, wk, hk);
    const {g, gx, gy} = sobelOf(cv), ya = Math.round(hk * .45), yb = Math.round(hk * .93), ym = (ya + yb) / 2;
    const win = Math.round(hk * .5), cent = [], tl = [];
    for (let x0 = 0; x0 < wk - win / 2; x0 += Math.round(win / 2)) {
      const Hh = new Float64Array(41); let tot = 0;
      for (let y = ya; y < yb; y++) for (let x = Math.max(1, x0); x < Math.min(wk - 1, x0 + win); x++) { const i = y * wk + x, ax = Math.abs(gx[i]), ay = Math.abs(gy[i]);
        if (ax < 60 || ax < 2 * ay) continue; const t = Math.atan(-gy[i] / gx[i]) * 180 / Math.PI; if (t < -20 || t > 20) continue; Hh[Math.round(t + 20)] += ax; tot += ax; }
      let bi = 20, bv = -1; for (let i = 0; i < 41; i++) { const v = (Hh[i - 2] || 0) + 2 * (Hh[i - 1] || 0) + 3 * Hh[i] + 2 * (Hh[i + 1] || 0) + (Hh[i + 2] || 0); if (v > bv) { bv = v; bi = i; } }
      cent.push(x0 + win / 2); tl.push(tot > 1500 ? bi - 20 : 0);
    }
    const tls = tl.map((_, i) => med(tl.slice(Math.max(0, i - 1), i + 2)));
    const tiltAt = x => { if (!cent.length) return 0; if (x <= cent[0]) return tls[0]; for (let i = 1; i < cent.length; i++) if (x <= cent[i]) { const a = (x - cent[i - 1]) / (cent[i] - cent[i - 1]); return tls[i - 1] * (1 - a) + tls[i] * a; } return tls[tls.length - 1]; };
    const absx = []; for (let y = ya; y < yb; y += 3) for (let x = 1; x < wk - 1; x += 3) absx.push(Math.abs(gx[y * wk + x]));
    const T = pct(absx, .75), P = new Float64Array(wk), tanX = new Float64Array(wk);
    for (let x = 0; x < wk; x++) { const tn = Math.tan(tiltAt(x) * Math.PI / 180); tanX[x] = tn; let c = 0, n = 0;
      for (let y = ya; y < yb; y += 2) { const xs = Math.round(x + (y - ym) * tn); if (xs < 1 || xs >= wk - 1) continue; n++; const i = y * wk + xs, v = Math.abs(gx[i]);
        if (v > T && v > 1.2 * Math.abs(gy[i])) c++; }
      P[x] = n ? c / n : 0; }
    const Ps = new Float64Array(wk); for (let x = 1; x < wk - 1; x++) Ps[x] = (P[x - 1] + 2 * P[x] + P[x + 1]) / 4;
    const minW = Math.max(3, Math.round(hk * .03)), thr = Math.max(.2, pct(Ps, .6)), cuts = [];
    for (let x = 2; x < wk - 2; x++) { if (Ps[x] <= thr) continue; let mx = 0; for (let j = Math.max(0, x - (minW >> 1)); j <= Math.min(wk - 1, x + (minW >> 1)); j++) mx = Math.max(mx, Ps[j]);
      if (Ps[x] < mx) continue; if (!cuts.length || x - cuts[cuts.length - 1] >= minW) cuts.push(x); else if (Ps[x] > Ps[cuts[cuts.length - 1]]) cuts[cuts.length - 1] = x; }
    for (let pass = 0; pass < 3; pass++) { const ws = cuts.slice(1).map((c, i) => c - cuts[i]), add = [];
      for (let i = 0; i < ws.length; i++) { const loc = med(ws.slice(Math.max(0, i - 4), i + 5));
        if (ws[i] > loc * 1.75 && ws[i] > minW * 2.4) { let bx = -1, bv = .1; for (let x = cuts[i] + Math.round(minW * 1.1); x <= cuts[i + 1] - Math.round(minW * 1.1); x++) if (Ps[x] > bv && Ps[x] >= Ps[x - 1] && Ps[x] >= Ps[x + 1]) { bv = Ps[x]; bx = x; }
          if (bx > 0) add.push(bx); } }
      if (!add.length) break; cuts.push(...add); cuts.sort((p, q) => p - q); }
    const out = [], toImg = (x, y) => [B.x0 + x / k, B.y0 + y / k];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], wS = b - a; if (wS < minW || wS > hk * 1.2) continue;
      const tA = tanX[a], tB = tanX[b], xAt = (c, tn, y) => c + (y - ym) * tn;
      let e = 0, n = 0; for (let y = ya; y < yb; y += 2) for (let x = Math.round(a + wS * .2); x < b - wS * .2; x++) { const xs = Math.round(x + (y - ym) * (tA + tB) / 2); if (xs < 1 || xs >= wk - 1) continue; const j = y * wk + xs; e += Math.abs(gx[j]) + Math.abs(gy[j]); n++; }
      if (!n || e / n < 18) continue;
      let top = 0, bv = -1; const mid = (a + b) / 2, half = Math.max(1, wS * .3);
      const rowMean = y => { let s = 0, c = 0; for (let x = Math.round(mid - half); x <= mid + half; x++) { const xs = Math.round(x + (y - ym) * (tA + tB) / 2); if (xs >= 0 && xs < wk) { s += g[y * wk + xs]; c++; } } return c ? s / c : 0; };
      const RM = []; for (let y = 0; y < hk; y++) RM.push(rowMean(y));
      const V = []; for (let y = 6; y < hk * .45; y++) { let up = 0, dn = 0; for (let j = 1; j <= 5; j++) { up += RM[y - j]; dn += RM[y + j]; } V.push([y, Math.abs(dn - up) / 5]); }
      V.forEach(([y, v]) => { if (v > bv) { bv = v; top = y; } });
      const cand = V.filter(([y, v], j) => v >= Math.max(12, bv * .4) && (!V[j - 1] || v >= V[j - 1][1]) && (!V[j + 1] || v >= V[j + 1][1])).map(([y, v]) => ({y: B.y0 + y / k, v}));
      if (bv < 12) top = 0;
      const bot = hk - 1;
      const Q = [toImg(xAt(a, tA, top), top), toImg(xAt(b, tB, top), top), toImg(xAt(b, tB, bot), bot), toImg(xAt(a, tA, bot), bot)];
      const Qr = [toImg(xAt(a, tA, 0), 0), toImg(xAt(b, tB, 0), 0), Q[2], Q[3]];
      const topAt = yImg => { const y = CL((yImg - B.y0) * k, 0, hk * .6); return [toImg(xAt(a, tA, y), y), toImg(xAt(b, tB, y), y), Q[2], Q[3]]; };
      out.push({Q, Qr, cand, topAt, cx: B.x0 + mid / k, wImg: wS / k, tilt: Math.atan((tA + tB) / 2) * 180 / Math.PI});
    }
    return out;
  }

  /* ---------- 1. lecture d'ensemble ---------- */
  async function globalPass(url, ii) {
    try { const o = await gemini([{text: SCAN_PROMPT + '\n- ' + NOBOOK}, {inlineData: {mimeType: 'image/jpeg', data: url.split(',')[1]}}], {json: true, think: scanMode() === 'fast' ? 'off' : 'low', timeout: 240000});
      return asList(o).filter(d => d && Array.isArray(d.boite) && d.boite.length === 4 && d.boite.every(isFinite) && d.boite[2] > d.boite[0] && d.boite[3] > d.boite[1])
        .filter(d => !/sabre|épée|katana|vase|cadre|décor/i.test(d.titre || ''))
        .map(d => { const [y0, x0, y1, x1] = d.boite.map(Number); return {t: d.illisible ? null : d.titre, a: d.auteur, s: d.serie, v: d.tome, e: d.editeur, ty: d.type, c: +d.confiance || 0, ii, x0: x0 / 1000, x1: x1 / 1000, y0: y0 / 1000, y1: y1 / 1000}; });
    } catch (e) { console.warn('SCANLY lecture d\'ensemble', e); return []; }
  }
  function bandsFrom(G, W, H) {
    const L = G.filter(d => (d.x1 - d.x0) * W < (d.y1 - d.y0) * H * 1.3);
    if (L.length < 2) return [{x0: W * .005, x1: W * .995, y0: H * .06, y1: H * .96, G: L}];   // V1.9.7
    const S = [...L].sort((p, q) => (p.y0 + p.y1) - (q.y0 + q.y1)), mh = med(S.map(d => d.y1 - d.y0)) || .2, rows = [];
    let cur = null; S.forEach(d => { const c = (d.y0 + d.y1) / 2; if (!cur || c - cur.c > mh * .6) { cur = {c, L: []}; rows.push(cur); } cur.L.push(d); cur.c = c; });
    return rows.map(r => { const y0 = pct(r.L.map(d => d.y0), .1), y1 = pct(r.L.map(d => d.y1), .85), hh = y1 - y0;
      return {x0: W * .005, x1: W * .995,   // V1.9.7 : toujours toute la largeur de la photo
        y0: CL((y0 - hh * .12) * H, 0, H), y1: CL((y1 + hh * .04) * H, 0, H), G: r.L}; });
  }

  /* ---------- 3. lecture des tranches par lots ---------- */
  async function readSlices(S, done) {
    const FAST = scanMode() === 'fast', LOT = FAST ? 25 : 12;
    const chunks = []; for (let i = 0; i < S.length; i += LOT) chunks.push(S.slice(i, i + LOT)); let n = 0;
    await pool(chunks, FAST ? 4 : 3, async ch => {
      const parts = [{text: `Voici ${ch.length} tranches de livres découpées dans une photo d'étagère, redressées et agrandies, dans l'ordre de gauche à droite (le texte est souvent vertical, parfois à l'envers).
Pour chaque tranche k, lis le titre, l'auteur, l'éditeur et le tome (édition française en priorité). Un « titre probable » issu d'une lecture d'ensemble de la photo est indiqué quand il existe : vérifie-le sur l'image, corrige-le si besoin. Les voisins d'une même série se ressemblent : sers-t'en.
Indique "livre": false si l'image n'est pas un livre (mur, planche, objet), et "suite": true si l'image est un morceau du MÊME livre que la tranche précédente (k-1).
Si l'image contient PLUSIEURS livres côte à côte (souvent des poches très fins), indique "nb" (nombre de livres) et décris le 1er dans les champs normaux, les suivants (de gauche à droite) dans "autres".
N'invente rien : "titre": null si illisible. Le numéro de "tome" doit être LU sur l'image (chiffre ou mention imprimée) : ne le déduis JAMAIS des voisins ; s'il n'est pas visible, "tome": null.
JSON : [{"k":1,"livre":true,"suite":false,"titre":"…","auteur":"…","serie":"… ou null","tome":nombre ou null,"editeur":"…","type":"un parmi ${TYPES.join(', ')}","confiance":0-1,"nb":1,"autres":[{"titre":"…","auteur":"…","serie":null,"tome":null,"editeur":"…"}]}]`}];
      ch.forEach((s, k) => { parts.push({text: `Tranche k=${k + 1}${s.hint ? ` – titre probable : « ${s.hint} »` : ''}${s.prev ? ` – voisin de gauche : « ${s.prev} »` : ''}`},
        {inlineData: {mimeType: 'image/jpeg', data: s.read.split(',')[1]}}); });
      for (let a = 0; a < 2; a++) { try {
        asList(await gemini(parts, {json: true, think: FAST ? 'off' : 'low', timeout: 180000})).forEach(o => { const s = ch[(+o.k || 0) - 1]; if (!s) return;
          s.ok = true; s.notBook = o.livre === false; s.cont = !!o.suite; s.nb = CL(parseInt(o.nb) || 1, 1, 6); s.more = Array.isArray(o.autres) ? o.autres : [];
          if (o.titre && (+o.confiance || 0) >= .35) Object.assign(s, {t: o.titre, a: o.auteur, se: o.serie, v: o.tome, e: o.editeur, ty: o.type, c: +o.confiance || .6}); });
        break; } catch (e) { console.warn('SCANLY lecture tranches', e); } }
      n += ch.length; done(n);
    });
  }

  /* V1.9.9 : deux livres voisins suspects (même série/titre proche, ou deux morceaux étroits) -> l'IA voit les deux réunis et tranche */
  const similarT = (p, q) => { const A = norm(p.se || p.t || ''), B = norm(q.se || q.t || ''); if (!A || !B || A.length < 4 || B.length < 4) return false; return A === B || sim(A, B) >= .75 || (A.length > 6 && B.length > 6 && (A.includes(B) || B.includes(A))); };
  /* V2.1 : une tranche anormalement large pour sa hauteur contient sans doute plusieurs livres fins */
  async function splitWide(img, S) {
    const L = S.filter(s => !s.notBook && !(s.nb > 1) && s.sp && s.sp.hpx > 20), ratio = s => s.sp.wpx / s.sp.hpx;
    if (!L.length) return;
    const rs = L.map(ratio).sort((a, b) => a - b), mr = rs[rs.length >> 1] || .1;
    const cand = L.filter(s => ratio(s) > Math.max(.17, mr * 1.9) && ratio(s) < 1.1);
    if (!cand.length) return;
    const pics = cand.map(s => warp(img, s.Qr, 560));
    const chunks = []; for (let i = 0; i < cand.length; i += 6) chunks.push(cand.map((s, k) => [s, pics[k]]).slice(i, i + 6));
    await pool(chunks, 2, async ch => {
      const parts = [{text: `Chaque image montre UNE zone d'étagère redressée (dos de livres, texte souvent vertical). Le découpage automatique pense qu'il y a un seul livre, mais il y en a peut-être PLUSIEURS, collés et fins (ex. poches de la même collection, même couleur).
Pour chaque image k, compte les livres de gauche à droite. Pour chacun : titre, auteur, série, tome (LU sur l'image, sinon null), éditeur, et la position horizontale de son bord DROIT en fraction de la largeur de l'image (0 = bord gauche, 1 = bord droit ; le dernier vaut 1).
JSON : [{"k":1,"nb":3,"livres":[{"titre":"…","auteur":"…","serie":null,"tome":null,"editeur":"…","droite":0.31,"confiance":0.8}]}]`}];
      ch.forEach(([s, pc], k) => parts.push({text: `Image k=${k + 1}`}, {inlineData: {mimeType: 'image/jpeg', data: pc.crop.split(',')[1]}}));
      try { asList(await gemini(parts, {json: true, think: 'low', timeout: 150000})).forEach(o => { const e = ch[(+o.k || 0) - 1]; if (!e) return;
          const [s, pc] = e, LV = Array.isArray(o.livres) ? o.livres : [], nb = CL(parseInt(o.nb) || LV.length, 1, 8); if (nb < 2 || LV.length < 2) return;
          let cuts = LV.slice(0, -1).map(x => +x.droite).filter(v => v > .03 && v < .97).sort((a, b) => a - b);
          if (cuts.length !== LV.length - 1) cuts = Array.from({length: LV.length - 1}, (_, i) => (i + 1) / LV.length);
          s.cuts = snapCuts(pc.crop, cuts); s.parts = LV; }); }
      catch (e) { console.warn('SCANLY tranches larges', e); }
    });
    // recale chaque coupure sur le bord vertical le plus net à proximité (synchronisé après chargement)
    for (const s of cand) if (s.cuts && s.cuts.then) s.cuts = await s.cuts;
    console.log(`SCANLY 2.1 : ${cand.length} tranche(s) large(s) contrôlée(s), ${cand.filter(s => s.cuts && s.cuts.length).length} redécoupée(s)`);
  }
  async function snapCuts(src, cuts) {
    try { const im = await srcToImg(src), w = im.naturalWidth, h = im.naturalHeight, c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0);
      const {gx} = sobelOf(c), P = new Float64Array(w); for (let y = Math.round(h * .3); y < h * .95; y++) for (let x = 1; x < w - 1; x++) P[x] += Math.abs(gx[y * w + x]);
      const win = Math.max(2, Math.round(w * .07));
      return cuts.map(f => { const x0 = Math.round(f * w); let bx = x0, bv = -1; for (let x = Math.max(2, x0 - win); x <= Math.min(w - 3, x0 + win); x++) if (P[x] > bv) { bv = P[x]; bx = x; } return bx / w; }).sort((a, b) => a - b);
    } catch (e) { return cuts; }
  }
  async function verifyPairs(img, S2) {
    const L = S2.filter(s => !s.notBook), cand = [];
    for (let i = 1; i < L.length; i++) { const p = L[i - 1], q = L[i]; if (p.row !== q.row || q.cont) continue;
      const wp = p.wImg || 0, wq = q.wImg || 0, loc = L.slice(Math.max(0, i - 6), i + 6).map(x => x.wImg || 0).filter(Boolean).sort((a, b) => a - b), mw = loc[loc.length >> 1] || 0;
      const narrow = mw && wp < mw * .7 && wq < mw * .7 && (wp + wq) < mw * 1.6;
      const same = p.t && q.t && similarT(p, q) && (!p.v || !q.v || p.v === q.v || Math.abs(p.v - q.v) === 1);
      if (same || (narrow && (!p.t || !q.t || similarT(p, q)))) cand.push([p, q]); }
    if (!cand.length) return;
    const pic = ([p, q]) => { const Q = [p.Qr[0], q.Qr[1], q.Qr[2], p.Qr[3]], im = warp(img, Q, 520), c = document.createElement('canvas');
      return new Promise(res => { const I2 = new Image(); I2.onload = () => { c.width = I2.width; c.height = I2.height; const x = c.getContext('2d'); x.drawImage(I2, 0, 0);
        const fr = (p.wImg || 1) / ((p.wImg || 1) + (q.wImg || 1)), cx = Math.round(c.width * fr); x.strokeStyle = '#ff00c8'; x.lineWidth = 2; x.setLineDash([6, 4]); x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, c.height); x.stroke();
        res(c.toDataURL('image/jpeg', .9)); }; I2.src = im.crop; }); };
    const chunks = []; for (let i = 0; i < cand.length; i += 8) chunks.push(cand.slice(i, i + 8));
    await pool(chunks, 2, async ch => {
      const parts = [{text: `Chaque image ci-dessous montre une zone d'étagère redressée, coupée en deux par une ligne rose pointillée. Pour chaque image k, dis si la ligne coupe UN SEUL livre (les deux côtés sont le même dos de livre : même couleur, même graphisme, texte qui continue) ou sépare DEUX livres différents.
Si c'est un seul livre, lis son titre, l'auteur, la série et le tome (le tome doit être LU sur l'image, sinon null).
JSON : [{"k":1,"un_seul":true,"titre":"…","auteur":"…","serie":"… ou null","tome":nombre ou null,"editeur":"…","confiance":0-1}]`}];
      for (let k = 0; k < ch.length; k++) parts.push({text: `Image k=${k + 1}`}, {inlineData: {mimeType: 'image/jpeg', data: (await pic(ch[k])).split(',')[1]}});
      try { asList(await gemini(parts, {json: true, think: 'low', timeout: 150000})).forEach(o => { const pr = ch[(+o.k || 0) - 1]; if (!pr || o.un_seul !== true) return;
          const [p, q] = pr; q.cont = true; if (o.titre) { const t = {t: o.titre, a: o.auteur || p.a || q.a, se: o.serie || null, v: parseInt(o.tome) || null, e: o.editeur || p.e || q.e, c: +o.confiance || .7}; Object.assign(p, t); Object.assign(q, t); } });
      } catch (e) { console.warn('SCANLY vérification des paires', e); }
    });
    console.log(`SCANLY 1.9.9 : ${cand.length} paire(s) voisine(s) vérifiée(s)`);
  }
  const sameBook = (p, q) => p.t && q.t && norm(p.t) === norm(q.t) && (p.v || 0) === (q.v || 0);
  const CACHE = new Map();

  /* ---------- V1.9.6 : REGROUPEMENT VISUEL (perspective, couvertures vues de biais, motifs) ----------
     L'IA voit la bande de l'étagère avec les découpes numérotées et indique quelles bandes forment
     UN SEUL livre, et laquelle est la tranche (dos). Évite qu'un livre vu en perspective soit
     découpé en plusieurs morceaux. */
  function groupImage(img, L) {
    const xs = L.flatMap(s => [s.Qr[0][0], s.Qr[3][0], s.Qr[1][0], s.Qr[2][0]]), ys = L.flatMap(s => [s.Qr[0][1], s.Qr[2][1]]);
    const W = img.naturalWidth, H = img.naturalHeight, pad = 6;
    const x0 = CL(Math.min(...xs) - pad, 0, W), x1 = CL(Math.max(...xs) + pad, 0, W), y0 = CL(Math.min(...ys) - pad, 0, H), y1 = CL(Math.max(...ys) + pad, 0, H);
    const k = Math.min(3, 480 / (y1 - y0), 1900 / (x1 - x0)), head = 46, cw = Math.round((x1 - x0) * k), ch = Math.round((y1 - y0) * k);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch + head; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, cw, head); x.imageSmoothingQuality = 'high'; x.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, head, cw, ch);
    const P = q => [(q[0] - x0) * k, (q[1] - y0) * k + head];
    x.lineWidth = 2;
    L.forEach((s, i) => { const a = P(s.Qr[0]), b = P(s.Qr[3]); x.strokeStyle = '#ff00c8'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
      if (i === L.length - 1) { const e = P(s.Qr[1]), f = P(s.Qr[2]); x.beginPath(); x.moveTo(e[0], e[1]); x.lineTo(f[0], f[1]); x.stroke(); }
      const cx = (P(s.Qr[0])[0] + P(s.Qr[1])[0]) / 2, ty = i % 2 ? 38 : 16;
      x.strokeStyle = '#999'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, ty + 3); x.lineTo(cx, head); x.stroke(); x.lineWidth = 2;
      x.font = 'bold 15px Arial'; x.textAlign = 'center'; x.fillStyle = '#c00060'; x.fillText(String(i + 1), cx, ty); });
    return c.toDataURL('image/jpeg', .9);
  }
  async function groupPass(img, L, bandH) {
    // renvoie, pour chaque bande, l'index du groupe et si c'est la tranche
    const n = L.length, parent = L.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i])), spine = {};
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    const WIN = 22, OV = 5, jobs = [];
    for (let s0 = 0; s0 < n; s0 += WIN - OV) { jobs.push([s0, Math.min(n, s0 + WIN)]); if (s0 + WIN >= n) break; }
    await pool(jobs, 3, async ([a, b]) => {
      const sub = L.slice(a, b);
      try {
        const o = await gemini([{text: `Cette image montre une portion d'étagère de livres. Des traits roses verticaux (qui suivent l'inclinaison des livres) la découpent en ${sub.length} bandes numérotées de 1 à ${sub.length} (numéros en haut, de gauche à droite).
La plupart des bandes contiennent exactement UN livre : dans ce cas, NE LES REGROUPE PAS.
Signale UNIQUEMENT les exceptions : plusieurs bandes VOISINES qui appartiennent au MÊME livre physique (livre posé de biais dont on voit la couverture en perspective, tranche dessinée coupée par erreur). Indique la bande qui contient la tranche (le dos avec le titre).
Signale aussi les bandes qui ne contiennent aucun livre (mur, objet).
JSON : {"regroupements":[{"bandes":[8,9,10],"tranche":10}],"vides":[]}  (listes vides si tout est correct)`}, {inlineData: {mimeType: 'image/jpeg', data: groupImage(img, sub).split(',')[1]}}], {json: true, think: 'low', timeout: 150000});
        (Array.isArray(o.vides) ? o.vides : []).map(v => parseInt(v) - 1).filter(v => v >= 0 && v < sub.length).forEach(v => { L[a + v].wall = true; });
        (Array.isArray(o.regroupements) ? o.regroupements : []).forEach(gr => { const B = (Array.isArray(gr.bandes) ? gr.bandes : []).map(v => parseInt(v) - 1).filter(v => v >= 0 && v < sub.length).sort((p, q) => p - q);
          if (B.length < 2 || B.length > 4 || B[B.length - 1] - B[0] !== B.length - 1) return;          // garde-fou : 2 à 4 bandes voisines
          if (B.reduce((t, j) => t + (sub[j].wImg || 0), 0) > bandH * .85) return;                        // garde-fou : largeur d'un seul livre
          for (let j = 1; j < B.length; j++) union(a + B[0], a + B[j]);
          const t = parseInt(gr.tranche) - 1; if (B.includes(t)) spine[a + B[0]] = a + t; });
      } catch (e) { console.warn('SCANLY regroupement', e); }
    });
    const groups = new Map(); L.forEach((s, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
    return [...groups.values()].sort((p, q) => p[0] - q[0]).map(G => {
      const sp = G.map(i => spine[i]).find(v => v != null && G.includes(v));
      return {idx: G, spine: sp != null ? sp : null};
    });
  }

  recognize = async function (urls) {
    const out = [];
    for (let ii = 0; ii < urls.length; ii++) {
      const img = await srcToImg(urls[ii]), W = img.naturalWidth, H = img.naturalHeight;
      setMsg(`Photo ${ii + 1}/${urls.length} : lecture d'ensemble…`);
      const G = await globalPass(urls[ii], ii), bands = bandsFrom(G, W, H);
      setMsg(`Photo ${ii + 1}/${urls.length} : découpage des tranches…`); await sleep(20);
      const S = [], RAW = bands.map(B => segmentBand(img, B));
      for (let r = 0; r < bands.length; r++) {
        const L = RAW[r]; if (L.length < 2) continue;
        if (scanMode() === 'precise') setMsg(`Photo ${ii + 1}/${urls.length} : regroupement des morceaux (étagère ${r + 1})…`);
        const groups = scanMode() === 'fast' ? L.map((_, i) => ({idx: [i], spine: null})) : await groupPass(img, L, bands[r].y1 - bands[r].y0), merged = [];   // V2.7 : en mode rapide, le recollage se fait pendant la lecture (« suite »)
        groups.forEach(g => { const A = g.idx.map(i => L[i]); if (A.length === 1) { if (!A[0].wall) merged.push(A[0]); return; }
          if (A.every(s => s.wall)) return;
          const f = A[0], l = A[A.length - 1], sp = g.spine != null ? L[g.spine] : null, topY = Math.min(...A.map(s => s.Q[0][1]));
          merged.push({...f, Q: [[f.Q[0][0], topY], [l.Q[1][0], topY], l.Q[2], f.Q[3]], Qr: [f.Qr[0], l.Qr[1], l.Qr[2], f.Qr[3]],
            cx: (f.cx + l.cx) / 2, cand: [], spineQ: sp ? sp.Q : null, parts: A.length}); });
        RAW[r] = merged;
        console.log(`SCANLY 1.9.6 : étagère ${r + 1} : ${L.length} bandes -> ${merged.length} livres après regroupement`);
      }
      bands.forEach((B, r) => RAW[r].forEach(s => {
        const x0 = Math.min(s.Q[0][0], s.Q[3][0]) / W, x1 = Math.max(s.Q[1][0], s.Q[2][0]) / W;
        const gm = (B.G || []).filter(d => d.t).map(d => ({d, dist: Math.abs((d.x0 + d.x1) / 2 - s.cx / W)})).filter(o => o.dist < (x1 - x0) * .9 + .004).sort((p, q) => p.dist - q.dist)[0];
        if (gm && s.cand.length) { const gy = gm.d.y0 * H, c = s.cand.reduce((p, q) => Math.abs(q.y - gy) < Math.abs(p.y - gy) ? q : p); if (Math.abs(c.y - gy) < (B.y1 - B.y0) * .25) s.Q = s.topAt(c.y); }
        if (s.spineQ) s.Q = s.spineQ;   // livre vu de biais : on garde la tranche (dos) pour l'étagère
        const sp = warp(img, s.Q), rd = warp(img, s.Qr, scanMode() === 'fast' ? Math.min(460, Math.max(300, sp.hpx * 1.2)) : Math.min(700, Math.max(380, sp.hpx * 1.6)));
        S.push({...s, row: r + 1, sp, read: rd.crop, hint: gm ? gm.d.t + (gm.d.v ? ' (tome ' + gm.d.v + ')' : '') : '', g: gm && gm.d});
      }));
      S.forEach((s, i) => { if (i && S[i - 1].row === s.row && S[i - 1].hint) s.prev = S[i - 1].hint; });
      await readSlices(S, n => setMsg(`Photo ${ii + 1}/${urls.length} : lecture des tranches ${n}/${S.length}…`));
      S.forEach(s => { if (!s.ok && s.g && s.g.t) Object.assign(s, {t: s.g.t, a: s.g.a, se: s.g.s, v: s.g.v, e: s.g.e, ty: s.g.ty, c: Math.min(.6, s.g.c || .6)}); });
      setMsg(`Photo ${ii + 1}/${urls.length} : contrôle des tranches larges…`);
      if (scanMode() === 'precise') await splitWide(img, S);
      const S2 = [];
      S.forEach(s => { if (s.cuts && s.cuts.length) { const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f], fr = [0, ...s.cuts, 1];
          for (let j = 0; j < fr.length - 1; j++) { const f0 = fr[j], f1 = fr[j + 1], inf = s.parts[j] || {};
            S2.push({...s, t: inf.titre || null, a: inf.auteur || null, se: inf.serie || null, v: parseInt(inf.tome) || null, e: inf.editeur || null, ty: s.ty, c: +inf.confiance || .6,
              Q: [lerp(s.Q[0], s.Q[1], f0), lerp(s.Q[0], s.Q[1], f1), lerp(s.Q[3], s.Q[2], f1), lerp(s.Q[3], s.Q[2], f0)],
              Qr: [lerp(s.Qr[0], s.Qr[1], f0), lerp(s.Qr[0], s.Qr[1], f1), lerp(s.Qr[3], s.Qr[2], f1), lerp(s.Qr[3], s.Qr[2], f0)],
              wImg: (s.wImg || 0) * (f1 - f0), cont: false, merged: true, nb: 1, cuts: null}); }
          return; }
        if (!(s.nb > 1) || s.notBook) return S2.push(s);
        const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f], info = [{t: s.t, a: s.a, se: s.se, v: s.v, e: s.e, ty: s.ty, c: s.c}, ...s.more.map(o => ({t: o.titre, a: o.auteur, se: o.serie, v: o.tome, e: o.editeur, ty: s.ty, c: .6}))];
        for (let j = 0; j < s.nb; j++) { const f0 = j / s.nb, f1 = (j + 1) / s.nb, Q = [lerp(s.Q[0], s.Q[1], f0), lerp(s.Q[0], s.Q[1], f1), lerp(s.Q[3], s.Q[2], f1), lerp(s.Q[3], s.Q[2], f0)];
          S2.push({...s, ...(info[j] || {t: null}), Q, cont: j ? false : s.cont, merged: true, nb: 1}); } });
      setMsg(`Photo ${ii + 1}/${urls.length} : vérification des livres coupés en deux…`);
      if (scanMode() === 'precise') await verifyPairs(img, S2);
      const M = [];
      S2.filter(s => !s.notBook).forEach(s => { const p = M[M.length - 1];
        if (p && p.row === s.row && (s.cont || sameBook(p, s))) { const ty = Math.min(p.Q[0][1], s.Q[1][1]); p.Q = [[p.Q[0][0], ty], [s.Q[1][0], ty], s.Q[2], p.Q[3]]; if (!p.t && s.t) Object.assign(p, {t: s.t, a: s.a, se: s.se, v: s.v, e: s.e, ty: s.ty, c: s.c}); p.Qr = [p.Qr[0], s.Qr[1], s.Qr[2], p.Qr[3]]; p.wImg = (p.wImg || 0) + (s.wImg || 0); p.merged = true; }
        else M.push({...s}); });
      const pos = {};
      setMsg(`Photo ${ii + 1}/${urls.length} : affinage du détourage…`); await sleep(10);
      M.forEach(s => { const Qf = s.spineQ ? s.Q : refineScanQuad20(img, s.Q), refined = Qf !== s.Q; s.Q = Qf; const sp = s.merged || refined ? warp(img, s.Q) : s.sp, xs = s.Q.map(p => p[0]), ys = s.Q.map(p => p[1]);
        const box = [Math.min(...ys) / H, Math.min(...xs) / W, Math.max(...ys) / H, Math.max(...xs) / W].map(v => Math.round(CL(v * 1000, 0, 1000)));
        CACHE.set(box.join(','), {crop: sp.crop, color: sp.color, wpx: sp.wpx, hpx: sp.hpx, quad: s.Q.map(p => [+(p[0] / W).toFixed(5), +(p[1] / H).toFixed(5)]), tilt: s.tilt});
        pos[s.row] = (pos[s.row] || 0) + 1;
        out.push({titre: s.t || null, illisible: !s.t, auteur: s.a || null, serie: s.se || null, tome: parseInt(s.v) || null, editeur: s.e || null, type: s.ty, rangee: s.row, position: pos[s.row],
          confiance: s.t ? (s.c || .7) : 0, image: ii, boite: box, alternatives: []}); });
      console.log(`SCANLY ${VER} : ${S.length} tranches découpées, ${M.length} livres après recollage`);
    }
    return {list: out};
  };
  const prevSpine = typeof spineFromDetection === 'function' ? spineFromDetection : null;
  spineFromDetection = function (img, box, coins) { const c = CACHE.get(box.map(v => Math.round(v)).join(',')); if (c) return c; return prevSpine ? prevSpine(img, box, coins) : spineData(img, box); };
  window.SCANLY_FIX = '1.9.7';
})();



