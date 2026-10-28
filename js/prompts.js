// Prompts hadika ao amin'ny ChatGPT na Claude (frantsay foana, satria tsara kokoa ny valin'ny IA).
// Ny IA dia manoratra ny texte amin'ny teny telo: fr, en, mg.
import { isComplete, fmt, qtyLabel, needsPieceWeight, lineGrams } from './calc.js';
import { PLAT_TEXT_FIELDS } from './i18n.js';

export { PLAT_TEXT_FIELDS };
export const ING_FIELDS = ['id', 'nom_mg', 'nom_fr', 'nom_en', 'categorie', 'etat', 'kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium', 'ig', 'poids_piece', 'densite', 'source'];
export const TEXT_LANGS = ['fr', 'en', 'mg'];
// Onglet "Plat" ao amin'ny Excel: fr_marketing, en_marketing, mg_marketing...
export const PLAT_SHEET_FIELDS = ['id', 'nom', 'photo_en', ...TEXT_LANGS.flatMap((l) => PLAT_TEXT_FIELDS.map((f) => `${l}_${f}`))];
const ING_CATS = 'Féculent / Protéine / Légumineuse / Légume / Fruit / Boisson / Laitier / Matière grasse / Condiment';

function catNamesFr(plat, categories) {
  return (plat.categories || []).map((id) => categories.find((c) => c.id === id)?.nom || id).join(', ') || 'Normal';
}

// Ingrédients tsy maintsy fenoina: tsy misy valeur, na ampiasaina amin'ny "isa" nefa tsy fantatra ny lanjany
export function ingredientsToFill(lines, ingMap) {
  const out = new Map();
  for (const l of lines) {
    const ing = ingMap.get(l.ingredient_id);
    if (!ing) continue;
    const needPiece = needsPieceWeight(l, ing);
    if (!isComplete(ing) || needPiece) {
      const cur = out.get(ing.id) || { ing, needPiece: false };
      cur.needPiece = cur.needPiece || needPiece;
      out.set(ing.id, cur);
    }
  }
  return [...out.values()];
}

const nameFr = (i) => (i ? (i.nom_fr || i.nom_mg) + (i.nom_fr && i.nom_mg && i.nom_fr !== i.nom_mg ? ` (${i.nom_mg})` : '') : '?');

const TEXTS_SPEC = `   - "nom_commercial" : un nom court et appétissant pour la vente (6 mots maximum) ;
   - "marketing" : un résumé marketing de 2 à 3 phrases qui donne envie de choisir ce menu : le goût, ce que le client y gagne pour son objectif, et ce qui le rend spécial (utilise les NB / points forts : sans sel, sans sucre ajouté, fait maison…). Ton chaleureux et positif, sans exagération ;
   - "description" : 1 phrase qui décrit le plat ;
   - "avantages" : les bénéfices nutritionnels (1 à 2 phrases) ;
   - "effets" : l'effet attendu sur l'objectif du client (1 à 2 phrases).
   Écris ces 5 textes en TROIS langues : "fr" (français), "en" (anglais), "mg" (malgache courant, naturel, comme on parle à Antananarivo).
   Aucune promesse médicale (interdit : "guérit", "fait perdre X kg"). Ne cite pas de chiffres de calories : mon logiciel les calcule.`;

const TEXTS_JSON = `"fr": { "nom_commercial": "", "marketing": "", "description": "", "avantages": "", "effets": "" },
    "en": { "nom_commercial": "", "marketing": "", "description": "", "avantages": "", "effets": "" },
    "mg": { "nom_commercial": "", "marketing": "", "description": "", "avantages": "", "effets": "" }`;

// ---------- Prompt 1: hameno ny données momba ny sakafo iray ----------
export function promptHameno(plat, lines, ingMap, categories) {
  const toFill = ingredientsToFill(lines, ingMap);
  const compo = lines.map((l) => {
    const ing = ingMap.get(l.ingredient_id);
    const g = lineGrams(l, ing);
    const conv = (l.unite || 'g') !== 'g' && g ? ` (≈ ${fmt(g)} g)` : '';
    return `- ${l.ingredient_id} | ${nameFr(ing)} | ${qtyLabel(l)}${conv}${l.note ? ' | NB : ' + l.note : ''}`;
  }).join('\n');
  const fill = toFill.length
    ? toFill.map(({ ing: i, needPiece }) => `- ${i.id} | ${nameFr(i)}${i.etat ? ' | état : ' + i.etat : ''}${!isComplete(i) ? ' | valeurs nutritionnelles manquantes' : ''}${needPiece ? ' | POIDS D\'UNE PIÈCE manquant (partie comestible, en g)' : ''}`).join('\n')
    : '(aucun : toutes les valeurs sont déjà connues, laisse "ingredients" vide)';

  return `Tu es nutritionniste diplômé et expert en marketing culinaire. Tu travailles pour un service de repas sur mesure livrés à Antananarivo (Madagascar).

PLAT À DOCUMENTER
- ID : ${plat.id}
- Nom interne : ${plat.nom}
- Moment : ${plat.fotoana || '?'}
- Objectif(s) du client : ${catNamesFr(plat, categories)}
- Composition (quantités telles que servies) :
${compo || '(vide)'}
${plat.nb ? `- NB / points forts du plat : ${plat.nb}\n` : ''}
INGRÉDIENTS À COMPLÉTER :
${fill}

TA MISSION
1. Pour chaque ingrédient à compléter :
   - valeurs pour 100 g de partie comestible, dans l'état où il est servi (tiens compte des NB, ex. café sans sucre = café nature) : kcal, protéines, glucides, lipides, fibres, sucres (g), sodium (mg), index glycémique ;
   - "nom_fr", "nom_en", "nom_mg" : le nom de l'ingrédient dans les trois langues ;
   - "poids_piece" : poids moyen d'UNE pièce en g (partie comestible : œuf sans coquille, banane sans peau…) si demandé, sinon null ;
   - "densite" : g par ml pour un liquide (eau, café, lait ≈ 1,0 ; huile ≈ 0,92), sinon null ;
   - source exacte (USDA FoodData Central ou Ciqual + nom de l'aliment). Si tu n'es pas sûr d'une valeur, mets null et écris "À VÉRIFIER" dans la source : n'invente jamais.
2. Pour le plat :
${TEXTS_SPEC}
   - "photo_en" : en anglais, une description visuelle précise du plat pour générer une photo.
3. NE CALCULE PAS les calories totales du plat.

FORMAT DE RÉPONSE
Si je t'ai joint un fichier Excel « hameno_${plat.id}.xlsx », remplis uniquement les cellules vides des onglets "Plat" et "Ingredients" (ne change ni les ID ni les en-têtes) et renvoie-moi le fichier complété.
Dans tous les cas, termine ta réponse par ce bloc JSON (et rien après) :

\`\`\`json
{
  "plat": {
    "id": "${plat.id}",
    "photo_en": "",
    ${TEXTS_JSON}
  },
  "ingredients": [
    { "id": "", "nom_fr": "", "nom_en": "", "nom_mg": "", "categorie": "${ING_CATS}", "etat": "Masaka | Manta | Vonona", "kcal": 0, "proteines": 0, "glucides": 0, "lipides": 0, "fibres": 0, "sucres": 0, "sodium": 0, "ig": 0, "poids_piece": null, "densite": null, "source": "" }
  ]
}
\`\`\``;
}

// ---------- Prompt 2: soso-kevitra sakafo vaovao ----------
export function promptPropositions(opts, plats, ingredients, category) {
  const ingList = ingredients.map((i) => `${i.id} | ${nameFr(i)}`).join('\n');
  const existing = plats.map((p) => p.nom_commercial || p.nom).join(' ; ') || '(aucun)';
  return `Tu es nutritionniste diplômé, expert en cuisine malgache et en cuisine du monde, et en marketing culinaire, pour un service de repas sur mesure livrés à Antananarivo (Madagascar).

OBJECTIF : propose ${opts.isa} nouveaux plats.
- Catégorie : ${category?.nom || opts.categorie}
- Règles de la catégorie : ${category?.regles || '-'}
- Moment du repas : ${opts.fotoana}
- Cible par portion : environ ${opts.kcal} kcal (± 10 %)${opts.prot ? ', protéines au moins ' + opts.prot + ' g' : ''}
- Budget maximum par portion : ${opts.budget ? opts.budget + ' Ar' : 'raisonnable pour Madagascar'}
- Style : ${opts.style || '60 % plats malgaches revisités, 40 % plats du monde adaptés aux produits locaux'}
${opts.fanamarihana ? '- Remarques : ' + opts.fanamarihana + '\n' : ''}- Ingrédients faciles à trouver sur les marchés d'Antananarivo.
- Ne propose PAS ces plats qui existent déjà : ${existing}

INGRÉDIENTS DISPONIBLES (utilise ces ID en priorité) :
${ingList}

S'il faut un ingrédient absent de la liste, mets "ingredient_id": null et remplis "nouvel_ingredient" avec ses valeurs pour 100 g (USDA ou Ciqual, source précise ; null si tu ne sais pas).
Les grammes (toujours en g, même pour un œuf ou un liquide) sont ceux de l'ingrédient TEL QU'IL EST SERVI (cuit si cuit). Ne calcule pas les calories totales : mon logiciel le fait.
Pour chaque ingrédient, tu peux ajouter un "note" court (ex : "sans sel", "sans sucre ajouté", "grillé sans huile").

Textes de chaque plat :
${TEXTS_SPEC}

Réponds UNIQUEMENT avec ce JSON (aucun texte avant ni après) :

\`\`\`json
{
  "propositions": [
    {
      "nom": "nom interne court",
      "fotoana": "${opts.fotoana}",
      "nb": "points forts du plat en français (ex : sans sel, sans sucre ajouté)",
      "photo_en": "description visuelle précise en anglais pour une photo",
      ${TEXTS_JSON.replace(/\n {4}/g, '\n      ')},
      "composition": [
        { "ingredient_id": "I012", "grammes": 120, "note": "" },
        { "ingredient_id": null, "grammes": 50, "note": "", "nouvel_ingredient": { "nom_fr": "", "nom_en": "", "nom_mg": "", "categorie": "", "etat": "Masaka", "kcal": 0, "proteines": 0, "glucides": 0, "lipides": 0, "fibres": 0, "sucres": 0, "sodium": 0, "ig": 0, "poids_piece": null, "densite": null, "source": "" } }
      ]
    }
  ]
}
\`\`\``;
}

// ---------- Prompts sary ----------
const MEAL_EN = { Maraina: 'breakfast', Atoandro: 'lunch', Hariva: 'dinner', 'Goûter': 'snack' };
const MEAL_MOOD = {
  Maraina: 'bright fresh morning light, a cozy breakfast table, a cup or glass next to the plate when there is a drink',
  Atoandro: 'warm natural midday light, generous lunch plate',
  Hariva: 'soft warm evening light, calm and elegant dinner setting',
  'Goûter': 'soft afternoon light, light and casual snack setting',
};
const GOAL_MOOD = {
  'perte-de-poids': 'light, fresh, colourful and healthy, no greasy look',
  'prise-de-masse': 'hearty, generous and energising, abundant protein',
  'diabete': 'balanced and wholesome, natural ingredients, no sugary elements',
  'economique': 'homely, simple and generous, local market ingredients',
  'normal': 'balanced, homemade and inviting',
};
const unitEn = (u, q) => ({ isa: '', ml: ' ml of', cas: q > 1 ? ' tablespoons of' : ' tablespoon of', cac: q > 1 ? ' teaspoons of' : ' teaspoon of', g: ' g of' }[u || 'g'] ?? ' g of');

function ingredientsForPhoto(lines, ingMap) {
  return lines.map((l) => {
    const i = ingMap.get(l.ingredient_id);
    const name = (i && (i.nom_en || i.nom_fr || i.nom_mg)) || '?';
    const q = l.quantite ?? l.grammes;
    const nm = String(name).toLowerCase();
    const qty = (l.unite || 'g') === 'isa' ? `${q} × ${nm}` : `${q}${unitEn(l.unite, q)} ${nm}`;
    return l.note ? `${qty} (${l.note})` : qty;
  });
}

// mode 'photo' = sary tena izy ho an'ny vente (tsy misy soratra); mode 'pub' = visuel publicitaire misy titre
export function promptSary(plat, lines = [], ingMap = new Map(), categories = [], mode = 'photo', kcal = null) {
  if (mode === 'retouch') return promptRetouche(plat, lines, ingMap);
  const meal = MEAL_EN[plat.fotoana] || 'meal';
  const items = ingredientsForPhoto(lines, ingMap);
  const goals = (plat.categories || []).map((id) => GOAL_MOOD[id]).filter(Boolean);
  const goalNames = (plat.categories || []).map((id) => categories.find((c) => c.id === id)?.nom_en || categories.find((c) => c.id === id)?.nom).filter(Boolean);
  const title = plat.traductions?.en?.nom_commercial || plat.nom_commercial || '';
  const desc = plat.nom_en || plat.traductions?.en?.description || '';
  const story = plat.traductions?.en?.marketing || '';

  const lines1 = [
    `Ultra-realistic professional food photograph for a healthy meal-delivery brand in Antananarivo, Madagascar: a ${meal} called "${title || plat.nom}".`,
    desc ? `Dish: ${desc}.` : '',
    items.length ? `Show exactly these portions (nothing more, true serving size), clearly visible and appetising: ${items.join(', ')}.` : '',
    plat.nb ? `Key selling points to suggest visually: ${plat.nb}.` : '',
    goalNames.length ? `Target customers: ${goalNames.join(', ')} — the dish must look ${goals.join('; ') || 'balanced and inviting'}.` : '',
    story ? `Mood and story: ${story}` : '',
    `Styling: ${MEAL_MOOD[plat.fotoana] || 'natural light'}; beautiful plating on a matte ceramic plate, rustic light wooden table, natural linen napkin, a few fresh raw ingredients scattered around as props, fresh herbs, subtle steam on hot food, droplets of freshness on fruit.`,
    'Camera: 45-degree angle (or top-down if it shows the portions better), 50 mm lens, shallow depth of field, crisp focus on the food, true-to-life colours, real textures, no artificial look, natural shadows.',
  ];
  const tail = mode === 'pub'
    ? [
      `Advertising layout for Instagram / Facebook (square 1:1, also works in 4:5): the plate on one side, clean empty space on the other side for text.`,
      `Add a short bold headline in French: "${plat.nom_commercial || title || plat.nom}"${kcal ? ` and a small rounded badge "${Math.round(kcal)} kcal"` : ''}${plat.nb ? `, plus 2 small icons/labels for: ${plat.nb}` : ''}.`,
      'Modern, fresh, premium healthy-food branding, soft green and warm natural tones, easy to read on a phone. Spell the French text exactly, no other text, no watermark.',
    ]
    : ['Square format 1:1, high resolution, photorealistic, no text, no logo, no watermark, no hands, no people.'];
  return [...lines1, ...tail].filter(Boolean).join('\n');
}

// mode 'retouch': hanatsara ny sary TENA IZY nalain'ny mpampiasa (ampiarahina amin'ny prompt ilay sary)
export function promptRetouche(plat, lines = [], ingMap = new Map()) {
  const meal = MEAL_EN[plat.fotoana] || 'meal';
  const items = ingredientsForPhoto(lines, ingMap);
  const title = plat.traductions?.en?.nom_commercial || plat.nom_commercial || plat.nom;
  return [
    `I attached a REAL photo of our ${meal} "${title}" from our healthy meal-delivery service in Antananarivo, Madagascar. Turn it into a professional, appetising marketing photo.`,
    items.length ? `The dish contains: ${items.join(', ')}.` : '',
    plat.nb ? `Selling points: ${plat.nb}.` : '',
    'KEEP exactly the same food, the same quantities, the same plate and the same arrangement: do not add, remove or enlarge any food (the customer must receive what the photo shows).',
    'Improve only: lighting (soft natural daylight), white balance and true-to-life colours, sharpness and texture of the food, gentle depth of field, clean the background and table (remove clutter, stains, crumbs, fingers), straighten and crop to a square 1:1 with the plate well centred.',
    `Background: ${MEAL_MOOD[plat.fotoana] || 'natural light'}, light wooden table or clean neutral surface.`,
    'Photorealistic, no text, no logo, no watermark, no cartoon or artificial look.',
  ].filter(Boolean).join('\n');
}

// ---------- Mamaky ny JSON avy amin'ny IA ----------
export function extractJson(text) {
  if (!text) throw new Error('vide');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('JSON ?');
  body = body.slice(start, end + 1);
  try { return JSON.parse(body); } catch (e) {
    return JSON.parse(body.replace(/,\s*([}\]])/g, '$1'));
  }
}

// Mamadika ny "plat" avy amin'ny IA (JSON na Excel) ho { photo_en, texts: { fr:{}, en:{}, mg:{} } }
export function normalizePlatTexts(p) {
  const out = { photo_en: p?.photo_en || p?.nom_en || '', texts: { fr: {}, en: {}, mg: {} } };
  if (!p) return out;
  for (const l of TEXT_LANGS) {
    for (const f of PLAT_TEXT_FIELDS) {
      const v = p[l]?.[f] ?? p[`${l}_${f}`];
      if (v) out.texts[l][f] = String(v);
    }
  }
  // endrika taloha (tsy misy teny): raisina ho frantsay
  for (const f of PLAT_TEXT_FIELDS) if (!out.texts.fr[f] && typeof p[f] === 'string' && p[f]) out.texts.fr[f] = p[f];
  return out;
}

// Ampiharina amin'ny sakafo iray ny texte
export function applyPlatTexts(plat, norm) {
  const next = { ...plat, traductions: { en: { ...(plat.traductions?.en || {}) }, mg: { ...(plat.traductions?.mg || {}) } } };
  if (norm.photo_en) next.nom_en = norm.photo_en;
  for (const f of PLAT_TEXT_FIELDS) {
    if (norm.texts.fr[f]) next[f] = norm.texts.fr[f];
    if (norm.texts.en[f]) next.traductions.en[f] = norm.texts.en[f];
    if (norm.texts.mg[f]) next.traductions.mg[f] = norm.texts.mg[f];
  }
  return next;
}
