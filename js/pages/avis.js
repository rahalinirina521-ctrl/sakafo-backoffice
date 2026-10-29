// Avis, communauté (modération) et incidents livreurs — vue admin.
import { html, useState } from '../lib.js?v=202610291423';
import { useApp, Badge, Empty } from '../ui.js?v=202610291423';
import { tr, platTitle } from '../i18n.js?v=202610291423';
import { fmt } from '../calc.js?v=202610291423';
import { updateRow, supprimer } from '../db.js?v=202610291423';
import { Etoiles, moyenne, Avatar, incidentLabel } from '../client/social.js?v=202610291423';
import { heure } from '../map.js?v=202610291423';
import { depuis } from './livreurs.js?v=202610291423';

export function AvisAdmin() {
  const app = useApp();
  const { data, setData, toast } = app;
  const [onglet, setOnglet] = useState('avis');
  const [type, setType] = useState('');
  const [note, setNote] = useState('');
  const [rep, setRep] = useState({});
  const avis = (data.avis || []).filter((a) => (!type || a.cible_type === type) && (!note || (note === 'bas' ? a.note <= 3 : a.note >= 4))).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const tous = data.avis || [];
  const cible = (a) => (a.cible_type === 'plat' ? '🍲 ' + platTitle(data.plats.find((p) => p.id === a.cible_id) || { nom: a.cible_id }) : a.cible_type === 'livreur' ? '🛵 ' + ((data.livreurs || []).find((l) => l.id === a.cible_id)?.nom || a.cible_id) : '🍽️ ' + tr('Service', 'Service', 'Serivisy'));
  const client = (cid) => (data.clients || []).find((c) => c.id === cid)?.nom || cid;
  const maj = (table, id, p) => updateRow(table, id, p).then(() => setData((d) => ({ ...d, [table]: d[table].map((x) => (x.id === id ? { ...x, ...p } : x)) }))).catch((e) => toast(e.message, 'bad'));
  const suppr = (table, id) => confirm(tr('Supprimer définitivement ?', 'Delete permanently?', 'Hofafana tanteraka?')) && supprimer(table, { id }).then(() => setData((d) => ({ ...d, [table]: d[table].filter((x) => x.id !== id) }))).catch((e) => toast(e.message, 'bad'));
  const incidents = (data.incidents || []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const enCours = incidents.filter((i) => i.statut === 'en_cours').length;
  const pubs = (data.publications || []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const pseudo = (cid) => (data.communaute || []).find((c) => c.client_id === cid)?.pseudo || client(cid);
  const stat = (t) => { const l = tous.filter((a) => a.cible_type === t); return { n: l.length, m: moyenne(l) }; };

  return html`<div class="page">
    <h1>⭐ ${tr('Avis & communauté', 'Reviews & community', 'Hevitra & fiaraha-monina')}</h1>
    <div class="kpis">${[['service', '🍽️', tr('Service', 'Service', 'Serivisy')], ['plat', '🍲', tr('Plats', 'Dishes', 'Sakafo')], ['livreur', '🛵', tr('Livraison', 'Delivery', 'Fanaterana')]].map(([t, ic, l]) => { const s = stat(t); return html`<div class="kpi"><small>${ic} ${l}</small><b>${s.m ? fmt(s.m, 1) + ' ★' : '—'}</b><small>${s.n} ${tr('avis', 'reviews', 'hevitra')}</small></div>`; })}
      <div class="kpi"><small>👥 ${tr('Membres', 'Members', 'Mpikambana')}</small><b>${(data.communaute || []).length}</b><small>${(data.amis || []).filter((a) => a.statut === 'accepte').length} ${tr('amitiés', 'friendships', 'fifandraisana')}</small></div>
      <div class=${'kpi' + (enCours ? ' kpi-alert' : '')}><small>⚠️ ${tr('Incidents en cours', 'Open incidents', 'Olana mbola misy')}</small><b>${enCours}</b></div></div>
    <div class="seg big">${[['avis', '⭐ ' + tr('Avis', 'Reviews', 'Hevitra')], ['pubs', '📰 ' + tr('Publications', 'Posts', 'Lahatsoratra')], ['incidents', '⚠️ ' + tr('Incidents', 'Incidents', 'Olana'), enCours]].map(([k, l, n]) => html`<button class=${onglet === k ? 'on' : ''} onClick=${() => setOnglet(k)}>${l}${n ? html` <i class="wa-badge">${n}</i>` : null}</button>`)}</div>

    ${onglet === 'avis' && html`
      <div class="filters row gap wrap"><select value=${type} onChange=${(e) => setType(e.target.value)} style="max-width:200px"><option value="">${tr('Tous les avis', 'All reviews', 'Hevitra rehetra')}</option><option value="service">🍽️ Service</option><option value="plat">🍲 ${tr('Plats', 'Dishes', 'Sakafo')}</option><option value="livreur">🛵 ${tr('Livraison', 'Delivery', 'Fanaterana')}</option></select>
        <select value=${note} onChange=${(e) => setNote(e.target.value)} style="max-width:200px"><option value="">${tr('Toutes les notes', 'All ratings', 'Naoty rehetra')}</option><option value="bas">😕 1 à 3 ★</option><option value="haut">😀 4 et 5 ★</option></select></div>
      ${avis.length === 0 ? html`<${Empty}>${tr('Aucun avis pour le moment.', 'No reviews yet.', 'Mbola tsy misy hevitra.')}<//>` : avis.map((a) => html`<section class=${'card avis-admin' + (a.masque ? ' masque' : '')} key=${a.id}>
        <div class="row gap wrap between"><span class="row gap"><${Avatar} nom=${client(a.client_id)} size=${34} /><span><b>${client(a.client_id)}</b><small class="muted d-block">${cible(a)} · ${depuis(a.created_at)}</small></span></span><${Etoiles} note=${a.note} size=${18} /></div>
        ${a.commentaire && html`<p>${a.commentaire}</p>`}
        ${a.reponse && html`<p class="avis-rep">🧑‍🍳 ${a.reponse}</p>`}
        <div class="row gap wrap"><input placeholder=${tr('Répondre publiquement…', 'Reply publicly…', 'Hamaly…')} value=${rep[a.id] ?? ''} onInput=${(e) => setRep({ ...rep, [a.id]: e.target.value })} style="flex:1;min-width:200px" />
          <button class="btn small primary" disabled=${!(rep[a.id] || '').trim()} onClick=${() => { maj('avis', a.id, { reponse: rep[a.id].trim() }); setRep({ ...rep, [a.id]: '' }); }}>${tr('Répondre', 'Reply', 'Hamaly')}</button>
          <button class="btn small" onClick=${() => maj('avis', a.id, { masque: !a.masque })}>${a.masque ? '👁 ' + tr('Afficher', 'Show', 'Asehoy') : '🙈 ' + tr('Masquer', 'Hide', 'Afeno')}</button>
          <a class="btn small ghost" href=${'#/messages?c=client:' + a.client_id}>💬</a></div>
      </section>`)}`}

    ${onglet === 'pubs' && (pubs.length === 0 ? html`<${Empty}>${tr('Aucune publication.', 'No posts.', 'Tsy misy.')}<//>` : pubs.map((p) => html`<section class=${'card' + (p.masque ? ' masque' : '')} key=${p.id}>
        <div class="row gap between wrap"><span class="row gap"><${Avatar} nom=${pseudo(p.client_id)} size=${32} /><b>${pseudo(p.client_id)}</b><small class="muted">${depuis(p.created_at)} · ${p.visibilite === 'communaute' ? '🌍' : '🤝'}</small></span>
          <span class="row gap"><button class="btn small" onClick=${() => maj('publications', p.id, { masque: !p.masque })}>${p.masque ? tr('Afficher', 'Show', 'Asehoy') : tr('Masquer', 'Hide', 'Afeno')}</button><button class="btn small ghost danger" onClick=${() => suppr('publications', p.id)}>🗑</button></span></div>
        <p>${p.texte}</p><small class="muted">${(data.reactions || []).filter((r) => r.publication_id === p.id).map((r) => r.emoji).join(' ')}</small>
      </section>`))}

    ${onglet === 'incidents' && (incidents.length === 0 ? html`<${Empty}>${tr('Aucun incident signalé.', 'No incident reported.', 'Tsy misy olana voalaza.')}<//>` : incidents.map((i) => html`<section class=${'card incident-card' + (i.statut === 'en_cours' ? ' live' : '')} key=${i.id}>
        <div class="row gap between wrap"><b>${incidentLabel(i.type)} — ${(data.livreurs || []).find((l) => l.id === i.livreur_id)?.nom || i.livreur_id}</b>
          <${Badge} tone=${i.statut === 'en_cours' ? 'bad' : 'ok'}>${i.statut === 'en_cours' ? tr('En cours', 'Ongoing', 'Mbola misy') : tr('Résolu', 'Resolved', 'Voavaha') + (i.resolu_at ? ' ' + heure(i.resolu_at) : '')}<//></div>
        <small class="muted">${new Date(i.created_at).toLocaleString('fr-FR')} · ${tr('retard annoncé', 'announced delay', 'tara voalaza')} +${i.duree_min} min</small>
        ${i.description && html`<p>${i.description}</p>`}
        <div class="row gap wrap">${i.statut === 'en_cours' && html`<button class="btn small primary" onClick=${() => maj('incidents', i.id, { statut: 'resolu', resolu_at: new Date().toISOString() })}>✅ ${tr('Marquer résolu', 'Mark resolved', 'Voavaha')}</button><a class="btn small" href="#/livraisons">🛵 ${tr('Réassigner les livraisons', 'Reassign deliveries', 'Afindra ny fanaterana')}</a>`}
          ${i.lat && html`<a class="btn small ghost" target="_blank" rel="noopener" href=${`https://www.google.com/maps?q=${i.lat},${i.lng}`}>📍 ${tr('Position', 'Location', 'Toerana')}</a>`}<a class="btn small ghost" href=${'#/messages?c=livreur:' + i.livreur_id}>💬</a></div>
      </section>`))}
  </div>`;
}
