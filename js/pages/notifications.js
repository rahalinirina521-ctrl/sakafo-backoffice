// Notifications de l'admin : nouvelles inscriptions, messages des clients / livreurs.
import { html } from '../lib.js?v=202610291512';
import { useApp, Empty } from '../ui.js?v=202610291512';
import { tr } from '../i18n.js?v=202610291512';
import { depuis } from './livreurs.js?v=202610291512';

export function Notifications() {
  const app = useApp();
  const { data, toast } = app;
  const list = [...(data.notifications || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const nonLues = list.filter((n) => !n.lu);
  const ouvrir = async (n) => {
    if (!n.lu) app.patch('notifications', n.id, { lu: true }).catch(() => {});
    if (n.lien) location.hash = n.lien;
  };
  const toutLu = async () => {
    try { for (const n of nonLues) await app.patch('notifications', n.id, { lu: true }); } catch (e) { toast(e.message, 'bad'); }
  };
  return html`<div class="page">
    <div class="page-head"><h1>🔔 ${tr('Notifications', 'Notifications', 'Fampahafantarana')}</h1>
      ${nonLues.length > 0 && html`<button class="btn" onClick=${toutLu}>✓ ${tr('Tout marquer comme lu', 'Mark all as read', 'Voavaky daholo')}</button>`}</div>
    <p class="muted small">${tr('Recevez-les aussi sur votre téléphone : Paramètres → « Activer les notifications sur cet appareil ».', 'Also get them on your phone: Settings → "Enable notifications on this device".', 'Raisina koa ao amin\'ny findainao: Paramètres → « Activer les notifications ».')} <a href="#/parametres">⚙️</a></p>
    ${list.length === 0 ? html`<${Empty}>${tr('Aucune notification pour le moment.', 'No notification yet.', 'Mbola tsy misy.')}<//>` : html`
    <div class="notif-list">${list.map((n) => html`<button class=${'notif' + (n.lu ? '' : ' new')} onClick=${() => ouvrir(n)} key=${n.id}>
      <span class="notif-ic">${n.type === 'inscription' ? '🆕' : n.type === 'message' ? '💬' : '🔔'}</span>
      <span class="notif-body"><b>${n.titre}</b>${n.texte && html`<small>${n.texte}</small>`}</span>
      <small class="muted">${depuis(n.created_at)}</small>
    </button>`)}</div>`}
  </div>`;
}
