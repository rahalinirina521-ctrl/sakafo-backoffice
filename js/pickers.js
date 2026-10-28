// Mpisafidy misy fikarohana sy sary: sakafo (plat) sy menu.
import { html, useState, useMemo } from './lib.js';
import { useApp, Badge } from './ui.js';
import { platTotals, menuTotals, menuRepas, fmt } from './calc.js';
import { tr, fotLabel, catName, platTitle } from './i18n.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function Thumb({ plat, size = 44 }) {
  const st = `width:${size}px;height:${size}px`;
  if (plat?.image_url) return html`<img class="thumb" style=${st} src=${plat.image_url} alt="" loading="lazy" />`;
  const t = (platTitle(plat || {}) || '?').trim().charAt(0).toUpperCase();
  return html`<span class="thumb ph" style=${st}>${t}</span>`;
}

function PickerModal({ title, onClose, children, search, setSearch, filters }) {
  return html`<div class="modal-back" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal wide picker" role="dialog" aria-modal="true">
      <header class="card-head"><h2>${title}</h2><button class="btn ghost" onClick=${onClose} aria-label=${tr('Fermer', 'Close', 'Hidio')}>✕</button></header>
      <input class="picker-search" type="search" autofocus placeholder=${tr('Rechercher par nom ou ingrédient…', 'Search by name or ingredient…', 'Hikaroka amin\'ny anarana na ingrédient…')} value=${search} onInput=${(e) => setSearch(e.target.value)} />
      ${filters}
      <div class="picker-list">${children}</div>
    </div>
  </div>`;
}

// ---------- Sakafo ----------
export function PlatPicker({ value, fotoana, categorieId, onChange, placeholder }) {
  const { data, ingMap } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('moment'); // moment | tous
  const [onlyCat, setOnlyCat] = useState(!!categorieId);
  const plat = data.plats.find((p) => p.id === value);
  const kcal = (id) => platTotals(id, data.composition, ingMap).kcal;

  const list = useMemo(() => {
    if (!open) return [];
    const q = norm(search);
    const ingNames = (pid) => data.composition.filter((c) => c.plat_id === pid).map((c) => { const i = ingMap.get(c.ingredient_id); return i ? `${i.nom_fr || ''} ${i.nom_mg || ''} ${i.nom_en || ''}` : ''; }).join(' ');
    return data.plats
      .filter((p) => scope === 'tous' || !fotoana || p.fotoana === fotoana)
      .filter((p) => !onlyCat || !categorieId || (p.categories || []).includes(categorieId))
      .filter((p) => !q || norm(`${p.nom} ${p.nom_commercial || ''} ${p.id} ${ingNames(p.id)}`).includes(q))
      .map((p) => ({ p, k: kcal(p.id) }))
      .sort((a, b) => platTitle(a.p).localeCompare(platTitle(b.p)));
  }, [open, search, scope, onlyCat, data, ingMap, fotoana, categorieId]);

  const cat = data.categories.find((c) => c.id === categorieId);
  const filters = html`<div class="picker-filters">
    ${fotoana && html`<div class="tabs mini">
      <button class=${'tab' + (scope === 'moment' ? ' on' : '')} onClick=${() => setScope('moment')}>${fotLabel(fotoana)}</button>
      <button class=${'tab' + (scope === 'tous' ? ' on' : '')} onClick=${() => setScope('tous')}>${tr('Tous les moments', 'All meal times', 'Fotoana rehetra')}</button>
    </div>`}
    ${cat && html`<label class="check"><input type="checkbox" checked=${onlyCat} onChange=${(e) => setOnlyCat(e.target.checked)} /> ${tr('Seulement', 'Only', 'Ho an\'ny')} ${catName(cat)}</label>`}
  </div>`;

  return html`<span class="picker-wrap">
    <button type="button" class=${'picker-btn' + (plat ? '' : ' empty')} onClick=${() => setOpen(true)}>
      ${plat ? html`<${Thumb} plat=${plat} size=${36} /><span class="pb-text"><b>${platTitle(plat)}</b><small>${fmt(kcal(plat.id))} kcal${fotoana && plat.fotoana !== fotoana ? ' · ' + fotLabel(plat.fotoana) : ''}</small></span>`
        : html`<span class="pb-text muted">${placeholder || tr('Choisir un plat…', 'Choose a dish…', 'Misafidiana sakafo…')}</span>`}
      <span class="pb-caret">▾</span>
    </button>
    ${open && html`<${PickerModal} title=${fotoana ? tr('Plat pour : ', 'Dish for: ', 'Sakafo ho an\'ny: ') + fotLabel(fotoana) : tr('Choisir un plat', 'Choose a dish', 'Misafidiana sakafo')} onClose=${() => setOpen(false)} search=${search} setSearch=${setSearch} filters=${filters}>
      ${value && html`<button class="picker-item clear" onClick=${() => { onChange(null); setOpen(false); }}>✕ ${tr('Retirer le plat', 'Remove the dish', 'Esory ny sakafo')}</button>`}
      ${list.length === 0 && html`<p class="muted center-text">${tr('Aucun plat trouvé. Essayez « Tous les moments ».', 'No dish found. Try "All meal times".', 'Tsy misy sakafo hita. Andramo "Fotoana rehetra".')}</p>`}
      ${list.map(({ p, k }) => html`<button class=${'picker-item' + (p.id === value ? ' on' : '')} onClick=${() => { onChange(p.id); setOpen(false); }}>
        <${Thumb} plat=${p} size=${56} />
        <span class="pi-text"><b>${platTitle(p)}</b><small>${p.nom !== platTitle(p) ? p.nom + ' · ' : ''}${fotLabel(p.fotoana)}${p.prix_vente ? ' · ' + fmt(p.prix_vente) + ' Ar' : ''}</small>
          <span class="pi-badges">${(p.details?.regimes || []).slice(0, 2).map((r) => html`<${Badge} tone="ok">${r}<//>`)}</span></span>
        <span class="pi-kcal"><b>${fmt(k)}</b><small>kcal</small></span>
      </button>`)}
    <//>`}
  </span>`;
}

// ---------- Menu ----------
export function MenuPicker({ value, categorieId, onChange, placeholder, compact }) {
  const { data, ingMap } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyCat, setOnlyCat] = useState(!!categorieId);
  const menu = data.menus.find((m) => m.id === value);
  const tot = (m) => menuTotals(m, data.plats, data.composition, ingMap);
  const platsOf = (m) => menuRepas(m).map((r) => data.plats.find((p) => p.id === r.plat_id)).filter(Boolean);

  const list = useMemo(() => {
    if (!open) return [];
    const q = norm(search);
    return data.menus
      .filter((m) => !onlyCat || !categorieId || m.categorie_id === categorieId)
      .filter((m) => !q || norm(`${m.nom || ''} ${m.id} ${platsOf(m).map((p) => platTitle(p) + ' ' + p.nom).join(' ')}`).includes(q))
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr', { numeric: true }));
  }, [open, search, onlyCat, data, categorieId]);

  const cat = data.categories.find((c) => c.id === categorieId);
  const filters = cat ? html`<div class="picker-filters"><label class="check"><input type="checkbox" checked=${onlyCat} onChange=${(e) => setOnlyCat(e.target.checked)} /> ${tr('Seulement', 'Only', 'Ho an\'ny')} ${catName(cat)}</label></div>` : null;

  return html`<span class="picker-wrap">
    <button type="button" class=${'picker-btn' + (menu ? '' : ' empty') + (compact ? ' compact' : '')} onClick=${() => setOpen(true)}>
      ${menu ? html`<span class="thumbs">${platsOf(menu).slice(0, 3).map((p) => html`<${Thumb} plat=${p} size=${28} />`)}</span><span class="pb-text"><b>${menu.nom || menu.id}</b><small>${fmt(tot(menu).kcal)} kcal · ${platsOf(menu).length} ${tr('repas', 'meals', 'sakafo')}</small></span>`
        : html`<span class="pb-text muted">${placeholder || tr('Choisir un menu…', 'Choose a menu…', 'Misafidiana menu…')}</span>`}
      <span class="pb-caret">▾</span>
    </button>
    ${open && html`<${PickerModal} title=${tr('Choisir un menu', 'Choose a menu', 'Misafidiana menu')} onClose=${() => setOpen(false)} search=${search} setSearch=${setSearch} filters=${filters}>
      ${value && html`<button class="picker-item clear" onClick=${() => { onChange(null); setOpen(false); }}>✕ ${tr('Aucun menu ce jour', 'No menu this day', 'Tsy misy menu amin\'io andro io')}</button>`}
      ${list.length === 0 && html`<p class="muted center-text">${tr('Aucun menu. Créez-en un dans « Menus ».', 'No menu. Create one in "Menus".', 'Tsy misy menu. Mamorona ao amin\'ny "Menus".')}</p>`}
      ${list.map((m) => {
        const t = tot(m);
        const ps = platsOf(m);
        return html`<button class=${'picker-item' + (m.id === value ? ' on' : '')} onClick=${() => { onChange(m.id); setOpen(false); }}>
          <span class="thumbs">${ps.slice(0, 4).map((p) => html`<${Thumb} plat=${p} size=${40} />`)}</span>
          <span class="pi-text"><b>${m.nom || m.id}</b><small>${catName(data.categories.find((c) => c.id === m.categorie_id))} · ${ps.map((p) => platTitle(p)).join(' · ')}</small></span>
          <span class="pi-kcal"><b>${fmt(t.kcal)}</b><small>kcal</small></span>
        </button>`;
      })}
    <//>`}
  </span>`;
}
