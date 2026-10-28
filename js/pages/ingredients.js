import { html, useState, useMemo } from '../lib.js';
import { useApp, Badge, Field, Modal } from '../ui.js';
import { isComplete, kcalCheck, nextId, fmt, toNum } from '../calc.js';

const CATS = ['Féculent', 'Protéine', 'Légumineuse', 'Légume', 'Fruit', 'Boisson', 'Laitier', 'Matière grasse', 'Condiment', 'Autre'];
const NUM = [
  ['kcal', 'Kcal'], ['proteines', 'Protéines g'], ['glucides', 'Glucides g'], ['lipides', 'Lipides g'],
  ['fibres', 'Fibres g'], ['sucres', 'Sucres g'], ['sodium', 'Sodium mg'], ['ig', 'Index glycémique'], ['poids_piece', 'Lanjan\'ny isa iray (g)'], ['densite', 'Densité (g/ml)'], ['prix_kg', 'Vidiny Ar/kg'],
];

export function Ingredients() {
  const app = useApp();
  const { data, toast } = app;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [edit, setEdit] = useState(null);

  const used = useMemo(() => new Set(data.composition.map((c) => c.ingredient_id)), [data.composition]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.ingredients
      .filter((i) => !s || `${i.id} ${i.nom_mg} ${i.nom_fr || ''}`.toLowerCase().includes(s))
      .filter((i) => !filter || (filter === 'vide' ? !isComplete(i) : filter === 'verif' ? i.a_verifier : filter === 'prix' ? toNum(i.prix_kg) === null : i.categorie === filter))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [data.ingredients, q, filter]);

  async function save(row) {
    const clean = { ...row };
    for (const [k] of NUM) clean[k] = toNum(clean[k]);
    if (!clean.nom_mg?.trim()) { toast('Soraty ny anarana', 'bad'); return; }
    try { await app.save('ingredients', clean); toast('Voatahiry'); setEdit(null); } catch (e) { toast(e.message, 'bad'); }
  }
  async function del(row) {
    if (used.has(row.id)) { toast('Ampiasain\'ny sakafo iray io ingrédient io, tsy azo fafana.', 'bad'); return; }
    if (!confirm(`Hofafana ve ny ${row.nom_mg}?`)) return;
    try { await app.del('ingredients', row.id); setEdit(null); toast('Voafafa'); } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="page">
    <div class="page-head">
      <h1>Ingrédients <span class="muted">(${data.ingredients.length})</span></h1>
      <button class="btn primary" onClick=${() => setEdit({ id: nextId('I', data.ingredients, 3), nom_mg: '', a_verifier: true })}>+ Ingrédient</button>
    </div>
    <p class="muted small">Sanda isaky ny 100 g, araka ny fanomezana azy (masaka raha masaka). Ny marika "hamarinina" dia manondro fa mbola tsy nohamarininao tamin'ny loharano.</p>
    <div class="filters">
      <input type="search" placeholder="Hikaroka…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <select value=${filter} onChange=${(e) => setFilter(e.target.value)}>
        <option value="">Rehetra</option>
        <option value="vide">Tsy misy valeur</option>
        <option value="verif">Mbola hamarinina</option>
        <option value="prix">Tsy misy vidiny</option>
        ${CATS.map((c) => html`<option value=${c}>${c}</option>`)}
      </select>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>ID</th><th>Anarana</th><th>Sokajy</th><th class="num">Kcal</th><th class="num">Prot.</th><th class="num">Gluc.</th><th class="num">Lip.</th><th class="num">Fibres</th><th class="num">IG</th><th class="num">Ar/kg</th><th>Sata</th></tr></thead>
      <tbody>${rows.map((i) => {
        const chk = kcalCheck(i);
        return html`<tr class="clickable" onClick=${() => setEdit({ ...i })}>
          <td class="mono">${i.id}</td>
          <td><b>${i.nom_mg}</b><div class="muted small">${i.nom_fr || ''}${i.etat ? ' · ' + i.etat : ''}</div></td>
          <td>${i.categorie || '—'}</td>
          <td class="num">${fmt(i.kcal)}</td><td class="num">${fmt(i.proteines, 1)}</td><td class="num">${fmt(i.glucides, 1)}</td><td class="num">${fmt(i.lipides, 1)}</td><td class="num">${fmt(i.fibres, 1)}</td><td class="num">${fmt(i.ig)}</td><td class="num">${fmt(i.prix_kg)}</td>
          <td>${!isComplete(i) ? html`<${Badge} tone="bad">tsy feno<//>` : chk && !chk.ok ? html`<${Badge} tone="warn">kcal tsy mifanaraka<//>` : i.a_verifier ? html`<${Badge} tone="muted">hamarinina<//>` : html`<${Badge} tone="ok">voamarina<//>`}</td>
        </tr>`;
      })}</tbody>
    </table></div>
    ${edit && html`<${IngForm} row=${edit} onClose=${() => setEdit(null)} onSave=${save} onDelete=${del} isNew=${!data.ingredients.some((x) => x.id === edit.id)} />`}
  </div>`;
}

function IngForm({ row, onClose, onSave, onDelete, isNew }) {
  const [f, setF] = useState(row);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const chk = kcalCheck(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, NUM.some(([n]) => n === k) ? toNum(v) : v])));
  return html`<${Modal} title=${isNew ? 'Ingrédient vaovao' : f.id + ' — ' + (f.nom_mg || '')} onClose=${onClose} wide>
    <div class="form-grid">
      <${Field} label="Anarana (MG)"><input value=${f.nom_mg || ''} onInput=${(e) => set('nom_mg', e.target.value)} /><//>
      <${Field} label="Nom (FR)"><input value=${f.nom_fr || ''} onInput=${(e) => set('nom_fr', e.target.value)} /><//>
      <${Field} label="Sokajy"><select value=${f.categorie || ''} onChange=${(e) => set('categorie', e.target.value || null)}><option value="">—</option>${CATS.map((c) => html`<option>${c}</option>`)}</select><//>
      <${Field} label="Toetra"><select value=${f.etat || ''} onChange=${(e) => set('etat', e.target.value || null)}><option value="">—</option><option>Masaka</option><option>Manta</option><option>Vonona</option></select><//>
      ${NUM.map(([k, l]) => html`<${Field} label=${l + (['prix_kg', 'ig', 'poids_piece', 'densite'].includes(k) ? '' : ' /100g')}><input type="number" step="any" value=${f[k] ?? ''} onInput=${(e) => set(k, e.target.value)} /><//>`)}
      <${Field} label="Loharano (source)" wide><input value=${f.source || ''} onInput=${(e) => set('source', e.target.value)} placeholder="USDA FDC / Ciqual + anaran'ny sakafo" /><//>
      <label class="check wide"><input type="checkbox" checked=${!f.a_verifier} onChange=${(e) => set('a_verifier', !e.target.checked)} /> Efa nohamarinina tamin'ny loharano</label>
    </div>
    ${chk && html`<p class=${chk.ok ? 'ok-box' : 'warn-box'}>Fanamarinana: 4×P + 4×G + 9×L = ${fmt(chk.est)} kcal ${chk.ok ? '(mifanaraka)' : '(lavitra ny kcal nosoratana, hamarino)'}</p>`}
    <div class="row gap between">
      ${!isNew ? html`<button class="btn danger ghost" onClick=${() => onDelete(f)}>Fafao</button>` : html`<span></span>`}
      <div class="row gap"><button class="btn ghost" onClick=${onClose}>Aoka ihany</button><button class="btn primary" onClick=${() => onSave(f)}>Tehirizo</button></div>
    </div>
  <//>`;
}
