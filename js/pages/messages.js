// Messagerie admin : toutes les conversations (clients, livreurs, invités).
import { html, useState } from '../lib.js?v=202610290734';
import { useApp, Empty } from '../ui.js?v=202610290734';
import { tr } from '../i18n.js?v=202610290734';
import { Chat, convLabel, nonLus } from '../chat.js?v=202610290734';

export function Messages() {
  const app = useApp();
  const { data, me, toast } = app;
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const [conv, setConv] = useState(q.get('c') || '');
  const [filtre, setFiltre] = useState('');
  const msgs = data.messages || [];
  const convs = [...new Set(msgs.map((m) => m.conversation))].map((c) => {
    const last = msgs.filter((m) => m.conversation === c).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    return { c, last, unread: nonLus(msgs, c, me.id) };
  }).sort((a, b) => String(b.last?.created_at).localeCompare(String(a.last?.created_at)));
  if (conv && !convs.some((x) => x.c === conv)) convs.unshift({ c: conv, last: null, unread: 0 });
  const shown = convs.filter((x) => !filtre || convLabel(x.c, data).toLowerCase().includes(filtre.toLowerCase()));
  const open = (c) => { setConv(c); history.replaceState(null, '', '#/messages?c=' + encodeURIComponent(c)); };
  const quick = conv.startsWith('livreur:')
    ? [tr('Merci !', 'Thanks!', 'Misaotra!'), tr('Appelle-moi STP', 'Please call me', 'Antsoy aho azafady'), tr('Le client attend, tu arrives quand ?', 'The customer is waiting, ETA?', 'Miandry ny client, rahoviana ianao tonga?')]
    : [tr('Bonjour 👋', 'Hello 👋', 'Manao ahoana 👋'), tr('Votre repas est en route 🛵', 'Your meal is on its way 🛵', 'Eny an-dalana ny sakafonao 🛵'), tr('Merci pour votre confiance 🙏', 'Thank you for your trust 🙏', 'Misaotra tamin\'ny fitokisana 🙏')];

  return html`<div class="page">
    <h1>💬 ${tr('Messages', 'Messages', 'Hafatra')}</h1>
    <div class=${'msg-layout' + (conv ? ' has-conv' : '')}>
      <aside class="conv-list">
        <input type="search" placeholder=${tr('Rechercher…', 'Search…', 'Hikaroka…')} value=${filtre} onInput=${(e) => setFiltre(e.target.value)} />
        <select onChange=${(e) => { if (e.target.value) open(e.target.value); e.target.value = ''; }}>
          <option value="">+ ${tr('Nouvelle conversation…', 'New conversation…', 'Resaka vaovao…')}</option>
          <optgroup label=${tr('Clients', 'Customers', 'Clients')}>${(data.clients || []).sort((a, b) => a.nom.localeCompare(b.nom)).map((c) => html`<option value=${'client:' + c.id}>${c.nom}</option>`)}</optgroup>
          <optgroup label=${tr('Livreurs', 'Couriers', 'Mpitondra')}>${(data.livreurs || []).map((l) => html`<option value=${'livreur:' + l.id}>${l.nom}</option>`)}</optgroup>
        </select>
        ${shown.length === 0 && html`<${Empty}>${tr('Aucune conversation.', 'No conversation.', 'Tsy misy resaka.')}<//>`}
        ${shown.map((x) => html`<button class=${'conv' + (x.c === conv ? ' on' : '')} onClick=${() => open(x.c)}>
          <span class="conv-name">${convLabel(x.c, data)}${x.unread ? html` <span class="nav-badge">${x.unread}</span>` : null}</span>
          <small class="muted">${x.last ? x.last.texte.slice(0, 60) : tr('Nouvelle', 'New', 'Vaovao')}</small>
        </button>`)}
      </aside>
      <section class="conv-pane">
        ${conv ? html`<div class="row gap between"><h2><button class="btn ghost small only-mobile" onClick=${() => setConv('')}>◀</button> ${convLabel(conv, data)}</h2>
            ${conv.startsWith('client:') && html`<a class="btn small ghost" href="#/clients">${tr('Fiche', 'Record', 'Fiche')}</a>`}</div>
          <${Chat} conversation=${conv} messages=${msgs} me=${me} quick=${quick} height="calc(100vh - 260px)" onSend=${(t) => app.send(conv, t).catch((e) => toast(e.message, 'bad'))} onRead=${app.markRead} />`
          : html`<${Empty}>${tr('Choisissez une conversation.', 'Choose a conversation.', 'Misafidiana resaka.')}<//>`}
      </section>
    </div>
  </div>`;
}
