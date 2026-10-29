// Communauté (amis, fil d'actualité, encouragements), avis, messagerie par interlocuteur, incidents de livraison.
import { html, useState, useMemo, useEffect, useRef } from '../lib.js?v=202610291512';
import { useApp, Modal, Badge } from '../ui.js?v=202610291512';
import { tr, platTitle, platText } from '../i18n.js?v=202610291512';
import { fmt, isoDate, platTotals, menuRepas } from '../calc.js?v=202610291512';
import { insertRow, updateRow, supprimer, upsert } from '../db.js?v=202610291512';
import { Chat, ConvList, convLabel, dmId } from '../chat.js?v=202610291512';
import { Thumb } from '../pickers.js?v=202610291512';
import { heure } from '../map.js?v=202610291512';

export const depuis = (iso) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return tr('à l\'instant', 'just now', 'izao');
  if (m < 60) return m + ' min';
  if (m < 1440) return Math.round(m / 60) + ' h';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
const ini = (s) => String(s || '?').trim().split(/[\s._-]+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || '?';
const teinte = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 55% 45%)`; };
export function Avatar({ nom, size = 40, photo }) {
  if (photo) return html`<img class="av" src=${photo} alt=${nom || ''} loading="lazy" style=${{ width: size + 'px', height: size + 'px' }} />`;
  return html`<span class="av" style=${{ width: size + 'px', height: size + 'px', background: teinte(nom), fontSize: Math.round(size * 0.38) + 'px' }}>${ini(nom)}</span>`;
}
export const erreur = (toast) => (e) => toast(/démo/i.test(e.message) ? tr('Compte démo : action désactivée. Créez votre compte pour participer !', 'Demo account: action disabled.', 'Kaonty démo: tsy azo atao.') : e.message, 'bad');

// ---------- Étoiles ----------
export function Etoiles({ note = 0, onChange, size = 22 }) {
  const [survol, setSurvol] = useState(0);
  const v = survol || note;
  return html`<span class=${'stars' + (onChange ? ' edit' : '')} style=${{ fontSize: size + 'px' }} onMouseLeave=${() => setSurvol(0)}>
    ${[1, 2, 3, 4, 5].map((i) => html`<button type="button" disabled=${!onChange} class=${i <= v ? 'on' : ''} onMouseEnter=${() => onChange && setSurvol(i)} onClick=${() => onChange && onChange(i)} aria-label=${i + '/5'}>★</button>`)}
  </span>`;
}
export const moyenne = (avis) => (avis.length ? avis.reduce((a, x) => a + x.note, 0) / avis.length : null);

// Formulaire d'avis (plat, livreur, service)
export function AvisForm({ client, cible_type, cible_id = '', titre, onDone }) {
  const { data, setData, toast } = useApp();
  const exist = (data.avis || []).find((a) => a.client_id === client.id && a.cible_type === cible_type && a.cible_id === cible_id);
  const [note, setNote] = useState(exist?.note || 0);
  const [com, setCom] = useState(exist?.commentaire || '');
  const [busy, setBusy] = useState(false);
  async function envoyer() {
    if (!note) return toast(tr('Choisissez une note', 'Pick a rating', 'Misafidiana naoty'), 'bad');
    setBusy(true);
    try {
      if (exist) { await updateRow('avis', exist.id, { note, commentaire: com.trim() || null }); setData((d) => ({ ...d, avis: d.avis.map((a) => (a.id === exist.id ? { ...a, note, commentaire: com } : a)) })); }
      else { const r = await insertRow('avis', { client_id: client.id, cible_type, cible_id, note, commentaire: com.trim() || null }); setData((d) => ({ ...d, avis: [...(d.avis || []), r || { id: Math.random().toString(36), client_id: client.id, cible_type, cible_id, note, commentaire: com, created_at: new Date().toISOString() }] })); }
      toast(tr('Merci pour votre avis ⭐', 'Thanks for your review ⭐', 'Misaotra tamin\'ny hevitrao ⭐'));
      onDone && onDone();
    } catch (e) { erreur(toast)(e); }
    setBusy(false);
  }
  return html`<div class="avis-form">
    ${titre && html`<b>${titre}</b>`}
    <${Etoiles} note=${note} onChange=${setNote} size=${30} />
    <textarea rows="2" maxlength="1000" placeholder=${tr('Un commentaire ? (facultatif)', 'A comment? (optional)', 'Fanamarihana? (tsy voatery)')} value=${com} onInput=${(e) => setCom(e.target.value)}></textarea>
    <button class="btn primary" disabled=${busy} onClick=${envoyer}>${exist ? tr('Mettre à jour mon avis', 'Update my review', 'Havaozina') : tr('Publier mon avis', 'Post my review', 'Alefa ny hevitro')}</button>
  </div>`;
}
// Liste d'avis publics
export function AvisListe({ avis, data, max = 5, cibles }) {
  if (!avis.length) return html`<p class="muted small">${tr('Pas encore d\'avis.', 'No reviews yet.', 'Mbola tsy misy hevitra.')}</p>`;
  return html`<div class="avis-list">${[...avis].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, max).map((a) => html`<div class="avis-item">
    <div class="row gap"><${Avatar} nom=${a.auteur || '?'} size=${30} /><b>${a.auteur || tr('Client', 'Customer', 'Client')}</b><${Etoiles} note=${a.note} size=${14} /><small class="muted">${depuis(a.created_at)}</small></div>
    ${cibles && a.cible_type === 'plat' && (() => { const pl = data.plats.find((x) => x.id === a.cible_id); return pl ? html`<div class="avis-cible"><${Thumb} plat=${pl} size=${36} /><span>${platTitle(pl)}</span></div>` : null; })()}
    ${cibles && a.cible_type === 'livreur' && html`<div class="avis-cible">🛵 <span>${tr('Livraison', 'Delivery', 'Fanaterana')}</span></div>`}
    ${a.commentaire && html`<p>${a.commentaire}</p>`}
    ${a.reponse && html`<p class="avis-rep">🧑‍🍳 <b>Sakafo :</b> ${a.reponse}</p>`}
  </div>`)}</div>`;
}

// ---------- Incident en cours (bannière client) ----------
export function incidentPour(data, livreurId) {
  return (data.incidents || []).filter((i) => i.livreur_id === livreurId && i.statut === 'en_cours').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
}
export const INCIDENT_TYPES = [
  ['panne', '🛠️', ['Panne', 'Breakdown', 'Simba']], ['crevaison', '🛞', ['Crevaison', 'Flat tyre', 'Kodiarana triatra']],
  ['embouteillage', '🚦', ['Embouteillage', 'Traffic jam', 'Fitohanana']], ['meteo', '🌧️', ['Pluie / météo', 'Rain / weather', 'Orana']],
  ['accident', '🚑', ['Accident', 'Accident', 'Loza']], ['autre', '❓', ['Autre', 'Other', 'Hafa']],
];
export const incidentLabel = (t) => { const x = INCIDENT_TYPES.find((i) => i[0] === t) || INCIDENT_TYPES[5]; return x[1] + ' ' + tr(...x[2]); };
export function IncidentBanner({ incident }) {
  if (!incident) return null;
  const fin = Date.parse(incident.created_at) + incident.duree_min * 60000;
  return html`<div class="incident-banner"><span class="ib-ic">😔</span><div><b>${tr('Petit retard sur votre livraison', 'Small delay on your delivery', 'Tara kely ny fanaterana')}</b>
    <p>${incidentLabel(incident.type)} — ${tr(`environ +${incident.duree_min} min (reprise prévue vers ${heure(fin)}). Toutes nos excuses, nous faisons le maximum 🙏`, `about +${incident.duree_min} min (back on the road around ${heure(fin)}). We apologise 🙏`, `eo amin'ny +${incident.duree_min} min (hiainga indray manodidina ny ${heure(fin)}). Miala tsiny tokoa 🙏`)}</p></div></div>`;
}

// ---------- Messagerie client : Équipe / Livreur / Amis ----------
export function MessagesHub({ client }) {
  const app = useApp();
  const { data, me, toast } = app;
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const [conv, setConv] = useState(params.get('c') || '');
  const msgs = data.messages || [];
  const auj = isoDate(new Date());
  const livAuj = (data.livraisons || []).some((l) => l.client_id === client.id && l.livreur_id && l.date >= isoDate(new Date(Date.now() - 864e5)) && l.date <= auj);
  const amis = (data.amis || []).filter((a) => a.statut === 'accepte' && (a.de === client.id || a.a === client.id)).map((a) => (a.de === client.id ? a.a : a.de));
  const items = [
    { conv: 'client:' + client.id, label: tr('Équipe Sakafo', 'Sakafo team', 'Ekipa Sakafo'), icone: '🧑‍🍳', sous: tr('Questions, abonnement, menus…', 'Questions, subscription, menus…', 'Fanontaniana, abonnement, menu…'), epingle: true, couleur: 'equipe' },
    ...(livAuj || msgs.some((m) => m.conversation === 'livclient:' + client.id) ? [{ conv: 'livclient:' + client.id, label: tr('Mon livreur', 'My courier', 'Ny mpitondra'), icone: '🛵', sous: tr('Pour la livraison du jour', 'For today\'s delivery', 'Ho an\'ny fanaterana androany'), couleur: 'livreur' }] : []),
    ...amis.map((id) => ({ conv: dmId(client.id, id), label: (data.communaute || []).find((c) => c.client_id === id)?.pseudo || tr('Ami', 'Friend', 'Namana'), couleur: 'ami' })),
  ];
  const quick = conv.startsWith('livclient:') ? [tr('Je suis là dans 5 min', 'I\'ll be there in 5 min', 'Ho tonga afaka 5 min aho'), tr('Déposez au gardien SVP', 'Please leave it with the guard', 'Apetraho amin\'ny mpiambina azafady'), tr('Merci !', 'Thank you!', 'Misaotra!')]
    : conv.startsWith('dm:') ? ['💪', '🔥 ' + tr('Bravo !', 'Well done!', 'Arahabaina!'), tr('On continue ensemble !', 'Let\'s keep going together!', 'Andeha hiara-mitohy!')]
    : [tr('Bonjour 👋', 'Hello 👋', 'Manao ahoana 👋'), tr('Je voudrais modifier mon menu', 'I\'d like to change my menu', 'Te hanova ny menu aho'), tr('Merci !', 'Thank you!', 'Misaotra!')];
  const demo = client.id === 'CL-DEMO';
  const [nouveau, setNouveau] = useState(false);
  const ouvrir = (c) => { setNouveau(false); setConv(c); history.replaceState(null, '', '#/messages?c=' + encodeURIComponent(c)); };
  if (conv) return html`<div class="c-page"><${Chat} conversation=${conv} messages=${msgs} me=${me} height="calc(100dvh - 190px)" titre=${convLabel(conv, data, client.id).replace(/^\S+\s/, '')}
    sousTitre=${conv.startsWith('livclient:') ? tr('Votre livreur du jour', 'Today\'s courier', 'Ny mpitondra androany') : conv.startsWith('dm:') ? tr('Ami de la communauté', 'Community friend', 'Namana') : tr('Répond en général en moins d\'1 h', 'Usually replies within 1 h', 'Mamaly ao anatin\'ny 1 ora')}
    onBack=${() => { setConv(''); history.replaceState(null, '', '#/messages'); }} quick=${quick} readOnly=${demo ? tr('Compte démo : lecture seule', 'Demo account: read only', 'Kaonty démo: jerena fotsiny') : null}
    onSend=${(t) => app.send(conv, t).catch(erreur(toast))} onRead=${app.markRead} /></div>`;
  return html`<div class="c-page">
    <div class="row between"><h1>💬 ${tr('Messages', 'Messages', 'Hafatra')}</h1><button class="btn primary small" onClick=${() => setNouveau(true)}>✏️ ${tr('Nouvelle discussion', 'New chat', 'Resaka vaovao')}</button></div>
    <section class="c-card flush"><${ConvList} items=${items} messages=${msgs} me=${me} onOpen=${ouvrir} /></section>
    ${nouveau && html`<${NouvelleDiscussion} client=${client} amis=${amis} onOpen=${ouvrir} onClose=${() => setNouveau(false)} />`}
  </div>`;
}

// Choisir avec qui discuter : équipe, livreur, amis (ou en trouver)
function NouvelleDiscussion({ client, amis, onOpen, onClose }) {
  const { data } = useApp();
  const [q, setQ] = useState('');
  const auj = isoDate(new Date());
  const membre = (data.communaute || []).some((c) => c.client_id === client.id);
  const prochaine = (data.livraisons || []).filter((l) => l.client_id === client.id && l.date >= auj && l.livreur_id).sort((a, b) => a.date.localeCompare(b.date))[0];
  const lv = prochaine && (data.livreurs || []).find((x) => x.id === prochaine.livreur_id);
  const pseudo = (id) => (data.communaute || []).find((c) => c.client_id === id)?.pseudo || tr('Ami', 'Friend', 'Namana');
  const f = (t) => !q || t.toLowerCase().includes(q.toLowerCase());
  const Ligne = ({ icone, couleur, titre, sous, onClick }) => html`<button class="wa-item" onClick=${onClick}><span class=${'wa-av ' + (couleur || '')}>${icone}</span><span class="wa-mid"><b>${titre}</b><small>${sous}</small></span><span class="chev">›</span></button>`;
  const amisF = amis.filter((id) => f(pseudo(id)));
  return html`<${Modal} title=${'✏️ ' + tr('Nouvelle discussion', 'New chat', 'Resaka vaovao')} onClose=${onClose}>
    <input type="search" placeholder=${tr('Rechercher un ami…', 'Search a friend…', 'Hitady namana…')} value=${q} onInput=${(e) => setQ(e.target.value)} />
    <h3 class="nd-titre">${tr('Sakafo', 'Sakafo', 'Sakafo')}</h3>
    <div class="wa-list">
      <${Ligne} icone="🧑‍🍳" couleur="equipe" titre=${tr('Équipe Sakafo (administration)', 'Sakafo team (admin)', 'Ekipa Sakafo (fitantanana)')} sous=${tr('Abonnement, menus, paiement, question…', 'Subscription, menus, payment, questions…', 'Abonnement, menu, fandoavana, fanontaniana…')} onClick=${() => onOpen('client:' + client.id)} />
      ${client.formule !== 'conseil' && html`<${Ligne} icone="🛵" couleur="livreur" titre=${lv ? tr('Mon livreur', 'My courier', 'Ny mpitondra') + ' · ' + lv.nom : tr('Mon livreur', 'My courier', 'Ny mpitondra')}
        sous=${lv ? tr('Livraison du', 'Delivery on', 'Fanaterana ny') + ' ' + new Date(prochaine.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }) : tr('Transmis au livreur de votre prochaine livraison (l\'équipe le voit aussi)', 'Passed on to your next delivery\'s courier (the team sees it too)', 'Halefa amin\'ny mpitondra manaraka (hitan\'ny ekipa koa)')}
        onClick=${() => onOpen('livclient:' + client.id)} />`}
    </div>
    <h3 class="nd-titre">${tr('Mes amis', 'My friends', 'Ny namako')} ${amis.length ? html`<small class="muted">(${amis.length})</small>` : null}</h3>
    ${amisF.length ? html`<div class="wa-list">${amisF.map((id) => html`<${Ligne} icone=${html`<${Avatar} nom=${pseudo(id)} size=${40} />`} titre=${pseudo(id)} sous=${tr('Ami de la communauté', 'Community friend', 'Namana')} onClick=${() => onOpen(dmId(client.id, id))} />`)}</div>`
      : html`<p class="small muted">${amis.length ? tr('Aucun ami ne correspond.', 'No matching friend.', 'Tsy misy namana mifanaraka.') : membre ? tr('Vous n\'avez pas encore d\'amis : envoyez des demandes dans la communauté.', 'No friends yet: send requests in the community.', 'Mbola tsy manana namana: mandefasa fangatahana.') : tr('Rejoignez la communauté pour discuter avec d\'autres membres, partager vos progrès et vous motiver.', 'Join the community to chat with other members, share progress and stay motivated.', 'Midira ao amin\'ny fiaraha-monina hiresahana amin\'ny hafa.')}</p>`}
    <a class="btn" href="#/communaute?onglet=amis" onClick=${onClose}>👥 ${membre ? tr('Trouver des amis', 'Find friends', 'Hitady namana') : tr('Rejoindre la communauté', 'Join the community', 'Hiditra amin\'ny fiaraha-monina')}</a>
  <//>`;
}

// ---------- Avis du client (onglet « Avis » de la communauté) ----------
export function AvisClient({ client }) {
  const { data } = useApp();
  const [plat, setPlat] = useState('');
  const [q, setQ] = useState('');
  const derLiv = (data.livraisons || []).filter((l) => l.client_id === client.id && l.statut === 'livree' && l.livreur_id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const platsVus = useMemo(() => {
    const ids = new Set();
    for (const c of data.calendrier || []) { const m = (data.menus || []).find((x) => x.id === c.menu_id); if (m) menuRepas(m).forEach((r) => r.plat_id && ids.add(r.plat_id)); }
    const vus = data.plats.filter((p) => ids.has(p.id));
    const publies = data.plats.filter((p) => p.statut !== 'Draft');
    return (vus.length ? vus : publies.length ? publies : data.plats).sort((a, b) => (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0));
  }, [data.calendrier, data.menus, data.plats]);
  const publics = (data.avis || []).filter((a) => !a.masque);
  const moy = moyenne(publics.filter((a) => a.cible_type === 'service'));
  return html`
    <section class="c-card"><${AvisForm} client=${client} cible_type="service" titre=${'🍽️ ' + tr('Votre avis sur Sakafo Sur Mesure', 'Your review of Sakafo Sur Mesure', 'Ny hevitrao momba ny Sakafo')} /></section>
    ${derLiv && html`<section class="c-card"><${AvisForm} client=${client} cible_type="livreur" cible_id=${derLiv.livreur_id} titre=${'🛵 ' + tr('La livraison du ', 'Delivery of ', 'Ny fanaterana tamin\'ny ') + new Date(derLiv.date).toLocaleDateString('fr-FR')} /></section>`}
    <section class="c-card"><h2>🍲 ${tr('Noter un plat', 'Rate a dish', 'Hanome naoty sakafo')}</h2>
      <p class="small muted">${tr('Touchez un plat que vous avez goûté.', 'Tap a dish you have tasted.', 'Tsindrio ny sakafo efa nohaninao.')}</p>
      <input type="search" placeholder=${tr('Rechercher un plat…', 'Search a dish…', 'Hitady sakafo…')} value=${q} onInput=${(e) => setQ(e.target.value)} />
      <div class="plat-strip">${platsVus.filter((p) => !q || platTitle(p).toLowerCase().includes(q.toLowerCase())).map((p) => { const av = (data.avis || []).filter((a) => a.cible_type === 'plat' && a.cible_id === p.id && !a.masque); const m = moyenne(av); const mien = (data.avis || []).some((a) => a.cible_type === 'plat' && a.cible_id === p.id && a.client_id === client.id);
        return html`<button class=${'plat-tile' + (plat === p.id ? ' on' : '')} onClick=${() => setPlat(plat === p.id ? '' : p.id)}>${p.image_url ? html`<img src=${p.image_url} alt="" loading="lazy" />` : html`<span class="pt-ph">${platTitle(p).charAt(0)}</span>`}
          ${mien && html`<i class="pt-ok">✓</i>`}<b>${platTitle(p)}</b><small>${m ? '★ ' + fmt(m, 1) + ' (' + av.length + ')' : tr('Pas encore noté', 'Not rated yet', 'Mbola tsy misy naoty')}</small></button>`; })}</div>
    </section>
    ${plat && html`<${PlatAvisCarte} plat=${data.plats.find((p) => p.id === plat)} client=${client} key=${plat} onClose=${() => setPlat('')} />`}
    <section class="c-card"><div class="row between"><h2>💬 ${tr('Avis des clients', 'Customer reviews', 'Hevitry ny mpanjifa')}</h2>${moy && html`<span class="row gap"><${Etoiles} note=${Math.round(moy)} size=${16} /><b>${fmt(moy, 1)}</b></span>`}</div>
      <${AvisListe} avis=${publics} data=${data} max=${15} cibles /></section>`;
}

// Fiche d'un plat présentée comme une publication, puis le formulaire de note
function PlatAvisCarte({ plat, client, onClose }) {
  const { data, ingMap } = useApp();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);
  if (!plat) return null;
  const av = (data.avis || []).filter((a) => a.cible_type === 'plat' && a.cible_id === plat.id && !a.masque);
  const m = moyenne(av);
  const t = platTotals(plat.id, data.composition, ingMap);
  const txt = platText(plat, 'marketing');
  const tags = [].concat(plat.details?.regimes || []).filter(Boolean).slice(0, 4);
  return html`<article class="c-card post plat-post" ref=${ref}>
    <header class="post-h"><span class="pp-ic">🍲</span><div class="grow"><b>${platTitle(plat)}</b><small class="muted d-block">${m ? html`<${Etoiles} note=${Math.round(m)} size=${13} /> ${fmt(m, 1)} · ${av.length} ${tr('avis', 'reviews', 'hevitra')}` : tr('Soyez le premier à le noter !', 'Be the first to rate it!', 'Aoka ho ianao no voalohany!')}</small></div><button class="icon-btn" onClick=${onClose} aria-label=${tr('Fermer', 'Close', 'Hidio')}>✕</button></header>
    ${plat.image_url ? html`<img class="pp-hero" src=${plat.image_url} alt=${platTitle(plat)} loading="lazy" />` : html`<div class="pp-hero pp-ph"><span>${platTitle(plat).charAt(0)}</span><b>${platTitle(plat)}</b></div>`}
    <div class="pp-chips"><span>🔥 ${fmt(t.kcal)} kcal</span><span>💪 ${fmt(t.proteines)} g ${tr('protéines', 'protein', 'proteinina')}</span><span>🌾 ${fmt(t.fibres)} g ${tr('fibres', 'fibre', 'fibres')}</span>${tags.map((x) => html`<span>✓ ${x}</span>`)}</div>
    ${txt && html`<p class="post-txt">${txt}</p>`}
    ${av.length > 0 && html`<${AvisListe} avis=${av} data=${data} max=${2} />`}
    <div class="pp-form"><${AvisForm} client=${client} cible_type="plat" cible_id=${plat.id} titre=${tr('Votre note', 'Your rating', 'Ny naotinao')} /></div>
  </article>`;
}
