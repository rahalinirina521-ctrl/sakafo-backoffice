import { html, useState, useMemo } from '../lib.js';
import { useApp, Badge, navigate, Empty, pctBadge } from '../ui.js';
import { platTotals, slotTarget, fitStatus, FOTOANA, optionList, fmt, pct } from '../calc.js';
import { tr, fotLabel, catName, platTitle } from '../i18n.js';

export const fitLabel = (f) => ({
  Mety: tr('Adapté', 'Fits', 'Mety'),
  'Be loatra': tr('Trop', 'Too much', 'Be loatra'),
  'Kely loatra': tr('Trop peu', 'Too little', 'Kely loatra'),
}[f.label] || f.label);
export const statutLabel = (s) => (s === 'Voamarina' ? tr('Validé', 'Validated', 'Voamarina') : tr('Brouillon', 'Draft', 'Draft'));

export function PlatsList() {
  const { data, ingMap } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [fot, setFot] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.plats
      .filter((p) => (!s || (p.nom + ' ' + (p.nom_commercial || '') + ' ' + p.id).toLowerCase().includes(s)))
      .filter((p) => (!cat || (p.categories || []).includes(cat)))
      .filter((p) => (!fot || p.fotoana === fot))
      .map((p) => ({ p, t: platTotals(p.id, data.composition, ingMap) }))
      .sort((a, b) => a.p.id.localeCompare(b.p.id));
  }, [data, ingMap, q, cat, fot]);

  const catObj = data.categories.find((c) => c.id === cat);

  return html`<div class="page">
    <div class="page-head">
      <h1>${tr('Plats', 'Dishes', 'Sakafo')} <span class="muted">(${data.plats.length})</span></h1>
      <button class="btn primary" onClick=${() => navigate('/plats/vaovao')}>+ ${tr('Nouveau plat', 'New dish', 'Sakafo vaovao')}</button>
    </div>
    <div class="filters">
      <input type="search" placeholder=${tr('Rechercher…', 'Search…', 'Hikaroka…')} value=${q} onInput=${(e) => setQ(e.target.value)} />
      <select value=${cat} onChange=${(e) => setCat(e.target.value)}>
        <option value="">${tr('Toutes les catégories', 'All categories', 'Sokajy rehetra')}</option>
        ${[...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map((c) => html`<option value=${c.id}>${catName(c)}</option>`)}
      </select>
      <select value=${fot} onChange=${(e) => setFot(e.target.value)}>
        <option value="">${tr('Tous les moments', 'All meal times', 'Fotoana rehetra')}</option>
        ${optionList('fotoana', FOTOANA, data.options).map((f) => html`<option value=${f}>${fotLabel(f)}</option>`)}
      </select>
    </div>
    ${rows.length === 0 ? html`<${Empty}>${tr('Aucun plat pour l\'instant. Cliquez sur « + Nouveau plat ».', 'No dishes yet. Click "+ New dish".', 'Mbola tsy misy sakafo. Tsindrio "+ Sakafo vaovao".')}<//>` : html`
    <div class="table-wrap"><table class="table">
      <thead><tr><th>ID</th><th>${tr('Nom', 'Name', 'Anarana')}</th><th>${tr('Moment', 'Meal', 'Fotoana')}</th><th class="num">Kcal</th><th class="num">${tr('Prot.', 'Prot.', 'Prot.')}</th><th class="num">${tr('Gluc.', 'Carbs', 'Gluc.')}</th><th class="num">${tr('Lip.', 'Fat', 'Lip.')}</th><th class="num">% prot</th>${catObj && html`<th>${tr('Adapté à', 'Fits', 'Mety amin\'ny')} ${catName(catObj)} ?</th>`}<th>${tr('Statut', 'Status', 'Sata')}</th></tr></thead>
      <tbody>${rows.map(({ p, t }) => {
        const fit = catObj ? fitStatus(t.kcal, slotTarget(catObj, p.fotoana), catObj.tolerance) : null;
        const title = platTitle(p);
        return html`<tr class="clickable" onClick=${() => navigate('/plats/' + p.id)}>
          <td class="mono">${p.id}</td>
          <td><b>${title}</b>${title !== p.nom ? html`<div class="muted small">${p.nom}</div>` : null}${t.missing > 0 && html` <${Badge} tone="warn">${t.missing} ${tr('ingr. incomplets', 'incomplete ingr.', 'ingr. tsy feno')}<//>`}</td>
          <td>${fotLabel(p.fotoana)}</td>
          <td class="num"><b>${fmt(t.kcal)}</b></td>
          <td class="num">${fmt(t.proteines, 1)}</td>
          <td class="num">${fmt(t.glucides, 1)}</td>
          <td class="num">${fmt(t.lipides, 1)}</td>
          <td class="num">${pct(t.protPct)}</td>
          ${fit && html`<td><${Badge} tone=${fit.tone}>${fitLabel(fit)}${pctBadge(fit.ecart)}<//></td>`}
          <td><${Badge} tone=${p.statut === 'Voamarina' ? 'ok' : 'muted'}>${statutLabel(p.statut)}<//></td>
        </tr>`;
      })}</tbody>
    </table></div>`}
  </div>`;
}
