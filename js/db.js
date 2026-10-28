// Fidirana amin'ny données: Supabase raha voafetra ao amin'ny config.js,
// raha tsy izany dia "mode démo" (localStorage ao amin'ny navigateur).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { DEMO } from './seed.js';

export const TABLES = ['ingredients', 'categories', 'plats', 'composition', 'menus'];
export const MODE = SUPABASE_URL && SUPABASE_ANON_KEY ? 'supabase' : 'demo';

let client = null;
export async function getClient() {
  if (!client) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

// ---------- mode démo ----------
const LS_KEY = 'sakafo_demo_v1';
let memory = null;
function demoLoad() {
  if (memory) return memory;
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && saved.ingredients) { memory = saved; return memory; }
  } catch (e) { /* tsy misy localStorage */ }
  memory = JSON.parse(JSON.stringify(DEMO));
  demoSave();
  return memory;
}
function demoSave() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(memory)); } catch (e) { /* tsy maninona */ }
}
export function resetDemo() {
  memory = JSON.parse(JSON.stringify(DEMO));
  demoSave();
}

// ---------- API iraisana ----------
export async function loadAll() {
  if (MODE === 'demo') return JSON.parse(JSON.stringify(demoLoad()));
  const c = await getClient();
  const out = {};
  await Promise.all(TABLES.map(async (t) => {
    const { data, error } = await c.from(t).select('*');
    if (error) throw error;
    out[t] = data || [];
  }));
  return out;
}

// rows: andalana FENO foana (tsy ampahany), satria manolo ny andalana iray manontolo.
export async function upsert(table, rows) {
  rows = Array.isArray(rows) ? rows : [rows];
  if (!rows.length) return;
  if (MODE === 'demo') {
    const d = demoLoad();
    for (const r of rows) {
      const i = d[table].findIndex((x) => x.id === r.id);
      if (i >= 0) d[table][i] = { ...r }; else d[table].push({ ...r });
    }
    demoSave();
    return;
  }
  const c = await getClient();
  const { error } = await c.from(table).upsert(rows);
  if (error) throw error;
}

export async function remove(table, ids) {
  ids = Array.isArray(ids) ? ids : [ids];
  if (!ids.length) return;
  if (MODE === 'demo') {
    const d = demoLoad();
    d[table] = d[table].filter((x) => !ids.includes(x.id));
    if (table === 'plats') {
      d.composition = d.composition.filter((x) => !ids.includes(x.plat_id));
      d.menus.forEach((m) => ['maraina', 'atoandro', 'hariva', 'gouter'].forEach((k) => { if (ids.includes(m[k])) m[k] = null; }));
    }
    demoSave();
    return;
  }
  const c = await getClient();
  const { error } = await c.from(table).delete().in('id', ids);
  if (error) throw error;
}

// ---------- Fidirana (login) ----------
export async function getSession() {
  if (MODE === 'demo') return { user: { email: 'demo' } };
  const c = await getClient();
  const { data } = await c.auth.getSession();
  return data.session;
}
export async function signIn(email, password) {
  const c = await getClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() {
  if (MODE === 'demo') return;
  const c = await getClient();
  await c.auth.signOut();
}
