import { html, useState, createContext, useContext } from './lib.js?v=202610290725';
import { tr } from './i18n.js?v=202610290725';
import { optionList } from './calc.js?v=202610290725';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function navigate(path) { location.hash = '#' + path; }

export function Badge({ tone = 'muted', children }) {
  return html`<span class=${'badge ' + tone}>${children}</span>`;
}

export function Card({ title, actions, children, class: cls = '' }) {
  return html`<section class=${'card ' + cls}>
    ${(title || actions) && html`<header class="card-head"><h2>${title}</h2><div class="row gap">${actions}</div></header>`}
    ${children}
  </section>`;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove(); return ok;
  }
}

export function CopyBox({ text, label, rows = 10 }) {
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  return html`<div class="copybox">
    <div class="row gap wrap">
      <button class="btn primary" onClick=${async () => {
        const ok = await copyText(text);
        toast(ok ? tr('Copié ! Collez-le dans ChatGPT ou Claude.', 'Copied! Paste it into ChatGPT or Claude.', 'Voadika! Apetaho ao amin\'ny ChatGPT na Claude.')
          : tr('Copie impossible : sélectionnez le texte et copiez-le.', 'Copy failed: select the text and copy it.', 'Tsy nety: safidio ny soratra dia adikao.'), ok ? 'ok' : 'bad');
      }}>${label || tr('Copier le prompt', 'Copy the prompt', 'Adikao ny prompt')}</button>
      <button class="btn ghost" onClick=${() => setOpen(!open)}>${open ? tr('Masquer', 'Hide', 'Afeno') : tr('Voir le prompt', 'Show the prompt', 'Jereo ny prompt')}</button>
    </div>
    ${open && html`<textarea class="mono" readonly rows=${rows} value=${text} onFocus=${(e) => e.target.select()}></textarea>`}
  </div>`;
}

export function Field({ label, hint, children, wide }) {
  return html`<label class=${'field' + (wide ? ' wide' : '')}><span class="field-label">${label}</span>${children}${hint && html`<small class="hint">${hint}</small>`}</label>`;
}

export function Modal({ title, onClose, children, wide }) {
  return html`<div class="modal-back" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
      <header class="card-head"><h2>${title}</h2><button class="btn ghost" onClick=${onClose} aria-label=${tr('Fermer', 'Close', 'Hidio')}>✕</button></header>
      <div class="modal-body">${children}</div>
    </div>
  </div>`;
}

export function Empty({ children }) {
  return html`<div class="empty">${children}</div>`;
}

export const pctBadge = (e) => (e === null || e === undefined ? '' : ' ' + (e > 0 ? '+' : '') + Math.round(e * 100) + '%');

// Lisitra misafidy misy "+ Autre…": tehirizina ho azy ny safidy vaovao (table options)
const slug = (v) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(Date.now());
export function SelectOrAdd({ type, value, onChange, defaults, labelFn = (v) => v, cls = '', unit = false, allowEmpty = false }) {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const [txt, setTxt] = useState('');
  const [fac, setFac] = useState('');
  const [base, setBase] = useState('g');
  const list = optionList(type, defaults, app.data.options);
  const all = value && !list.includes(value) ? [...list, value] : list;

  async function confirmAdd() {
    const v = txt.trim();
    if (!v) { setAdding(false); return; }
    if (unit && !(+String(fac).replace(',', '.') > 0)) { app.toast(tr('Indiquez l\'équivalence en g ou ml', 'Enter the equivalent in g or ml', 'Soraty ny mitovy aminy amin\'ny g na ml'), 'bad'); return; }
    const exists = list.find((x) => x.toLowerCase() === v.toLowerCase());
    if (!exists) {
      try {
        await app.save('options', { id: type + ':' + slug(v), type, valeur: v, base: unit ? base : null, facteur: unit ? +String(fac).replace(',', '.') : null, ordre: 0 });
        app.toast(tr(`« ${v} » ajouté à la liste`, `"${v}" added to the list`, `"${v}" tafiditra ao amin'ny lisitra`));
      } catch (e) { app.toast(e.message, 'bad'); return; }
    }
    onChange(exists || v);
    setAdding(false); setTxt(''); setFac('');
  }

  if (adding) {
    return html`<span class="add-opt">
      <input autofocus value=${txt} placeholder=${tr('Nouveau choix…', 'New option…', 'Safidy vaovao…')} onInput=${(e) => setTxt(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAdding(false); }} />
      ${unit && html`<span class="muted small">= </span><input class="num-input" type="number" min="0" step="any" placeholder="?" value=${fac} onInput=${(e) => setFac(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') confirmAdd(); }} />
        <select class="unit" value=${base} onChange=${(e) => setBase(e.target.value)}><option value="g">g</option><option value="ml">ml</option></select>`}
      <button class="btn small primary" title="OK" onClick=${confirmAdd}>✓</button>
      <button class="btn small ghost" title=${tr('Annuler', 'Cancel', 'Aoka ihany')} onClick=${() => setAdding(false)}>✕</button>
    </span>`;
  }
  return html`<select class=${cls} value=${value || ''} onChange=${(e) => { if (e.target.value === '__add') { e.target.value = value || ''; setAdding(true); } else onChange(e.target.value); }}>
    ${(allowEmpty || !value) && html`<option value="">—</option>`}
    ${all.map((v) => html`<option value=${v}>${labelFn(v)}</option>`)}
    <option value="__add">+ ${tr('Autre…', 'Other…', 'Hafa…')}</option>
  </select>`;
}
