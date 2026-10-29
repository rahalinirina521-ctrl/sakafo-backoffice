// Application livreur (PWA) : tournée du jour, ordre optimisé, carte, ETA, GPS partagé, messages.
import { html, render, useState, useEffect, useMemo, useRef } from '../lib.js?v=202610290734';
import { AppCtx, Badge, Modal, useApp as useAppL } from '../ui.js?v=202610290734';
import { tr } from '../i18n.js?v=202610290734';
import { isoDate } from '../calc.js?v=202610290734';
import { loadAll, upsert, updateRow } from '../db.js?v=202610290734';
import { useLive, envoyerMessage, marquerLus } from '../live.js?v=202610290734';
import { MapView, optimiser, hasPos, heure, fmtDuree, fmtDist, googleNav, haversine } from '../map.js?v=202610290734';
import { calculerEtas, STATUTS, CRENEAU_LABEL } from '../tournee.js?v=202610290734';
import { Chat, nonLus } from '../chat.js?v=202610290734';
import { param } from '../params.js?v=202610290734';
import { LangSwitch, useLang, useToast, useAuth, AuthScreen, NewPassword, UpdateNotice } from '../shell.js?v=202610290734';

const t3 = (a) => tr(a[0], a[1], a[2]);
const DEMO_AS = { user_id: 'demo-livreur', admin: false, role: 'livreur', livreur_id: new URLSearchParams(location.search).get('as') || 'LR001' };
const creneauActuel = () => { const h = new Date().getHours(); return h < 10 ? 'matin' : h < 15 ? 'midi' : 'soir'; };

export function LivreurApp() {
  const [lang, setLang] = useLang();
  const [toast, toastView] = useToast();
  const auth = useAuth(DEMO_AS);
  const me = auth.me;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [onglet, setOnglet] = useState('tournee');
  const [chatConv, setChatConv] = useState(null);
  useEffect(() => { if (me?.livreur_id) loadAll().then(setData).catch((e) => setError(e.message || String(e))); }, [me?.livreur_id]);
  const lid = me?.livreur_id;
  useLive(setData, lid ? [['livraisons', 'livreur_id=eq.' + lid], ['messages']] : [], [lid]);
  const livreur = data && (data.livreurs || []).find((l) => l.id === lid);
  const meChat = me && { id: me.id, role: 'livreur', nom: livreur?.nom || 'Livreur' };
  const ctx = useMemo(() => ({ data, setData, toast, me: meChat, lang, ingMap: new Map(),
    send: (c, t) => envoyerMessage(setData, c, t, meChat), markRead: (m) => marquerLus(setData, m, meChat) }), [data, lang, me, livreur?.nom]);

  if (auth.session === undefined) return html`<div class="center muted">${tr('Chargement…', 'Loading…', 'Miandrasa…')}</div>`;
  if (!me) { if (auth.session === null) location.replace('connexion.html'); return html`<div class="center muted">…</div>`; }
  if (me.role !== 'livreur' || !lid) return html`<div class="center"><div class="card login"><h2>${tr('Compte non relié à un livreur', 'Account not linked to a courier', 'Tsy mifandray amin\'ny mpitondra')}</h2><p class="muted">${me.email}</p>
    <p>${tr('Demandez à l\'administrateur d\'indiquer cet e-mail dans votre fiche livreur, puis rouvrez l\'application.', 'Ask the administrator to enter this e-mail in your courier record, then reopen the app.', 'Angataho amin\'ny mpitantana ny hampiditra ity mailaka ity ao amin\'ny fiche-nao, dia sokafy indray.')}</p>
    <button class="btn ghost" onClick=${async () => { await auth.logout(); location.replace('connexion.html'); }}>${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button></div></div>`;
  if (!data) return html`<div class="center muted">${error ? html`<span class="error">${error}</span>` : tr('Chargement…', 'Loading…', 'Miandrasa…')}</div>`;

  const convs = ['livreur:' + lid, ...[...new Set((data.livraisons || []).filter((l) => l.date === isoDate(new Date())).map((l) => 'client:' + l.client_id))]];
  const unread = convs.reduce((n, c) => n + nonLus(data.messages || [], c, me.id), 0);
  return html`<${AppCtx.Provider} value=${ctx}>
    <div class="c-app lv-app">
      <header class="c-top"><span class="auth-brand"><span class="logo-dot" style=${{ background: livreur?.couleur }}>🛵</span><b>${livreur?.nom || tr('Livreur', 'Courier', 'Mpitondra')}</b></span><${LangSwitch} lang=${lang} onChange=${setLang} /></header>
      <${UpdateNotice} /><main class="c-main">
        ${onglet === 'tournee' && html`<${Tournee} livreur=${livreur} lid=${lid} ouvrirChat=${(c) => { setChatConv(c); setOnglet('messages'); }} />`}
        ${onglet === 'messages' && html`<${MessagesLivreur} convs=${convs} conv=${chatConv} setConv=${setChatConv} />`}
        ${onglet === 'compte' && html`<div class="c-page"><section class="c-card"><p>${me.email}</p><button class="btn ghost" onClick=${async () => { await auth.logout(); location.replace('connexion.html'); }}>${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button></section></div>`}
      </main>
      <nav class="c-nav">${[['tournee', '🗺️', tr('Tournée', 'Route', 'Lalana')], ['messages', '💬', tr('Messages', 'Messages', 'Hafatra')], ['compte', '👤', tr('Compte', 'Account', 'Kaonty')]].map(([k, i, l]) => html`<a href="#" class=${onglet === k ? 'on' : ''} onClick=${(e) => { e.preventDefault(); setOnglet(k); }}><span>${i}${k === 'messages' && unread ? html`<i class="dot-badge">${unread}</i>` : null}</span><small>${l}</small></a>`)}</nav>
    </div>
    ${auth.recovery && html`<${NewPassword} onDone=${() => auth.setRecovery(false)} />`}
    ${toastView}
  <//>`;
}

function Tournee({ livreur, lid, ouvrirChat }) {
  const { data, setData, toast } = useAppL();
  const [cren, setCren] = useState(() => {
    const auj = (data.livraisons || []).filter((l) => l.date === isoDate(new Date()) && l.livreur_id === lid);
    const ordre = ['matin', 'midi', 'soir']; const cur = creneauActuel();
    const avec = (k) => auj.some((l) => l.creneau === k && (l.statut === 'prevue' || l.statut === 'en_route'));
    return avec(cur) ? cur : ordre.slice(ordre.indexOf(cur)).find(avec) || ordre.find(avec) || cur;
  });
  const [gps, setGps] = useState(null);
  const [calc, setCalc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [probleme, setProbleme] = useState(null);
  const watch = useRef(null); const last = useRef({ sent: 0, pos: null, eta: 0, etaPos: null }); const lock = useRef(null);
  const depot = param(data, 'depot'); const trafic = param(data, 'trafic'); const arret = param(data, 'arret_min');
  const date = isoDate(new Date());
  const toutes = (data.livraisons || []).filter((l) => l.date === date && l.livreur_id === lid);
  const liste = toutes.filter((l) => l.creneau === cren).sort((a, b) => (a.statut === 'livree') - (b.statut === 'livree') || (a.ordre ?? 999) - (b.ordre ?? 999));
  const restantes = liste.filter((l) => l.statut === 'prevue' || l.statut === 'en_route');
  const clMap = new Map((data.clients || []).map((c) => [c.id, c]));
  const depart = gps || depot;
  const cle = restantes.map((l) => l.id + l.ordre + l.statut).join(',');
  const suivi = liste.some((l) => l.statut === 'en_route');

  // ETA (recalcul quand la liste change ou toutes les 60 s / 300 m)
  async function recalculer(force) {
    if (!restantes.length) { setCalc(null); return; }
    const from = gps || depot;
    if (!force && last.current.etaPos && haversine(last.current.etaPos, from) < 300 && Date.now() - last.current.eta < 60000) return;
    last.current.eta = Date.now(); last.current.etaPos = from;
    const r = await calculerEtas(from, restantes, { trafic, arret_min: arret });
    setCalc(r);
    if (suivi) for (const l of restantes) { const e = r.etas.get(l.id); if (e) updateRow('livraisons', l.id, { eta: e.eta.toISOString() }).catch(() => {}); }
  }
  useEffect(() => { recalculer(true); }, [cle, cren]);
  useEffect(() => { if (gps) recalculer(false); }, [gps]);

  function onPos(p) {
    const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
    setGps(pos);
    const moved = !last.current.pos || haversine(last.current.pos, pos) > 40;
    if (Date.now() - last.current.sent > 15000 || (moved && Date.now() - last.current.sent > 5000)) {
      last.current.sent = Date.now(); last.current.pos = pos;
      upsert('positions', { livreur_id: lid, lat: pos.lat, lng: pos.lng, precision: p.coords.accuracy, vitesse: p.coords.speed, cap: p.coords.heading, updated_at: new Date().toISOString() }).catch(() => {});
    }
  }
  function startGps() {
    if (!navigator.geolocation) { toast(tr('GPS non disponible', 'GPS not available', 'Tsy misy GPS'), 'bad'); return; }
    if (watch.current !== null) return;
    watch.current = navigator.geolocation.watchPosition(onPos, (e) => toast(tr('Activez la localisation : ', 'Enable location: ', 'Alefaso ny GPS: ') + e.message, 'bad'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    try { navigator.wakeLock?.request('screen').then((l) => { lock.current = l; }).catch(() => {}); } catch (e) { /* */ }
  }
  function stopGps() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null; try { lock.current?.release(); } catch (e) { /* */ }
  }
  useEffect(() => { startGps(); return stopGps; }, []);

  async function demarrer() {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      for (const l of liste.filter((x) => x.statut === 'prevue')) await updateRow('livraisons', l.id, { statut: 'en_route', depart_at: now });
      setData((d) => ({ ...d, livraisons: d.livraisons.map((l) => (l.date === date && l.livreur_id === lid && l.creneau === cren && l.statut === 'prevue' ? { ...l, statut: 'en_route', depart_at: now } : l)) }));
      startGps();
      toast(tr('Tournée démarrée : les clients vous voient sur la carte', 'Route started: customers can see you on the map', 'Nanomboka: hitan\'ny client eo amin\'ny sarintany ianao'));
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  }
  async function reoptimiser() {
    setBusy(true);
    try {
      const order = await optimiser(depart, restantes);
      const patch = order.map((id, i) => ({ id, ordre: i + 1 }));
      for (const p of patch) await updateRow('livraisons', p.id, { ordre: p.ordre });
      setData((d) => ({ ...d, livraisons: d.livraisons.map((l) => { const p = patch.find((x) => x.id === l.id); return p ? { ...l, ordre: p.ordre } : l; }) }));
      toast(tr('Ordre optimisé depuis votre position', 'Order optimised from your position', 'Voalamina avy amin\'ny toeranao'));
    } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  }
  async function statut(l, st, note) {
    const p = { statut: st, ...(st === 'livree' ? { livree_at: new Date().toISOString() } : {}), ...(note !== undefined ? { note_livreur: note } : {}) };
    try {
      await updateRow('livraisons', l.id, p);
      setData((d) => ({ ...d, livraisons: d.livraisons.map((x) => (x.id === l.id ? { ...x, ...p } : x)) }));
      if (st === 'livree') toast('✓ ' + tr('Livré', 'Delivered', 'Tonga'));
    } catch (e) { toast(e.message, 'bad'); }
  }

  const markers = [
    { ...depot, icon: 'kitchen' },
    ...liste.filter(hasPos).map((l) => ({ lat: l.lat, lng: l.lng, label: l.statut === 'livree' ? '✓' : l.ordre ?? '•', color: l.statut === 'livree' ? '#9e9e9e' : livreur?.couleur, popup: clMap.get(l.client_id)?.nom || '' })),
    gps && { ...gps, icon: 'moto', color: livreur?.couleur },
  ].filter(Boolean);
  const navTout = googleNav(gps, restantes);
  const fini = liste.length > 0 && !restantes.length;

  return html`<div class="c-page">
    <div class="tabs">${Object.entries(CRENEAU_LABEL).map(([k, v]) => { const n = toutes.filter((l) => l.creneau === k).length; return html`<button class=${'tab' + (cren === k ? ' on' : '')} onClick=${() => setCren(k)}>${t3(v)} (${n})</button>`; })}</div>
    ${liste.length === 0 ? html`<section class="c-card"><p class="muted">${tr('Aucune livraison pour ce créneau.', 'No delivery for this slot.', 'Tsy misy fanaterana amin\'ity fotoana ity.')}</p></section>` : html`
    <section class="c-card lv-sum">
      <div><small>${tr('Restantes', 'Remaining', 'Sisa')}</small><b>${restantes.length}/${liste.length}</b></div>
      <div><small>${tr('Distance', 'Distance', 'Halavirana')}</small><b>${calc ? fmtDist(calc.total_m) : '…'}</b></div>
      <div><small>${tr('Durée', 'Duration', 'Faharetana')}</small><b>${calc ? fmtDuree(calc.total_s) : '…'}</b></div>
      <div><small>${tr('Fin vers', 'Done by', 'Vita amin\'ny')}</small><b>${calc && restantes.length ? heure(Date.now() + calc.total_s * 1000) : '—'}</b></div>
    </section>
    ${calc?.approx && html`<p class="tiny muted">${tr('Temps estimés à vol d\'oiseau (serveur d\'itinéraires indisponible).', 'Times estimated as the crow flies (routing server unavailable).', 'Tombana tsotra ny fotoana.')}</p>`}
    <div class="row gap wrap">
      ${liste.some((l) => l.statut === 'prevue') && html`<button class="btn primary big" disabled=${busy} onClick=${demarrer}>▶ ${tr('Démarrer la tournée', 'Start the route', 'Hanomboka')}</button>`}
      <button class="btn" disabled=${busy || restantes.length < 2} onClick=${reoptimiser}>🧭 ${tr('Ré-optimiser', 'Re-optimise', 'Alamino indray')}</button>
      ${navTout && html`<a class="btn" href=${navTout} target="_blank" rel="noopener">🗺️ Google Maps</a>`}
    </div>
    <p class="tiny muted">${gps ? '📡 ' + tr('GPS actif — votre position est partagée avec vos clients du jour.', 'GPS on — your position is shared with today\'s customers.', 'Mandeha ny GPS — hitan\'ny client androany ny toeranao.') : '📡 ' + tr('En attente du GPS… gardez l\'application ouverte pendant la tournée.', 'Waiting for GPS… keep the app open during the route.', 'Miandry GPS… avelao misokatra ny app mandritra ny lalana.')}</p>
    <${MapView} height=${300} markers=${markers} line=${calc?.line} fitKey=${cren + liste.length} />
    ${fini && html`<p class="ok-box">🎉 ${tr('Toutes les livraisons de ce créneau sont faites. Merci !', 'All deliveries for this slot are done. Thank you!', 'Vita daholo ny fanaterana. Misaotra!')}</p>`}
    <div class="stops">${liste.map((l) => {
      const c = clMap.get(l.client_id) || {};
      const e = calc?.etas.get(l.id);
      const nav = hasPos(l) ? `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}&travelmode=driving` : l.adresse ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.adresse + ', Antananarivo')}` : null;
      const done = l.statut === 'livree' || l.statut === 'echec' || l.statut === 'annulee';
      return html`<section class=${'c-card stop' + (done ? ' done' : '')} key=${l.id}>
        <div class="row gap between"><span class="row gap"><span class="liv-num" style=${{ background: done ? '#9e9e9e' : livreur?.couleur }}>${l.statut === 'livree' ? '✓' : l.ordre ?? '•'}</span><b>${c.nom || l.client_id}</b></span>
          ${done ? html`<${Badge} tone=${STATUTS[l.statut][3]}>${t3(STATUTS[l.statut])} ${l.livree_at ? heure(l.livree_at) : ''}<//>` : e ? html`<span class="eta-chip">⏱ ${heure(e.eta)} <small>(${fmtDist(e.leg_m)})</small></span>` : null}</div>
        <p class="small">${l.adresse || '—'}${l.repere ? html`<br/><b>📍 ${l.repere}</b>` : null}${!hasPos(l) ? html` <${Badge} tone="warn">${tr('sans GPS', 'no GPS', 'tsy misy GPS')}<//>` : null}</p>
        ${c.allergies && html`<p class="small warn-text">⚠️ ${c.allergies}</p>`}
        ${l.note_livreur && html`<p class="small muted">📝 ${l.note_livreur}</p>`}
        ${!done && html`<div class="stop-act">
          ${c.telephone && html`<a class="btn small" href=${'tel:' + c.telephone}>📞</a>`}
          <button class="btn small" onClick=${() => ouvrirChat('client:' + l.client_id)}>💬</button>
          ${nav && html`<a class="btn small" href=${nav} target="_blank" rel="noopener">🧭 ${tr('Y aller', 'Go', 'Mandeha')}</a>`}
          <button class="btn small primary" onClick=${() => statut(l, 'livree')}>✓ ${tr('Livré', 'Delivered', 'Tonga')}</button>
          <button class="btn small ghost danger" onClick=${() => setProbleme(l)}>⚠</button>
        </div>`}
      </section>`;
    })}</div>`}
    ${probleme && html`<${Probleme} l=${probleme} onClose=${() => setProbleme(null)} onOk=${(note) => { statut(probleme, 'echec', note); setProbleme(null); }} onReport=${(note) => { statut(probleme, probleme.statut, note); setProbleme(null); }} />`}
  </div>`;
}

function Probleme({ l, onClose, onOk, onReport }) {
  const [note, setNote] = useState(l.note_livreur || '');
  const motifs = [tr('Client absent', 'Customer absent', 'Tsy teo ny client'), tr('Adresse introuvable', 'Address not found', 'Tsy hita ny adiresy'), tr('Téléphone injoignable', 'Phone unreachable', 'Tsy azo antsoina'), tr('Retard (embouteillage)', 'Delay (traffic)', 'Tara (fitohanana)')];
  return html`<${Modal} title=${'⚠ ' + tr('Signaler un problème', 'Report a problem', 'Hilaza olana')} onClose=${onClose}>
    <div class="obj-chips">${motifs.map((m) => html`<button class="chip" onClick=${() => setNote(m)}>${m}</button>`)}</div>
    <textarea rows="3" value=${note} onInput=${(e) => setNote(e.target.value)}></textarea>
    <div class="row gap wrap"><button class="btn" onClick=${() => onReport(note)}>${tr('Enregistrer la note', 'Save note', 'Tehirizo')}</button><button class="btn danger" onClick=${() => onOk(note)}>${tr('Livraison impossible', 'Delivery failed', 'Tsy tontosa')}</button></div>
  <//>`;
}

function MessagesLivreur({ convs, conv, setConv }) {
  const app = useAppL();
  const { data, me } = app;
  const nom = (c) => (c.startsWith('livreur:') ? '🧑‍🍳 ' + tr('Administration', 'Office', 'Biraon\'ny Sakafo') : '🙂 ' + ((data.clients || []).find((x) => 'client:' + x.id === c)?.nom || c));
  if (conv) return html`<div class="c-page"><h2><button class="btn ghost small" onClick=${() => setConv(null)}>◀</button> ${nom(conv)}</h2>
    <${Chat} conversation=${conv} messages=${data.messages || []} me=${me} height="calc(100vh - 220px)" onSend=${(t) => app.send(conv, t).catch((e) => app.toast(e.message, 'bad'))} onRead=${app.markRead}
      quick=${conv.startsWith('client:') ? [tr('Je suis en route 🛵', 'On my way 🛵', 'Eny an-dalana aho 🛵'), tr('J\'arrive dans 5 min', 'Arriving in 5 min', 'Ho tonga afaka 5 min'), tr('Je suis devant chez vous', 'I\'m at your door', 'Efa eo ivelany aho')] : [tr('Bien reçu', 'Received', 'Voaray'), tr('Problème sur une livraison', 'Problem with a delivery', 'Misy olana')]} /></div>`;
  return html`<div class="c-page"><h1>💬 ${tr('Messages', 'Messages', 'Hafatra')}</h1>
    ${convs.map((c) => html`<button class="conv" onClick=${() => setConv(c)}><span class="conv-name">${nom(c)}${nonLus(data.messages || [], c, me.id) ? html` <span class="nav-badge">${nonLus(data.messages || [], c, me.id)}</span>` : null}</span></button>`)}</div>`;
}
if (typeof document !== 'undefined' && document.getElementById('app')) render(html`<${LivreurApp} />`, document.getElementById('app'));
