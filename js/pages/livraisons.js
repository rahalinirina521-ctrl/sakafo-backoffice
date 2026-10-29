// Livraisons du jour : génération à partir des abonnés, répartition entre livreurs, ordre optimisé, suivi en direct.
import { html, useState, useMemo } from '../lib.js?v=202610290705';
import { useApp, Badge, Empty, Card } from '../ui.js?v=202610290705';
import { isoDate, addDays, uid } from '../calc.js?v=202610290705';
import { tr, catName } from '../i18n.js?v=202610290705';
import { MapView, optimiser, hasPos, heure, googleNav } from '../map.js?v=202610290705';
import { STATUTS, CRENEAU_LABEL, COULEURS } from '../tournee.js?v=202610290705';
import { param } from '../params.js?v=202610290705';
import { depuis } from './livreurs.js?v=202610290705';
import { aboCouvre, menuDuJour } from '../metier.js?v=202610290705';

const t3 = (a) => tr(a[0], a[1], a[2]);
export function Livraisons() {
  const app = useApp();
  const { data, toast } = app;
  const [date, setDate] = useState(isoDate(new Date()));
  const [cren, setCren] = useState('');
  const [busy, setBusy] = useState(false);
  const depot = param(data, 'depot');
  const livreurs = (data.livreurs || []).filter((l) => l.actif !== false);
  const lvMap = new Map((data.livreurs || []).map((l) => [l.id, l]));
  const clMap = new Map((data.clients || []).map((c) => [c.id, c]));
  const jour = (data.livraisons || []).filter((l) => l.date === date && (!cren || l.creneau === cren));
  const stats = Object.fromEntries(Object.keys(STATUTS).map((k) => [k, jour.filter((l) => l.statut === k).length]));
  const groups = useMemo(() => {
    const g = new Map([['', []], ...livreurs.map((l) => [l.id, []])]);
    for (const l of jour) { const k = l.livreur_id && g.has(l.livreur_id) ? l.livreur_id : (l.livreur_id || ''); if (!g.has(k)) g.set(k, []); g.get(k).push(l); }
    for (const v of g.values()) v.sort((a, b) => (a.creneau || '').localeCompare(b.creneau || '') || (a.ordre ?? 999) - (b.ordre ?? 999));
    return g;
  }, [data.livraisons, date, cren, data.livreurs]);

  async function generer() {
    const exist = new Set((data.livraisons || []).filter((l) => l.date === date).map((l) => l.client_id + '|' + l.creneau));
    const rows = [];
    for (const c of data.clients || []) {
      if (!aboCouvre(c, date)) continue;
      for (const cr of c.creneaux && c.creneaux.length ? c.creneaux : ['midi']) {
        if (cren && cr !== cren) continue;
        if (exist.has(c.id + '|' + cr)) continue;
        rows.push({ id: `LV-${date}-${c.id}-${cr}`, date, creneau: cr, client_id: c.id, livreur_id: null, statut: 'prevue', ordre: null, adresse: c.adresse, repere: c.repere, lat: c.lat, lng: c.lng, menu_id: menuDuJour(data, c, date).menu_id });
      }
    }
    if (!rows.length) { toast(tr('Rien à ajouter : toutes les livraisons des abonnés existent déjà.', 'Nothing to add: all subscriber deliveries already exist.', 'Tsy misy hampiana: efa misy daholo.'), 'warn'); return; }
    try { await app.save('livraisons', rows); toast(tr(`${rows.length} livraison(s) créée(s)`, `${rows.length} delivery(ies) created`, `Fanaterana ${rows.length} noforonina`)); } catch (e) { toast(e.message, 'bad'); }
  }

  // Répartition : on trie les adresses par direction depuis la cuisine, puis on coupe en parts égales
  async function repartir() {
    if (!livreurs.length) { toast(tr('Ajoutez d\'abord un livreur.', 'Add a courier first.', 'Ampidiro aloha ny mpitondra.'), 'bad'); return; }
    const todo = jour.filter((l) => l.statut === 'prevue');
    if (!todo.length) return;
    setBusy(true);
    try {
      const out = [];
      for (const cr of [...new Set(todo.map((l) => l.creneau))]) {
        const list = todo.filter((l) => l.creneau === cr);
        const angle = (l) => (hasPos(l) ? Math.atan2(l.lat - depot.lat, l.lng - depot.lng) : 99);
        list.sort((a, b) => angle(a) - angle(b));
        const per = Math.ceil(list.length / livreurs.length);
        livreurs.forEach((lv, i) => list.slice(i * per, (i + 1) * per).forEach((l) => out.push({ ...l, livreur_id: lv.id })));
      }
      await app.save('livraisons', out);
      await ordonner(out);
      toast(tr('Livraisons réparties et itinéraires optimisés', 'Deliveries split and routes optimised', 'Voazara ary voalamina ny lalana'));
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  }
  async function ordonner(base = jour) {
    const out = [];
    for (const lv of livreurs) for (const cr of ['matin', 'midi', 'soir']) {
      const list = base.filter((l) => l.livreur_id === lv.id && l.creneau === cr && l.statut === 'prevue');
      if (!list.length) continue;
      const order = await optimiser(depot, list);
      order.forEach((id, i) => { const l = list.find((x) => x.id === id); out.push({ ...l, ordre: i + 1 }); });
    }
    if (out.length) await app.save('livraisons', out);
  }
  async function opti() { setBusy(true); try { await ordonner(); toast(tr('Ordre optimisé selon les routes', 'Order optimised by road', 'Voalamina araka ny lalana')); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); } }
  const setLv = (l, livreur_id) => app.save('livraisons', { ...l, livreur_id: livreur_id || null, ordre: null }).catch((e) => toast(e.message, 'bad'));
  const setSt = (l, statut) => app.save('livraisons', { ...l, statut, livree_at: statut === 'livree' ? new Date().toISOString() : l.livree_at }).catch((e) => toast(e.message, 'bad'));
  const del = (l) => confirm(tr('Supprimer cette livraison ?', 'Delete this delivery?', 'Hofafana ve?')) && app.del('livraisons', l.id).catch((e) => toast(e.message, 'bad'));
  async function ajouter(cid) {
    const c = clMap.get(cid); if (!c) return;
    const cr = cren || (c.creneaux || ['midi'])[0];
    await app.save('livraisons', { id: `LV-${date}-${c.id}-${cr}-${uid().slice(0, 4)}`, date, creneau: cr, client_id: c.id, livreur_id: null, statut: 'prevue', ordre: null, adresse: c.adresse, repere: c.repere, lat: c.lat, lng: c.lng, menu_id: menuDuJour(data, c, date).menu_id }).catch((e) => toast(e.message, 'bad'));
  }

  const markers = [
    { ...depot, icon: 'kitchen', popup: depot.adresse },
    ...jour.filter(hasPos).map((l) => ({ lat: l.lat, lng: l.lng, label: l.statut === 'livree' ? '✓' : (l.ordre ?? '•'), color: l.statut === 'livree' ? '#9e9e9e' : lvMap.get(l.livreur_id)?.couleur || '#757575', popup: `<b>${clMap.get(l.client_id)?.nom || l.client_id}</b><br>${l.adresse || ''}<br>${t3(STATUTS[l.statut])}${l.eta ? ' · ETA ' + heure(l.eta) : ''}` })),
    ...livreurs.map((lv) => { const p = (data.positions || []).find((x) => x.livreur_id === lv.id); return p && Date.now() - Date.parse(p.updated_at) < 6 * 3600e3 ? { ...p, icon: 'moto', color: lv.couleur, popup: `${lv.nom} · ${depuis(p.updated_at)}` } : null; }).filter(Boolean),
  ];
  const sansGps = jour.filter((l) => !hasPos(l)).length;

  return html`<div class="page">
    <div class="page-head"><h1>🛵 ${tr('Livraisons', 'Deliveries', 'Fanaterana')}</h1>
      <div class="row gap wrap">
        <button class="btn ghost" onClick=${() => setDate(addDays(date, -1))}>◀</button>
        <input type="date" value=${date} onInput=${(e) => setDate(e.target.value || isoDate(new Date()))} style="max-width:170px" />
        <button class="btn ghost" onClick=${() => setDate(addDays(date, 1))}>▶</button>
        <button class="btn ghost small" onClick=${() => setDate(isoDate(new Date()))}>${tr('Aujourd\'hui', 'Today', 'Androany')}</button>
      </div></div>
    <div class="tabs">${[['', tr('Tous les créneaux', 'All slots', 'Fotoana rehetra')], ...Object.entries(CRENEAU_LABEL).map(([k, v]) => [k, t3(v)])].map(([k, l]) => html`<button class=${'tab' + (cren === k ? ' on' : '')} onClick=${() => setCren(k)}>${l}</button>`)}</div>
    <div class="kpis">${Object.entries(STATUTS).filter(([k]) => k !== 'annulee').map(([k, v]) => html`<div class="kpi"><small>${t3(v)}</small><b>${stats[k] || 0}</b></div>`)}<div class="kpi"><small>Total</small><b>${jour.length}</b></div></div>
    <div class="row gap wrap" style="margin:10px 0">
      <button class="btn primary" onClick=${generer}>⚡ ${tr('Générer depuis les abonnements', 'Generate from subscriptions', 'Foronina avy amin\'ny abonnement')}</button>
      <button class="btn" disabled=${busy || !jour.length} onClick=${repartir}>👥 ${tr('Répartir entre livreurs', 'Split between couriers', 'Zarao amin\'ny mpitondra')}</button>
      <button class="btn" disabled=${busy || !jour.length} onClick=${opti}>🧭 ${tr('Optimiser l\'ordre', 'Optimise order', 'Alamino ny filaharana')}</button>
      <select onChange=${(e) => { ajouter(e.target.value); e.target.value = ''; }} style="max-width:220px"><option value="">+ ${tr('Ajouter un client…', 'Add a customer…', 'Hanampy client…')}</option>${(data.clients || []).filter((c) => c.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom)).map((c) => html`<option value=${c.id}>${c.nom}</option>`)}</select>
    </div>
    ${sansGps > 0 && html`<p class="warn-box">📍 ${tr(`${sansGps} adresse(s) sans position GPS : complétez la fiche client (bouton « Ma position » ou lien Google Maps) pour l'itinéraire automatique.`, `${sansGps} address(es) without GPS: complete the customer record for automatic routing.`, `Adiresy ${sansGps} tsy misy GPS: fenoy ny fiche client mba hahafahana manao lalana mandeha ho azy.`)}</p>`}
    <${MapView} height=${360} markers=${markers} fitKey=${date + cren + jour.length} />
    ${jour.length === 0 ? html`<${Empty}>${tr('Aucune livraison pour ce jour. Cliquez sur « Générer depuis les abonnements ».', 'No delivery for this day. Click "Generate from subscriptions".', 'Tsy misy fanaterana androany. Tsindrio « Générer ».')}<//>`
      : [...groups.entries()].filter(([, v]) => v.length).map(([lid, list]) => {
        const lv = lvMap.get(lid);
        const nav = googleNav(depot, list.filter((l) => l.statut !== 'livree' && hasPos(l)));
        return html`<${Card} key=${lid} title=${html`<span class="dot" style=${{ background: lv?.couleur || '#9e9e9e' }}></span> ${lv ? lv.nom : tr('Non assignées', 'Unassigned', 'Tsy misy mpitondra')} <span class="muted">(${list.filter((l) => l.statut === 'livree').length}/${list.length})</span>`}
          actions=${html`${lv && html`<a class="btn small ghost" href=${'#/messages?c=livreur:' + lv.id}>💬</a>`}${nav && html`<a class="btn small ghost" href=${nav} target="_blank" rel="noopener">🗺️ Google Maps</a>`}`}>
          <div class="liv-list">${list.map((l) => {
            const c = clMap.get(l.client_id);
            const menu = (data.menus || []).find((m) => m.id === l.menu_id);
            return html`<div class=${'liv-row st-' + l.statut} key=${l.id}>
              <span class="liv-num" style=${{ background: lv?.couleur || '#9e9e9e' }}>${l.statut === 'livree' ? '✓' : l.ordre ?? '•'}</span>
              <div class="liv-main">
                <b>${c?.nom || l.client_id}</b> <small class="muted">${t3(CRENEAU_LABEL[l.creneau] || [l.creneau])}${menu ? ' · ' + (menu.nom || menu.id) : ''}${c ? ' · ' + catName(data.categories.find((x) => x.id === c.categorie_id)) : ''}</small>
                <div class="small">${l.adresse || '—'}${l.repere ? html` <span class="muted">· ${l.repere}</span>` : null}${!hasPos(l) ? html` <${Badge} tone="warn">GPS ?<//>` : null}</div>
                <div class="small row gap wrap">${c?.telephone && html`<a href=${'tel:' + c.telephone}>📞 ${c.telephone}</a>`}${l.eta && l.statut !== 'livree' ? html`<span>⏱ ETA ${heure(l.eta)}</span>` : null}${l.livree_at ? html`<span>✓ ${heure(l.livree_at)}</span>` : null}${l.note_livreur ? html`<span class="muted">📝 ${l.note_livreur}</span>` : null}</div>
              </div>
              <div class="liv-act">
                <select value=${l.livreur_id || ''} onChange=${(e) => setLv(l, e.target.value)}><option value="">— ${tr('livreur', 'courier', 'mpitondra')}</option>${livreurs.map((x) => html`<option value=${x.id}>${x.nom}</option>`)}</select>
                <select value=${l.statut} onChange=${(e) => setSt(l, e.target.value)}>${Object.entries(STATUTS).map(([k, v]) => html`<option value=${k}>${t3(v)}</option>`)}</select>
                <button class="btn ghost small danger" onClick=${() => del(l)} aria-label=${tr('Supprimer', 'Delete', 'Fafao')}>✕</button>
              </div>
            </div>`;
          })}</div>
        <//>`;
      })}
  </div>`;
}
