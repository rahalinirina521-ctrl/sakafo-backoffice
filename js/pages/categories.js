import { html, useState } from '../lib.js?v=202610290705';
import { useApp, Card, Field, Badge } from '../ui.js?v=202610290705';
import { fmt, toNum } from '../calc.js?v=202610290705';
import { tr, catName } from '../i18n.js?v=202610290705';
import { OBJECTIF_TYPES, typeObjectif, typeLabel } from '../conseil.js?v=202610290705';

export function Categories() {
  const app = useApp();
  const { data, toast } = app;
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const [edit, setEdit] = useState(null);

  async function save() {
    const row = { ...edit, kcal_cible: toNum(edit.kcal_cible), tolerance: (toNum(edit.tolerance_pct) ?? 10) / 100, prot_g_kg: toNum(edit.prot_g_kg), cg_max: toNum(edit.cg_max), ordre: toNum(edit.ordre) || 0 };
    delete row.tolerance_pct;
    if (!row.nom) { toast(tr('Indiquez un nom', 'Enter a name', 'Soraty ny anarana'), 'bad'); return; }
    if (!row.id) row.id = row.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try { await app.save('categories', row); setEdit(null); toast(tr('Enregistré', 'Saved', 'Voatahiry')); } catch (e) { toast(e.message, 'bad'); }
  }
  const s = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  async function toggle(c, e) {
    e.stopPropagation();
    const statut = c.statut === 'attente' ? 'valide' : 'attente';
    try { await app.save('categories', { ...c, statut }); toast(statut === 'valide' ? tr('Objectif validé : visible par les clients', 'Goal approved: visible to customers', 'Voamarina: hitan\'ny client') : tr('Objectif mis en attente : masqué pour les clients', 'Goal on hold: hidden from customers', 'Miandry: tsy hitan\'ny client')); } catch (x) { toast(x.message, 'bad'); }
  }

  return html`<div class="page">
    <div class="page-head"><h1>${tr('Objectifs', 'Goals', 'Tanjona')}</h1><button class="btn primary" onClick=${() => setEdit({ nom: '', nom_en: '', nom_mg: '', kcal_cible: 2000, tolerance_pct: 10, ordre: cats.length + 1, regles: '', statut: 'attente', type: 'normal', icone: '' })}>+ ${tr('Objectif', 'Goal', 'Tanjona')}</button></div>
    <p class="muted small">${tr('Seuls les objectifs « Validé » sont proposés aux clients dans l\'application. « En attente » = préparé mais masqué (ex. objectif médical à faire relire par un professionnel). Le « type » choisit les règles de l\'avis automatique (grossesse → DPA, diabète → traitement…).', 'Only "Approved" goals are offered to customers in the app. "On hold" = prepared but hidden. The "type" selects the automatic advice rules.', 'Ny tanjona « Validé » ihany no hitan\'ny client. « En attente » = vonona fa miafina (ohatra tanjona ara-pahasalamana mbola hojeren\'ny dokotera). Ny « type » no mifidy ny fitsipiky ny torohevitra mandeha ho azy.')}</p>
    <div class="table-wrap"><table class="table resp">
      <thead><tr><th>${tr('Statut', 'Status', 'Toetra')}</th><th>${tr('Nom', 'Name', 'Anarana')}</th><th>Type</th><th class="num">Kcal/${tr('jour', 'day', 'andro')}</th><th class="num">±</th><th class="num">${tr('Prot. g/kg', 'Prot. g/kg', 'Prot. g/kg')}</th><th class="num">CG max</th><th>${tr('Règles', 'Rules', 'Fitsipika')}</th></tr></thead>
      <tbody>${cats.map((c) => html`<tr class="clickable" onClick=${() => setEdit({ ...c, tolerance_pct: Math.round((c.tolerance ?? 0.1) * 100) })}>
        <td><button class=${'badge-btn ' + (c.statut === 'attente' ? 'warn' : 'ok')} onClick=${(e) => toggle(c, e)} title=${tr('Cliquer pour changer', 'Click to change', 'Tsindrio raha hanova')}>${c.statut === 'attente' ? '⏸ ' + tr('En attente', 'On hold', 'Miandry') : '✓ ' + tr('Validé', 'Approved', 'Voamarina')}</button></td>
        <td><b>${c.icone || ''} ${catName(c)}</b>${c.description ? html`<div class="small muted">${c.description}</div>` : null}</td><td class="small">${typeLabel(typeObjectif(c))}</td><td class="num">${fmt(c.kcal_cible)}</td><td class="num">${Math.round((c.tolerance ?? 0.1) * 100)} %</td><td class="num">${fmt(c.prot_g_kg, 1)}</td><td class="num">${fmt(c.cg_max)}</td><td class="small">${c.regles}</td>
      </tr>`)}</tbody>
    </table></div>
    ${edit && html`<${Card} title=${edit.id ? tr('Modifier : ', 'Edit: ', 'Ovay: ') + catName(edit) : tr('Nouvelle catégorie', 'New category', 'Sokajy vaovao')}>
      <div class="form-grid">
        <${Field} label=${tr('Nom (FR)', 'Name (FR)', 'Anarana (FR)')}><input value=${edit.nom} onInput=${s('nom')} /><//>
        <${Field} label=${tr('Nom (EN)', 'Name (EN)', 'Anarana (EN)')}><input value=${edit.nom_en || ''} onInput=${s('nom_en')} /><//>
        <${Field} label=${tr('Nom (MG)', 'Name (MG)', 'Anarana (MG)')}><input value=${edit.nom_mg || ''} onInput=${s('nom_mg')} /><//>
        <${Field} label=${tr('Statut', 'Status', 'Toetra')}><select value=${edit.statut || 'valide'} onChange=${s('statut')}><option value="valide">✓ ${tr('Validé (visible clients)', 'Approved (visible)', 'Voamarina (hita)')}</option><option value="attente">⏸ ${tr('En attente (masqué)', 'On hold (hidden)', 'Miandry (miafina)')}</option></select><//>
        <${Field} label=${tr('Type (règles de l\'avis)', 'Type (advice rules)', 'Type (fitsipiky ny torohevitra)')}><select value=${edit.type || typeObjectif(edit)} onChange=${s('type')}>${Object.keys(OBJECTIF_TYPES).map((k) => html`<option value=${k}>${typeLabel(k)}</option>`)}</select><//>
        <${Field} label=${tr('Icône (emoji)', 'Icon (emoji)', 'Sary kely (emoji)')}><input value=${edit.icone || ''} onInput=${s('icone')} placeholder="⚖️" /><//>
        <${Field} label=${tr('Description pour les clients', 'Description for customers', 'Famaritana ho an\'ny client')} wide><input value=${edit.description || ''} onInput=${s('description')} /><//>
        <${Field} label=${tr('Kcal cible par jour', 'Target kcal per day', 'Kcal tanjona isan\'andro')}><input type="number" value=${edit.kcal_cible ?? ''} onInput=${s('kcal_cible')} /><//>
        <${Field} label=${tr('Tolérance (%)', 'Tolerance (%)', 'Fandeferana (%)')}><input type="number" value=${edit.tolerance_pct ?? ''} onInput=${s('tolerance_pct')} /><//>
        <${Field} label=${tr('Protéines g / kg de poids', 'Protein g / kg body weight', 'Protéines g / kg vatana')}><input type="number" step="0.1" value=${edit.prot_g_kg ?? ''} onInput=${s('prot_g_kg')} /><//>
        <${Field} label=${tr('Charge glycémique max / jour', 'Max glycemic load / day', 'Charge glycémique max /andro')} hint=${tr('Pour le diabète', 'For diabetes', 'Ho an\'ny diabète')}><input type="number" value=${edit.cg_max ?? ''} onInput=${s('cg_max')} /><//>
        <${Field} label=${tr('Ordre', 'Order', 'Filaharana')}><input type="number" value=${edit.ordre ?? ''} onInput=${s('ordre')} /><//>
        <${Field} label=${tr('Règles (utilisées dans les prompts IA)', 'Rules (used in the AI prompts)', 'Fitsipika (ampiasain\'ny prompt IA)')} wide><textarea rows="3" value=${edit.regles || ''} onInput=${s('regles')}></textarea><//>
      </div>
      <div class="row gap"><button class="btn primary" onClick=${save}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button><button class="btn ghost" onClick=${() => setEdit(null)}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button></div>
    <//>`}
  </div>`;
}
