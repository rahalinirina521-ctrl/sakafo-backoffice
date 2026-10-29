// Règles métier partagées (back-office, application client, application livreur).
import { tr } from './i18n.js?v=202610291028';
import { menuRepas, lineGrams } from './calc.js?v=202610291028';

export function aboStatut(c) {
  if (!c || !c.abonnement_fin) return { label: tr('Sans abonnement', 'No subscription', 'Tsy misy abonnement'), tone: 'muted', actif: false };
  const j = Math.ceil((new Date(c.abonnement_fin + 'T23:59:59') - Date.now()) / 864e5);
  if (j < 0) return { label: tr('Expiré', 'Expired', 'Lany'), tone: 'bad', actif: false, jours: j };
  return { label: tr(`${j} j restants`, `${j} days left`, `${j} andro sisa`), tone: j <= 3 ? 'warn' : 'ok', actif: true, jours: j };
}
export function aboCouvre(c, date) {
  if (c.actif === false || c.formule === 'conseil') return false;
  if (c.abonnement_debut && date < c.abonnement_debut) return false;
  if (c.abonnement_fin && date > c.abonnement_fin) return false;
  return true;
}
// Menu du jour d'un client : personnalisé sinon menu général de son objectif
export function menuDuJour(data, client, date) {
  const perso = (data.calendrier || []).find((x) => x.id === `cli:${client.id}:${date}`);
  if (perso) return { menu_id: perso.menu_id, perso: true };
  const gen = (data.calendrier || []).find((x) => x.id === `cat:${client.categorie_id}:${date}`);
  return gen ? { menu_id: gen.menu_id, perso: false } : { menu_id: null };
}
// Liste de courses (formule « conseil ») : somme des ingrédients des menus donnés
export function listeCourses(data, menus, ingMap, personnes = 1) {
  const tot = new Map();
  for (const m of menus) for (const r of menuRepas(m)) {
    if (!r.plat_id) continue;
    for (const l of data.composition.filter((c) => c.plat_id === r.plat_id)) {
      const ing = ingMap.get(l.ingredient_id); if (!ing) continue;
      const g = lineGrams(l, ing) ?? 0;
      const cur = tot.get(ing.id) || { ing, grammes: 0, pieces: 0, plats: new Set() };
      cur.grammes += g * personnes;
      if ((l.unite || 'g') === 'isa') cur.pieces += (+l.quantite || 0) * personnes;
      cur.plats.add(r.plat_id);
      tot.set(ing.id, cur);
    }
  }
  return [...tot.values()].sort((a, b) => (a.ing.categorie || '').localeCompare(b.ing.categorie || '') || b.grammes - a.grammes);
}
