// Adiresy + Google Maps: fikarohana, toerana GPS, marika (repère), itinéraire. Tsy mila clé API.
import { html, useState } from './lib.js?v=202610291512';
import { useApp } from './ui.js?v=202610291512';
import { tr } from './i18n.js?v=202610291512';

const CITY = 'Antananarivo, Madagascar';
const num = (v) => (v === null || v === undefined || v === '' || isNaN(+v) ? null : +v);
export const hasGps = (o) => num(o?.lat) !== null && num(o?.lng) !== null;

// Lien Google Maps (recherche ou point exact)
export function mapsLink(o) {
  if (hasGps(o)) return `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`;
  if (o?.maps_url) return o.maps_url;
  const q = [o?.adresse, o?.repere].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + ', ' + CITY)}` : null;
}
// Itinéraire (pour le livreur)
export function directionsLink(o) {
  if (hasGps(o)) return `https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=driving`;
  if (o?.maps_url) return o.maps_url;
  const q = [o?.adresse, o?.repere].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q + ', ' + CITY)}&travelmode=driving` : null;
}

// Maka ny lat/lng avy amin'ny lien Google Maps na "-18.91, 47.52"
export function parseCoords(text) {
  const t = decodeURIComponent(String(text || ''));
  const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /^\s*(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*$/];
  for (const p of pats) {
    const m = t.match(p);
    if (m) {
      const lat = +m[1]; const lng = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    }
  }
  return null;
}

// Bokotra kely: "Carte" sy "Itinéraire"
export function MapLinks({ o, small = true }) {
  const m = mapsLink(o);
  if (!m) return null;
  const cls = 'btn ' + (small ? 'small' : '');
  return html`<span class="row gap wrap map-links" onClick=${(e) => e.stopPropagation()}>
    <a class=${cls} href=${m} target="_blank" rel="noopener">📍 ${tr('Carte', 'Map', 'Sarintany')}</a>
    <a class=${cls} href=${directionsLink(o)} target="_blank" rel="noopener">🧭 ${tr('Itinéraire', 'Directions', 'Lalana')}</a>
  </span>`;
}

// Saha feno: adiresy, repère, GPS (tsy voatery)
export function AddressField({ value, onChange }) {
  const { toast } = useApp();
  const v = value || {};
  const [paste, setPaste] = useState('');
  const [locating, setLocating] = useState(false);
  const set = (patch) => onChange({ ...v, ...patch });
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([v.adresse, v.repere].filter(Boolean).join(', ') + ', ' + CITY)}`;

  function applyPaste(text) {
    setPaste(text);
    const c = parseCoords(text);
    if (c) { set({ ...c, maps_url: /^https?:/.test(text.trim()) ? text.trim() : v.maps_url }); toast(tr('Position enregistrée', 'Location saved', 'Voaray ny toerana')); setPaste(''); }
    else if (/^https?:\/\//.test(text.trim())) { set({ maps_url: text.trim() }); toast(tr('Lien enregistré (ouvrez-le puis copiez les coordonnées pour plus de précision)', 'Link saved (open it and copy the coordinates for more precision)', 'Voaray ny lien')); setPaste(''); }
  }
  function here() {
    if (!navigator.geolocation) { toast(tr('Localisation non disponible', 'Location not available', 'Tsy azo ny toerana'), 'bad'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { set({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }); setLocating(false); toast(tr(`Position prise (précision ~${Math.round(p.coords.accuracy)} m)`, `Location captured (~${Math.round(p.coords.accuracy)} m)`, `Voaray ny toerana (~${Math.round(p.coords.accuracy)} m)`)); },
      (e) => { setLocating(false); toast(tr('Localisation refusée ou impossible : ', 'Location denied or failed: ', 'Tsy nety: ') + e.message, 'bad'); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return html`<div class="address-field wide">
    <label class="field"><span class="field-label">${tr('Adresse de livraison', 'Delivery address', 'Adiresy hanaterana')}</span>
      <input value=${v.adresse || ''} placeholder=${tr('Ex. Lot II M 45 Ambohijatovo', 'E.g. Lot II M 45 Ambohijatovo', 'Ohatra: Lot II M 45 Ambohijatovo')} onInput=${(e) => set({ adresse: e.target.value })} /></label>
    <label class="field"><span class="field-label">${tr('Repère (facultatif)', 'Landmark (optional)', 'Marika (tsy voatery)')}</span>
      <input value=${v.repere || ''} placeholder=${tr('Ex. portail vert en face de la pharmacie, 2e étage', 'E.g. green gate opposite the pharmacy, 2nd floor', 'Ohatra: vavahady maitso tandrifin\'ny fivarotam-panafody, rihana faha-2')} onInput=${(e) => set({ repere: e.target.value })} /></label>

    <div class="gps-box">
      <div class="row gap wrap between">
        <b class="small">${tr('Position exacte sur la carte (facultatif)', 'Exact location on the map (optional)', 'Toerana marina amin\'ny sarintany (tsy voatery)')}</b>
        ${hasGps(v) ? html`<span class="badge ok">GPS ✓ ${v.lat}, ${v.lng}</span>` : v.maps_url ? html`<span class="badge muted">${tr('lien Maps', 'Maps link', 'lien Maps')}</span>` : html`<span class="badge muted">${tr('non renseignée', 'not set', 'tsy misy')}</span>`}
      </div>
      <div class="row gap wrap">
        <a class="btn small" href=${searchUrl} target="_blank" rel="noopener">🔎 ${tr('Chercher sur Google Maps', 'Search on Google Maps', 'Karohy ao amin\'ny Google Maps')}</a>
        <button type="button" class="btn small" disabled=${locating} onClick=${here}>📡 ${locating ? tr('Localisation…', 'Locating…', 'Mitady…') : tr('Ma position actuelle', 'My current location', 'Ny toerako izao')}</button>
        ${(hasGps(v) || v.maps_url) && html`<${MapLinks} o=${v} />`}
        ${(hasGps(v) || v.maps_url) && html`<button type="button" class="btn small ghost danger" onClick=${() => set({ lat: null, lng: null, maps_url: null })}>✕</button>`}
      </div>
      <input class="small-input" value=${paste} placeholder=${tr('Collez ici le lien Google Maps ou les coordonnées (ex. -18.9137, 47.5361)', 'Paste the Google Maps link or coordinates here (e.g. -18.9137, 47.5361)', 'Apetaho eto ny lien Google Maps na ny coordonnées (ohatra: -18.9137, 47.5361)')}
        onInput=${(e) => setPaste(e.target.value)} onPaste=${(e) => setTimeout(() => applyPaste(e.target.value), 0)} onKeyDown=${(e) => { if (e.key === 'Enter') applyPaste(paste); }} onBlur=${() => paste && applyPaste(paste)} />
      <p class="hint">${tr('Astuce : dans Google Maps, appuyez longuement sur le point exact → les coordonnées s\'affichent en haut → copiez-les et collez-les ici. Ou, chez le client, touchez « Ma position actuelle ».', 'Tip: in Google Maps, long-press the exact spot → coordinates appear at the top → copy and paste them here. Or, at the customer\'s place, tap "My current location".', 'Torohevitra: ao amin\'ny Google Maps, tsindrio ela ny toerana marina → miseho eo ambony ny coordonnées → adikao dia apetaho eto. Na, rehefa any amin\'ny client, tsindrio "Ny toerako izao".')}</p>
      ${hasGps(v) && html`<iframe class="map-preview" title="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src=${`https://maps.google.com/maps?q=${v.lat},${v.lng}&z=17&output=embed`}></iframe>`}
    </div>
  </div>`;
}
