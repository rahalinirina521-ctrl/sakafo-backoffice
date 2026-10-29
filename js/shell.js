// Éléments communs aux applications client et livreur : session, connexion / inscription, langue, toast, mise à jour.
import { html, useState, useEffect, useCallback } from './lib.js?v=202610290637';
import { MODE, getSession, signIn, signUp, resetPassword, onAuthChange, whoami, loadAll, signOut, updatePassword } from './db.js?v=202610290637';
import { tr, getLang, setLang, LANGS, LANG_SHORT } from './i18n.js?v=202610290637';

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
  const logout = async () => { await signOut(); setSession(null); };
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

export function AuthScreen({ titre, sousTitre, lang, onLang, onGuest, allowSignup = true, children }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', pwd: '', nom: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === 'login') await signIn(f.email.trim(), f.pwd);
      else if (mode === 'signup') {
        if (f.pwd.length < 8) throw new Error(tr('Mot de passe : 8 caractères minimum.', 'Password: at least 8 characters.', 'Teny miafina: litera 8 farafahakeliny.'));
        const r = await signUp(f.email.trim(), f.pwd, f.nom.trim());
        if (!r.session) setMsg({ ok: true, t: tr('Compte créé ! Ouvrez l\'e-mail de confirmation que nous venons d\'envoyer, puis connectez-vous.', 'Account created! Open the confirmation e-mail we just sent, then sign in.', 'Vita ny kaonty! Sokafy ny mailaka fanamarinana nalefanay, dia midira.') });
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
