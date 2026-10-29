// Fidirana amin'ny données: Supabase raha voafetra ao amin'ny config.js,
// raha tsy izany dia "mode démo" (localStorage ao amin'ny navigateur).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { DEMO } from './seed.js';
import { resizeImage, blobToDataUrl } from './image.js';

export const TABLES = ['ingredients', 'categories', 'plats', 'composition', 'menus', 'options', 'clients', 'calendrier', 'offres'];
const OPTIONAL_TABLES = ['options', 'clients', 'calendrier', 'offres'];
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
    if (saved && saved.ingredients) { memory = saved; for (const t of ['options', 'clients', 'calendrier', 'offres']) if (!memory[t]) memory[t] = t === 'offres' ? JSON.parse(JSON.stringify(DEMO.offres)) : []; return memory; }
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

// ---------- Colonnes feno isaky ny table (mba tsy ho null ny not null) ----------
const COLS = {
  ingredients: { id: null, nom_mg: '', nom_fr: null, nom_en: null, categorie: null, etat: null, kcal: null, proteines: null, glucides: null, lipides: null, fibres: null, sucres: null, sodium: null, ig: null, poids_piece: null, densite: null, prix_kg: null, source: null, a_verifier: true },
  categories: { id: null, nom: '', nom_en: null, nom_mg: null, kcal_cible: null, tolerance: 0.1, prot_g_kg: null, cg_max: null, ordre: 0, regles: null },
  plats: { id: null, nom: '', nom_commercial: null, marketing: null, nom_en: null, nb: null, traductions: {}, fotoana: null, categories: [], description: null, avantages: null, effets: null, conseil: null, conservation: null, post_reseaux: null, details: {}, image_url: null, prix_vente: null, statut: 'Voamarina', notes: null },
  composition: { id: null, plat_id: null, ingredient_id: null, quantite: 0, unite: 'g', grammes: 0, note: null, ordre: 0 },
  options: { id: null, type: '', valeur: '', base: null, facteur: null, ordre: 0 },
  menus: { id: null, nom: '', categorie_id: null, repas: [], andro: null, maraina: null, atoandro: null, hariva: null, gouter: null, notes: null },
  clients: { id: null, nom: '', telephone: null, adresse: null, categorie_id: null, kcal_cible: null, allergies: null, notes: null, profil: {}, actif: true },
  calendrier: { id: null, date: null, menu_id: null, categorie_id: null, client_id: null, notes: null },
  offres: { id: null, nom: '', nb_jours: 1, prix: null, categorie_id: null, description: null, actif: true, ordre: 0 },
};
export function normalizeRow(table, r) {
  const def = COLS[table];
  if (!def) return r;
  const o = {};
  for (const [k, v] of Object.entries(def)) o[k] = r[k] === undefined || (r[k] === null && v !== null && typeof v !== 'number') ? (Array.isArray(v) ? [...v] : (v && typeof v === 'object' ? { ...v } : v)) : r[k];
  if (table === 'composition' && (r.quantite === undefined || r.quantite === null)) o.quantite = r.grammes ?? 0;
  if (r.created_at) o.created_at = r.created_at;
  return o;
}

// ---------- API iraisana ----------
export async function loadAll() {
  if (MODE === 'demo') return JSON.parse(JSON.stringify(demoLoad()));
  const c = await getClient();
  const out = {};
  await Promise.all(TABLES.map(async (t) => {
    const { data, error } = await c.from(t).select('*');
    if (error) { if (OPTIONAL_TABLES.includes(t)) { out[t] = []; return; } throw error; }
    out[t] = data || [];
  }));
  return out;
}

// rows: andalana FENO foana (tsy ampahany), satria manolo ny andalana iray manontolo.
export async function upsert(table, rows) {
  rows = (Array.isArray(rows) ? rows : [rows]).map((r) => normalizeRow(table, r));
  if (!rows.length) return;
  if (MODE === 'demo') {
    const d = demoLoad();
    for (const r of rows) {
      if (!d[table]) d[table] = [];
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
    d[table] = (d[table] || []).filter((x) => !ids.includes(x.id));
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

// ---------- Sary ----------
// Mampakatra ny sary an'ny sakafo iray ary mamerina ny lien-ny
export async function uploadPlatImage(platId, file) {
  const blob = await resizeImage(file, MODE === 'demo' ? 700 : 1200, MODE === 'demo' ? 0.75 : 0.85);
  if (MODE === 'demo') return blobToDataUrl(blob);
  const c = await getClient();
  const path = `plats/${platId}.jpg`;
  const { error } = await c.storage.from('sary').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw error;
  const { data } = c.storage.from('sary').getPublicUrl(path);
  return data.publicUrl + '?v=' + Date.now();
}
export async function removePlatImage(platId) {
  if (MODE === 'demo') return;
  const c = await getClient();
  await c.storage.from('sary').remove([`plats/${platId}.jpg`]);
}

// ---------- Famindrana données démo → Supabase ----------
export function readBrowserDemo() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY));
    if (d && d.plats) return d;
  } catch (e) { /* tsy misy */ }
  return null;
}
export async function migrateDemoToSupabase(d) {
  if (MODE !== 'supabase') throw new Error('Supabase ?');
  const order = ['ingredients', 'categories', 'plats', 'composition', 'menus'];
  const counts = {};
  for (const t of order) {
    const rows = (d[t] || []).map((r) => normalizeRow(t, r));
    counts[t] = rows.length;
    for (let i = 0; i < rows.length; i += 200) await upsert(t, rows.slice(i, i + 200));
  }
  return counts;
}

// ---------- IA ao anatiny (Edge Function "ia-hameno") ----------
// Mamerina ny soratra navalin'ny IA. Raha tsy voafetra ny cle API: error.code = 'no_key'
export async function callAI(prompt) {
  if (MODE === 'demo') { const e = new Error('Supabase requis'); e.code = 'demo'; throw e; }
  const c = await getClient();
  const { data, error } = await c.functions.invoke('ia-hameno', { body: { prompt } });
  if (error) {
    let info = {};
    try { info = await error.context.json(); } catch (x) { /* tsy JSON */ }
    const e = new Error(info.error || error.message || 'Erreur IA');
    e.code = info.code || 'ai';
    throw e;
  }
  if (!data || typeof data.text !== 'string') throw new Error('Réponse IA vide');
  return data.text;
}
