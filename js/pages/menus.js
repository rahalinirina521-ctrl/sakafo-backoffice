import { html, useState, useMemo } from '../lib.js';
import { useApp, Badge, Empty } from '../ui.js';
import { menuTotals, menuStatus, nextId, platTotals, fmt, FOTOANA, SLOT_KEYS } from '../calc.js';

export function Menus() {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const [cat, setCat] = useState(cats[0]?.id || '');
  const category = data.categories.find((c) => c.id === cat);

  const platKcal = useMemo(() => new Map(data.plats.map((p) => [p.id, platTotals(p.id, data.composition, ingMap).kcal])), [data, ingMap]);
  const menus = data.menus.filter((m) => m.categorie_id === cat).sort((a, b) => (a.andro || '').localeCompare(b.andro || '', 'fr', { numeric: true }));

  async function update(m, patch) {
    try { await app.save('menus', { ...m, ...patch }); } catch (e) { toast(e.message, 'bad'); }
  }
  async function add() {
    const n = menus.length + 1;
    try { await app.save('menus', { id: nextId('MN', data.menus), categorie_id: cat, andro: 'Andro ' + n, maraina: null, atoandro: null, hariva: null, gouter: null, notes: '' }); } catch (e) { toast(e.message, 'bad'); }
  }
  async function del(m) {
    if (!confirm(`Hofafana ve ny ${m.andro}?`)) return;
    try { await app.del('menus', m.id); } catch (e) { toast(e.message, 'bad'); }
  }

  const options = (fot) => {
    const inCat = data.plats.filter((p) => (p.categories || []).includes(cat));
    const list = inCat.length ? inCat : data.plats;
    return [...list].sort((a, b) => (a.fotoana === fot ? -1 : 0) - (b.fotoana === fot ? -1 : 0) || a.nom.localeCompare(b.nom));
  };

  return html`<div class="page">
    <div class="page-head">
      <h1>Menus</h1>
      <button class="btn primary" disabled=${!cat} onClick=${add}>+ Andro</button>
    </div>
    <div class="tabs">${cats.map((c) => html`<button class=${'tab' + (c.id === cat ? ' on' : '')} onClick=${() => setCat(c.id)}>${c.nom}</button>`)}</div>
    ${category && html`<p class="muted small">Tanjona: <b>${fmt(category.kcal_cible)} kcal</b>/andro (±${Math.round((category.tolerance ?? 0.1) * 100)}%)${category.cg_max ? ', CG ≤ ' + category.cg_max : ''}. Maraina 25% · Atoandro 35% · Hariva 30% · Goûter 10%.</p>`}
    ${menus.length === 0 ? html`<${Empty}>Mbola tsy misy menu ho an'ity sokajy ity. Tsindrio "+ Andro".<//>` : html`
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Andro</th>${FOTOANA.map((f) => html`<th>${f}</th>`)}<th class="num">Kcal</th><th class="num">Prot.</th><th class="num">CG</th><th class="num">Coût</th><th>Sata</th><th></th></tr></thead>
      <tbody>${menus.map((m) => {
        const t = menuTotals(m, data.plats, data.composition, ingMap);
        const st = menuStatus(m, t, category);
        return html`<tr>
          <td><input class="andro-input" value=${m.andro || ''} onChange=${(e) => update(m, { andro: e.target.value })} /></td>
          ${FOTOANA.map((f) => {
            const k = SLOT_KEYS[f];
            return html`<td><select class="slot" value=${m[k] || ''} onChange=${(e) => update(m, { [k]: e.target.value || null })}>
              <option value="">—</option>
              ${options(f).map((p) => html`<option value=${p.id}>${p.nom} · ${fmt(platKcal.get(p.id))} kcal${p.fotoana !== f ? ' (' + (p.fotoana || '?') + ')' : ''}</option>`)}
            </select></td>`;
          })}
          <td class="num"><b>${fmt(t.kcal)}</b></td>
          <td class="num">${fmt(t.proteines)}</td>
          <td class="num">${fmt(t.cg)}</td>
          <td class="num">${fmt(t.cout)}</td>
          <td><${Badge} tone=${st.tone}>${st.label}${st.ecart !== null ? ' ' + (st.ecart > 0 ? '+' : '') + Math.round(st.ecart * 100) + '%' : ''}<//>${t.missing ? html` <${Badge} tone="warn">tsy feno<//>` : null}</td>
          <td><button class="btn ghost small" onClick=${() => del(m)}>✕</button></td>
        </tr>`;
      })}</tbody>
    </table></div>`}
  </div>`;
}
