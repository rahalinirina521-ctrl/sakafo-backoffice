// Sauvegarde & restauration : automatique chaque nuit, à la demande, fichier JSON, Excel, corbeille des suppressions.
import { html, useState, useEffect } from '../lib.js?v=202610291028';
import { useApp, Card, Badge, Empty } from '../ui.js?v=202610291028';
import { exportAll } from '../excel.js?v=202610291028';
import { MODE, readBrowserDemo, migrateDemoToSupabase, lire, upsert } from '../db.js?v=202610291028';
import { tr } from '../i18n.js?v=202610291028';
import { exporterJSON, lireFichier, resume, restaurer, listeSauvegardes, telechargerSauvegarde, sauvegarderMaintenant, ORDRE } from '../sauvegarde.js?v=202610291028';
import { depuis } from './livreurs.js?v=202610291028';

const NOMS = { categories: 'Objectifs', ingredients: 'Ingrédients', offres: 'Formules', options: 'Options / paramètres', plats: 'Plats', composition: 'Compositions', menus: 'Menus', clients: 'Clients', livreurs: 'Livreurs', calendrier: 'Planning', mesures: 'Pesées', livraisons: 'Livraisons', suggestions: 'Suggestions IA', avis: 'Avis', communaute: 'Communauté', amis: 'Amis', publications: 'Publications', reactions: 'Réactions', incidents: 'Incidents', messages: 'Messages', notifications: 'Notifications' };
const ko = (n) => (n ? (n / 1024 > 1024 ? (n / 1048576).toFixed(1) + ' Mo' : Math.round(n / 1024) + ' ko') : '');

export function Backup() {
  const app = useApp();
  const { data, ingMap, toast, reload } = app;
  const [busy, setBusy] = useState('');
  const [liste, setListe] = useState(null);
  const [apercu, setApercu] = useState(null); // { dump, source }
  const [choix, setChoix] = useState([]);
  const [progres, setProgres] = useState('');
  const [corbeille, setCorbeille] = useState(null);
  const demo = MODE === 'supabase' ? readBrowserDemo() : null;

  const charger = () => { listeSauvegardes().then(setListe).catch(() => setListe([])); lire('journal', { order: 'quand', limit: 400, filtre: (q) => q.eq('action', 'DELETE') }).then(setCorbeille).catch(() => setCorbeille([])); };
  useEffect(charger, []);

  async function maintenant() {
    setBusy('save');
    try { const r = await sauvegarderMaintenant(); toast(tr('Sauvegarde enregistrée ✅', 'Backup saved ✅', 'Voatahiry ✅') + ' (' + Object.values(r.compte || {}).reduce((a, b) => a + b, 0) + ' ' + tr('lignes', 'rows', 'andalana') + ')'); charger(); } catch (e) { toast(e.message, 'bad'); }
    setBusy('');
  }
  async function ouvrir(src, dumpP) {
    setBusy('lecture');
    try { const dump = await dumpP; setApercu({ dump, source: src }); setChoix(resume(dump).filter(([t, n]) => n > 0 && !['notifications', 'messages'].includes(t)).map(([t]) => t)); } catch (e) { toast(e.message, 'bad'); }
    setBusy('');
  }
  async function lancer() {
    if (!confirm(tr('Restaurer les éléments cochés ? Les données actuelles portant le même identifiant seront remises à l\'état de la sauvegarde. Rien n\'est supprimé.', 'Restore the checked items? Current data with the same ID will be reset to the backup state. Nothing is deleted.', 'Hamerina ireo voafidy? Haverina amin\'ny toetry ny sauvegarde ny données mitovy ID. Tsy misy voafafa.'))) return;
    setBusy('restore');
    try { await restaurer(apercu.dump, choix, (t, i, n) => setProgres(`${NOMS[t] || t} ${i}/${n}`)); toast(tr('Restauration terminée ✅', 'Restore complete ✅', 'Vita ny famerenana ✅')); setApercu(null); await reload(); } catch (e) { toast(e.message, 'bad'); }
    setBusy(''); setProgres('');
  }
  async function recuperer(j) {
    try {
      await upsert(j.table_nom, j.details);
      // un plat revient avec sa composition, un menu avec son planning
      const liees = (corbeille || []).filter((x) => (j.table_nom === 'plats' && x.table_nom === 'composition' && x.details?.plat_id === j.ligne_id) || (j.table_nom === 'menus' && x.table_nom === 'calendrier' && x.details?.menu_id === j.ligne_id));
      if (liees.length) await upsert(liees[0].table_nom, liees.map((x) => x.details));
      setCorbeille((c) => c.filter((x) => !liees.includes(x)));
      toast(tr('Élément restauré ✅', 'Item restored ✅', 'Naverina ✅')); await reload(); setCorbeille((c) => c.filter((x) => x.id !== j.id)); } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="page">
    <h1>💾 ${tr('Sauvegarde & restauration', 'Backup & restore', 'Fitahirizana sy famerenana')}</h1>
    <div class="grid-2">
      <${Card} title=${'🌙 ' + tr('Sauvegardes automatiques', 'Automatic backups', 'Fitahirizana ho azy')}>
        <p class="small">${tr('Chaque nuit à 2 h, toute la base est copiée dans un espace privé (30 dernières copies gardées). Vous pouvez aussi en créer une avant une grosse modification.', 'Every night at 2 am the whole database is copied to private storage (last 30 kept). You can also create one before a big change.', 'Isan\'alina amin\'ny 2 ora, adika ao amin\'ny toerana miafina ny base rehetra (30 farany no tehirizina).')}</p>
        <button class="btn primary" disabled=${busy || MODE !== 'supabase'} onClick=${maintenant}>${busy === 'save' ? '⏳ …' : '💾 ' + tr('Sauvegarder maintenant', 'Back up now', 'Tehirizo izao')}</button>
        ${liste === null ? html`<p class="muted small">…</p>` : liste.length === 0 ? html`<p class="muted small">${tr('Aucune sauvegarde pour l\'instant.', 'No backup yet.', 'Mbola tsy misy.')}</p>` : html`<div class="bk-list">${liste.slice(0, 15).map((f) => html`<div class="bk-item"><span><b>${f.nom.replace('.json', '').replace(/-(\d\d)-(\d\d)$/, ' $1:$2')}</b><small class="muted"> ${f.dossier === 'auto' ? '🌙 auto' : '👤 ' + tr('manuelle', 'manual', 'tanana')} ${ko(f.taille)}</small></span><button class="btn small" disabled=${!!busy} onClick=${() => ouvrir(f.nom, telechargerSauvegarde(f.chemin))}>${tr('Restaurer…', 'Restore…', 'Avereno…')}</button></div>`)}</div>`}
      <//>
      <${Card} title=${'📦 ' + tr('Fichier de sauvegarde', 'Backup file', 'Fichier fitahirizana')}>
        <p class="small">${tr('Une copie complète (JSON) à garder sur votre ordinateur ou Google Drive. Elle permet de tout restaurer, même sur un nouveau projet.', 'A complete copy (JSON) to keep on your computer or Google Drive.', 'Kopia feno (JSON) hotehirizina ao amin\'ny ordinateur na Google Drive.')}</p>
        <div class="row gap wrap"><button class="btn" disabled=${!!busy} onClick=${() => { setBusy('export'); exporterJSON(data).then(() => toast(tr('Fichier téléchargé', 'File downloaded', 'Voaray'))).catch((e) => toast(e.message, 'bad')).finally(() => setBusy('')); }}>⬇ ${tr('Télécharger (.json)', 'Download (.json)', 'Alaivo (.json)')}</button>
          <label class="btn">⬆ ${tr('Restaurer un fichier…', 'Restore a file…', 'Hamerina fichier…')}<input type="file" accept=".json,application/json" hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) ouvrir(f.name, lireFichier(f)); }} /></label></div>
        <hr />
        <p class="small">${tr('Tableau Excel lisible (plats avec calories, compositions, clients, planning…).', 'Readable Excel workbook.', 'Excel azo vakiana.')}</p>
        <button class="btn" onClick=${() => exportAll(data, ingMap).then(() => toast(tr('Excel téléchargé', 'Excel downloaded', 'Voaray'))).catch((e) => toast(e.message, 'bad'))}>⬇ ${tr('Télécharger (.xlsx)', 'Download (.xlsx)', 'Alaivo (.xlsx)')}</button>
      <//>
    </div>

    ${apercu && html`<${Card} title=${'🔁 ' + tr('Restaurer : ', 'Restore: ', 'Hamerina: ') + apercu.source}>
      <p class="small muted">${tr('Sauvegarde du', 'Backup from', 'Sauvegarde tamin\'ny')} ${new Date(apercu.dump._meta.date).toLocaleString('fr-FR')}. ${tr('Cochez ce qu\'il faut restaurer. Mode « fusion » : rien n\'est supprimé.', 'Check what to restore. "Merge" mode: nothing is deleted.', 'Safidio izay haverina. Tsy misy voafafa.')}</p>
      <div class="bk-choix">${resume(apercu.dump).map(([t, n]) => html`<label class="check"><input type="checkbox" checked=${choix.includes(t)} disabled=${!n} onChange=${(e) => setChoix(e.target.checked ? [...choix, t] : choix.filter((x) => x !== t))} /> ${NOMS[t] || t} <small class="muted">(${n})</small></label>`)}</div>
      ${progres && html`<p class="small">⏳ ${progres}</p>`}
      <div class="row gap"><button class="btn primary" disabled=${!!busy || !choix.length} onClick=${lancer}>${busy === 'restore' ? '⏳ …' : tr('Restaurer la sélection', 'Restore selection', 'Avereno')}</button><button class="btn ghost" onClick=${() => setApercu(null)}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button></div>
    <//>`}

    <${Card} title=${'🗑️ ' + tr('Corbeille (éléments supprimés)', 'Bin (deleted items)', 'Zavatra voafafa')}>
      <p class="small muted">${tr('Plats, clients, menus, formules, objectifs, livreurs… supprimés par erreur : récupérez-les en un clic.', 'Dishes, customers, menus… deleted by mistake: get them back in one click.', 'Sakafo, client, menu… voafafa tsy nahy: averina amin\'ny tsindry iray.')}</p>
      ${corbeille === null ? html`<p class="muted small">…</p>` : corbeille.length === 0 ? html`<${Empty}>${tr('Rien dans la corbeille.', 'Bin is empty.', 'Tsy misy.')}<//>` : html`<div class="bk-list">${corbeille.filter((j) => !['composition', 'calendrier'].includes(j.table_nom)).map((j) => html`<div class="bk-item"><span><${Badge}>${NOMS[j.table_nom] || j.table_nom}<//> <b>${j.details?.nom || j.details?.nom_commercial || j.details?.titre || j.ligne_id}</b><small class="muted"> · ${depuis(j.quand)}${j.email ? ' · ' + j.email : ''}</small></span><button class="btn small" onClick=${() => recuperer(j)}>↩ ${tr('Restaurer', 'Restore', 'Avereno')}</button></div>`)}</div>`}
    <//>

    ${demo && html`<${Card} title=${tr('Données de démo trouvées dans ce navigateur', 'Demo data found in this browser', 'Misy données démo ato amin\'ity navigateur ity')}>
      <p>${tr(`${demo.plats.length} plat(s), ${demo.ingredients.length} ingrédient(s) et ${demo.menus.length} menu(s) saisis en mode démo.`, `${demo.plats.length} dish(es), ${demo.ingredients.length} ingredient(s) and ${demo.menus.length} menu(s) entered in demo mode.`, `Sakafo ${demo.plats.length}, ingrédients ${demo.ingredients.length} ary menus ${demo.menus.length}.`)}</p>
      <button class="btn" disabled=${!!busy} onClick=${async () => { if (!confirm(tr('Transférer vers Supabase ?', 'Transfer to Supabase?', 'Afindra?'))) return; try { await migrateDemoToSupabase(demo); await reload(); toast('✅'); } catch (e) { toast(e.message, 'bad'); } }}>${tr('Transférer vers Supabase', 'Transfer to Supabase', 'Afindrao any amin\'ny Supabase')}</button>
    <//>`}
  </div>`;
}
export { ORDRE };
