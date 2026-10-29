// Mpisafidy misy fikarohana sy sary: sakafo (plat) sy menu.
import { html, useState, useMemo } from './lib.js?v=202610290520';
import { useApp, Badge } from './ui.js?v=202610290520';
import { platTotals, menuTotals, menuRepas, fmt } from './calc.js?v=202610290520';
import { tr, fotLabel, catName, platTitle } from './i18n.js?v=202610290520';

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
// Aseho daholo ny sakafo: ny mifanaraka amin'ny fotoana sy tanjona eo ambony, ny hafa eo ambany.
export function PlatPicker({ value, fotoana, categorieId, onChange, placeholder }) {
  const { data, ingMap } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const plat = data.plats.find((p) => p.id === value);
  const kcal = (id) => platTotals(id, data.composition, ingMap).kcal;

  const groups = useMemo(() => {
    if (!open) return { top: [], rest: [] };
    const q = norm(search).trim();
    const ingNames = (pid) => data.composition.filter((c) => c.plat_id === pid).map((c) => { const i = ingMap.get(c.ingredient_id); return i ? `${i.nom_fr || ''} ${i.nom_mg || ''} ${i.nom_en || ''}` : ''; }).join(' ');
    const words = q.split(/\s+/).filter(Boolean);
    const rows = data.plats
      .filter((p) => { if (!words.length) return true; const hay = norm(`${p.nom} ${p.nom_commercial || ''} ${p.id} ${fotLabel(p.fotoana)} ${ingNames(p.id)}`); return words.every((w) => hay.includes(w)); })
      .map((p) => {
        const sameMoment = !fotoana || p.fotoana === fotoana;
        const sameCat = !categorieId || (p.categories || []).includes(categorieId);
        return { p, k: kcal(p.id), score: (sameMoment ? 2 : 0) + (sameCat ? 1 : 0) };
      })
      .sort((a, b) => b.score - a.score || platTitle(a.p).localeCompare(platTitle(b.p)));
    return { top: rows.filter((r) => r.score >= 2), rest: rows.filter((r) => r.score < 2) };
  }, [open, search, data, ingMap, fotoana, categorieId]);

  const item = ({ p, k }) => html`<button class=${'picker-item' + (p.id === value ? ' on' : '')} onClick=${() => { onChange(p.id); setOpen(false); setSearch(''); }}>
    <${Thumb} plat=${p} size=${56} />
    <span class="pi-text"><b>${platTitle(p)}</b><small>${p.nom !== platTitle(p) ? p.nom + ' · ' : ''}${fotLabel(p.fotoana)}${p.prix_vente ? ' · ' + fmt(p.prix_vente) + ' Ar' : ''}</small>
      <span class="pi-badges">${(p.details?.regimes || []).slice(0, 2).map((r) => html`<${Badge} tone="ok">${r}<//>`)}</span></span>
    <span class="pi-kcal"><b>${fmt(k)}</b><small>kcal</small></span>
  </button>`;
  const total = groups.top.length + groups.rest.length;

  return html`<span class="picker-wrap">
    <button type="button" class=${'picker-btn' + (plat ? '' : ' empty')} onClick=${() => setOpen(true)}>
      ${plat ? html`<${Thumb} plat=${plat} size=${36} /><span class="pb-text"><b>${platTitle(plat)}</b><small>${fmt(kcal(plat.id))} kcal${fotoana && plat.fotoana !== fotoana ? ' · ' + fotLabel(plat.fotoana) : ''}</small></span>`
        : html`<span class="pb-text muted">${placeholder || tr('Choisir un plat…', 'Choose a dish…', 'Misafidiana sakafo…')}</span>`}
      <span class="pb-caret">▾</span>
    </button>
    ${open && html`<${PickerModal} title=${fotoana ? tr('Plat pour : ', 'Dish for: ', 'Sakafo ho an\'ny: ') + fotLabel(fotoana) : tr('Choisir un plat', 'Choose a dish', 'Misafidiana sakafo')} onClose=${() => setOpen(false)} search=${search} setSearch=${setSearch}
      filters=${html`<p class="muted small picker-count">${total} ${tr('plat(s)', 'dish(es)', 'sakafo')}${search ? ' · « ' + search + ' »' : ''}</p>`}>
      ${value && html`<button class="picker-item clear" onClick=${() => { onChange(null); setOpen(false); }}>✕ ${tr('Retirer le plat', 'Remove the dish', 'Esory ny sakafo')}</button>`}
      ${total === 0 && html`<p class="muted center-text">${data.plats.length ? tr('Aucun plat ne correspond à la recherche.', 'No dish matches the search.', 'Tsy misy sakafo mifanaraka amin\'ny fikarohana.') : tr('Aucun plat encore. Créez-en dans « Plats ».', 'No dish yet. Create some in "Dishes".', 'Mbola tsy misy sakafo. Mamorona ao amin\'ny "Sakafo".')}</p>`}
      ${groups.top.length > 0 && fotoana && html`<p class="picker-group">${tr('Pour', 'For', 'Ho an\'ny')} ${fotLabel(fotoana)}</p>`}
      ${groups.top.map(item)}
      ${groups.rest.length > 0 && fotoana && html`<p class="picker-group">${groups.top.length ? tr('Autres plats', 'Other dishes', 'Sakafo hafa') : tr('Aucun plat « ', 'No "', 'Tsy misy sakafo "') + fotLabel(fotoana) + tr(' » encore : tous les plats', '" dish yet: all dishes', '" mbola: sakafo rehetra')}</p>`}
      ${groups.rest.map(item)}
    <//>`}
  </span>`;
}

// ---------- Menu ----------
export function MenuPicker({ value, categorieId, onChange, placeholder, compact, suggestedId }) {
  const { data, ingMap } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const menu = data.menus.find((m) => m.id === value);
  const tot = (m) => menuTotals(m, data.plats, data.composition, ingMap);
  const platsOf = (m) => menuRepas(m).map((r) => data.plats.find((p) => p.id === r.plat_id)).filter(Boolean);

  const list = useMemo(() => {
    if (!open) return [];
    const words = norm(search).trim().split(/\s+/).filter(Boolean);
    return data.menus
      .filter((m) => { if (!words.length) return true; const hay = norm(`${m.nom || ''} ${m.id} ${platsOf(m).map((p) => platTitle(p) + ' ' + p.nom).join(' ')}`); return words.every((w) => hay.includes(w)); })
      .sort((a, b) => ((b.categorie_id === categorieId) - (a.categorie_id === categorieId)) || (a.nom || '').localeCompare(b.nom || '', 'fr', { numeric: true }));
  }, [open, search, data, categorieId]);

  const filters = html`<p class="muted small picker-count">${list.length} menu(s)</p>`;

  return html`<span class="picker-wrap">
    <button type="button" class=${'picker-btn' + (menu ? '' : ' empty') + (compact ? ' compact' : '')} onClick=${() => setOpen(true)}>
      ${menu ? html`<span class="thumbs">${platsOf(menu).slice(0, 3).map((p) => html`<${Thumb} plat=${p} size=${28} />`)}</span><span class="pb-text"><b>${menu.nom || menu.id}</b><small>${fmt(tot(menu).kcal)} kcal · ${platsOf(menu).length} ${tr('repas', 'meals', 'sakafo')}</small></span>`
        : html`<span class="pb-text muted">${placeholder || tr('Choisir un menu…', 'Choose a menu…', 'Misafidiana menu…')}</span>`}
      <span class="pb-caret">▾</span>
    </button>
    ${open && html`<${PickerModal} title=${tr('Choisir un menu', 'Choose a menu', 'Misafidiana menu')} onClose=${() => setOpen(false)} search=${search} setSearch=${setSearch} filters=${filters}>
      ${value && html`<button class="picker-item clear" onClick=${() => { onChange(null); setOpen(false); }}>✕ ${tr('Aucun menu ce jour', 'No menu this day', 'Tsy misy menu amin\'io andro io')}</button>`}
      ${suggestedId && data.menus.find((m) => m.id === suggestedId) && (() => {
        const m = data.menus.find((x) => x.id === suggestedId);
        const ps = platsOf(m);
        return html`<p class="picker-group">💡 ${tr('Suggestion : menu général du jour', 'Suggestion: general menu of the day', 'Soso-kevitra: menu iraisana androany')}</p>
          <button class="picker-item suggest" onClick=${() => { onChange(m.id); setOpen(false); setSearch(''); }}>
            <span class="thumbs">${ps.slice(0, 4).map((p) => html`<${Thumb} plat=${p} size=${40} />`)}</span>
            <span class="pi-text"><b>${m.nom || m.id}</b><small>${ps.map((p) => platTitle(p)).join(' · ')}</small></span>
            <span class="pi-kcal"><b>${fmt(tot(m).kcal)}</b><small>kcal</small></span>
          </button>
          <p class="picker-group">${tr('Tous les menus', 'All menus', 'Menus rehetra')}</p>`;
      })()}
      ${list.length === 0 && html`<p class="muted center-text">${tr('Aucun menu. Créez-en un dans « Menus ».', 'No menu. Create one in "Menus".', 'Tsy misy menu. Mamorona ao amin\'ny "Menus".')}</p>`}
      ${list.map((m) => {
        const t = tot(m);
        const ps = platsOf(m);
        return html`<button class=${'picker-item' + (m.id === value ? ' on' : '')} onClick=${() => { onChange(m.id); setOpen(false); setSearch(''); }}>
          <span class="thumbs">${ps.slice(0, 4).map((p) => html`<${Thumb} plat=${p} size=${40} />`)}</span>
          <span class="pi-text"><b>${m.nom || m.id}</b><small>${catName(data.categories.find((c) => c.id === m.categorie_id))} · ${ps.map((p) => platTitle(p)).join(' · ')}</small></span>
          <span class="pi-kcal"><b>${fmt(t.kcal)}</b><small>kcal</small></span>
        </button>`;
      })}
    <//>`}
  </span>`;
}
