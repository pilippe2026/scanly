/* SCANEBOOK – 02_piece.js : Rendu, univers, caméra, meubles, livres 3D, pièce, sélection, glisser-déposer, rangement, exports, catalogue, séries, tableau de bord.
   Les fichiers js/ sont chargés dans l'ordre par index.html et partagent les mêmes variables globales. */
'use strict';
/* =====================================================================
   RENDU GÉNÉRAL
   ===================================================================== */
function renderAll() {
  reviewCache18=new Map(); ensureTypes20();
  const own = books.filter(b => !b.wish).length, w = books.length - own, u = books.filter(b => b.unknown).length;
  $('#hcount').textContent = own + ' ouvrage' + (own > 1 ? 's' : '') + (u ? ` · ${u} à identifier` : '') + (w ? ` · ${w} souhait${w > 1 ? 's' : ''}` : '');
  renderToolbar(); renderRoom(); renderCat(); renderList(); renderSeries(); renderDash();renderReviewQueue18();renderWishlist18(); updUndoBtns();
}
function opt(arr, all, cur) { return `<option value="">${all}</option>` + arr.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join(''); }
function renderToolbar() {
  renderCompactFilters19();
  const types = TYPES.filter(t => books.some(b => b.type === t));
  $('#chips').innerHTML = `<button class="chip ${F.type ? '' : 'on'}" data-t="">Tout</button>` + types.map(t => `<button class="chip ${F.type === t ? 'on' : ''}" data-t="${t}">${t}<span class="n">${books.filter(b => b.type === t && !b.wish).length}</span></button>`).join('');
  $('#fAuthor').innerHTML = opt([...new Set(books.flatMap(b => (b.author || '').split(',').map(a => a.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'fr')), 'Tous auteurs', F.author);
  $('#fGenre').innerHTML = opt([...new Set(books.map(b => b.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), 'Tous genres', F.genre);
}

/* =====================================================================
   UNIVERS (général + par meuble)
   ===================================================================== */
function activeTheme() { const c = curCase !== ALL ? cases.find(x => x.id === curCase) : null; return c && THEMES[c.theme] ? c.theme : theme; }
function renderThemeBar() {
  const kc = curCase !== ALL ? cases.find(c => c.id === curCase) : null;
  $('#themeBar').innerHTML = `<div class="ddw down right"><button class="ddt" data-dd title="Univers de la pièce">${I(rt)}<span class="lb">${THEMES[rt].short || THEMES[rt].name}</span><span class="car">▾</span></button><div class="dd">` + Object.entries(THEMES).map(([k, t]) => `<button data-theme="${k}" class="${k === rt ? 'on' : ''}" title="${esc(t.tip || 'Univers ' + t.name)}">${I(k)}<span class="lb">${t.short || t.name}</span></button>`).join('') +
    (kc ? `<span class="sep"></span><button data-pin class="pin${kc.theme ? ' on' : ''}" title="${kc.theme ? 'Ce meuble a son propre univers (clic : suivre l\'univers général)' : 'Garder cet univers pour ce meuble uniquement'}">${I('pin')}</button>` : '') + '</div></div>';
}
function applyTheme() {
  const T = THEMES[rt], lib = $('#v-lib');
  Object.keys(THEMES).forEach(k => lib.classList.toggle('th-' + k, k === rt));
  lib.style.setProperty('--roomImg', `url(${T.img})`);
  let fx = '';
  if (rt === 'magie') {
    const C = [[150, 120, 260], [260, 70, 200], [1250, 90, 240], [1360, 150, 180], [620, 40, 320], [930, 55, 300], [1080, 30, 280], [430, 30, 330]];
    fx = C.map(([x, y, z], i) => `<div class="fcandle" style="left:${x}px;top:${y}px;transform:translateZ(${z}px);animation-delay:${-i * .7}s;animation-duration:${4 + i % 3}s"><i class="candle"></i><i class="flame" style="animation-delay:${i * .05}s"></i></div>`).join('');
  } else if (rt === 'futur') {
    fx = Array.from({length: 18}, (_, i) => `<i class="spark" style="left:${300 + (hash('s' + i) % 940)}px;top:${640 + (hash('t' + i) % 120)}px;transform:translateZ(${60 + hash('z' + i) % 220}px);animation-duration:${6 + i % 5}s;animation-delay:${-(i * 0.9)}s"></i>`).join('');
  } else if (rt === 'bnf') {
    fx = Array.from({length: 16}, (_, i) => `<i class="mote" style="left:${240 + (hash('m' + i) % 420)}px;top:${120 + (hash('n' + i) % 380)}px;transform:translateZ(${80 + hash('o' + i) % 200}px);animation-duration:${9 + i % 6}s;animation-delay:${-(i * 1.3)}s"></i>`).join('');
  }
  $('#fx').innerHTML = fx;
}
$('#themeBar').onclick = async e => {
  const kc = curCase !== ALL ? cases.find(c => c.id === curCase) : null;
  if (e.target.closest('[data-pin]') && kc) { kc.theme = kc.theme ? null : rt; await DB.put('cases', kc);
    toast(kc.theme ? `Univers « ${THEMES[rt].name} » réservé à « ${kc.name} »` : `« ${kc.name} » suit l'univers général`); return renderRoom(); }
  const b = e.target.closest('[data-theme]'); if (!b) return;
  if (kc && kc.theme) { kc.theme = b.dataset.theme; await DB.put('cases', kc); }
  else { theme = b.dataset.theme; localStorage.setItem('scanly_theme', theme); }
  renderRoom(true);
};

/* =====================================================================
   CAMÉRA, ZOOM ET DÉPLACEMENT DANS LA PIÈCE
   ===================================================================== */
const U = {D: 118, T: 16};
const VIEW = {z: 1, px: 0, py: 0, R: 1, k: 1, key: ''};
function zMin() { const vp = $('#viewport'); return Math.min(1, vp.clientWidth / (1536 * VIEW.R * VIEW.k), vp.clientHeight / (1024 * VIEW.R * VIEW.k)); }
function applyView(mode) {
  const vp = $('#viewport'), Vw = vp.clientWidth, Vh = vp.clientHeight; if (!Vw || !Vh) return;
  const R = VIEW.R, T = THEMES[rt].unit; VIEW.k = Math.min(Vw / (1536 * 0.82), Vh / 1000);
  if (mode === 'reset') { VIEW.z = 1; const sc = VIEW.k;
    if (R > 1.02) { VIEW.px = 70 - Vw / 2 - (T.x * R - 768 * R) * sc; VIEW.py = 30 - Vh / 2 - (T.y * R - 512 * R) * sc; } else { VIEW.px = 0; VIEW.py = 0; } }
  if (mode === 'all') { VIEW.z = zMin(); VIEW.px = 0; VIEW.py = 0; }
  VIEW.z = clamp(VIEW.z, Math.min(zMin(), 1), 7);
  const sc = VIEW.k * VIEW.z, Sw = 1536 * R * sc, Sh = 1024 * R * sc, mx = Math.max(0, (Sw - Vw) / 2), my = Math.max(0, (Sh - Vh) / 2);
  VIEW.px = clamp(VIEW.px, -mx, mx); VIEW.py = clamp(VIEW.py, -my, my);
  const st = $('#stage'); st.style.width = 1536 * R + 'px'; st.style.height = 1024 * R + 'px';
  st.style.transform = `translate(-50%,-50%) translate(${VIEW.px.toFixed(1)}px,${VIEW.py.toFixed(1)}px) scale(${sc.toFixed(4)})`;
  const ox = 768 * R - VIEW.px / sc, oy = 512 * R - VIEW.py / sc;
  st.style.perspectiveOrigin = `${ox.toFixed(0)}px ${(oy - 60 / sc).toFixed(0)}px`; $('#scene').style.transformOrigin = `${ox.toFixed(0)}px ${oy.toFixed(0)}px`;
  $('#zoomLbl').textContent = Math.round(VIEW.z * 100) + '%';
}
function fitStage() { applyView(); }
function applyCam() {
  const base = {left: 7, front: 0, right: -7}[CAM.view] || 0, f = 1 / Math.sqrt(VIEW.R);
  const ry = base * f + (CAM.move ? CAM.mx * 2 * f : 0), rx = CAM.move ? -CAM.my * 1.5 * f : 0, z = CAM.view === 'front' ? 0 : -40;
  $('#scene').style.transform = `translateZ(${z}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  $('#v-lib').classList.toggle('dusk', CAM.dusk);
  $('#unit').style.setProperty('--ledOn', CAM.dusk ? 1 : (rt === 'salon' ? .35 : rt === 'bnf' ? .45 : .7));
  $$('#camBar [data-cam]').forEach(b => { const c = b.dataset.cam; b.classList.toggle('on', c === CAM.view || (c === 'move' && CAM.move) || (c === 'dusk' && CAM.dusk) || (c === 'ghost' && CAM.ghost) || (c === 'photo' && CAM.photo) || (c === 'select' && CAM.sel)); });
}
$('#camBar').onclick = e => {
  const a = e.target.closest('[data-act]'); if (a) return ({undo, redo, origin: restoreOrigin, sort: openSortMenu, imports: openImports, shot: exportImageFile})[a.dataset.act]();
  const zb = e.target.closest('[data-z]'); if (zb) { const d = +zb.dataset.z; if (!d) applyView(VIEW.z <= zMin() + .01 ? 'reset' : 'all'); else zoomAt(d > 0 ? 1.25 : 0.8); return; }
  const b = e.target.closest('[data-cam]'); if (!b) return; const c = b.dataset.cam;
  const tg = (k, ls) => { CAM[k] = !CAM[k]; localStorage.setItem(ls, CAM[k] ? '1' : '0'); };
  if (c === 'move') { tg('move', 'scanly_move'); CAM.mx = CAM.my = 0; }
  else if (c === 'dusk') tg('dusk', 'scanly_dusk');
  else if (c === 'ghost') { tg('ghost', 'scanly_ghost'); toast(CAM.ghost ? 'Liste de souhaits affichée sur les étagères' : 'Liste de souhaits masquée'); return renderRoom(); }
  else if (c === 'select') { CAM.sel = !CAM.sel; toast(CAM.sel ? 'Mode sélection : clique sur des livres ou sur « Étagère n » pour tout cocher, puis Déplacer ou Supprimer' : 'Mode sélection désactivé', 5000); return renderRoom(); }
  else if (c === 'photo') { tg('photo', 'scanly_photo'); toast(CAM.photo ? 'Tranches réelles (photos) affichées' : 'Tranches dessinées (titre + couleur)'); return renderRoom(); }
  else { CAM.view = c; localStorage.setItem('scanly_cam', c); }
  $('#scene').style.transition = 'transform .7s cubic-bezier(.2,.7,.2,1)'; applyCam();
};
function zoomAt(f, cx = 0, cy = 0) { const old = VIEW.k * VIEW.z; VIEW.z = clamp(VIEW.z * f, Math.min(zMin(), 1), 7); const nsc = VIEW.k * VIEW.z;
  VIEW.px = cx - (cx - VIEW.px) * nsc / old; VIEW.py = cy - (cy - VIEW.py) * nsc / old; applyView(); }
const VP = $('#viewport');
/* V2.1 : zoom sur un livre ou une étagère (double-clic) */
function centerOn(el) { const r = el.getBoundingClientRect(), v = VP.getBoundingClientRect(); VIEW.px += (v.left + v.width / 2) - (r.left + r.width / 2); VIEW.py += (v.top + v.height / 2) - (r.top + r.height / 2); applyView(); }
function unionRect(els) { const R = els.map(e => (e.querySelector('.fr') || e).getBoundingClientRect()); return {left: Math.min(...R.map(r => r.left)), top: Math.min(...R.map(r => r.top)), right: Math.max(...R.map(r => r.right)), bottom: Math.max(...R.map(r => r.bottom)),
  get width() { return this.right - this.left; }, get height() { return this.bottom - this.top; }}; }
/* coordonnées « pièce » (indépendantes du zoom et des effets 3D) */
function stageBox(els) { const u = $('#unit'), ux = parseFloat(u.style.left) || 0, uy = parseFloat(u.style.top) || 0;
  const B = els.map(el => { const x = ux + parseFloat(el.style.left), y = uy + parseFloat(el.style.top); return [x, y, x + parseFloat(el.style.width), y + parseFloat(el.style.height)]; });
  return {x0: Math.min(...B.map(b => b[0])), y0: Math.min(...B.map(b => b[1])), x1: Math.max(...B.map(b => b[2])), y1: Math.max(...B.map(b => b[3]))}; }
function zoomToBox(b, fw, fh) {
  const v = VP.getBoundingClientRect(), w = b.x1 - b.x0, h = b.y1 - b.y0;
  VIEW.z = clamp(Math.min(fw * v.width / (w * VIEW.k), fh * v.height / (h * VIEW.k)), Math.min(zMin(), 1), 7);
  const sc = VIEW.k * VIEW.z, R = VIEW.R; VIEW.px = -((b.x0 + b.x1) / 2 - 768 * R) * sc; VIEW.py = -((b.y0 + b.y1) / 2 - 512 * R) * sc;
  if (CAM.view !== 'front') { CAM.view = 'front'; localStorage.setItem('scanly_cam', 'front'); applyCam(); }
  applyView(); }
function zoomBook(id) { const el = $(`#unit .book[data-id="${id}"]`); if (!el) return;
  const b = stageBox([el]), h = b.y1 - b.y0; zoomToBox({x0: b.x0 - h * .35, x1: b.x1 + h * .35, y0: b.y0 - h * .08, y1: b.y1 + h * .08}, .9, .82);
  el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 1800); toast(IS_TOUCH ? 'Zoom sur le livre – menu Vue › « Tout voir » pour revenir' : 'Zoom sur le livre – Échap ou « Tout voir » pour revenir', 2500); }
function zoomRow(y) { // étagère la plus proche du point cliqué
  const books = $$('#unit .book'); if (!books.length) return;
  const rows = {}; books.forEach(el => { const k = el.dataset.case + '|' + el.dataset.row; (rows[k] = rows[k] || []).push(el); });
  let best = null, bd = 1e9; Object.values(rows).forEach(L => { const R = L.map(e => e.getBoundingClientRect()), t = Math.min(...R.map(r => r.top)), bt = Math.max(...R.map(r => r.bottom)), d = y < t ? t - y : y > bt ? y - bt : 0; if (d < bd) { bd = d; best = L; } });
  if (!best) return; const b = stageBox(best), h = b.y1 - b.y0; zoomToBox({x0: b.x0 - 20, x1: b.x1 + 20, y0: b.y0 - h * .15, y1: b.y1 + h * .25}, .94, .85);
  toast(IS_TOUCH ? 'Zoom sur l\'étagère – menu Vue › « Tout voir » pour revenir' : 'Zoom sur l\'étagère – Échap ou « Tout voir » pour revenir', 2500); }
VP.addEventListener('dblclick', e => { if (e.target.closest('.shgrip,.plaque,.rowsel')) return; e.preventDefault();
  clearTimeout(window._bkClick); const bk = e.target.closest('.book'); if (bk) return zoomBook(bk.dataset.id); zoomRow(e.clientY); });
VP.addEventListener('wheel', e => { e.preventDefault(); const r = VP.getBoundingClientRect();
  if (e.shiftKey) { VIEW.px -= e.deltaY; applyView(); return; }
  zoomAt(Math.exp(-e.deltaY * .0015), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2); }, {passive: false});
let pan = null, pxRaf = 0;
VP.addEventListener('mousedown', e => { if ((e.button !== 0 && e.button !== 1) || (e.button === 0 && e.target.closest('.book,.plaque,.rowsel,.shgrip'))) return;
  pan = {x: e.clientX, y: e.clientY, px: VIEW.px, py: VIEW.py, moved: false}; e.preventDefault(); });
window.addEventListener('mousemove', e => {
  if (pan) { const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (Math.abs(dx) + Math.abs(dy) > 4) { pan.moved = true; VP.classList.add('panning'); } VIEW.px = pan.px + dx; VIEW.py = pan.py + dy; applyView(); return; }
  if (!CAM.move || drag || !e.target.closest || !e.target.closest('#viewport')) return; const r = VP.getBoundingClientRect();
  CAM.mx = ((e.clientX - r.left) / r.width - .5) * 2; CAM.my = ((e.clientY - r.top) / r.height - .5) * 2;
  if (!pxRaf) pxRaf = requestAnimationFrame(() => { pxRaf = 0; $('#scene').style.transition = 'transform .5s ease-out'; applyCam(); });
});
window.addEventListener('mouseup', () => { if (pan) { if (pan.moved) { justDragged = true; setTimeout(() => justDragged = false, 60); } pan = null; VP.classList.remove('panning'); } });
VP.addEventListener('mouseleave', () => { if (CAM.move && !drag) { CAM.mx = CAM.my = 0; applyCam(); } $('#tip').style.display = 'none'; });

/* =====================================================================
   MEUBLES
   ===================================================================== */
function caseGroups() {
  const vis = b => CAM.ghost || !b.wish;
  const g = cases.map(c => ({...c, bs: books.filter(b => vis(b) && caseOf(b) === c.id)}));
  const loose = books.filter(b => vis(b) && caseOf(b) === NONE); if (loose.length) g.push({id: NONE, name: 'Non rangés', bs: loose, photos: []});
  return g;
}
/* V2.28: user-chosen unit names are never translated; system labels (Non rangés…) are. */
const nm28 = g => (g.id === NONE || g.id === 'demo') ? esc(g.name) : `<span data-no-i18n>${esc(g.name)}</span>`;
const rowsCount = g => Math.max(g.rows || 3, 1, ...g.bs.map(b => b.row || 1));
function renderCaseBar(groups) {
  const q = F.q.trim(), hitsOf = g => q ? g.bs.filter(b => matchQ(b, q) && passF(b)).length : 0, ownN = g => g.bs.filter(b => !b.wish).length;
  const allHits = groups.reduce((s, g) => s + hitsOf(g), 0), kc = cases.find(c => c.id === curCase);
  const curName = curCase === ALL ? 'Vue d\'ensemble' : (groups.find(g => g.id === curCase)?.name || 'Meubles'), curN = curCase === ALL ? books.filter(b => !b.wish).length : (groups.find(g => g.id === curCase) ? ownN(groups.find(g => g.id === curCase)) : 0);
  $('#caseBar').innerHTML = `<div class="ddw down left"><button class="ddt" data-dd title="Choisir un meuble, la vue d'ensemble, ajouter un meuble ou une étagère">${I('shelfI')} ${curCase === ALL || !groups.find(g => g.id === curCase) ? esc(curName) : nm28(groups.find(g => g.id === curCase))} <span class="n">${curN}</span>${allHits ? `<span class="hitn">${allHits}</span>` : ''}<span class="car">▾</span></button><div class="dd">` + (aiHits ? `<button data-case="__clearai" class="ai" title="Revenir à l'affichage normal">Sélection IA (${aiHits.size}) ✕</button><span class="sep"></span>` : '') +
    (groups.length > 1 ? `<button data-case="${ALL}" class="${curCase === ALL ? 'on' : ''}" title="Tous les meubles réunis en un seul, par zones">Vue d'ensemble<span class="n">${books.filter(b => !b.wish).length}</span>${allHits ? `<span class="hitn">${allHits}</span>` : ''}</button><span class="sep"></span>` : '') +
    groups.map(g => { const h = hitsOf(g); return `<button data-case="${g.id}" class="${g.id === curCase ? 'on' : ''}" title="Glisse un livre ici pour le déplacer dans ce meuble">${nm28(g)}<span class="n">${ownN(g)}</span>${h ? `<span class="hitn">${h}</span>` : ''}</button>`; }).join('') +
    `<button data-case="__add" title="Nouveau meuble">＋ Meuble</button>` +
    (kc ? `<span class="sep"></span><div class="rowb"><button data-rows="-1" title="Retirer la dernière étagère (si elle est vide)">−</button><span class="rn">${rowsCount({...kc, bs: books.filter(b => b.caseId === kc.id)})} étagères</span><button data-rows="1" title="Ajouter une étagère à ce meuble">＋ Étagère</button></div><button data-shelves21="1" title="Choisir une étagère : sélectionner, vider ou supprimer">Gérer / supprimer une étagère…</button><button data-sel21="1" title="Toucher des livres pour les déplacer ou les supprimer">☑ Sélectionner des livres</button>` : '') + '</div></div>';
}
$('#caseBar').onclick = async e => {
  const rb = e.target.closest('[data-rows]'); if (rb) return changeRows(+rb.dataset.rows);
  if (e.target.closest('[data-shelves21]')) return openShelves21();
  if (e.target.closest('[data-sel21]')) { CAM.sel = true; renderRoom(); return toast('Touche les livres à sélectionner, puis Supprimer ou Déplacer dans la barre du bas', 4500); }
  const b = e.target.closest('[data-case]'); if (!b) return;
  if (b.dataset.case === '__clearai') { aiHits = null; return renderRoom(); }
  if (b.dataset.case === '__add') { const n = prompt('Nom du nouveau meuble :', 'Bureau – Étagère'); if (!n) return; curCase = (await newCase(n)).id; }
  else curCase = b.dataset.case;
  localStorage.setItem('scanly_case', curCase); renderRoom(true);
};
async function changeRows(d) {
  const c = cases.find(x => x.id === curCase); if (!c) return;
  const used = Math.max(0, ...books.filter(b => b.caseId === c.id).map(b => b.row || 1)), cur = Math.max(c.rows || 3, used);
  if (d < 0 && cur <= used) return toast(`La dernière étagère contient des livres : déplace-les d'abord (ou ⇅ Ranger).`, 4000);
  c.rows = clamp(cur + d, 1, 15); await DB.put('cases', c); renderRoom(); toast(`${c.name} : ${c.rows} étagère${c.rows > 1 ? 's' : ''}`);
}

/* =====================================================================
   LIVRES 3D
   ===================================================================== */
function bookDims(b) {
  const tall = b.height === 'grande' || ['BD', 'Beau livre', 'Comics'].includes(b.type), small = b.height === 'petite' || ['Manga'].includes(b.type) || /poche|folio|pocket|j'ai lu/i.test(b.publisher || '');
  const h = b.hU || (tall ? 178 + hash(b.id) % 8 : small ? 126 + hash(b.id) % 8 : 150 + hash(b.id) % 22);
  if (b.faceOut) return {w: Math.round(h * .68), h, d: 22};
  let w = b.wU || {fine: 20, moyenne: 29, epaisse: 42}[b.thickness] || (b.pages ? clamp(10 + b.pages / 13, 16, 54) : 27);
  if (!b.wU && tall && !b.thickness && !b.pages) w = 18;
  return {w, h, d: Math.min(U.D - 10, Math.round(h * (tall ? .62 : .58)))};
}
function book3D(b, x, yBottom, s, dimmed) {
  const {w: w0, h: h0, d: d0} = bookDims(b), w = w0 * s, h = h0 * s, d = Math.min(64, d0 * Math.max(s, .8)), supportZ = U.D - 8, backZ = supportZ - d;
  const col = colOf(b), tc = txtCol(col), side = shade(col, .62), deco = hash(b.id) % 3, loan = isLoaned(b);
  const ph = CAM.photo && b.spineImg && !b.faceOut && !b.wish ? spineURL(b) : '';
  const label = b.unknown ? '?' : (b.series && b.volume ? b.series : b.title);
  const cls = ['book', dimmed && 'dim', b.wish && 'ghost', loan && 'loaned', b.faceOut && 'face', b.unknown && 'unk', SEL.has(b.id) && 'sel'].filter(Boolean).join(' ');
  const front = b.faceOut
    ? `<i class="fr" style="transform:translateZ(${d}px);color:${tc};background:linear-gradient(135deg,${col},${shade(col, .7)})"><span class="ft" style="font-size:${Math.max(8, 12 * s)}px">${esc(dispTitle(b))}</span>${b.cover && !b.wish ? `<img src="${esc(b.cover)}" alt="" onerror="this.remove()">` : ''}</i>`
    : `<i class="fr${ph ? ' ph' : ''}" style="transform:translateZ(${d}px);color:${tc};background:${ph ? `url('${ph}') center/100% 100% no-repeat,${col}` : `linear-gradient(90deg,${shade(col, .85)},${col} 25%,${shade(col, 1.1)} 50%,${col} 75%,${shade(col, .8)})`}">
      ${!ph && deco ? '<span class="band b1"></span>' : ''}${!ph && deco === 2 ? '<span class="band b2"></span>' : ''}
      ${b.volume ? `<span class="vol" style="font-size:${Math.max(8, 11 * s)}px">${b.volume}</span>` : ''}
      <span class="st" style="max-height:${h - 60 * s}px;font-size:${Math.max(8, 12 * s)}px">${esc(label)}</span>
      <span class="sa" style="font-size:${Math.max(7, 9.5 * s)}px">${esc(lastName(b))}</span></i>`;
  return `<div class="${cls}" data-id="${b.id}" data-case="${caseOf(b)}" data-row="${b.row || 1}" style="left:${x.toFixed(1)}px;top:${(yBottom - h).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;--bookZ:${backZ.toFixed(2)}px">${front}<i class="contact" style="top:${h}px;width:${w}px;height:${d}px;transform:rotateX(90deg)"></i>
    ${loan ? `<i class="rib" style="transform:translateZ(${d + 1}px)">${T28('PRÊTÉ')}</i>` : ''}${b.wish ? `<i class="rib wishr" style="transform:translateZ(${d + 1}px)">${T28('SOUHAIT')}</i>` : ''}${b.unknown && w > 14 ? `<i class="rib unkr" style="transform:translateZ(${d + 1}px)">?</i>` : ''}
    <i class="tp" style="width:${w}px;height:${d}px;transform:rotateX(90deg);background:linear-gradient(90deg,${shade(col, .55)} 0 9%,transparent 9% 91%,${shade(col, .55)} 91%),linear-gradient(0deg,rgba(0,0,0,.35),rgba(0,0,0,0) 70%),repeating-linear-gradient(90deg,#e6dcc6 0 1px,#cdbfa3 1px 2px)"></i>
    <i class="sl" style="left:0;width:${d}px;height:${h}px;background:linear-gradient(90deg,${shade(col, .45)},${side});transform:rotateY(-90deg)"></i>
    <i class="sr" style="left:${w}px;width:${d}px;height:${h}px;background:linear-gradient(90deg,${shade(col, .55)},${shade(col, .4)});transform:translateZ(${d}px) rotateY(90deg)"></i>
  </div>`;
}
function bookend3D(x, yBottom, s) {
  const w = 10 * s, h = 92 * s, d = 70 * s;
  const c = rt === 'futur' ? ['#9eeaff', '#2b394c', '#0c131d'] : rt === 'magie' ? ['#e2c27e', '#9c7a3c', '#6b4e22'] : rt === 'bnf' ? ['#eef0f3', '#b8bdc5', '#6b717a'] : ['#e8cc98', '#c9a46e', '#9c7a48'];
  return `<div class="bookend" style="left:${x}px;top:${yBottom - h}px;width:${w}px;height:${h}px">
    <i style="inset:0;transform:translateZ(${d}px);background:linear-gradient(90deg,${c[0]},${c[1]} 50%,${c[2]});border-radius:2px 6px 0 0;${rt === 'futur' ? 'box-shadow:0 0 10px rgba(80,200,255,.8)' : ''}"></i>
    <i style="left:0;top:0;width:${d}px;height:${h}px;transform-origin:left;transform:rotateY(-90deg);background:linear-gradient(90deg,${c[2]},${c[1]})"></i>
    <i style="left:0;top:0;width:${w}px;height:${d}px;transform-origin:top;transform:rotateX(90deg);background:${c[0]}"></i></div>`;
}
function stackFlat(x, yB, s, cols, topper) {
  let h = '', y = yB;
  cols.forEach((c, i) => { const w = (120 - i * 12) * s, t = (16 - i * 2) * s, d = 80 * s; y -= t;
    h += `<div class="bookend" style="left:${x + i * 5 * s}px;top:${y}px;width:${w}px;height:${t}px">
      <i style="inset:0;transform:translateZ(${d}px);background:linear-gradient(180deg,${shade(c, 1.15)},${c});border-radius:1px"></i>
      <i style="left:0;top:0;width:${w}px;height:${d}px;transform-origin:top;transform:rotateX(90deg);background:${shade(c, 1.2)}"></i>
      <i style="left:${w}px;top:0;width:${d}px;height:${t}px;transform-origin:left;transform:translateZ(${d}px) rotateY(90deg);background:repeating-linear-gradient(180deg,#f4ecdc 0 1px,#d8cbb0 1px 2px)"></i></div>`; });
  return h + topper(x + 40 * s, y, s);
}
function decor3D(kind, xEnd, yB, s) {
  const Z = z => `transform:translateZ(${z * s}px)`, ball = cls => (x, y, s2) => `<div class="decor" style="left:${x}px;top:${y - 32 * s2}px;width:${32 * s2}px;height:${32 * s2}px;transform:translateZ(${50 * s2}px)"><i class="${cls}" style="inset:0"></i></div>`;
  if (rt === 'futur') {
    if (kind === 0) { const w = 64 * s; return `<div class="decor" style="left:${xEnd - w - 20 * s}px;top:${yB - 120 * s}px;width:${w}px;height:${120 * s}px;${Z(55)}"><i class="pedestal" style="left:0;right:0;bottom:0;height:${18 * s}px"></i><i class="beam" style="left:${10 * s}px;right:${10 * s}px;bottom:${18 * s}px;height:${90 * s}px"></i><i class="holo" style="left:${14 * s}px;top:${18 * s}px;width:${36 * s}px;height:${36 * s}px"></i></div>`; }
    if (kind === 1) { const w = 56 * s; return `<div class="decor" style="left:${xEnd - w - 20 * s}px;top:${yB - 96 * s}px;width:${w}px;height:${96 * s}px;${Z(55)}"><i class="pedestal" style="left:${6 * s}px;right:${6 * s}px;bottom:0;height:${24 * s}px;border-radius:4px"></i><i class="orb" style="left:${8 * s}px;top:${10 * s}px;width:${40 * s}px;height:${40 * s}px"></i></div>`; }
    return stackFlat(xEnd - 130 * s, yB, s, ['#1b2433', '#2b394c', '#0f5f86'], ball('orb'));
  }
  if (rt === 'magie') {
    if (kind === 0) { const w = 90 * s; let c = '';
      [[0, 70], [30, 95], [60, 60]].forEach(([dx, h], i) => { c += `<i class="candle" style="left:${dx * s}px;bottom:${8 * s}px;width:${14 * s}px;height:${h * s}px"></i><i class="flame" style="left:${(dx + 2) * s}px;bottom:${(h + 6) * s}px;transform:scale(${s});animation-delay:${i * .07}s"></i>`; });
      return `<div class="decor" style="left:${xEnd - w - 20 * s}px;top:${yB - 130 * s}px;width:${w}px;height:${130 * s}px;${Z(60)}">${c}<i class="brass" style="left:${-6 * s}px;right:0;bottom:0;height:${9 * s}px"></i></div>`; }
    if (kind === 1) { const w = 64 * s; return `<div class="decor" style="left:${xEnd - w - 20 * s}px;top:${yB - 80 * s}px;width:${w}px;height:${80 * s}px;${Z(55)}"><i class="brass" style="left:${8 * s}px;right:${8 * s}px;bottom:0;height:${20 * s}px"></i><i class="cball" style="left:${4 * s}px;top:0;width:${56 * s}px;height:${56 * s}px"></i></div>`; }
    return stackFlat(xEnd - 130 * s, yB, s, ['#5e1a1a', '#2c4a2c', '#6b4423'], (x, y, s2) => `<div class="decor" style="left:${x + 10 * s2}px;top:${y - 44 * s2}px;width:${12 * s2}px;height:${44 * s2}px;transform:translateZ(${50 * s2}px)"><i class="candle" style="inset:0"></i><i class="flame" style="left:${s2}px;top:${-17 * s2}px;transform:scale(${s2})"></i></div>`);
  }
  if (rt === 'bnf') {
    if (kind === 0) { const w = 80 * s, h = 120 * s; return `<div class="decor" style="left:${xEnd - w - 20 * s}px;top:${yB - h}px;width:${w}px;height:${h}px;${Z(55)}"><i class="brass" style="left:${22 * s}px;width:${36 * s}px;bottom:0;height:${8 * s}px"></i><i class="brass" style="left:${37 * s}px;width:${6 * s}px;bottom:${8 * s}px;height:${78 * s}px;border-radius:2px"></i><i class="lshade" style="left:0;right:0;top:0;height:${34 * s}px"></i></div>`; }
    if (kind === 1) { const w = 104 * s, h = 132 * s; return `<div class="decor" style="left:${xEnd - w}px;top:${yB - h}px;width:${w}px;height:${h}px;transform:translateZ(${30 * s}px) rotateX(-6deg);transform-origin:bottom"><i class="frame" style="inset:0;border-color:#8d939c"><img src="assets/symbole.png" alt=""></i></div>`; }
    return stackFlat(xEnd - 130 * s, yB, s, ['#7a2a1e', '#c3c8cf', '#0B1F44'], ball('steel'));
  }
  if (kind === 0) { const w = 104 * s, h = 132 * s; return `<div class="decor" style="left:${xEnd - w}px;top:${yB - h}px;width:${w}px;height:${h}px;transform:translateZ(${30 * s}px) rotateX(-6deg);transform-origin:bottom"><i class="frame" style="inset:0"><img src="assets/symbole.png" alt=""></i></div>`; }
  if (kind === 1) { const w = 70 * s, h = 92 * s; let leaves = '';
    for (let k = 0; k < 7; k++) { const a = -50 + k * 17, len = (60 + (k % 3) * 18) * s;
      leaves += `<i class="stem" style="left:${w / 2}px;bottom:${h - 4}px;height:${len}px;transform:rotate(${a}deg)"><i class="leaf" style="left:-10px;top:-6px;transform:rotate(${a < 0 ? 200 : -20}deg) scale(${s})"></i></i>`; }
    return `<div class="decor" style="left:${xEnd - w - 10 * s}px;top:${yB - h}px;width:${w}px;height:${h}px;${Z(55)}">${leaves}<i class="vase" style="inset:0"></i></div>`; }
  return stackFlat(xEnd - 130 * s, yB, s, ['#0B1F44', '#D4AF7C', '#64748B'], ball('sphere'));
}
/* V2.37 : numéro d'étagère sur le chant de la tablette (vue 3D) */
function rowTag37(n, x, y, key) { return `<div class="rowtag37${key ? ' tap46' : ''}"${key ? ` data-shelfkey="${key}" title="Menu de l'étagère"` : ''} style="left:${x}px;top:${y + 1}px;transform:translateZ(${U.D + 2}px)"><span>${T28('Étagère')}</span> <b data-no-i18n>${n}</b></div>`; }
function shelf3D(y, x, w, key) {
  const D = U.D, T = U.T, k46 = key ? ` data-shelfkey="${key}" title="Menu de l'étagère"` : '';
  return `<div class="shelf" style="top:${y}px;left:${x}px;width:${w}px;height:${T}px;--D:${D}px">
    <div class="sh-shadow" style="top:${T}px"></div><div class="sh-glow" style="top:${T}px"></div>
    <div class="sh-top" style="top:0;transform:translateZ(${D}px) rotateX(-90deg)"></div>
    <div class="sh-bot" style="top:${T}px;transform:translateZ(${D}px) rotateX(-90deg)"></div>
    <div class="sh-front${key ? ' tap46' : ''}"${k46} style="top:0;transform:translateZ(${D}px)"></div></div>`;
}
function divider3D(x, top, h) {
  const w = 10, D = U.D;
  return `<div class="divider" style="left:${x - w / 2}px;top:${top}px;width:${w}px;height:${h}px">
    <i style="inset:0;transform:translateZ(${D}px);background:var(--div);box-shadow:0 0 8px rgba(0,0,0,.4)"></i>
    <i style="left:0;top:0;width:${D}px;height:${h}px;transform-origin:left;transform:translateZ(${D}px) rotateY(90deg);background:var(--shBot);opacity:.9"></i>
    <i style="left:${w}px;top:0;width:${D}px;height:${h}px;transform-origin:left;transform:translateZ(${D}px) rotateY(90deg);background:var(--shBot);opacity:.7"></i></div>`;
}
const rowsOf = (g, n) => Array.from({length: n}, (_, i) => g.bs.filter(b => (b.row || 1) === i + 1).sort((a, b) => (a.position || 999) - (b.position || 999)));
const rowWidth = r => r.reduce((s, b) => s + bookDims(b).w + 1, 0);

/* =====================================================================
   PIÈCE 3D (la pièce s'agrandit quand il y a beaucoup de livres)
   ===================================================================== */
function renderRoom(resetView) {
  const groups = caseGroups(), q = F.q.trim();
  if (curCase !== ALL && !groups.some(g => g.id === curCase)) curCase = groups[0]?.id || '';
  if (curCase === ALL && groups.length < 2) curCase = groups[0]?.id || '';
  if (q && !aiHits && curCase !== ALL) { const cur = groups.find(g => g.id === curCase);
    if (!cur || !cur.bs.some(b => matchQ(b, q) && passF(b))) { const g = groups.find(g => g.bs.some(b => matchQ(b, q) && passF(b))); if (g) { curCase = g.id; resetView = true; } } }
  const nrt = activeTheme(); if (nrt !== rt || !$('#v-lib').classList.contains('th-' + nrt)) { rt = nrt; applyTheme(); }
  renderCaseBar(groups); renderThemeBar(); renderSelBar();
  $('#caseBar').style.display = 'flex';
  $('#welcome').classList.toggle('on', !books.length);
  const dimmed = b => aiHits ? !aiHits.has(b.id) : !(passF(b) && matchQ(b, q));
  const T = THEMES[rt].unit, W0 = T.w, H0 = T.h, TOP = 46, GAP = 22;
  const dz = (cid, row, x, y, w, h) => `<div class="dropz" data-case="${cid}" data-row="${row}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:translateZ(${U.D / 2}px)"></div>`;
  let html = '', R = 1;
  const isAll = curCase === ALL, zones = isAll ? groups.filter(g => g.bs.length || g.id !== NONE) : [groups.find(x => x.id === curCase) || {id: 'demo', name: 'Ma bibliothèque', bs: [], rows: 3}];
  const rowsN = Math.max(...zones.map(rowsCount));
  const allB = zones.flatMap(g => g.bs), maxBH = Math.max(150, ...allB.map(b => bookDims(b).h));
  const s = clamp(((H0 - TOP) / 3 - U.T - GAP) / maxBH, .45, 1);
  const rowHneed = maxBH * s + U.T + GAP;
  const need = zones.map(g => Math.max(isAll ? 170 : 300, ...rowsOf(g, rowsN).map(r => rowWidth(r) * s + (isAll ? 40 : 60 + 170 * s))));
  const sumNeed = need.reduce((a, b) => a + b, 0);
  R = clamp(Math.max(1, sumNeed / W0, (TOP + rowsN * rowHneed) / H0), 1, 6);
  const W = W0 * R, H = H0 * R, rowH = (H - TOP) / rowsN;
  $('#emptyMsg').style.display = !isAll && books.length && !zones[0].bs.length ? 'block' : 'none';
  const extra = Math.max(0, W - sumNeed); let zx = 0;
  zones.forEach((g, zi) => {
    const zw = isAll ? need[zi] + extra * need[zi] / sumNeed : W;
    if (isAll) { html += `<div class="zonebg" style="left:${zx + 4}px;top:4px;width:${zw - 8}px;height:${H - 8}px"></div>`;
      html += `<div class="plaque zl" data-goto="${g.id}" title="Ouvrir ce meuble" style="left:${zx + zw / 2}px;top:10px">${nm28(g)}<small>${g.bs.filter(b => !b.wish).length}</small></div>`; }
    else if (books.length) html += `<div class="plaque" data-ren="${g.id}" title="Renommer" style="left:${Math.min(W * .72, W - 160)}px;top:4px">${nm28(g)}<small>${g.bs.filter(b => !b.wish).length} ouvrage${g.bs.filter(b => !b.wish).length > 1 ? 's' : ''}</small></div>`;
    rowsOf(g, rowsN).forEach((r, i) => {
      const y = Math.round(TOP + (i + 1) * rowH - U.T); let x = zx + 20;
      const sk46 = !isAll && g.id !== NONE && g.id !== 'demo' ? g.id + '|' + (i + 1) : '';
      if (!isAll) html += `<div class="rowgrp" data-rg="${i + 1}">${shelf3D(y, 0, W, sk46)}${g.id !== NONE && g.id !== 'demo' ? `<div class="shgrip" data-grip="${g.id}|${i + 1}" style="left:-52px;top:${y - 22}px" title="Cliquer : menu de l'étagère (sélectionner, supprimer). Maintenir puis glisser : déplacer l'étagère" aria-label="Étagère ${i + 1}"><i class="ghit46"></i><b class="g37n" data-no-i18n>${i + 1}</b></div>` : ''}`;
      html += dz(g.id, i + 1, zx, TOP + i * rowH, zw, rowH);
      if (CAM.sel) { const ids = r.filter(b => !b.wish).map(b => b.id), all = ids.length && ids.every(id => SEL.has(id));
        html += `<button class="rowsel${all ? ' on' : ''}" data-rs="${g.id}|${i + 1}" style="left:${zx + 6}px;top:${TOP + i * rowH + 6}px">${all ? '☑' : '☐'} Étagère ${i + 1}${ids.length ? ` (${ids.length})` : ''}</button>`; }
      if (!isAll || zi === 0) html += rowTag37(i + 1, zx + (isAll ? 10 : 24), y, sk46);
      r.forEach(b => { html += book3D(b, x, y, s, dimmed(b)); x += (bookDims(b).w + 1) * s; });
      if (r.length && x + 14 * s < zx + zw - 6) html += bookend3D(x + 3, y, s);
      if (!isAll && zx + zw - x > 190 * s) html += decor3D((i + hash(g.id)) % 3, zx + zw - 30, y, s);
      if (!isAll) html += '</div>';
    });
    zx += zw; if (isAll && zi < zones.length - 1) html += divider3D(zx, 0, H - 4);
  });
  if (isAll) for (let i = 0; i < rowsN; i++) html += shelf3D(Math.round(TOP + (i + 1) * rowH - U.T), 0, W);
  const u = $('#unit'); Object.assign(u.style, {left: T.x * R + 'px', top: T.y * R + 'px', width: W + 'px', height: H + 'px'});
  u.dataset.rowh = rowH; u.innerHTML = html; $('#fx').style.transform = `scale(${R})`;
  const key = curCase + '|' + rt; const reset = resetView || VIEW.key !== key || Math.abs(VIEW.R - R) > .01; VIEW.R = R; VIEW.key = key;
  applyView(reset ? 'reset' : null); applyCam();
  if (q || aiHits) $$('#unit .book:not(.dim)').forEach(el => el.classList.add('hit'));
}
function focusBook(id) { // centre la vue sur un livre
  const el = $(`#unit .book[data-id="${id}"]`); if (!el) return; const r = el.getBoundingClientRect(), v = VP.getBoundingClientRect();
  VIEW.px += (v.left + v.width / 2) - (r.left + r.width / 2); VIEW.py += (v.top + v.height / 2) - (r.top + r.height / 2); applyView();
}
$('#unit').addEventListener('click', async e => {
  if (justDragged) return;
  const gp = e.target.closest('.shgrip'); if (gp) return openShelfMenu20(gp.dataset.grip);
  const sk = e.target.closest('[data-shelfkey]'); if (sk && !CAM.sel) return openShelfMenu20(sk.dataset.shelfkey); // V2.46 : planche ou étiquette « Étagère n »
  const bk = e.target.closest('.book');
  const rs = e.target.closest('[data-rs]'); if (rs) return selectRow(rs.dataset.rs);
  if (bk) { if (CAM.sel || e.ctrlKey || e.metaKey || e.shiftKey) { SEL.has(bk.dataset.id) ? SEL.delete(bk.dataset.id) : SEL.add(bk.dataset.id); bk.classList.toggle('sel'); return renderSelBar(); } const id = bk.dataset.id; clearTimeout(window._bkClick); window._bkClick = setTimeout(() => openBook(id), 260); return; }
  const go = e.target.closest('[data-goto]'); if (go) { curCase = go.dataset.goto; localStorage.setItem('scanly_case', curCase); return renderRoom(true); }
  const rn = e.target.closest('[data-ren]'); if (rn) { const c = cases.find(x => x.id === rn.dataset.ren); if (!c) return;
    const n = prompt('Nom du meuble :', c.name); if (n && n.trim()) { c.name = n.trim(); await DB.put('cases', c); renderAll(); } }
});
$('#unit').addEventListener('mousemove', e => {
  const bk = e.target.closest('.book'), t = $('#tip'); if (!bk || drag || pan) { t.style.display = 'none'; return; }
  const b = books.find(x => x.id === bk.dataset.id); if (!b) return;
  const cn = cases.find(c => c.id === b.caseId)?.name;
  t.innerHTML = `<b>${esc(dispTitle(b))}${b.volume && !norm(b.title).includes(String(b.volume)) ? ' – T' + b.volume : ''}</b><div class="m">${esc(b.author || (b.unknown ? 'Clique pour compléter la fiche' : 'Auteur inconnu'))}</div><div class="m">${[b.type, b.year, b.publisher].filter(Boolean).map(esc).join(' · ')}</div>${curCase === ALL && cn ? `<div class="m">${esc(cn)}</div>` : ''}${b.wish ? '<div style="color:var(--gold)">Liste de souhaits</div>' : ''}${isLoaned(b) ? `<div style="color:#ff9b8a">Prêté${b.loanTo ? ' à ' + esc(b.loanTo) : ''}${isLate(b) ? ' – en retard' : ''}</div>` : ''}${b.price && !b.wish ? `<div style="color:var(--gold)">${eur(b.price, b.priceSource)}</div>` : ''}<div class="m" style="margin-top:4px;font-size:10px">Clic : fiche · Double-clic : zoom · Glisser : déplacer · Ctrl+clic : sélectionner</div>`;
  t.style.display = 'block'; t.style.left = Math.min(e.clientX + 16, innerWidth - 300) + 'px'; t.style.top = Math.min(e.clientY + 16, innerHeight - 150) + 'px';
});
$('#welcome').addEventListener('click', e => { const c = e.target.closest('[data-act]'); if (!c) return; ({cam: () => openScan(null, 'cam'), imp: () => openScan(null, 'imp'), add: addManual})[c.dataset.act](); });
window.addEventListener('resize', () => applyView());

/* =====================================================================
   SÉLECTION MULTIPLE ET DÉPLACEMENT GROUPÉ
   ===================================================================== */
const caseOptions = (cur, withNone = false) => cases.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${esc(c.name)}</option>`).join('') + (withNone ? `<option value="${NONE}">Non rangés</option>` : '') + `<option value="__new">＋ Nouveau meuble…</option>`;
function renderSelBar() {
  [...SEL].forEach(id => { if (!books.some(b => b.id === id)) SEL.delete(id); });
  const bar = $('#selBar'); if (!SEL.size && !CAM.sel) { bar.classList.remove('on'); return; }
  bar.classList.add('on');
  const done = CAM.sel ? '<button class="btn s sm" id="selDone">Terminer la sélection</button>' : '';
  if (!SEL.size) { bar.innerHTML = `<b>Mode sélection</b><span class="hint" style="color:#c9d3e6">Touche des livres, ou « ☐ Étagère n » pour toute une étagère.</span><button class="btn s sm" id="selCase2" title="Sélectionner tous les livres du meuble affiché">Tout le meuble</button>${done}`; }
  else bar.innerHTML = `<b>${SEL.size} livre${SEL.size > 1 ? 's' : ''} sélectionné${SEL.size > 1 ? 's' : ''}</b><span class="hint" style="color:#c9d3e6">Déplacer vers</span>
    <select id="selCase">${caseOptions(cases.some(c => c.id === curCase) ? curCase : '')}</select><span class="hint" style="color:#c9d3e6">étagère</span><input id="selRow" type="number" min="1" max="15" value="1" style="width:56px">
    <button class="btn g sm" id="selGo">Déplacer</button><button class="btn k sm" id="selDel">Supprimer (${SEL.size})</button><button class="btn s sm" id="selCase2" title="Sélectionner tous les livres du meuble affiché">Tout le meuble</button><button class="btn s sm" id="selClear">Tout désélectionner</button>${done}`;
  if ($('#selDel')) $('#selDel').onclick = () => deleteBooks([...SEL], 'Suppression de la sélection');
  $('#selCase2').onclick = () => { books.filter(b => !b.wish && (curCase === ALL || caseOf(b) === curCase)).forEach(b => SEL.add(b.id)); renderRoom(); };
  if ($('#selGo')) $('#selGo').onclick = async () => { const ok = await moveBooks([...SEL], $('#selCase').value, Math.max(1, parseInt($('#selRow').value) || 1), `Déplacement de ${SEL.size} livre(s)`); if (ok) { SEL.clear(); renderAll(); } };
  if ($('#selClear')) $('#selClear').onclick = () => { SEL.clear(); renderRoom(); renderList(); };
  if ($('#selDone')) $('#selDone').onclick = () => { CAM.sel = false; SEL.clear(); renderRoom(); renderList(); };
}
function selectRow(key) {
  const i = key.lastIndexOf('|'), cid = key.slice(0, i), row = +key.slice(i + 1);
  const ids = books.filter(b => !b.wish && caseOf(b) === cid && (b.row || 1) === row).map(b => b.id); if (!ids.length) return toast('Cette étagère est vide');
  const all = ids.every(id => SEL.has(id)); ids.forEach(id => all ? SEL.delete(id) : SEL.add(id)); renderRoom(); renderList();
}
async function moveBooks(ids, dest, row, label) {
  if (dest === '__new') { const n = prompt('Nom du nouveau meuble :', 'Nouveau meuble'); if (!n) return false; dest = (await newCase(n, row)).id; }
  if (dest === NONE) dest = null;
  const c = cases.find(x => x.id === dest); if (c && (c.rows || 3) < row) { c.rows = row; await DB.put('cases', c); }
  const set = new Set(ids), list = books.filter(b => set.has(b.id)).sort((a, b) => (a.caseId || '').localeCompare(b.caseId || '') || (a.row || 1) - (b.row || 1) || (a.position || 0) - (b.position || 0));
  pushUndo(label); const base = nextPos(dest, row, set) - 1;
  list.forEach((b, i) => { b.caseId = dest; b.row = row; b.position = base + i + 1; });
  await DB.putMany('books', list); if (dest) { curCase = dest; localStorage.setItem('scanly_case', curCase); }
  renderAll(); showUndo(`${list.length} livre(s) déplacé(s) vers ${c ? c.name : 'Non rangés'}`); return true;
}

/* =====================================================================
   GLISSER-DÉPOSER DES LIVRES
   ===================================================================== */
$('#unit').addEventListener('mousedown', e => { if (e.button !== 0) return; const bk = e.target.closest('.book'); if (!bk) return; drag = {id: bk.dataset.id, x0: e.clientX, y0: e.clientY, on: false, el: bk}; e.preventDefault(); });
window.addEventListener('mousemove', e => {
  if (!drag) return;
  if (!drag.on) { if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return; startDrag(); }
  const g = $('#dragGhost'); if (g) { g.style.left = (e.clientX - 15) + 'px'; g.style.top = (e.clientY - 75) + 'px'; }
  updateDrop(e.clientX, e.clientY);
});
window.addEventListener('mouseup', async () => { if (!drag) return; const d = drag; drag = null; if (!d.on) return; justDragged = true; setTimeout(() => justDragged = false, 80); await endDrag(d); });
function startDrag() {
  drag.on = true; const b = books.find(x => x.id === drag.id), col = colOf(b);
  const g = document.createElement('div'); g.id = 'dragGhost'; g.style.background = col; g.style.color = txtCol(col);
  if (b.spineImg && CAM.photo) g.style.backgroundImage = `url('${spineURL(b)}')`; else g.textContent = b.series && b.volume ? b.series + ' ' + b.volume : dispTitle(b);
  document.body.appendChild(g);
  drag.el.classList.add('lifted'); $('#unit').classList.add('dragging'); document.body.classList.add('dnd'); $('#tip').style.display = 'none'; document.body.style.cursor = 'grabbing';
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-dd]');
  $$('.ddw.open').forEach(w => { if (!t || w !== t.parentElement) w.classList.remove('open'); });
  if (t) { t.parentElement.classList.toggle('open'); e.stopPropagation(); }
  else if (e.target.closest('.ddw .dd button[data-case],.ddw .dd button[data-theme],.ddw .dd button[data-cam],.ddw .dd button[data-act],.ddw .dd button[data-z]')) setTimeout(() => $$('.ddw').forEach(w => w.classList.remove('open')), 0);
}, true);
/* V2.13 : un menu déroulant ne sort jamais de l'écran */
function fitDD(w) { const d = w && w.querySelector(':scope>.dd'); if (!d) return; d.style.transform = '';
  requestAnimationFrame(() => { const r = d.getBoundingClientRect(); if (!r.width) return; const m = 8; let dx = 0, dy = 0;
    if (r.right > innerWidth - m) dx = innerWidth - m - r.right; if (r.left + dx < m) dx = m - r.left;
    if (r.top < m) dy = m - r.top; if (r.bottom + dy > innerHeight - m) dy = innerHeight - m - r.bottom;
    if (dx || dy) d.style.transform = `translate(${Math.round(dx)}px,${Math.round(dy)}px)`; }); }
document.addEventListener('mouseover', e => { const w = e.target.closest && e.target.closest('.ddw'); if (w) fitDD(w); });
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-dd]'); if (t) setTimeout(() => fitDD(t.parentElement), 0); });
function dropTarget(x, y) {
  const els = document.elementsFromPoint(x, y);
  const cb = els.find(el => el.matches && el.matches('#caseBar button[data-case]') && ![ALL, '__add', '__clearai'].includes(el.dataset.case));
  if (cb) return {kind: 'case', caseId: cb.dataset.case, el: cb};
  const z = els.find(el => el.classList && el.classList.contains('dropz')); if (z) return {kind: 'row', caseId: z.dataset.case, row: +z.dataset.row, el: z};
  return null;
}
function rowSlots(caseId, row, exclId) {
  return $$('#unit .book').filter(el => el.dataset.case === caseId && +el.dataset.row === row && el.dataset.id !== exclId)
    .map(el => ({id: el.dataset.id, r: el.querySelector('.fr').getBoundingClientRect()})).sort((a, b) => a.r.left - b.r.left);
}
function updateDrop(x, y) {
  $$('.dropz.over,#caseBar .dropok').forEach(el => el.classList.remove('over', 'dropok'));
  const m = $('#dropMark'); m.style.display = 'none';
  const t = dropTarget(x, y); drag.t = t; if (!t) return;
  if (t.kind === 'case') { t.el.classList.add('dropok'); return; }
  t.el.classList.add('over');
  const sl = rowSlots(t.caseId, t.row, drag.id), i = sl.filter(s => s.r.left + s.r.width / 2 < x).length; t.index = i;
  const zr = t.el.getBoundingClientRect(), ref = sl[Math.min(i, sl.length - 1)]?.r;
  const mx = sl.length ? (i < sl.length ? sl[i].r.left - 3 : sl[sl.length - 1].r.right + 1) : zr.left + 20;
  Object.assign(m.style, {display: 'block', left: mx + 'px', top: (ref ? ref.top : zr.top + 10) + 'px', height: (ref ? ref.height : Math.max(40, zr.height - 30)) + 'px'});
}
async function endDrag(d) {
  $('#dragGhost')?.remove(); $('#dropMark').style.display = 'none'; $('#unit').classList.remove('dragging'); document.body.classList.remove('dnd'); document.body.style.cursor = '';
  $$('.dropz.over,#caseBar .dropok').forEach(el => el.classList.remove('over', 'dropok'));
  const b = books.find(z => z.id === d.id), t = d.t; d.el.classList.remove('lifted');
  if (!b || !t) return;
  const newCase_ = t.caseId === NONE ? null : t.caseId;
  if (t.kind === 'case') {
    if (newCase_ === b.caseId) return;
    pushUndo(`Déplacement de « ${dispTitle(b)} »`);
    b.caseId = newCase_; b.row = 1; b.position = nextPos(newCase_, 1, new Set([b.id])); await saveBook(b);
    renderAll(); showUndo(`« ${dispTitle(b)} » déplacé vers ${cases.find(c => c.id === newCase_)?.name || 'Non rangés'}`); return;
  }
  const order = rowSlots(t.caseId, t.row, d.id).map(s => books.find(z => z.id === s.id)).filter(Boolean);
  order.splice(Math.min(t.index ?? order.length, order.length), 0, b);
  pushUndo(`Déplacement de « ${dispTitle(b)} »`);
  b.caseId = newCase_; b.row = t.row; order.forEach((z, i) => z.position = i + 1);
  await DB.putMany('books', order); animateRender(renderAll);
  showUndo(`« ${dispTitle(b)} » déplacé`);
}
function animateRender(fn) {
  const old = {}; $$('#unit .book').forEach(el => old[el.dataset.id] = [el.style.left, el.style.top]); fn();
  const els = $$('#unit .book').filter(el => old[el.dataset.id]), nw = els.map(el => [el.style.left, el.style.top]);
  els.forEach(el => { [el.style.left, el.style.top] = old[el.dataset.id]; }); void $('#unit').offsetWidth;
  els.forEach((el, i) => { el.classList.add('anim'); [el.style.left, el.style.top] = nw[i]; });
  setTimeout(() => els.forEach(el => el.classList.remove('anim')), 1000);
}
function showUndo(txt, fn) {
  $('#undoTxt').textContent = txt; $('#undo').classList.add('on');
  $('#undoBtn').onclick = async () => { $('#undo').classList.remove('on'); await (fn || undo)(); };
  clearTimeout(showUndo._t); showUndo._t = setTimeout(() => $('#undo').classList.remove('on'), 10000);
}

/* =====================================================================
   RANGEMENT (photo d'origine, auteur, série…)
   ===================================================================== */
const SORTS = {photo: 'Ordre de la photo d\'origine', author: 'Auteur', series: 'Série et tome', title: 'Titre', genre: 'Genre', type: 'Type', color: 'Couleur', year: 'Année de parution'};
function sortCmp(key) {
  const c = (a, b) => String(a || '\uffff').localeCompare(String(b || '\uffff'), 'fr', {numeric: true});
  const ser = (a, b) => c(a.series || a.title, b.series || b.title) || (a.volume || 0) - (b.volume || 0);
  return {author: (a, b) => c(lastName(a), lastName(b)) || ser(a, b), series: ser, title: (a, b) => c(a.title, b.title),
    genre: (a, b) => c(a.genre, b.genre) || c(lastName(a), lastName(b)) || ser(a, b), type: (a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || ser(a, b),
    color: (a, b) => hueOf(colOf(a)) - hueOf(colOf(b)), year: (a, b) => (a.year || 9999) - (b.year || 9999) || ser(a, b)}[key];
}
function openSortMenu() {
  if (!cases.length || curCase === NONE) return toast('Choisis d\'abord un meuble à ranger');
  const scope = curCase === ALL ? 'chaque meuble (séparément)' : `le meuble « ${esc(cases.find(c => c.id === curCase)?.name || '')} »`;
  openModal(`<div class="dhead"><h3>Rangement automatique</h3><button class="x" data-close>×</button></div><div class="mbody">
    <p class="hint">Réorganise ${scope}. Les livres se déplacent sous tes yeux ; <b>↶ Annuler</b> (Ctrl+Z) revient en arrière à tout moment.</p>
    <div class="btns"><button class="btn g" data-sort="photo">${SORTS.photo}</button></div>
    <p class="hint">Remet chaque livre importé à l'étagère et à la place qu'il occupait sur la photo. Les livres ajoutés à la main restent à la suite.</p>
    <div class="btns">${Object.entries(SORTS).filter(([k]) => k !== 'photo').map(([k, v]) => `<button class="btn s" data-sort="${k}">${v}</button>`).join('')}</div>
    <p class="hint" style="margin-top:12px">Les tris par auteur, série, etc. répartissent les livres sur toutes les étagères du meuble.</p></div>`, 'sm');
  $('#mbox').onclick = e => { const b = e.target.closest('[data-sort]'); if (b) { closeModal(); setView('lib'); autoSort(b.dataset.sort); } };
}
async function reorderByOrig(list, label) { // remet une liste de livres à leur emplacement d'origine
  pushUndo(label); const rows = new Set(), set = new Set(list.map(b => b.id));
  list.filter(b => b.orig).forEach(b => { b.caseId = b.orig.caseId; b.row = b.orig.row; rows.add((b.caseId || '') + '|' + b.row); });
  const ch = [];
  rows.forEach(k => { const [cid, r] = k.split('|'), caseId = cid || null, row = +r;
    const L = books.filter(b => (b.caseId || null) === caseId && (b.row || 1) === row);
    const key = b => set.has(b.id) && b.orig ? b.orig.position - .5 : (b.position || 999);
    L.sort((a, b) => key(a) - key(b) || (a.importOrder || 0) - (b.importOrder || 0)).forEach((b, i) => { b.position = i + 1; ch.push(b); }); });
  await DB.putMany('books', ch); animateRender(renderAll);
}
async function autoSort(key) {
  const ids = curCase === ALL ? cases.map(c => c.id) : [curCase];
  if (key === 'photo') {
    const L = books.filter(b => ids.includes(b.caseId) && b.orig && ids.includes(b.orig.caseId));
    if (!L.length) return toast('Aucun livre importé par photo dans ce meuble'); await reorderByOrig(L, 'Ordre de la photo d\'origine');
    return showUndo('Livres remis dans l\'ordre de la photo d\'origine');
  }
  pushUndo('Rangement par ' + SORTS[key].toLowerCase()); const ch = [];
  for (const cid of ids) {
    const c = cases.find(x => x.id === cid); if (!c) continue;
    const list = books.filter(b => b.caseId === cid).sort(sortCmp(key)); if (!list.length) continue;
    const rowsN = Math.max(c.rows || 3, 1), total = list.reduce((s, b) => s + bookDims(b).w + 1, 0), per = total / rowsN;
    let row = 1, acc = 0, pos = 0;
    list.forEach(b => { const w = bookDims(b).w + 1; if (acc + w / 2 > per * row && row < rowsN) { row++; pos = 0; } acc += w; b.row = row; b.position = ++pos; ch.push(b); });
  }
  await DB.putMany('books', ch); animateRender(renderAll); showUndo('Rangé par ' + SORTS[key].toLowerCase());
}

/* =====================================================================
   EXPORT IMAGE / PDF
   ===================================================================== */
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_TOUCH = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
async function saveFile(name, content, mime, ext, desc) {
  const blob = content instanceof Blob ? content : new Blob([content], {type: mime});
  if (window.showSaveFilePicker) {
    try { const h = await window.showSaveFilePicker({suggestedName: name, types: [{description: desc, accept: {[mime]: [ext]}}]});
      const w = await h.createWritable(); await w.write(blob); await w.close(); return h.name; }
    catch (e) { if (e.name === 'AbortError') return null; }
  }
  if (IS_IOS && navigator.canShare) { try { const f = new File([blob], name, {type: mime}); if (navigator.canShare({files: [f]})) { await navigator.share({files: [f], title: name}); return name; } }
    catch (e) { if (e.name === 'AbortError') return null; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); return name;
}
async function renderImage() {
  if (!$('#unit .shelf')) renderRoom();
  const T = THEMES[rt], R = VIEW.R, f = Math.min(1, 4096 / (1536 * R)), cv = document.createElement('canvas'); cv.width = Math.round(1536 * R * f); cv.height = Math.round(1024 * R * f);
  const x = cv.getContext('2d');
  try { x.drawImage(await srcToImg(T.img), 0, 0, cv.width, cv.height); } catch (e) { x.fillStyle = '#0B1F44'; x.fillRect(0, 0, cv.width, cv.height); }
  x.scale(f, f);
  const ox = T.unit.x * R, oy = T.unit.y * R, px = el => ['left', 'top', 'width', 'height'].map(k => parseFloat(el.style[k]) || 0);
  const wood = rt === 'futur' ? ['#2a3a4f', '#0a1019'] : rt === 'magie' ? ['#7a4d28', '#3a2210'] : rt === 'bnf' ? ['#e9ebee', '#868c95'] : ['#d9b386', '#9c7146'];
  $$('#unit .zonebg').forEach(z => { const [l, t, w, h] = px(z); x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(ox + l, oy + t, w, h); });
  $$('#unit .divider').forEach(d => { const [l, t, w, h] = px(d); x.fillStyle = wood[0]; x.fillRect(ox + l, oy + t, w, h); });
  $$('#unit .shelf').forEach(s => { const [l, t, w] = px(s); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(ox + l, oy + t + 16, w, 9);
    const g = x.createLinearGradient(0, oy + t, 0, oy + t + 16); g.addColorStop(0, wood[0]); g.addColorStop(1, wood[1]); x.fillStyle = g; x.fillRect(ox + l, oy + t, w, 16);
    if (rt === 'futur') { x.fillStyle = '#4fd6ff'; x.fillRect(ox + l, oy + t, w, 2); } });
  const fit = (s, max) => { s = String(s); while (s.length > 1 && x.measureText(s).width > max) s = s.slice(0, -2); return s; };
  for (const el of $$('#unit .book')) { const b = books.find(z => z.id === el.dataset.id); if (!b) continue; const [l, t, w, h] = px(el), bx = ox + l, by = oy + t, col = colOf(b);
    x.globalAlpha = b.wish ? .35 : el.classList.contains('dim') ? .3 : 1;
    let drawn = false;
    if (CAM.photo && b.spineImg && !b.faceOut && !b.wish) { try { x.drawImage(await srcToImg(b.spineImg), bx, by, w, h); drawn = true; } catch (e) {} }
    if (!drawn) { const g = x.createLinearGradient(bx, 0, bx + w, 0); g.addColorStop(0, shade(col, .75)); g.addColorStop(.5, shade(col, 1.1)); g.addColorStop(1, shade(col, .7)); x.fillStyle = g; x.fillRect(bx, by, w, h);
      x.fillStyle = txtCol(col); x.save();
      if (b.faceOut) { x.font = `700 ${Math.max(9, w / 9)}px Segoe UI, Arial`; x.textAlign = 'center'; x.fillText(fit(dispTitle(b), w - 8), bx + w / 2, by + h / 2); }
      else { x.translate(bx + w / 2, by + h - 8); x.rotate(-Math.PI / 2); x.font = `600 ${clamp(w * .42, 7, 12)}px Segoe UI, Arial`; x.textBaseline = 'middle'; x.fillText(fit(b.unknown ? '?' : b.series && b.volume ? b.series + ' ' + b.volume : b.title, h - 16), 0, 0); }
      x.restore(); }
    x.globalAlpha = 1; }
  $$('#unit .plaque').forEach(p => { const l = parseFloat(p.style.left), t = parseFloat(p.style.top) || 0, txt = (p.childNodes[0]?.textContent || '').toUpperCase();
    x.font = '700 13px Segoe UI, Arial'; const tw = x.measureText(txt).width + 28;
    x.fillStyle = rt === 'futur' ? 'rgba(8,18,30,.9)' : rt === 'bnf' ? '#e9ebee' : '#D4AF7C'; x.fillRect(ox + l - tw / 2, oy + t, tw, 26);
    x.fillStyle = rt === 'futur' ? '#7fe3ff' : rt === 'magie' ? '#5e1a1a' : '#0B1F44'; x.textAlign = 'center'; x.fillText(txt, ox + l, oy + t + 17); x.textAlign = 'left'; });
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = 'rgba(11,31,68,.78)'; x.fillRect(0, cv.height - 40, cv.width, 40); x.fillStyle = '#F8F6F0'; x.font = '800 20px Segoe UI, Arial'; x.fillText('SCANEBOOK', 20, cv.height - 13);
  x.font = '500 13px Segoe UI, Arial'; x.fillStyle = '#D4AF7C';
  x.fillText(`${new Date().toLocaleDateString('fr-FR')} · ${books.filter(b => !b.wish).length} ouvrages · ${curCase === ALL ? 'Vue d\'ensemble' : (cases.find(c => c.id === curCase)?.name || '')}`, 120, cv.height - 14);
  return cv;
}
async function exportImageFile() {
  const cv = await renderImage(), blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const n = await saveFile(`scanly_bibliotheque_${today()}.png`, blob, 'image/png', '.png', 'Image PNG'); if (n) toast('Image enregistrée : ' + n);
}
async function printInventory() {
  const cv = await renderImage(), img = cv.toDataURL('image/jpeg', .85), own = sorted(books.filter(b => !b.wish)), val = own.reduce((s, b) => s + (Number(b.price) || 0), 0);
  const w = window.open('', '_blank'); if (!w) return toast('Autorise l\'ouverture de fenêtres pour imprimer');
  const rows = own.map(b => `<tr><td>${b.cover ? `<img src="${esc(b.cover)}" onerror="this.remove()">` : ''}</td><td><b>${esc(dispTitle(b))}</b></td><td>${esc(b.author)}</td><td>${esc(b.series ? b.series + (b.volume ? ' T' + b.volume : '') : '')}</td><td>${esc(b.type)}</td><td>${esc(b.publisher)}</td><td>${b.year || ''}</td><td>${esc(b.isbn)}</td><td>${esc(locOf(b))}</td><td style="text-align:right;white-space:nowrap">${eur(b.price, b.priceSource)}</td></tr>`).join('');
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Inventaire SCANEBOOK ${today()}</title><style>
    body{font:12px "Segoe UI",Arial;color:#0B1F44;margin:24px}h1{font:800 22px "Segoe UI";margin:0}.sub{color:#64748B;margin:4px 0 10px}
    img.lib{width:100%;border-radius:8px;margin:8px 0 16px}table{width:100%;border-collapse:collapse}th{background:#0B1F44;color:#F8F6F0;text-align:left;padding:5px;font-size:11px}
    td{border-bottom:1px solid #e4dfd3;padding:4px 5px;font-size:11px;vertical-align:middle}td img{height:40px;border-radius:2px}tr{page-break-inside:avoid}.tot{margin-top:10px;font:700 14px "Segoe UI"}@page{margin:12mm}</style></head><body>
    <h1>SCANEBOOK – Inventaire de ma bibliothèque</h1><div class="sub">Édité le ${new Date().toLocaleDateString('fr-FR')} · ${own.length} ouvrages · valeur estimée ${eur(val)}</div>
    <img class="lib" src="${img}"><table><tr><th></th><th>Titre</th><th>Auteur</th><th>Série</th><th>Type</th><th>Éditeur</th><th>Année</th><th>ISBN</th><th>Emplacement</th><th>Prix</th></tr>${rows}</table>
    <div class="tot">Valeur totale estimée : ${eur(val)}</div><p class="sub">Prix « ≈ » = estimation IA indicative.</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`);
  w.document.close(); toast('Dans la fenêtre d\'impression, choisis « Microsoft Print to PDF » ou « Enregistrer au format PDF »', 6000);
}

/* =====================================================================
   CATALOGUE & LISTE
   ===================================================================== */
function sorted(list) {
  const c = (a, b) => String(a || '\uffff').localeCompare(String(b || '\uffff'), 'fr', {numeric: true});
  const cIdx = id => { const i = cases.findIndex(x => x.id === id); return i < 0 ? 999 : i; };
  const S = { shelf: (a, b) => cIdx(a.caseId) - cIdx(b.caseId) || (a.row || 1) - (b.row || 1) || (a.position || 999) - (b.position || 999),
    title: (a, b) => c(a.title, b.title), author: (a, b) => c(lastName(a), lastName(b)) || c(a.title, b.title),
    series: (a, b) => c(a.series || a.title, b.series || b.title) || (a.volume || 0) - (b.volume || 0),
    year: (a, b) => (b.year || 0) - (a.year || 0), yearAsc: (a, b) => (a.year || 9999) - (b.year || 9999),
    added: (a, b) => (b.addedAt || 0) - (a.addedAt || 0), price: (a, b) => (b.price || 0) - (a.price || 0), rating: (a, b) => (b.rating || 0) - (a.rating || 0) };
  return list.sort(S[F.sort] || S.title);
}
const visible = () => sorted(books.filter(b => passF(b) && matchQ(b, F.q)));
function coverHTML(b, cls = 'cover') {
  const col = colOf(b), tc = txtCol(col), ph = `<div class="${cls} phc" style="background:linear-gradient(150deg,${shade(col, 1.15)},${col} 45%,${shade(col, .6)});color:${tc}"><span class="pht">${esc(b.series || dispTitle(b))}</span>${b.volume ? `<span class="phv">${b.volume}</span>` : (b.series ? '' : '')}${(() => { if (!b.series || !b.title) return ''; const sub = b.title.replace(new RegExp('^' + b.series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[-–:]?\\s*', 'i'), '').replace(/^(tome|t\.?)\s*\d+\s*[-–:]?\s*/i, '').replace(/^\d+\s*[-–:]?\s*/, '').trim(); return sub && norm(sub) !== norm(b.series) ? `<span class="phs">${esc(sub)}</span>` : ''; })()}<span class="pha">${esc(b.author || '')}</span></div>`;
  return b.cover ? `<img class="${cls}" loading="lazy" src="${esc(b.cover)}" alt="" data-ph="${esc(ph)}" onerror="this.outerHTML=this.dataset.ph">` : ph;
}
function renderCat() {
  const list = visible(), own = books.filter(b => !b.wish), val = own.reduce((s, b) => s + (Number(b.price) || 0), 0), wn = books.length - own.length, un = books.filter(b => b.unknown).length;
  $('#stats').innerHTML = `<div class="stat"><b>${own.length}</b><span>ouvrages</span></div><div class="stat"><b>${new Set(own.map(b => (b.author || '').split(',')[0].trim()).filter(Boolean)).size}</b><span>auteurs</span></div><div class="stat"><b>${new Set(own.map(b => b.series).filter(Boolean)).size}</b><span>séries</span></div><div class="stat"><b>${own.filter(b => b.status === 'Lu').length}</b><span>lus</span></div><div class="stat g"><b>${val ? Math.round(val).toLocaleString('fr-FR') + ' €' : '—'}</b><span>valeur estimée</span></div>${un ? `<div class="stat k"><b>${un}</b><span>à identifier</span></div>` : ''}${wn ? `<div class="stat"><b>${wn}</b><span>souhaits</span></div>` : ''}${list.length !== books.length ? `<div class="stat"><b>${list.length}</b><span>résultats</span></div>` : ''}`;
  const dupC = sharedCovers();
  $('#grid').innerHTML = list.map(b => `<div class="bk${b.wish ? ' ghost' : ''}" data-id="${b.id}"><div class="cv">${coverHTML(b.cover && dupC.has(ckey(b.cover)) && b.series && b.volume > 1 ? {...b, cover: null} : b)}</div><div class="t">${b.unknown ? '❓ ' : ''}${esc(b.series && b.volume ? b.series + ' – T' + b.volume : dispTitle(b))}</div><div class="a">${esc(b.author || '')}${b.year ? ' · ' + b.year : ''}</div></div>`).join('') || `<div class="empty" style="grid-column:1/-1">Aucun ouvrage</div>`;
}
function renderList() {
  const list = visible();
  $('#tlist').innerHTML = `<tr><th style="width:34px"></th><th data-s="title">Titre</th><th data-s="author">Auteur</th><th data-s="series">Série</th><th>Type</th><th>Genre</th><th>Éditeur</th><th data-s="year">Année</th><th data-s="price">Prix</th><th>Statut</th><th data-s="rating">Note</th><th data-s="shelf">Emplacement</th></tr>` +
    (list.map(b => `<tr data-id="${b.id}" class="${b.wish ? 'wish' : ''}${SEL.has(b.id) ? ' chk' : ''}"><td><input type="checkbox" data-chk="${b.id}" ${SEL.has(b.id) ? 'checked' : ''}></td><td><b>${esc(dispTitle(b))}</b>${b.unknown ? ' <span class="badge k">à identifier</span>' : ''}</td><td>${esc(b.author)}</td><td>${esc(b.series ? b.series + (b.volume ? ' T' + b.volume : '') : '')}</td><td>${esc(b.type)}</td><td>${esc(b.genre)}</td><td>${esc(b.publisher)}</td><td>${b.year || ''}</td><td>${eur(b.price, b.priceSource)}</td><td>${b.wish ? 'Souhait' : isLoaned(b) ? `Prêté – ${esc(b.loanTo || '')}${isLate(b) ? ' (retard)' : ''}` : esc(b.status || 'À lire')}</td><td style="color:var(--gold2)">${'★'.repeat(b.rating || 0)}</td><td class="hint">${b.caseId ? esc(locOf(b)) : '—'}</td></tr>`).join('') || `<tr><td colspan="12" class="empty">Aucun ouvrage</td></tr>`);
  renderListBar();
}
$('#grid').onclick = e => { const b = e.target.closest('.bk'); if (b) openBook(b.dataset.id); };
$('#tlist').onclick = e => { const ck = e.target.closest('[data-chk]'); if (ck) { ck.checked ? SEL.add(ck.dataset.chk) : SEL.delete(ck.dataset.chk); ck.closest('tr').classList.toggle('chk', ck.checked); renderListBar(); return renderSelBar(); } const th = e.target.closest('th[data-s]'); if (th) { F.sort = th.dataset.s; $('#fSort').value = F.sort; return renderAll(); } const tr = e.target.closest('tr[data-id]'); if (tr) openBook(tr.dataset.id); };

function setView(v) {document.body.classList.toggle('utility-view',v==='wish'||v==='review'); $$('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v)); if (v === 'lib') applyView();if(v==='review')renderReviewQueue18();if(v==='wish')renderWishlist18();renderCompactFilters19();requestAnimationFrame(()=>$('#viewSeg button.on')?.scrollIntoView({block:'nearest',inline:'nearest'})); }
$('#viewSeg').onclick = e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); };
/* setupCompactFilters19() est appelée dans js/03_fiche.js, juste après sa définition */
$('#chips').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; F.type = c.dataset.t; renderAll(); };
[['#fStatus', 'status'], ['#fAuthor', 'author'], ['#fGenre', 'genre'], ['#fSort', 'sort']].forEach(([s, k]) => $(s).onchange = e => { F[k] = e.target.value; if (k === 'status' && F.status === '__wish' && !CAM.ghost) { CAM.ghost = true; localStorage.setItem('scanly_ghost', '1'); } renderAll(); });
$('#fReset').onclick = () => { Object.assign(F, {q: '', type: '', status: '', author: '', genre: '', sort: 'shelf'}); aiHits = null; $('#q').value = ''; $('#fStatus').value = ''; $('#fSort').value = 'shelf'; renderAll(); };
$('#q').oninput = e => { F.q = e.target.value; aiHits = null; clearTimeout(window._qt); window._qt = setTimeout(() => { renderRoom(); renderCat(); renderList(); }, 220); };

/* =====================================================================
   SÉRIES & LISTE DE SOUHAITS
   ===================================================================== */
function seriesGroups() {
  const m = new Map();
  books.forEach(b => { if (!b.series) return; const k = norm(b.series); if (!m.has(k)) m.set(k, {key: k, name: b.series, author: '', items: []}); const g = m.get(k); g.items.push(b); if (!g.author && b.author) g.author = b.author; });
  return [...m.values()].map(g => {
    const own = new Set(g.items.filter(b => !b.wish && b.volume).map(b => b.volume)), wish = new Set(g.items.filter(b => b.wish && b.volume).map(b => b.volume));
    const meta = SMETA[g.key] || {}, max = Math.min(200, Math.max(meta.total || 0, ...g.items.map(b => b.volume || 0), 1));
    const miss = []; for (let v = 1; v <= max; v++) if (!own.has(v)) miss.push(v);
    return {...g, own, wish, max, miss, meta};
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
function renderSeries() {
  const S = seriesGroups(), el = $('#v-series');
  if (!S.length) { el.innerHTML = '<div class="empty">Aucune série détectée.<br>Renseigne « Série » et « Tome » dans les fiches (le scan le fait automatiquement pour les BD et mangas).</div>'; return; }
  const totalMiss = S.reduce((a, s) => a + s.miss.filter(v => !s.wish.has(v)).length, 0);
  el.innerHTML = `<div class="stats"><div class="stat"><b>${S.length}</b><span>séries</span></div><div class="stat"><b>${S.filter(s => !s.miss.length).length}</b><span>complètes</span></div><div class="stat g"><b>${S.reduce((a, s) => a + s.miss.length, 0)}</b><span>tomes manquants</span></div><div class="stat"><b>${books.filter(b => b.wish).length}</b><span>souhaits</span></div>
    <div style="display:flex;gap:8px;align-items:center;margin-left:auto;flex-wrap:wrap"><button class="btn s" id="srAI">Nombre de tomes parus (IA)</button><button class="btn g" id="srAllWish" ${totalMiss ? '' : 'disabled'}>Tous les manquants → souhaits (${totalMiss})</button></div></div>
    <p class="hint" style="margin-top:-6px">Clic sur un tome manquant (gris) : ajout à la liste de souhaits. Il apparaît alors en « livre fantôme » à sa place sur l'étagère.</p>
    <div class="sgrid">${S.map(s => { const pct = Math.round(s.own.size / s.max * 100);
      return `<div class="scard"><div class="sh"><div><b>${esc(s.name)}</b><div class="hint">${esc(s.author)} · ${s.meta.total ? `${s.meta.total} tomes parus${s.meta.status ? ' · ' + esc(s.meta.status) : ''} <i>(IA)</i>` : 'total inconnu'}</div></div><span class="pc">${s.own.size}/${s.max}</span></div>
        <div class="pbar"><i style="width:${pct}%"></i></div>
        <div class="vols">${Array.from({length: s.max}, (_, k) => { const v = k + 1, ob = s.items.find(b => b.volume === v && !b.wish), wb = s.items.find(b => b.volume === v && b.wish);
          return ob ? `<span class="vol own" data-open="${ob.id}" title="Tome ${v} – ${esc(ob.title)}" style="background:${colOf(ob)};color:${txtCol(colOf(ob))}">${v}</span>`
            : wb ? `<span class="vol wish" data-open="${wb.id}" title="Tome ${v} – dans ta liste de souhaits">${v}</span>`
            : `<span class="vol miss" data-addwish="${esc(s.key)}|${v}" title="Tome ${v} manquant – clic : ajouter aux souhaits">${v}</span>`; }).join('')}</div>
        ${s.miss.length ? `<div class="hint" style="margin-top:6px">Manquants : ${s.miss.slice(0, 25).join(', ')}${s.miss.length > 25 ? '…' : ''}</div>` : `<div class="hint" style="margin-top:6px;color:var(--ok)">Série complète${s.meta.total ? '' : ' (d\'après tes tomes)'}</div>`}</div>`; }).join('')}</div>`;
}
async function addWish(key, v, batch = false) {
  const s = seriesGroups().find(x => x.key === key); if (!s || s.own.has(v) || s.wish.has(v)) return;
  const lower = s.items.filter(b => b.volume && b.volume < v).sort((a, b) => b.volume - a.volume)[0], upper = s.items.filter(b => b.volume > v).sort((a, b) => a.volume - b.volume)[0];
  const ref = lower || upper || s.items[0];
  const b = newBook({title: `${s.name} – Tome ${v}`, series: s.name, volume: v, author: ref.author, type: ref.type, publisher: ref.publisher, wish: true, status: 'À lire',
    color: ref.color, thickness: ref.thickness, height: ref.height, hU: ref.hU, wU: ref.wU, caseId: ref.caseId || null, row: ref.row || 1, position: (ref.position || 0) + (lower ? .5 : -.5)});
  books.push(b); renumber(b.caseId, b.row);
  await DB.putMany('books', books.filter(x => x.caseId === b.caseId && (x.row || 1) === b.row));
  if (!batch) { if (!CAM.ghost) { CAM.ghost = true; localStorage.setItem('scanly_ghost', '1'); } renderAll(); toast(`Tome ${v} ajouté à ta liste de souhaits`); }
}
async function seriesAI() {
  const S = seriesGroups(); if (!S.length) return; const btn = $('#srAI'); btn.innerHTML = '<span class="spin"></span> Interrogation de l\'IA…';
  try {
    const out = await gemini([{text: `Pour chaque série (édition française), indique le nombre de tomes parus à ce jour et son statut. Si tu ne sais pas, mets null.
JSON : [{"i":0,"total":nombre,"statut":"en cours|terminée"}]
Séries : ${JSON.stringify(S.map((s, i) => ({i, serie: s.name, auteur: s.author, type: s.items[0].type})))}`}], {json: true});
    let n = 0; (Array.isArray(out) ? out : out.series || []).forEach(o => { const s = S[o.i]; if (s && parseInt(o.total)) { SMETA[s.key] = {total: parseInt(o.total), status: o.statut || ''}; n++; } });
    localStorage.setItem('scanly_series', JSON.stringify(SMETA)); renderSeries(); toast(`${n} série(s) mise(s) à jour (estimation IA, à vérifier)`);
  } catch (e) { toast(e.message, 4000); btn.textContent = 'Nombre de tomes parus (IA)'; }
}
$('#v-series').onclick = async e => {
  const o = e.target.closest('[data-open]'); if (o) return openBook(o.dataset.open);
  const w = e.target.closest('[data-addwish]'); if (w) { const i = w.dataset.addwish.lastIndexOf('|'); return addWish(w.dataset.addwish.slice(0, i), +w.dataset.addwish.slice(i + 1)); }
  if (e.target.closest('#srAI')) return seriesAI();
  if (e.target.closest('#srAllWish')) {
    const todo = seriesGroups().flatMap(s => s.miss.filter(v => !s.wish.has(v)).map(v => [s.key, v])); if (!todo.length) return;
    if (todo.length > 20 && !confirm(`Ajouter ${todo.length} tomes manquants à ta liste de souhaits ?`)) return;
    for (const [k, v] of todo) await addWish(k, v, true);
    if (!CAM.ghost) { CAM.ghost = true; localStorage.setItem('scanly_ghost', '1'); }
    renderAll(); toast(`${todo.length} tome(s) ajouté(s) à ta liste de souhaits`);
  }
};

/* =====================================================================
   TABLEAU DE BORD
   ===================================================================== */
const PAL = ['#0B1F44', '#D4AF7C', '#64748B', '#2d4f86', '#b8915b', '#9fb0cc', '#7d2a33', '#2c5d4a', '#c9c2b0', '#4f3769'];
const countBy = (arr, f) => { const m = {}; arr.forEach(b => { const k = f(b); if (k != null && k !== '') m[k] = (m[k] || 0) + 1; }); return Object.entries(m).map(([l, v]) => ({l, v})).sort((a, b) => b.v - a.v); };
function barsSVG(data, {color = '#D4AF7C', fmt = v => v} = {}) {
  if (!data.length) return '<div class="hint">Pas encore de données</div>';
  const w = 380, max = Math.max(...data.map(d => d.v), 1), rh = 24, lw = 130, h = data.length * rh + 4;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w + 60}px">${data.map((d, i) => { const bw = (w - lw - 60) * d.v / max;
    return `<text x="${lw - 8}" y="${i * rh + 16}" text-anchor="end" font-size="12" fill="#334">${esc(String(d.l).slice(0, 20))}</text><rect x="${lw}" y="${i * rh + 5}" width="${Math.max(2, bw)}" height="${rh - 9}" rx="3" fill="${color}"/><text x="${lw + bw + 6}" y="${i * rh + 16}" font-size="11" fill="#64748B">${fmt(d.v)}</text>`; }).join('')}</svg>`;
}
function donutSVG(data) {
  if (!data.length) return '<div class="hint">Pas encore de données</div>';
  const tot = data.reduce((s, d) => s + d.v, 0), R = 62, r = 38, cx = 72, cy = 72; let a = -Math.PI / 2;
  const P = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)].map(n => n.toFixed(2));
  const arcs = data.length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${PAL[0]}" stroke-width="${R - r}"/>` : data.map((d, i) => {
    const a2 = a + 2 * Math.PI * d.v / tot, lg = a2 - a > Math.PI ? 1 : 0, [x1, y1] = P(a, R), [x2, y2] = P(a2, R), [x3, y3] = P(a2, r), [x4, y4] = P(a, r); a = a2;
    return `<path d="M${x1},${y1}A${R},${R} 0 ${lg} 1 ${x2},${y2}L${x3},${y3}A${r},${r} 0 ${lg} 0 ${x4},${y4}Z" fill="${PAL[i % PAL.length]}"/>`; }).join('');
  return `<div style="display:flex;gap:16px;align-items:center"><svg viewBox="0 0 144 144" width="144">${arcs}<text x="72" y="78" text-anchor="middle" font-size="20" font-weight="800" fill="#0B1F44">${tot}</text></svg><div>${data.map((d, i) => `<div class="hint" style="display:flex;align-items:center;gap:6px;margin:2px 0"><i style="width:10px;height:10px;border-radius:2px;background:${PAL[i % PAL.length]};display:inline-block"></i>${esc(d.l)} <b style="color:#0B1F44">${d.v}</b></div>`).join('')}</div></div>`;
}
function findDuplicates() {
  const m = new Map();
  books.filter(b => !b.wish && b.title).forEach(b => { const k = norm(b.title).replace(/\b(tome|t|vol|volume|n)\b/g, '').replace(/\s+/g, ' ').trim() + '|' + (b.volume || '') + '|' + norm(lastName(b)); if (!m.has(k)) m.set(k, []); m.get(k).push(b); });
  return [...m.values()].filter(g => g.length > 1).map(g => { const isb = new Set(g.map(b => String(b.isbn || '').replace(/\D/g, '')).filter(Boolean)), pub = new Set(g.map(b => norm(b.publisher)).filter(Boolean));
    return {kind: isb.size > 1 || pub.size > 1 ? 'edition' : 'doublon', items: g}; });
}
function dupGroupHTML(kind, items, why = '') {
  return `<div class="dupg"><span class="badge ${kind === 'doublon' ? 'k' : 'g'}">${kind === 'doublon' ? 'Doublon' : 'Éditions différentes'}</span>${why ? `<span class="hint"> ${esc(why)}</span>` : ''}
    ${items.map(b => `<div class="dupi"><b>${esc(b.title)}${b.volume ? ' – T' + b.volume : ''}</b><span class="hint">${esc(b.author || '')} · ${esc(b.publisher || 'éditeur ?')} · ${b.year || '—'} · ${b.isbn ? 'ISBN ' + esc(b.isbn) : 'sans ISBN'} · ${esc(locOf(b))}</span><span style="margin-left:auto;display:flex;gap:6px"><button class="btn s sm" data-open="${b.id}">Fiche</button><button class="btn k sm" data-del="${b.id}">Supprimer</button></span></div>`).join('')}</div>`;
}
function renderDash() {
  const own = books.filter(b => !b.wish), y = String(new Date().getFullYear()), val = own.reduce((s, b) => s + (Number(b.price) || 0), 0);
  const loans = own.filter(isLoaned).sort((a, b) => String(a.loanDue || '9').localeCompare(String(b.loanDue || '9'))), late = loans.filter(isLate), unk = own.filter(b => b.unknown);
  const readY = countBy(own.filter(b => b.readDate), b => b.readDate.slice(0, 4)).sort((a, b) => a.l.localeCompare(b.l));
  const dec = countBy(own.filter(b => b.year), b => Math.floor(b.year / 10) * 10 + 's').sort((a, b) => a.l.localeCompare(b.l));
  const valType = Object.entries(own.reduce((m, b) => { if (b.price) m[b.type || 'Autre'] = (m[b.type || 'Autre'] || 0) + Number(b.price); return m; }, {})).map(([l, v]) => ({l, v: Math.round(v)})).sort((a, b) => b.v - a.v);
  const S = seriesGroups(), dups = findDuplicates(), last = localStorage.getItem('scanly_lastsave');
  $('#v-dash').innerHTML = `<div class="stats">
      <div class="stat"><b>${own.length}</b><span>ouvrages</span></div>
      <div class="stat g"><b>${val ? Math.round(val).toLocaleString('fr-FR') + ' €' : '—'}</b><span>valeur estimée</span></div>
      <div class="stat"><b>${own.filter(b => b.status === 'Lu').length}</b><span>lus au total</span></div>
      <div class="stat"><b>${own.filter(b => (b.readDate || '').startsWith(y)).length}</b><span>lus en ${y}</span></div>
      <div class="stat"><b>${S.filter(s => !s.miss.length).length}/${S.length}</b><span>séries complètes</span></div>
      <div class="stat ${unk.length ? 'k' : ''}"><b>${unk.length}</b><span>à identifier</span></div>
      <div class="stat ${late.length ? 'k' : ''}"><b>${loans.length}${late.length ? ` <small style="font-size:12px">(${late.length} en retard)</small>` : ''}</b><span>prêts en cours</span></div>
      <div class="stat"><b style="font-size:15px">${last ? new Date(last).toLocaleDateString('fr-FR') : 'jamais'}</b><span>dernière sauvegarde</span></div>
    </div>
    <div class="dgrid">
      ${unk.length ? `<div class="dcard wide"><h3>Livres à identifier (${unk.length})</h3><p class="hint">Tranches non lues par l'IA lors du scan : ouvre la fiche pour voir la photo de la tranche et compléter le titre (ou « Identifier avec l'IA »).</p><div style="display:flex;gap:6px;flex-wrap:wrap">${unk.map(b => `<button class="btn s sm" data-open="${b.id}" style="padding:4px">${b.spineImg ? `<img src="${spineURL(b)}" style="height:60px;max-width:26px;object-fit:cover;border-radius:2px">` : '?'}</button>`).join('')}</div></div>` : ''}
      <div class="dcard"><h3>Répartition par type</h3>${donutSVG(countBy(own, b => b.type || 'Autre'))}</div>
      <div class="dcard"><h3>Genres principaux</h3>${barsSVG(countBy(own, b => b.genre).slice(0, 8))}</div>
      <div class="dcard"><h3>Livres lus par année</h3>${barsSVG(readY, {color: '#0B1F44'})}<p class="hint">Basé sur la date « Lu le » (remplie automatiquement quand tu passes un livre en « Lu »).</p></div>
      <div class="dcard"><h3>Époque de publication</h3>${barsSVG(dec, {color: '#64748B'})}</div>
      <div class="dcard"><h3>Valeur estimée par type</h3>${barsSVG(valType, {fmt: v => v.toLocaleString('fr-FR') + ' €'})}</div>
      <div class="dcard"><h3>Auteurs les plus présents</h3>${barsSVG(countBy(own, b => (b.author || '').split(',')[0].trim() || null).slice(0, 8), {color: '#b8915b'})}</div>
      <div class="dcard wide"><h3>Prêts en cours (${loans.length})</h3>${loans.length ? `<table class="mini"><tr><th>Ouvrage</th><th>Prêté à</th><th>Depuis le</th><th>Retour prévu</th><th></th></tr>${loans.map(b => `<tr><td><b>${esc(b.title)}</b></td><td>${esc(b.loanTo || '—')}</td><td>${fmtD(b.loanDate)}</td><td style="${isLate(b) ? 'color:var(--ko);font-weight:700' : ''}">${fmtD(b.loanDue)}${isLate(b) ? ' – en retard' : ''}</td><td style="text-align:right"><button class="btn s sm" data-open="${b.id}">Fiche</button> <button class="btn g sm" data-ret="${b.id}">Rendu</button></td></tr>`).join('')}</table>` : '<p class="hint">Aucun prêt en cours. Pour prêter un livre : ouvre sa fiche et renseigne « Prêté à ».</p>'}</div>
      <div class="dcard wide"><h3>Doublons et éditions différentes</h3>${dups.length ? dups.map(g => dupGroupHTML(g.kind, g.items)).join('') : '<p class="hint">Aucun doublon évident (même titre, même auteur).</p>'}
        <div class="btns" style="margin-top:6px"><button class="btn s" id="dbAI">Analyse IA approfondie (traductions, rééditions, titres différents)</button></div><div style="margin-top:10px">${dupAIhtml}</div></div>
    </div>`;
}
async function dupAI() {
  const own = books.filter(b => !b.wish && b.title).slice(0, 600); if (own.length < 2) return toast('Pas assez d\'ouvrages'); $('#dbAI').innerHTML = '<span class="spin"></span> Analyse en cours…';
  try {
    const out = await gemini([{text: `Voici une bibliothèque (id | titre | auteur | éditeur | année | ISBN). Repère les ouvrages qui sont la MÊME œuvre : doublons exacts, éditions différentes (poche / grand format, réédition, intégrale), traductions ou titres légèrement différents. Ignore les tomes différents d'une même série.
JSON : [{"ids":["id1","id2"],"type":"doublon|edition","raison":"courte explication"}] (liste vide si rien).
${own.map(b => `${b.id} | ${b.title}${b.volume ? ' T' + b.volume : ''} | ${b.author || ''} | ${b.publisher || ''} | ${b.year || ''} | ${b.isbn || ''}`).join('\n')}`}], {json: true});
    const groups = (Array.isArray(out) ? out : out.groupes || []).map(g => ({...g, items: (g.ids || []).map(id => books.find(b => b.id === id)).filter(Boolean)})).filter(g => g.items.length > 1);
    dupAIhtml = `<div class="hint" style="margin-bottom:6px"><b>Résultat de l'analyse IA :</b></div>` + (groups.length ? groups.map(g => dupGroupHTML(g.type === 'doublon' ? 'doublon' : 'edition', g.items, g.raison)).join('') : '<p class="hint">L\'IA n\'a trouvé aucun autre doublon.</p>');
  } catch (e) { dupAIhtml = `<p class="hint">${esc(e.message)}</p>`; }
  renderDash();
}
$('#v-dash').onclick = async e => {
  const o = e.target.closest('[data-open]'); if (o) return openBook(o.dataset.open);
  const r = e.target.closest('[data-ret]'); if (r) { const b = books.find(x => x.id === r.dataset.ret); if (!b) return; returnLoan(b); await saveBook(b); renderAll(); return toast(`« ${b.title} » est revenu dans ta bibliothèque`); }
  const d = e.target.closest('[data-del]'); if (d) { const b = books.find(x => x.id === d.dataset.del); if (b) { dupAIhtml = ''; await deleteBooks([b.id], 'Doublon'); } return; }
  if (e.target.closest('#dbAI')) dupAI();
};
function returnLoan(b) { b.status = b.prevStatus && b.prevStatus !== 'Prêté' ? b.prevStatus : (b.readDate ? 'Lu' : 'À lire'); b.loanTo = ''; b.loanDate = ''; b.loanDue = ''; }

