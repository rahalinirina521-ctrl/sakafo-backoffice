// Ajouter des plats avec l'IA (gratuit) : noms de plats OU demande d'idées → prompt + Excel → ChatGPT / Claude.ai remplit → import.
import { html, useState, useMemo } from '../lib.js?v=202610290520';
import { useApp, Card, Badge, Field, CopyBox, SelectOrAdd, navigate } from '../ui.js?v=202610290520';
import { FOTOANA, SLOT_SHARE, slotTarget, fitStatus, nextId, uid, fmt, lineGrams, toNum } from '../calc.js?v=202610290520';
import { applyPlatTexts } from '../prompts.js?v=202610290520';
import { tr, fotLabel, catName, ingName, getLang } from '../i18n.js?v=202610290520';
import { uploadPlatImage } from '../db.js?v=202610290520';
import { promptAjout, exportAjout, readAjoutExcel, readAjoutJson, buildProps, parseNames } from '../ajout.js?v=202610290520';
import { fitLabel } from './plats.js?v=202610290520';

export function Propositions() {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const [opts, setOpts] = useState(() => {
    const c = cats[0];
    return { mode: 'noms', noms: '', categorie: c?.id || '', fotoana: 'Atoandro', kcal: c?.kcal_cible ? Math.round(c.kcal_cible * SLOT_SHARE.Atoandro) : 500, isa: 6, prot: '', budget: '', style: '', remarques: '' };
  });
  const [text, setText] = useState('');
  const [props, setProps] = useState([]);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const category = data.categories.find((c) => c.id === opts.categorie);

  const set = (k, v) => setOpts((o) => {
    const n = { ...o, [k]: v };
    if (k === 'categorie' || k === 'fotoana') {
      const c = data.categories.find((x) => x.id === n.categorie);
      const t = slotTarget(c, n.fotoana);
      if (t) n.kcal = Math.round(t);
    }
    return n;
  });

  const names = parseNames(opts.noms);
  const ready = opts.mode === 'idees' || names.length > 0;
  const prompt = useMemo(() => promptAjout(opts, data), [opts, data]);

  function show(raw) {
    const list = buildProps(raw, data, opts);
    if (!list.length) throw new Error(tr('Aucun plat trouvé dans la réponse.', 'No dish found in the answer.', 'Tsy misy sakafo hita.'));
    setProps(list);
    setImage(raw.image || null);
    toast(tr(`${list.length} plat(s) lus : vérifiez puis ajoutez.`, `${list.length} dish(es) read: check, then add.`, `Sakafo ${list.length} voavaky: hamarino dia ampidiro.`));
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

  async function importSelected() {
    const chosen = props.filter((p) => p.selected);
    if (!chosen.length) { toast(tr('Sélectionnez au moins un plat', 'Select at least one dish', 'Misafidiana sakafo iray farafahakeliny'), 'bad'); return; }
    setBusy(true);
    try {
      const ingPool = [...data.ingredients];
      const platPool = [...data.plats];
      const created = new Map(); // NEW:<nom> → id
      const newIngs = []; const newPlats = []; const newLines = [];
      for (const p of chosen) {
        const platId = nextId('SK', platPool);
        const base = {
          id: platId, nom: p.nom, nom_commercial: '', marketing: '', avantages: '', nom_en: '', fotoana: p.fotoana, categories: opts.categorie ? [opts.categorie] : [],
          nb: p.nb || '', traductions: {}, details: {}, image_url: '', prix_vente: null, statut: 'Voamarina', notes: tr('Ajouté avec l\'IA', 'Added with AI', 'Nampidirina tamin\'ny IA'),
        };
        const plat = applyPlatTexts(base, p.texts);
        platPool.push(plat); newPlats.push(plat);
        p.lines.forEach((l, i) => {
          let ingId = l.ingredient_id;
          if (l.nouvel) {
            if (created.has(ingId)) ingId = created.get(ingId);
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
      if (image && newPlats.length === 1) {
        try { const url = await uploadPlatImage(newPlats[0].id, image); await app.save('plats', { ...newPlats[0], image_url: url }); } catch (e) { /* sary tsy voatery */ }
      }
      toast(tr(`${newPlats.length} plat(s) ajouté(s)`, `${newPlats.length} dish(es) added`, `Sakafo ${newPlats.length} nampidirina`) + (newIngs.length ? ' + ' + newIngs.length + ' ' + tr('ingrédient(s)', 'ingredient(s)', 'ingrédient') : ''));
      setProps((ps) => ps.filter((p) => !p.selected));
      if (newPlats.length === 1) navigate('/plats/' + newPlats[0].id);
    } catch (e) { toast(tr('Erreur : ', 'Error: ', 'Nisy olana: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }

  const target = slotTarget(category, opts.fotoana);
  const L = getLang();
  const nbSel = props.filter((p) => p.selected).length;

  return html`<div class="page">
    <h1>${tr('Ajouter des plats avec l\'IA', 'Add dishes with AI', 'Hampiditra sakafo amin\'ny IA')}</h1>
    <p class="muted">${tr('Gratuit : vous copiez le prompt et l\'Excel dans ChatGPT ou Claude.ai, l\'IA remplit tout (ingrédients, quantités, valeurs, textes FR/EN/MG, allergènes), puis vous importez l\'Excel rempli et choisissez les plats à garder.', 'Free: copy the prompt and the Excel into ChatGPT or Claude.ai, the AI fills everything (ingredients, quantities, values, FR/EN/MG texts, allergens), then import the filled Excel and choose the dishes to keep.', 'Maimaim-poana: adikao ao amin\'ny ChatGPT na Claude.ai ny prompt sy ny Excel, fenoin\'ny IA daholo (ingrédients, habetsahana, valeur, texte FR/EN/MG, allergènes), dia ampidiro ny Excel feno ary safidio izay tehirizina.')}</p>

    <${Card} title=${'1. ' + tr('Que voulez-vous ajouter ?', 'What do you want to add?', 'Inona no hampidirina?')}>
      <div class="tabs">
        <button class=${'tab' + (opts.mode === 'noms' ? ' on' : '')} onClick=${() => set('mode', 'noms')}>${tr('J\'ai les noms des plats', 'I have the dish names', 'Manana ny anaran\'ny sakafo aho')}</button>
        <button class=${'tab' + (opts.mode === 'idees' ? ' on' : '')} onClick=${() => set('mode', 'idees')}>${tr('Je veux des idées', 'I want ideas', 'Mila hevitra aho')}</button>
      </div>
      <div class="form-grid">
        ${opts.mode === 'noms' && html`<${Field} label=${tr('Noms des plats (un par ligne)', 'Dish names (one per line)', 'Anaran\'ny sakafo (iray isaky ny andalana)')} wide hint=${names.length ? names.length + ' ' + tr('plat(s)', 'dish(es)', 'sakafo') : ''}>
          <textarea rows="5" value=${opts.noms} placeholder=${tr('Romazava au bœuf\nSalade de lentilles\nPorridge avoine banane', 'Beef romazava\nLentil salad\nOat banana porridge', 'Romazava hena omby\nSalady lentilles\nPorridge avoine akondro')} onInput=${(e) => set('noms', e.target.value)}></textarea><//>`}
        <${Field} label=${tr('Objectif', 'Goal', 'Tanjona')}><select value=${opts.categorie} onChange=${(e) => set('categorie', e.target.value)}>${cats.map((c) => html`<option value=${c.id}>${catName(c)}</option>`)}</select><//>
        <${Field} label=${tr('Moment', 'Meal time', 'Fotoana')}><${SelectOrAdd} type="fotoana" value=${opts.fotoana} defaults=${FOTOANA} labelFn=${fotLabel} onChange=${(v) => set('fotoana', v)} /><//>
        ${opts.mode === 'idees' && html`
          <${Field} label=${tr('Nombre de plats', 'Number of dishes', 'Isan\'ny sakafo')}><input type="number" min="1" max="20" value=${opts.isa} onInput=${(e) => set('isa', e.target.value)} /><//>
          <${Field} label=${tr('Kcal par plat', 'Kcal per dish', 'Kcal isaky ny sakafo')}><input type="number" value=${opts.kcal} onInput=${(e) => set('kcal', e.target.value)} /><//>
          <${Field} label=${tr('Protéines minimum (g)', 'Minimum protein (g)', 'Protéines farafahakeliny (g)')}><input type="number" value=${opts.prot} onInput=${(e) => set('prot', e.target.value)} /><//>
          <${Field} label=${tr('Budget par plat (Ar)', 'Budget per dish (Ar)', 'Budget isaky ny sakafo (Ar)')}><input type="number" value=${opts.budget} onInput=${(e) => set('budget', e.target.value)} /><//>
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

    ${props.length > 0 && html`<${Card} title=${'4. ' + tr('Choisissez les plats à ajouter', 'Choose the dishes to add', 'Safidio ny sakafo ampidirina') + ' (' + nbSel + '/' + props.length + ')'}
      actions=${html`<button class="btn small ghost" onClick=${() => setProps((ps) => ps.map((p) => ({ ...p, selected: nbSel < ps.length })))}>${nbSel < props.length ? tr('Tout cocher', 'Select all', 'Safidio daholo') : tr('Tout décocher', 'Unselect all', 'Esory daholo')}</button>`}>
      <div class="prop-grid">${props.map((p, idx) => {
        const fit = fitStatus(p.totals.kcal, slotTarget(category, p.fotoana) || target, category?.tolerance);
        const tx = p.texts.texts[L] && Object.keys(p.texts.texts[L]).length ? p.texts.texts[L] : p.texts.texts.fr;
        return html`<article class=${'prop' + (p.selected ? ' on' : '')} onClick=${() => setProps((ps) => ps.map((x, j) => (j === idx ? { ...x, selected: !x.selected } : x)))}>
          <header><input type="checkbox" checked=${p.selected} /><div><h3>${tx.nom_commercial || p.nom}</h3><small class="muted">${p.nom} · ${fotLabel(p.fotoana)}</small></div></header>
          ${tx.marketing && html`<p class="small">${tx.marketing}</p>`}
          <div class="row gap wrap"><b>${fmt(p.totals.kcal)} kcal</b><span>P ${fmt(p.totals.proteines)} g</span><span>G ${fmt(p.totals.glucides)} g</span><span>L ${fmt(p.totals.lipides)} g</span>${fit.label !== '—' && html`<${Badge} tone=${fit.tone}>${fitLabel(fit)}<//>`}</div>
          <ul class="small ing-list">${p.lines.map((l) => html`<li>${l.nouvel ? html`<${Badge} tone="warn">${tr('nouveau', 'new', 'vaovao')}<//> ${ingName(l.nouvel)}` : ingName(ingMap.get(l.ingredient_id))} — ${fmt(l.quantite, l.quantite % 1 ? 1 : 0)} ${l.unite}${l.note ? ' (' + l.note + ')' : ''}</li>`)}</ul>
          ${p.lines.length === 0 && html`<p class="small warn-text">${tr('Pas de composition dans la réponse.', 'No composition in the answer.', 'Tsy misy composition ao amin\'ny valiny.')}</p>`}
          ${p.totals.missing > 0 && html`<p class="small warn-text">${tr('Un ingrédient n\'a pas de valeurs ou de poids : calcul incomplet (à compléter ensuite).', 'An ingredient has no values or weight: incomplete (complete later).', 'Misy ingrédient tsy misy valeur na lanja: tsy feno (fenoina aorian\'izay).')}</p>`}
          ${tx.avantages && html`<p class="small muted pre">${tx.avantages}</p>`}
        </article>`;
      })}</div>
      <div class="row gap wrap" style="margin-top:12px">
        <button class="btn primary" disabled=${busy || !nbSel} onClick=${importSelected}>${busy ? tr('Ajout…', 'Adding…', 'Mampiditra…') : tr(`Ajouter ${nbSel} plat(s) à « Plats »`, `Add ${nbSel} dish(es) to "Dishes"`, `Ampidiro ao amin'ny "Sakafo" ireo ${nbSel}`)}</button>
        <span class="muted small">${tr('Vous pourrez ensuite ajuster chaque plat, ajouter le prix et la photo.', 'You can then adjust each dish, add the price and the photo.', 'Azonao amboarina avy eo ny sakafo tsirairay, ampiana vidiny sy sary.')}</span>
      </div>
    <//>`}
  </div>`;
}
