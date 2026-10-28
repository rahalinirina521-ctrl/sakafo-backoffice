// Kajy nutritionnelle rehetra. Ny sanda ao amin'ny ingrédient dia isaky ny 100 g.

export const NUTR = ['kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium'];
export const NUTR_LABEL = {
  kcal: 'Kcal', proteines: 'Protéines (g)', glucides: 'Glucides (g)', lipides: 'Lipides (g)',
  fibres: 'Fibres (g)', sucres: 'Sucres (g)', sodium: 'Sodium (mg)',
};
export const FOTOANA = ['Maraina', 'Collation', 'Atoandro', 'Goûter', 'Hariva'];
export const SLOT_KEYS = { Maraina: 'maraina', Atoandro: 'atoandro', Hariva: 'hariva', 'Goûter': 'gouter' };
// Zaraina amin'ny sakafo isan'andro ny kcal tanjona
export const SLOT_SHARE = { Maraina: 0.25, Collation: 0.10, Atoandro: 0.35, 'Goûter': 0.10, Hariva: 0.30 };

const num = (v) => (v === null || v === undefined || v === '' || isNaN(+v) ? null : +v);

export function isComplete(ing) {
  return !!ing && ['kcal', 'proteines', 'glucides', 'lipides'].every((k) => num(ing[k]) !== null);
}

// Unités azo ampiasaina ao amin'ny composition (+ izay nampidirin'ny mpampiasa)
export const UNITES = ['g', 'kg', 'ml', 'cl', 'l', 'isa', 'cas', 'cac', 'tasse'];
const ML_PAR_UNITE = { ml: 1, cl: 10, l: 1000, cas: 15, cac: 5, tasse: 250 };
const G_PAR_UNITE = { g: 1, kg: 1000 };
// Unités custom: { valeur: { base: 'g'|'ml', facteur } }
let CUSTOM_UNITS = {};
export function registerCustomUnits(options) {
  CUSTOM_UNITS = {};
  for (const o of options || []) if (o.type === 'unite' && num(o.facteur)) CUSTOM_UNITS[o.valeur] = { base: o.base === 'ml' ? 'ml' : 'g', facteur: num(o.facteur) };
}
export const customUnit = (u) => CUSTOM_UNITS[u] || null;

// Safidy: lisitra fototra + izay nampidirina (options)
export function optionList(type, defaults, options) {
  const extra = (options || []).filter((o) => o.type === type).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.valeur.localeCompare(b.valeur)).map((o) => o.valeur);
  return [...defaults, ...extra.filter((v) => !defaults.includes(v))];
}

// Mamadika ny habetsahana ho grammes. null raha tsy fantatra (ohatra: isa nefa tsy misy poids_piece)
export function lineGrams(line, ing) {
  const unite = line.unite || 'g';
  const q = num(line.quantite ?? line.grammes);
  if (q === null) return 0;
  if (G_PAR_UNITE[unite]) return q * G_PAR_UNITE[unite];
  if (ML_PAR_UNITE[unite]) return q * ML_PAR_UNITE[unite] * (num(ing?.densite) || 1);
  if (unite === 'isa') return ing && num(ing.poids_piece) ? q * num(ing.poids_piece) : null;
  const cu = CUSTOM_UNITS[unite];
  if (cu) return q * cu.facteur * (cu.base === 'ml' ? (num(ing?.densite) || 1) : 1);
  return null;
}

export function needsPieceWeight(line, ing) {
  return (line.unite || 'g') === 'isa' && !(ing && num(ing.poids_piece));
}

// Ho an'ny prompt IA (frantsay foana)
export function qtyLabel(line) {
  const u = line.unite || 'g';
  const q = num(line.quantite ?? line.grammes);
  if (q === null) return '?';
  const lab = { isa: q > 1 ? 'pièces' : 'pièce', cas: 'c. à soupe', cac: 'c. à café', l: 'L', tasse: q > 1 ? 'tasses' : 'tasse' }[u] || u;
  const cu = CUSTOM_UNITS[u];
  return `${q} ${lab}${cu ? ` (1 ${u} = ${cu.facteur} ${cu.base})` : ''}`;
}

export function lineValues(line, ing) {
  const gr = lineGrams(line, ing);
  const g = gr || 0;
  const f = g / 100;
  const out = { grammes: g, grammesInconnus: gr === null, missing: !isComplete(ing) || gr === null };
  for (const k of NUTR) out[k] = ing && num(ing[k]) !== null ? f * num(ing[k]) : 0;
  out.cg = ing && num(ing.ig) !== null ? (num(ing.ig) * out.glucides) / 100 : 0;
  out.cout = ing && num(ing.prix_kg) !== null ? (g / 1000) * num(ing.prix_kg) : 0;
  return out;
}

export function sumLines(lines, ingMap) {
  const t = { grammes: 0, cg: 0, cout: 0, missing: 0, prixManquant: 0 };
  for (const k of NUTR) t[k] = 0;
  for (const l of lines) {
    const ing = ingMap.get(l.ingredient_id);
    const v = lineValues(l, ing);
    t.grammes += v.grammes;
    for (const k of NUTR) t[k] += v[k];
    t.cg += v.cg;
    t.cout += v.cout;
    if (v.missing) t.missing += 1;
    if (!ing || num(ing.prix_kg) === null) t.prixManquant += 1;
  }
  t.protPct = t.kcal > 0 ? (t.proteines * 4) / t.kcal : 0;
  t.glucPct = t.kcal > 0 ? (t.glucides * 4) / t.kcal : 0;
  t.lipPct = t.kcal > 0 ? (t.lipides * 9) / t.kcal : 0;
  return t;
}

export function platTotals(platId, composition, ingMap) {
  return sumLines(composition.filter((c) => c.plat_id === platId), ingMap);
}

// Kcal tanjona ho an'ny sakafo iray araka ny fotoana sy ny sokajy
export function slotTarget(category, fotoana) {
  if (!category || !num(category.kcal_cible)) return null;
  const share = SLOT_SHARE[fotoana];
  return share ? num(category.kcal_cible) * share : null;
}

export function fitStatus(kcal, target, tolerance) {
  if (!target) return { label: '—', tone: 'muted', ecart: null };
  const tol = num(tolerance) ?? 0.1;
  const ecart = (kcal - target) / target;
  if (Math.abs(ecart) <= tol) return { label: 'Mety', tone: 'ok', ecart };
  return { label: ecart > 0 ? 'Be loatra' : 'Kely loatra', tone: 'warn', ecart };
}

// Fanamarinana ingrédient: kcal ≈ 4P + 4G + 9L
export function kcalCheck(ing) {
  if (!isComplete(ing)) return null;
  const est = 4 * num(ing.proteines) + 4 * num(ing.glucides) + 9 * num(ing.lipides);
  const k = num(ing.kcal);
  if (k === 0 && est < 5) return { ok: true, est };
  const diff = k > 0 ? Math.abs(est - k) / k : 1;
  return { ok: diff <= 0.15, est, diff };
}

// Ny sakafo ao anatin'ny menu (endrika vaovao: repas[]; endrika taloha: tsanganana 4)
export function menuRepas(menu) {
  if (Array.isArray(menu?.repas) && menu.repas.length) return menu.repas;
  const out = [];
  for (const [f, k] of [['Maraina', 'maraina'], ['Atoandro', 'atoandro'], ['Goûter', 'gouter'], ['Hariva', 'hariva']]) if (menu?.[k]) out.push({ id: k, fotoana: f, plat_id: menu[k] });
  return out;
}

export function menuTotals(menu, plats, composition, ingMap) {
  const t = { kcal: 0, proteines: 0, glucides: 0, lipides: 0, cg: 0, cout: 0, missing: 0, prix: 0, prixManquant: 0, nb: 0 };
  for (const r of menuRepas(menu)) {
    if (!r.plat_id) continue;
    const plat = plats.find((p) => p.id === r.plat_id);
    if (!plat) continue;
    const p = platTotals(r.plat_id, composition, ingMap);
    for (const k of ['kcal', 'proteines', 'glucides', 'lipides', 'cg', 'cout', 'missing']) t[k] += p[k] || 0;
    if (num(plat.prix_vente)) t.prix += num(plat.prix_vente); else t.prixManquant += 1;
    t.nb += 1;
  }
  return t;
}

export function menuStatus(menu, totals, category, kcalCible = null) {
  const cible = num(kcalCible) || num(category?.kcal_cible);
  if (!cible) return { label: 'Tsy misy tanjona', tone: 'muted', ecart: null };
  const ecart = (totals.kcal - cible) / cible;
  if (num(category?.cg_max) && totals.cg > num(category.cg_max)) return { label: 'CG ambony loatra', tone: 'bad', ecart };
  if (Math.abs(ecart) <= (num(category?.tolerance) ?? 0.1)) return { label: 'OK', tone: 'ok', ecart };
  return { label: 'Amboary ny kcal', tone: 'warn', ecart };
}

export function nextId(prefix, rows, pad = 4) {
  let max = 0;
  const re = new RegExp('^' + prefix + '(\\d+)$');
  for (const r of rows) {
    const m = re.exec(r.id || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return prefix + String(max + 1).padStart(pad, '0');
}

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function fmt(v, dec = 0) {
  if (v === null || v === undefined || v === '' || isNaN(+v)) return '—';
  return (+v).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function pct(v, dec = 0) {
  if (v === null || v === undefined || isNaN(+v)) return '—';
  return (v * 100).toFixed(dec) + ' %';
}
export const toNum = num;

// Daty (ISO yyyy-mm-dd, ora eo an-toerana)
export function isoDate(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
export function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d); }
export function mondayOf(iso) { const d = new Date(iso + 'T12:00:00'); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return isoDate(d); }

// Kajy kcal ilain'ny client (Mifflin-St Jeor)
export const ACTIVITES = [['sedentaire', 1.2], ['leger', 1.375], ['modere', 1.55], ['intense', 1.725]];
export function besoinKcal({ sexe, age, poids, taille, activite }, ajustement = 0) {
  if (!num(age) || !num(poids) || !num(taille)) return null;
  const bmr = 10 * num(poids) + 6.25 * num(taille) - 5 * num(age) + (sexe === 'H' ? 5 : -161);
  const f = (ACTIVITES.find((a) => a[0] === activite) || ACTIVITES[0])[1];
  return Math.round((bmr * f * (1 + ajustement)) / 10) * 10;
}
