/* SCANEBOOK – 04_scan.js : Scanner, historique des imports, voix, assistant IA.
   Les fichiers js/ sont chargés dans l'ordre par index.html et partagent les mêmes variables globales. */
'use strict';
/* =====================================================================
   SCANNER
   ===================================================================== */
let shots = [], detected = [], stream = null;
let modalExtraCleanup = null, modalLeaveGuard = null;
function runModalCleanup(){if(modalExtraCleanup){const fn=modalExtraCleanup;modalExtraCleanup=null;fn();}}
function openModal(html, size = '') { modalLeaveGuard=null; runModalCleanup(); $('#mbox').className = 'mbox ' + size; $('#mbox').innerHTML = html; $('#mbox').onclick = null; $('#modal').classList.add('on');queueMicrotask(enhanceModal18); }
function closeModal() { if(modalLeaveGuard&&!modalLeaveGuard())return false;modalLeaveGuard=null;runModalCleanup(); $('#modal').classList.remove('on'); stopCam(); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
function stopCam() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
function openScan(caseId = null, mode = '') {
  if (!cfg.key) { toast('Ajoute d\'abord ta clé Gemini'); return openSettings(); }
  shots = []; detected = [];
  const sel = caseId || defaultCase() || '__new';
  openModal(`<div class="dhead"><h3>Scanner des tranches de livres</h3><button class="x" data-close>×</button></div><div class="mbody">
    <div class="step"><i>1</i>Dans quel meuble ? <span class="hint" style="font-weight:400">(modifiable aussi à l'étape 3)</span></div>
    <div class="g2"><select class="fld" id="sCase">${cases.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new" ${sel === '__new' ? 'selected' : ''}>＋ Nouveau meuble…</option></select>
      <input class="fld" id="sNew" placeholder="Nom (ex. Salon – Bibliothèque BD)" style="display:${sel === '__new' ? 'block' : 'none'}"></div>
    <div class="step" style="margin-top:18px"><i>2</i>Prendre ou importer des photos</div>
    <div class="scan-grid">
      <div class="camwrap" id="camwrap"><video id="vid" autoplay playsinline muted></video><div class="camframe"><i></i><i></i><i></i><i></i></div>
        <div class="camoff" id="camoff">${I('cam')}<div>Webcam du PC</div><button class="btn g" id="camOn">Activer la caméra</button></div>
        <button class="shoot" id="shoot" title="Prendre la photo (Espace)"></button>
        <button class="btn s sm" id="burstBtn" style="position:absolute;bottom:26px;right:14px;display:none" title="4 photos successives en glissant vers la droite, assemblées automatiquement">Rafale ×4</button>
        <div class="burst" id="burstCd"></div></div>
      <label class="drop" id="drop" for="fileIn">${I('img')}<b>Importer des photos</b><span>Clique ou glisse-dépose des images</span><span class="hint">Astuce : 1 photo par étagère, bien de face, sans reflet</span></label>
    </div>
    <div class="thumbs" id="thumbs"></div>
    <div class="smode" id="sMode"><span class="step" style="margin:0"><i>⚡</i>Reconnaissance</span>
      <label class="smo"><input type="radio" name="smode" value="fast" ${scanMode() === 'fast' ? 'checked' : ''}><b>Rapide</b><span>≈ 30 à 60 s par photo · ~5 appels IA · conseillé</span></label>
      <label class="smo"><input type="radio" name="smode" value="precise" ${scanMode() === 'precise' ? 'checked' : ''}><b>Précise</b><span>2 à 4 min · ~15 appels IA · étagères difficiles (poches serrés, livres de biais)</span></label></div>
    <label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:10px"><input type="checkbox" id="sMerge" style="accent-color:var(--navy)"> Ces photos sont des morceaux d'un même grand meuble (de gauche à droite) : les assembler</label>
    <div class="btns"><button class="btn p" id="sGo" disabled>Analyser avec l'IA</button><span class="hint" id="sMsg" style="align-self:center"></span></div>
    <div class="prog" id="sProg"><i></i></div><div id="review"></div></div>`);
  $('#sCase').onchange = () => $('#sNew').style.display = $('#sCase').value === '__new' ? 'block' : 'none';
  $('#camOn').onclick = () => startCam(); $('#shoot').onclick = snap; $('#burstBtn').onclick = burst;
  const dz = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  $('#sGo').onclick = analyze;
  if (mode === 'cam') { if (IS_TOUCH) $('#camIn').click(); else startCam(); }
  if (IS_TOUCH && $('#camOn')) { $('#camOn').textContent = 'Ouvrir l\'appareil photo'; $('#camOn').onclick = () => $('#camIn').click(); }
  if (mode === 'imp') setTimeout(() => $('#fileIn').click(), 50);
}
async function startCam(devId) {
  try { stopCam();
    stream = await navigator.mediaDevices.getUserMedia({video: devId ? {deviceId: {exact: devId}, width: {ideal: 1920}, height: {ideal: 1080}} : {facingMode: {ideal: 'environment'}, width: {ideal: 1920}, height: {ideal: 1080}}, audio: false});
    $('#vid').srcObject = stream; $('#camoff').style.display = 'none'; $('#shoot').style.display = 'block'; $('#burstBtn').style.display = 'inline-flex';
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    if (devs.length > 1) { let s = $('#camPick'); if (!s) { s = document.createElement('select'); s.id = 'camPick'; s.className = 'fld'; s.style.cssText = 'position:absolute;top:10px;left:10px;width:auto;max-width:60%;opacity:.9'; $('#camwrap').appendChild(s); s.onchange = () => startCam(s.value); }
      const cur = stream.getVideoTracks()[0].getSettings().deviceId;
      s.innerHTML = devs.map((d, i) => `<option value="${d.deviceId}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || 'Caméra ' + (i + 1))}</option>`).join(''); }
  } catch (e) { toast('Caméra inaccessible : ' + (e.name === 'NotAllowedError' ? 'autorisation refusée' : e.message), 4500); }
}
function snap() { const v = $('#vid'); if (!v || !v.videoWidth) return; addShot(resize(v, 2560, .9)); $('#camwrap').animate([{filter: 'brightness(2.5)'}, {filter: 'none'}], 250); }
async function burst() {
  if (!stream) return; const cd = $('#burstCd'); cd.style.display = 'flex';
  for (const t of [3, 2, 1]) { cd.textContent = t; await sleep(700); }
  for (let k = 1; k <= 4; k++) { cd.innerHTML = `<span style="font-size:26px">${k}/4${k < 4 ? '<br>glisse doucement vers la droite' : ''}</span>`; snap(); if (k < 4) await sleep(1700); }
  cd.style.display = 'none'; $('#sMerge').checked = true; toast('4 photos prises : elles seront assemblées en un seul meuble');
}
async function addFiles(fl) { for (const f of [...fl]) { if (!f.type.startsWith('image/')) continue;
  try { const url = URL.createObjectURL(f); const img = await srcToImg(url); addShot(resize(img, 2560, .9)); URL.revokeObjectURL(url); } catch (e) { toast(f.name + ' : format non lu (convertis en JPG)'); } } }
$('#fileIn').onchange = e => { if (!$('#modal').classList.contains('on') || !$('#thumbs')) openScan(); addFiles(e.target.files); e.target.value = ''; };
function addShot(d) { shots.push(d); renderShots(); }
function renderShots() {
  if (!$('#thumbs')) return;
  $('#thumbs').innerHTML = shots.map((s, i) => `<div class="th"><img src="${s}" alt=""><button data-rm="${i}" title="Retirer">×</button><button data-ed="${i}" title="Recadrer / redresser">✎</button></div>`).join('');
  $('#sGo').disabled = !shots.length; $('#sMsg').textContent = shots.length ? shots.length + ' photo(s) prête(s) – ✎ pour recadrer ou redresser' : '';
}
document.addEventListener('click', e => {
  const r = e.target.closest('[data-rm]'); if (r && $('#thumbs')) { shots.splice(+r.dataset.rm, 1); return renderShots(); }
  const ed = e.target.closest('[data-ed]'); if (ed && $('#thumbs')) openEditor(+ed.dataset.ed);
});

/* --- Éditeur : recadrer / pivoter / redresser --- */
const ED = {i: -1, img: null, rot: 0, fine: 0, sel: null, dn: null};
async function openEditor(i) { ED.i = i; ED.img = await srcToImg(shots[i]); ED.rot = 0; ED.fine = 0; ED.sel = null; $('#edA').value = 0; $('#edAv').textContent = '0°'; $('#editor').classList.add('on'); drawEd(); }
function rotated() {
  const a = (ED.rot + ED.fine) * Math.PI / 180, w = ED.img.naturalWidth, h = ED.img.naturalHeight, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const cv = document.createElement('canvas'); cv.width = Math.round(w * c + h * s); cv.height = Math.round(w * s + h * c);
  const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height); x.translate(cv.width / 2, cv.height / 2); x.rotate(a); x.drawImage(ED.img, -w / 2, -h / 2); return cv;
}
function drawEd() { const full = rotated(), k = Math.min(1, innerWidth * .86 / full.width, innerHeight * .66 / full.height), cv = $('#edCan'); cv.width = Math.round(full.width * k); cv.height = Math.round(full.height * k); cv.getContext('2d').drawImage(full, 0, 0, cv.width, cv.height); showSel(); }
function showSel() { const s = $('#edSel'), cv = $('#edCan'); if (!ED.sel) { s.style.display = 'none'; return; } Object.assign(s.style, {display: 'block', left: ED.sel.x * cv.clientWidth + 'px', top: ED.sel.y * cv.clientHeight + 'px', width: ED.sel.w * cv.clientWidth + 'px', height: ED.sel.h * cv.clientHeight + 'px'}); }
const edPos = e => { const r = $('#edCan').getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
$('#edCan').addEventListener('mousedown', e => { ED.dn = edPos(e); ED.sel = null; showSel(); e.preventDefault(); });
window.addEventListener('mousemove', e => { if (!ED.dn) return; const [x, y] = edPos(e), [x0, y0] = ED.dn; ED.sel = {x: Math.min(x, x0), y: Math.min(y, y0), w: Math.abs(x - x0), h: Math.abs(y - y0)}; showSel(); });
window.addEventListener('mouseup', () => { if (!ED.dn) return; ED.dn = null; if (ED.sel && (ED.sel.w < .03 || ED.sel.h < .03)) { ED.sel = null; showSel(); } });
$('#edL').onclick = () => { ED.rot -= 90; ED.sel = null; drawEd(); };
$('#edR').onclick = () => { ED.rot += 90; ED.sel = null; drawEd(); };
$('#edA').oninput = e => { ED.fine = +e.target.value; $('#edAv').textContent = ED.fine + '°'; drawEd(); };
$('#edReset').onclick = () => { ED.sel = null; showSel(); };
$('#edCancel').onclick = () => $('#editor').classList.remove('on');
$('#edOk').onclick = () => {
  const full = rotated(); let out = full;
  if (ED.sel) { const s = ED.sel; out = document.createElement('canvas'); out.width = Math.max(1, Math.round(s.w * full.width)); out.height = Math.max(1, Math.round(s.h * full.height));
    out.getContext('2d').drawImage(full, s.x * full.width, s.y * full.height, out.width, out.height, 0, 0, out.width, out.height); }
  shots[ED.i] = resize(out, 2560, .9); $('#editor').classList.remove('on'); renderShots(); toast('Photo modifiée');
};

/* --- Analyse : lecture des tranches + découpe, vraie couleur et vraie taille --- */
function scanMode() { return localStorage.getItem('scanly_mode') === 'precise' ? 'precise' : 'fast'; }
async function analyze() {
  if(!await checkPhotos18(shots))return;
  { const r = document.querySelector('input[name=smode]:checked'); if (r) localStorage.setItem('scanly_mode', r.value); }
  window.SCAN_T = {t0: performance.now(), steps: []};
  const merge = $('#sMerge').checked && shots.length > 1;
  if (merge && shots.length > 8) toast('Assemblage limité aux 8 premières photos');
  const batches = merge ? [shots.map((_, i) => i).slice(0, 8)] : shots.map((_, i) => [i]);
  stopCam(); $('#shoot').style.display = 'none'; $('#burstBtn').style.display = 'none'; $('#camoff').style.display = 'flex';
  $('#sGo').disabled = true; $('#sProg').style.display = 'block'; detected = []; const tScan = performance.now(); PERF.reset();
  let rowOff = 0;
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    $('#sMsg').innerHTML = `<span class="spin"></span> Lecture des tranches – ${merge ? `assemblage de ${batch.length} photos` : `photo ${bi + 1}/${batches.length}`}…`; $('#sProg i').style.width = (bi / batches.length * 100) + '%';
    try {
      const {list} = await recognize(batch.map(i => shots[i]));
      const imgs = await Promise.all(batch.map(i => srcToImg(shots[i])));
      const items = list.map(d => { const ii = clamp(parseInt(d.image) || 0, 0, batch.length - 1);
        const box = Array.isArray(d.boite) && d.boite.length === 4 && d.boite.every(v => isFinite(v)) ? d.boite.map(v => clamp(Number(v), 0, 1000)) : null;
        const ok = box && box[2] - box[0] > 8 && box[3] - box[1] > 2; let sp = null;
        if (ok) { try { sp = spineFromDetection(imgs[ii], box, d.coins); } catch (e) { console.warn(e); sp = spineData(imgs[ii], box); } }
        return {d, ii, box: ok ? box : null, sp}; });
      const med = {}; batch.forEach((_, ii) => { const hs = items.filter(x => x.ii === ii && x.sp).map(x => x.sp.hpx).sort((a, b) => a - b); med[ii] = hs.length ? hs[Math.floor(hs.length / 2)] : 0; });
      let maxRow = 0;
      for (const {d, ii, box, sp} of items) {
        const row = (parseInt(d.rangee) || 1) + rowOff; maxRow = Math.max(maxRow, row);
        const title = d.titre && !d.illisible ? String(d.titre).trim() : '';
        const b = newBook({title, unknown: !title, author: title ? d.auteur || '' : '', series: d.serie || '', volume: parseInt(d.tome) || null, publisher: d.editeur || '',
          type: TYPES.includes(d.type) ? d.type : 'Autre', isbn: d.isbn || '', thickness: d.epaisseur, height: d.hauteur, confidence: title ? d.confiance : 0,scanConfidence:title&&Number.isFinite(+d.confiance)?clamp(+d.confiance,0,1):0, row, position: parseInt(d.position) || 999});
        if (sp) { b.color = sp.color; b.spineImg = sp.crop; if (med[ii]) { b.pxMed = med[ii]; b.hU = Math.round(clamp(170 * sp.hpx / med[ii], 90, 300)); b.wU = Math.round(clamp(170 * sp.wpx / med[ii], 6, 95)); } }
        b._shot = batch[ii]; b._box = box;
        if (sp && sp.quad) { b.quad = sp.quad; const xs = sp.quad.map(p => p[0] * 1000), ys = sp.quad.map(p => p[1] * 1000); b._box = [Math.min(...ys), Math.min(...xs), Math.max(...ys), Math.max(...xs)]; }
        b._alts = (Array.isArray(d.alternatives) ? d.alternatives : []).filter(a => a && a.titre && norm(a.titre) !== norm(title)).slice(0, 2);
        b._dup = !!title && (books.some(x => !x.wish && keyOf(x) === keyOf(b)) || detected.some(x => x.title && keyOf(x) === keyOf(b))); b._sel = !b._dup; detected.push(b);
      }
      if (!merge) rowOff = 0; // chaque photo garde ses propres étagères (modifiable dans le tableau)
    } catch (e) { toast((merge ? 'Assemblage' : 'Photo ' + (bi + 1)) + ' : ' + e.message, 5000); }
  }
  detected.sort((a, b) => a._shot - b._shot || a.row - b.row || a.position - b.position);
  REV38.merge = merge; prows38(); REV38.base = 1; rows38();
  const unk = detected.filter(d => d.unknown).length;
  $('#sProg').style.display = 'none'; $('#sGo').disabled = false;
  { const T = window.SCAN_T; if (T && T.steps.length) { const L = T.steps[T.steps.length - 1]; if (L.ms == null) L.ms = performance.now() - L.t; } }
  $('#sMsg').textContent = `Mode ${scanMode() === 'fast' ? 'rapide' : 'précis'} · ${PERF.aiCalls} appel(s) IA · durée ${fmtDur(performance.now() - tScan)}${window.SCAN_T && window.SCAN_T.steps.length ? ' (' + window.SCAN_T.steps.filter(x => x.ms > 500).map(x => x.k.replace(/^lecture d'ensemble$/, 'ensemble').replace(/^regroupement des morceaux.*$/, 'regroupement').replace(/^lecture des tranches$/, 'lecture').replace(/^découpage des tranches$/, 'découpage') + ' ' + fmtDur(x.ms)).join(', ') + ')' : ''}${PERF.waitMs > 2000 ? ` (dont ${fmtDur(PERF.waitMs)} d'attente quota)` : ''}${unk ? ` · ${unk} livre(s) non reconnu(s), ajouté(s) avec des champs vides` : ''}`;
  renderReview(true);
}
function rebindScan() {
  $('#sCase').onchange = () => $('#sNew').style.display = $('#sCase').value === '__new' ? 'block' : 'none';
  $('#camOn').onclick = () => startCam(); $('#shoot').onclick = snap; $('#burstBtn').onclick = burst; $('#sGo').onclick = analyze; renderShots();
}
/* V2.38 : une seule numérotation (1 = étagère du haut, comme dans la pièce 3D).
   _prow = rangée dans la photo (1 = la plus haute rangée où un livre a été lu, par photo) ;
   d.row = étagère réelle du meuble, affichée dans le tableau et utilisée telle quelle au rangement. */
const REV38 = {base: 1, merge: false};
const grp38 = d => REV38.merge ? 0 : d._shot; // photos assemblées : une seule numérotation
function prows38() {
  const shotsSeen = [...new Set(detected.map(grp38))];
  shotsSeen.forEach(si => { const L = detected.filter(d => grp38(d) === si), rs = [...new Set(L.map(d => d.row || 1))].sort((a, b) => a - b);
    L.forEach(d => { d._prow = rs.indexOf(d.row || 1) + 1; delete d._rowMan; }); });
}
function rows38() {
  const shotsSeen = [...new Set(detected.map(grp38))];
  shotsSeen.forEach(si => { const L = detected.filter(d => grp38(d) === si && d._prow), S = L.filter(d => d._sel), ref = S.length ? S : L;
    const top = Math.min(...ref.map(d => d._prow));
    L.forEach(d => { if (!d._rowMan) d.row = clamp(REV38.base + d._prow - top, 1, 15); }); });
}
function showRows38() { $$('#review tr[data-i]').forEach(tr => { const d = detected[+tr.dataset.i], inp = tr.querySelector('[data-k=row]'); if (d && inp && document.activeElement !== inp) inp.value = d.row; }); }
/* V2.45 : cadre dessiné selon le vrai contour (livre penché) au lieu d'un rectangle qui déborde sur les voisins */
function quadSvg45(d) {
  const q = d.quad, B = d._box; if (!Array.isArray(q) || q.length !== 4 || !B) return '';
  const w = Math.max(1, B[3] - B[1]), h = Math.max(1, B[2] - B[0]), pts = q.map(p => `${((p[0] * 1000 - B[1]) / w * 100).toFixed(1)},${((p[1] * 1000 - B[0]) / h * 100).toFixed(1)}`).join(' ');
  return `<svg class="q45" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="${pts}"/></svg>`;
}
function renderReview(scroll = false) {
  const dups = detected.filter(d => d._dup).length, unk = detected.filter(d => d.unknown).length, used = [...new Set(detected.map(d => d._shot).filter(v => v != null && shots[v]))];
  const s1 = $('#sCase').value, nm = $('#sNew').value;
  $('#review').innerHTML = !detected.length ? `<p class="hint" style="margin-top:14px">Aucun ouvrage repéré. Essaie une photo plus nette, plus proche et bien éclairée (✎ pour recadrer).</p>` : `
    <div class="step" style="margin-top:20px"><i>3</i>Vérifier et ranger</div>
    <div class="hint"><b style="color:var(--navy)">${detected.length}</b> livre(s) repéré(s)${unk ? ` · <span style="color:var(--ko)">${unk} non reconnu(s) : ajoutés avec des champs vides à compléter</span>` : ''}${dups ? ` · ${dups} déjà présent(s) (décochés)` : ''}.</div>
    ${detected.some(d => d._box) ? `<div class="shots">${used.map(si => `<div class="shotv"><img src="${shots[si]}" alt="">${detected.map((d, i) => d._shot === si && d._box ? `<div class="bbox${d.unknown ? ' unk' : ''}${d._sel ? '' : ' off'}" data-bi="${i}" style="top:${d._box[0] / 10}%;left:${d._box[1] / 10}%;height:${Math.max(1, d._box[2] - d._box[0]) / 10}%;width:${Math.max(1, d._box[3] - d._box[1]) / 10}%">${quadSvg45(d)}<span>${i + 1}</span></div>` : '').join('')}</div>`).join('')}</div>
      <p class="hint">Chaque cadre numéroté = une ligne du tableau (pointillés rouges = non reconnu). Survole une ligne pour la repérer, clique sur un cadre pour aller à la ligne.</p>` : ''}
    <table class="rev"><tr><th>#</th><th><input type="checkbox" id="rAll" ${detected.every(d => d._sel) ? 'checked' : ''}></th><th>Tranche</th><th>Titre</th><th>Auteur</th><th>Série / T.</th><th>Type</th><th title="Étagère du meuble (1 = en haut)">Étagère</th><th>Pos.</th><th>Conf.</th></tr>
    ${detected.map((d, i) => `<tr data-i="${i}" class="${d.unknown ? 'unk' : ''}"><td class="hint" style="padding-top:10px"><b>${i + 1}</b></td><td><input type="checkbox" data-k="_sel" ${d._sel ? 'checked' : ''}></td><td style="white-space:nowrap">${d.spineImg ? `<img class="crop" src="${d.spineImg}" alt="" style="display:inline-block;vertical-align:top">` : `<div class="sw" style="background:${colOf(d)};display:inline-block"></div>`}${d._box ? ` <button type="button" class="btn s sm" data-qe="${i}" title="Ajuster le détourage de ce livre (4 coins)" style="padding:3px 7px;vertical-align:top">✎</button>` : ''}</td>
      <td><input class="fld" data-k="title" value="${esc(d.title)}" placeholder="${d.unknown ? 'Non reconnu – à compléter (ou plus tard)' : ''}">${d._dup ? '<span class="badge k">Déjà présent</span>' : ''}${d.unknown ? '<span class="badge k">Non reconnu</span>' : d.confidence != null && d.confidence < .6 ? '<span class="badge g">À vérifier</span>' : ''}
        ${d._alts && d._alts.length ? `<div class="alts"><span class="hint">L'IA hésite :</span>${d._alts.map((a, k) => `<button type="button" class="alt" data-alt="${k}" title="Remplacer par cette proposition">↺ ${esc(a.titre)}${a.auteur ? ' – ' + esc(a.auteur) : ''}</button>`).join('')}</div>` : ''}</td>
      <td><input class="fld" data-k="author" value="${esc(d.author)}"></td>
      <td style="white-space:nowrap"><input class="fld" data-k="series" value="${esc(d.series)}" style="width:110px"> <input class="fld" data-k="volume" type="number" value="${esc(d.volume)}" style="width:52px"></td>
      <td><select class="fld" data-k="type">${TYPES.map(t => `<option ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><input class="fld" data-k="row" type="number" min="1" value="${d.row}" style="width:50px"></td><td><input class="fld" data-k="position" type="number" value="${d.position}" style="width:54px"></td>
      <td class="hint" style="padding-top:10px">${d.unknown ? '—' : d.confidence != null ? Math.round(d.confidence * 100) + '%' : ''}</td></tr>`).join('')}</table>
    <div class="dest"><b>Ranger dans</b><select id="rCase">${cases.map(c => `<option value="${c.id}" ${c.id === s1 ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new" ${s1 === '__new' ? 'selected' : ''}>＋ Nouveau meuble…</option></select>
      <input id="rNew" placeholder="Nom du nouveau meuble" value="${esc(nm)}" style="display:${s1 === '__new' ? 'block' : 'none'}">
      <span>la rangée du haut de la photo va sur l'étagère</span><input id="rRow0" type="number" min="1" max="15" value="${REV38.base}" style="width:60px"><span class="hint">(1 = étagère du haut, comme les numéros de la pièce 3D ; la colonne « Étagère » montre où chaque livre sera rangé ; les livres se placent à la suite de ceux déjà présents)</span></div>
    <div class="btns"><label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="rGB" checked style="accent-color:var(--navy)"> Compléter via Google Books / Open Library</label>
      <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="rAI" checked style="accent-color:var(--navy)"> Compléter avec l'IA (genre, résumé, prix estimé)</label></div>
    <div class="btns"><button class="btn g" id="rAdd">Ranger dans ma bibliothèque</button></div>`;
  if (!detected.length) return;
  $('#rCase').onchange = () => $('#rNew').style.display = $('#rCase').value === '__new' ? 'block' : 'none';
  $('#rRow0').oninput = () => { const v = parseInt($('#rRow0').value); if (!(v >= 1)) return; REV38.base = Math.min(15, v); rows38(); showRows38(); };
  $('#review table').oninput = e => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; const d = detected[tr.dataset.i], k = e.target.dataset.k;
    d[k] = e.target.type === 'checkbox' ? e.target.checked : (['volume', 'row', 'position'].includes(k) ? (parseInt(e.target.value) || null) : e.target.value);
    if (k === 'row') d._rowMan = true; if (k === '_sel') { rows38(); showRows38(); }
    if (k === '_sel') $(`#review .bbox[data-bi="${tr.dataset.i}"]`)?.classList.toggle('off', !e.target.checked); };
  $('#review').onclick = e => {
    const al = e.target.closest('[data-alt]'); if (al) { const i = +al.closest('tr').dataset.i, d = detected[i], k = +al.dataset.alt, a = d._alts[k];
      d._alts[k] = {titre: d.title, auteur: d.author}; d.title = a.titre; d.author = a.auteur || ''; d.unknown = false; d._dup = books.some(x => !x.wish && keyOf(x) === keyOf(d)); d._sel = !d._dup; return renderReview(); }
    const qe = e.target.closest('[data-qe]'); if (qe) { const d = detected[+qe.dataset.qe], keep = $('#mbox').innerHTML, scrollY = $('#mbox .mbody')?.scrollTop || 0;
      const quad = d.quad || [[d._box[1] / 1000, d._box[0] / 1000], [d._box[3] / 1000, d._box[0] / 1000], [d._box[3] / 1000, d._box[2] / 1000], [d._box[1] / 1000, d._box[2] / 1000]];
      const back = () => { $('#mbox').innerHTML = keep; $('#modal').classList.add('on'); rebindScan(); renderReview(); const mb = $('#mbox .mbody'); if (mb) mb.scrollTop = scrollY; };
      openQuadEditor({src: shots[d._shot], quad, title: `Détourage du livre n° ${+qe.dataset.qe + 1}`, onSave: async (qn, sp) => {
        d.quad = qn; d.spineImg = sp.crop; d.color = sp.color; if (d.pxMed) { d.hU = Math.round(clamp(170 * sp.hpx / d.pxMed, 90, 300)); d.wU = Math.round(clamp(170 * sp.wpx / d.pxMed, 6, 95)); }
        const xs = qn.map(p => p[0] * 1000), ys = qn.map(p => p[1] * 1000); d._box = [Math.min(...ys), Math.min(...xs), Math.max(...ys), Math.max(...xs)];
        back(); toast('Détourage mis à jour'); }}).then(() => $$('#mbox [data-close]').forEach(x => x.addEventListener('click', e2 => { e2.stopPropagation(); if (modalLeaveGuard && !modalLeaveGuard()) return; modalLeaveGuard = null; runModalCleanup(); setTimeout(back, 0); }, true)));
      return; }
    const bb = e.target.closest('.bbox'); if (bb) { const tr = $(`#review tr[data-i="${bb.dataset.bi}"]`); tr.scrollIntoView({behavior: 'smooth', block: 'center'}); tr.querySelector('[data-k=title]').focus(); }
  };
  $('#review').onmouseover = e => { const tr = e.target.closest('tr[data-i]'), bb = e.target.closest('.bbox'), i = tr ? tr.dataset.i : bb ? bb.dataset.bi : null;
    $$('#review .bbox.hl,#review tr.hl').forEach(x => x.classList.remove('hl')); if (i == null) return;
    $(`#review .bbox[data-bi="${i}"]`)?.classList.add('hl'); $(`#review tr[data-i="${i}"]`)?.classList.add('hl'); };
  $('#rAll').onchange = e => { detected.forEach(d => d._sel = e.target.checked); $$('#review [data-k="_sel"]').forEach(c => c.checked = e.target.checked); $$('#review .bbox').forEach(b => b.classList.toggle('off', !e.target.checked)); };
  $('#rAdd').onclick = addDetected;
  if (scroll) $('#review').scrollIntoView({behavior: 'smooth', block: 'start'});
}
async function addDetected() {
  const sel = detected.filter(d => d._sel); if (!sel.length) return toast('Aucun ouvrage sélectionné');
  const useGB = $('#rGB').checked, useAI = $('#rAI').checked; rows38();
  sel.forEach(d => { d.row = clamp(parseInt(d.row) || 1, 1, 15); delete d._prow; delete d._rowMan; });
  const maxRow = Math.max(...sel.map(d => d.row)); // V2.38 : d.row = étagère réelle, déjà affichée dans le tableau
  let dest = $('#rCase').value; if (dest === '__new') dest = (await newCase($('#rNew').value || 'Nouveau meuble', maxRow)).id;
  const kc = cases.find(c => c.id === dest); if (kc && (kc.rows || 3) < maxRow) { kc.rows = maxRow; await DB.put('cases', kc); }
  for (const d of sel.filter(d => d.title)) { const w = books.find(x => x.wish && keyOf(x) === keyOf(d)) || books.find(x => x.wish && x.series && d.series && norm(x.series) === norm(d.series) && x.volume === d.volume);
    if (w) { await DB.del('books', w.id); books = books.filter(x => x.id !== w.id); } }
  const imp = {id: 'imp_' + uid(), date: new Date().toISOString(), caseId: dest, count: sel.length, photos: [], hd: []}, piOf = {};
  for (const si of [...new Set(sel.map(d => d._shot))].filter(v => shots[v])) { const im = await srcToImg(shots[si]); piOf[si] = imp.hd.length; imp.photos.push(resize(im, 900, .6)); imp.hd.push(resize(im, 2200, .85)); }
  sel.forEach(d => { if (d.quad && piOf[d._shot] != null) d.srcRef = {imp: imp.id, pi: piOf[d._shot]}; });
  const rows = new Map(); sel.forEach(d => { const r = d.row; if (!rows.has(r)) rows.set(r, []); rows.get(r).push(d); });
  rows.forEach((L, r) => { const base = nextPos(dest, r) - 1; L.sort((a, b) => (a.position || 999) - (b.position || 999)).forEach((d, i) => { d.row = r; d.position = base + i + 1; }); });
  sel.forEach((d, i) => { d.title = String(d.title || '').trim(); d.unknown = !d.title; ['_sel', '_dup', '_shot', '_box', '_alts'].forEach(k => delete d[k]);
    d.caseId = dest; d.importId = imp.id; d.importOrder = i; d.orig = {caseId: dest, row: d.row, position: d.position}; d.addedAt = Date.now(); });
  await DB.put('imports', imp); imports.push(imp);
  await DB.putMany('books', sel); books.push(...sel);
  closeModal(); setView('lib'); curCase = dest; localStorage.setItem('scanly_case', curCase); renderRoom(true); renderAll();
  sel.forEach((d, i) => { const el = $(`#unit .book[data-id="${d.id}"]`); if (el) { el.style.animationDelay = (i * 30) + 'ms'; el.classList.add('new'); } });
  const un = sel.filter(d => d.unknown).length;
  toast(`${sel.length} livre(s) rangé(s)${un ? `, dont ${un} à identifier (filtre « À identifier »)` : ''} – les fiches se complètent en arrière-plan`, 6000);
  if (useGB || useAI) bgComplete(sel, useGB, useAI);
}
const BG = {running: false, queue: []};
function bgPill(txt) { const p = $('#bgJob'); p.style.display = txt ? 'inline-flex' : 'none'; p.innerHTML = txt || ''; }
async function bgComplete(list, useGB, useAI) {
  BG.queue.push({list, useGB, useAI}); if (BG.running) return; BG.running = true;
  while (BG.queue.length) {
    const job = BG.queue.shift(), L = job.list.filter(b => b.title), n = L.length, t0 = performance.now(); let tGB = 0, tAI = 0, k = 0, lastR = 0;
    if (!n) continue;
    const alive = () => L.filter(b => books.includes(b));
    const refresh = force => { const now = performance.now(); if (force || now - lastR > 2500) { lastR = now; if (!drag && !pan && !$('#drawer').classList.contains('on')) renderAll(); } };
    PERF.reset();
    if (job.useGB) { const t = performance.now();
      await pool(alive(), 5, async b => { await enrich(b); if (books.includes(b)) await DB.put('books', b); k++; bgPill(`<span class="spin"></span> Fiches ${k}/${n} · Google Books`); refresh(); });
      tGB = performance.now() - t; }
    if (job.useAI) { const t = performance.now(), A = alive(); bgPill(`<span class="spin"></span> Complément IA 0/${A.length}`);
      await aiComplete(A, async (done, ch) => { if (ch) await DB.putMany('books', ch.filter(b => books.includes(b))); bgPill(`<span class="spin"></span> Complément IA ${done}/${A.length}`); refresh(); });
      tAI = performance.now() - t; }
    refresh(true);
    const tot = performance.now() - t0;
    const detail = [job.useGB && `Google Books ${fmtDur(tGB)}`, job.useAI && `IA ${fmtDur(tAI)} (${PERF.aiCalls} appel${PERF.aiCalls > 1 ? 's' : ''}${PERF.waitMs > 2000 ? `, dont ${fmtDur(PERF.waitMs)} d'attente quota` : ''})`].filter(Boolean).join(' · ');
    bgPill(`${n} fiche(s) complétée(s) en ${fmtDur(tot)}`); toast(`${n} fiches complétées en ${fmtDur(tot)} – ${detail}`, 9000);
    setTimeout(() => { if (!BG.running) bgPill(''); }, 12000);
  }
  BG.running = false;
}
let dragN = 0;
window.addEventListener('dragenter', e => { if (![...e.dataTransfer.types].includes('Files') || $('#modal').classList.contains('on')) return; dragN++; $('#dropall').classList.add('on'); });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; $('#dropall').classList.remove('on'); } });
window.addEventListener('drop', e => { e.preventDefault(); dragN = 0; $('#dropall').classList.remove('on'); if ($('#modal').classList.contains('on') || !e.dataTransfer.files.length) return; openScan(); addFiles(e.dataTransfer.files); });

/* =====================================================================
   HISTORIQUE DES IMPORTS
   ===================================================================== */
function openImports() {
  const L = [...imports].sort((a, b) => b.date.localeCompare(a.date));
  openModal(`<div class="dhead"><h3>Imports</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint" style="margin-top:0">Chaque photo importée forme un lot. Tu peux déplacer tout un lot vers un autre meuble ou une autre étagère (y compris un nouveau meuble), le remettre dans l'ordre de la photo, ou le supprimer. Tout est annulable avec ↶ (Ctrl+Z).</p>
    ${L.length ? L.map(imp => { const bs = books.filter(b => b.importId === imp.id), where = [...new Set(bs.map(b => cases.find(c => c.id === b.caseId)?.name || 'Non rangés'))].join(', '), un = bs.filter(b => b.unknown).length;
      return `<div class="impc" data-imp="${imp.id}"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b style="font:700 14px var(--fT)">${new Date(imp.date).toLocaleString('fr-FR', {dateStyle: 'short', timeStyle: 'short'})}</b> · ${bs.length} livre(s)${un ? ` · <span style="color:var(--ko)">${un} à identifier</span>` : ''}<div class="hint">Actuellement : ${esc(where || '—')}${imp.legacy ? ' · import antérieur à la V1.5 (ordre d\'origine = position au passage en V1.5)' : ''}</div></div></div>
        ${imp.photos?.length ? `<div class="ph">${imp.photos.map(p => `<img src="${p}" alt="">`).join('')}</div>` : ''}
        ${bs.length ? `<div class="row"><span class="hint">Déplacer le lot vers</span><select data-f="case">${caseOptions(imp.caseId)}</select><span class="hint">à partir de l'étagère</span><input data-f="row" type="number" min="1" max="15" value="${Math.min(...bs.map(b => b.orig?.row || b.row || 1))}" style="width:56px"><button class="btn g sm" data-a="move">Déplacer</button></div>
        <div class="row"><button class="btn s sm" data-a="select">Sélectionner dans la pièce</button><button class="btn s sm" data-a="orig">Remettre dans l'ordre de la photo</button><button class="btn s sm" data-a="straight" title="Re-détourer et redresser toutes les tranches de ce lot">Redresser les tranches</button><button class="btn s sm" data-a="fix" title="Utile si tu as corrigé à la main l'emplacement des livres">Fixer l'ordre actuel comme ordre d'origine</button><button class="btn k sm" data-a="del">Supprimer ces livres</button></div>` : `<div class="row"><span class="hint">Lot vide.</span><button class="btn s sm" data-a="forget">Retirer de l'historique</button></div>`}</div>`; }).join('') : '<p class="hint">Aucun import pour l\'instant.</p>'}</div>`, 'sm');
  $('#mbox').onclick = async e => {
    const a = e.target.closest('[data-a]'); if (!a) return; const card = a.closest('[data-imp]'), imp = imports.find(x => x.id === card.dataset.imp), bs = books.filter(b => b.importId === imp.id);
    const act = a.dataset.a;
    if (act === 'select') { SEL.clear(); bs.forEach(b => SEL.add(b.id)); closeModal(); setView('lib'); const cs = new Set(bs.map(caseOf)); curCase = cs.size === 1 ? [...cs][0] : ALL; renderRoom(true); return toast('Lot sélectionné : utilise la barre bleue pour le déplacer'); }
    if (act === 'orig') { closeModal(); setView('lib'); curCase = bs[0]?.orig?.caseId || curCase; await reorderByOrig(bs, 'Lot remis dans l\'ordre de la photo'); return showUndo('Lot remis dans l\'ordre de la photo'); }
    if (act === 'straight') return restraightenMany(bs, a);
    if (act === 'fix') { bs.forEach(b => b.orig = {caseId: b.caseId || null, row: b.row || 1, position: b.position}); await DB.putMany('books', bs); toast('Ordre actuel enregistré comme ordre d\'origine'); return openImports(); }
    if (act === 'forget') { await DB.del('imports', imp.id); imports = imports.filter(x => x !== imp); return openImports(); }
    if (act === 'del') { if (await deleteBooks(bs.map(b => b.id), 'Lot importé du ' + new Date(imp.date).toLocaleDateString('fr-FR'))) closeModal(); return; }
    if (act === 'move') {
      let dest = card.querySelector('[data-f=case]').value; const row0 = Math.max(1, parseInt(card.querySelector('[data-f=row]').value) || 1);
      const minR = Math.min(...bs.map(b => b.orig?.row || b.row || 1)), maxR = Math.max(...bs.map(b => b.orig?.row || b.row || 1));
      if (dest === '__new') { const n = prompt('Nom du nouveau meuble :', 'Nouveau meuble'); if (!n) return; dest = (await newCase(n, row0 + maxR - minR)).id; }
      if (dest === NONE) dest = null;
      const c = cases.find(x => x.id === dest); if (c && (c.rows || 3) < row0 + maxR - minR) { c.rows = row0 + maxR - minR; await DB.put('cases', c); }
      pushUndo('Déplacement d\'un lot importé'); const set = new Set(bs.map(b => b.id)), groups = new Map();
      bs.forEach(b => { const r = b.orig?.row || b.row || 1; if (!groups.has(r)) groups.set(r, []); groups.get(r).push(b); });
      groups.forEach((L, r) => { const row = row0 + r - minR, base = nextPos(dest, row, set) - 1;
        L.sort((x, y) => (x.orig?.position ?? x.position ?? 0) - (y.orig?.position ?? y.position ?? 0)).forEach((b, i) => { b.caseId = dest; b.row = row; b.position = base + i + 1; b.orig = {caseId: dest, row, position: b.position}; }); });
      imp.caseId = dest; await DB.put('imports', imp); await DB.putMany('books', bs);
      closeModal(); setView('lib'); if (dest) curCase = dest; localStorage.setItem('scanly_case', curCase); renderRoom(true); renderAll();
      showUndo(`Lot de ${bs.length} livre(s) déplacé vers ${c ? c.name : cases.find(x => x.id === dest)?.name || 'Non rangés'}`);
    }
  };
}

/* =====================================================================
   VOIX
   ===================================================================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function listen(btn, onText) {
  if (!SR) return toast('Reconnaissance vocale indisponible dans ce navigateur (utilise Microsoft Edge ou Chrome)', 4500);
  const r = new SR(); r.lang = 'fr-FR'; r.interimResults = false; r.maxAlternatives = 1;
  btn.classList.add('rec'); toast('Je t\'écoute…', 2000);
  r.onresult = e => onText(e.results[0][0].transcript);
  r.onerror = e => toast('Micro : ' + (e.error === 'not-allowed' ? 'autorisation refusée' : e.error === 'no-speech' ? 'rien entendu' : e.error));
  r.onend = () => btn.classList.remove('rec');
  try { r.start(); } catch (e) { btn.classList.remove('rec'); }
}
function speak(t) {
  if (!('speechSynthesis' in window) || !t) return;
  const u = new SpeechSynthesisUtterance(String(t).replace(/[*#_`>|]/g, '').replace(/\n+/g, '. ').slice(0, 700)); u.lang = 'fr-FR';
  const v = speechSynthesis.getVoices().find(v => /^fr/i.test(v.lang) && /natural|online/i.test(v.name)) || speechSynthesis.getVoices().find(v => /^fr/i.test(v.lang)); if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
$('#qMic').onclick = () => listen($('#qMic'), t => {
  const q = t.replace(/^\s*(où (est|sont|se trouvent?|ai-je (rangé|mis))|j'ai rangé où|cherche|trouve|montre(-moi)?|retrouve)\s*/i, '').replace(/^(le|la|les|l'|mon|ma|mes|un|une)\s+/i, '').replace(/[?.!]+$/, '').trim();
  $('#q').value = q; F.q = q; aiHits = null; setView('lib'); renderRoom(); renderCat(); renderList();
  const hits = books.filter(b => matchQ(b, q)), n = hits.length; if (n) focusBook(hits[0].id);
  speak(n ? (n === 1 ? `${hits[0].title} : ${locOf(hits[0]).replace(/ét\./, 'étagère').replace(/pos\./, 'position')}` : `${n} résultats pour ${q}`) : `Je ne trouve pas ${q}`);
});

/* =====================================================================
   ASSISTANT IA
   ===================================================================== */
const SUGG = ['Quels tomes me manquent dans mes séries ?', 'Que devrais-je lire ensuite ?', 'Recommande-moi 5 ouvrages à acheter selon mes goûts', 'Montre-moi mes livres de science-fiction', 'Analyse ma bibliothèque (genres, auteurs, époques)', 'Ai-je des doublons ?', 'Propose un rangement plus logique', 'Quelle est la valeur estimée de ma collection ?'];
let chatHist = [], chatHTML = `<div class="msg a">Bonjour, je suis l'assistant SCANEBOOK. Je connais tout ton catalogue : recommandations, tomes manquants, statistiques, emplacement d'un livre… Pose ta question au clavier ou à la voix. Quand je cite tes livres, je peux les faire ressortir dans la pièce.</div>`;
function md(t) {
  let h = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/^#{1,4} (.+)$/gm, '<b>$1</b>');
  h = h.replace(/(^|\n)((?:\s*[-•*] .+(?:\n|$))+)/g, (m, p, l) => p + '<ul>' + l.trim().split('\n').map(x => '<li>' + x.replace(/^\s*[-•*] /, '') + '</li>').join('') + '</ul>');
  return h.split(/\n{2,}/).map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
}
function highlightIds(ids) {
  ids = ids.filter(id => books.some(b => b.id === id)); if (!ids.length) return;
  aiHits = new Set(ids); if (books.some(b => aiHits.has(b.id) && b.wish) && !CAM.ghost) { CAM.ghost = true; localStorage.setItem('scanly_ghost', '1'); }
  F.q = ''; $('#q').value = ''; closeDrawer(); setView('lib');
  const cs = new Set(ids.map(id => caseOf(books.find(b => b.id === id)))); curCase = cs.size === 1 ? [...cs][0] : (caseGroups().length > 1 ? ALL : curCase);
  renderRoom(true); focusBook(ids[0]); toast(`${ids.length} ouvrage(s) mis en lumière par l'assistant`);
}
const ttsOn = () => localStorage.getItem('scanly_tts') === '1';
function openAI() {
  openDrawer('Assistant IA', `<div class="sugg">${SUGG.map(s => `<button class="chip">${s}</button>`).join('')}<button class="chip" id="aiTts" style="border-color:var(--gold)">${ttsOn() ? 'Lecture vocale : oui' : 'Lecture vocale : non'}</button></div><div class="chat" id="chat">${chatHTML}</div>`,
    `<div class="compose"><button class="btn s" id="aiMic" title="Poser la question à voix haute">${I('mic')}</button><textarea class="fld" id="aiQ" placeholder="Pose ta question… (Entrée pour envoyer)"></textarea><button class="btn p" id="aiSend">Envoyer</button></div>`);
  $('.sugg').onclick = e => { if (e.target.id === 'aiTts') { const on = !ttsOn(); localStorage.setItem('scanly_tts', on ? '1' : '0'); e.target.textContent = on ? 'Lecture vocale : oui' : 'Lecture vocale : non'; if (!on && window.speechSynthesis) speechSynthesis.cancel(); return; }
    const c = e.target.closest('.chip'); if (c) { $('#aiQ').value = c.textContent; ask(); } };
  $('#aiMic').onclick = () => listen($('#aiMic'), t => { $('#aiQ').value = t; ask(true); });
  $('#dBody').onclick = e => { const h = e.target.closest('[data-hl]'); if (h) highlightIds(h.dataset.hl.split(','));
    const rt = e.target.closest('[data-retry42]'); if (rt) { $('#aiQ').value = rt.dataset.retry42; rt.disabled = true; ask(); } };
  $('#aiSend').onclick = () => ask(); $('#aiQ').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } };
  if (!matchMedia('(pointer:coarse)').matches) $('#aiQ').focus(); $('#dBody').scrollTop = 1e6; // V2.43 : pas de clavier automatique sur écran tactile
}
function catalog() {
  return books.filter(b => b.title).map(b => `[${b.id}] ` + [b.title, b.author, b.type, b.genre, b.series ? b.series + (b.volume ? ' T' + b.volume : '') : '', b.year, b.publisher,
    b.wish ? 'SOUHAIT (non possédé)' : isLoaned(b) ? `prêté à ${b.loanTo || '?'}` : (b.status || 'À lire'), b.rating ? b.rating + '/5' : '', b.price ? b.price + '€' : '', b.caseId ? locOf(b) : 'non rangé'].map(x => x ?? '').join(' | ')).join('\n');
}
async function ask(voice = false) {
  const q = $('#aiQ').value.trim(); if (!q) return; $('#aiQ').value = '';
  $('#chat').insertAdjacentHTML('beforeend', `<div class="msg u">${esc(q)}</div><div class="msg a" id="pend"><span class="spin"></span> Réflexion…</div>`); $('#dBody').scrollTop = 1e6;
  const system = `Tu es l'assistant de SCANEBOOK, bibliothécaire personnel passionné (livres, BD, mangas, comics). Ton : clair, calme, cultivé et utile. Réponds en français, de façon concise et structurée.
Appuie-toi sur le catalogue ci-dessous ; chaque ligne commence par l'identifiant entre crochets puis : titre | auteur | type | genre | série tome | année | éditeur | statut | note | prix | emplacement. Quand tu cites un ouvrage possédé, donne son emplacement. Distingue clairement ce qu'il possède de tes suggestions d'achat. N'affiche jamais les identifiants dans le texte.
Si ta réponse cite des ouvrages du catalogue, termine OBLIGATOIREMENT par une dernière ligne au format exact : SCANLY_IDS: id1,id2 (12 maximum, uniquement des identifiants du catalogue). Date : ${new Date().toLocaleDateString('fr-FR')}.
CATALOGUE (${books.length} ouvrages) :
${catalog() || '(vide)'}`;
  let html, text = '', ids = [];
  try {
    const a = await gemini([{text: q}], {system, history: chatHist.slice(-10), think: 'low'}); chatHist.push({role: 'user', parts: [{text: q}]}, {role: 'model', parts: [{text: a}]});
    const m = a.match(/SCANLY_IDS\s*:\s*([^\n]*)\s*$/i);
    ids = m ? [...new Set(m[1].split(/[\s,;]+/).map(s => s.replace(/[\[\]]/g, '')).filter(id => books.some(b => b.id === id)))] : [];
    text = a.replace(/\n?\s*SCANLY_IDS\s*:[^\n]*\s*$/i, '').trim();
    html = md(text) + (ids.length ? `<button class="btn g sm" data-hl="${ids.join(',')}" style="margin-top:8px">Voir dans la pièce (${ids.length})</button>` : '');
  } catch (e) { html = `<b>${T28('L’assistant n’a pas pu répondre')}</b> : ${esc(e.message)}<br><button type="button" class="btn s sm" data-retry42="${esc(q)}" style="margin-top:8px">↻ ${T28('Réessayer')}</button>`; } // V2.42
  const p = $('#pend'); if (p) { p.innerHTML = html; p.removeAttribute('id'); }
  chatHTML = $('#chat') ? $('#chat').innerHTML : chatHTML; if ($('#dBody')) $('#dBody').scrollTop = 1e6;
  if (text && (voice || ttsOn())) speak(text);
  if (voice && ids.length) setTimeout(() => highlightIds(ids), 1500);
}

