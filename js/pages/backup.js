import { html, useState } from '../lib.js?v=202610290725';
import { useApp, Card } from '../ui.js?v=202610290725';
import { exportAll } from '../excel.js?v=202610290725';
import { MODE, readBrowserDemo, migrateDemoToSupabase } from '../db.js?v=202610290725';
import { tr } from '../i18n.js?v=202610290725';

export function Backup() {
  const { data, ingMap, toast, reload } = useApp();
  const [busy, setBusy] = useState(false);
  const demo = MODE === 'supabase' ? readBrowserDemo() : null;

  async function migrate() {
    if (!confirm(tr('Copier les données de démo de ce navigateur vers Supabase ? Les éléments avec le même ID seront remplacés.', 'Copy the demo data from this browser to Supabase? Items with the same ID will be replaced.', 'Afindra any amin\'ny Supabase ve ny données démo ato amin\'ity navigateur ity? Hosoloina izay mitovy ID.'))) return;
    setBusy(true);
    try {
      const c = await migrateDemoToSupabase(demo);
      toast(tr(`Transféré : ${c.plats} plats, ${c.ingredients} ingrédients, ${c.menus} menus`, `Transferred: ${c.plats} dishes, ${c.ingredients} ingredients, ${c.menus} menus`, `Voafindra: sakafo ${c.plats}, ingrédients ${c.ingredients}, menus ${c.menus}`));
      await reload();
    } catch (e) { toast(tr('Erreur : ', 'Error: ', 'Nisy olana: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }

  return html`<div class="page">
    <h1>${tr('Sauvegarde Excel', 'Excel backup', 'Backup Excel')}</h1>
    <${Card} title=${tr('Télécharger toutes les données', 'Download all data', 'Alaivo ny données rehetra')}>
      <p>${tr('Un fichier Excel avec tous les plats (calories et macros calculées), la composition, les ingrédients, les menus et les catégories.', 'One Excel file with all dishes (calculated calories and macros), composition, ingredients, menus and categories.', 'Fichier Excel iray misy ny sakafo rehetra (kcal sy macros voakajy), composition, ingrédients, menus ary sokajy.')}</p>
      <p class="muted small">${tr('Les données sont déjà dans Supabase ; ce fichier est une copie de sécurité en plus.', 'Data is already in Supabase; this file is an extra safety copy.', 'Efa ao amin\'ny Supabase ny données; fanampiny ho fiarovana ity fichier ity.')}</p>
      <button class="btn primary" onClick=${() => exportAll(data, ingMap).then(() => toast(tr('Sauvegarde téléchargée', 'Backup downloaded', 'Vita ny backup'))).catch((e) => toast(e.message, 'bad'))}>${tr('Télécharger la sauvegarde (.xlsx)', 'Download the backup (.xlsx)', 'Alaivo ny backup (.xlsx)')}</button>
    <//>
    ${demo && html`<${Card} title=${tr('Données de démo trouvées dans ce navigateur', 'Demo data found in this browser', 'Misy données démo ato amin\'ity navigateur ity')}>
      <p>${tr(`${demo.plats.length} plat(s), ${demo.ingredients.length} ingrédient(s) et ${demo.menus.length} menu(s) saisis en mode démo.`, `${demo.plats.length} dish(es), ${demo.ingredients.length} ingredient(s) and ${demo.menus.length} menu(s) entered in demo mode.`, `Sakafo ${demo.plats.length}, ingrédients ${demo.ingredients.length} ary menus ${demo.menus.length} nampidirina tamin'ny mode démo.`)}</p>
      <button class="btn" disabled=${busy} onClick=${migrate}>${busy ? tr('Transfert…', 'Transferring…', 'Mamindra…') : tr('Transférer vers Supabase', 'Transfer to Supabase', 'Afindrao any amin\'ny Supabase')}</button>
    <//>`}
  </div>`;
}
