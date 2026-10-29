import { html, useMemo } from '../lib.js?v=202610290636';
import { useApp, Card, Badge } from '../ui.js?v=202610290636';
import { platTotals, isComplete } from '../calc.js?v=202610290636';
import { tr, ingName, platTitle } from '../i18n.js?v=202610290636';
import { MODE } from '../db.js?v=202610290636';

export function Dashboard() {
  const { data, ingMap } = useApp();
  const stats = useMemo(() => {
    const platsIncomplets = data.plats.filter((p) => {
      const t = platTotals(p.id, data.composition, ingMap);
      return t.missing > 0 || !p.marketing || !p.avantages || data.composition.every((c) => c.plat_id !== p.id);
    });
    return {
      plats: data.plats.length,
      voamarina: data.plats.filter((p) => p.statut === 'Voamarina').length,
      ings: data.ingredients.length,
      ingsVide: data.ingredients.filter((i) => !isComplete(i)),
      ingsVerif: data.ingredients.filter((i) => i.a_verifier).length,
      menus: data.menus.length,
      platsIncomplets,
    };
  }, [data, ingMap]);

  return html`<div class="page">
    <h1>${tr('Tableau de bord', 'Dashboard', 'Tableau de bord')}</h1>
    ${MODE === 'demo' && html`<p class="warn-box">${tr('Supabase n\'est pas encore connecté : les données restent dans ce navigateur. Suivez le README (config.js) pour enregistrer dans Supabase.', 'Supabase is not connected yet: data stays in this browser. Follow the README (config.js) to save to Supabase.', 'Mbola tsy mifandray amin\'ny Supabase: ato amin\'ity navigateur ity ihany ny données. Araho ny README (config.js) mba hitahiry ao amin\'ny Supabase.')}</p>`}
    <div class="stats">
      <a class="stat" href="#/plats"><b>${stats.plats}</b><span>${tr('Plats', 'Dishes', 'Sakafo')}</span><small>${stats.voamarina} ${tr('validés', 'validated', 'voamarina')}</small></a>
      <a class="stat" href="#/ingredients"><b>${stats.ings}</b><span>${tr('Ingrédients', 'Ingredients', 'Ingrédients')}</span><small>${stats.ingsVerif} ${tr('à vérifier', 'to check', 'mbola hamarinina')}</small></a>
      <a class="stat" href="#/menus"><b>${stats.menus}</b><span>Menus</span><small>${tr('journées planifiées', 'planned days', 'andro voarafitra')}</small></a>
    </div>

    <${Card} title=${tr('Comment ça marche', 'How it works', 'Fomba fiasa')}>
      <ol class="steps">
        <li>${tr(html`<b>Saisissez votre plat</b> : <a href="#/plats/vaovao">Nouveau plat</a> → nom (ex. M1), moment, catégorie et composition en g, ml ou pièces (fraise 50 g, œufs 2 pièces, café 150 ml). Ajoutez un <b>NB</b> si besoin : « sans sel », « sans sucre ».`,
          html`<b>Enter your dish</b>: <a href="#/plats/vaovao">New dish</a> → name (e.g. M1), meal time, category and composition in g, ml or pieces (strawberries 50 g, 2 eggs, coffee 150 ml). Add a <b>NB</b> if needed: "no salt", "no sugar".`,
          html`<b>Ampidiro ny sakafonao</b>: <a href="#/plats/vaovao">Sakafo vaovao</a> → anarana (ohatra M1), fotoana, sokajy ary composition amin'ny g, ml na isa (fraise 50 g, atody 2 isa, café 150 ml). Ampio <b>NB</b> raha ilaina: "tsy misy sira", "tsy misy siramamy".`)}</li>
        <li>${tr(html`<b>Complétez avec l'IA</b> : « Copier le prompt » → collez dans ChatGPT ou Claude (avec le fichier Excel si vous voulez).`,
          html`<b>Complete with AI</b>: "Copy the prompt" → paste into ChatGPT or Claude (with the Excel file if you like).`,
          html`<b>Hameno amin'ny IA</b>: "Adikao ny prompt" → apetaho ao amin'ny ChatGPT na Claude (miaraka amin'ny Excel raha tianao).`)}</li>
        <li>${tr(html`<b>Collez la réponse</b> (JSON ou Excel) → valeurs nutritionnelles, poids des pièces, nom commercial et résumé marketing en FR / EN / MG remplis automatiquement.`,
          html`<b>Paste the answer</b> (JSON or Excel) → nutrition values, piece weights, commercial name and marketing summary in FR / EN / MG filled in automatically.`,
          html`<b>Apetaho ny valiny</b> (JSON na Excel) → feno ho azy ny valeur, ny lanjan'ny isa, ny anarana commercial sy résumé marketing amin'ny FR / EN / MG.`)}</li>
        <li>${tr('Modifiez les quantités : les calories se recalculent aussitôt.', 'Change quantities: calories update instantly.', 'Ovay ny habetsahana: miova avy hatrany ny kcal.')}</li>
        <li>${tr(html`Plusieurs plats d'un coup (noms ou idées) : <a href="#/propositions">Ajout IA (Excel)</a> → prompt + Excel dans ChatGPT/Claude.ai, puis import.`, html`Several dishes at once (names or ideas): <a href="#/propositions">AI add (Excel)</a> → prompt + Excel in ChatGPT/Claude.ai, then import.`, html`Sakafo maromaro indray mandeha (anarana na hevitra): <a href="#/propositions">Ampiditra IA (Excel)</a> → prompt + Excel ao amin'ny ChatGPT/Claude.ai, dia import.`)}</li>
      </ol>
    <//>

    <div class="grid2">
      <${Card} title=${tr('Plats à compléter', 'Dishes to complete', 'Sakafo mbola tsy feno')}>
        ${stats.platsIncomplets.length ? html`<ul class="list">${stats.platsIncomplets.slice(0, 12).map((p) => html`<li><a href=${'#/plats/' + p.id}>${platTitle(p)}</a> <${Badge} tone="warn">${tr('à compléter', 'to complete', 'hamenoina')}<//></li>`)}</ul>` : html`<p class="muted">${tr('Tout est complet.', 'All complete.', 'Feno daholo.')}</p>`}
      <//>
      <${Card} title=${tr('Ingrédients sans valeurs', 'Ingredients without values', 'Ingrédients tsy misy valeur')}>
        ${stats.ingsVide.length ? html`<ul class="list">${stats.ingsVide.slice(0, 12).map((i) => html`<li>${i.id} — ${ingName(i)}</li>`)}</ul>` : html`<p class="muted">${tr('Aucun.', 'None.', 'Tsy misy.')}</p>`}
      <//>
    </div>
  </div>`;
}
