import { html, useState } from '../lib.js';
import { useApp, Card, Field } from '../ui.js';
import { fmt, toNum } from '../calc.js';
import { tr, catName } from '../i18n.js';

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

  return html`<div class="page">
    <div class="page-head"><h1>${tr('Catégories (objectifs)', 'Categories (goals)', 'Sokajy (tanjona)')}</h1><button class="btn primary" onClick=${() => setEdit({ nom: '', nom_en: '', nom_mg: '', kcal_cible: 2000, tolerance_pct: 10, ordre: cats.length + 1, regles: '' })}>+ ${tr('Catégorie', 'Category', 'Sokajy')}</button></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>${tr('Nom', 'Name', 'Anarana')}</th><th class="num">Kcal/${tr('jour', 'day', 'andro')}</th><th class="num">±</th><th class="num">${tr('Prot. g/kg', 'Prot. g/kg', 'Prot. g/kg')}</th><th class="num">CG max</th><th>${tr('Règles', 'Rules', 'Fitsipika')}</th></tr></thead>
      <tbody>${cats.map((c) => html`<tr class="clickable" onClick=${() => setEdit({ ...c, tolerance_pct: Math.round((c.tolerance ?? 0.1) * 100) })}>
        <td><b>${catName(c)}</b></td><td class="num">${fmt(c.kcal_cible)}</td><td class="num">${Math.round((c.tolerance ?? 0.1) * 100)} %</td><td class="num">${fmt(c.prot_g_kg, 1)}</td><td class="num">${fmt(c.cg_max)}</td><td class="small">${c.regles}</td>
      </tr>`)}</tbody>
    </table></div>
    ${edit && html`<${Card} title=${edit.id ? tr('Modifier : ', 'Edit: ', 'Ovay: ') + catName(edit) : tr('Nouvelle catégorie', 'New category', 'Sokajy vaovao')}>
      <div class="form-grid">
        <${Field} label=${tr('Nom (FR)', 'Name (FR)', 'Anarana (FR)')}><input value=${edit.nom} onInput=${s('nom')} /><//>
        <${Field} label=${tr('Nom (EN)', 'Name (EN)', 'Anarana (EN)')}><input value=${edit.nom_en || ''} onInput=${s('nom_en')} /><//>
        <${Field} label=${tr('Nom (MG)', 'Name (MG)', 'Anarana (MG)')}><input value=${edit.nom_mg || ''} onInput=${s('nom_mg')} /><//>
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
