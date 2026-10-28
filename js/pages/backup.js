import { html } from '../lib.js';
import { useApp, Card } from '../ui.js';
import { exportAll } from '../excel.js';

export function Backup() {
  const { data, ingMap, toast } = useApp();
  return html`<div class="page">
    <h1>Backup Excel</h1>
    <${Card} title="Alaivo ny données rehetra">
      <p>Fichier Excel iray misy ny sakafo rehetra (miaraka amin'ny kcal sy macros efa voakajy), ny composition, ny ingrédients, ny menus ary ny sokajy.</p>
      <p class="muted small">Ataovy isan-kerinandro fara fahakeliny, indrindra amin'ny mode démo.</p>
      <button class="btn primary" onClick=${() => exportAll(data, ingMap).then(() => toast('Vita ny backup')).catch((e) => toast(e.message, 'bad'))}>Alaivo ny backup (.xlsx)</button>
    <//>
  </div>`;
}
