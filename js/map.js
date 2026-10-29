// Cartes (Leaflet + OpenStreetMap) et itinéraires (OSRM) — gratuits, sans clé.
// OSRM ne connaît pas les embouteillages : on applique un « facteur trafic » (Antananarivo ≈ ×1,6 par défaut).
import { html, useEffect, useRef } from './lib.js?v=202610291512';
import { useThemeSombre, isDark } from './theme.js?v=202610291512';
// Fonds de carte modernes (CARTO, gratuits) : clair « Voyager » / sombre « Dark Matter »
const tuiles = (d) => (d ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
// Texte sûr pour les bulles de la carte (pas d'injection HTML)
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
const OSRM = 'https://router.project-osrm.org';
export const TANA = [-18.8792, 47.5079];

let leafletP = null;
export function loadLeaflet() {
  if (globalThis.L && globalThis.L.map) return Promise.resolve(globalThis.L);
  if (!leafletP) {
    leafletP = new Promise((ok, ko) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = LEAFLET_JS; s.onload = () => ok(globalThis.L); s.onerror = () => { leafletP = null; ko(new Error('Leaflet')); };
      document.head.appendChild(s);
    });
  }
  return leafletP;
}

// ---------- Géométrie ----------
export const hasPos = (o) => o && Number.isFinite(+o.lat) && Number.isFinite(+o.lng) && o.lat !== null && o.lng !== null && o.lat !== '' && o.lng !== '';
export function haversine(a, b) {
  const R = 6371000; const r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat); const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const VITESSE_URBAINE = 18 / 3.6; // m/s (≈ 18 km/h à Tana, trafic inclus) pour l'estimation sans OSRM
const ligne = (pts) => pts.map((p) => [+p.lat, +p.lng]);
const coordStr = (pts) => pts.map((p) => `${(+p.lng).toFixed(6)},${(+p.lat).toFixed(6)}`).join(';');

async function osrm(path, timeout = 9000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(OSRM + path, { signal: ctl.signal });
    if (!r.ok) throw new Error('OSRM ' + r.status);
    const j = await r.json();
    if (j.code !== 'Ok') throw new Error('OSRM ' + j.code);
    return j;
  } finally { clearTimeout(tm); }
}

// Itinéraire passant par les points dans l'ordre → { coords, distance (m), duration (s, trafic inclus), legs:[{distance,duration}], approx }
export async function route(points, trafic = 1.6) {
  const pts = points.filter(hasPos);
  if (pts.length < 2) return { coords: ligne(pts), distance: 0, duration: 0, legs: [], approx: true };
  try {
    const j = await osrm(`/route/v1/driving/${coordStr(pts)}?overview=full&geometries=geojson&steps=false`);
    const R = j.routes[0];
    return { coords: R.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distance: R.distance, duration: R.duration * trafic, legs: R.legs.map((l) => ({ distance: l.distance, duration: l.duration * trafic })), approx: false };
  } catch (e) {
    const legs = pts.slice(1).map((p, i) => { const d = haversine(pts[i], p) * 1.35; return { distance: d, duration: d / VITESSE_URBAINE }; });
    return { coords: ligne(pts), distance: legs.reduce((a, l) => a + l.distance, 0), duration: legs.reduce((a, l) => a + l.duration, 0), legs, approx: true };
  }
}

// Ordre optimal des arrêts depuis un point de départ (OSRM trip, sinon plus proche voisin + 2-opt)
// start : {lat,lng} ; stops : [{id, lat, lng}] → ids dans l'ordre
export async function optimiser(start, stops) {
  const ok = stops.filter(hasPos); const sans = stops.filter((s) => !hasPos(s));
  if (ok.length <= 1) return [...ok, ...sans].map((s) => s.id);
  if (ok.length <= 90) {
    try {
      const j = await osrm(`/trip/v1/driving/${coordStr([start, ...ok])}?source=first&roundtrip=false&overview=false`);
      const order = j.waypoints.slice(1).map((w, i) => ({ id: ok[i].id, k: w.waypoint_index })).sort((a, b) => a.k - b.k).map((x) => x.id);
      return [...order, ...sans.map((s) => s.id)];
    } catch (e) { /* repli local */ }
  }
  // plus proche voisin
  let cur = start; const rest = [...ok]; const res = [];
  while (rest.length) {
    let bi = 0; let bd = Infinity;
    rest.forEach((s, i) => { const d = haversine(cur, s); if (d < bd) { bd = d; bi = i; } });
    cur = rest.splice(bi, 1)[0]; res.push(cur);
  }
  // 2-opt
  const dist = (a, b) => haversine(a, b);
  let better = true; let guard = 0;
  while (better && guard++ < 50) {
    better = false;
    for (let i = 0; i < res.length - 1; i++) for (let k = i + 1; k < res.length; k++) {
      const a = i === 0 ? start : res[i - 1]; const b = res[i]; const c = res[k]; const d = res[k + 1];
      const avant = dist(a, b) + (d ? dist(c, d) : 0); const apres = dist(a, c) + (d ? dist(b, d) : 0);
      if (apres + 1 < avant) { res.splice(i, k - i + 1, ...res.slice(i, k + 1).reverse()); better = true; }
    }
  }
  return [...res.map((s) => s.id), ...sans.map((s) => s.id)];
}

// Lien de navigation Google Maps (jusqu'à 9 étapes)
export function googleNav(origin, stops) {
  const s = stops.filter(hasPos);
  if (!s.length) return null;
  const dest = s[s.length - 1]; const way = s.slice(0, -1).slice(0, 9);
  const q = new URLSearchParams({ api: '1', destination: `${dest.lat},${dest.lng}`, travelmode: 'driving' });
  if (origin && hasPos(origin)) q.set('origin', `${origin.lat},${origin.lng}`);
  if (way.length) q.set('waypoints', way.map((p) => `${p.lat},${p.lng}`).join('|'));
  return 'https://www.google.com/maps/dir/?' + q.toString();
}

export const fmtDuree = (s) => { if (s === null || s === undefined || isNaN(s)) return '—'; const m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
export const fmtDist = (m) => (m === null || m === undefined || isNaN(m) ? '—' : m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km');
export const heure = (d) => (d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');

// ---------- Composant carte ----------
// markers : [{id, lat, lng, label, color, popup, icon:'moto'|'home'|'kitchen'|'num'}]
// route : [[lat,lng],...]  ; fit : recadrer sur les marqueurs ; onPick({lat,lng}) : clic pour placer
export function MapView({ markers = [], line = null, fitKey = '', onPick, height = 320, center = TANA, zoom = 13, className = '' }) {
  const box = useRef(null); const st = useRef({});
  const sombre = useThemeSombre();
  useEffect(() => { if (st.current.tiles) st.current.tiles.setUrl(tuiles(sombre)); }, [sombre]);
  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !box.current || st.current.map) return;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(center, zoom);
      const tiles = L.tileLayer(tuiles(isDark()), { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(map);
      st.current = { tiles, L, map, layer: L.layerGroup().addTo(map), lineLayer: null, fitted: null };
      if (onPick) map.on('click', (e) => st.current.onPick && st.current.onPick({ lat: e.latlng.lat, lng: e.latlng.lng }));
      setTimeout(() => map.invalidateSize(), 200);
      draw();
    }).catch(() => { if (box.current) box.current.innerHTML = '<div class="map-off">Carte indisponible (connexion)</div>'; });
    return () => { dead = true; if (st.current.map) { st.current.map.remove(); st.current = {}; } };
  }, []);
  st.current.onPick = onPick;
  function icon(L, m) {
    const cls = 'mk mk-' + (m.icon || 'num');
    const inner = m.icon === 'moto' ? '🛵' : m.icon === 'home' ? '🏠' : m.icon === 'kitchen' ? '🍳' : m.icon === 'me' ? '' : esc(m.label ?? '');
    return L.divIcon({ className: '', html: `<div class="${cls}" style="${m.color && /^#[0-9a-f]{3,8}$/i.test(m.color) ? `--mk:${m.color}` : ''}">${inner}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
  }
  function draw() {
    const { L, map, layer } = st.current; if (!map) return;
    layer.clearLayers();
    const pts = [];
    for (const m of markers.filter(hasPos)) {
      const mk = L.marker([+m.lat, +m.lng], { icon: icon(L, m), zIndexOffset: m.icon === 'moto' ? 1000 : 0 });
      if (m.popup) mk.bindPopup(esc(m.popup).replace(/\n/g, '<br>')); // texte brut : aucune injection HTML possible
      mk.addTo(layer); pts.push([+m.lat, +m.lng]);
    }
    if (st.current.lineLayer) { st.current.lineLayer.remove(); st.current.lineLayer = null; }
    if (line && line.length > 1) st.current.lineLayer = L.polyline(line, { color: '#2e7d32', weight: 5, opacity: 0.75 }).addTo(map);
    if (st.current.fitted !== fitKey) {
      st.current.fitted = fitKey;
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 16 });
      else if (pts.length === 1) map.setView(pts[0], 15);
    }
  }
  useEffect(draw);
  return html`<div class=${'mapview ' + className} ref=${box} style=${{ height: typeof height === 'number' ? height + 'px' : height }}></div>`;
}
