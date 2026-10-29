// Tarifs : prix de chaque plat (à l'unité) et formules d'abonnement, modifiables par l'admin.
import { html, useState, useMemo } from '../lib.js?v=202610290636';
import { useApp, Card, Badge } from '../ui.js?v=202610290636';
import { platTotals, menuTotals, toNum, fmt } from '../calc.js?v=202610290636';
import { tr, catName, fotLabel, platTitle } from '../i18n.js?v=202610290636';
import { Thumb } from '../pickers.js?v=202610290636';

export function Tarifs() {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const [q, setQ] = useState('');
  const offres = [...(data.offres || [])].sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.nb_jours - b.nb_jours);
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  // Prix moyen d'une journée de menu (somme des prix des plats), par objectif
  const dayPrice = useMemo(() => {
    const out = new Map();
    const all = [];
    for (const c of cats) {
      const ps = data.menus.filter((m) => m.categorie_id === c.id).map((m) => menuTotals(m, data.plats, data.composition, ingMap)).filter((t) => t.prix && !t.prixManquant).map((t) => t.prix);
      all.push(...ps);
      out.set(c.id, ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null);
    }
    out.set('', all.length ? all.reduce((a, b) => a + b, 0) / all.length : null);
    return out;
  }, [data, ingMap]);

  async function savePlat(p, prix) {
    const v = toNum(prix);
    if (v === toNum(p.prix_vente)) return;
    try { await app.save('plats', { ...p, prix_vente: v }); toast(tr('Prix enregistré', 'Price saved', 'Voatahiry ny vidiny')); } catch (e) { toast(e.message, 'bad'); }
  }
  async function saveOffre(o, patch) {
    try { await app.save('offres', { ...o, ...patch }); } catch (e) { toast(e.message, 'bad'); }
  }
  async function addOffre() {
    const n = offres.length + 1;
    try { await app.save('offres', { id: 'OF-' + Date.now().toString(36), nom: tr('Nouvelle formule', 'New plan', 'Formule vaovao'), nb_jours: 5, prix: null, categorie_id: null, description: '', actif: true, ordre: n + 1 }); } catch (e) { toast(e.message, 'bad'); }
  }
  async function delOffre(o) {
    if (!confirm(tr(`Supprimer la formule « ${o.nom} » ?`, `Delete plan "${o.nom}"?`, `Hofafana ve ny formule "${o.nom}"?`))) return;
    try { await app.del('offres', o.id); } catch (e) { toast(e.message, 'bad'); }
  }

  const plats = data.plats
    .filter((p) => !q || `${p.nom} ${p.nom_commercial || ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => platTitle(a).localeCompare(platTitle(b)));

  return html`<div class="page">
    <h1>${tr('Tarifs', 'Prices', 'Vidiny')}</h1>
    <p class="muted small">${tr('Vous fixez librement les prix. Les suggestions sont calculées à partir du prix des plats de vos menus, pour vous aider à décider (remise dégressive pour les abonnements longs).', 'You set prices freely. Suggestions are computed from the dish prices in your menus to help you decide (decreasing discount for longer subscriptions).', 'Ianao no mametraka malalaka ny vidiny. Ny soso-kevitra dia kajiana avy amin\'ny vidin\'ny sakafo ao amin\'ny menus, mba hanampy anao (fihenam-bidy ho an\'ny abonnement lava).')}</p>

    <${Card} title=${tr('Formules d\'abonnement', 'Subscription plans', 'Formule abonnement')} actions=${html`<button class="btn small" onClick=${addOffre}>+ ${tr('Formule', 'Plan', 'Formule')}</button>`}>
      <div class="table-wrap"><table class="table resp offres-t">
        <thead><tr><th>${tr('Formule', 'Plan', 'Formule')}</th><th class="num">${tr('Jours', 'Days', 'Andro')}</th><th>${tr('Objectif', 'Goal', 'Tanjona')}</th><th class="num">${tr('Prix (Ar)', 'Price (Ar)', 'Vidiny (Ar)')}</th><th class="num">${tr('Par jour', 'Per day', 'Isan\'andro')}</th><th class="num">${tr('Suggestion', 'Suggestion', 'Soso-kevitra')}</th><th>${tr('Actif', 'Active', 'Mavitrika')}</th><th></th></tr></thead>
        <tbody>${offres.map((o) => {
          const base = dayPrice.get(o.categorie_id || '');
          const remise = o.nb_jours >= 30 ? 0.15 : o.nb_jours >= 14 ? 0.1 : o.nb_jours >= 7 ? 0.07 : o.nb_jours >= 3 ? 0.03 : 0;
          const sugg = base ? Math.round((base * o.nb_jours * (1 - remise)) / 500) * 500 : null;
          return html`<tr key=${o.id}>
            <td><input value=${o.nom} onChange=${(e) => saveOffre(o, { nom: e.target.value })} /></td>
            <td class="num"><input class="num-input" type="number" min="1" value=${o.nb_jours} onChange=${(e) => saveOffre(o, { nb_jours: Math.max(1, toNum(e.target.value) || 1) })} /></td>
            <td><select value=${o.categorie_id || ''} onChange=${(e) => saveOffre(o, { categorie_id: e.target.value || null })}><option value="">${tr('Tous', 'All', 'Rehetra')}</option>${cats.map((c) => html`<option value=${c.id}>${catName(c)}</option>`)}</select></td>
            <td class="num"><input class="num-input wide" type="number" min="0" step="500" value=${o.prix ?? ''} placeholder=${sugg ? fmt(sugg) : ''} onChange=${(e) => saveOffre(o, { prix: toNum(e.target.value) })} /></td>
            <td class="num">${o.prix ? fmt(o.prix / o.nb_jours) + ' Ar' : '—'}</td>
            <td class="num">${sugg ? html`<button class="link-btn" title=${tr('Utiliser ce prix', 'Use this price', 'Ampiasao ity vidiny ity')} onClick=${() => saveOffre(o, { prix: sugg })}>${fmt(sugg)} Ar</button>${remise ? html`<small class="muted"> (−${Math.round(remise * 100)} %)</small>` : null}` : html`<span class="muted small">${tr('prix des plats ?', 'dish prices?', 'vidin\'ny sakafo?')}</span>`}</td>
            <td><input type="checkbox" checked=${o.actif !== false} onChange=${(e) => saveOffre(o, { actif: e.target.checked })} /></td>
            <td><button class="btn ghost small danger" onClick=${() => delOffre(o)}>✕</button></td>
          </tr>`;
        })}</tbody>
      </table></div>
      <p class="hint">${tr('Commande d\'un seul menu (sans abonnement) = somme des prix des plats choisis.', 'Single menu order (no subscription) = sum of the chosen dish prices.', 'Menu tokana (tsy abonnement) = vidin\'ny sakafo nofidiana atambatra.')}</p>
    <//>

    <${Card} title=${tr('Prix des plats (à l\'unité)', 'Dish prices (per unit)', 'Vidin\'ny sakafo (isaky ny iray)')}>
      <div class="filters"><input type="search" placeholder=${tr('Rechercher…', 'Search…', 'Hikaroka…')} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
      <div class="table-wrap"><table class="table resp">
        <thead><tr><th>${tr('Plat', 'Dish', 'Sakafo')}</th><th>${tr('Moment', 'Meal', 'Fotoana')}</th><th class="num">${tr('Coût matière', 'Food cost', 'Coût')}</th><th class="num">${tr('Prix de vente (Ar)', 'Selling price (Ar)', 'Vidiny amidy (Ar)')}</th><th class="num">${tr('Marge', 'Margin', 'Tombony')}</th></tr></thead>
        <tbody>${plats.map((p) => {
          const t = platTotals(p.id, data.composition, ingMap);
          const prix = toNum(p.prix_vente);
          const marge = prix && !t.prixManquant ? prix - t.cout : null;
          return html`<tr key=${p.id}>
            <td><span class="row gap"><${Thumb} plat=${p} size=${36} /><b>${platTitle(p)}</b></span></td>
            <td>${fotLabel(p.fotoana)}</td>
            <td class="num">${t.prixManquant ? html`<span class="muted small" title=${tr('Prix d\'ingrédients manquants', 'Missing ingredient prices', 'Vidin\'ingrédients tsy fantatra')}>?</span>` : fmt(t.cout) + ' Ar'}</td>
            <td class="num"><input class="num-input wide" type="number" min="0" step="100" value=${p.prix_vente ?? ''} onChange=${(e) => savePlat(p, e.target.value)} /></td>
            <td class="num">${marge === null ? '—' : html`<${Badge} tone=${marge > 0 ? 'ok' : 'bad'}>${fmt(marge)} Ar<//>`}</td>
          </tr>`;
        })}</tbody>
      </table></div>
      <p class="hint">${tr('Le coût matière vient des prix au kg saisis dans « Ingrédients ».', 'Food cost comes from the per-kg prices in "Ingredients".', 'Ny coût dia avy amin\'ny vidiny isaky ny kg ao amin\'ny "Ingrédients".')}</p>
    <//>
  </div>`;
}
