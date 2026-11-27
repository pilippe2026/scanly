/* =====================================================================
   SCANEBOOK V2.34 – METTRE À JOUR UNE ÉTAGÈRE PAR PHOTO
   On rephotographie un meuble (ou quelques étagères) : SCANEBOOK compare la
   photo à la bibliothèque et propose, à valider :
   - les nouveaux livres, à leur vraie place ;
   - les livres déplacés, remis dans l'ordre de la photo ;
   - les livres absents de la photo (laissés en place, ou retirés du meuble).
   Rien n'est supprimé ; un point de restauration est créé avant d'appliquer.
   ===================================================================== */
const UPD34 = {shots: [], det: [], res: null};

/* ---------- correspondance photo ↔ livres existants ---------- */
function score34(d, b) {
  if (!d.title || !b.title) return 0;
  const vd = parseInt(d.volume) || null, vb = parseInt(b.volume) || null;
  if (vd && vb && vd !== vb) return 0;                                   // deux tomes différents ne sont jamais le même livre
  const td = norm(d.title), tb = norm(b.title), sd = norm(d.series || ''), sb = norm(b.series || '');
  let s = td === tb ? 1 : sim(td, tb) >= .75 ? .82 : (td.length > 5 && tb.length > 5 && (td.includes(tb) || tb.includes(td))) ? .72 : 0;
  if (sd && sb && sd === sb && vd && vd === vb) s = Math.max(s, .9);
  if (sd && sb && sd === sb && !vd && !vb && s) s += .02;
  if (!s) return 0;
  const ad = norm((d.author || '').split(/[,&]/)[0]), ab = norm((b.author || '').split(/[,&]/)[0]);
  if (ad && ab) s += ad === ab || sim(ad, ab) >= .5 ? .06 : -.12;
  if (vd && !vb || !vd && vb) s -= .05;
  return s;
}
/* plus longue sous-suite croissante : les livres qui n'en font pas partie sont ceux qui ont bougé */
function lisKeep34(seq) {
  const n = seq.length, len = new Array(n).fill(1), prev = new Array(n).fill(-1); let best = -1;
  for (let i = 0; i < n; i++) { for (let j = 0; j < i; j++) if (seq[j] < seq[i] && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; } if (best < 0 || len[i] > len[best]) best = i; }
  const keep = new Set(); for (let i = best; i >= 0; i = prev[i]) keep.add(i); return keep;
}
function compare34(caseId, baseRow, det) {
  const pool = books.filter(b => !b.wish), rows = [...new Set(det.map(d => d.row))].sort((a, b) => a - b);
  const pairs = [];
  det.forEach((d, i) => pool.forEach(b => { let s = score34(d, b); if (s < .6) return; if (b.caseId === caseId) s += .05; if (b.caseId === caseId && (b.row || 1) === d.row) s += .03; pairs.push([s, i, b]); }));
  pairs.sort((p, q) => q[0] - p[0]);
  const usedD = new Set(), usedB = new Set();
  pairs.forEach(([s, i, b]) => { if (usedD.has(i) || usedB.has(b.id)) return; usedD.add(i); usedB.add(b.id); det[i].match = b; });
  // « absents » : livres de ce meuble, sur les étagères photographiées, que la photo ne montre pas
  const covered = new Set(rows), absent = books.filter(b => !b.wish && b.caseId === caseId && covered.has(b.row || 1) && !usedB.has(b.id))
    .sort((a, b) => (a.row || 1) - (b.row || 1) || (a.position || 0) - (b.position || 0));
  // déplacés : par étagère, ceux qui sortent de l'ordre (plus longue sous-suite croissante de l'ancien ordre)
  const moved = new Set();
  rows.forEach(r => { const L = det.filter(d => d.row === r && d.match), same = L.filter(d => d.match.caseId === caseId && (d.match.row || 1) === r);
    L.filter(d => !(d.match.caseId === caseId && (d.match.row || 1) === r)).forEach(d => moved.add(d));
    const keep = lisKeep34(same.map(d => d.match.position || 0)); same.forEach((d, k) => { if (!keep.has(k)) moved.add(d); }); });
  const fresh = det.filter(d => !d.match);
  return {rows, moved: det.filter(d => moved.has(d)), fresh, absent, ok: det.filter(d => d.match && !moved.has(d))};
}

/* ---------- fenêtre ---------- */
function openShelfUpdate34(caseId) {
  if (!cases.length) return toast('Créez d\'abord un meuble en photographiant une étagère');
  const cid = caseId && cases.some(c => c.id === caseId) ? caseId : cases.some(c => c.id === curCase) ? curCase : cases[0].id;
  UPD34.shots = []; UPD34.det = []; UPD34.res = null;
  openModal(`<div class="dhead"><h3>Mettre à jour une étagère</h3><button class="x" data-close>×</button></div><div class="mbody upd34">
    <p class="hint" style="margin-top:0">Rephotographiez un meuble, ou seulement quelques étagères. SCANEBOOK compare la photo à votre bibliothèque : nouveaux livres à leur place, livres déplacés, livres absents. Vous validez avant toute modification.</p>
    <div class="g2"><div><label class="l">Meuble</label><select class="fld" id="u34Case">${cases.map(c => `<option data-no-i18n value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div><label class="l">La 1re étagère de la photo est l'étagère n°</label><input class="fld" id="u34Row" type="number" min="1" max="15" value="1"></div></div>
    <div class="li33-btns"><label class="btn p" style="cursor:pointer">${I('cam')} Prendre la photo<input type="file" id="u34Cam" accept="image/*" capture="environment" hidden></label>
      <label class="btn g" style="cursor:pointer">${I('img')} Choisir des photos<input type="file" id="u34File" accept="image/*" multiple hidden></label></div>
    <p class="hint">Plusieurs photos : de gauche à droite, mêmes étagères.</p>
    <div id="u34Shots" class="u34-shots"></div>
    <label class="l">Reconnaissance</label><select class="fld" id="u34Mode"><option value="fast" ${scanMode() === 'fast' ? 'selected' : ''}>Rapide</option><option value="precise" ${scanMode() === 'precise' ? 'selected' : ''}>Précise (étagères difficiles)</option></select>
    <div class="btns"><button class="btn p" id="u34Go" disabled>Comparer avec ma bibliothèque</button></div>
    <p id="sMsg" class="hint" aria-live="polite"></p><div id="u34Res"></div></div>`, 'sm');
  const add = async e => { const fs = [...(e.target.files || [])]; e.target.value = '';
    for (const f of fs) { const u = URL.createObjectURL(f); try { const im = await srcToImg(u); UPD34.shots.push(resize(im, 2560, .9)); } catch (er) { toast('Photo illisible : ' + f.name); } finally { URL.revokeObjectURL(u); } }
    UPD34.shots = UPD34.shots.slice(0, 4); shots34(); };
  $('#u34Cam').onchange = add; $('#u34File').onchange = add; $('#u34Go').onclick = analyse34;
}
function shots34() {
  const box = $('#u34Shots'); if (!box) return;
  box.innerHTML = UPD34.shots.map((s, i) => `<div class="u34-shot"><img src="${s}" alt=""><button class="x" data-u34del="${i}" title="Retirer">×</button></div>`).join('');
  box.querySelectorAll('[data-u34del]').forEach(b => b.onclick = () => { UPD34.shots.splice(+b.dataset.u34del, 1); shots34(); });
  $('#u34Go').disabled = !UPD34.shots.length;
}
async function analyse34() {
  if (!UPD34.shots.length) return; if (!cfg.key) return toast('Clé API Gemini manquante (⚙ Paramètres)', 5000);
  if (!await checkPhotos18(UPD34.shots)) return;
  const caseId = $('#u34Case').value, base = clamp(parseInt($('#u34Row').value) || 1, 1, 15), mode = $('#u34Mode').value, prev = localStorage.getItem('scanly_mode');
  localStorage.setItem('scanly_mode', mode); $('#u34Go').disabled = true; $('#u34Res').innerHTML = ''; modalLeaveGuard = () => false;
  const det = [];
  try {
    for (let si = 0; si < UPD34.shots.length; si++) {
      $('#sMsg').innerHTML = `<span class="spin"></span> Photo ${si + 1}/${UPD34.shots.length} : lecture des tranches…`;
      const {list} = await recognize([UPD34.shots[si]]), img = await srcToImg(UPD34.shots[si]);
      list.forEach(d => { const box = Array.isArray(d.boite) && d.boite.length === 4 && d.boite.every(v => isFinite(v)) ? d.boite.map(v => clamp(Number(v), 0, 1000)) : null; let sp = null;
        if (box && box[2] - box[0] > 8 && box[3] - box[1] > 2) { try { sp = spineFromDetection(img, box, d.coins); } catch (e) { try { sp = spineData(img, box); } catch (e2) {} } }
        const title = d.titre && !d.illisible ? String(d.titre).trim() : '';
        det.push({title, author: title ? d.auteur || '' : '', series: d.serie || '', volume: parseInt(d.tome) || null, publisher: d.editeur || '', type: TYPES.includes(d.type) ? d.type : 'Autre',
          isbn: d.isbn || '', conf: title ? +d.confiance || .6 : 0, rang: parseInt(d.rangee) || 1, row: base + (parseInt(d.rangee) || 1) - 1, shot: si, pos: parseInt(d.position) || 999, sp, box}); });
    }
  } catch (e) { $('#sMsg').textContent = 'Analyse interrompue : ' + e.message; $('#u34Go').disabled = false; modalLeaveGuard = null; return; }
  finally { if (prev == null) localStorage.removeItem('scanly_mode'); else localStorage.setItem('scanly_mode', prev); }
  modalLeaveGuard = null;
  // V2.38 : rangées de chaque photo renumérotées depuis 1 (rangée du haut où un livre est vu), pour que l'étagère choisie soit bien celle du haut
  [...new Set(det.map(d => d.shot))].forEach(si => { const L = det.filter(d => d.shot === si), rs = [...new Set(L.map(d => d.rang))].sort((x, y) => x - y); L.forEach(d => { d.rang = rs.indexOf(d.rang) + 1; d.row = base + d.rang - 1; }); });
  det.sort((a, b) => a.row - b.row || a.shot - b.shot || a.pos - b.pos);
  // plusieurs photos qui se chevauchent : un même livre vu deux fois n'est gardé qu'une fois
  const seen = new Set(); UPD34.det = det.filter(d => { if (!d.title) return true; const k = d.row + '|' + norm(d.title) + '|' + (d.volume || ''); if (seen.has(k)) return false; seen.add(k); return true; });
  UPD34.res = compare34(caseId, base, UPD34.det); UPD34.caseId = caseId; UPD34.base = base;
  $('#sMsg').textContent = ''; $('#u34Go').disabled = false; render34();
}
const thumb34 = (sp, b) => sp && sp.crop ? `<img class="u34-sp" src="${sp.crop}" alt="">` : b && b.spineImg ? `<img class="u34-sp" src="${spineURL(b)}" alt="">` : `<span class="u34-sp sw" style="background:${b ? colOf(b) : '#ccc'}"></span>`;
const where34 = b => { const c = cases.find(x => x.id === b.caseId); return c ? `<span data-no-i18n>${esc(c.name)}</span> <span>· ét. ${b.row || 1}, pos. ${b.position || '?'}</span>` : '<span>non rangé</span>'; };
function render34() {
  const R = UPD34.res, box = $('#u34Res'); if (!R || !box) return;
  const nRang = Math.max(1, ...UPD34.det.map(d => d.rang || 1)), last = UPD34.base + nRang - 1;
  const target = `<div class="u34-target"><b>Appliquer sur</b><select class="fld" id="u34Case2">${cases.map(c => `<option data-no-i18n value="${c.id}" ${c.id === UPD34.caseId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <span>${nRang > 1 ? 'étagères' : 'étagère'}</span><input class="fld" id="u34Row2" type="number" min="1" max="15" value="${UPD34.base}"><span>${nRang > 1 ? `à ${last}` : ''}</span>
    <small class="hint">Mauvais meuble ou mauvaise étagère ? Changez-les ici : la comparaison se refait sans relire la photo.</small></div>`;
  const nNew = R.fresh.filter(d => d.title).length, nUnk = R.fresh.length - nNew;
  box.innerHTML = target + `<div class="u34-sum"><b>${UPD34.det.length} livre(s) sur la photo</b> · <span class="ok">${R.ok.length} à leur place</span> · <span class="mv">${R.moved.length} déplacé(s)</span> · <span class="nw">${nNew} nouveau(x)</span>${nUnk ? ` · <span>${nUnk} non reconnu(s)</span>` : ''} · <span class="ab">${R.absent.length} absent(s)</span></div>
    ${R.moved.length ? `<details class="u34-sec" open><summary>Livres déplacés <span class="badge">${R.moved.length}</span></summary>
      <label class="hint u34-opt"><input type="checkbox" id="u34Order" checked> Ranger ces livres comme sur la photo</label>
      ${R.moved.map(d => `<div class="u34-row">${thumb34(d.sp, d.match)}<span><b data-no-i18n>${esc(dispTitle(d.match))}</b><small>${where34(d.match)} <span>→ étagère ${d.row}</span></small></span></div>`).join('')}</details>` : ''}
    ${R.fresh.length ? `<details class="u34-sec" open><summary>Nouveaux livres <span class="badge">${R.fresh.length}</span></summary>
      ${R.fresh.map((d, i) => `<label class="u34-row${d.title ? '' : ' unk'}"><input type="checkbox" data-u34new="${i}" ${d.title ? 'checked' : ''}>${thumb34(d.sp)}<span><input class="fld" data-u34t="${i}" value="${esc(d.title)}" placeholder="Non reconnu – titre à saisir"><small><span>étagère ${d.row}</span>${d.author ? ` · <span data-no-i18n>${esc(d.author)}</span>` : ''}${d.title && d.conf < .6 ? '<span> · à vérifier</span>' : ''}</small></span></label>`).join('')}</details>` : ''}
    ${R.absent.length ? `<details class="u34-sec" open><summary>Absents de la photo <span class="badge">${R.absent.length}</span></summary>
      <p class="hint">Prêtés, en lecture, ou retirés ? Par défaut ils restent à leur place. Cochez ceux à retirer du meuble (ils restent dans votre bibliothèque, « non rangés »).</p>
      ${R.absent.map((b, i) => `<label class="u34-row"><input type="checkbox" data-u34abs="${i}">${thumb34(null, b)}<span><b data-no-i18n>${esc(dispTitle(b))}</b><small>${where34(b)}${isLoaned(b) ? '<span> · prêté</span>' : ''}</small></span><em class="li33-tag">retirer</em></label>`).join('')}</details>` : ''}
    ${!R.moved.length && !R.fresh.length && !R.absent.length ? '<p class="hint">Tout est déjà à jour : rien à modifier.</p>' : `
    <label class="hint u34-opt"><input type="checkbox" id="u34Comp" checked> Compléter les fiches des nouveaux livres (Google Books${cfg.key ? ', IA' : ''})</label>
    <div class="btns"><button class="btn p" id="u34Apply">Appliquer</button></div><p class="hint" id="u34Msg"></p>`}`;
  box.querySelectorAll('[data-u34t]').forEach(inp => inp.oninput = () => { const d = R.fresh[+inp.dataset.u34t]; d.title = inp.value.trim(); const c = box.querySelector(`[data-u34new="${inp.dataset.u34t}"]`); if (c && d.title) c.checked = true; });
  if ($('#u34Apply')) $('#u34Apply').onclick = apply34;
  $('#u34Case2').onchange = $('#u34Row2').onchange = () => retarget34($('#u34Case2').value, clamp(parseInt($('#u34Row2').value) || 1, 1, 15));
  box.scrollIntoView({behavior: 'smooth', block: 'start'});
}
function retarget34(caseId, base) {   // V2.35 : changer de meuble ou d'étagère sans relancer l'analyse
  UPD34.det.forEach(d => { d.row = base + (d.rang || 1) - 1; delete d.match; });
  UPD34.res = compare34(caseId, base, UPD34.det); UPD34.caseId = caseId; UPD34.base = base;
  const c = $('#u34Case'), r = $('#u34Row'); if (c) c.value = caseId; if (r) r.value = base; render34();
}
async function apply34() {
  const R = UPD34.res, caseId = UPD34.caseId, box = $('#u34Res');
  const order = $('#u34Order') ? $('#u34Order').checked : true;
  const newSel = R.fresh.filter((d, i) => box.querySelector(`[data-u34new="${i}"]`)?.checked);
  const remove = new Set(R.absent.filter((b, i) => box.querySelector(`[data-u34abs="${i}"]`)?.checked).map(b => b.id));
  if (!newSel.length && !(order && R.moved.length) && !remove.size) { $('#u34Msg').textContent = 'Rien de sélectionné.'; return; }
  const cName = cases.find(c => c.id === caseId)?.name || '?', r0 = Math.min(...R.rows), r1 = Math.max(...R.rows), nMv0 = order ? R.moved.length : 0;
  if (!confirm(T28('Appliquer sur') + ` « ${cName} », ` + T28(r1 > r0 ? `étagères ${r0} à ${r1}` : `étagère ${r0}`) + ' ?' + '\n' + T28(`${newSel.length} ajout(s), ${nMv0} déplacement(s), ${remove.size} retrait(s).`) + '\n' + T28('Vous pourrez annuler avec ↶.'))) return;
  $('#u34Apply').disabled = true;
  if (!await safetyPoint18('Avant mise à jour d\'une étagère')) { $('#u34Apply').disabled = false; return; }
  const snap = snapPos();   // V2.35 : pour ↶
  // 1. photos enregistrées comme un import (pour la tranche et le détourage des nouveaux livres)
  const imp = {id: 'imp_' + uid(), date: new Date().toISOString(), caseId, count: newSel.length, photos: [], hd: [], update34: true};
  const used = [...new Set(newSel.map(d => d.shot))];
  for (const si of used) { const im = await srcToImg(UPD34.shots[si]); imp.photos.push(resize(im, 900, .6)); imp.hd.push(resize(im, 2200, .85)); }
  const pi = Object.fromEntries(used.map((si, k) => [si, k]));
  const made = newSel.map((d, k) => { const b = newBook({title: d.title, unknown: !d.title, author: d.author, series: d.series, volume: d.volume, publisher: d.publisher, type: d.type, isbn: d.isbn,
      confidence: d.conf, scanConfidence: d.conf, caseId, row: d.row, importId: imp.id, importOrder: k, addedAt: Date.now()});
    if (d.sp) { b.color = d.sp.color; b.spineImg = d.sp.crop; if (d.sp.quad) { b.quad = d.sp.quad; b.srcRef = {imp: imp.id, pi: pi[d.shot]}; } }
    d.made = b; return b; });
  // 2. livres d'autres meubles reconnus sur la photo : déplacés seulement si « ranger comme sur la photo » est coché
  const changed = new Set(made);
  // 3. ordre final de chaque étagère photographiée
  for (const r of R.rows) {
    const inPhoto = UPD34.det.filter(d => d.row === r && ((d.match && (order || (d.match.caseId === caseId && (d.match.row || 1) === r))) || d.made)).map(d => d.match || d.made);
    const old = books.filter(b => !b.wish && b.caseId === caseId && (b.row || 1) === r && !inPhoto.includes(b)).sort((a, b) => (a.position || 0) - (b.position || 0));
    let fin;
    if (order) { fin = inPhoto.slice();
      // livres absents gardés : réinsérés après leur ancien voisin de gauche
      old.forEach(b => { if (remove.has(b.id)) return; const was = books.filter(x => !x.wish && x.caseId === caseId && (x.row || 1) === r && (x.position || 0) < (b.position || 0)).sort((p, q) => (q.position || 0) - (p.position || 0));
        const left = was.find(x => fin.includes(x)); fin.splice(left ? fin.indexOf(left) + 1 : 0, 0, b); }); }
    else { fin = books.filter(b => !b.wish && b.caseId === caseId && (b.row || 1) === r && !remove.has(b.id)).sort((a, b) => (a.position || 0) - (b.position || 0));
      UPD34.det.filter(d => d.row === r && d.made).forEach(d => { const k = UPD34.det.indexOf(d); let left = null;
        for (let j = k - 1; j >= 0; j--) { const e = UPD34.det[j]; if (e.row !== r) break; const x = e.match || e.made; if (x && fin.includes(x)) { left = x; break; } }
        fin.splice(left ? fin.indexOf(left) + 1 : 0, 0, d.made); }); }
    fin.forEach((b, i) => { if (b.caseId !== caseId || (b.row || 1) !== r || b.position !== i + 1) { b.caseId = caseId; b.row = r; b.position = i + 1; changed.add(b); } });
  }
  remove.forEach(id => { const b = books.find(x => x.id === id); if (b) { b.caseId = null; b.position = null; changed.add(b); } });
  made.forEach(b => { b.orig = {caseId, row: b.row, position: b.position}; });
  const kc = cases.find(c => c.id === caseId), maxRow = Math.max(...R.rows); if (kc && (kc.rows || 3) < maxRow) { kc.rows = maxRow; await DB.put('cases', kc); }
  if (made.length) { await DB.put('imports', imp); imports.push(imp); books.push(...made); }
  await DB.putMany('books', [...changed]);
  const comp = $('#u34Comp')?.checked;
  closeModal(); setView('lib'); curCase = caseId; localStorage.setItem('scanly_case', curCase); renderRoom(true); renderAll();
  const nMv = order ? R.moved.length : 0;
  UNDO.stack.push({label: 'Mise à jour de l\'étagère', at: Date.now(), s: snap, added: made.map(b => b.id)}); if (UNDO.stack.length > 25) UNDO.stack.shift(); UNDO.redo = []; persistUndo();
  try { localStorage.setItem('scanly_upd34_last', JSON.stringify([...changed].map(b => b.id))); } catch (e) {}
  showUndo(`✔ Étagère mise à jour : ${made.length} ajouté(s), ${nMv} déplacé(s), ${remove.size} retiré(s)`);
  if (comp && made.some(b => b.title)) bgComplete(made, true, !!cfg.key);
}

/* ---------- accès : menu Ajouter et menu Outils de la pièce ---------- */
{ const o = openAdd29; openAdd29 = function () { o.apply(this, arguments); const s = $('#mbox .sheet29'); if (!s || $('#ad34Upd')) return;
    s.insertAdjacentHTML('beforeend', sheetBtn29('ad34Upd', '⟳', 'Mettre à jour une étagère', 'Nouveaux, déplacés, absents : d\'après une photo'));
    $('#ad34Upd').onclick = () => { closeModal(); openShelfUpdate34(); }; }; }
function boot34() {
  const dd = [...$$('#camBar .dd')].find(d => d.querySelector('[data-act="sort"]'));
  if (dd && !$('#upd34Btn')) { dd.insertAdjacentHTML('beforeend', '<button type="button" id="upd34Btn" title="Comparer une nouvelle photo du meuble avec la bibliothèque">⟳ Mettre à jour</button>');
    $('#upd34Btn').onclick = e => { e.stopPropagation(); $$('#camBar .ddw.open').forEach(x => x.classList.remove('open')); openShelfUpdate34(curCase); }; }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot34, 0)); else setTimeout(boot34, 0);

/* ---------- V2.35 : ↶ annule aussi une mise à jour d'étagère (y compris les livres ajoutés) ---------- */
{ const o = undo; undo = async function () {
    const u = UNDO.stack[UNDO.stack.length - 1]; if (!u || !u.added || !u.added.length) return o.apply(this, arguments);
    const ids = new Set(u.added), gone = books.filter(b => ids.has(b.id));
    for (const b of gone) await DB.del('books', b.id); books = books.filter(b => !ids.has(b.id));
    await o.apply(this, arguments); const r = UNDO.redo[UNDO.redo.length - 1]; if (r) r.addedBooks = gone; }; }
{ const o = redo; redo = async function () {
    const r = UNDO.redo[UNDO.redo.length - 1]; if (!r || !r.addedBooks) return o.apply(this, arguments);
    const add = r.addedBooks.filter(b => !books.some(x => x.id === b.id)); if (add.length) { await DB.putMany('books', add); books.push(...add); }
    await o.apply(this, arguments); const u = UNDO.stack[UNDO.stack.length - 1]; if (u) { u.added = r.addedBooks.map(b => b.id); persistUndo(); } }; }
/* ---------- V2.35 : sélection en un geste des livres de la dernière mise à jour (pour les changer d'étagère ensemble) ---------- */
function lastUpd35() { try { const ids = JSON.parse(localStorage.getItem('scanly_upd34_last') || '[]'); return ids.filter(id => books.some(b => b.id === id)); } catch (e) { return []; } }
{ const o = renderSelBar; renderSelBar = function () { o.apply(this, arguments); const bar = $('#selBar'), ids = lastUpd35();
    if (!bar || !bar.classList.contains('on') || !ids.length || $('#selUpd35')) return;
    bar.insertAdjacentHTML('beforeend', `<button class="btn s sm" id="selUpd35" title="Sélectionner les livres ajoutés ou déplacés par la dernière mise à jour d'étagère">Dernière mise à jour (${ids.length})</button>`);
    $('#selUpd35').onclick = () => { ids.forEach(id => SEL.add(id)); renderRoom(); if (typeof renderList === 'function') renderList(); }; }; }
