// Ajouter des plats avec l'IA (gratuit) : noms de plats OU demande d'idées → prompt + Excel → ChatGPT / Claude.ai remplit → import.
import { html, useState, useMemo, useEffect } from '../lib.js?v=202610290744';
import { useApp, Card, Badge, Field, CopyBox, SelectOrAdd, navigate } from '../ui.js?v=202610290744';
import { FOTOANA, SLOT_SHARE, slotTarget, fitStatus, nextId, uid, fmt, lineGrams, toNum } from '../calc.js?v=202610290744';
import { applyPlatTexts } from '../prompts.js?v=202610290744';
import { tr, fotLabel, catName, ingName, getLang } from '../i18n.js?v=202610290744';
import { uploadPlatImage } from '../db.js?v=202610290744';
import { promptAjout, exportAjout, readAjoutExcel, readAjoutJson, buildProps, parseNames, isExisting } from '../ajout.js?v=202610290744';
import { fitLabel } from './plats.js?v=202610290744';

const PENDING_KEY = 'sakafo_ajout_attente';
const r10 = (x) => Math.round(x / 10) * 10;
// Intervalles par défaut : kcal ± 10 % autour de la cible du moment, protéines = 20 à 30 % des kcal
function ranges(cat, fotoana) {
  const t = slotTarget(cat, fotoana) || 500;
  return { kcalMin: r10(t * 0.9), kcalMax: r10(t * 1.1), protMin: Math.round((t * 0.2) / 4), protMax: Math.round((t * 0.3) / 4) };
}
function Range({ label, a, b, onA, onB, unit, step }) {
  return html`<${Field} label=${label}><div class="range-in">
    <input type="number" min="0" step=${step || 1} value=${a} placeholder="min" onInput=${(e) => onA(e.target.value)} />
    <span>→</span>
    <input type="number" min="0" step=${step || 1} value=${b} placeholder="max" onInput=${(e) => onB(e.target.value)} />
    ${unit && html`<small class="muted">${unit}</small>`}
  </div><//>`;
}

export function Propositions() {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const [opts, setOpts] = useState(() => ({ mode: 'idees', noms: '', categorie: cats[0]?.id || '', fotoana: 'Atoandro', isa: 10, ...ranges(cats[0], 'Atoandro'), budgetMin: '', budgetMax: '', style: '', remarques: '' }));
  const [text, setText] = useState('');
  // Soso-kevitra voatahiry ao amin'ny Supabase (table suggestions): mijanona raha tsy lavina
  const props = useMemo(() => (data.suggestions || [])
    .map((r) => ({ ...(r.data || {}), id: r.id, statut: r.statut || 'attente', categorie: r.categorie_id || '', fotoana: r.fotoana || r.data?.fotoana, plat_id: r.plat_id, created_at: r.created_at || r.data?.created_at || '' }))
    .map((p) => ({ ...p, doublon: p.statut === 'attente' && isExisting(data, p.nom, p.texts?.texts?.fr?.nom_commercial) }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), [data.suggestions, data.plats]);
  const toRow = (p, patch = {}) => {
    const { id, statut, categorie, fotoana, plat_id, doublon, ...rest } = p;
    const row = { id, statut: statut || 'attente', categorie_id: categorie || null, fotoana: fotoana || null, nom: p.nom || null, plat_id: plat_id || null, data: { ...rest, fotoana }, ...patch };
    if (p.created_at) row.created_at = p.created_at;
    return row;
  };
  const [fObj, setFObj] = useState('');
  const [fMom, setFMom] = useState('');
  const [fStat, setFStat] = useState('attente');
  const [fq, setFq] = useState('');
  // Famindrana ireo soso-kevitra tao amin'ny navigateur (version teo aloha) any amin'ny Supabase
  useEffect(() => {
    let old = [];
    try { old = JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (e) { return; }
    if (!old.length) return;
    app.save('suggestions', old.map((p) => toRow({ ...p, id: 'SG-' + uid() }))).then(() => { try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* */ } }).catch(() => {});
  }, []);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const category = data.categories.find((c) => c.id === opts.categorie);

  const set = (k, v) => setOpts((o) => {
    const n = { ...o, [k]: v };
    if (k === 'categorie' || k === 'fotoana') Object.assign(n, ranges(data.categories.find((x) => x.id === n.categorie), n.fotoana));
    return n;
  });

  const names = parseNames(opts.noms);
  const ready = opts.mode === 'idees' || names.length > 0;
  const prompt = useMemo(() => promptAjout(opts, data), [opts, data]);

  async function show(raw) {
    const list = buildProps(raw, data, opts);
    if (!list.length) throw new Error(tr('Aucun plat trouvé dans la réponse.', 'No dish found in the answer.', 'Tsy misy sakafo hita.'));
    await app.save('suggestions', list.map((p, i) => toRow({ ...p, id: 'SG-' + uid(), categorie: opts.categorie, created_at: new Date(Date.now() - i).toISOString() })));
    setFStat('attente'); setFObj(''); setFMom(''); setFq('');
    setImage(raw.image || null);
    toast(tr(`${list.length} plat(s) à valider ci-dessous`, `${list.length} dish(es) to approve below`, `Sakafo ${list.length} hamarinina eto ambany`));
    setTimeout(() => document.querySelector('.prop-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  async function onFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { await show(await readAjoutExcel(f)); } catch (x) { toast(tr('Excel illisible : ', 'Unreadable Excel: ', 'Tsy voavaky ny Excel: ') + x.message, 'bad'); }
  }
  async function onJson() {
    try { await show(readAjoutJson(text)); } catch (x) { toast(tr('Réponse illisible : ', 'Unreadable answer: ', 'Tsy voavaky ny valiny: ') + x.message, 'bad'); }
  }

  // Manampy sakafo iray na maromaro ao amin'ny "Plats" (rehefa voamarina)
  async function addPlats(chosen) {
    setBusy(true);
    try {
      const ingPool = [...data.ingredients];
      const platPool = [...data.plats];
      const key = (x) => String(x || '').trim().toLowerCase();
      const created = new Map(); // NEW:<nom> → id
      const newIngs = []; const newPlats = []; const newLines = [];
      for (const p of chosen) {
        const platId = nextId('SK', platPool);
        const catId = p.categorie || opts.categorie;
        const base = {
          id: platId, nom: p.nom, nom_commercial: '', marketing: '', avantages: '', nom_en: '', fotoana: p.fotoana, categories: catId ? [catId] : [],
          nb: p.nb || '', traductions: {}, details: {}, image_url: '', prix_vente: null, statut: 'Voamarina', notes: tr('Ajouté avec l\'IA', 'Added with AI', 'Nampidirina tamin\'ny IA'),
        };
        const plat = applyPlatTexts(base, p.texts);
        platPool.push(plat); newPlats.push(plat);
        p.lines.forEach((l, i) => {
          let ingId = l.ingredient_id;
          if (l.nouvel) {
            const same = ingPool.find((x) => [x.nom_fr, x.nom_mg].some((n) => n && [l.nouvel.nom_fr, l.nouvel.nom_mg].some((m) => m && key(n) === key(m))));
            if (created.has(ingId)) ingId = created.get(ingId);
            else if (same) { created.set(ingId, same.id); ingId = same.id; } // efa nampidirina tamin'ny sakafo teo aloha
            else {
              const ing = { ...l.nouvel, id: nextId('I', ingPool, 3), a_verifier: true };
              ingPool.push(ing); newIngs.push(ing); created.set(l.ingredient_id, ing.id); ingId = ing.id;
            }
          }
          const ing = ingPool.find((x) => x.id === ingId);
          newLines.push({ id: uid(), plat_id: platId, ingredient_id: ingId, quantite: l.quantite, unite: l.unite, note: l.note || null, grammes: Math.round((lineGrams(l, ing) || 0) * 10) / 10, ordre: i });
        });
      }
      if (newIngs.length) await app.save('ingredients', newIngs);
      await app.save('plats', newPlats);
      if (newLines.length) await app.save('composition', newLines);
      if (image && newPlats.length === 1 && chosen[0].created_at && Date.now() - Date.parse(chosen[0].created_at) < 36e5) {
        try { const url = await uploadPlatImage(newPlats[0].id, image); await app.save('plats', { ...newPlats[0], image_url: url }); } catch (e) { /* sary tsy voatery */ }
      }
      toast(tr(`${newPlats.length} plat(s) validé(s) et ajouté(s)`, `${newPlats.length} dish(es) approved and added`, `Sakafo ${newPlats.length} voamarina sy nampidirina`) + (newIngs.length ? ' + ' + newIngs.length + ' ' + tr('ingrédient(s)', 'ingredient(s)', 'ingrédient') : ''));
      await app.save('suggestions', chosen.map((p, i) => toRow(p, { statut: 'valide', plat_id: newPlats[i].id })));
    } catch (e) { toast(tr('Erreur : ', 'Error: ', 'Nisy olana: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }
  async function refuse(list) {
    try { await app.del('suggestions', list.map((p) => p.id)); } catch (e) { toast(e.message, 'bad'); }
  }
  function refuseAll(list) {
    if (confirm(tr(`Refuser (supprimer) ces ${list.length} suggestion(s) ?`, `Reject (delete) these ${list.length} suggestion(s)?`, `Lavina (fafana) ireo soso-kevitra ${list.length} ireo?`))) refuse(list);
  }

  const L = getLang();
  // Sivana: tanjona, fotoana, statut, fikarohana
  const nq = (x) => String(x || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const statOk = (p, k) => !k || (k === 'doublon' ? p.doublon : k === 'attente' ? p.statut === 'attente' && !p.doublon : p.statut === k);
  const match = (p, { cat = fObj, mom = fMom, stat = fStat, q = fq } = {}) => (!cat || p.categorie === cat) && (!mom || p.fotoana === mom) && statOk(p, stat)
    && (!q.trim() || nq(q).split(/\s+/).every((w) => nq([p.nom, p.texts?.texts?.fr?.nom_commercial, ...(p.lines || []).map((l) => (l.nouvel ? ingName(l.nouvel) : ingName(ingMap.get(l.ingredient_id))))].join(' ')).includes(w)));
  const count = (o) => props.filter((p) => match(p, o)).length;
  const shown = props.filter((p) => match(p));
  const moments = [...new Set([...FOTOANA.filter((m) => props.some((p) => p.fotoana === m)), ...props.map((p) => p.fotoana).filter(Boolean)])];
  const nbAttente = props.filter((p) => p.statut === 'attente').length;

  return html`<div class="page">
    <h1>${tr('Ajouter des plats avec l\'IA', 'Add dishes with AI', 'Hampiditra sakafo amin\'ny IA')}</h1>
    <p class="muted">${tr('Gratuit : vous copiez le prompt et l\'Excel dans ChatGPT ou Claude.ai, l\'IA remplit tout (ingrédients, quantités, valeurs, textes FR/EN/MG, allergènes), puis vous importez l\'Excel rempli et choisissez les plats à garder.', 'Free: copy the prompt and the Excel into ChatGPT or Claude.ai, the AI fills everything (ingredients, quantities, values, FR/EN/MG texts, allergens), then import the filled Excel and choose the dishes to keep.', 'Maimaim-poana: adikao ao amin\'ny ChatGPT na Claude.ai ny prompt sy ny Excel, fenoin\'ny IA daholo (ingrédients, habetsahana, valeur, texte FR/EN/MG, allergènes), dia ampidiro ny Excel feno ary safidio izay tehirizina.')}</p>

    <${Card} title=${'1. ' + tr('Que voulez-vous ajouter ?', 'What do you want to add?', 'Inona no hampidirina?')}>
      <div class="tabs">
        <button class=${'tab' + (opts.mode === 'idees' ? ' on' : '')} onClick=${() => set('mode', 'idees')}>${tr('Je veux des idées', 'I want ideas', 'Mila hevitra aho')}</button>
        <button class=${'tab' + (opts.mode === 'noms' ? ' on' : '')} onClick=${() => set('mode', 'noms')}>${tr('J\'ai les noms des plats', 'I have the dish names', 'Manana ny anaran\'ny sakafo aho')}</button>
      </div>
      <p class="small muted">💡 ${tr(`Le prompt et l'Excel contiennent vos ${data.plats.length} plats existants : l'IA ne les proposera pas à nouveau.`, `The prompt and Excel list your ${data.plats.length} existing dishes: the AI won't suggest them again.`, `Ao anatin'ny prompt sy Excel ireo sakafo ${data.plats.length} efa misy: tsy haroson'ny IA indray izy ireo.`)}</p>
      <div class="form-grid">
        ${opts.mode === 'noms' && html`<${Field} label=${tr('Noms des plats (un par ligne)', 'Dish names (one per line)', 'Anaran\'ny sakafo (iray isaky ny andalana)')} wide hint=${names.length ? names.length + ' ' + tr('plat(s)', 'dish(es)', 'sakafo') : ''}>
          <textarea rows="5" value=${opts.noms} placeholder=${tr('Romazava au bœuf\nSalade de lentilles\nPorridge avoine banane', 'Beef romazava\nLentil salad\nOat banana porridge', 'Romazava hena omby\nSalady lentilles\nPorridge avoine akondro')} onInput=${(e) => set('noms', e.target.value)}></textarea><//>`}
        <${Field} label=${tr('Objectif', 'Goal', 'Tanjona')}><select value=${opts.categorie} onChange=${(e) => set('categorie', e.target.value)}>${cats.map((c) => html`<option value=${c.id}>${catName(c)}</option>`)}</select><//>
        <${Field} label=${tr('Moment', 'Meal time', 'Fotoana')}><${SelectOrAdd} type="fotoana" value=${opts.fotoana} defaults=${FOTOANA} labelFn=${fotLabel} onChange=${(v) => set('fotoana', v)} /><//>
        ${opts.mode === 'idees' && html`
          <${Field} label=${tr('Nombre de plats', 'Number of dishes', 'Isan\'ny sakafo')}><input type="number" min="1" max="20" value=${opts.isa} onInput=${(e) => set('isa', e.target.value)} /><//>
          <${Range} label=${tr('Kcal par plat', 'Kcal per dish', 'Kcal isaky ny sakafo')} unit="kcal" step="10" a=${opts.kcalMin} b=${opts.kcalMax} onA=${(v) => set('kcalMin', v)} onB=${(v) => set('kcalMax', v)} />
          <${Range} label=${tr('Protéines par plat', 'Protein per dish', 'Protéines isaky ny sakafo')} unit="g" a=${opts.protMin} b=${opts.protMax} onA=${(v) => set('protMin', v)} onB=${(v) => set('protMax', v)} />
          <${Range} label=${tr('Budget par plat (facultatif)', 'Budget per dish (optional)', 'Budget isaky ny sakafo (tsy voatery)')} unit="Ar" step="500" a=${opts.budgetMin} b=${opts.budgetMax} onA=${(v) => set('budgetMin', v)} onB=${(v) => set('budgetMax', v)} />
          <${Field} label=${tr('Style', 'Style', 'Endrika')} wide><input value=${opts.style} onInput=${(e) => set('style', e.target.value)} placeholder=${tr('ex. uniquement malgache, sans porc…', 'e.g. Malagasy only, no pork…', 'ohatra: malagasy fotsiny, tsy misy henakisoa…')} /><//>`}
        <${Field} label=${tr('Remarques (facultatif)', 'Remarks (optional)', 'Fanamarihana (tsy voatery)')} wide><input value=${opts.remarques} onInput=${(e) => set('remarques', e.target.value)} placeholder=${tr('ex. portions généreuses, sans piment', 'e.g. generous portions, no chilli', 'ohatra: be ny habetsahany, tsy misy sakay')} /><//>
      </div>
    <//>

    <${Card} title=${'2. ' + tr('Envoyez à ChatGPT ou Claude.ai', 'Send to ChatGPT or Claude.ai', 'Alefaso any amin\'ny ChatGPT na Claude.ai')}>
      ${!ready && html`<p class="warn-box">${tr('Écrivez d\'abord au moins un nom de plat.', 'Write at least one dish name first.', 'Soraty aloha ny anaran\'ny sakafo iray farafahakeliny.')}</p>`}
      <div class="ai-steps two">
        <div class="ai-step">
          <h3><span class="num-circle">a</span> ${tr('Copier le prompt', 'Copy the prompt', 'Adikao ny prompt')}</h3>
          <${CopyBox} text=${prompt} rows="12" />
        </div>
        <div class="ai-step">
          <h3><span class="num-circle">b</span> ${tr('Télécharger l\'Excel à remplir', 'Download the Excel to fill', 'Alaivo ny Excel hofenoina')}</h3>
          <p class="small muted">${tr('Joignez-le au prompt dans la même conversation. L\'IA vous renverra l\'Excel complété.', 'Attach it to the prompt in the same conversation. The AI will send the filled Excel back.', 'Ampiarahina amin\'ny prompt ao amin\'ny resaka iray ihany. Haverin\'ny IA aminao ny Excel feno.')}</p>
          <button class="btn" disabled=${!ready} onClick=${() => exportAjout(opts, data).catch((e) => toast(e.message, 'bad'))}>⬇ ajout_plats.xlsx</button>
        </div>
      </div>
    <//>

    <${Card} title=${'3. ' + tr('Importer la réponse', 'Import the answer', 'Ampidiro ny valiny')}>
      <div class="row gap wrap">
        <label class="btn primary">⬆ ${tr('Importer l\'Excel rempli', 'Import the filled Excel', 'Ampidiro ny Excel feno')}<input type="file" accept=".xlsx,.xls,.csv" hidden onChange=${onFile} /></label>
        <span class="muted small">${tr('ou, si l\'IA a répondu en texte (JSON) :', 'or, if the AI answered in text (JSON):', 'na, raha soratra (JSON) no navalin\'ny IA:')}</span>
      </div>
      <textarea rows="4" class="mono" placeholder=${tr('Collez ici la réponse JSON…', 'Paste the JSON answer here…', 'Apetaho eto ny valiny JSON…')} value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
      <button class="btn" disabled=${!text.trim()} onClick=${onJson}>${tr('Lire la réponse', 'Read the answer', 'Vakio ny valiny')}</button>
    <//>

    ${props.length > 0 && html`<${Card} title=${'4. ' + tr('Suggestions', 'Suggestions', 'Soso-kevitra') + ' (' + nbAttente + ' ' + tr('à valider', 'to approve', 'hamarinina') + ')'}>
      <p class="small muted">${tr('Les suggestions restent ici (sur tous vos appareils) tant que vous ne les refusez pas. Seuls les plats validés vont dans « Plats ».', 'Suggestions stay here (on all your devices) until you reject them. Only approved dishes go to "Dishes".', 'Mijanona eto ny soso-kevitra (amin\'ny fitaovanao rehetra) raha tsy lavinao. Ny sakafo voamarina ihany no miditra ao amin\'ny « Plats ».')}</p>
      <div class="filters sugg-filters">
        <input type="search" placeholder=${tr('Rechercher (nom, ingrédient)…', 'Search (name, ingredient)…', 'Hikaroka (anarana, ingrédient)…')} value=${fq} onInput=${(e) => setFq(e.target.value)} />
        <select value=${fObj} onChange=${(e) => setFObj(e.target.value)}>
          <option value="">🎯 ${tr('Tous les objectifs', 'All goals', 'Tanjona rehetra')}</option>
          ${cats.map((c) => html`<option value=${c.id}>${catName(c)} (${count({ cat: c.id })})</option>`)}
        </select>
        <select value=${fMom} onChange=${(e) => setFMom(e.target.value)}>
          <option value="">🕒 ${tr('Tous les moments', 'All meal times', 'Fotoana rehetra')}</option>
          ${moments.map((m) => html`<option value=${m}>${fotLabel(m)} (${count({ mom: m })})</option>`)}
        </select>
        <div class="tabs mini">
          ${[['attente', tr('À valider', 'To approve', 'Hamarinina')], ['valide', tr('Validés', 'Approved', 'Voamarina')], ['doublon', tr('Déjà existants', 'Already exist', 'Efa misy')], ['', tr('Tous', 'All', 'Rehetra')]].map(([k, l]) => html`<button class=${'tab' + (fStat === k ? ' on' : '')} onClick=${() => setFStat(k)}>${l} (${count({ stat: k })})</button>`)}
        </div>
      </div>
      ${shown.length === 0 && html`<p class="muted">${tr('Aucune suggestion pour ces filtres.', 'No suggestion for these filters.', 'Tsy misy soso-kevitra amin\'ireo sivana ireo.')}</p>`}
      ${[...new Set(shown.map((p) => p.categorie || ''))].map((cid) => {
        const cat = data.categories.find((c) => c.id === cid);
        const group = shown.filter((p) => (p.categorie || '') === cid);
        const valid = group.filter((p) => p.statut === 'attente' && !p.doublon);
        const pending = group.filter((p) => p.statut === 'attente');
        return html`<div class="prop-group" key=${cid}>
          <div class="row gap wrap prop-group-head"><h3>🎯 ${cat ? catName(cat) : tr('Sans objectif', 'No goal', 'Tsy misy tanjona')} <span class="muted">(${group.length})</span></h3>
            <div class="row gap wrap">
              ${valid.length > 1 && html`<button class="btn small" disabled=${busy} onClick=${() => addPlats(valid)}>✓ ${tr(`Valider les ${valid.length}`, `Approve all ${valid.length}`, `Hamarino ireo ${valid.length}`)}</button>`}
              ${pending.length > 1 && html`<button class="btn small ghost danger" disabled=${busy} onClick=${() => refuseAll(pending)}>✕ ${tr('Tout refuser', 'Reject all', 'Lavina daholo')}</button>`}
            </div></div>
          <div class="prop-grid">${group.map((p) => {
            const fit = fitStatus(p.totals?.kcal, slotTarget(cat, p.fotoana), cat?.tolerance);
            const T = p.texts?.texts || { fr: {} };
            const tx = T[L] && Object.keys(T[L]).length ? T[L] : (T.fr || {});
            const ok = p.statut === 'valide';
            const lines = p.lines || [];
            return html`<article class=${'prop' + (p.doublon ? ' doublon' : '') + (ok ? ' valide' : '')} key=${p.id}>
              <header><div><h3>${tx.nom_commercial || p.nom}</h3><small class="muted">${p.nom} · ${fotLabel(p.fotoana)}</small></div>${ok && html`<${Badge} tone="ok">✓ ${tr('Validé', 'Approved', 'Voamarina')}<//>`}</header>
              ${p.doublon && html`<p class="small warn-text">⚠ ${tr('Ce plat existe déjà dans « Plats ».', 'This dish already exists in "Dishes".', 'Efa misy ao amin\'ny « Plats » ity sakafo ity.')}</p>`}
              ${tx.marketing && html`<p class="small">${tx.marketing}</p>`}
              <div class="row gap wrap"><b>${fmt(p.totals?.kcal)} kcal</b><span>P ${fmt(p.totals?.proteines)} g</span><span>G ${fmt(p.totals?.glucides)} g</span><span>L ${fmt(p.totals?.lipides)} g</span>${fit.label !== '—' && html`<${Badge} tone=${fit.tone}>${fitLabel(fit)}<//>`}</div>
              <ul class="small ing-list">${lines.map((l) => html`<li>${l.nouvel ? html`<${Badge} tone="warn">${tr('nouveau', 'new', 'vaovao')}<//> ${ingName(l.nouvel)}` : ingName(ingMap.get(l.ingredient_id))} — ${fmt(l.quantite, l.quantite % 1 ? 1 : 0)} ${l.unite}${l.note ? ' (' + l.note + ')' : ''}</li>`)}</ul>
              ${lines.length === 0 && html`<p class="small warn-text">${tr('Pas de composition dans la réponse.', 'No composition in the answer.', 'Tsy misy composition ao amin\'ny valiny.')}</p>`}
              ${!ok && p.totals?.missing > 0 && html`<p class="small warn-text">${tr('Un ingrédient n\'a pas de valeurs ou de poids : calcul incomplet (à compléter ensuite).', 'An ingredient has no values or weight: incomplete (complete later).', 'Misy ingrédient tsy misy valeur na lanja: tsy feno (fenoina aorian\'izay).')}</p>`}
              ${tx.avantages && html`<p class="small muted pre">${tx.avantages}</p>`}
              <div class="prop-actions">
                ${ok
                  ? html`${p.plat_id && data.plats.some((x) => x.id === p.plat_id) && html`<button class="btn small" onClick=${() => navigate('/plats/' + p.plat_id)}>${tr('Voir le plat', 'Open dish', 'Jereo ny sakafo')}</button>`}
                    <button class="btn ghost small" disabled=${busy} onClick=${() => refuse([p])}>${tr('Retirer de la liste', 'Remove from list', 'Esory amin\'ny lisitra')}</button>`
                  : html`<button class="btn primary small" disabled=${busy} onClick=${() => addPlats([p])}>✓ ${p.doublon ? tr('Ajouter quand même', 'Add anyway', 'Ampidiro ihany') : tr('Valider', 'Approve', 'Marina')}</button>
                    <button class="btn ghost small danger" disabled=${busy} onClick=${() => refuse([p])}>✕ ${tr('Refuser', 'Reject', 'Lavina')}</button>`}
              </div>
            </article>`;
          })}</div>
        </div>`;
      })}
      <p class="hint">${tr('Après validation, vous pouvez ajuster chaque plat, ajouter le prix et la photo dans « Plats ».', 'After approval, adjust each dish, add the price and the photo in "Dishes".', 'Rehefa voamarina, azonao amboarina ao amin\'ny « Plats » ny sakafo tsirairay, ampiana vidiny sy sary.')}</p>
    <//>`}
  </div>`;
}
