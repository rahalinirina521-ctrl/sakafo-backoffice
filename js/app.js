import { html, render, useState, useEffect, useMemo, useCallback } from './lib.js';
import { MODE, loadAll, upsert, remove, getSession, signIn, signOut, getClient, resetDemo } from './db.js';
import { BRAND } from '../config.js';
import { AppCtx } from './ui.js';
import { tr, getLang, setLang, LANGS, LANG_SHORT } from './i18n.js';
import { registerCustomUnits } from './calc.js';
import { Dashboard } from './pages/dashboard.js';
import { PlatsList } from './pages/plats.js';
import { PlatEdit } from './pages/plat-edit.js';
import { Ingredients } from './pages/ingredients.js';
import { Menus } from './pages/menus.js';
import { Propositions } from './pages/propositions.js';
import { Categories } from './pages/categories.js';
import { Backup } from './pages/backup.js';

export const VERSION = '2026-10-28 19:45';

const nav = () => [
  ['/', tr('Tableau de bord', 'Dashboard', 'Tableau de bord')],
  ['/plats', tr('Plats', 'Dishes', 'Sakafo')],
  ['/ingredients', tr('Ingrédients', 'Ingredients', 'Ingrédients')],
  ['/menus', tr('Menus', 'Menus', 'Menus')],
  ['/propositions', tr('Suggestions IA', 'AI suggestions', 'Soso-kevitra IA')],
  ['/categories', tr('Catégories', 'Categories', 'Sokajy')],
  ['/backup', tr('Sauvegarde Excel', 'Excel backup', 'Backup Excel')],
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
  // Avaozina ao amin'ny cache ny fichier rehetra, vao alaina indray ny pejy
  const files = [...(v.files || []), 'index.html'];
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
    const check = () => fetchVersion().then((v) => { if (alive && v.version && v.version !== VERSION) setUpd(v); }).catch(() => {});
    check();
    const t = setInterval(check, 60000);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  if (!upd) return null;
  const d = fmtDate(upd.date);
  return html`<div class="update-banner" role="status">
    <span><b>${tr('Nouvelle version disponible', 'New version available', 'Misy version vaovao')}</b> — ${tr('mise à jour du', 'updated on', 'navaozina ny')} ${d.day} ${tr('à', 'at', 'tamin\'ny')} ${d.time}. ${tr('Enregistrez votre travail puis mettez à jour.', 'Save your work, then update.', 'Tehirizo aloha ny asanao dia avaozy.')}</span>
    <button class="btn small primary" disabled=${busy} onClick=${() => { setBusy(true); applyUpdate(upd); }}>${busy ? tr('Mise à jour…', 'Updating…', 'Manavao…') : tr('Mettre à jour maintenant', 'Update now', 'Avaozy izao')}</button>
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
  useEffect(() => { if (session) reload(); }, [session]);

  const ingMap = useMemo(() => {
    registerCustomUnits(data?.options || []);
    return new Map((data?.ingredients || []).map((i) => [i.id, i]));
  }, [data]);

  const api = useMemo(() => ({
    data, ingMap, toast, reload, lang,
    // manolo andalana manontolo (row feno)
    async save(table, rows) {
      rows = Array.isArray(rows) ? rows : [rows];
      await upsert(table, rows);
      setData((d) => {
        const list = [...(d[table] || [])];
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
        const n = { ...d, [table]: (d[table] || []).filter((x) => !ids.includes(x.id)) };
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
  }), [data, ingMap, toast, reload, lang]);

  if (session === undefined) return html`<div class="center muted">${tr('Chargement…', 'Loading…', 'Miandrasa…')}</div>`;
  if (!session) return html`<${Login} lang=${lang} onLang=${changeLang} />`;
  if (error && !data) {
    return html`<div class="center"><div class="card"><h2>${tr('Un problème est survenu', 'Something went wrong', 'Nisy olana')}</h2><p class="error">${error}</p>
      <p class="muted">${tr('Vérifiez config.js et les tables Supabase (voir le README).', 'Check config.js and the Supabase tables (see the README).', 'Hamarino ny config.js sy ny tables ao amin\'ny Supabase (jereo ny README).')}</p>
      <button class="btn" onClick=${reload}>${tr('Réessayer', 'Retry', 'Andramo indray')}</button></div></div>`;
  }
  if (!data) return html`<div class="center muted">${tr('Chargement des données…', 'Loading data…', 'Maka ny données…')}</div>`;

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
  else page = html`<p>${tr('Page introuvable.', 'Page not found.', 'Pejy tsy hita.')}</p>`;

  const active = '/' + (parts[0] || '');
  return html`<${AppCtx.Provider} value=${api}>
    <div class="layout">
      <aside class=${'sidebar' + (menuOpen ? ' open' : '')}>
        <div class="brand">${BRAND}<small>Back-office · ${tr('mise à jour', 'updated', 'navaozina')} ${VERSION}</small></div>
        <${LangSwitch} lang=${lang} onChange=${changeLang} />
        <nav>${nav().map(([p, l]) => html`<a href=${'#' + p} class=${active === p ? 'active' : ''} onClick=${() => setMenuOpen(false)}>${l}</a>`)}</nav>
        <div class="side-foot">
          ${MODE === 'demo'
            ? html`<div class="demo-note"><b>${tr('Mode démo', 'Demo mode', 'Mode démo')}</b><br/>${tr('Les données sont enregistrées uniquement dans ce navigateur.', 'Data is saved in this browser only.', 'Ao amin\'ity navigateur ity ihany no voatahiry ny données.')}<br/>
                <button class="link" onClick=${() => { if (confirm(tr('Effacer toutes les données de démo ?', 'Erase all demo data?', 'Hamafa ny données démo rehetra?'))) { resetDemo(); reload(); } }}>${tr('Réinitialiser', 'Reset', 'Avereno amin\'ny voalohany')}</button></div>`
            : html`<div class="muted small">${session.user?.email}</div><button class="btn ghost small" onClick=${async () => { await signOut(); setSession(null); }}>${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button>`}
        </div>
      </aside>
      <main>
        <${UpdateBanner} />
        <div class="topbar"><button class="btn ghost" onClick=${() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button><span>${BRAND}</span></div>
        ${error && html`<p class="error banner">${error}</p>`}
        ${page}
      </main>
    </div>
    ${toastMsg && html`<div class=${'toast ' + toastMsg.tone}>${toastMsg.msg}</div>`}
  <//>`;
}

if (typeof document !== 'undefined' && document.getElementById('app')) render(html`<${App} />`, document.getElementById('app'));
