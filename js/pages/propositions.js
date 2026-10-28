import { html, useState } from '../lib.js';
import { useApp, Card, Badge, Field, CopyBox } from '../ui.js';
import { FOTOANA, SLOT_SHARE, sumLines, slotTarget, fitStatus, nextId, uid, fmt, toNum, NUTR } from '../calc.js';
import { promptPropositions, extractJson, normalizePlatTexts, applyPlatTexts } from '../prompts.js';
import { tr, fotLabel, catName, ingName, getLang } from '../i18n.js';
import { callAI } from '../db.js';
import { fitLabel } from './plats.js';

const EMPTY_ING = { nom_fr: null, nom_en: null, categorie: null, etat: null, kcal: null, proteines: null, glucides: null, lipides: null, fibres: null, sucres: null, sodium: null, ig: null, poids_piece: null, densite: null, prix_kg: null, source: null, a_verifier: true };

export function Propositions() {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const cats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const [opts, setOpts] = useState(() => {
    const c = cats[0];
    return { categorie: c?.id || '', fotoana: 'Atoandro', kcal: c?.kcal_cible ? Math.round(c.kcal_cible * SLOT_SHARE.Atoandro) : 500, isa: 8, prot: '', budget: '', style: '', fanamarihana: '' };
  });
  const [text, setText] = useState('');
  const [props, setProps] = useState([]);
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

  const prompt = promptPropositions(opts, data.plats, data.ingredients, category);

  async function askAI() {
    setBusy(true);
    try { const t = await callAI(prompt); setText(t); parse(t); } catch (e) {
      toast(e.code === 'no_key' ? tr('IA intégrée non activée (clé ANTHROPIC_API_KEY dans Supabase). Utilisez le copier-coller.', 'Built-in AI not enabled (ANTHROPIC_API_KEY in Supabase). Use copy-paste.', 'Tsy mbola mandeha ny IA ao anatiny (ANTHROPIC_API_KEY ao amin\'ny Supabase). Ampiasao ny adika sy apetaka.') : e.message, 'bad');
    } finally { setBusy(false); }
  }

  function parse(src = text) {
    try {
      const j = extractJson(src);
      const list = (j.propositions || j.plats || []).map((p) => {
        const temp = new Map(ingMap);
        const lines = (p.composition || []).map((c, i) => {
          let id = c.ingredient_id && ingMap.has(c.ingredient_id) ? c.ingredient_id : null;
          let nouvel = null;
          if (!id) {
            const n = c.nouvel_ingredient || {};
            nouvel = { ...EMPTY_ING, ...n, nom_mg: n.nom_mg || n.nom_fr || c.ingredient_id || '?' };
            for (const k of [...NUTR, 'ig', 'poids_piece', 'densite']) nouvel[k] = toNum(nouvel[k]);
            id = 'NEW-' + i;
            temp.set(id, nouvel);
          }
          const g = toNum(c.grammes) || 0;
          return { id: uid(), ingredient_id: id, grammes: g, quantite: g, unite: 'g', note: c.note || '', nouvel };
        });
        const texts = normalizePlatTexts(p);
        return { ...p, texts, fotoana: FOTOANA.includes(p.fotoana) ? p.fotoana : opts.fotoana, lines, totals: sumLines(lines, temp), selected: false };
      });
      if (!list.length) throw new Error('"propositions" ?');
      setProps(list);
    } catch (e) { toast(tr('Illisible : ', 'Unreadable: ', 'Tsy voavaky: ') + e.message, 'bad'); }
  }

  async function importSelected() {
    const chosen = props.filter((p) => p.selected);
    if (!chosen.length) { toast(tr('Sélectionnez d\'abord les plats à ajouter', 'Select the dishes to add first', 'Safidio aloha izay ampidirina'), 'bad'); return; }
    setBusy(true);
    try {
      const ingPool = [...data.ingredients];
      const platPool = [...data.plats];
      const newIngs = [];
      const newPlats = [];
      const newLines = [];
      for (const p of chosen) {
        const platId = nextId('SK', platPool);
        const base = {
          id: platId, nom: p.nom || p.texts.texts.fr.nom_commercial || 'Plat', nom_commercial: '', marketing: '', nom_en: '', fotoana: p.fotoana, categories: [opts.categorie],
          description: '', avantages: '', effets: '', nb: p.nb || '', traductions: {}, image_url: '', prix_vente: null, statut: 'Draft', notes: tr('Suggestion IA', 'AI suggestion', 'Soso-kevitra IA'),
        };
        const plat = applyPlatTexts(base, p.texts);
        platPool.push(plat); newPlats.push(plat);
        p.lines.forEach((l, i) => {
          let ingId = l.ingredient_id;
          if (l.nouvel) {
            const nm = (l.nouvel.nom_fr || l.nouvel.nom_mg || '').toLowerCase();
            const same = ingPool.find((x) => [x.nom_fr, x.nom_mg].some((v) => (v || '').toLowerCase() === nm));
            if (same) ingId = same.id;
            else {
              const ing = { ...l.nouvel, id: nextId('I', ingPool, 3), a_verifier: true };
              ingPool.push(ing); newIngs.push(ing); ingId = ing.id;
            }
          }
          newLines.push({ id: uid(), plat_id: platId, ingredient_id: ingId, quantite: l.grammes, unite: 'g', grammes: l.grammes, note: l.note || null, ordre: i });
        });
      }
      if (newIngs.length) await app.save('ingredients', newIngs);
      await app.save('plats', newPlats);
      await app.save('composition', newLines);
      toast(tr(`${newPlats.length} plat(s) ajouté(s)`, `${newPlats.length} dish(es) added`, `Sakafo ${newPlats.length} nampidirina`) + (newIngs.length ? ' + ' + newIngs.length + ' ' + tr('ingrédient(s)', 'ingredient(s)', 'ingrédient') : ''));
      setProps((ps) => ps.filter((p) => !p.selected));
    } catch (e) { toast(tr('Erreur : ', 'Error: ', 'Nisy olana: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }

  const target = slotTarget(category, opts.fotoana);
  const L = getLang();

  return html`<div class="page">
    <h1>${tr('Suggestions IA', 'AI suggestions', 'Soso-kevitra IA')}</h1>
    <p class="muted">${tr('À court d\'idées : demandez de nouveaux plats à l\'IA, puis gardez seulement ceux qui vous plaisent.', 'Out of ideas: ask the AI for new dishes, then keep only the ones you like.', 'Rehefa lany hevitra: mangataha sakafo vaovao amin\'ny IA, dia izay tianao ihany no ampidirina.')}</p>
    <${Card} title=${'1. ' + tr('Que cherchez-vous ?', 'What are you looking for?', 'Inona no tadiavina?')}>
      <div class="form-grid">
        <${Field} label=${tr('Catégorie', 'Category', 'Sokajy')}><select value=${opts.categorie} onChange=${(e) => set('categorie', e.target.value)}>${cats.map((c) => html`<option value=${c.id}>${catName(c)}</option>`)}</select><//>
        <${Field} label=${tr('Moment', 'Meal time', 'Fotoana')}><select value=${opts.fotoana} onChange=${(e) => set('fotoana', e.target.value)}>${FOTOANA.map((f) => html`<option value=${f}>${fotLabel(f)}</option>`)}</select><//>
        <${Field} label=${tr('Kcal par plat', 'Kcal per dish', 'Kcal isaky ny sakafo')}><input type="number" value=${opts.kcal} onInput=${(e) => set('kcal', e.target.value)} /><//>
        <${Field} label=${tr('Nombre', 'Number', 'Isa')}><input type="number" min="1" max="20" value=${opts.isa} onInput=${(e) => set('isa', e.target.value)} /><//>
        <${Field} label=${tr('Protéines minimum (g)', 'Minimum protein (g)', 'Protéines farafahakeliny (g)')}><input type="number" value=${opts.prot} onInput=${(e) => set('prot', e.target.value)} /><//>
        <${Field} label=${tr('Budget par plat (Ar)', 'Budget per dish (Ar)', 'Budget isaky ny sakafo (Ar)')}><input type="number" value=${opts.budget} onInput=${(e) => set('budget', e.target.value)} /><//>
        <${Field} label=${tr('Style', 'Style', 'Endrika')} wide><input value=${opts.style} onInput=${(e) => set('style', e.target.value)} placeholder=${tr('ex. uniquement malgache, ou asiatique, sans porc…', 'e.g. Malagasy only, or Asian, no pork…', 'ohatra: malagasy fotsiny, na asiatique, tsy misy henakisoa…')} /><//>
        <${Field} label=${tr('Autres remarques', 'Other remarks', 'Fanamarihana hafa')} wide><input value=${opts.fanamarihana} onInput=${(e) => set('fanamarihana', e.target.value)} /><//>
      </div>
      <div class="row gap wrap">
        <button class="btn primary big" disabled=${busy} onClick=${askAI}>${busy ? tr('L\'IA réfléchit… (30–60 s)', 'AI is thinking… (30–60 s)', 'Mieritreritra ny IA… (30–60 s)') : tr('Demander à l\'IA maintenant', 'Ask the AI now', 'Anontanio ny IA izao')}</button>
        <span class="muted small">${tr('ou copiez le prompt dans ChatGPT / Claude :', 'or copy the prompt into ChatGPT / Claude:', 'na adikao ao amin\'ny ChatGPT / Claude ny prompt:')}</span>
      </div>
      <${CopyBox} text=${prompt} rows="14" />
    <//>
    <${Card} title=${'2. ' + tr('Collez la réponse de l\'IA', 'Paste the AI answer', 'Apetaho ny valin\'ny IA')}>
      <textarea rows="6" class="mono" placeholder=${tr('Collez ici le JSON donné par l\'IA…', 'Paste the JSON from the AI here…', 'Apetaho eto ny JSON nomen\'ny IA…')} value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
      <button class="btn primary" disabled=${!text.trim()} onClick=${() => parse()}>${tr('Afficher les suggestions', 'Show the suggestions', 'Asehoy ny soso-kevitra')}</button>
    <//>
    ${props.length > 0 && html`<${Card} title=${'3. ' + tr('Choisissez', 'Choose', 'Safidio') + ' (' + props.filter((p) => p.selected).length + '/' + props.length + ')'} actions=${html`<button class="btn primary" disabled=${busy} onClick=${importSelected}>${busy ? tr('Ajout…', 'Adding…', 'Mampiditra…') : tr('Ajouter la sélection', 'Add selected', 'Ampidiro ireo voafidy')}</button>`}>
      <div class="prop-grid">${props.map((p, idx) => {
        const fit = fitStatus(p.totals.kcal, target, category?.tolerance);
        const tx = p.texts.texts[L] && Object.keys(p.texts.texts[L]).length ? p.texts.texts[L] : p.texts.texts.fr;
        return html`<article class=${'prop' + (p.selected ? ' on' : '')} onClick=${() => setProps((ps) => ps.map((x, j) => (j === idx ? { ...x, selected: !x.selected } : x)))}>
          <header><input type="checkbox" checked=${p.selected} /><h3>${tx.nom_commercial || p.nom}</h3></header>
          <p class="small">${tx.marketing || tx.description || ''}</p>
          <div class="row gap wrap"><b>${fmt(p.totals.kcal)} kcal</b><span>P ${fmt(p.totals.proteines)} g</span><span>G ${fmt(p.totals.glucides)} g</span><span>L ${fmt(p.totals.lipides)} g</span><${Badge} tone=${fit.tone}>${fitLabel(fit)}<//></div>
          <ul class="small ing-list">${p.lines.map((l) => html`<li>${l.nouvel ? html`<${Badge} tone="warn">${tr('nouveau', 'new', 'vaovao')}<//> ${ingName(l.nouvel)}` : ingName(ingMap.get(l.ingredient_id))} — ${fmt(l.grammes)} g${l.note ? ' (' + l.note + ')' : ''}</li>`)}</ul>
          ${p.totals.missing > 0 && html`<p class="small warn-text">${tr('Un ingrédient n\'a pas de valeurs : calcul incomplet.', 'An ingredient has no values: incomplete.', 'Misy ingrédient tsy misy valeur: tsy feno ny kajy.')}</p>`}
          <p class="small muted">${tx.avantages || ''}</p>
        </article>`;
      })}</div>
    <//>`}
    <p class="muted small">${tr(html`Les plats ajoutés sont en « Brouillon » dans <a href="#/plats">Plats</a>, où vous pouvez les modifier et les valider.`, html`Added dishes are "Draft" in <a href="#/plats">Dishes</a>, where you can edit and validate them.`, html`Ny sakafo nampidirina dia "Draft" ao amin'ny <a href="#/plats">Sakafo</a>, azonao ovaina sy hamarinina.`)}</p>
  </div>`;
}
