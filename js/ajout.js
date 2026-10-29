// Ajout de plats en lot par l'IA (gratuit) : prompt + Excel à remplir dans ChatGPT / Claude.ai, puis import.
import { xlsxLib, sheetFromRows, readSheet, extractXlsxImage } from './excel.js?v=202610290520';
import { NUTR, sumLines, uid, toNum } from './calc.js?v=202610290520';
import { normalizePlatTexts, extractJson, TEXT_LANGS, PLAT_TEXT_FIELDS } from './prompts.js?v=202610290520';

const norm = (s) => String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ING_CATS = 'Féculent / Protéine / Légumineuse / Légume / Fruit / Boisson / Laitier / Matière grasse / Condiment';
const FOT_FR = { Maraina: 'Petit-déjeuner', Collation: 'Collation du matin', Atoandro: 'Déjeuner', 'Goûter': 'Goûter', Hariva: 'Dîner' };
const FOT_FROM = Object.fromEntries(Object.entries(FOT_FR).map(([k, v]) => [norm(v), k]));

export const PLAT_COLS = ['ref', 'nom', 'moment', 'objectifs', 'nb', ...TEXT_LANGS.flatMap((l) => PLAT_TEXT_FIELDS.map((f) => `${l}_${f}`)), 'allergenes', 'regimes', 'photo_en'];
export const COMPO_COLS = ['plat_ref', 'ingredient_id', 'ingredient', 'quantite', 'unite', 'nb'];
export const NEW_ING_COLS = ['nom_fr', 'nom_mg', 'nom_en', 'categorie', 'etat', 'kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium', 'ig', 'poids_piece', 'densite', 'source'];

export const parseNames = (txt) => String(txt || '').split(/\n|;/).map((x) => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);

// ---------- Prompt ----------
export function promptAjout(opts, data) {
  const cat = data.categories.find((c) => c.id === opts.categorie);
  const names = parseNames(opts.noms);
  const ingList = data.ingredients.map((i) => `${i.id} | ${i.nom_fr || i.nom_mg}${i.nom_mg && i.nom_mg !== i.nom_fr ? ' (' + i.nom_mg + ')' : ''}`).join('\n');
  const existing = data.plats.map((p) => p.nom_commercial || p.nom).join(' ; ') || '(aucun)';
  const moment = FOT_FR[opts.fotoana] || opts.fotoana;
  const what = opts.mode === 'noms'
    ? `PLATS À DOCUMENTER (${names.length}) — un plat par nom, garde ces noms comme « nom » :\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n') || '(aucun nom fourni)'}\n${opts.fotoana ? `Moment par défaut : ${moment} (corrige si un plat est clairement d'un autre moment).` : 'Moment : choisis le bon moment pour chaque plat.'}`
    : `PROPOSE ${opts.isa} NOUVEAUX PLATS :\n- Moment : ${moment || 'au choix'}\n- Cible par portion : environ ${opts.kcal || '?'} kcal (± 10 %)${opts.prot ? ', protéines au moins ' + opts.prot + ' g' : ''}\n- Budget maximum par portion : ${opts.budget ? opts.budget + ' Ar' : 'raisonnable pour Madagascar'}\n- Style : ${opts.style || '60 % plats malgaches revisités, 40 % plats du monde adaptés aux produits locaux'}\n- Ne propose PAS ces plats qui existent déjà : ${existing}`;

  return `Tu es nutritionniste diplômé, chef cuisinier et expert en marketing culinaire, pour un service de repas sur mesure livrés à Antananarivo (Madagascar).

${what}

OBJECTIF CLIENT : ${cat?.nom || 'Normal'}${cat?.regles ? ' — règles : ' + cat.regles : ''}
${opts.remarques ? 'REMARQUES : ' + opts.remarques + '\n' : ''}Ingrédients faciles à trouver sur les marchés d'Antananarivo. Portions réalistes pour 1 personne.

INGRÉDIENTS DÉJÀ DANS MA BASE (utilise ces ID en priorité dans « ingredient_id ») :
${ingList}

REMPLIS LE FICHIER EXCEL JOINT (« ajout_plats.xlsx ») :
1. Onglet "Plats" — une ligne par plat : ref (P1, P2…), nom, moment (Petit-déjeuner / Collation du matin / Déjeuner / Goûter / Dîner), objectifs, nb (points forts : sans sel, fait maison…), puis les textes pour le CLIENT, courts et convaincants, en français (fr_), anglais (en_) et malgache courant d'Antananarivo (mg_) :
   - nom_commercial : nom appétissant (5 mots max) ;
   - marketing : 2 phrases max qui donnent envie (goût + bénéfice pour l'objectif) ;
   - avantages : exactement 3 points courts, un par ligne, commençant par « • ».
   Puis allergenes (parmi : gluten, crustacés, œuf, poisson, arachide, soja, lait, fruits à coque, céleri, moutarde, sésame, sulfites, lupin, mollusques ; séparés par ;), regimes (2 ou 3 étiquettes vraies : riche en protéines, riche en fibres, faible IG, sans sucre ajouté, sans gluten, végétarien…), photo_en (description visuelle en anglais pour une photo).
2. Onglet "Composition" — une ligne par ingrédient : plat_ref, ingredient_id (ID de ma base si l'ingrédient existe, sinon vide), ingredient (nom en français), quantite, unite (g, ml, isa = pièce, cas = c. à soupe, cac = c. à café), nb (ex. sans sel, grillé sans huile). Quantités telles que servies (cuit si cuit).
3. Onglet "Nouveaux_ingredients" — seulement les ingrédients ABSENTS de ma base : valeurs pour 100 g dans l'état servi (USDA FoodData Central ou Ciqual ; source exacte ; null si tu n'es pas sûr, n'invente jamais), poids_piece (g d'une pièce si utilisé en « isa »), densite (g/ml pour un liquide), categorie (${ING_CATS}), etat (Masaka = cuit / Manta = cru / Vonona = prêt).
Ne change pas les en-têtes. Ne calcule pas les calories totales : mon logiciel les calcule. Aucune promesse médicale.

Renvoie-moi le fichier Excel complété.
Si tu ne peux pas créer de fichier, réponds avec ce JSON (et rien d'autre) :
\`\`\`json
{ "plats": [ { "ref": "P1", "nom": "", "moment": "", "nb": "", "photo_en": "",
    "fr": { "nom_commercial": "", "marketing": "", "avantages": "• …\\n• …\\n• …" }, "en": { … }, "mg": { … },
    "details": { "allergenes": [], "regimes": [] },
    "composition": [ { "ingredient_id": "I012", "ingredient": "Poulet", "quantite": 120, "unite": "g", "nb": "" } ] } ],
  "nouveaux_ingredients": [ { "nom_fr": "", "nom_mg": "", "nom_en": "", "categorie": "", "etat": "", "kcal": 0, "proteines": 0, "glucides": 0, "lipides": 0, "fibres": 0, "sucres": 0, "sodium": 0, "ig": 0, "poids_piece": null, "densite": null, "source": "" } ] }
\`\`\``;
}

// ---------- Excel à remplir ----------
export async function exportAjout(opts, data) {
  const X = await xlsxLib();
  const wb = X.utils.book_new();
  const cat = data.categories.find((c) => c.id === opts.categorie);
  const guide = [
    ['AJOUT DE PLATS — à remplir par ChatGPT / Claude'],
    [''],
    ['Onglet "Plats" : une ligne par plat (textes FR / EN / MG, allergènes, étiquettes).'],
    ['Onglet "Composition" : une ligne par ingrédient de chaque plat (plat_ref = ref du plat).'],
    ['Onglet "Nouveaux_ingredients" : uniquement les ingrédients absents de "Ingredients_existants", valeurs pour 100 g.'],
    ['Onglet "Ingredients_existants" : liste de référence, ne pas modifier.'],
    ['Ne pas changer les en-têtes (ligne 1).'],
  ];
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(guide), 'Torolalana');
  const names = opts.mode === 'noms' ? parseNames(opts.noms) : [];
  const n = opts.mode === 'noms' ? names.length : Math.max(1, toNum(opts.isa) || 5);
  const rows = Array.from({ length: n }, (_, i) => ({ ref: 'P' + (i + 1), nom: names[i] || null, moment: FOT_FR[opts.fotoana] || opts.fotoana || null, objectifs: cat?.nom || null }));
  X.utils.book_append_sheet(wb, sheetFromRows(X, PLAT_COLS, rows), 'Plats');
  X.utils.book_append_sheet(wb, sheetFromRows(X, COMPO_COLS, []), 'Composition');
  X.utils.book_append_sheet(wb, sheetFromRows(X, NEW_ING_COLS, []), 'Nouveaux_ingredients');
  X.utils.book_append_sheet(wb, sheetFromRows(X, ['id', 'nom_fr', 'nom_mg'], data.ingredients.map((i) => ({ id: i.id, nom_fr: i.nom_fr, nom_mg: i.nom_mg }))), 'Ingredients_existants');
  X.writeFile(wb, 'ajout_plats.xlsx');
}

// ---------- Lecture (Excel ou JSON) → structure commune ----------
export async function readAjoutExcel(file) {
  const X = await xlsxLib();
  const buf = await file.arrayBuffer();
  const wb = X.read(buf, { type: 'array' });
  const find = (name) => wb.Sheets[wb.SheetNames.find((s) => norm(s) === norm(name))];
  const plats = readSheet(X, find('Plats'), 'ref').concat(readSheet(X, find('Plats'), 'nom').filter((r) => !r.ref));
  const compo = readSheet(X, find('Composition'), 'plat_ref');
  const nouveaux = readSheet(X, find('Nouveaux_ingredients'), 'nom_fr').concat(readSheet(X, find('Nouveaux_ingredients'), 'nom_mg').filter((r) => !r.nom_fr));
  if (!plats.length) throw new Error('Onglet "Plats" vide ou introuvable');
  const image = await extractXlsxImage(buf);
  return {
    plats: plats.map((p, i) => ({ ...p, ref: p.ref || 'P' + (i + 1), composition: compo.filter((c) => [String(p.ref || 'P' + (i + 1)), norm(p.nom)].includes(String(c.plat_ref)) || (p.nom && norm(c.plat_ref) === norm(p.nom))) })),
    nouveaux,
    image,
  };
}
export function readAjoutJson(text) {
  const j = extractJson(text);
  const plats = (j.plats || j.propositions || []).map((p, i) => ({ ...p, ref: p.ref || 'P' + (i + 1), composition: (p.composition || []).map((c) => ({ ...c, ingredient: c.ingredient || c.nouvel_ingredient?.nom_fr, nb: c.nb || c.note })) }));
  const nouveaux = [...(j.nouveaux_ingredients || [])];
  for (const p of j.plats || j.propositions || []) for (const c of p.composition || []) if (c.nouvel_ingredient) nouveaux.push(c.nouvel_ingredient);
  if (!plats.length) throw new Error('"plats" ?');
  return { plats, nouveaux, image: null };
}

const NEW_ING = { nom_fr: null, nom_mg: '', nom_en: null, categorie: null, etat: null, kcal: null, proteines: null, glucides: null, lipides: null, fibres: null, sucres: null, sodium: null, ig: null, poids_piece: null, densite: null, prix_kg: null, source: null, a_verifier: true };
const UNITS = ['g', 'kg', 'ml', 'cl', 'l', 'isa', 'cas', 'cac', 'tasse'];
const unitOf = (u) => {
  const x = norm(u);
  if (!x) return 'g';
  if (UNITS.includes(x)) return x;
  if (/piece|unite|pc|isa/.test(x)) return 'isa';
  if (/soupe|tbsp/.test(x)) return 'cas';
  if (/cafe|tsp/.test(x)) return 'cac';
  if (/litre/.test(x)) return 'l';
  return 'g';
};
const momentOf = (m, fallback) => {
  if (!m) return fallback;
  if (FOT_FR[m]) return m;
  return FOT_FROM[norm(m)] || (/petit|matin/.test(norm(m)) && !/collation/.test(norm(m)) ? 'Maraina' : /dejeuner|midi/.test(norm(m)) ? 'Atoandro' : /diner|soir/.test(norm(m)) ? 'Hariva' : /gouter|collation/.test(norm(m)) ? 'Goûter' : m);
};

// Mitady ingrédient: anarana mitovy, na singulier/pluriel, na anarana manomboka amin'izany (Œuf → Œuf entier)
function findByName(byName, name) {
  const n = norm(name);
  if (!n) return null;
  if (byName.has(n)) return byName.get(n);
  const sing = n.split(' ').map((w) => w.replace(/(s|x)$/, '')).join(' ');
  for (const [k, id] of byName) if (k.split(' ').map((w) => w.replace(/(s|x)$/, '')).join(' ') === sing) return id;
  for (const [k, id] of byName) if (k.startsWith(n + ' ')) return id;
  return null;
}

// Mamadika ho "propositions" azo jerena sy ampidirina
export function buildProps(raw, data, opts) {
  const ingMap = new Map(data.ingredients.map((i) => [i.id, i]));
  const byName = new Map();
  for (const i of data.ingredients) for (const k of [i.nom_fr, i.nom_mg, i.nom_en]) if (k) byName.set(norm(k), i.id);
  const nouveaux = (raw.nouveaux || []).map((n) => {
    const o = { ...NEW_ING, ...n, nom_mg: n.nom_mg || n.nom_fr || '?' };
    for (const k of [...NUTR, 'ig', 'poids_piece', 'densite']) o[k] = toNum(o[k]);
    return o;
  });
  const newByName = new Map();
  for (const n of nouveaux) for (const k of [n.nom_fr, n.nom_mg, n.nom_en]) if (k) newByName.set(norm(k), n);

  return raw.plats.map((p) => {
    const temp = new Map(ingMap);
    const lines = (p.composition || []).map((c, i) => {
      let id = c.ingredient_id && ingMap.has(String(c.ingredient_id)) ? String(c.ingredient_id) : findByName(byName, c.ingredient);
      let nouvel = null;
      if (!id) {
        nouvel = newByName.get(norm(c.ingredient)) || { ...NEW_ING, nom_fr: c.ingredient || '?', nom_mg: c.ingredient || '?' };
        id = 'NEW:' + norm(nouvel.nom_fr || nouvel.nom_mg);
        temp.set(id, nouvel);
      }
      return { id: uid(), ingredient_id: id, quantite: toNum(c.quantite) || 0, unite: unitOf(c.unite), note: c.nb || '', nouvel, ordre: i };
    });
    const texts = normalizePlatTexts(p);
    return {
      ref: p.ref, nom: p.nom || texts.texts.fr.nom_commercial || p.ref, fotoana: momentOf(p.moment || p.fotoana, opts.fotoana || 'Atoandro'),
      nb: p.nb || '', texts, lines, totals: sumLines(lines, temp), selected: true,
    };
  });
}
