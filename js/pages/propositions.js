import { html, useState } from '../lib.js';
import { useApp, Card, Badge, Field, CopyBox, navigate } from '../ui.js';
import { FOTOANA, SLOT_SHARE, sumLines, slotTarget, fitStatus, nextId, uid, fmt, toNum, NUTR } from '../calc.js';
import { promptPropositions, extractJson } from '../prompts.js';

const EMPTY_ING = { nom_fr: null, categorie: null, etat: null, kcal: null, proteines: null, glucides: null, lipides: null, fibres: null, sucres: null, sodium: null, ig: null, prix_kg: null, source: null, a_verifier: true };

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

  function parse() {
    try {
      const j = extractJson(text);
      const list = (j.propositions || j.plats || []).map((p) => {
        // ingrédients vaovao: ampiasaina vonjimaika amin'ny kajy
        const temp = new Map(ingMap);
        const lines = (p.composition || []).map((c, i) => {
          let id = c.ingredient_id && ingMap.has(c.ingredient_id) ? c.ingredient_id : null;
          let nouvel = null;
          if (!id) {
            nouvel = { ...EMPTY_ING, ...(c.nouvel_ingredient || {}), nom_mg: c.nouvel_ingredient?.nom_mg || c.nouvel_ingredient?.nom_fr || c.ingredient_id || 'Ingrédient vaovao' };
            for (const k of [...NUTR, 'ig']) nouvel[k] = toNum(nouvel[k]);
            id = 'NEW-' + i;
            temp.set(id, nouvel);
          }
          return { id: uid(), ingredient_id: id, grammes: toNum(c.grammes) || 0, nouvel };
        });
        return { ...p, fotoana: FOTOANA.includes(p.fotoana) ? p.fotoana : opts.fotoana, lines, totals: sumLines(lines, temp), selected: false };
      });
      if (!list.length) throw new Error('Tsy misy "propositions" ao amin\'ny JSON');
      setProps(list);
    } catch (e) { toast('Tsy voavaky: ' + e.message, 'bad'); }
  }

  async function importSelected() {
    const chosen = props.filter((p) => p.selected);
    if (!chosen.length) { toast('Safidio aloha izay ampidirina', 'bad'); return; }
    setBusy(true);
    try {
      let ingPool = [...data.ingredients];
      let platPool = [...data.plats];
      const newIngs = [];
      const newPlats = [];
      const newLines = [];
      for (const p of chosen) {
        const platId = nextId('SK', platPool);
        const plat = {
          id: platId, nom: p.nom || 'Sakafo vaovao', nom_en: p.nom_en || '', fotoana: p.fotoana, categories: [opts.categorie],
          description: p.description || '', avantages: p.avantages || '', effets: p.effets || '', image_url: '', prix_vente: null,
          statut: 'Draft', notes: 'Soso-kevitra IA',
        };
        platPool.push(plat); newPlats.push(plat);
        p.lines.forEach((l, i) => {
          let ingId = l.ingredient_id;
          if (l.nouvel) {
            const same = ingPool.find((x) => (x.nom_mg || '').toLowerCase() === l.nouvel.nom_mg.toLowerCase());
            if (same) ingId = same.id;
            else {
              const ing = { ...l.nouvel, id: nextId('I', ingPool, 3), a_verifier: true };
              delete ing.nouvel;
              ingPool.push(ing); newIngs.push(ing); ingId = ing.id;
            }
          }
          newLines.push({ id: uid(), plat_id: platId, ingredient_id: ingId, grammes: l.grammes, ordre: i });
        });
      }
      if (newIngs.length) await app.save('ingredients', newIngs);
      await app.save('plats', newPlats);
      await app.save('composition', newLines);
      toast(`Sakafo ${newPlats.length} nampidirina${newIngs.length ? ', ingrédient vaovao ' + newIngs.length : ''}`);
      setProps((ps) => ps.filter((p) => !p.selected));
    } catch (e) { toast('Nisy olana: ' + (e.message || e), 'bad'); } finally { setBusy(false); }
  }

  const target = slotTarget(category, opts.fotoana);

  return html`<div class="page">
    <h1>Soso-kevitra IA</h1>
    <p class="muted">Rehefa lany hevitra ianao: mangataha sakafo vaovao amin'ny IA, dia safidio ireo tianao ihany no ampidirina.</p>
    <${Card} title="1. Inona no tadiavina?">
      <div class="form-grid">
        <${Field} label="Sokajy"><select value=${opts.categorie} onChange=${(e) => set('categorie', e.target.value)}>${cats.map((c) => html`<option value=${c.id}>${c.nom}</option>`)}</select><//>
        <${Field} label="Fotoana"><select value=${opts.fotoana} onChange=${(e) => set('fotoana', e.target.value)}>${FOTOANA.map((f) => html`<option>${f}</option>`)}</select><//>
        <${Field} label="Kcal isaky ny sakafo"><input type="number" value=${opts.kcal} onInput=${(e) => set('kcal', e.target.value)} /><//>
        <${Field} label="Isa"><input type="number" min="1" max="20" value=${opts.isa} onInput=${(e) => set('isa', e.target.value)} /><//>
        <${Field} label="Protéines farafahakeliny (g)"><input type="number" value=${opts.prot} onInput=${(e) => set('prot', e.target.value)} /><//>
        <${Field} label="Budget isaky ny sakafo (Ar)"><input type="number" value=${opts.budget} onInput=${(e) => set('budget', e.target.value)} /><//>
        <${Field} label="Endrika (style)" wide><input value=${opts.style} onInput=${(e) => set('style', e.target.value)} placeholder="ohatra: sakafo malagasy fotsiny, na asiatique, na tsy misy henakisoa…" /><//>
        <${Field} label="Fanamarihana hafa" wide><input value=${opts.fanamarihana} onInput=${(e) => set('fanamarihana', e.target.value)} /><//>
      </div>
      <${CopyBox} text=${prompt} rows="14" />
    <//>
    <${Card} title="2. Apetaho ny valin'ny IA">
      <textarea rows="6" class="mono" placeholder="Apetaho eto ny JSON nomen'ny IA…" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
      <button class="btn primary" disabled=${!text.trim()} onClick=${parse}>Asehoy ny soso-kevitra</button>
    <//>
    ${props.length > 0 && html`<${Card} title=${'3. Safidio (' + props.filter((p) => p.selected).length + '/' + props.length + ')'} actions=${html`<button class="btn primary" disabled=${busy} onClick=${importSelected}>${busy ? 'Mampiditra…' : 'Ampidiro ireo voafidy'}</button>`}>
      <div class="prop-grid">${props.map((p, idx) => {
        const fit = fitStatus(p.totals.kcal, target, category?.tolerance);
        return html`<article class=${'prop' + (p.selected ? ' on' : '')} onClick=${() => setProps((ps) => ps.map((x, j) => (j === idx ? { ...x, selected: !x.selected } : x)))}>
          <header><input type="checkbox" checked=${p.selected} /><h3>${p.nom}</h3></header>
          <p class="small">${p.description}</p>
          <div class="row gap wrap"><b>${fmt(p.totals.kcal)} kcal</b><span>P ${fmt(p.totals.proteines)} g</span><span>G ${fmt(p.totals.glucides)} g</span><span>L ${fmt(p.totals.lipides)} g</span><${Badge} tone=${fit.tone}>${fit.label}<//></div>
          <ul class="small ing-list">${p.lines.map((l) => html`<li>${l.nouvel ? html`<${Badge} tone="warn">vaovao<//> ${l.nouvel.nom_mg}` : ingMap.get(l.ingredient_id)?.nom_mg} — ${fmt(l.grammes)} g</li>`)}</ul>
          ${p.totals.missing > 0 && html`<p class="small warn-text">Misy ingrédient tsy misy valeur: tsy feno ny kajy.</p>`}
          <p class="small muted">${p.avantages}</p>
        </article>`;
      })}</div>
    <//>`}
    <p class="muted small">Ny sakafo nampidirina dia "Draft" ary hita ao amin'ny <a href="#/plats" onClick=${() => navigate('/plats')}>Sakafo</a>, azonao ovaina sy hamarinina.</p>
  </div>`;
}
