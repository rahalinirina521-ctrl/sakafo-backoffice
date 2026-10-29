// Vues de l'application client.
import { html, useState, useEffect, useMemo } from '../lib.js?v=202610291451';
import { useApp, Badge, Modal, Field } from '../ui.js?v=202610291451';
import { tr, catName, platText, platTitle, fotLabel, ingName, unitLabel } from '../i18n.js?v=202610291451';
import { isoDate, addDays, menuRepas, platTotals, fmt, toNum, uid } from '../calc.js?v=202610291451';
import { analyse, typeObjectif, fmtDate } from '../conseil.js?v=202610291451';
import { ProfilFields, AnalysePanel, WeightChart } from '../conseil-ui.js?v=202610291451';
import { aboStatut, menuDuJour, listeCourses } from '../metier.js?v=202610291451';
import { MapView, hasPos, route, heure, fmtDuree } from '../map.js?v=202610291451';
import { STATUTS, CRENEAU_LABEL } from '../tournee.js?v=202610291451';
import { Chat } from '../chat.js?v=202610291451';
import { insertRow, updateRow, remove } from '../db.js?v=202610291451';
import { param } from '../params.js?v=202610291451';
import { AddressField } from '../address.js?v=202610291451';
import { Thumb } from '../pickers.js?v=202610291451';
import { pushPossible, etatPush, activerPush, desactiverPush } from '../push.js?v=202610291451';
import { CommunauteResume } from './reseau.js?v=202610291451';
import { IncidentBanner, incidentPour, AvisForm, AvisListe, Etoiles, moyenne } from './social.js?v=202610291451';

const t3 = (a) => tr(a[0], a[1], a[2]);
const today = () => isoDate(new Date());
export const objectifsVisibles = (data) => [...data.categories].filter((c) => c.statut !== 'attente').sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
const prenom = (n) => String(n || '').trim().split(/\s+/)[0] || '';

// ---------- Plat (détail) ----------
export function PlatModal({ plat, onClose, showCompo, client }) {
  const { data, ingMap } = useApp();
  const avisPlat = (data.avis || []).filter((a) => a.cible_type === 'plat' && a.cible_id === plat.id && !a.masque);
  const moy = moyenne(avisPlat);
  const [noter, setNoter] = useState(false);
  const t = platTotals(plat.id, data.composition, ingMap);
  const lines = data.composition.filter((c) => c.plat_id === plat.id).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const det = plat.details || {};
  const tags = [].concat(det.regimes || []).filter(Boolean);
  const allerg = [].concat(det.allergenes || []).filter(Boolean);
  return html`<${Modal} title=${platTitle(plat)} onClose=${onClose}>
    ${plat.image_url && html`<img class="plat-hero" src=${plat.image_url} alt=${platTitle(plat)} loading="lazy" />`}
    ${moy && html`<div class="row gap"><${Etoiles} note=${Math.round(moy)} size=${16} /><b>${fmt(moy, 1)}</b><small class="muted">(${avisPlat.length} ${tr('avis', 'reviews', 'hevitra')})</small></div>`}
    ${platText(plat, 'marketing') && html`<p>${platText(plat, 'marketing')}</p>`}
    ${tags.length > 0 && html`<div class="row gap wrap">${tags.map((x) => html`<${Badge} tone="ok">${x}<//>`)}</div>`}
    <div class="kpis small-kpis">
      <div class="kpi"><small>Kcal</small><b>${fmt(t.kcal)}</b></div>
      <div class="kpi"><small>${tr('Protéines', 'Protein', 'Proteinina')}</small><b>${fmt(t.proteines)} g</b></div>
      <div class="kpi"><small>${tr('Glucides', 'Carbs', 'Gliosida')}</small><b>${fmt(t.glucides)} g</b></div>
      <div class="kpi"><small>${tr('Lipides', 'Fat', 'Tavy')}</small><b>${fmt(t.lipides)} g</b></div>
      <div class="kpi"><small>${tr('Fibres', 'Fibre', 'Fibres')}</small><b>${fmt(t.fibres)} g</b></div>
    </div>
    ${platText(plat, 'avantages') && html`<p class="pre small">${platText(plat, 'avantages')}</p>`}
    ${allerg.length > 0 && html`<p class="small warn-text">⚠️ ${tr('Allergènes', 'Allergens', 'Allergènes')} : ${allerg.join(', ')}</p>`}
    ${showCompo ? html`<h3>🧺 ${tr('Ingrédients pour 1 personne', 'Ingredients for 1 person', 'Akora ho an\'olona 1')}</h3>
      <ul class="ing-list">${lines.map((l) => html`<li><b>${fmt(l.quantite, (+l.quantite) % 1 ? 1 : 0)} ${unitLabel(l.unite || 'g')}</b> ${ingName(ingMap.get(l.ingredient_id))}${l.note ? html` <span class="muted">(${l.note})</span>` : null}</li>`)}</ul>
      ${plat.nb && html`<p class="small muted">📝 ${plat.nb}</p>`}`
      : html`<p class="small muted">🔒 ${tr('Ingrédients détaillés et quantités réservés à la formule « Conseil ».', 'Detailed ingredients and quantities are for the "Coaching" plan.', 'Ho an\'ny formule « Conseil » ny antsipirian\'ny akora.')}</p>`}
    <h3>⭐ ${tr('Avis', 'Reviews', 'Hevitra')}</h3>
    <${AvisListe} avis=${avisPlat} data=${data} max=${4} />
    ${client && (noter ? html`<${AvisForm} client=${client} cible_type="plat" cible_id=${plat.id} onDone=${() => setNoter(false)} />` : html`<button class="btn" onClick=${() => setNoter(true)}>⭐ ${tr('Noter ce plat', 'Rate this dish', 'Hanome naoty')}</button>`)}
  <//>`;
}

function Repas({ data, menu, showCompo, onPlat }) {
  const { ingMap } = useApp();
  if (!menu) return html`<p class="muted small">${tr('Menu pas encore publié pour ce jour.', 'Menu not published yet for this day.', 'Mbola tsy navoaka ny menu androany.')}</p>`;
  return html`<div class="repas-list">${menuRepas(menu).filter((r) => r.plat_id).map((r) => {
    const p = data.plats.find((x) => x.id === r.plat_id); if (!p) return null;
    const t = platTotals(p.id, data.composition, ingMap);
    return html`<button class="repas-item" onClick=${() => onPlat(p)}><${Thumb} plat=${p} size=${56} /><span><small class="muted">${fotLabel(r.fotoana)}</small><b>${platTitle(p)}</b><small>${fmt(t.kcal)} kcal · P ${fmt(t.proteines)} g</small></span><span class="chev">›</span></button>`;
  })}</div>`;
}

// ---------- Accueil (tableau de bord) ----------
export function Accueil({ client, go }) {
  const app = useApp();
  const { data, ingMap } = app;
  const [plat, setPlat] = useState(null);
  const cat = data.categories.find((c) => c.id === client.categorie_id);
  const mesures = (data.mesures || []).filter((m) => m.client_id === client.id).sort((a, b) => a.date.localeCompare(b.date));
  const a = analyse(client.profil || {}, typeObjectif(cat), mesures);
  const abo = aboStatut(client);
  const mj = menuDuJour(data, client, today());
  const menu = data.menus.find((m) => m.id === mj.menu_id);
  const tot = menu ? menuRepas(menu).reduce((s, r) => { if (!r.plat_id) return s; const t = platTotals(r.plat_id, data.composition, ingMap); return { kcal: s.kcal + t.kcal, p: s.p + t.proteines }; }, { kcal: 0, p: 0 }) : null;
  const cibleKcal = toNum(client.kcal_cible) || a.kcal || toNum(cat?.kcal_cible);
  const p = client.profil || {};
  const depart = mesures.length ? +mesures[0].poids : toNum(p.poids_depart) || toNum(p.poids);
  const actuel = mesures.length ? +mesures[mesures.length - 1].poids : toNum(p.poids);
  const cible = toNum(p.poids_cible);
  const prog = depart && cible && actuel && depart !== cible ? Math.max(0, Math.min(1, (depart - actuel) / (depart - cible))) : null;
  const liv = (data.livraisons || []).filter((l) => l.date === today()).sort((x, y) => (x.statut === 'livree') - (y.statut === 'livree') || x.creneau.localeCompare(y.creneau))[0];
  const conseilJour = a.conseils?.length ? a.conseils[new Date().getDate() % a.conseils.length] : null;

  return html`<div class="c-page">
    <h1 class="hello">${tr('Bonjour', 'Hello', 'Manao ahoana')} ${prenom(client.nom)} 👋</h1>
    <p class="muted">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    ${!abo.actif && html`<div class="warn-box">${client.abonnement_fin ? tr('Votre abonnement est terminé.', 'Your subscription has ended.', 'Tapitra ny abonnement-nao.') : tr('Aucun abonnement actif.', 'No active subscription.', 'Tsy misy abonnement.')} <button class="link-btn" onClick=${() => go('/formules')}>${tr('Voir les formules →', 'See plans →', 'Jereo ny formules →')}</button></div>`}
    ${abo.actif && abo.jours <= 3 && html`<div class="warn-box">⏳ ${tr(`Votre abonnement se termine dans ${abo.jours} jour(s).`, `Your subscription ends in ${abo.jours} day(s).`, `Tapitra afaka ${abo.jours} andro ny abonnement-nao.`)} <button class="link-btn" onClick=${() => go('/messages')}>${tr('Renouveler', 'Renew', 'Havaozina')}</button></div>`}

    <section class="c-card goal-card clickable" onClick=${() => go('/programme')}>
      <div class="row between"><b>${cat?.icone || '🎯'} ${catName(cat)}</b><${Badge} tone=${abo.tone}>${client.formule === 'conseil' ? '📋 ' : '🛵 '}${abo.label}<//></div>
      ${actuel ? html`<div class="goal-nums"><div><small>${tr('Départ', 'Start', 'Fiandohana')}</small><b>${fmt(depart, 1)}</b></div><div class="big"><small>${tr('Actuel', 'Now', 'Ankehitriny')}</small><b>${fmt(actuel, 1)} kg</b></div><div><small>${tr('Objectif', 'Goal', 'Tanjona')}</small><b>${cible ? fmt(cible, 1) : '—'}</b></div></div>
        ${prog !== null && html`<div class="progress"><div style=${{ width: Math.round(prog * 100) + '%' }}></div></div><small class="muted">${Math.round(prog * 100)} % ${tr('du chemin', 'of the way', 'vita')}${a.tendance?.date ? ' · ' + tr('à ce rythme : ', 'at this pace: ', 'raha toy izao: ') + fmtDate(a.tendance.date) : a.prevision ? ' · ' + tr('prévu : ', 'forecast: ', 'vinavina: ') + fmtDate(a.prevision.date) : ''}</small>`}`
        : html`<p class="small">${tr('Complétez votre profil pour obtenir votre plan personnalisé.', 'Complete your profile to get your personal plan.', 'Fenoy ny momba anao mba hahazoana drafitra manokana.')} →</p>`}
      ${a.grossesse?.trimestre && html`<p class="small">🤰 ${a.verdict.titre}</p>`}
    </section>

    <section class="c-card">
      <div class="row between"><h2>🍽️ ${tr('Aujourd\'hui', 'Today', 'Androany')}</h2>${tot && cibleKcal ? html`<small class="muted">${fmt(tot.kcal)} / ${fmt(cibleKcal)} kcal</small>` : null}</div>
      ${tot && cibleKcal ? html`<div class="progress thin"><div style=${{ width: Math.min(100, Math.round((tot.kcal / cibleKcal) * 100)) + '%' }}></div></div>` : null}
      <${Repas} data=${data} menu=${menu} showCompo=${client.formule === 'conseil'} onPlat=${setPlat} />
      ${mj.perso === false && menu ? html`<small class="muted">${tr('Menu de votre objectif (adapté par notre équipe si besoin).', 'Your goal\'s menu (adjusted by our team if needed).', 'Menu an\'ny tanjonao.')}</small>` : null}
    </section>

    ${client.formule !== 'conseil' && liv && html`<section class="c-card clickable" onClick=${() => go('/livraison')}>
      <div class="row between"><h2>🛵 ${tr('Livraison', 'Delivery', 'Fanaterana')} · ${t3(CRENEAU_LABEL[liv.creneau] || [liv.creneau])}</h2><${Badge} tone=${STATUTS[liv.statut][3]}>${t3(STATUTS[liv.statut])}<//></div>
      ${liv.statut !== 'livree' && html`<${IncidentBanner} incident=${incidentPour(data, liv.livreur_id)} />`}
      ${liv.statut === 'en_route' && liv.eta ? html`<p class="eta-big">${tr('Arrivée vers', 'Arriving around', 'Ho tonga manodidina ny')} <b>${heure(liv.eta)}</b></p>` : liv.statut === 'livree' ? html`<p>✓ ${tr('Livré à', 'Delivered at', 'Tonga tamin\'ny')} ${heure(liv.livree_at)}</p>` : html`<p class="small muted">${tr('Suivez votre livreur en direct dès son départ.', 'Track your courier live once they leave.', 'Arahina mivantana ny mpitondra rehefa miainga.')}</p>`}
    </section>`}

    ${conseilJour && html`<section class="c-card tip">💡 <b>${tr('Conseil du jour', 'Tip of the day', 'Torohevitra androany')}</b><p>${conseilJour}</p></section>`}
    <${CommunauteResume} client=${client} />
    <div class="quick-row">
      <button class="btn" onClick=${() => go('/suivi')}>⚖️ ${tr('Me peser', 'Weigh in', 'Handanja')}</button>
      <button class="btn" onClick=${() => go('/messages')}>💬 ${tr('Écrire', 'Message', 'Hanoratra')}</button>
      <button class="btn" onClick=${() => go('/programme')}>📅 ${tr('Mon programme', 'My programme', 'Ny programako')}</button>
    </div>
    ${plat && html`<${PlatModal} plat=${plat} client=${client} onClose=${() => setPlat(null)} showCompo=${client.formule === 'conseil'} />`}
  </div>`;
}

// ---------- Menus de la semaine (+ liste de courses pour la formule conseil) ----------
export function MenusSemaine({ client }) {
  const { data, ingMap } = useApp();
  const [jour, setJour] = useState(today());
  const [plat, setPlat] = useState(null);
  const [courses, setCourses] = useState(false);
  const jours = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
  const menuDe = (d) => data.menus.find((m) => m.id === menuDuJour(data, client, d).menu_id);
  const conseil = client.formule === 'conseil';
  return html`<div class="c-page">
    <h1>📅 ${tr('Ma semaine', 'My week', 'Ny herinandroko')}</h1>
    <div class="day-strip">${jours.map((d) => { const x = new Date(d + 'T12:00:00'); return html`<button class=${'day' + (d === jour ? ' on' : '') + (menuDe(d) ? '' : ' empty')} onClick=${() => setJour(d)}><small>${x.toLocaleDateString('fr-FR', { weekday: 'short' })}</small><b>${x.getDate()}</b></button>`; })}</div>
    <section class="c-card"><${Repas} data=${data} menu=${menuDe(jour)} showCompo=${conseil} onPlat=${setPlat} /></section>
    ${conseil && html`<button class="btn primary big" onClick=${() => setCourses(true)}>🛒 ${tr('Liste de courses (7 jours)', 'Shopping list (7 days)', 'Lisitry ny entana (7 andro)')}</button>`}
    ${plat && html`<${PlatModal} plat=${plat} client=${client} onClose=${() => setPlat(null)} showCompo=${conseil} />`}
    ${courses && html`<${Courses} menus=${jours.map(menuDe).filter(Boolean)} onClose=${() => setCourses(false)} />`}
  </div>`;
}
export function Courses({ menus, onClose }) {
  const { data, ingMap, toast } = useApp();
  const [pers, setPers] = useState(1);
  const [coche, setCoche] = useState({});
  const list = listeCourses(data, menus, ingMap, pers);
  const qte = (x) => (x.pieces ? `${fmt(x.pieces, x.pieces % 1 ? 1 : 0)} ${tr('pièce(s)', 'piece(s)', 'isa')}` : x.grammes >= 1000 ? `${fmt(x.grammes / 1000, 1)} kg` : `${fmt(Math.ceil(x.grammes / 10) * 10)} g`);
  const texte = list.map((x) => `• ${ingName(x.ing)} : ${qte(x)}`).join('\n');
  return html`<${Modal} title=${'🛒 ' + tr('Liste de courses', 'Shopping list', 'Lisitry ny entana')} onClose=${onClose}>
    <div class="row gap"><span>${tr('Personnes', 'People', 'Olona')}</span><input type="number" min="1" max="12" value=${pers} onInput=${(e) => setPers(Math.max(1, +e.target.value || 1))} style="max-width:80px" /></div>
    ${list.length === 0 && html`<p class="muted">${tr('Aucun menu publié pour les 7 prochains jours : la liste apparaîtra dès que votre planning sera prêt.', 'No menu published for the next 7 days yet.', 'Mbola tsy misy menu navoaka ho an\'ny 7 andro ho avy.')}</p>`}
    <ul class="courses">${list.map((x) => html`<li class=${coche[x.ing.id] ? 'done' : ''} onClick=${() => setCoche({ ...coche, [x.ing.id]: !coche[x.ing.id] })}><input type="checkbox" checked=${!!coche[x.ing.id]} /> <span>${ingName(x.ing)}</span><b>${qte(x)}</b></li>`)}</ul>
    <div class="row gap wrap"><a class="btn" href=${'https://wa.me/?text=' + encodeURIComponent(texte)} target="_blank" rel="noopener">WhatsApp</a>
      <button class="btn ghost" onClick=${async () => { try { await navigator.clipboard.writeText(texte); toast(tr('Copié', 'Copied', 'Voadika')); } catch (e) { /* */ } }}>${tr('Copier', 'Copy', 'Adikao')}</button></div>
  <//>`;
}

// ---------- Livraison en direct ----------
export function LivraisonLive({ client }) {
  const { data } = useApp();
  const [tick, setTick] = useState(0);
  const [direct, setDirect] = useState(null);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const mes = (data.livraisons || []).filter((l) => l.client_id === client.id).sort((a, b) => b.date.localeCompare(a.date) || a.creneau.localeCompare(b.creneau));
  const auj = mes.filter((l) => l.date === today());
  const liv = auj.find((l) => l.statut === 'en_route') || auj.find((l) => l.statut === 'prevue') || auj[0];
  const lv = liv && (data.livreurs || []).find((x) => x.id === liv.livreur_id);
  const pos = liv && (data.positions || []).find((p) => p.livreur_id === liv.livreur_id);
  const dest = liv && hasPos(liv) ? liv : hasPos(client) ? client : null;
  const posKey = pos ? `${(+pos.lat).toFixed(3)},${(+pos.lng).toFixed(3)}` : '';
  useEffect(() => {
    if (!liv || liv.statut !== 'en_route' || !pos || !dest) { setDirect(null); return; }
    route([pos, dest], param(data, 'trafic')).then(setDirect).catch(() => setDirect(null));
  }, [posKey, liv?.statut, Math.floor(tick / 2)]);
  const etaMs = liv?.eta ? Date.parse(liv.eta) : direct ? Date.now() + direct.duration * 1000 : null;
  const minutes = etaMs ? Math.max(1, Math.round((etaMs - Date.now()) / 60000)) : null;
  const etapes = ['prevue', 'en_route', 'livree'];
  const idx = liv ? etapes.indexOf(liv.statut) : -1;
  return html`<div class="c-page">
    <h1>🛵 ${tr('Ma livraison', 'My delivery', 'Ny fanaterana')}</h1>
    ${!liv ? html`<section class="c-card"><p class="muted">${tr('Pas de livraison prévue aujourd\'hui.', 'No delivery planned today.', 'Tsy misy fanaterana androany.')}</p></section>` : html`
    <section class="c-card">
      <div class="steps">${etapes.map((e, i) => html`<div class=${'step' + (i <= idx ? ' done' : '') + (i === idx ? ' cur' : '')}><span>${i + 1}</span><small>${t3(STATUTS[e])}</small></div>`)}</div>
      ${liv.statut === 'en_route' && html`<div class="eta-box"><small>${tr('Votre repas arrive dans', 'Your meal arrives in', 'Ho tonga afaka')}</small><b>${minutes ? fmtDuree(minutes * 60) : '…'}</b><small>${etaMs ? tr('vers ', 'around ', 'manodidina ny ') + heure(etaMs) : ''}</small></div>`}
      ${liv.statut !== 'livree' && html`<${IncidentBanner} incident=${incidentPour(data, liv.livreur_id)} />`}
      ${liv.statut === 'livree' && html`<p class="ok-box">✓ ${tr('Livré à', 'Delivered at', 'Tonga tamin\'ny')} ${heure(liv.livree_at)}. ${tr('Bon appétit !', 'Enjoy your meal!', 'Mazotoa homana!')}</p>`}
      ${liv.statut === 'livree' && liv.livreur_id && client.id !== 'CL-DEMO' && html`<${AvisForm} client=${client} cible_type="livreur" cible_id=${liv.livreur_id} titre=${tr('Comment s\'est passée la livraison ?', 'How was the delivery?', 'Nahoana ny fanaterana?')} />`}
      ${liv.statut === 'prevue' && html`<p class="small muted">${tr(`Créneau ${t3(CRENEAU_LABEL[liv.creneau] || [liv.creneau]).toLowerCase()} · départ de la cuisine vers ${(param(data, 'departs') || {})[liv.creneau] || '—'}. La carte s'animera dès que le livreur partira.`, `${t3(CRENEAU_LABEL[liv.creneau] || [liv.creneau])} slot · leaves the kitchen around ${(param(data, 'departs') || {})[liv.creneau] || '—'}. The map goes live when the courier leaves.`, `Fotoana ${t3(CRENEAU_LABEL[liv.creneau] || [liv.creneau])} · miainga avy any an-dakozia manodidina ny ${(param(data, 'departs') || {})[liv.creneau] || '—'}.`)}</p>`}
      ${lv && html`<div class="row gap between wrap courier"><span>🛵 <b>${lv.nom}</b>${lv.vehicule ? html` <small class="muted">· ${lv.vehicule}</small>` : null}${pos ? html`<br/><small class="muted">${tr('position mise à jour', 'position updated', 'toerana navaozina')} ${heure(pos.updated_at)}</small>` : null}</span>
        <span class="row gap">${lv.telephone && html`<a class="btn small" href=${'tel:' + lv.telephone}>📞 ${tr('Appeler', 'Call', 'Antsoy')}</a>`}<a class="btn small" href=${'#/messages?c=livclient:' + client.id}>💬 ${tr('Écrire', 'Message', 'Hanoratra')}</a></span></div>`}
    </section>
    <${MapView} height=${340} fitKey=${liv.id + (pos ? 'p' : '')} line=${direct?.coords} markers=${[dest && { ...dest, icon: 'home', popup: tr('Chez vous', 'Your place', 'Any aminao') }, pos && liv.statut === 'en_route' && { ...pos, icon: 'moto', color: lv?.couleur, popup: lv?.nom }].filter(Boolean)} />
    ${!dest && html`<p class="warn-box small">📍 ${tr('Ajoutez votre position exacte dans « Profil » pour un suivi précis.', 'Add your exact location in "Profile" for precise tracking.', 'Ampio ny toerana misy anao ao amin\'ny « Profil ».')}</p>`}`}
    ${mes.length > 0 && html`<section class="c-card"><h2>${tr('Historique', 'History', 'Tantara')}</h2>
      <ul class="hist">${mes.slice(0, 20).map((l) => html`<li><span>${fmtDate(l.date)} · ${t3(CRENEAU_LABEL[l.creneau] || [l.creneau])}</span><${Badge} tone=${STATUTS[l.statut][3]}>${t3(STATUTS[l.statut])}${l.livree_at ? ' ' + heure(l.livree_at) : ''}<//></li>`)}</ul></section>`}
  </div>`;
}

// ---------- Suivi (poids, objectif, avis) ----------
export function Suivi({ client, onClient }) {
  const app = useApp();
  const { data, toast, setData, me } = app;
  const [f, setF] = useState({ date: today(), poids: '', tour_taille: '' });
  const mesures = (data.mesures || []).filter((m) => m.client_id === client.id).sort((a, b) => a.date.localeCompare(b.date));
  const cat = data.categories.find((c) => c.id === client.categorie_id);
  const a = analyse(client.profil || {}, typeObjectif(cat), mesures);
  async function peser() {
    const poids = toNum(f.poids); if (!poids) return;
    const row = { id: 'MS-' + uid(), client_id: client.id, date: f.date, poids, tour_taille: toNum(f.tour_taille), notes: null };
    try {
      await insertRow('mesures', row);
      setData((d) => ({ ...d, mesures: [...(d.mesures || []), row] }));
      if (f.date >= (mesures[mesures.length - 1]?.date || '')) { const profil = { ...(client.profil || {}), poids }; await updateRow('clients', client.id, { profil }); onClient({ ...client, profil }); }
      setF({ ...f, poids: '', tour_taille: '' });
      toast(tr('Pesée enregistrée 💪', 'Weigh-in saved 💪', 'Voatahiry 💪'));
    } catch (e) { toast(e.message, 'bad'); }
  }
  async function delMesure(m) {
    try { await remove('mesures', [m.id]); setData((d) => ({ ...d, mesures: d.mesures.filter((x) => x.id !== m.id) })); } catch (e) { toast(e.message, 'bad'); }
  }
  return html`<div class="c-page">
    <h1>📈 ${tr('Mon suivi', 'My progress', 'Ny fandrosoako')}</h1>
    <section class="c-card">
      <${WeightChart} mesures=${mesures} prevision=${a.prevision} cible=${client.profil?.poids_cible} />
      <div class="pesee">
        <input type="date" value=${f.date} max=${today()} onInput=${(e) => setF({ ...f, date: e.target.value })} />
        <input type="number" inputmode="decimal" step="0.1" placeholder=${tr('Poids (kg)', 'Weight (kg)', 'Lanja (kg)')} value=${f.poids} onInput=${(e) => setF({ ...f, poids: e.target.value })} />
        <input type="number" inputmode="decimal" step="0.5" placeholder=${tr('Tour de taille (cm)', 'Waist (cm)', 'Valahana (cm)')} value=${f.tour_taille} onInput=${(e) => setF({ ...f, tour_taille: e.target.value })} />
        <button class="btn primary" onClick=${peser}>+ ${tr('Ajouter', 'Add', 'Ampio')}</button>
      </div>
      <p class="tiny muted">${tr('Conseil : pesez-vous le matin à jeun, 1 fois par semaine, le même jour.', 'Tip: weigh yourself in the morning before eating, once a week, same day.', 'Torohevitra: mandanja isan-kerinandro, maraina alohan\'ny hisakafo.')}</p>
    </section>
    <a class="c-card clickable row between" href="#/programme"><span>🎯 <b>${catName(cat)}</b>${a.ok ? html` · ${fmt(toNum(client.kcal_cible) || a.kcal)} kcal/${tr('jour', 'day', 'andro')}` : null}</span><small>${tr('Modifier mon objectif →', 'Edit my goal →', 'Hanova ny tanjona →')}</small></a>
    ${a.tendance && html`<p class="small">📈 ${tr('Tendance réelle', 'Actual trend', 'Fandehany marina')} : <b>${a.tendance.rate > 0 ? '+' : ''}${fmt(a.tendance.rate, 1)} kg/${tr('semaine', 'week', 'herinandro')}</b>${a.tendance.date ? html` → ${tr('objectif vers le', 'goal around', 'tanjona manodidina ny')} <b>${fmtDate(a.tendance.date)}</b>` : null}</p>`}
    ${mesures.length > 0 && html`<section class="c-card"><h2>${tr('Historique des pesées', 'Weigh-in history', 'Tantaran\'ny lanja')}</h2>
      <ul class="hist">${[...mesures].reverse().map((m, i, arr) => { const prev = arr[i + 1]; const d = prev ? +m.poids - +prev.poids : null; return html`<li><span>${fmtDate(m.date)}</span><span><b>${fmt(m.poids, 1)} kg</b>${d !== null ? html` <small class=${d <= 0 ? 'ok-text' : 'warn-text'}>${d > 0 ? '+' : ''}${fmt(d, 1)}</small>` : null}${m.tour_taille ? html` · <small>${fmt(m.tour_taille, 1)} cm</small>` : null} <button class="link-btn small" onClick=${() => delMesure(m)}>✕</button></span></li>`; })}</ul></section>`}
  </div>`;
}

// ---------- Messages ----------
export function MessagesClient({ conversation }) {
  const app = useApp();
  const tel = param(app.data, 'telephone'); const wa = param(app.data, 'whatsapp');
  return html`<div class="c-page">
    <h1>💬 ${tr('Messages', 'Messages', 'Hafatra')}</h1>
    <p class="small muted">${tr('Notre équipe (et votre livreur le jour de la livraison) vous répond ici.', 'Our team (and your courier on delivery day) answers here.', 'Ny ekipanay (sy ny mpitondra amin\'ny andro fanaterana) no mamaly eto.')}</p>
    <${Chat} conversation=${conversation} messages=${app.data.messages || []} me=${app.me} height="calc(100vh - 290px)" onSend=${(t) => app.send(conversation, t).catch((e) => app.toast(e.message, 'bad'))} onRead=${app.markRead}
      quick=${[tr('Bonjour 👋', 'Hello 👋', 'Manao ahoana 👋'), tr('Je ne serai pas là, déposez au gardien SVP', 'I won\'t be home, please leave it with the guard', 'Tsy ao aho, apetraho amin\'ny mpiambina azafady'), tr('Merci !', 'Thank you!', 'Misaotra!')]} />
    ${(tel || wa) && html`<div class="row gap wrap" style="margin-top:8px">${tel && html`<a class="btn small ghost" href=${'tel:' + tel}>📞 ${tel}</a>`}${wa && html`<a class="btn small ghost" href=${'https://wa.me/' + wa.replace(/\D/g, '')} target="_blank" rel="noopener">WhatsApp</a>`}</div>`}
  </div>`;
}

// ---------- Notifications push (réactions, commentaires, amis, messages) ----------
function PushClient() {
  const { data, toast } = useApp();
  const [etat, setEtat] = useState('…');
  useEffect(() => { etatPush().then(setEtat).catch(() => setEtat('impossible')); }, []);
  async function basculer() {
    try {
      if (etat === 'actif') { await desactiverPush(); setEtat('inactif'); }
      else { await activerPush(data); setEtat('actif'); toast(tr('Notifications activées 🔔', 'Notifications enabled 🔔', 'Mandeha ny fampandrenesana 🔔')); }
    } catch (e) { toast(e.message, 'bad'); }
  }
  return html`<section class="c-card"><div class="row between wrap gap"><span>🔔 <b>${tr('Notifications sur ce téléphone', 'Notifications on this phone', 'Fampandrenesana amin\'ity finday ity')}</b><small class="muted d-block">${tr('Réactions, commentaires, demandes d\'ami…', 'Reactions, comments, friend requests…', 'Fihetseham-po, fanehoan-kevitra, namana…')}</small></span>
    ${etat === 'impossible' || !pushPossible() ? html`<small class="muted">${tr('Sur iPhone : ajoutez d\'abord l\'application à l\'écran d\'accueil.', 'On iPhone: add the app to the home screen first.', 'iPhone: ampidiro aloha amin\'ny écran d\'accueil.')}</small>`
      : etat === 'refuse' ? html`<small class="muted">${tr('Bloquées dans les réglages du navigateur', 'Blocked in browser settings', 'Voasakana ao amin\'ny navigateur')}</small>`
      : html`<button class=${'btn small' + (etat === 'actif' ? '' : ' primary')} onClick=${basculer}>${etat === 'actif' ? tr('Désactiver', 'Turn off', 'Ajanony') : tr('Activer', 'Turn on', 'Alefaso')}</button>`}</div></section>`;
}

// ---------- Profil ----------
export function Profil({ client, onClient, logout, lang, onLang, LangSwitch, moi, onMoi, compte }) {
  const { toast } = useApp();
  const [username, setUsername] = useState(moi?.username || '');
  async function saveUsername() {
    const u = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (u.length < 3) { toast(tr('3 caractères minimum', 'At least 3 characters', 'Litera 3 farafahakeliny'), 'bad'); return; }
    try { await updateRow('profils', moi.user_id, { username: u }); onMoi({ ...moi, username: u }); toast(tr(`Vous pouvez maintenant vous connecter avec « ${u} »`, `You can now sign in with "${u}"`, `Afaka miditra amin'ny « ${u} » ianao izao`)); }
    catch (e) { toast(/duplicate|unique/i.test(e.message) ? tr('Ce nom d\'utilisateur est déjà pris', 'This username is taken', 'Efa misy mampiasa') : e.message, 'bad'); }
  }
  const [f, setF] = useState({ nom: client.nom, telephone: client.telephone || '', adresse: client.adresse, repere: client.repere, lat: client.lat, lng: client.lng, maps_url: client.maps_url, allergies: client.allergies || '' });
  async function save() {
    try { await updateRow('clients', client.id, f); onClient({ ...client, ...f }); toast(tr('Profil enregistré', 'Profile saved', 'Voatahiry')); } catch (e) { toast(e.message, 'bad'); }
  }
  return html`<div class="c-page">
    <h1>👤 ${tr('Mon profil', 'My profile', 'Ny momba ahy')}</h1>
    <section class="c-card"><div class="form-grid">
      <${Field} label=${tr('Nom', 'Name', 'Anarana')}><input value=${f.nom} onInput=${(e) => setF({ ...f, nom: e.target.value })} /><//>
      <${Field} label=${tr('Téléphone', 'Phone', 'Finday')}><input type="tel" value=${f.telephone} onInput=${(e) => setF({ ...f, telephone: e.target.value })} /><//>
      ${client.formule !== 'conseil' && html`<${AddressField} value=${f} onChange=${(a) => setF({ ...f, ...a })} />`}
      <${Field} label=${tr('Allergies / aliments à éviter', 'Allergies / foods to avoid', 'Allergies / sakafo tsy tiana')} wide><input value=${f.allergies} onInput=${(e) => setF({ ...f, allergies: e.target.value })} /><//>
    </div><button class="btn primary" onClick=${save}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button></section>
    ${moi && client.id !== 'CL-DEMO' && html`<section class="c-card"><${Field} label=${tr('Nom d\'utilisateur (pour se connecter)', 'Username (to sign in)', 'Anarana mpampiasa (hidirana)')}><div class="row gap"><input value=${username} onInput=${(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} autocapitalize="none" /><button class="btn" onClick=${saveUsername}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button></div><//>
      <small class="muted">${tr('Vous pouvez aussi vous connecter avec votre e-mail.', 'You can also sign in with your e-mail.', 'Azonao ampiasaina koa ny mailakao.')}</small></section>`}
    ${client.id !== 'CL-DEMO' && html`<${PushClient} />`}
    <section class="c-card"><div class="row between wrap gap"><span>${tr('Langue', 'Language', 'Fiteny')}</span><${LangSwitch} lang=${lang} onChange=${onLang} /></div></section>
    ${compte || html`<section class="c-card"><button class="btn ghost" onClick=${logout}>${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button></section>`}
  </div>`;
}
