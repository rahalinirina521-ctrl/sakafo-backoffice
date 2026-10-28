// Teny: frantsay par défaut, azo ovaina ho anglisy na malagasy.
const KEY = 'sakafo_lang';
export const LANGS = [['fr', 'Français'], ['en', 'English'], ['mg', 'Malagasy']];
export const LANG_SHORT = { fr: 'FR', en: 'EN', mg: 'MG' };

let lang = 'fr';
try { const saved = localStorage.getItem(KEY); if (saved && LANG_SHORT[saved]) lang = saved; } catch (e) { /* tsy misy */ }

export const getLang = () => lang;
export function setLang(l) {
  if (!LANG_SHORT[l]) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch (e) { /* tsy maninona */ }
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = l;
}

// tr('Français', 'English', 'Malagasy')
export const tr = (fr, en, mg) => (lang === 'en' ? (en ?? fr) : lang === 'mg' ? (mg ?? fr) : fr);

const FOT = {
  Maraina: ['Petit-déjeuner', 'Breakfast', 'Maraina'],
  Atoandro: ['Déjeuner', 'Lunch', 'Atoandro'],
  Hariva: ['Dîner', 'Dinner', 'Hariva'],
  'Goûter': ['Goûter', 'Snack', 'Goûter'],
};
export const fotLabel = (f) => (FOT[f] ? tr(...FOT[f]) : (f || '—'));

const UNIT = {
  g: ['g', 'g', 'g'],
  kg: ['kg', 'kg', 'kg'],
  ml: ['ml', 'ml', 'ml'],
  cl: ['cl', 'cl', 'cl'],
  l: ['L', 'L', 'L'],
  tasse: ['tasse', 'cup', 'kapoaka'],
  isa: ['pièce(s)', 'piece(s)', 'isa'],
  cas: ['c. à soupe', 'tbsp', 'sotro lehibe'],
  cac: ['c. à café', 'tsp', 'sotro kely'],
};
export const unitLabel = (u) => (UNIT[u] ? tr(...UNIT[u]) : u);

export function ingName(i) {
  if (!i) return '?';
  if (lang === 'en') return i.nom_en || i.nom_fr || i.nom_mg;
  if (lang === 'mg') return i.nom_mg || i.nom_fr;
  return i.nom_fr || i.nom_mg;
}
export function catName(c) {
  if (!c) return '?';
  if (lang === 'en') return c.nom_en || c.nom;
  if (lang === 'mg') return c.nom_mg || c.nom;
  return c.nom;
}

// Textes ny sakafo: FR = colonnes fototra; EN/MG = plat.traductions[l]
// Ny tena ilain'ny client ihany (mandresy lahatra)
export const PLAT_TEXT_FIELDS = ['nom_commercial', 'marketing', 'avantages'];
export function platText(p, field, l = lang) {
  if (!p) return '';
  if (l === 'fr') return p[field] || '';
  return p.traductions?.[l]?.[field] || '';
}
export function platTitle(p) {
  return platText(p, 'nom_commercial') || (lang !== 'fr' && p.nom_commercial) || p.nom;
}
