/* =====================================================================
   SCANEBOOK V2.36 – REDRESSEMENT AUTOMATIQUE DES PHOTOS
   Avant la reconnaissance, chaque photo est redressée :
   - inclinaison (téléphone penché) : mesurée sur les bords verticaux des livres,
     contrôlée par les bords horizontaux des étagères ;
   - perspective (photo prise d'en bas ou d'en haut, livres « en trapèze ») :
     mesurée par la convergence des bords des livres, puis corrigée.
   La photo redressée remplace l'originale pour le détourage, la lecture et
   la photo d'origine enregistrée. Chaque tranche reste ensuite redressée
   individuellement (livres penchés) comme avant.
   ===================================================================== */
const LEVEL36 = {on: () => localStorage.getItem('scanly_level36') !== '0', set: v => localStorage.setItem('scanly_level36', v ? '1' : '0')};

/* ---------- mesure ---------- */
function measureLevel36(img) {
  const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height, k = Math.min(1, 900 / Math.max(W0, H0));
  const w = Math.max(16, Math.round(W0 * k)), h = Math.max(16, Math.round(H0 * k)), c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * .299 + d[j + 1] * .587 + d[j + 2] * .114;
  const STRIPS = 12, NB = 81, vh = Array.from({length: STRIPS}, () => new Float64Array(NB)), hh = new Float64Array(NB);   // histogrammes -20°…+20° par pas de 0,5°
  let vTot = 0, hTot = 0;
  for (let y = 2; y < h - 2; y++) for (let xx = 2; xx < w - 2; xx++) { const i = y * w + xx;
    const gx = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - 1] + g[i + w - 1]), gy = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - w] + g[i - w + 1]);
    const ax = Math.abs(gx), ay = Math.abs(gy);
    if (ax > 90 && ax > 2.7 * ay) { const t = Math.atan(-gy / gx) * 180 / Math.PI, b = Math.round((t + 20) * 2); if (b >= 0 && b < NB) { vh[Math.min(STRIPS - 1, Math.floor(xx / w * STRIPS))][b] += ax; vTot += ax; } }
    else if (ay > 90 && ay > 2.7 * ax) { const t = Math.atan(gx / gy) * 180 / Math.PI, b = Math.round((t + 20) * 2); if (b >= 0 && b < NB) { hh[b] += ay; hTot += ay; } } }
  const mode = H => { let bi = -1, bv = 0; for (let i = 0; i < NB; i++) { const v = (H[i - 2] || 0) + 2 * (H[i - 1] || 0) + 3 * H[i] + 2 * (H[i + 1] || 0) + (H[i + 2] || 0); if (v > bv) { bv = v; bi = i; } }
    if (bi < 0) return null; const a = H[bi - 1] || 0, b = H[bi], c2 = H[bi + 1] || 0, den = a - 2 * b + c2, off = den ? .5 * (a - c2) / den : 0; return {deg: (bi + CLv(off, -.5, .5)) / 2 - 20, w: bv}; };
  // bords verticaux : une mesure par bande verticale, puis droite tan(t) = a + b·x (moindres carrés pondérés, rejet des aberrants)
  let P = vh.map((H, s) => { const m = mode(H), tot = H.reduce((p, q) => p + q, 0); return m && tot > vTot / STRIPS * .25 ? {x: ((s + .5) / STRIPS - .5) * w, t: Math.tan(m.deg * Math.PI / 180), w: tot} : null; }).filter(Boolean);
  const fit = L => { let sw = 0, sx = 0, st = 0, sxx = 0, sxt = 0; L.forEach(p => { sw += p.w; sx += p.w * p.x; st += p.w * p.t; sxx += p.w * p.x * p.x; sxt += p.w * p.x * p.t; });
    const den = sw * sxx - sx * sx, b = L.length >= 4 && den ? (sw * sxt - sx * st) / den : 0, a = (st - b * sx) / sw; return {a, b}; };
  if (P.length < 3) return {roll: 0, keystone: 0, ok: false};
  let F = fit(P); for (let it = 0; it < 2; it++) { const r = P.map(p => Math.abs(p.t - (F.a + F.b * p.x))), lim = Math.max(.02, [...r].sort((p, q) => p - q)[Math.floor(r.length * .7)] * 2.2); const Q = P.filter((p, i) => r[i] <= lim); if (Q.length >= 3 && Q.length < P.length) { P = Q; F = fit(P); } }
  const vRoll = Math.atan(F.a) * 180 / Math.PI, hm = hTot > vTot * .15 ? mode(hh) : null;
  // l'inclinaison retenue : celle des livres, confirmée par les étagères quand elles sont nettes
  let roll = vRoll; if (hm && Math.abs(hm.deg - vRoll) < 2.5) roll = (vRoll * vTot + hm.deg * hTot) / (vTot + hTot);
  const keystone = F.b * k;   // tan(t) varie de « keystone » par pixel de la photo réelle
  const spread = Math.atan(Math.abs(keystone) * W0 / 2) * 180 / Math.PI;   // écart d'angle entre le centre et le bord
  return {roll, keystone, spread, ok: true, n: P.length};
}
const CLv = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- correction (une seule passe : perspective puis rotation, avec recadrage sans bord vide) ---------- */
function levelCanvas36(img, roll, keystone) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, cx = W / 2, cy = H / 2;
  const th = -roll * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), kk = keystone;
  // sortie -> entrée : p (centré) --K⁻¹--> m --rotation--> q
  const inv = (x, y) => { const den = 1 - kk * y, mx = x / den, my = y / den; return [mx * cs - my * sn + cx, mx * sn + my * cs + cy]; };
  const inside = (x, y) => { const [u, v] = inv(x, y); return u >= 0 && v >= 0 && u <= W - 1 && v <= H - 1; };
  // plus grand rectangle centré (même proportions) dont tout le bord tombe dans la photo
  let lo = .5, hi = 1; for (let it = 0; it < 18; it++) { const s = (lo + hi) / 2, hw = W * s / 2, hh = H * s / 2; let ok = true;
    for (let t = 0; t <= 1 && ok; t += .05) ok = inside(-hw + 2 * hw * t, -hh) && inside(-hw + 2 * hw * t, hh) && inside(-hw, -hh + 2 * hh * t) && inside(hw, -hh + 2 * hh * t);
    if (ok) lo = s; else hi = s; }
  const s = lo, ow = Math.round(W * s), oh = Math.round(H * s);
  const src = document.createElement('canvas'); src.width = W; src.height = H; const sx = src.getContext('2d', {willReadFrequently: true}); sx.drawImage(img, 0, 0);
  const sd = sx.getImageData(0, 0, W, H).data, out = document.createElement('canvas'); out.width = ow; out.height = oh;
  const ox = out.getContext('2d'), od = ox.createImageData(ow, oh), o = od.data;
  for (let v = 0; v < oh; v++) { const y = v - oh / 2 + .5;
    for (let u = 0; u < ow; u++) { const [fx, fy] = inv(u - ow / 2 + .5, y), x0 = fx | 0, y0 = fy | 0, x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
      const i00 = (y0 * W + x0) * 4, i10 = (y0 * W + x1) * 4, i01 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4, j = (v * ow + u) * 4;
      for (let c = 0; c < 3; c++) o[j + c] = (sd[i00 + c] * (1 - ax) + sd[i10 + c] * ax) * (1 - ay) + (sd[i01 + c] * (1 - ax) + sd[i11 + c] * ax) * ay;
      o[j + 3] = 255; } }
  ox.putImageData(od, 0, 0); return out;
}
/* Redresse une photo (data URL). Ne touche à rien si elle est déjà droite ou si la mesure n'est pas fiable. */
async function autoLevel36(url) {
  try { const img = await srcToImg(url), m = measureLevel36(img);
    if (!m.ok) return {src: url, roll: 0, spread: 0, changed: false};
    // affinage : on corrige un aperçu réduit, on remesure, on cumule (la mesure brute sous-estime un peu les angles)
    if (Math.abs(m.roll) >= .4 || m.spread >= .8) {
      const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height, ps = Math.min(1, 1000 / Math.max(W0, H0)), pv = document.createElement('canvas');
      pv.width = Math.round(W0 * ps); pv.height = Math.round(H0 * ps); pv.getContext('2d').drawImage(img, 0, 0, pv.width, pv.height);
      let roll = m.roll, key = m.keystone;
      for (let it = 0; it < 3; it++) { const c = levelCanvas36(pv, roll, key / ps), r = measureLevel36(c); if (!r.ok) break;
        roll += r.roll; key += r.keystone * ps; if (Math.abs(r.roll) < .15 && r.spread < .3) break; }
      m.roll = roll; m.keystone = key; m.spread = Math.atan(Math.abs(key) * W0 / 2) * 180 / Math.PI; }
    const doRoll = Math.abs(m.roll) >= .6 && Math.abs(m.roll) <= 15, doKey = m.spread >= 1.2 && m.spread <= 14;
    if (!doRoll && !doKey) return {src: url, roll: m.roll, spread: m.spread, changed: false};
    const c = levelCanvas36(img, doRoll ? m.roll : 0, doKey ? m.keystone : 0);
    if (c.width < (img.naturalWidth || img.width) * .6) return {src: url, roll: m.roll, spread: m.spread, changed: false};   // trop de recadrage : on garde l'original
    return {src: c.toDataURL('image/jpeg', .92), roll: doRoll ? m.roll : 0, spread: doKey ? m.spread : 0, changed: true};
  } catch (e) { console.warn('SCANEBOOK redressement', e); return {src: url, roll: 0, spread: 0, changed: false}; }
}
async function levelAll36(list, say) {
  const done = []; for (let i = 0; i < list.length; i++) { say && say(i, list.length); const r = await autoLevel36(list[i]); list[i] = r.src; if (r.changed) done.push(r); }
  if (done.length) { const parts = done.map(r => [Math.abs(r.roll) >= .6 ? `inclinaison ${Math.abs(r.roll).toFixed(1).replace('.', ',')}°` : '', r.spread ? 'perspective' : ''].filter(Boolean).join(' + '));
    toast(done.length === 1 ? `↻ 1 photo(s) redressée(s) : ${parts[0]}` : `↻ ${done.length} photo(s) redressée(s)`, 4500); }
  return done.length;
}

/* ---------- branchement : scan d'étagère et mise à jour d'étagère ---------- */
{ const o = analyze; analyze = async function () {
    if (LEVEL36.on() && shots.length) { const m = $('#sMsg'); await levelAll36(shots, (i, n) => { if (m) m.innerHTML = `<span class="spin"></span> Redressement des photos ${i + 1}/${n}…`; }); if (typeof renderShots === 'function') renderShots(); }
    return o.apply(this, arguments); }; }
{ const o = analyse34; analyse34 = async function () {
    if (LEVEL36.on() && UPD34.shots.length) { const m = $('#sMsg'); await levelAll36(UPD34.shots, (i, n) => { if (m) m.innerHTML = `<span class="spin"></span> Redressement des photos ${i + 1}/${n}…`; }); shots34(); }
    return o.apply(this, arguments); }; }
{ const o = openScan; openScan = function () { const r = o.apply(this, arguments); const mg = $('#sMerge')?.closest('label');
    if (mg && !$('#sLevel36')) { mg.insertAdjacentHTML('afterend', `<label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="sLevel36" style="accent-color:var(--navy)" ${LEVEL36.on() ? 'checked' : ''}> Redresser automatiquement les photos (inclinaison et perspective)</label>`);
      $('#sLevel36').onchange = e => LEVEL36.set(e.target.checked); }
    return r; }; }
{ const o = openShelfUpdate34; openShelfUpdate34 = function () { const r = o.apply(this, arguments); const md = $('#u34Mode');
    if (md && !$('#u34Level36')) { md.insertAdjacentHTML('afterend', `<label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="u34Level36" ${LEVEL36.on() ? 'checked' : ''}> Redresser automatiquement les photos (inclinaison et perspective)</label>`);
      $('#u34Level36').onchange = e => LEVEL36.set(e.target.checked); }
    return r; }; }
