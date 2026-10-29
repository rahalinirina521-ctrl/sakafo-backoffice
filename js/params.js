// Paramètres généraux (stockés dans la table options, type « param »)
export const PARAM_DEFAULTS = {
  depot: { lat: -18.9137, lng: 47.5361, adresse: 'Cuisine Sakafo — Antananarivo' },
  trafic: 1.6,          // multiplicateur des temps OSRM (embouteillages)
  arret_min: 4,         // minutes passées à chaque livraison
  departs: { matin: '06:30', midi: '11:00', soir: '17:30' },
  telephone: '',
  whatsapp: '',
  message_accueil: '',
  vapid_public: 'BDfFJZ9V5J43Ff3iZIJXSK8GSJRbn242jHSlRebXazd76g4wbYoqXz-fK363Ks_D9sgwIqxVZrwFlGrkVMn6udA',
};
export function param(data, k) {
  const row = (data?.options || []).find((o) => o.id === 'param:' + k);
  if (!row) return PARAM_DEFAULTS[k];
  try { return JSON.parse(row.valeur); } catch (e) { return PARAM_DEFAULTS[k]; }
}
export const paramRow = (k, v) => ({ id: 'param:' + k, type: 'param', valeur: JSON.stringify(v), base: null, facteur: null, ordre: 0 });
