import { html, render, useState, useEffect, useMemo, useCallback } from './lib.js';
import { MODE, loadAll, upsert, remove, getSession, signIn, signOut, getClient, resetDemo } from './db.js';
import { BRAND } from '../config.js';
import { AppCtx } from './ui.js';
import { Dashboard } from './pages/dashboard.js';
import { PlatsList } from './pages/plats.js';
import { PlatEdit } from './pages/plat-edit.js';
import { Ingredients } from './pages/ingredients.js';
import { Menus } from './pages/menus.js';
import { Propositions } from './pages/propositions.js';
import { Categories } from './pages/categories.js';
import { Backup } from './pages/backup.js';

const NAV = [
  ['/', 'Tableau de bord'],
  ['/plats', 'Sakafo'],
  ['/ingredients', 'Ingrédients'],
  ['/menus', 'Menus'],
  ['/propositions', 'Soso-kevitra IA'],
  ['/categories', 'Sokajy'],
  ['/backup', 'Backup Excel'],
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

function Login({ onDone }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await signIn(email, pwd); onDone(); } catch (x) { setErr('Tsy nety: ' + (x.message || x)); }
    setBusy(false);
  };
  return html`<div class="login-wrap"><form class="card login" onSubmit=${submit}>
    <h1>${BRAND}</h1><p class="muted">Back-office — midira</p>
    <label class="field"><span class="field-label">Email</span><input type="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="username" /></label>
    <label class="field"><span class="field-label">Mot de passe</span><input type="password" required value=${pwd} onInput=${(e) => setPwd(e.target.value)} autocomplete="current-password" /></label>
    ${err && html`<p class="error">${err}</p>`}
    <button class="btn primary" disabled=${busy}>${busy ? 'Miandrasa…' : 'Hiditra'}</button>
  </form></div>`;
}

export function App() {
  const route = useRoute();
  const [session, setSession] = useState(undefined);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const toast = useCallback((msg, tone = 'ok') => {
    setToastMsg({ msg, tone, k: Date.now() });
    setTimeout(() => setToastMsg((t) => (t && Date.now() - t.k >= 3400 ? null : t)), 3500);
  }, []);

  const reload = useCallback(async () => {
    try { setData(await loadAll()); setError(''); } catch (e) { setError(e.message || String(e)); }
  }, []);

  useEffect(() => {
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
  useEffect(() => { if (session) reload(); }, [session]);

  const ingMap = useMemo(() => new Map((data?.ingredients || []).map((i) => [i.id, i])), [data]);

  const api = useMemo(() => ({
    data, ingMap, toast, reload,
    // manolo andalana manontolo (row feno)
    async save(table, rows) {
      rows = Array.isArray(rows) ? rows : [rows];
      await upsert(table, rows);
      setData((d) => {
        const list = [...d[table]];
        for (const r of rows) {
          const i = list.findIndex((x) => x.id === r.id);
          if (i >= 0) list[i] = r; else list.push(r);
        }
        return { ...d, [table]: list };
      });
    },
    async del(table, ids) {
      ids = Array.isArray(ids) ? ids : [ids];
      await remove(table, ids);
      setData((d) => {
        const n = { ...d, [table]: d[table].filter((x) => !ids.includes(x.id)) };
        if (table === 'plats') {
          n.composition = d.composition.filter((c) => !ids.includes(c.plat_id));
          n.menus = d.menus.map((m) => {
            const m2 = { ...m };
            ['maraina', 'atoandro', 'hariva', 'gouter'].forEach((k) => { if (ids.includes(m2[k])) m2[k] = null; });
            return m2;
          });
        }
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
  }), [data, ingMap, toast, reload]);

  if (session === undefined) return html`<div class="center muted">Miandrasa…</div>`;
  if (!session) return html`<${Login} onDone=${() => {}} />`;
  if (error && !data) return html`<div class="center"><div class="card"><h2>Nisy olana</h2><p class="error">${error}</p><p class="muted">Hamarino ny config.js sy ny tables ao amin'ny Supabase (jereo ny README).</p><button class="btn" onClick=${reload}>Andramo indray</button></div></div>`;
  if (!data) return html`<div class="center muted">Maka ny données…</div>`;

  const parts = route.split('/').filter(Boolean);
  let page;
  if (!parts.length) page = html`<${Dashboard} />`;
  else if (parts[0] === 'plats' && parts[1]) page = html`<${PlatEdit} id=${decodeURIComponent(parts[1])} key=${parts[1]} />`;
  else if (parts[0] === 'plats') page = html`<${PlatsList} />`;
  else if (parts[0] === 'ingredients') page = html`<${Ingredients} />`;
  else if (parts[0] === 'menus') page = html`<${Menus} />`;
  else if (parts[0] === 'propositions') page = html`<${Propositions} />`;
  else if (parts[0] === 'categories') page = html`<${Categories} />`;
  else if (parts[0] === 'backup') page = html`<${Backup} />`;
  else page = html`<p>Pejy tsy hita.</p>`;

  const active = '/' + (parts[0] || '');
  return html`<${AppCtx.Provider} value=${api}>
    <div class="layout">
      <aside class=${'sidebar' + (menuOpen ? ' open' : '')}>
        <div class="brand">${BRAND}<small>Back-office</small></div>
        <nav>${NAV.map(([p, l]) => html`<a href=${'#' + p} class=${active === p ? 'active' : ''} onClick=${() => setMenuOpen(false)}>${l}</a>`)}</nav>
        <div class="side-foot">
          ${MODE === 'demo'
            ? html`<div class="demo-note"><b>Mode démo</b><br/>Ao amin'ity navigateur ity ihany no voatahiry ny données.<br/><button class="link" onClick=${() => { if (confirm('Hamafa ny données démo rehetra?')) { resetDemo(); reload(); } }}>Avereno amin'ny voalohany</button></div>`
            : html`<div class="muted small">${session.user?.email}</div><button class="btn ghost small" onClick=${async () => { await signOut(); setSession(null); }}>Hivoaka</button>`}
        </div>
      </aside>
      <main>
        <div class="topbar"><button class="btn ghost" onClick=${() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button><span>${BRAND}</span></div>
        ${error && html`<p class="error banner">${error}</p>`}
        ${page}
      </main>
    </div>
    ${toastMsg && html`<div class=${'toast ' + toastMsg.tone}>${toastMsg.msg}</div>`}
  <//>`;
}

render(html`<${App} />`, document.getElementById('app'));
