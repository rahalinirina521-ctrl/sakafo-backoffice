// Page de connexion unique : nom d'utilisateur (ou e-mail) + mot de passe, inscription des clients, compte démo.
import { html, render, useState, useEffect } from './lib.js?v=202610291423';
import { MODE, getSession, onAuthChange, whoami, connexion, signUp, resetPassword, usernameLibre, lireTable, seSouvenir } from './db.js?v=202610291423';
import { tr, catName } from './i18n.js?v=202610291423';
import { LangSwitch, useLang, NewPassword, deconnecter, roleLabel } from './shell.js?v=202610291423';
import { Logo } from './logo.js?v=202610291423';
import { ThemeToggle } from './theme.js?v=202610291423';

const destination = (w) => (w.admin ? 'index.html' : w.livreur_id || w.role === 'livreur' ? 'livreur.html' : 'client.html');
const nettoie = (u) => String(u || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);

function Connexion() {
  const [lang, setLang] = useLang();
  const params = new URLSearchParams(location.search);
  const [mode, setMode] = useState(params.has('inscription') || location.hash === '#inscription' ? 'signup' : 'login');
  const [etat, setEtat] = useState('verif'); // verif | form | connecte | redirection
  const [moi, setMoi] = useState(null);
  const deco = params.get('deconnecte');
  const [recovery, setRecovery] = useState(false);
  const [objectifs, setObjectifs] = useState([]);

  async function allerVersEspace() {
    setEtat('redirection');
    try { const w = await whoami(); location.replace(destination(w)); } catch (e) { setEtat('form'); }
  }
  useEffect(() => {
    let stop = () => {};
    (async () => {
      stop = await onAuthChange((ev) => { if (ev === 'PASSWORD_RECOVERY') setRecovery(true); });
      if (MODE === 'demo') { location.replace('index.html'); return; }
      const s = await getSession();
      if (s && !location.hash.includes('type=recovery')) {
        // Déjà connecté : on le montre clairement au lieu de rediriger sans prévenir
        try { const w = await whoami(); setMoi({ ...w, email: s.user?.email }); setEtat('connecte'); } catch (e) { setEtat('form'); }
      } else setEtat('form');
    })();
    lireTable('categories').then((cs) => setObjectifs(cs.filter((c) => c.statut !== 'attente').sort((a, b) => (a.ordre || 0) - (b.ordre || 0)))).catch(() => {});
    return () => stop();
  }, []);

  if (recovery) return html`<div class="cx-wrap"><${NewPassword} onDone=${() => { setRecovery(false); allerVersEspace(); }} /></div>`;
  return html`<div class="cx-wrap">
    <section class="cx-hero">
      <div class="cx-logo"><${Logo} size=${52} titre /></div>
      <h1>${tr('Des repas calculés pour votre objectif, livrés chez vous.', 'Meals calculated for your goal, delivered to your door.', 'Sakafo kajiana araka ny tanjonao, aterina any aminao.')}</h1>
      <ul class="cx-points">
        <li>🎯 ${tr('Perte de poids, muscle, diabète, grossesse…', 'Weight loss, muscle, diabetes, pregnancy…', 'Fihenan\'ny lanja, hozatra, diabeta, fitondrana vohoka…')}</li>
        <li>📈 ${tr('Suivi de votre progression et prévisions', 'Progress tracking and forecasts', 'Fanaraha-maso ny fandrosoana sy vinavina')}</li>
        <li>🛵 ${tr('Livreur suivi en direct sur la carte', 'Live courier tracking on the map', 'Mpitondra arahina mivantana amin\'ny sarintany')}</li>
        <li>💬 ${tr('Messages avec notre équipe', 'Messages with our team', 'Hafatra amin\'ny ekipanay')}</li>
      </ul>
    </section>
    <section class="cx-card card">
      <div class="row between"><h2>${mode === 'signup' ? tr('Créer un compte', 'Create an account', 'Hamorona kaonty') : mode === 'reset' ? tr('Mot de passe oublié', 'Forgot password', 'Hadino ny teny miafina') : tr('Connexion', 'Sign in', 'Fidirana')}</h2><span class="row gap"><${ThemeToggle} compact /><${LangSwitch} lang=${lang} onChange=${setLang} /></span></div>
      ${deco !== null && etat === 'form' && html`<p class="ok-box small">✓ ${deco === 'tous' ? tr('Vous êtes déconnecté de tous les appareils.', 'You are signed out of all devices.', 'Nivoaka tamin\'ny fitaovana rehetra ianao.') : tr('Vous êtes déconnecté.', 'You are signed out.', 'Nivoaka ianao.')}</p>`}
      ${etat === 'connecte' && moi ? html`<div class="col">
          <div class="deja"><span class="avatar big">${(moi.email || '?')[0].toUpperCase()}</span><div><small class="muted">${tr('Vous êtes connecté en tant que', 'You are signed in as', 'Tafiditra ho')}</small><b>${moi.email}</b><span class="badge muted">${moi.admin ? roleLabel('admin') : roleLabel(moi.livreur_id ? 'livreur' : moi.client_id ? 'client' : 'invite')}</span></div></div>
          <button class="btn primary big" onClick=${allerVersEspace}>${moi.admin ? tr('Ouvrir le back-office →', 'Open the back-office →', 'Hanokatra ny back-office →') : tr('Continuer vers mon espace →', 'Continue to my space →', 'Hiditra amin\'ny toerako →')}</button>
          <button class="btn big" onClick=${() => deconnecter()}>⎋ ${tr('Se déconnecter / changer de compte', 'Sign out / switch account', 'Hivoaka / hanova kaonty')}</button>
        </div>`
      : etat !== 'form' ? html`<p class="muted center-text">${etat === 'redirection' ? tr('Ouverture de votre espace…', 'Opening your space…', 'Manokatra ny toeranao…') : '…'}</p>`
        : mode === 'signup' ? html`<${Inscription} objectifs=${objectifs} onLogin=${() => setMode('login')} />`
        : mode === 'reset' ? html`<${Oubli} onBack=${() => setMode('login')} />`
        : html`<${Login} onOk=${allerVersEspace} onSignup=${() => setMode('signup')} onReset=${() => setMode('reset')} />`}
    </section>
  </div>`;
}

function Mdp({ value, onInput, autocomplete, placeholder }) {
  const [voir, setVoir] = useState(false);
  return html`<div class="pwd"><input type=${voir ? 'text' : 'password'} required value=${value} onInput=${onInput} autocomplete=${autocomplete} placeholder=${placeholder || ''} />
    <button type="button" class="pwd-eye" onClick=${() => setVoir(!voir)} aria-label=${tr('Afficher le mot de passe', 'Show password', 'Asehoy')}>${voir ? '🙈' : '👁'}</button></div>`;
}

function Login({ onOk, onSignup, onReset }) {
  const [id, setId] = useState(() => { try { return localStorage.getItem('sakafo_last_user') || ''; } catch (e) { return ''; } });
  const [pwd, setPwd] = useState('');
  const [souvenir, setSouvenir] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // connexion.html?demo : entre directement dans le compte démo
  useEffect(() => { if (new URLSearchParams(location.search).has('demo')) go('demo', 'demo'); }, []);
  async function go(i = id, p = pwd) {
    setBusy(true); setErr('');
    try { await connexion(i, p); seSouvenir(i === 'demo' ? false : souvenir); try { if (i !== 'demo') localStorage.setItem('sakafo_last_user', i.trim()); } catch (e) { /* */ } await onOk(); } catch (x) { setErr(x.message || String(x)); setBusy(false); }
  }
  return html`<form class="col" onSubmit=${(e) => { e.preventDefault(); go(); }}>
    <label class="field"><span class="field-label">${tr('Nom d\'utilisateur ou e-mail', 'Username or e-mail', 'Anarana mpampiasa na mailaka')}</span>
      <input required value=${id} onInput=${(e) => setId(e.target.value)} autocomplete="username" autocapitalize="none" spellcheck="false" placeholder=${tr('ex. rasoa.hanta', 'e.g. rasoa.hanta', 'ohatra rasoa.hanta')} /></label>
    <label class="field"><span class="field-label">${tr('Mot de passe', 'Password', 'Teny miafina')}</span><${Mdp} value=${pwd} onInput=${(e) => setPwd(e.target.value)} autocomplete="current-password" /></label>
    <label class="check"><input type="checkbox" checked=${souvenir} onChange=${(e) => setSouvenir(e.target.checked)} /> ${tr('Rester connecté sur cet appareil', 'Keep me signed in on this device', 'Avelao hiditra foana amin\'ity fitaovana ity')}</label>
    ${err && html`<p class="error">${err}</p>`}
    <button class="btn primary big" disabled=${busy}>${busy ? tr('Connexion…', 'Signing in…', 'Miditra…') : tr('Se connecter', 'Sign in', 'Hiditra')}</button>
    <button type="button" class="link-btn small" onClick=${onReset}>${tr('Mot de passe oublié ?', 'Forgot password?', 'Hadino ny teny miafina?')}</button>
    <div class="cx-sep"><span>${tr('Nouveau ?', 'New here?', 'Vaovao?')}</span></div>
    <button type="button" class="btn big" onClick=${onSignup}>✨ ${tr('Créer mon compte', 'Create my account', 'Hamorona ny kaontiko')}</button>
    <div class="cx-demo">
      <div><b>👀 ${tr('Compte démo', 'Demo account', 'Kaonty démo')}</b><small>${tr('Utilisateur', 'Username', 'Mpampiasa')} : <code>demo</code> · ${tr('Mot de passe', 'Password', 'Teny miafina')} : <code>demo</code></small></div>
      <button type="button" class="btn small" disabled=${busy} onClick=${() => { setId('demo'); setPwd('demo'); go('demo', 'demo'); }}>${tr('Essayer', 'Try it', 'Andramo')}</button>
    </div>
  </form>`;
}

function Inscription({ objectifs, onLogin }) {
  const [f, setF] = useState({ nom: '', username: '', telephone: '', objectif: '', email: '', pwd: '', pwd2: '' });
  const [libre, setLibre] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    const u = nettoie(f.username);
    if (u.length < 3) { setLibre(null); return undefined; }
    const t = setTimeout(() => usernameLibre(u).then(setLibre).catch(() => setLibre(null)), 400);
    return () => clearTimeout(t);
  }, [f.username]);
  async function submit(e) {
    e.preventDefault(); setMsg(null);
    const u = nettoie(f.username);
    if (u.length < 3) return setMsg({ ok: false, t: tr('Nom d\'utilisateur : 3 caractères minimum (lettres, chiffres, . _ -).', 'Username: at least 3 characters.', 'Anarana mpampiasa: litera 3 farafahakeliny.') });
    if (libre === false) return setMsg({ ok: false, t: tr('Ce nom d\'utilisateur est déjà pris.', 'This username is taken.', 'Efa misy mampiasa io anarana io.') });
    if (f.pwd.length < 8) return setMsg({ ok: false, t: tr('Mot de passe : 8 caractères minimum.', 'Password: at least 8 characters.', 'Teny miafina: litera 8 farafahakeliny.') });
    if (f.pwd !== f.pwd2) return setMsg({ ok: false, t: tr('Les deux mots de passe sont différents.', 'Passwords do not match.', 'Tsy mitovy ny teny miafina roa.') });
    setBusy(true);
    try {
      const r = await signUp(f.email.trim(), f.pwd, { nom: f.nom.trim(), username: u, telephone: f.telephone.trim(), objectif: f.objectif || null, app: 'client' });
      try { localStorage.setItem('sakafo_last_user', u); } catch (x) { /* */ }
      if (r.session) { location.replace('client.html'); return; }
      setMsg({ ok: true, t: tr(`Compte créé ✅ Votre nom d'utilisateur : « ${u} ». Ouvrez l'e-mail de confirmation envoyé à ${f.email} (regardez aussi dans « Spam »), puis connectez-vous.`, `Account created ✅ Your username: "${u}". Open the confirmation e-mail sent to ${f.email} (check Spam too), then sign in.`, `Vita ny kaonty ✅ Ny anaranao mpampiasa: « ${u} ». Sokafy ny mailaka fanamarinana nalefa tany amin'ny ${f.email} (jereo koa ny « Spam »), dia midira.`) });
    } catch (x) { setMsg({ ok: false, t: /registered|already/i.test(x.message) ? tr('Cet e-mail a déjà un compte : connectez-vous.', 'This e-mail already has an account: sign in.', 'Efa misy kaonty io mailaka io: midira.') : x.message }); }
    setBusy(false);
  }
  if (msg?.ok) return html`<div class="col"><p class="ok-box">${msg.t}</p><button class="btn primary big" onClick=${onLogin}>${tr('Se connecter', 'Sign in', 'Hiditra')}</button></div>`;
  return html`<form class="col" onSubmit=${submit}>
    <label class="field"><span class="field-label">${tr('Nom et prénom', 'Full name', 'Anarana feno')}</span><input required value=${f.nom} onInput=${(e) => { const v = e.target.value; setF((x) => ({ ...x, nom: v, username: x._u ? x.username : nettoie(v.trim().split(/\s+/).join('.')) })); }} autocomplete="name" /></label>
    <label class="field"><span class="field-label">${tr('Nom d\'utilisateur', 'Username', 'Anarana mpampiasa')} ${libre === true ? html`<span class="ok-text">✓ ${tr('disponible', 'available', 'azo ampiasaina')}</span>` : libre === false ? html`<span class="error">✗ ${tr('déjà pris', 'taken', 'efa misy')}</span>` : null}</span>
      <input required value=${f.username} onInput=${(e) => setF({ ...f, username: nettoie(e.target.value), _u: true })} autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="rasoa.hanta" /></label>
    <label class="field"><span class="field-label">${tr('Téléphone', 'Phone', 'Finday')}</span><input type="tel" required value=${f.telephone} onInput=${set('telephone')} autocomplete="tel" placeholder="034 00 000 00" /></label>
    ${objectifs.length > 0 && html`<label class="field"><span class="field-label">${tr('Votre objectif', 'Your goal', 'Ny tanjonao')}</span><select value=${f.objectif} onChange=${set('objectif')}><option value="">—</option>${objectifs.map((c) => html`<option value=${c.id}>${c.icone || ''} ${catName(c)}</option>`)}</select></label>`}
    <label class="field"><span class="field-label">E-mail <small class="muted">(${tr('pour confirmer le compte et récupérer le mot de passe', 'to confirm the account and recover the password', 'hanamarinana ny kaonty sy hamerenana ny teny miafina')})</small></span><input type="email" required value=${f.email} onInput=${set('email')} autocomplete="email" /></label>
    <label class="field"><span class="field-label">${tr('Mot de passe (8 caractères min.)', 'Password (min. 8 characters)', 'Teny miafina (litera 8 farafahakeliny)')}</span><${Mdp} value=${f.pwd} onInput=${set('pwd')} autocomplete="new-password" /></label>
    <label class="field"><span class="field-label">${tr('Confirmer le mot de passe', 'Confirm password', 'Averina ny teny miafina')}</span><${Mdp} value=${f.pwd2} onInput=${set('pwd2')} autocomplete="new-password" /></label>
    ${msg && html`<p class="error">${msg.t}</p>`}
    <button class="btn primary big" disabled=${busy}>${busy ? tr('Patientez…', 'Please wait…', 'Miandrasa…') : tr('Créer mon compte', 'Create my account', 'Hamorona ny kaontiko')}</button>
    <button type="button" class="link-btn small" onClick=${onLogin}>${tr('J\'ai déjà un compte → Se connecter', 'I already have an account → Sign in', 'Efa manana kaonty → Hiditra')}</button>
  </form>`;
}

function Oubli({ onBack }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  return html`<form class="col" onSubmit=${async (e) => { e.preventDefault(); setBusy(true); try { await resetPassword(email.trim()); setMsg({ ok: true, t: tr('Si un compte existe avec cet e-mail, un lien vient d\'être envoyé. Suivez-le pour choisir un nouveau mot de passe.', 'If an account exists with this e-mail, a link has been sent.', 'Raha misy kaonty amin\'io mailaka io, lasa ny rohy.') }); } catch (x) { setMsg({ ok: false, t: x.message }); } setBusy(false); }}>
    <p class="small muted">${tr('Indiquez l\'e-mail utilisé à l\'inscription.', 'Enter the e-mail used to sign up.', 'Soraty ny mailaka nampiasainao nisoratra.')}</p>
    <label class="field"><span class="field-label">E-mail</span><input type="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="email" /></label>
    ${msg && html`<p class=${msg.ok ? 'ok-box' : 'error'}>${msg.t}</p>`}
    <button class="btn primary big" disabled=${busy}>${tr('Recevoir le lien', 'Send the link', 'Andefaso ny rohy')}</button>
    <button type="button" class="link-btn small" onClick=${onBack}>← ${tr('Retour', 'Back', 'Hiverina')}</button>
  </form>`;
}

if (typeof document !== 'undefined' && document.getElementById('app')) render(html`<${Connexion} />`, document.getElementById('app'));
