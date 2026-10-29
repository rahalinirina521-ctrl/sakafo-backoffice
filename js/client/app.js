// Application client (PWA) : tableau de bord, menus, livraison en direct, suivi, messages — et mode invité (démo limitée).
import { html, render, useState, useEffect, useMemo } from '../lib.js?v=202610290637';
import { AppCtx, Badge, useApp as useApp2 } from '../ui.js?v=202610290637';
import { tr, catName, platTitle, platText } from '../i18n.js?v=202610290637';
import { registerCustomUnits, fmt, isoDate } from '../calc.js?v=202610290637';
import { MODE, loadAll } from '../db.js?v=202610290637';
import { useLive, envoyerMessage, marquerLus } from '../live.js?v=202610290637';
import { analyse, typeObjectif } from '../conseil.js?v=202610290637';
import { ProfilFields, AnalysePanel, WeightChart } from '../conseil-ui.js?v=202610290637';
import { nonLus } from '../chat.js?v=202610290637';
import { param } from '../params.js?v=202610290637';
import { Thumb } from '../pickers.js?v=202610290637';
import { LangSwitch, useLang, useToast, useAuth, AuthScreen, NewPassword, UpdateNotice } from '../shell.js?v=202610290637';
import { Accueil, MenusSemaine, LivraisonLive, Suivi, MessagesClient, Profil, PlatModal, objectifsVisibles } from './vues.js?v=202610290637';

const BRAND = 'Sakafo Sur Mesure';
const DEMO_AS = (() => { const a = new URLSearchParams(location.search).get('as'); return a ? (a === 'invite' ? { user_id: 'demo-invite', admin: false, role: 'invite' } : { user_id: 'demo-' + a, admin: false, role: 'client', client_id: a }) : { user_id: 'demo-invite', admin: false, role: 'invite' }; })();

function useRoute() {
  const get = () => location.hash.replace(/^#/, '') || '/';
  const [r, setR] = useState(get());
  useEffect(() => { const on = () => { setR(get()); window.scrollTo(0, 0); }; addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return r;
}
const go = (p) => { location.hash = '#' + p; };

export function ClientApp() {
  const [lang, setLang] = useLang();
  const [toast, toastView] = useToast();
  const auth = useAuth(DEMO_AS);
  const [guest, setGuest] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const route = useRoute();
  const me = auth.me;
  const actif = !!me || guest;

  useEffect(() => {
    if (!actif) return;
    loadAll().then(setData).catch((e) => setError(e.message || String(e)));
  }, [actif, me?.client_id]);
  const client = data && me?.client_id ? (data.clients || []).find((c) => c.id === me.client_id) : null;
  const conv = client ? 'client:' + client.id : me ? 'user:' + me.id : null;
  useLive(setData, client ? [['messages', 'conversation=eq.' + conv], ['livraisons', 'client_id=eq.' + client.id], ['positions'], ['clients', 'id=eq.' + client.id]] : me ? [['messages', 'conversation=eq.' + conv]] : [], [conv]);

  const ingMap = useMemo(() => { registerCustomUnits(data?.options || []); return new Map((data?.ingredients || []).map((i) => [i.id, i])); }, [data]);
  const meChat = me && { id: me.id, role: client ? 'client' : 'invite', nom: client?.nom || me.email || '' };
  const ctx = useMemo(() => ({ data, setData, ingMap, toast, me: meChat, lang,
    send: (c, t) => envoyerMessage(setData, c, t, meChat), markRead: (m) => marquerLus(setData, m, meChat) }), [data, ingMap, lang, me, client?.nom]);

  if (auth.session === undefined) return html`<div class="center muted">${tr('Chargement…', 'Loading…', 'Miandrasa…')}</div>`;
  if (!actif) return html`<${AuthScreen} titre=${BRAND} sousTitre=${tr('Repas sur mesure livrés à Antananarivo', 'Tailored meals delivered in Antananarivo', 'Sakafo natao ho anao, aterina eto Antananarivo')} lang=${lang} onLang=${setLang} onGuest=${() => setGuest(true)}>
    <p class="auth-pitch">${tr('Perte de poids, prise de muscle, diabète, grossesse… des repas calculés pour votre objectif, un suivi réel et un livreur que vous suivez en direct.', 'Weight loss, muscle gain, diabetes, pregnancy… meals calculated for your goal, real follow-up and live courier tracking.', 'Fihenan\'ny lanja, hozatra, diabeta, fitondrana vohoka… sakafo kajiana araka ny tanjonao, fanaraha-maso tena izy ary mpitondra arahina mivantana.')}</p>
  <//>`;
  if (me && me.role === 'livreur') return html`<div class="center"><div class="card login"><p>${tr('Ce compte est un compte livreur.', 'This is a courier account.', 'Kaonty mpitondra ity.')}</p><a class="btn primary" href="livreur.html">🛵 ${tr('Ouvrir l\'application livreur', 'Open the courier app', 'Sokafy ny app livreur')}</a> <button class="btn ghost" onClick=${auth.logout}>${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button></div></div>`;
  if (!data) return html`<div class="center muted">${error ? html`<span class="error">${error}</span>` : tr('Chargement…', 'Loading…', 'Miandrasa…')}</div>`;

  const setClient = (c) => setData((d) => ({ ...d, clients: d.clients.map((x) => (x.id === c.id ? c : x)) }));
  const unread = conv ? nonLus(data.messages || [], conv, me?.id) : 0;
  const parts = route.split('?')[0];
  let tabs; let page;
  if (client) {
    tabs = [['/', '🏠', tr('Accueil', 'Home', 'Fandraisana')], ['/menus', '📅', tr('Menus', 'Menus', 'Menus')], ...(client.formule !== 'conseil' ? [['/livraison', '🛵', tr('Livraison', 'Delivery', 'Fanaterana')]] : []), ['/suivi', '📈', tr('Suivi', 'Progress', 'Fandrosoana')], ['/messages', '💬', tr('Messages', 'Messages', 'Hafatra')], ['/profil', '👤', tr('Profil', 'Profile', 'Momba ahy')]];
    page = parts === '/menus' ? html`<${MenusSemaine} client=${client} />`
      : parts === '/livraison' ? html`<${LivraisonLive} client=${client} />`
      : parts === '/suivi' ? html`<${Suivi} client=${client} onClient=${setClient} />`
      : parts === '/messages' ? html`<${MessagesClient} conversation=${conv} />`
      : parts === '/profil' ? html`<${Profil} client=${client} onClient=${setClient} logout=${auth.logout} lang=${lang} onLang=${setLang} LangSwitch=${LangSwitch} />`
      : parts === '/formules' ? html`<${Formules} me=${me} />`
      : html`<${Accueil} client=${client} go=${go} />`;
  } else {
    tabs = [['/', '✨', tr('Découvrir', 'Discover', 'Hijery')], ['/objectif', '🎯', tr('Mon objectif', 'My goal', 'Tanjona')], ['/plats', '🍽️', tr('Plats', 'Dishes', 'Sakafo')], ['/formules', '💳', tr('Formules', 'Plans', 'Formules')], ...(me ? [['/messages', '💬', tr('Messages', 'Messages', 'Hafatra')]] : []), ['/compte', '👤', me ? tr('Compte', 'Account', 'Kaonty') : tr('Connexion', 'Sign in', 'Hiditra')]];
    page = parts === '/objectif' ? html`<${Simulateur} me=${me} />`
      : parts === '/plats' ? html`<${Vitrine} />`
      : parts === '/formules' ? html`<${Formules} me=${me} />`
      : parts === '/messages' && me ? html`<${MessagesClient} conversation=${conv} />`
      : parts === '/compte' ? html`<${CompteInvite} me=${me} logout=${auth.logout} quitter=${() => { setGuest(false); go('/'); }} lang=${lang} onLang=${setLang} />`
      : html`<${Decouvrir} me=${me} />`;
  }
  const actifTab = '/' + (parts.split('/')[1] || '');
  return html`<${AppCtx.Provider} value=${ctx}>
    <div class="c-app">
      <header class="c-top"><span class="auth-brand"><span class="logo-dot">S</span><b>${BRAND}</b></span>${!client && html`<${Badge} tone="warn">${tr('Démo', 'Demo', 'Démo')}<//>`}<${LangSwitch} lang=${lang} onChange=${setLang} /></header>
      <${UpdateNotice} /><main class="c-main">${page}</main>
      <nav class="c-nav">${tabs.map(([p, i, l]) => html`<a href=${'#' + p} class=${actifTab === p ? 'on' : ''}><span>${i}${p === '/messages' && unread ? html`<i class="dot-badge">${unread}</i>` : null}</span><small>${l}</small></a>`)}</nav>
    </div>
    ${auth.recovery && html`<${NewPassword} onDone=${() => { auth.setRecovery(false); toast(tr('Mot de passe modifié', 'Password changed', 'Voaova ny teny miafina')); }} />`}
    ${toastView}
  <//>`;
}

// ---------- Mode invité ----------
const LOCK_N = 6;
function Decouvrir({ me }) {
  const { data } = useApp2();
  const accueil = param(data, 'message_accueil');
  const plats = data.plats.filter((p) => p.image_url && p.statut !== 'Draft').slice(0, 4);
  return html`<div class="c-page">
    <section class="hero"><h1>${tr('Des repas calculés pour VOTRE objectif', 'Meals calculated for YOUR goal', 'Sakafo kajiana ho an\'ny tanjonao')}</h1>
      <p>${accueil || tr('Nutrition, cuisine et livraison à Antananarivo. Chaque plat est pesé, ses calories et protéines calculées, et votre progression suivie semaine après semaine.', 'Nutrition, cooking and delivery in Antananarivo. Every dish is weighed, its calories and protein calculated, and your progress tracked week after week.', 'Nutrition, nahandro ary fanaterana eto Antananarivo. Lanjaina ny sakafo tsirairay, kajiana ny kcal sy proteinina, arahina isan-kerinandro ny fandrosoanao.')}</p>
      <a class="btn primary big" href="#/objectif">🎯 ${tr('Calculer mon objectif gratuitement', 'Calculate my goal for free', 'Kajio maimaim-poana ny tanjoko')}</a></section>
    <section class="c-card"><h2>${tr('Comment ça marche', 'How it works', 'Ahoana no fandehany')}</h2>
      <ol class="how"><li><b>${tr('Votre objectif', 'Your goal', 'Ny tanjonao')}</b> — ${tr('nous calculons vos besoins et un délai réaliste.', 'we calculate your needs and a realistic timeline.', 'kajianay ny filanao sy fotoana azo tanterahina.')}</li>
        <li><b>${tr('Vos menus', 'Your menus', 'Ny menu-nao')}</b> — ${tr('petit-déj, déjeuner, dîner, collations, adaptés jour après jour.', 'breakfast, lunch, dinner, snacks, adapted day by day.', 'maraina, atoandro, hariva, tsakitsaky, amboarina isan\'andro.')}</li>
        <li><b>${tr('Livraison ou conseil', 'Delivery or coaching', 'Fanaterana na torohevitra')}</b> — ${tr('on cuisine et on livre (suivi GPS), ou vous cuisinez avec nos menus et listes de courses.', 'we cook and deliver (GPS tracking), or you cook with our menus and shopping lists.', 'izahay no mahandro sy manatitra (GPS), na ianao no mahandro amin\'ny menu sy lisitry ny entana.')}</li>
        <li><b>${tr('Suivi', 'Follow-up', 'Fanaraha-maso')}</b> — ${tr('courbe de poids, prévisions et messages avec l\'équipe.', 'weight curve, forecasts and messages with the team.', 'fiolahan\'ny lanja, vinavina ary hafatra amin\'ny ekipa.')}</li></ol></section>
    <section class="c-card"><h2>${tr('Nos programmes', 'Our programmes', 'Ny programa')}</h2>
      <div class="obj-grid">${objectifsVisibles(data).map((c) => html`<a class="obj" href="#/objectif"><span>${c.icone || '🎯'}</span><b>${catName(c)}</b>${c.description ? html`<small>${c.description}</small>` : null}</a>`)}</div></section>
    ${plats.length > 0 && html`<section class="c-card"><div class="row between"><h2>${tr('Quelques plats', 'Some dishes', 'Sakafo vitsivitsy')}</h2><a href="#/plats">${tr('Voir plus →', 'See more →', 'Hijery bebe kokoa →')}</a></div>
      <div class="vit-grid">${plats.map((p) => html`<a class="vit" href="#/plats"><img src=${p.image_url} alt=${platTitle(p)} loading="lazy" /><b>${platTitle(p)}</b></a>`)}</div></section>`}
  </div>`;
}
function Vitrine() {
  const { data } = useApp2();
  const [plat, setPlat] = useState(null);
  const plats = [...data.plats].filter((p) => p.statut !== 'Draft').sort((a, b) => (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0));
  return html`<div class="c-page"><h1>🍽️ ${tr('Nos plats', 'Our dishes', 'Ny sakafonay')}</h1>
    <div class="vit-grid">${plats.slice(0, LOCK_N).map((p) => html`<button class="vit" onClick=${() => setPlat(p)}>${p.image_url ? html`<img src=${p.image_url} alt=${platTitle(p)} loading="lazy" />` : html`<${Thumb} plat=${p} size=${120} />`}<b>${platTitle(p)}</b>${platText(p, 'marketing') && html`<small>${platText(p, 'marketing').slice(0, 90)}…</small>`}</button>`)}</div>
    ${plats.length > LOCK_N && html`<div class="locked"><span>🔒</span><p>${tr(`+ ${plats.length - LOCK_N} autres plats, les menus de la semaine et les valeurs nutritionnelles complètes sont réservés aux abonnés.`, `+ ${plats.length - LOCK_N} more dishes, weekly menus and full nutrition values are for subscribers.`, `Sakafo ${plats.length - LOCK_N} hafa, menu isan-kerinandro ary valeur nutritionnelle feno: ho an'ny mpanjifa manana abonnement.`)}</p><a class="btn primary" href="#/formules">${tr('Voir les formules', 'See plans', 'Jereo ny formules')}</a></div>`}
    ${plat && html`<${PlatModal} plat=${plat} onClose=${() => setPlat(null)} showCompo=${false} />`}
  </div>`;
}
function Simulateur({ me }) {
  const app = useApp2();
  const { data, toast } = app;
  const objs = objectifsVisibles(data);
  const [catId, setCatId] = useState(objs[0]?.id);
  const [prof, setProf] = useState(() => { try { return JSON.parse(localStorage.getItem('sakafo_simu') || '{}'); } catch (e) { return {}; } });
  const cat = data.categories.find((c) => c.id === catId);
  const a = analyse(prof, typeObjectif(cat), []);
  useEffect(() => { try { localStorage.setItem('sakafo_simu', JSON.stringify(prof)); } catch (e) { /* */ } }, [prof]);
  async function demander() {
    if (!me) { go('/compte'); return; }
    const txt = `🎯 ${tr('Je souhaite un programme', 'I would like a programme', 'Mila programa aho')} « ${catName(cat)} ». ${prof.poids ? tr('Poids', 'Weight', 'Lanja') + ' ' + prof.poids + ' kg' : ''}${prof.poids_cible ? ' → ' + prof.poids_cible + ' kg' : ''}${prof.taille ? ', ' + prof.taille + ' cm' : ''}. ${a.verdict ? a.verdict.titre : ''} (${fmt(a.kcal)} kcal/${tr('jour', 'day', 'andro')})`;
    try { await app.send('user:' + me.id, txt); toast(tr('Demande envoyée ! Nous vous répondons dans « Messages ».', 'Request sent! We reply in "Messages".', 'Lasa ny fangatahana! Hamaly ao amin\'ny « Hafatra » izahay.')); go('/messages'); } catch (e) { toast(e.message, 'bad'); }
  }
  return html`<div class="c-page"><h1>🎯 ${tr('Mon objectif', 'My goal', 'Ny tanjoko')}</h1>
    <p class="muted small">${tr('Gratuit et immédiat : un avis basé sur les recommandations nutritionnelles officielles.', 'Free and instant: advice based on official nutrition guidelines.', 'Maimaim-poana: torohevitra mifototra amin\'ny fenitra ofisialy.')}</p>
    <section class="c-card">
      <div class="obj-chips">${objs.map((c) => html`<button class=${'chip' + (c.id === catId ? ' on' : '')} onClick=${() => setCatId(c.id)}>${c.icone || ''} ${catName(c)}</button>`)}</div>
      <${ProfilFields} profil=${prof} type=${typeObjectif(cat)} onChange=${setProf} compact />
    </section>
    <section class="c-card"><${AnalysePanel} a=${a} showRefs />${a.ok && a.prevision && html`<${WeightChart} mesures=${[]} prevision=${a.prevision} cible=${prof.poids_cible} />`}</section>
    ${a.ok && html`<div class="locked"><span>🔒</span><p>${tr('Menus jour par jour, livraison, suivi de poids et messages avec l\'équipe : réservés aux abonnés.', 'Day-by-day menus, delivery, weight tracking and team messages: for subscribers.', 'Menu isan\'andro, fanaterana, fanaraha-maso lanja ary hafatra: ho an\'ny manana abonnement.')}</p>
      <button class="btn primary big" onClick=${demander}>${me ? tr('Je veux ce programme', 'I want this programme', 'Tiako ity programa ity') : tr('Créer mon compte pour commencer', 'Create my account to start', 'Hamorona kaonty hanombohana')}</button></div>`}
  </div>`;
}
function Formules({ me }) {
  const { data } = useApp2();
  const offres = [...(data.offres || [])].filter((o) => o.actif !== false).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.nb_jours - b.nb_jours);
  const tel = param(data, 'telephone'); const wa = param(data, 'whatsapp');
  return html`<div class="c-page"><h1>💳 ${tr('Formules', 'Plans', 'Formules')}</h1>
    <div class="offres">${offres.map((o) => html`<div class="offre"><b>${o.nom}</b><span class="prix">${o.prix ? fmt(o.prix) + ' Ar' : tr('sur devis', 'on quote', 'araka ny fifanarahana')}</span><small>${o.nb_jours} ${tr('jour(s)', 'day(s)', 'andro')}${o.prix && o.nb_jours > 1 ? ' · ' + fmt(o.prix / o.nb_jours) + ' Ar/' + tr('jour', 'day', 'andro') : ''}</small>${o.description && html`<p class="small">${o.description}</p>`}</div>`)}</div>
    <section class="c-card"><h2>${tr('Deux façons de suivre le programme', 'Two ways to follow the programme', 'Fomba roa')}</h2>
      <p>🛵 <b>${tr('Livraison', 'Delivery', 'Fanaterana')}</b> — ${tr('nous cuisinons et livrons vos repas, suivi du livreur en direct.', 'we cook and deliver your meals, live courier tracking.', 'izahay no mahandro sy manatitra, arahina mivantana ny mpitondra.')}</p>
      <p>📋 <b>${tr('Conseil seulement', 'Coaching only', 'Torohevitra fotsiny')}</b> — ${tr('vous cuisinez : menus, recettes avec quantités et liste de courses chaque semaine.', 'you cook: menus, recipes with quantities and a weekly shopping list.', 'ianao no mahandro: menu, recette misy habetsahana ary lisitry ny entana isan-kerinandro.')}</p></section>
    <div class="row gap wrap">${me ? html`<a class="btn primary" href="#/messages">💬 ${tr('Demander mon abonnement', 'Request my subscription', 'Hangataka abonnement')}</a>` : html`<a class="btn primary" href="#/compte">${tr('Créer mon compte', 'Create my account', 'Hamorona kaonty')}</a>`}
      ${tel && html`<a class="btn" href=${'tel:' + tel}>📞 ${tel}</a>`}${wa && html`<a class="btn" href=${'https://wa.me/' + wa.replace(/\D/g, '')} target="_blank" rel="noopener">WhatsApp</a>`}</div>
  </div>`;
}
function CompteInvite({ me, logout, quitter, lang, onLang }) {
  if (me) return html`<div class="c-page"><h1>👤 ${tr('Mon compte', 'My account', 'Ny kaontiko')}</h1>
    <section class="c-card"><p>${me.email}</p><p class="small muted">${tr('Votre compte est en mode découverte. Dès que votre abonnement est activé par notre équipe, votre espace complet (menus, suivi, livraison) s\'ouvre automatiquement.', 'Your account is in discovery mode. As soon as our team activates your subscription, your full space opens automatically.', 'Mbola mode fijerena ny kaontinao. Rehefa alefan\'ny ekipa ny abonnement, misokatra ho azy ny toerana feno.')}</p>
    <div class="row gap wrap"><a class="btn primary" href="#/messages">💬 ${tr('Contacter l\'équipe', 'Contact the team', 'Hifandray amin\'ny ekipa')}</a><button class="btn ghost" onClick=${logout}>${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button></div></section></div>`;
  return html`<div class="c-page"><section class="c-card"><p>${tr('Créez un compte gratuit pour envoyer une demande et être recontacté.', 'Create a free account to send a request and be contacted.', 'Mamorona kaonty maimaim-poana mba handefasana fangatahana.')}</p><button class="btn primary big" onClick=${quitter}>${tr('Se connecter / créer un compte', 'Sign in / create account', 'Hiditra / hamorona kaonty')}</button></section></div>`;
}
if (typeof document !== 'undefined' && document.getElementById('app')) render(html`<${ClientApp} />`, document.getElementById('app'));
