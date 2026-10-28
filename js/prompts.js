// Mamorona ireo prompts hadika ao amin'ny ChatGPT na Claude.
import { isComplete, fmt } from './calc.js';

export const ING_FIELDS = ['id', 'nom_mg', 'nom_fr', 'categorie', 'etat', 'kcal', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium', 'ig', 'source'];
export const PLAT_FIELDS = ['id', 'nom', 'nom_en', 'description', 'avantages', 'effets'];
const ING_CATS = 'Féculent / Protéine / Légumineuse / Légume / Fruit / Laitier / Matière grasse / Condiment';

function catNames(plat, categories) {
  return (plat.categories || []).map((id) => categories.find((c) => c.id === id)?.nom || id).join(', ') || 'Normal';
}

export function ingredientsToFill(lines, ingMap) {
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    const ing = ingMap.get(l.ingredient_id);
    if (!ing || seen.has(ing.id)) continue;
    seen.add(ing.id);
    if (!isComplete(ing)) out.push(ing);
  }
  return out;
}

// ---------- Prompt 1: hameno ny données momba ny sakafo iray ----------
export function promptHameno(plat, lines, ingMap, categories) {
  const toFill = ingredientsToFill(lines, ingMap);
  const compo = lines.map((l) => {
    const ing = ingMap.get(l.ingredient_id);
    return `- ${l.ingredient_id} | ${ing?.nom_mg || '?'}${ing?.nom_fr ? ' (' + ing.nom_fr + ')' : ''} | ${fmt(l.grammes)} g`;
  }).join('\n');
  const fill = toFill.length
    ? toFill.map((i) => `- ${i.id} | ${i.nom_mg}${i.nom_fr ? ' (' + i.nom_fr + ')' : ''}${i.etat ? ' | état : ' + i.etat : ''}`).join('\n')
    : '(aucun : toutes les valeurs sont déjà connues, laisse "ingredients" vide)';

  return `Tu es nutritionniste diplômé, expert en cuisine malgache, et tu travailles pour un service de repas sur mesure livrés à Antananarivo (Madagascar).

PLAT À DOCUMENTER
- ID : ${plat.id}
- Nom (malgache) : ${plat.nom}
- Moment : ${plat.fotoana || '?'}
- Catégorie(s) / objectif(s) : ${catNames(plat, categories)}
- Composition (poids de l'ingrédient tel qu'il est servi) :
${compo || '(vide)'}

INGRÉDIENTS DONT IL FAUT LES VALEURS NUTRITIONNELLES (pour 100 g, dans l'état indiqué) :
${fill}

TA MISSION
1. Pour chaque ingrédient de la liste ci-dessus : donne les valeurs pour 100 g (kcal, protéines, glucides, lipides, fibres, sucres en g ; sodium en mg ; index glycémique). Utilise en priorité USDA FoodData Central ou la table Ciqual (ANSES) ; pour les aliments malgaches, une table de composition africaine (FAO/INFOODS) si besoin. Indique la source exacte (base + nom de l'aliment). Si tu n'es pas sûr d'une valeur, mets null et écris "À VÉRIFIER" dans la source : n'invente jamais.
2. Pour le plat : écris en malgache simple
   - "description" : 1 phrase qui donne envie,
   - "avantages" : les bénéfices nutritionnels (1 à 2 phrases),
   - "effets" : l'effet attendu en lien avec l'objectif ${catNames(plat, categories)} (1 à 2 phrases, sans promesse médicale),
   et en anglais "nom_en" : une description visuelle précise du plat pour générer une photo.
3. NE CALCULE PAS les calories totales du plat : mon logiciel les calcule lui-même à partir des ingrédients.

FORMAT DE RÉPONSE
Si je t'ai joint un fichier Excel « hameno_${plat.id}.xlsx », remplis uniquement les cellules vides des onglets "Plat" et "Ingredients" (ne change ni les ID ni les en-têtes) et renvoie-moi le fichier complété.
Dans tous les cas, termine ta réponse par ce bloc JSON exact (et rien après) :

\`\`\`json
{
  "plat": { "id": "${plat.id}", "nom_en": "", "description": "", "avantages": "", "effets": "" },
  "ingredients": [
    { "id": "", "nom_fr": "", "categorie": "${ING_CATS}", "etat": "Masaka | Manta | Vonona", "kcal": 0, "proteines": 0, "glucides": 0, "lipides": 0, "fibres": 0, "sucres": 0, "sodium": 0, "ig": 0, "source": "" }
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
Les grammes sont ceux de l'ingrédient TEL QU'IL EST SERVI (cuit si cuit). Ne calcule pas les calories totales : mon logiciel le fait.

Réponds UNIQUEMENT avec ce JSON (aucun texte avant ni après) :

\`\`\`json
{
  "propositions": [
    {
      "nom": "nom du plat en malgache",
      "nom_en": "description visuelle précise en anglais pour une photo",
      "fotoana": "${opts.fotoana}",
      "description": "1 phrase en malgache",
      "avantages": "bénéfices nutritionnels en malgache",
      "effets": "effet attendu sur l'objectif, en malgache, sans promesse médicale",
      "composition": [
        { "ingredient_id": "I012", "grammes": 120 },
        { "ingredient_id": null, "grammes": 50, "nouvel_ingredient": { "nom_mg": "", "nom_fr": "", "categorie": "", "etat": "Masaka", "kcal": 0, "proteines": 0, "glucides": 0, "lipides": 0, "fibres": 0, "sucres": 0, "sodium": 0, "ig": 0, "source": "" } }
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
