import { html, useState, useMemo } from '../lib.js';
import { useApp, Card, Badge, Field, CopyBox, navigate, pctBadge, SelectOrAdd } from '../ui.js';
import {
  FOTOANA, UNITES, lineValues, lineGrams, sumLines, slotTarget, fitStatus, nextId, uid, fmt, pct, toNum, kcalCheck, NUTR,
} from '../calc.js';
import { promptHameno, promptSary, extractJson, ingredientsToFill, normalizePlatTexts, applyPlatTexts, TEXT_LANGS } from '../prompts.js';
import { exportHameno, importHameno } from '../excel.js';
import { uploadPlatImage, removePlatImage, MODE, callAI } from '../db.js';
import { tr, fotLabel, unitLabel, ingName, catName, PLAT_TEXT_FIELDS, LANG_SHORT, getLang } from '../i18n.js';
import { fitLabel } from './plats.js';

const NEW_ING = { nom_fr: null, nom_en: null, categorie: null, etat: null, kcal: null, proteines: null, glucides: null, lipides: null, fibres: null, sucres: null, sodium: null, ig: null, poids_piece: null, densite: null, prix_kg: null, source: null, a_verifier: true };

const EMPTY_PLAT = {
  nom: '', nom_commercial: '', marketing: '', nom_en: '', fotoana: 'Maraina', categories: [], description: '', avantages: '', effets: '',
  nb: '', traductions: {}, details: {}, conseil: '', conservation: '', post_reseaux: '', image_url: '', prix_vente: null, statut: 'Draft', notes: '',
};

const textLabel = (f) => ({
  nom_commercial: tr('Nom commercial', 'Commercial name', 'Anarana commercial'),
  marketing: tr('Résumé marketing', 'Marketing summary', 'Résumé marketing'),
  avantages: tr('Pourquoi ce menu ? (3 points)', 'Why this menu? (3 points)', 'Nahoana ity menu ity? (teboka 3)'),
  description: tr('Description', 'Description', 'Famaritana'),
  effets: tr('Effets attendus', 'Expected effects', 'Vokatra'),
}[f]);

const splitList = (v) => String(v || '').split(/[;\n]/).map((x) => x.trim()).filter(Boolean);

export function ingLabel(i) { return `${ingName(i)} (${i.id})`; }
export function findIngredient(text, ingredients) {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/\(([^()]+)\)\s*$/);
  if (m) { const byId = ingredients.find((i) => i.id === m[1].trim()); if (byId) return byId; }
  const low = t.toLowerCase();
  return ingredients.find((i) => i.id.toLowerCase() === low || ['nom_mg', 'nom_fr', 'nom_en'].some((k) => (i[k] || '').toLowerCase() === low)) || null;
}

export function PlatEdit({ id }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const isNew = id === 'vaovao';
  const existing = data.plats.find((p) => p.id === id);
  const [form, setForm] = useState(() => (existing ? { ...EMPTY_PLAT, ...existing, traductions: existing.traductions || {} } : { ...EMPTY_PLAT, id: nextId('SK', data.plats) }));
  const [lines, setLines] = useState(() => data.composition.filter((c) => c.plat_id === id).sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map((c) => ({ ...c, quantite: c.quantite ?? c.grammes, unite: c.unite || 'g', note: c.note || '' })));
  const [dirty, setDirty] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [newIng, setNewIng] = useState('');
  const [newG, setNewG] = useState('');
  const [newU, setNewU] = useState('g');
  const [newNote, setNewNote] = useState('');
  const [txtLang, setTxtLang] = useState(getLang());

  const totals = useMemo(() => sumLines(lines, ingMap), [lines, ingMap]);
  if (!isNew && !existing) return html`<div class="page"><p>${tr('Plat introuvable', 'Dish not found', 'Tsy hita ny sakafo')} ${id}.</p><a href="#/plats">← ${tr('Retour', 'Back', 'Hiverina')}</a></div>`;

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };
  const setText = (l, f, v) => {
    setForm((p) => (l === 'fr' ? { ...p, [f]: v } : { ...p, traductions: { ...p.traductions, [l]: { ...(p.traductions?.[l] || {}), [f]: v } } }));
    setDirty(true);
  };
  const setDetail = (k, v) => { setForm((p) => ({ ...p, details: { ...(p.details || {}), [k]: v } })); setDirty(true); };
  const getText = (l, f) => (l === 'fr' ? form[f] || '' : form.traductions?.[l]?.[f] || '');
  const setLine = (i, patch) => { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l))); setDirty(true); };
  const sortedCats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const compRows = (ls, map) => ls.map((l, i) => ({ id: l.id, plat_id: form.id, ingredient_id: l.ingredient_id, quantite: toNum(l.quantite) || 0, unite: l.unite || 'g', note: (l.note || '').trim() || null, grammes: Math.round((lineGrams(l, map.get(l.ingredient_id)) || 0) * 10) / 10, ordre: i }));

  // Mitady ingrédient amin'ny anarany; raha tsy misy dia mamorona vaovao (rehefa ekena)
  async function resolveIngredient(txt) {
    txt = txt.trim();
    if (!txt) return null;
    const found = findIngredient(txt, data.ingredients);
    if (found) return found;
    if (!confirm(tr(`« ${txt} » n'existe pas encore. L'ajouter comme nouvel ingrédient (valeurs à compléter par l'IA) ?`, `"${txt}" does not exist yet. Add it as a new ingredient (values to be filled by AI)?`, `"${txt}" mbola tsy ao. Hampidirina ho ingrédient vaovao (fenoin'ny IA ny valeur)?`))) return null;
    const field = getLang() === 'en' ? 'nom_en' : getLang() === 'mg' ? 'nom_mg' : 'nom_fr';
    const ing = { ...NEW_ING, id: nextId('I', data.ingredients, 3), nom_mg: txt, [field]: txt };
    try { await app.save('ingredients', ing); toast(`${tr('Nouvel ingrédient', 'New ingredient', 'Ingrédient vaovao')} : ${ing.id} ${txt}`); } catch (e) { toast(e.message, 'bad'); return null; }
    return ing;
  }

  async function addLine() {
    const ing = await resolveIngredient(newIng);
    if (!ing) return;
    setLines((ls) => [...ls, { id: uid(), plat_id: form.id, ingredient_id: ing.id, quantite: toNum(newG) || 0, unite: newU, note: newNote.trim(), grammes: 0, ordre: ls.length }]);
    setNewIng(''); setNewG(''); setNewU('g'); setNewNote(''); setDirty(true);
  }

  async function changeLineIngredient(i, txt, input) {
    const cur = ingMap.get(lines[i].ingredient_id);
    if (cur && txt.trim() === ingLabel(cur)) return;
    const ing = await resolveIngredient(txt);
    if (ing) setLine(i, { ingredient_id: ing.id });
    else if (input) input.value = cur ? ingLabel(cur) : '';
  }
  function moveLine(i, d) {
    const j = i + d;
    if (j < 0 || j >= lines.length) return;
    setLines((ls) => { const n = [...ls]; [n[i], n[j]] = [n[j], n[i]]; return n; });
    setDirty(true);
  }
  function removeLine(i) {
    setLines((ls) => ls.filter((_, j) => j !== i));
    setDirty(true);
  }
  function clearLines() {
    if (!lines.length) return;
    if (!confirm(tr('Supprimer toute la composition ?', 'Delete the whole composition?', 'Hofafana daholo ve ny composition?'))) return;
    setLines([]); setDirty(true);
  }

  // Mitahiry ny sakafo + composition (ampiasain'ny "Enregistrer" sy ny IA)
  async function persist(formArg = form, mapArg = ingMap) {
    if (!(formArg.nom || '').trim()) { toast(tr('Indiquez le nom du plat', 'Enter the dish name', 'Soraty ny anaran\'ny sakafo'), 'bad'); return false; }
    const row = { ...EMPTY_PLAT, ...formArg, nom: formArg.nom.trim(), prix_vente: toNum(formArg.prix_vente) };
    delete row.created_at;
    if (existing?.created_at) row.created_at = existing.created_at;
    await app.save('plats', row);
    await app.setComposition(row.id, compRows(lines, mapArg));
    setForm(row);
    setDirty(false);
    return row;
  }

  async function save() {
    setBusy(true);
    try {
      const row = await persist();
      if (!row) return false;
      toast(tr('Enregistré', 'Saved', 'Voatahiry'));
      if (isNew) navigate('/plats/' + row.id);
      return true;
    } catch (e) { toast(tr('Non enregistré : ', 'Not saved: ', 'Tsy voatahiry: ') + (e.message || e), 'bad'); return false; } finally { setBusy(false); }
  }

  async function del() {
    if (!confirm(tr(`Supprimer définitivement « ${form.nom} » ?`, `Permanently delete "${form.nom}"?`, `Hofafana tanteraka ve ny "${form.nom}"?`))) return;
    try { await app.del('plats', form.id); toast(tr('Supprimé', 'Deleted', 'Voafafa')); navigate('/plats'); } catch (e) { toast(e.message, 'bad'); }
  }

  const units = UNITES.map((u) => html`<option value=${u}>${unitLabel(u)}</option>`);

  return html`<div class="page">
    <div class="page-head">
      <div><a href="#/plats" class="muted">← ${tr('Plats', 'Dishes', 'Sakafo')}</a><h1>${isNew ? tr('Nouveau plat', 'New dish', 'Sakafo vaovao') : (getText(getLang(), 'nom_commercial') || form.nom)}<span class="muted mono small"> ${form.id}</span></h1></div>
      <div class="row gap">
        ${!isNew && html`<button class="btn danger ghost" onClick=${del}>${tr('Supprimer', 'Delete', 'Fafao')}</button>`}
        <button class="btn primary" disabled=${busy || !dirty} onClick=${save}>${busy ? tr('Enregistrement…', 'Saving…', 'Mitahiry…') : dirty ? tr('Enregistrer', 'Save', 'Tehirizo') : tr('Enregistré ✓', 'Saved ✓', 'Voatahiry ✓')}</button>
      </div>
    </div>

    <div class="edit-grid">
      <div class="col">
        <${Card} title=${tr('Le plat', 'The dish', 'Momba ny sakafo')}>
          <div class="form-grid">
            <${Field} label=${tr('Nom / code interne', 'Name / internal code', 'Anarana / code anatiny')} wide hint=${tr('Pour vous uniquement (ex. M1 – Petit-déjeuner 1)', 'For you only (e.g. M1 – Breakfast 1)', 'Ho anao ihany (ohatra: M1 – Maraina 1)')}><input value=${form.nom} onInput=${(e) => set('nom', e.target.value)} placeholder="M1" /><//>
            <${Field} label=${tr('Moment', 'Meal time', 'Fotoana')}>
              <${SelectOrAdd} type="fotoana" value=${form.fotoana} defaults=${FOTOANA} labelFn=${fotLabel} onChange=${(v) => set('fotoana', v)} />
            <//>
            <${Field} label=${tr('Statut', 'Status', 'Sata')}>
              <select value=${form.statut} onChange=${(e) => set('statut', e.target.value)}><option value="Draft">${tr('Brouillon', 'Draft', 'Draft')}</option><option value="Voamarina">${tr('Validé', 'Validated', 'Voamarina')}</option></select>
            <//>
            <${Field} label=${tr('Catégories (objectifs)', 'Categories (goals)', 'Sokajy (tanjona)')} wide>
              <div class="chips">${sortedCats.map((c) => {
                const on = (form.categories || []).includes(c.id);
                return html`<button type="button" class=${'chip' + (on ? ' on' : '')} onClick=${() => set('categories', on ? form.categories.filter((x) => x !== c.id) : [...(form.categories || []), c.id])}>${catName(c)}</button>`;
              })}</div>
            <//>
            <${Field} label=${tr('NB / points forts du plat', 'NB / highlights of the dish', 'NB / tombony manokana')} wide hint=${tr('Utilisé par l\'IA pour le texte marketing (ex. sans gluten, fait maison, livré chaud)', 'Used by the AI for the marketing text (e.g. gluten-free, homemade, delivered hot)', 'Ampiasain\'ny IA amin\'ny texte marketing (ohatra: tsy misy gluten, vita an-trano)')}><input value=${form.nb || ''} onInput=${(e) => set('nb', e.target.value)} /><//>
            <${Field} label=${tr('Prix de vente (Ar)', 'Selling price (Ar)', 'Vidiny amidy (Ar)')}><input type="number" min="0" value=${form.prix_vente ?? ''} onInput=${(e) => set('prix_vente', e.target.value)} /><//>
            <${Field} label=${tr('Note interne', 'Internal note', 'Fanamarihana anatiny')}><input value=${form.notes || ''} onInput=${(e) => set('notes', e.target.value)} /><//>
          </div>
        <//>

        <${Card} title=${tr('Composition', 'Composition', 'Composition')} actions=${lines.length ? html`<button class="btn ghost small danger" onClick=${clearLines}>${tr('Tout supprimer', 'Delete all', 'Fafao daholo')}</button>` : null}>
          <div class="table-wrap"><table class="table compact">
            <thead><tr><th>${tr('Ingrédient', 'Ingredient', 'Ingrédient')}</th><th>${tr('Quantité', 'Quantity', 'Habetsahana')}</th><th>NB</th><th class="num">≈ g</th><th class="num">Kcal</th><th class="num">Prot.</th><th class="num">${tr('Gluc.', 'Carbs', 'Gluc.')}</th><th class="num">${tr('Lip.', 'Fat', 'Lip.')}</th><th></th></tr></thead>
            <tbody>
              ${lines.map((l, i) => {
                const ing = ingMap.get(l.ingredient_id);
                const v = lineValues(l, ing);
                return html`<tr>
                  <td><input class="ing-input" list="ing-list" key=${l.id + ':' + l.ingredient_id} defaultValue=${ing ? ingLabel(ing) : l.ingredient_id} title=${tr('Changer l\'ingrédient', 'Change ingredient', 'Ovay ny ingrédient')}
                      onChange=${(e) => changeLineIngredient(i, e.target.value, e.target)} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); }} />${v.grammesInconnus ? html` <${Badge} tone="warn">${tr('poids inconnu', 'unknown weight', 'lanjany tsy fantatra')}<//>` : v.missing && html` <${Badge} tone="warn">${tr('sans valeurs', 'no values', 'tsy misy valeur')}<//>`}</td>
                  <td><div class="qty"><input class="num-input" type="number" min="0" step="any" value=${l.quantite} onInput=${(e) => setLine(i, { quantite: e.target.value })} /><${SelectOrAdd} type="unite" unit cls="unit" value=${l.unite || 'g'} defaults=${UNITES} labelFn=${unitLabel} onChange=${(v) => setLine(i, { unite: v })} /></div></td>
                  <td><input class="note-input" value=${l.note || ''} placeholder=${tr('ex. sans sel', 'e.g. no salt', 'ohatra: tsy misy sira')} onInput=${(e) => setLine(i, { note: e.target.value })} /></td>
                  <td class="num muted">${v.grammesInconnus ? '?' : fmt(v.grammes)}</td>
                  <td class="num">${v.missing ? '?' : fmt(v.kcal)}</td>
                  <td class="num">${v.missing ? '?' : fmt(v.proteines, 1)}</td>
                  <td class="num">${v.missing ? '?' : fmt(v.glucides, 1)}</td>
                  <td class="num">${v.missing ? '?' : fmt(v.lipides, 1)}</td>
                  <td class="line-actions">
                    <button class="btn ghost small" title=${tr('Monter', 'Move up', 'Akaro')} disabled=${i === 0} onClick=${() => moveLine(i, -1)}>↑</button>
                    <button class="btn ghost small" title=${tr('Descendre', 'Move down', 'Ampidino')} disabled=${i === lines.length - 1} onClick=${() => moveLine(i, 1)}>↓</button>
                    <button class="btn ghost small danger" title=${tr('Supprimer cette ligne', 'Delete this line', 'Fafao ity andalana ity')} onClick=${() => removeLine(i)}>✕</button>
                  </td>
                </tr>`;
              })}
              <tr class="total-row"><td>Total</td><td></td><td></td><td class="num">${fmt(totals.grammes)} g</td><td class="num">${fmt(totals.kcal)}</td><td class="num">${fmt(totals.proteines, 1)}</td><td class="num">${fmt(totals.glucides, 1)}</td><td class="num">${fmt(totals.lipides, 1)}</td><td></td></tr>
            </tbody>
          </table></div>
          <datalist id="ing-list">${data.ingredients.map((i) => html`<option value=${ingLabel(i)}></option>`)}</datalist>
          <div class="add-line">
            <input list="ing-list" class="grow" placeholder=${tr('Ingrédient (tapez le nom)…', 'Ingredient (type the name)…', 'Ingrédient (soraty ny anarany)…')} value=${newIng} onInput=${(e) => setNewIng(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') addLine(); }} />
            <input type="number" min="0" step="any" placeholder=${tr('qté', 'qty', 'isa')} class="num-input" value=${newG} onInput=${(e) => setNewG(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') addLine(); }} />
            <${SelectOrAdd} type="unite" unit cls="unit" value=${newU} defaults=${UNITES} labelFn=${unitLabel} onChange=${setNewU} />
            <input class="note-input" placeholder=${tr('NB (ex. sans sucre)', 'NB (e.g. no sugar)', 'NB (ohatra: tsy misy siramamy)')} value=${newNote} onInput=${(e) => setNewNote(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') addLine(); }} />
            <button class="btn" onClick=${addLine}>${tr('Ajouter', 'Add', 'Ampio')}</button>
          </div>
          <p class="hint">${tr(
            'Tout est modifiable : cliquez sur un ingrédient pour le remplacer, changez la quantité, l\'unité ou le NB, ✕ pour supprimer une ligne, puis « Enregistrer ». Quantités en g, ml ou pièces (ex. 2 œufs, café 150 ml). Le poids des pièces et les valeurs manquantes seront complétés par l\'IA. Le NB (sans sel, sans sucre…) sert à l\'IA pour le calcul et le texte marketing.',
            'Everything is editable: click an ingredient to replace it, change quantity, unit or NB, ✕ to delete a line, then "Save". Quantities in g, ml or pieces (e.g. 2 eggs, coffee 150 ml). Piece weights and missing values will be filled by the AI. The NB (no salt, no sugar…) helps the AI with values and marketing text.',
            'Azo ovaina daholo: tsindrio ny ingrédient raha hanolo azy, ovay ny habetsahana, unité na NB, ✕ hamafana andalana, dia "Tehirizo". Habetsahana amin\'ny g, ml na isa (ohatra: atody 2, café 150 ml). Fenoin\'ny IA ny lanjan\'ny isa sy ny valeur tsy misy. Ny NB (tsy misy sira, tsy misy siramamy…) dia ampiasain\'ny IA amin\'ny kajy sy ny texte marketing.')}</p>
        <//>

      </div>

      <div class="col side">
        <${Card} title=${tr('Valeurs nutritionnelles', 'Nutrition facts', 'Valeur nutritionnelle')} class="sticky">
          ${totals.missing > 0 && html`<p class="warn-box">${totals.missing} ${tr('ingrédient(s) sans valeurs ou sans poids : calcul incomplet. Utilisez « Compléter avec l\'IA » plus bas.', 'ingredient(s) without values or weight: incomplete. Use "Complete with AI" below.', 'ingrédient tsy misy valeur na lanja: tsy feno ny kajy. Ampiasao ny "Hameno amin\'ny IA" eo ambany.')}</p>`}
          <div class="big-kcal">${fmt(totals.kcal)}<span>kcal</span></div>
          <div class="macro-bar">
            <i style=${'flex:' + (totals.protPct || 0) + ';background:var(--prot)'}></i>
            <i style=${'flex:' + (totals.glucPct || 0) + ';background:var(--gluc)'}></i>
            <i style=${'flex:' + (totals.lipPct || 0) + ';background:var(--lip)'}></i>
          </div>
          <table class="kv">
            <tr><td><span class="dot" style="background:var(--prot)"></span>${tr('Protéines', 'Protein', 'Protéines')}</td><td>${fmt(totals.proteines, 1)} g</td><td class="muted">${pct(totals.protPct)}</td></tr>
            <tr><td><span class="dot" style="background:var(--gluc)"></span>${tr('Glucides', 'Carbohydrates', 'Glucides')}</td><td>${fmt(totals.glucides, 1)} g</td><td class="muted">${pct(totals.glucPct)}</td></tr>
            <tr><td><span class="dot" style="background:var(--lip)"></span>${tr('Lipides', 'Fat', 'Lipides')}</td><td>${fmt(totals.lipides, 1)} g</td><td class="muted">${pct(totals.lipPct)}</td></tr>
            <tr><td>${tr('Fibres', 'Fibre', 'Fibres')}</td><td>${fmt(totals.fibres, 1)} g</td><td></td></tr>
            <tr><td>${tr('Sucres', 'Sugars', 'Sucres')}</td><td>${fmt(totals.sucres, 1)} g</td><td></td></tr>
            <tr><td>Sodium</td><td>${fmt(totals.sodium)} mg</td><td></td></tr>
            <tr><td>${tr('Charge glycémique', 'Glycemic load', 'Charge glycémique')}</td><td>${fmt(totals.cg, 1)}</td><td></td></tr>
            <tr><td>${tr('Coût', 'Cost', 'Coût')}</td><td>${totals.prixManquant ? '?' : fmt(totals.cout) + ' Ar'}</td><td class="muted small">${totals.prixManquant ? totals.prixManquant + ' ' + tr('prix manquant(s)', 'missing price(s)', 'vidiny tsy fantatra') : ''}</td></tr>
            ${toNum(form.prix_vente) && !totals.prixManquant ? html`<tr><td>${tr('Marge', 'Margin', 'Tombony')}</td><td>${fmt(toNum(form.prix_vente) - totals.cout)} Ar</td><td></td></tr>` : null}
          </table>
          ${(form.categories || []).length > 0 && html`<h3>${tr('Adapté à l\'objectif ?', 'Fits the goal?', 'Mifanaraka amin\'ny tanjona?')}</h3>
            <ul class="list">${form.categories.map((cid) => {
              const c = data.categories.find((x) => x.id === cid);
              if (!c) return null;
              const target = slotTarget(c, form.fotoana);
              const f = fitStatus(totals.kcal, target, c.tolerance);
              return html`<li><b>${catName(c)}</b> · ${fotLabel(form.fotoana)} : ${tr('cible', 'target', 'tanjona')} ${fmt(target)} kcal <${Badge} tone=${f.tone}>${fitLabel(f)}${pctBadge(f.ecart)}<//></li>`;
            })}</ul>`}
        <//>
      </div>
    </div>

    <${AiPanel} form=${form} lines=${lines} isNew=${isNew} persist=${persist} />

        <${Card} title=${tr('Textes (vente et marketing)', 'Texts (sales and marketing)', 'Texte (fivarotana sy marketing)')} actions=${html`<div class="tabs mini">${TEXT_LANGS.map((l) => html`<button class=${'tab' + (l === txtLang ? ' on' : '')} onClick=${() => setTxtLang(l)}>${LANG_SHORT[l]}</button>`)}</div>`}>
      <p class="hint">${tr('Remplis par l\'IA en français, anglais et malgache. Vous pouvez les corriger.', 'Filled by the AI in French, English and Malagasy. You can edit them.', 'Fenoin\'ny IA amin\'ny frantsay, anglisy ary malagasy. Azonao ahitsy.')}</p>
      ${!form.marketing && !form.nom_commercial && html`<p class="ok-box row gap wrap between"><span>${tr('Encore vides : lancez l\'analyse IA de la composition pour tout remplir.', 'Still empty: run the AI analysis of the composition to fill everything.', 'Mbola foana: ampandehano ny famakafakana IA ny composition mba ho feno daholo.')}</span>
        <button class="btn small primary" onClick=${() => document.querySelector('.ai-auto')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>${tr('Aller à l\'analyse IA', 'Go to AI analysis', 'Mankany amin\'ny famakafakana IA')} ↓</button></p>`}
      <div class="form-grid">
        ${PLAT_TEXT_FIELDS.map((f) => html`<${Field} label=${textLabel(f) + ' (' + LANG_SHORT[txtLang] + ')'} wide>
          ${f === 'nom_commercial'
            ? html`<input value=${getText(txtLang, f)} placeholder=${tr('Rempli par l\'IA', 'Filled by AI', 'Fenoin\'ny IA')} onInput=${(e) => setText(txtLang, f, e.target.value)} />`
            : html`<textarea rows=${f === 'avantages' ? 3 : 2} value=${getText(txtLang, f)} placeholder=${tr('Rempli par l\'IA', 'Filled by AI', 'Fenoin\'ny IA')} onInput=${(e) => setText(txtLang, f, e.target.value)}></textarea>`}
        <//>`)}
      </div>
    <//>
    <${Card} title=${tr('Allergènes et étiquettes (remplis par l\'IA)', 'Allergens and labels (filled by AI)', 'Allergènes sy marika (fenoin\'ny IA)')}>
      <div class="form-grid">
        <${Field} label=${tr('Allergènes', 'Allergens', 'Allergènes')} hint=${tr('Séparés par ;', 'Separated by ;', 'Sarahana amin\'ny ;')}><input value=${(form.details?.allergenes || []).join('; ')} placeholder=${tr('Rempli par l\'IA', 'Filled by AI', 'Fenoin\'ny IA')} onChange=${(e) => setDetail('allergenes', splitList(e.target.value))} /><//>
        <${Field} label=${tr('Étiquettes (2 ou 3)', 'Labels (2 or 3)', 'Marika (2 na 3)')} hint=${tr('ex. riche en protéines; sans sucre ajouté', 'e.g. high protein; no added sugar', 'ohatra: riche en protéines; sans sucre ajouté')}><input value=${(form.details?.regimes || []).join('; ')} placeholder=${tr('Rempli par l\'IA', 'Filled by AI', 'Fenoin\'ny IA')} onChange=${(e) => setDetail('regimes', splitList(e.target.value))} /><//>
      </div>
    <//>

    <${PhotoCard} form=${form} setForm=${setForm} isNew=${isNew} lines=${lines} kcal=${totals.missing ? null : totals.kcal} />
  </div>`;
}

// ---------------------------------------------------------------
function AiPanel({ form, lines, isNew, persist }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const toFill = ingredientsToFill(lines, ingMap);
  const prompt = promptHameno(form, lines, ingMap, data.categories);
  const [auto, setAuto] = useState(false);
  const [aiErr, setAiErr] = useState(null);

  async function autoFill() {
    if (!lines.length) { toast(tr('Ajoutez d\'abord la composition.', 'Add the composition first.', 'Ampidiro aloha ny composition.'), 'bad'); return; }
    setAuto(true); setAiErr(null);
    try {
      const answer = await callAI(prompt);
      setText(answer);
      setResult(normalize(extractJson(answer)));
      toast(tr('Analyse terminée : vérifiez puis validez.', 'Analysis done: check, then accept.', 'Vita ny famakafakana: hamarino dia ekeo.'));
      setTimeout(() => document.querySelector('.preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) { setAiErr(e); } finally { setAuto(false); }
  }

  function parseText() {
    try { setResult(normalize(extractJson(text))); } catch (e) { toast(tr('JSON illisible : ', 'Unreadable JSON: ', 'Tsy voavaky ny JSON: ') + e.message, 'bad'); }
  }
  async function onFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    try { setResult(normalize(await importHameno(f))); } catch (x) { toast(tr('Excel illisible : ', 'Unreadable Excel: ', 'Tsy voavaky ny Excel: ') + x.message, 'bad'); }
    e.target.value = '';
  }
  function normalize(r) {
    const ings = (r.ingredients || []).filter((i) => i && (i.id || i.nom_mg || i.nom_fr)).map((i) => {
      const o = { ...i };
      for (const k of [...NUTR, 'ig', 'poids_piece', 'densite']) o[k] = toNum(o[k]);
      return o;
    });
    return { plat: normalizePlatTexts(r.plat || {}), ingredients: ings };
  }

  async function apply() {
    setBusy(true);
    try {
      const rows = [];
      const pool = [...data.ingredients];
      for (const r of result.ingredients) {
        const cur = r.id ? pool.find((x) => x.id === r.id) : null;
        const base = cur || { ...NEW_ING, id: nextId('I', pool, 3), nom_mg: r.nom_mg || r.nom_fr || '?' };
        const merged = { ...base };
        for (const k of ['nom_fr', 'nom_en', 'nom_mg', 'categorie', 'etat', 'source', ...NUTR, 'ig', 'poids_piece', 'densite']) {
          if (r[k] !== null && r[k] !== undefined && r[k] !== '') merged[k] = r[k];
        }
        if (merged.categorie && merged.categorie.includes('/')) merged.categorie = null;
        if (merged.etat && merged.etat.includes('|')) merged.etat = null;
        merged.a_verifier = true;
        rows.push(merged);
        if (!cur) pool.push(merged);
      }
      if (rows.length) await app.save('ingredients', rows);
      const next = applyPlatTexts(form, result.plat);
      const newMap = new Map(ingMap); rows.forEach((r) => newMap.set(r.id, r));
      const saved = await persist(next, newMap);
      if (!saved) return;
      toast(tr(`Enregistré : ${rows.length} ingrédient(s) et les textes du plat`, `Saved: ${rows.length} ingredient(s) and the dish texts`, `Voatahiry: ingrédient ${rows.length} sy ny texte`));
      setResult(null); setText('');
      if (isNew) navigate('/plats/' + saved.id);
    } catch (e) { toast(tr('Erreur : ', 'Error: ', 'Nisy olana: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }

  const textRows = result && (result.plat.texts) ? TEXT_LANGS.flatMap((l) => PLAT_TEXT_FIELDS.filter((f) => result.plat.texts[l][f]).map((f) => ({ l, f, v: result.plat.texts[l][f] }))) : [];

  return html`<${Card} title=${tr('Compléter avec l\'IA', 'Complete with AI', 'Hameno amin\'ny IA')}>
    ${!lines.length && html`<p class="warn-box">${tr('Ajoutez d\'abord la composition (ingrédients et quantités) : le prompt l\'utilise.', 'Add the composition first (ingredients and quantities): the prompt uses it.', 'Ampidiro aloha ny composition (ingrédients sy habetsahana): ampiasain\'ny prompt izany.')}</p>`}
    <p class="muted small">${tr('« Valider et enregistrer » enregistre aussi le plat et sa composition.', '"Accept and save" also saves the dish and its composition.', '"Ekena sy tehirizo" dia mitahiry koa ny sakafo sy ny composition.')}</p>
    <div class="ai-auto">
      <div>
        <h3>${tr('Analyse automatique', 'Automatic analysis', 'Famakafakana ho azy')}</h3>
        <p class="small muted">${tr('L\'IA analyse la composition et remplit tout : valeurs nutritionnelles et poids des pièces, puis ce qui convainc le client : nom commercial, résumé marketing, 3 avantages (FR / EN / MG), allergènes et étiquettes.', 'The AI analyses the composition and fills everything: nutrition values and piece weights, then what convinces the customer: commercial name, marketing summary, 3 benefits (FR / EN / MG), allergens and labels.', 'Famakafakan\'ny IA ny composition ary fenoiny daholo: valeur nutritionnelle sy lanjan\'ny isa, ary izay mandresy lahatra ny client: anarana commercial, résumé marketing, tombony 3 (FR / EN / MG), allergènes sy marika.')}</p>
      </div>
      <button class="btn primary big" disabled=${auto || !lines.length} onClick=${autoFill}>${auto ? tr('Analyse en cours… (30 s environ)', 'Analysing… (about 30 s)', 'Mamakafaka… (30 s eo ho eo)') : tr('Analyser et remplir avec l\'IA', 'Analyse and fill with AI', 'Famakafakao sy fenoy amin\'ny IA')}</button>
    </div>
    ${aiErr && (aiErr.code === 'no_key'
      ? html`<div class="warn-box">${tr(html`<b>L'IA intégrée n'est pas encore activée.</b> Il faut une clé API Anthropic (console.anthropic.com → API Keys), puis dans Supabase : <b>Edge Functions → Secrets → Add</b>, nom <code>ANTHROPIC_API_KEY</code>, valeur = votre clé. En attendant, utilisez la méthode manuelle ci-dessous (copier-coller dans ChatGPT ou Claude).`,
          html`<b>Built-in AI is not enabled yet.</b> You need an Anthropic API key (console.anthropic.com → API Keys), then in Supabase: <b>Edge Functions → Secrets → Add</b>, name <code>ANTHROPIC_API_KEY</code>, value = your key. Meanwhile, use the manual method below (copy-paste into ChatGPT or Claude).`,
          html`<b>Mbola tsy mandeha ny IA ao anatiny.</b> Mila clé API Anthropic (console.anthropic.com → API Keys), dia ao amin'ny Supabase: <b>Edge Functions → Secrets → Add</b>, anarana <code>ANTHROPIC_API_KEY</code>, sanda = ny clé-nao. Mandritra izany, ampiasao ny fomba tanana eto ambany (adika sy apetaka ao amin'ny ChatGPT na Claude).`)}</div>`
      : html`<p class="warn-box">${tr('Analyse impossible : ', 'Analysis failed: ', 'Tsy nety ny famakafakana: ')}${aiErr.message}</p>`)}
    <details class="manual" open=${MODE === 'demo'}>
      <summary>${tr('Méthode manuelle (copier-coller dans ChatGPT / Claude, ou Excel)', 'Manual method (copy-paste into ChatGPT / Claude, or Excel)', 'Fomba tanana (adika ao amin\'ny ChatGPT / Claude, na Excel)')}</summary>
    <div class="ai-steps">
      <div class="ai-step">
        <h3><span class="num-circle">1</span> ${tr('Copier le prompt', 'Copy the prompt', 'Adikao ny prompt')}</h3>
        <p class="muted small">${toFill.length} ${tr('ingrédient(s) à compléter', 'ingredient(s) to complete', 'ingrédient hofenoina')}${toFill.length ? ' : ' + toFill.map((x) => ingName(x.ing)).join(', ') : ''}. ${tr('L\'IA écrira aussi le nom commercial, le résumé marketing et 3 avantages en FR, EN et MG, plus allergènes et étiquettes.', 'The AI will also write the commercial name, marketing summary and 3 benefits in FR, EN and MG, plus allergens and labels.', 'Hosoratan\'ny IA koa ny anarana commercial, résumé marketing ary tombony 3 amin\'ny FR, EN ary MG, miampy allergènes sy marika.')}</p>
        <${CopyBox} text=${prompt} rows="14" />
      </div>
      <div class="ai-step">
        <h3><span class="num-circle">2</span> ${tr('Fichier Excel (facultatif)', 'Excel file (optional)', 'Fichier Excel (tsy voatery)')}</h3>
        <p class="muted small">${tr('À joindre au prompt si vous voulez que l\'IA remplisse un Excel.', 'Attach it to the prompt if you want the AI to fill an Excel file.', 'Ampiarahina amin\'ny prompt raha tianao hameno Excel ny IA.')}</p>
        <button class="btn" onClick=${() => exportHameno(form, lines, ingMap).catch((e) => toast(e.message, 'bad'))}>${tr('Télécharger', 'Download', 'Alaivo')} hameno_${form.id}.xlsx</button>
      </div>
      <div class="ai-step">
        <h3><span class="num-circle">3</span> ${tr('Coller la réponse de l\'IA', 'Paste the AI answer', 'Avereno ny valin\'ny IA')}</h3>
        <textarea rows="5" class="mono" placeholder=${tr('Collez ici la réponse (avec le bloc JSON)…', 'Paste the answer here (with the JSON block)…', 'Apetaho eto ny valiny (misy ny bloc JSON)…')} value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
        <div class="row gap wrap">
          <button class="btn primary" disabled=${!text.trim()} onClick=${parseText}>${tr('Lire le JSON', 'Read the JSON', 'Vakio ny JSON')}</button>
          <label class="btn">${tr('Importer l\'Excel rempli', 'Import the filled Excel', 'Ampidiro Excel voafeno')}<input type="file" accept=".xlsx,.xls,.csv" hidden onChange=${onFile} /></label>
        </div>
      </div>
    </div>
    </details>

    ${result && html`<div class="preview">
      <h3>${tr('Vérifiez avant d\'enregistrer', 'Check before saving', 'Hamarino alohan\'ny hitahirizana')}</h3>
      ${(textRows.length > 0 || Object.keys(result.plat.details || {}).length > 0) && html`<table class="kv wide">
        ${textRows.map((r) => html`<tr><td>${textLabel(r.f)} <span class="badge muted">${LANG_SHORT[r.l]}</span></td><td>${r.v}</td></tr>`)}
        ${result.plat.photo_en && html`<tr><td>Photo (EN)</td><td>${result.plat.photo_en}</td></tr>`}
        ${result.plat.details?.allergenes && html`<tr><td>${tr('Allergènes', 'Allergens', 'Allergènes')}</td><td>${result.plat.details.allergenes.join(', ') || '—'}</td></tr>`}
        ${result.plat.details?.regimes?.length ? html`<tr><td>${tr('Régimes', 'Diets', 'Régimes')}</td><td>${result.plat.details.regimes.join(', ')}</td></tr>` : null}
      </table>`}
      ${result.ingredients.length > 0 && html`<div class="table-wrap"><table class="table compact">
        <thead><tr><th>ID</th><th>${tr('Nom', 'Name', 'Anarana')}</th><th class="num">Kcal</th><th class="num">Prot.</th><th class="num">${tr('Gluc.', 'Carbs', 'Gluc.')}</th><th class="num">${tr('Lip.', 'Fat', 'Lip.')}</th><th class="num">${tr('Fibres', 'Fibre', 'Fibres')}</th><th class="num">IG</th><th class="num">${tr('g / pièce', 'g / piece', 'g / isa')}</th><th>${tr('Contrôle', 'Check', 'Fanamarinana')}</th><th>Source</th></tr></thead>
        <tbody>${result.ingredients.map((i) => {
          const cur = ingMap.get(i.id);
          const chk = kcalCheck(i);
          return html`<tr>
            <td class="mono">${i.id || tr('nouveau', 'new', 'vaovao')}</td><td>${ingName({ ...(cur || {}), ...i })}</td>
            <td class="num">${fmt(i.kcal)}</td><td class="num">${fmt(i.proteines, 1)}</td><td class="num">${fmt(i.glucides, 1)}</td><td class="num">${fmt(i.lipides, 1)}</td><td class="num">${fmt(i.fibres, 1)}</td><td class="num">${fmt(i.ig)}</td><td class="num">${fmt(i.poids_piece)}</td>
            <td>${chk ? html`<${Badge} tone=${chk.ok ? 'ok' : 'warn'}>${chk.ok ? tr('cohérent', 'consistent', 'mifanaraka') : '4P+4G+9L = ' + fmt(chk.est)}<//>` : html`<${Badge} tone="warn">${tr('incomplet', 'incomplete', 'tsy feno')}<//>`}</td>
            <td class="small">${i.source || '—'}</td>
          </tr>`;
        })}</tbody>
      </table></div>`}
      <div class="row gap"><button class="btn primary" disabled=${busy} onClick=${apply}>${busy ? tr('Enregistrement…', 'Saving…', 'Mitahiry…') : tr('Valider et enregistrer', 'Accept and save', 'Ekena sy tehirizo')}</button><button class="btn ghost" onClick=${() => setResult(null)}>${tr('Annuler', 'Cancel', 'Aoka ihany')}</button></div>
    </div>`}
  <//>`;
}

// ---------------------------------------------------------------
function PhotoCard({ form, setForm, isNew, lines, kcal }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const [kind, setKind] = useState('retouch');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function persist(patch) {
    const cur = data.plats.find((p) => p.id === form.id);
    if (cur) await app.save('plats', { ...cur, ...patch });
    setForm((f) => ({ ...f, ...patch }));
  }
  async function onFile(file) {
    if (!file) return;
    if (isNew) { toast(tr('Enregistrez d\'abord le plat.', 'Save the dish first.', 'Tehirizo aloha ny sakafo.'), 'bad'); return; }
    setBusy(true);
    try {
      const url = await uploadPlatImage(form.id, file);
      await persist({ image_url: url });
      toast(tr('Photo enregistrée', 'Photo saved', 'Voatahiry ny sary'));
    } catch (e) { toast(tr('Envoi impossible : ', 'Upload failed: ', 'Tsy lasa ny sary: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }
  async function onRemove() {
    if (!confirm(tr('Retirer la photo ?', 'Remove the photo?', 'Esorina ve ny sary?'))) return;
    setBusy(true);
    try { await removePlatImage(form.id); await persist({ image_url: null }); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  }

  return html`<${Card} title=${tr('Photo', 'Photo', 'Sary')}>
    <div class="photo-row">
      <label class=${'photo drop' + (over ? ' over' : '') + (busy ? ' busy' : '')}
        onDragOver=${(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave=${() => setOver(false)}
        onDrop=${(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}>
        ${form.image_url ? html`<img src=${form.image_url} alt=${form.nom} />` : html`<span class="muted">${busy ? tr('Envoi…', 'Uploading…', 'Mampakatra…') : tr('Cliquez ou glissez une photo ici', 'Click or drop a photo here', 'Tsindrio na apetraho eto ny sary')}</span>`}
        <input type="file" accept="image/*" hidden disabled=${busy} onChange=${(e) => { onFile(e.target.files[0]); e.target.value = ''; }} />
      </label>
      <div class="col grow">
        <div class="row gap wrap">
          <label class=${'btn primary' + (busy ? ' disabled' : '')}>${form.image_url ? tr('Changer la photo', 'Change photo', 'Ovay ny sary') : tr('Choisir une photo', 'Choose a photo', 'Misafidiana sary')}<input type="file" accept="image/*" hidden disabled=${busy} onChange=${(e) => { onFile(e.target.files[0]); e.target.value = ''; }} /></label>
          ${form.image_url && html`<button class="btn ghost danger" disabled=${busy} onClick=${onRemove}>${tr('Retirer', 'Remove', 'Esory')}</button>`}
        </div>
        <p class="hint">${MODE === 'supabase'
          ? tr('La photo est réduite automatiquement et enregistrée dans Supabase.', 'The photo is resized automatically and stored in Supabase.', 'Hakelezina ho azy ny sary ary tehirizina ao amin\'ny Supabase.')
          : tr('Mode démo : photo gardée dans ce navigateur uniquement.', 'Demo mode: photo kept in this browser only.', 'Mode démo: ao amin\'ity navigateur ity ihany ny sary.')}</p>
        <h3>${tr('Pas encore de photo ? Générez-la avec l\'IA', 'No photo yet? Generate it with AI', 'Tsy mbola misy sary? Ampiasao ny IA')}</h3>
        <p class="small muted">${tr('Le prompt reprend la composition, les quantités, les NB, l\'objectif et le texte marketing. Copiez-le dans ChatGPT (image), Gemini ou Midjourney, enregistrez l\'image puis choisissez-la ci-dessus. Complétez d\'abord les textes avec l\'IA pour un meilleur résultat.', 'The prompt uses the composition, quantities, NB, goal and marketing text. Copy it into ChatGPT (image), Gemini or Midjourney, save the image, then choose it above. Complete the texts with AI first for a better result.', 'Ao anatin\'ny prompt ny composition, ny habetsahana, ny NB, ny tanjona ary ny texte marketing. Adikao ao amin\'ny ChatGPT (image), Gemini na Midjourney, tehirizo ny sary dia safidio eo ambony. Fenoy amin\'ny IA aloha ny texte mba ho tsara kokoa ny vokatra.')}</p>
        <div class="tabs mini wrap">
          <button class=${'tab' + (kind === 'retouch' ? ' on' : '')} onClick=${() => setKind('retouch')}>${tr('Embellir ma vraie photo', 'Enhance my real photo', 'Hatsarao ny sariko tena izy')}</button>
          <button class=${'tab' + (kind === 'photo' ? ' on' : '')} onClick=${() => setKind('photo')}>${tr('Créer une photo (sans texte)', 'Create a photo (no text)', 'Mamorona sary (tsy misy soratra)')}</button>
          <button class=${'tab' + (kind === 'pub' ? ' on' : '')} onClick=${() => setKind('pub')}>${tr('Visuel pub Facebook / Instagram', 'Facebook / Instagram ad visual', 'Sary dokam-barotra Facebook / Instagram')}</button>
        </div>
        ${kind === 'retouch' && html`<p class="small ok-box">${tr('Prenez la photo du vrai plat, envoyez-la dans ChatGPT (ou Gemini) AVEC ce prompt : l\'IA améliore la lumière et la présentation sans changer la nourriture ni les portions.', 'Take a photo of the real dish and send it to ChatGPT (or Gemini) WITH this prompt: the AI improves light and presentation without changing the food or portions.', 'Alaivo sary ny sakafo tena izy, alefaso any amin\'ny ChatGPT (na Gemini) MIARAKA amin\'ity prompt ity: hatsarain\'ny IA ny hazavana sy ny fandaminana, tsy ovainy ny sakafo na ny habetsahany.')}</p>`}
        <${CopyBox} text=${promptSary(form, lines, ingMap, data.categories, kind, kcal)} label=${tr('Copier le prompt photo', 'Copy the photo prompt', 'Adikao ny prompt sary')} rows="9" />
      </div>
    </div>
  <//>`;
}
