// Paramètres : cuisine (point de départ), trafic, horaires, contacts, liens des applications, comptes.
import { html, useState } from '../lib.js?v=202610290637';
import { useApp, Card, Field, Badge, copyText } from '../ui.js?v=202610290637';
import { tr } from '../i18n.js?v=202610290637';
import { toNum } from '../calc.js?v=202610290637';
import { param, paramRow } from '../params.js?v=202610290637';
import { MapView } from '../map.js?v=202610290637';
import { MODE } from '../db.js?v=202610290637';

export function Parametres() {
  const app = useApp();
  const { data, toast } = app;
  const [depot, setDepot] = useState(param(data, 'depot'));
  const [trafic, setTrafic] = useState(param(data, 'trafic'));
  const [arret, setArret] = useState(param(data, 'arret_min'));
  const [departs, setDeparts] = useState(param(data, 'departs'));
  const [tel, setTel] = useState(param(data, 'telephone'));
  const [wa, setWa] = useState(param(data, 'whatsapp'));
  const [accueil, setAccueil] = useState(param(data, 'message_accueil'));
  const base = location.href.split('#')[0].replace(/index\.html$/, '').replace(/[^/]*$/, '');
  const liens = [['🙂 ' + tr('Application client', 'Customer app', 'App client'), base + 'client.html'], ['🛵 ' + tr('Application livreur', 'Courier app', 'App livreur'), base + 'livreur.html']];

  async function save() {
    try {
      await app.save('options', [paramRow('depot', { ...depot, lat: toNum(depot.lat), lng: toNum(depot.lng) }), paramRow('trafic', toNum(trafic) || 1.6), paramRow('arret_min', toNum(arret) ?? 4), paramRow('departs', departs), paramRow('telephone', tel), paramRow('whatsapp', wa), paramRow('message_accueil', accueil)]);
      toast(tr('Paramètres enregistrés', 'Settings saved', 'Voatahiry ny fikirana'));
    } catch (e) { toast(e.message, 'bad'); }
  }
  function maPosition() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => setDepot({ ...depot, lat: p.coords.latitude, lng: p.coords.longitude }), () => toast(tr('Position refusée', 'Position denied', 'Tsy azo ny toerana'), 'bad'), { enableHighAccuracy: true, timeout: 15000 });
  }
  const profils = [...(data.profils || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const roleLabel = { invite: tr('Invité', 'Guest', 'Vahiny'), client: 'Client', livreur: tr('Livreur', 'Courier', 'Mpitondra') };

  return html`<div class="page">
    <h1>⚙️ ${tr('Paramètres', 'Settings', 'Fikirana')}</h1>

    <${Card} title=${'📱 ' + tr('Liens des applications', 'App links', 'Rohy ho an\'ny app')}>
      ${liens.map(([l, u]) => html`<div class="row gap wrap between link-row"><span><b>${l}</b><br/><small class="muted mono">${u}</small></span><span class="row gap"><a class="btn small" href=${u} target="_blank" rel="noopener">${tr('Ouvrir', 'Open', 'Sokafy')}</a><button class="btn small ghost" onClick=${async () => toast((await copyText(u)) ? tr('Lien copié', 'Link copied', 'Voadika') : u)}>${tr('Copier', 'Copy', 'Adikao')}</button></span></div>`)}
      <p class="hint">${tr('Partagez le lien client sur Facebook, Instagram et WhatsApp. Sur téléphone, « Ajouter à l\'écran d\'accueil » l\'installe comme une application.', 'Share the customer link on Facebook, Instagram and WhatsApp. On phones, "Add to home screen" installs it as an app.', 'Zarao amin\'ny Facebook, Instagram ary WhatsApp ny rohy client. Amin\'ny finday, « Ajouter à l\'écran d\'accueil » no hametrahana azy ho app.')}</p>
      ${MODE === 'supabase' && html`<p class="warn-box small">${tr('Important (une seule fois) : dans Supabase → Authentication → URL Configuration, mettez « Site URL » = ', 'Important (once): in Supabase → Authentication → URL Configuration, set "Site URL" = ', 'Zava-dehibe (indray mandeha): ao amin\'ny Supabase → Authentication → URL Configuration, apetraho ny « Site URL » = ')}<b class="mono">${base}</b>${tr(' et ajoutez ', ' and add ', ' ary ampio ')}<b class="mono">${base}*</b>${tr(' dans « Redirect URLs », sinon les e-mails de confirmation renvoient vers une mauvaise adresse.', ' to "Redirect URLs", otherwise confirmation e-mails point to a wrong address.', ' ao amin\'ny « Redirect URLs », raha tsy izany dia diso adiresy ny mailaka fanamarinana.')}</p>`}
    <//>

    <${Card} title=${'🍳 ' + tr('Cuisine (point de départ des livraisons)', 'Kitchen (delivery start point)', 'Lakozia (fiaingan\'ny fanaterana)')}>
      <div class="form-grid">
        <${Field} label=${tr('Adresse', 'Address', 'Adiresy')} wide><input value=${depot.adresse || ''} onInput=${(e) => setDepot({ ...depot, adresse: e.target.value })} /><//>
        <${Field} label="Latitude"><input value=${depot.lat ?? ''} onInput=${(e) => setDepot({ ...depot, lat: e.target.value })} /><//>
        <${Field} label="Longitude"><input value=${depot.lng ?? ''} onInput=${(e) => setDepot({ ...depot, lng: e.target.value })} /><//>
      </div>
      <div class="row gap wrap"><button class="btn small" onClick=${maPosition}>📍 ${tr('Utiliser ma position', 'Use my position', 'Ampiasao ny toerako')}</button><span class="muted small">${tr('ou touchez la carte', 'or tap the map', 'na tsindrio ny sarintany')}</span></div>
      <${MapView} height=${260} markers=${[{ ...depot, icon: 'kitchen' }]} fitKey=${'d'} onPick=${(p) => setDepot({ ...depot, ...p })} />
    <//>

    <${Card} title=${'🧭 ' + tr('Itinéraires et horaires', 'Routes and times', 'Lalana sy ora')}>
      <div class="form-grid">
        <${Field} label=${tr('Facteur trafic', 'Traffic factor', 'Fitomboan\'ny fotoana (fitohanana)')} hint=${tr('Temps « sans bouchon » × ce facteur. 1,6 = Tana aux heures de pointe.', 'Free-flow time × this factor.', 'Fotoana tsy misy fitohanana × ity isa ity.')}><input type="number" step="0.1" min="1" value=${trafic} onInput=${(e) => setTrafic(e.target.value)} /><//>
        <${Field} label=${tr('Minutes par livraison', 'Minutes per stop', 'Minitra isaky ny fanaterana')}><input type="number" min="0" value=${arret} onInput=${(e) => setArret(e.target.value)} /><//>
        ${['matin', 'midi', 'soir'].map((k) => html`<${Field} label=${tr('Départ ', 'Departure ', 'Fiaingana ') + { matin: tr('matin', 'morning', 'maraina'), midi: tr('midi', 'noon', 'atoandro'), soir: tr('soir', 'evening', 'hariva') }[k]}><input type="time" value=${departs[k] || ''} onInput=${(e) => setDeparts({ ...departs, [k]: e.target.value })} /><//>`)}
      </div>
    <//>

    <${Card} title=${'☎️ ' + tr('Contact affiché aux clients', 'Contact shown to customers', 'Fifandraisana hitan\'ny client')}>
      <div class="form-grid">
        <${Field} label=${tr('Téléphone', 'Phone', 'Finday')}><input type="tel" value=${tel} onInput=${(e) => setTel(e.target.value)} /><//>
        <${Field} label="WhatsApp"><input type="tel" value=${wa} onInput=${(e) => setWa(e.target.value)} placeholder="261340000000" /><//>
        <${Field} label=${tr('Message d\'accueil (application client)', 'Welcome message (customer app)', 'Hafatra fandraisana (app client)')} wide><textarea rows="2" value=${accueil} onInput=${(e) => setAccueil(e.target.value)}></textarea><//>
      </div>
    <//>
    <div class="row gap"><button class="btn primary" onClick=${save}>${tr('Enregistrer les paramètres', 'Save settings', 'Tehirizo ny fikirana')}</button></div>

    <${Card} title=${'👥 ' + tr('Comptes inscrits', 'Registered accounts', 'Kaonty voasoratra') + ` (${profils.length})`}>
      <p class="muted small">${tr('Un compte devient « Client » ou « Livreur » automatiquement quand son e-mail est indiqué dans la fiche client ou livreur. Sinon il reste « Invité » (démo limitée).', 'An account becomes "Customer" or "Courier" automatically when its e-mail is entered in the customer or courier record. Otherwise it stays "Guest" (limited demo).', 'Lasa « Client » na « Livreur » ho azy ny kaonty rehefa voasoratra ao amin\'ny fiche ny mailakany. Raha tsy izany dia « Vahiny » (démo voafetra).')}</p>
      <div class="table-wrap"><table class="table resp"><thead><tr><th>E-mail</th><th>${tr('Nom', 'Name', 'Anarana')}</th><th>${tr('Rôle', 'Role', 'Andraikitra')}</th><th>${tr('Inscrit le', 'Signed up', 'Nisoratra')}</th><th></th></tr></thead>
        <tbody>${profils.map((p) => html`<tr><td>${p.email}</td><td>${p.nom || '—'}</td><td><${Badge} tone=${p.role === 'invite' ? 'muted' : 'ok'}>${roleLabel[p.role] || p.role}<//></td><td class="small">${p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—'}</td>
          <td>${p.role === 'invite' ? html`<a href=${'#/messages?c=user:' + p.user_id}>💬</a>` : null}</td></tr>`)}</tbody></table></div>
    <//>
  </div>`;
}
