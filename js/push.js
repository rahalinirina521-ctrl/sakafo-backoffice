// Activation des notifications push sur l'appareil de l'admin.
import { upsert, MODE } from './db.js?v=202610291451';
import { param } from './params.js?v=202610291451';

export const pushPossible = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
const ab64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function etatPush() {
  if (!pushPossible()) return 'impossible';
  if (Notification.permission === 'denied') return 'refuse';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? 'actif' : 'inactif';
}
export async function activerPush(data) {
  if (!pushPossible()) throw new Error('Ce navigateur ne gère pas les notifications push (sur iPhone : ajoutez d\'abord le site à l\'écran d\'accueil).');
  if (MODE !== 'supabase') throw new Error('Indisponible en mode démo');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications refusées dans le navigateur');
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(param(data, 'vapid_public')) });
  const j = sub.toJSON();
  await upsert('push_abonnements', { endpoint: sub.endpoint, p256dh: j.keys.p256dh || ab64(sub.getKey('p256dh')), auth: j.keys.auth || ab64(sub.getKey('auth')), appareil: navigator.userAgent.slice(0, 120) });
  return sub;
}
export async function desactiverPush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) await sub.unsubscribe();
}
