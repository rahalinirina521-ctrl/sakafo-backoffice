// Messagerie interne façon WhatsApp : bulles (mes messages à droite), séparateurs de jours, accusés de lecture,
// liste des conversations avec aperçu et compteur de non-lus. Temps réel via Supabase.
import { html, useState, useEffect, useRef } from './lib.js?v=202610291427';
import { tr } from './i18n.js?v=202610291427';

const ROLE_ICON = { admin: '🧑‍🍳', client: '🙂', livreur: '🛵', invite: '👤' };
const pseudoDe = (data, cid) => (data.communaute || []).find((c) => c.client_id === cid)?.pseudo;
// Nom lisible d'une conversation, du point de vue de « moi » (meClientId pour les conversations entre amis)
export const convLabel = (conv, data, meClientId) => {
  const [k, rest] = [String(conv).split(':')[0], String(conv).slice(String(conv).indexOf(':') + 1)];
  const nomClient = (id) => (data.clients || []).find((c) => c.id === id)?.nom || pseudoDe(data, id) || id;
  if (k === 'client') return meClientId ? '🧑‍🍳 ' + tr('Équipe Sakafo', 'Sakafo team', 'Ekipa Sakafo') : '🙂 ' + nomClient(rest);
  if (k === 'livclient') return meClientId ? '🛵 ' + tr('Mon livreur', 'My courier', 'Ny mpitondra') : '🛵↔🙂 ' + nomClient(rest);
  if (k === 'livreur') return '🛵 ' + ((data.livreurs || []).find((c) => c.id === rest)?.nom || rest);
  if (k === 'user') { const p = (data.profils || []).find((x) => x.user_id === rest); return '👤 ' + (p?.nom || p?.email || tr('Invité', 'Guest', 'Vahiny')); }
  if (k === 'dm') { const [a, b] = rest.split('|'); const autre = a === meClientId ? b : a; return '🤝 ' + (pseudoDe(data, autre) || tr('Ami', 'Friend', 'Namana')); }
  return conv;
};
export const dmId = (a, b) => 'dm:' + [a, b].sort().join('|');
const heure = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const jourLabel = (d) => {
  const x = new Date(d); const n = new Date(); const hier = new Date(Date.now() - 864e5);
  if (x.toDateString() === n.toDateString()) return tr('Aujourd\'hui', 'Today', 'Androany');
  if (x.toDateString() === hier.toDateString()) return tr('Hier', 'Yesterday', 'Omaly');
  return x.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};
const quand = (d) => { const x = new Date(d); return new Date().toDateString() === x.toDateString() ? heure(d) : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
export const nonLus = (messages, conv, meId) => messages.filter((m) => m.conversation === conv && m.auteur_id !== meId && !(m.lu_par || []).includes(meId)).length;
const initiales = (s) => String(s || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() || '').join('') || '💬';

// Liste des conversations : [{ conv, label, sous }]
export function ConvList({ items, messages, me, actif, onOpen, vide }) {
  const rows = items.map((it) => {
    const list = messages.filter((m) => m.conversation === it.conv);
    const last = list.reduce((a, m) => (!a || String(m.created_at) > String(a.created_at) ? m : a), null);
    return { ...it, last, unread: nonLus(messages, it.conv, me.id) };
  }).sort((a, b) => (b.epingle ? 1 : 0) - (a.epingle ? 1 : 0) || String(b.last?.created_at || '').localeCompare(String(a.last?.created_at || '')));
  if (!rows.length) return html`<p class="muted small center-text">${vide || tr('Aucune conversation.', 'No conversation.', 'Tsy misy resaka.')}</p>`;
  return html`<div class="wa-list">${rows.map((r) => html`<button class=${'wa-item' + (r.conv === actif ? ' on' : '') + (r.unread ? ' unread' : '')} onClick=${() => onOpen(r.conv)} key=${r.conv}>
    <span class=${'wa-av ' + (r.couleur || '')}>${r.icone || initiales(r.label)}</span>
    <span class="wa-mid"><b>${r.label}</b><small>${r.last ? (r.last.auteur_id === me.id ? tr('Vous : ', 'You: ', 'Ianao: ') : '') + r.last.texte.replace(/\n/g, ' ').slice(0, 70) : r.sous || tr('Démarrer la conversation', 'Start the conversation', 'Hanomboka ny resaka')}</small></span>
    <span class="wa-end"><small>${r.last ? quand(r.last.created_at) : ''}</small>${r.unread ? html`<i class="wa-badge">${r.unread}</i>` : null}</span>
  </button>`)}</div>`;
}

export function Chat({ conversation, messages, me, onSend, onRead, height = 420, quick = [], titre, sousTitre, onBack, readOnly }) {
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef(null); const ta = useRef(null);
  const list = messages.filter((m) => m.conversation === conversation).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  useEffect(() => { if (box.current) box.current.scrollTo({ top: box.current.scrollHeight, behavior: list.length > 30 ? 'auto' : 'smooth' }); }, [list.length, conversation]);
  useEffect(() => {
    const unread = list.filter((m) => m.auteur_id !== me.id && !(m.lu_par || []).includes(me.id));
    if (unread.length && onRead) onRead(unread);
  }, [list.length, conversation]);
  useEffect(() => { if (ta.current) { ta.current.style.height = 'auto'; ta.current.style.height = Math.min(120, ta.current.scrollHeight) + 'px'; } }, [txt]);
  async function send(t) {
    const texte = (t ?? txt).trim();
    if (!texte || busy) return;
    setBusy(true);
    try { await onSend(texte); if (t === undefined) setTxt(''); } catch (e) { /* message d'erreur affiché par l'appelant */ } finally { setBusy(false); }
  }
  let jourPrec = ''; let auteurPrec = '';
  return html`<div class="chat wa" style=${{ height: typeof height === 'number' ? height + 'px' : height }}>
    ${titre && html`<header class="wa-head">${onBack && html`<button class="wa-back" onClick=${onBack} aria-label=${tr('Retour', 'Back', 'Hiverina')}>‹</button>`}<span class="wa-av sm">${initiales(titre)}</span><span class="wa-mid"><b>${titre}</b>${sousTitre && html`<small>${sousTitre}</small>`}</span></header>`}
    <div class="chat-list wa-body" ref=${box}>
      ${list.length === 0 && html`<div class="wa-empty">💬<p>${tr('Aucun message. Écrivez le premier !', 'No message yet. Write the first one!', 'Mbola tsy misy hafatra. Soraty ny voalohany!')}</p></div>`}
      ${list.map((m) => {
        const mine = m.auteur_id === me.id;
        const j = new Date(m.created_at).toDateString();
        const sep = j !== jourPrec; jourPrec = j;
        const suite = !sep && auteurPrec === (m.auteur_id || m.auteur_role); auteurPrec = m.auteur_id || m.auteur_role;
        const lu = mine && (m.lu_par || []).some((u) => u !== me.id);
        return html`${sep && html`<div class="wa-day"><span>${jourLabel(m.created_at)}</span></div>`}
          <div class=${'msg' + (mine ? ' mine' : '') + (m.auteur_role === 'admin' && !mine ? ' admin' : '') + (suite ? ' suite' : '')} key=${m.id}>
            ${!mine && !suite && html`<small class="msg-who">${ROLE_ICON[m.auteur_role] || ''} ${m.auteur_nom || m.auteur_role}</small>`}
            <div class="bubble">${m.texte}<span class="b-meta">${heure(m.created_at)}${mine ? html`<i class=${'tick' + (lu ? ' lu' : '')}>${lu ? '✓✓' : '✓'}</i>` : null}</span></div>
          </div>`;
      })}
    </div>
    ${readOnly ? html`<div class="wa-ro">${readOnly}</div>` : html`
    ${quick.length > 0 && html`<div class="chat-quick">${quick.map((q) => html`<button class="chip" onClick=${() => send(q)}>${q}</button>`)}</div>`}
    <form class="chat-form" onSubmit=${(e) => { e.preventDefault(); send(); }}>
      <textarea ref=${ta} rows="1" value=${txt} placeholder=${tr('Écrire un message…', 'Write a message…', 'Manorata hafatra…')} onInput=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(); } }}></textarea>
      <button class="send" disabled=${busy || !txt.trim()} aria-label=${tr('Envoyer', 'Send', 'Alefa')}>➤</button>
    </form>`}
  </div>`;
}
