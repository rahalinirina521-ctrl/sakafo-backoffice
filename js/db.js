// Fidirana amin'ny données: Supabase raha voafetra ao amin'ny config.js,
// raha tsy izany dia "mode démo" (localStorage ao amin'ny navigateur).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js?v=202610291359';
import { DEMO } from './seed.js?v=202610291359';
import { resizeImage, blobToDataUrl } from './image.js?v=202610291359';

export const TABLES = ['ingredients', 'categories', 'plats', 'composition', 'menus', 'options', 'clients', 'calendrier', 'offres', 'suggestions', 'livreurs', 'livraisons', 'mesures', 'positions', 'messages', 'profils', 'notifications', 'communaute', 'amis', 'publications', 'reactions', 'avis', 'incidents'];
const OPTIONAL_TABLES = ['options', 'clients', 'calendrier', 'offres', 'suggestions', 'livreurs', 'livraisons', 'mesures', 'positions', 'messages', 'profils', 'notifications', 'communaute', 'amis', 'publications', 'reactions', 'avis', 'incidents'];
// clé primaire si ce n'est pas « id »
export const PK = { positions: 'livreur_id', profils: 'user_id', push_abonnements: 'endpoint', communaute: 'client_id' };
const pk = (t) => PK[t] || 'id';
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
    if (saved && saved.ingredients) { memory = saved; for (const t of OPTIONAL_TABLES) if (!memory[t]) memory[t] = t === 'offres' ? JSON.parse(JSON.stringify(DEMO.offres)) : []; return memory; }
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
  categories: { id: null, nom: '', nom_en: null, nom_mg: null, kcal_cible: null, tolerance: 0.1, prot_g_kg: null, cg_max: null, ordre: 0, regles: null, statut: 'valide', type: null, description: null, icone: null },
  plats: { id: null, nom: '', nom_commercial: null, marketing: null, nom_en: null, nb: null, traductions: {}, fotoana: null, categories: [], description: null, avantages: null, effets: null, conseil: null, conservation: null, post_reseaux: null, details: {}, image_url: null, prix_vente: null, statut: 'Voamarina', notes: null },
  composition: { id: null, plat_id: null, ingredient_id: null, quantite: 0, unite: 'g', grammes: 0, note: null, ordre: 0 },
  options: { id: null, type: '', valeur: '', base: null, facteur: null, ordre: 0 },
  menus: { id: null, nom: '', categorie_id: null, repas: [], andro: null, maraina: null, atoandro: null, hariva: null, gouter: null, notes: null },
  clients: { id: null, nom: '', telephone: null, adresse: null, repere: null, lat: null, lng: null, maps_url: null, categorie_id: null, kcal_cible: null, allergies: null, notes: null, profil: {}, actif: true, email: null, formule: 'livraison', abonnement_debut: null, abonnement_fin: null, offre_id: null, creneaux: ['midi'] },
  livreurs: { id: null, nom: '', telephone: null, email: null, vehicule: null, couleur: null, actif: true },
  livraisons: { id: null, date: null, creneau: 'midi', client_id: null, livreur_id: null, statut: 'prevue', ordre: null, adresse: null, repere: null, lat: null, lng: null, eta: null, depart_at: null, livree_at: null, menu_id: null, note_livreur: null },
  mesures: { id: null, client_id: null, date: null, poids: null, tour_taille: null, notes: null },
  push_abonnements: { endpoint: null, p256dh: null, auth: null, appareil: null },
  notifications: { id: null, type: 'info', titre: '', texte: null, lien: null, lu: false },
  positions: { livreur_id: null, lat: null, lng: null, precision: null, vitesse: null, cap: null, updated_at: null },
  calendrier: { id: null, date: null, menu_id: null, categorie_id: null, client_id: null, notes: null },
  suggestions: { id: null, statut: 'attente', categorie_id: null, fotoana: null, nom: null, plat_id: null, data: {} },
  offres: { id: null, nom: '', nb_jours: 1, prix: null, categorie_id: null, description: null, actif: true, ordre: 0, mode: null },
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
    let qy = c.from(t).select('*');
    if (t === 'messages') qy = qy.order('created_at', { ascending: false }).limit(800);
    if (t === 'notifications') qy = qy.order('created_at', { ascending: false }).limit(200);
    if (t === 'publications') qy = qy.order('created_at', { ascending: false }).limit(300);
    if (t === 'incidents') qy = qy.order('created_at', { ascending: false }).limit(100);
    if (t === 'livraisons') qy = qy.gte('date', new Date(Date.now() - 62 * 864e5).toISOString().slice(0, 10));
    const { data, error } = await qy;
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
      const i = d[table].findIndex((x) => x[pk(table)] === r[pk(table)]);
      if (i >= 0) d[table][i] = { ...r }; else d[table].push({ ...r });
    }
    demoSave();
    return;
  }
  const c = await getClient();
  const { error } = await c.from(table).upsert(rows, { onConflict: pk(table) });
  if (error) throw error;
}

export async function remove(table, ids) {
  ids = Array.isArray(ids) ? ids : [ids];
  if (!ids.length) return;
  if (MODE === 'demo') {
    const d = demoLoad();
    d[table] = (d[table] || []).filter((x) => !ids.includes(x[pk(table)]));
    if (table === 'plats') {
      d.composition = d.composition.filter((x) => !ids.includes(x.plat_id));
      d.menus.forEach((m) => ['maraina', 'atoandro', 'hariva', 'gouter'].forEach((k) => { if (ids.includes(m[k])) m[k] = null; }));
    }
    demoSave();
    return;
  }
  const c = await getClient();
  const { error } = await c.from(table).delete().in(pk(table), ids);
  if (error) throw error;
}

// ---------- Fidirana (login) ----------
export async function getSession() {
  if (MODE === 'demo') return { user: { email: 'demo' } };
  const c = await getClient();
  // « Se souvenir de moi » décoché : la session se termine à la fermeture du navigateur
  try {
    if (localStorage.getItem('sakafo_session_temp') === '1' && !sessionStorage.getItem('sakafo_alive')) {
      localStorage.removeItem('sakafo_session_temp');
      await c.auth.signOut({ scope: 'local' });
      return null;
    }
  } catch (e) { /* stockage indisponible */ }
  const { data } = await c.auth.getSession();
  return data.session;
}
export function seSouvenir(oui) {
  try {
    if (oui) localStorage.removeItem('sakafo_session_temp'); else localStorage.setItem('sakafo_session_temp', '1');
    sessionStorage.setItem('sakafo_alive', '1');
  } catch (e) { /* */ }
}
export async function signIn(email, password) {
  const c = await getClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
// scope : 'local' (cet appareil) ou 'global' (tous les appareils)
export async function signOut(scope = 'local') {
  try { localStorage.removeItem('sakafo_session_temp'); sessionStorage.removeItem('sakafo_alive'); } catch (e) { /* */ }
  if (MODE === 'demo') return;
  const c = await getClient();
  await c.auth.signOut({ scope });
}
// Vérifie le mot de passe actuel puis le remplace
export async function changerMotDePasse(email, actuel, nouveau) {
  const c = await getClient();
  const { error: e1 } = await c.auth.signInWithPassword({ email, password: actuel });
  if (e1) throw new Error('Mot de passe actuel incorrect');
  const { error } = await c.auth.updateUser({ password: nouveau });
  if (error) throw error;
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

// ---------- Mise à jour partielle (clients et livreurs n'ont pas le droit d'INSERT) ----------
export async function updateRow(table, id, patch) {
  if (MODE === 'demo') {
    const d = demoLoad(); const list = d[table] || (d[table] = []);
    const i = list.findIndex((x) => x[pk(table)] === id);
    if (i >= 0) list[i] = { ...list[i], ...patch };
    demoSave(); return;
  }
  const c = await getClient();
  const { error } = await c.from(table).update(patch).eq(pk(table), id);
  if (error) throw error;
}
// Insertion simple (messages, mesures…) sans normalisation
export async function insertRow(table, row) {
  if (MODE === 'demo') { const d = demoLoad(); (d[table] || (d[table] = [])).push({ created_at: new Date().toISOString(), ...row }); demoSave(); return row; }
  const c = await getClient();
  const { data, error } = await c.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

// ---------- Comptes ----------
export async function signUp(email, password, meta = {}) {
  const c = await getClient();
  const { data, error } = await c.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: location.href.split('#')[0] } });
  if (error) throw error;
  return data;
}
export async function resetPassword(email) {
  const c = await getClient();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
  if (error) throw error;
}
export async function updatePassword(password) {
  const c = await getClient();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw error;
}
export async function onAuthChange(cb) {
  if (MODE === 'demo') return () => {};
  const c = await getClient();
  const { data } = c.auth.onAuthStateChange((ev, session) => cb(ev, session));
  return () => data.subscription.unsubscribe();
}
// Qui suis-je ? { user_id, admin, role: invite|client|livreur, client_id, livreur_id }
export async function whoami(demoAs) {
  if (MODE === 'demo') return demoAs || { user_id: 'demo', admin: true, role: 'client', client_id: null, livreur_id: null };
  const c = await getClient();
  const { data, error } = await c.rpc('whoami');
  if (error) throw error;
  return data;
}

// ---------- Temps réel ----------
// subscribe('messages', 'conversation=eq.client:CL0001', (payload) => …) → fonction d'arrêt
export async function subscribe(table, filter, cb) {
  if (MODE === 'demo') return () => {};
  const c = await getClient();
  const ch = c.channel('rt-' + table + '-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (p) => cb(p))
    .subscribe();
  return () => { c.removeChannel(ch); };
}

// Lecture simple d'une table (ex. objectifs pour le formulaire d'inscription, sans être connecté)
export async function lireTable(table, cols = '*') {
  if (MODE === 'demo') return JSON.parse(JSON.stringify(demoLoad()[table] || []));
  const c = await getClient();
  const { data, error } = await c.from(table).select(cols);
  if (error) throw error;
  return data || [];
}
// Appel d'une fonction Edge avec la session de l'utilisateur
export async function appelFonction(nom, body) {
  if (MODE === 'demo') throw new Error('Indisponible en mode démo');
  const c = await getClient();
  const { data, error } = await c.functions.invoke(nom, { body });
  if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch (e) { /* */ } throw new Error(m); }
  return data;
}

// Connexion : e-mail directement, ou nom d'utilisateur / compte démo via la fonction « connexion »
export async function connexion(identifiant, password) {
  const id = String(identifiant || '').trim();
  if (MODE === 'demo') return;
  const c = await getClient();
  if (id.includes('@')) {
    const { error } = await c.auth.signInWithPassword({ email: id, password });
    if (error) throw new Error(/confirm/i.test(error.message) ? 'Adresse e-mail pas encore confirmée : ouvrez l\'e-mail reçu à l\'inscription.' : 'Identifiant ou mot de passe incorrect');
    return;
  }
  const { data, error } = await c.functions.invoke('connexion', { body: { identifiant: id, password } });
  if (error) { let m = 'Identifiant ou mot de passe incorrect'; try { const j = await error.context.json(); m = j.error || m; } catch (e) { /* */ } throw new Error(m); }
  const { error: e2 } = await c.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (e2) throw e2;
}
export async function usernameLibre(u) {
  if (MODE === 'demo') return true;
  const c = await getClient();
  const { data } = await c.rpc('username_libre', { u });
  return !!data;
}

// Suppression par critères (tables à clé composée, ex. réactions)
export async function supprimer(table, match) {
  if (MODE === 'demo') { const d = demoLoad(); d[table] = (d[table] || []).filter((x) => !Object.entries(match).every(([k, v]) => x[k] === v)); demoSave(); return; }
  const c = await getClient();
  let q = c.from(table).delete();
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw error;
}
// Lecture paginée (journal, sauvegardes…)
export async function lire(table, { order = 'created_at', limit = 200, filtre } = {}) {
  if (MODE === 'demo') return (demoLoad()[table] || []).slice(0, limit);
  const c = await getClient();
  let q = c.from(table).select('*').order(order, { ascending: false }).limit(limit);
  if (filtre) q = filtre(q);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
