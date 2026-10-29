import { html, useState, useMemo, useEffect } from '../lib.js?v=202610290527';
import { useApp, Card, Badge, Field, CopyBox, Modal, navigate, pctBadge, SelectOrAdd } from '../ui.js?v=202610290527';
import {
  FOTOANA, UNITES, lineValues, lineGrams, sumLines, slotTarget, fitStatus, nextId, uid, fmt, pct, toNum, kcalCheck, NUTR,
} from '../calc.js?v=202610290527';
import { promptHameno, photoBrief, extractJson, ingredientsToFill, normalizePlatTexts, applyPlatTexts, TEXT_LANGS } from '../prompts.js?v=202610290527';
import { exportHameno, importHameno } from '../excel.js?v=202610290527';
import { uploadPlatImage, removePlatImage, MODE } from '../db.js?v=202610290527';
import { tr, fotLabel, unitLabel, ingName, catName, PLAT_TEXT_FIELDS, LANG_SHORT, getLang } from '../i18n.js?v=202610290527';
import { fitLabel } from './plats.js?v=202610290527';
import { PhotoEditor } from '../photo-editor.js?v=202610290527';

const NEW_ING = { nom_fr: null, nom_en: null, categorie: null, etat: null, kcal: null, proteines: null, glucides: null, lipides: null, fibres: null, sucres: null, sodium: null, ig: null, poids_piece: null, densite: null, prix_kg: null, source: null, a_verifier: true };

const EMPTY_PLAT = {
  nom: '', nom_commercial: '', marketing: '', nom_en: '', fotoana: 'Maraina', categories: [], description: '', avantages: '', effets: '',
  nb: '', traductions: {}, details: {}, conseil: '', conservation: '', post_reseaux: '', image_url: '', prix_vente: null, statut: 'Voamarina', notes: '',
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

  // Brouillon: tehirizina ao amin'ny navigateur isaky ny fanovana, mba tsy ho very ny composition
  const draftKey = 'sakafo_draft_' + (isNew ? 'vaovao' : id);
  const [draft, setDraft] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem(draftKey)); return d && d.lines ? d : null; } catch (e) { return null; }
  });
  useEffect(() => {
    if (!dirty || draft || (!lines.length && !(form.nom || '').trim())) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ form, lines, at: Date.now() })); } catch (e) { /* tsy maninona */ }
  }, [form, lines, dirty, draft]);
  const clearDraft = () => { try { localStorage.removeItem(draftKey); localStorage.removeItem('sakafo_draft_vaovao'); } catch (e) { /* */ } };
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
    // Raha tsy misy anarana: raisina ny anarana commercial, na ny ID
    const nom = (formArg.nom || '').trim() || (formArg.nom_commercial || '').trim() || formArg.id;
    const row = { ...EMPTY_PLAT, ...formArg, nom, prix_vente: toNum(formArg.prix_vente) };
    delete row.created_at;
    if (existing?.created_at) row.created_at = existing.created_at;
    await app.save('plats', row);
    await app.setComposition(row.id, compRows(lines, mapArg));
    setForm(row);
    setDirty(false);
    clearDraft();
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
      <div class="row gap save-bar">
        ${!isNew && html`<button class="btn danger ghost" onClick=${del}>${tr('Supprimer', 'Delete', 'Fafao')}</button>`}
        <button class="btn primary" disabled=${busy || !dirty} onClick=${save}>${busy ? tr('Enregistrement…', 'Saving…', 'Mitahiry…') : dirty ? tr('Enregistrer', 'Save', 'Tehirizo') : tr('Enregistré ✓', 'Saved ✓', 'Voatahiry ✓')}</button>
      </div>
    </div>

    ${draft && html`<p class="warn-box row gap wrap between"><span>${tr('Brouillon non enregistré retrouvé (composition et saisie du', 'Unsaved draft found (composition and entries from', 'Misy brouillon tsy voatahiry hita (composition sy fanoratana tamin\'ny')} ${new Date(draft.at).toLocaleString()}).</span>
      <span class="row gap"><button class="btn small primary" onClick=${() => { setForm({ ...EMPTY_PLAT, ...draft.form, id: draft.form.id || form.id }); setLines(draft.lines); setDirty(true); setDraft(null); }}>${tr('Restaurer', 'Restore', 'Avereno')}</button>
      <button class="btn small ghost" onClick=${() => { clearDraft(); setDraft(null); }}>${tr('Ignorer', 'Discard', 'Aoka ihany')}</button></span></p>`}

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
              })}<button type="button" class="chip add" onClick=${async () => {
                const nom = (prompt(tr('Nom du nouvel objectif (ex. Grossesse, Sportif, Senior…)', 'Name of the new goal (e.g. Pregnancy, Athlete, Senior…)', 'Anaran\'ny tanjona vaovao (ohatra: Bevohoka, Mpanao fanatanjahantena…)')) || '').trim();
                if (!nom) return;
                const cid = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'objectif-' + Date.now();
                if (!data.categories.some((c) => c.id === cid)) await app.save('categories', { id: cid, nom, kcal_cible: 2000, tolerance: 0.1, ordre: data.categories.length + 1, regles: '' });
                set('categories', [...(form.categories || []).filter((x) => x !== cid), cid]);
                toast(tr('Objectif ajouté : réglez ses calories dans « Objectifs ».', 'Goal added: set its calories in "Goals".', 'Tafiditra ny tanjona: amboary ny kcal ao amin\'ny "Tanjona".'));
              }}>+ ${tr('Objectif', 'Goal', 'Tanjona')}</button></div>
            <//>
            <${Field} label=${tr('NB / points forts du plat', 'NB / highlights of the dish', 'NB / tombony manokana')} wide hint=${tr('Utilisé par l\'IA pour le texte marketing (ex. sans gluten, fait maison, livré chaud)', 'Used by the AI for the marketing text (e.g. gluten-free, homemade, delivered hot)', 'Ampiasain\'ny IA amin\'ny texte marketing (ohatra: tsy misy gluten, vita an-trano)')}><input value=${form.nb || ''} onInput=${(e) => set('nb', e.target.value)} /><//>
            <${Field} label=${tr('Prix de vente (Ar)', 'Selling price (Ar)', 'Vidiny amidy (Ar)')}><input type="number" min="0" value=${form.prix_vente ?? ''} onInput=${(e) => set('prix_vente', e.target.value)} /><//>
            <${Field} label=${tr('Note interne', 'Internal note', 'Fanamarihana anatiny')}><input value=${form.notes || ''} onInput=${(e) => set('notes', e.target.value)} /><//>
          </div>
        <//>

        <${Card} title=${tr('Composition', 'Composition', 'Composition')} actions=${lines.length ? html`<button class="btn ghost small danger" onClick=${clearLines}>${tr('Tout supprimer', 'Delete all', 'Fafao daholo')}</button>` : null}>
          <div class="table-wrap"><table class="table compact resp comp">
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

    <${AiPanel} form=${form} setForm=${setForm} lines=${lines} isNew=${isNew} persist=${persist} />

        <${Card} title=${tr('Textes (vente et marketing)', 'Texts (sales and marketing)', 'Texte (fivarotana sy marketing)')} actions=${html`<div class="tabs mini">${TEXT_LANGS.map((l) => html`<button class=${'tab' + (l === txtLang ? ' on' : '')} onClick=${() => setTxtLang(l)}>${LANG_SHORT[l]}</button>`)}</div>`}>
      <p class="hint">${tr('Remplis par l\'IA en français, anglais et malgache. Vous pouvez les corriger.', 'Filled by the AI in French, English and Malagasy. You can edit them.', 'Fenoin\'ny IA amin\'ny frantsay, anglisy ary malagasy. Azonao ahitsy.')}</p>
      ${!form.marketing && !form.nom_commercial && html`<p class="ok-box row gap wrap between"><span>${tr('Encore vides : utilisez « Compléter avec l\'IA » (copier le prompt, coller la réponse) pour tout remplir.', 'Still empty: use "Complete with AI" (copy the prompt, paste the answer) to fill everything.', 'Mbola foana: ampiasao ny "Hameno amin\'ny IA" (adikao ny prompt, apetaho ny valiny) mba ho feno daholo.')}</span>
        <button class="btn small primary" onClick=${() => document.querySelector('.ai-steps')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>${tr('Aller à « Compléter avec l\'IA »', 'Go to "Complete with AI"', 'Mankany amin\'ny "Hameno amin\'ny IA"')} ↓</button></p>`}
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

    <${PhotoCard} form=${form} setForm=${setForm} isNew=${isNew} persistAll=${persist} lines=${lines} />
  </div>`;
}

// ---------------------------------------------------------------
function AiPanel({ form, setForm, lines, isNew, persist }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const toFill = ingredientsToFill(lines, ingMap);
  const prompt = promptHameno(form, lines, ingMap, data.categories);



  function parseText() {
    try { setResult(normalize(extractJson(text))); } catch (e) { toast(tr('JSON illisible : ', 'Unreadable JSON: ', 'Tsy voavaky ny JSON: ') + e.message, 'bad'); }
  }
  // Excel (misy sary na tsia) sy/na sary misaraka: azo safidiana miaraka
  async function onFile(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const xls = files.find((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
    const img = files.find((f) => (f.type || '').startsWith('image/'));
    try {
      if (xls) {
        const r = normalize(await importHameno(xls));
        if (img) r.image = img;
        setResult(r);
        if (r.image) toast(tr('Photo trouvée : elle sera enregistrée avec le plat.', 'Photo found: it will be saved with the dish.', 'Hita ny sary: hotehirizina miaraka amin\'ny sakafo.'));
      } else if (img) {
        setResult((cur) => (cur ? { ...cur, image: img } : { plat: normalizePlatTexts({}), ingredients: [], image: img }));
      }
    } catch (x) { toast(tr('Excel illisible : ', 'Unreadable Excel: ', 'Tsy voavaky ny Excel: ') + x.message, 'bad'); }
  }
  function normalize(r) {
    const ings = (r.ingredients || []).filter((i) => i && (i.id || i.nom_mg || i.nom_fr)).map((i) => {
      const o = { ...i };
      for (const k of [...NUTR, 'ig', 'poids_piece', 'densite']) o[k] = toNum(o[k]);
      return o;
    });
    return { plat: normalizePlatTexts(r.plat || {}), ingredients: ings, image: r.image || null };
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
      if (result.image) {
        try {
          const url = await uploadPlatImage(saved.id, result.image);
          const withImg = { ...saved, image_url: url };
          await app.save('plats', withImg);
          setForm(withImg);
        } catch (e) { toast(tr('Photo non envoyée : ', 'Photo not uploaded: ', 'Tsy lasa ny sary: ') + (e.message || e), 'bad'); }
      }
      toast(tr(`Enregistré : ${rows.length} ingrédient(s) et les textes du plat`, `Saved: ${rows.length} ingredient(s) and the dish texts`, `Voatahiry: ingrédient ${rows.length} sy ny texte`));
      setResult(null); setText('');
      if (isNew) navigate('/plats/' + saved.id);
    } catch (e) { toast(tr('Erreur : ', 'Error: ', 'Nisy olana: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }

  const textRows = result && (result.plat.texts) ? TEXT_LANGS.flatMap((l) => PLAT_TEXT_FIELDS.filter((f) => result.plat.texts[l][f]).map((f) => ({ l, f, v: result.plat.texts[l][f] }))) : [];

  return html`<${Card} title=${tr('Compléter avec l\'IA', 'Complete with AI', 'Hameno amin\'ny IA')}>
    ${!lines.length && html`<p class="warn-box">${tr('Ajoutez d\'abord la composition (ingrédients et quantités) : le prompt l\'utilise.', 'Add the composition first (ingredients and quantities): the prompt uses it.', 'Ampidiro aloha ny composition (ingrédients sy habetsahana): ampiasain\'ny prompt izany.')}</p>`}
    <p class="small">${tr('Gratuit : copiez le prompt dans ChatGPT ou Claude.ai, puis collez la réponse (ou importez l\'Excel rempli). « Valider et enregistrer » enregistre aussi le plat et sa composition.', 'Free: copy the prompt into ChatGPT or Claude.ai, then paste the answer (or import the filled Excel). "Accept and save" also saves the dish and its composition.', 'Maimaim-poana: adikao ao amin\'ny ChatGPT na Claude.ai ny prompt, dia apetaho ny valiny (na ampidiro ny Excel feno). "Ekena sy tehirizo" dia mitahiry koa ny sakafo sy ny composition.')}</p>
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
          <label class="btn">${tr('Importer l\'Excel rempli (+ photo)', 'Import the filled Excel (+ photo)', 'Ampidiro Excel voafeno (+ sary)')}<input type="file" accept=".xlsx,.xls,.csv,image/*" multiple hidden onChange=${onFile} /></label>
        </div>
      </div>
    </div>

    ${result && html`<div class="preview">
      <h3>${tr('Vérifiez avant d\'enregistrer', 'Check before saving', 'Hamarino alohan\'ny hitahirizana')}</h3>
      <div class="row gap wrap">
        ${result.image ? html`<img class="preview-photo" src=${URL.createObjectURL(result.image)} alt="" />` : html`<span class="muted small">${tr('Pas de photo dans le fichier.', 'No photo in the file.', 'Tsy misy sary ao amin\'ny fichier.')}</span>`}
        <label class="btn small">${result.image ? tr('Changer la photo', 'Change photo', 'Ovay ny sary') : tr('Ajouter la photo de l\'IA', 'Add the AI photo', 'Ampidiro ny sary navoakan\'ny IA')}<input type="file" accept="image/*" hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) setResult((cur) => ({ ...cur, image: f })); }} /></label>
      </div>
      ${(textRows.length > 0 || Object.keys(result.plat.details || {}).length > 0) && html`<table class="kv wide">
        ${textRows.map((r) => html`<tr><td>${textLabel(r.f)} <span class="badge muted">${LANG_SHORT[r.l]}</span></td><td>${r.v}</td></tr>`)}
        ${result.plat.photo_en && html`<tr><td>Photo (EN)</td><td>${result.plat.photo_en}</td></tr>`}
        ${result.plat.details?.allergenes && html`<tr><td>${tr('Allergènes', 'Allergens', 'Allergènes')}</td><td>${result.plat.details.allergenes.join(', ') || '—'}</td></tr>`}
        ${result.plat.details?.regimes?.length ? html`<tr><td>${tr('Régimes', 'Diets', 'Régimes')}</td><td>${result.plat.details.regimes.join(', ')}</td></tr>` : null}
      </table>`}
      ${result.ingredients.length > 0 && html`<div class="table-wrap"><table class="table compact resp">
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
function PhotoCard({ form, setForm, isNew, persistAll, lines }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [edit, setEdit] = useState(null); // { src, local }

  async function persist(patch) {
    const cur = data.plats.find((p) => p.id === form.id) || form;
    await app.save('plats', { ...cur, ...patch });
    setForm((f) => ({ ...f, ...patch }));
  }
  // Rehefa misafidy sary: sokafana aloha ny éditeur (tapahana, hazavana…) vao tehirizina
  function onFile(file) {
    if (!file) return;
    if (!(file.type || '').startsWith('image/')) { toast(tr('Choisissez une image', 'Choose an image', 'Misafidiana sary'), 'bad'); return; }
    setEdit({ src: URL.createObjectURL(file), local: true });
  }
  async function upload(file) {
    setBusy(true);
    try {
      let saved = null;
      if (isNew) { saved = await persistAll(); if (!saved) return; }
      const url = await uploadPlatImage(form.id, file);
      await persist({ ...(saved || {}), image_url: url });
      toast(tr('Photo enregistrée', 'Photo saved', 'Voatahiry ny sary'));
      setEdit(null);
      if (isNew) navigate('/plats/' + form.id);
    } catch (e) { toast(tr('Envoi impossible : ', 'Upload failed: ', 'Tsy lasa ny sary: ') + (e.message || e), 'bad'); } finally { setBusy(false); }
  }
  async function onRemove() {
    if (!confirm(tr('Retirer la photo ?', 'Remove the photo?', 'Esorina ve ny sary?'))) return;
    setBusy(true);
    try { await removePlatImage(form.id); await persist({ image_url: null }); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); }
  }
  const pick = (e) => { onFile(e.target.files[0]); e.target.value = ''; };
  const closeEdit = () => { if (edit?.local) URL.revokeObjectURL(edit.src); setEdit(null); };

  return html`<${Card} title=${tr('Photo', 'Photo', 'Sary')}>
    <div class="photo-row">
      ${form.image_url
        ? html`<button class="photo zoomable" title=${tr('Agrandir', 'Enlarge', 'Hitarina')} onClick=${() => setZoom(true)}><img src=${form.image_url} alt=${form.nom} /><span class="zoom-hint">⤢</span></button>`
        : html`<label class=${'photo drop' + (over ? ' over' : '') + (busy ? ' busy' : '')}
            onDragOver=${(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave=${() => setOver(false)}
            onDrop=${(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}>
            <span class="muted">${busy ? tr('Envoi…', 'Uploading…', 'Mampakatra…') : tr('Cliquez ou glissez une photo ici', 'Click or drop a photo here', 'Tsindrio na apetraho eto ny sary')}</span>
            <input type="file" accept="image/*" hidden disabled=${busy} onChange=${pick} />
          </label>`}
      <div class="col grow">
        <div class="ai-step">
          <h3><span class="num-circle">1</span> ${tr('Prompt photo', 'Photo prompt', 'Prompt sary')}</h3>
          <p class="small muted">${tr('Fait à partir de la composition, des NB et des textes. Collez-le dans ChatGPT ou Gemini (création d\'image), puis enregistrez l\'image obtenue.', 'Built from the composition, NB and texts. Paste it into ChatGPT or Gemini (image creation), then save the image.', 'Vita avy amin\'ny composition, NB ary texte. Apetaho ao amin\'ny ChatGPT na Gemini (famoronana sary), dia tehirizo ny sary azo.')}</p>
          <${CopyBox} text=${photoBrief(form, lines, ingMap)} label=${tr('Copier le prompt photo', 'Copy the photo prompt', 'Adikao ny prompt sary')} rows="7" />
        </div>
        <div class="ai-step">
          <h3><span class="num-circle">2</span> ${tr('Ajouter et ajuster la photo', 'Add and adjust the photo', 'Ampidiro sy amboary ny sary')}</h3>
          <div class="row gap wrap">
            <label class=${'btn primary' + (busy ? ' disabled' : '')}>${busy ? tr('Envoi…', 'Uploading…', 'Mampakatra…') : form.image_url ? tr('Remplacer la photo', 'Replace photo', 'Soloy ny sary') : tr('Ajouter une photo', 'Add a photo', 'Ampidiro sary')}<input type="file" accept="image/*" hidden disabled=${busy} onChange=${pick} /></label>
            ${form.image_url && html`<button class="btn" disabled=${busy} onClick=${() => setEdit({ src: form.image_url, local: false })}>${tr('Modifier', 'Edit', 'Ovay')}</button>`}
            ${form.image_url && html`<button class="btn" onClick=${() => setZoom(true)}>${tr('Agrandir', 'Enlarge', 'Hitarina')}</button>`}
            ${form.image_url && html`<button class="btn ghost danger" disabled=${busy} onClick=${onRemove}>${tr('Retirer', 'Remove', 'Esory')}</button>`}
          </div>
          <p class="hint">${tr('Après le choix, vous pouvez recadrer, pivoter et régler la lumière avant d\'enregistrer. Votre propre photo convient aussi.', 'After choosing, you can crop, rotate and adjust the light before saving. Your own photo works too.', 'Aorian\'ny fisafidianana, azonao tapahana, ahodina ary amboarina ny hazavana alohan\'ny hitahirizana. Mety koa ny sarinao manokana.')}</p>
        </div>
      </div>
    </div>
    ${zoom && form.image_url && html`<div class="lightbox" onClick=${() => setZoom(false)} role="dialog" aria-modal="true">
      <img src=${form.image_url} alt=${form.nom} />
      <button class="btn lightbox-close" onClick=${() => setZoom(false)} aria-label=${tr('Fermer', 'Close', 'Hidio')}>✕</button>
    </div>`}
    ${edit && html`<${PhotoEditor} src=${edit.src} onCancel=${closeEdit} onSave=${upload} />`}
  <//>`;
}
