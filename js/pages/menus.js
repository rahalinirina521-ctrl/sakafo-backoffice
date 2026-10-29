// Menus = modèles réutilisables (Menu 1, Menu 2…) avec une liste de repas libre.
import { html, useState, useMemo } from '../lib.js?v=202610290636';
import { useApp, Badge, Card, Field, Empty, navigate, pctBadge, SelectOrAdd } from '../ui.js?v=202610290636';
import { menuTotals, menuStatus, menuRepas, nextId, uid, platTotals, slotTarget, fmt, pct, FOTOANA } from '../calc.js?v=202610290636';
import { tr, fotLabel, catName, platTitle } from '../i18n.js?v=202610290636';
import { PlatPicker, Thumb } from '../pickers.js?v=202610290636';

export const statusLabel = (s) => ({
  OK: 'OK',
  'Amboary ny kcal': tr('Ajuster les kcal', 'Adjust kcal', 'Amboary ny kcal'),
  'CG ambony loatra': tr('Charge glycémique trop haute', 'Glycemic load too high', 'CG ambony loatra'),
  'Tsy misy tanjona': tr('Pas de cible', 'No target', 'Tsy misy tanjona'),
}[s.label] || s.label);

const DEFAULT_REPAS = ['Maraina', 'Atoandro', 'Goûter', 'Hariva'];

export function Menus() {
  const { data, ingMap } = useApp();
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const usage = useMemo(() => {
    const m = new Map();
    for (const c of data.calendrier || []) if (c.menu_id) m.set(c.menu_id, (m.get(c.menu_id) || 0) + 1);
    return m;
  }, [data.calendrier]);
  const list = data.menus
    .filter((m) => !cat || m.categorie_id === cat)
    .filter((m) => !q || (m.nom || m.id).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.nom || a.id).localeCompare(b.nom || b.id, 'fr', { numeric: true }));

  return html`<div class="page">
    <div class="page-head">
      <h1>Menus <span class="muted">(${data.menus.length})</span></h1>
      <button class="btn primary" onClick=${() => navigate('/menus/vaovao' + (cat ? '?cat=' + cat : ''))}>+ ${tr('Nouveau menu', 'New menu', 'Menu vaovao')}</button>
    </div>
    <p class="muted small">${tr('Un menu = une journée de repas, réutilisable autant de fois que vous voulez dans le planning (la même semaine, ou pour plusieurs clients).', 'A menu = one day of meals, reusable as often as you want in the planning (same week, or for several clients).', 'Menu iray = sakafo indray andro, azo averina im-betsaka ao amin\'ny planning (herinandro iray ihany, na ho an\'ny client maromaro).')}</p>
    <div class="filters">
      <input type="search" placeholder=${tr('Rechercher…', 'Search…', 'Hikaroka…')} value=${q} onInput=${(e) => setQ(e.target.value)} />
    </div>
    <div class="tabs wrap">
      <button class=${'tab' + (!cat ? ' on' : '')} onClick=${() => setCat('')}>${tr('Tous', 'All', 'Rehetra')}</button>
      ${cats.map((c) => html`<button class=${'tab' + (c.id === cat ? ' on' : '')} onClick=${() => setCat(c.id)}>${catName(c)}</button>`)}
    </div>
    ${list.length === 0 ? html`<${Empty}>${tr('Aucun menu. Cliquez sur « + Nouveau menu ».', 'No menu yet. Click "+ New menu".', 'Mbola tsy misy menu. Tsindrio "+ Menu vaovao".')}<//>` : html`
    <div class="menu-grid">${list.map((m) => {
      const c = data.categories.find((x) => x.id === m.categorie_id);
      const t = menuTotals(m, data.plats, data.composition, ingMap);
      const st = menuStatus(m, t, c);
      return html`<a class="menu-card" href=${'#/menus/' + m.id}>
        <header><b>${m.nom || m.id}</b><${Badge} tone=${st.tone}>${statusLabel(st)}${pctBadge(st.ecart)}<//></header>
        <div class="muted small">${c ? catName(c) : '—'}${usage.get(m.id) ? ' · ' + tr('utilisé', 'used', 'nampiasaina') + ' ' + usage.get(m.id) + ' ' + tr('j', 'd', 'andro') : ''}</div>
        <ul class="menu-meals">${menuRepas(m).map((r) => {
          const p = data.plats.find((x) => x.id === r.plat_id);
          return html`<li><${Thumb} plat=${p} size=${32} /><span><small class="muted">${fotLabel(r.fotoana)}</small><br/>${p ? platTitle(p) : '—'}</span></li>`;
        })}</ul>
        <footer><b>${fmt(t.kcal)} kcal</b><span>${t.prix ? fmt(t.prix) + ' Ar' : ''}</span></footer>
      </a>`;
    })}</div>`}
  </div>`;
}

// ---------------------------------------------------------------
export function MenuEdit({ id }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const isNew = id === 'vaovao';
  const existing = data.menus.find((m) => m.id === id);
  const presetCat = (location.hash.split('?cat=')[1] || '').split('&')[0];
  const [form, setForm] = useState(() => {
    if (existing) return { ...existing, repas: menuRepas(existing).map((r) => ({ ...r, id: r.id || uid() })) };
    const n = data.menus.length + 1;
    return { id: nextId('MN', data.menus), nom: tr('Menu ', 'Menu ', 'Menu ') + n, categorie_id: presetCat || [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))[0]?.id || null, repas: DEFAULT_REPAS.map((f) => ({ id: uid(), fotoana: f, plat_id: null })), notes: '' };
  });
  const [dirty, setDirty] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const cat = data.categories.find((c) => c.id === form.categorie_id);
  const totals = useMemo(() => menuTotals(form, data.plats, data.composition, ingMap), [form, data, ingMap]);

  if (!isNew && !existing) return html`<div class="page"><p>${tr('Menu introuvable.', 'Menu not found.', 'Tsy hita ny menu.')}</p><a href="#/menus">← Menus</a></div>`;

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };
  const setRepas = (fn) => { setForm((f) => ({ ...f, repas: fn(f.repas) })); setDirty(true); };
  const move = (i, d) => setRepas((rs) => { const j = i + d; if (j < 0 || j >= rs.length) return rs; const n = [...rs]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const st = menuStatus(form, totals, cat);
  const usedDays = (data.calendrier || []).filter((c) => c.menu_id === form.id).length;

  async function save() {
    setBusy(true);
    try {
      const row = { ...form, nom: (form.nom || '').trim() || form.id, repas: form.repas.filter((r) => r.fotoana), andro: null, maraina: null, atoandro: null, hariva: null, gouter: null };
      await app.save('menus', row);
      setDirty(false);
      toast(tr('Menu enregistré', 'Menu saved', 'Voatahiry ny menu'));
      if (isNew) navigate('/menus/' + row.id);
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  }
  async function del() {
    if (!confirm(tr(`Supprimer « ${form.nom} » ?${usedDays ? ' Il sera retiré de ' + usedDays + ' jour(s) du planning.' : ''}`, `Delete "${form.nom}"?${usedDays ? ' It will be removed from ' + usedDays + ' planning day(s).' : ''}`, `Hofafana ve ny "${form.nom}"?${usedDays ? ' Hesorina amin\'ny andro ' + usedDays + ' ao amin\'ny planning.' : ''}`))) return;
    try {
      const ids = (data.calendrier || []).filter((c) => c.menu_id === form.id).map((c) => c.id);
      if (ids.length) await app.del('calendrier', ids);
      await app.del('menus', form.id); navigate('/menus');
    } catch (e) { toast(e.message, 'bad'); }
  }
  async function duplicate() {
    const copy = { ...form, id: nextId('MN', data.menus), nom: (form.nom || '') + ' (' + tr('copie', 'copy', 'kopia') + ')', repas: form.repas.map((r) => ({ ...r, id: uid() })) };
    try { await app.save('menus', copy); navigate('/menus/' + copy.id); toast(tr('Menu dupliqué', 'Menu duplicated', 'Voadika ny menu')); } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="page">
    <div class="page-head">
      <div><a href="#/menus" class="muted">← Menus</a><h1>${form.nom || form.id}<span class="muted mono small"> ${form.id}</span></h1></div>
      <div class="row gap save-bar">
        ${!isNew && html`<button class="btn ghost" onClick=${duplicate}>${tr('Dupliquer', 'Duplicate', 'Adikao')}</button>`}
        ${!isNew && html`<button class="btn danger ghost" onClick=${del}>${tr('Supprimer', 'Delete', 'Fafao')}</button>`}
        <button class="btn primary" disabled=${busy || !dirty} onClick=${save}>${busy ? tr('Enregistrement…', 'Saving…', 'Mitahiry…') : dirty ? tr('Enregistrer', 'Save', 'Tehirizo') : tr('Enregistré ✓', 'Saved ✓', 'Voatahiry ✓')}</button>
      </div>
    </div>

    <div class="edit-grid">
      <div class="col">
        <${Card} title=${tr('Le menu', 'The menu', 'Momba ny menu')}>
          <div class="form-grid">
            <${Field} label=${tr('Nom', 'Name', 'Anarana')}><input value=${form.nom || ''} onInput=${(e) => set('nom', e.target.value)} placeholder="Menu 1" /><//>
            <${Field} label=${tr('Objectif', 'Goal', 'Tanjona')}>
              <select value=${form.categorie_id || ''} onChange=${(e) => set('categorie_id', e.target.value || null)}>
                ${[...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map((c) => html`<option value=${c.id}>${catName(c)}</option>`)}
              </select>
            <//>
            <${Field} label=${tr('Note', 'Note', 'Fanamarihana')} wide><input value=${form.notes || ''} onInput=${(e) => set('notes', e.target.value)} /><//>
          </div>
        <//>

        <${Card} title=${tr('Repas de la journée', 'Meals of the day', 'Sakafo isan\'andro')}>
          <p class="hint">${tr('Ajoutez autant de repas que nécessaire (ex. collation du matin ET goûter), dans l\'ordre de la journée. Le choix du plat propose d\'abord les plats de ce moment.', 'Add as many meals as needed (e.g. morning snack AND afternoon snack), in the order of the day. The dish picker first shows dishes for that meal time.', 'Ampio araka izay ilaina (ohatra: tsakitsaky maraina SY goûter), araka ny filaharan\'ny andro. Ny sakafo mifanaraka amin\'io fotoana io no aseho voalohany.')}</p>
          <div class="repas-list">${form.repas.map((r, i) => {
            const p = data.plats.find((x) => x.id === r.plat_id);
            const k = p ? platTotals(p.id, data.composition, ingMap).kcal : 0;
            const target = slotTarget(cat, r.fotoana);
            return html`<div class="repas-row" key=${r.id}>
              <div class="repas-moment"><${SelectOrAdd} type="fotoana" value=${r.fotoana} defaults=${FOTOANA} labelFn=${fotLabel} onChange=${(v) => setRepas((rs) => rs.map((x, j) => (j === i ? { ...x, fotoana: v } : x)))} /></div>
              <div class="repas-plat"><${PlatPicker} value=${r.plat_id} fotoana=${r.fotoana} categorieId=${form.categorie_id} onChange=${(v) => setRepas((rs) => rs.map((x, j) => (j === i ? { ...x, plat_id: v } : x)))} /></div>
              <div class="repas-kcal">${p ? html`<b>${fmt(k)}</b> kcal${target ? html`<small class="muted"> / ${fmt(target)}</small>` : null}` : html`<span class="muted small">—</span>`}</div>
              <div class="line-actions">
                <button class="btn ghost small" disabled=${i === 0} onClick=${() => move(i, -1)} title=${tr('Monter', 'Move up', 'Akaro')}>↑</button>
                <button class="btn ghost small" disabled=${i === form.repas.length - 1} onClick=${() => move(i, 1)} title=${tr('Descendre', 'Move down', 'Ampidino')}>↓</button>
                <button class="btn ghost small danger" onClick=${() => setRepas((rs) => rs.filter((_, j) => j !== i))} title=${tr('Retirer', 'Remove', 'Esory')}>✕</button>
              </div>
            </div>`;
          })}</div>
          <div class="row gap wrap">
            <button class="btn" onClick=${() => setRepas((rs) => [...rs, { id: uid(), fotoana: 'Goûter', plat_id: null }])}>+ ${tr('Ajouter un repas', 'Add a meal', 'Ampio sakafo')}</button>
          </div>
        <//>
      </div>

      <div class="col side">
        <${Card} title=${tr('Bilan de la journée', 'Day summary', 'Fehiny isan\'andro')} class="sticky">
          <div class="big-kcal">${fmt(totals.kcal)}<span>kcal</span></div>
          <p>${tr('Cible', 'Target', 'Tanjona')} ${cat ? catName(cat) : ''} : <b>${cat?.kcal_cible ? fmt(cat.kcal_cible) + ' kcal' : '—'}</b> <${Badge} tone=${st.tone}>${statusLabel(st)}${pctBadge(st.ecart)}<//></p>
          <table class="kv">
            <tr><td>${tr('Protéines', 'Protein', 'Protéines')}</td><td>${fmt(totals.proteines, 1)} g</td><td class="muted">${pct(totals.kcal ? totals.proteines * 4 / totals.kcal : 0)}</td></tr>
            <tr><td>${tr('Glucides', 'Carbohydrates', 'Glucides')}</td><td>${fmt(totals.glucides, 1)} g</td><td></td></tr>
            <tr><td>${tr('Lipides', 'Fat', 'Lipides')}</td><td>${fmt(totals.lipides, 1)} g</td><td></td></tr>
            <tr><td>${tr('Charge glycémique', 'Glycemic load', 'Charge glycémique')}</td><td>${fmt(totals.cg)}</td><td></td></tr>
            <tr><td>${tr('Coût matière', 'Food cost', 'Coût')}</td><td>${fmt(totals.cout)} Ar</td><td></td></tr>
            <tr><td>${tr('Prix (somme des plats)', 'Price (sum of dishes)', 'Vidiny (sakafo rehetra)')}</td><td>${totals.prix ? fmt(totals.prix) + ' Ar' : '—'}</td><td class="muted small">${totals.prixManquant ? totals.prixManquant + ' ' + tr('sans prix', 'without price', 'tsy misy vidiny') : ''}</td></tr>
          </table>
          ${totals.missing > 0 && html`<p class="warn-box small">${tr('Certains plats ont des ingrédients sans valeurs : bilan incomplet.', 'Some dishes have ingredients without values: incomplete.', 'Misy sakafo tsy feno valeur: tsy feno ny fehiny.')}</p>`}
          ${!isNew && html`<p class="muted small">${tr('Utilisé', 'Used', 'Nampiasaina')} ${usedDays} ${tr('jour(s) dans le planning.', 'day(s) in the planning.', 'andro ao amin\'ny planning.')} <a href="#/planning">${tr('Ouvrir le planning', 'Open planning', 'Sokafy ny planning')} →</a></p>`}
        <//>
      </div>
    </div>
  </div>`;
}
