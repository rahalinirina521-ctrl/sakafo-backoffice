import { html, useState } from '../lib.js';
import { useApp, Card, Field } from '../ui.js';
import { fmt, toNum } from '../calc.js';

export function Categories() {
  const app = useApp();
  const { data, toast } = app;
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const [edit, setEdit] = useState(null);

  async function save() {
    const row = { ...edit, kcal_cible: toNum(edit.kcal_cible), tolerance: (toNum(edit.tolerance_pct) ?? 10) / 100, prot_g_kg: toNum(edit.prot_g_kg), cg_max: toNum(edit.cg_max), ordre: toNum(edit.ordre) || 0 };
    delete row.tolerance_pct;
    if (!row.id) row.id = (row.nom || 'sokajy').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!row.nom) { toast('Soraty ny anarana', 'bad'); return; }
    try { await app.save('categories', row); setEdit(null); toast('Voatahiry'); } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="page">
    <div class="page-head"><h1>Sokajy (tanjona)</h1><button class="btn primary" onClick=${() => setEdit({ nom: '', kcal_cible: 2000, tolerance_pct: 10, ordre: cats.length + 1, regles: '' })}>+ Sokajy</button></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Anarana</th><th class="num">Kcal/andro</th><th class="num">±</th><th class="num">Prot. g/kg</th><th class="num">CG max</th><th>Fitsipika</th></tr></thead>
      <tbody>${cats.map((c) => html`<tr class="clickable" onClick=${() => setEdit({ ...c, tolerance_pct: Math.round((c.tolerance ?? 0.1) * 100) })}>
        <td><b>${c.nom}</b></td><td class="num">${fmt(c.kcal_cible)}</td><td class="num">${Math.round((c.tolerance ?? 0.1) * 100)}%</td><td class="num">${fmt(c.prot_g_kg, 1)}</td><td class="num">${fmt(c.cg_max)}</td><td class="small">${c.regles}</td>
      </tr>`)}</tbody>
    </table></div>
    ${edit && html`<${Card} title=${edit.id ? 'Ovay: ' + edit.nom : 'Sokajy vaovao'}>
      <div class="form-grid">
        <${Field} label="Anarana"><input value=${edit.nom} onInput=${(e) => setEdit({ ...edit, nom: e.target.value })} /><//>
        <${Field} label="Kcal tanjona isan'andro"><input type="number" value=${edit.kcal_cible ?? ''} onInput=${(e) => setEdit({ ...edit, kcal_cible: e.target.value })} /><//>
        <${Field} label="Fandeferana (%)"><input type="number" value=${edit.tolerance_pct ?? ''} onInput=${(e) => setEdit({ ...edit, tolerance_pct: e.target.value })} /><//>
        <${Field} label="Protéines g / kg vatana"><input type="number" step="0.1" value=${edit.prot_g_kg ?? ''} onInput=${(e) => setEdit({ ...edit, prot_g_kg: e.target.value })} /><//>
        <${Field} label="Charge glycémique max /andro" hint="Ho an'ny diabète"><input type="number" value=${edit.cg_max ?? ''} onInput=${(e) => setEdit({ ...edit, cg_max: e.target.value })} /><//>
        <${Field} label="Filaharana"><input type="number" value=${edit.ordre ?? ''} onInput=${(e) => setEdit({ ...edit, ordre: e.target.value })} /><//>
        <${Field} label="Fitsipika (ampiasain'ny prompt IA)" wide><textarea rows="3" value=${edit.regles || ''} onInput=${(e) => setEdit({ ...edit, regles: e.target.value })}></textarea><//>
      </div>
      <div class="row gap"><button class="btn primary" onClick=${save}>Tehirizo</button><button class="btn ghost" onClick=${() => setEdit(null)}>Aoka ihany</button></div>
    <//>`}
  </div>`;
}
