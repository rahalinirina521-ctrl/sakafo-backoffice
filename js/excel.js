// Export / import Excel (SheetJS, ampidirina rehefa ilaina ihany).
import { ING_FIELDS, PLAT_SHEET_FIELDS, PLAT_TEXT_FIELDS, TEXT_LANGS, DETAIL_FIELDS, ingredientsToFill } from './prompts.js';
import { NUTR, sumLines, lineGrams } from './calc.js';

let XLSX = null;
async function lib() {
  if (!XLSX) XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  return XLSX;
}

function sheetFromRows(X, header, rows) {
  const aoa = [header, ...rows.map((r) => header.map((h) => (r[h] === undefined ? null : r[h])))];
  const ws = X.utils.aoa_to_sheet(aoa);
  ws['!cols'] = header.map((h) => ({ wch: Math.max(10, Math.min(45, h.length + 4)) }));
  return ws;
}

// ---------- Fichier "hameno" ho an'ny sakafo iray ----------
export async function exportHameno(plat, lines, ingMap) {
  const X = await lib();
  const wb = X.utils.book_new();
  const guide = [
    ['FICHIER À COMPLÉTER — ' + plat.id + ' — ' + plat.nom],
    [''],
    ['1. Onglet "Plat" : remplir les cellules vides : photo_en ; fr_..., en_..., mg_... (nom_commercial, marketing, avantages = 3 points) ; allergenes et regimes (séparés par ;).'],
    ['2. Onglet "Ingredients" : valeurs nutritionnelles POUR 100 g, noms fr/en/mg, poids_piece (g d\'une pièce), densite (g/ml pour un liquide) et la source (USDA / Ciqual).'],
    ['3. Onglet "Composition" : information seulement (avec les NB), ne pas modifier.'],
    ['Ne pas changer les ID ni les en-têtes (ligne 1). Ne pas calculer les calories totales.'],
  ];
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(guide), 'Torolalana');
  const platRow = { id: plat.id, nom: plat.nom, photo_en: plat.nom_en || null };
  for (const l of TEXT_LANGS) for (const f of PLAT_TEXT_FIELDS) platRow[`${l}_${f}`] = (l === 'fr' ? plat[f] : plat.traductions?.[l]?.[f]) || null;
  for (const f of DETAIL_FIELDS) { const v = plat.details?.[f]; platRow[f] = Array.isArray(v) ? (v.length ? v.join('; ') : null) : (v ?? null); }
  X.utils.book_append_sheet(wb, sheetFromRows(X, PLAT_SHEET_FIELDS, [platRow]), 'Plat');
  const toFill = ingredientsToFill(lines, ingMap).map((x) => x.ing);
  X.utils.book_append_sheet(wb, sheetFromRows(X, ING_FIELDS, toFill), 'Ingredients');
  const comp = lines.map((l) => {
    const ing = ingMap.get(l.ingredient_id);
    return { ingredient_id: l.ingredient_id, nom: ing?.nom_fr || ing?.nom_mg || '', quantite: l.quantite ?? l.grammes, unite: l.unite || 'g', grammes_estimes: lineGrams(l, ing), nb: l.note || null };
  });
  X.utils.book_append_sheet(wb, sheetFromRows(X, ['ingredient_id', 'nom', 'quantite', 'unite', 'grammes_estimes', 'nb'], comp), 'Composition');
  if (plat.nb) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['NB / points forts du plat'], [plat.nb]]), 'NB');
  X.writeFile(wb, `hameno_${plat.id}.xlsx`);
}

function normHeader(h) {
  return String(h || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s*\/\s*100\s*g/g, '').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
const NUM_FIELDS = new Set(['kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium', 'ig', 'prix_kg', 'grammes', 'poids_piece', 'densite', 'quantite']);

function readSheet(X, ws) {
  if (!ws) return [];
  const rows = X.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!rows.length) return [];
  const header = rows[0].map(normHeader);
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => {
      if (!h) return;
      let v = r[i];
      if (typeof v === 'string') v = v.trim();
      if (v === '') v = null;
      if (NUM_FIELDS.has(h) && v !== null) {
        const n = parseFloat(String(v).replace(',', '.'));
        v = isNaN(n) ? null : n;
      }
      o[h] = v;
    });
    return o;
  }).filter((o) => o.id);
}

// Mamerina { plat, ingredients } mitovy amin'ny JSON
export async function importHameno(file) {
  const X = await lib();
  const buf = await file.arrayBuffer();
  const wb = X.read(buf, { type: 'array' });
  const find = (name) => wb.Sheets[wb.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase())];
  const plats = readSheet(X, find('Plat'));
  const ingredients = readSheet(X, find('Ingredients'));
  if (!plats.length && !ingredients.length) throw new Error('Onglets "Plat" / "Ingredients" introuvables');
  return { plat: plats[0] || null, ingredients };
}

// ---------- Backup feno ----------
export async function exportAll(data, ingMap) {
  const X = await lib();
  const wb = X.utils.book_new();
  const platRows = data.plats.map((p) => {
    const t = sumLines(data.composition.filter((c) => c.plat_id === p.id), ingMap);
    const o = { ...p, categories: (p.categories || []).join(';'), traductions: JSON.stringify(p.traductions || {}), details: JSON.stringify(p.details || {}) };
    for (const k of NUTR) o[k] = Math.round(t[k] * 10) / 10;
    o.charge_glycemique = Math.round(t.cg * 10) / 10;
    o.cout_ar = Math.round(t.cout);
    return o;
  });
  const add = (name, rows) => {
    const header = rows.length ? Object.keys(rows[0]) : ['id'];
    X.utils.book_append_sheet(wb, sheetFromRows(X, header, rows), name);
  };
  add('Plats', platRows);
  add('Composition', data.composition);
  add('Ingredients', data.ingredients);
  add('Menus', data.menus);
  add('Categories', data.categories);
  const d = new Date().toISOString().slice(0, 10);
  X.writeFile(wb, `backup_sakafo_${d}.xlsx`);
}
