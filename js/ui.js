import { html, useState, createContext, useContext } from './lib.js';
import { tr } from './i18n.js';

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
