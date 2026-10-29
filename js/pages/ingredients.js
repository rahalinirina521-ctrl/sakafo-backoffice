import { html, useState, useMemo } from '../lib.js?v=202610291451';
import { useApp, Badge, Field, Modal, SelectOrAdd } from '../ui.js?v=202610291451';
import { isComplete, kcalCheck, nextId, fmt, toNum, optionList } from '../calc.js?v=202610291451';
import { tr, ingName } from '../i18n.js?v=202610291451';

const CATS = ['Féculent', 'Protéine', 'Légumineuse', 'Légume', 'Fruit', 'Boisson', 'Laitier', 'Matière grasse', 'Condiment', 'Autre'];
const catLabel = (c) => ({
  'Féculent': tr('Féculent', 'Starch', 'Féculent'), 'Protéine': tr('Protéine', 'Protein', 'Protéine'), 'Légumineuse': tr('Légumineuse', 'Legume', 'Légumineuse'),
  'Légume': tr('Légume', 'Vegetable', 'Legioma'), 'Fruit': tr('Fruit', 'Fruit', 'Voankazo'), 'Boisson': tr('Boisson', 'Drink', 'Zava-pisotro'),
  'Laitier': tr('Laitier', 'Dairy', 'Ronono'), 'Matière grasse': tr('Matière grasse', 'Fat', 'Menaka'), 'Condiment': tr('Condiment', 'Condiment', 'Condiment'), 'Autre': tr('Autre', 'Other', 'Hafa'),
}[c] || c);
const etatLabel = (e) => ({ Masaka: tr('Cuit', 'Cooked', 'Masaka'), Manta: tr('Cru', 'Raw', 'Manta'), Vonona: tr('Prêt', 'Ready', 'Vonona') }[e] || e);
const numFields = () => [
  ['kcal', 'Kcal /100 g'], ['proteines', tr('Protéines g /100 g', 'Protein g /100 g', 'Protéines g /100 g')], ['glucides', tr('Glucides g /100 g', 'Carbs g /100 g', 'Glucides g /100 g')],
  ['lipides', tr('Lipides g /100 g', 'Fat g /100 g', 'Lipides g /100 g')], ['fibres', tr('Fibres g /100 g', 'Fibre g /100 g', 'Fibres g /100 g')], ['sucres', tr('Sucres g /100 g', 'Sugars g /100 g', 'Sucres g /100 g')],
  ['sodium', 'Sodium mg /100 g'], ['ig', tr('Index glycémique', 'Glycemic index', 'Index glycémique')],
  ['poids_piece', tr('Poids d\'une pièce (g)', 'Weight of one piece (g)', 'Lanjan\'ny isa iray (g)')], ['densite', tr('Densité (g/ml)', 'Density (g/ml)', 'Densité (g/ml)')],
  ['prix_kg', tr('Prix Ar/kg', 'Price Ar/kg', 'Vidiny Ar/kg')],
];
const NUM_KEYS = ['kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium', 'ig', 'poids_piece', 'densite', 'prix_kg'];

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
      .filter((i) => !s || `${i.id} ${i.nom_mg} ${i.nom_fr || ''} ${i.nom_en || ''}`.toLowerCase().includes(s))
      .filter((i) => !filter || (filter === 'vide' ? !isComplete(i) : filter === 'verif' ? i.a_verifier : filter === 'prix' ? toNum(i.prix_kg) === null : i.categorie === filter))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [data.ingredients, q, filter]);

  async function save(row) {
    const clean = { ...row };
    for (const k of NUM_KEYS) clean[k] = toNum(clean[k]);
    if (!(clean.nom_mg || '').trim() && !(clean.nom_fr || '').trim()) { toast(tr('Indiquez un nom', 'Enter a name', 'Soraty ny anarana'), 'bad'); return; }
    if (!clean.nom_mg) clean.nom_mg = clean.nom_fr;
    try { await app.save('ingredients', clean); toast(tr('Enregistré', 'Saved', 'Voatahiry')); setEdit(null); } catch (e) { toast(e.message, 'bad'); }
  }
  async function del(row) {
    if (used.has(row.id)) { toast(tr('Utilisé dans un plat : suppression impossible.', 'Used in a dish: cannot delete.', 'Ampiasain\'ny sakafo iray, tsy azo fafana.'), 'bad'); return; }
    if (!confirm(tr(`Supprimer ${ingName(row)} ?`, `Delete ${ingName(row)}?`, `Hofafana ve ny ${ingName(row)}?`))) return;
    try { await app.del('ingredients', row.id); setEdit(null); toast(tr('Supprimé', 'Deleted', 'Voafafa')); } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="page">
    <div class="page-head">
      <h1>${tr('Ingrédients', 'Ingredients', 'Ingrédients')} <span class="muted">(${data.ingredients.length})</span></h1>
      <button class="btn primary" onClick=${() => setEdit({ id: nextId('I', data.ingredients, 3), nom_mg: '', nom_fr: '', a_verifier: true })}>+ ${tr('Ingrédient', 'Ingredient', 'Ingrédient')}</button>
    </div>
    <p class="muted small">${tr('Valeurs pour 100 g, dans l\'état où l\'ingrédient est servi (cuit si cuit). « À vérifier » = pas encore contrôlé avec la source.', 'Values per 100 g, as served (cooked if cooked). "To check" = not yet verified against the source.', 'Sanda isaky ny 100 g, araka ny fanomezana azy (masaka raha masaka). "Hamarinina" = mbola tsy nohamarinina tamin\'ny loharano.')}</p>
    <div class="filters">
      <input type="search" placeholder=${tr('Rechercher…', 'Search…', 'Hikaroka…')} value=${q} onInput=${(e) => setQ(e.target.value)} />
      <select value=${filter} onChange=${(e) => setFilter(e.target.value)}>
        <option value="">${tr('Tous', 'All', 'Rehetra')}</option>
        <option value="vide">${tr('Sans valeurs', 'No values', 'Tsy misy valeur')}</option>
        <option value="verif">${tr('À vérifier', 'To check', 'Mbola hamarinina')}</option>
        <option value="prix">${tr('Sans prix', 'No price', 'Tsy misy vidiny')}</option>
        ${optionList('categorie_ingredient', CATS, data.options).map((c) => html`<option value=${c}>${catLabel(c)}</option>`)}
      </select>
    </div>
    <div class="table-wrap"><table class="table resp">
      <thead><tr><th>ID</th><th>${tr('Nom', 'Name', 'Anarana')}</th><th>${tr('Catégorie', 'Category', 'Sokajy')}</th><th class="num">Kcal</th><th class="num">Prot.</th><th class="num">${tr('Gluc.', 'Carbs', 'Gluc.')}</th><th class="num">${tr('Lip.', 'Fat', 'Lip.')}</th><th class="num">${tr('Fibres', 'Fibre', 'Fibres')}</th><th class="num">IG</th><th class="num">${tr('g/pièce', 'g/piece', 'g/isa')}</th><th class="num">Ar/kg</th><th>${tr('Statut', 'Status', 'Sata')}</th></tr></thead>
      <tbody>${rows.map((i) => {
        const chk = kcalCheck(i);
        return html`<tr class="clickable" onClick=${() => setEdit({ ...i })}>
          <td class="mono">${i.id}</td>
          <td><b>${ingName(i)}</b><div class="muted small">${[i.nom_fr, i.nom_mg, i.nom_en].filter((x, k, arr) => x && x !== ingName(i) && arr.indexOf(x) === k).join(' · ')}${i.etat ? ' · ' + etatLabel(i.etat) : ''}</div></td>
          <td>${i.categorie ? catLabel(i.categorie) : '—'}</td>
          <td class="num">${fmt(i.kcal)}</td><td class="num">${fmt(i.proteines, 1)}</td><td class="num">${fmt(i.glucides, 1)}</td><td class="num">${fmt(i.lipides, 1)}</td><td class="num">${fmt(i.fibres, 1)}</td><td class="num">${fmt(i.ig)}</td><td class="num">${fmt(i.poids_piece)}</td><td class="num">${fmt(i.prix_kg)}</td>
          <td>${!isComplete(i) ? html`<${Badge} tone="bad">${tr('incomplet', 'incomplete', 'tsy feno')}<//>` : chk && !chk.ok ? html`<${Badge} tone="warn">${tr('kcal incohérentes', 'kcal inconsistent', 'kcal tsy mifanaraka')}<//>` : i.a_verifier ? html`<${Badge} tone="muted">${tr('à vérifier', 'to check', 'hamarinina')}<//>` : html`<${Badge} tone="ok">${tr('vérifié', 'verified', 'voamarina')}<//>`}</td>
        </tr>`;
      })}</tbody>
    </table></div>
    ${edit && html`<${IngForm} row=${edit} onClose=${() => setEdit(null)} onSave=${save} onDelete=${del} isNew=${!data.ingredients.some((x) => x.id === edit.id)} />`}
  </div>`;
}

function IngForm({ row, onClose, onSave, onDelete, isNew }) {
  const [f, setF] = useState(row);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const chk = kcalCheck(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, NUM_KEYS.includes(k) ? toNum(v) : v])));
  return html`<${Modal} title=${isNew ? tr('Nouvel ingrédient', 'New ingredient', 'Ingrédient vaovao') : f.id + ' — ' + ingName(f)} onClose=${onClose} wide>
    <div class="form-grid">
      <${Field} label=${tr('Nom (FR)', 'Name (FR)', 'Anarana (FR)')}><input value=${f.nom_fr || ''} onInput=${(e) => set('nom_fr', e.target.value)} /><//>
      <${Field} label=${tr('Nom (MG)', 'Name (MG)', 'Anarana (MG)')}><input value=${f.nom_mg || ''} onInput=${(e) => set('nom_mg', e.target.value)} /><//>
      <${Field} label=${tr('Nom (EN)', 'Name (EN)', 'Anarana (EN)')}><input value=${f.nom_en || ''} onInput=${(e) => set('nom_en', e.target.value)} /><//>
      <${Field} label=${tr('Catégorie', 'Category', 'Sokajy')}><${SelectOrAdd} type="categorie_ingredient" allowEmpty value=${f.categorie || ''} defaults=${CATS} labelFn=${catLabel} onChange=${(v) => set('categorie', v || null)} /><//>
      <${Field} label=${tr('État', 'State', 'Toetra')}><${SelectOrAdd} type="etat" allowEmpty value=${f.etat || ''} defaults=${['Masaka', 'Manta', 'Vonona']} labelFn=${etatLabel} onChange=${(v) => set('etat', v || null)} /><//>
      ${numFields().map(([k, l]) => html`<${Field} label=${l}><input type="number" step="any" value=${f[k] ?? ''} onInput=${(e) => set(k, e.target.value)} /><//>`)}
      <${Field} label="Source" wide><input value=${f.source || ''} onInput=${(e) => set('source', e.target.value)} placeholder="USDA FDC / Ciqual" /><//>
      <label class="check wide"><input type="checkbox" checked=${!f.a_verifier} onChange=${(e) => set('a_verifier', !e.target.checked)} /> ${tr('Vérifié avec la source', 'Verified against the source', 'Efa nohamarinina tamin\'ny loharano')}</label>
    </div>
    ${chk && html`<p class=${chk.ok ? 'ok-box' : 'warn-box'}>${tr('Contrôle', 'Check', 'Fanamarinana')} : 4×P + 4×G + 9×L = ${fmt(chk.est)} kcal ${chk.ok ? tr('(cohérent)', '(consistent)', '(mifanaraka)') : tr('(écart important, à vérifier)', '(large gap, please check)', '(lavitra, hamarino)')}</p>`}
    <div class="row gap between">
      ${!isNew ? html`<button class="btn danger ghost" onClick=${() => onDelete(f)}>${tr('Supprimer', 'Delete', 'Fafao')}</button>` : html`<span></span>`}
      <div class="row gap"><button class="btn ghost" onClick=${onClose}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button><button class="btn primary" onClick=${() => onSave(f)}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button></div>
    </div>
  <//>`;
}
