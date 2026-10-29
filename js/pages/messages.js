// Messagerie admin : clients, livreurs, invités — liste à gauche, conversation à droite (une seule colonne sur téléphone).
import { html, useState } from '../lib.js?v=202610291028';
import { useApp } from '../ui.js?v=202610291028';
import { tr } from '../i18n.js?v=202610291028';
import { Chat, ConvList, convLabel } from '../chat.js?v=202610291028';

export function Messages() {
  const app = useApp();
  const { data, me, toast } = app;
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const [conv, setConv] = useState(q.get('c') || '');
  const [filtre, setFiltre] = useState('');
  const [onglet, setOnglet] = useState('tous');
  const msgs = data.messages || [];
  const convs = [...new Set([...msgs.map((m) => m.conversation), ...(conv ? [conv] : [])])].filter((c) => !c.startsWith('dm:'));
  const type = (c) => (c.startsWith('livreur:') ? 'livreurs' : c.startsWith('user:') ? 'invites' : 'clients');
  const items = convs.filter((c) => onglet === 'tous' || type(c) === onglet)
    .map((c) => ({ conv: c, label: convLabel(c, data).replace(/^\S+\s/, ''), icone: c.startsWith('livreur:') || c.startsWith('livclient:') ? '🛵' : c.startsWith('user:') ? '👤' : null, couleur: type(c) }))
    .filter((it) => !filtre || it.label.toLowerCase().includes(filtre.toLowerCase()));
  const open = (c) => { setConv(c); history.replaceState(null, '', '#/messages?c=' + encodeURIComponent(c)); };
  const quick = conv.startsWith('livreur:')
    ? [tr('Merci !', 'Thanks!', 'Misaotra!'), tr('Appelle-moi STP', 'Please call me', 'Antsoy aho azafady'), tr('Le client attend, tu arrives quand ?', 'The customer is waiting, ETA?', 'Miandry ny client, rahoviana ianao tonga?')]
    : [tr('Bonjour 👋', 'Hello 👋', 'Manao ahoana 👋'), tr('Votre repas est en route 🛵', 'Your meal is on its way 🛵', 'Eny an-dalana ny sakafonao 🛵'), tr('Merci pour votre confiance 🙏', 'Thank you for your trust 🙏', 'Misaotra tamin\'ny fitokisana 🙏')];
  const nouveaux = [...(data.clients || []).map((c) => ['client:' + c.id, '🙂 ' + c.nom]), ...(data.livreurs || []).map((l) => ['livreur:' + l.id, '🛵 ' + l.nom])];

  return html`<div class="page">
    <h1>💬 ${tr('Messages', 'Messages', 'Hafatra')}</h1>
    <div class=${'msg-layout' + (conv ? ' has-conv' : '')}>
      <aside class="conv-list card">
        <div class="seg">${[['tous', tr('Tous', 'All', 'Rehetra')], ['clients', tr('Clients', 'Customers', 'Client')], ['livreurs', tr('Livreurs', 'Couriers', 'Mpitondra')], ['invites', tr('Invités', 'Guests', 'Vahiny')]].map(([k, l]) => html`<button class=${onglet === k ? 'on' : ''} onClick=${() => setOnglet(k)}>${l}</button>`)}</div>
        <input type="search" placeholder=${tr('Rechercher…', 'Search…', 'Hikaroka…')} value=${filtre} onInput=${(e) => setFiltre(e.target.value)} />
        <select onChange=${(e) => { if (e.target.value) open(e.target.value); e.target.value = ''; }}>
          <option value="">✏️ ${tr('Nouvelle conversation…', 'New conversation…', 'Resaka vaovao…')}</option>
          ${nouveaux.map(([v, l]) => html`<option value=${v}>${l}</option>`)}
        </select>
        <${ConvList} items=${items} messages=${msgs} me=${me} actif=${conv} onOpen=${open} />
      </aside>
      <section class="conv-pane">
        ${conv ? html`<${Chat} conversation=${conv} messages=${msgs} me=${me} quick=${quick} height="calc(100vh - 170px)" titre=${convLabel(conv, data).replace(/^\S+\s/, '')}
            sousTitre=${conv.startsWith('client:') ? tr('Client', 'Customer', 'Client') : conv.startsWith('livreur:') ? tr('Livreur', 'Courier', 'Mpitondra') : conv.startsWith('livclient:') ? tr('Livreur ↔ client (lecture)', 'Courier ↔ customer', 'Mpitondra ↔ client') : tr('Invité', 'Guest', 'Vahiny')}
            onBack=${() => setConv('')} onSend=${(t) => app.send(conv, t).catch((e) => toast(e.message, 'bad'))} onRead=${app.markRead} />`
          : html`<div class="wa-empty big">💬<p>${tr('Choisissez une conversation', 'Choose a conversation', 'Misafidiana resaka')}</p></div>`}
      </section>
    </div>
  </div>`;
}
