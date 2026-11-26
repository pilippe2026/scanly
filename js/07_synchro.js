/* SCANLY – 07_synchro.js : Synchronisation GitHub entre appareils.
   Les fichiers js/ sont chargés dans l'ordre par index.html et partagent les mêmes variables globales. */
'use strict';
/* =====================================================================
   V2.4 – SYNCHRONISATION ENTRE APPAREILS (iPhone, iPad, Mac, PC)
   Stockage : un dépôt GitHub PRIVÉ personnel (gratuit), via l'API GitHub.
   - scanly-data/core.json : livres, meubles, étagères, imports, corbeille,
     infos IA, séries, univers (sans les images) ;
   - scanly-data/img/<empreinte>.txt : tranches photo et photos d'origine,
     envoyées une seule fois (seules les nouvelles images partent).
   Chaque envoi = un « commit » horodaté (appareil + date) : historique complet.
   ===================================================================== */
const SY = {
  get owner() { return (localStorage.getItem('scanly_gh_owner') || '').trim(); }, get repo() { return (localStorage.getItem('scanly_gh_repo') || 'scanly-data').trim(); },
  get token() { return (localStorage.getItem('scanly_gh_token') || '').trim(); }, get auto() { return localStorage.getItem('scanly_sync_auto') !== '0'; },
  get device() { return localStorage.getItem('scanly_device') || (/iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /Mac/.test(navigator.platform) ? 'Mac' : /Win/.test(navigator.platform) ? 'PC' : 'Appareil'); },
  get last() { try { return JSON.parse(localStorage.getItem('scanly_sync_last') || 'null'); } catch (e) { return null; } },
  set last(v) { localStorage.setItem('scanly_sync_last', JSON.stringify(v)); },
  get dirty() { return localStorage.getItem('scanly_sync_dirty') === '1'; }, set dirty(v) { localStorage.setItem('scanly_sync_dirty', v ? '1' : '0'); syncPill(); },
  busy: false, mute: 0, timer: 0, branch: null, err: ''
};
const syncOn = () => !!(SY.owner && SY.repo && SY.token);
const DIR = 'scanly-data', IMGP = DIR + '/img/', TAG = '§img:';
async function gh(path, method = 'GET', body) {
  const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(SY.owner)}/${encodeURIComponent(SY.repo)}${path}`, {method, cache: 'no-store',
    headers: {Authorization: 'Bearer ' + SY.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type': 'application/json'} : {})}, body: body ? JSON.stringify(body) : undefined});
  if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch (e) {} const er = new Error(r.status === 401 ? 'Jeton GitHub refusé (vérifie le jeton ou sa date d\'expiration)' : r.status === 404 ? 'Dépôt introuvable (vérifie le pseudo, le nom du dépôt et les droits du jeton)' : r.status === 403 ? 'Accès refusé par GitHub : le jeton doit avoir « Contents : Read and write » sur ce dépôt' : `GitHub ${r.status} ${m}`); er.status = r.status; er.msg = m; throw er; }
  return r.status === 204 ? null : r.json();
}
const b64utf8 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768)); return btoa(bin); };
const utf8b64 = b => { const bin = atob(b.replace(/\s/g, '')), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder('utf-8').decode(u); };
async function sha1(s) { const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const isImg = v => typeof v === 'string' && v.startsWith('data:image') && v.length > 600;
async function extern(o, imgs) { // remplace les images par leur empreinte
  if (Array.isArray(o)) return Promise.all(o.map(v => extern(v, imgs)));
  if (isImg(o)) { const h = await sha1(o); imgs.set(h, o); return TAG + h; }
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = await extern(o[k], imgs); return r; }
  return o;
}
function intern(o, imgs) {
  if (Array.isArray(o)) return o.map(v => intern(v, imgs));
  if (typeof o === 'string' && o.startsWith(TAG)) return imgs.get(o.slice(TAG.length)) || null;
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = intern(o[k], imgs); return r; }
  return o;
}
async function snapshot() {
  const imgs = new Map(), trash = await DB.all('trash').catch(() => []);
  const core = {app: 'SCANLY', version: VERSION, date: new Date().toISOString(), device: SY.device,
    books: await extern(books, imgs), cases: await extern(cases, imgs), imports: await extern(imports, imgs), trash: await extern(trash, imgs),
    seriesMeta: SMETA, settings: {theme: localStorage.getItem('scanly_theme') || '', ghost: localStorage.getItem('scanly_ghost'), photo: localStorage.getItem('scanly_photo'), types: [...TYPES]}};
  return {core, imgs};
}
async function headInfo() { // dernier envoi présent sur GitHub
  if (!SY.branch) { const rp = await gh(''); SY.branch = rp.default_branch || 'main'; SY.private = rp.private; }
  let ref; try { ref = await gh('/git/ref/heads/' + SY.branch); } catch (e) { if (e.status === 409 || e.status === 404) return {empty: true}; throw e; }
  const c = await gh('/git/commits/' + ref.object.sha), m = /SCANLY · (.+?) · (\S+)/.exec(c.message || '');
  return {sha: ref.object.sha, tree: c.tree.sha, device: m ? m[1] : '?', date: m ? m[2] : c.committer?.date, hasData: !!m};
}
function syncPill(state) {
  const b = $('#hSync'); if (!b) return; if (!syncOn()) { b.style.display = 'none'; return; } b.style.display = '';
  const st = state || (SY.busy ? 'busy' : SY.err ? 'err' : SY.dirty ? 'dirty' : 'ok');
  b.dataset.st = st; b.title = {busy: 'Synchronisation en cours…', err: 'Synchronisation : ' + SY.err + ' (clic pour réessayer)', dirty: 'Modifications à envoyer (clic pour synchroniser)', ok: 'Bibliothèque synchronisée' + (SY.last ? ' – ' + new Date(SY.last.date).toLocaleString('fr-FR') : '')}[st];
  b.innerHTML = st === 'busy' ? '<span class="spin"></span>' : `<span data-i="cloud">${I('cloud')}</span>`;
}
function syncMsg(t) { const m = $('#syMsg'); if (m) m.innerHTML = t; }
async function syncPush(force = false) {
  if (!syncOn() || SY.busy) return; SY.busy = true; SY.err = ''; syncPill(); syncMsg('<span class="spin"></span> Envoi…');
  try {
    let h = await headInfo();
    if (h.empty) { await gh(`/contents/${DIR}/LISEZMOI.md`, 'PUT', {message: 'SCANLY : création du stockage', content: b64utf8('Stockage des données SCANLY (ne pas modifier à la main).\n')}); h = await headInfo(); }
    if (!force && h.hasData && SY.last && h.sha !== SY.last.sha) { SY.busy = false; syncPill(); return syncConflict(h); }
    if (!force && h.hasData && !SY.last && (books.length || cases.length)) { SY.busy = false; syncPill(); return syncConflict(h); }
    const {core, imgs} = await snapshot(), tree = await gh(`/git/trees/${h.tree}?recursive=1`), have = new Set(tree.tree.map(t => t.path));
    const todo = [...imgs.keys()].filter(k => !have.has(IMGP + k + '.txt')), entries = []; let n = 0;
    await pool(todo, 4, async k => { const bl = await gh('/git/blobs', 'POST', {content: imgs.get(k), encoding: 'utf-8'}); entries.push({path: IMGP + k + '.txt', mode: '100644', type: 'blob', sha: bl.sha}); n++; syncMsg(`<span class="spin"></span> Envoi des images ${n}/${todo.length}…`); });
    if (entries.length < todo.length) throw new Error('certaines images n\'ont pas pu être envoyées, réessaie');
    const cb = await gh('/git/blobs', 'POST', {content: JSON.stringify(core), encoding: 'utf-8'}); entries.push({path: DIR + '/core.json', mode: '100644', type: 'blob', sha: cb.sha});
    const nt = await gh('/git/trees', 'POST', {base_tree: h.tree, tree: entries});
    const date = new Date().toISOString(), cm = await gh('/git/commits', 'POST', {message: `SCANLY · ${SY.device} · ${date} · ${books.filter(b => !b.wish).length} livres`, tree: nt.sha, parents: [h.sha]});
    await gh('/git/refs/heads/' + SY.branch, 'PATCH', {sha: cm.sha, force: false});
    SY.last = {sha: cm.sha, date, device: SY.device}; SY.dirty = false;
    syncMsg(`Envoyé : ${books.filter(b => !b.wish).length} livres, ${todo.length} nouvelle(s) image(s)`); toast('☁ Bibliothèque envoyée', 2500);
  } catch (e) { SY.err = e.message; syncMsg('⚠ ' + esc(e.message)); toast('Synchronisation : ' + e.message, 6000); }
  SY.busy = false; syncPill(); renderSyncInfo();
}
async function syncPull(h) {
  if (!syncOn() || SY.busy) return; SY.busy = true; SY.err = ''; syncPill(); syncMsg('<span class="spin"></span> Récupération…');
  try {
    h = h || await headInfo(); if (!h.hasData) throw new Error('aucune bibliothèque sur GitHub pour l\'instant : fais d\'abord « Envoyer » depuis l\'appareil principal');
    const tree = await gh(`/git/trees/${h.tree}?recursive=1`), map = new Map(tree.tree.map(t => [t.path, t.sha]));
    const core = JSON.parse(utf8b64((await gh('/git/blobs/' + map.get(DIR + '/core.json'))).content));
    const need = new Set(); JSON.stringify(core, (k, v) => { if (typeof v === 'string' && v.startsWith(TAG)) need.add(v.slice(TAG.length)); return v; });
    const local = new Map(); for (const v of [...books, ...imports].flatMap(o => [o.spineImg, o.spineOrig, ...(o.photos || []), ...(o.hd || [])]).filter(isImg)) { const k = await sha1(v); if (need.has(k)) local.set(k, v); }
    const todo = [...need].filter(k => !local.has(k) && map.has(IMGP + k + '.txt')); let n = 0;
    await pool(todo, 5, async k => { const bl = await gh('/git/blobs/' + map.get(IMGP + k + '.txt')); local.set(k, utf8b64(bl.content)); n++; syncMsg(`<span class="spin"></span> Images ${n}/${todo.length}…`); });
    const d = intern(core, local);
    if(!await safetyPoint18('Avant récupération depuis un autre appareil')){SY.busy=false;syncPill();return;}
    SY.mute++;
    try { await DB.replaceAll(d); } finally { SY.mute--; } // V2.26 : une seule transaction, jamais de bibliothèque à moitié écrite
    if (d.seriesMeta) { SMETA = d.seriesMeta; localStorage.setItem('scanly_series', JSON.stringify(SMETA)); }
    if (d.settings?.theme && THEMES[d.settings.theme]) { theme = d.settings.theme; localStorage.setItem('scanly_theme', theme); }
    if (Array.isArray(d.settings?.types)) applyTypesSetting20(d.settings.types);
    UNDO.stack = []; UNDO.redo = []; persistUndo(); SEL.clear();
    await load(); rt = activeTheme(); applyTheme(); renderAll(); renderRoom(true);
    SY.last = {sha: h.sha, date: h.date, device: h.device}; SY.dirty = false;
    syncMsg(`Récupéré : ${books.filter(b => !b.wish).length} livres (envoyés depuis ${esc(h.device)})`); toast(`☁ Bibliothèque récupérée depuis ${h.device}`, 3500);
  } catch (e) { SY.err = e.message; syncMsg('⚠ ' + esc(e.message)); toast('Synchronisation : ' + e.message, 6000); }
  SY.busy = false; syncPill(); renderSyncInfo();
}
function syncConflict(h) {
  openModal(`<div class="dhead"><h3>Deux versions de la bibliothèque</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p>Une version plus récente a été envoyée depuis <b>${esc(h.device)}</b> le <b>${new Date(h.date).toLocaleString('fr-FR')}</b>, et cet appareil (${esc(SY.device)}) a aussi des modifications.</p>
    <p class="hint">Les deux versions restent dans l'historique GitHub : rien n'est définitivement perdu.</p>
    <div class="btns"><button class="btn g" id="scPull">Récupérer la version de ${esc(h.device)}</button><button class="btn s" id="scPush">Garder celle de cet appareil et l'envoyer</button><button class="btn s" data-close>Plus tard</button></div></div>`, 'sm');
  $('#scPull').onclick = () => { closeModal(); syncPull(h); }; $('#scPush').onclick = () => { closeModal(); syncPush(true); };
}
async function syncNow() { // bouton ☁ : récupère si une version plus récente existe, sinon envoie
  if (!syncOn()) return openSettings(); if (SY.busy) return;
  try { const h = await headInfo(); const remoteNew = h.hasData && (!SY.last || h.sha !== SY.last.sha);
    if (remoteNew && (SY.dirty || (!SY.last && books.length))) return syncConflict(h);
    if (remoteNew) return syncPull(h); return syncPush(); }
  catch (e) { SY.err = e.message; syncPill(); toast('Synchronisation : ' + e.message, 6000); }
}
async function syncBoot() {
  syncPill(); if (!syncOn() || !SY.auto) return;
  try { const h = await headInfo(); if (!h.hasData) return SY.dirty || books.length ? syncPush() : null;
    if (SY.last && h.sha === SY.last.sha) { if (SY.dirty) syncPush(); return; }
    if (!SY.dirty && (SY.last || !books.length)) return syncPull(h);
    syncConflict(h);
  } catch (e) { SY.err = e.message; syncPill(); }
}
/* toute modification enregistrée -> envoi automatique 20 s plus tard */
['put', 'putMany', 'del', 'delMany', 'clear'].forEach(m => { const f = DB[m].bind(DB); DB[m] = async (...a) => { const r = await f(...a);
  if (!SY.mute && ['books', 'cases', 'imports', 'trash'].includes(a[0])) { SY.dirty = true; if (syncOn() && SY.auto) { clearTimeout(SY.timer); SY.timer = setTimeout(() => syncPush(), 20000); } } return r; }; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && SY.dirty && syncOn() && SY.auto && !SY.busy) { clearTimeout(SY.timer); syncPush(); } });
function renderSyncInfo() { const el = $('#syInfo'); if (!el) return; const L = SY.last;
  el.innerHTML = !syncOn() ? 'Non configurée.' : `${SY.private === false ? '<b style="color:var(--ko)">⚠ Ce dépôt est PUBLIC : rends-le privé (Settings › General › Change visibility).</b><br>' : ''}Cet appareil : <b>${esc(SY.device)}</b> · ${L ? `dernière synchro le ${new Date(L.date).toLocaleString('fr-FR')} (${esc(L.device)})` : 'jamais synchronisé'}${SY.dirty ? ' · <b>modifications à envoyer</b>' : ''}${tokenWarn26()}`; }
/* V2.26 : un jeton « classique » (ghp_…) donne accès à TOUS les dépôts du compte : on le signale */
const tokenWarn26 = () => /^gh[ops]_/.test(SY.token) ? '<br><b style="color:var(--ko)">⚠ Jeton « classique » : il donne accès à tous tes dépôts. Remplace-le par un jeton « Fine-grained » limité au dépôt de données.</b>' : '';
function bindSyncSettings() {
  if (!$('#syOwner')) return; renderSyncInfo();
  const save = () => { localStorage.setItem('scanly_gh_owner', $('#syOwner').value.trim()); localStorage.setItem('scanly_gh_repo', $('#syRepo').value.trim() || 'scanly-data');
    if ($('#syToken').value.trim()) localStorage.setItem('scanly_gh_token', $('#syToken').value.trim()); localStorage.setItem('scanly_device', $('#syDev').value.trim() || SY.device);
    localStorage.setItem('scanly_sync_auto', $('#syAuto').checked ? '1' : '0'); SY.branch = null; syncPill(); renderSyncInfo(); };
  ['#syOwner', '#syRepo', '#syToken', '#syDev', '#syAuto'].forEach(s => $(s).onchange = save);
  $('#syTest').onclick = async () => { save(); syncMsg('<span class="spin"></span> Test…'); try { const h = await headInfo();
      syncMsg(`✔ Connexion réussie au dépôt ${SY.private ? 'privé' : '<b style="color:var(--ko)">PUBLIC</b>'} « ${esc(SY.repo)} ». ${h.hasData ? `Une bibliothèque y est déjà stockée (envoyée depuis ${esc(h.device)} le ${new Date(h.date).toLocaleString('fr-FR')}).` : 'Aucune bibliothèque stockée pour l\'instant.'}${tokenWarn26()}`); renderSyncInfo(); }
    catch (e) { syncMsg('⚠ ' + esc(e.message)); } };
  $('#syPush').onclick = () => { save(); syncPush(true); }; $('#syPull').onclick = async () => { save(); if (books.length && !confirm('Remplacer la bibliothèque de cet appareil par celle stockée sur GitHub ?')) return; syncPull(); };
  $('#syOff').onclick = () => { if (!confirm('Déconnecter cet appareil de la synchronisation ? (les données restent sur l\'appareil et sur GitHub)')) return;
    ['scanly_gh_token', 'scanly_sync_last'].forEach(k => localStorage.removeItem(k)); $('#syToken').value = ''; syncPill(); renderSyncInfo(); syncMsg('Synchronisation désactivée sur cet appareil.'); };
}
window.syncBoot = syncBoot; window.bindSyncSettings = bindSyncSettings;

