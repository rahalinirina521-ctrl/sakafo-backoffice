// Paramètres : cuisine (point de départ), trafic, horaires, contacts, liens des applications, comptes.
import { html, useState, useEffect } from '../lib.js?v=202610291423';
import { useApp, Card, Field, Badge, copyText } from '../ui.js?v=202610291423';
import { tr } from '../i18n.js?v=202610291423';
import { toNum } from '../calc.js?v=202610291423';
import { param, paramRow } from '../params.js?v=202610291423';
import { MapView } from '../map.js?v=202610291423';
import { pushPossible, etatPush, activerPush, desactiverPush } from '../push.js?v=202610291423';
import { MODE } from '../db.js?v=202610291423';
import { CompteCard } from '../shell.js?v=202610291423';

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
  const [inactivite, setInactivite] = useState(param(data, 'inactivite_min'));
  const base = location.href.split('#')[0].replace(/index\.html$/, '').replace(/[^/]*$/, '');
  const liens = [['🔐 ' + tr('Page de connexion (lien à partager)', 'Sign-in page (link to share)', 'Pejy fidirana (rohy hozaraina)'), base + 'connexion.html'], ['🙂 ' + tr('Application client', 'Customer app', 'App client'), base + 'client.html'], ['🛵 ' + tr('Application livreur', 'Courier app', 'App livreur'), base + 'livreur.html']];

  async function save() {
    try {
      await app.save('options', [paramRow('depot', { ...depot, lat: toNum(depot.lat), lng: toNum(depot.lng) }), paramRow('trafic', toNum(trafic) || 1.6), paramRow('arret_min', toNum(arret) ?? 4), paramRow('departs', departs), paramRow('telephone', tel), paramRow('whatsapp', wa), paramRow('message_accueil', accueil), paramRow('inactivite_min', toNum(inactivite) ?? 60)]);
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
    ${MODE === 'supabase' && html`<${CompteCard} email=${app.me?.email || ''} nom=${tr('Administrateur', 'Administrator', 'Mpitantana')} role="admin" toast=${toast} />`}

    <${Card} title=${'📱 ' + tr('Liens des applications', 'App links', 'Rohy ho an\'ny app')}>
      ${liens.map(([l, u]) => html`<div class="row gap wrap between link-row"><span><b>${l}</b><br/><small class="muted mono">${u}</small></span><span class="row gap"><a class="btn small" href=${u} target="_blank" rel="noopener">${tr('Ouvrir', 'Open', 'Sokafy')}</a><button class="btn small ghost" onClick=${async () => toast((await copyText(u)) ? tr('Lien copié', 'Link copied', 'Voadika') : u)}>${tr('Copier', 'Copy', 'Adikao')}</button></span></div>`)}
      <p class="hint">${tr('Partagez le lien client sur Facebook, Instagram et WhatsApp. Sur téléphone, « Ajouter à l\'écran d\'accueil » l\'installe comme une application.', 'Share the customer link on Facebook, Instagram and WhatsApp. On phones, "Add to home screen" installs it as an app.', 'Zarao amin\'ny Facebook, Instagram ary WhatsApp ny rohy client. Amin\'ny finday, « Ajouter à l\'écran d\'accueil » no hametrahana azy ho app.')}</p>
      ${MODE === 'supabase' && html`<p class="warn-box small">${tr('Important (une seule fois) : dans Supabase → Authentication → URL Configuration, mettez « Site URL » = ', 'Important (once): in Supabase → Authentication → URL Configuration, set "Site URL" = ', 'Zava-dehibe (indray mandeha): ao amin\'ny Supabase → Authentication → URL Configuration, apetraho ny « Site URL » = ')}<b class="mono">${base}connexion.html</b>${tr(' et ajoutez ', ' and add ', ' ary ampio ')}<b class="mono">${base}*</b>${tr(' dans « Redirect URLs », sinon les e-mails de confirmation renvoient vers une mauvaise adresse.', ' to "Redirect URLs", otherwise confirmation e-mails point to a wrong address.', ' ao amin\'ny « Redirect URLs », raha tsy izany dia diso adiresy ny mailaka fanamarinana.')}</p>`}
    <//>

    <${PushCard} />

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
    <${Card} title=${'🛡️ ' + tr('Sécurité', 'Security', 'Fiarovana')}>
      <div class="form-grid"><${Field} label=${tr('Déconnexion automatique du back-office après (minutes sans activité)', 'Auto sign-out of the back-office after (idle minutes)', 'Mivoaka ho azy aorian\'ny (minitra tsy miasa)')} hint=${tr('0 = jamais. Conseillé : 60.', '0 = never. Recommended: 60.', '0 = tsy mivoaka mihitsy. Atoro: 60.')}><input type="number" min="0" max="1440" value=${inactivite} onInput=${(e) => setInactivite(e.target.value)} /><//></div>
      <ul class="small sec-list">
        <li>✅ ${tr('Chaque client ne voit que ses propres données (règles de sécurité de la base).', 'Each customer only sees their own data (database security rules).', 'Ny azy ihany no hitan\'ny client tsirairay.')}</li>
        <li>✅ ${tr('Blocage 15 min après 6 mots de passe erronés sur un même nom d\'utilisateur.', '15-min lock after 6 wrong passwords on a username.', 'Voasakana 15 min aorian\'ny diso 6.')}</li>
        <li>✅ ${tr('Journal des modifications et corbeille (Sauvegarde).', 'Change log and bin (Backup).', 'Tantaran\'ny fanovana sy corbeille.')}</li>
        <li>✅ ${tr('Sauvegarde automatique chaque nuit.', 'Automatic nightly backup.', 'Fitahirizana isan\'alina.')}</li>
        <li>⚠️ ${tr('À activer une fois dans Supabase → Authentication → « Leaked password protection » (refuse les mots de passe piratés connus).', 'Enable once in Supabase → Authentication → "Leaked password protection".', 'Alefaso indray mandeha ao amin\'ny Supabase → Authentication → « Leaked password protection ».')}</li>
      </ul>
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

function PushCard() {
  const { data, toast } = useApp();
  const [etat, setEtat] = useState('…');
  const [busy, setBusy] = useState(false);
  useEffect(() => { etatPush().then(setEtat).catch(() => setEtat('impossible')); }, []);
  async function on() { setBusy(true); try { await activerPush(data); setEtat('actif'); toast(tr('Notifications activées sur cet appareil 🔔', 'Notifications enabled on this device 🔔', 'Mandeha ny fampahafantarana 🔔')); } catch (e) { toast(e.message, 'bad'); } setBusy(false); }
  async function off() { setBusy(true); try { await desactiverPush(); setEtat('inactif'); } catch (e) { toast(e.message, 'bad'); } setBusy(false); }
  return html`<${Card} title=${'🔔 ' + tr('Notifications sur ce téléphone / ordinateur', 'Notifications on this phone / computer', 'Fampahafantarana amin\'ity finday / ordinateur ity')}>
    <p class="small">${tr('Recevez une alerte à chaque nouvelle inscription et à chaque message d\'un client ou d\'un livreur, même quand le back-office est fermé. À activer sur chaque appareil (téléphone, PC).', 'Get an alert for every new sign-up and every message, even when the back-office is closed. Enable on each device.', 'Mahazo fampahafantarana isaky ny misy misoratra vaovao na hafatra, na mikatona aza ny back-office. Alefaso isaky ny fitaovana (finday, PC).')}</p>
    ${etat === 'actif' ? html`<div class="row gap wrap"><${Badge} tone="ok">✓ ${tr('Activées sur cet appareil', 'Enabled on this device', 'Mandeha eto')}<//><button class="btn small ghost" disabled=${busy} onClick=${off}>${tr('Désactiver', 'Disable', 'Ajanony')}</button></div>`
      : etat === 'refuse' ? html`<p class="warn-box small">${tr('Les notifications sont bloquées pour ce site dans le navigateur : autorisez-les dans les réglages du site (icône 🔒 à côté de l\'adresse).', 'Notifications are blocked for this site: allow them in the site settings.', 'Voasakana ny fampahafantarana: avelao ao amin\'ny fikirana ny site (🔒 eo akaikin\'ny adiresy).')}</p>`
      : etat === 'impossible' ? html`<p class="warn-box small">${tr('Ce navigateur ne gère pas les notifications push. Sur iPhone : Safari → Partager → « Sur l\'écran d\'accueil », puis ouvrez le site depuis l\'icône.', 'This browser does not support push. On iPhone: Safari → Share → "Add to Home Screen", then open from the icon.', 'Tsy mahavita push ity navigateur ity. iPhone: Safari → Partager → « Sur l\'écran d\'accueil », dia sokafy avy amin\'ny icône.')}</p>`
      : html`<button class="btn primary" disabled=${busy || MODE !== 'supabase'} onClick=${on}>🔔 ${tr('Activer les notifications sur cet appareil', 'Enable notifications on this device', 'Alefaso eto ny fampahafantarana')}</button>`}
  <//>`;
}
