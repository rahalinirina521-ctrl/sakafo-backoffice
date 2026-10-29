// Planning : on place les menus sur les jours, par objectif (menu général) ou par client (menu personnalisé).
import { html, useState, useMemo } from '../lib.js?v=202610291427';
import { useApp, Badge, Card, Empty, pctBadge } from '../ui.js?v=202610291427';
import { menuTotals, menuStatus, isoDate, addDays, mondayOf, fmt } from '../calc.js?v=202610291427';
import { tr, catName, getLang } from '../i18n.js?v=202610291427';
import { MenuPicker } from '../pickers.js?v=202610291427';
import { statusLabel } from './menus.js?v=202610291427';

const locale = () => ({ fr: 'fr-FR', en: 'en-GB', mg: 'fr-FR' }[getLang()] || 'fr-FR');
const dayName = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'long' });
const dayShort = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });

export function Planning() {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const clients = [...(data.clients || [])].filter((c) => c.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom));
  const initClient = (location.hash.split('?client=')[1] || '').split('&')[0];
  const [scope, setScope] = useState(initClient ? 'client' : 'cat');
  const [catId, setCatId] = useState(cats[0]?.id || '');
  const [clientId, setClientId] = useState(initClient || clients[0]?.id || '');
  const [week, setWeek] = useState(mondayOf(isoDate(new Date())));
  const [weeksN, setWeeksN] = useState(1);
  const [busy, setBusy] = useState(false);
  const cal = data.calendrier || [];

  const client = clients.find((c) => c.id === clientId);
  const effCat = scope === 'client' ? client?.categorie_id : catId;
  const category = data.categories.find((c) => c.id === effCat);
  const cible = scope === 'client' && client?.kcal_cible ? client.kcal_cible : category?.kcal_cible;
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const today = isoDate(new Date());

  const menuKcal = useMemo(() => new Map(data.menus.map((m) => [m.id, menuTotals(m, data.plats, data.composition, ingMap)])), [data, ingMap]);

  const keyFor = (d) => (scope === 'cat' ? `cat:${catId}:${d}` : `cli:${clientId}:${d}`);
  const generic = (d, cid = effCat) => cal.find((c) => !c.client_id && c.categorie_id === cid && c.date === d);
  const own = (d) => cal.find((c) => c.id === keyFor(d));
  const resolve = (d) => {
    if (scope === 'cat') return { menuId: own(d)?.menu_id || null, source: own(d) ? 'own' : null };
    const o = own(d);
    return { menuId: o?.menu_id || null, source: o ? 'own' : null, suggestion: generic(d)?.menu_id || null };
  };
  const row = (d, menuId) => ({ id: keyFor(d), date: d, menu_id: menuId, categorie_id: scope === 'cat' ? catId : (client?.categorie_id || null), client_id: scope === 'client' ? clientId : null, notes: null });

  async function setDay(d, menuId) {
    try {
      if (!menuId) { if (own(d)) await app.del('calendrier', own(d).id); return; }
      await app.save('calendrier', row(d, menuId));
    } catch (e) { toast(e.message, 'bad'); }
  }
  async function bulk(fn, msg) {
    setBusy(true);
    try { await fn(); toast(msg); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  }
  const copyPrev = () => bulk(async () => {
    const rows = days.map((d) => { const src = cal.find((c) => c.id === keyFor(addDays(d, -7))); return src?.menu_id ? row(d, src.menu_id) : null; }).filter(Boolean);
    if (!rows.length) throw new Error(tr('La semaine précédente est vide.', 'The previous week is empty.', 'Foana ny herinandro teo aloha.'));
    await app.save('calendrier', rows);
  }, tr('Semaine précédente copiée', 'Previous week copied', 'Voadika ny herinandro teo aloha'));
  const copyGeneral = () => bulk(async () => {
    const rows = days.filter((d) => !own(d) && generic(d)).map((d) => row(d, generic(d).menu_id));
    if (!rows.length) throw new Error(tr('Rien à reprendre (jours déjà remplis ou pas de menu général).', 'Nothing to copy (days already filled or no general menu).', 'Tsy misy haka.'));
    await app.save('calendrier', rows);
  }, tr('Menu général repris pour les jours vides', 'General menu applied to empty days', 'Napetraka amin\'ny andro foana ny menu iraisana'));
  const sameAll = (menuId) => menuId && bulk(() => app.save('calendrier', days.map((d) => row(d, menuId))), tr('Menu appliqué à toute la semaine', 'Menu applied to the whole week', 'Napetraka amin\'ny herinandro manontolo'));
  const repeat = () => bulk(async () => {
    const rows = [];
    for (let w = 1; w <= weeksN; w++) for (const d of days) { const o = own(d); if (o?.menu_id) rows.push(row(addDays(d, 7 * w), o.menu_id)); }
    if (!rows.length) throw new Error(tr('Cette semaine est vide.', 'This week is empty.', 'Foana ity herinandro ity.'));
    await app.save('calendrier', rows);
  }, tr('Semaine répétée', 'Week repeated', 'Naverina ny herinandro'));
  const clearWeek = () => { if (confirm(tr('Vider cette semaine ?', 'Clear this week?', 'Hofafana ve ity herinandro ity?'))) bulk(() => app.del('calendrier', days.map((d) => own(d)?.id).filter(Boolean)), tr('Semaine vidée', 'Week cleared', 'Voafafa ny herinandro')); };

  const sums = days.map((d) => { const r = resolve(d); return r.menuId ? menuKcal.get(r.menuId) : null; });
  const filled = sums.filter(Boolean);
  const avg = filled.length ? filled.reduce((a, t) => a + t.kcal, 0) / filled.length : 0;
  const prixSemaine = filled.reduce((a, t) => a + (t.prix || 0), 0);

  return html`<div class="page">
    <div class="page-head"><h1>Planning</h1></div>
    <div class="tabs">
      <button class=${'tab' + (scope === 'cat' ? ' on' : '')} onClick=${() => setScope('cat')}>${tr('Menu général (par objectif)', 'General menu (by goal)', 'Menu iraisana (isaky ny tanjona)')}</button>
      <button class=${'tab' + (scope === 'client' ? ' on' : '')} onClick=${() => setScope('client')}>${tr('Menu personnalisé (par client)', 'Personal menu (by customer)', 'Menu manokana (isaky ny client)')}</button>
    </div>
    <div class="filters">
      ${scope === 'cat'
        ? html`<select value=${catId} onChange=${(e) => setCatId(e.target.value)}>${cats.map((c) => html`<option value=${c.id}>${catName(c)}</option>`)}</select>`
        : clients.length
          ? html`<select value=${clientId} onChange=${(e) => setClientId(e.target.value)}>${clients.map((c) => html`<option value=${c.id}>${c.nom}${c.categorie_id ? ' — ' + catName(data.categories.find((x) => x.id === c.categorie_id)) : ''}</option>`)}</select>`
          : html`<a class="btn" href="#/clients">+ ${tr('Ajouter un client', 'Add a customer', 'Ampio client')}</a>`}
    </div>
    <p class="muted small">${scope === 'cat'
      ? tr('Le menu général est servi à tous les clients de cet objectif, sauf ceux qui ont un menu personnalisé ce jour-là.', 'The general menu is served to all customers with this goal, except those with a personal menu that day.', 'Ny menu iraisana dia omena ny client rehetra manana io tanjona io, afa-tsy izay manana menu manokana amin\'io andro io.')
      : tr('Choisissez le menu de chaque jour pour ce client. 💡 = suggestion : le menu général prévu ce jour-là pour son objectif (un clic pour l\'utiliser).', 'Choose the menu of each day for this customer. 💡 = suggestion: the general menu planned that day for their goal (one click to use it).', 'Safidio ny menu isan\'andro ho an\'ity client ity. 💡 = soso-kevitra: ny menu iraisana voalahatra amin\'io andro io ho an\'ny tanjony (tsindrio indray mandeha raha hampiasa azy).')}</p>

    ${scope === 'client' && !client ? html`<${Empty}>${tr('Aucun client pour l\'instant.', 'No customer yet.', 'Mbola tsy misy client.')}<//>` : html`
    <${Card}>
      <div class="week-nav">
        <button class="btn" onClick=${() => setWeek(addDays(week, -7))} aria-label="◀">◀</button>
        <div class="week-title"><b>${tr('Semaine du', 'Week of', 'Herinandro')} ${dayShort(days[0])} – ${dayShort(days[6])}</b>
          <small class="muted">${tr('Moyenne', 'Average', 'Salanisa')} : <b>${fmt(avg)}</b> kcal/${tr('jour', 'day', 'andro')}${cible ? ' · ' + tr('cible', 'target', 'tanjona') + ' ' + fmt(cible) : ''}${prixSemaine ? ' · ' + fmt(prixSemaine) + ' Ar' : ''}</small></div>
        <button class="btn" onClick=${() => setWeek(addDays(week, 7))} aria-label="▶">▶</button>
        <button class="btn ghost small" onClick=${() => setWeek(mondayOf(today))}>${tr('Aujourd\'hui', 'Today', 'Androany')}</button>
      </div>

      <div class="week-grid">${days.map((d, i) => {
        const r = resolve(d);
        const t = sums[i];
        const st = t ? menuStatus(null, t, category, cible) : null;
        return html`<div class=${'day-card' + (d === today ? ' today' : '') + (r.source === 'general' ? ' general' : '')}>
          <div class="day-head"><b>${dayName(d)}</b><span class="muted small">${dayShort(d)}</span></div>
          <${MenuPicker} value=${r.menuId} categorieId=${effCat} suggestedId=${r.suggestion} onChange=${(v) => setDay(d, v)} placeholder=${tr('+ Choisir un menu', '+ Choose a menu', '+ Misafidiana menu')} />
          <div class="day-foot">
            ${st && html`<${Badge} tone=${st.tone}>${fmt(t.kcal)} kcal${pctBadge(st.ecart)}<//>`}
            ${scope === 'client' && !r.menuId && r.suggestion && html`<button class="suggest-btn" title=${tr('Utiliser le menu général du jour', 'Use the general menu of the day', 'Ampiasao ny menu iraisana androany')} onClick=${() => setDay(d, r.suggestion)}>💡 ${data.menus.find((m) => m.id === r.suggestion)?.nom || r.suggestion}</button>`}
            ${scope === 'client' && r.menuId && r.menuId === r.suggestion && html`<span class="badge muted">${tr('= menu général', '= general menu', '= menu iraisana')}</span>`}
          </div>
        </div>`;
      })}</div>

      <div class="week-actions">
        ${scope === 'client' && days.some((d) => generic(d)) && html`<button class="btn" disabled=${busy} onClick=${copyGeneral}>💡 ${tr('Reprendre le menu général de la semaine', 'Use the general menu for the week', 'Raisina ny menu iraisana amin\'ity herinandro ity')}</button>`}
        <button class="btn" disabled=${busy} onClick=${copyPrev}>${tr('Copier la semaine précédente', 'Copy previous week', 'Adikao ny herinandro teo aloha')}</button>
        <span class="row gap wrap"><span class="muted small">${tr('Même menu toute la semaine :', 'Same menu all week:', 'Menu iray ihany mandritra ny herinandro:')}</span><${MenuPicker} value=${null} categorieId=${effCat} onChange=${sameAll} placeholder=${tr('Choisir…', 'Choose…', 'Safidio…')} compact /></span>
        <span class="row gap wrap"><button class="btn" disabled=${busy} onClick=${repeat}>${tr('Répéter cette semaine sur', 'Repeat this week for', 'Avereno ity herinandro ity mandritra ny')}</button>
          <select class="unit" value=${weeksN} onChange=${(e) => setWeeksN(+e.target.value)}>${[1, 2, 3, 4, 8, 12].map((n) => html`<option value=${n}>${n} ${tr('sem.', 'wk', 'herinandro')}</option>`)}</select></span>
        <button class="btn ghost danger" disabled=${busy} onClick=${clearWeek}>${tr('Vider la semaine', 'Clear week', 'Fafao ny herinandro')}</button>
      </div>
    <//>`}
  </div>`;
}
