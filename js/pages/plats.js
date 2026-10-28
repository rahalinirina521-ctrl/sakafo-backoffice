import { html, useState, useMemo } from '../lib.js';
import { useApp, Badge, navigate, Empty } from '../ui.js';
import { platTotals, slotTarget, fitStatus, FOTOANA, fmt, pct } from '../calc.js';

export function PlatsList() {
  const { data, ingMap } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [fot, setFot] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.plats
      .filter((p) => (!s || (p.nom + ' ' + p.id).toLowerCase().includes(s)))
      .filter((p) => (!cat || (p.categories || []).includes(cat)))
      .filter((p) => (!fot || p.fotoana === fot))
      .map((p) => ({ p, t: platTotals(p.id, data.composition, ingMap) }))
      .sort((a, b) => a.p.id.localeCompare(b.p.id));
  }, [data, ingMap, q, cat, fot]);

  const catObj = data.categories.find((c) => c.id === cat);

  return html`<div class="page">
    <div class="page-head">
      <h1>Sakafo <span class="muted">(${data.plats.length})</span></h1>
      <button class="btn primary" onClick=${() => navigate('/plats/vaovao')}>+ Sakafo vaovao</button>
    </div>
    <div class="filters">
      <input type="search" placeholder="Hikaroka…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <select value=${cat} onChange=${(e) => setCat(e.target.value)}>
        <option value="">Sokajy rehetra</option>
        ${[...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map((c) => html`<option value=${c.id}>${c.nom}</option>`)}
      </select>
      <select value=${fot} onChange=${(e) => setFot(e.target.value)}>
        <option value="">Fotoana rehetra</option>
        ${FOTOANA.map((f) => html`<option>${f}</option>`)}
      </select>
    </div>
    ${rows.length === 0 ? html`<${Empty}>Mbola tsy misy sakafo. Tsindrio "+ Sakafo vaovao".<//>` : html`
    <div class="table-wrap"><table class="table">
      <thead><tr><th>ID</th><th>Anarana</th><th>Fotoana</th><th class="num">Kcal</th><th class="num">Prot.</th><th class="num">Gluc.</th><th class="num">Lip.</th><th class="num">% prot</th>${catObj && html`<th>Mety amin'ny ${catObj.nom}?</th>`}<th>Sata</th></tr></thead>
      <tbody>${rows.map(({ p, t }) => {
        const fit = catObj ? fitStatus(t.kcal, slotTarget(catObj, p.fotoana), catObj.tolerance) : null;
        return html`<tr class="clickable" onClick=${() => navigate('/plats/' + p.id)}>
          <td class="mono">${p.id}</td>
          <td><b>${p.nom}</b>${p.nom_commercial ? html`<div class="muted small">${p.nom_commercial}</div>` : null}${t.missing > 0 && html` <${Badge} tone="warn">${t.missing} ingr. tsy feno<//>`}</td>
          <td>${p.fotoana || '—'}</td>
          <td class="num"><b>${fmt(t.kcal)}</b></td>
          <td class="num">${fmt(t.proteines, 1)}</td>
          <td class="num">${fmt(t.glucides, 1)}</td>
          <td class="num">${fmt(t.lipides, 1)}</td>
          <td class="num">${pct(t.protPct)}</td>
          ${fit && html`<td><${Badge} tone=${fit.tone}>${fit.label}${fit.ecart !== null ? ' (' + (fit.ecart > 0 ? '+' : '') + Math.round(fit.ecart * 100) + '%)' : ''}<//></td>`}
          <td><${Badge} tone=${p.statut === 'Voamarina' ? 'ok' : 'muted'}>${p.statut || 'Draft'}<//></td>
        </tr>`;
      })}</tbody>
    </table></div>`}
  </div>`;
}
