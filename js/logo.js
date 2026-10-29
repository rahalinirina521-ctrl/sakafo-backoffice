// Logo Sakafo (bol + feuilles) — utilisé dans toutes les pages
import { html } from './lib.js?v=202610291451';
export function Logo({ size = 34, titre = false }) {
  return html`<span class="logo" style=${{ '--s': size + 'px' }}>
    <svg viewBox="0 0 64 64" width=${size} height=${size} aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#15803d"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#sg)"/><path d="M33 29.5c0-8.5 5.6-14.6 14.5-15.5-.6 8.8-6 14.7-14.5 15.5z" fill="#d9f99d"/><path d="M31.5 29.5c-.7-6.2-4.6-10.3-11-11 .3 6.4 4.4 10.4 11 11z" fill="#bbf7d0"/><path d="M12.5 33.5h39a19.5 19.5 0 0 1-39 0z" fill="#fff"/><rect x="11" y="31" width="42" height="4.2" rx="2.1" fill="#fff"/><path d="M22 41.5c3 3.2 6.4 4.6 10 4.6s7-1.4 10-4.6" stroke="#16a34a" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>
    ${titre && html`<span class="logo-txt"><b>Sakafo</b><small>Sur Mesure</small></span>`}
  </span>`;
}
