// Clients : objectif, calories cibles (avec calculateur), allergies, lien vers son planning.
import { html, useState } from '../lib.js?v=202610291427';
import { useApp, Card, Field, Badge, Empty, Modal } from '../ui.js?v=202610291427';
import { nextId, fmt, toNum, isoDate, uid } from '../calc.js?v=202610291427';
import { tr, catName } from '../i18n.js?v=202610291427';
import { AddressField, MapLinks, hasGps } from '../address.js?v=202610291427';
import { analyse, typeObjectif } from '../conseil.js?v=202610291427';
import { ProfilFields, AnalysePanel, WeightChart } from '../conseil-ui.js?v=202610291427';
import { aboStatut } from '../metier.js?v=202610291427';
export { aboStatut };

export const FORMULES = () => [['livraison', tr('🛵 Livraison (repas cuisinés)', '🛵 Delivery (cooked meals)', '🛵 Fanaterana (sakafo masaka)')], ['conseil', tr('📋 Prescription sans livraison (le client cuisine)', '📋 Meal plan, no delivery (customer cooks)', '📋 Torolalana sakafo, tsy misy fanaterana (izy no mahandro)')]];
export const CRENEAUX = () => [['matin', tr('Matin', 'Morning', 'Maraina')], ['midi', tr('Midi', 'Noon', 'Atoandro')], ['soir', tr('Soir', 'Evening', 'Hariva')]];


export function Clients() {
  const app = useApp();
  const { data, toast } = app;
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState('');
  const idUrl = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  const [edit, setEdit] = useState(() => { const c = idUrl && (data.clients || []).find((x) => x.id === idUrl); return c ? { ...c, profil: c.profil || {} } : null; });
  const nouveau = (c) => !c.abonnement_fin && c.created_at && Date.now() - Date.parse(c.created_at) < 14 * 864e5;
  const F = { nouveaux: nouveau, sans: (c) => !aboStatut(c).actif, actifs: (c) => aboStatut(c).actif };
  const clients = [...(data.clients || [])]
    .filter((c) => !q || `${c.nom} ${c.telephone || ''} ${c.email || ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter((c) => !filtre || F[filtre](c))
    .sort((a, b) => (nouveau(b) - nouveau(a)) || a.nom.localeCompare(b.nom));
  const daysOf = (id) => (data.calendrier || []).filter((c) => c.client_id === id).length;

  async function save(row) {
    if (!(row.nom || '').trim()) { toast(tr('Indiquez le nom', 'Enter the name', 'Soraty ny anarana'), 'bad'); return; }
    try { await app.save('clients', { ...row, nom: row.nom.trim(), kcal_cible: toNum(row.kcal_cible) }); setEdit(null); toast(tr('Client enregistré', 'Customer saved', 'Voatahiry ny client')); } catch (e) { toast(e.message, 'bad'); }
  }
  async function del(row) {
    if (!confirm(tr(`Supprimer ${row.nom} et son planning personnalisé ?`, `Delete ${row.nom} and their personal planning?`, `Hofafana ve i ${row.nom} sy ny planning-ny?`))) return;
    try { await app.del('clients', row.id); setEdit(null); } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="page">
    <div class="page-head">
      <h1>Clients <span class="muted">(${(data.clients || []).length})</span></h1>
      <button class="btn primary" onClick=${() => setEdit({ id: nextId('CL', data.clients || []), nom: '', categorie_id: data.categories[0]?.id || null, actif: true, profil: {} })}>+ ${tr('Client', 'Customer', 'Client')}</button>
    </div>
    <div class="filters"><input type="search" placeholder=${tr('Rechercher (nom, téléphone, e-mail)…', 'Search (name, phone, e-mail)…', 'Hikaroka…')} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    <div class="tabs">${[['', tr('Tous', 'All', 'Rehetra')], ['nouveaux', '🆕 ' + tr('Nouveaux inscrits', 'New sign-ups', 'Vao nisoratra')], ['sans', tr('Sans abonnement', 'No subscription', 'Tsy misy abonnement')], ['actifs', tr('Abonnés actifs', 'Active subscribers', 'Mavitrika')]].map(([k, l]) => html`<button class=${'tab' + (filtre === k ? ' on' : '')} onClick=${() => setFiltre(k)}>${l} (${(data.clients || []).filter((c) => !k || F[k](c)).length})</button>`)}</div>
    ${clients.length === 0 ? html`<${Empty}>${tr('Aucun client. Ajoutez vos abonnés pour leur faire un menu personnalisé.', 'No customer yet. Add your subscribers to give them a personal menu.', 'Mbola tsy misy client. Ampidiro ny mpanjifa mba hanaovana menu manokana ho azy.')}<//>` : html`
    <div class="table-wrap"><table class="table resp">
      <thead><tr><th>${tr('Nom', 'Name', 'Anarana')}</th><th>${tr('Téléphone', 'Phone', 'Finday')}</th><th>${tr('Adresse', 'Address', 'Adiresy')}</th><th>${tr('Objectif', 'Goal', 'Tanjona')}</th><th class="num">${tr('Kcal / jour', 'Kcal / day', 'Kcal / andro')}</th><th>${tr('Formule', 'Plan', 'Formule')}</th><th>${tr('Compte app', 'App account', 'Kaonty app')}</th><th>${tr('Planning', 'Planning', 'Planning')}</th></tr></thead>
      <tbody>${clients.map((c) => html`<tr class="clickable" onClick=${() => setEdit({ ...c, profil: c.profil || {} })}>
        <td><b>${c.nom}</b>${nouveau(c) ? html` <${Badge} tone="info">🆕 ${tr('nouveau', 'new', 'vaovao')}<//>` : null}${c.actif === false ? html` <${Badge}>${tr('inactif', 'inactive', 'tsy mavitrika')}<//>` : null}</td>
        <td>${c.telephone ? html`<a href=${'tel:' + c.telephone} onClick=${(e) => e.stopPropagation()}>${c.telephone}</a>` : '—'}</td>
        <td class="small"><span class="addr-cell">${c.adresse || '—'}${c.repere ? html`<span class="muted"> · ${c.repere}</span>` : null}${hasGps(c) ? html` <span class="badge ok">GPS</span>` : null}</span><${MapLinks} o=${c} /></td>
        <td>${catName(data.categories.find((x) => x.id === c.categorie_id))}</td>
        <td class="num">${fmt(c.kcal_cible)}</td>
        <td class="small">${c.formule === 'conseil' ? '📋' : '🛵'} <${Badge} tone=${aboStatut(c).tone}>${aboStatut(c).label}<//></td>
        <td class="small">${c.user_id ? html`<${Badge} tone="ok">✓ ${tr('connecté', 'linked', 'mifandray')}<//>` : c.email ? html`<span class="muted">${tr('en attente d\'inscription', 'awaiting sign-up', 'miandry fisoratana')}</span>` : '—'}</td>
        <td><a href=${'#/planning?client=' + c.id} onClick=${(e) => e.stopPropagation()}>${daysOf(c.id) ? daysOf(c.id) + ' ' + tr('j perso', 'custom d', 'andro manokana') : tr('Voir', 'View', 'Jereo')} →</a></td>
      </tr>`)}</tbody>
    </table></div>`}
    ${edit && html`<${ClientForm} row=${edit} onClose=${() => setEdit(null)} onSave=${save} onDelete=${del} isNew=${!(data.clients || []).some((x) => x.id === edit.id)} />`}
  </div>`;
}

function ClientForm({ row, onClose, onSave, onDelete, isNew }) {
  const app = useApp();
  const { data, toast } = app;
  const [f, setF] = useState(row);
  const [pesee, setPesee] = useState({ date: isoDate(new Date()), poids: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const cat = data.categories.find((c) => c.id === f.categorie_id);
  const type = typeObjectif(cat);
  const mesures = (data.mesures || []).filter((m) => m.client_id === f.id).sort((a, b) => a.date.localeCompare(b.date));
  const a = analyse(f.profil || {}, type, mesures);
  const cre = f.creneaux || ['midi'];
  async function addPesee() {
    if (!toNum(pesee.poids)) return;
    try {
      await app.save('mesures', { id: 'MS-' + uid(), client_id: f.id, date: pesee.date, poids: toNum(pesee.poids) });
      setF((x) => ({ ...x, profil: { ...(x.profil || {}), poids: toNum(pesee.poids) } }));
      setPesee({ ...pesee, poids: '' });
    } catch (e) { toast(e.message, 'bad'); }
  }
  return html`<${Modal} title=${isNew ? tr('Nouveau client', 'New customer', 'Client vaovao') : f.nom} onClose=${onClose} wide>
    <div class="form-grid">
      <${Field} label=${tr('Nom', 'Name', 'Anarana')}><input value=${f.nom || ''} onInput=${(e) => set('nom', e.target.value)} /><//>
      <${Field} label=${tr('Téléphone', 'Phone', 'Finday')}><input type="tel" value=${f.telephone || ''} onInput=${(e) => set('telephone', e.target.value)} /><//>
      <${AddressField} value=${{ adresse: f.adresse, repere: f.repere, lat: f.lat, lng: f.lng, maps_url: f.maps_url }} onChange=${(ad) => setF((x) => ({ ...x, ...ad }))} />
    </div>

    <${Card} title=${'🔐 ' + tr('Compte et abonnement', 'Account and subscription', 'Kaonty sy abonnement')} class="inner">
      <div class="form-grid">
        <${Field} label=${tr('E-mail du compte (application client)', 'Account e-mail (customer app)', 'Mailaka (app client)')} hint=${f.user_id ? '✓ ' + tr('Compte relié', 'Account linked', 'Kaonty mifandray') : tr('Le client s\'inscrit dans l\'application avec cet e-mail : son compte est relié automatiquement.', 'The customer signs up in the app with this e-mail: the account is linked automatically.', 'Misoratra amin\'ity mailaka ity ny client: mifandray ho azy ny kaontiny.')}><input type="email" value=${f.email || ''} onInput=${(e) => set('email', e.target.value.trim().toLowerCase())} /><//>
        ${!f.user_id && !isNew && html`<div class="field wide"><${CreerCompte} client=${f} onDone=${(email) => setF((x) => ({ ...x, email }))} /></div>`}
        ${f.profil?.formule_souhaitee && html`<div class="field wide"><div class="info-box">🛎️ ${tr('Le client a demandé', 'Customer requested', 'Nangatahin\'ny client')} : <b>${f.profil.formule_souhaitee === 'conseil' ? '📋 ' + tr('Prescription', 'Meal plan', 'Torolalana') : '🛵 ' + tr('Livraison', 'Delivery', 'Fanaterana')}</b>${(data.offres || []).find((o) => o.id === f.profil.offre_souhaitee) ? ' · ' + (data.offres || []).find((o) => o.id === f.profil.offre_souhaitee).nom : ''} <button type="button" class="link-btn" onClick=${() => { const o = (data.offres || []).find((x) => x.id === f.profil.offre_souhaitee); setF((x) => ({ ...x, formule: f.profil.formule_souhaitee, ...(o ? { offre_id: o.id, abonnement_debut: isoDate(new Date()), abonnement_fin: isoDate(new Date(Date.now() + (o.nb_jours - 1) * 864e5)) } : {}) })); }}>${tr('Appliquer', 'Apply', 'Ampiharo')}</button></div></div>`}
        <${Field} label=${tr('Formule', 'Plan type', 'Karazana')}><select value=${f.formule || 'livraison'} onChange=${(e) => set('formule', e.target.value)}>${FORMULES().map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select><//>
        <${Field} label=${tr('Abonnement', 'Subscription', 'Abonnement')}><select value=${f.offre_id || ''} onChange=${(e) => { const o = (data.offres || []).find((x) => x.id === e.target.value); setF((x) => ({ ...x, offre_id: e.target.value || null, ...(o && !x.abonnement_debut ? { abonnement_debut: isoDate(new Date()), abonnement_fin: isoDate(new Date(Date.now() + (o.nb_jours - 1) * 864e5)) } : {}) })); }}><option value="">—</option>${(data.offres || []).filter((o) => o.actif !== false).map((o) => html`<option value=${o.id}>${o.nom} (${o.nb_jours} j)</option>`)}</select><//>
        <${Field} label=${tr('Début', 'Start', 'Fanombohana')}><input type="date" value=${f.abonnement_debut || ''} onInput=${(e) => set('abonnement_debut', e.target.value || null)} /><//>
        <${Field} label=${tr('Fin', 'End', 'Fiafarana')} hint=${aboStatut(f).label}><input type="date" value=${f.abonnement_fin || ''} onInput=${(e) => set('abonnement_fin', e.target.value || null)} /><//>
        ${f.formule !== 'conseil' && html`<${Field} label=${tr('Livraisons', 'Deliveries', 'Fanaterana')}><span class="row gap wrap">${CRENEAUX().map(([v, l]) => html`<label class="check"><input type="checkbox" checked=${cre.includes(v)} onChange=${(e) => set('creneaux', e.target.checked ? [...new Set([...cre, v])] : cre.filter((x) => x !== v))} /> ${l}</label>`)}</span><//>`}
      </div>
    <//>

    <${Card} title=${'🎯 ' + tr('Objectif et avis automatique', 'Goal and automatic advice', 'Tanjona sy torohevitra')} class="inner">
      <div class="form-grid">
        <${Field} label=${tr('Objectif', 'Goal', 'Tanjona')}><select value=${f.categorie_id || ''} onChange=${(e) => set('categorie_id', e.target.value || null)}>${[...data.categories].sort((x, y) => (x.ordre || 0) - (y.ordre || 0)).map((c) => html`<option value=${c.id}>${c.icone || ''} ${catName(c)}${c.statut === 'attente' ? ' (' + tr('en attente', 'on hold', 'miandry') + ')' : ''}</option>`)}</select><//>
        <${Field} label=${tr('Calories cibles / jour', 'Target calories / day', 'Kcal tanjona / andro')} hint=${tr('Vide = cible de l\'objectif', 'Empty = goal target', 'Foana = an\'ny tanjona')}><input type="number" value=${f.kcal_cible ?? ''} onInput=${(e) => set('kcal_cible', e.target.value)} /><//>
      </div>
      <${ProfilFields} profil=${f.profil || {}} type=${type} onChange=${(p) => set('profil', p)} />
      <${AnalysePanel} a=${a} onUseKcal=${(k) => set('kcal_cible', k)} showRefs />
    <//>

    ${!isNew && html`<${Card} title=${'📈 ' + tr('Suivi du poids', 'Weight tracking', 'Fanaraha-maso ny lanja')} class="inner">
      <${WeightChart} mesures=${mesures} prevision=${a.prevision} cible=${f.profil?.poids_cible} />
      <div class="row gap wrap">
        <input type="date" value=${pesee.date} onInput=${(e) => setPesee({ ...pesee, date: e.target.value })} style="max-width:170px" />
        <input type="number" step="0.1" inputmode="decimal" placeholder="kg" value=${pesee.poids} onInput=${(e) => setPesee({ ...pesee, poids: e.target.value })} style="max-width:110px" />
        <button class="btn small" onClick=${addPesee}>+ ${tr('Pesée', 'Weigh-in', 'Lanja')}</button>
        <span class="muted small">${mesures.length} ${tr('mesure(s)', 'record(s)', 'refy')}</span>
      </div>
    <//>`}

    <div class="form-grid">
      <${Field} label=${tr('Allergies / aliments exclus', 'Allergies / excluded foods', 'Allergies / sakafo tsy hohanina')} wide><input value=${f.allergies || ''} onInput=${(e) => set('allergies', e.target.value)} /><//>
      <${Field} label=${tr('Notes internes (non visibles par le client)', 'Internal notes (not visible to customer)', 'Fanamarihana anatiny (tsy hitan\'ny client)')} wide><textarea rows="2" value=${f.notes || ''} onInput=${(e) => set('notes', e.target.value)}></textarea><//>
      <label class="check wide"><input type="checkbox" checked=${f.actif !== false} onChange=${(e) => set('actif', e.target.checked)} /> ${tr('Client actif', 'Active customer', 'Client mavitrika')}</label>
    </div>
    <div class="row gap between wrap">
      ${!isNew ? html`<span class="row gap wrap"><button class="btn danger ghost" onClick=${() => onDelete(f)}>${tr('Supprimer', 'Delete', 'Fafao')}</button><a class="btn" href=${'#/planning?client=' + f.id}>${tr('Son planning', 'Their planning', 'Ny planning-ny')} →</a><a class="btn" href=${'#/messages?c=client:' + f.id}>💬 ${tr('Messages', 'Messages', 'Hafatra')}</a></span>` : html`<span></span>`}
      <span class="row gap"><button class="btn ghost" onClick=${onClose}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button><button class="btn primary" onClick=${() => onSave(f)}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button></span>
    </div>
  <//>`;
}

// L'admin crée le compte du client (e-mail + mot de passe provisoire à lui transmettre)
function CreerCompte({ client, onDone }) {
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(client.email || '');
  const [pwd] = useState(() => 'Sakafo-' + Math.random().toString(36).slice(2, 6) + Math.floor(10 + Math.random() * 89));
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const lien = location.href.split('#')[0].replace(/index\.html$/, '').replace(/[^/]*$/, '') + 'client.html';
  const texte = tr(`Bonjour ${client.nom} ! Votre espace Sakafo Sur Mesure : ${lien}\nE-mail : ${email}\nMot de passe provisoire : ${pwd}\n(à changer après la première connexion via « Mot de passe oublié »)`, `Hello ${client.nom}! Your Sakafo space: ${lien}\nE-mail: ${email}\nTemporary password: ${pwd}`, `Manao ahoana ${client.nom}! Ny toeranao Sakafo: ${lien}\nMailaka: ${email}\nTeny miafina vonjimaika: ${pwd}`);
  async function creer() {
    setBusy(true);
    try { await appelFonction('creer-compte', { client_id: client.id, email: email.trim().toLowerCase(), password: pwd, nom: client.nom }); setRes(true); onDone(email.trim().toLowerCase()); toast(tr('Compte créé et relié', 'Account created and linked', 'Vita ny kaonty')); } catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  }
  if (!open) return html`<button class="btn small" onClick=${() => setOpen(true)}>🔑 ${tr('Créer le compte de ce client', 'Create this customer\'s account', 'Hamorona ny kaontin\'ity client ity')}</button>`;
  return html`<div class="inner-box">
    ${!res ? html`<div class="row gap wrap"><input type="email" placeholder="e-mail" value=${email} onInput=${(e) => setEmail(e.target.value)} style="max-width:260px" /><span class="mono">${pwd}</span><button class="btn small primary" disabled=${busy || !email.includes('@')} onClick=${creer}>${busy ? '…' : tr('Créer', 'Create', 'Foronina')}</button></div>
      <small class="muted">${tr('Le client pourra se connecter tout de suite avec ce mot de passe provisoire.', 'The customer can sign in right away with this temporary password.', 'Afaka miditra avy hatrany amin\'ity teny miafina ity ny client.')}</small>`
      : html`<p class="ok-box small">✓ ${tr('Compte créé. Envoyez ces informations au client :', 'Account created. Send these details to the customer:', 'Vita. Alefaso amin\'ny client ireto:')}</p><pre class="small">${texte}</pre>
        <div class="row gap wrap">${client.telephone && html`<a class="btn small" target="_blank" rel="noopener" href=${'https://wa.me/' + client.telephone.replace(/\D/g, '').replace(/^0/, '261') + '?text=' + encodeURIComponent(texte)}>WhatsApp</a>`}<a class="btn small" href=${'sms:' + (client.telephone || '') + '?body=' + encodeURIComponent(texte)}>SMS</a></div>`}
  </div>`;
}
