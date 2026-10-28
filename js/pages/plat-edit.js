import { html, useState, useMemo } from '../lib.js';
import { useApp, Card, Badge, Field, CopyBox, navigate } from '../ui.js';
import {
  FOTOANA, lineValues, sumLines, slotTarget, fitStatus, nextId, uid, fmt, pct, toNum, kcalCheck, NUTR,
} from '../calc.js';
import { promptHameno, promptSary, extractJson, ingredientsToFill } from '../prompts.js';
import { exportHameno, importHameno } from '../excel.js';

const EMPTY_PLAT = {
  nom: '', nom_en: '', fotoana: 'Atoandro', categories: [], description: '', avantages: '', effets: '',
  image_url: '', prix_vente: null, statut: 'Draft', notes: '',
};

export function ingLabel(i) { return `${i.nom_mg} (${i.id})`; }
export function findIngredient(text, ingredients) {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/\(([^()]+)\)\s*$/);
  if (m) { const byId = ingredients.find((i) => i.id === m[1].trim()); if (byId) return byId; }
  const low = t.toLowerCase();
  return ingredients.find((i) => i.id.toLowerCase() === low || (i.nom_mg || '').toLowerCase() === low || (i.nom_fr || '').toLowerCase() === low) || null;
}

export function PlatEdit({ id }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const isNew = id === 'vaovao';
  const existing = data.plats.find((p) => p.id === id);
  const [form, setForm] = useState(() => (existing ? { ...EMPTY_PLAT, ...existing } : { ...EMPTY_PLAT, id: nextId('SK', data.plats) }));
  const [lines, setLines] = useState(() => data.composition.filter((c) => c.plat_id === id).sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map((c) => ({ ...c })));
  const [dirty, setDirty] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [newIng, setNewIng] = useState('');
  const [newG, setNewG] = useState('');

  const totals = useMemo(() => sumLines(lines, ingMap), [lines, ingMap]);
  if (!isNew && !existing) return html`<div class="page"><p>Tsy hita ny sakafo ${id}.</p><a href="#/plats">← Hiverina</a></div>`;

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };
  const setLine = (i, patch) => { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l))); setDirty(true); };
  const sortedCats = [...data.categories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  async function addLine() {
    const txt = newIng.trim();
    if (!txt) return;
    let ing = findIngredient(txt, data.ingredients);
    if (!ing) {
      if (!confirm(`"${txt}" mbola tsy ao amin'ny ingrédients. Hampidirina ho ingrédient vaovao (ho fenoin'ny IA ny valeur-ny)?`)) return;
      ing = {
        id: nextId('I', data.ingredients, 3), nom_mg: txt, nom_fr: null, categorie: null, etat: null,
        kcal: null, proteines: null, glucides: null, lipides: null, fibres: null, sucres: null, sodium: null, ig: null,
        prix_kg: null, source: null, a_verifier: true,
      };
      try { await app.save('ingredients', ing); toast(`Ingrédient vaovao: ${ing.id} ${txt}`); } catch (e) { toast(e.message, 'bad'); return; }
    }
    setLines((ls) => [...ls, { id: uid(), plat_id: form.id, ingredient_id: ing.id, grammes: toNum(newG) || 0, ordre: ls.length }]);
    setNewIng(''); setNewG(''); setDirty(true);
  }

  async function save() {
    if (!form.nom.trim()) { toast('Soraty ny anaran\'ny sakafo', 'bad'); return false; }
    setBusy(true);
    try {
      const row = { ...EMPTY_PLAT, ...form, nom: form.nom.trim(), prix_vente: toNum(form.prix_vente) };
      delete row.created_at;
      if (existing?.created_at) row.created_at = existing.created_at;
      await app.save('plats', row);
      await app.setComposition(row.id, lines.map((l, i) => ({ id: l.id, plat_id: row.id, ingredient_id: l.ingredient_id, grammes: toNum(l.grammes) || 0, ordre: i })));
      setDirty(false);
      toast('Voatahiry');
      if (isNew) navigate('/plats/' + row.id);
      return true;
    } catch (e) { toast('Tsy voatahiry: ' + (e.message || e), 'bad'); return false; } finally { setBusy(false); }
  }

  async function del() {
    if (!confirm(`Hofafana tanteraka ve ny "${form.nom}"?`)) return;
    try { await app.del('plats', form.id); toast('Voafafa'); navigate('/plats'); } catch (e) { toast(e.message, 'bad'); }
  }

  return html`<div class="page">
    <div class="page-head">
      <div><a href="#/plats" class="muted">← Sakafo</a><h1>${isNew ? 'Sakafo vaovao' : form.nom}<span class="muted mono small"> ${form.id}</span></h1></div>
      <div class="row gap">
        ${!isNew && html`<button class="btn danger ghost" onClick=${del}>Fafao</button>`}
        <button class="btn primary" disabled=${busy || !dirty} onClick=${save}>${busy ? 'Mitahiry…' : dirty ? 'Tehirizo' : 'Voatahiry ✓'}</button>
      </div>
    </div>

    <div class="edit-grid">
      <div class="col">
        <${Card} title="Momba ny sakafo">
          <div class="form-grid">
            <${Field} label="Anaran'ny sakafo" wide><input value=${form.nom} onInput=${(e) => set('nom', e.target.value)} placeholder="ohatra: Akoho sy legioma, vary mena" /><//>
            <${Field} label="Fotoana">
              <select value=${form.fotoana} onChange=${(e) => set('fotoana', e.target.value)}>${FOTOANA.map((f) => html`<option>${f}</option>`)}</select>
            <//>
            <${Field} label="Sata">
              <select value=${form.statut} onChange=${(e) => set('statut', e.target.value)}><option>Draft</option><option>Voamarina</option></select>
            <//>
            <${Field} label="Sokajy (tanjona)" wide>
              <div class="chips">${sortedCats.map((c) => {
                const on = (form.categories || []).includes(c.id);
                return html`<button type="button" class=${'chip' + (on ? ' on' : '')} onClick=${() => set('categories', on ? form.categories.filter((x) => x !== c.id) : [...(form.categories || []), c.id])}>${c.nom}</button>`;
              })}</div>
            <//>
            <${Field} label="Famaritana" wide><textarea rows="2" value=${form.description || ''} onInput=${(e) => set('description', e.target.value)}></textarea><//>
            <${Field} label="Tombony (avantages)" wide><textarea rows="2" value=${form.avantages || ''} onInput=${(e) => set('avantages', e.target.value)}></textarea><//>
            <${Field} label="Vokatra (effets)" wide><textarea rows="2" value=${form.effets || ''} onInput=${(e) => set('effets', e.target.value)}></textarea><//>
            <${Field} label="Anarana anglisy (ho an'ny sary)" wide hint="Fenoin'ny IA ho azy"><input value=${form.nom_en || ''} onInput=${(e) => set('nom_en', e.target.value)} /><//>
            <${Field} label="Vidiny amidy (Ar)"><input type="number" min="0" value=${form.prix_vente ?? ''} onInput=${(e) => set('prix_vente', e.target.value)} /><//>
            <${Field} label="Fanamarihana"><input value=${form.notes || ''} onInput=${(e) => set('notes', e.target.value)} /><//>
          </div>
        <//>

        <${Card} title="Composition">
          <div class="table-wrap"><table class="table compact">
            <thead><tr><th>Ingrédient</th><th class="num">Grammes</th><th class="num">Kcal</th><th class="num">Prot.</th><th class="num">Gluc.</th><th class="num">Lip.</th><th></th></tr></thead>
            <tbody>
              ${lines.map((l, i) => {
                const ing = ingMap.get(l.ingredient_id);
                const v = lineValues(l, ing);
                return html`<tr>
                  <td>${ing ? ing.nom_mg : html`<span class="error">${l.ingredient_id} tsy hita</span>`} <span class="muted mono small">${l.ingredient_id}</span>${v.missing && html` <${Badge} tone="warn">tsy misy valeur<//>`}</td>
                  <td class="num"><input class="num-input" type="number" min="0" step="1" value=${l.grammes} onInput=${(e) => setLine(i, { grammes: e.target.value })} /></td>
                  <td class="num">${v.missing ? '?' : fmt(v.kcal)}</td>
                  <td class="num">${v.missing ? '?' : fmt(v.proteines, 1)}</td>
                  <td class="num">${v.missing ? '?' : fmt(v.glucides, 1)}</td>
                  <td class="num">${v.missing ? '?' : fmt(v.lipides, 1)}</td>
                  <td><button class="btn ghost small" title="Esory" onClick=${() => { setLines((ls) => ls.filter((_, j) => j !== i)); setDirty(true); }}>✕</button></td>
                </tr>`;
              })}
              <tr class="total-row"><td>Total</td><td class="num">${fmt(totals.grammes)} g</td><td class="num">${fmt(totals.kcal)}</td><td class="num">${fmt(totals.proteines, 1)}</td><td class="num">${fmt(totals.glucides, 1)}</td><td class="num">${fmt(totals.lipides, 1)}</td><td></td></tr>
            </tbody>
          </table></div>
          <datalist id="ing-list">${data.ingredients.map((i) => html`<option value=${ingLabel(i)}></option>`)}</datalist>
          <div class="add-line">
            <input list="ing-list" placeholder="Ingrédient (soraty ny anarany)…" value=${newIng} onInput=${(e) => setNewIng(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') addLine(); }} />
            <input type="number" min="0" placeholder="g" class="num-input" value=${newG} onInput=${(e) => setNewG(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') addLine(); }} />
            <button class="btn" onClick=${addLine}>Ampio</button>
          </div>
          <p class="hint">Lanjan'ny ingrédient araka ny fanomezana azy (masaka raha masaka). Raha tsy ao amin'ny lisitra, soraty fotsiny ny anarany dia tsindrio "Ampio".</p>
        <//>
      </div>

      <div class="col side">
        <${Card} title="Valeur nutritionnelle" class="sticky">
          ${totals.missing > 0 && html`<p class="warn-box">Ingrédient ${totals.missing} mbola tsy misy valeur: tsy feno ny kajy. Ampiasao ny "Hameno amin'ny IA".</p>`}
          <div class="big-kcal">${fmt(totals.kcal)}<span>kcal</span></div>
          <div class="macro-bar">
            <i style=${'flex:' + (totals.protPct || 0) + ';background:var(--prot)'}></i>
            <i style=${'flex:' + (totals.glucPct || 0) + ';background:var(--gluc)'}></i>
            <i style=${'flex:' + (totals.lipPct || 0) + ';background:var(--lip)'}></i>
          </div>
          <table class="kv">
            <tr><td><span class="dot" style="background:var(--prot)"></span>Protéines</td><td>${fmt(totals.proteines, 1)} g</td><td class="muted">${pct(totals.protPct)}</td></tr>
            <tr><td><span class="dot" style="background:var(--gluc)"></span>Glucides</td><td>${fmt(totals.glucides, 1)} g</td><td class="muted">${pct(totals.glucPct)}</td></tr>
            <tr><td><span class="dot" style="background:var(--lip)"></span>Lipides</td><td>${fmt(totals.lipides, 1)} g</td><td class="muted">${pct(totals.lipPct)}</td></tr>
            <tr><td>Fibres</td><td>${fmt(totals.fibres, 1)} g</td><td></td></tr>
            <tr><td>Sucres</td><td>${fmt(totals.sucres, 1)} g</td><td></td></tr>
            <tr><td>Sodium</td><td>${fmt(totals.sodium)} mg</td><td></td></tr>
            <tr><td>Charge glycémique</td><td>${fmt(totals.cg, 1)}</td><td></td></tr>
            <tr><td>Coût</td><td>${totals.prixManquant ? '?' : fmt(totals.cout) + ' Ar'}</td><td class="muted small">${totals.prixManquant ? 'vidiny ' + totals.prixManquant + ' tsy fantatra' : ''}</td></tr>
            ${toNum(form.prix_vente) && !totals.prixManquant ? html`<tr><td>Tombony</td><td>${fmt(toNum(form.prix_vente) - totals.cout)} Ar</td><td></td></tr>` : null}
          </table>
          ${(form.categories || []).length > 0 && html`<h3>Mifanaraka amin'ny tanjona?</h3>
            <ul class="list">${form.categories.map((cid) => {
              const c = data.categories.find((x) => x.id === cid);
              if (!c) return null;
              const target = slotTarget(c, form.fotoana);
              const f = fitStatus(totals.kcal, target, c.tolerance);
              return html`<li><b>${c.nom}</b> · ${form.fotoana}: tanjona ${fmt(target)} kcal <${Badge} tone=${f.tone}>${f.label}${f.ecart !== null ? ' ' + (f.ecart > 0 ? '+' : '') + Math.round(f.ecart * 100) + '%' : ''}<//></li>`;
            })}</ul>`}
        <//>
      </div>
    </div>

    ${isNew
      ? html`<${Card} title="Hameno amin'ny IA"><p class="muted">Tehirizo aloha ny sakafo dia hiseho eto ny prompt.</p><//>`
      : html`<${AiPanel} form=${form} setForm=${setForm} lines=${lines} dirty=${dirty} save=${save} />`}

    <${Card} title="Sary">
      <div class="photo-row">
        <div class="photo">${form.image_url ? html`<img src=${form.image_url} alt=${form.nom} />` : html`<span class="muted">Tsy mbola misy sary</span>`}</div>
        <div class="col grow">
          <p>1. Adikao ity prompt ity ao amin'ny ChatGPT (image), Gemini, Midjourney na Ideogram.</p>
          <${CopyBox} text=${promptSary(form)} label="Adikao ny prompt sary" rows="5" />
          <p>2. Ampakaro any amin'ny toerana (ohatra: Supabase Storage, Google Drive public, imgbb) ny sary dia apetaho eto ny lien-ny.</p>
          <${Field} label="Lien ny sary (URL)" wide><input value=${form.image_url || ''} onInput=${(e) => set('image_url', e.target.value)} placeholder="https://…" /><//>
        </div>
      </div>
    <//>
  </div>`;
}

// ---------------------------------------------------------------
function AiPanel({ form, setForm, lines, dirty, save }) {
  const app = useApp();
  const { data, ingMap, toast } = app;
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const toFill = ingredientsToFill(lines, ingMap);
  const prompt = promptHameno(form, lines, ingMap, data.categories);

  function parseText() {
    try { setResult(normalize(extractJson(text))); } catch (e) { toast('Tsy voavaky ny JSON: ' + e.message, 'bad'); }
  }
  async function onFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    try { setResult(normalize(await importHameno(f))); } catch (x) { toast('Tsy voavaky ny Excel: ' + x.message, 'bad'); }
    e.target.value = '';
  }
  function normalize(r) {
    const plat = r.plat || {};
    const ings = (r.ingredients || []).filter((i) => i && (i.id || i.nom_mg)).map((i) => {
      const o = { ...i };
      for (const k of [...NUTR, 'ig']) o[k] = toNum(o[k]);
      return o;
    });
    return { plat, ingredients: ings };
  }

  async function apply() {
    setBusy(true);
    try {
      // 1. ingrédients
      const rows = [];
      let pool = [...data.ingredients];
      for (const r of result.ingredients) {
        const cur = r.id ? pool.find((x) => x.id === r.id) : null;
        const base = cur || {
          id: nextId('I', pool, 3), nom_mg: r.nom_mg || r.nom_fr || '?', nom_fr: null, categorie: null, etat: null,
          kcal: null, proteines: null, glucides: null, lipides: null, fibres: null, sucres: null, sodium: null, ig: null,
          prix_kg: null, source: null, a_verifier: true,
        };
        const merged = { ...base };
        for (const k of ['nom_fr', 'categorie', 'etat', 'source', ...NUTR, 'ig']) {
          if (r[k] !== null && r[k] !== undefined && r[k] !== '') merged[k] = r[k];
        }
        if (merged.categorie && merged.categorie.includes('/')) merged.categorie = null;
        if (merged.etat && merged.etat.includes('|')) merged.etat = null;
        merged.a_verifier = true;
        rows.push(merged);
        if (!cur) pool.push(merged);
      }
      if (rows.length) await app.save('ingredients', rows);
      // 2. sakafo
      const p = result.plat || {};
      const next = { ...form };
      for (const k of ['nom_en', 'description', 'avantages', 'effets']) if (p[k]) next[k] = String(p[k]);
      setForm(next);
      const row = { ...next, prix_vente: toNum(next.prix_vente) };
      await app.save('plats', row);
      toast(`Voatahiry: ingrédient ${rows.length} sy ny momba ny sakafo`);
      setResult(null); setText('');
    } catch (e) { toast('Nisy olana: ' + (e.message || e), 'bad'); } finally { setBusy(false); }
  }

  return html`<${Card} title="Hameno amin'ny IA">
    ${dirty && html`<p class="warn-box">Misy fanovana tsy voatahiry. <button class="btn small" onClick=${save}>Tehirizo aloha</button></p>`}
    <div class="ai-steps">
      <div class="ai-step">
        <h3><span class="num-circle">1</span> Adikao ny prompt</h3>
        <p class="muted small">Ingrédient ${toFill.length} no mila valeur${toFill.length ? ': ' + toFill.map((i) => i.nom_mg).join(', ') : ''}. Hosoratan'ny IA koa ny famaritana, tombony sy vokatra.</p>
        <${CopyBox} text=${prompt} rows="14" />
      </div>
      <div class="ai-step">
        <h3><span class="num-circle">2</span> Fichier Excel (tsy voatery)</h3>
        <p class="muted small">Ampiarahina amin'ny prompt raha tianao hameno Excel ny IA.</p>
        <button class="btn" onClick=${() => exportHameno(form, lines, ingMap).catch((e) => toast(e.message, 'bad'))}>Alaivo ny hameno_${form.id}.xlsx</button>
      </div>
      <div class="ai-step">
        <h3><span class="num-circle">3</span> Avereno ny valin'ny IA</h3>
        <textarea rows="5" class="mono" placeholder="Apetaho eto ny valiny (misy ny bloc JSON)…" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
        <div class="row gap wrap">
          <button class="btn primary" disabled=${!text.trim()} onClick=${parseText}>Vakio ny JSON</button>
          <label class="btn">Ampidiro Excel voafeno<input type="file" accept=".xlsx,.xls,.csv" hidden onChange=${onFile} /></label>
        </div>
      </div>
    </div>

    ${result && html`<div class="preview">
      <h3>Hamarino alohan'ny hitahirizana</h3>
      ${result.plat && html`<table class="kv wide">
        ${['nom_en', 'description', 'avantages', 'effets'].filter((k) => result.plat[k]).map((k) => html`<tr><td>${k}</td><td>${result.plat[k]}</td></tr>`)}
      </table>`}
      ${result.ingredients.length > 0 && html`<div class="table-wrap"><table class="table compact">
        <thead><tr><th>ID</th><th>Anarana</th><th class="num">Kcal</th><th class="num">Prot.</th><th class="num">Gluc.</th><th class="num">Lip.</th><th class="num">Fibres</th><th class="num">IG</th><th>Fanamarinana</th><th>Source</th></tr></thead>
        <tbody>${result.ingredients.map((i) => {
          const cur = ingMap.get(i.id);
          const chk = kcalCheck(i);
          return html`<tr>
            <td class="mono">${i.id || 'vaovao'}</td><td>${cur?.nom_mg || i.nom_mg || i.nom_fr}</td>
            <td class="num">${fmt(i.kcal)}</td><td class="num">${fmt(i.proteines, 1)}</td><td class="num">${fmt(i.glucides, 1)}</td><td class="num">${fmt(i.lipides, 1)}</td><td class="num">${fmt(i.fibres, 1)}</td><td class="num">${fmt(i.ig)}</td>
            <td>${chk ? html`<${Badge} tone=${chk.ok ? 'ok' : 'warn'}>${chk.ok ? 'mifanaraka' : '4P+4G+9L = ' + fmt(chk.est)}<//>` : html`<${Badge} tone="warn">tsy feno<//>`}</td>
            <td class="small">${i.source || '—'}</td>
          </tr>`;
        })}</tbody>
      </table></div>`}
      <div class="row gap"><button class="btn primary" disabled=${busy} onClick=${apply}>${busy ? 'Mitahiry…' : 'Ekena sy tehirizo'}</button><button class="btn ghost" onClick=${() => setResult(null)}>Aoka ihany</button></div>
    </div>`}
  <//>`;
}
