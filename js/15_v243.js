// SCANEBOOK V2.43 : ouverture de l'assistant IA allégée (plantage Safari iPhone).
// Sur iPhone, Safari ferme la page (« Un problème récurrent est survenu ») quand il manque de mémoire.
// L'assistant s'ouvre en plein écran par-dessus la pièce 3D : on met la pièce en pause pendant ce temps
// (Safari libère alors ses images et ses couches 3D), et on n'ouvre plus le clavier tout seul.
const touch43 = (() => { try { return matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0; } catch (e) { return false; } })();
function aiFull43() { const d = $('#drawer'); return !!d && d.classList.contains('on') && d.offsetWidth >= innerWidth - 2; }
function pauseRoom43(on) { const was = document.body.classList.contains('ai43'); document.body.classList.toggle('ai43', !!on); if (was && !on) requestAnimationFrame(() => { try { applyView(); } catch (e) {} }); }
const openAI42 = openAI;
openAI = function () {
  const r = openAI42.apply(this, arguments);
  try {
    if (touch43) { const q = $('#aiQ'); if (q && document.activeElement === q) q.blur(); } // pas de clavier automatique
    pauseRoom43(aiFull43());
  } catch (e) { console.warn('SCANEBOOK assistant', e); }
  return r;
};
const closeDrawer42 = closeDrawer;
closeDrawer = function () { pauseRoom43(false); return closeDrawer42.apply(this, arguments); };
$('#dClose').onclick = () => closeDrawer(); $('#scrim').onclick = () => closeDrawer();
$('#hAI').onclick = () => openAI();
// filet de sécurité : dès que le tiroir se ferme (quel que soit le chemin), la pièce revient
try { new MutationObserver(() => { if (!$('#drawer').classList.contains('on')) pauseRoom43(false); }).observe($('#drawer'), {attributes: true, attributeFilter: ['class']}); } catch (e) {}
// pas de recalcul de la pièce pendant la pause (le clavier iPhone déclenche des « resize »)
const applyView42 = applyView;
applyView = function () { if (document.body.classList.contains('ai43')) return; return applyView42.apply(this, arguments); };
