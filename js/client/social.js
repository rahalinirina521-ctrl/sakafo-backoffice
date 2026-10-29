// Communauté (amis, fil d'actualité, encouragements), avis, messagerie par interlocuteur, incidents de livraison.
import { html, useState, useMemo } from '../lib.js?v=202610291028';
import { useApp, Modal, Badge } from '../ui.js?v=202610291028';
import { tr, platTitle } from '../i18n.js?v=202610291028';
import { fmt, isoDate } from '../calc.js?v=202610291028';
import { insertRow, updateRow, supprimer, upsert } from '../db.js?v=202610291028';
import { Chat, ConvList, convLabel, dmId } from '../chat.js?v=202610291028';
import { heure } from '../map.js?v=202610291028';

const EMOJIS = ['👏', '💪', '🔥', '❤️', '🎉'];
const depuis = (iso) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return tr('à l\'instant', 'just now', 'izao');
  if (m < 60) return m + ' min';
  if (m < 1440) return Math.round(m / 60) + ' h';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
const ini = (s) => String(s || '?').trim().split(/[\s._-]+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || '?';
const teinte = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 55% 45%)`; };
export function Avatar({ nom, size = 40 }) {
  return html`<span class="av" style=${{ width: size + 'px', height: size + 'px', background: teinte(nom), fontSize: Math.round(size * 0.38) + 'px' }}>${ini(nom)}</span>`;
}
const erreur = (toast) => (e) => toast(/démo/i.test(e.message) ? tr('Compte démo : action désactivée. Créez votre compte pour participer !', 'Demo account: action disabled.', 'Kaonty démo: tsy azo atao.') : e.message, 'bad');

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
export function AvisListe({ avis, data, max = 5 }) {
  if (!avis.length) return html`<p class="muted small">${tr('Pas encore d\'avis.', 'No reviews yet.', 'Mbola tsy misy hevitra.')}</p>`;
  return html`<div class="avis-list">${[...avis].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, max).map((a) => html`<div class="avis-item">
    <div class="row gap"><${Avatar} nom=${a.auteur || '?'} size=${30} /><b>${a.auteur || tr('Client', 'Customer', 'Client')}</b><${Etoiles} note=${a.note} size=${14} /><small class="muted">${depuis(a.created_at)}</small></div>
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
  if (conv) return html`<div class="c-page"><${Chat} conversation=${conv} messages=${msgs} me=${me} height="calc(100dvh - 190px)" titre=${convLabel(conv, data, client.id).replace(/^\S+\s/, '')}
    sousTitre=${conv.startsWith('livclient:') ? tr('Votre livreur du jour', 'Today\'s courier', 'Ny mpitondra androany') : conv.startsWith('dm:') ? tr('Ami de la communauté', 'Community friend', 'Namana') : tr('Répond en général en moins d\'1 h', 'Usually replies within 1 h', 'Mamaly ao anatin\'ny 1 ora')}
    onBack=${() => { setConv(''); history.replaceState(null, '', '#/messages'); }} quick=${quick} readOnly=${demo ? tr('Compte démo : lecture seule', 'Demo account: read only', 'Kaonty démo: jerena fotsiny') : null}
    onSend=${(t) => app.send(conv, t).catch(erreur(toast))} onRead=${app.markRead} /></div>`;
  return html`<div class="c-page">
    <h1>💬 ${tr('Messages', 'Messages', 'Hafatra')}</h1>
    <section class="c-card flush"><${ConvList} items=${items} messages=${msgs} me=${me} onOpen=${setConv} /></section>
    <p class="small muted center-text">${tr('Ajoutez des amis dans « Communauté » pour discuter avec eux.', 'Add friends in "Community" to chat with them.', 'Manampia namana ao amin\'ny « Fiaraha-monina » hiresahana aminy.')} <a href="#/communaute">👥</a></p>
  </div>`;
}

// ---------- Communauté ----------
export function Communaute({ client }) {
  const app = useApp();
  const { data } = app;
  const moi = (data.communaute || []).find((c) => c.client_id === client.id);
  const [onglet, setOnglet] = useState('fil');
  const demandes = (data.amis || []).filter((a) => a.a === client.id && a.statut === 'attente').length;
  return html`<div class="c-page">
    <h1>👥 ${tr('Communauté', 'Community', 'Fiaraha-monina')}</h1>
    <div class="seg big">${[['fil', '📰 ' + tr('Fil', 'Feed', 'Vaovao')], ['amis', '🤝 ' + tr('Amis', 'Friends', 'Namana'), demandes], ['avis', '⭐ ' + tr('Avis', 'Reviews', 'Hevitra')]].map(([k, l, n]) => html`<button class=${onglet === k ? 'on' : ''} onClick=${() => setOnglet(k)}>${l}${n ? html` <i class="wa-badge">${n}</i>` : null}</button>`)}</div>
    ${onglet === 'avis' ? html`<${AvisClient} client=${client} />`
      : !moi ? html`<${Rejoindre} client=${client} />`
      : onglet === 'amis' ? html`<${Amis} client=${client} moi=${moi} />`
      : html`<${Fil} client=${client} moi=${moi} />`}
  </div>`;
}

function Rejoindre({ client }) {
  const { setData, toast } = useApp();
  const [f, setF] = useState({ pseudo: client.nom.split(' ')[0], bio: '', visible: true });
  async function ok() {
    try { const row = { client_id: client.id, pseudo: f.pseudo.trim(), bio: f.bio.trim() || null, visible: f.visible }; await upsert('communaute', row); setData((d) => ({ ...d, communaute: [...(d.communaute || []).filter((c) => c.client_id !== client.id), row] })); toast(tr('Bienvenue dans la communauté 🎉', 'Welcome to the community 🎉', 'Tongasoa 🎉')); }
    catch (e) { erreur(toast)(e); }
  }
  return html`<section class="c-card hero-soft">
    <div class="big-emoji">🤝</div>
    <h2>${tr('Rejoignez la communauté Sakafo', 'Join the Sakafo community', 'Midira amin\'ny fiaraha-monina Sakafo')}</h2>
    <p class="small">${tr('Ajoutez des amis, partagez vos progrès, encouragez-vous mutuellement : on tient mieux ses objectifs à plusieurs !', 'Add friends, share your progress, encourage each other: goals are easier together!', 'Manampia namana, mizara ny fandrosoana, mifampahery: mora kokoa ny tanjona rehefa miaraka!')}</p>
    <label class="field"><span class="field-label">${tr('Pseudo (visible par les autres)', 'Nickname (visible to others)', 'Anarana hiseho')}</span><input maxlength="30" value=${f.pseudo} onInput=${(e) => setF({ ...f, pseudo: e.target.value })} /></label>
    <label class="field"><span class="field-label">${tr('Petite présentation (facultatif)', 'Short bio (optional)', 'Fampahafantarana fohy')}</span><input maxlength="200" value=${f.bio} onInput=${(e) => setF({ ...f, bio: e.target.value })} placeholder=${tr('ex. Objectif -10 kg avant Noël 💪', 'e.g. Goal -10 kg by Christmas 💪', 'ohatra: -10 kg alohan\'ny Krismasy 💪')} /></label>
    <label class="check"><input type="checkbox" checked=${f.visible} onChange=${(e) => setF({ ...f, visible: e.target.checked })} /> ${tr('Les autres membres peuvent me trouver', 'Other members can find me', 'Hitan\'ny mpikambana hafa aho')}</label>
    <p class="tiny muted">🔒 ${tr('Seuls votre pseudo et ce que vous publiez sont visibles. Votre poids, adresse et téléphone restent privés.', 'Only your nickname and posts are visible. Weight, address and phone stay private.', 'Ny anaranao sy izay avoakanao ihany no hita. Tsy hita ny lanja, adiresy ary finday.')}</p>
    <button class="btn primary big" disabled=${f.pseudo.trim().length < 2} onClick=${ok}>${tr('Rejoindre', 'Join', 'Hiditra')}</button>
  </section>`;
}

function Fil({ client, moi }) {
  const { data, setData, toast } = useApp();
  const mes = (data.mesures || []).filter((m) => m.client_id === client.id).sort((a, b) => a.date.localeCompare(b.date));
  const perf = mes.length >= 2 ? { depart: +mes[0].poids, actuel: +mes[mes.length - 1].poids, semaines: Math.max(1, Math.round((Date.parse(mes[mes.length - 1].date) - Date.parse(mes[0].date)) / (7 * 864e5))) } : null;
  const ecart = perf ? Math.round((perf.actuel - perf.depart) * 10) / 10 : 0;
  const [type, setType] = useState('motivation');
  const [txt, setTxt] = useState('');
  const [vis, setVis] = useState('amis');
  const [busy, setBusy] = useState(false);
  const texteAuto = perf ? (ecart < 0 ? tr(`${fmt(-ecart, 1)} kg en moins en ${perf.semaines} semaine(s) 🎉`, `${fmt(-ecart, 1)} kg lost in ${perf.semaines} week(s) 🎉`, `${fmt(-ecart, 1)} kg nihena tao anatin'ny herinandro ${perf.semaines} 🎉`) : tr(`+${fmt(ecart, 1)} kg en ${perf.semaines} semaine(s) 💪`, `+${fmt(ecart, 1)} kg in ${perf.semaines} week(s) 💪`, `+${fmt(ecart, 1)} kg tao anatin'ny herinandro ${perf.semaines} 💪`)) : '';
  const pseudo = (cid) => (data.communaute || []).find((c) => c.client_id === cid)?.pseudo || '…';
  const pubs = (data.publications || []).filter((p) => !p.masque).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  async function publier() {
    const texte = (type === 'performance' ? (txt.trim() ? texteAuto + ' — ' + txt.trim() : texteAuto) : txt.trim());
    if (!texte) return;
    setBusy(true);
    try {
      const row = { client_id: client.id, type, texte, data: type === 'performance' && perf ? { ecart, semaines: perf.semaines } : {}, visibilite: vis };
      const r = await insertRow('publications', row);
      setData((d) => ({ ...d, publications: [{ ...row, id: r?.id || Math.random().toString(36), created_at: new Date().toISOString(), masque: false }, ...(d.publications || [])] }));
      setTxt(''); toast(tr('Publié ✨', 'Posted ✨', 'Navoaka ✨'));
    } catch (e) { erreur(toast)(e); }
    setBusy(false);
  }
  async function reagir(p, emoji) {
    const mien = (data.reactions || []).find((r) => r.publication_id === p.id && r.client_id === client.id);
    try {
      if (mien && mien.emoji === emoji) { await supprimer('reactions', { publication_id: p.id, client_id: client.id }); setData((d) => ({ ...d, reactions: d.reactions.filter((r) => !(r.publication_id === p.id && r.client_id === client.id)) })); }
      else {
        if (mien) await supprimer('reactions', { publication_id: p.id, client_id: client.id });
        await insertRow('reactions', { publication_id: p.id, client_id: client.id, emoji });
        setData((d) => ({ ...d, reactions: [...(d.reactions || []).filter((r) => !(r.publication_id === p.id && r.client_id === client.id)), { publication_id: p.id, client_id: client.id, emoji }] }));
      }
    } catch (e) { erreur(toast)(e); }
  }
  async function effacer(p) {
    if (!confirm(tr('Supprimer cette publication ?', 'Delete this post?', 'Hofafana?'))) return;
    try { await supprimer('publications', { id: p.id }); setData((d) => ({ ...d, publications: d.publications.filter((x) => x.id !== p.id) })); } catch (e) { erreur(toast)(e); }
  }
  return html`
    <section class="c-card composer">
      <div class="row gap"><${Avatar} nom=${moi.pseudo} /><div class="seg">${[['motivation', '🔥 ' + tr('Motivation', 'Motivation', 'Fampaherezana')], ['performance', '🏆 ' + tr('Mes progrès', 'My progress', 'Fandrosoako'), !perf], ['texte', '💬 ' + tr('Message', 'Post', 'Hafatra')]].map(([k, l, dis]) => html`<button class=${type === k ? 'on' : ''} disabled=${dis} onClick=${() => setType(k)}>${l}</button>`)}</div></div>
      ${type === 'performance' && perf && html`<div class="perf-chip">${ecart < 0 ? '📉' : '📈'} <b>${texteAuto}</b></div>`}
      <textarea rows="2" maxlength="900" value=${txt} onInput=${(e) => setTxt(e.target.value)} placeholder=${type === 'motivation' ? tr('Un mot pour motiver les autres…', 'A word to motivate others…', 'Teny fampaherezana…') : type === 'performance' ? tr('Ajoutez un commentaire (facultatif)', 'Add a comment (optional)', 'Fanamarihana (tsy voatery)') : tr('Quoi de neuf ?', 'What\'s new?', 'Inona no vaovao?')}></textarea>
      <div class="row between wrap gap"><select value=${vis} onChange=${(e) => setVis(e.target.value)} style="max-width:200px"><option value="amis">🤝 ${tr('Mes amis', 'My friends', 'Ny namako')}</option><option value="communaute">🌍 ${tr('Toute la communauté', 'Whole community', 'Ny fiaraha-monina')}</option></select>
        <button class="btn primary" disabled=${busy || (type !== 'performance' && !txt.trim())} onClick=${publier}>${tr('Publier', 'Post', 'Avoaka')}</button></div>
    </section>
    ${pubs.length === 0 && html`<div class="wa-empty">🌱<p>${tr('Rien pour l\'instant. Ajoutez des amis ou publiez le premier message !', 'Nothing yet. Add friends or post first!', 'Mbola tsy misy. Manampia namana na manorata voalohany!')}</p></div>`}
    ${pubs.map((p) => {
      const reacs = (data.reactions || []).filter((r) => r.publication_id === p.id);
      const mien = reacs.find((r) => r.client_id === client.id);
      return html`<article class="c-card post" key=${p.id}>
        <header class="row gap"><${Avatar} nom=${pseudo(p.client_id)} /><div class="grow"><b>${pseudo(p.client_id)}</b><small class="muted"> · ${depuis(p.created_at)} · ${p.visibilite === 'communaute' ? '🌍' : '🤝'}</small></div>
          ${p.type === 'performance' && html`<${Badge} tone="ok">🏆 ${tr('Progrès', 'Progress', 'Fandrosoana')}<//>`}${p.type === 'motivation' && html`<${Badge} tone="warn">🔥<//>`}
          ${p.client_id === client.id && html`<button class="icon-btn" onClick=${() => effacer(p)} aria-label=${tr('Supprimer', 'Delete', 'Fafao')}>🗑</button>`}</header>
        <p class="post-txt">${p.texte}</p>
        <div class="reacts">${EMOJIS.map((e) => { const n = reacs.filter((r) => r.emoji === e).length; return html`<button class=${'react' + (mien?.emoji === e ? ' on' : '')} onClick=${() => reagir(p, e)}>${e}${n ? html`<small>${n}</small>` : null}</button>`; })}</div>
      </article>`;
    })}`;
}

function Amis({ client, moi }) {
  const { data, setData, toast } = useApp();
  const [q, setQ] = useState('');
  const liens = (data.amis || []).filter((a) => a.de === client.id || a.a === client.id);
  const etat = (cid) => liens.find((a) => (a.de === cid || a.a === cid));
  const pseudo = (cid) => (data.communaute || []).find((c) => c.client_id === cid)?.pseudo || '…';
  const recues = liens.filter((a) => a.a === client.id && a.statut === 'attente');
  const envoyees = liens.filter((a) => a.de === client.id && a.statut === 'attente');
  const amis = liens.filter((a) => a.statut === 'accepte');
  const membres = (data.communaute || []).filter((c) => c.visible && c.client_id !== client.id && (!q || c.pseudo.toLowerCase().includes(q.toLowerCase())));
  async function demander(cid) {
    try { const row = { de: client.id, a: cid, statut: 'attente' }; const r = await insertRow('amis', row); setData((d) => ({ ...d, amis: [...(d.amis || []), { ...row, id: r?.id || Math.random().toString(36), created_at: new Date().toISOString() }] })); toast(tr('Demande envoyée 📨', 'Request sent 📨', 'Lasa ny fangatahana 📨')); } catch (e) { erreur(toast)(e); }
  }
  async function repondre(a, statut) {
    try { await updateRow('amis', a.id, { statut }); setData((d) => ({ ...d, amis: d.amis.map((x) => (x.id === a.id ? { ...x, statut } : x)) })); if (statut === 'accepte') toast(tr('Vous êtes maintenant amis 🤝', 'You are now friends 🤝', 'Mpinamana ianareo izao 🤝')); } catch (e) { erreur(toast)(e); }
  }
  async function retirer(a) {
    if (!confirm(tr('Retirer ce lien ?', 'Remove this connection?', 'Esorina?'))) return;
    try { await supprimer('amis', { id: a.id }); setData((d) => ({ ...d, amis: d.amis.filter((x) => x.id !== a.id) })); } catch (e) { erreur(toast)(e); }
  }
  const autre = (a) => (a.de === client.id ? a.a : a.de);
  return html`
    ${recues.length > 0 && html`<section class="c-card"><h2>📨 ${tr('Demandes reçues', 'Requests received', 'Fangatahana voaray')}</h2>
      ${recues.map((a) => html`<div class="person"><${Avatar} nom=${pseudo(a.de)} /><b class="grow">${pseudo(a.de)}</b><button class="btn small primary" onClick=${() => repondre(a, 'accepte')}>✓ ${tr('Accepter', 'Accept', 'Ekena')}</button><button class="btn small ghost" onClick=${() => repondre(a, 'refuse')}>✕</button></div>`)}</section>`}
    <section class="c-card"><h2>🤝 ${tr('Mes amis', 'My friends', 'Ny namako')} (${amis.length})</h2>
      ${amis.length === 0 && html`<p class="muted small">${tr('Cherchez des membres ci-dessous et envoyez une demande.', 'Search members below and send a request.', 'Tadiavo eto ambany ny mpikambana.')}</p>`}
      ${amis.map((a) => html`<div class="person"><${Avatar} nom=${pseudo(autre(a))} /><b class="grow">${pseudo(autre(a))}</b><a class="btn small" href=${'#/messages?c=' + encodeURIComponent(dmId(client.id, autre(a)))}>💬</a><button class="btn small ghost" onClick=${() => retirer(a)}>${tr('Retirer', 'Remove', 'Esory')}</button></div>`)}
    </section>
    <section class="c-card"><h2>🔎 ${tr('Trouver des membres', 'Find members', 'Hitady mpikambana')}</h2>
      <input type="search" placeholder=${tr('Pseudo…', 'Nickname…', 'Anarana…')} value=${q} onInput=${(e) => setQ(e.target.value)} />
      ${membres.slice(0, 30).map((m) => { const l = etat(m.client_id); return html`<div class="person"><${Avatar} nom=${m.pseudo} /><span class="grow"><b>${m.pseudo}</b>${m.bio && html`<small class="muted d-block">${m.bio}</small>`}</span>
        ${!l ? html`<button class="btn small primary" onClick=${() => demander(m.client_id)}>+ ${tr('Ajouter', 'Add', 'Ampio')}</button>` : l.statut === 'accepte' ? html`<${Badge} tone="ok">✓ ${tr('Ami', 'Friend', 'Namana')}<//>` : l.statut === 'attente' ? html`<${Badge}>${l.de === client.id ? tr('Envoyée', 'Sent', 'Lasa') : tr('À accepter', 'To accept', 'Ekena')}<//>` : html`<${Badge} tone="muted">—<//>`}</div>`; })}
      ${envoyees.length > 0 && html`<p class="tiny muted">${envoyees.length} ${tr('demande(s) en attente de réponse', 'pending request(s)', 'fangatahana miandry')}</p>`}
    </section>
    <section class="c-card"><h2>👤 ${tr('Mon profil communauté', 'My community profile', 'Ny momba ahy')}</h2><div class="person"><${Avatar} nom=${moi.pseudo} /><span class="grow"><b>${moi.pseudo}</b><small class="muted d-block">${moi.bio || ''}</small></span><${Badge}>${moi.visible ? tr('Visible', 'Visible', 'Hita') : tr('Masqué', 'Hidden', 'Miafina')}<//></div></section>`;
}

function AvisClient({ client }) {
  const { data } = useApp();
  const [plat, setPlat] = useState('');
  const derLiv = (data.livraisons || []).filter((l) => l.client_id === client.id && l.statut === 'livree' && l.livreur_id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const platsVus = useMemo(() => {
    const ids = new Set();
    for (const c of data.calendrier || []) { const m = (data.menus || []).find((x) => x.id === c.menu_id); (m?.repas || []).forEach((r) => r.plat_id && ids.add(r.plat_id)); }
    return data.plats.filter((p) => ids.has(p.id));
  }, [data.calendrier, data.menus]);
  const publics = (data.avis || []).filter((a) => !a.masque);
  const moy = moyenne(publics.filter((a) => a.cible_type === 'service'));
  return html`
    <section class="c-card"><${AvisForm} client=${client} cible_type="service" titre=${'🍽️ ' + tr('Votre avis sur Sakafo Sur Mesure', 'Your review of Sakafo Sur Mesure', 'Ny hevitrao momba ny Sakafo')} /></section>
    ${derLiv && html`<section class="c-card"><${AvisForm} client=${client} cible_type="livreur" cible_id=${derLiv.livreur_id} titre=${'🛵 ' + tr('La livraison du ', 'Delivery of ', 'Ny fanaterana tamin\'ny ') + new Date(derLiv.date).toLocaleDateString('fr-FR')} /></section>`}
    <section class="c-card"><b>🍲 ${tr('Noter un plat', 'Rate a dish', 'Hanome naoty sakafo')}</b>
      <select value=${plat} onChange=${(e) => setPlat(e.target.value)}><option value="">—</option>${platsVus.map((p) => html`<option value=${p.id}>${platTitle(p)}</option>`)}</select>
      ${plat && html`<${AvisForm} client=${client} cible_type="plat" cible_id=${plat} key=${plat} />`}</section>
    <section class="c-card"><div class="row between"><h2>💬 ${tr('Avis des clients', 'Customer reviews', 'Hevitry ny mpanjifa')}</h2>${moy && html`<span class="row gap"><${Etoiles} note=${Math.round(moy)} size=${16} /><b>${fmt(moy, 1)}</b></span>`}</div>
      <${AvisListe} avis=${publics} data=${data} max=${15} /></section>`;
}
