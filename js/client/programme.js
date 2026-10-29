// Espace client « personnalisé » : accueil résumé (avant abonnement), onglet Programme (objectif + calendrier),
// et page Formules (livraison ou prescription sans livraison, compte démo).
import { html, useState } from '../lib.js?v=202610291423';
import { useApp, Badge, Field } from '../ui.js?v=202610291423';
import { tr, catName, platTitle, fotLabel } from '../i18n.js?v=202610291423';
import { isoDate, addDays, menuRepas, platTotals, fmt, toNum } from '../calc.js?v=202610291423';
import { analyse, typeObjectif, fmtDate } from '../conseil.js?v=202610291423';
import { ProfilFields, AnalysePanel } from '../conseil-ui.js?v=202610291423';
import { aboStatut, menuDuJour } from '../metier.js?v=202610291423';
import { updateRow } from '../db.js?v=202610291423';
import { param } from '../params.js?v=202610291423';
import { Thumb } from '../pickers.js?v=202610291423';
import { PlatModal, objectifsVisibles, Courses } from './vues.js?v=202610291423';

const today = () => isoDate(new Date());
const prenom = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const go = (p) => { location.hash = '#' + p; };

// Un client « a un objectif » dès qu'il a enregistré son poids (le type d'objectif est toujours rempli).
export const aObjectif = (client) => !!(client && toNum(client.profil?.poids));
export const MODES = () => ({
  livraison: { icone: '🛵', nom: tr('Livraison', 'Delivery', 'Fanaterana'), sous: tr('On cuisine et on vous livre', 'We cook and deliver', 'Izahay no mahandro sy manatitra') },
  conseil: { icone: '📋', nom: tr('Prescription', 'Meal plan', 'Torolalana sakafo'), sous: tr('Vous cuisinez vous-même', 'You cook yourself', 'Ianao no mahandro') },
});

function useObjectif(client) {
  const { data } = useApp();
  const cat = data.categories.find((c) => c.id === client.categorie_id);
  const mesures = (data.mesures || []).filter((m) => m.client_id === client.id).sort((a, b) => a.date.localeCompare(b.date));
  const a = analyse(client.profil || {}, typeObjectif(cat), mesures);
  const p = client.profil || {};
  const depart = mesures.length ? +mesures[0].poids : toNum(p.poids_depart) || toNum(p.poids);
  const actuel = mesures.length ? +mesures[mesures.length - 1].poids : toNum(p.poids);
  const cible = toNum(p.poids_cible);
  const prog = depart && cible && actuel && depart !== cible ? Math.max(0, Math.min(1, (depart - actuel) / (depart - cible))) : null;
  const dateFin = a.tendance?.date || a.prevision?.date || p.date_cible || null;
  return { cat, mesures, a, depart, actuel, cible, prog, dateFin };
}

// ---------- Carte résumé de l'objectif ----------
export function ObjectifResume({ client, onClick, compact }) {
  const { cat, a, depart, actuel, cible, prog, dateFin } = useObjectif(client);
  const abo = aboStatut(client);
  const M = MODES()[client.formule === 'conseil' ? 'conseil' : 'livraison'];
  return html`<section class=${'c-card goal-card' + (onClick ? ' clickable' : '')} onClick=${onClick}>
    <div class="row between"><b>${cat?.icone || '🎯'} ${catName(cat)}</b>${abo.actif ? html`<${Badge} tone=${abo.tone}>${M.icone} ${abo.label}<//>` : html`<${Badge} tone="warn">${tr('Pas encore abonné', 'Not subscribed yet', 'Mbola tsy misoratra')}<//>`}</div>
    ${actuel ? html`<div class="goal-nums"><div><small>${tr('Départ', 'Start', 'Fiandohana')}</small><b>${fmt(depart, 1)}</b></div><div class="big"><small>${tr('Actuel', 'Now', 'Ankehitriny')}</small><b>${fmt(actuel, 1)} kg</b></div><div><small>${tr('Objectif', 'Goal', 'Tanjona')}</small><b>${cible ? fmt(cible, 1) : '—'}</b></div></div>
      ${prog !== null && html`<div class="progress"><div style=${{ width: Math.round(prog * 100) + '%' }}></div></div><small class="muted">${Math.round(prog * 100)} % ${tr('du chemin', 'of the way', 'vita')}${dateFin ? ' · ' + tr('objectif prévu le ', 'goal expected ', 'tanjona amin\'ny ') + fmtDate(dateFin) : ''}</small>`}`
      : html`<p class="small">${tr('Complétez votre profil pour obtenir votre plan personnalisé.', 'Complete your profile to get your personal plan.', 'Fenoy ny momba anao mba hahazoana drafitra manokana.')} →</p>`}
    ${!compact && a.ok && html`<div class="mini-kpis">
      <span><small>${tr('Calories / jour', 'Calories / day', 'Kcal / andro')}</small><b>${fmt(toNum(client.kcal_cible) || a.kcal)}</b></span>
      <span><small>${tr('Protéines / jour', 'Protein / day', 'Proteinina / andro')}</small><b>${a.macros.proteines} g</b></span>
      <span><small>${tr('Eau / jour', 'Water / day', 'Rano / andro')}</small><b>${fmt(a.macros.eau_l, 1)} L</b></span>
      <span><small>IMC</small><b>${fmt(a.imc, 1)}</b></span></div>`}
    ${a.verdict && !compact && html`<p class="small"><b>${a.verdict.titre}</b></p>`}
  </section>`;
}

// Liste des repas d'un menu (sans composition, sauf prescription)
export function RepasJour({ menu, onPlat, vide }) {
  const { data, ingMap } = useApp();
  if (!menu) return html`<p class="muted small">${vide || tr('Menu pas encore publié pour ce jour.', 'Menu not published yet for this day.', 'Mbola tsy navoaka ny menu androany.')}</p>`;
  return html`<div class="repas-list">${menuRepas(menu).filter((r) => r.plat_id).map((r) => {
    const p = data.plats.find((x) => x.id === r.plat_id); if (!p) return null;
    const t = platTotals(p.id, data.composition, ingMap);
    return html`<button class="repas-item" onClick=${() => onPlat(p)}><${Thumb} plat=${p} size=${56} /><span><small class="muted">${fotLabel(r.fotoana)}</small><b>${platTitle(p)}</b><small>${fmt(t.kcal)} kcal · P ${fmt(t.proteines)} g</small></span><span class="chev">›</span></button>`;
  })}</div>`;
}
const totalMenu = (data, menu, ingMap) => (menu ? menuRepas(menu).reduce((s, r) => { if (!r.plat_id) return s; const t = platTotals(r.plat_id, data.composition, ingMap); return { kcal: s.kcal + t.kcal, p: s.p + t.proteines }; }, { kcal: 0, p: 0 }) : null);

// ---------- Accueil avant abonnement (le client a déjà un objectif) ----------
export function AccueilDecouverte({ client }) {
  const { data, ingMap } = useApp();
  const [plat, setPlat] = useState(null);
  const { a } = useObjectif(client);
  const menu = data.menus.find((m) => m.id === menuDuJour(data, client, today()).menu_id);
  const tot = totalMenu(data, menu, ingMap);
  const conseilJour = a.conseils?.length ? a.conseils[new Date().getDate() % a.conseils.length] : null;
  const fini = !!client.abonnement_fin;
  return html`<div class="c-page">
    <h1 class="hello">${tr('Bonjour', 'Hello', 'Manao ahoana')} ${prenom(client.nom)} 👋</h1>
    <p class="muted">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <div class="info-box">${fini ? tr('Votre abonnement est terminé : renouvelez-le pour retrouver vos repas et votre suivi complet.', 'Your subscription has ended: renew it to get your meals and full follow-up back.', 'Tapitra ny abonnement-nao: havaozy mba hahazoana indray ny sakafo sy ny fanaraha-maso.')
      : tr('Votre programme est prêt ✨ Choisissez votre formule pour le démarrer.', 'Your programme is ready ✨ Choose your plan to start it.', 'Vonona ny programa-nao ✨ Misafidiana formule hanombohana azy.')} <a class="link-btn" href="#/formules">${tr('Voir les formules →', 'See plans →', 'Jereo ny formules →')}</a></div>
    <${ObjectifResume} client=${client} onClick=${() => go('/programme')} />
    <section class="c-card">
      <div class="row between"><h2>🍽️ ${tr('Vos repas du jour', 'Your meals today', 'Ny sakafonao androany')}</h2>${tot && a.kcal ? html`<small class="muted">${fmt(tot.kcal)} / ${fmt(toNum(client.kcal_cible) || a.kcal)} kcal</small>` : null}</div>
      <${RepasJour} menu=${menu} onPlat=${setPlat} vide=${tr('Le menu de votre objectif sera publié très bientôt.', 'Your goal\'s menu will be published very soon.', 'Havoaka tsy ho ela ny menu an\'ny tanjonao.')} />
      <a class="link-btn small" href="#/programme">📅 ${tr('Voir toute la semaine →', 'See the whole week →', 'Jereo ny herinandro →')}</a>
    </section>
    ${conseilJour && html`<section class="c-card tip">💡 <b>${tr('Conseil du jour', 'Tip of the day', 'Torohevitra androany')}</b><p>${conseilJour}</p></section>`}
    <section class="c-card"><h2>${tr('Comment voulez-vous suivre ce programme ?', 'How do you want to follow this programme?', 'Ahoana no tianao hanarahana ity programa ity?')}</h2>
      <div class="mode-grid">${Object.entries(MODES()).map(([k, M]) => html`<a class="mode-card" href=${'#/formules?mode=' + k}><span>${M.icone}</span><b>${M.nom}</b><small>${M.sous}</small></a>`)}</div></section>
    <div class="quick-row"><a class="btn" href="#/programme">🎯 ${tr('Mon programme', 'My programme', 'Ny programako')}</a><a class="btn" href="#/messages">💬 ${tr('Écrire à l\'équipe', 'Message the team', 'Hanoratra')}</a></div>
    ${plat && html`<${PlatModal} plat=${plat} client=${client} onClose=${() => setPlat(null)} showCompo=${false} />`}
  </div>`;
}

// ---------- Programme : résumé de l'objectif + calendrier ----------
export function Programme({ client, onClient, abonne }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const { a, mesures } = useObjectif(client);
  const [edit, setEdit] = useState(false);
  const [prof, setProf] = useState(client.profil || {});
  const [catId, setCatId] = useState(client.categorie_id);
  const [jour, setJour] = useState(today());
  const [plat, setPlat] = useState(null);
  const [courses, setCourses] = useState(false);
  const abo = aboStatut(client);
  const conseil = client.formule === 'conseil';
  const nbJours = abonne ? 14 : 7;
  const OUVERTS = 3; // jours visibles avant abonnement
  const jours = Array.from({ length: nbJours }, (_, i) => addDays(today(), i));
  const menuDe = (d) => data.menus.find((m) => m.id === menuDuJour(data, client, d).menu_id);
  const idx = jours.indexOf(jour);
  const verrou = !abonne && idx >= OUVERTS;
  const menu = verrou ? null : menuDe(jour);
  const tot = totalMenu(data, menu, ingMap);
  const editCat = data.categories.find((c) => c.id === catId);
  const aEdit = edit ? analyse(prof, typeObjectif(editCat), mesures) : null;

  async function saveDate(patch) {
    try {
      const profil = { ...(client.profil || {}), ...patch };
      await updateRow('clients', client.id, { profil }); onClient({ ...client, profil });
      toast(patch.date_cible ? tr('Nouvelle date enregistrée ✓', 'New date saved ✓', 'Voatahiry ny daty vaovao ✓') : tr('C\'est noté, nous gardons votre date', 'Noted, we keep your date', 'Voaray, tazoninay ny datinao'));
    } catch (e) { toast(e.message, 'bad'); }
  }
  async function saveObj() {
    try {
      const profil = { ...prof, poids_depart: prof.poids_depart || client.profil?.poids_depart || prof.poids };
      await updateRow('clients', client.id, { profil, categorie_id: catId });
      onClient({ ...client, profil, categorie_id: catId });
      const a2 = analyse(profil, typeObjectif(editCat), mesures);
      if (abonne) await app.send('client:' + client.id, `📝 ${tr('Objectif mis à jour', 'Goal updated', 'Tanjona novaina')} : ${catName(editCat)}${profil.poids_cible ? ' → ' + profil.poids_cible + ' kg' : ''}${profil.date_cible ? ' (' + fmtDate(profil.date_cible) + ')' : ''}. ${a2.verdict ? a2.verdict.titre : ''}`).catch(() => {});
      setEdit(false); toast(tr('Objectif enregistré', 'Goal saved', 'Voatahiry ny tanjona'));
    } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="c-page">
    <h1>🎯 ${tr('Mon programme', 'My programme', 'Ny programako')}</h1>
    <${ObjectifResume} client=${client} />
    ${abonne && html`<section class="c-card abo-line"><span>${MODES()[conseil ? 'conseil' : 'livraison'].icone} <b>${MODES()[conseil ? 'conseil' : 'livraison'].nom}</b> · ${client.abonnement_debut ? fmtDate(client.abonnement_debut) + ' → ' : ''}${fmtDate(client.abonnement_fin)}</span><${Badge} tone=${abo.tone}>${abo.label}<//></section>`}

    <section class="c-card">
      <div class="row between"><h2>📅 ${tr('Mon calendrier', 'My calendar', 'Ny tetiandroko')}</h2>${tot && a.kcal ? html`<small class="muted">${fmt(tot.kcal)} / ${fmt(toNum(client.kcal_cible) || a.kcal)} kcal</small>` : null}</div>
      <div class="day-strip">${jours.map((d, i) => { const x = new Date(d + 'T12:00:00'); const lock = !abonne && i >= OUVERTS; return html`<button class=${'day' + (d === jour ? ' on' : '') + (lock ? ' lock' : menuDe(d) ? '' : ' empty')} onClick=${() => setJour(d)}><small>${x.toLocaleDateString('fr-FR', { weekday: 'short' })}</small><b>${x.getDate()}</b>${lock ? html`<i>🔒</i>` : null}</button>`; })}</div>
      ${tot && a.kcal ? html`<div class="progress thin"><div style=${{ width: Math.min(100, Math.round((tot.kcal / (toNum(client.kcal_cible) || a.kcal)) * 100)) + '%' }}></div></div>` : null}
      ${verrou ? html`<div class="locked"><span>🔒</span><p>${tr('Les jours suivants sont visibles une fois votre formule choisie.', 'The following days are visible once you choose a plan.', 'Hita rehefa nisafidy formule ianao ireo andro manaraka.')}</p><a class="btn primary" href="#/formules">${tr('Choisir ma formule', 'Choose my plan', 'Hisafidy formule')}</a></div>`
        : html`<${RepasJour} menu=${menu} onPlat=${setPlat} />`}
      ${abonne && conseil && html`<button class="btn primary" onClick=${() => setCourses(true)}>🛒 ${tr('Liste de courses (7 jours)', 'Shopping list (7 days)', 'Lisitry ny entana (7 andro)')}</button>`}
    </section>

    <section class="c-card">
      <div class="row between"><h2>⚙️ ${tr('Mon objectif en détail', 'My goal in detail', 'Ny antsipirian\'ny tanjoko')}</h2>${!edit && client.id !== 'CL-DEMO' && html`<button class="btn small" onClick=${() => { setProf(client.profil || {}); setCatId(client.categorie_id); setEdit(true); }}>✏️ ${tr('Modifier', 'Edit', 'Ovaina')}</button>`}</div>
      ${edit ? html`<${Field} label=${tr('Objectif', 'Goal', 'Tanjona')}><select value=${catId || ''} onChange=${(e) => setCatId(e.target.value)}>${objectifsVisibles(data).map((c) => html`<option value=${c.id}>${c.icone || ''} ${catName(c)}</option>`)}</select><//>
        <${ProfilFields} profil=${prof} type=${typeObjectif(editCat)} onChange=${setProf} />
        <${AnalysePanel} a=${aEdit} onDate=${(patch) => setProf({ ...prof, ...patch })} />
        <div class="row gap"><button class="btn primary" onClick=${saveObj}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button><button class="btn ghost" onClick=${() => setEdit(false)}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button></div>`
        : html`<details open=${a.verdict?.niveau === 'note' && !a.verdict.vu}><summary>${tr('Voir l\'analyse complète', 'See full analysis', 'Jereo ny fanadihadiana feno')}</summary><${AnalysePanel} a=${a} showRefs onDate=${client.id !== 'CL-DEMO' ? saveDate : null} /></details>`}
    </section>
    ${!abonne && html`<a class="btn primary big" href="#/formules">💳 ${tr('Démarrer mon programme', 'Start my programme', 'Hanomboka ny programako')}</a>`}
    ${plat && html`<${PlatModal} plat=${plat} client=${client} onClose=${() => setPlat(null)} showCompo=${abonne && conseil} />`}
    ${courses && html`<${Courses} menus=${jours.slice(0, 7).map(menuDe).filter(Boolean)} onClose=${() => setCourses(false)} />`}
  </div>`;
}

// ---------- Formules : livraison ou prescription, compte démo ----------
export function Formules({ me, conv, client, onClient, abonne, essayerDemo }) {
  const app = useApp();
  const { data, toast } = app;
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const [mode, setMode] = useState(q.get('mode') || client?.profil?.formule_souhaitee || '');
  const M = MODES();
  const offres = [...(data.offres || [])].filter((o) => o.actif !== false && (!mode || !o.mode || o.mode === mode))
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.nb_jours - b.nb_jours);
  const tel = param(data, 'telephone'); const wa = param(data, 'whatsapp');
  const estDemo = client?.id === 'CL-DEMO';
  const choisir = async (o) => {
    if (!me) { location.href = 'connexion.html?inscription'; return; }
    if (estDemo) { toast(tr('Compte démo : créez votre compte pour choisir une formule.', 'Demo account: create your account to choose a plan.', 'Kaonty démo: mamorona kaonty hisafidianana.'), 'bad'); return; }
    try {
      if (client) { const profil = { ...(client.profil || {}), formule_souhaitee: mode, offre_souhaitee: o.id }; await updateRow('clients', client.id, { profil }).catch(() => {}); onClient?.({ ...client, profil }); }
      await app.send(conv, `💳 ${tr('Je choisis la formule', 'I choose the plan', 'Ity formule ity no safidiko')} « ${o.nom} » (${o.nb_jours} ${tr('jour(s)', 'day(s)', 'andro')}${o.prix ? ', ' + fmt(o.prix) + ' Ar' : ''}) — ${M[mode].icone} ${M[mode].nom}.`);
      toast(tr('Demande envoyée : nous vous confirmons le paiement et la date de début.', 'Request sent: we will confirm payment and start date.', 'Lasa: hamafisinay aminao ny fandoavana sy ny daty fanombohana.')); go('/messages');
    } catch (e) { toast(e.message, 'bad'); }
  };
  const lignes = [
    [tr('Repas calculés pour votre objectif', 'Meals calculated for your goal', 'Sakafo kajiana ho an\'ny tanjonao'), 1, 1],
    [tr('Menus jour par jour (matin, midi, soir, collations)', 'Day-by-day menus', 'Menu isan\'andro'), 1, 1],
    [tr('Cuisine et livraison à domicile / au bureau', 'Cooking and delivery to home / office', 'Mahandro sy manatitra'), 1, 0],
    [tr('Suivi du livreur en direct', 'Live courier tracking', 'Arahina mivantana ny mpitondra'), 1, 0],
    [tr('Recettes avec quantités exactes', 'Recipes with exact quantities', 'Recette misy habetsahana'), 0, 1],
    [tr('Liste de courses chaque semaine', 'Weekly shopping list', 'Lisitry ny entana isan-kerinandro'), 0, 1],
    [tr('Suivi du poids, conseils et messages avec l\'équipe', 'Weight tracking, tips and team messages', 'Fanaraha-maso, torohevitra, hafatra'), 1, 1],
    [tr('Communauté (amis, motivation, avis)', 'Community (friends, motivation, reviews)', 'Fiaraha-monina'), 1, 1],
  ];
  return html`<div class="c-page">
    <h1>💳 ${tr('Choisissez votre formule', 'Choose your plan', 'Misafidiana formule')}</h1>
    ${abonne && html`<div class="info-box">${tr('Vous êtes abonné', 'You are subscribed', 'Efa misoratra ianao')} : ${M[client.formule === 'conseil' ? 'conseil' : 'livraison'].icone} <b>${M[client.formule === 'conseil' ? 'conseil' : 'livraison'].nom}</b> · ${aboStatut(client).label}. ${tr('Choisissez ci-dessous pour renouveler ou changer.', 'Choose below to renew or change.', 'Misafidiana eto ambany hanavaozana na hanova.')}</div>`}
    <p class="muted">${tr('Deux façons de suivre votre programme. Dans les deux cas, c\'est un abonnement : vos repas sont calculés pour votre objectif et notre équipe vous suit.', 'Two ways to follow your programme. Both are subscriptions: your meals are calculated for your goal and our team follows you.', 'Fomba roa hanarahana ny programa. Samy abonnement avokoa: kajiana ho an\'ny tanjonao ny sakafo ary arahin\'ny ekipa ianao.')}</p>

    <div class="mode-grid big">
      ${Object.entries(M).map(([k, x]) => html`<button class=${'mode-card' + (mode === k ? ' on' : '')} onClick=${() => setMode(k)}>
        <span>${x.icone}</span><b>${k === 'livraison' ? tr('Je veux être livré', 'I want delivery', 'Te hatitra aho') : tr('Je veux seulement la prescription', 'I only want the meal plan', 'Ny torolalana sakafo fotsiny')}</b>
        <small>${k === 'livraison' ? tr('Nous cuisinons vos repas adaptés à votre objectif et vous les livrons chaque jour, avec suivi du livreur en direct.', 'We cook meals adapted to your goal and deliver them every day, with live courier tracking.', 'Izahay no mahandro ny sakafo mifanaraka amin\'ny tanjonao ary manatitra isan\'andro.')
          : tr('Chaque semaine, vous recevez les repas à suivre, les recettes avec quantités et la liste de courses. Vous cuisinez vous-même, sans livraison.', 'Every week you get the meals to follow, recipes with quantities and the shopping list. You cook yourself, no delivery.', 'Isan-kerinandro: ny sakafo arahina, ny recette sy ny lisitry ny entana. Ianao no mahandro, tsy misy fanaterana.')}</small></button>`)}
      <button class="mode-card demo" onClick=${essayerDemo}><span>👀</span><b>${tr('Vous voulez d\'abord voir ?', 'Want to see first?', 'Te hijery aloha?')}</b>
        <small>${estDemo ? tr('Vous êtes sur le compte démo. Créez votre compte quand vous êtes prêt.', 'You are on the demo account. Create your account when ready.', 'Kaonty démo no ampiasainao.') : tr('On vous donne un compte démo : visitez l\'espace complet d\'un abonné (menus, livraison, suivi), sans engagement.', 'We give you a demo account: visit a subscriber\'s full space, no commitment.', 'Omenay kaonty démo ianao: jereo ny toerana feno an\'ny mpanjifa, tsy misy fanerena.')}</small>
        <i class="btn small">${estDemo ? tr('Créer mon compte', 'Create my account', 'Hamorona kaonty') : tr('Essayer le compte démo', 'Try the demo account', 'Andramo ny kaonty démo')}</i></button>
    </div>

    ${mode && html`<section class="c-card"><h2>${M[mode].icone} ${tr('Formules', 'Plans', 'Formules')} « ${M[mode].nom} »</h2>
      ${offres.length ? html`<div class="offres">${offres.map((o) => html`<div class=${'offre' + (client?.profil?.offre_souhaitee === o.id ? ' on' : '')}><b>${o.nom}</b><span class="prix">${o.prix ? fmt(o.prix) + ' Ar' : tr('sur devis', 'on quote', 'araka ny fifanarahana')}</span><small>${o.nb_jours} ${tr('jour(s)', 'day(s)', 'andro')}${o.prix && o.nb_jours > 1 ? ' · ' + fmt(o.prix / o.nb_jours) + ' Ar/' + tr('jour', 'day', 'andro') : ''}</small>${o.description && html`<p class="small">${o.description}</p>`}
        <button class="btn small primary" onClick=${() => choisir(o)}>${me ? tr('Choisir', 'Choose', 'Safidiana') : tr('Créer mon compte', 'Create my account', 'Hamorona kaonty')}</button></div>`)}</div>`
        : html`<p class="muted small">${tr('Tarif sur demande : écrivez-nous.', 'Price on request: message us.', 'Anontanio aminay ny vidiny.')}</p>`}
      <p class="tiny muted">${tr('Après votre choix, l\'équipe vous confirme le paiement (Mobile Money, espèces) et la date de début. Votre espace complet s\'ouvre dès l\'activation.', 'After choosing, the team confirms payment and start date. Your full space opens on activation.', 'Aorian\'ny safidy, hamafisin\'ny ekipa ny fandoavana sy ny daty fanombohana.')}</p></section>`}

    <section class="c-card"><h2>${tr('Ce qui est inclus', 'What\'s included', 'Ny ao anatiny')}</h2>
      <table class="cmp-table"><thead><tr><th></th><th>🛵<br/><small>${M.livraison.nom}</small></th><th>📋<br/><small>${M.conseil.nom}</small></th></tr></thead>
        <tbody>${lignes.map(([l, x, y]) => html`<tr><td>${l}</td><td>${x ? '✓' : '—'}</td><td>${y ? '✓' : '—'}</td></tr>`)}</tbody></table></section>

    <div class="row gap wrap">${me ? html`<a class="btn" href="#/messages">💬 ${tr('Poser une question', 'Ask a question', 'Hametraka fanontaniana')}</a>` : html`<a class="btn primary" href="connexion.html?inscription">${tr('Créer mon compte', 'Create my account', 'Hamorona kaonty')}</a>`}
      ${tel && html`<a class="btn" href=${'tel:' + tel}>📞 ${tel}</a>`}${wa && html`<a class="btn" href=${'https://wa.me/' + wa.replace(/\D/g, '')} target="_blank" rel="noopener">WhatsApp</a>`}</div>
  </div>`;
}
