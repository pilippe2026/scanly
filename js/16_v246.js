/* =====================================================================
   SCANEBOOK V2.46 – VERSION VISIBLE PARTOUT
   Sur Mac / PC / iPad (pas d'onglet Profil), le numéro de version apparaît :
   - dans l'en-tête, sous le logo (à côté de « SCAN. SAVE. COLLECT. ») ;
   - tout en haut des Paramètres, sur tous les appareils.
   (Les corrections du menu d'étagère sont dans 02_piece.js et 06_demarrage.js.)
   ===================================================================== */
'use strict';
(function () {
  const tag = document.querySelector('header .brand .tag');
  if (tag && !tag.querySelector('.ver46')) tag.insertAdjacentHTML('beforeend', `<span class="ver46" data-no-i18n> · V${VERSION}</span>`);
  const brand = document.querySelector('header .brand'); if (brand) brand.title = 'SCANEBOOK V' + VERSION;
})();
{ const o = openSettings; openSettings = function () { const r = o.apply(this, arguments);
    const body = document.querySelector('#mbox .mbody'); if (body && !body.querySelector('.ver46p'))
      body.insertAdjacentHTML('afterbegin', `<p class="ver46p"><span>Version installée</span> <b data-no-i18n>SCANEBOOK V${VERSION}</b></p>`);
    return r; }; }
