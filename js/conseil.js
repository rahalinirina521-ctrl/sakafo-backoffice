// Moteur de conseil « semi-IA » (règles nutritionnelles publiées, sans IA payante).
// Il analyse le profil et l'objectif d'un client : faisabilité, kcal/jour, macros, prévision, alertes médicales.
// Ce n'est pas un avis médical : il oriente vers un professionnel dès qu'une situation le demande.
import { tr, getLang } from './i18n.js?v=202610290636';
import { ACTIVITES, toNum, isoDate, addDays } from './calc.js?v=202610290636';

const n = toNum;
const KCAL_PAR_KG = 7700; // énergie approx. d'1 kg de masse grasse
const r10 = (x) => Math.round(x / 10) * 10;
const r1 = (x) => Math.round(x * 10) / 10;
const f1 = (x) => r1(x).toLocaleString('fr-FR');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const fmtDate = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString({ fr: 'fr-FR', en: 'en-GB', mg: 'fr-FR' }[getLang()] || 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const kg = (x) => r1(x).toLocaleString('fr-FR') + ' kg';
const today = () => isoDate(new Date());
const weeksBetween = (a, b) => (new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / (7 * 864e5);

// ---------- Types d'objectifs et champs à demander ----------
const L = (fr, en, mg) => [fr, en, mg];
export const ACTIVITE_LABELS = {
  sedentaire: L('Sédentaire (bureau, peu de marche)', 'Sedentary', 'Tsy dia mihetsika'),
  leger: L('Légère (marche, 1-3 séances/sem.)', 'Light (1-3 sessions/wk)', 'Kely (fanatanjahantena 1-3/herinandro)'),
  modere: L('Modérée (3-5 séances/sem.)', 'Moderate (3-5 sessions/wk)', 'Antonony (3-5/herinandro)'),
  intense: L('Intense (travail physique, sport quotidien)', 'Intense (physical job, daily sport)', 'Mafy (asa mavesatra, fanatanjahantena isan\'andro)'),
};
const F = {
  poids_cible: { k: 'poids_cible', type: 'number', unit: 'kg', label: L('Poids souhaité', 'Target weight', 'Lanja irina') },
  date_cible: { k: 'date_cible', type: 'date', label: L('Pour quand ? (souhait)', 'By when? (wish)', 'Hatramin\'ny oviana? (faniriana)') },
  dpa: { k: 'dpa', type: 'date', label: L('Date prévue d\'accouchement (DPA)', 'Due date', 'Daty andrasana hiterahana (DPA)') },
  poids_avant: { k: 'poids_avant', type: 'number', unit: 'kg', label: L('Poids avant la grossesse', 'Pre-pregnancy weight', 'Lanja talohan\'ny fitondrana vohoka') },
  jumeaux: { k: 'jumeaux', type: 'bool', label: L('Grossesse gémellaire (jumeaux)', 'Twin pregnancy', 'Kambana') },
  naissance_bebe: { k: 'naissance_bebe', type: 'date', label: L('Date de naissance du bébé', 'Baby\'s birth date', 'Daty nahaterahan\'ny zaza') },
  exclusif: { k: 'exclusif', type: 'bool', label: L('Allaitement exclusif', 'Exclusive breastfeeding', 'Mampinono fotsiny (tsy misy ronono hafa)') },
  type_diabete: { k: 'type_diabete', type: 'select', label: L('Type de diabète', 'Diabetes type', 'Karazana diabeta'), options: [['2', L('Type 2', 'Type 2', 'Karazany 2')], ['1', L('Type 1', 'Type 1', 'Karazany 1')], ['pre', L('Prédiabète', 'Prediabetes', 'Efa akaiky diabeta')], ['gesta', L('Diabète de grossesse', 'Gestational', 'Diabeta mandritra ny fitondrana vohoka')]] },
  traitement: { k: 'traitement', type: 'select', label: L('Traitement', 'Treatment', 'Fitsaboana'), options: [['aucun', L('Aucun', 'None', 'Tsy misy')], ['comprimes', L('Comprimés', 'Tablets', 'Fanafody vongany')], ['insuline', L('Insuline', 'Insulin', 'Insuline')]] },
  hba1c: { k: 'hba1c', type: 'number', unit: '%', label: L('Dernière HbA1c (si connue)', 'Last HbA1c (if known)', 'HbA1c farany (raha fantatra)') },
  tension: { k: 'tension', type: 'text', placeholder: '140/90', label: L('Dernière tension (ex. 140/90)', 'Last blood pressure (e.g. 140/90)', 'Tosidra farany (ohatra 140/90)') },
  ldl: { k: 'ldl', type: 'number', unit: 'g/L', label: L('LDL-cholestérol (si connu)', 'LDL cholesterol (if known)', 'LDL (raha fantatra)') },
  hemoglobine: { k: 'hemoglobine', type: 'number', unit: 'g/dL', label: L('Hémoglobine (si connue)', 'Haemoglobin (if known)', 'Hémoglobine (raha fantatra)') },
  seances: { k: 'seances', type: 'number', unit: '/sem.', label: L('Séances de musculation par semaine', 'Strength sessions per week', 'Fanazaran-tena isan-kerinandro') },
};
export const OBJECTIF_TYPES = {
  perte: { label: L('Perte de poids', 'Weight loss', 'Fihenan\'ny lanja'), champs: [F.poids_cible, F.date_cible] },
  prise: { label: L('Prise de poids', 'Weight gain', 'Fitomboan\'ny lanja'), champs: [F.poids_cible, F.date_cible] },
  masse: { label: L('Prise de muscle', 'Muscle gain', 'Hozatra'), champs: [F.poids_cible, F.date_cible, F.seances] },
  diabete: { label: L('Diabète', 'Diabetes', 'Diabeta'), champs: [F.type_diabete, F.traitement, F.hba1c, F.poids_cible] },
  grossesse: { label: L('Grossesse', 'Pregnancy', 'Bevohoka'), champs: [F.dpa, F.poids_avant, F.jumeaux] },
  allaitement: { label: L('Allaitement', 'Breastfeeding', 'Mampinono'), champs: [F.naissance_bebe, F.exclusif, F.poids_cible] },
  hta: { label: L('Tension artérielle', 'Blood pressure', 'Tosidra'), champs: [F.tension, F.traitement, F.poids_cible] },
  cholesterol: { label: L('Cholestérol', 'Cholesterol', 'Kolesterola'), champs: [F.ldl, F.poids_cible] },
  senior: { label: L('Senior', 'Senior', 'Zokiolona'), champs: [F.poids_cible] },
  anemie: { label: L('Anémie', 'Anaemia', 'Tsy fahampian-dra'), champs: [F.hemoglobine] },
  budget: { label: L('Économique', 'Budget', 'Mora'), champs: [F.poids_cible, F.date_cible] },
  normal: { label: L('Équilibré', 'Balanced', 'Voalanjalanja'), champs: [F.poids_cible, F.date_cible] },
};
export const typeLabel = (t) => (OBJECTIF_TYPES[t] ? tr(...OBJECTIF_TYPES[t].label) : t || '—');
export const champsPour = (type) => OBJECTIF_TYPES[type]?.champs || OBJECTIF_TYPES.normal.champs;
// Devine le type d'un objectif à partir de son id/nom (objectifs ajoutés par l'admin)
export function typeObjectif(cat) {
  if (!cat) return 'normal';
  if (cat.type && OBJECTIF_TYPES[cat.type]) return cat.type;
  const s = (cat.id + ' ' + (cat.nom || '')).toLowerCase();
  for (const [re, t] of [[/perte|mincir|maigr/, 'perte'], [/muscl|masse/, 'masse'], [/prise|gross?ir/, 'prise'], [/diab/, 'diabete'], [/grossesse|enceinte|vohoka/, 'grossesse'], [/allait/, 'allaitement'], [/tension|hta|hyperten/, 'hta'], [/chol/, 'cholesterol'], [/senior|ag[eé]/, 'senior'], [/an[eé]mi|fer\b/, 'anemie'], [/eco|budget/, 'budget']]) if (re.test(s)) return t;
  return 'normal';
}

// ---------- Profil ----------
export function ageDe(p) {
  if (n(p.age)) return n(p.age);
  if (p.date_naissance) { const d = new Date(p.date_naissance); if (!isNaN(d)) return Math.floor((Date.now() - d) / (365.25 * 864e5)); }
  return null;
}
export function imc(poids, taille) { return n(poids) && n(taille) ? n(poids) / ((n(taille) / 100) ** 2) : null; }
export function imcLabel(v, age) {
  if (!v) return { label: '—', tone: 'muted' };
  if (age >= 70 && v < 22) return { label: tr('Risque de dénutrition', 'Risk of undernutrition', 'Mety ho tsy ampy sakafo'), tone: 'warn' };
  if (v < 18.5) return { label: tr('Insuffisance pondérale', 'Underweight', 'Mahia loatra'), tone: 'warn' };
  if (v < 25) return { label: tr('Poids normal', 'Healthy weight', 'Lanja ara-dalàna'), tone: 'ok' };
  if (v < 30) return { label: tr('Surpoids', 'Overweight', 'Somary matavy'), tone: 'warn' };
  if (v < 35) return { label: tr('Obésité modérée', 'Obesity class I', 'Matavy loatra (1)'), tone: 'bad' };
  if (v < 40) return { label: tr('Obésité sévère', 'Obesity class II', 'Matavy loatra (2)'), tone: 'bad' };
  return { label: tr('Obésité massive', 'Obesity class III', 'Matavy loatra (3)'), tone: 'bad' };
}
const poidsPourImc = (b, taille) => b * (n(taille) / 100) ** 2;
export function bmr({ sexe, poids, taille }, age) {
  if (!n(poids) || !n(taille) || !age) return null;
  return 10 * n(poids) + 6.25 * n(taille) - 5 * age + (sexe === 'H' ? 5 : -161);
}
const facteur = (a) => (ACTIVITES.find((x) => x[0] === a) || ACTIVITES[0])[1];
const plancher = (sexe) => (sexe === 'H' ? 1500 : 1200);

// ---------- Analyse ----------
// profil : { sexe, age|date_naissance, taille, poids, activite, ...champs du type }
// mesures : [{date, poids}] (historique, facultatif)
export function analyse(profil = {}, type = 'normal', mesures = []) {
  const p = { ...profil };
  const age = ageDe(p);
  const out = { type, age, ok: false, conseils: [], alertes: [], manque: [], verdict: null, prevision: null, macros: null };
  const histo = (mesures || []).filter((m) => n(m.poids) && m.date).sort((a, b) => a.date.localeCompare(b.date));
  if (histo.length && !n(p.poids)) p.poids = histo[histo.length - 1].poids;
  for (const [k, l] of [['sexe', L('Sexe', 'Sex', 'Lahy/vavy')], ['taille', L('Taille', 'Height', 'Halava')], ['poids', L('Poids actuel', 'Current weight', 'Lanja ankehitriny')]]) if (!p[k]) out.manque.push(tr(...l));
  if (!age) out.manque.push(tr('Âge', 'Age', 'Taona'));
  if (out.manque.length) return out;
  if (age < 18) {
    out.verdict = { niveau: 'medical', titre: tr('Moins de 18 ans', 'Under 18', 'Latsaky ny 18 taona'), texte: tr('Pour un enfant ou un adolescent, les besoins dépendent de la croissance : pas de régime sans un médecin ou un nutritionniste. Nous proposons des repas équilibrés uniquement.', 'For children and teenagers, needs depend on growth: no diet without a doctor or dietitian. We only offer balanced meals.', 'Ho an\'ny ankizy sy tanora, miankina amin\'ny fitomboana ny filàna: tsy misy régime raha tsy misy dokotera. Sakafo voalanjalanja ihany no atolotray.') };
  }

  const poids = n(p.poids); const taille = n(p.taille);
  const B = bmr(p, age);
  const tdee = B * facteur(p.activite);
  const I = imc(poids, taille);
  Object.assign(out, { ok: true, bmr: r10(B), tdee: r10(tdee), imc: r1(I), imcInfo: imcLabel(I, age), poidsSain: [r1(poidsPourImc(18.5, taille)), r1(poidsPourImc(24.9, taille))] });
  const cible = n(p.poids_cible);
  const dateCible = p.date_cible && p.date_cible > today() ? p.date_cible : null;
  let kcal = tdee; let protKg = 1.0; let lipPct = 0.3; let gluPct = null; let sodium = 2000; let fibres = null;

  // ---- objectifs de poids (perte / prise / masse) ----
  const objPoids = (sens) => {
    const ecart = sens === 'perte' ? poids - cible : cible - poids;
    if (!cible || ecart <= 0) return null;
    const capAllait = type === 'allaitement' && sens === 'perte' ? 0.5 : 9;
    const rateMax = Math.min(capAllait, sens === 'perte' ? Math.min(1, poids * 0.01) : sens === 'masse' ? poids * 0.005 : 0.5);
    const rateReco = Math.min(capAllait, sens === 'perte' ? Math.min(0.75, poids * 0.0075) : sens === 'masse' ? poids * 0.0025 : 0.35);
    const semDispo = dateCible ? weeksBetween(today(), dateCible) : null;
    const rateDemande = semDispo ? ecart / semDispo : null;
    let rate = rateReco; let niveau = 'ok';
    if (rateDemande) {
      if (rateDemande <= rateMax) rate = Math.max(rateDemande, sens === 'perte' ? 0.25 : 0.15);
      else niveau = rateDemande > rateMax * 1.5 ? 'irrealiste' : 'attention';
    }
    const semaines = Math.ceil(ecart / rate);
    const dateReal = addDays(today(), semaines * 7);
    return { ecart, rateMax, rateReco, rateDemande, rate, niveau, semDispo, semaines, dateReal };
  };

  const sens = { perte: 'perte', prise: 'prise', masse: 'masse' }[type] || (cible ? (cible < poids ? 'perte' : cible > poids ? 'prise' : null) : null);
  const peutChangerPoids = !['grossesse'].includes(type);
  const o = peutChangerPoids && sens ? objPoids(sens) : null;
  if (type === 'perte' && cible && cible >= poids) out.alertes.push(tr('Le poids souhaité n\'est pas inférieur au poids actuel.', 'Target weight is not below current weight.', 'Tsy ambany noho ny lanja ankehitriny ny lanja irina.'));

  if (o) {
    const delta = (o.rate * KCAL_PAR_KG) / 7;
    if (sens === 'perte') {
      const deficit = Math.min(delta, 1000, tdee * 0.25);
      kcal = Math.max(tdee - deficit, plancher(p.sexe));
      if (tdee - delta < plancher(p.sexe) && type !== 'allaitement') out.alertes.push(tr(`Les apports ne descendront pas sous ${plancher(p.sexe)} kcal/jour (minimum de sécurité) : l'activité physique fera le reste.`, `Intake will not go below ${plancher(p.sexe)} kcal/day (safety minimum): physical activity will do the rest.`, `Tsy hidina ambanin'ny ${plancher(p.sexe)} kcal isan'andro (fetra azo antoka): ny fanatanjahantena no hanampy.`));
      if (cible < out.poidsSain[0]) out.alertes.push(tr(`Le poids souhaité (${kg(cible)}) est sous le poids santé minimum pour votre taille (${kg(out.poidsSain[0])}). Nous visons au plus bas ${kg(Math.ceil(out.poidsSain[0]))}.`, `Target (${kg(cible)}) is below the healthy minimum for your height (${kg(out.poidsSain[0])}).`, `Ambany noho ny lanja salama farany ambany (${kg(out.poidsSain[0])}) ny lanja irina (${kg(cible)}).`));
      protKg = 1.4;
    } else {
      kcal = tdee + clamp(delta, 250, sens === 'masse' ? 500 : 600);
      protKg = sens === 'masse' ? 1.8 : 1.4;
      if (cible > out.poidsSain[1] && sens === 'prise') out.alertes.push(tr(`Le poids souhaité dépasse le poids santé maximum pour votre taille (${kg(out.poidsSain[1])}).`, `Target exceeds the healthy maximum for your height (${kg(out.poidsSain[1])}).`, `Mihoatra ny lanja salama farany ambony (${kg(out.poidsSain[1])}) ny lanja irina.`));
      if (sens === 'masse' && !(n(p.seances) >= 2)) out.alertes.push(tr('Sans musculation (au moins 2-3 séances/semaine), le surplus de calories devient surtout de la graisse.', 'Without strength training (at least 2-3 sessions/week), extra calories mostly become fat.', 'Raha tsy misy fanazaran-tena (2-3 isan-kerinandro farafahakeliny), tavy no ho lasan\'ny kcal fanampiny.'));
    }
    const objTxt = sens === 'perte' ? tr('perdre', 'lose', 'hampihena') : tr('prendre', 'gain', 'hampitombo');
    const rangeTxt = sens === 'perte' ? `${f1(Math.min(0.5, o.rateReco))}–${f1(o.rateMax)} kg` : sens === 'masse' ? `${f1(poids * 0.0025)}–${f1(poids * 0.005)} kg` : '0,25–0,5 kg';
    if (o.niveau === 'ok') {
      out.verdict = { niveau: 'ok', titre: tr('Objectif réaliste ✅', 'Realistic goal ✅', 'Tanjona azo tanterahina ✅'), texte: tr(
        `${objTxt.charAt(0).toUpperCase() + objTxt.slice(1)} ${kg(o.ecart)} à environ ${f1(o.rate)} kg/semaine : objectif atteint vers le ${fmtDate(o.dateReal)} (≈ ${o.semaines} semaines).`,
        `${objTxt} ${kg(o.ecart)} at about ${f1(o.rate)} kg/week: reached around ${fmtDate(o.dateReal)} (≈ ${o.semaines} weeks).`,
        `${kg(o.ecart)} amin'ny ${f1(o.rate)} kg isan-kerinandro eo ho eo: ho tratra manodidina ny ${fmtDate(o.dateReal)} (≈ ${o.semaines} herinandro).`) };
    } else {
      const sem = f1(o.semDispo);
      out.verdict = { niveau: o.niveau, titre: o.niveau === 'irrealiste' ? tr('Délai irréaliste ⛔', 'Unrealistic timeline ⛔', 'Fotoana tsy azo tanterahina ⛔') : tr('Délai trop ambitieux ⚠️', 'Timeline too ambitious ⚠️', 'Fotoana fohy loatra ⚠️'),
        texte: tr(
          `${objTxt.charAt(0).toUpperCase() + objTxt.slice(1)} ${kg(o.ecart)} en ${sem} semaines demanderait ${f1(o.rateDemande)} kg/semaine. Le rythme sûr et durable est de ${rangeTxt} par semaine${sens === 'perte' ? ' : au-delà, on perd du muscle, on risque fatigue, carences, calculs biliaires et reprise rapide du poids (effet yo-yo)' : ''}. Date réaliste : ${fmtDate(o.dateReal)} (≈ ${o.semaines} semaines). Premier palier conseillé : ${sens === 'perte' ? '-' : '+'}${kg(Math.min(o.ecart, o.rateReco * 4.3))} le premier mois.`,
          `${objTxt} ${kg(o.ecart)} in ${sem} weeks would require ${f1(o.rateDemande)} kg/week. A safe, lasting pace is ${rangeTxt} per week. Realistic date: ${fmtDate(o.dateReal)} (≈ ${o.semaines} weeks). First milestone: ${kg(Math.min(o.ecart, o.rateReco * 4.3))} in the first month.`,
          `${kg(o.ecart)} ao anatin'ny herinandro ${sem} dia mitaky ${f1(o.rateDemande)} kg isan-kerinandro. Ny haingana azo antoka sy maharitra dia ${rangeTxt} isan-kerinandro${sens === 'perte' ? ': raha mihoatra, very ny hozatra, reraka, tsy ampy otrikaina ary miverina haingana ny lanja (yo-yo)' : ''}. Daty azo tanterahina: ${fmtDate(o.dateReal)} (≈ herinandro ${o.semaines}). Dingana voalohany: ${kg(Math.min(o.ecart, o.rateReco * 4.3))} amin'ny volana voalohany.`) };
    }
    out.prevision = { depart: poids, cible, rate: o.rate * (sens === 'perte' ? -1 : 1), semaines: o.semaines, date: o.dateReal };
    if (sens === 'perte') out.conseils.push(tr('Les 1 à 2 premières semaines, la balance baisse souvent plus vite (eau) puis ralentit : c\'est normal.', 'The first 1-2 weeks the scale often drops faster (water), then slows: that\'s normal.', 'Amin\'ny herinandro 1-2 voalohany, mety hidina haingana kokoa ny lanja (rano) dia miadana avy eo: ara-dalàna izany.'));
    if (sens === 'perte' && I >= 30) out.conseils.push(tr('Perdre déjà 5 à 10 % de son poids améliore nettement la tension, la glycémie et le cholestérol.', 'Losing just 5-10% of body weight clearly improves blood pressure, glucose and cholesterol.', 'Ny fihenan\'ny lanja 5-10 % fotsiny dia efa manatsara ny tosidra, ny siramamy ary ny kolesterola.'));
  } else if (!['grossesse', 'allaitement'].includes(type)) {
    out.verdict = { niveau: 'ok', titre: tr('Maintien du poids', 'Weight maintenance', 'Fitazonana ny lanja'), texte: tr(`Environ ${r10(kcal)} kcal/jour pour garder un poids stable.`, `About ${r10(kcal)} kcal/day to keep a stable weight.`, `Eo amin'ny ${r10(kcal)} kcal isan'andro mba hitazona ny lanja.`) };
  }

  // ---- règles spécifiques ----
  if (type === 'diabete') {
    gluPct = 0.42; fibres = 30; protKg = Math.max(protKg, 1.1);
    out.conseils.push(tr('Glucides à index glycémique bas, répartis sur les 3 repas (même quantité chaque jour), légumes à chaque repas, pas de boissons sucrées.', 'Low-GI carbs spread over 3 meals (same amount daily), vegetables at every meal, no sugary drinks.', 'Gliosida ambany IG, zaraina amin\'ny sakafo 3 (mitovy isan\'andro), legioma isaky ny sakafo, tsy misy zava-pisotro misy siramamy.'));
    if (I >= 25) out.conseils.push(tr('En cas de surpoids, perdre 5 à 7 % du poids améliore fortement la glycémie.', 'If overweight, losing 5-7% of weight greatly improves blood sugar.', 'Raha somary matavy, ny fihenan\'ny lanja 5-7 % dia manatsara be ny siramamy anaty ra.'));
    if (p.traitement === 'insuline' || p.type_diabete === '1') out.alertes.push(tr('Sous insuline : ne sautez pas de repas et ajustez les doses avec votre médecin (risque d\'hypoglycémie). Nos repas indiquent les glucides de chaque plat.', 'On insulin: don\'t skip meals and adjust doses with your doctor (hypoglycaemia risk). Our meals show the carbs of each dish.', 'Raha mampiasa insuline: aza mandingana sakafo ary ataovy miaraka amin\'ny dokotera ny fanitsiana (mety hidina ny siramamy). Voasoratra ny gliosida isaky ny sakafo.'));
    if (n(p.hba1c) >= 9) out.alertes.push(tr('HbA1c ≥ 9 % : diabète mal équilibré, consultez rapidement votre médecin.', 'HbA1c ≥ 9%: poorly controlled diabetes, see your doctor soon.', 'HbA1c ≥ 9 %: tsy voafehy ny diabeta, mankanesa any amin\'ny dokotera haingana.'));
    if (p.type_diabete === 'gesta') out.alertes.push(tr('Diabète de grossesse : suivi obligatoire par la sage-femme / le médecin, aucune restriction calorique sans avis.', 'Gestational diabetes: mandatory follow-up, no calorie restriction without advice.', 'Diabeta mandritra ny fitondrana vohoka: tsy maintsy arahin\'ny dokotera.'));
  }
  if (type === 'grossesse') {
    const pre = n(p.poids_avant) || poids;
    const Ipre = imc(pre, taille);
    const restant = p.dpa ? weeksBetween(today(), p.dpa) : null;
    const sa = restant !== null ? clamp(40 - restant, 0, 42) : null;
    const tri = sa === null ? null : sa < 14 ? 1 : sa < 28 ? 2 : 3;
    // IOM 2009 : prise totale recommandée selon l'IMC avant grossesse (singleton / jumeaux) et rythme T2-T3
    const tab = Ipre < 18.5 ? [12.5, 18, 0.44, 0.58, null] : Ipre < 25 ? [11.5, 16, 0.35, 0.5, [17, 25]] : Ipre < 30 ? [7, 11.5, 0.23, 0.33, [14, 23]] : [5, 9, 0.17, 0.27, [11, 19]];
    const total = p.jumeaux ? (tab[4] || [17, 25]) : [tab[0], tab[1]];
    kcal = bmr({ ...p, poids: pre }, age) * facteur(p.activite) + (tri === 2 ? 340 : tri === 3 ? 452 : 0) + (p.jumeaux && tri > 1 ? 300 : 0);
    protKg = 1.1; fibres = 28;
    const attendu = sa === null ? null : sa <= 13 ? [0.5 * sa / 13, 2 * sa / 13] : [0.5 + (sa - 13) * tab[2], 2 + (sa - 13) * tab[3]];
    const pris = poids - pre;
    out.grossesse = { sa: sa === null ? null : Math.floor(sa), jours: sa === null ? null : Math.round((sa % 1) * 7), trimestre: tri, imcAvant: r1(Ipre), priseTotale: total, priseAttendue: attendu && attendu.map(r1), prise: r1(pris), dpa: p.dpa };
    if (!p.dpa) out.manque.push(tr('Date prévue d\'accouchement', 'Due date', 'Daty hiterahana'));
    let niv = 'ok'; let txt = '';
    if (attendu && n(p.poids_avant)) {
      if (pris < attendu[0] - 1) { niv = 'attention'; txt = tr('Prise de poids plutôt faible pour ce terme : à signaler à la sage-femme.', 'Weight gain rather low for this stage: tell your midwife.', 'Kely ny fitomboan\'ny lanja amin\'ity fotoana ity: lazao amin\'ny sage-femme.'); }
      else if (pris > attendu[1] + 1) { niv = 'attention'; txt = tr('Prise de poids plutôt rapide pour ce terme : on privilégie légumes, protéines maigres et on limite sucres et fritures (sans régime).', 'Weight gain rather fast for this stage: favour vegetables and lean protein, limit sugar and fried food (no diet).', 'Haingana ny fitomboan\'ny lanja: ampitomboy legioma sy proteinina, ahenao siramamy sy endasina (tsy régime).'); }
      else txt = tr('Prise de poids dans la zone recommandée pour ce terme. 👍', 'Weight gain within the recommended range. 👍', 'Ao anatin\'ny fetra tokony ho izy ny fitomboan\'ny lanja. 👍');
    }
    out.verdict = { niveau: niv === 'ok' ? 'medical' : 'attention', titre: tri ? tr(`${Math.floor(sa)} SA — ${tri}${tri === 1 ? 'er' : 'e'} trimestre`, `Week ${Math.floor(sa)} — trimester ${tri}`, `Herinandro ${Math.floor(sa)} — telovolana faha-${tri}`) : tr('Grossesse', 'Pregnancy', 'Bevohoka'),
      texte: tr(`Pas de régime pendant la grossesse. Prise de poids totale recommandée : ${total[0]} à ${total[1]} kg (IMC avant grossesse ${f1(Ipre)}).${attendu ? ` À ce terme : environ ${f1(attendu[0])} à ${f1(attendu[1])} kg depuis le début (actuellement ${f1(pris)} kg).` : ''} ${txt}`,
        `No dieting during pregnancy. Recommended total gain: ${total[0]}-${total[1]} kg (pre-pregnancy BMI ${f1(Ipre)}).${attendu ? ` At this stage: about ${f1(attendu[0])}-${f1(attendu[1])} kg so far (now ${f1(pris)} kg).` : ''} ${txt}`,
        `Tsy misy régime mandritra ny fitondrana vohoka. Fitomboan\'ny lanja tokony ho izy: ${total[0]} hatramin\'ny ${total[1]} kg (IMC talohan\'ny vohoka ${f1(Ipre)}).${attendu ? ` Amin\'izao fotoana izao: ${f1(attendu[0])}-${f1(attendu[1])} kg eo ho eo (ankehitriny ${f1(pris)} kg).` : ''} ${txt}`) };
    out.conseils.push(tr('Fer, acide folique (folates), calcium et iode : brèdes, légumineuses, poisson bien cuit, œufs bien cuits, laitages pasteurisés.', 'Iron, folate, calcium and iodine: leafy greens, legumes, well-cooked fish and eggs, pasteurised dairy.', 'Fer, folates, calcium, iode: anana, voamaina, trondro sy atody masaka tsara, ronono pasteurisé.'));
    out.alertes.push(tr('Sécurité : viande, poisson et œufs toujours bien cuits, pas de lait cru, pas d\'alcool, café/thé limités (≤ 200 mg de caféine/jour ≈ 2 tasses), pas de foie en grande quantité. Suivi par la sage-femme ou le médecin.', 'Safety: meat, fish and eggs always well cooked, no raw milk, no alcohol, limited coffee/tea (≤ 200 mg caffeine/day), no large amounts of liver. Follow-up by your midwife or doctor.', 'Fiarovana: hena, trondro, atody masaka tsara foana, tsy misy ronono manta, tsy misy toaka, kafe/dite voafetra (≤ 2 kaopy), aza mihinana aty be loatra. Arahin\'ny sage-femme na dokotera.'));
    if (cible && cible < poids) out.alertes.push(tr('Un objectif de perte de poids n\'est pas adapté pendant la grossesse : il est ignoré.', 'Weight-loss goals are not suitable during pregnancy: ignored.', 'Tsy mety ny tanjona hampihena lanja mandritra ny fitondrana vohoka.'));
    out.prevision = null;
  }
  if (type === 'allaitement') {
    const mois = p.naissance_bebe ? (Date.now() - new Date(p.naissance_bebe)) / (30.44 * 864e5) : 0;
    const bonus = mois <= 6 ? 330 : mois <= 12 ? 400 : 0;
    const extra = p.exclusif === false ? Math.round(bonus * 0.6) : bonus;
    kcal = Math.max(kcal + extra, 1800); protKg = Math.max(protKg, 1.3); fibres = 28;
    if (o && sens === 'perte') out.conseils.push(tr('Pendant l\'allaitement, la perte de poids est limitée à 0,5 kg/semaine pour préserver le lait.', 'While breastfeeding, weight loss is limited to 0.5 kg/week to protect milk supply.', 'Mandritra ny fampinonoana, 0,5 kg isan-kerinandro farafahabetsany no fihenan\'ny lanja.'));
    out.conseils.push(tr(`+${extra} kcal/jour pour la production de lait, boire 2 à 3 L d'eau, protéines et calcium à chaque repas, pas d'alcool.`, `+${extra} kcal/day for milk production, drink 2-3 L of water, protein and calcium at every meal, no alcohol.`, `+${extra} kcal isan'andro ho an'ny ronono, misotroa rano 2-3 L, proteinina sy calcium isaky ny sakafo, tsy misy toaka.`));
    if (!out.verdict) out.verdict = { niveau: 'ok', titre: tr('Allaitement', 'Breastfeeding', 'Fampinonoana'), texte: tr(`Environ ${r10(kcal)} kcal/jour.`, `About ${r10(kcal)} kcal/day.`, `Eo amin'ny ${r10(kcal)} kcal isan'andro.`) };
  }
  if (type === 'hta') {
    sodium = 1500; fibres = 30;
    out.conseils.push(tr('Méthode DASH : légumes et fruits à chaque repas, légumineuses, laitages maigres, peu de viande grasse. Pas de cube bouillon, pas de sel à table, peu de sakay sira / achards salés.', 'DASH: vegetables and fruit at every meal, legumes, low-fat dairy, little fatty meat. No stock cubes, no table salt.', 'Fomba DASH: legioma sy voankazo isaky ny sakafo, voamaina, ronono tsy misy tavy. Tsy misy cube, tsy misy sira ambony latabatra, ahenao ny sakay sira sy achards.'));
    const m = /(\d{2,3})\s*[/-]\s*(\d{2,3})/.exec(p.tension || '');
    if (m && (+m[1] >= 180 || +m[2] >= 110)) out.alertes.push(tr('Tension ≥ 180/110 : consultez un médecin rapidement.', 'BP ≥ 180/110: see a doctor promptly.', 'Tosidra ≥ 180/110: mankanesa any amin\'ny dokotera haingana.'));
    else if (m && (+m[1] >= 140 || +m[2] >= 90)) out.conseils.push(tr('Tension élevée : le suivi médical reste indispensable, l\'alimentation vient en complément du traitement.', 'High BP: medical follow-up remains essential; diet complements treatment.', 'Ambony ny tosidra: ilaina foana ny dokotera, fanampiny amin\'ny fitsaboana ny sakafo.'));
  }
  if (type === 'cholesterol') {
    lipPct = 0.3; fibres = 30;
    out.conseils.push(tr(`Graisses saturées < ${Math.round((kcal * 0.1) / 9)} g/jour (10 % des kcal) : pas de friture, peu de viande grasse, charcuterie et beurre ; avoine, légumineuses, poisson 2 fois/semaine.`, `Saturated fat < ${Math.round((kcal * 0.1) / 9)} g/day: no frying, little fatty meat; oats, legumes, fish twice a week.`, `Tavy saturé < ${Math.round((kcal * 0.1) / 9)} g isan'andro: tsy misy endasina, hena tsy misy tavy; avoine, voamaina, trondro indroa isan-kerinandro.`));
    if (n(p.ldl) >= 1.9) out.alertes.push(tr('LDL ≥ 1,9 g/L : avis médical recommandé.', 'LDL ≥ 1.9 g/L: medical advice recommended.', 'LDL ≥ 1,9 g/L: manatona dokotera.'));
  }
  if (type === 'senior' || age >= 65) {
    protKg = Math.max(protKg, 1.1);
    out.conseils.push(tr('Après 65 ans : protéines à chaque repas (1 à 1,2 g/kg/jour) pour garder les muscles, calcium et vitamine D, boire même sans soif.', 'After 65: protein at every meal (1-1.2 g/kg/day) to keep muscle, calcium and vitamin D, drink even without thirst.', 'Aorian\'ny 65 taona: proteinina isaky ny sakafo (1-1,2 g/kg), calcium sy vitamine D, misotroa rano na tsy mangetaheta aza.'));
    if (age >= 70 && I < 22) out.alertes.push(tr('IMC < 22 après 70 ans : risque de dénutrition, aucune perte de poids n\'est conseillée.', 'BMI < 22 after 70: undernutrition risk, no weight loss advised.', 'IMC < 22 aorian\'ny 70 taona: mety tsy ampy sakafo, tsy atoro ny fampihenana lanja.'));
  }
  if (type === 'anemie') {
    out.conseils.push(tr('Fer + vitamine C au même repas (viande rouge, foie avec modération, brèdes, haricots + agrumes, goyave, tomate). Thé et café à distance des repas.', 'Iron + vitamin C in the same meal; tea and coffee away from meals.', 'Fer + vitamine C amin\'ny sakafo iray ihany (hena mena, anana, tsaramaso + voasary, goavy). Dite sy kafe lavitra ny sakafo.'));
    const hb = n(p.hemoglobine);
    if (hb && hb < 8) out.alertes.push(tr('Hémoglobine < 8 g/dL : anémie sévère, consultez un médecin rapidement.', 'Hb < 8 g/dL: severe anaemia, see a doctor promptly.', 'Hémoglobine < 8: mankanesa any amin\'ny dokotera haingana.'));
    else out.alertes.push(tr('L\'alimentation aide mais un traitement en fer peut être nécessaire : à voir avec le médecin.', 'Diet helps but iron treatment may be needed: check with your doctor.', 'Manampy ny sakafo fa mety ilaina ny fanafody fer: jereo miaraka amin\'ny dokotera.'));
  }
  if (I >= 40) out.alertes.push(tr('IMC ≥ 40 : un accompagnement médical est recommandé en plus des repas.', 'BMI ≥ 40: medical support recommended alongside meals.', 'IMC ≥ 40: atoro ny fanaraha-maso ara-pahasalamana ankoatra ny sakafo.'));

  // ---- macros ----
  kcal = r10(kcal);
  const poidsRef = I > 27 ? poidsPourImc(27, taille) : poids; // poids « ajusté » en cas d'obésité
  const prot = Math.round(protKg * poidsRef);
  const lip = Math.round((kcal * lipPct) / 9);
  const glu = Math.max(0, Math.round(gluPct ? (kcal * gluPct) / 4 : (kcal - prot * 4 - lip * 9) / 4));
  out.kcal = kcal;
  out.macros = { proteines: prot, lipides: lip, glucides: glu, fibres: fibres || Math.round((kcal / 1000) * 14), sodium_max: sodium, eau_l: r1(Math.max(1.5, (type === 'allaitement' ? 0.035 : 0.03) * poids)) };
  out.conseils.push(tr(`Répartition conseillée : petit-déjeuner ${r10(kcal * 0.25)} kcal, déjeuner ${r10(kcal * 0.35)} kcal, dîner ${r10(kcal * 0.3)} kcal, collation ${r10(kcal * 0.1)} kcal.`, `Suggested split: breakfast ${r10(kcal * 0.25)}, lunch ${r10(kcal * 0.35)}, dinner ${r10(kcal * 0.3)}, snack ${r10(kcal * 0.1)} kcal.`, `Fizarana: maraina ${r10(kcal * 0.25)}, atoandro ${r10(kcal * 0.35)}, hariva ${r10(kcal * 0.3)}, tsakitsaky ${r10(kcal * 0.1)} kcal.`));

  // ---- tendance réelle (historique) ----
  if (histo.length >= 2) {
    const recent = histo.filter((m) => weeksBetween(m.date, today()) <= 6);
    const pts = recent.length >= 2 ? recent : histo.slice(-2);
    const a = pts[0]; const b = pts[pts.length - 1];
    const w = weeksBetween(a.date, b.date);
    if (w >= 0.9) {
      const rate = (n(b.poids) - n(a.poids)) / w;
      out.tendance = { rate: r1(rate), depuis: a.date };
      if (cible && Math.sign(cible - n(b.poids)) === Math.sign(rate) && Math.abs(rate) > 0.05) {
        const sem = Math.ceil(Math.abs(cible - n(b.poids)) / Math.abs(rate));
        out.tendance.date = addDays(today(), sem * 7);
      }
      if (out.prevision && out.prevision.rate < 0 && rate < -1.2) out.alertes.push(tr('Vous perdez plus de 1 kg par semaine depuis plusieurs semaines : nous augmentons un peu les portions pour protéger vos muscles.', 'You have been losing over 1 kg/week: we slightly increase portions to protect your muscles.', 'Mihena mihoatra ny 1 kg isan-kerinandro ianao: ampitomboinay kely ny anjara mba hiarovana ny hozatra.'));
    }
  }
  return out;
}

// Courbe de prévision : [{date, poids}] chaque semaine
export function courbePrevision(prev, depuis = today()) {
  if (!prev) return [];
  const pts = [];
  for (let s = 0; s <= prev.semaines; s++) {
    const pd = prev.depart + prev.rate * s;
    pts.push({ date: addDays(depuis, s * 7), poids: r1(prev.rate < 0 ? Math.max(pd, prev.cible) : Math.min(pd, prev.cible)) });
  }
  return pts;
}

export const NIVEAU = {
  ok: { tone: 'ok', icon: '✅' },
  attention: { tone: 'warn', icon: '⚠️' },
  irrealiste: { tone: 'bad', icon: '⛔' },
  medical: { tone: 'info', icon: '🩺' },
};

export const REFERENCES = [
  ['NICE CG189 — rythme de perte de poids 0,5 à 1 kg/semaine', 'https://www.nice.org.uk/guidance/cg189/ifp/chapter/How-much-weight-should-you-lose'],
  ['Mifflin-St Jeor (1990) — métabolisme de base', 'https://pubmed.ncbi.nlm.nih.gov/2305711/'],
  ['IOM 2009 — prise de poids pendant la grossesse selon l\'IMC', 'https://www.nationalacademies.org/read/12584/chapter/14'],
  ['IOM DRI — énergie grossesse (+340 / +452 kcal) et allaitement (+330 / +400 kcal)', 'https://depts.washington.edu/pwdlearn/revfirststeps/pdfs/2nutrienttable.pdf'],
  ['ISSN 2017 — protéines et exercice (1,4 à 2,0 g/kg)', 'https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8'],
  ['OMS — sodium < 2 g/jour (5 g de sel)', 'https://www.who.int/news-room/fact-sheets/detail/salt-reduction'],
  ['ADA Standards of Care — nutrition et diabète', 'https://diabetesjournals.org/care/issue'],
  ['HAS 2021 — dénutrition de la personne âgée (IMC < 22 après 70 ans)', 'https://www.has-sante.fr/jcms/p_3165944/fr/diagnostic-de-la-denutrition-chez-la-personne-de-70-ans-et-plus'],
];
