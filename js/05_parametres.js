/* SCANEBOOK – 05_parametres.js : Sauvegarde, paramètres, stockage protégé, conversion des images.
   Les fichiers js/ sont chargés dans l'ordre par index.html et partagent les mêmes variables globales. */
'use strict';
/* =====================================================================
   SAUVEGARDE (via l'explorateur) & PARAMÈTRES
   ===================================================================== */
async function backupNow() {
  if (!books.length && !cases.length) return toast('Rien à sauvegarder pour l\'instant');
  const data = {app: 'SCANLY', version: VERSION, date: new Date().toISOString(), cases, imports, books: books.map(b => ({...b, shelfId: b.caseId})),
    shelves: cases.map(c => ({id: c.id, name: c.name, photos: [], createdAt: c.createdAt})), seriesMeta: SMETA, types: [...TYPES], readers27: localStorage.getItem('scanly_readers27'), goal27: localStorage.getItem('scanly_goal27')};
  const n = await saveFile(`scanebook_sauvegarde_${today()}.json`, JSON.stringify(data), 'application/json', '.json', 'Sauvegarde SCANEBOOK');
  if (n) { localStorage.setItem('scanly_lastsave', new Date().toISOString()); toast('Sauvegarde enregistrée : ' + n); renderDash(); }
}
async function openBackup() {
  if (window.showOpenFilePicker) {
    try { const [h] = await window.showOpenFilePicker({types: [{description: 'Sauvegarde SCANEBOOK / SCANLY / BiblioScan', accept: {'application/json': ['.json']}}]}); return importFile(await h.getFile()); }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  $('#jsonIn').click();
}
async function importFile(f) {
  try { const d = JSON.parse(await f.text()); const bk = d.books || [], cs = d.cases || d.shelves || [];
    if (!Array.isArray(bk)) throw new Error('fichier non reconnu');
    bk.forEach(b => { if (b.shelfId && !b.caseId) b.caseId = b.shelfId; delete b.shelfId; if (b.loan && !b.loanTo) { b.loanTo = b.loan; delete b.loan; } });
    if (!confirm(`Importer ${bk.length} ouvrage(s) et ${cs.length} meuble(s) depuis « ${f.name} » ?\nLes ouvrages déjà présents (même identifiant) seront mis à jour.`)) return;
    if(!await safetyPoint18('Avant import de sauvegarde'))return;
    await DB.putMany('cases', cs.map(c => ({rows: 3, createdAt: Date.now(), ...c}))); await DB.putMany('books', bk);
    if (Array.isArray(d.imports)) await DB.putMany('imports', d.imports);
    if (d.seriesMeta) { SMETA = {...SMETA, ...d.seriesMeta}; localStorage.setItem('scanly_series', JSON.stringify(SMETA)); }
    for (const k of ['readers27', 'goal27']) if (typeof d[k] === 'string' && !localStorage.getItem('scanly_' + k)) localStorage.setItem('scanly_' + k, d[k]);
    if (Array.isArray(d.types)) applyTypesSetting20([...new Set([...TYPES.filter(t => t !== 'Autre'), ...d.types])]);
    await load(); renderAll(); closeModal(); toast('Import terminé');
  } catch (er) { toast('Import impossible : ' + er.message); }
}
$('#jsonIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
async function exportCsv() {
  const cols = [['title', 'Titre'], ['author', 'Auteur'], ['series', 'Série'], ['volume', 'Tome'], ['type', 'Type'], ['genre', 'Genre'], ['publisher', 'Éditeur'], ['year', 'Année'], ['isbn', 'ISBN'], ['pages', 'Pages'], ['price', 'Prix €'], ['priceSource', 'Source prix'], ['status', 'Statut'], ['wish', 'Souhait'], ['rating', 'Note'], ['readDate', 'Lu le'], ['loanTo', 'Prêté à'], ['loanDue', 'Retour prévu'], ['case', 'Meuble'], ['row', 'Étagère'], ['position', 'Position'], ['notes', 'Notes']];
  const cn = Object.fromEntries(cases.map(c => [c.id, c.name])), q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = '\ufeff' + cols.map(c => c[1]).join(';') + '\n' + books.map(b => cols.map(([k]) => q(k === 'case' ? cn[b.caseId] : k === 'wish' ? (b.wish ? 'oui' : '') : k === 'title' ? dispTitle(b) : k === 'price' && b.price != null ? String(b.price).replace('.', ',') : b[k])).join(';')).join('\n');
  const n = await saveFile(`scanly_catalogue_${today()}.csv`, csv, 'text/csv', '.csv', 'Fichier CSV (Excel)'); if (n) toast('Export enregistré : ' + n);
}
/* ---------- V2.25 : stockage protégé (le navigateur ne doit pas effacer la bibliothèque) ----------
   navigator.storage.persist() demande au navigateur de ne pas vider les données de SCANEBOOK quand
   l'espace manque (Safari iPhone / iPad, Chrome, Edge, Firefox). Le navigateur peut refuser :
   on vérifie donc le résultat, on l'affiche dans les Paramètres et on redemande au premier geste. */
const STORE25 = {persisted: null};
async function askPersist25(force = false) {
  const st = navigator.storage; if (!st?.persist) { STORE25.persisted = null; return true; } // API absente : rien à protéger de plus
  try { let ok = st.persisted ? await st.persisted() : false; if (!ok || force) ok = await st.persist(); STORE25.persisted = !!ok; }
  catch (e) { STORE25.persisted = false; }
  if (!STORE25.persisted && !STORE25.armed) { STORE25.armed = true; // certains navigateurs n'accordent qu'après un geste
    addEventListener('pointerup', async function retry() { removeEventListener('pointerup', retry, true); try { if (await navigator.storage.persist()) { STORE25.persisted = true; renderStore25(); } } catch (e) {} }, true); }
  return STORE25.persisted;
}
const mo25 = n => n >= 1e9 ? (n / 1e9).toLocaleString('fr-FR', {maximumFractionDigits: 1}) + ' Go' : Math.max(1, Math.round(n / 1e6)) + ' Mo';
async function renderStore25() {
  const el = $('#pStore25'); if (!el) return; const st = navigator.storage;
  if (!st?.persist) { el.innerHTML = 'Stockage : ce navigateur ne permet pas de le protéger. Enregistre des sauvegardes régulièrement.'; return; }
  if (STORE25.persisted == null) await askPersist25();
  let used = ''; try { const e = await st.estimate(); if (e?.usage != null) used = `<span> · Espace utilisé : ${mo25(e.usage)}${e.quota ? ' sur ' + mo25(e.quota) + ' disponibles' : ''}</span>`; } catch (e) {}
  const ios = typeof IS_IOS !== 'undefined' && IS_IOS && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
  el.innerHTML = STORE25.persisted
    ? `<b style="color:var(--ok, #2c7a4b)">✔ Stockage protégé</b> : le navigateur ne videra pas la bibliothèque pour libérer de la place.${used}`
    : `<b style="color:var(--ko)">⚠ Stockage non protégé</b> : le navigateur peut effacer la bibliothèque s'il manque de place.${ios ? ' Sur iPhone / iPad, ajoute SCANEBOOK à l\'écran d\'accueil (Partager › Sur l\'écran d\'accueil) puis ouvre-le depuis l\'icône.' : ''} Garde des sauvegardes récentes.${used}
       <br><button class="btn s" id="pPersist25" style="margin-top:6px">Protéger le stockage</button>`;
  const b = $('#pPersist25'); if (b) b.onclick = async () => { const ok = await askPersist25(true); renderStore25(); toast(ok ? '✔ Stockage protégé' : 'Le navigateur a refusé pour l\'instant : il accepte souvent quand SCANEBOOK est installé et utilisé régulièrement.', 6000); };
}
/* ---------- V2.26 : conversion des images et ménage ---------- */
async function migrateImgs26() {
  const t = setTimeout(() => toast('Optimisation du stockage des images (une seule fois)…', 60000), 800);
  try { const n = await DB.migrateImgs(); if (n) console.info('SCANEBOOK : ' + n + ' fiche(s) converties au stockage d\'images V2.26'); }
  catch (e) { console.warn('SCANEBOOK : conversion des images reportée', e); } // les fiches restent lisibles telles quelles
  finally { clearTimeout(t); $('#toast')?.classList.remove('on'); }
}
async function gcImgs26() {
  try { const db = await safetyDB18(), points = await new Promise((res, rej) => { const r = db.transaction('points').objectStore('points').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const n = await DB.gcImgs(collectRefs(points, new Set())); if (n) console.info('SCANEBOOK : ' + n + ' image(s) inutilisée(s) effacée(s)'); }
  catch (e) { console.warn('SCANEBOOK : ménage des images reporté', e); } // en cas de doute on ne supprime rien
}
function openSettings() {
  const cur = cfg.model, last = localStorage.getItem('scanly_lastsave');
  openModal(`<div class="dhead"><h3>Paramètres</h3><button class="x" data-close>×</button></div><div class="mbody">
    <div class="step">Langue de l’application</div>
    <label class="l" for="pLanguage">Langue</label>
    <select class="fld" id="pLanguage" aria-label="Langue de l’application" data-no-i18n>${Object.entries(window.SCANLY_I18N?.languages || {fr:'Français',en:'English',es:'Español',ko:'한국어',de:'Deutsch'}).map(([code,name]) => `<option value="${code}" ${code === (window.SCANLY_I18N?.get() || 'fr') ? 'selected' : ''}>${name}</option>`).join('')}</select>
    <p class="hint">Le choix est mémorisé sur cet appareil. Les titres, noms de meubles et données existantes ne sont pas traduits.</p>
    <div class="step">Confort et sécurité</div>
    <label class="l">Durée de l’appui long tactile</label><select class="fld" id="pHoldDelay"><option value="short" ${localStorage.getItem('scanly_hold_delay')==='short'?'selected':''}>Court (0,45 s)</option><option value="normal" ${!localStorage.getItem('scanly_hold_delay')||localStorage.getItem('scanly_hold_delay')==='normal'?'selected':''}>Normal (0,6 s)</option><option value="long" ${localStorage.getItem('scanly_hold_delay')==='long'?'selected':''}>Long (0,9 s)</option></select>
    <div class="btns"><button type="button" class="btn s" id="pSafety">Points de restauration</button><button type="button" class="btn s" id="pReview">À vérifier</button><button type="button" class="btn s" id="pWish">Souhaits</button></div>
    <div class="step">Sources bibliographiques</div>
    <p class="hint">Google Books et Open Library restent les sources principales. La BnF complète uniquement les champs manquants pour un ISBN exact. Les recherches sont mémorisées localement 30 jours.</p>
    <label class="hint"><input type="checkbox" id="pBnfAuto" ${localStorage.getItem('scanly_bnf_auto')!=='0'?'checked':''}> Complément BnF automatique pour les fiches incomplètes</label>
    <div class="btns"><button class="btn s" id="pBiblioClear">Effacer le cache des recherches</button></div>
    <div class="step">Univers général</div>
    <div class="thcards" id="pTheme">${Object.entries(THEMES).map(([k, t]) => `<div class="thcard ${k === theme ? 'on' : ''}" data-th="${k}" title="${esc(t.tip || '')}"><img src="${t.img}" alt=""><b>${I(k)}${t.name}</b></div>`).join('')}</div>
    <p class="hint">Chaque meuble peut avoir son propre univers : liste ci-dessous, ou bouton épingle en haut à droite de la pièce.</p>
    <div class="step" style="margin-top:22px">Intelligence artificielle – Google Gemini</div>
    <p class="hint">Clé gratuite sur <b>aistudio.google.com</b> → « Get API key ». Elle est stockée uniquement sur ce PC.</p>
    <label class="l">Clé API</label><input class="fld" id="pKey" type="password" value="${esc(cfg.key)}" placeholder="AIza…" autocomplete="off">
    <label class="l">Modèle (bascule automatique si indisponible)</label>
    <select class="fld" id="pModel">${MODELS.map(m => `<option ${m === cur ? 'selected' : ''}>${m}</option>`).join('')}${MODELS.includes(cur) ? '' : `<option selected>${esc(cur)}</option>`}</select>
    <div class="btns"><button class="btn p" id="pSave">Enregistrer</button><button class="btn s" id="pTest">Tester la connexion</button><span class="hint" id="pMsg" style="align-self:center"></span></div>
    <div class="step" style="margin-top:22px">Meubles (ordre des zones de la vue d'ensemble)</div>
    <div id="pCases">${cases.length ? cases.map((c, i) => `<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center"><button class="btn s sm" data-cup="${c.id}" ${i ? '' : 'disabled'} title="Monter">▲</button><input class="fld" data-cid="${c.id}" value="${esc(c.name)}">
      <select class="fld" data-cth="${c.id}" style="width:auto;padding:6px" title="Univers du meuble">${['', ...Object.keys(THEMES)].map(k => `<option value="${k}" ${(c.theme || '') === k ? 'selected' : ''}>${k ? (THEMES[k].short || THEMES[k].name) : 'Univers général'}</option>`).join('')}</select>
      <label class="hint" style="white-space:nowrap">Étagères <input class="fld" data-crows="${c.id}" type="number" min="1" max="15" value="${Math.max(c.rows || 3, ...books.filter(b => b.caseId === c.id).map(b => b.row || 1))}" style="width:56px;display:inline-block;padding:5px"></label><span class="hint" style="white-space:nowrap">${books.filter(b => b.caseId === c.id && !b.wish).length} ouvr.</span><button class="btn k sm" data-cdel="${c.id}">✕</button></div>`).join('') : '<p class="hint">Aucun meuble : il sera créé au premier scan.</p>'}</div>
    <button class="btn s" id="pNewCase">＋ Nouveau meuble</button>
    <div class="step" style="margin-top:22px">Synchronisation entre appareils (iPhone, iPad, Mac, PC)</div>
    <p class="hint" style="margin-top:0">Livres, étagères, meubles, infos IA, tranches et photos d'origine sont stockés dans <b>ton dépôt GitHub privé</b> (gratuit) et retrouvés sur tes autres appareils. Procédure de création : fichier INSTALLER_SUR_IPHONE_IPAD_MAC.txt.</p>
    <div class="g2"><div><label class="l">Pseudo GitHub</label><input class="fld" id="syOwner" value="${esc(SY.owner)}" placeholder="ton-pseudo" autocapitalize="off" autocorrect="off"></div>
      <div><label class="l">Dépôt privé</label><input class="fld" id="syRepo" value="${esc(SY.repo)}" autocapitalize="off" autocorrect="off"></div></div>
    <label class="l">Jeton d'accès GitHub ${SY.token ? '(enregistré – laisse vide pour le garder)' : ''}</label><input class="fld" id="syToken" type="password" placeholder="github_pat_…" autocomplete="off"><p class="hint">Conseil sécurité : crée un jeton « Fine-grained » limité au seul dépôt de données (Repository access › Only select repositories), avec uniquement la permission Contents : Read and write, et une date d'expiration.</p>
    <div class="g2"><div><label class="l">Nom de cet appareil</label><input class="fld" id="syDev" value="${esc(SY.device)}"></div>
      <div><label class="l">&nbsp;</label><label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="syAuto" ${SY.auto ? 'checked' : ''} style="accent-color:var(--navy)"> Synchronisation automatique</label></div></div>
    <div class="btns"><button class="btn s" id="syTest">Tester</button><button class="btn g" id="syPush">⬆ Envoyer cette bibliothèque</button><button class="btn p" id="syPull">⬇ Récupérer depuis GitHub</button><button class="btn s" id="syOff">Déconnecter</button></div>
    <p class="hint" id="syInfo"></p><p class="hint" id="syMsg"></p>
    <div class="step" style="margin-top:22px">Sauvegarde et exports</div>
    <p class="hint">Les données sont stockées dans ce navigateur. Tu choisis à chaque fois où enregistrer, dans l'explorateur Windows (PC, clé USB, OneDrive…). Dernière sauvegarde : <b>${last ? new Date(last).toLocaleString('fr-FR') : 'jamais'}</b></p>
    <p class="hint" id="pStore25"><span class="spin"></span></p>
    <div class="btns"><button class="btn g" id="pExp">Enregistrer une sauvegarde… (Ctrl+S)</button><button class="btn s" id="pImp">Ouvrir une sauvegarde…</button></div>
    <div class="btns"><button class="btn s" id="pCsv">Exporter pour Excel (CSV)…</button><button class="btn s" id="pImg">Image de la bibliothèque…</button><button class="btn s" id="pPdf">Inventaire PDF (assurance)…</button></div>
    <p class="hint">iPhone : le fichier de sauvegarde est compatible avec BiblioScan, dans les deux sens.</p>
    <div class="step" style="margin-top:22px">Corbeille</div><div id="pTrash"><p class="hint"><span class="spin"></span></p></div>
    <div class="btns"><button class="btn s" id="pStraight" title="Re-détourage précis et redressement vertical de toutes les tranches photographiées">Redresser toutes les tranches photo</button><button class="btn s" id="pCov" title="Recherche une couverture propre à chaque tome (séries dont plusieurs tomes ont le même visuel)">Corriger les couvertures</button><button class="btn s" id="pCov21" title="Revérifie toutes les couvertures trouvées automatiquement : une couverture qui ne correspond pas au titre est remplacée ou retirée. Les couvertures personnelles ne sont pas touchées.">Revérifier les couvertures automatiques</button><button class="btn s" id="pEnr">Compléter les fiches incomplètes</button><button class="btn k" id="pWipe">Tout effacer</button></div>
    <p class="hint" id="pInfo"></p></div>`, 'sm');
  $('#pTheme').onclick = e => { const c = e.target.closest('[data-th]'); if (!c) return; theme = c.dataset.th; localStorage.setItem('scanly_theme', theme); renderRoom(true); $$('#pTheme .thcard').forEach(x => x.classList.toggle('on', x.dataset.th === theme)); };
  const save = () => { localStorage.setItem('scanly_key', $('#pKey').value.trim()); localStorage.setItem('scanly_model', $('#pModel').value); };
  $('#pSave').onclick = () => { save(); toast('Paramètres enregistrés'); };
  $('#pTest').onclick = async () => { save(); $('#pMsg').innerHTML = '<span class="spin"></span> Test…';
    try { await gemini([{text: 'Réponds uniquement : OK'}]); $('#pMsg').innerHTML = 'Connexion réussie (' + esc(cfg.model) + ')'; } catch (e) { $('#pMsg').innerHTML = esc(e.message); } };
  $('#pCases').onchange = async e => { const t = e.target, id = t.dataset.cid || t.dataset.crows || t.dataset.cth, c = cases.find(x => x.id === id); if (!c) return;
    if (t.dataset.cid) c.name = t.value.trim() || c.name;
    else if (t.dataset.crows) { const used = Math.max(0, ...books.filter(b => b.caseId === c.id).map(b => b.row || 1)); c.rows = clamp(parseInt(t.value) || 3, Math.max(1, used), 15); t.value = c.rows; }
    else c.theme = t.value || null;
    await DB.put('cases', c); renderAll(); };
  $('#pCases').onclick = async e => {
    const up = e.target.closest('[data-cup]'); if (up) { const i = cases.findIndex(c => c.id === up.dataset.cup); if (i > 0) { const a = cases[i - 1], b = cases[i]; [a.createdAt, b.createdAt] = [b.createdAt, a.createdAt]; if (a.createdAt === b.createdAt) b.createdAt -= 1; await DB.putMany('cases', [a, b]); cases.sort((x, y) => x.createdAt - y.createdAt); renderAll(); openSettings(); } return; }
    const id = e.target.dataset.cdel; if (!id) return; const c = cases.find(x => x.id === id);
    if (!confirm(`Supprimer le meuble « ${c.name} » ? Ses ouvrages seront conservés en « Non rangés ».`)) return;
    const mv = books.filter(b => b.caseId === id);
    if (mv.length && confirm(`Supprimer aussi ses ${mv.length} livre(s) (corbeille) ?\nOK = supprimer les livres · Annuler = les garder en « Non rangés »`)) await deleteBooks(mv.map(b => b.id), 'Meuble « ' + c.name + ' »', false);
    else { mv.forEach(b => b.caseId = null); await DB.putMany('books', mv); } await DB.del('cases', id); cases = cases.filter(x => x.id !== id); renderAll(); openSettings(); };
  $('#pNewCase').onclick = async () => { const n = prompt('Nom du nouveau meuble :'); if (!n) return; curCase = (await newCase(n)).id; renderAll(); openSettings(); };
  renderStore25(); $('#pExp').onclick = backupNow; $('#pImp').onclick = openBackup; $('#pCsv').onclick = exportCsv; $('#pImg').onclick = exportImageFile; $('#pPdf').onclick = printInventory;
  $('#pStraight').onclick = e => restraightenMany(books.filter(b => !b.wish), e.currentTarget);
  $('#pCov').onclick = e => fixCovers(e.currentTarget);
  $('#pCov21').onclick = e => auditCovers21(e.currentTarget);
  $('#pEnr').onclick = async e => { const todo = books.filter(b => !b.wish && b.title && (!b.cover || !b.year || !b.isbn)); if (!todo.length) return toast('Toutes les fiches sont complètes');
    closeModal(); bgComplete(todo, true, true); };
  $('#pWipe').onclick = async () => { if (!confirm('Effacer TOUTE la bibliothèque ? Pense à enregistrer une sauvegarde avant.') || !confirm('Confirmer la suppression définitive ?')) return;
    if(!await safetyPoint18('Avant effacement de bibliothèque'))return;
    await DB.clear('books'); await DB.clear('cases'); await DB.clear('imports'); books = []; cases = []; imports = []; UNDO.stack = []; UNDO.redo = []; persistUndo(); renderAll(); closeModal(); toast('Bibliothèque vidée'); };
  const loadTrash = async () => { if (!$('#pTrash')) return; $('#pTrash').innerHTML = await trashHTML(); };
  loadTrash();
  $('#pTrash').onclick = async e => { const r = e.target.closest('[data-rest]'); if (r) { await restoreTrash(r.dataset.rest === '__all' ? null : r.dataset.rest); return loadTrash(); }
    if (e.target.id === 'trEmpty' && confirm('Vider définitivement la corbeille ?')) { await DB.clear('trash'); loadTrash(); } };
  $('#pHoldDelay').onchange=e=>localStorage.setItem('scanly_hold_delay',e.target.value);
  $('#pSafety').onclick=()=>openSafety18().catch(e=>toast(e.message));
  $('#pReview').onclick=()=>{closeModal();setView('review');};$('#pWish').onclick=()=>{closeModal();setView('wish');};
  $('#pBnfAuto').onchange=e=>localStorage.setItem('scanly_bnf_auto',e.target.checked?'1':'0');
  $('#pBiblioClear').onclick=()=>{SCANLY_SOURCES.clear();toast('Cache des recherches effacé');};
  if (window.bindSyncSettings) bindSyncSettings();
  navigator.storage?.estimate?.().then(e => { if ($('#pInfo')) $('#pInfo').textContent = `Espace utilisé : ${(e.usage / 1048576).toFixed(1)} Mo · SCANEBOOK V${VERSION}`; });
}

