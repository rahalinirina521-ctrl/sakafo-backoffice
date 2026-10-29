// Éléments communs aux applications client et livreur : session, connexion / inscription, langue, toast, mise à jour.
import { html, useState, useEffect, useCallback } from './lib.js?v=202610291451';
import { MODE, getSession, signIn, signUp, resetPassword, onAuthChange, whoami, loadAll, signOut, updatePassword, changerMotDePasse } from './db.js?v=202610291451';
import { tr, getLang, setLang, LANGS, LANG_SHORT } from './i18n.js?v=202610291451';

export function LangSwitch({ lang, onChange }) {
  return html`<div class="lang-switch" role="group" aria-label="Langue">
    ${LANGS.map(([l, name]) => html`<button class=${'lang' + (l === lang ? ' on' : '')} title=${name} onClick=${() => onChange(l)}>${LANG_SHORT[l]}</button>`)}
  </div>`;
}

export function useLang() {
  const [lang, setL] = useState(getLang());
  useEffect(() => setLang(getLang()), []);
  return [lang, (l) => { setLang(l); setL(l); }];
}

export function useToast() {
  const [t, setT] = useState(null);
  const toast = useCallback((msg, tone = 'ok') => {
    const k = Date.now(); setT({ msg, tone, k });
    setTimeout(() => setT((x) => (x && x.k === k ? null : x)), 3500);
  }, []);
  const view = t && html`<div class=${'toast ' + t.tone}>${t.msg}</div>`;
  return [toast, view];
}

// Session + identité. demoAs : identité simulée en mode démo.
export function useAuth(demoAs) {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState('');
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let stop = () => {};
    (async () => {
      try {
        const s = await getSession(); setSession(s || null);
        stop = await onAuthChange((ev, s2) => { if (ev === 'PASSWORD_RECOVERY') setRecovery(true); setSession(s2 || null); });
      } catch (e) { setErr(e.message || String(e)); setSession(null); }
    })();
    return () => stop();
  }, []);
  useEffect(() => {
    if (!session) { setMe(null); return; }
    whoami(demoAs).then((w) => setMe({ ...w, id: w.user_id, email: session.user?.email })).catch((e) => setErr(e.message || String(e)));
  }, [session]);
  const logout = async () => { await deconnecter(); };
  return { session, me, err, logout, recovery, setRecovery };
}

export function useData(enabled) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try { setData(await loadAll()); setError(''); } catch (e) { setError(e.message || String(e)); }
  }, []);
  useEffect(() => { if (enabled) reload(); }, [enabled]);
  return { data, setData, error, reload };
}

export function AuthScreen({ titre, sousTitre, lang, onLang, onGuest, allowSignup = true, children, app = 'client', objectifs = [] }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', pwd: '', nom: '', telephone: '', objectif: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === 'login') await signIn(f.email.trim(), f.pwd);
      else if (mode === 'signup') {
        if (f.pwd.length < 8) throw new Error(tr('Mot de passe : 8 caractères minimum.', 'Password: at least 8 characters.', 'Teny miafina: litera 8 farafahakeliny.'));
        const r = await signUp(f.email.trim(), f.pwd, { nom: f.nom.trim(), telephone: f.telephone.trim(), objectif: f.objectif || null, app });
        if (!r.session) { setMsg({ ok: true, t: tr('Compte créé ! Ouvrez l\'e-mail de confirmation que nous venons d\'envoyer (regardez aussi dans « Spam »), puis connectez-vous.', 'Account created! Open the confirmation e-mail we just sent (check Spam too), then sign in.', 'Vita ny kaonty! Sokafy ny mailaka fanamarinana nalefanay (jereo koa ao amin\'ny « Spam »), dia midira.') }); setMode('login'); }
      } else {
        await resetPassword(f.email.trim());
        setMsg({ ok: true, t: tr('E-mail envoyé : suivez le lien pour choisir un nouveau mot de passe.', 'E-mail sent: follow the link to choose a new password.', 'Lasa ny mailaka: araho ny rohy hisafidianana teny miafina vaovao.') });
      }
    } catch (x) { setMsg({ ok: false, t: x.message || String(x) }); }
    setBusy(false);
  }
  return html`<div class="auth-wrap">
    <div class="auth-card card">
      <div class="row between"><div class="auth-brand"><span class="logo-dot">S</span><div><b>${titre}</b><small>${sousTitre}</small></div></div><${LangSwitch} lang=${lang} onChange=${onLang} /></div>
      ${children}
      ${MODE === 'demo' ? html`<p class="warn-box small">${tr('Mode démo (pas de Supabase configuré).', 'Demo mode (no Supabase configured).', 'Mode démo.')}</p>` : html`
      ${allowSignup && html`<div class="tabs">${[['login', tr('Se connecter', 'Sign in', 'Hiditra')], ['signup', tr('Créer un compte', 'Create account', 'Hamorona kaonty')]].map(([k, l]) => html`<button class=${'tab' + (mode === k ? ' on' : '')} onClick=${() => { setMode(k); setMsg(null); }}>${l}</button>`)}</div>`}
      <form onSubmit=${submit} class="col">
        ${mode === 'signup' && html`<label class="field"><span class="field-label">${tr('Nom et prénom', 'Full name', 'Anarana feno')}</span><input required value=${f.nom} onInput=${set('nom')} autocomplete="name" /></label>`}
        ${mode === 'signup' && html`<label class="field"><span class="field-label">${tr('Téléphone', 'Phone', 'Finday')}</span><input type="tel" required value=${f.telephone} onInput=${set('telephone')} autocomplete="tel" placeholder="034 00 000 00" /></label>`}
        ${mode === 'signup' && objectifs.length > 0 && html`<label class="field"><span class="field-label">${tr('Votre objectif', 'Your goal', 'Ny tanjonao')}</span><select value=${f.objectif} onChange=${set('objectif')}><option value="">—</option>${objectifs.map((c) => html`<option value=${c.id}>${c.icone || ''} ${c.nom_label || c.nom}</option>`)}</select></label>`}
        <label class="field"><span class="field-label">E-mail</span><input type="email" required value=${f.email} onInput=${set('email')} autocomplete="username" /></label>
        ${mode !== 'reset' && html`<label class="field"><span class="field-label">${tr('Mot de passe', 'Password', 'Teny miafina')}</span><input type="password" required minlength=${mode === 'signup' ? 8 : undefined} value=${f.pwd} onInput=${set('pwd')} autocomplete=${mode === 'signup' ? 'new-password' : 'current-password'} /></label>`}
        ${msg && html`<p class=${msg.ok ? 'ok-box' : 'error'}>${msg.t}</p>`}
        <button class="btn primary big" disabled=${busy}>${busy ? tr('Patientez…', 'Please wait…', 'Miandrasa…') : mode === 'login' ? tr('Se connecter', 'Sign in', 'Hiditra') : mode === 'signup' ? tr('Créer mon compte', 'Create my account', 'Hamorona ny kaontiko') : tr('Recevoir le lien', 'Send the link', 'Andefaso ny rohy')}</button>
        <button type="button" class="link-btn small" onClick=${() => { setMode(mode === 'reset' ? 'login' : 'reset'); setMsg(null); }}>${mode === 'reset' ? tr('← Retour', '← Back', '← Hiverina') : tr('Mot de passe oublié ?', 'Forgot password?', 'Hadino ny teny miafina?')}</button>
      </form>`}
      ${onGuest && html`<div class="auth-guest"><button class="btn ghost big" onClick=${onGuest}>👀 ${tr('Découvrir sans compte (démo)', 'Explore without an account (demo)', 'Hijery tsy misy kaonty (démo)')}</button></div>`}
    </div>
  </div>`;
}

// Après le lien « mot de passe oublié »
export function NewPassword({ onDone }) {
  const [p, setP] = useState(''); const [m, setM] = useState(''); const [busy, setBusy] = useState(false);
  return html`<div class="modal-back"><form class="modal" onSubmit=${async (e) => { e.preventDefault(); setBusy(true); try { await updatePassword(p); onDone(); } catch (x) { setM(x.message); } setBusy(false); }}>
    <header class="card-head"><h2>${tr('Nouveau mot de passe', 'New password', 'Teny miafina vaovao')}</h2></header>
    <div class="modal-body col"><input type="password" minlength="8" required value=${p} onInput=${(e) => setP(e.target.value)} autocomplete="new-password" />${m && html`<p class="error">${m}</p>`}
    <button class="btn primary" disabled=${busy}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button></div></form></div>`;
}

// Nouvelle version publiée ? (compare le tag de ce fichier avec version.json)
const MON_TAG = (() => { try { return new URL(import.meta.url).searchParams.get('v'); } catch (e) { return null; } })();
export function UpdateNotice() {
  const [nv, setNv] = useState(false);
  useEffect(() => {
    if (!MON_TAG) return undefined;
    const check = () => fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((v) => { if (v.tag && v.tag !== MON_TAG) setNv(true); }).catch(() => {});
    check(); const t = setInterval(check, 120000);
    return () => clearInterval(t);
  }, []);
  if (!nv) return null;
  return html`<div class="update-banner"><span>${tr('Nouvelle version disponible', 'New version available', 'Misy version vaovao')}</span>
    <button class="btn small primary" onClick=${async () => { await fetch(location.pathname, { cache: 'reload' }).catch(() => {}); location.reload(); }}>${tr('Mettre à jour', 'Update', 'Avaozy')}</button></div>`;
}

// ---------- Compte : déconnexion, changement de mot de passe, menu utilisateur ----------
export async function deconnecter(scope = 'local') {
  try { await signOut(scope); } catch (e) { /* on quitte quand même */ }
  location.replace('connexion.html?deconnecte' + (scope === 'global' ? '=tous' : ''));
}
const ROLES = { admin: ['Administrateur', 'Administrator', 'Mpitantana'], client: ['Client', 'Customer', 'Client'], livreur: ['Livreur', 'Courier', 'Mpitondra'], invite: ['Invité', 'Guest', 'Vahiny'] };
export const roleLabel = (r) => tr(...(ROLES[r] || ROLES.invite));
const initiales = (n) => String(n || '?').trim().split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '?';

// Bouton rond (initiales) en haut à droite → nom, rôle, « Mon compte », « Se déconnecter »
export function UserMenu({ nom, email, role, onCompte, demo }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!e.target.closest || !e.target.closest('.user-menu')) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  return html`<div class="user-menu">
    <button class="avatar" onClick=${() => setOpen(!open)} aria-label=${tr('Mon compte', 'My account', 'Ny kaontiko')} aria-expanded=${open}>${initiales(nom || email)}</button>
    ${open && html`<div class="user-pop" role="menu">
      <div class="user-id"><b>${nom || email}</b><small>${email || ''}</small><span class="badge muted">${demo ? tr('Compte démo', 'Demo account', 'Kaonty démo') : roleLabel(role)}</span></div>
      ${onCompte && html`<button role="menuitem" onClick=${() => { setOpen(false); onCompte(); }}>👤 ${tr('Mon compte', 'My account', 'Ny kaontiko')}</button>`}
      <button role="menuitem" class="danger" onClick=${() => deconnecter()}>⎋ ${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button>
    </div>`}
  </div>`;
}

// Carte « Mon compte » : identité, mot de passe, déconnexion (cet appareil / tous les appareils)
export function CompteCard({ email, nom, role, username, demo, toast }) {
  const [f, setF] = useState({ actuel: '', nouveau: '', confirme: '' });
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  async function changer(e) {
    e.preventDefault();
    if (f.nouveau.length < 8) return toast(tr('Nouveau mot de passe : 8 caractères minimum', 'New password: at least 8 characters', 'Teny miafina vaovao: litera 8 farafahakeliny'), 'bad');
    if (f.nouveau !== f.confirme) return toast(tr('Les deux mots de passe sont différents', 'Passwords do not match', 'Tsy mitovy ny teny miafina roa'), 'bad');
    setBusy(true);
    try { await changerMotDePasse(email, f.actuel, f.nouveau); setF({ actuel: '', nouveau: '', confirme: '' }); setOuvert(false); toast(tr('Mot de passe modifié ✅', 'Password changed ✅', 'Voaova ny teny miafina ✅')); } catch (x) { toast(x.message, 'bad'); }
    setBusy(false);
  }
  return html`<section class="c-card compte-card">
    <h2>🔐 ${tr('Mon compte', 'My account', 'Ny kaontiko')}</h2>
    <div class="compte-id"><span class="avatar big">${initiales(nom || email)}</span><div><b>${nom || '—'}</b><small>${email}</small>${username && html`<small>${tr('Utilisateur', 'Username', 'Mpampiasa')} : <b>${username}</b></small>`}<span class="badge muted">${demo ? tr('Compte démo', 'Demo account', 'Kaonty démo') : roleLabel(role)}</span></div></div>
    ${!demo && (ouvert ? html`<form class="col" onSubmit=${changer}>
        <input type="password" required placeholder=${tr('Mot de passe actuel', 'Current password', 'Teny miafina ankehitriny')} value=${f.actuel} onInput=${(e) => setF({ ...f, actuel: e.target.value })} autocomplete="current-password" />
        <input type="password" required placeholder=${tr('Nouveau mot de passe (8 caractères min.)', 'New password (min. 8)', 'Teny miafina vaovao')} value=${f.nouveau} onInput=${(e) => setF({ ...f, nouveau: e.target.value })} autocomplete="new-password" />
        <input type="password" required placeholder=${tr('Confirmer le nouveau mot de passe', 'Confirm new password', 'Averina ny teny miafina vaovao')} value=${f.confirme} onInput=${(e) => setF({ ...f, confirme: e.target.value })} autocomplete="new-password" />
        <div class="row gap"><button class="btn primary" disabled=${busy}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button><button type="button" class="btn ghost" onClick=${() => setOuvert(false)}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button></div>
      </form>` : html`<button class="btn" onClick=${() => setOuvert(true)}>🔑 ${tr('Changer mon mot de passe', 'Change my password', 'Hanova ny teny miafina')}</button>`)}
    <div class="row gap wrap">
      <button class="btn danger" onClick=${() => deconnecter()}>⎋ ${tr('Se déconnecter', 'Sign out', 'Hivoaka')}</button>
      ${!demo && html`<button class="btn ghost small" onClick=${() => { if (confirm(tr('Se déconnecter de tous les appareils (téléphones, ordinateurs) ?', 'Sign out from all devices?', 'Hivoaka amin\'ny fitaovana rehetra?'))) deconnecter('global'); }}>${tr('Se déconnecter de tous les appareils', 'Sign out of all devices', 'Hivoaka amin\'ny fitaovana rehetra')}</button>`}
    </div>
  </section>`;
}
