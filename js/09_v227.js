/* SCANLY – 09_v227.js : nouveautés V2.27.
   1. Scan d'ISBN en rafale          5. Étiquettes libres et listes personnelles
   2. Rappels de prêt et relance     6. Liste de souhaits partageable
   3. Import Goodreads/Babelio/CSV   7. Alertes de parution des séries
   4. Suivi de lecture et objectif   8. Bibliothèque familiale (plusieurs lecteurs)
   Données ajoutées aux fiches (facultatives, ignorées par les anciennes versions) :
     b.page (page en cours), b.readStart (commencé le), b.tags (étiquettes),
     b.readers27 = {« Prénom » : {status, date, page}} pour les autres lecteurs,
     b.loanReminded (date de la dernière relance), b.loanNotified (dernière notification).
   Réglages (synchronisés) : scanly_readers27 (lecteurs), scanly_goal27 (objectifs annuels).
   Ce fichier se branche sur les fonctions existantes sans les modifier. */
'use strict';

/* ---------- Réglages partagés ---------- */
const V27 = {
  get readers() { try { const r = JSON.parse(localStorage.getItem('scanly_readers27') || 'null'); return Array.isArray(r) && r.length ? r : ['Moi']; } catch (e) { return ['Moi']; } },
  set readers(v) { localStorage.setItem('scanly_readers27', JSON.stringify(v)); try { SY.dirty = true; } catch (e) {} },
  get me() { return this.readers[0]; },
  get others() { return this.readers.slice(1); },
  get goals() { try { return JSON.parse(localStorage.getItem('scanly_goal27') || '{}') || {}; } catch (e) { return {}; } },
  set goals(v) { localStorage.setItem('scanly_goal27', JSON.stringify(v)); try { SY.dirty = true; } catch (e) {} },
  goal(year, reader) { return Number(this.goals[year + '|' + (reader || this.me)]) || 0; }
};
/* statut de lecture d'un livre pour un lecteur (le premier lecteur = les champs habituels de la fiche) */
function readOf27(b, reader) {
  if (!reader || reader === V27.me) return {status: b.status === 'Prêté' ? (b.prevStatus || 'À lire') : (b.status || 'À lire'), date: b.readDate || '', page: b.page || null};
  const r = (b.readers27 || {})[reader] || {}; return {status: r.status || 'À lire', date: r.date || '', page: r.page || null};
}
const readIn27 = (b, reader, year) => { const r = readOf27(b, reader); return r.status === 'Lu' && String(r.date || '').startsWith(String(year)); };
const tagsOf27 = b => Array.isArray(b.tags) ? b.tags : [];
const allTags27 = () => [...new Set(books.flatMap(tagsOf27))].sort((a, b) => a.localeCompare(b, 'fr'));
const parseTags27 = s => [...new Set(String(s || '').split(/[,;\n]/).map(t => t.trim().replace(/\s+/g, ' ')).filter(Boolean).map(t => t.slice(0, 40)))];
const pct27 = (b, page) => b.pages && page ? Math.min(100, Math.round(page / b.pages * 100)) : null;
const beep27 = (() => { let ctx = null; return (ok = true) => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = ok ? 1320 : 330; g.gain.value = .08; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ok ? .09 : .25)); if (navigator.vibrate) navigator.vibrate(ok ? 40 : [60, 40, 60]); } catch (e) {} }; })();

/* =====================================================================
   1. SCAN D'ISBN EN RAFALE
   ===================================================================== */
function openRafale27() {
  const R = {items: [], seen: new Set(), done: false};
  openModal(`<div class="dhead"><h3>Scanner plusieurs livres</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint" style="margin-top:0">Présente les codes-barres l'un après l'autre : chaque code lu fait un bip et s'ajoute à la liste. Range tout à la fin.</p>
    <div class="camwrap" style="aspect-ratio:16/9"><video id="bcVid" autoplay playsinline muted></video><div class="camframe" style="inset:22% 14%"><i></i><i></i><i></i><i></i></div>
      <div class="camoff" id="bcOff">${I('isbn')}<div>Activation de la caméra…</div></div></div>
    <div class="btns"><button class="btn p" id="rfRead">Lire le code (IA)</button><span class="hint" id="rfMsg" style="align-self:center"></span></div>
    <div style="display:flex;gap:8px;margin-top:8px"><input class="fld" id="rfIn" placeholder="Ou tape un ISBN puis Entrée" inputmode="numeric"><button class="btn g" id="rfAdd">Ajouter</button></div>
    <div id="rfList" class="rf27-list"></div>
    <div class="rf27-end">
      <div class="g3"><div><label class="l">Ranger dans</label><select class="fld" id="rfCase"><option value="">Non rangé (catalogue)</option>${cases.map(c => `<option value="${c.id}" ${c.id === defaultCase() ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__wish">Liste de souhaits</option></select></div>
        <div><label class="l">Étagère (1 = haut)</label><input class="fld" id="rfRow" type="number" min="1" max="15" value="1"></div>
        <div><label class="l">Statut</label><select class="fld" id="rfStatus">${STATUS.filter(s => s !== 'Prêté').map(s => `<option>${s}</option>`).join('')}</select></div></div>
      <div class="btns"><button class="btn p" id="rfSave" disabled>Ranger les livres</button></div></div></div>`, 'sm');
  const msg = t => { const m = $('#rfMsg'); if (m) m.textContent = t; };
  const draw = () => { const el = $('#rfList'); if (!el) return;
    el.innerHTML = R.items.length ? R.items.map((it, i) => `<div class="rf27-item ${it.state}"><span class="rf27-n">${i + 1}</span><div style="flex:1;min-width:0"><b data-no-i18n>${esc(it.r?.title || it.isbn)}</b><div class="hint" data-no-i18n>${it.state === 'wait' ? 'Recherche…' : it.state === 'ko' ? 'Introuvable : la fiche sera à compléter' : esc(it.r?.author || '')}${it.dup ? ' · <b style="color:var(--ko)">déjà dans ta bibliothèque</b>' : ''}</div></div><button class="x" data-rm="${i}" title="Retirer">×</button></div>`).join('')
      : '<p class="hint">Aucun livre pour l\'instant.</p>';
    const ok = R.items.filter(it => it.state !== 'wait').length; $('#rfSave').disabled = !R.items.length || ok < R.items.length;
    $('#rfSave').textContent = R.items.length ? `Ranger ${R.items.length} livre${R.items.length > 1 ? 's' : ''}` : 'Ranger les livres'; };
  let queue = Promise.resolve();
  const add = code => { const c = cleanIsbn(code); if (c.length !== 10 && c.length !== 13) { msg('Code incomplet : réessaie.'); return; }
    if (!isbnValid(c)) { beep27(false); msg(`Code ${c} incorrect (clé de contrôle).`); return; }
    if (R.seen.has(c)) { msg('Déjà dans la liste.'); return; } R.seen.add(c); beep27(true);
    const it = {isbn: c, state: 'wait', dup: books.some(x => !x.wish && x.isbn && cleanIsbn(x.isbn) === c)}; R.items.push(it); msg(`${R.items.length} livre(s) scanné(s)`); draw();
    queue = queue.then(async () => { try { it.r = await isbnLookup(c); it.state = it.r.found ? 'ok' : 'ko'; } catch (e) { it.state = 'ko'; } draw(); }); };
  $('#rfAdd').onclick = () => { add($('#rfIn').value); $('#rfIn').value = ''; $('#rfIn').focus(); };
  $('#rfIn').onkeydown = e => { if (e.key === 'Enter') $('#rfAdd').onclick(); };
  $('#rfList').onclick = e => { const x = e.target.closest('[data-rm]'); if (!x) return; const [it] = R.items.splice(+x.dataset.rm, 1); R.seen.delete(it.isbn); draw(); };
  $('#rfCase').onchange = () => { $('#rfRow').disabled = !$('#rfCase').value || $('#rfCase').value === '__wish'; };
  $('#rfCase').onchange();
  $('#rfRead').onclick = async () => { const v = $('#bcVid'); if (!v || !v.videoWidth) return toast('Caméra non disponible : tape l\'ISBN'); msg('Lecture du code…');
    try { const o = await gemini([{text: 'Lis le code-barres EAN-13 / ISBN visible sur cette image. Réponds en JSON {"isbn":"chiffres uniquement, ou null"}.'}, {inlineData: {mimeType: 'image/jpeg', data: resize(v, 1280, .92).split(',')[1]}}], {json: true}); if (o && o.isbn) add(o.isbn); else msg('Code non lu : rapproche le livre et réessaie.'); }
    catch (e) { msg(e.message); } };
  $('#rfSave').onclick = async () => {
    const dest = $('#rfCase').value, wish = dest === '__wish', caseId = wish ? null : dest || null, row = clamp(parseInt($('#rfRow').value) || 1, 1, 15), status = $('#rfStatus').value;
    if (!await safetyPoint18('Avant ajout de livres scannés')) return;
    const made = []; let pos = caseId ? nextPos(caseId, row) : null;
    for (const it of R.items) { const b = newBook({caseId, row: caseId ? row : 1, position: caseId ? pos++ : null, wish, status}); if (it.r) applyIsbn(b, it.r); b.isbn = it.isbn; if (!b.title) b.unknown = true; b.addedAt = Date.now(); made.push(b); }
    const c = cases.find(x => x.id === caseId); if (c && (c.rows || 3) < row) { c.rows = row; await DB.put('cases', c); }
    await DB.putMany('books', made); books.push(...made); R.done = true; closeModal(); renderAll();
    toast(`${made.length} livre(s) ajouté(s)${made.some(b => b.unknown) ? ' – certains sont à compléter (vue « À vérifier »)' : ''}`, 5000); };
  modalLeaveGuard = () => R.done || !R.items.length || confirm('Fermer sans ranger les livres scannés ?');
  draw();
  (async () => {
    try { stopCam(); stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false}); if (!$('#bcVid')) return stopCam(); $('#bcVid').srcObject = stream; $('#bcOff').style.display = 'none'; }
    catch (e) { const off = $('#bcOff'); if (off) off.innerHTML = `${I('isbn')}<div>Caméra indisponible : tape les ISBN ci-dessous.</div>`; return; }
    let det = null; if ('BarcodeDetector' in window) { try { if ((await window.BarcodeDetector.getSupportedFormats()).includes('ean_13')) det = new window.BarcodeDetector({formats: ['ean_13', 'ean_8', 'upc_a']}); } catch (e) {} }
    msg(det ? 'Détection automatique : passe les livres un par un.' : 'Touche « Lire le code » pour chaque livre (ou tape l\'ISBN).');
    if (!det) return; let last = '', lastAt = 0;
    const loop = async () => { if (!stream || !$('#bcVid') || R.done) return; try { const r = await det.detect($('#bcVid')), c = r.find(x => /^97[89]\d{10}$/.test(x.rawValue)) || r[0];
      if (c && (c.rawValue !== last || Date.now() - lastAt > 4000)) { last = c.rawValue; lastAt = Date.now(); add(c.rawValue); } } catch (e) {} setTimeout(loop, 350); };
    loop(); })();
}
const addManual27 = addManual;
addManual = function () { addManual27.apply(this, arguments); const box = $('#mbox .mbody'); if (!box || $('#aRafale27')) return;
  const d = document.createElement('div'); d.innerHTML = `<div class="step" style="margin-top:20px"><i>4</i>Ou plusieurs livres à la suite</div><p class="hint" style="margin-top:0">Scanne une pile de livres d'un coup, puis range-les ensemble.</p><button class="btn g" id="aRafale27">${I('isbn')} Scanner plusieurs livres</button>`;
  box.append(d); $('#aRafale27').onclick = () => { closeModal(); openRafale27(); }; };

/* =====================================================================
   2. RAPPELS DE PRÊT : notification + message de relance
   ===================================================================== */
function loanText27(b) { const late = isLate(b);
  return `Bonjour ${b.loanTo || ''},\n\nJe t'ai prêté « ${dispTitle(b)} »${b.author ? ' de ' + b.author : ''}${b.loanDate ? ' le ' + fmtD(b.loanDate) : ''}.${b.loanDue ? (late ? ` Le retour était prévu le ${fmtD(b.loanDue)}.` : ` Le retour est prévu le ${fmtD(b.loanDue)}.`) : ''} Peux-tu me le rendre quand tu auras terminé ?\n\nMerci !`; }
function openLoanRemind27(b) {
  const txt = loanText27(b);
  openModal(`<div class="dhead"><h3>Relancer ${esc(b.loanTo || 'l\'emprunteur')}</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint" style="margin-top:0">${b.loanReminded ? 'Dernière relance le ' + fmtD(b.loanReminded) + '. ' : ''}Modifie le message si besoin, puis choisis comment l'envoyer.</p>
    <textarea class="fld" id="lrTxt" rows="7" data-no-i18n>${esc(txt)}</textarea>
    <div class="btns"><button class="btn p" id="lrSms">SMS</button><button class="btn s" id="lrMail">E-mail</button>${navigator.share ? '<button class="btn s" id="lrShare">Partager…</button>' : ''}<button class="btn s" id="lrCopy">Copier</button></div></div>`, 'sm');
  const done = async () => { b.loanReminded = today(); await saveBook(b); };
  const t = () => $('#lrTxt').value;
  $('#lrSms').onclick = async () => { await done(); location.href = 'sms:' + (IS_IOS ? '&' : '?') + 'body=' + encodeURIComponent(t()); };
  $('#lrMail').onclick = async () => { await done(); location.href = 'mailto:?subject=' + encodeURIComponent('Livre prêté : ' + dispTitle(b)) + '&body=' + encodeURIComponent(t()); };
  if ($('#lrShare')) $('#lrShare').onclick = async () => { try { await navigator.share({text: t()}); await done(); } catch (e) {} };
  $('#lrCopy').onclick = async () => { try { await navigator.clipboard.writeText(t()); await done(); toast('Message copié'); } catch (e) { $('#lrTxt').select(); toast('Sélectionne le texte et copie-le'); } };
}
const loanSoon27 = () => books.filter(b => isLoaned(b) && b.loanDue && b.loanDue <= addDays(today(), 2));
async function notify27(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try { const reg = navigator.serviceWorker && await Promise.race([navigator.serviceWorker.getRegistration(), sleep(1500)]); if (reg && reg.showNotification) { await reg.showNotification(title, {body, tag, icon: 'assets/icon-192.png'}); return true; } } catch (e) {}
  try { new Notification(title, {body, tag, icon: 'assets/icon-192.png'}); return true; } catch (e) { return false; }
}
async function checkLoans27() {
  if (localStorage.getItem('scanly_loan_notif27') === '0') return; const t = today();
  for (const b of loanSoon27().filter(b => b.loanNotified !== t)) {
    const late = isLate(b), ok = await notify27(late ? 'Prêt en retard' : 'Retour de prêt bientôt', `« ${dispTitle(b)} » – ${b.loanTo || '?'} – ${late ? 'retour prévu le ' : 'à rendre le '}${fmtD(b.loanDue)}`, 'loan-' + b.id);
    if (ok) { b.loanNotified = t; await saveBook(b); } }
}
async function askNotif27() {
  if (!('Notification' in window)) return toast(IS_IOS ? 'Sur iPhone / iPad, ajoute d\'abord SCANLY à l\'écran d\'accueil, puis ouvre-le depuis l\'icône.' : 'Ce navigateur ne gère pas les notifications.', 7000);
  const p = await Notification.requestPermission(); toast(p === 'granted' ? '✔ Rappels de prêt activés' : 'Notifications refusées (réglages du navigateur)', 5000); if (p === 'granted') { localStorage.setItem('scanly_loan_notif27', '1'); checkLoans27(); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && DB.db) checkLoans27(); });

/* =====================================================================
   3. IMPORT GOODREADS / BABELIO / CSV / EXCEL
   ===================================================================== */
function parseCSV27(text) {
  text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '';
  const sep = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim()));
}
const COLS27 = {title: ['title', 'titre', 'nom du livre'], author: ['author', 'auteur', 'auteurs', 'auteur(s)', 'author l-f'], isbn: ['isbn13', 'isbn', 'ean', 'isbn 13', 'isbn/ean'],
  publisher: ['publisher', 'editeur', 'éditeur', 'maison d\'edition'], year: ['original publication year', 'year published', 'annee', 'année', 'date de publication', 'date de parution', 'parution'],
  pages: ['number of pages', 'pages', 'nombre de pages', 'nb pages'], rating: ['my rating', 'note', 'ma note'], readDate: ['date read', 'date de lecture', 'lu le', 'date lecture'],
  status: ['exclusive shelf', 'statut', 'status', 'etat de lecture', 'état de lecture'], series: ['series', 'serie', 'série'], volume: ['tome', 'volume', 'numero', 'numéro'],
  genre: ['genre', 'categorie', 'catégorie'], type: ['type'], tags: ['bookshelves', 'etiquettes', 'étiquettes', 'tags', 'etageres', 'étagères', 'listes'], notes: ['my review', 'critique', 'notes', 'commentaire', 'avis'], price: ['prix', 'prix €', 'price']};
function mapCols27(head) { const h = head.map(x => norm(x)), m = {};
  for (const [k, names] of Object.entries(COLS27)) for (const n of names) { const i = h.indexOf(norm(n)); if (i >= 0) { m[k] = i; break; } } // ordre de préférence des noms
  m.isbnAll = COLS27.isbn.map(n => h.indexOf(norm(n))).filter(i => i >= 0); // ISBN-13 vide : on essaie l'ISBN-10
  if (m.author == null) { const i = h.findIndex(x => x.includes('auteur') || x.includes('author')); if (i >= 0) m.author = i; } return m; }
function rowToBook27(r, m, src) {
  const g = k => m[k] == null ? '' : String(r[m[k]] ?? '').trim(), num = v => { const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; };
  const isbn = (m.isbnAll || [m.isbn]).map(i => cleanIsbn(String(r[i] ?? ''))).find(x => isbnValid(x)) || '', st = norm(g('status'));
  const status = /read$|^lu\b|^lus?$|termine/.test(st) && !/to read|a lire/.test(st) ? 'Lu' : /currently|en cours/.test(st) ? 'En cours' : 'À lire';
  let author = g('author'); if (/^[^,]+, [^,]+$/.test(author) && m.author != null && /l-f/.test(norm(String(r.__head?.[m.author] || '')))) author = author.split(', ').reverse().join(' ');
  const date = g('readDate').replace(/\//g, '-'), dm = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) || date.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  const readDate = dm ? (dm[1].length === 4 ? `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}` : `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`) : '';
  const shelves = parseTags27(g('tags').replace(/\s*\(#\d+\)/g, '')).filter(t => !/^(read|to-read|currently-reading|lu|a lire|à lire|en cours)$/i.test(t));
  const rating = num(g('rating')), type = TYPES.includes(g('type')) ? g('type') : 'Roman';
  return {title: g('title'), author, isbn: isbnValid(isbn) ? isbn : '', publisher: g('publisher'), year: num(g('year').match(/\d{4}/)?.[0] || ''), pages: num(g('pages')),
    rating: rating ? clamp(Math.round(rating > 5 ? rating / 4 : rating), 0, 5) : 0, readDate: status === 'Lu' ? readDate : '', status, series: g('series'), volume: num(g('volume')),
    genre: g('genre'), type, tags: shelves, notes: g('notes').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''), price: num(g('price')), importSource27: src, toRead: /to read|to-read|a lire/.test(st)};
}
function openImport27() {
  openModal(`<div class="dhead"><h3>Importer une bibliothèque</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint" style="margin-top:0">Fichier CSV exporté depuis <b>Goodreads</b> (My Books › Import and export › Export Library), <b>Babelio</b> (Mon profil › Exporter ma bibliothèque), un tableur <b>Excel</b> enregistré en CSV, ou l'export CSV de SCANLY. Les colonnes sont reconnues automatiquement (titre, auteur, ISBN, éditeur, année, pages, note, date de lecture, étagères…).</p>
    <label class="btn g" style="cursor:pointer">${I('img')} Choisir le fichier CSV<input type="file" id="imFile" accept=".csv,.txt,text/csv" hidden></label>
    <div id="imPrev"></div></div>`, 'sm');
  $('#imFile').onchange = async e => { const f = e.target.files[0]; if (!f) return;
    let text = await f.text(); if (/�/.test(text)) { try { text = new TextDecoder('windows-1252').decode(await f.arrayBuffer()); } catch (er) {} }
    const rows = parseCSV27(text); if (rows.length < 2) return $('#imPrev').innerHTML = '<p class="hint">Fichier vide ou non reconnu.</p>';
    const head = rows[0], m = mapCols27(head); if (m.title == null) return $('#imPrev').innerHTML = `<p class="hint">Colonne « Titre » introuvable. Colonnes lues : ${esc(head.join(' · '))}</p>`;
    const src = /goodreads/i.test(f.name) || head.some(h => /exclusive shelf/i.test(h)) ? 'Goodreads' : /babelio/i.test(f.name) ? 'Babelio' : 'CSV';
    const L = rows.slice(1).map(r => { r.__head = head; return rowToBook27(r, m, src); }).filter(b => b.title);
    const key = b => b.isbn ? 'i' + SCANLY_SOURCES.isbn13(b.isbn) : 't' + norm(b.title) + '|' + norm((b.author || '').split(',')[0]);
    const have = new Set(books.filter(b => !b.wish).map(key)), fresh = L.filter(b => !have.has(key(b))), dups = L.length - fresh.length;
    const toRead = fresh.filter(b => b.toRead).length, found = Object.keys(m).filter(k => k !== 'title' && k !== 'isbnAll');
    $('#imPrev').innerHTML = `<div class="fsub20" style="margin-top:12px"><b>${L.length} livre(s) lu(s) · source : ${src}</b>
      <p class="hint">${fresh.length} nouveau(x)${dups ? `, ${dups} déjà dans ta bibliothèque (ignorés)` : ''}. Colonnes reconnues : titre, ${found.map(k => ({author: 'auteur', isbn: 'ISBN', publisher: 'éditeur', year: 'année', pages: 'pages', rating: 'note', readDate: 'date de lecture', status: 'statut', series: 'série', volume: 'tome', genre: 'genre', type: 'type', tags: 'étiquettes', notes: 'notes', price: 'prix'}[k])).join(', ')}.</p>
      <div class="hint" data-no-i18n style="max-height:140px;overflow:auto">${fresh.slice(0, 30).map(b => `• ${esc(b.title)}${b.author ? ' – ' + esc(b.author) : ''}`).join('<br>')}${fresh.length > 30 ? '<br>…' : ''}</div>
      <label class="l">Ranger dans</label><select class="fld" id="imCase"><option value="">Non rangé (catalogue)</option>${cases.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      ${toRead ? `<label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="imWish" checked> Mettre les ${toRead} livre(s) « à lire » dans la liste de souhaits (pas encore achetés)</label>` : ''}
      <label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="imCov" checked> Chercher ensuite les couvertures (livres avec ISBN)</label>
      <div class="btns"><button class="btn p" id="imGo" ${fresh.length ? '' : 'disabled'}>Importer ${fresh.length} livre(s)</button></div><p class="hint" id="imMsg"></p></div>`;
    $('#imGo').onclick = async () => { $('#imGo').disabled = true; if (!await safetyPoint18('Avant import ' + src)) { $('#imGo').disabled = false; return; }
      const caseId = $('#imCase').value || null, wishTR = !!$('#imWish')?.checked, row = 1; let pos = caseId ? nextPos(caseId, row) : null;
      const made = fresh.map(o => { const {toRead: tr, ...f} = o, w = wishTR && tr; return newBook({...f, wish: w, caseId: w ? null : caseId, row, position: w || !caseId ? null : pos++, addedAt: Date.now()}); });
      await DB.putMany('books', made); books.push(...made); closeModal(); renderAll(); toast(`${made.length} livre(s) importé(s) depuis ${src}`, 5000);
      if ($('#imCov') ? $('#imCov').checked : true) covers27(made.filter(b => b.isbn)); };
  };
}
async function covers27(L) { if (!L.length) return; let n = 0;
  await pool(L, 2, async b => { try { const u = await coverFor(b); if (u && !b.cover) { b.cover = u; await saveBook(b); n++; } } catch (e) {} });
  if (n) { renderAll(); toast(`${n} couverture(s) trouvée(s) pour les livres importés`, 4000); } }

/* =====================================================================
   4. SUIVI DE LECTURE · 5. ÉTIQUETTES · 8. LECTEURS : section de la fiche
   ===================================================================== */
const bindFiche27 = bindFiche20;
bindFiche20 = function (b, isNew) {
  bindFiche27.apply(this, arguments);
  const body = $('#dBody'), notes = body && body.querySelector('details[data-sec="notes"]'); if (!body || !notes || $('#ePage27')) return;
  const me = readOf27(b), others = V27.others, p = pct27(b, b.page);
  const d = document.createElement('details'); d.className = 'fsec20'; d.dataset.sec = 'reading27'; d.open = ficheSecOpen20('reading27', !!(b.page || tagsOf27(b).length || b.status === 'En cours'));
  d.innerHTML = `<summary>Suivi de lecture et étiquettes</summary><div class="fsec20-body">
    <div class="g3"><div><label class="l">Page en cours</label><input class="fld" id="ePage27" type="number" min="0" value="${esc(b.page ?? '')}" placeholder="${b.pages ? 'sur ' + b.pages : ''}"></div>
      <div><label class="l">Commencé le</label><input class="fld" id="eStart27" type="date" value="${esc(b.readStart || '')}"></div>
      <div><label class="l">Progression</label><div class="pbar" style="margin-top:12px"><i id="eBar27" style="width:${p || 0}%"></i></div><div class="hint" id="ePct27">${p != null ? p + ' %' : b.pages ? '' : 'Indique le nombre de pages'}</div></div></div>
    <label class="l">Étiquettes / listes (séparées par des virgules)</label><input class="fld" id="eTags27" value="${esc(tagsOf27(b).join(', '))}" placeholder="ex. À offrir, Dédicacé, Édition originale" list="tags27"><datalist id="tags27">${allTags27().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    ${allTags27().length ? `<div class="tags27">${allTags27().slice(0, 30).map(t => `<button type="button" class="tag27 ${tagsOf27(b).includes(t) ? 'on' : ''}" data-tag27="${esc(t)}" data-no-i18n>${esc(t)}</button>`).join('')}</div>` : ''}
    ${others.length ? `<div class="fsub20"><b>Lectures de la famille</b>${others.map((r, i) => { const o = readOf27(b, r); return `<div class="g3"><div><label class="l" data-no-i18n>${esc(r)}</label><select class="fld" data-rd-st="${i}">${['À lire', 'En cours', 'Lu'].map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div><label class="l">Lu le</label><input class="fld" type="date" data-rd-date="${i}" value="${esc(o.date)}"></div><div><label class="l">Page</label><input class="fld" type="number" min="0" data-rd-page="${i}" value="${esc(o.page ?? '')}"></div></div>`; }).join('')}</div>` : ''}
  </div>`;
  notes.before(d);
  d.addEventListener('toggle', () => { try { const s = JSON.parse(localStorage.getItem('scanly_fiche_sections') || '{}'); s.reading27 = d.open; localStorage.setItem('scanly_fiche_sections', JSON.stringify(s)); } catch (e) {} });
  const upd = () => { const pg = parseInt($('#ePage27').value) || 0, pages = parseInt($('#ePages')?.value) || b.pages, q = pages && pg ? Math.min(100, Math.round(pg / pages * 100)) : null; $('#eBar27').style.width = (q || 0) + '%'; $('#ePct27').textContent = q != null ? q + ' %' : ''; };
  $('#ePage27').oninput = () => { upd(); const pg = parseInt($('#ePage27').value) || 0, st = $('#eStatus'); if (pg && st && st.value === 'À lire') st.value = 'En cours'; if (pg && !$('#eStart27').value) $('#eStart27').value = today(); };
  d.querySelectorAll('[data-tag27]').forEach(t => t.onclick = () => { const cur = parseTags27($('#eTags27').value), k = t.dataset.tag27, on = cur.includes(k); $('#eTags27').value = (on ? cur.filter(x => x !== k) : [...cur, k]).join(', '); t.classList.toggle('on', !on); bookDirty = true; });
  const save = $('#bSave'); if (!save) return; const orig = save.onclick;
  save.onclick = async function () {
    const pg = $('#ePage27').value.trim(); b.page = pg === '' ? null : Math.max(0, parseInt(pg) || 0); b.readStart = $('#eStart27').value || null;
    const tg = parseTags27($('#eTags27').value); if (tg.length) b.tags = tg; else delete b.tags;
    const pages = parseInt($('#ePages')?.value) || b.pages; if (b.page && pages && b.page >= pages && $('#eStatus') && $('#eStatus').value !== 'Lu' && confirm('Dernière page atteinte : marquer ce livre comme « Lu » ?')) $('#eStatus').value = 'Lu';
    if (others.length) { const R = {...(b.readers27 || {})}; others.forEach((r, i) => { const st = d.querySelector(`[data-rd-st="${i}"]`).value, dt = d.querySelector(`[data-rd-date="${i}"]`).value, pp = parseInt(d.querySelector(`[data-rd-page="${i}"]`).value) || null;
      if (st === 'À lire' && !dt && !pp) delete R[r]; else R[r] = {status: st, date: st === 'Lu' ? (dt || today()) : dt, page: pp}; }); if (Object.keys(R).length) b.readers27 = R; else delete b.readers27; }
    return orig.apply(this, arguments); };
  /* prêt : bouton Relancer */
  if (isLoaned(b) && b.loanTo) { const loan = body.querySelector('details[data-sec="loan"] .fsec20-body .btns') || body.querySelector('details[data-sec="loan"] .fsec20-body');
    if (loan) { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn s sm'; btn.id = 'bRemind27'; btn.textContent = 'Relancer ' + b.loanTo; btn.onclick = () => openLoanRemind27(b); loan.append(btn); } }
};

/* filtres : étiquette et « lu par » */
const passF27 = passF;
passF = function (b) { return passF27(b) && (!F.tag27 || tagsOf27(b).includes(F.tag27)) && (!F.reader27 || readOf27(b, F.reader27).status === 'Lu'); };
const filterCount27 = filterCount19;
filterCount19 = function () { return filterCount27() + (F.tag27 ? 1 : 0) + (F.reader27 ? 1 : 0); };
const openFilters27 = openFilters19;
openFilters19 = function () {
  openFilters27.apply(this, arguments); const panel = $('#mbox .filter-panel19'), apply = $('#filterApply19'); if (!panel || !apply) return;
  const tags = allTags27(), readers = V27.readers.length > 1 ? V27.readers : [];
  if (tags.length || readers.length) { const d = document.createElement('details'); d.open = !!(F.tag27 || F.reader27);
    d.innerHTML = `<summary>Étiquettes et lecteurs</summary>${tags.length ? `<label class="l">Étiquette / liste</label><select class="fld" id="filterTag27" data-no-i18n>${opt(tags.map(t => t), 'Toutes les étiquettes', F.tag27 || '')}</select>` : ''}${readers.length ? `<label class="l">Lu par</label><select class="fld" id="filterReader27" data-no-i18n>${opt(readers, 'Peu importe', F.reader27 || '')}</select>` : ''}`;
    const last = panel.querySelector('details:last-of-type'); (last || panel).after(d); }
  const reset = $('#filterReset19'); if (reset) reset.addEventListener('click', () => { if ($('#filterTag27')) $('#filterTag27').value = ''; if ($('#filterReader27')) $('#filterReader27').value = ''; });
  const orig = apply.onclick; apply.onclick = function () { F.tag27 = $('#filterTag27')?.value || ''; F.reader27 = $('#filterReader27')?.value || ''; return orig.apply(this, arguments); };
};
document.addEventListener('click', e => { if (e.target.closest('#filterClear19')) { F.tag27 = ''; F.reader27 = ''; } }, true);

/* =====================================================================
   TABLEAU DE BORD : lecture en cours, objectif, bilan, listes, famille, prêts, parutions
   ===================================================================== */
let dashYear27 = String(new Date().getFullYear());
const renderDash27 = renderDash;
renderDash = function () {
  renderDash27.apply(this, arguments); const grid = $('#v-dash .dgrid'); if (!grid) return;
  const own = books.filter(b => !b.wish), y = dashYear27, me = V27.me, readers = V27.readers;
  const cur = own.filter(b => readOf27(b).status === 'En cours').sort((a, b) => (pct27(b, b.page) || 0) - (pct27(a, a.page) || 0));
  const goalCards = readers.map(r => { const n = own.filter(b => readIn27(b, r, y)).length, g = V27.goal(y, r), q = g ? Math.min(100, Math.round(n / g * 100)) : 0;
    return `<div class="goal27"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b data-no-i18n>${readers.length > 1 ? esc(r) : 'Objectif ' + y}</b><span>${n}${g ? ' / ' + g : ''} livre${(g || n) > 1 ? 's' : ''}</span></div>
      <div class="pbar"><i style="width:${q}%"></i></div><div class="hint">${g ? (n >= g ? 'Objectif atteint ! 🎉' : `Encore ${g - n} pour atteindre l'objectif`) : 'Pas d\'objectif fixé'} · <button type="button" class="linkbtn20" data-goal27="${esc(r)}">${g ? 'modifier' : 'fixer un objectif'}</button></div></div>`; }).join('');
  const years = [...new Set([String(new Date().getFullYear()), ...own.flatMap(b => [readOf27(b).date, ...Object.values(b.readers27 || {}).map(o => o.date)]).filter(Boolean).map(d => d.slice(0, 4))])].sort().reverse();
  const readY = own.filter(b => readIn27(b, me, y)), pagesY = readY.reduce((s, b) => s + (Number(b.pages) || 0), 0);
  const top = (f) => { const c = countBy(readY, f); return c[0] ? `${esc(c[0].l)} (${c[0].v})` : '—'; };
  const best = readY.filter(b => b.rating).sort((a, b) => b.rating - a.rating)[0];
  const tags = allTags27(), soon = loanSoon27(), rel = releases27().filter(r => !r.seen);
  const html = `
    <div class="dcard wide"><h3>Lecture</h3><div class="read27">
      <div><h4>En cours (${cur.length})</h4>${cur.length ? cur.slice(0, 8).map(b => { const q = pct27(b, b.page); return `<div class="cur27" data-open27="${b.id}"><b data-no-i18n>${esc(dispTitle(b))}</b><div class="pbar"><i style="width:${q || 0}%"></i></div><span class="hint">${b.page ? 'page ' + b.page + (b.pages ? ' / ' + b.pages : '') : 'page non renseignée'}${q != null ? ' · ' + q + ' %' : ''}</span></div>`; }).join('') : '<p class="hint">Aucun livre en cours. Indique « En cours » ou une page dans la fiche.</p>'}</div>
      <div><h4>Objectif de lecture <select class="tsel" id="dashYear27">${years.map(v => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select></h4>${goalCards}</div>
      <div><h4>Bilan ${y}${readers.length > 1 ? ' – ' + esc(me) : ''}</h4><div class="bilan27"><div><b>${readY.length}</b><span>livres lus</span></div><div><b>${pagesY.toLocaleString('fr-FR')}</b><span>pages</span></div></div>
        <p class="hint" style="margin:6px 0 0">Auteur le plus lu : <b data-no-i18n>${top(b => (b.author || '').split(',')[0].trim() || null)}</b><br>Genre favori : <b data-no-i18n>${top(b => b.genre || b.type)}</b><br>Coup de cœur : <b data-no-i18n>${best ? esc(dispTitle(best)) + ' ' + '★'.repeat(best.rating) : '—'}</b></p></div>
    </div></div>
    ${soon.length ? `<div class="dcard wide"><h3>Prêts à relancer (${soon.length})</h3>${soon.map(b => `<div class="cur27"><b data-no-i18n>${esc(dispTitle(b))}</b> <span class="hint" data-no-i18n>${esc(b.loanTo || '?')} · ${isLate(b) ? '<b style="color:var(--ko)">en retard depuis le ' + fmtD(b.loanDue) + '</b>' : 'à rendre le ' + fmtD(b.loanDue)}${b.loanReminded ? ' · relancé le ' + fmtD(b.loanReminded) : ''}</span> <button type="button" class="btn s sm" data-remind27="${b.id}">Relancer</button></div>`).join('')}
      ${'Notification' in window && Notification.permission !== 'granted' ? '<p class="hint">Reçois une notification à l\'échéance : <button type="button" class="linkbtn20" id="notif27">activer les rappels</button> (l\'application doit être ouverte de temps en temps).</p>' : ''}</div>` : ''}
    ${rel.length ? `<div class="dcard wide"><h3>Nouveautés dans tes séries (${rel.length})</h3>${rel.map(r => `<div class="cur27"><b data-no-i18n>${esc(r.name)}</b> <span class="hint">tome${r.to - r.from > 1 ? 's' : ''} ${r.from + 1}${r.to - r.from > 1 ? ' à ' + r.to : ''} paru${r.to - r.from > 1 ? 's' : ''} (estimation IA, à vérifier)</span> <button type="button" class="btn g sm" data-relwish27="${esc(r.key)}">→ souhaits</button> <button type="button" class="btn s sm" data-relseen27="${esc(r.key)}">Vu</button></div>`).join('')}</div>` : ''}
    <div class="dcard wide"><h3>Mes listes (étiquettes)</h3>${tags.length ? `<div class="tags27">${tags.map(t => `<button type="button" class="tag27" data-taglist27="${esc(t)}" data-no-i18n>${esc(t)} <small>${books.filter(b => tagsOf27(b).includes(t)).length}</small></button>`).join('')}</div><p class="hint">Touche une liste pour afficher ses livres dans le catalogue.</p>` : '<p class="hint">Ajoute des étiquettes dans la fiche d\'un livre (section « Suivi de lecture et étiquettes ») : « À offrir », « Dédicacé »… Elles deviennent des listes ici.</p>'}</div>`;
  grid.insertAdjacentHTML('afterbegin', html);
  const ys = $('#dashYear27'); if (ys) ys.onchange = () => { dashYear27 = ys.value; renderDash(); };
};
$('#v-dash').addEventListener('click', async e => {
  const o = e.target.closest('[data-open27]'); if (o) return openBook(o.dataset.open27);
  const g = e.target.closest('[data-goal27]'); if (g) { const r = g.dataset.goal27, v = prompt(`Objectif ${dashYear27}${V27.readers.length > 1 ? ' pour ' + r : ''} : combien de livres ?`, V27.goal(dashYear27, r) || 12); if (v == null) return;
    const G = V27.goals, n = parseInt(v) || 0; if (n > 0) G[dashYear27 + '|' + r] = n; else delete G[dashYear27 + '|' + r]; V27.goals = G; return renderDash(); }
  const rm = e.target.closest('[data-remind27]'); if (rm) return openLoanRemind27(books.find(b => b.id === rm.dataset.remind27));
  if (e.target.closest('#notif27')) return askNotif27();
  const t = e.target.closest('[data-taglist27]'); if (t) { Object.assign(F, {tag27: t.dataset.taglist27}); setView('cat'); return renderAll(); }
  const rw = e.target.closest('[data-relwish27]'); if (rw) { const r = releases27().find(x => x.key === rw.dataset.relwish27); if (r) { for (let v = r.from + 1; v <= r.to; v++) await addWish(r.key, v, true); seenRelease27(r.key); renderAll(); toast('Ajouté(s) à ta liste de souhaits'); } return; }
  const rs = e.target.closest('[data-relseen27]'); if (rs) { seenRelease27(rs.dataset.relseen27); return renderDash(); }
});

/* =====================================================================
   6. LISTE DE SOUHAITS PARTAGEABLE
   ===================================================================== */
function wishText27() { const L = books.filter(b => b.wish).sort((a, b) => norm(a.series || a.title).localeCompare(norm(b.series || b.title), 'fr', {numeric: true}) || (+a.volume || 0) - (+b.volume || 0));
  return `Ma liste de souhaits (${L.length} livre${L.length > 1 ? 's' : ''})\n\n` + L.map(b => `• ${dispTitle(b)}${b.author ? ' – ' + b.author : ''}${b.isbn ? ' (ISBN ' + b.isbn + ')' : ''}${b.wishTarget ? ' – env. ' + Number(b.wishTarget).toLocaleString('fr-FR') + ' €' : ''}${b.wishLink ? '\n  ' + b.wishLink : ''}`).join('\n'); }
function wishPage27() { const L = books.filter(b => b.wish).sort((a, b) => ({high: 0, normal: 1, low: 2}[wishPriority18(a)] - {high: 0, normal: 1, low: 2}[wishPriority18(b)]) || norm(a.series || a.title).localeCompare(norm(b.series || b.title), 'fr', {numeric: true}));
  const cov = b => /^https:\/\//.test(b.cover || '') ? `<img src="${esc(b.cover)}" alt="">` : `<div class="ph" style="background:${colOf(b)}"></div>`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ma liste de souhaits</title><style>
body{font-family:-apple-system,"Segoe UI",sans-serif;background:#F8F6F0;color:#0B1F44;margin:0;padding:20px}h1{font-size:22px;margin:0 0 4px}p.s{color:#64748B;margin:0 0 18px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}.c{background:#fff;border-radius:10px;padding:10px;box-shadow:0 1px 4px #0001}
.c img,.c .ph{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:6px;display:block}.c b{display:block;margin-top:8px;font-size:14px}.c span{color:#64748B;font-size:12px;display:block}.c a{font-size:12px;color:#8a6a35}.h{color:#b8915b;font-size:11px;font-weight:700}
@media(prefers-color-scheme:dark){body{background:#0B1F44;color:#F8F6F0}.c{background:#142a55}.c span,p.s{color:#c9d3e6}}</style></head><body>
<h1>Ma liste de souhaits</h1><p class="s">${L.length} livre${L.length > 1 ? 's' : ''} · mise à jour le ${new Date().toLocaleDateString('fr-FR')} · créée avec SCANLY</p><div class="g">
${L.map(b => `<div class="c">${cov(b)}${wishPriority18(b) === 'high' ? '<div class="h">★ PRIORITAIRE</div>' : ''}<b>${esc(dispTitle(b))}</b><span>${esc(b.author || '')}</span>${b.isbn ? `<span>ISBN ${esc(b.isbn)}</span>` : ''}${b.wishTarget ? `<span>env. ${esc(Number(b.wishTarget).toLocaleString('fr-FR'))} €</span>` : ''}${safeBuyLink18(b.wishLink || '') ? `<a href="${esc(safeBuyLink18(b.wishLink))}" rel="noopener">Où l'acheter</a>` : ''}</div>`).join('')}
</div></body></html>`; }
function openWishShare27() {
  if (!books.some(b => b.wish)) return toast('Ta liste de souhaits est vide');
  openModal(`<div class="dhead"><h3>Partager ma liste de souhaits</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint" style="margin-top:0">Envoie ta liste à tes proches (anniversaire, Noël…). Elle ne contient ni tes notes, ni l'emplacement de tes livres.</p>
    <textarea class="fld" id="wsTxt" rows="8" data-no-i18n>${esc(wishText27())}</textarea>
    <div class="btns">${navigator.share ? '<button class="btn p" id="wsShare">Partager…</button>' : ''}<button class="btn s" id="wsCopy">Copier le texte</button><button class="btn g" id="wsPage">Page web (fichier à envoyer)</button></div></div>`, 'sm');
  if ($('#wsShare')) $('#wsShare').onclick = async () => { try { await navigator.share({title: 'Ma liste de souhaits', text: $('#wsTxt').value}); } catch (e) {} };
  $('#wsCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#wsTxt').value); toast('Liste copiée'); } catch (e) { $('#wsTxt').select(); } };
  $('#wsPage').onclick = async () => { const n = await saveFile(`liste_de_souhaits_${today()}.html`, wishPage27(), 'text/html', '.html', 'Page web'); if (n) toast('Page enregistrée : ' + n + ' – envoie-la par e-mail ou message'); };
}
const renderWish27 = renderWishlist18;
renderWishlist18 = function () { renderWish27.apply(this, arguments); const head = $('#v-wish .enhance-head'); if (!head || $('#wishShare27')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn s'; b.id = 'wishShare27'; b.textContent = 'Partager ma liste'; b.onclick = openWishShare27; head.append(b); };

/* =====================================================================
   7. ALERTES DE PARUTION (séries en cours, vérifiées par l'IA au plus une fois par semaine)
   ===================================================================== */
function releases27() { try { return JSON.parse(localStorage.getItem('scanly_releases27') || '[]'); } catch (e) { return []; } }
function seenRelease27(key) { localStorage.setItem('scanly_releases27', JSON.stringify(releases27().map(r => r.key === key ? {...r, seen: true} : r))); }
async function checkReleases27(force = false) {
  if (!cfg.key || localStorage.getItem('scanly_release_auto27') === '0' && !force) return 0;
  const last = +localStorage.getItem('scanly_release_last27') || 0; if (!force && Date.now() - last < 7 * 864e5) return 0;
  const S = seriesGroups().filter(s => s.items.some(b => !b.wish) && s.meta.status !== 'terminée').slice(0, 80); if (!S.length) return 0;
  localStorage.setItem('scanly_release_last27', String(Date.now()));
  const out = await gemini([{text: `Pour chaque série (édition française), indique le nombre de tomes parus À CE JOUR et son statut. Si tu ne sais pas, mets null. N'invente pas de tome à paraître.
JSON : [{"i":0,"total":nombre,"statut":"en cours|terminée"}]
Séries : ${JSON.stringify(S.map((s, i) => ({i, serie: s.name, auteur: s.author, type: s.items[0].type, tomes_connus: s.meta.total || s.max})))}`}], {json: true});
  const R = releases27(); let n = 0;
  (Array.isArray(out) ? out : out.series || []).forEach(o => { const s = S[o.i], t = parseInt(o.total); if (!s || !t) return; const known = s.meta.total || s.max;
    if (t > known && t - known <= 5) { const i = R.findIndex(r => r.key === s.key); const rec = {key: s.key, name: s.name, from: known, to: t, at: today(), seen: false}; if (i >= 0) R[i] = {...rec, from: Math.min(R[i].seen ? known : R[i].from, known)}; else R.push(rec); n++; }
    SMETA[s.key] = {...(SMETA[s.key] || {}), total: Math.max(t, s.meta.total || 0), status: o.statut || s.meta.status || ''}; });
  localStorage.setItem('scanly_series', JSON.stringify(SMETA)); localStorage.setItem('scanly_releases27', JSON.stringify(R.slice(-60)));
  if (n) { toast(`📚 ${n} série(s) avec un nouveau tome – voir le Tableau de bord`, 7000); notify27('Nouveaux tomes', `${n} de tes séries ont un nouveau tome (estimation IA)`, 'releases'); }
  return n;
}
const renderSeries27 = renderSeries;
renderSeries = function () { renderSeries27.apply(this, arguments); const ai = $('#srAI'); if (!ai || $('#srRel27')) return;
  const b = document.createElement('button'); b.className = 'btn s'; b.id = 'srRel27'; b.textContent = 'Vérifier les nouvelles parutions';
  b.onclick = async () => { if (!cfg.key) return toast('Clé API Gemini manquante (⚙ Paramètres)'); b.innerHTML = '<span class="spin"></span> Vérification…'; try { const n = await checkReleases27(true); toast(n ? `${n} série(s) avec un nouveau tome` : 'Aucun nouveau tome détecté', 5000); } catch (e) { toast(e.message, 5000); } renderAll(); };
  ai.after(b); };

/* =====================================================================
   PARAMÈTRES : lecteurs, rappels, parutions, import
   ===================================================================== */
const openSettings27 = openSettings;
openSettings = function () {
  openSettings27.apply(this, arguments); const anchor = $('#pStore25')?.closest('.mbody') && $('#pExp')?.closest('.btns'); if (!anchor || $('#pReaders27')) return;
  const d = document.createElement('div');
  d.innerHTML = `<div class="btns"><button class="btn s" id="pImport27">Importer Goodreads / Babelio / CSV…</button></div>
    <div class="step" style="margin-top:22px">Lecteurs de la famille</div>
    <p class="hint">Le premier nom est le lecteur principal (statut, « Lu le » et page habituels de la fiche). Ajoute les autres lecteurs : chacun aura son statut de lecture, son objectif et son bilan.</p>
    <input class="fld" id="pReaders27" value="${esc(V27.readers.join(', '))}" placeholder="ex. Philippe, Marie, Léo" data-no-i18n>
    <div class="step" style="margin-top:22px">Rappels et alertes</div>
    <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pNotif27" ${'Notification' in window && Notification.permission === 'granted' && localStorage.getItem('scanly_loan_notif27') !== '0' ? 'checked' : ''}> Notification quand un prêt arrive à échéance</label>
    <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pRel27" ${localStorage.getItem('scanly_release_auto27') !== '0' ? 'checked' : ''}> Vérifier chaque semaine les nouveaux tomes de mes séries (IA)</label>
    <p class="hint">Les rappels apparaissent quand SCANLY est ouvert (ou à son ouverture). Sur iPhone / iPad, les notifications demandent que SCANLY soit ajouté à l'écran d'accueil.</p>`;
  anchor.after(d);
  $('#pImport27').onclick = () => { closeModal(); openImport27(); };
  $('#pReaders27').onchange = e => { const L = parseTags27(e.target.value); V27.readers = L.length ? L : ['Moi']; e.target.value = V27.readers.join(', '); toast('Lecteurs enregistrés'); };
  $('#pNotif27').onchange = e => { if (e.target.checked) askNotif27(); else localStorage.setItem('scanly_loan_notif27', '0'); };
  $('#pRel27').onchange = e => localStorage.setItem('scanly_release_auto27', e.target.checked ? '1' : '0');
};

/* ---------- démarrage : rappels de prêt puis parutions (sans gêner le lancement) ---------- */
(async () => { if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, {once: true}));
  for (let i = 0; i < 40 && !DB.db; i++) await sleep(250);
  setTimeout(() => checkLoans27().catch(() => {}), 4000);
  setTimeout(() => checkReleases27().catch(e => console.warn('SCANLY parutions :', e.message)), 30000);
})();
