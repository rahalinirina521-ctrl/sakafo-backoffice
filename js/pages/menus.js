import { html, useState, useMemo } from '../lib.js';
import { useApp, Badge, Empty, pctBadge } from '../ui.js';
import { menuTotals, menuStatus, nextId, platTotals, fmt, FOTOANA, SLOT_KEYS } from '../calc.js';
import { tr, fotLabel, catName, platTitle } from '../i18n.js';

const statusLabel = (s) => ({
  OK: 'OK',
  'Amboary ny kcal': tr('Ajuster les kcal', 'Adjust kcal', 'Amboary ny kcal'),
  'CG ambony loatra': tr('Charge glycémique trop haute', 'Glycemic load too high', 'CG ambony loatra'),
  'Tsy misy tanjona': tr('Pas de cible', 'No target', 'Tsy misy tanjona'),
}[s.label] || s.label);

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
    try { await app.save('menus', { id: nextId('MN', data.menus), categorie_id: cat, andro: tr('Jour ', 'Day ', 'Andro ') + n, maraina: null, atoandro: null, hariva: null, gouter: null, notes: '' }); } catch (e) { toast(e.message, 'bad'); }
  }
  async function del(m) {
    if (!confirm(tr(`Supprimer ${m.andro} ?`, `Delete ${m.andro}?`, `Hofafana ve ny ${m.andro}?`))) return;
    try { await app.del('menus', m.id); } catch (e) { toast(e.message, 'bad'); }
  }

  const options = (fot) => {
    const inCat = data.plats.filter((p) => (p.categories || []).includes(cat));
    const list = inCat.length ? inCat : data.plats;
    return [...list].sort((a, b) => (a.fotoana === fot ? -1 : 0) - (b.fotoana === fot ? -1 : 0) || platTitle(a).localeCompare(platTitle(b)));
  };

  return html`<div class="page">
    <div class="page-head">
      <h1>Menus</h1>
      <button class="btn primary" disabled=${!cat} onClick=${add}>+ ${tr('Jour', 'Day', 'Andro')}</button>
    </div>
    <div class="tabs">${cats.map((c) => html`<button class=${'tab' + (c.id === cat ? ' on' : '')} onClick=${() => setCat(c.id)}>${catName(c)}</button>`)}</div>
    ${category && html`<p class="muted small">${tr('Cible', 'Target', 'Tanjona')} : <b>${fmt(category.kcal_cible)} kcal</b>/${tr('jour', 'day', 'andro')} (±${Math.round((category.tolerance ?? 0.1) * 100)} %)${category.cg_max ? ', CG ≤ ' + category.cg_max : ''}. ${fotLabel('Maraina')} 25 % · ${fotLabel('Atoandro')} 35 % · ${fotLabel('Hariva')} 30 % · ${fotLabel('Goûter')} 10 %.</p>`}
    ${menus.length === 0 ? html`<${Empty}>${tr('Aucun menu pour cette catégorie. Cliquez sur « + Jour ».', 'No menu for this category yet. Click "+ Day".', 'Mbola tsy misy menu ho an\'ity sokajy ity. Tsindrio "+ Andro".')}<//>` : html`
    <div class="table-wrap"><table class="table">
      <thead><tr><th>${tr('Jour', 'Day', 'Andro')}</th>${FOTOANA.map((f) => html`<th>${fotLabel(f)}</th>`)}<th class="num">Kcal</th><th class="num">Prot.</th><th class="num">CG</th><th class="num">${tr('Coût', 'Cost', 'Coût')}</th><th>${tr('Statut', 'Status', 'Sata')}</th><th></th></tr></thead>
      <tbody>${menus.map((m) => {
        const t = menuTotals(m, data.plats, data.composition, ingMap);
        const st = menuStatus(m, t, category);
        return html`<tr>
          <td><input class="andro-input" value=${m.andro || ''} onChange=${(e) => update(m, { andro: e.target.value })} /></td>
          ${FOTOANA.map((f) => {
            const k = SLOT_KEYS[f];
            return html`<td><select class="slot" value=${m[k] || ''} onChange=${(e) => update(m, { [k]: e.target.value || null })}>
              <option value="">—</option>
              ${options(f).map((p) => html`<option value=${p.id}>${platTitle(p)} · ${fmt(platKcal.get(p.id))} kcal${p.fotoana !== f ? ' (' + fotLabel(p.fotoana) + ')' : ''}</option>`)}
            </select></td>`;
          })}
          <td class="num"><b>${fmt(t.kcal)}</b></td>
          <td class="num">${fmt(t.proteines)}</td>
          <td class="num">${fmt(t.cg)}</td>
          <td class="num">${fmt(t.cout)}</td>
          <td><${Badge} tone=${st.tone}>${statusLabel(st)}${pctBadge(st.ecart)}<//>${t.missing ? html` <${Badge} tone="warn">${tr('incomplet', 'incomplete', 'tsy feno')}<//>` : null}</td>
          <td><button class="btn ghost small" onClick=${() => del(m)}>✕</button></td>
        </tr>`;
      })}</tbody>
    </table></div>`}
  </div>`;
}
