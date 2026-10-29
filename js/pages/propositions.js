// Ajouter des plats avec l'IA (gratuit) : noms de plats OU demande d'idées → prompt + Excel → ChatGPT / Claude.ai remplit → import.
import { html, useState, useMemo } from '../lib.js?v=202610290532';
import { useApp, Card, Badge, Field, CopyBox, SelectOrAdd, navigate } from '../ui.js?v=202610290532';
import { FOTOANA, SLOT_SHARE, slotTarget, fitStatus, nextId, uid, fmt, lineGrams, toNum } from '../calc.js?v=202610290532';
import { applyPlatTexts } from '../prompts.js?v=202610290532';
import { tr, fotLabel, catName, ingName, getLang } from '../i18n.js?v=202610290532';
import { uploadPlatImage } from '../db.js?v=202610290532';
import { promptAjout, exportAjout, readAjoutExcel, readAjoutJson, buildProps, parseNames } from '../ajout.js?v=202610290532';
import { fitLabel } from './plats.js?v=202610290532';

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
  const [props, setProps] = useState(() => { try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (e) { return []; } });
  const savePending = (list) => { setProps(list); try { if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list)); else localStorage.removeItem(PENDING_KEY); } catch (e) { /* tsy voatery */ } };
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

  function show(raw) {
    const list = buildProps(raw, data, opts);
    if (!list.length) throw new Error(tr('Aucun plat trouvé dans la réponse.', 'No dish found in the answer.', 'Tsy misy sakafo hita.'));
    const ex = new Set(props.map((p) => p.ref));
    const stamp = Date.now().toString(36);
    savePending([...props, ...list.map((p) => ({ ...p, ref: ex.has(p.ref) ? p.ref + '-' + stamp : p.ref, categorie: opts.categorie }))]);
    setImage(raw.image || null);
    toast(tr(`${list.length} plat(s) à valider ci-dessous`, `${list.length} dish(es) to approve below`, `Sakafo ${list.length} hamarinina eto ambany`));
    setTimeout(() => document.querySelector('.prop-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  async function onFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { show(await readAjoutExcel(f)); } catch (x) { toast(tr('Excel illisible : ', 'Unreadable Excel: ', 'Tsy voavaky ny Excel: ') + x.message, 'bad'); }
  }
  function onJson() {
    try { show(readAjoutJson(text)); } catch (x) { toast(tr('Réponse illisible : ', 'Unreadable answer: ', 'Tsy voavaky ny valiny: ') + x.message, 'bad'); }
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
      if (image && newPlats.length === 1 && props.length === 1) {
        try { const url = await uploadPlatImage(newPlats[0].id, image); await app.save('plats', { ...newPlats[0], image_url: url }); } catch (e) { /* sary tsy voatery */ }
      }
      toast(tr(`${newPlats.length} plat(s) validé(s) et ajouté(s)`, `${newPlats.length} dish(es) approved and added`, `Sakafo ${newPlats.length} voamarina sy nampidirina`) + (newIngs.length ? ' + ' + newIngs.length + ' ' + tr('ingrédient(s)', 'ingredient(s)', 'ingrédient') : ''));
      const refs = new Set(chosen.map((p) => p.ref));
      savePending(props.filter((p) => !refs.has(p.ref)));
    } catch (e) { toast(tr('Erreur : ', 'Error: ', 'Nisy olana: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }
  function refuse(ref) { savePending(props.filter((p) => p.ref !== ref)); }
  function clearAll() {
    if (confirm(tr('Refuser toutes les suggestions restantes ?', 'Reject all remaining suggestions?', 'Lavina daholo ve ny soso-kevitra sisa?'))) savePending([]);
  }

  const L = getLang();

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

    ${props.length > 0 && html`<${Card} title=${'4. ' + tr('Plats à valider', 'Dishes to approve', 'Sakafo hamarinina') + ' (' + props.length + ')'}
      actions=${html`<button class="btn small ghost danger" onClick=${clearAll}>✕ ${tr('Tout refuser', 'Reject all', 'Lavina daholo')}</button>`}>
      <p class="small muted">${tr('Les suggestions restent ici (même si vous quittez la page) jusqu\'à ce que vous les validiez ou refusiez. Seuls les plats validés vont dans « Plats ».', 'Suggestions stay here (even if you leave the page) until you approve or reject them. Only approved dishes go to "Dishes".', 'Mijanona eto ny soso-kevitra (na dia miala amin\'ny pejy aza ianao) mandra-pamarinanao na handavanao azy. Ny sakafo voamarina ihany no miditra ao amin\'ny « Plats ».')}</p>
      ${[...new Set(props.map((p) => p.categorie || ''))].map((cid) => {
        const cat = data.categories.find((c) => c.id === cid);
        const group = props.filter((p) => (p.categorie || '') === cid);
        const valid = group.filter((p) => !p.doublon);
        return html`<div class="prop-group" key=${cid}>
          <div class="row gap wrap prop-group-head"><h3>🎯 ${cat ? catName(cat) : tr('Sans objectif', 'No goal', 'Tsy misy tanjona')} <span class="muted">(${group.length})</span></h3>
            ${valid.length > 1 && html`<button class="btn small" disabled=${busy} onClick=${() => addPlats(valid)}>✓ ${tr(`Valider les ${valid.length}`, `Approve all ${valid.length}`, `Hamarino ireo ${valid.length}`)}</button>`}</div>
          <div class="prop-grid">${group.map((p) => {
            const fit = fitStatus(p.totals.kcal, slotTarget(cat, p.fotoana), cat?.tolerance);
            const tx = p.texts.texts[L] && Object.keys(p.texts.texts[L]).length ? p.texts.texts[L] : p.texts.texts.fr;
            return html`<article class=${'prop' + (p.doublon ? ' doublon' : '')} key=${p.ref}>
              <header><div><h3>${tx.nom_commercial || p.nom}</h3><small class="muted">${p.nom} · ${fotLabel(p.fotoana)}</small></div></header>
              ${p.doublon && html`<p class="small warn-text">⚠ ${tr('Ce plat existe déjà dans « Plats ».', 'This dish already exists in "Dishes".', 'Efa misy ao amin\'ny « Plats » ity sakafo ity.')}</p>`}
              ${tx.marketing && html`<p class="small">${tx.marketing}</p>`}
              <div class="row gap wrap"><b>${fmt(p.totals.kcal)} kcal</b><span>P ${fmt(p.totals.proteines)} g</span><span>G ${fmt(p.totals.glucides)} g</span><span>L ${fmt(p.totals.lipides)} g</span>${fit.label !== '—' && html`<${Badge} tone=${fit.tone}>${fitLabel(fit)}<//>`}</div>
              <ul class="small ing-list">${p.lines.map((l) => html`<li>${l.nouvel ? html`<${Badge} tone="warn">${tr('nouveau', 'new', 'vaovao')}<//> ${ingName(l.nouvel)}` : ingName(ingMap.get(l.ingredient_id))} — ${fmt(l.quantite, l.quantite % 1 ? 1 : 0)} ${l.unite}${l.note ? ' (' + l.note + ')' : ''}</li>`)}</ul>
              ${p.lines.length === 0 && html`<p class="small warn-text">${tr('Pas de composition dans la réponse.', 'No composition in the answer.', 'Tsy misy composition ao amin\'ny valiny.')}</p>`}
              ${p.totals.missing > 0 && html`<p class="small warn-text">${tr('Un ingrédient n\'a pas de valeurs ou de poids : calcul incomplet (à compléter ensuite).', 'An ingredient has no values or weight: incomplete (complete later).', 'Misy ingrédient tsy misy valeur na lanja: tsy feno (fenoina aorian\'izay).')}</p>`}
              ${tx.avantages && html`<p class="small muted pre">${tx.avantages}</p>`}
              <div class="prop-actions">
                <button class="btn primary small" disabled=${busy} onClick=${() => addPlats([p])}>✓ ${p.doublon ? tr('Ajouter quand même', 'Add anyway', 'Ampidiro ihany') : tr('Valider', 'Approve', 'Marina')}</button>
                <button class="btn ghost small danger" disabled=${busy} onClick=${() => refuse(p.ref)}>✕ ${tr('Refuser', 'Reject', 'Lavina')}</button>
              </div>
            </article>`;
          })}</div>
        </div>`;
      })}
      <p class="hint">${tr('Après validation, vous pouvez ajuster chaque plat, ajouter le prix et la photo dans « Plats ».', 'After approval, adjust each dish, add the price and the photo in "Dishes".', 'Rehefa voamarina, azonao amboarina ao amin\'ny « Plats » ny sakafo tsirairay, ampiana vidiny sy sary.')}</p>
    <//>`}
  </div>`;
}
