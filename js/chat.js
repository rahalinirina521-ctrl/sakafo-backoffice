// Messagerie interne (admin ↔ client ↔ livreur), temps réel via Supabase.
import { html, useState, useEffect, useRef } from './lib.js?v=202610290734';
import { tr } from './i18n.js?v=202610290734';

const ROLE_ICON = { admin: '🧑‍🍳', client: '🙂', livreur: '🛵', invite: '👤' };
export const convLabel = (conv, data) => {
  const [k, id] = String(conv).split(':');
  if (k === 'client') return '🙂 ' + ((data.clients || []).find((c) => c.id === id)?.nom || id);
  if (k === 'livreur') return '🛵 ' + ((data.livreurs || []).find((c) => c.id === id)?.nom || id);
  if (k === 'user') { const p = (data.profils || []).find((x) => x.user_id === id); return '👤 ' + (p?.nom || p?.email || tr('Invité', 'Guest', 'Vahiny')); }
  return conv;
};
const heureMsg = (d) => {
  const x = new Date(d); const auj = new Date().toDateString() === x.toDateString();
  return auj ? x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
export const nonLus = (messages, conv, meId) => messages.filter((m) => m.conversation === conv && m.auteur_id !== meId && !(m.lu_par || []).includes(meId)).length;

export function Chat({ conversation, messages, me, onSend, onRead, height = 420, quick = [] }) {
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const list = messages.filter((m) => m.conversation === conversation).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [list.length, conversation]);
  useEffect(() => {
    const unread = list.filter((m) => m.auteur_id !== me.id && !(m.lu_par || []).includes(me.id));
    if (unread.length && onRead) onRead(unread);
  }, [list.length, conversation]);
  async function send(t) {
    const texte = (t ?? txt).trim();
    if (!texte || busy) return;
    setBusy(true);
    try { await onSend(texte); if (t === undefined) setTxt(''); } finally { setBusy(false); }
  }
  return html`<div class="chat" style=${{ height: typeof height === 'number' ? height + 'px' : height }}>
    <div class="chat-list" ref=${box}>
      ${list.length === 0 && html`<p class="muted small center-text">${tr('Aucun message. Écrivez le premier !', 'No message yet. Write the first one!', 'Mbola tsy misy hafatra. Soraty ny voalohany!')}</p>`}
      ${list.map((m) => {
        const mine = m.auteur_id === me.id;
        return html`<div class=${'msg' + (mine ? ' mine' : '') + (m.auteur_role === 'admin' ? ' admin' : '')} key=${m.id}>
          ${!mine && html`<small class="msg-who">${ROLE_ICON[m.auteur_role] || ''} ${m.auteur_nom || m.auteur_role}</small>`}
          <div class="bubble">${m.texte}</div>
          <small class="msg-time">${heureMsg(m.created_at)}${mine && (m.lu_par || []).some((u) => u !== me.id) ? ' · ✓✓' : ''}</small>
        </div>`;
      })}
    </div>
    ${quick.length > 0 && html`<div class="chat-quick">${quick.map((q) => html`<button class="chip" onClick=${() => send(q)}>${q}</button>`)}</div>`}
    <form class="chat-form" onSubmit=${(e) => { e.preventDefault(); send(); }}>
      <textarea rows="1" value=${txt} placeholder=${tr('Votre message…', 'Your message…', 'Ny hafatrao…')} onInput=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}></textarea>
      <button class="btn primary" disabled=${busy || !txt.trim()} aria-label=${tr('Envoyer', 'Send', 'Alefa')}>➤</button>
    </form>
  </div>`;
}
