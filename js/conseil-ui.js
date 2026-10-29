// Composants partagés (back-office + application client) : profil, objectif, avis automatique, courbe de poids.
import { html } from './lib.js?v=202610290705';
import { Field, Badge } from './ui.js?v=202610290705';
import { tr } from './i18n.js?v=202610290705';
import { ACTIVITES, fmt, isoDate } from './calc.js?v=202610290705';
import { champsPour, ACTIVITE_LABELS, NIVEAU, courbePrevision, fmtDate, REFERENCES } from './conseil.js?v=202610290705';

const t3 = (l) => tr(l[0], l[1], l[2]);

// Champs communs + champs propres à l'objectif (ex. DPA pour la grossesse)
export function ProfilFields({ profil = {}, type, onChange, compact }) {
  const p = profil;
  const set = (k, v) => onChange({ ...p, [k]: v });
  return html`<div class="form-grid">
    <${Field} label=${tr('Sexe', 'Sex', 'Lahy/vavy')}><select value=${p.sexe || ''} onChange=${(e) => set('sexe', e.target.value)}><option value="">—</option><option value="F">${tr('Femme', 'Female', 'Vavy')}</option><option value="H">${tr('Homme', 'Male', 'Lahy')}</option></select><//>
    <${Field} label=${tr('Date de naissance', 'Date of birth', 'Daty nahaterahana')} hint=${p.age && !p.date_naissance ? tr(`ou âge : ${p.age} ans`, `or age: ${p.age}`, `na taona: ${p.age}`) : ''}><input type="date" value=${p.date_naissance || ''} max=${isoDate(new Date())} onInput=${(e) => set('date_naissance', e.target.value)} /><//>
    <${Field} label=${tr('Taille (cm)', 'Height (cm)', 'Halava (cm)')}><input type="number" inputmode="decimal" value=${p.taille ?? ''} onInput=${(e) => set('taille', e.target.value)} /><//>
    <${Field} label=${tr('Poids actuel (kg)', 'Current weight (kg)', 'Lanja ankehitriny (kg)')}><input type="number" inputmode="decimal" step="0.1" value=${p.poids ?? ''} onInput=${(e) => set('poids', e.target.value)} /><//>
    <${Field} label=${tr('Activité physique', 'Physical activity', 'Hetsika ara-batana')} wide><select value=${p.activite || 'sedentaire'} onChange=${(e) => set('activite', e.target.value)}>${ACTIVITES.map(([a]) => html`<option value=${a}>${t3(ACTIVITE_LABELS[a])}</option>`)}</select><//>
    ${champsPour(type).map((c) => html`<${Field} label=${t3(c.label)} key=${c.k} wide=${c.type === 'bool'}>
      ${c.type === 'select' ? html`<select value=${p[c.k] || ''} onChange=${(e) => set(c.k, e.target.value)}><option value="">—</option>${c.options.map(([v, l]) => html`<option value=${v}>${t3(l)}</option>`)}</select>`
        : c.type === 'bool' ? html`<span class="check"><input type="checkbox" checked=${!!p[c.k]} onChange=${(e) => set(c.k, e.target.checked)} /> ${tr('Oui', 'Yes', 'Eny')}</span>`
        : c.type === 'date' ? html`<input type="date" value=${p[c.k] || ''} onInput=${(e) => set(c.k, e.target.value)} />`
        : c.type === 'number' ? html`<div class="unit-in"><input type="number" inputmode="decimal" step="0.1" value=${p[c.k] ?? ''} onInput=${(e) => set(c.k, e.target.value)} />${c.unit && html`<small class="muted">${c.unit}</small>`}</div>`
        : html`<input value=${p[c.k] || ''} placeholder=${c.placeholder || ''} onInput=${(e) => set(c.k, e.target.value)} />`}
    <//>`)}
    ${!compact && html`<${Field} label=${tr('Problèmes de santé / remarques', 'Health issues / remarks', 'Olana ara-pahasalamana / fanamarihana')} wide><input value=${p.sante || ''} onInput=${(e) => set('sante', e.target.value)} placeholder=${tr('ex. ulcère, goutte, pas de piment…', 'e.g. ulcer, gout, no chilli…', 'ohatra: fery an-kibo, tsy misy sakay…')} /><//>`}
  </div>`;
}

// Avis automatique
export function AnalysePanel({ a, onUseKcal, showRefs }) {
  if (!a) return null;
  if (!a.ok) return html`<p class="muted small">${tr('Complétez pour obtenir l\'avis : ', 'Complete to get the advice: ', 'Fenoy mba hahazoana ny torohevitra: ')}<b>${a.manque.join(', ')}</b></p>`;
  const v = a.verdict;
  const N = v ? NIVEAU[v.niveau] || NIVEAU.ok : null;
  return html`<div class="analyse">
    ${v && html`<div class=${'verdict ' + N.tone}><b>${v.titre}</b><p>${v.texte}</p></div>`}
    <div class="kpis">
      <div class="kpi"><small>${tr('Calories / jour', 'Calories / day', 'Kcal / andro')}</small><b>${fmt(a.kcal)}</b>${onUseKcal && html`<button class="link-btn small" onClick=${() => onUseKcal(a.kcal)}>${tr('Utiliser', 'Use', 'Ampiasao')}</button>`}</div>
      <div class="kpi"><small>${tr('Protéines', 'Protein', 'Proteinina')}</small><b>${a.macros.proteines} g</b></div>
      <div class="kpi"><small>${tr('Glucides', 'Carbs', 'Gliosida')}</small><b>${a.macros.glucides} g</b></div>
      <div class="kpi"><small>${tr('Lipides', 'Fat', 'Tavy')}</small><b>${a.macros.lipides} g</b></div>
      <div class="kpi"><small>${tr('Fibres', 'Fibre', 'Fibres')}</small><b>≥ ${a.macros.fibres} g</b></div>
      <div class="kpi"><small>${tr('Eau', 'Water', 'Rano')}</small><b>${fmt(a.macros.eau_l, 1)} L</b></div>
      <div class="kpi"><small>IMC</small><b>${fmt(a.imc, 1)}</b><${Badge} tone=${a.imcInfo.tone}>${a.imcInfo.label}<//></div>
      <div class="kpi"><small>${tr('Poids santé', 'Healthy weight', 'Lanja salama')}</small><b>${fmt(a.poidsSain[0], 0)}–${fmt(a.poidsSain[1], 0)} kg</b></div>
    </div>
    ${a.grossesse && a.grossesse.trimestre && html`<div class="preg-bar"><div style=${{ width: Math.min(100, (a.grossesse.sa / 40) * 100) + '%' }}></div><span>${a.grossesse.sa} SA + ${a.grossesse.jours} j · DPA ${fmtDate(a.grossesse.dpa)}</span></div>`}
    ${a.tendance && html`<p class="small">📈 ${tr('Tendance réelle', 'Actual trend', 'Fandehany marina')} : <b>${a.tendance.rate > 0 ? '+' : ''}${fmt(a.tendance.rate, 1)} kg/${tr('semaine', 'week', 'herinandro')}</b>${a.tendance.date ? html` → ${tr('objectif vers le', 'goal around', 'tanjona manodidina ny')} <b>${fmtDate(a.tendance.date)}</b>` : null}</p>`}
    ${a.alertes.length > 0 && html`<ul class="alertes">${a.alertes.map((x) => html`<li>⚠️ ${x}</li>`)}</ul>`}
    ${a.conseils.length > 0 && html`<ul class="conseils">${a.conseils.map((x) => html`<li>💡 ${x}</li>`)}</ul>`}
    <p class="tiny muted">${tr('Avis automatique basé sur des recommandations publiées (Mifflin-St Jeor, NICE, IOM, OMS, ISSN). Il ne remplace pas un médecin ou un nutritionniste.', 'Automatic advice based on published guidelines. It does not replace a doctor or dietitian.', 'Torohevitra mandeha ho azy avy amin\'ny fenitra navoaka. Tsy misolo ny dokotera na nutritionniste.')}
      ${showRefs && html` <details><summary>${tr('Sources', 'Sources', 'Loharano')}</summary><ul>${REFERENCES.map(([l, u]) => html`<li><a href=${u} target="_blank" rel="noopener">${l}</a></li>`)}</ul></details>`}</p>
  </div>`;
}

// Courbe : historique (points) + prévision (pointillés) + cible
export function WeightChart({ mesures = [], prevision, cible, height = 180 }) {
  const histo = mesures.filter((m) => m.poids && m.date).map((m) => ({ date: m.date, poids: +m.poids })).sort((a, b) => a.date.localeCompare(b.date));
  const depuis = histo.length ? histo[histo.length - 1].date : isoDate(new Date());
  const prev = prevision ? courbePrevision({ ...prevision, depart: histo.length ? histo[histo.length - 1].poids : prevision.depart }, depuis) : [];
  const all = [...histo, ...prev];
  if (all.length < 2) return html`<p class="muted small">${tr('Ajoutez des pesées pour voir votre courbe.', 'Add weigh-ins to see your curve.', 'Ampidiro ny lanjanao mba hahitana ny fiolahana.')}</p>`;
  const W = 600; const H = height; const P = { l: 34, r: 10, t: 10, b: 22 };
  const ts = all.map((x) => Date.parse(x.date)); const t0 = Math.min(...ts); const t1 = Math.max(...ts) || t0 + 1;
  const vs = [...all.map((x) => x.poids), ...(cible ? [+cible] : [])]; const v0 = Math.floor(Math.min(...vs) - 1); const v1 = Math.ceil(Math.max(...vs) + 1);
  const X = (d) => P.l + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - v0) / (v1 - v0 || 1)) * (H - P.t - P.b);
  const path = (pts) => pts.map((x, i) => (i ? 'L' : 'M') + X(x.date).toFixed(1) + ' ' + Y(x.poids).toFixed(1)).join(' ');
  const ticks = [v0, Math.round((v0 + v1) / 2), v1];
  const months = [];
  for (let d = new Date(t0); d <= new Date(t1); d.setMonth(d.getMonth() + 1, 1)) months.push(isoDate(d));
  return html`<svg class="wchart" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${tr('Courbe de poids', 'Weight curve', 'Fiolahan\'ny lanja')}>
    ${ticks.map((v) => html`<g><line x1=${P.l} x2=${W - P.r} y1=${Y(v)} y2=${Y(v)} class="grid" /><text x=${P.l - 4} y=${Y(v) + 4} text-anchor="end">${v}</text></g>`)}
    ${months.slice(0, 14).map((d) => html`<text x=${X(d)} y=${H - 6} text-anchor="middle">${new Date(d).toLocaleDateString('fr-FR', { month: 'short' })}</text>`)}
    ${cible && html`<line x1=${P.l} x2=${W - P.r} y1=${Y(+cible)} y2=${Y(+cible)} class="target" /><text x=${W - P.r} y=${Y(+cible) - 4} text-anchor="end" class="target-t">${tr('objectif', 'goal', 'tanjona')} ${cible} kg</text>`}
    ${prev.length > 1 && html`<path d=${path(prev)} class="prev" />`}
    ${histo.length > 1 && html`<path d=${path(histo)} class="real" />`}
    ${histo.map((x) => html`<circle cx=${X(x.date)} cy=${Y(x.poids)} r="3.5" class="pt"><title>${fmtDate(x.date)} : ${x.poids} kg</title></circle>`)}
  </svg>
  <div class="legend small"><span class="lg real"></span> ${tr('Pesées', 'Weigh-ins', 'Lanja voarefy')} <span class="lg prev"></span> ${tr('Prévision', 'Forecast', 'Vinavina')} ${cible ? html`<span class="lg target"></span> ${tr('Objectif', 'Goal', 'Tanjona')}` : null}</div>`;
}
