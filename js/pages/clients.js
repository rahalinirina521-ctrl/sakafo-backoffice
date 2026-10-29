// Clients : objectif, calories cibles (avec calculateur), allergies, lien vers son planning.
import { html, useState } from '../lib.js?v=202610290532';
import { useApp, Card, Field, Badge, Empty, Modal } from '../ui.js?v=202610290532';
import { nextId, besoinKcal, ACTIVITES, fmt, toNum } from '../calc.js?v=202610290532';
import { tr, catName } from '../i18n.js?v=202610290532';
import { AddressField, MapLinks, hasGps } from '../address.js?v=202610290532';

const AJUST = { 'perte-de-poids': -0.2, 'prise-de-masse': 0.15 };
const actLabel = (a) => ({
  sedentaire: tr('Sédentaire (bureau)', 'Sedentary (office)', 'Tsy mihetsika (birao)'),
  leger: tr('Peu actif', 'Lightly active', 'Mihetsika kely'),
  modere: tr('Actif (sport 3×/sem.)', 'Active (sport 3×/wk)', 'Mihetsika (fanatanjahantena 3×)'),
  intense: tr('Très actif', 'Very active', 'Mihetsika be'),
}[a]);

export function Clients() {
  const app = useApp();
  const { data, toast } = app;
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const clients = [...(data.clients || [])]
    .filter((c) => !q || `${c.nom} ${c.telephone || ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.nom.localeCompare(b.nom));
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
    <div class="filters"><input type="search" placeholder=${tr('Rechercher…', 'Search…', 'Hikaroka…')} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    ${clients.length === 0 ? html`<${Empty}>${tr('Aucun client. Ajoutez vos abonnés pour leur faire un menu personnalisé.', 'No customer yet. Add your subscribers to give them a personal menu.', 'Mbola tsy misy client. Ampidiro ny mpanjifa mba hanaovana menu manokana ho azy.')}<//>` : html`
    <div class="table-wrap"><table class="table resp">
      <thead><tr><th>${tr('Nom', 'Name', 'Anarana')}</th><th>${tr('Téléphone', 'Phone', 'Finday')}</th><th>${tr('Adresse', 'Address', 'Adiresy')}</th><th>${tr('Objectif', 'Goal', 'Tanjona')}</th><th class="num">${tr('Kcal / jour', 'Kcal / day', 'Kcal / andro')}</th><th>${tr('Allergies', 'Allergies', 'Allergies')}</th><th>${tr('Planning', 'Planning', 'Planning')}</th></tr></thead>
      <tbody>${clients.map((c) => html`<tr class="clickable" onClick=${() => setEdit({ ...c, profil: c.profil || {} })}>
        <td><b>${c.nom}</b>${c.actif === false ? html` <${Badge}>${tr('inactif', 'inactive', 'tsy mavitrika')}<//>` : null}</td>
        <td>${c.telephone ? html`<a href=${'tel:' + c.telephone} onClick=${(e) => e.stopPropagation()}>${c.telephone}</a>` : '—'}</td>
        <td class="small"><span class="addr-cell">${c.adresse || '—'}${c.repere ? html`<span class="muted"> · ${c.repere}</span>` : null}${hasGps(c) ? html` <span class="badge ok">GPS</span>` : null}</span><${MapLinks} o=${c} /></td>
        <td>${catName(data.categories.find((x) => x.id === c.categorie_id))}</td>
        <td class="num">${fmt(c.kcal_cible)}</td>
        <td class="small">${c.allergies || '—'}</td>
        <td><a href=${'#/planning?client=' + c.id} onClick=${(e) => e.stopPropagation()}>${daysOf(c.id) ? daysOf(c.id) + ' ' + tr('j perso', 'custom d', 'andro manokana') : tr('Voir', 'View', 'Jereo')} →</a></td>
      </tr>`)}</tbody>
    </table></div>`}
    ${edit && html`<${ClientForm} row=${edit} onClose=${() => setEdit(null)} onSave=${save} onDelete=${del} isNew=${!(data.clients || []).some((x) => x.id === edit.id)} />`}
  </div>`;
}

function ClientForm({ row, onClose, onSave, onDelete, isNew }) {
  const { data } = useApp();
  const [f, setF] = useState(row);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setP = (k, v) => setF((x) => ({ ...x, profil: { ...(x.profil || {}), [k]: v } }));
  const p = f.profil || {};
  const besoin = besoinKcal(p, AJUST[f.categorie_id] || 0);
  return html`<${Modal} title=${isNew ? tr('Nouveau client', 'New customer', 'Client vaovao') : f.nom} onClose=${onClose} wide>
    <div class="form-grid">
      <${Field} label=${tr('Nom', 'Name', 'Anarana')}><input value=${f.nom || ''} onInput=${(e) => set('nom', e.target.value)} /><//>
      <${Field} label=${tr('Téléphone', 'Phone', 'Finday')}><input type="tel" value=${f.telephone || ''} onInput=${(e) => set('telephone', e.target.value)} /><//>
      <${AddressField} value=${{ adresse: f.adresse, repere: f.repere, lat: f.lat, lng: f.lng, maps_url: f.maps_url }} onChange=${(a) => setF((x) => ({ ...x, ...a }))} />
      <${Field} label=${tr('Objectif', 'Goal', 'Tanjona')}><select value=${f.categorie_id || ''} onChange=${(e) => set('categorie_id', e.target.value || null)}>${[...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map((c) => html`<option value=${c.id}>${catName(c)}</option>`)}</select><//>
      <${Field} label=${tr('Calories cibles / jour', 'Target calories / day', 'Kcal tanjona / andro')} hint=${tr('Vide = cible de l\'objectif', 'Empty = goal target', 'Foana = an\'ny tanjona')}><input type="number" value=${f.kcal_cible ?? ''} onInput=${(e) => set('kcal_cible', e.target.value)} /><//>
    </div>
    <${Card} title=${tr('Calculateur de besoins (facultatif)', 'Needs calculator (optional)', 'Kajy filana (tsy voatery)')} class="inner">
      <div class="form-grid">
        <${Field} label=${tr('Sexe', 'Sex', 'Lahy/Vavy')}><select value=${p.sexe || 'F'} onChange=${(e) => setP('sexe', e.target.value)}><option value="F">${tr('Femme', 'Female', 'Vavy')}</option><option value="H">${tr('Homme', 'Male', 'Lahy')}</option></select><//>
        <${Field} label=${tr('Âge', 'Age', 'Taona')}><input type="number" value=${p.age ?? ''} onInput=${(e) => setP('age', e.target.value)} /><//>
        <${Field} label=${tr('Poids (kg)', 'Weight (kg)', 'Lanja (kg)')}><input type="number" value=${p.poids ?? ''} onInput=${(e) => setP('poids', e.target.value)} /><//>
        <${Field} label=${tr('Taille (cm)', 'Height (cm)', 'Haavo (cm)')}><input type="number" value=${p.taille ?? ''} onInput=${(e) => setP('taille', e.target.value)} /><//>
        <${Field} label=${tr('Activité', 'Activity', 'Hetsika')} wide><select value=${p.activite || 'sedentaire'} onChange=${(e) => setP('activite', e.target.value)}>${ACTIVITES.map(([a]) => html`<option value=${a}>${actLabel(a)}</option>`)}</select><//>
      </div>
      ${besoin ? html`<p class="ok-box row gap wrap between"><span>${tr('Besoin estimé pour son objectif', 'Estimated need for the goal', 'Filana tombanana ho an\'ny tanjony')} : <b>${fmt(besoin)} kcal/${tr('jour', 'day', 'andro')}</b></span><button class="btn small primary" onClick=${() => set('kcal_cible', besoin)}>${tr('Utiliser', 'Use', 'Ampiasao')}</button></p>`
        : html`<p class="muted small">${tr('Renseignez âge, poids et taille pour une estimation (formule Mifflin-St Jeor). À valider par un professionnel pour les cas médicaux.', 'Enter age, weight and height for an estimate (Mifflin-St Jeor). To be validated by a professional for medical cases.', 'Fenoy ny taona, lanja ary haavo (kajy Mifflin-St Jeor). Hamarinin\'ny dokotera raha aretina.')}</p>`}
    <//>
    <div class="form-grid">
      <${Field} label=${tr('Allergies / aliments exclus', 'Allergies / excluded foods', 'Allergies / sakafo tsy hohanina')} wide><input value=${f.allergies || ''} onInput=${(e) => set('allergies', e.target.value)} /><//>
      <${Field} label=${tr('Notes', 'Notes', 'Fanamarihana')} wide><textarea rows="2" value=${f.notes || ''} onInput=${(e) => set('notes', e.target.value)}></textarea><//>
      <label class="check wide"><input type="checkbox" checked=${f.actif !== false} onChange=${(e) => set('actif', e.target.checked)} /> ${tr('Client actif', 'Active customer', 'Client mavitrika')}</label>
    </div>
    <div class="row gap between wrap">
      ${!isNew ? html`<span class="row gap"><button class="btn danger ghost" onClick=${() => onDelete(f)}>${tr('Supprimer', 'Delete', 'Fafao')}</button><a class="btn" href=${'#/planning?client=' + f.id}>${tr('Son planning', 'Their planning', 'Ny planning-ny')} →</a></span>` : html`<span></span>`}
      <span class="row gap"><button class="btn ghost" onClick=${onClose}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button><button class="btn primary" onClick=${() => onSave(f)}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button></span>
    </div>
  <//>`;
}
