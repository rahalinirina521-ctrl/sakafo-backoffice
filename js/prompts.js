// Mamorona ireo prompts hadika ao amin'ny ChatGPT na Claude.
import { isComplete, fmt, qtyLabel, needsPieceWeight, lineGrams } from './calc.js';

export const ING_FIELDS = ['id', 'nom_mg', 'nom_fr', 'categorie', 'etat', 'kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium', 'ig', 'poids_piece', 'densite', 'source'];
export const PLAT_TEXT_FIELDS = ['nom_commercial', 'marketing', 'description', 'avantages', 'effets', 'nom_en'];
export const PLAT_FIELDS = ['id', 'nom', ...PLAT_TEXT_FIELDS];
const ING_CATS = 'Féculent / Protéine / Légumineuse / Légume / Fruit / Boisson / Laitier / Matière grasse / Condiment';

function catNames(plat, categories) {
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

// ---------- Prompt 1: hameno ny données momba ny sakafo iray ----------
export function promptHameno(plat, lines, ingMap, categories) {
  const toFill = ingredientsToFill(lines, ingMap);
  const compo = lines.map((l) => {
    const ing = ingMap.get(l.ingredient_id);
    const g = lineGrams(l, ing);
    const conv = (l.unite || 'g') !== 'g' && g ? ` (≈ ${fmt(g)} g)` : '';
    return `- ${l.ingredient_id} | ${ing?.nom_mg || '?'}${ing?.nom_fr ? ' (' + ing.nom_fr + ')' : ''} | ${qtyLabel(l)}${conv}`;
  }).join('\n');
  const fill = toFill.length
    ? toFill.map(({ ing: i, needPiece }) => `- ${i.id} | ${i.nom_mg}${i.nom_fr ? ' (' + i.nom_fr + ')' : ''}${i.etat ? ' | état : ' + i.etat : ''}${!isComplete(i) ? ' | valeurs nutritionnelles manquantes' : ''}${needPiece ? ' | POIDS D\'UNE PIÈCE manquant (partie comestible, en g)' : ''}`).join('\n')
    : '(aucun : toutes les valeurs sont déjà connues, laisse "ingredients" vide)';

  return `Tu es nutritionniste diplômé et expert en marketing culinaire. Tu travailles pour un service de repas sur mesure livrés à Antananarivo (Madagascar).

PLAT À DOCUMENTER
- ID : ${plat.id}
- Nom interne : ${plat.nom}
- Moment : ${plat.fotoana || '?'}
- Catégorie(s) / objectif(s) du client : ${catNames(plat, categories)}
- Composition (quantités telles que servies ; "isa" = pièce, "ml" = millilitres) :
${compo || '(vide)'}

INGRÉDIENTS À COMPLÉTER :
${fill}

TA MISSION
1. Pour chaque ingrédient à compléter :
   - valeurs pour 100 g de partie comestible, dans l'état où il est servi : kcal, protéines, glucides, lipides, fibres, sucres (g), sodium (mg), index glycémique ;
   - "poids_piece" : poids moyen d'UNE pièce en g (partie comestible : œuf sans coquille, banane sans peau…) si demandé, sinon null ;
   - "densite" : g par ml pour un liquide (eau, café, lait ≈ 1,0 ; huile ≈ 0,92), sinon null ;
   - source exacte (USDA FoodData Central ou Ciqual + nom de l'aliment). Si tu n'es pas sûr d'une valeur, mets null et écris "À VÉRIFIER" dans la source : n'invente jamais.
2. Pour le plat, en malgache simple et naturel (comme on parle à Antananarivo) :
   - "nom_commercial" : un nom court et appétissant pour la vente (max 6 mots) ;
   - "marketing" : un résumé marketing de 2 à 3 phrases qui donne envie de choisir ce menu : le goût, ce que le client y gagne pour son objectif ${catNames(plat, categories)}, et une raison concrète (rassasiant, rapide, énergie, etc.). Ton chaleureux, positif, sans exagération ;
   - "description" : 1 phrase qui décrit le plat ;
   - "avantages" : les bénéfices nutritionnels (1 à 2 phrases) ;
   - "effets" : l'effet attendu sur l'objectif (1 à 2 phrases) ;
   - en anglais, "nom_en" : une description visuelle précise du plat pour générer une photo.
   Aucune promesse médicale (interdit : "guérit", "fait perdre X kg"). Les chiffres de calories sont calculés par mon logiciel : ne les cite pas.
3. NE CALCULE PAS les calories totales du plat.

FORMAT DE RÉPONSE
Si je t'ai joint un fichier Excel « hameno_${plat.id}.xlsx », remplis uniquement les cellules vides des onglets "Plat" et "Ingredients" (ne change ni les ID ni les en-têtes) et renvoie-moi le fichier complété.
Dans tous les cas, termine ta réponse par ce bloc JSON (et rien après) :

\`\`\`json
{
  "plat": { "id": "${plat.id}", "nom_commercial": "", "marketing": "", "description": "", "avantages": "", "effets": "", "nom_en": "" },
  "ingredients": [
    { "id": "", "nom_fr": "", "categorie": "${ING_CATS}", "etat": "Masaka | Manta | Vonona", "kcal": 0, "proteines": 0, "glucides": 0, "lipides": 0, "fibres": 0, "sucres": 0, "sodium": 0, "ig": 0, "poids_piece": null, "densite": null, "source": "" }
  ]
}
\`\`\``;
}

// ---------- Prompt 2: soso-kevitra sakafo vaovao ----------
export function promptPropositions(opts, plats, ingredients, category) {
  const ingList = ingredients.map((i) => `${i.id} | ${i.nom_mg}${i.nom_fr ? ' (' + i.nom_fr + ')' : ''}`).join('\n');
  const existing = plats.map((p) => p.nom).join(' ; ') || '(aucun)';
  return `Tu es nutritionniste diplômé, expert en cuisine malgache et en cuisine du monde, pour un service de repas sur mesure livrés à Antananarivo (Madagascar).

OBJECTIF : propose ${opts.isa} nouveaux plats.
- Catégorie : ${category?.nom || opts.categorie}
- Règles de la catégorie : ${category?.regles || '-'}
- Moment du repas : ${opts.fotoana}
- Cible par portion : environ ${opts.kcal} kcal (± 10 %)${opts.prot ? ', protéines au moins ' + opts.prot + ' g' : ''}
- Budget maximum par portion : ${opts.budget ? opts.budget + ' Ar' : 'raisonnable pour Madagascar'}
- Style : ${opts.style || '60 % plats malagasy revisités, 40 % plats du monde adaptés aux produits locaux'}
${opts.fanamarihana ? '- Remarques : ' + opts.fanamarihana + '\n' : ''}- Ingrédients faciles à trouver sur les marchés d'Antananarivo.
- Ne propose PAS ces plats qui existent déjà : ${existing}

INGRÉDIENTS DISPONIBLES (utilise ces ID en priorité) :
${ingList}

S'il faut un ingrédient absent de la liste, mets "ingredient_id": null et remplis "nouvel_ingredient" avec ses valeurs pour 100 g (USDA ou Ciqual, source précise ; null si tu ne sais pas).
Les grammes (toujours en g, même pour un œuf ou un liquide) sont ceux de l'ingrédient TEL QU'IL EST SERVI (cuit si cuit). Ne calcule pas les calories totales : mon logiciel le fait.

Réponds UNIQUEMENT avec ce JSON (aucun texte avant ni après) :

\`\`\`json
{
  "propositions": [
    {
      "nom": "nom du plat en malgache",
      "nom_commercial": "nom court et appétissant pour la vente",
      "marketing": "2 à 3 phrases en malgache qui donnent envie de choisir ce plat (goût, bénéfice pour l'objectif), sans promesse médicale",
      "nom_en": "description visuelle précise en anglais pour une photo",
      "fotoana": "${opts.fotoana}",
      "description": "1 phrase en malgache",
      "avantages": "bénéfices nutritionnels en malgache",
      "effets": "effet attendu sur l'objectif, en malgache, sans promesse médicale",
      "composition": [
        { "ingredient_id": "I012", "grammes": 120 },
        { "ingredient_id": null, "grammes": 50, "nouvel_ingredient": { "nom_mg": "", "nom_fr": "", "categorie": "", "etat": "Masaka", "kcal": 0, "proteines": 0, "glucides": 0, "lipides": 0, "fibres": 0, "sucres": 0, "sodium": 0, "ig": 0, "poids_piece": null, "densite": null, "source": "" } }
      ]
    }
  ]
}
\`\`\``;
}

// ---------- Prompt sary ----------
export function promptSary(plat) {
  const what = plat.nom_en || plat.nom;
  return `Professional food photography of ${what}, served in a white ceramic plate on a rustic light wooden table, Malagasy home cooking, natural soft daylight from the left, 45-degree angle, steam rising, vibrant colors, realistic textures, fresh and appetizing, high detail, shallow depth of field, clean background, no text, no logo, no hands, square format 1:1.`;
}

// ---------- Mamaky ny JSON avy amin'ny IA ----------
export function extractJson(text) {
  if (!text) throw new Error('Tsy misy soratra');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Tsy hita ny JSON ao amin\'ny valiny');
  body = body.slice(start, end + 1);
  try { return JSON.parse(body); } catch (e) {
    // fanitsiana kely: virgule farany
    return JSON.parse(body.replace(/,\s*([}\]])/g, '$1'));
  }
}
