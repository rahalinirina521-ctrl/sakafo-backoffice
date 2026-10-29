// Sauvegarde complète (JSON) et restauration — tables dans l'ordre des dépendances.
import { MODE, getClient, upsert, appelFonction, PK } from './db.js?v=202610291028';

export const ORDRE = ['categories', 'ingredients', 'offres', 'options', 'plats', 'composition', 'menus', 'clients', 'livreurs', 'calendrier', 'mesures', 'livraisons',
  'suggestions', 'avis', 'communaute', 'amis', 'publications', 'reactions', 'incidents', 'messages', 'notifications'];
const CLE = { reactions: 'publication_id,client_id', communaute: 'client_id', positions: 'livreur_id', profils: 'user_id' };

// Lit toutes les lignes d'une table (par paquets de 1000)
async function tout(c, table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c.from(table).select('*').range(from, from + 999);
    if (error) return rows;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
export async function exporterJSON(data) {
  let dump = { _meta: { app: 'sakafo', version: 1, date: new Date().toISOString(), source: 'navigateur' } };
  if (MODE === 'demo') for (const t of ORDRE) dump[t] = data[t] || [];
  else { const c = await getClient(); for (const t of ORDRE) dump[t] = await tout(c, t); }
  const blob = new Blob([JSON.stringify(dump, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `sakafo_sauvegarde_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return Object.fromEntries(ORDRE.map((t) => [t, dump[t].length]));
}
export function lireFichier(file) {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => { try { const j = JSON.parse(r.result); if (!j._meta || j._meta.app !== 'sakafo') throw new Error('Ce fichier n\'est pas une sauvegarde Sakafo.'); ok(j); } catch (e) { ko(e); } };
    r.onerror = () => ko(r.error);
    r.readAsText(file);
  });
}
export const resume = (dump) => ORDRE.filter((t) => Array.isArray(dump[t])).map((t) => [t, dump[t].length]);

// Restauration « fusion » : ajoute les lignes manquantes et remet les lignes existantes à l'état de la sauvegarde.
// Rien n'est supprimé.
export async function restaurer(dump, tables, onProgress) {
  const fait = {};
  if (MODE === 'demo') { for (const t of tables) { await upsert(t, dump[t] || []); fait[t] = (dump[t] || []).length; } return fait; }
  const c = await getClient();
  for (const t of ORDRE.filter((x) => tables.includes(x))) {
    const rows = dump[t] || [];
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await c.from(t).upsert(rows.slice(i, i + 500), { onConflict: CLE[t] || PK[t] || 'id' });
      if (error) throw new Error(`${t} : ${error.message}`);
      onProgress && onProgress(t, Math.min(rows.length, i + 500), rows.length);
    }
    fait[t] = rows.length;
  }
  return fait;
}

// ---------- Sauvegardes automatiques (stockage privé) ----------
export async function listeSauvegardes() {
  if (MODE === 'demo') return [];
  const c = await getClient();
  const out = [];
  for (const dossier of ['auto', 'manuel']) {
    const { data } = await c.storage.from('sauvegardes').list(dossier, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
    for (const f of data || []) if (f.name.endsWith('.json')) out.push({ chemin: `${dossier}/${f.name}`, dossier, nom: f.name, taille: f.metadata?.size, date: f.created_at || f.updated_at });
  }
  return out.sort((a, b) => String(b.nom).localeCompare(String(a.nom)));
}
export async function telechargerSauvegarde(chemin) {
  const c = await getClient();
  const { data, error } = await c.storage.from('sauvegardes').download(chemin);
  if (error) throw error;
  return JSON.parse(await data.text());
}
export const sauvegarderMaintenant = () => appelFonction('sauvegarde', {});
