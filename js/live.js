// Temps réel partagé : applique les changements Supabase (INSERT/UPDATE/DELETE) aux données en mémoire.
import { useEffect } from './lib.js?v=202610290725';
import { subscribe, PK, insertRow, updateRow, MODE } from './db.js?v=202610290725';
import { uid } from './calc.js?v=202610290725';

export function applyChange(d, table, p) {
  if (!d) return d;
  const key = PK[table] || 'id';
  const list = [...(d[table] || [])];
  if (p.eventType === 'DELETE') {
    const id = p.old && p.old[key];
    return { ...d, [table]: list.filter((x) => x[key] !== id) };
  }
  const row = p.new; const i = list.findIndex((x) => x[key] === row[key]);
  if (i >= 0) list[i] = { ...list[i], ...row }; else list.push(row);
  return { ...d, [table]: list };
}

// useLive(setData, [['messages'], ['positions'], ['livraisons', 'date=eq.2026-10-29']], deps)
export function useLive(setData, subs, deps = []) {
  useEffect(() => {
    if (MODE !== 'supabase') return undefined;
    let stops = []; let dead = false;
    Promise.all(subs.map(([t, f]) => subscribe(t, f, (p) => setData((d) => applyChange(d, t, p))))).then((s) => { if (dead) s.forEach((x) => x()); else stops = s; });
    return () => { dead = true; stops.forEach((x) => x()); };
  }, deps);
}

// Envoi d'un message + ajout local immédiat
export async function envoyerMessage(setData, conversation, texte, me) {
  const row = { id: uid(), conversation, texte, auteur_id: me.id, auteur_role: me.role, auteur_nom: me.nom || '', lu_par: [me.id], created_at: new Date().toISOString() };
  setData((d) => ({ ...d, messages: [...(d.messages || []).filter((m) => m.id !== row.id), row] }));
  try { await insertRow('messages', { id: row.id, conversation, texte, auteur_id: me.id, auteur_role: me.role, auteur_nom: me.nom || '', lu_par: [me.id] }); } catch (e) {
    setData((d) => ({ ...d, messages: (d.messages || []).filter((m) => m.id !== row.id) }));
    throw e;
  }
}
export function marquerLus(setData, msgs, me) {
  if (!msgs.length) return;
  const ids = new Set(msgs.map((m) => m.id));
  setData((d) => ({ ...d, messages: (d.messages || []).map((m) => (ids.has(m.id) ? { ...m, lu_par: [...new Set([...(m.lu_par || []), me.id])] } : m)) }));
  msgs.forEach((m) => updateRow('messages', m.id, { lu_par: [...new Set([...(m.lu_par || []), me.id])] }).catch(() => {}));
}
