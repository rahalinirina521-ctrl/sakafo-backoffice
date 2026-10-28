// Kajy nutritionnelle rehetra. Ny sanda ao amin'ny ingrédient dia isaky ny 100 g.

export const NUTR = ['kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium'];
export const NUTR_LABEL = {
  kcal: 'Kcal', proteines: 'Protéines (g)', glucides: 'Glucides (g)', lipides: 'Lipides (g)',
  fibres: 'Fibres (g)', sucres: 'Sucres (g)', sodium: 'Sodium (mg)',
};
export const FOTOANA = ['Maraina', 'Atoandro', 'Hariva', 'Goûter'];
export const SLOT_KEYS = { Maraina: 'maraina', Atoandro: 'atoandro', Hariva: 'hariva', 'Goûter': 'gouter' };
// Zaraina amin'ny sakafo isan'andro ny kcal tanjona
export const SLOT_SHARE = { Maraina: 0.25, Atoandro: 0.35, Hariva: 0.30, 'Goûter': 0.10 };

const num = (v) => (v === null || v === undefined || v === '' || isNaN(+v) ? null : +v);

export function isComplete(ing) {
  return !!ing && ['kcal', 'proteines', 'glucides', 'lipides'].every((k) => num(ing[k]) !== null);
}

// Unités azo ampiasaina ao amin'ny composition
export const UNITES = ['g', 'ml', 'isa', 'cas', 'cac'];
const ML_PAR_UNITE = { ml: 1, cas: 15, cac: 5 };

// Mamadika ny habetsahana ho grammes. null raha tsy fantatra (ohatra: isa nefa tsy misy poids_piece)
export function lineGrams(line, ing) {
  const unite = line.unite || 'g';
  const q = num(line.quantite ?? line.grammes);
  if (q === null) return 0;
  if (unite === 'g') return q;
  if (ML_PAR_UNITE[unite]) return q * ML_PAR_UNITE[unite] * (num(ing?.densite) || 1);
  if (unite === 'isa') return ing && num(ing.poids_piece) ? q * num(ing.poids_piece) : null;
  return q;
}

export function needsPieceWeight(line, ing) {
  return (line.unite || 'g') === 'isa' && !(ing && num(ing.poids_piece));
}

// Ho an'ny prompt IA (frantsay foana)
export function qtyLabel(line) {
  const u = line.unite || 'g';
  const q = num(line.quantite ?? line.grammes);
  if (q === null) return '?';
  const lab = { isa: q > 1 ? 'pièces' : 'pièce', cas: 'c. à soupe', cac: 'c. à café' }[u] || u;
  return `${q} ${lab}`;
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

export function menuTotals(menu, plats, composition, ingMap) {
  const t = { kcal: 0, proteines: 0, glucides: 0, lipides: 0, cg: 0, cout: 0, missing: 0 };
  for (const slot of Object.values(SLOT_KEYS)) {
    const id = menu[slot];
    if (!id) continue;
    const p = platTotals(id, composition, ingMap);
    for (const k of Object.keys(t)) t[k] += p[k] || 0;
  }
  return t;
}

export function menuStatus(menu, totals, category) {
  if (!category || !num(category.kcal_cible)) return { label: 'Tsy misy tanjona', tone: 'muted', ecart: null };
  const ecart = (totals.kcal - category.kcal_cible) / category.kcal_cible;
  if (num(category.cg_max) && totals.cg > num(category.cg_max)) return { label: 'CG ambony loatra', tone: 'bad', ecart };
  if (Math.abs(ecart) <= (num(category.tolerance) ?? 0.1)) return { label: 'OK', tone: 'ok', ecart };
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
