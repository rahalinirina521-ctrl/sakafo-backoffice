import { html, render, useState, useEffect, useMemo, useCallback } from './lib.js?v=202610290637';
import { MODE, loadAll, upsert, remove, getSession, signIn, signOut, getClient, resetDemo, whoami, PK, updateRow } from './db.js?v=202610290637';
import { useLive, envoyerMessage, marquerLus } from './live.js?v=202610290637';
import { nonLus } from './chat.js?v=202610290637';
import { BRAND } from '../config.js?v=202610290637';
import { AppCtx } from './ui.js?v=202610290637';
import { tr, getLang, setLang, LANGS, LANG_SHORT } from './i18n.js?v=202610290637';
import { registerCustomUnits } from './calc.js?v=202610290637';
import { Dashboard } from './pages/dashboard.js?v=202610290637';
import { PlatsList } from './pages/plats.js?v=202610290637';
import { PlatEdit } from './pages/plat-edit.js?v=202610290637';
import { Ingredients } from './pages/ingredients.js?v=202610290637';
import { Menus, MenuEdit } from './pages/menus.js?v=202610290637';
import { Planning } from './pages/planning.js?v=202610290637';
import { Clients } from './pages/clients.js?v=202610290637';
import { Tarifs } from './pages/tarifs.js?v=202610290637';
import { Propositions } from './pages/propositions.js?v=202610290637';
import { Categories } from './pages/categories.js?v=202610290637';
import { Backup } from './pages/backup.js?v=202610290637';
import { Livraisons } from './pages/livraisons.js?v=202610290637';
import { Livreurs } from './pages/livreurs.js?v=202610290637';
import { Messages } from './pages/messages.js?v=202610290637';
import { Parametres } from './pages/parametres.js?v=202610290637';

export const VERSION = '2026-10-29 06:37';

const nav = () => [
  ['/', tr('Tableau de bord', 'Dashboard', 'Tableau de bord')],
  ['/plats', tr('Plats', 'Dishes', 'Sakafo')],
  ['/menus', tr('Menus', 'Menus', 'Menus')],
  ['/planning', tr('Planning', 'Planning', 'Planning')],
  ['/clients', tr('Clients', 'Customers', 'Clients')],
  ['/livraisons', '🛵 ' + tr('Livraisons', 'Deliveries', 'Fanaterana')],
  ['/messages', '💬 ' + tr('Messages', 'Messages', 'Hafatra')],
  ['/livreurs', tr('Livreurs', 'Couriers', 'Mpitondra')],
  ['/tarifs', tr('Tarifs', 'Prices', 'Vidiny')],
  ['/ingredients', tr('Ingrédients', 'Ingredients', 'Ingrédients')],
  ['/propositions', tr('Ajout IA (Excel)', 'AI add (Excel)', 'Ampiditra IA (Excel)')],
  ['/categories', tr('Objectifs', 'Goals', 'Tanjona')],
  ['/backup', tr('Sauvegarde Excel', 'Excel backup', 'Backup Excel')],
  ['/parametres', '⚙️ ' + tr('Paramètres', 'Settings', 'Fikirana')],
];

function useRoute() {
  const get = () => (location.hash.replace(/^#/, '') || '/');
  const [route, setRoute] = useState(get());
  useEffect(() => {
    const on = () => { setRoute(get()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function LangSwitch({ lang, onChange }) {
  return html`<div class="lang-switch" role="group" aria-label="Langue">
    ${LANGS.map(([l, name]) => html`<button class=${'lang' + (l === lang ? ' on' : '')} title=${name} onClick=${() => onChange(l)}>${LANG_SHORT[l]}</button>`)}
  </div>`;
}

function Login({ lang, onLang }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await signIn(email, pwd); } catch (x) { setErr(tr('Échec : ', 'Failed: ', 'Tsy nety: ') + (x.message || x)); }
    setBusy(false);
  };
  return html`<div class="login-wrap"><form class="card login" onSubmit=${submit}>
    <div class="row between"><h1>${BRAND}</h1><${LangSwitch} lang=${lang} onChange=${onLang} /></div>
    <p class="muted">${tr('Back-office — connexion', 'Back-office — sign in', 'Back-office — midira')}</p>
    <label class="field"><span class="field-label">Email</span><input type="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="username" /></label>
    <label class="field"><span class="field-label">${tr('Mot de passe', 'Password', 'Teny miafina')}</span><input type="password" required value=${pwd} onInput=${(e) => setPwd(e.target.value)} autocomplete="current-password" /></label>
    ${err && html`<p class="error">${err}</p>`}
    <button class="btn primary" disabled=${busy}>${busy ? tr('Patientez…', 'Please wait…', 'Miandrasa…') : tr('Se connecter', 'Sign in', 'Hiditra')}</button>
  </form></div>`;
}

// ---------- Fanavaozana (mise à jour) ----------
async function fetchVersion() {
  const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('version');
  return r.json();
}
async function applyUpdate(v) {
  // Avaozina ny index.html sy ny fichier rehetra ao amin'ny cache, vao alaina indray ny pejy
  try { sessionStorage.setItem('sakafo_update_try', v.version); } catch (e) { /* */ }
  const files = ['index.html', './', ...(v.files || [])];
  await Promise.all(files.map((f) => fetch(f, { cache: 'reload' }).catch(() => null)));
  location.reload();
}
const fmtDate = (iso) => {
  try { const d = new Date(iso); return { day: d.toLocaleDateString('fr-FR'), time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }; } catch (e) { return { day: iso, time: '' }; }
};

function UpdateBanner() {
  const [upd, setUpd] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => fetchVersion().then((v) => {
      if (!alive || !v.version || v.version === VERSION) return;
      setUpd(v);
    }).catch(() => {});
    check();
    const t = setInterval(check, 60000);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  if (!upd) return null;
  let tried = false;
  try { tried = sessionStorage.getItem('sakafo_update_try') === upd.version; } catch (e) { /* */ }
  const d = fmtDate(upd.date);
  return html`<div class="update-banner" role="status">
    <span><b>${tr('Nouvelle version disponible', 'New version available', 'Misy version vaovao')}</b> — ${tr('mise à jour du', 'updated on', 'navaozina ny')} ${d.day} ${tr('à', 'at', 'tamin\'ny')} ${d.time}.
      ${tried ? tr(' Si elle ne s\'applique pas, fermez l\'onglet et rouvrez le site.', ' If it does not apply, close the tab and reopen the site.', ' Raha tsy miova, hidio ny onglet dia sokafy indray ny site.') : tr(' Enregistrez votre travail puis mettez à jour.', ' Save your work, then update.', ' Tehirizo aloha ny asanao dia avaozy.')}</span>
    <span class="row gap">
      <button class="btn small primary" disabled=${busy} onClick=${() => { setBusy(true); applyUpdate(upd); }}>${busy ? tr('Mise à jour…', 'Updating…', 'Manavao…') : tr('Mettre à jour maintenant', 'Update now', 'Avaozy izao')}</button>
      <button class="btn small ghost" onClick=${() => setUpd(null)} aria-label=${tr('Plus tard', 'Later', 'Afaka kelikely')}>✕</button>
    </span>
  </div>`;
}

export function App() {
  const route = useRoute();
  const [lang, setLangState] = useState(getLang());
  const [session, setSession] = useState(undefined);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState(null);

  const changeLang = (l) => { setLang(l); setLangState(l); };

  const toast = useCallback((msg, tone = 'ok') => {
    const k = Date.now();
    setToastMsg({ msg, tone, k });
    setTimeout(() => setToastMsg((t) => (t && t.k === k ? null : t)), 3500);
  }, []);

  const reload = useCallback(async () => {
    try { setData(await loadAll()); setError(''); } catch (e) { setError(e.message || String(e)); }
  }, []);

  useEffect(() => {
    setLang(getLang());
    (async () => {
      try {
        const s = await getSession();
        setSession(s || null);
        if (MODE === 'supabase') {
          const c = await getClient();
          c.auth.onAuthStateChange((_ev, s2) => setSession(s2 || null));
        }
      } catch (e) { setError(e.message || String(e)); setSession(null); }
    })();
  }, []);
  useEffect(() => {
    if (!session) { setMe(null); return; }
    whoami().then((w) => { setMe({ ...w, id: w.user_id, role: 'admin', nom: BRAND }); if (w.admin) reload(); }).catch((e) => setError(e.message || String(e)));
  }, [session]);
  useLive(setData, [['messages'], ['positions'], ['livraisons'], ['profils']], [me?.admin]);

  const ingMap = useMemo(() => {
    registerCustomUnits(data?.options || []);
    return new Map((data?.ingredients || []).map((i) => [i.id, i]));
  }, [data]);

  const api = useMemo(() => ({
    data, ingMap, toast, reload, lang, me, setData,
    send: (conv, texte) => envoyerMessage(setData, conv, texte, me),
    markRead: (msgs) => marquerLus(setData, msgs, me),
    async patch(table, id, p) {
      await updateRow(table, id, p);
      const k = PK[table] || 'id';
      setData((d) => ({ ...d, [table]: (d[table] || []).map((x) => (x[k] === id ? { ...x, ...p } : x)) }));
    },
    // manolo andalana manontolo (row feno)
    async save(table, rows) {
      rows = Array.isArray(rows) ? rows : [rows];
      await upsert(table, rows);
      setData((d) => {
        const list = [...(d[table] || [])];
        for (const r of rows) {
          const k = PK[table] || 'id';
          const i = list.findIndex((x) => x[k] === r[k]);
          if (i >= 0) list[i] = r; else list.push(r);
        }
        return { ...d, [table]: list };
      });
    },
    async del(table, ids) {
      ids = Array.isArray(ids) ? ids : [ids];
      await remove(table, ids);
      setData((d) => {
        const n = { ...d, [table]: (d[table] || []).filter((x) => !ids.includes(x.id)) };
        if (table === 'plats') {
          n.composition = d.composition.filter((c) => !ids.includes(c.plat_id));
          n.menus = d.menus.map((m) => {
            const m2 = { ...m, repas: Array.isArray(m.repas) ? m.repas.map((r) => (ids.includes(r.plat_id) ? { ...r, plat_id: null } : r)) : m.repas };
            ['maraina', 'atoandro', 'hariva', 'gouter'].forEach((k) => { if (ids.includes(m2[k])) m2[k] = null; });
            return m2;
          });
        }
        if (table === 'menus') n.calendrier = (d.calendrier || []).filter((c) => !ids.includes(c.menu_id));
        if (table === 'clients') n.calendrier = (d.calendrier || []).filter((c) => !ids.includes(c.client_id));
        return n;
      });
    },
    // soloina ny composition rehetra an'ny sakafo iray
    async setComposition(platId, lines) {
      const old = data.composition.filter((c) => c.plat_id === platId).map((c) => c.id);
      const keep = new Set(lines.map((l) => l.id));
      const toDelete = old.filter((id) => !keep.has(id));
      if (toDelete.length) await remove('composition', toDelete);
      if (lines.length) await upsert('composition', lines);
      setData((d) => ({ ...d, composition: [...d.composition.filter((c) => c.plat_id !== platId), ...lines] }));
    },
  }), [data, ingMap, toast, reload, lang, me]);

  if (session === undefined) return html`<div class="center muted">${tr('Chargement…', 'Loading…', 'Miandrasa…')}</div>`;
  if (!session) return html`<${Login} lang=${lang} onLang=${changeLang} />`;
  if (!me) return html`<div class="center muted">${error ? html`<span class="error">${error}</span>` : tr('Chargement…', 'Loading…', 'Miandrasa…')}</div>`;
  if (!me.admin) {
    return html`<div class="center"><div class="card login"><h2>${tr('Ce compte n\'est pas administrateur', 'This account is not an administrator', 'Tsy mpitantana ity kaonty ity')}</h2>
      <p class="muted">${session.user?.email}</p>
      <p>${tr('Utilisez l\'application qui vous correspond :', 'Use the app that matches your account:', 'Ampiasao ny application mifanaraka aminao:')}</p>
      <div class="col"><a class="btn primary" href="client.html">🙂 ${tr('Application client', 'Customer app', 'App client')}</a><a class="btn" href="livreur.html">🛵 ${tr('Application livreur', 'Courier app', 'App livreur')}</a>
      <button class="btn ghost" onClick=${async () => { await signOut(); setSession(null); }}>${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button></div></div></div>`;
  }
  if (error && !data) {
    return html`<div class="center"><div class="card"><h2>${tr('Un problème est survenu', 'Something went wrong', 'Nisy olana')}</h2><p class="error">${error}</p>
      <p class="muted">${tr('Vérifiez config.js et les tables Supabase (voir le README).', 'Check config.js and the Supabase tables (see the README).', 'Hamarino ny config.js sy ny tables ao amin\'ny Supabase (jereo ny README).')}</p>
      <button class="btn" onClick=${reload}>${tr('Réessayer', 'Retry', 'Andramo indray')}</button></div></div>`;
  }
  if (!data) return html`<div class="center muted">${tr('Chargement des données…', 'Loading data…', 'Maka ny données…')}</div>`;

  const parts = route.split('?')[0].split('/').filter(Boolean);
  let page;
  if (!parts.length) page = html`<${Dashboard} />`;
  else if (parts[0] === 'plats' && parts[1]) page = html`<${PlatEdit} id=${decodeURIComponent(parts[1])} key=${parts[1]} />`;
  else if (parts[0] === 'plats') page = html`<${PlatsList} />`;
  else if (parts[0] === 'ingredients') page = html`<${Ingredients} />`;
  else if (parts[0] === 'menus' && parts[1]) page = html`<${MenuEdit} id=${decodeURIComponent(parts[1])} key=${parts[1]} />`;
  else if (parts[0] === 'menus') page = html`<${Menus} />`;
  else if (parts[0] === 'planning') page = html`<${Planning} key=${route} />`;
  else if (parts[0] === 'clients') page = html`<${Clients} />`;
  else if (parts[0] === 'tarifs') page = html`<${Tarifs} />`;
  else if (parts[0] === 'propositions') page = html`<${Propositions} />`;
  else if (parts[0] === 'categories') page = html`<${Categories} />`;
  else if (parts[0] === 'backup') page = html`<${Backup} />`;
  else if (parts[0] === 'livraisons') page = html`<${Livraisons} />`;
  else if (parts[0] === 'livreurs') page = html`<${Livreurs} />`;
  else if (parts[0] === 'messages') page = html`<${Messages} key=${route} />`;
  else if (parts[0] === 'parametres') page = html`<${Parametres} />`;
  else page = html`<p>${tr('Page introuvable.', 'Page not found.', 'Pejy tsy hita.')}</p>`;

  const active = '/' + (parts[0] || '');
  const unread = [...new Set((data.messages || []).map((m) => m.conversation))].reduce((n, c) => n + nonLus(data.messages, c, me.id), 0);
  return html`<${AppCtx.Provider} value=${api}>
    <div class="layout">
      <aside class=${'sidebar' + (menuOpen ? ' open' : '')}>
        <div class="brand">${BRAND}<small>Back-office · ${tr('mise à jour', 'updated', 'navaozina')} ${VERSION}</small></div>
        <${LangSwitch} lang=${lang} onChange=${changeLang} />
        <nav>${nav().map(([p, l]) => html`<a href=${'#' + p} class=${active === p ? 'active' : ''} onClick=${() => setMenuOpen(false)}>${l}${p === '/messages' && unread ? html` <span class="nav-badge">${unread}</span>` : null}</a>`)}</nav>
        <div class="side-foot">
          ${MODE === 'demo'
            ? html`<div class="demo-note"><b>${tr('Mode démo', 'Demo mode', 'Mode démo')}</b><br/>${tr('Les données sont enregistrées uniquement dans ce navigateur.', 'Data is saved in this browser only.', 'Ao amin\'ity navigateur ity ihany no voatahiry ny données.')}<br/>
                <button class="link" onClick=${() => { if (confirm(tr('Effacer toutes les données de démo ?', 'Erase all demo data?', 'Hamafa ny données démo rehetra?'))) { resetDemo(); reload(); } }}>${tr('Réinitialiser', 'Reset', 'Avereno amin\'ny voalohany')}</button></div>`
            : html`<div class="muted small">${session.user?.email}</div><button class="btn ghost small" onClick=${async () => { await signOut(); setSession(null); }}>${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button>`}
        </div>
      </aside>
      ${menuOpen && html`<div class="backdrop" onClick=${() => setMenuOpen(false)}></div>`}
      <main>
        <${UpdateBanner} />
        <div class="topbar"><button class="btn ghost" onClick=${() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button><span class="topbar-title">${BRAND}</span><${LangSwitch} lang=${lang} onChange=${changeLang} /></div>
        ${error && html`<p class="error banner">${error}</p>`}
        ${page}
      </main>
    </div>
    ${toastMsg && html`<div class=${'toast ' + toastMsg.tone}>${toastMsg.msg}</div>`}
  <//>`;
}

// Ho an'ny finday: ny lohatenin'ny tsanganana dia apetaka amin'ny sela tsirairay (data-label)
function labelTables() {
  document.querySelectorAll('table.resp').forEach((t) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => { const l = heads[i] || ''; if (td.getAttribute('data-label') !== l) td.setAttribute('data-label', l); });
    });
  });
}
if (typeof document !== 'undefined' && document.getElementById('app')) {
  render(html`<${App} />`, document.getElementById('app'));
  let pending = false;
  new MutationObserver(() => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; labelTables(); }); } })
    .observe(document.getElementById('app'), { childList: true, subtree: true });
}
