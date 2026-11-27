/* =====================================================================
   SCANEBOOK V2.41 – DIDACTICIEL INTÉGRÉ
   Visite guidée pas à pas : chaque étape met en lumière un élément réel de
   l'écran et le grossit (zoom sur le détail ; dans la pièce 3D, la vue
   zoome vraiment sur une étagère). Proposé à l'ouverture tant qu'il n'a pas
   été terminé ou que « Ne plus proposer » n'est pas coché. Bouton « ? »
   dans l'en-tête pour le relancer à tout moment.
   Préférence locale : scanly_tuto41 = '' (à proposer) | 'done' | 'off'.
   ===================================================================== */
const TUTO41 = {i: 0, steps: [], el: null, scaled: null, view: null, key: 'scanly_tuto41'};
const tutoPref41 = () => { try { return localStorage.getItem(TUTO41.key) || ''; } catch (e) { return ''; } };
const tutoSet41 = v => { try { localStorage.setItem(TUTO41.key, v); } catch (e) {} };
function vis41(sel) {
  for (const s of [].concat(sel)) { const e = typeof s === 'function' ? s() : document.querySelector(s); if (!e) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) return e; }
  return null;
}
function steps41() {
  const touch = typeof IS_TOUCH !== 'undefined' && IS_TOUCH, hasBooks = typeof books !== 'undefined' && books.some(b => !b.wish);
  return [
    {t: 'Bienvenue dans SCANEBOOK', x: 'Votre bibliothèque en 3D, rangée comme chez vous. Ce guide vous montre l’essentiel en une minute.'},
    {t: 'La pièce 3D', x: touch ? 'Pincez avec deux doigts pour zoomer, glissez pour vous déplacer, touchez un livre pour ouvrir sa fiche.' : 'Molette pour zoomer, cliquer-glisser pour vous déplacer, clic sur un livre pour ouvrir sa fiche.',
      room: hasBooks, sel: hasBooks ? () => $('#unit .book') : '#viewport'},
    {t: 'Les numéros d’étagère', x: 'Chaque étagère porte son numéro, 1 = en haut. Touchez le rond pour son menu ; maintenez-le pour déplacer toute l’étagère.', grip: true, sel: '#unit .shgrip', need: true},
    {t: 'Vos meubles', x: 'Choisissez le meuble affiché, ou la vue d’ensemble de toute la bibliothèque.', sel: '#caseBar'},
    {t: 'Le décor', x: 'Changez l’ambiance de la pièce : salon, loft, grande bibliothèque…', sel: '#themeBar'},
    {t: 'Ajouter des livres', x: 'Photographiez une étagère : SCANEBOOK reconnaît les tranches. Vous pouvez aussi importer des photos, scanner des codes-barres, saisir un livre ou importer une liste.', sel: ['#tabs29 [data-tab="add"]', '#hScan', '#fabCam', '.fab']},
    {t: 'Rechercher', x: 'Un titre, un auteur, une série… La pièce montre aussitôt où se trouve le livre.', sel: '.hsearch'},
    {t: 'Assistant IA', x: 'Posez une question sur votre bibliothèque : recommandations, tomes manquants, où se trouve un livre… L’assistant peut ensuite montrer les livres dans la pièce.', sel: '#hAI'},
    {t: 'Les vues', x: 'Passez de la pièce 3D au catalogue, à la liste, aux séries ou au tableau de bord.', sel: ['#viewCompact19', '#viewSeg']},
    {t: 'Annuler, zoomer, ranger', x: '↶ annule, ↷ rétablit. « Comme sur les photos » remet chaque livre à sa place d’origine.', sel: '#camBar'},
    {t: 'Profil et paramètres', x: 'Langue, clé IA, synchronisation entre appareils et sauvegardes.', sel: ['#tabs29 [data-tab="me"]', '#hSet', '#hMenu']},
    {t: 'Ce guide, à tout moment', x: 'Touchez ce bouton « ? » pour revoir le guide quand vous voulez.', sel: '#hHelp41', last: true}
  ].filter(s => !s.need || vis41(s.sel));
}
function ui41() {
  let o = $('#tuto41'); if (o) return o;
  o = document.createElement('div'); o.id = 'tuto41'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
  o.innerHTML = `<div class="t41-sh" data-s="t"></div><div class="t41-sh" data-s="b"></div><div class="t41-sh" data-s="l"></div><div class="t41-sh" data-s="r"></div><div class="t41-hole"></div><div class="t41-card" tabindex="-1"><div class="t41-top"><span class="t41-n"></span><button type="button" class="t41-x" data-act41="close" aria-label="${T28('Fermer le guide')}">×</button></div>
    <h3 class="t41-t"></h3><p class="t41-x2"></p>
    <div class="t41-btns"><button type="button" class="btn s sm" id="t41A"></button><button type="button" class="btn g sm" id="t41B"></button></div>
    <label class="t41-off"><input type="checkbox" id="t41Off"> <span>${T28('Ne plus proposer ce guide à l’ouverture')}</span></label></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-act41]'); if (!b) return; const a = b.dataset.act41;
    if (a === 'next') go41(TUTO41.i + 1); else if (a === 'prev') go41(TUTO41.i - 1); else if (a === 'start') go41(1); else endTuto41(false);
  });
  o.querySelector('#t41Off').onchange = e => tutoSet41(e.target.checked ? 'off' : (TUTO41.done ? 'done' : ''));
  return o;
}
function unscale41() { const s = TUTO41.scaled; if (s) { s.el.style.transform = s.t; s.el.style.transformOrigin = s.o; s.el.style.transition = s.tr; s.el.style.zIndex = s.z; s.el.classList.remove('t41-zoom'); TUTO41.scaled = null; } }
function restoreView41() { const v = TUTO41.view; if (!v) return; TUTO41.view = null; // le guide ne change ni la vue ni l'angle choisis
  const {cam, camLS, ...rest} = v; Object.assign(VIEW, rest); CAM.view = cam; try { if (camLS == null) localStorage.removeItem('scanly_cam'); else localStorage.setItem('scanly_cam', camLS); } catch (e) {}
  try { applyView(); applyCam(); } catch (e) {} }
function place41(rect, pad) {
  const o = $('#tuto41'), hole = o.querySelector('.t41-hole'), card = o.querySelector('.t41-card'), W = innerWidth, H = innerHeight, m = 12;
  const sh = (k, l, t, w, h) => { const e = o.querySelector(`.t41-sh[data-s="${k}"]`); if (e) e.style.cssText = `left:${l}px;top:${t}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`; };
  if (!rect) { hole.style.cssText = 'display:none'; sh('t', 0, 0, W, H); sh('b', 0, H, W, 0); sh('l', 0, 0, 0, 0); sh('r', 0, 0, 0, 0); o.classList.add('t41-center'); card.style.left = card.style.top = ''; return; }
  o.classList.remove('t41-center');
  const x = Math.max(4, rect.left - pad), y = Math.max(4, rect.top - pad), w = Math.min(W - 8, rect.right + pad) - x, h = Math.min(H - 8, rect.bottom + pad) - y;
  hole.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${Math.min(18, h / 2)}px`;
  sh('t', 0, 0, W, y); sh('b', 0, y + h, W, H - y - h); sh('l', 0, y, x, h); sh('r', x + w, y, W - x - w, h);
  const cw = Math.min(360, W - 2 * m); card.style.width = cw + 'px'; const ch = card.offsetHeight || 200;
  let top = y + h + m >= H - ch - m ? y - ch - m : y + h + m; if (top < m) top = Math.max(m, Math.min(H - ch - m, y + h + m));
  if (top + ch > H - m && y - ch - m < m) top = Math.max(m, (H - ch) / 2); // élément très grand : carte centrée
  top = Math.max(m, Math.min(top, H - ch - m)); card.style.top = top + 'px'; card.style.left = Math.max(m, Math.min(W - cw - m, x + w / 2 - cw / 2)) + 'px';
}
async function go41(i) {
  const S = TUTO41.steps; if (i < 0) i = 0; if (i >= S.length) return endTuto41(true);
  unscale41(); TUTO41.i = i; const s = S[i], o = ui41(), card = o.querySelector('.t41-card');
  o.querySelector('.t41-n').textContent = i ? `${i} / ${S.length - 1}` : '';
  o.querySelector('.t41-t').textContent = T28(s.t); o.querySelector('.t41-x2').textContent = T28(s.x);
  const prev = o.querySelector('#t41A'), next = o.querySelector('#t41B');
  if (i === 0) { prev.dataset.act41 = 'close'; prev.textContent = T28('Plus tard'); next.dataset.act41 = 'start'; next.textContent = T28('Commencer la visite'); }
  else { prev.dataset.act41 = 'prev'; prev.textContent = T28('Précédent'); prev.disabled = i === 1; next.dataset.act41 = 'next'; next.textContent = T28(s.last ? 'Terminer' : 'Suivant'); }
  if (i === 0) prev.disabled = false;
  o.querySelector('#t41Off').checked = tutoPref41() === 'off'; o.classList.add('on'); // visible avant la mesure de la fiche
  let el = s.sel ? vis41(s.sel) : null;
  if ((s.room || s.grip) && $('#unit .book') && typeof zoomToBox === 'function') {
    // zoom réel de la pièce sur le détail (premiers livres de l'étagère 1, ou le rond et sa plaquette)
    if (!TUTO41.view) TUTO41.view = {...VIEW, cam: CAM.view, camLS: localStorage.getItem('scanly_cam')};
    try { const g = $('#unit .rowgrp'), els = s.grip ? [...(g ? g.querySelectorAll('.book') : [])].slice(0, 3) : [...$$('#unit .book')].slice(0, 6);
      const box = stageBox(els); if (s.grip) { box.x0 -= 90; box.y1 += 40; } zoomToBox(box, .8, s.grip ? .45 : .5); if (VIEW.z > 3) { VIEW.z = 3; const sc = VIEW.k * 3; VIEW.px = -((box.x0 + box.x1) / 2 - 768 * VIEW.R) * sc; VIEW.py = -((box.y0 + box.y1) / 2 - 512 * VIEW.R) * sc; applyView(); } applyCam(); } catch (e) { console.warn('SCANEBOOK guide', e); }
    await new Promise(r => setTimeout(r, 420)); el = vis41(s.sel);
    // petit écran : on dézoome par paliers jusqu'à voir le rond en entier
    for (let k = 0; s.grip && k < 6; k++) { const gr = el && el.getBoundingClientRect(); if (gr && gr.left >= 4 && gr.right <= innerWidth - 4) break;
      VIEW.z = Math.max(typeof zMin === 'function' ? zMin() : .2, VIEW.z * .78); applyView(); applyCam(); await new Promise(r => setTimeout(r, 120)); el = vis41(s.sel); }
    if (s.grip && !el) place41(null);
    else if (s.grip) { const a = el.getBoundingClientRect(), t = el.closest('.rowgrp')?.querySelector('.rowtag37')?.getBoundingClientRect(); place41(t ? {left: Math.min(a.left, t.left), top: Math.min(a.top, t.top), right: Math.max(a.right, t.right), bottom: Math.max(a.bottom, t.bottom)} : a, 10); }
    else { const L = [...$$('#unit .book')].slice(0, 6).map(b => b.getBoundingClientRect()).filter(r => r.width); place41(L.length ? {left: Math.min(...L.map(r => r.left)), top: Math.min(...L.map(r => r.top)), right: Math.max(...L.map(r => r.right)), bottom: Math.max(...L.map(r => r.bottom))} : null, 14); }
  } else {
    if (!s.room && !s.grip) restoreView41();
    if (el) { // zoom sur le détail : l'élément réel grossit dans le halo
      const r = el.getBoundingClientRect(), k = Math.max(1, Math.min(1.6, 220 / r.width, 96 / r.height));
      const ox = r.left < 60 ? 'left' : r.right > innerWidth - 60 ? 'right' : 'center', oy = r.top < 90 ? 'top' : r.bottom > innerHeight - 90 ? 'bottom' : 'center';
      if (k > 1.04 && !el.closest('#unit')) { TUTO41.scaled = {el, t: el.style.transform, o: el.style.transformOrigin, tr: el.style.transition, z: el.style.zIndex};
        el.style.transition = 'transform .35s cubic-bezier(.2,.8,.3,1)'; el.style.transformOrigin = `${ox} ${oy}`; el.style.transform = `scale(${k})`; el.classList.add('t41-zoom'); }
      const ax = ox === 'left' ? r.left : ox === 'right' ? r.right : (r.left + r.right) / 2, ay = oy === 'top' ? r.top : oy === 'bottom' ? r.bottom : (r.top + r.bottom) / 2, kk = TUTO41.scaled ? k : 1;
      place41({left: ax + (r.left - ax) * kk, right: ax + (r.right - ax) * kk, top: ay + (r.top - ay) * kk, bottom: ay + (r.bottom - ay) * kk}, 8);
    } else place41(null);
  }
  o.classList.add('on'); card.focus({preventScroll: true});
}
function running41(on) { try { if (on) sessionStorage.setItem('scanly_tuto41_run', '1'); else sessionStorage.removeItem('scanly_tuto41_run'); localStorage.setItem('scanly_tuto41_run', on ? String(Date.now()) : ''); } catch (e) {} }
function startTuto41() { running41(true);
  if ($('#modal')?.classList.contains('on')) try { closeModal(); } catch (e) {}
  if (document.body.classList.contains('search29')) $('#qClose29')?.click();
  if (!$('#v-lib')?.classList.contains('on')) try { setView('lib'); } catch (e) {}
  TUTO41.steps = steps41(); TUTO41.done = tutoPref41() === 'done'; go41(1);
}
function proposeTuto41() { running41(true); TUTO41.steps = steps41(); TUTO41.done = false; go41(0); }
function endTuto41(finished) { running41(false);
  unscale41(); restoreView41(); const o = $('#tuto41'); if (o) o.classList.remove('on');
  if (finished && tutoPref41() !== 'off') { tutoSet41('done'); TUTO41.done = true; }
}
function initAI42() {
  const ai = $('#hAI'), hs = $('header .hsearch'); if (!ai || !hs) return;
  if (hs.nextElementSibling !== ai) hs.after(ai); // juste à droite de la loupe / de la barre de recherche
  ai.classList.add('ai42'); ai.title = 'Assistant IA'; ai.setAttribute('aria-label', 'Assistant IA');
}
function initTuto41() { try { initAI42(); } catch (e) { console.warn('SCANEBOOK assistant', e); }
  if (!$('#hHelp41')) { const b = document.createElement('button'); b.type = 'button'; b.id = 'hHelp41'; b.className = 'hbtn help41'; b.title = 'Guide de SCANEBOOK'; b.setAttribute('aria-label', 'Guide de SCANEBOOK'); b.textContent = '?';
    const r = $('header .hright'); if (r) r.insertBefore(b, $('#hSync') || r.firstChild); b.onclick = e => { e.stopPropagation(); startTuto41(); }; }
  document.addEventListener('keydown', e => { const o = $('#tuto41'); if (!o || !o.classList.contains('on')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endTuto41(false); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go41(TUTO41.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go41(TUTO41.i - 1); } }, true);
  addEventListener('resize', () => { const o = $('#tuto41'); if (o && o.classList.contains('on')) { const i = TUTO41.i; setTimeout(() => go41(i), 250); } });
  try { if (localStorage.getItem('scanly_tuto41_run')) { localStorage.setItem('scanly_tuto41_run', ''); if (!tutoPref41()) tutoSet41('done'); } } catch (e) {} // fermé pendant le guide : on ne le repropose pas
  if (!tutoPref41()) setTimeout(() => { if (tutoPref41() || $('#modal')?.classList.contains('on') || $('#tuto41')?.classList.contains('on')) return; proposeTuto41(); }, 2500);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(initTuto41, 300)); else setTimeout(initTuto41, 300);
