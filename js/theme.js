// Thème clair / sombre / automatique (suit le téléphone)
import { html, useState, useEffect } from './lib.js?v=202610291427';
import { tr } from './i18n.js?v=202610291427';

const KEY = 'sakafo_theme';
const mq = typeof window !== 'undefined' && window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
export const getTheme = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } };
export const isDark = () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark');
function apply(t) {
  const dark = t === 'dark' || (t === 'auto' && mq && mq.matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0b120e' : '#16a34a');
  window.dispatchEvent(new CustomEvent('sakafo-theme', { detail: dark ? 'dark' : 'light' }));
}
export function setTheme(t) { try { localStorage.setItem(KEY, t); } catch (e) { /* */ } apply(t); }
if (typeof document !== 'undefined') { apply(getTheme()); if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (getTheme() === 'auto') apply('auto'); }); }

// Hook : re-rendu quand le thème change (cartes, graphiques)
export function useThemeSombre() {
  const [d, setD] = useState(isDark());
  useEffect(() => { const on = (e) => setD(e.detail === 'dark'); window.addEventListener('sakafo-theme', on); return () => window.removeEventListener('sakafo-theme', on); }, []);
  return d;
}

const ICON = { auto: '🖥️', light: '☀️', dark: '🌙' };
const SUIV = { auto: 'light', light: 'dark', dark: 'auto' };
export function ThemeToggle({ compact }) {
  const [t, setT] = useState(getTheme());
  const lab = { auto: tr('Thème automatique', 'Automatic theme', 'Loko mandeha ho azy'), light: tr('Thème clair', 'Light theme', 'Loko mazava'), dark: tr('Thème sombre', 'Dark theme', 'Loko maizina') }[t];
  return html`<button class=${'theme-btn' + (compact ? ' compact' : '')} title=${lab} aria-label=${lab} onClick=${() => { const n = SUIV[t]; setT(n); setTheme(n); }}>
    <span class="theme-ic">${ICON[t]}</span>${!compact && html`<span>${lab}</span>`}</button>`;
}
