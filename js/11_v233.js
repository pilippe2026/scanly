/* =====================================================================
   SCANLY V2.33 – IMPORT D'UNE LISTE DE LIVRES
   Fichier (Excel, Numbers, Word, Pages, PDF, CSV, texte, OpenDocument, RTF)
   ou photo d'une liste papier (imprimée ou manuscrite).
   - Tableaux avec une colonne « Titre » : lus directement, sans IA.
   - Tout le reste : l'IA (Gemini) lit le document et en tire les livres.
   La liste est toujours montrée avant l'import : on coche ce qu'on garde.
   ===================================================================== */
const LIST33_ACCEPT = '.csv,.tsv,.txt,.md,.xlsx,.xlsm,.ods,.numbers,.docx,.odt,.pages,.rtf,.pdf,.xls,.doc,image/*,text/csv,text/plain,application/pdf';

/* ---------- lecture des fichiers ZIP (xlsx, docx, ods, odt, pages, numbers) ---------- */
async function unzip33(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf), files = new Map();
  let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('zip');
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true), dec = new TextDecoder();
  for (let k = 0; k < n && dv.getUint32(p, true) === 0x02014b50; k++) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    files.set(name, async () => { const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), raw = u8.slice(start, start + size);
      if (method === 0) return raw;
      if (method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('deflate');
      return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); });
    p += 46 + nl + xl + cl;
  }
  return files;
}
const xml33 = async (Z, name) => { const g = Z.get(name); if (!g) return null; return new DOMParser().parseFromString(new TextDecoder().decode(await g()), 'application/xml'); };
const kids33 = el => [...el.childNodes].filter(c => c.nodeType === 1);

function wordText33(doc) {   // Word : paragraphes, et lignes de tableau « case | case »
  const out = [], para = p => { let s = ''; p.querySelectorAll('*').forEach(x => { if (x.localName === 't') s += x.textContent; else if (x.localName === 'tab') s += '\t'; else if (x.localName === 'br') s += '\n'; }); return s; };
  const walk = node => kids33(node).forEach(c => { if (c.localName === 'p') out.push(para(c)); else if (c.localName === 'tbl') kids33(c).filter(r => r.localName === 'tr').forEach(r => out.push(kids33(r).filter(x => x.localName === 'tc').map(tc => kids33(tc).filter(x => x.localName === 'p').map(para).join(' ')).join(' | '))); else walk(c); });
  walk(doc.documentElement); return out.join('\n');
}
function odText33(doc) {     // OpenDocument texte
  const out = [], walk = node => kids33(node).forEach(c => { if (c.localName === 'p' || c.localName === 'h') out.push(c.textContent); else if (c.localName === 'table-row') out.push(kids33(c).map(x => x.textContent).join(' | ')); else walk(c); });
  walk(doc.documentElement); return out.join('\n');
}
function odsRows33(doc) {    // OpenDocument tableur
  const rows = []; doc.querySelectorAll('*').forEach(r => { if (r.localName !== 'table-row') return; const row = [];
    kids33(r).forEach(c => { if (c.localName !== 'table-cell' && c.localName !== 'covered-table-cell') return; const rep = Math.min(30, +c.getAttribute('table:number-columns-repeated') || 1), v = kids33(c).filter(x => x.localName === 'p').map(x => x.textContent).join(' ');
      for (let i = 0; i < rep; i++) row.push(v); });
    while (row.length && !String(row[row.length - 1]).trim()) row.pop(); if (row.length) rows.push(row); });
  return rows;
}
async function xlsxRows33(Z) {  // Excel : toutes les feuilles, dans l'ordre
  const ss = await xml33(Z, 'xl/sharedStrings.xml'), shared = ss ? [...ss.getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
  const names = [...Z.keys()].filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/))), sheets = [];
  const col = ref => { let n = 0; for (const ch of String(ref).replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return Math.max(0, n - 1); };
  for (const nm of names) { const d = await xml33(Z, nm), rows = [];
    [...d.getElementsByTagName('row')].forEach(r => { const row = [];
      [...r.getElementsByTagName('c')].forEach(c => { const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        const val = t === 's' ? (shared[+v] ?? '') : t === 'inlineStr' ? c.textContent : v; const i = col(c.getAttribute('r') || ''); if (i < 60) row[i] = val; });
      for (let i = 0; i < row.length; i++) if (row[i] == null) row[i] = '';
      if (row.some(v => String(v).trim())) rows.push(row); });
    if (rows.length) sheets.push(rows); }
  return sheets;
}
function rtfText33(s) {     // RTF : texte seul (tables de polices, couleurs, images… ignorées)
  const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|listtable|listoverridetable|generator|themedata|colorschememapping|latentstyles|datastore|xmlnsTbl|rsidtbl|header|footer)$/;
  let out = '', i = 0, depth = 0, skipAt = -1; const cp = new TextDecoder('windows-1252');
  while (i < s.length) { const c = s[i];
    if (c === '{') { depth++; i++; if (skipAt < 0 && s.startsWith('\\*', i)) skipAt = depth; continue; }
    if (c === '}') { if (depth === skipAt) skipAt = -1; depth--; i++; continue; }
    if (c === '\\') { const m = /^\\([a-z]+)(-?\d+)? ?|^\\'([0-9a-f]{2})|^\\(.)/i.exec(s.slice(i, i + 40)); if (!m) { i++; continue; } i += m[0].length;
      if (skipAt >= 0) continue;
      if (m[1]) { const w = m[1]; if (SKIP.test(w)) { skipAt = depth; continue; } if (w === 'par' || w === 'line' || w === 'row') out += '\n'; else if (w === 'tab' || w === 'cell') out += '\t'; else if (w === 'u') { const n = +m[2]; out += String.fromCharCode(n < 0 ? n + 65536 : n); if (s[i] === '?') i++; } }
      else if (m[3]) out += cp.decode(new Uint8Array([parseInt(m[3], 16)])); else if (m[4] && /[\\{}]/.test(m[4])) out += m[4];
      continue; }
    if (skipAt < 0 && c !== '\r' && c !== '\n') out += c; i++; }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const b64_33 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function photo33(file) {   // photo -> JPEG raisonnable (2200 px), HEIC compris là où le navigateur sait le lire
  const url = URL.createObjectURL(file);
  try { const img = await srcToImg(url), k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .9).split(',')[1]; }
  finally { URL.revokeObjectURL(url); }
}
async function textOf33(file) { let t = await file.text(); if (/�/.test(t)) { try { t = new TextDecoder('windows-1252').decode(await file.arrayBuffer()); } catch (e) {} } return t.replace(/^﻿/, ''); }

const headRow33 = rows => rows.slice(0, 6).findIndex(r => mapCols27(r).title != null);   // l'en-tête peut suivre une ligne de titre
/* Un fichier devient : un tableau (rows), du texte (text) ou un document à montrer à l'IA (blob). */
async function readListFile33(file) {
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase(), type = file.type || '';
  if (/^image\//.test(type) || /^(jpe?g|png|heic|heif|webp|gif)$/.test(ext)) {
    try { return {kind: 'blob', mime: 'image/jpeg', data: await photo33(file), name: file.name, photo: true}; }
    catch (e) { throw new Error(`Photo illisible par ce navigateur (${file.name}). Sur PC, enregistrez-la en JPEG.`); } }
  if (ext === 'pdf' || type === 'application/pdf') { if (file.size > 15e6) throw new Error('PDF trop lourd (15 Mo au plus).'); return {kind: 'blob', mime: 'application/pdf', data: b64_33(await file.arrayBuffer()), name: file.name}; }
  if (/^(csv|tsv)$/.test(ext) || type === 'text/csv') return {kind: 'rows', rows: parseCSV27(await textOf33(file)), name: file.name};
  if (/^(txt|md)$/.test(ext) || /^text\//.test(type)) return {kind: 'text', text: await textOf33(file), name: file.name};
  if (ext === 'rtf') return {kind: 'text', text: rtfText33(await textOf33(file)), name: file.name};
  if (ext === 'xls' || ext === 'doc') throw new Error(`Ancien format .${ext} : enregistrez le fichier en .${ext}x, en PDF ou en CSV, puis réessayez.`);
  let Z; try { Z = await unzip33(await file.arrayBuffer()); } catch (e) { throw new Error(e.message === 'deflate' ? 'Ce navigateur ne sait pas ouvrir ce fichier. Mettez-le à jour, ou exportez le document en PDF.' : `Format non reconnu (${file.name}).`); }
  if (Z.has('xl/workbook.xml')) { const sheets = await xlsxRows33(Z); return {kind: 'rows', rows: sheets.find(r => headRow33(r) >= 0) || sheets.flat(), name: file.name}; }
  if (Z.has('word/document.xml')) return {kind: 'text', text: wordText33(await xml33(Z, 'word/document.xml')), name: file.name};
  if (Z.has('content.xml')) { const d = await xml33(Z, 'content.xml'); return /spreadsheet/.test(new TextDecoder().decode(await (Z.get('mimetype') || (async () => new Uint8Array()))())) ? {kind: 'rows', rows: odsRows33(d), name: file.name} : {kind: 'text', text: odText33(d), name: file.name}; }
  // Pages / Numbers / Keynote : format fermé ; on lit l'aperçu PDF ou l'image d'aperçu enregistrés dans le fichier
  const pv = Z.get('QuickLook/Preview.pdf'); if (pv) return {kind: 'blob', mime: 'application/pdf', data: b64_33((await pv()).buffer), name: file.name};
  const im = Z.get('preview.jpg') || Z.get('QuickLook/Thumbnail.jpg'); if (im) return {kind: 'blob', mime: 'image/jpeg', data: b64_33((await im()).buffer), name: file.name, preview: true};
  throw new Error(`Impossible de lire « ${file.name} ». Dans Pages ou Numbers : Fichier › Exporter vers › PDF (ou Word / Excel), puis importez ce fichier.`);
}

/* ---------- l'IA lit la liste ---------- */
const LIST33_PROMPT = `Tu es bibliothécaire. Le document fourni contient une liste de livres (tableau, liste à puces, inventaire, notes manuscrites, photo d'une page…). Extrais CHAQUE livre, dans l'ordre du document.
Règles :
- Ignore les titres de rubriques, en-têtes de colonnes, totaux, numéros de page, dates d'impression.
- N'invente aucun livre. Corrige seulement les fautes évidentes ; complète l'auteur uniquement si le titre est sans ambiguïté.
- Une ligne qui regroupe plusieurs tomes (« Astérix 1 à 5 », « One Piece t.1-10 », « Harry Potter 1, 2, 3 ») donne UN livre PAR tome (60 au plus par ligne), avec "serie" et "tome".
- "souhait": true si le document indique que le livre est à acheter, souhaité ou manquant ; "statut" : "Lu", "En cours", "À lire" ou null selon ce qui est indiqué (case cochée, « lu », date de lecture…).
- "type" : un parmi ${TYPES.join(', ')}.
- Écriture manuscrite difficile : mets ton meilleur déchiffrage et une "confiance" basse.
Réponds UNIQUEMENT en JSON : {"livres":[{"titre":"…","auteur":"… ou null","serie":"… ou null","tome":nombre ou null,"editeur":"… ou null","annee":nombre ou null,"isbn":"… ou null","type":"…","statut":"… ou null","note":nombre de 0 à 5 ou null,"souhait":false,"confiance":0.0}]}`;
function aiBook33(o) {
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; }, isbn = cleanIsbn(String(o.isbn || ''));
  const st = String(o.statut || ''), status = /^lu$/i.test(st) ? 'Lu' : /cours/i.test(st) ? 'En cours' : 'À lire';
  return {title: String(o.titre || '').trim(), author: String(o.auteur || '').trim(), isbn: isbnValid(isbn) ? isbn : '', publisher: String(o.editeur || '').trim(), year: num(o.annee),
    series: String(o.serie || '').trim(), volume: num(o.tome), type: TYPES.includes(o.type) ? o.type : 'Roman', status, rating: o.note ? clamp(Math.round(num(o.note) || 0), 0, 5) : 0,
    toRead: o.souhait === true, importSource27: 'Liste', conf33: +o.confiance || .7};
}
async function aiList33(src, msg) {
  if (!cfg.key) throw new Error('nokey');
  const calls = [];
  if (src.kind === 'blob') calls.push([{text: LIST33_PROMPT + (src.photo || src.preview ? '\nLe document est une PHOTO : lis-la entièrement, y compris les colonnes et les annotations dans les marges.' : '')}, {inlineData: {mimeType: src.mime, data: src.data}}]);
  else { const text = src.kind === 'rows' ? src.rows.map(r => r.map(v => String(v).trim()).filter(Boolean).join(' | ')).join('\n') : src.text;
    const lines = text.split(/\n/).filter(l => l.trim()); let cur = '';
    for (const l of lines) { if (cur.length + l.length > 12000) { calls.push(cur); cur = ''; } cur += l + '\n'; } if (cur.trim()) calls.push(cur);
    for (let i = 0; i < calls.length; i++) calls[i] = [{text: LIST33_PROMPT + '\n\nDOCUMENT :\n' + calls[i]}]; }
  const res = new Array(calls.length); let done = 0, err = null;
  await pool(calls, 2, async (parts, i) => { let out = null;
    for (let a = 0; a < 2 && !out; a++) { try { out = await gemini(parts, {json: true, think: 'low', timeout: 180000}); } catch (e) { if (a) { err = e; return; } } }
    res[i] = (Array.isArray(out) ? out : out?.livres || []).map(aiBook33).filter(b => b.title); done++; msg && msg(done, calls.length); });
  if (err && !res.some(Boolean)) throw err;
  return res.filter(Boolean).flat();
}

/* ---------- fenêtre d'import ---------- */
function openListImport33() {
  openModal(`<div class="dhead"><h3>Importer une liste de livres</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint" style="margin-top:0">Excel, Numbers, Word, Pages, PDF, CSV (Goodreads, Babelio), texte… ou la photo d'une liste papier, imprimée ou manuscrite. L'IA lit le document et prépare les livres : vous vérifiez la liste avant l'import.</p>
    <div class="li33-btns"><label class="btn p" style="cursor:pointer">${I('cam')} Photographier une liste<input type="file" id="li33Cam" accept="image/*" capture="environment" hidden></label>
    <label class="btn g" style="cursor:pointer">${I('img')} Choisir un fichier ou des photos<input type="file" id="li33File" ${/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? '' : `accept="${LIST33_ACCEPT}"`} multiple hidden></label></div>
    <div id="li33Prev"></div></div>`, 'sm');
  const go = async e => { const files = [...(e.target.files || [])]; e.target.value = ''; if (files.length) await analyseList33(files); };
  $('#li33Cam').onchange = go; $('#li33File').onchange = go;
}
async function analyseList33(files) {
  const box = $('#li33Prev'), say = h => { if (box) box.innerHTML = `<p class="hint li33-wait"><span class="spin"></span> ${h}</p>`; };
  const L = [], notes = []; let src = 'Liste', direct = 0;
  for (let i = 0; i < files.length; i++) { const f = files[i];
    say(`Lecture de « ${esc(f.name)} » (${i + 1}/${files.length})…`);
    try { const s = await readListFile33(f);
      if (s.kind === 'rows' && s.rows.length > 1 && headRow33(s.rows) >= 0) { const h0 = headRow33(s.rows), head = s.rows[h0], m = mapCols27(head);
        { const sr = /goodreads/i.test(f.name) || head.some(h => /exclusive shelf/i.test(h)) ? 'Goodreads' : /babelio/i.test(f.name) ? 'Babelio' : 'Tableau';
          const got = s.rows.slice(h0 + 1).map(r => { r.__head = head; return rowToBook27(r, m, sr); }).filter(b => b.title); L.push(...got); direct += got.length; if (files.length === 1) src = sr; continue; } }
      if (s.kind === 'text' && !s.text.trim()) { notes.push(`« ${f.name} » est vide.`); continue; }
      if (s.preview) notes.push(`« ${f.name} » : seul l'aperçu de la 1re page a pu être lu. Pour tout importer, exportez le document en PDF.`);
      L.push(...await aiList33(s, (d, n) => say(`L'IA lit « ${esc(f.name)} »${n > 1 ? ` (partie ${d}/${n})` : ''}…`)));
    } catch (e) {
      if (e.message === 'nokey') { notes.push(`« ${f.name} » : l'analyse par l'IA demande une clé Gemini (gratuite, ⚙ Paramètres). Les tableaux avec une colonne « Titre » s'importent sans IA.`); continue; }
      notes.push(e.message.startsWith('«') || /navigateur|format|PDF|Pages|enregistrez/i.test(e.message) ? e.message : `« ${f.name} » : ${e.message}`); }
  }
  showList33(L, notes, files.length === 1 ? src : 'Liste', direct);
}
function key33(b) { return b.isbn ? 'i' + SCANLY_SOURCES.isbn13(b.isbn) : 't' + norm(b.title) + '|' + (b.volume || '') + '|' + norm((b.author || '').split(',')[0]); }
function showList33(L0, notes, src, direct) {
  const box = $('#li33Prev'); if (!box) return;
  const seen = new Set(), L = L0.filter(b => { const k = key33(b); if (seen.has(k)) return false; seen.add(k); return true; });
  const have = new Set(books.filter(b => !b.wish).map(key33));
  L.forEach(b => { b.dup33 = have.has(key33(b)); });
  const noteH = notes.length ? `<div class="li33-notes">${notes.map(n => `<p class="hint">⚠ ${esc(n)}</p>`).join('')}</div>` : '';
  if (!L.length) { box.innerHTML = noteH + '<p class="hint">Aucun livre trouvé dans ce document.</p>'; return; }
  const fresh = L.filter(b => !b.dup33).length, wishN = L.filter(b => b.toRead && !b.dup33).length;
  box.innerHTML = `${noteH}<div class="fsub20 li33" style="margin-top:12px"><b>${L.length} livre(s) trouvé(s)</b>
    <p class="hint"><span>${fresh} nouveau(x)</span>${L.length - fresh ? `<span>, ${L.length - fresh} déjà dans la bibliothèque (décochés)</span>` : ''}<span>${direct && direct < L.length ? ` · ${direct} lu(s) directement, le reste par l'IA` : direct ? ' · lus directement, sans IA' : ' · lus par l\'IA : vérifiez les titres'}</span>.</p>
    <div class="li33-all"><button class="lnk" id="li33All">Tout cocher</button> · <button class="lnk" id="li33None">Tout décocher</button></div>
    <div class="li33-list">${L.map((b, i) => `<label class="li33-row${b.dup33 ? ' dup' : ''}${b.conf33 != null && b.conf33 < .5 ? ' low' : ''}"><input type="checkbox" data-li33="${i}" ${b.dup33 ? '' : 'checked'}>
      <span data-no-i18n><b>${esc(b.title)}</b>${b.volume ? ` <i>t.${esc(b.volume)}</i>` : ''}${b.author ? `<br><small>${esc(b.author)}${b.publisher ? ' · ' + esc(b.publisher) : ''}</small>` : ''}</span>${b.dup33 ? '<em class="li33-tag">déjà là</em>' : b.toRead ? '<em class="li33-tag w">souhait</em>' : ''}</label>`).join('')}</div>
    <label class="l">Ranger dans</label><select class="fld" id="li33Case"><option value="">Non rangé (catalogue)</option>${cases.map(c => `<option data-no-i18n value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    ${wishN ? `<label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="li33Wish" checked> Mettre les ${wishN} livre(s) marqué(s) « souhait » dans la liste de souhaits</label>` : ''}
    <label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="li33Cov" checked> Chercher ensuite les couvertures</label>
    <div class="btns"><button class="btn p" id="li33Go"></button></div></div>`;
  const sel = () => $$('#li33Prev [data-li33]').filter(c => c.checked).map(c => L[+c.dataset.li33]);
  const upd = () => { const n = sel().length, g = $('#li33Go'); g.disabled = !n; g.textContent = `Importer ${n} livre(s)`; };
  box.querySelectorAll('[data-li33]').forEach(c => c.onchange = upd); upd();
  $('#li33All').onclick = () => { $$('#li33Prev [data-li33]').forEach(c => { c.checked = true; }); upd(); };
  $('#li33None').onclick = () => { $$('#li33Prev [data-li33]').forEach(c => { c.checked = false; }); upd(); };
  $('#li33Go').onclick = async () => { const pick = sel(); if (!pick.length) return; $('#li33Go').disabled = true;
    if (!await safetyPoint18('Avant import ' + src)) { $('#li33Go').disabled = false; return; }
    const caseId = $('#li33Case').value || null, wishTR = !!$('#li33Wish')?.checked, row = 1; let pos = caseId ? nextPos(caseId, row) : null;
    const made = pick.map(o => { const {toRead: tr, dup33, conf33, ...f} = o, w = wishTR && tr;
      return newBook({...f, wish: w, caseId: w ? null : caseId, row, position: w || !caseId ? null : pos++, addedAt: Date.now()}); });
    await DB.putMany('books', made); books.push(...made); closeModal(); renderAll(); toast(`✔ ${made.length} livre(s) importé(s)`, 5000);
    if ($('#li33Cov') ? $('#li33Cov').checked : true) covers27(made); };
}
openImport27 = openListImport33;   // toutes les entrées « Importer un fichier » mènent ici
