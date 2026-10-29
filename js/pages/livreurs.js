// Livreurs : fiches, compte de l'application livreur, dernière position GPS.
import { html, useState } from '../lib.js?v=202610291427';
import { useApp, Field, Badge, Empty, Modal } from '../ui.js?v=202610291427';
import { nextId } from '../calc.js?v=202610291427';
import { tr } from '../i18n.js?v=202610291427';
import { COULEURS } from '../tournee.js?v=202610291427';
import { MapView } from '../map.js?v=202610291427';
import { param } from '../params.js?v=202610291427';

export const depuis = (iso) => {
  if (!iso) return '—';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return tr('à l\'instant', 'just now', 'izao');
  if (m < 60) return tr(`il y a ${m} min`, `${m} min ago`, `${m} min lasa`);
  const h = Math.round(m / 60);
  return h < 24 ? tr(`il y a ${h} h`, `${h} h ago`, `${h} ora lasa`) : new Date(iso).toLocaleDateString('fr-FR');
};

export function Livreurs() {
  const app = useApp();
  const { data, toast } = app;
  const [edit, setEdit] = useState(null);
  const livreurs = [...(data.livreurs || [])].sort((a, b) => a.nom.localeCompare(b.nom));
  const pos = (id) => (data.positions || []).find((p) => p.livreur_id === id);
  const depot = param(data, 'depot');

  async function save(f) {
    if (!(f.nom || '').trim()) { toast(tr('Indiquez le nom', 'Enter the name', 'Soraty ny anarana'), 'bad'); return; }
    try { await app.save('livreurs', { ...f, nom: f.nom.trim(), email: (f.email || '').trim().toLowerCase() || null }); setEdit(null); toast(tr('Livreur enregistré', 'Courier saved', 'Voatahiry')); } catch (e) { toast(e.message, 'bad'); }
  }
  async function del(f) {
    if (!confirm(tr(`Supprimer ${f.nom} ?`, `Delete ${f.nom}?`, `Hofafana ve i ${f.nom}?`))) return;
    try { await app.del('livreurs', f.id); setEdit(null); } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="page">
    <div class="page-head"><h1>${tr('Livreurs', 'Couriers', 'Mpitondra sakafo')}</h1>
      <button class="btn primary" onClick=${() => setEdit({ id: nextId('LR', livreurs, 3), nom: '', telephone: '', email: '', vehicule: 'Moto', couleur: COULEURS[livreurs.length % COULEURS.length], actif: true })}>+ ${tr('Livreur', 'Courier', 'Mpitondra')}</button></div>
    <p class="muted small">${tr('Chaque livreur se connecte à l\'application livreur (livreur.html) avec l\'e-mail indiqué ici : son compte est relié automatiquement.', 'Each courier signs in to the courier app (livreur.html) with the e-mail entered here: the account is linked automatically.', 'Miditra amin\'ny app livreur (livreur.html) amin\'ny mailaka voasoratra eto ny mpitondra tsirairay: mifandray ho azy ny kaontiny.')}</p>
    ${livreurs.length === 0 ? html`<${Empty}>${tr('Aucun livreur.', 'No courier yet.', 'Mbola tsy misy mpitondra.')}<//>` : html`
    <div class="table-wrap"><table class="table resp">
      <thead><tr><th>${tr('Nom', 'Name', 'Anarana')}</th><th>${tr('Téléphone', 'Phone', 'Finday')}</th><th>${tr('Véhicule', 'Vehicle', 'Fiara')}</th><th>${tr('Compte app', 'App account', 'Kaonty')}</th><th>${tr('Dernière position', 'Last position', 'Toerana farany')}</th><th></th></tr></thead>
      <tbody>${livreurs.map((l) => html`<tr class="clickable" onClick=${() => setEdit(l)}>
        <td><span class="dot" style=${{ background: l.couleur || '#2e7d32' }}></span> <b>${l.nom}</b>${l.actif === false ? html` <${Badge}>${tr('inactif', 'inactive', 'tsy mavitrika')}<//>` : null}</td>
        <td>${l.telephone ? html`<a href=${'tel:' + l.telephone} onClick=${(e) => e.stopPropagation()}>${l.telephone}</a>` : '—'}</td>
        <td>${l.vehicule || '—'}</td>
        <td class="small">${l.user_id ? html`<${Badge} tone="ok">✓ ${tr('relié', 'linked', 'mifandray')}<//>` : l.email ? html`<span class="muted">${l.email} · ${tr('pas encore inscrit', 'not signed up yet', 'mbola tsy nisoratra')}</span>` : '—'}</td>
        <td class="small">${pos(l.id) ? depuis(pos(l.id).updated_at) : '—'}</td>
        <td><a href=${'#/messages?c=livreur:' + l.id} onClick=${(e) => e.stopPropagation()}>💬</a></td>
      </tr>`)}</tbody>
    </table></div>
    <${MapView} height=${300} fitKey=${'lv' + livreurs.length} markers=${[{ ...depot, icon: 'kitchen', popup: depot.adresse }, ...livreurs.map((l) => pos(l.id) && { ...pos(l.id), icon: 'moto', color: l.couleur, popup: `${l.nom} · ${depuis(pos(l.id).updated_at)}` }).filter(Boolean)]} />`}
    ${edit && html`<${LivreurForm} row=${edit} onClose=${() => setEdit(null)} onSave=${save} onDelete=${del} isNew=${!livreurs.some((x) => x.id === edit.id)} />`}
  </div>`;
}

function LivreurForm({ row, onClose, onSave, onDelete, isNew }) {
  const [f, setF] = useState(row);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return html`<${Modal} title=${isNew ? tr('Nouveau livreur', 'New courier', 'Mpitondra vaovao') : f.nom} onClose=${onClose}>
    <div class="form-grid">
      <${Field} label=${tr('Nom', 'Name', 'Anarana')}><input value=${f.nom} onInput=${set('nom')} /><//>
      <${Field} label=${tr('Téléphone', 'Phone', 'Finday')}><input type="tel" value=${f.telephone || ''} onInput=${set('telephone')} /><//>
      <${Field} label=${tr('E-mail du compte', 'Account e-mail', 'Mailaka kaonty')} wide hint=${f.user_id ? '✓ ' + tr('Compte relié', 'Account linked', 'Mifandray') : ''}><input type="email" value=${f.email || ''} onInput=${set('email')} /><//>
      <${Field} label=${tr('Véhicule', 'Vehicle', 'Fiara')}><input value=${f.vehicule || ''} onInput=${set('vehicule')} placeholder="Moto, vélo…" /><//>
      <${Field} label=${tr('Couleur sur la carte', 'Map colour', 'Loko amin\'ny sarintany')}><span class="row gap wrap">${COULEURS.map((c) => html`<button type="button" class=${'swatch' + (f.couleur === c ? ' on' : '')} style=${{ background: c }} onClick=${() => setF({ ...f, couleur: c })} aria-label=${c}></button>`)}</span><//>
      <label class="check wide"><input type="checkbox" checked=${f.actif !== false} onChange=${set('actif')} /> ${tr('Actif', 'Active', 'Mavitrika')}</label>
    </div>
    <div class="row gap between wrap">
      ${!isNew ? html`<button class="btn danger ghost" onClick=${() => onDelete(f)}>${tr('Supprimer', 'Delete', 'Fafao')}</button>` : html`<span></span>`}
      <span class="row gap"><button class="btn ghost" onClick=${onClose}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button><button class="btn primary" onClick=${() => onSave(f)}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button></span>
    </div>
  <//>`;
}
