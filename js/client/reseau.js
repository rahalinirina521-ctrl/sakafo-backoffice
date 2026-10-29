// Communauté façon réseau social : fil d'actualité, publications avec photos, réactions, commentaires,
// profils des membres, amis, notifications, blocage et signalement.
import { html, useState, useEffect, useRef, useMemo } from '../lib.js?v=202610291512';
import { useApp, Modal, Badge } from '../ui.js?v=202610291512';
import { tr, catName } from '../i18n.js?v=202610291512';
import { fmt } from '../calc.js?v=202610291512';
import { insertRow, insertSansRetour, updateRow, supprimer, upsert, uploadPhotoCommunaute } from '../db.js?v=202610291512';
import { dmId } from '../chat.js?v=202610291512';
import { Avatar, AvisClient, erreur, depuis } from './social.js?v=202610291512';

const REACTIONS = [['👍', ['J\'aime', 'Like', 'Tiako']], ['❤️', ['J\'adore', 'Love', 'Tiako be']], ['💪', ['Courage', 'Strong', 'Matanjaha']], ['🔥', ['Bravo', 'Fire', 'Mahery']], ['👏', ['Applaudir', 'Applause', 'Tehaka']], ['🎉', ['Fête', 'Party', 'Fety']]];
const TYPES = () => ({
  texte: ['💬', tr('Publication', 'Post', 'Hafatra')],
  motivation: ['🔥', tr('Motivation', 'Motivation', 'Fampaherezana')],
  repas: ['🍽️', tr('Mon repas', 'My meal', 'Ny sakafoko')],
  sport: ['🏃', tr('Sport', 'Workout', 'Fanatanjahantena')],
  performance: ['🏆', tr('Mes progrès', 'My progress', 'Fandrosoako')],
  progres: ['🏆', tr('Mes progrès', 'My progress', 'Fandrosoako')],
});
const nouvelId = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2));
const hashParams = () => new URLSearchParams(location.hash.split('?')[1] || '');

// Données partagées de la communauté
function useReseau(client) {
  const { data } = useApp();
  return useMemo(() => {
    const membres = new Map((data.communaute || []).map((c) => [c.client_id, c]));
    const bloques = new Set((data.blocages || []).filter((b) => b.client_id === client.id).map((b) => b.bloque_id));
    const liens = (data.amis || []).filter((a) => a.de === client.id || a.a === client.id);
    const amis = liens.filter((a) => a.statut === 'accepte').map((a) => (a.de === client.id ? a.a : a.de));
    const lien = (cid) => liens.find((a) => a.de === cid || a.a === cid);
    const pubs = (data.publications || []).filter((p) => (!p.masque || p.client_id === client.id) && !bloques.has(p.client_id))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const coms = (data.commentaires || []).filter((c) => (!c.masque || c.client_id === client.id) && !bloques.has(c.client_id));
    const notifs = (data.notifs_client || []).filter((n) => n.client_id === client.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const pseudo = (cid) => membres.get(cid)?.pseudo || tr('Membre', 'Member', 'Mpikambana');
    const photo = (cid) => membres.get(cid)?.photo_url || null;
    return { membres, bloques, liens, amis, lien, pubs, coms, notifs, pseudo, photo, moi: membres.get(client.id) };
  }, [data.communaute, data.blocages, data.amis, data.publications, data.commentaires, data.notifs_client, client.id]);
}
export function nbNouveautes(data, client) {
  if (!client) return 0;
  const n = (data.notifs_client || []).filter((x) => x.client_id === client.id && !x.lu).length;
  const d = (data.amis || []).filter((a) => a.a === client.id && a.statut === 'attente').length;
  return n + (n ? 0 : d);
}

// ---------- Page Communauté ----------
export function Communaute({ client }) {
  const R = useReseau(client);
  const q = hashParams();
  const [onglet, setOnglet] = useState(q.get('onglet') || 'fil');
  const [profil, setProfil] = useState(q.get('membre') || '');
  const demandes = R.liens.filter((a) => a.a === client.id && a.statut === 'attente').length;
  const nonLues = R.notifs.filter((n) => !n.lu).length;
  const tabs = [['fil', '🏠', tr('Fil', 'Feed', 'Vaovao')], ['notifs', '🔔', tr('Notifications', 'Notifications', 'Fampahafantarana'), nonLues], ['amis', '🤝', tr('Amis', 'Friends', 'Namana'), demandes], ['avis', '⭐', tr('Avis', 'Reviews', 'Hevitra')]];
  return html`<div class="c-page reseau">
    <div class="row between"><h1>👥 ${tr('Communauté', 'Community', 'Fiaraha-monina')}</h1>${R.moi && html`<button class="me-chip" onClick=${() => setProfil(client.id)}><${Avatar} nom=${R.moi.pseudo} photo=${R.moi.photo_url} size=${30} /><span>${R.moi.pseudo}</span></button>`}</div>
    <nav class="rs-tabs">${tabs.map(([k, ic, l, n]) => html`<button class=${onglet === k ? 'on' : ''} onClick=${() => setOnglet(k)}><span>${ic}${n ? html`<i class="dot-badge">${n}</i>` : null}</span><small>${l}</small></button>`)}</nav>
    ${onglet === 'avis' ? html`<${AvisClient} client=${client} />`
      : !R.moi ? html`<${Rejoindre} client=${client} />`
      : onglet === 'amis' ? html`<${Amis} client=${client} R=${R} onProfil=${setProfil} />`
      : onglet === 'notifs' ? html`<${Notifs} client=${client} R=${R} onProfil=${setProfil} onFil=${() => setOnglet('fil')} />`
      : html`<${Fil} client=${client} R=${R} onProfil=${setProfil} focus=${q.get('p')} />`}
    ${profil && R.moi && html`<${ProfilMembre} cid=${profil} client=${client} R=${R} onClose=${() => setProfil('')} onProfil=${setProfil} />`}
  </div>`;
}

// ---------- Adhésion ----------
function Rejoindre({ client }) {
  const { data, setData, toast } = useApp();
  const cat = data.categories.find((c) => c.id === client.categorie_id);
  const [f, setF] = useState({ pseudo: client.nom.split(' ')[0], bio: '', visible: true, montrer_objectif: true });
  async function ok() {
    try {
      const row = { client_id: client.id, pseudo: f.pseudo.trim(), bio: f.bio.trim() || null, visible: f.visible, montrer_objectif: f.montrer_objectif, objectif: cat ? catName(cat) : null };
      await upsert('communaute', row); setData((d) => ({ ...d, communaute: [...(d.communaute || []).filter((c) => c.client_id !== client.id), row] }));
      toast(tr('Bienvenue dans la communauté 🎉', 'Welcome to the community 🎉', 'Tongasoa 🎉'));
    } catch (e) { erreur(toast)(/duplicate|unique/i.test(e.message) ? new Error(tr('Ce pseudo est déjà pris', 'This nickname is taken', 'Efa misy mampiasa')) : e); }
  }
  return html`<section class="c-card hero-soft">
    <div class="big-emoji">🤝</div>
    <h2>${tr('Rejoignez la communauté Sakafo', 'Join the Sakafo community', 'Midira amin\'ny fiaraha-monina Sakafo')}</h2>
    <p class="small">${tr('Publiez vos repas et vos progrès, réagissez, commentez, motivez-vous entre membres : on tient mieux ses objectifs à plusieurs !', 'Post your meals and progress, react, comment, motivate each other: goals are easier together!', 'Avoahy ny sakafonao sy ny fandrosoanao, mifampahereza: mora kokoa ny tanjona rehefa miaraka!')}</p>
    <label class="field"><span class="field-label">${tr('Pseudo (visible par les autres)', 'Nickname (visible to others)', 'Anarana hiseho')}</span><input maxlength="30" value=${f.pseudo} onInput=${(e) => setF({ ...f, pseudo: e.target.value })} /></label>
    <label class="field"><span class="field-label">${tr('Petite présentation (facultatif)', 'Short bio (optional)', 'Fampahafantarana fohy')}</span><input maxlength="200" value=${f.bio} onInput=${(e) => setF({ ...f, bio: e.target.value })} placeholder=${tr('ex. Objectif -10 kg avant Noël 💪', 'e.g. Goal -10 kg by Christmas 💪', 'ohatra: -10 kg alohan\'ny Krismasy 💪')} /></label>
    ${cat && html`<label class="check"><input type="checkbox" checked=${f.montrer_objectif} onChange=${(e) => setF({ ...f, montrer_objectif: e.target.checked })} /> ${tr('Afficher mon objectif', 'Show my goal', 'Asehoy ny tanjoko')} (${cat.icone || ''} ${catName(cat)})</label>`}
    <label class="check"><input type="checkbox" checked=${f.visible} onChange=${(e) => setF({ ...f, visible: e.target.checked })} /> ${tr('Les autres membres peuvent me trouver', 'Other members can find me', 'Hitan\'ny mpikambana hafa aho')}</label>
    <p class="tiny muted">🔒 ${tr('Seuls votre pseudo, votre photo et ce que vous publiez sont visibles. Votre poids, adresse et téléphone restent privés.', 'Only your nickname, photo and posts are visible. Weight, address and phone stay private.', 'Ny anaranao, sarinao ary izay avoakanao ihany no hita.')}</p>
    <button class="btn primary big" disabled=${f.pseudo.trim().length < 2} onClick=${ok}>${tr('Rejoindre', 'Join', 'Hiditra')}</button>
  </section>`;
}

// ---------- Fil d'actualité ----------
function Fil({ client, R, onProfil, focus }) {
  const [filtre, setFiltre] = useState('tous');
  const [n, setN] = useState(10);
  const [compose, setCompose] = useState(null);
  const fin = useRef(null);
  const liste = R.pubs.filter((p) => filtre === 'tous' || (filtre === 'amis' ? R.amis.includes(p.client_id) : p.client_id === client.id));
  const vus = focus ? [...liste.filter((p) => p.id === focus), ...liste.filter((p) => p.id !== focus)] : liste;
  useEffect(() => {
    if (!fin.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setN((x) => x + 10); }, { rootMargin: '400px' });
    io.observe(fin.current); return () => io.disconnect();
  }, [fin.current, vus.length]);
  return html`
    <section class="c-card composer-mini">
      <div class="row gap"><button class="av-btn" onClick=${() => onProfil(client.id)}><${Avatar} nom=${R.moi.pseudo} photo=${R.moi.photo_url} size=${42} /></button>
        <button class="fake-input" onClick=${() => setCompose('texte')}>${tr('Quoi de neuf', 'What\'s new', 'Inona no vaovao')}, ${R.moi.pseudo} ?</button></div>
      <div class="composer-actions">
        <button onClick=${() => setCompose('repas')}>📷 <span>${tr('Photo', 'Photo', 'Sary')}</span></button>
        <button onClick=${() => setCompose('performance')}>🏆 <span>${tr('Mes progrès', 'Progress', 'Fandrosoana')}</span></button>
        <button onClick=${() => setCompose('motivation')}>🔥 <span>${tr('Motivation', 'Motivation', 'Fampaherezana')}</span></button>
      </div>
    </section>
    <div class="seg">${[['tous', tr('Tous', 'All', 'Rehetra')], ['amis', tr('Mes amis', 'Friends', 'Namana')], ['moi', tr('Mes publications', 'My posts', 'Ny ahy')]].map(([k, l]) => html`<button class=${filtre === k ? 'on' : ''} onClick=${() => { setFiltre(k); setN(10); }}>${l}</button>`)}</div>
    ${vus.length === 0 && html`<div class="wa-empty">🌱<p>${filtre === 'moi' ? tr('Vous n\'avez encore rien publié.', 'You haven\'t posted yet.', 'Mbola tsy namoaka ianao.') : tr('Rien pour l\'instant. Ajoutez des amis ou publiez le premier message !', 'Nothing yet. Add friends or post first!', 'Mbola tsy misy. Manampia namana na manorata voalohany!')}</p></div>`}
    ${vus.slice(0, n).map((p) => html`<${Post} key=${p.id} p=${p} client=${client} R=${R} onProfil=${onProfil} ouvert=${p.id === focus} />`)}
    ${vus.length > n && html`<div ref=${fin} class="center-text"><button class="btn ghost" onClick=${() => setN(n + 10)}>${tr('Voir plus', 'See more', 'Hijery bebe kokoa')}</button></div>`}
    ${compose && html`<${Composer} client=${client} R=${R} type0=${compose} onClose=${() => setCompose(null)} />`}`;
}

// ---------- Écrire une publication ----------
function Composer({ client, R, type0, onClose }) {
  const { data, setData, toast } = useApp();
  const mes = (data.mesures || []).filter((m) => m.client_id === client.id).sort((a, b) => a.date.localeCompare(b.date));
  const perf = mes.length >= 2 ? { depart: +mes[0].poids, actuel: +mes[mes.length - 1].poids, semaines: Math.max(1, Math.round((Date.parse(mes[mes.length - 1].date) - Date.parse(mes[0].date)) / (7 * 864e5))), pesees: mes.length } : null;
  const ecart = perf ? Math.round((perf.actuel - perf.depart) * 10) / 10 : 0;
  const [type, setType] = useState(type0 === 'performance' && !perf ? 'texte' : type0);
  const [txt, setTxt] = useState('');
  const [photos, setPhotos] = useState([]);
  const [vis, setVis] = useState('communaute');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { if (type0 === 'repas' && fileRef.current) fileRef.current.click(); }, []);
  const T = TYPES();
  async function ajouterPhotos(files) {
    const liste = [...files].slice(0, 4 - photos.length);
    if (!liste.length) return;
    setBusy(true);
    try { for (const f of liste) { const url = await uploadPhotoCommunaute(client.id, f); setPhotos((x) => [...x, url]); } }
    catch (e) { erreur(toast)(e); }
    setBusy(false);
  }
  async function publier() {
    const texte = txt.trim();
    if (!texte && !photos.length && type !== 'performance') return;
    setBusy(true);
    try {
      const row = { id: nouvelId(), client_id: client.id, type, texte, photos, data: type === 'performance' && perf ? { ecart, semaines: perf.semaines, pesees: perf.pesees } : {}, visibilite: vis };
      await insertRow('publications', row);
      setData((d) => ({ ...d, publications: [{ ...row, created_at: new Date().toISOString(), masque: false }, ...(d.publications || [])] }));
      toast(tr('Publié ✨', 'Posted ✨', 'Navoaka ✨')); onClose();
    } catch (e) { erreur(toast)(e); }
    setBusy(false);
  }
  return html`<${Modal} title=${tr('Créer une publication', 'Create a post', 'Hamorona hafatra')} onClose=${onClose}>
    <div class="row gap"><${Avatar} nom=${R.moi.pseudo} photo=${R.moi.photo_url} size=${42} /><div><b>${R.moi.pseudo}</b><br/>
      <select class="mini-select" value=${vis} onChange=${(e) => setVis(e.target.value)}><option value="communaute">🌍 ${tr('Toute la communauté', 'Whole community', 'Ny fiaraha-monina')}</option><option value="amis">🤝 ${tr('Mes amis seulement', 'Friends only', 'Ny namako ihany')}</option></select></div></div>
    <div class="type-chips">${['texte', 'motivation', 'repas', 'sport', 'performance'].map((k) => html`<button class=${'chip' + (type === k ? ' on' : '')} disabled=${k === 'performance' && !perf} onClick=${() => setType(k)}>${T[k][0]} ${T[k][1]}</button>`)}</div>
    ${type === 'performance' && perf && html`<${CartePerf} d=${{ ecart, semaines: perf.semaines, pesees: perf.pesees }} />`}
    <textarea class="composer-txt" rows="4" maxlength="1000" value=${txt} onInput=${(e) => setTxt(e.target.value)} placeholder=${type === 'motivation' ? tr('Un mot pour motiver les autres…', 'A word to motivate others…', 'Teny fampaherezana…') : type === 'repas' ? tr('Qu\'avez-vous mangé de bon ?', 'What did you eat?', 'Inona no nohaninao?') : type === 'sport' ? tr('Votre séance du jour ?', 'Today\'s workout?', 'Ny fanatanjahantena androany?') : tr('Quoi de neuf ?', 'What\'s new?', 'Inona no vaovao?')}></textarea>
    ${photos.length > 0 && html`<div class=${'pg pg-' + photos.length}>${photos.map((u, i) => html`<div class="pg-it"><img src=${u} alt="" /><button class="pg-x" onClick=${() => setPhotos(photos.filter((_, j) => j !== i))}>✕</button></div>`)}</div>`}
    <input ref=${fileRef} type="file" accept="image/*" multiple hidden onChange=${(e) => { ajouterPhotos(e.target.files); e.target.value = ''; }} />
    <div class="row between wrap gap">
      <button class="btn" disabled=${busy || photos.length >= 4} onClick=${() => fileRef.current.click()}>📷 ${tr('Ajouter des photos', 'Add photos', 'Hanampy sary')} <small class="muted">${photos.length}/4</small></button>
      <button class="btn primary" disabled=${busy || (!txt.trim() && !photos.length && type !== 'performance')} onClick=${publier}>${busy ? '…' : tr('Publier', 'Post', 'Avoaka')}</button>
    </div>
  <//>`;
}

function CartePerf({ d }) {
  const e = +d.ecart || 0;
  return html`<div class=${'perf-card ' + (e <= 0 ? 'down' : 'up')}>
    <span class="perf-ic">${e <= 0 ? '📉' : '📈'}</span>
    <b>${e <= 0 ? '−' : '+'}${fmt(Math.abs(e), 1)} kg</b>
    <small>${tr(`en ${d.semaines} semaine(s)`, `in ${d.semaines} week(s)`, `tao anatin'ny herinandro ${d.semaines}`)}${d.pesees ? ' · ' + d.pesees + ' ' + tr('pesées', 'weigh-ins', 'fandanjana') : ''}</small>
  </div>`;
}

// ---------- Une publication ----------
function Post({ p, client, R, onProfil, ouvert }) {
  const { data, setData, toast } = useApp();
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [voirComs, setVoirComs] = useState(!!ouvert);
  const [qui, setQui] = useState(false);
  const [signal, setSignal] = useState(null);
  const [long, setLong] = useState(false);
  const [zoom, setZoom] = useState(null);
  const reacs = (data.reactions || []).filter((r) => r.publication_id === p.id && !R.bloques.has(r.client_id));
  const mien = reacs.find((r) => r.client_id === client.id);
  const coms = R.coms.filter((c) => c.publication_id === p.id);
  const top = Object.entries(reacs.reduce((m, r) => ({ ...m, [r.emoji]: (m[r.emoji] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
  const T = TYPES()[p.type];
  const moi = p.client_id === client.id;
  const texte = p.texte || '';
  const coupe = texte.length > 280 && !long;
  async function reagir(emoji) {
    setPicker(false);
    const ancien = mien;
    try {
      if (ancien && (ancien.emoji === emoji || !emoji)) {
        setData((d) => ({ ...d, reactions: d.reactions.filter((r) => !(r.publication_id === p.id && r.client_id === client.id)) }));
        await supprimer('reactions', { publication_id: p.id, client_id: client.id });
      } else {
        const e = emoji || '👍';
        setData((d) => ({ ...d, reactions: [...(d.reactions || []).filter((r) => !(r.publication_id === p.id && r.client_id === client.id)), { publication_id: p.id, client_id: client.id, emoji: e }] }));
        if (ancien) await supprimer('reactions', { publication_id: p.id, client_id: client.id });
        await insertRow('reactions', { publication_id: p.id, client_id: client.id, emoji: e });
      }
    } catch (e) { erreur(toast)(e); setData((d) => ({ ...d, reactions: [...(d.reactions || []).filter((r) => !(r.publication_id === p.id && r.client_id === client.id)), ...(ancien ? [ancien] : [])] })); }
  }
  async function effacer() {
    setMenu(false);
    if (!confirm(tr('Supprimer cette publication ?', 'Delete this post?', 'Hofafana?'))) return;
    try { await supprimer('publications', { id: p.id }); setData((d) => ({ ...d, publications: d.publications.filter((x) => x.id !== p.id) })); toast(tr('Publication supprimée', 'Post deleted', 'Voafafa')); } catch (e) { erreur(toast)(e); }
  }
  return html`<article class="c-card post fb">
    <header class="post-h">
      <button class="av-btn" onClick=${() => onProfil(p.client_id)}><${Avatar} nom=${R.pseudo(p.client_id)} photo=${R.photo(p.client_id)} size=${42} /></button>
      <div class="grow"><button class="link-name" onClick=${() => onProfil(p.client_id)}>${R.pseudo(p.client_id)}</button>${T && p.type !== 'texte' ? html` <small class="muted">· ${T[0]} ${T[1]}</small>` : null}
        <small class="muted d-block">${depuis(p.created_at)} · ${p.visibilite === 'communaute' ? '🌍' : '🤝'}${p.masque ? ' · ' + tr('masqué par la modération', 'hidden by moderation', 'nafenina') : ''}</small></div>
      <div class="menu-wrap"><button class="icon-btn" onClick=${() => setMenu(!menu)} aria-label="Menu">⋯</button>
        ${menu && html`<div class="pop-menu" onClick=${() => setMenu(false)}>
          ${moi ? html`<button onClick=${effacer}>🗑 ${tr('Supprimer', 'Delete', 'Fafao')}</button>`
            : html`<button onClick=${() => onProfil(p.client_id)}>👤 ${tr('Voir le profil', 'View profile', 'Jereo ny mombamomba')}</button>
              <button onClick=${() => setSignal({ type: 'publication', id: p.id })}>🚩 ${tr('Signaler', 'Report', 'Hitaraina')}</button>
              <button onClick=${() => setSignal({ type: 'bloquer', id: p.client_id })}>🚫 ${tr('Bloquer', 'Block', 'Sakanana')} ${R.pseudo(p.client_id)}</button>`}
        </div>`}</div>
    </header>
    ${texte && html`<p class="post-txt">${coupe ? texte.slice(0, 260) + '… ' : texte}${coupe && html`<button class="link-btn" onClick=${() => setLong(true)}>${tr('Voir plus', 'See more', 'Hijery bebe kokoa')}</button>`}</p>`}
    ${p.type === 'performance' && p.data?.semaines && html`<${CartePerf} d=${p.data} />`}
    ${(p.photos || []).length > 0 && html`<div class=${'pg pg-' + Math.min(4, p.photos.length)}>${p.photos.map((u) => html`<button class="pg-it" onClick=${() => setZoom(u)}><img src=${u} alt="" loading="lazy" /></button>`)}</div>`}
    ${(reacs.length > 0 || coms.length > 0) && html`<div class="post-stats">
      ${reacs.length > 0 ? html`<button class="link-btn" onClick=${() => setQui(true)}><span class="emo-stack">${top.map((e) => html`<i>${e}</i>`)}</span> ${mien ? (reacs.length > 1 ? tr(`Vous et ${reacs.length - 1} autre(s)`, `You and ${reacs.length - 1} other(s)`, `Ianao sy ${reacs.length - 1} hafa`) : tr('Vous', 'You', 'Ianao')) : reacs.length}</button>` : html`<span></span>`}
      ${coms.length > 0 && html`<button class="link-btn" onClick=${() => setVoirComs(!voirComs)}>${coms.length} ${tr('commentaire(s)', 'comment(s)', 'fanehoan-kevitra')}</button>`}
    </div>`}
    <div class="post-actions">
      <div class="react-wrap">
        ${picker && html`<div class="react-picker">${REACTIONS.map(([e, l]) => html`<button title=${tr(...l)} onClick=${() => reagir(e)}>${e}</button>`)}</div>`}
        <button class=${'pa' + (mien ? ' on' : '')} onClick=${() => reagir(mien ? null : '👍')} onContextMenu=${(e) => { e.preventDefault(); setPicker(true); }}>${mien ? mien.emoji : '👍'} ${mien ? tr(...(REACTIONS.find((r) => r[0] === mien.emoji) || REACTIONS[0])[1]) : tr('J\'aime', 'Like', 'Tiako')}</button>
        <button class="pa pa-more" onClick=${() => setPicker(!picker)} aria-label=${tr('Choisir une réaction', 'Pick a reaction', 'Misafidiana')}>😊</button>
      </div>
      <button class="pa" onClick=${() => setVoirComs(true)}>💬 ${tr('Commenter', 'Comment', 'Hanehoa hevitra')}</button>
      ${!moi && R.amis.includes(p.client_id) && html`<a class="pa" href=${'#/messages?c=' + encodeURIComponent(dmId(client.id, p.client_id))}>✉️ ${tr('Message', 'Message', 'Hafatra')}</a>`}
    </div>
    ${voirComs && html`<${Commentaires} p=${p} client=${client} R=${R} coms=${coms} onProfil=${onProfil} focus=${ouvert} />`}
    ${qui && html`<${Modal} title=${tr('Réactions', 'Reactions', 'Fihetseham-po')} onClose=${() => setQui(false)}>${reacs.map((r) => html`<button class="person clickable" onClick=${() => { setQui(false); onProfil(r.client_id); }}><${Avatar} nom=${R.pseudo(r.client_id)} photo=${R.photo(r.client_id)} size=${36} /><b class="grow">${r.client_id === client.id ? tr('Vous', 'You', 'Ianao') : R.pseudo(r.client_id)}</b><span class="big-emo">${r.emoji}</span></button>`)}<//>`}
    ${signal && html`<${Signaler} cible=${signal} client=${client} R=${R} onClose=${() => setSignal(null)} />`}
    ${zoom && html`<div class="lightbox" onClick=${() => setZoom(null)}><img src=${zoom} alt="" /></div>`}
  </article>`;
}

// ---------- Commentaires ----------
function Commentaires({ p, client, R, coms, onProfil, focus }) {
  const { setData, toast } = useApp();
  const [txt, setTxt] = useState('');
  const [rep, setRep] = useState(null);
  const [tous, setTous] = useState(!!focus || coms.length <= 3);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const racines = coms.filter((c) => !c.parent_id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const vus = tous ? racines : racines.slice(-2);
  const reponses = (id) => coms.filter((c) => c.parent_id === id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  useEffect(() => { if (input.current && (focus || rep)) input.current.focus(); }, [rep]);
  async function envoyer() {
    const t = txt.trim(); if (!t) return;
    setBusy(true);
    try {
      const row = { id: nouvelId(), publication_id: p.id, client_id: client.id, parent_id: rep?.id || null, texte: t };
      await insertRow('commentaires', row);
      setData((d) => ({ ...d, commentaires: [...(d.commentaires || []), { ...row, masque: false, created_at: new Date().toISOString() }] }));
      setTxt(''); setRep(null);
    } catch (e) { erreur(toast)(e); }
    setBusy(false);
  }
  async function effacer(c) {
    if (!confirm(tr('Supprimer ce commentaire ?', 'Delete this comment?', 'Hofafana?'))) return;
    try { await supprimer('commentaires', { id: c.id }); setData((d) => ({ ...d, commentaires: d.commentaires.filter((x) => x.id !== c.id && x.parent_id !== c.id) })); } catch (e) { erreur(toast)(e); }
  }
  const Com = ({ c, sub }) => html`<div class=${'com' + (sub ? ' sub' : '')}>
    <button class="av-btn" onClick=${() => onProfil(c.client_id)}><${Avatar} nom=${R.pseudo(c.client_id)} photo=${R.photo(c.client_id)} size=${sub ? 26 : 32} /></button>
    <div class="com-body"><div class="com-bulle"><button class="link-name" onClick=${() => onProfil(c.client_id)}>${R.pseudo(c.client_id)}</button><p>${c.texte}</p></div>
      <div class="com-meta"><small>${depuis(c.created_at)}</small>${!sub && html`<button class="link-btn" onClick=${() => setRep(c)}>${tr('Répondre', 'Reply', 'Hamaly')}</button>`}
        ${(c.client_id === client.id || p.client_id === client.id) && html`<button class="link-btn" onClick=${() => effacer(c)}>${tr('Supprimer', 'Delete', 'Fafao')}</button>`}</div></div></div>`;
  return html`<div class="coms">
    ${!tous && racines.length > 2 && html`<button class="link-btn small" onClick=${() => setTous(true)}>${tr(`Voir les ${racines.length} commentaires`, `See all ${racines.length} comments`, `Hijery ny ${racines.length}`)}</button>`}
    ${vus.map((c) => html`<div key=${c.id}><${Com} c=${c} />${reponses(c.id).map((r) => html`<${Com} key=${r.id} c=${r} sub />`)}</div>`)}
    ${rep && html`<div class="rep-bar">↪ ${tr('Réponse à', 'Replying to', 'Mamaly an\'i')} <b>${R.pseudo(rep.client_id)}</b> <button class="link-btn" onClick=${() => setRep(null)}>✕</button></div>`}
    <div class="com-input"><${Avatar} nom=${R.moi.pseudo} photo=${R.moi.photo_url} size=${32} />
      <input ref=${input} maxlength="500" value=${txt} onInput=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') envoyer(); }} placeholder=${tr('Écrire un commentaire…', 'Write a comment…', 'Manorata fanehoan-kevitra…')} />
      <button class="btn small primary" disabled=${busy || !txt.trim()} onClick=${envoyer}>➤</button></div>
  </div>`;
}

// ---------- Signaler / bloquer ----------
function Signaler({ cible, client, R, onClose }) {
  const { setData, toast } = useApp();
  const [motif, setMotif] = useState('');
  const [detail, setDetail] = useState('');
  const bloquer = cible.type === 'bloquer';
  const MOTIFS = [tr('Contenu inapproprié', 'Inappropriate content', 'Tsy mety'), tr('Harcèlement ou insulte', 'Harassment', 'Fanorisorenana'), tr('Spam / publicité', 'Spam', 'Dokam-barotra'), tr('Fausse information santé', 'Health misinformation', 'Vaovao diso momba ny fahasalamana'), tr('Autre', 'Other', 'Hafa')];
  async function ok() {
    try {
      if (bloquer) {
        const row = { client_id: client.id, bloque_id: cible.id };
        await insertRow('blocages', row);
        setData((d) => ({ ...d, blocages: [...(d.blocages || []), row] }));
        const l = R.lien(cible.id); if (l) { await supprimer('amis', { id: l.id }).catch(() => {}); setData((d) => ({ ...d, amis: d.amis.filter((x) => x.id !== l.id) })); }
        toast(tr('Membre bloqué. Vous ne verrez plus ses publications.', 'Member blocked.', 'Voasakana.'));
      } else {
        await insertSansRetour('signalements', { id: nouvelId(), client_id: client.id, cible_type: cible.type, cible_id: cible.id, motif: [motif, detail.trim()].filter(Boolean).join(' — ') || null });
        toast(tr('Merci, notre équipe va vérifier 🙏', 'Thanks, our team will check 🙏', 'Misaotra, hojerenay 🙏'));
      }
      onClose();
    } catch (e) { erreur(toast)(/duplicate|unique/i.test(e.message) ? new Error(tr('Déjà fait', 'Already done', 'Efa vita')) : e); }
  }
  return html`<${Modal} title=${bloquer ? '🚫 ' + tr('Bloquer', 'Block', 'Sakanana') + ' ' + R.pseudo(cible.id) : '🚩 ' + tr('Signaler', 'Report', 'Hitaraina')} onClose=${onClose}>
    ${bloquer ? html`<p>${tr('Vous ne verrez plus ses publications ni ses commentaires, et vous ne serez plus amis. Il/elle ne sera pas prévenu(e).', 'You won\'t see their posts or comments any more and you will no longer be friends. They won\'t be notified.', 'Tsy ho hitanao intsony ny hafany. Tsy ampandrenesina izy.')}</p>`
      : html`<div class="col">${MOTIFS.map((m) => html`<label class="check"><input type="radio" name="motif" checked=${motif === m} onChange=${() => setMotif(m)} /> ${m}</label>`)}
        <textarea rows="2" maxlength="250" placeholder=${tr('Précisions (facultatif)', 'Details (optional)', 'Antsipiriany')} value=${detail} onInput=${(e) => setDetail(e.target.value)}></textarea></div>`}
    <div class="row gap"><button class=${'btn ' + (bloquer ? 'danger' : 'primary')} disabled=${!bloquer && !motif} onClick=${ok}>${bloquer ? tr('Bloquer', 'Block', 'Sakanana') : tr('Envoyer le signalement', 'Send report', 'Alefaso')}</button><button class="btn ghost" onClick=${onClose}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button></div>
  <//>`;
}

// ---------- Boutons d'amitié ----------
function BoutonAmi({ cid, client, R, small }) {
  const { setData, toast } = useApp();
  const l = R.lien(cid);
  async function demander() {
    try { const row = { id: nouvelId(), de: client.id, a: cid, statut: 'attente' }; await insertRow('amis', row); setData((d) => ({ ...d, amis: [...(d.amis || []), { ...row, created_at: new Date().toISOString() }] })); toast(tr('Demande envoyée 📨', 'Request sent 📨', 'Lasa ny fangatahana 📨')); } catch (e) { erreur(toast)(e); }
  }
  async function repondre(statut) {
    try { await updateRow('amis', l.id, { statut }); setData((d) => ({ ...d, amis: d.amis.map((x) => (x.id === l.id ? { ...x, statut } : x)) })); if (statut === 'accepte') toast(tr('Vous êtes maintenant amis 🤝', 'You are now friends 🤝', 'Mpinamana ianareo izao 🤝')); } catch (e) { erreur(toast)(e); }
  }
  async function annuler() {
    try { await supprimer('amis', { id: l.id }); setData((d) => ({ ...d, amis: d.amis.filter((x) => x.id !== l.id) })); } catch (e) { erreur(toast)(e); }
  }
  const cls = 'btn' + (small ? ' small' : '');
  if (cid === client.id) return null;
  if (!l || l.statut === 'refuse') return html`<button class=${cls + ' primary'} onClick=${demander}>➕ ${tr('Ajouter', 'Add friend', 'Ampio')}</button>`;
  if (l.statut === 'accepte') return html`<a class=${cls} href=${'#/messages?c=' + encodeURIComponent(dmId(client.id, cid))}>✉️ ${tr('Message', 'Message', 'Hafatra')}</a>`;
  if (l.a === client.id) return html`<span class="row gap"><button class=${cls + ' primary'} onClick=${() => repondre('accepte')}>✓ ${tr('Accepter', 'Accept', 'Ekena')}</button><button class=${cls + ' ghost'} onClick=${() => repondre('refuse')}>✕</button></span>`;
  return html`<button class=${cls + ' ghost'} onClick=${annuler}>⏳ ${tr('Demande envoyée', 'Request sent', 'Lasa')}</button>`;
}

// ---------- Profil d'un membre ----------
function ProfilMembre({ cid, client, R, onClose, onProfil }) {
  const { data, setData, toast } = useApp();
  const m = R.membres.get(cid);
  const moi = cid === client.id;
  const [edit, setEdit] = useState(false);
  const [signal, setSignal] = useState(null);
  const pubs = R.pubs.filter((p) => p.client_id === cid);
  const nbAmis = (data.amis || []).filter((a) => a.statut === 'accepte' && (a.de === cid || a.a === cid)).length;
  const bloque = R.bloques.has(cid);
  async function debloquer() {
    try { await supprimer('blocages', { client_id: client.id, bloque_id: cid }); setData((d) => ({ ...d, blocages: (d.blocages || []).filter((b) => b.bloque_id !== cid) })); toast(tr('Membre débloqué', 'Member unblocked', 'Afaka indray')); } catch (e) { erreur(toast)(e); }
  }
  if (!m) return html`<${Modal} title=${tr('Profil', 'Profile', 'Mombamomba')} onClose=${onClose}><p class="muted">${tr('Ce membre n\'est plus visible.', 'This member is no longer visible.', 'Tsy hita intsony.')}</p><//>`;
  return html`<${Modal} title=${m.pseudo} onClose=${onClose}>
    <div class="profil-head">
      <${Avatar} nom=${m.pseudo} photo=${m.photo_url} size=${88} />
      <h2>${m.pseudo}</h2>
      ${m.bio && html`<p class="muted">${m.bio}</p>`}
      ${m.montrer_objectif && m.objectif && html`<${Badge} tone="ok">🎯 ${m.objectif}<//>`}
      <div class="profil-stats"><span><b>${pubs.length}</b><small>${tr('publications', 'posts', 'hafatra')}</small></span><span><b>${nbAmis}</b><small>${tr('amis', 'friends', 'namana')}</small></span></div>
      <div class="row gap wrap profil-btns">${moi ? html`<button class="btn" onClick=${() => setEdit(true)}>✏️ ${tr('Modifier mon profil', 'Edit my profile', 'Hanova')}</button>`
        : bloque ? html`<button class="btn" onClick=${debloquer}>${tr('Débloquer', 'Unblock', 'Esory ny sakana')}</button>`
        : html`<${BoutonAmi} cid=${cid} client=${client} R=${R} /><button class="btn ghost" onClick=${() => setSignal({ type: 'membre', id: cid })}>🚩</button><button class="btn ghost" onClick=${() => setSignal({ type: 'bloquer', id: cid })}>🚫</button>`}</div>
    </div>
    ${edit ? html`<${EditProfil} client=${client} m=${m} onDone=${() => setEdit(false)} />`
      : !bloque && html`<div class="profil-pubs">${pubs.length ? pubs.slice(0, 20).map((p) => html`<${Post} key=${p.id} p=${p} client=${client} R=${R} onProfil=${onProfil} />`) : html`<p class="muted small center-text">${tr('Aucune publication visible.', 'No visible posts.', 'Tsy misy hafatra hita.')}</p>`}</div>`}
    ${signal && html`<${Signaler} cible=${signal} client=${client} R=${R} onClose=${() => setSignal(null)} />`}
  <//>`;
}

function EditProfil({ client, m, onDone }) {
  const { data, setData, toast } = useApp();
  const cat = data.categories.find((c) => c.id === client.categorie_id);
  const [f, setF] = useState({ pseudo: m.pseudo, bio: m.bio || '', photo_url: m.photo_url || null, visible: m.visible !== false, montrer_objectif: !!m.montrer_objectif });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  async function photo(file) {
    if (!file) return; setBusy(true);
    try { setF((x) => ({ ...x, photo_url: null })); const url = await uploadPhotoCommunaute(client.id, file); setF((x) => ({ ...x, photo_url: url })); } catch (e) { erreur(toast)(e); }
    setBusy(false);
  }
  async function ok() {
    try {
      const row = { ...m, ...f, pseudo: f.pseudo.trim(), bio: f.bio.trim() || null, objectif: cat ? catName(cat) : m.objectif || null };
      await upsert('communaute', row); setData((d) => ({ ...d, communaute: (d.communaute || []).map((c) => (c.client_id === client.id ? row : c)) }));
      toast(tr('Profil mis à jour', 'Profile updated', 'Voatahiry')); onDone();
    } catch (e) { erreur(toast)(/duplicate|unique/i.test(e.message) ? new Error(tr('Ce pseudo est déjà pris', 'This nickname is taken', 'Efa misy mampiasa')) : e); }
  }
  return html`<div class="col edit-profil">
    <div class="row gap"><${Avatar} nom=${f.pseudo} photo=${f.photo_url} size=${56} /><button class="btn" disabled=${busy} onClick=${() => fileRef.current.click()}>📷 ${busy ? '…' : tr('Changer la photo', 'Change photo', 'Hanova sary')}</button>${f.photo_url && html`<button class="link-btn" onClick=${() => setF({ ...f, photo_url: null })}>${tr('Retirer', 'Remove', 'Esory')}</button>`}
      <input ref=${fileRef} type="file" accept="image/*" hidden onChange=${(e) => { photo(e.target.files[0]); e.target.value = ''; }} /></div>
    <label class="field"><span class="field-label">${tr('Pseudo', 'Nickname', 'Anarana')}</span><input maxlength="30" value=${f.pseudo} onInput=${(e) => setF({ ...f, pseudo: e.target.value })} /></label>
    <label class="field"><span class="field-label">${tr('Présentation', 'Bio', 'Fampahafantarana')}</span><input maxlength="200" value=${f.bio} onInput=${(e) => setF({ ...f, bio: e.target.value })} /></label>
    ${cat && html`<label class="check"><input type="checkbox" checked=${f.montrer_objectif} onChange=${(e) => setF({ ...f, montrer_objectif: e.target.checked })} /> ${tr('Afficher mon objectif', 'Show my goal', 'Asehoy ny tanjoko')} (${catName(cat)})</label>`}
    <label class="check"><input type="checkbox" checked=${f.visible} onChange=${(e) => setF({ ...f, visible: e.target.checked })} /> ${tr('Les autres membres peuvent me trouver', 'Other members can find me', 'Hitan\'ny hafa aho')}</label>
    <div class="row gap"><button class="btn primary" disabled=${busy || f.pseudo.trim().length < 2} onClick=${ok}>${tr('Enregistrer', 'Save', 'Tehirizo')}</button><button class="btn ghost" onClick=${onDone}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button></div>
  </div>`;
}

// ---------- Amis ----------
function Amis({ client, R, onProfil }) {
  const [q, setQ] = useState('');
  const recues = R.liens.filter((a) => a.a === client.id && a.statut === 'attente');
  const tous = [...R.membres.values()].filter((c) => c.visible !== false && c.client_id !== client.id && !R.bloques.has(c.client_id));
  const suggestions = tous.filter((c) => !R.lien(c.client_id) && R.moi.objectif && c.objectif === R.moi.objectif).slice(0, 6);
  const trouves = q ? tous.filter((c) => c.pseudo.toLowerCase().includes(q.toLowerCase())).slice(0, 30) : [];
  const Ligne = ({ cid, sous }) => html`<div class="person"><button class="av-btn" onClick=${() => onProfil(cid)}><${Avatar} nom=${R.pseudo(cid)} photo=${R.photo(cid)} /></button><button class="grow person-txt" onClick=${() => onProfil(cid)}><b>${R.pseudo(cid)}</b>${sous && html`<small class="muted d-block">${sous}</small>`}</button><${BoutonAmi} cid=${cid} client=${client} R=${R} small /></div>`;
  return html`
    ${recues.length > 0 && html`<section class="c-card"><h2>📨 ${tr('Demandes d\'ami', 'Friend requests', 'Fangatahana')} <span class="wa-badge">${recues.length}</span></h2>${recues.map((a) => html`<${Ligne} cid=${a.de} sous=${depuis(a.created_at)} />`)}</section>`}
    <section class="c-card"><h2>🔎 ${tr('Trouver des membres', 'Find members', 'Hitady mpikambana')}</h2>
      <input type="search" placeholder=${tr('Rechercher un pseudo…', 'Search a nickname…', 'Hitady anarana…')} value=${q} onInput=${(e) => setQ(e.target.value)} />
      ${q && (trouves.length ? trouves.map((m) => html`<${Ligne} cid=${m.client_id} sous=${m.bio} />`) : html`<p class="muted small">${tr('Aucun membre trouvé.', 'No member found.', 'Tsy misy hita.')}</p>`)}</section>
    ${suggestions.length > 0 && html`<section class="c-card"><h2>✨ ${tr('Suggestions', 'Suggestions', 'Soso-kevitra')}</h2><p class="small muted">${tr('Ils ont le même objectif que vous', 'Same goal as you', 'Mitovy tanjona aminao')} : ${R.moi.objectif}</p>
      <div class="sugg-grid">${suggestions.map((m) => html`<div class="sugg"><button class="av-btn" onClick=${() => onProfil(m.client_id)}><${Avatar} nom=${m.pseudo} photo=${m.photo_url} size=${64} /></button><b>${m.pseudo}</b><${BoutonAmi} cid=${m.client_id} client=${client} R=${R} small /></div>`)}</div></section>`}
    <section class="c-card"><h2>🤝 ${tr('Mes amis', 'My friends', 'Ny namako')} (${R.amis.length})</h2>
      ${R.amis.length === 0 ? html`<p class="muted small">${tr('Cherchez des membres ou suivez les suggestions pour envoyer une demande.', 'Search members or use suggestions to send a request.', 'Tadiavo ny mpikambana.')}</p>` : R.amis.map((cid) => html`<${Ligne} cid=${cid} sous=${R.membres.get(cid)?.bio} />`)}
    </section>
    ${!q && html`<section class="c-card"><h2>🌍 ${tr('Tous les membres', 'All members', 'Mpikambana rehetra')} (${tous.length})</h2>${tous.slice(0, 40).map((m) => html`<${Ligne} cid=${m.client_id} sous=${m.montrer_objectif && m.objectif ? '🎯 ' + m.objectif : m.bio} />`)}</section>`}`;
}

// ---------- Notifications ----------
const ICONES = { reaction: '❤️', commentaire: '💬', reponse: '↪️', demande_ami: '📨', ami_accepte: '🤝', publication: '📝' };
function Notifs({ client, R, onProfil, onFil }) {
  const { setData } = useApp();
  useEffect(() => {
    const nl = R.notifs.filter((n) => !n.lu);
    if (!nl.length || client.id === 'CL-DEMO') return;
    const t = setTimeout(() => {
      setData((d) => ({ ...d, notifs_client: (d.notifs_client || []).map((n) => (n.client_id === client.id ? { ...n, lu: true } : n)) }));
      nl.slice(0, 60).forEach((n) => updateRow('notifs_client', n.id, { lu: true }).catch(() => {}));
    }, 1500);
    return () => clearTimeout(t);
  }, [R.notifs.length]);
  const ouvrir = (n) => {
    const q = new URLSearchParams((n.lien || '').split('?')[1] || '');
    if (q.get('membre')) onProfil(q.get('membre'));
    else if (n.lien) { location.hash = n.lien; }
    else onFil();
  };
  const demandes = R.liens.filter((a) => a.a === client.id && a.statut === 'attente');
  return html`<section class="c-card flush">
    ${demandes.length > 0 && html`<button class="notif-row unread" onClick=${() => { location.hash = '#/communaute?onglet=amis'; }}><span class="notif-ic">📨</span><span class="grow"><b>${demandes.length} ${tr('demande(s) d\'ami en attente', 'pending friend request(s)', 'fangatahana miandry')}</b></span><span class="chev">›</span></button>`}
    ${R.notifs.length === 0 && !demandes.length ? html`<div class="wa-empty">🔔<p>${tr('Aucune notification pour l\'instant.', 'No notifications yet.', 'Mbola tsy misy.')}</p></div>`
      : R.notifs.slice(0, 80).map((n) => html`<button key=${n.id} class=${'notif-row' + (n.lu ? '' : ' unread')} onClick=${() => ouvrir(n)}>
        <span class="notif-av"><${Avatar} nom=${n.acteur || '?'} size=${44} /><i>${ICONES[n.type] || '🔔'}</i></span>
        <span class="grow"><b>${n.titre}</b>${n.texte && html`<small class="d-block muted">« ${n.texte} »</small>`}<small class="d-block notif-t">${depuis(n.created_at)}</small></span>
        ${!n.lu && html`<i class="unread-dot"></i>`}</button>`)}
  </section>`;
}

// ---------- Encart pour l'accueil ----------
export function CommunauteResume({ client }) {
  const { data } = useApp();
  const R = useReseau(client);
  if (!R.moi) return html`<a class="c-card comm-card clickable" href="#/communaute"><span class="comm-ic">👥</span><span class="grow"><b>${tr('Rejoignez la communauté', 'Join the community', 'Midira amin\'ny fiaraha-monina')}</b><small class="d-block muted">${tr('Partagez vos repas et vos progrès, motivez-vous entre membres.', 'Share meals and progress, motivate each other.', 'Mizara sakafo sy fandrosoana, mifampahereza.')}</small></span><span class="chev">›</span></a>`;
  const nonLues = R.notifs.filter((n) => !n.lu);
  const demandes = R.liens.filter((a) => a.a === client.id && a.statut === 'attente').length;
  const derniere = R.pubs.find((p) => p.client_id !== client.id && R.amis.includes(p.client_id)) || R.pubs.find((p) => p.client_id !== client.id);
  const nbReac = (data.reactions || []).filter((r) => r.client_id !== client.id && R.pubs.some((p) => p.id === r.publication_id && p.client_id === client.id)).length;
  return html`<section class="c-card comm-card">
    <div class="row between"><h2>👥 ${tr('Communauté', 'Community', 'Fiaraha-monina')}</h2><a class="link-btn small" href="#/communaute">${tr('Ouvrir →', 'Open →', 'Sokafy →')}</a></div>
    <div class="comm-stats">
      <a href="#/communaute?onglet=notifs"><b>${nonLues.length}</b><small>🔔 ${tr('nouveautés', 'new', 'vaovao')}</small></a>
      <a href="#/communaute?onglet=amis"><b>${demandes}</b><small>📨 ${tr('demandes', 'requests', 'fangatahana')}</small></a>
      <a href="#/communaute?onglet=amis"><b>${R.amis.length}</b><small>🤝 ${tr('amis', 'friends', 'namana')}</small></a>
      <a href="#/communaute?onglet=fil"><b>${nbReac}</b><small>❤️ ${tr('réactions reçues', 'reactions', 'fihetseham-po')}</small></a>
    </div>
    ${nonLues[0] && html`<a class="comm-last" href="#/communaute?onglet=notifs">${ICONES[nonLues[0].type] || '🔔'} ${nonLues[0].titre}</a>`}
    ${derniere && html`<a class="comm-last" href=${'#/communaute?p=' + derniere.id}><${Avatar} nom=${R.pseudo(derniere.client_id)} photo=${R.photo(derniere.client_id)} size=${30} /><span class="grow"><b>${R.pseudo(derniere.client_id)}</b> <small class="muted">· ${depuis(derniere.created_at)}</small><small class="d-block">${(derniere.texte || (derniere.photos?.length ? '📷' : '')).slice(0, 90)}</small></span></a>`}
  </section>`;
}
