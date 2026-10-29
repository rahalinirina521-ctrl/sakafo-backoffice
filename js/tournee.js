// Tournée de livraison : ETA de chaque arrêt à partir de la position actuelle (ou de la cuisine).
import { route, hasPos } from './map.js?v=202610291427';

// depart {lat,lng} ; stops : livraisons ordonnées (non livrées) → { etas: Map(id → {eta: Date, cumul_s, distance_m}), line, total }
export async function calculerEtas(depart, stops, { trafic = 1.6, arret_min = 4, maintenant = new Date() } = {}) {
  const pts = [depart, ...stops.filter(hasPos)];
  const r = await route(pts, trafic);
  const etas = new Map();
  let cumul = 0; let dist = 0;
  stops.filter(hasPos).forEach((s, i) => {
    const leg = r.legs[i] || { duration: 0, distance: 0 };
    cumul += leg.duration + (i > 0 ? arret_min * 60 : 0);
    dist += leg.distance;
    etas.set(s.id, { eta: new Date(maintenant.getTime() + cumul * 1000), cumul_s: cumul, distance_m: dist, leg_s: leg.duration, leg_m: leg.distance });
  });
  return { etas, line: r.coords, total_s: cumul, total_m: dist, approx: r.approx };
}

export const STATUTS = {
  prevue: ['Prévue', 'Planned', 'Voalahatra', 'muted'],
  en_route: ['En route', 'On the way', 'Eny an-dalana', 'info'],
  livree: ['Livrée', 'Delivered', 'Tonga', 'ok'],
  echec: ['Échec', 'Failed', 'Tsy tontosa', 'bad'],
  annulee: ['Annulée', 'Cancelled', 'Nofoanana', 'muted'],
};
export const CRENEAU_LABEL = { matin: ['Matin', 'Morning', 'Maraina'], midi: ['Midi', 'Noon', 'Atoandro'], soir: ['Soir', 'Evening', 'Hariva'] };
export const COULEURS = ['#2e7d32', '#1565c0', '#c62828', '#6a1b9a', '#ef6c00', '#00838f', '#ad1457', '#4e342e'];
