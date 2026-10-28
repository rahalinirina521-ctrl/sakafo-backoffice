import { html } from '../lib.js';
import { useApp, Card } from '../ui.js';
import { exportAll } from '../excel.js';
import { tr } from '../i18n.js';

export function Backup() {
  const { data, ingMap, toast } = useApp();
  return html`<div class="page">
    <h1>${tr('Sauvegarde Excel', 'Excel backup', 'Backup Excel')}</h1>
    <${Card} title=${tr('Télécharger toutes les données', 'Download all data', 'Alaivo ny données rehetra')}>
      <p>${tr('Un fichier Excel avec tous les plats (calories et macros calculées), la composition, les ingrédients, les menus et les catégories.', 'One Excel file with all dishes (calculated calories and macros), composition, ingredients, menus and categories.', 'Fichier Excel iray misy ny sakafo rehetra (kcal sy macros voakajy), composition, ingrédients, menus ary sokajy.')}</p>
      <p class="muted small">${tr('À faire au moins une fois par semaine, surtout en mode démo.', 'Do it at least once a week, especially in demo mode.', 'Ataovy isan-kerinandro fara fahakeliny, indrindra amin\'ny mode démo.')}</p>
      <button class="btn primary" onClick=${() => exportAll(data, ingMap).then(() => toast(tr('Sauvegarde téléchargée', 'Backup downloaded', 'Vita ny backup'))).catch((e) => toast(e.message, 'bad'))}>${tr('Télécharger la sauvegarde (.xlsx)', 'Download the backup (.xlsx)', 'Alaivo ny backup (.xlsx)')}</button>
    <//>
  </div>`;
}
