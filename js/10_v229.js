/* =====================================================================
   SCANLY V2.29 – design
   1. Barre d'onglets en bas (téléphone) : Bibliothèque, Ajouter, Prêts, Souhaits, Profil
   2. En-tête allégé : la recherche devient une loupe qui s'ouvre
   3. Zoom au pincement : boutons − / + retirés sur écran tactile
   4. Paramètres en sections repliables, zone « Avancé » pour les actions irréversibles
   5. Fiche livre : grande couverture sur fond flouté
   6. Mode sombre (automatique, clair ou sombre)
   7. Petites animations (livre rangé, scan validé)
   Aucune donnée modifiée : seules des préférences d'affichage sont ajoutées
   (scanly_mode29, scanly_zoomtip29).
   ===================================================================== */

/* ---------- 6. Mode sombre ---------- */
const MODE29 = {
  get: () => localStorage.getItem('scanly_mode29') || 'auto',
  mq: matchMedia('(prefers-color-scheme: dark)'),
  apply() { const m = MODE29.get(), dark = m === 'dark' || (m === 'auto' && MODE29.mq.matches);
    document.documentElement.dataset.mode29 = dark ? 'dark' : 'light'; },
  set(m) { localStorage.setItem('scanly_mode29', m); MODE29.apply(); $$('[data-mode29]').forEach(b => b.classList.toggle('on', b.dataset.mode29 === m)); }
};
MODE29.apply();
MODE29.mq.addEventListener?.('change', () => MODE29.apply());
const modePicker29 = () => `<div class="mode29">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => `<button type="button" data-mode29="${k}" class="${MODE29.get() === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-mode29]'); if (b) MODE29.set(b.dataset.mode29); });

/* ---------- 1. Barre d'onglets ---------- */
const ICO29 = {
  lib: '<path d="M4 19V5M9 19V5M14 19l3-14 4 1-3 14z"/><path d="M3 19h18"/>',
  add: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  loan: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  wish: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'
};
const ico29 = k => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICO29[k]}</svg>`;
let tab29 = 'lib';
function setTab29(t) { tab29 = t; $$('#tabs29 button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); }
function initTabs29() {
  if ($('#tabs29')) return;
  const nav = document.createElement('nav'); nav.id = 'tabs29'; nav.setAttribute('aria-label', 'Navigation');
  nav.innerHTML = [['lib', 'Bibliothèque'], ['add', 'Ajouter'], ['loan', 'Prêts'], ['wish', 'Souhaits'], ['me', 'Profil']]
    .map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === 'lib' ? 'on' : ''}">${ico29(k)}<span>${l}</span>${k === 'loan' ? '<i class="dot29" hidden></i>' : ''}</button>`).join('');
  document.body.appendChild(nav); document.body.classList.add('tabs29');
  nav.onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; const t = b.dataset.tab;
    if (t === 'lib') { closeModal?.(); setView('lib'); setTab29('lib'); }
    else if (t === 'wish') { closeModal?.(); setView('wish'); setTab29('wish'); }
    else if (t === 'add') openAdd29();
    else if (t === 'loan') openLoans29();
    else if (t === 'me') openProfile29(); };
  updateLoanDot29();
}
function updateLoanDot29() { const d = $('#tabs29 .dot29'); if (!d) return; const n = books.filter(b => isLoaned(b) && isLate(b)).length; d.hidden = !n; d.textContent = n || ''; }
const sheetBtn29 = (id, icon, title, sub) => `<button type="button" class="sheet29-b" id="${id}"><span class="si">${icon}</span><span><b>${title}</b><small>${sub}</small></span></button>`;
function openAdd29() {
  openModal(`<div class="dhead"><h3>Ajouter</h3><button class="x" data-close>×</button></div><div class="mbody sheet29">
    ${sheetBtn29('ad29Cam', '📷', 'Photographier une étagère', 'SCANLY reconnaît toutes les tranches')}
    ${sheetBtn29('ad29Imp', '🖼', 'Importer des photos', 'Depuis la photothèque')}
    ${sheetBtn29('ad29Rf', '▥', 'Scanner plusieurs livres', 'Codes-barres à la suite')}
    ${sheetBtn29('ad29Man', '✎', 'Ajouter un livre', 'Saisie manuelle, titre ou ISBN')}
    ${sheetBtn29('ad29Csv', '⇪', 'Importer un fichier', 'Goodreads, Babelio, tableur CSV')}
  </div>`, 'sm');
  const go = f => () => { closeModal(); f(); };
  $('#ad29Cam').onclick = go(() => $('#fabCam').click()); $('#ad29Imp').onclick = go(() => $('#fabImp').click());
  $('#ad29Rf').onclick = go(() => openRafale27()); $('#ad29Man').onclick = go(() => addManual()); $('#ad29Csv').onclick = go(() => openImport27());
}
function openLoans29() {
  const L = books.filter(b => isLoaned(b)).sort((a, b) => (a.loanDue || '9999').localeCompare(b.loanDue || '9999'));
  openModal(`<div class="dhead"><h3>Prêts en cours <span class="badge">${L.length}</span></h3><button class="x" data-close>×</button></div><div class="mbody">
    ${L.length ? L.map(b => { const late = isLate(b); return `<div class="loan29${late ? ' late' : ''}"><div class="lc">${coverHTML(b)}</div><div class="lt"><b data-no-i18n>${esc(dispTitle(b))}</b>
      <small><span data-no-i18n>${esc(b.loanTo || '?')}</span>${b.loanDue ? ` · ${late ? 'en retard depuis le ' : 'à rendre le '}${fmtD(b.loanDue)}` : ''}</small></div>
      <div class="la"><button type="button" class="btn s sm" data-l29open="${b.id}">Fiche</button><button type="button" class="btn ${late ? 'g' : 's'} sm" data-l29rem="${b.id}">Relancer</button></div></div>`; }).join('')
      : '<p class="empty29">Aucun prêt en cours. Pour prêter un livre : ouvre sa fiche et renseigne « Prêté à ».</p>'}
  </div>`, 'sm');
  $('#mbox').onclick = e => { const o = e.target.closest('[data-l29open]'), r = e.target.closest('[data-l29rem]');
    if (o) { closeModal(); openBook(o.dataset.l29open); } else if (r) { const b = books.find(x => x.id === r.dataset.l29rem); closeModal(); if (b) openLoanRemind27(b); } };
}
function openProfile29() {
  const n = books.filter(b => !b.wish).length, read = books.filter(b => !b.wish && b.status === 'Lu').length, last = localStorage.getItem('scanly_lastsave');
  openModal(`<div class="dhead"><h3>Profil</h3><button class="x" data-close>×</button></div><div class="mbody sheet29">
    <div class="me29"><b>${n}</b><span>ouvrages</span><b>${read}</b><span>lus</span><b>${books.filter(b => b.wish).length}</b><span>souhaits</span></div><p class="hint" style="text-align:center;margin:0 0 4px">SCANLY V${VERSION}</p>
    ${sheetBtn29('me29Dash', '▤', 'Tableau de bord', 'Statistiques, lectures, séries')}
    ${sheetBtn29('me29Rev', '⚑', 'À vérifier', 'Doublons possibles et tranches incertaines')}
    ${sheetBtn29('me29AI', '✦', 'Assistant IA', 'Recommandations et questions sur ta bibliothèque')}
    ${sheetBtn29('me29Save', '⬇', 'Sauvegarder', last ? 'Dernière sauvegarde : ' + new Date(+last).toLocaleDateString() : 'Aucune sauvegarde pour l\'instant')}
    ${$('#hSync') && $('#hSync').style.display !== 'none' ? sheetBtn29('me29Sync', '☁', 'Synchroniser', 'Envoyer ou récupérer via GitHub') : ''}
    ${sheetBtn29('me29Set', '⚙', 'Paramètres', 'Langue, clé IA, synchronisation, sauvegardes')}
    <div class="step">Apparence</div>${modePicker29()}
  </div>`, 'sm');
  const go = (f, t) => () => { closeModal(); f(); if (t) setTab29(t); };
  $('#me29Dash').onclick = go(() => setView('dash'), 'me'); $('#me29Rev').onclick = go(() => setView('review'), 'me');
  $('#me29AI').onclick = go(() => openAI()); $('#me29Save').onclick = go(() => backupNow()); $('#me29Set').onclick = go(() => openSettings());
  if ($('#me29Sync')) $('#me29Sync').onclick = go(() => $('#hSync').click());
}
{ const orig = setView; setView = function (v) { orig.apply(this, arguments); setTab29(v === 'wish' ? 'wish' : (v === 'dash' || v === 'review') ? 'me' : 'lib'); }; }

/* ---------- 2. Recherche en loupe ---------- */
function initSearch29() {
  const hs = $('.hsearch'), q = $('#q'); if (!hs || !q || $('#qClose29')) return;
  const close = document.createElement('button'); close.type = 'button'; close.id = 'qClose29'; close.className = 'qclose29'; close.title = 'Fermer la recherche'; close.textContent = '×';
  hs.appendChild(close);
  const open = () => { if (document.body.classList.contains('search29')) return; document.body.classList.add('search29'); setTimeout(() => q.focus(), 30); };
  hs.addEventListener('click', e => { if (e.target === close) return; open(); });
  close.onclick = e => { e.stopPropagation(); if (q.value) { q.value = ''; q.dispatchEvent(new Event('input', {bubbles: true})); } document.body.classList.remove('search29'); q.blur(); };
  q.addEventListener('blur', () => setTimeout(() => { if (!q.value.trim() && document.activeElement !== q) document.body.classList.remove('search29'); }, 150));
  if (q.value) document.body.classList.add('search29');
}

/* ---------- 3. Zoom au pincement ---------- */
function initZoom29() {
  if (!IS_TOUCH) return; document.body.classList.add('touch29');
  const lbl = $('#zoomLbl'); if (lbl) { lbl.title = 'Pince l\'écran pour zoomer · toucher : tout voir'; lbl.setAttribute('role', 'button');
    lbl.onclick = () => $('#camBar [data-z="0"]')?.click(); }
  if (!localStorage.getItem('scanly_zoomtip29') && books.length) { localStorage.setItem('scanly_zoomtip29', '1'); setTimeout(() => toast('Astuce : pince l\'écran avec deux doigts pour zoomer', 4500), 6000); }
}

/* ---------- 4. Paramètres repliables ---------- */
{ const orig = openSettings; openSettings = function () { orig.apply(this, arguments); try { sections29(); } catch (e) { console.warn('SCANLY 2.29 sections', e); } }; }
function sections29() {
  const body = $('#mbox .mbody'); if (!body || body.dataset.s29) return; body.dataset.s29 = '1';
  // Apparence en tête
  const app = document.createElement('div'); app.className = 'step'; app.textContent = 'Apparence';
  const pick = document.createElement('div'); pick.innerHTML = modePicker29() + '<p class="hint">Automatique suit le réglage clair / sombre de l\'appareil.</p>';
  body.prepend(app, ...pick.childNodes);
  // Zone « Avancé » : actions irréversibles
  const wipe = $('#pWipe');
  const adv = document.createElement('div'); adv.className = 'step adv29'; adv.textContent = 'Avancé';
  const advBody = document.createElement('div'); advBody.innerHTML = '<p class="hint">Actions irréversibles. Enregistre une sauvegarde avant de les utiliser.</p><div class="btns" id="adv29"></div>';
  body.append(adv, ...advBody.childNodes);
  if (wipe) { const host = wipe.parentElement; $('#adv29').appendChild(wipe); if (host && !host.children.length) host.remove(); }
  // Regroupement en <details> à partir de chaque titre .step
  const kids = [...body.children]; let cur = null, i = 0; const openKey = localStorage.getItem('scanly_setsec29');
  for (const el of kids) {
    if (el.classList.contains('step')) { cur = document.createElement('details'); cur.className = 'sec29' + (el.classList.contains('adv29') ? ' adv29' : ''); const sum = document.createElement('summary');
      el.removeAttribute('style'); sum.appendChild(el); cur.appendChild(sum); cur.dataset.k = String(i++);
      if (openKey === cur.dataset.k || (openKey == null && i === 1)) cur.open = true;
      cur.addEventListener('toggle', function () { if (this.open) { localStorage.setItem('scanly_setsec29', this.dataset.k); $$('#mbox details.sec29').forEach(d => { if (d !== this) d.open = false; }); } });
      body.appendChild(cur); continue; }
    if (cur) cur.appendChild(el); }
}

/* ---------- 5. Fiche livre : couverture sur fond flouté ---------- */
{ const orig = openBook; openBook = function (idOrBook, isNew) { orig.apply(this, arguments);
  try { const b = isNew ? idOrBook : books.find(x => x.id === idOrBook), top = $('#dBody .det-top'); if (!b || !top) return;
    top.classList.add('hero29'); const col = colOf(b);
    top.style.setProperty('--hero29', b.cover && !/["\\)]/.test(b.cover) ? `url("${b.cover}")` : `linear-gradient(135deg,${col},${shade(col, .55)})`);
  } catch (e) { console.warn('SCANLY 2.29 fiche', e); } }; }

/* ---------- 7. Animations ---------- */
const RM29 = matchMedia('(prefers-reduced-motion: reduce)');
let place29 = null;
const placeKey29 = b => (b.wish ? 'w' : '') + caseOf(b) + '|' + (b.row || 1) + '|' + (b.position || 0);
{ const orig = renderAll; renderAll = function () { orig.apply(this, arguments);
  try { updateLoanDot29(); const now = new Map(books.map(b => [b.id, placeKey29(b)]));
    if (place29 && !RM29.matches) { const moved = books.filter(b => place29.get(b.id) !== now.get(b.id));
      if (moved.length && moved.length <= 40) requestAnimationFrame(() => moved.forEach((b, i) => { const el = $(`#unit .book[data-id="${b.id}"]`); if (!el) return;
        el.style.animationDelay = Math.min(i * 40, 600) + 'ms'; el.classList.remove('pop29'); void el.offsetWidth; el.classList.add('pop29');
        el.addEventListener('animationend', () => { el.classList.remove('pop29'); el.style.animationDelay = ''; }, {once: true}); })); }
    place29 = now; } catch (e) {} }; }
const OK29 = /^(✔|☁)|ajouté|rangé|enregistré|importé|restauré|synchronisée|complétée|trouvée|copié|Acheté|activés/i;
{ const orig = toast; toast = function (m) { orig.apply(this, arguments); const t = $('#toast'); if (!t) return;
  t.classList.toggle('ok29', OK29.test(String(m)) && !/impossible|refus|erreur|indisponible|aucun/i.test(String(m)));
  if (!RM29.matches) { t.classList.remove('bump29'); void t.offsetWidth; t.classList.add('bump29'); } }; }

/* ---------- Démarrage ---------- */
function boot29() { const hs = $('#hSet'); if (hs) hs.onclick = () => openSettings(); /* V2.29 : le bouton ⚙ appelait l'ancienne version (sans les sections V2.27) */
  initTabs29(); initSearch29(); initZoom29(); updateLoanDot29(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot29, 0)); else setTimeout(boot29, 0);

/* V2.32 : repère le mode app (écran d'accueil) pour la règle html.app32 de scanly.css. */
function appMode32() { const sa = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  document.documentElement.classList.toggle('app32', sa); }
appMode32();
